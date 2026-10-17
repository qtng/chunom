#!/usr/bin/env python3
"""Record the one-syllable entries of dict.csv with Google Cloud Text-to-Speech.

  GOOGLE_TTS_KEY=... python3 tools/make_tts.py --out ../chunom-assets/audio/tts/vi-VN-Standard-A

Only files that do not exist yet are made, so it can be run again after dict.csv grew.
--list prints the syllables and file names without calling Google (no key needed).
The file name rule is the same as syllableFileName() in decks/audiomanager.js:
Telex letters (â=aa ê=ee ô=oo ă=aw ơ=ow ư=uw đ=dd) + tone digit 0 ngang, 1 sắc, 2 huyền, 3 hỏi, 4 ngã, 5 nặng.
"""
import argparse, base64, csv, json, os, re, sys, time, unicodedata, urllib.request

TONE = {'̀': 2, '́': 1, '̉': 3, '̃': 4, '̣': 5}
HERE = os.path.dirname(os.path.abspath(__file__))


def file_name(text):
    s = unicodedata.normalize('NFC', text.strip().lower()).replace('đ', 'd\0')
    if not re.fullmatch(r'[a-zà-ỹ\0]+', s):
        return None
    out, tone = '', 0
    for c in unicodedata.normalize('NFD', s):
        if c == '\0': out += 'd'
        elif c in TONE: tone = TONE[c]
        elif c == '̂': out += out[-1:]
        elif c in '̛̆': out += 'w'
        elif 'a' <= c <= 'z': out += c
        else: return None
    return out + str(tone)


def syllables():
    found = {}
    with open(os.path.join(HERE, '..', 'dict.csv'), encoding='utf-8') as f:
        for row in csv.reader(f):
            if row and row[0].strip() and ' ' not in row[0].strip():
                name = file_name(row[0])
                if name: found.setdefault(name, row[0].strip().lower())
    return found


def synthesize(text, key, voice):
    body = json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'vi-VN', 'name': voice},
                       'audioConfig': {'audioEncoding': 'MP3'}}).encode()
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + key,
                                 body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return base64.b64decode(json.load(r)['audioContent'])


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='.')
    ap.add_argument('--voice', default='vi-VN-Standard-A')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    todo = syllables()
    if a.list:
        for name, text in sorted(todo.items()): print(name, text)
        print(len(todo), 'syllables', file=sys.stderr); sys.exit()
    key = os.environ.get('GOOGLE_TTS_KEY')
    if not key: sys.exit('set GOOGLE_TTS_KEY')
    os.makedirs(a.out, exist_ok=True)
    made = 0
    for name, text in sorted(todo.items()):
        path = os.path.join(a.out, name + '.mp3')
        if os.path.exists(path): continue
        with open(path, 'wb') as f: f.write(synthesize(text, key, a.voice))
        made += 1; time.sleep(0.05)
    print(made, 'made,', len(todo) - made, 'already there')
