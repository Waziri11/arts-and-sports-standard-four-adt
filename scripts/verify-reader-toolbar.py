#!/usr/bin/env python3
"""Audit shared UI provenance, page installation, offline HTML and SCORM assets."""
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads(path.read_text(encoding='utf-8'))
record=read(ROOT/'scripts/reader-toolbar-reference.json')
config=read(ROOT/'assets/config.json')
pages=read(ROOT/'content/pages.json')
version=config['bundleVersion']
inline=json.JSONDecoder().raw_decode((ROOT/'assets/offline-preloader.js').read_text(encoding='utf-8').split('  var INLINE = ',1)[1])[0]
listed={node.attrib['href'] for node in ET.parse(ROOT/'imsmanifest.xml').iter() if node.tag.endswith('}file')}
for resource in record['files']:
    path=ROOT/resource['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==resource['sha256'],f'Reference UI was modified: {path}'
    assert resource['path'] in listed,f'Missing SCORM resource: {path}'
for page in pages:
    source=(ROOT/page['href']).read_text(encoding='utf-8')
    for name in ['reader-ui.css','mobile-sheet-drag.css','base.bundle.local.js','mobile-sheet-drag.js']:
        assert source.count(f'./assets/{name}?v={version}')==1,f'Missing or duplicate {name} on {page["href"]}'
    assert source.index('content/tailwind_output.css')<source.index('assets/reader-ui.css')
    assert source.index('assets/sign-language.js')<source.index('assets/base.bundle.local.js')<source.index('assets/mobile-sheet-drag.js')
    assert inline['./'+page['href']]==source,f'Stale offline page: {page["href"]}'
assert inline['./assets/config.json']==config
print(f'PASS: {len(pages)} pages have the current responsive toolbar; all {len(record["files"])} UI assets match the Writing Standard 1 reference and are included in SCORM.')
