#!/usr/bin/env python3
"""Audit every reading-order mapping, media file, and embedded video manifest."""
import argparse
import concurrent.futures
import json
from pathlib import Path
import re
import shutil
import subprocess
import urllib.request
import time
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--decode', action='store_true', help='Decode every local video completely')
parser.add_argument('--remote', action='store_true', help='Verify ranged bytes from every published media URL')
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / 'arts-sign-video-audit.json'))
parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg') or 'ffmpeg', help='FFmpeg executable')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
pages = json.loads((root / 'content/pages.json').read_text(encoding='utf-8'))
mappings = json.loads((root / 'content/i18n/en/videos.json').read_text(encoding='utf-8'))
config = json.loads((root / 'assets/config.json').read_text(encoding='utf-8'))
preloader = (root / 'assets/offline-preloader.js').read_text(encoding='utf-8')
inline = json.JSONDecoder().raw_decode(preloader.split('  var INLINE = ', 1)[1])[0]
assert config['features']['signLanguage']
assert inline['./assets/config.json'] == config
assert inline['./content/i18n/en/videos.json'] == mappings
assert set(mappings) == {f'video-{i}' for i in range(1, len(pages) + 1)}
tracked_media = {'videos/' + p.name for p in (root / 'videos').iterdir()}
source = (root / 'assets/sign-language.js').read_text(encoding='utf-8')
remote = re.search(r"var remoteBase = '([^']+)'", source)[1]
remote_files = json.loads(re.search(r'var remoteFiles = (\{[^\n]+\});', source)[1])

def probe(media):
    if shutil.which('ffprobe'):
        return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,pix_fmt', '-of', 'json', str(media)]))
    # FFmpeg distributions do not always include ffprobe (including on Windows).
    result = subprocess.run([args.ffmpeg, '-hide_banner', '-i', str(media)], capture_output=True, text=True)
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', result.stderr)
    stream_lines = [line for line in result.stderr.splitlines() if re.match(r'\s+Stream #', line)]
    assert duration and len(stream_lines) == 1, result.stderr
    video = re.search(r'Video: (\w+).*?(yuv420p)\b.*?, (\d+)x(\d+)', stream_lines[0])
    assert video, stream_lines[0]
    return {'format': {'duration': int(duration[1])*3600+int(duration[2])*60+float(duration[3]), 'size': media.stat().st_size},
            'streams': [{'codec_type':'video','codec_name':video[1],'pix_fmt':video[2],'width':int(video[3]),'height':int(video[4])}]}

def audit(item):
    position, page = item
    filename = mappings[f'video-{position}']
    media = root / 'videos' / filename
    row = {'position': position, 'page': page['href'], 'video': filename}
    try:
        assert 'videos/' + filename in tracked_media, 'Filename case does not match the committed media'
        html = (root / page['href']).read_text(encoding='utf-8')
        assert f'./assets/sign-language.js?v={config["bundleVersion"]}' in html
        assert html.index('assets/sign-language.js') < html.index('assets/base.bundle.local.js')
        assert f'./assets/offline-preloader.js?v={config["bundleVersion"]}' in html
        meta = re.search(r'<meta[^>]*name=["\']page-section-id["\'][^>]*content=["\'](\d+)', html) or re.search(r'<meta[^>]*content=["\'](\d+)["\'][^>]*name=["\']page-section-id', html)
        assert meta and int(meta[1]) == position
        data = probe(media)
        assert len(data['streams']) == 1 and data['streams'][0]['codec_type'] == 'video'
        assert data['streams'][0]['codec_name'] == 'h264' and data['streams'][0]['pix_fmt'] == 'yuv420p'
        assert float(data['format']['duration']) > 0
        row['metadata'] = data
        if args.decode:
            result = subprocess.run([args.ffmpeg, '-v', 'error', '-xerror', '-threads', '2', '-i', str(media), '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True)
            assert result.returncode == 0 and not result.stderr, result.stderr
            row['fullDecode'] = 'passed'
        if args.remote:
            url = remote + remote_files[filename] if filename in remote_files else 'https://waziri11.github.io/arts-and-sports-standard-four-adt/videos/' + filename
            request = urllib.request.Request(url, headers={'Range': 'bytes=0-1023'})
            for attempt in range(4):
                try:
                    response = urllib.request.urlopen(request, timeout=60)
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(2 ** (attempt + 1))
            with response:
                assert response.status == 206, response.status
                assert response.headers['Content-Range'] == f'bytes 0-1023/{media.stat().st_size}'
                with media.open('rb') as local:
                    assert response.read(1025) == local.read(1024)
                row['remoteRange'] = 'passed'
        row['passed'] = True
    except Exception as error:
        row.update(passed=False, error=str(error))
    print(f'{position}: {"PASS" if row["passed"] else row["error"]}', flush=True)
    return row

with concurrent.futures.ThreadPoolExecutor(max_workers=2 if args.remote else 4) as pool:
    rows = list(pool.map(audit, enumerate(pages, 1)))
Path(args.output).write_text(json.dumps(rows, indent=2) + '\n')
failures = [row for row in rows if not row['passed']]
print(f'{len(rows) - len(failures)}/{len(rows)} passed. Report: {args.output}')
raise SystemExit(bool(failures))
