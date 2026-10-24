"""Word-level transcription with faster-whisper (CPU, int8).

usage: transcribe.py <video> <out_words.json> <out_transcript.md> [--model large-v3] [--lang ar] [--prompt "..."]
Writes [{id, text, start, end, p}] plus a phrase-level markdown view (breaks on pauses >= 0.4 s)
that is the main thing to read when planning the edit.
"""
import argparse, json, sys

sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out_json"); ap.add_argument("out_md")
ap.add_argument("--model", default="large-v3"); ap.add_argument("--lang", default="ar")
ap.add_argument("--prompt", default="")
a = ap.parse_args()

from faster_whisper import WhisperModel

m = WhisperModel(a.model, device="cpu", compute_type="int8")
segs, info = m.transcribe(a.src, language=a.lang, word_timestamps=True, beam_size=5,
                          initial_prompt=a.prompt or None)
words = []
for s in segs:
    for w in s.words:
        words.append({"id": f"w{len(words)}", "text": w.word.strip(), "start": round(w.start, 3),
                      "end": round(w.end, 3), "p": round(w.probability, 2)})
json.dump(words, open(a.out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# phrase view: one line per phrase, low-confidence words marked with (?)
lines, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    if not nxt or nxt["start"] - w["end"] >= 0.4 or w["text"][-1:] in "،؟,.!?":
        txt = " ".join(x["text"] + ("(?)" if x["p"] < 0.6 else "") for x in cur)
        lines.append(f"[{cur[0]['start']:06.2f}-{cur[-1]['end']:06.2f}] {txt}")
        cur = []
with open(a.out_md, "w", encoding="utf-8") as f:
    f.write(f"# Transcript ({a.model}, {a.lang}) - {len(words)} words\n\n")
    f.write("Words marked (?) have confidence < 0.6: check them by ear and add fixes in reel.config.mjs.\n\n")
    f.write("\n".join(lines) + "\n")
print(len(words), "words ->", a.out_json)
