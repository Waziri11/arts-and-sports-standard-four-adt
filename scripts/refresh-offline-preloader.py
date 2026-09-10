#!/usr/bin/env python3
"""Refresh every existing embedded resource from its canonical book file."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'assets/offline-preloader.js'
source = path.read_text()
start = source.index('  var INLINE = ') + len('  var INLINE = ')
end = source.index(';\n', start)
resources = json.loads(source[start:end])
for key in resources:
    canonical = root / key.removeprefix('./')
    if canonical.is_file():
        resources[key] = json.loads(canonical.read_text()) if key.endswith('.json') else canonical.read_text()
source = source[:start] + json.dumps(resources, ensure_ascii=False, separators=(',', ':')) + source[end:]
path.write_text(source)
print(f'Refreshed {len(resources)} embedded resources')
