// alpha-video camera moves and paper cuts for HyperFrames (GSAP).
// Ported from papercut-explainer (github.com/0xS4N4TG/papercut-explainer) and restyled to the house look.
// Original work: MIT License, Copyright (c) 2026 sanat. Full notice: studio/blocks/LICENSE-papercut
// Only the moves the HyperFrames registry lacks live here; references/camera-and-cuts.md maps the rest to registry items.
//
// Every function adds tweens to a paused GSAP timeline `tl`, so any frame can be seeked. Times are in seconds.
// `el` / `host` take an element or a selector. Elements must be absolutely positioned and fill their frame.
// Moves set x, y, scale, rotation or filter on `el`: give each move its own wrapper div when you stack them.
// Each call returns { at, sfx }: put that sound on that time.
(function (root) {
  var F = 1 / 30;
  var C = { pink: "#F73186", yellow: "#FAE407", lime: "#BFF906", ink: "#141319", white: "#ffffff" };
  var $ = function (x) { return typeof x === "string" ? document.querySelector(x) : x; };
  var pick = function (v, d) { return v === undefined || v === null ? d : v; };
  var rad = function (d) { return (d * Math.PI) / 180; };
  // deterministic noise in [-1, 1], so every render shakes the same way
  var rnd = function (seed, k) { var s = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  var dims = function (el, o) { return { w: o.w || el.offsetWidth || 1080, h: o.h || el.offsetHeight || 1920 }; };
  var add = function (host, html) { var d = document.createElement("div"); d.innerHTML = html.trim(); var n = d.firstChild; host.appendChild(n); return n; };
  var uid = 0;
  // a one-axis motion blur (SVG feGaussianBlur), returns the node to tween: attr stdDeviation "x y"
  function axisBlur(el) {
    var id = "pa-blur-" + ++uid;
    add(document.body, '<svg width="0" height="0" style="position:absolute"><filter id="' + id + '" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>');
    el.style.filter = "url(#" + id + ")";
    return document.querySelector("#" + id + " feGaussianBlur");
  }

  // ---------------------------------------------------------------- camera

  // Punch-in on a focal point: scale 1 -> `to` in 4 frames with blur, a short decaying shake and roll, then settles.
  // For a number landing or a joke landing: `at` = the frame it lands.
  function snapZoom(tl, el, at, o) {
    o = o || {}; el = $(el);
    var d = dims(el, o), x = pick(o.x, d.w / 2), y = pick(o.y, d.h / 2);
    var to = pick(o.to, 1.25), settle = pick(o.settle, 1.17), shake = pick(o.shake, 18), roll = pick(o.roll, 1.4);
    gsap.set(el, { transformOrigin: x + "px " + y + "px" });
    tl.fromTo(el, { scale: 1 }, { scale: to, duration: 4 * F, ease: "power3.out", immediateRender: false }, at);
    tl.to(el, { scale: settle, duration: 14 * F, ease: "power3.out" }, at + 4 * F);
    tl.to(el, { scale: settle + 0.015, duration: 72 * F, ease: "none" }, at + 18 * F);
    if (o.blur !== false) {
      gsap.set(el, { filter: "blur(0px)" });
      tl.to(el, { filter: "blur(7px)", duration: 2 * F, ease: "power1.in" }, at);
      tl.to(el, { filter: "blur(0px)", duration: 4 * F, ease: "power2.out" }, at + 2 * F);
    }
    for (var k = 3; k <= 12; k++) {
      var e = Math.exp(-(k - 2.5) / 1.3);
      tl.set(el, { x: shake * e * rnd(1, k), y: 0.8 * shake * e * rnd(2, k), rotation: roll * Math.exp(-(k - 2.5) / 2.6) * Math.sin((k - 2.5) * 1.9) }, at + k * F);
    }
    tl.set(el, { x: 0, y: 0, rotation: 0 }, at + 13 * F);
    return { at: at, sfx: "impact hit" };
  }

  // Crane through a tall set. `world` is the tall container (top at y 0). drop: descends `height` px; rise: climbs and tilts up.
  // layers: [{el, z}] for parallax (z 0 = far backdrop, ~0.5 = props, 1 = foreground). For scale reveals and "meanwhile, below".
  function crane(tl, world, at, o) {
    o = o || {}; world = $(world);
    var dur = pick(o.dur, 1.4), height = o.height || 960, mode = o.mode || "drop", focus = pick(o.focus, 0.45), par = pick(o.parallax, 0.35);
    var layers = (o.layers || [{ el: world, z: focus }]).map(function (L) { return { el: $(L.el), z: L.z }; });
    layers.forEach(function (L) {
      var dy = -height * (1 + (L.z - focus) * par);
      tl.fromTo(L.el, { y: mode === "drop" ? 0 : dy }, { y: mode === "drop" ? dy : 0, duration: dur, ease: "power3.inOut" }, at);
    });
    if (mode === "rise") tl.fromTo(world, { rotationX: 0 }, { rotationX: -pick(o.pitch, 14), transformPerspective: 1600, duration: dur, ease: "power3.inOut" }, at);
    if (o.blur !== false) {
      var b = axisBlur(world), peak = Math.min(14, (height / (dur * 30)) * 0.18).toFixed(1);
      tl.to(b, { attr: { stdDeviation: "0 " + peak }, duration: dur / 2, ease: "sine.in" }, at);
      tl.to(b, { attr: { stdDeviation: "0 0" }, duration: dur / 2, ease: "sine.out" }, at + dur / 2);
    }
    return { at: at, sfx: mode === "drop" ? "descending whoosh" : "rising whoosh" };
  }

  // Dutch tilt for "things going wrong": rolls to `deg` with a back-ease snap, then judders on twos for `dur` s.
  // Scales up so the tilted frame still covers it: keep key content central. back: true straightens it after `dur`.
  function dutchTilt(tl, el, at, o) {
    o = o || {}; el = $(el);
    var d = dims(el, o), deg = pick(o.deg, 10), j = pick(o.judder, 1), dur = pick(o.dur, 2);
    var a = rad(Math.abs(deg) + 1.2 * j), cover = Math.cos(a) + Math.max(d.h / d.w, d.w / d.h) * Math.sin(a);
    tl.fromTo(el, { rotation: 0, scale: 1 }, { rotation: deg, scale: cover, duration: 7 * F, ease: "back.out(2.2)" }, at);
    for (var t = 8, k = 0; t * F < dur; t += 2, k++)
      tl.set(el, { rotation: deg + 0.9 * j * rnd(3, k), x: 6 * j * rnd(4, k), y: 5 * j * rnd(5, k) }, at + t * F);
    if (o.back) tl.to(el, { rotation: 0, scale: 1, x: 0, y: 0, duration: 8 * F, ease: "power2.inOut" }, at + dur);
    return { at: at, sfx: "low thud" };
  }

  // Tilt shift for "a tiny world": blurs the top and bottom bands of whatever sits under it in `host`, lifts saturation.
  // focus = sharp band centre (0-1 of the height), band = its height, blur = px at the edges.
  function tiltShift(tl, host, at, o) {
    o = o || {}; host = $(host);
    var focus = pick(o.focus, 0.5), band = pick(o.band, 0.3), blur = pick(o.blur, 14), sat = pick(o.sat, 1.15);
    var pct = function (v) { return Math.min(100, Math.max(0, v * 100)).toFixed(1) + "%"; };
    var lo = focus - band / 2, hi = focus + band / 2;
    var mask = function (soft, edge) { return "linear-gradient(to bottom,#000 0%,#000 " + pct(lo - edge) + ",transparent " + pct(lo + soft) + ",transparent " + pct(hi - soft) + ",#000 " + pct(hi + edge) + ",#000 100%)"; };
    var layer = function (b, m) {
      return add(host, '<div class="pa-tiltshift" style="position:absolute;inset:0;pointer-events:none;z-index:50;opacity:0;' +
        "backdrop-filter:blur(" + b + "px) saturate(" + sat + ");-webkit-backdrop-filter:blur(" + b + "px) saturate(" + sat + ");" +
        "-webkit-mask-image:" + m + ";mask-image:" + m + '"></div>');
    };
    var els = [layer(blur * 0.45, mask(0.03, 0.14)), layer(blur, mask(0, 0.07))];
    tl.to(els, { opacity: 1, duration: 6 * F, ease: "power1.out" }, at);
    if (o.dur) tl.to(els, { opacity: 0, duration: 6 * F, ease: "power1.in" }, at + o.dur);
    return { at: at, sfx: null };
  }

  // Focus pulse: the lens goes soft and snaps back over `dur` s. Emphasis on a reveal without moving the camera.
  function focusPulse(tl, el, at, o) {
    o = o || {}; el = $(el);
    var dur = pick(o.dur, 0.6), fr = [0, 4 / 18, 8 / 18, 13 / 18, 1], r = [0, 8, 18, 5, 0];
    gsap.set(el, { filter: "blur(0px)" });
    for (var i = 1; i < fr.length; i++) {
      var b = 0.7 * r[i], v = { filter: "blur(" + b.toFixed(2) + "px)", duration: (fr[i] - fr[i - 1]) * dur, ease: "sine.inOut" };
      if (o.scale !== false) v.scale = 1 + b * 0.0045;
      tl.to(el, v, at + fr[i - 1] * dur);
    }
    return { at: at, sfx: null };
  }

  // Focus hunt: hard push-in on (x, y) from 1x to 1 + amount over `dur` s, and the lens hunts for focus part-way through.
  function focusHunt(tl, el, at, o) {
    o = o || {}; el = $(el);
    var d = dims(el, o), dur = pick(o.dur, 1), x = pick(o.x, d.w / 2), y = pick(o.y, d.h / 2);
    gsap.set(el, { transformOrigin: x + "px " + y + "px" });
    tl.fromTo(el, { scale: 1 }, { scale: 1 + pick(o.amount, 1), duration: dur, ease: "power4.inOut" }, at);
    focusPulse(tl, el, at + dur / 3, { dur: dur * 0.6, scale: false });
    return { at: at, sfx: "riser" };
  }

  // A blurred object sweeps across the lens and dims the set for a moment. Put `host` on top of the scene.
  // kind: "leaf" (low, along the bottom) | "block" (white card, mid) | "bar" (pink bar, high). from: "left" | "right".
  function foregroundPass(tl, host, at, o) {
    o = o || {}; host = $(host);
    var d = dims(host, o), dur = pick(o.dur, 1.33), kind = o.kind || "leaf", dir = o.from === "right" ? -1 : 1, s = pick(o.scale, o.kind === "leaf" || !o.kind ? 1.4 : 1);
    var shape = {
      leaf: { w: 1240, h: 620, y: d.h * 0.9, svg: '<svg width="1240" height="620" viewBox="0 0 1240 620"><path d="M0 310C260 10 900-20 1240 310 900 640 260 610 0 310Z" fill="' + (o.color || C.ink) + '"/><path d="M40 310H1200" stroke="#2c2a33" stroke-width="16"/></svg>' },
      block: { w: 800, h: 520, y: d.h * 0.69, svg: '<div style="width:800px;height:520px;background:' + (o.color || C.white) + ';border:14px solid ' + C.ink + ';border-radius:28px"></div>' },
      bar: { w: 1400, h: 260, y: d.h * 0.08, svg: '<div style="width:1400px;height:260px;background:' + (o.color || C.pink) + '"></div>' },
    }[kind];
    var dim = add(host, '<div style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:60"></div>');
    var obj = add(host, '<div style="position:absolute;left:0;top:0;z-index:61;pointer-events:none;opacity:0;filter:blur(' + pick(o.blur, kind === "leaf" ? 8 : 14) + 'px)">' + shape.svg + "</div>");
    var half = (shape.w * s) / 2, x0 = dir > 0 ? -shape.w * s : d.w, x1 = dir > 0 ? d.w : -shape.w * s;
    gsap.set(obj, { y: pick(o.y, shape.y) - shape.h / 2, scale: s, transformOrigin: "50% 50%" });
    tl.set(obj, { opacity: 1 }, at);
    tl.fromTo(obj, { x: x0 - dir * half * 0.2, rotation: -14 * dir }, { x: x1 + dir * half * 0.2, rotation: 14 * dir, duration: dur, ease: "sine.inOut", immediateRender: false }, at);
    tl.set(obj, { opacity: 0 }, at + dur);
    tl.to(dim, { opacity: pick(o.dim, 0.2), duration: dur / 2, ease: "sine.in" }, at);
    tl.to(dim, { opacity: 0, duration: dur / 2, ease: "sine.out" }, at + dur / 2);
    return { at: at, sfx: "soft swoosh" };
  }

  // POV mask for spy and privacy beats: the scene seen through a keyhole, lens, binoculars or phone viewfinder in a dark surround.
  // (x, y) = view centre. target: the scene element, zoomed to `zoom` as the mask rises. dur: when set, the mask drops after it.
  function povMask(tl, host, at, o) {
    o = o || {}; host = $(host);
    var d = dims(host, o), kind = o.kind || "binoculars", x = pick(o.x, d.w / 2), y = pick(o.y, d.h * 0.47), s = pick(o.size, 1), sway = pick(o.sway, 1);
    var circle = function (cx, cy, r) { return "M" + (cx - r) + " " + cy + "a" + r + " " + r + " 0 1 0 " + 2 * r + " 0a" + r + " " + r + " 0 1 0 " + -2 * r + " 0Z"; };
    var keyhole = function (cx, cy, k) { var r = 200 * k, ccy = cy - 110 * k, a = 66 * k, yi = ccy + Math.sqrt(r * r - a * a), yb = yi + 560 * k; return "M" + (cx - a) + " " + yi + "A" + r + " " + r + " 0 1 1 " + (cx + a) + " " + yi + "L" + (cx + 170 * k) + " " + yb + "L" + (cx - 170 * k) + " " + yb + "Z"; };
    var bino = function (cx, cy, k) { var r = 320 * k, dd = 205 * k, h = Math.sqrt(r * r - dd * dd); return "M" + cx + " " + (cy - h) + "A" + r + " " + r + " 0 1 0 " + cx + " " + (cy + h) + "A" + r + " " + r + " 0 1 0 " + cx + " " + (cy - h) + "Z"; };
    var rrect = function (rx, ry, w, h, r) { return "M" + (rx + r) + " " + ry + "H" + (rx + w - r) + "A" + r + " " + r + " 0 0 1 " + (rx + w) + " " + (ry + r) + "V" + (ry + h - r) + "A" + r + " " + r + " 0 0 1 " + (rx + w - r) + " " + (ry + h) + "H" + (rx + r) + "A" + r + " " + r + " 0 0 1 " + rx + " " + (ry + h - r) + "V" + (ry + r) + "A" + r + " " + r + " 0 0 1 " + (rx + r) + " " + ry + "Z"; };
    var hole = function (k) { return kind === "keyhole" ? keyhole(x, y, k) : kind === "lens" ? circle(x, y, 360 * k) : kind === "binoculars" ? bino(x, y, k) : rrect(x - 430 * k, y - 640 * k, 860 * k, 1280 * k, 64 * k); };
    var inner = hole(s), rim = kind === "phone" ? rrect(x - 430 * s - 16, y - 640 * s - 16, 860 * s + 32, 1280 * s + 32, 76 * s) : kind === "lens" ? circle(x, y, 384 * s) : hole(s * (kind === "keyhole" ? 1.16 : 1.06));
    var frame = "M-3000 -3000H6000V6000H-3000Z", clip = function (p) { return "path(evenodd, '" + p + "')"; }; // single quotes: it sits inside a style="" attribute
    var line = function (x1, y1, x2, y2, c) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="7" stroke-linecap="round"/>'; };
    var ret = "";
    if (o.reticle !== false && kind !== "phone") { var L = 110 * s, g = 34 * s; ret = line(x - g - L, y, x - g, y, C.pink) + line(x + g, y, x + g + L, y, C.pink) + line(x, y - g - L, x, y - g, C.pink) + line(x, y + g, x, y + g + L, C.pink) + '<circle cx="' + x + '" cy="' + y + '" r="6" fill="' + C.pink + '"/>'; }
    if (kind === "phone") { var pw = 430 * s - 34, ph = 640 * s - 34, cl = 74; [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (c) { var cx = x + c[0] * pw, cy = y + c[1] * ph; ret += line(cx, cy, cx - c[0] * cl, cy, C.white) + line(cx, cy, cx, cy - c[1] * cl, C.white); }); }
    var rig = add(host, '<div style="position:absolute;inset:0;z-index:70;pointer-events:none;opacity:0">' +
      '<div style="position:absolute;inset:0;background:' + C.yellow + ";clip-path:" + clip(rim + inner) + ';filter:drop-shadow(0 5px 7px rgba(0,0,0,.55))"></div>' +
      '<div style="position:absolute;inset:0;background:' + C.ink + ";clip-path:" + clip(frame + rim) + '"></div>' +
      '<div style="position:absolute;inset:-80px;border:84px solid ' + C.ink + '"></div>' + // covers the frame edge while the mask sways
      '<svg style="position:absolute;left:0;top:0;overflow:visible" width="' + d.w + '" height="' + d.h + '">' + ret + "</svg>" +
      (kind === "phone" ? '<div class="pa-rec" style="position:absolute;left:' + (x - 430 * s + 56) + "px;top:" + (y - 640 * s + 48) + 'px;font:800 28px sans-serif;letter-spacing:.08em;color:#fff"><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#e04030;margin-right:12px;vertical-align:-3px"></span>REC</div>' : "") +
      "</div>");
    var hold = pick(o.dur, 3);
    gsap.set(rig, { transformOrigin: x + "px " + y + "px" });
    tl.set(rig, { opacity: 1 }, at);
    tl.fromTo(rig, { scale: 2.4 }, { scale: 1, duration: 10 * F, ease: "power3.out", immediateRender: false }, at);
    if (o.target) { var t = $(o.target); gsap.set(t, { transformOrigin: x + "px " + y + "px" }); tl.fromTo(t, { scale: 1 }, { scale: pick(o.zoom, 1.12), duration: 10 * F, ease: "power3.out", immediateRender: false }, at); }
    if (sway) {
      tl.to(rig, { x: 9 * sway, duration: 1.15, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(hold / 1.15)) }, at + 10 * F);
      tl.to(rig, { y: 7 * sway, duration: 1.37, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(hold / 1.37)) }, at + 10 * F);
    }
    if (kind === "phone") tl.to(rig.querySelector(".pa-rec span"), { opacity: 0, duration: 8 * F, ease: "steps(1)", yoyo: true, repeat: Math.ceil(hold / (8 * F)) }, at);
    if (o.dur) tl.to(rig, { scale: 2.4, opacity: 0, duration: 8 * F, ease: "power2.in" }, at + o.dur);
    return { at: at, sfx: kind === "phone" ? "camera beep" : "lens click" };
  }

  // Parallax orbit: the camera arcs `yaw` degrees around the focal plane while dollying to `push`, so the layers separate.
  // layers: [{el, z}] siblings inside one `world` div (z 0 = backdrop, ~0.5 = props, 1 = foreground), laid out at normal positions.
  function orbit(tl, layers, at, o) {
    o = o || {};
    layers = layers.map(function (L) { return { el: $(L.el), z: L.z }; });
    var world = $(o.world) || layers[0].el.parentNode, d = dims(world, o);
    var dur = pick(o.dur, 2), yaw = pick(o.yaw, 16), push = pick(o.push, 1.08), drift = o.drift || [0, 0], focus = pick(o.focus, 0.45), depth = pick(o.depth, 800);
    var P = pick(o.persp, 1600), org = o.origin || [d.w / 2, d.h * 0.52], ox = org[0], oy = org[1];
    world.parentNode.style.perspective = P + "px";
    world.parentNode.style.perspectiveOrigin = ox + "px " + oy + "px";
    gsap.set(world, { transformStyle: "preserve-3d", transformOrigin: ox + "px " + oy + "px" });
    var sy = Math.sin(rad(yaw / 2)), panMax = Math.max(Math.abs(drift[0]), Math.abs(drift[1])), dolly = P * (1 - 1 / push);
    layers.forEach(function (L) {
      var tz = (L.z - focus) * depth, comp = (P - tz) / P;
      // a backdrop is oversized so its edges never show while the camera arcs and dollies
      var bleed = L.z <= 0.1 ? 1.035 + (Math.abs(tz) * sy + panMax + (d.w / 2) * sy * (d.w / 2 / P) * 1.4 + 24) / (d.w / 2) : 1;
      gsap.set(L.el, { z: tz, scale: comp * bleed, transformOrigin: ox + "px " + oy + "px" });
    });
    tl.fromTo(world, { rotationY: -yaw / 2, x: 0, y: 0, z: 0 }, { rotationY: yaw / 2, x: -drift[0], y: -drift[1], z: dolly, duration: dur, ease: "power2.inOut" }, at);
    return { at: at, sfx: null };
  }

  // ---------------------------------------------------------------- cuts
  // A cut swaps scene `out` for scene `inn`: two full-frame siblings, `inn` transparent before `at`, `out` transparent after the cut.
  // Opacity, never visibility: a child set to visibility:visible shows through its hidden HyperFrames clip.

  function cutPrep(tl, out, inn, at, dur) {
    gsap.set(out, { zIndex: 2 }); gsap.set(inn, { zIndex: 1, opacity: 0 });
    tl.set(inn, { opacity: 1 }, at);
    tl.set(out, { opacity: 0 }, at + dur);
  }

  // Tape pull, the default cut: a taped strip slaps across the top of the outgoing scene and yanks it up and off with a tilt.
  // label: text printed on the tape. The tape slaps on 4 frames before `at`.
  function tapePull(tl, out, inn, at, o) {
    o = o || {}; out = $(out); inn = $(inn);
    var d = dims(out, o), dur = pick(o.dur, 10 * F), y = pick(o.y, 175);
    cutPrep(tl, out, inn, at, dur);
    var tape = add(out, '<div style="position:absolute;left:-30px;width:' + (d.w + 60) + "px;top:" + (y - 50) + "px;height:100px;z-index:80;background:" + (o.color || C.yellow) +
      ";border-top:6px solid " + C.ink + ";border-bottom:6px solid " + C.ink + ";box-shadow:0 10px 0 rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:800 46px sans-serif;letter-spacing:.06em;color:" + C.ink + ';opacity:0">' + (o.label || "") + "</div>");
    var dim = add(inn, '<div style="position:absolute;inset:0;background:#0f0800;opacity:0;pointer-events:none;z-index:90"></div>');
    tl.fromTo(tape, { scaleY: 1.6, rotation: -2, opacity: 0 }, { scaleY: 1, rotation: -1.5, opacity: 1, duration: 3 * F, ease: "power3.out", immediateRender: false }, at - 4 * F);
    gsap.set(out, { transformOrigin: d.w * 0.7 + "px " + y + "px" });
    tl.to(out, { y: 12, duration: F, ease: "power1.out" }, at);
    tl.to(out, { y: -(d.h + 460), rotation: -10, duration: dur - F, ease: "power2.in" }, at + F);
    tl.to(out, { rotationX: 15, transformPerspective: 2400, duration: (dur - F) * 0.45, ease: "sine.out" }, at + F);
    tl.to(out, { rotationX: 4, duration: (dur - F) * 0.55, ease: "sine.in" }, at + F + (dur - F) * 0.45);
    tl.fromTo(dim, { opacity: 0.34 }, { opacity: 0, duration: dur, ease: "power1.out", immediateRender: false }, at);
    return { at: at - 4 * F, sfx: "tape peel" };
  }

  // Stamp cut, for a verdict: a rubber stamp slams into (x, y), the frame shakes, the stamp springs off, and its ink
  // impression is a window onto the incoming scene that grows to fill the frame.
  function stampCut(tl, out, inn, at, o) {
    o = o || {}; out = $(out); inn = $(inn);
    var d = dims(out, o), dur = pick(o.dur, 12 * F), x = pick(o.x, d.w / 2), y = pick(o.y, d.h * 0.48), ink = o.ink || C.pink;
    var hit = at + 0.27 * dur, SW = Math.min(640, d.w * 0.6), SH = Math.min(760, d.h * 0.45);
    cutPrep(tl, out, inn, hit, dur * 0.73);
    var layer = out.parentNode;
    var stamp = add(layer, '<div style="position:absolute;left:' + (x - 280) + "px;top:" + (y - 520) + 'px;width:560px;height:520px;z-index:95;pointer-events:none;opacity:0">' +
      '<div style="position:absolute;left:210px;top:0;width:140px;height:250px;background:' + C.ink + ';border-radius:70px 70px 24px 24px"></div>' +
      '<div style="position:absolute;left:20px;top:240px;width:520px;height:200px;background:' + C.yellow + ";border:10px solid " + C.ink + ";border-radius:22px;box-shadow:12px 12px 0 " + C.ink + '"></div>' +
      '<div style="position:absolute;left:40px;top:450px;width:480px;height:70px;background:' + ink + ";border:8px solid " + C.ink + ';border-radius:10px"></div></div>');
    var inset = function (l, t, w, h, r) { return "inset(" + t + "px " + (d.w - l - w) + "px " + (d.h - t - h) + "px " + l + "px round " + r + "px)"; };
    var wl = x - SW / 2, wt = y - SH / 2;
    var mark = add(layer, '<div style="position:absolute;left:' + wl + "px;top:" + wt + "px;width:" + SW + "px;height:" + SH + "px;z-index:94;pointer-events:none;opacity:0;border:22px solid " + ink + ";border-radius:52px;box-sizing:border-box;outline:9px solid " + ink + ';outline-offset:-62px"></div>');
    gsap.set(stamp, { transformOrigin: "50% 100%" });
    tl.set(stamp, { opacity: 1 }, at);
    tl.fromTo(stamp, { y: -(y + 200) }, { y: 0, duration: hit - at, ease: "power3.in", immediateRender: false }, at);
    tl.to(stamp, { scaleX: 1.1, scaleY: 0.85, duration: 2 * F, ease: "power2.out" }, hit);
    tl.to(stamp, { scaleX: 1, scaleY: 1, y: -(y + 900), duration: 0.27 * dur, ease: "power2.in" }, hit + 0.07 * dur);
    tl.set(stamp, { opacity: 0 }, hit + 0.34 * dur + F);
    // the incoming scene shows through the ink window, then the window grows past the frame
    tl.set(inn, { clipPath: inset(wl, wt, SW, SH, 52) }, hit);
    tl.set(mark, { opacity: 1 }, hit);
    tl.set(inn, { zIndex: 3 }, hit);
    var grow = { duration: 0.55 * dur, ease: "power3.inOut" };
    tl.to(inn, Object.assign({ clipPath: inset(-40, -40, d.w + 80, d.h + 80, 0) }, grow), hit + 0.2 * dur);
    tl.to(mark, Object.assign({ left: -40, top: -40, width: d.w + 80, height: d.h + 80, opacity: 0 }, grow), hit + 0.2 * dur);
    tl.set(inn, { clipPath: "none" }, hit + 0.75 * dur);
    // a hard shake right after the thump, alternating each frame
    for (var k = 0; k < 6; k++) { var a = 1 - k / 6, sg = k % 2 ? 1 : -1; tl.set([out, inn], { x: sg * 15 * a, y: -sg * 9 * a }, hit + k * F); }
    tl.set([out, inn], { x: 0, y: 0 }, hit + 6 * F);
    return { at: hit, sfx: "stamp" };
  }

  // Page turn, for "next step" or a new chapter: the outgoing scene swings away like a book page on a hinge
  // (from: "right" hinges on the left edge), its face darkening, uncovering the incoming scene.
  function pageTurn(tl, out, inn, at, o) {
    o = o || {}; out = $(out); inn = $(inn);
    var dur = pick(o.dur, 12 * F), right = o.from !== "left";
    cutPrep(tl, out, inn, at, dur);
    var shade = add(out, '<div style="position:absolute;inset:0;z-index:90;pointer-events:none;opacity:0;background:linear-gradient(' + (right ? "to left" : "to right") + ',rgba(20,12,4,.65),rgba(20,12,4,0) 70%)"></div>');
    var under = add(inn, '<div style="position:absolute;inset:0;z-index:90;pointer-events:none;opacity:0;background:#140c04"></div>');
    gsap.set(out, { transformOrigin: right ? "0% 50%" : "100% 50%", backfaceVisibility: "hidden" });
    tl.fromTo(out, { rotationY: 0, rotationZ: 0 }, { rotationY: right ? -100 : 100, rotationZ: right ? -3 : 3, transformPerspective: 2400, duration: dur, ease: "power2.in" }, at);
    tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power1.in", immediateRender: false }, at);
    tl.fromTo(under, { opacity: 0.45 }, { opacity: 0, duration: dur, ease: "power1.in", immediateRender: false }, at);
    return { at: at, sfx: "page flip" };
  }

  root.PA = { C: C, snapZoom: snapZoom, crane: crane, dutchTilt: dutchTilt, tiltShift: tiltShift, focusPulse: focusPulse, focusHunt: focusHunt,
    foregroundPass: foregroundPass, povMask: povMask, orbit: orbit, tapePull: tapePull, stampCut: stampCut, pageTurn: pageTurn };
})(window);
