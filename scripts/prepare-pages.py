#!/usr/bin/env python3
"""Validate local reader resources and stage a clean GitHub Pages directory."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ('src', 'href') and value:
                self.urls.append(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    destination = args.destination.resolve()
    if destination.exists():
        parser.error('Destination must be a new directory')

    files = set(ROOT.glob('*.html')) | {ROOT / 'cover.png', ROOT / '.nojekyll'}
    for folder in ('assets', 'content', 'images'):
        files.update(p for p in (ROOT / folder).rglob('*') if p.is_file())
    files.discard(ROOT / 'content/i18n/en/audio-generation.json')
    files.update(ROOT / 'videos' / name for name in ('page_1.mp4', 'page_81.mp4'))
    names = {p.relative_to(ROOT).as_posix() for p in files}
    missing = set()

    def require_url(url, source):
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or not parts.path:
            return
        path = (source.parent / unquote(parts.path)).resolve()
        try:
            relative = path.relative_to(ROOT).as_posix()
        except ValueError:
            missing.add(f'{source.name}: resource outside book: {url}')
            return
        if relative not in names:
            missing.add(f'{source.relative_to(ROOT)}: {url}')

    for path in files:
        if path.suffix == '.html':
            doc = References()
            doc.feed(path.read_text(encoding='utf-8'))
            for url in doc.urls:
                require_url(url, path)
        elif path.suffix == '.css':
            for url in re.findall(r'url\(\s*[\'"]?([^\'"\s)]+)', path.read_text(encoding='utf-8')):
                require_url(url, path)

    for path in (ROOT / 'content/i18n').glob('*/audios.json'):
        for name in json.loads(path.read_text(encoding='utf-8')).values():
            require_url('audio/' + name, path)
    for page in json.loads((ROOT / 'content/pages.json').read_text(encoding='utf-8')):
        require_url(page['href'], ROOT / 'index.html')
    if missing:
        raise SystemExit('Missing published resources:\n' + '\n'.join(sorted(missing)))
    size = sum(path.stat().st_size for path in files)
    if size >= 1_000_000_000:
        raise SystemExit('Published site exceeds the 1 GB deployment budget')
    for path in sorted(files):
        output = destination / path.relative_to(ROOT)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, output)
    print(f'Validated and staged {len(files)} reader files ({size / 1_000_000:.1f} MB) in {destination}')


if __name__ == '__main__':
    main()
