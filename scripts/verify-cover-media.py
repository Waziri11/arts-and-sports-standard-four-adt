#!/usr/bin/env python3
"""Verify page attachments, original media integrity, cover narration and packaging."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import urllib.request
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT/'content/i18n/en'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta={}; self.ids=[]; self.sources=[]; self.sections=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='meta': self.meta[attrs.get('name')]=attrs.get('content')
        if attrs.get('data-id'): self.ids.append(attrs['data-id'])
        if attrs.get('data-section-id'): self.sections.append(attrs['data-section-id'])
        for attribute in ['src','href']:
            if attrs.get(attribute) and not urlsplit(attrs[attribute]).scheme and not attrs[attribute].startswith('#'):
                self.sources.append(urlsplit(attrs[attribute]).path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',help='Also check page, video and new audio resources over HTTP')
    parser.add_argument('--ffmpeg',help='Fully decode new cover audio/video with this FFmpeg executable')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    pages=read(ROOT/'content/pages.json'); texts=read(I18N/'texts.json'); audios=read(I18N/'audios.json')
    videos=read(I18N/'videos.json'); spec=read(ROOT/'scripts/cover-narration.json')
    integrity=read(ROOT/'scripts/cover-media-integrity.json')
    errors=[]
    def require(condition,message):
        if not condition: errors.append(message)
    require(len(pages)==81,'Expected 81 reader positions')
    require(pages[0]['section_id']=='cover_sec001','Front cover must be first')
    require(pages[1]['href']=='pg001_sec001.html','Certificate must be second')
    require(pages[-1]['section_id']=='back_cover_sec001','Back cover must be last')
    require(len(set(p['href'] for p in pages))==len(pages),'Duplicate page URLs')
    require(set(videos)=={f'video-{i}' for i in range(1,82)},'Video mapping is not continuous')
    require({p.name for p in (ROOT/'videos').glob('*.mp4')}=={f'page_{i}.mp4' for i in range(1,82)},'Video filenames do not match reader pages')
    inline=json.JSONDecoder().raw_decode((ROOT/'assets/offline-preloader.js').read_text(encoding='utf-8').split('  var INLINE = ',1)[1])[0]
    for path in ['assets/config.json','content/pages.json','content/toc.json','content/i18n/en/texts.json','content/i18n/en/audios.json','content/i18n/en/videos.json']:
        require(inline.get('./'+path)==read(ROOT/path),'Stale offline manifest '+path)
    active=set(); cover_ids=set(); http_paths=set(); package_paths=set()
    for number,page in enumerate(pages,1):
        source=(ROOT/page['href']).read_text(encoding='utf-8'); dom=Page(); dom.feed(source)
        require(dom.meta.get('page-section-id')==str(number),'Wrong page position '+page['href'])
        require(dom.meta.get('title-id')==page['section_id'],'Wrong section metadata '+page['href'])
        require(page['section_id'] in dom.sections,'Wrong section attachment '+page['href'])
        require(inline.get('./'+page['href'])==source,'Stale offline page '+page['href'])
        require(videos.get(f'video-{number}')==f'page_{number}.mp4','Wrong video at '+str(number))
        for path in dom.sources:
            require((ROOT/path).is_file(),'Missing page resource '+path)
            package_paths.add(path.removeprefix('./'))
        for key in dom.ids:
            if not key.startswith(('pg','cover_','back_cover_')): continue
            active.add(key)
            require(key in texts,'Missing text '+key)
            require(not texts.get(key,'').strip() or key in audios,'Missing narration '+key)
            if number in (1,81): cover_ids.add(key)
        http_paths.update([page['href'],f'videos/page_{number}.mp4'])
        if number in (1,81): http_paths.update(path.removeprefix('./') for path in dom.sources)
    for key,name in audios.items():
        require((I18N/'audio'/name).is_file(),'Missing audio '+name)
        package_paths.add('content/i18n/en/audio/'+name)
    for key,mapping in integrity['audioMappings'].items():
        require(audios.get(key)==mapping['after'],'Existing narration attached to wrong text '+key)
    for row in integrity['audioFiles']:
        require(digest(I18N/'audio'/row['filename'])==row['sha256'],'Changed original narration '+row['filename'])
    for row in integrity['videos']:
        require(digest(ROOT/'videos'/row['filename'])==row['sha256'],'Changed video '+row['filename'])
        require(pages[row['position']-1]['section_id']==row['sectionId'],'Video moved to wrong section '+row['filename'])
    require(spec['voice']=='en-TZ-ImaniNeural' and spec['rate']=='-5%','Cover voice does not match existing Imani settings')
    require(cover_ids=={item['textId'] for item in spec['items']},'Cover content and narration differ')
    timecodes=read(I18N/'timecode/timecode_output.json')
    for item in spec['items']:
        path=I18N/'audio'/item['filename']
        require(digest(path)==item['sha256'],'Cover narration checksum mismatch '+item['filename'])
        for suffix in ['', '_easy_read']:
            key=item['textId']+suffix
            require(audios.get(key)==item['filename'] and texts.get(key)==item['text'],'Wrong cover narration mapping '+key)
            require(bool(timecodes.get(key,{}).get('timecodes')),'Missing cover word timings '+key)
        http_paths.add('content/i18n/en/audio/'+item['filename'])
    package_paths.update(http_paths)
    listed={node.attrib['href'] for node in ET.parse(ROOT/'imsmanifest.xml').iter() if node.tag.endswith('}file')}
    for path in package_paths: require(path in listed,'Missing SCORM resource '+path)
    decoded=0
    if args.ffmpeg:
        new_media=[I18N/'audio'/item['filename'] for item in spec['items']]+[ROOT/'videos/page_1.mp4',ROOT/'videos/page_81.mp4']
        def decode(path):
            process=subprocess.run([args.ffmpeg,'-v','error','-xerror','-threads','2','-i',str(path),'-f','null','-'],capture_output=True,text=True)
            return path,process
        with ThreadPoolExecutor(max_workers=4) as pool:
            for path,result in pool.map(decode,new_media):
                require(result.returncode==0 and not result.stderr,'Decode failed '+str(path)+': '+result.stderr)
                decoded+=1
    if args.base_url:
        def request(path):
            try:
                with urllib.request.urlopen(urllib.request.Request(args.base_url.rstrip('/')+'/'+path,method='HEAD'),timeout=20) as response:
                    return None if response.status==200 else f'HTTP {response.status}: {path}'
            except Exception as error: return f'HTTP {path}: {error}'
        with ThreadPoolExecutor(max_workers=8) as pool:
            for error in pool.map(request,sorted(http_paths)):
                if error: errors.append(error)
    report={'readerPages':len(pages),'videos':len(videos),'originalAudioFilesVerified':len(integrity['audioFiles']),
            'originalAudioMappingsVerified':len(integrity['audioMappings']),'activeNarrationIds':len(active),
            'newImaniClips':len(spec['items']),'newMediaFullyDecoded':decoded,
            'httpResourcesChecked':len(http_paths) if args.base_url else 0,'errors':errors}
    print(json.dumps(report,indent=2))
    if args.output: args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    raise SystemExit(bool(errors))

if __name__=='__main__': main()
