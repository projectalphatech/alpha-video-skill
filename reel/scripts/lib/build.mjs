// Split-screen reel engine: speaker on top (crop, jump-cut zooms, punches, flashes,
// karaoke captions), explainer scenes at the bottom, SFX and a ducked music bed.
// Everything video-specific comes from the project's reel.config.mjs.
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_COLORS = { bg: "#0b141a", card: "#111b21", inBub: "#202c33", outBub: "#005c4b", green: "#25d366", ink: "#e9edef", mute: "#8696a0", red: "#ff4d5e", blue: "#2f7bff" };
const GSAP = `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>`;
const clean = t => t.replace(/[،؟,.!?]/g, "");

// Word lookups used by configs. at() searches from h.FROM (the current beat) so a word
// repeated earlier in the video never pulls a scene's animation to the wrong time.
export function helpers(words, DUR, C) {
  const h = { words, DUR, C, FROM: 0, B: {} };
  h.at = txt => { const w = words.find(w => w.start >= h.FROM - 0.01 && clean(w.text) === txt); if (!w) throw new Error(`word "${txt}" not found after ${h.FROM}s`); return w.start; };
  h.atN = (txt, n = 0) => { const w = words.filter(w => clean(w.text) === txt)[n]; if (!w) throw new Error(`word "${txt}" #${n} not found`); return w.start; };
  h.w = h.atN;
  h.end = (txt, n = 0) => words.filter(w => clean(w.text) === txt)[n].end;
  h.L = (beat, t) => +(t - h.B[beat]).toFixed(3); // root time -> scene-local time
  return h;
}

const fontFace = fam => `@font-face{font-family:"${fam}";src:url("assets/fonts/ReadexPro.ttf") format("truetype");font-weight:200 700;}`;

// Shared UI kit for the bottom explainer: WhatsApp-style chat cards, bubbles, stamps, chips.
const baseCss = (C, dir, fam) => `
${fontFace(fam)}
#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;font-family:"${fam}",sans-serif;color:${C.ink};direction:${dir};}
#root *{box-sizing:border-box;}
.stage{position:absolute;left:0;right:0;top:960px;height:960px;}
.card{position:absolute;left:90px;right:90px;background:${C.card};border-radius:36px;border:2px solid #1f2c34;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden;}
.hdr{display:flex;align-items:center;gap:22px;padding:22px 30px;background:#202c33;}
.av{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:#0b141a;flex:none;}
.hname{font-size:34px;font-weight:600;line-height:1.2}
.hsub{font-size:24px;color:${C.mute}}
.msgs{position:relative;padding:26px 28px;display:flex;flex-direction:column;gap:18px;}
.b{max-width:76%;padding:16px 24px 12px;border-radius:26px;font-size:34px;line-height:1.4;position:relative;}
.b .t{display:block;font-size:20px;color:#aebac1;text-align:left;margin-top:4px;direction:ltr}
.in{align-self:flex-start;background:${C.inBub};border-top-right-radius:6px;transform-origin:right top;}
.out{align-self:flex-end;background:${C.outBub};border-top-left-radius:6px;transform-origin:left top;}
.stamp{position:absolute;padding:14px 40px;border:8px solid ${C.red};color:${C.red};font-size:64px;font-weight:700;border-radius:20px;background:rgba(11,20,26,.85);}
.h1{position:absolute;left:60px;right:60px;text-align:center;font-weight:700;line-height:1.2;text-wrap:balance;}
.chip{display:inline-flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;font-size:30px;font-weight:600;}
`;

function sceneFile(id, dur, base, css, html, js, lang) {
  return `<!doctype html>
<html lang="${lang}">
  <head><meta charset="UTF-8" /><title>${id}</title></head>
  <body>
    <template>
      <div id="root" data-composition-id="${id}" data-start="0" data-duration="${dur}" data-width="1080" data-height="1920">
        <style>${base}${css}</style>
        <div class="stage" id="${id}-stage">${html}</div>
        ${GSAP}
        <script>
          (function () {
            var R = document.querySelector('[data-composition-id="${id}"]');
            var $ = function (s) { return R.querySelector(s); };
            var $$ = function (s) { return R.querySelectorAll(s); };
            var D = ${dur};
            var tl = gsap.timeline({ paused: true });
            var pop = function (el, t, from) { tl.fromTo(el, Object.assign({ opacity: 0, scale: 0.75 }, from || {}), { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.18, ease: "back.out(2)" }, t); };
            gsap.set($("#${id}-stage"), { opacity: 1 });
            ${js}
            tl.to($("#${id}-stage"), { opacity: 0, duration: 0.1, ease: "power1.in" }, D - 0.1);
            window.__timelines = window.__timelines || {};
            window.__timelines["${id}"] = tl;
          })();
        </script>
      </div>
    </template>
  </body>
</html>
`;
}

function captionsFile(words, B, DUR, C, cap, fam, dir, lang) {
  const K = { maxWords: 3, top: 760, size: 80, pause: 0.15, accent: C.green, ...cap };
  const beatStarts = Object.values(B).slice(1, -1);
  const groups = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const n = words[i + 1];
    const brk = !n || /[،؟,.!?]$/.test(w.text) || n.start - w.end >= K.pause || cur.length >= K.maxWords || beatStarts.some(b => Math.abs(b - n.start) < 0.01);
    if (brk) { groups.push(cur); cur = []; }
  });
  const gHtml = groups.map((g, gi) => `<div class="cg" id="cg${gi}">${g.map((w, wi) => `<span class="cw" id="cw${gi}-${wi}">${w.text.replace(/[،,]$/, "")}</span>`).join(" ")}</div>`).join("\n");
  const gData = groups.map((g, gi) => ({ s: Math.max(0, g[0].start - 0.05), e: groups[gi + 1] ? Math.min(groups[gi + 1][0].start - 0.05, g.at(-1).end + 0.4) : DUR, w: g.map(w => [w.start, w.end]) }));
  const rgb = K.accent.replace("#", "").match(/../g).map(x => parseInt(x, 16)).join(",");
  return { count: groups.length, html: `<!doctype html>
<html lang="${lang}">
  <head><meta charset="UTF-8" /><title>captions</title></head>
  <body>
    <template>
      <div id="root" data-composition-id="captions" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">
        <style>
          ${fontFace(fam)}
          #root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;font-family:"${fam}",sans-serif;direction:${dir};}
          .cg{position:absolute;left:0;right:0;top:${K.top}px;text-align:center;opacity:0;overflow:visible;white-space:nowrap;}
          .cw{display:inline-block;font-size:${K.size}px;font-weight:700;color:#ffffff;padding:4px 14px;border-radius:18px;
            text-shadow:0 4px 0 rgba(0,0,0,.55),0 0 24px rgba(0,0,0,.6);-webkit-text-stroke:2px rgba(0,0,0,.35);}
        </style>
        ${gHtml}
        ${GSAP}
        <script>
          (function () {
            var G = ${JSON.stringify(gData)};
            var tl = gsap.timeline({ paused: true });
            G.forEach(function (g, gi) {
              var el = document.getElementById("cg" + gi);
              tl.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" }, g.s);
              g.w.forEach(function (w, wi) {
                var we = document.getElementById("cw" + gi + "-" + wi);
                tl.set(we, { color: "#ffffff", backgroundColor: "rgba(${rgb},0)", scale: 1 }, g.s);
                tl.to(we, { color: "#0b141a", backgroundColor: "rgba(${rgb},1)", scale: 1.12, duration: 0.08, ease: "power2.out" }, w[0]);
                tl.to(we, { color: "${K.accent}", backgroundColor: "rgba(${rgb},0)", scale: 1, duration: 0.12, ease: "power2.inOut" }, Math.max(w[0] + 0.1, w[1]));
              });
              tl.to(el, { opacity: 0, duration: 0.06, ease: "power2.in" }, g.e - 0.06);
              tl.set(el, { opacity: 0, visibility: "hidden" }, g.e);
            });
            window.__timelines = window.__timelines || {};
            window.__timelines["captions"] = tl;
          })();
        </script>
      </div>
    </template>
  </body>
</html>
` };
}

export function build(proj, cfg, { sfxLen = {} } = {}) {
  const P = p => path.join(proj, p);
  const words = JSON.parse(fs.readFileSync(P("assets/words.json"), "utf8"));
  const edl = JSON.parse(fs.readFileSync(P("assets/edl.json"), "utf8"));
  const DUR = +edl.duration.toFixed(2);
  const C = { ...DEFAULT_COLORS, ...(cfg.colors || {}) };
  const lang = cfg.lang ?? "ar", dir = cfg.dir ?? (lang === "ar" ? "rtl" : "ltr"), fam = "Readex Pro";
  const h = helpers(words, DUR, C);
  h.B = { ...cfg.beats(h), end: DUR };
  const B = h.B;
  const base = baseCss(C, dir, fam);

  fs.mkdirSync(P("compositions"), { recursive: true });
  for (const f of fs.readdirSync(P("compositions"))) if (/^s-.*\.html$/.test(f)) fs.rmSync(P("compositions/" + f));
  const scenes = cfg.scenes.map(s => {
    h.FROM = B[s.from];
    const { css = "", html = "", js = "" } = s.make(h);
    const dur = +(B[s.to] - B[s.from]).toFixed(3);
    if (dur <= 0) throw new Error(`scene ${s.id}: beat "${s.to}" is not after "${s.from}"`);
    fs.writeFileSync(P(`compositions/${s.id}.html`), sceneFile(s.id, dur, base, css, html, js, lang));
    return { ...s, start: B[s.from], dur };
  });
  h.FROM = 0;

  const cap = captionsFile(words, B, DUR, C, cfg.captions, fam, dir, lang);
  fs.writeFileSync(P("compositions/captions.html"), cap.html);

  // camera: crop the 16:9 source to the 1080x960 top half, centred on the face
  const cam = { wide: 0.95, tight: 1.22, push: 1.035, punch: 1.14, ...(cfg.camera || {}) };
  const face = cfg.face, faceY = cfg.faceTargetY ?? 500;
  const punches = (cfg.punches ? cfg.punches(h) : []).filter(t => t >= 0 && t < DUR);
  const flashes = (cfg.flashes || []).map(b => B[b]);
  const hosts = scenes.map(s => `      <div id="h-${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start.toFixed(3)}" data-duration="${s.dur.toFixed(3)}" data-track-kind="graphics" data-track-index="2"></div>`).join("\n");

  const SFXLEN = { pop: 0.7, whoosh: 0.6, click: 0.4, impact: 2.1, chime: 2.5, typing: 1.5, ...sfxLen };
  const cues = (cfg.sfx ? cfg.sfx(h, B) : []).filter(([, t]) => t < DUR - 0.05);
  const sfxHtml = cues.map(([n, t, v], i) => `      <audio id="sfx-${i}" class="clip" data-start="${Math.max(0, t).toFixed(3)}" data-duration="${Math.min(SFXLEN[n] ?? 1, DUR - Math.max(0, t)).toFixed(2)}" data-track-index="${5 + (i % 2)}" data-volume="${v}" data-audio-group="sfx" src="assets/sfx/${n}.mp3"></audio>`).join("\n");

  let bgm = "";
  if (fs.existsSync(P("assets/bgm/bed.m4a"))) {
    const m = { bed: 0.22, outro: 0.55, ...(cfg.music || {}) };
    const lastEnd = words.at(-1).end;
    const auto = { version: 1, lanes: [{ target: "volume", points: [{ t: 0, v: m.bed }, { t: +lastEnd.toFixed(2), v: m.bed }, { t: +(lastEnd + 0.3).toFixed(2), v: m.outro }, { t: DUR, v: m.outro }] }] };
    bgm = `      <audio id="bgm" class="clip" data-start="0" data-duration="${DUR}" data-track-index="4" data-audio-group="music" data-automation="${JSON.stringify(auto).replace(/"/g, "&quot;")}" src="assets/bgm/bed.m4a"></audio>`;
  }

  fs.writeFileSync(P("index.html"), `<!doctype html>
<html lang="${lang}" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    ${GSAP}
    <style>
      ${fontFace(fam)}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: ${C.bg}; }
      #root { position: relative; width: 1080px; height: 1920px; font-family: "${fam}", sans-serif; }
      #panel { position: absolute; left: 0; right: 0; top: 960px; height: 960px; background: radial-gradient(900px 500px at 50% 30%, ${C.panelGlow ?? "#143225"} 0%, ${C.bg} 70%); }
      #cam { position: absolute; left: 0; top: 0; width: 1080px; height: 960px; overflow: hidden; background: #000; }
      #camzoom { position: absolute; left: ${540 - face.x}px; top: ${faceY - face.y}px; width: ${cfg.srcW ?? 1920}px; height: ${cfg.srcH ?? 1080}px; }
      #talk { width: ${cfg.srcW ?? 1920}px; height: ${cfg.srcH ?? 1080}px; display: block; }
      #flash { position: absolute; left: 0; top: 0; width: 1080px; height: 960px; background: #fff; opacity: 0; }
      #seam { position: absolute; left: 0; right: 0; top: 957px; height: 6px; background: ${C.green}; box-shadow: 0 0 30px ${C.green}; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">
      <div id="panel"></div>
      <div id="cam">
        <div id="camzoom">
          <video id="talk" class="clip" data-start="0" data-duration="${DUR}" data-track-index="0" data-has-audio="true" src="assets/talk.mp4"></video>
        </div>
        <div id="flash"></div>
      </div>
      <div id="seam"></div>
${hosts}
      <div id="h-captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${DUR}" data-track-kind="captions" data-track-index="3"></div>
${sfxHtml}
${bgm}
    </div>
    <script>
      (function () {
        var tl = gsap.timeline({ paused: true });
        var cuts = ${JSON.stringify(edl.cuts)}, punches = ${JSON.stringify(punches)}, flashes = ${JSON.stringify(flashes)}, DUR = ${DUR};
        var WIDE = ${cam.wide}, TIGHT = ${cam.tight}, PUSH = ${cam.push}, PUNCH = ${cam.punch};
        var cz = document.getElementById("camzoom");
        gsap.set(cz, { transformOrigin: "${face.x}px ${face.y}px", scale: WIDE });
        // alternate wide / tight at every jump cut so cuts read as edits, slow push inside each piece
        cuts.forEach(function (c, i) {
          var base = i % 2 ? TIGHT : WIDE;
          var next = cuts[i + 1] !== undefined ? cuts[i + 1] : DUR;
          tl.set(cz, { scale: base }, c);
          tl.to(cz, { scale: base * PUSH, duration: Math.max(0.1, next - c - 0.02), ease: "none" }, c + 0.01);
        });
        // quick punch-in on key words, held until the next cut
        punches.forEach(function (p) {
          var i = cuts.filter(function (c) { return c <= p; }).length - 1;
          var base = i % 2 ? TIGHT : WIDE;
          var next = cuts[i + 1] !== undefined ? cuts[i + 1] : DUR;
          tl.to(cz, { scale: base * PUNCH, duration: 0.12, ease: "power3.out", overwrite: false }, p);
          tl.to(cz, { scale: base * (PUNCH + 0.03), duration: Math.max(0.1, next - p - 0.15), ease: "none" }, p + 0.12);
        });
        flashes.forEach(function (f) {
          tl.fromTo("#flash", { opacity: 0.75 }, { opacity: 0, duration: 0.18, ease: "power2.out", immediateRender: false }, f);
        });
        window.__timelines = window.__timelines || {};
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`);
  return { DUR, beats: B, scenes: scenes.length, captionGroups: cap.count, sfx: cues.length, music: !!bgm };
}
