// Jump-cut montage: silence detection -> edit list -> one ffmpeg pass that cuts,
// grades (face key light) and cleans the voice -> word times remapped to the cut.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

// ffmpeg reports analysis (silencedetect, volumedetect, signalstats) on stderr
export const ffLog = args => spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr || "";

export function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration:format=duration", "-of", "json", file], { encoding: "utf8" });
  return JSON.parse(out);
}

export function maxDb(file, start, dur) {
  const m = ffLog(["-ss", String(start), "-t", String(Math.max(0.02, dur)), "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]).match(/max_volume: (-?[\d.]+) dB/);
  return m ? +m[1] : -91;
}

export function silences(file, db, minDur) {
  const log = ffLog(["-i", file, "-vn", "-af", `silencedetect=noise=${db}dB:d=${minDur}`, "-f", "null", "-"]);
  const s = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const e = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return s.map((v, i) => [v, e[i] ?? Infinity]);
}

// Face key light + overall lift. Brightens a soft oval around the face so a backlit
// room does not blow out. face = {x,y} in source pixels.
export function gradeChain(face, src, g = {}) {
  const { w, h } = src;
  const rx = g.radiusX ?? 400, ry = g.radiusY ?? 480;
  const E = `255*exp(-(pow((X/W*${w}-${face.x})/${rx},2)+pow((Y/H*${h}-${face.y + 40})/${ry},2)))`;
  const curve = g.lightCurve ?? "0/0 0.2/0.38 0.5/0.74 0.8/0.92 1/1";
  const eq = `eq=brightness=${g.brightness ?? 0.03}:contrast=${g.contrast ?? 1.08}:saturation=${g.saturation ?? 1.3}:gamma=${g.gamma ?? 1.18}`;
  const warm = g.warm === false ? "" : ",colorbalance=rs=0.03:bs=-0.03:rm=0.04:bm=-0.04";
  if (g.off) return "[v]null[vg]";
  return `[v]hqdn3d=2:1.5:4:3,split[o][b];[b]curves=all='${curve}'[lit];` +
    `color=c=black:s=${w}x${h}:d=1,format=yuv420p,geq=lum='${E}':cb='${E}':cr='${E}'[m];` +
    `[o][lit][m]maskedmerge,${eq}${warm},curves=all='0/0 0.07/0.045 1/1',unsharp=5:5:0.4[vg]`;
}

export function cut(proj, cfg) {
  const A = p => path.join(proj, "assets", p);
  const C = { silenceDb: -36, minGap: 0.25, pre: 0.1, post: 0.2, tail: 0.7, fade: 0.03, gapMaxDb: -40, ...(cfg.cut || {}) };
  const raw = A("raw.mp4");
  const rawWords = JSON.parse(fs.readFileSync(A("raw_words.json"), "utf8"));
  const src = probe(raw).streams.find(s => s.codec_type === "video");
  const lastW = rawWords.at(-1);
  const END = lastW.end + C.tail; // last word + room for its final consonant + a short hold

  const sil = [];
  for (const [s, e] of silences(raw, C.silenceDb, C.minGap)) { const p = sil.at(-1); if (p && s - p[1] < 0.02) p[1] = e; else sil.push([s, e]); }
  let keep = [], t = sil.length && sil[0][0] < 0.1 ? sil.shift()[1] - C.pre : 0;
  for (const [s, e] of sil) {
    if (s >= lastW.start) continue; // never trim the tail after the last word
    // whisper word ends often stretch across a pause: trust them only near the detected silence
    const prevEnd = Math.max(0, ...rawWords.filter(w => w.start < s).map(w => w.end));
    const nextStart = (rawWords.find(w => w.start >= e - 0.05) || { start: Infinity }).start;
    const a = Math.max(s + C.post, prevEnd <= s + 0.35 ? prevEnd + 0.12 : 0);
    const b = Math.min(e - C.pre, nextStart >= e - 0.35 ? nextStart - 0.06 : Infinity);
    if (b - a < 0.08) continue;
    if (a > t) keep.push([t, Math.min(a, END)]);
    t = b;
  }
  if (t < END) keep.push([t, END]);
  keep = keep.filter(([a, b]) => b - a > 0.05).map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]);

  // Gate: every removed gap must be near-silent, or a letter is being cut off.
  const bad = [];
  for (let i = 0; i < keep.length - 1; i++) {
    const g0 = keep[i][1], g1 = keep[i + 1][0];
    const db = maxDb(raw, g0, g1 - g0);
    if (db > C.gapMaxDb) bad.push({ gap: [g0, g1], db });
  }
  if (bad.length) console.warn("WARNING: sound inside removed gaps (possible clipped letters):", JSON.stringify(bad));

  const map = x => { let acc = 0; for (const [a, b] of keep) { if (x < a) return acc; if (x <= b) return acc + x - a; acc += b - a; } return acc; };
  const fixes = cfg.fixes || {};
  let words = [];
  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    const m = (cfg.merges || []).find(([x, y]) => w.text === x && rawWords[i + 1]?.text === y);
    if (m) { words.push({ text: m[2], start: w.start, end: rawWords[i + 1].end }); i++; continue; }
    words.push({ text: fixes[w.text] ?? w.text, start: w.start, end: w.end });
  }
  words = words.map((w, i) => ({ id: "w" + i, text: w.text, start: +map(Math.max(w.start, keep[0][0])).toFixed(3), end: +map(w.end).toFixed(3) }));
  for (let i = 0; i < words.length - 1; i++) words[i].end = Math.min(words[i].end, words[i + 1].start);

  const cuts = []; let acc = 0; for (const [a, b] of keep) { cuts.push(+acc.toFixed(3)); acc += b - a; }
  fs.writeFileSync(A("edl.json"), JSON.stringify({ keep, cuts, duration: +acc.toFixed(3), removedGapWarnings: bad }, null, 1));
  fs.writeFileSync(A("words.json"), JSON.stringify(words, null, 1));

  const F = C.fade;
  const parts = keep.map(([a, b], i) =>
    `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${F},afade=t=out:st=${(b - a - F).toFixed(3)}:d=${F}[a${i}]`);
  const voice = cfg.voice?.chain ?? `highpass=f=80,acompressor=threshold=-22dB:ratio=3:attack=10:release=150,loudnorm=I=${cfg.voice?.lufs ?? -15}:TP=-1.5:LRA=9`;
  const filter = parts.join(";") + ";" + keep.map((_, i) => `[v${i}][a${i}]`).join("") +
    `concat=n=${keep.length}:v=1:a=1[v][ac];${gradeChain(cfg.face, { w: src.width, h: src.height }, cfg.grade)};[ac]${voice}[a]`;
  fs.writeFileSync(A("cut.filter.txt"), filter);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-filter_complex_script", A("cut.filter.txt"), "-map", "[vg]", "-map", "[a]",
    "-r", String(cfg.fps ?? 30), "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", A("talk.mp4")], { stdio: "inherit" });
  console.log(`cut: ${keep.length} pieces, ${acc.toFixed(2)} s (source ${probe(raw).format.duration}s), cuts at ${cuts.join(", ")}`);
  return { keep, cuts, duration: acc, bad };
}

// Face/background brightness on one frame of talk.mp4 - target face Y 105-125, background < 200.
export function lumaReport(proj, cfg, at = 5) {
  const f = path.join(proj, "assets", "talk.mp4");
  const y = crop => (ffLog(["-ss", String(at), "-i", f, "-frames:v", "1", "-vf", `crop=${crop},signalstats,metadata=print:key=lavfi.signalstats.YAVG`, "-f", "null", "-"]).match(/YAVG=([\d.]+)/) || [])[1];
  const { x, y: fy } = cfg.face;
  return { face: +y(`300:340:${x - 150}:${fy - 160}`), background: +y(`300:400:${Math.max(0, x - 600)}:40`) };
}
