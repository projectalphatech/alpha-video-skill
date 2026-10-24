"""Search and download free, licensed media (real recorded SFX, music, images) from Openverse.

No API key needed (anonymous limit is about 100 requests a day; enough for one video).
Openverse indexes Freesound, Jamendo, Wikimedia, Flickr and more.

usage:
  python openverse.py audio "whoosh" [--n 10] [--max-sec 5] [--get 1,3] [--out assets/sfx]
  python openverse.py image "cairo skyline night" [--n 10] [--get 2] [--out assets/img]

Default filter: licences that allow commercial use (CC0, CC BY, CC BY-SA, PDM).
--get downloads the numbered results and appends a line per file to <out>/CREDITS.md.
CC BY / BY-SA need the credit line in the video description or project README.
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
API = "https://api.openverse.org/v1"
UA = {"User-Agent": "alpha-video/1.0 (Project Alpha Tech)"}

ap = argparse.ArgumentParser()
ap.add_argument("kind", choices=["audio", "image"])
ap.add_argument("q")
ap.add_argument("--n", type=int, default=10)
ap.add_argument("--max-sec", type=float, default=0, help="audio only: drop clips longer than this")
ap.add_argument("--cc0", action="store_true", help="CC0 / public domain only (no credit needed)")
ap.add_argument("--get", default="", help="comma list of result numbers to download")
ap.add_argument("--out", default=".")
a = ap.parse_args()

params = {"q": a.q, "page_size": min(max(a.n * 3, 20), 50)}
if a.cc0:
    params["license"] = "cc0,pdm"
else:
    params["license_type"] = "commercial"
if a.kind == "audio" and a.max_sec:
    params["duration"] = "short" if a.max_sec <= 240 else "medium"
url = f"{API}/{'audio' if a.kind == 'audio' else 'images'}/?{urllib.parse.urlencode(params)}"
def fetch(u, tries=4):  # anonymous API throttles bursts (429): back off and retry
    import time
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tries - 1:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 10 * (k + 1))


data = json.loads(fetch(url))

rows = []
for r in data["results"]:
    sec = (r.get("duration") or 0) / 1000
    if a.kind == "audio" and a.max_sec and sec and sec > a.max_sec:
        continue
    rows.append(r)
    if len(rows) >= a.n:
        break

for i, r in enumerate(rows, 1):
    extra = f"{(r.get('duration') or 0) / 1000:.1f}s" if a.kind == "audio" else f"{r.get('width')}x{r.get('height')}"
    print(f"{i:2}. [{r['license']}] {extra:>9}  {r['title'][:60]}  ({r['source']}, {r.get('creator') or '?'})")
print(f"{len(rows)} shown of {data['result_count']} results")

picks = [int(x) for x in a.get.split(",") if x.strip()]
if picks:
    os.makedirs(a.out, exist_ok=True)
    credits = open(os.path.join(a.out, "CREDITS.md"), "a", encoding="utf-8")
    for k in picks:
        r = rows[k - 1]
        ext = os.path.splitext(urllib.parse.urlparse(r["url"]).path)[1] or (".mp3" if a.kind == "audio" else ".jpg")
        name = re.sub(r"[^\w-]+", "-", r["title"].lower()).strip("-")[:40] + "-" + r["id"][:6] + ext
        dst = os.path.join(a.out, name)
        with open(dst, "wb") as f:
            f.write(fetch(r["url"]))
        credits.write(f"- `{name}`: {r.get('attribution') or r['title']} Source: {r.get('foreign_landing_url') or r['url']}\n")
        print("saved", dst)
