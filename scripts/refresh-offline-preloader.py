#!/usr/bin/env python3
"""Refresh every existing embedded resource from its canonical book file."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'assets/offline-preloader.js'
source = path.read_text(encoding='utf-8')
start = source.index('  var INLINE = ') + len('  var INLINE = ')
end = source.index(';\n', start)
resources = json.loads(source[start:end])
# Deleted resources must not survive as stale embedded copies.
resources = {key: value for key, value in resources.items()
             if (root / key.removeprefix('./')).is_file()}
# Newly inserted pages must be available to the same offline navigation path.
for page in json.loads((root / 'content/pages.json').read_text(encoding='utf-8')):
    resources.setdefault('./' + page['href'], '')
for key in resources:
    canonical = root / key.removeprefix('./')
    if canonical.is_file():
        resources[key] = json.loads(canonical.read_text(encoding='utf-8')) if key.endswith('.json') else canonical.read_text(encoding='utf-8')
source = source[:start] + json.dumps(resources, ensure_ascii=False, separators=(',', ':')) + source[end:]
path.write_text(source, encoding='utf-8')
print(f'Refreshed {len(resources)} embedded resources')
