#!/usr/bin/env node
// alpha-reel: talking-head -> split-screen vertical reel, fully in code.
//
//   node reel.mjs setup                       one-time: Python env (faster-whisper, MusicGen) + tool check
//   node reel.mjs init <video> <projectDir>   new HyperFrames project + assets + reel.config.mjs + face-check.jpg
//   node reel.mjs transcribe                  word timings -> assets/raw_words.json + transcript.md (cached)
//   node reel.mjs cut                         jump cuts + face light + voice -> assets/talk.mp4, words.json, edl.json
//   node reel.mjs music                       MusicGen bed looped to length -> assets/bgm/bed.m4a (cached by prompt)
//   node reel.mjs build                       index.html + scenes + captions + SFX + music from reel.config.mjs
//   node reel.mjs check                       hyperframes check (no GPU) -> errors / warnings
//   node reel.mjs snap [t1,t2,...]            snapshots (default: middle of every scene) -> snapshots/
//   node reel.mjs qa [from-to] [step]          dense time-labelled contact sheet of a range (any HyperFrames project) -> snapshots/qa-<from>-<to>/
//   node reel.mjs render                      final MP4 -> renders/<name>.mp4, then verify
//   node reel.mjs verify [file]               format, loudness, true peak, cut-boundary pops, cut contact sheet
//   node reel.mjs all                         cut -> music -> build -> check -> render -> verify
// Options: --dir <projectDir> (default: cwd)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cut, probe, maxDb, ffLog, lumaReport } from "./lib/cut.mjs";
import { build } from "./lib/build.mjs";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENV = process.env.ALPHA_REEL_VENV || path.join(process.env.USERPROFILE || process.env.HOME, ".alpha-reel", "venv");
const PY = path.join(VENV, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const DIR = path.resolve(opt("--dir") || process.cwd());
const [cmd, ...rest] = args;
const P = p => path.join(DIR, p);
const sh = (bin, a, o = {}) => execFileSync(bin, a, { stdio: "inherit", cwd: DIR, ...o });
// npx is a .cmd on Windows: run it through the shell as one quoted string
const q = a => /^[\w.:\/=,@+-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`;
const npx = (a, o = {}) => execSync(["npx", ...a].map(q).join(" "), { stdio: "inherit", cwd: DIR, maxBuffer: 1 << 26, ...o });
const hf = (a, o) => npx(["hyperframes", ...a], o);
const say = (...m) => console.log("[reel]", ...m);

async function loadConfig() {
  const f = P("reel.config.mjs");
  if (!fs.existsSync(f)) throw new Error("no reel.config.mjs in " + DIR);
  return (await import(pathToFileURL(f).href + "?t=" + Date.now())).default;
}

const steps = {
  setup() {
    for (const [b, a] of [["ffmpeg", ["-version"]], ["ffprobe", ["-version"]], ["node", ["--version"]]]) {
      const r = spawnSync(b, a, { encoding: "utf8" }); say(b, r.status === 0 ? "ok" : "MISSING");
    }
    if (!fs.existsSync(PY)) {
      say("creating Python env at", VENV, "(Python 3.10-3.12 needed; downloads ~1.5 GB)");
      const py = process.platform === "win32" ? ["py", ["-3.10", "-m", "venv", VENV]] : ["python3", ["-m", "venv", VENV]];
      sh(py[0], py[1]);
      sh(PY, ["-m", "pip", "install", "-q", "faster-whisper"]);
      sh(PY, ["-m", "pip", "install", "-q", "torch", "--index-url", "https://download.pytorch.org/whl/cpu"]);
      sh(PY, ["-m", "pip", "install", "-q", "transformers", "soundfile", "numpy", "scipy"]);
    }
    // alpha-video extras: Demucs (voice/music split). Pin the installed torch so pip never swaps it.
    if (spawnSync(PY, ["-c", "import demucs"]).status !== 0) {
      const tv = execFileSync(PY, ["-c", "import torch; print(torch.__version__)"], { encoding: "utf8" }).trim();
      const c = path.join(VENV, "torch-pin.txt"); fs.writeFileSync(c, `torch==${tv}
`);
      sh(PY, ["-m", "pip", "install", "-q", "demucs", "-c", c, "--extra-index-url", "https://download.pytorch.org/whl/cpu"]);
    }
    // declutter tool: filler + silence cutter (tools/declutter.py)
    if (spawnSync(PY, ["-c", "import whisper_timestamped, auto_editor"]).status !== 0) {
      const c = path.join(VENV, "torch-pin.txt");
      if (!fs.existsSync(c)) fs.writeFileSync(c, "torch==" + execFileSync(PY, ["-c", "import torch; print(torch.__version__)"], { encoding: "utf8" }).trim() + "\n");
      sh(PY, ["-m", "pip", "install", "-q", "auto-editor", "whisper-timestamped", "-c", c, "--extra-index-url", "https://download.pytorch.org/whl/cpu"]);
    }
    sh(PY, ["-c", "import faster_whisper, torch, transformers, demucs, whisper_timestamped, auto_editor; print('[reel] python env ok')"]);
    const blender = "C:/Program Files/Blender Foundation";
    say("blender", fs.existsSync(blender) ? fs.readdirSync(blender).join(", ") : "not installed (optional, for 3D titles)");
  },

  init([video, dir]) {
    if (!video || !dir) throw new Error("usage: init <video> <projectDir>");
    const proj = path.resolve(dir), parent = path.dirname(proj), name = path.basename(proj);
    // a folder that already holds a different project (index.html but no reel.config.mjs) must not be reused
    if (fs.existsSync(path.join(proj, "index.html")) && !fs.existsSync(path.join(proj, "reel.config.mjs")))
      throw new Error(`${proj} already holds another project - pick a new folder`);
    fs.mkdirSync(parent, { recursive: true });
    if (!fs.existsSync(path.join(proj, "index.html")))
      npx(["hyperframes", "init", name, "--example", "blank", "--resolution", "portrait", "--skip-transcribe", "--non-interactive"], { cwd: parent, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" } });
    const A = p => path.join(proj, "assets", p);
    for (const d of ["", "fonts", "sfx", "bgm"]) fs.mkdirSync(A(d), { recursive: true });
    fs.copyFileSync(path.resolve(video), A("raw.mp4"));
    fs.copyFileSync(path.join(SKILL, "assets/fonts/ReadexPro.ttf"), A("fonts/ReadexPro.ttf"));
    fs.copyFileSync(path.join(SKILL, "assets/pa-logo.png"), A("pa-logo.png"));
    for (const f of fs.readdirSync(path.join(SKILL, "assets/sfx"))) fs.copyFileSync(path.join(SKILL, "assets/sfx", f), A("sfx/" + f));
    if (!fs.existsSync(path.join(proj, "reel.config.mjs"))) fs.copyFileSync(path.join(SKILL, "templates/reel.config.mjs"), path.join(proj, "reel.config.mjs"));
    // a frame with a 100 px grid to read the face position (face.x / face.y in reel.config.mjs)
    spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", "5", "-i", A("raw.mp4"), "-frames:v", "1", "-vf", "drawgrid=w=100:h=100:t=1:c=red@0.6", A("face-check.jpg")]);
    const v = probe(A("raw.mp4"));
    fs.appendFileSync(path.join(proj, "project.md"), `# ${name}\n\n- ${new Date().toISOString().slice(0, 10)}: init from ${video} (${v.streams.find(s => s.codec_type === "video").width}x${v.streams.find(s => s.codec_type === "video").height}, ${(+v.format.duration).toFixed(1)} s)\n`);
    say("project ready:", proj, "- next: set face in reel.config.mjs from assets/face-check.jpg (100 px grid), then `reel transcribe`");
  },

  async transcribe() {
    const cfg = fs.existsSync(P("reel.config.mjs")) ? await loadConfig() : {};
    const raw = P("assets/raw.mp4"), st = fs.statSync(raw);
    const key = JSON.stringify({ size: st.size, mtime: st.mtimeMs, model: cfg.whisperModel ?? "large-v3", lang: cfg.lang ?? "ar" });
    if (fs.existsSync(P("assets/raw_words.json")) && fs.existsSync(P("assets/.transcribe.key")) && fs.readFileSync(P("assets/.transcribe.key"), "utf8") === key)
      return say("transcript cached (source unchanged) - read transcript.md");
    sh(PY, ["-I", path.join(SKILL, "scripts/py/transcribe.py"), raw, P("assets/raw_words.json"), P("transcript.md"),
      "--model", cfg.whisperModel ?? "large-v3", "--lang", cfg.lang ?? "ar", "--prompt", cfg.whisperPrompt ?? ""]);
    fs.writeFileSync(P("assets/.transcribe.key"), key);
    say("read transcript.md, then put misheard words in reel.config.mjs `fixes` and map the beats");
  },

  async cut() {
    const cfg = await loadConfig();
    const r = cut(DIR, cfg);
    const l = lumaReport(DIR, cfg, Math.min(5, r.duration / 2));
    say(`brightness: face Y ${l.face} (target 105-125), background Y ${l.background} (keep < 200)`);
    if (r.bad.length) say("FIX BEFORE GOING ON: sound inside removed gaps - raise cut.post or lower cut.silenceDb");
  },

  async music() {
    const cfg = await loadConfig();
    const m = cfg.music || {};
    if (m.off) return say("music off");
    const edl = JSON.parse(fs.readFileSync(P("assets/edl.json"), "utf8"));
    const D = (edl.duration + 0.2).toFixed(2);
    const seed = P("assets/bgm/seed.wav"), keyF = P("assets/bgm/.key"), key = JSON.stringify({ p: m.prompt, s: m.seed ?? 7 });
    if (m.file) fs.copyFileSync(path.resolve(DIR, m.file), seed);
    else if (!(fs.existsSync(seed) && fs.existsSync(keyF) && fs.readFileSync(keyF, "utf8") === key)) {
      say("generating music (MusicGen on CPU, a few minutes)...");
      sh(PY, ["-I", path.join(SKILL, "scripts/py/bgm.py"), seed, m.prompt ?? "upbeat modern tech advertisement background music, bright plucked synths, warm pads, light punchy drums, confident and positive, 112 bpm, no vocals", "28", String(m.seed ?? 7)]);
      fs.writeFileSync(keyF, key);
    }
    const sd = +probe(seed).format.duration;
    const loops = Math.max(1, Math.ceil(D / (sd - 2)));
    const inputs = Array.from({ length: loops }, () => ["-i", seed]).flat();
    let fc = loops === 1 ? "[0]anull[x]" : Array.from({ length: loops - 1 }, (_, i) => `${i ? `[x${i}]` : "[0]"}[${i + 1}]acrossfade=d=2:c1=tri:c2=tri[x${i + 1}]`).join(";").replace(new RegExp(`\\[x${loops - 1}\\]$`), "[x]");
    fc += `;[x]atrim=0:${D},afade=t=in:d=0.25,afade=t=out:st=${(D - 1.6).toFixed(2)}:d=1.6,aresample=48000[a]`;
    execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", P("assets/bgm/bed.m4a")]);
    say("music bed:", D, "s");
  },

  async build() {
    const cfg = await loadConfig();
    const r = build(DIR, cfg);
    say(`built ${r.scenes} scenes, ${r.captionGroups} caption groups, ${r.sfx} SFX, music ${r.music ? "on" : "none"}, ${r.DUR} s`);
    say("beats:", JSON.stringify(Object.fromEntries(Object.entries(r.beats).map(([k, v]) => [k, +v.toFixed(2)]))));
  },

  check() {
    // GPU capture times out on this machine; software capture is reliable
    let s = ""; try { s = npx(["hyperframes", "check", "--no-browser-gpu", "--json"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }); } catch (e) { s = String(e.stdout || ""); if (!s) console.error(String(e.stderr || e.message).slice(-1500)); }
    let j; try { j = JSON.parse(s.slice(s.indexOf("{"))); } catch { console.log(s.slice(-3000)); throw new Error("check output unreadable"); }
    const items = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.severity && (o.message || o.code)) items.push(o); Object.values(o).forEach(walk); } })(j);
    const seen = new Set();
    for (const x of items) { const k = x.code + x.message + x.selector; if (seen.has(k) || /WebGL|GPU stall/.test(x.message)) continue; seen.add(k); console.log(`${x.severity}\t${x.code}\t${x.selector || ""}\t${x.time ?? ""}\t${(x.message || "").slice(0, 140)}`); }
    const errors = items.filter(x => x.severity === "error").length;
    say("check:", errors, "errors");
    if (errors) process.exitCode = 1;
  },

  async snap([at]) {
    let times = at;
    if (!times) {
      const cfg = await loadConfig();
      const r = build(DIR, cfg);
      const b = Object.values(r.beats).sort((x, y) => x - y);
      times = b.slice(0, -1).map((v, i) => ((v + b[i + 1]) / 2).toFixed(2)).join(",");
    }
    fs.rmSync(P("snapshots"), { recursive: true, force: true });
    hf(["snapshot", "--no-browser-gpu", "--no-end", "--at", times, "-o", "snapshots"]);
    say("look at snapshots/contact-sheet*.jpg");
  },

  // QA sheet (from papercut-explainer's qa.sh): every `step` s of a range, so fast moves and cuts that fall between scene snapshots show up.
  // A cut: `qa 22.4-22.9 0.033` (every frame). A scene: its range, step ~ length / 6. Works on any HyperFrames project, no reel.config needed.
  qa([range, step]) {
    const root = fs.readFileSync(P("index.html"), "utf8").match(/<[^>]*data-composition-id="main"[^>]*>/)?.[0] || "";
    const dur = +(root.match(/data-duration="([\d.]+)"/)?.[1] ?? NaN);
    const [a, b] = range ? range.split("-").map(Number) : [0, dur];
    if (!(b > a)) throw new Error("usage: qa [from-to] [step] - got range " + range + " (duration " + dur + ")");
    const st = Math.max(1 / 30, +step || (b - a) / 24);
    const times = []; for (let t = a; t <= b + 1e-6 && times.length < 60; t += st) times.push(t.toFixed(3));
    const out = `snapshots/qa-${a}-${b}`;
    fs.rmSync(P(out), { recursive: true, force: true });
    hf(["snapshot", "--no-browser-gpu", "--no-end", "--describe", "false", "--at", times.join(","), "-o", out]);
    say(`${times.length} frames - look at ${out}/contact-sheet*.jpg (each frame is labelled with its time)`);
  },

  async render() {
    const name = path.basename(DIR);
    hf(["render", "--no-browser-gpu", "-f", "30", "-q", "delivery", "-o", `renders/${name}.mp4`]);
    await steps.verify([P(`renders/${name}.mp4`)]);
  },

  async verify([file]) {
    file = file || P(`renders/${path.basename(DIR)}.mp4`);
    const edl = JSON.parse(fs.readFileSync(P("assets/edl.json"), "utf8"));
    const p = probe(file), v = p.streams.find(s => s.codec_type === "video"), a = p.streams.find(s => s.codec_type === "audio");
    const fails = [];
    if (v.width !== 1080 || v.height !== 1920) fails.push(`size ${v.width}x${v.height}`);
    if (v.r_frame_rate !== "30/1") fails.push(`fps ${v.r_frame_rate}`);
    if (!a) fails.push("no audio");
    if (Math.abs(+p.format.duration - edl.duration) > 0.3) fails.push(`duration ${p.format.duration} vs edit ${edl.duration}`);
    const log = ffLog(["-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
    const I = +(log.match(/I:\s+(-?[\d.]+) LUFS/g) || []).at(-1)?.match(/-?[\d.]+/)[0];
    const TP = +(log.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).at(-1)?.match(/-?[\d.]+/)[0];
    if (!(I > -17 && I < -13)) fails.push(`loudness ${I} LUFS (want -16..-14)`);
    if (TP > -0.5) fails.push(`true peak ${TP} dBFS`);
    // a pop at a cut shows as a peak right at the boundary well above the speech just before it
    const pops = edl.cuts.slice(1).map(c => ({ c, at: maxDb(file, c - 0.03, 0.06), before: maxDb(file, c - 0.6, 0.5) })).filter(x => x.at > x.before + 6);
    if (pops.length) fails.push("possible pops at cuts " + pops.map(x => x.c).join(", "));
    // top-half frames either side of every cut, for a visual jump check
    const sel = edl.cuts.slice(1).flatMap(c => [c - 0.1, c + 0.1]).map(t => `between(t\\,${t.toFixed(2)}\\,${(t + 0.034).toFixed(2)})`).join("+");
    if (sel) spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `select='${sel}',crop=1080:960:0:0,scale=360:-1,tile=4x${Math.ceil(edl.cuts.length / 2)}`, "-frames:v", "1", "-fps_mode", "vfr", P("renders/cuts-check.jpg")]);
    say(`verify: ${v.width}x${v.height} ${v.r_frame_rate} ${(+p.format.duration).toFixed(2)}s, ${I} LUFS, TP ${TP} dBFS`);
    say(fails.length ? "VERIFY FAILED: " + fails.join("; ") : "verify passed - cut frames in renders/cuts-check.jpg");
    if (fails.length) process.exitCode = 1;
    fs.appendFileSync(P("project.md"), `- ${new Date().toISOString().slice(0, 16)}: render ${path.basename(file)} ${(+p.format.duration).toFixed(1)}s ${I} LUFS ${fails.length ? "FAILED " + fails.join("; ") : "verified"}\n`);
  },

  async all() {
    await steps.cut(); await steps.music(); await steps.build();
    steps.check(); if (process.exitCode) throw new Error("check failed - fix before render");
    await steps.render();
  },
};

if (!steps[cmd]) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 16).join("\n")); process.exit(cmd ? 1 : 0); }
await steps[cmd](rest);
