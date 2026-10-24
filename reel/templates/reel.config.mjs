// reel.config.mjs - everything specific to ONE video. The engine (alpha-reel) reads this.
// Worked example: NORA "two problems" reel (Arabic, 2026-10-24). For a new video keep the
// structure, rewrite fixes / beats / scenes / punches / sfx from the new transcript.
//
// Helpers passed as h:
//   h.at("word")        start time of the first match at/after the current scene's beat (use inside scenes)
//   h.atN("word", n)    start time of the n-th match in the whole video (use for beats/punches/sfx)
//   h.L(beat, t)        root time -> time inside the scene that starts at `beat`
//   h.C                 colours, h.B beats, h.DUR length, h.words all words
// Word matching ignores punctuation (، ؟ , . ! ?).
export default {
  lang: "ar",
  whisperModel: "large-v3",
  whisperPrompt: "نورا، Project Alpha Tech، واتساب، بكام؟", // names/terms to bias spelling

  // Face centre in SOURCE pixels (read off assets/face-check.jpg, 100 px grid). Drives crop + face light.
  face: { x: 1090, y: 560 },

  // Jump cuts. post = air kept after speech drops below silenceDb (protects soft final consonants).
  cut: { silenceDb: -36, minGap: 0.25, pre: 0.1, post: 0.2, tail: 0.7, fade: 0.03, gapMaxDb: -40 },

  // Face key light + overall lift. Targets: face Y 105-125, background < 200 (printed by `reel cut`).
  grade: { lightCurve: "0/0 0.2/0.38 0.5/0.74 0.8/0.92 1/1", radiusX: 400, radiusY: 480, brightness: 0.03, contrast: 1.08, saturation: 1.3, gamma: 1.18 },
  voice: { lufs: -15 },

  // Whisper misspellings -> what he actually said (captions show these).
  fixes: { "بيبيع": "بتبيع", "الاثنين،": "الاتنين،", "اشتراك": "اشترى", "نوعية": "ناوية", "بيحافظ": "بيحفظ", "تسألته،": "تسأله،", "ابعلتنا": "ابعتلنا", "اكيد": "أكيد", "الاولى": "الأولى", "اسئلة": "أسئلة", "الاسئلة": "الأسئلة", "اصلا": "أصلاً", "بكام": "بكام؟" },
  merges: [["اي", "اي", "AI"]], // two whisper tokens -> one word

  captions: { maxWords: 3, top: 760, size: 80 },
  camera: { wide: 0.95, tight: 1.22, push: 1.035, punch: 1.14 },
  music: { prompt: "upbeat modern tech advertisement background music, bright plucked synths, warm pads, light punchy drums, confident and positive, 112 bpm, no vocals", seed: 7, bed: 0.22, outro: 0.55 },

  // Story beats (root seconds). Scenes run from one beat to the next.
  beats: h => ({
    hook: 0,
    p1: h.atN("الأولى"),
    p2: h.atN("والمشكلة"),
    sol: h.atN("ايه"),
    bot: h.atN("نورا", 1),
    smart: h.atN("بيفهم"),
    filter: h.atN("بيفلتر"),
    cta: h.atN("لو", 1),
  }),
  flashes: ["p1", "p2", "sol", "cta"], // white flash on the top half at these beats
  punches: h => [h.atN("الاتنين"), h.atN("بساعتين"), h.atN("بكام"), h.atN("نورا"), h.atN("AI"), h.atN("بس", 1), h.atN("ونورا")],

  // [name, time, volume]; names = files in assets/sfx (pop whoosh click impact chime typing)
  sfx: (h, B) => [
    ["pop", h.atN("مشكلة"), 0.35], ["pop", h.atN("الاتنين"), 0.35],
    ...[B.p1, B.p2, B.sol, B.cta].map(t => ["whoosh", t - 0.12, 0.3]),
    ["pop", h.atN("العميل"), 0.35], ["click", h.atN("ترد") + 0.1, 0.4], ["pop", h.atN("بساعتين") + 0.25, 0.35], ["pop", h.atN("اشترى") - 0.1, 0.35], ["impact", h.atN("غيرك"), 0.3],
    ["pop", h.atN("بترد"), 0.25], ["pop", h.atN("بكام"), 0.3], ["pop", h.atN("فين"), 0.25], ["pop", h.atN("ناس"), 0.25], ["impact", h.atN("ناوية"), 0.3],
    ["chime", h.atN("نورا"), 0.35],
    ["pop", h.atN("بوت"), 0.3], ["pop", h.atN("بيحفظ"), 0.3], ["pop", h.atN("وبيرد"), 0.3], ["impact", h.atN("لأ"), 0.3], ["whoosh", h.atN("AI") - 0.1, 0.3],
    ["pop", h.atN("العميل", 1), 0.3], ["typing", h.atN("وبيرد", 1) - 0.2, 0.25], ["pop", h.atN("الأسئلة") - 0.3, 0.35], ["pop", h.atN("تسأله"), 0.3],
    ["click", h.atN("كل") + 0.38, 0.35], ["click", h.atN("جاهزة") - 0.2, 0.35],
    ["pop", h.atN("ابعتلنا"), 0.4], ["chime", h.atN("بنفسها"), 0.3],
  ],

  // Bottom-half explainer scenes. Each make(h) returns { css, html, js }.
  // In js: tl (scene timeline), $ / $$ (query inside the scene), pop(el, t, from), D (scene length).
  // Ids/classes are prefixed per scene. Set start states with gsap.set; animate with tl.
  scenes: [
    { id: "s-hook", from: "hook", to: "p1", make: h => { const { C, L, at } = h; return {
      css: `
.hk-ico{position:absolute;left:50%;top:70px;width:200px;height:200px;margin-left:-100px;}
.hk-badge{position:absolute;top:-6px;left:-6px;min-width:76px;height:76px;border-radius:38px;background:${C.red};color:#fff;font-size:40px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 14px;direction:ltr}
.hk-title{top:330px;font-size:128px;white-space:nowrap;}
.hk-title b{color:${C.red}}
.hk-row{position:absolute;top:540px;left:0;right:0;display:flex;justify-content:center;gap:40px;}
.hk-n{width:150px;height:150px;border-radius:50%;border:6px solid ${C.red};color:${C.red};font-size:90px;font-weight:700;display:flex;align-items:center;justify-content:center;}`,
      html: `
<div class="hk-ico" id="hk-ico">
  <svg viewBox="0 0 100 100" width="200" height="200"><circle cx="50" cy="50" r="46" fill="${C.green}"/><path d="M30 34h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H48l-12 10v-10h-6a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" fill="#0b141a"/></svg>
  <div class="hk-badge" id="hk-badge">12</div>
</div>
<div class="h1 hk-title" id="hk-title">عندك <b>مشكلتين</b></div>
<div class="hk-row"><div class="hk-n" id="hk-n1">١</div><div class="hk-n" id="hk-n2">٢</div></div>`,
      js: `
tl.fromTo($("#hk-title"), { scale: 1.08 }, { scale: 1, duration: 0.6, ease: "power3.out" }, 0);
tl.fromTo($("#hk-ico"), { y: 10 }, { y: 0, duration: 0.6, ease: "power3.out" }, 0);
var n = { v: 12 }; var badge = $("#hk-badge");
tl.to(n, { v: 99, duration: 1.6, ease: "power2.in", onUpdate: function () { badge.textContent = Math.round(n.v) >= 99 ? "99+" : Math.round(n.v); } }, 0.2);
pop($("#hk-n1"), ${L("hook", at("مشكلة"))});
pop($("#hk-n2"), ${L("hook", at("الاتنين"))});` }; } },

    { id: "s-p1", from: "p1", to: "p2", make: h => { const { C, L, at } = h; return {
      css: `
.p1-label{position:absolute;top:24px;left:0;right:0;text-align:center}
.p1-card{top:110px;height:700px;}
.p1-clock{position:absolute;top:120px;left:110px;width:150px;height:150px;border-radius:50%;background:#fff;border:8px solid ${C.red};z-index:5}
.p1-hand{position:absolute;left:50%;top:50%;width:8px;margin-left:-4px;background:#0b141a;border-radius:4px;transform-origin:50% 100%;}
.p1-hh{height:38px;margin-top:-38px}.p1-mh{height:56px;margin-top:-56px;background:${C.red}}
.p1-late{position:absolute;top:285px;left:62px;width:250px;text-align:center;font-size:30px;font-weight:700;color:${C.red};z-index:5}
.p1-stamp{top:360px;left:50%;margin-left:-250px;width:500px;text-align:center;z-index:6}
.p1-busy{position:absolute;bottom:26px;left:0;right:0;text-align:center}`,
      html: `
<div class="p1-label"><span class="chip" style="background:rgba(255,77,94,.15);color:${C.red}">المشكلة ١ · الرد المتأخر</span></div>
<div class="card p1-card">
  <div class="hdr"><div class="av" style="background:#ffb36b">ع</div><div><div class="hname">عميل جديد</div><div class="hsub">متصل الآن</div></div></div>
  <div class="msgs">
    <div class="b in" id="p1-m1">السلام عليكم، متاح؟ وبكام؟<span class="t">2:14 PM</span></div>
    <div class="b out" id="p1-m2">أيوه متاح يا فندم! ✔<span class="t">4:14 PM ✓✓</span></div>
    <div class="b in" id="p1-m3">معلش، اشتريت من مكان تاني 🙏<span class="t">4:15 PM</span></div>
  </div>
  <div class="p1-busy"><span class="chip" id="p1-busy" style="background:#202c33;color:${C.mute}">⏳ انت مشغول… العميل مستني</span></div>
</div>
<div class="p1-clock" id="p1-clock"><div class="p1-hand p1-hh" id="p1-hh"></div><div class="p1-hand p1-mh" id="p1-mh"></div></div>
<div class="p1-late" id="p1-late">بعد ساعتين!</div>
<div class="stamp p1-stamp" id="p1-stamp" data-layout-allow-overlap>✕ عميل ضاع</div>`,
      js: `
tl.fromTo($(".p1-card"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0);
tl.fromTo($(".p1-label"), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.05);
gsap.set([$("#p1-m1"), $("#p1-m2"), $("#p1-m3"), $("#p1-clock"), $("#p1-late"), $("#p1-stamp"), $("#p1-busy")], { opacity: 0 });
pop($("#p1-m1"), ${L("p1", at("العميل"))});
pop($("#p1-busy"), ${L("p1", at("مشغول"))}, { scale: 0.9 });
pop($("#p1-clock"), ${L("p1", at("ترد"))});
tl.fromTo($("#p1-mh"), { rotation: 0 }, { rotation: 720, duration: 0.9, ease: "power1.inOut" }, ${L("p1", at("ترد")) + 0.1});
tl.fromTo($("#p1-hh"), { rotation: 60 }, { rotation: 120, duration: 0.9, ease: "power1.inOut" }, ${L("p1", at("ترد")) + 0.1});
pop($("#p1-late"), ${L("p1", at("بساعتين"))});
tl.to($("#p1-busy"), { opacity: 0, duration: 0.15 }, ${L("p1", at("بساعتين")) + 0.1});
pop($("#p1-m2"), ${L("p1", at("بساعتين")) + 0.25});
pop($("#p1-m3"), ${L("p1", at("اشترى")) - 0.1});
tl.fromTo($("#p1-stamp"), { opacity: 0, scale: 2.2, rotation: -14 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.2, ease: "power4.in" }, ${L("p1", at("غيرك"))});
tl.to($(".p1-card"), { x: 10, duration: 0.04, yoyo: true, repeat: 3, ease: "none" }, ${L("p1", at("غيرك")) + 0.2});` }; } },

    { id: "s-p2", from: "p2", to: "sol", make: h => { const { C, L, at } = h;
      const ask = ["بكام؟", "فين مكانكم؟", "متاح؟", "السعر كام؟", "بتوصلوا؟", "بكام؟", "عنوانكم فين؟", "فيه خصم؟", "بكام؟", "مواعيدكم إيه؟"];
      const pos = [[560, 360], [130, 390], [700, 470], [300, 500], [80, 590], [560, 600], [330, 700], [690, 720], [110, 790], [430, 820]];
      return {
      css: `
.p2-label{position:absolute;top:24px;left:0;right:0;text-align:center}
.p2-title{top:100px;font-size:76px}
.p2-title b{color:${C.red}}
.p2-bar{position:absolute;top:220px;left:120px;right:120px;height:56px;border-radius:28px;background:#202c33;overflow:hidden;direction:ltr}
.p2-fill{position:absolute;left:0;top:0;bottom:0;width:100%;background:${C.green};border-radius:28px;transform-origin:0 50%}
.p2-pct{position:absolute;top:290px;left:0;right:0;text-align:center;font-size:30px;color:${C.mute}}
.p2-q{position:absolute;padding:14px 26px;border-radius:24px;border-top-right-radius:6px;background:${C.inBub};font-size:36px;font-weight:600;white-space:nowrap;}
.p2-stamp{top:540px;left:50%;margin-left:-330px;width:660px;text-align:center;font-size:56px;z-index:4}`,
      html: `
<div class="p2-label"><span class="chip" style="background:rgba(255,77,94,.15);color:${C.red}">المشكلة ٢ · أسئلة بلا شراء</span></div>
<div class="h1 p2-title" id="p2-title"><b>نص يومك</b> بيضيع</div>
<div class="p2-bar"><div class="p2-fill" id="p2-fill"></div></div>
<div class="p2-pct" id="p2-pct">يومك: ١٠٠٪</div>
${ask.map((t, i) => `<div class="p2-q" id="p2-q${i}" style="left:${pos[i][0]}px;top:${pos[i][1]}px">${t}</div>`).join("")}
<div class="stamp p2-stamp" id="p2-stamp" data-layout-allow-overlap>ولا واحد اشترى ✕</div>`,
      js: `
gsap.set([$("#p2-title"), $("#p2-stamp")], { opacity: 0 });
tl.fromTo($(".p2-label"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.25 }, 0);
tl.fromTo($(".p2-bar"), { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.1);
pop($("#p2-title"), ${L("p2", at("نص"))}, { scale: 0.9 });
var pct = { v: 100 }; var pctEl = $("#p2-pct");
tl.to($("#p2-fill"), { scaleX: 0.5, backgroundColor: "${C.red}", duration: 1.0, ease: "power2.inOut" }, ${L("p2", at("بيضيع"))});
tl.to(pct, { v: 50, duration: 1.0, ease: "power2.inOut", onUpdate: function () { pctEl.textContent = "يومك: " + Math.round(pct.v).toLocaleString("ar-EG") + "٪"; } }, ${L("p2", at("بيضيع"))});
var qs = $$(".p2-q"); gsap.set(qs, { opacity: 0 });
var t0 = ${L("p2", at("بترد"))}, t1 = ${L("p2", at("ناس"))};
for (var i = 0; i < qs.length; i++) { var k = i / (qs.length - 1); pop(qs[i], t0 + (t1 - t0) * Math.pow(k, 0.8), { y: 30, rotation: (i % 2 ? 6 : -6) }); }
pop(qs[0], ${L("p2", at("بكام"))});
tl.to(qs, { opacity: 0.35, duration: 0.25 }, ${L("p2", at("ناوية"))} - 0.1);
tl.fromTo($("#p2-stamp"), { opacity: 0, scale: 2, rotation: 10 }, { opacity: 1, scale: 1, rotation: 5, duration: 0.2, ease: "power4.in" }, ${L("p2", at("ناوية"))});` }; } },

    // NORA mascot: small robot (antenna, visor, blinking eyes, waving arm)
    { id: "s-sol", from: "sol", to: "bot", make: h => { const { C, L, at } = h; return {
      css: `
.so-q{top:250px;font-size:120px}
.so-name{position:absolute;top:150px;left:0;right:0;text-align:center}
.so-bot{display:block;margin:0 auto;width:260px;height:300px;overflow:visible;filter:drop-shadow(0 0 40px rgba(37,211,102,.45));}
.so-word{margin-top:30px;font-size:120px;font-weight:700;color:${C.green};line-height:1}
.so-by{position:absolute;top:640px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:24px;font-size:40px;color:${C.ink};direction:ltr}
.so-by img{width:96px;height:96px;border-radius:20px}`,
      html: `
<div class="h1 so-q" id="so-q">إيه الحل؟</div>
<div class="so-name" id="so-name"><svg class="so-bot" id="so-bot" viewBox="0 0 260 300" aria-hidden="true">
  <line x1="130" y1="44" x2="130" y2="16" stroke="#cfeedd" stroke-width="8" stroke-linecap="round"/>
  <circle id="so-bulb" cx="130" cy="14" r="12" fill="${C.green}"/>
  <rect x="26" y="92" width="18" height="46" rx="9" fill="${C.green}"/>
  <rect x="216" y="92" width="18" height="46" rx="9" fill="${C.green}"/>
  <rect x="40" y="40" width="180" height="146" rx="56" fill="#effff6"/>
  <rect x="60" y="70" width="140" height="84" rx="38" fill="#0b141a"/>
  <g id="so-eyes"><ellipse cx="104" cy="106" rx="13" ry="17" fill="${C.green}"/><ellipse cx="156" cy="106" rx="13" ry="17" fill="${C.green}"/></g>
  <path d="M116 132 Q130 143 144 132" stroke="${C.green}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="74" cy="166" r="10" fill="#ff9ab5" opacity=".75"/><circle cx="186" cy="166" r="10" fill="#ff9ab5" opacity=".75"/>
  <rect id="so-armL" x="62" y="196" width="24" height="58" rx="12" fill="#effff6"/>
  <rect id="so-armR" x="174" y="196" width="24" height="58" rx="12" fill="#effff6"/>
  <rect x="88" y="190" width="84" height="76" rx="28" fill="#effff6"/>
  <circle cx="130" cy="226" r="11" fill="${C.green}"/>
</svg><div class="so-word">نورا</div></div>
<div class="so-by" id="so-by"><img src="assets/pa-logo.png" alt="" /><span>by <b>Project Alpha Tech</b></span></div>`,
      js: `
gsap.set([$("#so-name"), $("#so-by")], { opacity: 0 });
tl.fromTo($("#so-q"), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, 0);
var tn = ${L("sol", at("نورا"))};
tl.to($("#so-q"), { opacity: 0, scale: 1.3, duration: 0.15, ease: "power2.in" }, tn - 0.15);
tl.fromTo($("#so-name"), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.8)" }, tn);
tl.fromTo($("#so-bot"), { rotation: -12, y: 30 }, { rotation: 0, y: 0, duration: 0.45, ease: "back.out(2.2)" }, tn);
tl.to($("#so-bot"), { y: -8, duration: 0.45, yoyo: true, repeat: 3, ease: "sine.inOut" }, tn + 0.45);
tl.fromTo($("#so-armR"), { rotation: 0 }, { rotation: -150, duration: 0.18, ease: "power2.out", svgOrigin: "186 202" }, tn + 0.3);
tl.to($("#so-armR"), { rotation: -120, duration: 0.16, yoyo: true, repeat: 5, ease: "sine.inOut", svgOrigin: "186 202" }, tn + 0.48);
tl.to($("#so-eyes"), { scaleY: 0.12, duration: 0.07, yoyo: true, repeat: 1, ease: "power1.inOut", svgOrigin: "130 106" }, tn + 0.9);
tl.fromTo($("#so-bulb"), { opacity: 1 }, { opacity: 0.35, duration: 0.25, yoyo: true, repeat: 5, ease: "sine.inOut" }, tn);
tl.fromTo($("#so-by"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${L("sol", at("Project"))});` }; } },

    { id: "s-bot", from: "bot", to: "smart", make: h => { const { C, L, at } = h; return {
      css: `
.bt-card{top:110px;height:560px}
.bt-menu{font-size:30px;line-height:1.7}
.bt-x{position:absolute;top:150px;left:50%;margin-left:-240px;width:480px;height:480px;z-index:5}
.bt-ai{position:absolute;top:150px;left:120px;right:120px;height:540px;border-radius:40px;background:linear-gradient(160deg,#103b26,#0b141a 70%);border:4px solid ${C.green};box-shadow:0 0 90px rgba(37,211,102,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;z-index:6}
.bt-ai .big{font-size:140px;font-weight:700;color:${C.green};direction:ltr;line-height:1}
.bt-ai .sm{font-size:56px;font-weight:700}
.bt-lbl{position:absolute;top:24px;left:0;right:0;text-align:center}`,
      html: `
<div class="bt-lbl"><span class="chip" id="bt-chip" style="background:#202c33;color:${C.mute}">🤖 البوت العادي</span></div>
<div class="card bt-card" id="bt-card">
  <div class="hdr"><div class="av" style="background:#8696a0">🤖</div><div><div class="hname">رد آلي</div><div class="hsub">بوت</div></div></div>
  <div class="msgs">
    <div class="b in" id="bt-m1">عايز أعرف الباقات المناسبة لمحلي</div>
    <div class="b out bt-menu" id="bt-m2">اختر رقم:<br/>1️⃣ الأسعار<br/>2️⃣ العنوان<br/>3️⃣ خدمة العملاء</div>
    <div class="b out" id="bt-m3">عذراً، لم أفهم سؤالك 🤖</div>
  </div>
</div>
<svg class="bt-x" id="bt-x" viewBox="0 0 100 100"><path d="M18 18L82 82M82 18L18 82" stroke="${C.red}" stroke-width="12" stroke-linecap="round" fill="none"/></svg>
<div class="bt-ai" id="bt-ai"><div class="big">AI</div><div class="sm">حقيقي، بيفهم بالمصري</div></div>`,
      js: `
gsap.set([$("#bt-m1"), $("#bt-m2"), $("#bt-m3"), $("#bt-x"), $("#bt-ai")], { opacity: 0 });
tl.fromTo($("#bt-card"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0);
pop($("#bt-m1"), ${L("bot", at("بوت"))});
pop($("#bt-m2"), ${L("bot", at("بيحفظ"))});
pop($("#bt-m3"), ${L("bot", at("وبيرد"))});
var tx = ${L("bot", at("لأ"))};
tl.fromTo($("#bt-x"), { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.15, ease: "power4.in" }, tx);
tl.to($("#bt-card"), { opacity: 0.25, scale: 0.94, duration: 0.2 }, tx + 0.1);
tl.to([$("#bt-x"), $("#bt-chip"), $("#bt-card")], { opacity: 0, duration: 0.15 }, ${L("bot", at("AI"))} - 0.1);
tl.fromTo($("#bt-ai"), { opacity: 0, scale: 0.6, rotation: -4 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.3, ease: "back.out(1.7)" }, ${L("bot", at("AI"))});
tl.fromTo($("#bt-ai .big"), { scale: 1 }, { scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: "sine.inOut" }, ${L("bot", at("حقيقي"))});` }; } },

    { id: "s-smart", from: "smart", to: "filter", make: h => { const { C, L, at } = h; return {
      css: `
.sm-card{top:40px;height:660px}
.sm-typing{display:flex;gap:10px;padding:22px 28px}
.sm-typing i{width:16px;height:16px;border-radius:50%;background:#aebac1;display:block}
.sm-fast{position:absolute;top:730px;left:0;right:0;text-align:center;z-index:4}`,
      html: `
<div class="card sm-card" id="sm-card">
  <div class="hdr"><div class="av" style="background:${C.green}">ن</div><div><div class="hname">نورا · Project Alpha</div><div class="hsub" style="color:${C.green}">متصلة ٢٤ ساعة</div></div></div>
  <div class="msgs">
    <div class="b in" id="sm-m1">محتاج موقع لمطعمي، بس الميزانية على قدي</div>
    <div class="b out sm-typing" id="sm-typ"><i></i><i></i><i></i></div>
    <div class="b out" id="sm-m2">ولا يهمك 👌 عندنا باقة تناسبك. المطعم في أنهي منطقة؟ وعايز أوردر أونلاين؟</div>
    <div class="b in" id="sm-m3">في المعادي، وأيوه أوردر أونلاين</div>
  </div>
</div>
<div class="sm-fast"><span class="chip" id="sm-fast" style="background:${C.green};color:#06210f">⚡ رد فوري</span></div>`,
      js: `
gsap.set([$("#sm-m1"), $("#sm-typ"), $("#sm-m2"), $("#sm-m3"), $("#sm-fast")], { opacity: 0 });
tl.fromTo($("#sm-card"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0);
pop($("#sm-m1"), ${L("smart", at("العميل"))});
pop($("#sm-typ"), ${L("smart", at("وبيرد"))} - 0.2);
var dots = $$(".sm-typing i");
for (var i = 0; i < 3; i++) tl.fromTo(dots[i], { y: 0 }, { y: -8, duration: 0.15, yoyo: true, repeat: 3, ease: "sine.inOut" }, ${L("smart", at("وبيرد"))} - 0.1 + i * 0.08);
var tr = ${L("smart", at("الأسئلة"))} - 0.3;
tl.set($("#sm-typ"), { display: "none" }, tr);
pop($("#sm-m2"), tr);
pop($("#sm-fast"), tr + 0.15);
pop($("#sm-m3"), ${L("smart", at("تسأله"))});` }; } },

    { id: "s-filter", from: "filter", to: "cta", make: h => { const { C, L, at } = h;
      const leads = [["م", "محمد", "بكام؟", 0], ["س", "سارة", "عايزة أبدأ الأسبوع ده", 1], ["ك", "كريم", "بتوصلوا؟", 0], ["ن", "نهى", "ابعتلي العرض وأدفع", 1], ["أ", "أحمد", "طب بس بسأل", 0], ["ي", "يوسف", "تمام، نبدأ إمتى؟", 1]];
      return {
      css: `
.fl-gate{position:absolute;top:400px;left:90px;right:90px;height:10px;border-radius:5px;background:${C.green};box-shadow:0 0 40px ${C.green}}
.fl-gate-l{position:absolute;top:360px;left:0;right:0;text-align:center}
.fl-lead{position:absolute;left:300px;width:480px;height:96px;top:60px;border-radius:24px;background:${C.inBub};display:flex;align-items:center;gap:18px;padding:0 20px;}
.fl-lead .av{width:64px;height:64px;font-size:30px}
.fl-lead .nm{font-size:28px;font-weight:600}.fl-lead .sn{font-size:24px;color:${C.mute};white-space:nowrap}
.fl-box{position:absolute;top:560px;left:200px;right:200px;height:260px;border-radius:36px;border:4px solid ${C.green};background:rgba(37,211,102,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.fl-box .k{font-size:110px;font-weight:700;color:${C.green};line-height:1}
.fl-box .l{font-size:40px;font-weight:700}`,
      html: `
${leads.map((l, i) => `<div class="fl-lead" id="fl-${i}"><div class="av" style="background:${l[3] ? C.green : "#8696a0"}">${l[0]}</div><div><div class="nm">${l[1]}</div><div class="sn">${l[2]}</div></div></div>`).join("")}
<div class="fl-gate" id="fl-gate"></div>
<div class="fl-gate-l"><span class="chip" style="background:${C.bg};color:${C.green};border:2px solid ${C.green}">نورا بتفلتر</span></div>
<div class="fl-box" id="fl-box"><div class="k" id="fl-k">٠</div><div class="l">جاهزين للشراء ✓</div></div>`,
      js: `
tl.fromTo([$("#fl-gate"), $(".fl-gate-l"), $("#fl-box")], { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0);
var L6 = $$(".fl-lead"); gsap.set(L6, { opacity: 0 });
var good = ${JSON.stringify(leads.map(l => l[3]))};
var tA = ${L("filter", at("كل"))} - 0.4, tEnd = ${L("filter", at("جاهزة"))};
var step = (tEnd - tA - 0.6) / L6.length;
var cnt = 0, kEl = $("#fl-k");
for (var i = 0; i < L6.length; i++) {
  var t = tA + i * step;
  tl.fromTo(L6[i], { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, t);
  tl.to(L6[i], { y: 300, duration: 0.25, ease: "power2.in" }, t + 0.3);
  if (good[i]) {
    tl.to(L6[i], { y: 560, scale: 0.6, opacity: 0, duration: 0.25, ease: "power2.in" }, t + 0.55);
    (function (n, tt) { tl.set(kEl, { textContent: n.toLocaleString("ar-EG") }, tt); })(++cnt, t + 0.78);
    tl.fromTo($("#fl-box"), { scale: 1 }, { scale: 1.06, duration: 0.1, yoyo: true, repeat: 1 }, t + 0.78);
  } else {
    tl.to(L6[i], { x: i % 2 ? 700 : -700, rotation: i % 2 ? 20 : -20, opacity: 0, duration: 0.3, ease: "power2.in" }, t + 0.55);
  }
}
tl.to($("#fl-box"), { boxShadow: "0 0 90px rgba(37,211,102,.6)", duration: 0.3 }, tEnd);` }; } },

    { id: "s-cta", from: "cta", to: "end", make: h => { const { C, L, at } = h; return {
      css: `
.ct-t{top:40px;font-size:84px}
.ct-t b{color:${C.green}}
.ct-btn{position:absolute;top:200px;left:140px;right:140px;height:150px;border-radius:75px;background:${C.green};color:#06210f;display:flex;align-items:center;justify-content:center;gap:24px;font-size:54px;font-weight:700;box-shadow:0 20px 60px rgba(37,211,102,.4)}
.ct-arrow{position:absolute;top:380px;left:0;right:0;text-align:center;font-size:44px;font-weight:700;color:${C.ink}}
.ct-bub{position:absolute;top:480px;left:120px;right:120px;display:flex;flex-direction:column;gap:12px}
.ct-who{font-size:26px;color:${C.green};font-weight:600}
.ct-logo{position:absolute;top:780px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:20px;font-size:34px;direction:ltr;color:${C.mute}}
.ct-logo img{width:72px;height:72px;border-radius:16px}`,
      html: `
<div class="h1 ct-t" id="ct-t">جرّب <b>نورا</b> بنفسك</div>
<div class="ct-btn" id="ct-btn"><svg viewBox="0 0 100 100" width="76" height="76"><path d="M26 30h48a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H48l-14 12V64h-8a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" fill="#06210f"/></svg>ابعتلنا على واتساب</div>
<div class="ct-arrow" id="ct-arrow">⬇ اللينك تحت</div>
<div class="ct-bub"><div class="ct-who" id="ct-who">نورا · بترد دلوقتي</div><div class="b out" id="ct-m" style="align-self:flex-start;max-width:100%">أهلاً! أنا نورا 👋 أقدر أساعدك إزاي؟</div></div>
<div class="ct-logo" id="ct-logo"><img src="assets/pa-logo.png" alt="" /><span>Project Alpha Tech</span></div>`,
      js: `
gsap.set([$("#ct-btn"), $("#ct-arrow"), $("#ct-who"), $("#ct-m")], { opacity: 0 });
tl.fromTo($("#ct-t"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, 0);
tl.fromTo($("#ct-logo"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.3);
var tb = ${L("cta", at("ابعتلنا"))};
pop($("#ct-btn"), tb);
tl.to($("#ct-btn"), { scale: 1.05, duration: 0.35, yoyo: true, repeat: 5, ease: "sine.inOut" }, tb + 0.3);
pop($("#ct-arrow"), ${L("cta", at("دلوقتي"))});
tl.to($("#ct-arrow"), { y: 14, duration: 0.3, yoyo: true, repeat: 5, ease: "sine.inOut" }, ${L("cta", at("دلوقتي"))} + 0.2);
pop($("#ct-who"), ${L("cta", at("ونورا"))});
pop($("#ct-m"), ${L("cta", at("بنفسها"))});` }; } },
  ],
};
