#!/usr/bin/env python3
"""Generate and register the cover narration with the existing Imani voice."""
import asyncio
from datetime import date
import hashlib
import json
from pathlib import Path

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / 'content/i18n/en'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

async def main():
    spec = read(ROOT/'scripts/cover-narration.json')
    semaphore = asyncio.Semaphore(3)
    timecodes = read(I18N/'timecode/timecode_output.json')

    async def generate(item):
        path = I18N/'audio'/item['filename']
        fingerprint = hashlib.sha256(json.dumps([item['spokenText'], spec['voice'], spec['rate'], spec['pitch']]).encode()).hexdigest()
        if item.get('fingerprint') == fingerprint and path.is_file() and item.get('sha256') == hashlib.sha256(path.read_bytes()).hexdigest():
            return
        async with semaphore:
            for attempt in range(4):
                data = bytearray()
                words = []
                try:
                    speech = edge_tts.Communicate(item['spokenText'], spec['voice'], rate=spec['rate'], pitch=spec['pitch'], boundary='WordBoundary')
                    async for event in speech.stream():
                        if event['type'] == 'audio':
                            data.extend(event['data'])
                        elif event['type'] == 'WordBoundary':
                            words.append({'text':event['text'], 'start':round(event['offset']/10_000_000,3),
                                          'end':round((event['offset']+event['duration'])/10_000_000,3)})
                    assert len(data) > 768 and words, 'Empty narration'
                    temporary = path.with_suffix('.tmp.mp3')
                    temporary.write_bytes(data)
                    duration = MP3(temporary).info.length
                    assert duration > 0
                    temporary.replace(path)
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    await asyncio.sleep(2*(attempt+1))
            entry = {'timecodes':[None, {'word_timestamps':words}]}
            timecodes[item['textId']] = timecodes[item['textId']+'_easy_read'] = entry
            item.update(duration=round(duration,3), sha256=hashlib.sha256(data).hexdigest(),
                        fingerprint=fingerprint, voice=spec['voice'], wordCount=len(words), status='generated')
            print(f'{item["filename"]}: {duration:.2f}s', flush=True)

    await asyncio.gather(*(generate(item) for item in spec['items']))
    spec['generatedOn'] = date.today().isoformat()
    write(ROOT/'scripts/cover-narration.json',spec)
    write(I18N/'timecode/timecode_output.json',timecodes)
    generation = read(I18N/'audio-generation.json')
    audios = read(I18N/'audios.json')
    generation['mappedTextIds'] = len(audios)
    generation['distinctAudioFiles'] = len(set(audios.values()))
    generation['silentEmptyTextFiles'] = sorted({audios[key] for key,text in read(I18N/'texts.json').items() if not text.strip() and key in audios})
    generation['generatedVoicedFiles'] = generation['distinctAudioFiles']-len(generation['silentEmptyTextFiles'])
    generation['coverNarration'] = {'generatedOn':spec['generatedOn'], 'voice':spec['voice'], 'rate':spec['rate'],
                                   'clipCount':len(spec['items']), 'manifest':'scripts/cover-narration.json'}
    write(I18N/'audio-generation.json',generation)
    print(f'Generated {len(spec["items"])} Imani clips; registered normal and Easy Read narration.')

if __name__ == '__main__':
    asyncio.run(main())
