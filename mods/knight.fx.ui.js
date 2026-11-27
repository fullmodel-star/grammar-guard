// 文法騎士絕招演出（三招 × 三級）— 2026-11-22 v3 第 1 期「⑥騎士畫面與演出」
// 依據：DESIGN_v3_2026-11-22.md 第三節、_research/同類遊戲研究_2026-11-22.md 第四節「英雄大招的華麗感」。
// 全部 Canvas 2D 自繪（不用圖檔／字型／emoji）；音效用 Web Audio 合成（不用外部音檔）。
// 只畫演出，不改遊戲數值：傷害、暈眩、擋怪全部由騎士引擎（⑤）決定，這裡只負責「看起來、聽起來」。
//
// ───────────── 介面（照 mods/CONTRACT_v3.md §9.3；window.KnightFX，有 TGUI 時也掛在 TGUI.knightFx）─────────────
//   KnightFX.play(ev, G)           ev＝引擎事件 { k:"knightUlt", ult:"wall"|"tense3"|"beWrath", hit, n, x, y, tier:1~3, targets:[{x,y,id}], text }
//                                  hit＝0 開始一段演出；同一招 hit≥1 的事件只用來更新後面幾刀的目標位置（不重播）。回傳演出物件 show（或 null）。
//   KnightFX.play(ultId, tier, x, y, opts)  直接呼叫版（預覽頁、測試用）：ultId＝wall｜tense｜be（tense3／beWrath 等別名也收）；
//                                  opts＝{ targets:[敵人物件或 {x,y,fly}], ang, dir, radius, stage:0~4, muted, seed, onHit(i,info), onEnd(show) }
//                                  show＝{ ult, tier, t, T, done, mainHit, hits:[秒], skip() }；同時只播一個，播新的會把舊的收掉。
//   KnightFX.update(realDt)        每幀推進（真實秒數，不乘遊戲速度）→ 回傳是否還在演出
//   KnightFX.draw(ctx, G, run)     在 drawTop 裡呼叫：ctx 已由 index 套好鏡頭（§9.2），世界層直接畫；閃光／壓暗／切入圖／字幕
//                                  用 TGUI.view().s 換回螢幕座標畫（save→setTransform→restore）。
//                                  預覽頁用 draw(ctx, { s, ox, oy })：沒有 index 時自己套鏡頭。
//   KnightFX.timeScale()           0＝停格（KnightFX.hitstopScale 可調）、0.25＝慢動作（只有傳說級）、平常 1
//   KnightFX.cameraTransform()     → { z, x, y, dx, dy }｜null（合約格式，給 TGUI.camMerge；震動也放在 dx/dy）
//   KnightFX.camera()              → { zoom, tx, ty, fx, fy, shakeX, shakeY, active }（螢幕＝世界×zoom＋(tx,ty)；預覽頁用）
//   KnightFX.cameraMatrix(s,ox,oy)／applyCamera(ctx,s,ox,oy)  沒有 index 時自己套鏡頭
//   KnightFX.busy()／active()／skip()／reset()／preload(s, stage)／tierFor(...)／create(cfg)（獨立實例）
//   KnightFX.ULTS／TIERS（規格表）、KnightFX.stats（粒子最大量、畫一幀耗時）、KnightFX.reduced（減少動態，預設跟系統）
//   KnightFX.quality＝"auto"（預設：連續 4 幀繪圖 > 8ms 自動切省電）｜"high"｜"low"；KnightFX.lite＝目前是否省電
//     省電版：不壓暗背景、不畫放射速度線與切入圖流光、光暈縮小、粒子上限減半、文字不加外光；停格／鏡頭／閃光／文字照常
//
// ───────────── 掛勾（本檔自己註冊，§9.3）與假設 ─────────────
//   event → play(ev,G)｜frame → update(real)｜drawTop → draw(ctx,G,run)｜timeScale → v×timeScale()｜camera → camMerge(cam, cameraTransform())｜
//   tap → 同一招第 2 次起點一下畫面就跳過（不吃掉這次點擊，原本的點擊照常）。
//   假設（引擎 knight.js 還是空殼，之後對齊）：ev.x／ev.y＝騎士腳底；ev.targets＝這一擊打到的怪（有 id 就去 G.enemies 找本體，跟著怪移動、
//   飛行怪抬高）；目標不足時從 G.enemies 補最近的怪當演出目標（只影響畫面，不影響傷害）。ev.text 目前不用：三招的英文字由本檔固定
//   （時態 past／now／will → 傳說級 I was／I am／I will be；Be 之怒 am／is／are → I am／He is／We are；盾牆 STOP! → Stay back!），避免「I is」這類錯配。
//   時態三連斬的三刀由本檔依真實時間排好節奏（傳說級 0.15／0.40／0.65 秒），引擎的三擊依遊戲時間結算，停格期間扣血會比畫面稍晚。
//   prefers-reduced-motion：不縮放、不震動、不閃光、不畫放射速度線，切入圖改淡入；保留停格、文字、粒子。
//   光敏安全：一次演出只有 1 次全螢幕閃光（每秒 ≤ 3 次）；之後的命中只用局部光暈；傳說級金色閃光是放射漸層（中心 60%、邊緣 18%），怪看得到。
//
// ───────────── 效能 ─────────────
//   粒子固定物件池 MAX_P＝160 顆（不會每幀 new）；三級實際用量約 30／70／130。形狀特效都由演出時間直接算，不另開陣列。
//   光暈／壓暗／金色閃光都是 64px 放射貼圖（快取）再縮放貼上，不每幀建大面積漸層；切入圖的騎士半身像也是離屏快取。
//   實測見 art/knight-fx-sheet.html?bench=3（每幀清畫布＋強制點陣化後量 draw 的耗時）。
(function (root) {
  "use strict";
  const W = root;
  const FW = 300, FH = 400, MAX_P = 160;
  const PI = Math.PI, TAU = PI * 2;
  const INK = "#0c1122", GOLD = "#E1B86A", GOLDL = "#F3D494";
  const FONT_EN = "'Segoe UI','Helvetica Neue',Arial,system-ui,sans-serif";
  const FONT_ZH = "'Microsoft JhengHei','PingFang TC','Noto Sans TC',system-ui,sans-serif";
  const HAS_DOC = typeof document !== "undefined";

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeIn = u => { u = clamp(u, 0, 1); return u * u * u; };
  const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const easeOutBack = u => { u = clamp(u, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const nowS = () => (W.performance && W.performance.now ? W.performance.now() : Date.now()) / 1000;
  const env = (t, a, b, fi, fo) => t < a || t > b ? 0 : Math.min(1, fi > 0 ? (t - a) / fi : 1, fo > 0 ? (b - t) / fo : 1);   // 淡入淡出包絡
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const RGB = {};
  function rgba(hex, a) {
    let c = RGB[hex];
    if (!c) { const h = hex.replace("#", ""); c = RGB[hex] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)].join(","); }
    return "rgba(" + c + "," + (+a).toFixed(3) + ")";
  }

  // ═════ 規格表（三級）：CONTRACT_v3 §9.3＋研究筆記 4-2 的起始值；要實機調就改這裡
  //   cap＝同時存活粒子上限（規格 20／40／80，多留一點給光暈）；總池 MAX_P＝160
  const TIERS = {
    // 第二輪 P1-15（11-24 小明）：一般孩子幾乎只看到第 1 級，原本只有 0.45 秒小「STOP!」→ 第 1 級也給短暫拉近（×1.1）＋一次閃光＋畫面中間大字（drawTitle1）；威力不變
    1: { key: "normal", name: "普通", stars: "★", T: 0.85, stop: 0.05, hitStop: 0, zoom: 1.1, slow: 1, slowT: 0,
         flashA: 0.38, flashT: 0.12, flashRGB: "255,255,255", radialFlash: false, shake: 5, shakeT: 0.22, hitShake: 0,
         darken: 0, speedLines: false, cutin: false, word: 12, sound: 1, parts: 24, cap: 28 },
    2: { key: "fancy", name: "華麗", stars: "★★", T: 0.9, stop: 0.10, hitStop: 0.03, zoom: 1.15, slow: 1, slowT: 0,
         flashA: 0.4, flashT: 0.12, flashRGB: "255,255,255", radialFlash: false, shake: 8, shakeT: 0.3, hitShake: 4,
         darken: 0, speedLines: false, cutin: false, word: 15, sound: 2, parts: 40, cap: 48 },
    3: { key: "legend", name: "傳說", stars: "★★★", T: 1.6, stop: 0.15, hitStop: 0.06, zoom: 1.3, slow: 0.25, slowT: 0.5,
         flashA: 0.6, flashT: 0.15, flashRGB: "255,214,120", radialFlash: true, shake: 12, shakeT: 0.35, hitShake: 12,
         darken: 0.5, speedLines: true, cutin: true, word: 20, sound: 3, parts: 80, cap: 96 }
  };
  const ULTS = {
    wall: { id: "wall", name: "盾牆", en: "SHIELD WALL", note: "祈使句：直接下命令" },
    tense: { id: "tense", name: "時態三連斬", en: "TENSE TRIPLE SLASH", note: "過去 → 現在 → 未來" },
    be: { id: "be", name: "Be 之怒", en: "WRATH OF BE", note: "be 動詞跟著主詞變" }
  };
  const ALIAS = { wall: "wall", shield: "wall", shieldwall: "wall", tense: "tense", tense3: "tense", slash: "tense", tenseslash: "tense", triple: "tense", be: "be", bewrath: "be", wrath: "be", berage: "be" };
  const TIER_ALIAS = { normal: 1, fancy: 2, legend: 3, legendary: 3 };
  // 時態三刀：顏色與字樣（第 1 級小字、第 2 級大字、第 3 級組成句子）
  const TENSE = [
    { key: "past", col: "#ffb35a", core: "#fff0d8", w: ["past", "PAST!", "I was"] },
    { key: "now", col: "#ffe27a", core: "#ffffff", w: ["now", "NOW!", "I am"] },
    { key: "will", col: "#7fe3ff", core: "#effcff", w: ["will", "WILL!", "I will be"] }
  ];
  const BE = [{ w: "am", col: "#ff9a7a", subj: "I" }, { w: "is", col: "#ffd75e", subj: "He" }, { w: "are", col: "#8fd0ff", subj: "We" }];
  const WALL_WORD = ["", "STOP!", "STAY BACK"];
  const WALL_SUB = [["Stop!", "#ffe27a"], ["Stay back!", "#9fd0ff"]];

  // 騎士外觀階段的配色（art/knight-art.js 的 ART.KNIGHT_FX；沒有就用預設銀藍）
  function stageCol(stage) {
    let fx = null;
    try { const t = W.ART && W.ART.KNIGHT_FX; if (t && stage != null) fx = t[clamp(stage | 0, 0, t.length - 1)]; } catch (e) {}
    const arc = fx && fx.arc ? fx.arc : "170,215,255", sp = fx && fx.spark ? fx.spark : "255,226,150";
    return { arc, spark: sp, arcHex: "#" + arc.split(",").map(v => (+v).toString(16).padStart(2, "0")).join(""), spHex: "#" + sp.split(",").map(v => (+v).toString(16).padStart(2, "0")).join("") };
  }

  // ═════ 音效（Web Audio 合成，全實例共用一個 AudioContext）
  let AC = null, MG = null, NB = null;
  function audio(inst) {
    if (inst.muted || (inst.sh && inst.sh.muted)) return null;
    try { if (W.TGUI && W.TGUI.S && W.TGUI.S.muted) return null; } catch (e) {}
    try {
      if (!AC) { const C = W.AudioContext || W.webkitAudioContext; if (!C) return null; AC = new C(); MG = AC.createGain(); MG.gain.value = 0.85; MG.connect(AC.destination); }
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(a, f, d, type, v, f2, delay) {
    try {
      const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(MG); o.start(t0); o.stop(t0 + d + 0.05);
    } catch (e) {}
  }
  function noise(a, d, v, ftype, f1, f2, delay, q) {
    try {
      if (!NB) { NB = a.createBuffer(1, Math.floor(a.sampleRate * 1.2), a.sampleRate); const ch = NB.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const t0 = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = NB; f.type = ftype || "lowpass"; f.frequency.setValueAtTime(f1 || 1200, t0); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + d); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      s.connect(f); f.connect(g); g.connect(MG); s.start(t0); s.stop(t0 + d + 0.03);
    } catch (e) {}
  }
  // 三層：①打擊（全部）②低頻轟（華麗起）③高頻鈴＋騎士喊聲（傳說）
  const SND = {
    impact(a, k) { noise(a, 0.14, 0.09 * k, "lowpass", 3200, 500); tone(a, 900, 0.08, "triangle", 0.05 * k, 260); },
    boom(a) { tone(a, 78, 0.7, "sine", 0.16, 30); noise(a, 0.55, 0.07, "lowpass", 420, 90); },
    bell(a) { [1318.5, 1975.5, 2637].forEach((f, i) => tone(a, f, 1.1 - i * 0.2, "sine", 0.03 - i * 0.006, null, 0.02 * i)); },
    shout(a) {   // 「哈！」：鋸齒波過兩個帶通（母音共振峰），音高下滑
      try {
        const t0 = a.currentTime, o = a.createOscillator(), g = a.createGain(), f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter(), mix = a.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(210, t0); o.frequency.exponentialRampToValueAtTime(150, t0 + 0.28);
        f1.type = "bandpass"; f1.frequency.setValueAtTime(650, t0); f1.frequency.linearRampToValueAtTime(820, t0 + 0.2); f1.Q.value = 6;
        f2.type = "bandpass"; f2.frequency.value = 1150; f2.Q.value = 8;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(MG); o.start(t0); o.stop(t0 + 0.36);
        noise(a, 0.12, 0.03, "bandpass", 1800, 900, 0, 2);
      } catch (e) {}
    },
    clang(a, k) { tone(a, 523, 0.22, "square", 0.025 * k, 500); tone(a, 1568, 0.3, "triangle", 0.02 * k, 1400, 0.005); noise(a, 0.08, 0.04 * k, "highpass", 3000); },
    swish(a, i) { const b = [1600, 2400, 3600][i] || 2400; noise(a, 0.11, 0.08, "bandpass", b, b * 2.6, 0, 1.4); tone(a, [392, 523, 784][i] || 523, 0.12, "triangle", 0.03, null, 0.03); },
    dong(a, i) { const f = [261.6, 329.6, 392][i] || 330; tone(a, f, 0.45, "triangle", 0.06); tone(a, f * 2, 0.3, "sine", 0.025, null, 0.01); noise(a, 0.18, 0.05, "lowpass", 900, 120); },
    rise(a, d) { tone(a, 220, d, "sawtooth", 0.018, 880); noise(a, d, 0.03, "bandpass", 400, 3000, 0, 1.2); },
    burst(a) { noise(a, 0.5, 0.14, "lowpass", 5000, 200); tone(a, 60, 0.8, "sine", 0.18, 28); [784, 988, 1175, 1568].forEach((f, i) => tone(a, f, 0.5, "triangle", 0.02, null, 0.04 * i)); }
  };

  // ═════ 放射漸層貼圖快取：光暈、壓暗、金色閃光都先畫成 64px 小圖，之後只 drawImage（比每幀 createRadialGradient 填滿大面積便宜很多）
  const SPR = {};
  function radialSprite(key, rgb, stops) {
    if (SPR[key] !== undefined) return SPR[key];
    let c = null;
    try {
      if (HAS_DOC) {
        c = document.createElement("canvas"); c.width = c.height = 64;
        const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        for (const [o, a] of stops) gr.addColorStop(o, "rgba(" + rgb + "," + a + ")");
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
    } catch (e) { c = null; }
    SPR[key] = c; return c;
  }
  const hexRgb = hex => { rgba(hex, 1); return RGB[hex]; };
  // 以 (x,y) 為圓心、半徑 r 貼放射圖；圓外用純色 edge 補滿戰場（壓暗、閃光用）。
  // 全部對齊到整數裝置像素再畫：貼圖與補色的交界不會因反鋸齒重疊／留縫而出現一條細線。
  function radialFill(ctx, spr, x, y, r, edgeStyle) {
    const m = ctx.getTransform ? ctx.getTransform() : null;
    if (!m) { ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); return; }
    const X = v => Math.round(m.a * v + m.e), Y = v => Math.round(m.d * v + m.f);
    const fx0 = X(0), fy0 = Y(0), fx1 = X(FW), fy1 = Y(FH);
    const L = X(x - r), Rt = X(x + r), T = Y(y - r), B = Y(y + r);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(spr, L, T, Rt - L, B - T);
    if (edgeStyle) {
      ctx.fillStyle = edgeStyle;
      if (T > fy0) ctx.fillRect(fx0, fy0, fx1 - fx0, T - fy0);
      if (B < fy1) ctx.fillRect(fx0, B, fx1 - fx0, fy1 - B);
      const t0 = Math.max(fy0, T), t1 = Math.min(fy1, B);
      if (t1 > t0) { if (L > fx0) ctx.fillRect(fx0, t0, L - fx0, t1 - t0); if (Rt < fx1) ctx.fillRect(Rt, t0, fx1 - Rt, t1 - t0); }
    }
    ctx.restore();
  }

  function detectReduced() { try { return !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }

  // ═════ 實例
  function create(cfg) {
    cfg = cfg || {};
    const I = {
      sh: null, P: [], nP: 0, pi: 0, extT: -1, muted: !!cfg.muted, hitstopScale: 0,
      reduced: cfg.reduced != null ? !!cfg.reduced : detectReduced(),
      stats: { maxP: 0, frames: 0, drawMs: 0, drawAvg: 0, drawMax: 0, played: 0, lite: false }, seen: {},
      quality: cfg.quality || "auto", lite: cfg.quality === "low", slowN: 0,   // 省電模式：auto＝畫太慢就自動切
      cache: {}
    };
    for (let i = 0; i < MAX_P; i++) I.P.push({ on: false, k: "", x: 0, y: 0, vx: 0, vy: 0, g: 0, dr: 1, t: 0, T: 1, s: 1, c: "#fff", rot: 0, vr: 0, ch: "", add: true });

    // ───── 粒子池
    function spawn(k, x, y, vx, vy, T, s, c, g, dr, add, ch) {
      if (I.nP >= MAX_P || (I.sh && I.nP >= (I.lite ? I.sh.tr.cap >> 1 : I.sh.tr.cap))) return null;
      for (let n = 0; n < MAX_P; n++) {
        const p = I.P[(I.pi + n) % MAX_P];
        if (p.on) continue;
        I.pi = (I.pi + n + 1) % MAX_P;
        p.on = true; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.T = T; p.t = 0; p.s = s; p.c = c; p.g = g || 0; p.dr = dr == null ? 1 : dr;
        p.add = add !== false; p.ch = ch || ""; p.rot = I.rng() * TAU; p.vr = (I.rng() - 0.5) * 12;
        I.nP++; if (I.nP > I.stats.maxP) I.stats.maxP = I.nP;
        return p;
      }
      return null;
    }
    I.rng = Math.random;
    function burst(x, y, n, sp, col, T, size, opt) {
      opt = opt || {};
      const a0 = opt.a0 == null ? 0 : opt.a0, spread = opt.spread == null ? TAU : opt.spread;
      for (let i = 0; i < n; i++) {
        const a = a0 - spread / 2 + spread * (n > 1 ? i / (n - 1) : 0.5) + (I.rng() - 0.5) * 0.5, v = sp * (0.45 + I.rng() * 0.75);
        if (!spawn(opt.k || "spark", x, y, Math.cos(a) * v, Math.sin(a) * v - (opt.up || 0), T * (0.7 + I.rng() * 0.5), size * (0.7 + I.rng() * 0.6), col, opt.g == null ? 120 : opt.g, opt.dr == null ? 0.9 : opt.dr, opt.add)) return;
      }
    }
    function stepParticles(dt) {
      if (!I.nP) return;
      for (let i = 0; i < MAX_P; i++) {
        const p = I.P[i]; if (!p.on) continue;
        p.t += dt; if (p.t >= p.T) { p.on = false; I.nP--; continue; }
        const d = Math.pow(p.dr, dt * 60);
        p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    }

    // ───── 播放
    function norm(ultId, tier) {
      const u = ALIAS[String(ultId || "").toLowerCase()] || "wall";
      let t = typeof tier === "string" ? (TIER_ALIAS[tier.toLowerCase()] || parseInt(tier, 10)) : tier;
      t = clamp(Math.round(t || 1), 1, 3);
      return [u, t];
    }
    function normTargets(list) {
      const out = [];
      for (const e of list || []) {
        if (!e || !isFinite(e.x) || !isFinite(e.y)) continue;
        let fly = !!e.fly;
        try { if (!fly && e.type && W.TG && W.TG.ENEMIES && W.TG.ENEMIES[e.type]) fly = !!W.TG.ENEMIES[e.type].fly; } catch (err) {}
        out.push({ ref: e, x: e.x, y: e.y, fly });
        if (out.length >= 12) break;
      }
      return out;
    }
    const livePos = p => { const r = p.ref; if (r && isFinite(r.x) && isFinite(r.y) && !(r.hp <= 0)) { p.x = r.x; p.y = r.y; } return p; };
    const bodyY = p => p.y - (p.fly ? 14 : 7);

    // 引擎事件版：{ k:"knightUlt", ult, hit, n, x, y, tier, targets:[{x,y,id}], text }
    function resolveTargets(list, G) {
      const out = [], es = G && G.enemies || [];
      for (const t of list || []) {
        if (!t) continue;
        const e = t.id != null ? es.find(o => o.id === t.id) : null;
        out.push(e || t);
      }
      return out;
    }
    function playEvent(ev, G) {
      const [ult, tier] = norm(ev.ult, ev.tier);
      const hit = ev.hit | 0, cur = I.sh;
      const tg = resolveTargets(ev.targets, G);
      if (hit > 0) {   // 同一段演出的後續一擊：只更新還沒砍出去的那一刀
        if (cur && !cur.done && cur.ult === ult && ult === "tense" && tg.length) {
          const sl = cur.slashes && cur.slashes[hit];
          if (sl && cur.t < sl.t) { const n = normTargets(tg)[0]; if (n) { sl.q = { ref: n.ref, x: n.x, y: n.y, fly: n.fly }; sl.sx = n.x; sl.sy = bodyY(n); } }
        }
        return cur || null;
      }
      const x = isFinite(ev.x) ? ev.x : 150, y = isFinite(ev.y) ? ev.y : 250;
      // 目標不夠就從場上補最近的怪（只影響畫面）
      const es = (G && G.enemies || []).filter(e => e && !(e.hp <= 0) && tg.indexOf(e) < 0);
      const want = ult === "tense" ? 3 : 8, range = ult === "be" ? (ev.radius || [55, 75, 100][tier - 1]) + 8 : 90;
      if (tg.length < want && es.length) {
        es.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
        for (const e of es) { if (tg.length >= want || Math.hypot(e.x - x, e.y - y) > range) break; tg.push(e); }
      }
      let stage = ev.stage;
      try { if (stage == null && G && W.TG && W.TG.heroEvo) { const h = (G.heroes || []).find(o => (o.id || "knight") === "knight"); if (h) stage = W.TG.heroEvo(h); } } catch (e) {}
      return playRaw(ult, tier, x, y, { targets: tg, ang: ev.ang, dir: ev.dir, stage, radius: ev.radius, text: ev.text });
    }
    function play(a, b, c, d, e) {
      if (a && typeof a === "object") return playEvent(a, b);
      return playRaw(a, b, c, d, e);
    }
    function playRaw(ultId, tier, x, y, opts) {
      opts = opts || {};
      if (I.sh) finish(I.sh, true);
      const [ult, tv] = norm(ultId, tier), tr = TIERS[tv];
      I.rng = opts.seed != null ? mulberry(opts.seed) : Math.random;
      x = isFinite(x) ? x : 150; y = isFinite(y) ? y : 250;
      const targets = normTargets(opts.targets);
      let ang = opts.ang;
      if (!isFinite(ang)) {
        if (targets.length) { let sx = 0, sy = 0; for (const t of targets) { sx += t.x; sy += t.y; } ang = Math.atan2(sy / targets.length - y, sx / targets.length - x); }
        else ang = (opts.dir || 1) < 0 ? PI : 0;
      }
      const dir = opts.dir || (Math.cos(ang) < 0 ? -1 : 1);
      const sh = {
        ult, tier: tv, tr, lv: tv - 1, x, y, ang, dir, targets, t: 0, T: tr.T, done: false, skipped: false,
        ev: [], ei: 0, stops: [], shakes: [], flash0: -1, slow0: 0, zoomHold: 0, mainHit: 0, hits: [],
        muted: !!opts.muted, onHit: opts.onHit, onEnd: opts.onEnd, col: stageCol(opts.stage), info: ULTS[ult],
        sword: { x: x + dir * 7, y: y - 17 }, bandY: y > 200 ? 112 : 300, opts
      };
      sh.f = { x: Math.cos(ang), y: Math.sin(ang) }; sh.p = { x: -sh.f.y, y: sh.f.x };
      if (ult === "wall") setupWall(sh); else if (ult === "tense") setupTense(sh); else setupBe(sh);
      // 鏡頭焦點：華麗＝騎士；傳說＝騎士與目標之間（怪也要在畫面裡）
      let fx = x, fy = y - 12;
      if (tv === 3 && sh.aim) { fx = lerp(x, sh.aim.x, 0.4); fy = lerp(y - 12, sh.aim.y, 0.4); }
      sh.fx = fx; sh.fy = fy;
      sh.zoomHold = tv === 3 ? sh.T - 0.42 : sh.mainHit + tr.stop + 0.3;
      sh.slow0 = sh.mainHit + tr.stop;
      sh.ev.sort((a, b) => a.t - b.t);
      sh.skip = () => skipShow(sh);
      I.seen[ult] = (I.seen[ult] || 0) + 1; sh.skippable = I.seen[ult] >= 2;   // 同一招第 2 次起可點擊跳過
      I.sh = sh; I.stats.played++;
      return sh;
    }
    // 排程小工具
    function at(sh, t, fn, isHit) { sh.ev.push({ t, fn, hit: !!isHit }); }
    function snd(sh, t, fn) { at(sh, t, () => { const a = audio(I); if (a) fn(a); }); }
    function hitAt(sh, t, i, main, info) {
      sh.hits.push(t);
      if (main) { sh.mainHit = t; sh.stops.push([t, t + sh.tr.stop]); sh.flash0 = t; sh.shakes.push({ t0: t, A: sh.tr.shake, D: sh.tr.shakeT }); }
      else if (sh.tr.hitStop > 0) { sh.stops.push([t, t + sh.tr.hitStop]); if (sh.tr.hitShake) sh.shakes.push({ t0: t, A: sh.tr.hitShake, D: 0.22 }); }
      else if (sh.tr.hitShake) sh.shakes.push({ t0: t, A: sh.tr.hitShake, D: 0.18 });
      at(sh, t, s => { if (s.onHit) try { s.onHit(i, info || {}); } catch (e) {} }, true);
      snd(sh, t, a => SND.impact(a, main ? 1 : 0.7));
    }
    function layers(sh, t) {   // 音效第 2、3 層
      if (sh.tr.sound >= 2) snd(sh, t, a => SND.boom(a));
      if (sh.tr.sound >= 3) { snd(sh, t, a => SND.bell(a)); snd(sh, Math.max(0, t - 0.12), a => SND.shout(a)); }
    }

    // ───── 盾牆：盾一面面從地面升起排成弧牆 → 重擊往前推出衝擊帶；傳說級最後整面盾牆炸成字母
    function setupWall(sh) {
      const L = sh.lv, n = [5, 7, 9][L], gap = 12.5, d0 = 18, f = sh.f;
      const p = sh.p.x < 0 || (Math.abs(sh.p.x) < 1e-6 && sh.p.y < 0) ? { x: -sh.p.x, y: -sh.p.y } : sh.p;   // 盾的排列方向：由左到右（直立牆由上到下）
      const flat = Math.abs(p.x) > 0.7;   // 橫向牆才把字母寫在盾上；直立牆字母會變成直排難讀 → 改用盾徽＋上方橫寫大字
      const cx = sh.x + f.x * d0, cy = sh.y + f.y * d0;
      const word = WALL_WORD[L].replace(/ /g, "");
      const wordN = WALL_WORD[L].length, start = Math.floor((n - wordN) / 2);
      const sh0 = [];
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * gap, bend = -(off * off) / (n * gap * 1.6);
        const ch = flat ? (WALL_WORD[L][i - start] || "") : "";
        sh0.push({ x: cx + p.x * off + f.x * bend, y: cy + p.y * off + f.y * bend, rt: 0.02 + Math.abs(i - (n - 1) / 2) * 0.022, ch: ch === " " ? "" : ch });
      }
      const hit = [0.13, 0.22, 0.3][L];
      sh.wall = { n, shields: sh0, cx, cy, hit, push: [8, 14, 20][L], reach: [34, 50, 70][L], burstT: L === 2 ? 1.22 : 0, word, flat };
      sh.aim = { x: cx + f.x * 30, y: cy + f.y * 30 - 6 };
      snd(sh, 0, a => SND.clang(a, 0.6));
      hitAt(sh, hit, 0, true, { x: cx, y: cy });
      layers(sh, hit);
      snd(sh, hit + 0.02, a => SND.clang(a, 1));
      const parts = sh.tr.parts;
      at(sh, 0.01, () => burst(sh.x + f.x * 6, sh.y, 6 + L * 4, 40, "#c8b488", 0.45, 2.2, { k: "dust", g: -10, add: false, up: 10, dr: 0.9 }));
      at(sh, hit, s => {
        const c = s.col;
        for (const q of s.wall.shields) burst(q.x, q.y - 12, Math.round(parts * 0.35 / n), 70, c.spHex, 0.5, 1.6, { a0: Math.atan2(f.y, f.x), spread: 1.6, up: 30 });
        spawn("glow", cx, cy - 6, 0, 0, 0.22, 40 + L * 14, c.arcHex, 0, 1, true);
        if (L >= 1) for (const q of s.wall.shields) spawn("dust", q.x, q.y + 1, f.x * 25 + (I.rng() - 0.5) * 30, -6, 0.55, 3.5, "#b8a27a", -8, 0.9, false);
      });
      // 衝擊帶打到目標：局部火花
      for (const tg of sh.targets) {
        const d = Math.max(0, (tg.x - cx) * f.x + (tg.y - cy) * f.y);
        if (d > sh.wall.push + sh.wall.reach + 18) continue;
        const tt = hit + 0.04 + clamp(d / (sh.wall.push + sh.wall.reach), 0, 1) * 0.22;
        at(sh, tt, () => { livePos(tg); burst(tg.x, bodyY(tg), 4 + L * 2, 80, "#ffffff", 0.3, 1.4, { a0: sh.ang, spread: 1.8 }); spawn("glow", tg.x, bodyY(tg), 0, 0, 0.16, 12 + L * 4, "#cfe6ff", 0, 1, true); });
      }
      if (L === 2) {
        const bt = sh.wall.burstT;
        hitAt(sh, bt, 1, false, { x: cx, y: cy, burst: true });
        snd(sh, bt, a => SND.burst(a));
        at(sh, bt, s => {
          s.wall.shields.forEach((q, i) => {
            const ox = q.x + f.x * s.wall.push, oy = q.y + f.y * s.wall.push - 8, ch = q.ch || (s.wall.flat ? "" : s.wall.word[i % s.wall.word.length]);
            if (ch) spawn("letter", ox, oy, f.x * 90 + (I.rng() - 0.5) * 50, f.y * 90 - 50 - I.rng() * 40, 0.42, 10, GOLDL, 160, 0.94, false, ch);
            burst(ox, oy, 5, 90, s.col.arcHex, 0.45, 2.2, { k: "chip", add: false, g: 160 });
          });
          spawn("glow", cx + f.x * 16, cy + f.y * 16 - 6, 0, 0, 0.3, 80, "#ffe7a8", 0, 1, true);
        });
      }
    }

    // ───── 時態三連斬：past／now／will 三刀不同顏色與字樣；可打飛行；傳說級最後十字斬＋組成句子
    function setupTense(sh) {
      const L = sh.lv, f = sh.f, p = sh.p;
      let pts = sh.targets.slice(0, 3).map(t => ({ ref: t.ref, x: t.x, y: t.y, fly: t.fly, src: t }));
      if (!pts.length) pts = [0, 1, 2].map(i => ({ x: sh.x + f.x * (26 + i * 10) + p.x * (i - 1) * 12, y: sh.y + f.y * (26 + i * 10) + p.y * (i - 1) * 12, fly: false }));
      for (let i = 0; pts.length < 3; i++) { const b = pts[i % pts.length]; pts.push({ ref: b.ref, src: b.src, x: b.x, y: b.y, fly: b.fly }); }
      const s0 = [0.05, 0.09, 0.15][L], gap = [0.13, 0.19, 0.25][L];
      const ORI = [0.75, PI + 0.08, -0.85];   // 斜劈、橫斬、上挑
      sh.slashes = pts.map((q, i) => ({ q, t: s0 + i * gap, ori: ORI[i] + (I.rng() - 0.5) * 0.25, r: [13, 17, 21][L], sx: q.x, sy: bodyY(q) }));
      let ax = 0, ay = 0; for (const s of sh.slashes) { ax += s.sx; ay += s.sy; }
      sh.aim = { x: ax / 3, y: ay / 3 };
      sh.finT = L === 2 ? 1.2 : 0;
      snd(sh, 0, a => SND.rise(a, 0.08 + L * 0.05));
      sh.slashes.forEach((s, i) => {
        hitAt(sh, s.t, i, i === 0, { tense: TENSE[i].key });
        snd(sh, Math.max(0, s.t - 0.02), a => SND.swish(a, i));
        at(sh, s.t, () => {
          livePos(s.q); if (s.q.ref) { s.sx = s.q.x; s.sy = bodyY(s.q); }
          const T = TENSE[i];
          burst(s.sx, s.sy, Math.round(sh.tr.parts * 0.22), 90 + L * 30, T.col, 0.42, 1.7, { a0: s.ori, spread: 2.2 });
          spawn("glow", s.sx, s.sy, 0, 0, 0.18, 14 + L * 7, T.col, 0, 1, true);
        });
      });
      layers(sh, sh.slashes[0].t);
      if (L === 2) {
        const ft = sh.finT;
        hitAt(sh, ft, 3, false, { finale: true });
        snd(sh, ft, a => SND.burst(a));
        at(sh, ft, s => {
          for (let i = 0; i < 3; i++) burst(s.aim.x, s.aim.y, 12, 150, TENSE[i].col, 0.5, 2, { a0: i * 2.1, spread: 2.4 });
          spawn("glow", s.aim.x, s.aim.y, 0, 0, 0.3, 70, "#fff3c4", 0, 1, true);
        });
      }
    }

    // ───── Be 之怒：舉劍引光 → am／is／are 從天砸地 → 大範圍衝擊波＋地裂＋暈眩星星
    function setupBe(sh) {
      const L = sh.lv, f = sh.f, R = sh.opts.radius || [55, 75, 100][L];
      const raise = [0.06, 0.16, 0.24][L], fall = [0, 0.13, 0.17][L];
      const h = raise + fall + (L ? 0.1 : 0.04);
      sh.be = { R, raise, h, words: [], cracks: [], stun: [], echoT: L === 2 ? 1.26 : 0 };
      // 第二輪 P2（11-24 小華）：第 3 級 am／is／are 字大、原本間距只有約 41 像素 → 三個字疊在一起；騎士靠近右邊時字被切掉
      //   → 華麗／傳說級改成固定間距（50／64 像素）橫排，整組中心夾在畫面內，三個字一定分開、不出界
      const sp = L === 2 ? 64 : L === 1 ? 50 : 0, gx = clamp(sh.x, 26 + sp, FW - 26 - sp);
      for (let i = 0; i < 3; i++) {
        const a = -PI / 2 + (i - 1) * 0.8, r = R * (L ? 0.46 : 0.0);   // 騎士上方排成弧：am（左）is（中）are（右），不蓋住怪
        const lx = L ? gx + (i - 1) * sp : sh.x + Math.cos(a) * r * 1.25, ly = sh.y - 6 + Math.sin(a) * r * 0.8;
        const land = L ? h - (2 - i) * 0.05 : h;
        sh.be.words.push({ i, x: clamp(lx, 24, 276), y: clamp(ly, 50, 392), land, a: -PI / 2 + (i - 1) * 0.7 });
      }
      if (L >= 1) for (let k = 0, n = L === 2 ? 9 : 6; k < n; k++) {
        const a = k / n * TAU + I.rng() * 0.4, len = R * (0.55 + I.rng() * 0.3), pts = [[0, 0]];
        for (let j = 1; j <= 4; j++) { const d = len * j / 4, w = (I.rng() - 0.5) * 7; pts.push([Math.cos(a) * d - Math.sin(a) * w, Math.sin(a) * d * 0.8 + Math.cos(a) * w * 0.8]); }
        sh.be.cracks.push(pts);
      }
      sh.aim = { x: sh.x + f.x * R * 0.3, y: sh.y + f.y * R * 0.3 };
      for (const tg of sh.targets) {
        const d = Math.hypot(tg.x - sh.x, (tg.y - sh.y) / 0.8);
        if (d > R + 8) continue;
        sh.be.stun.push({ tg, t: h + clamp(d / R, 0, 1) * 0.3, ph: I.rng() * TAU });
      }
      snd(sh, 0, a => SND.rise(a, raise + fall));
      sh.be.words.forEach(w => {
        if (L) snd(sh, w.land, a => SND.dong(a, w.i));
        at(sh, w.land, s => {
          if (L) { burst(w.x, w.y, 4 + L * 3, 60, "#c8b488", 0.5, 2.6, { k: "dust", add: false, g: -6, up: 12 }); spawn("glow", w.x, w.y - 6, 0, 0, 0.2, 18 + L * 6, BE[w.i].col, 0, 1, true); }
        });
      });
      if (!L) snd(sh, h, a => { SND.dong(a, 0); SND.dong(a, 1); });
      hitAt(sh, h, 0, true, { x: sh.x, y: sh.y, r: R });
      layers(sh, h);
      at(sh, h, s => {
        burst(s.x, s.y - 4, Math.round(s.tr.parts * 0.45), 70 + R, s.col.spHex, 0.55, 1.8, { up: 20 });
        spawn("glow", s.x, s.y - 4, 0, 0, 0.26, R * 0.8, "#ffe9a0", 0, 1, true);
        if (L >= 1) for (let k = 0; k < 10 + L * 6; k++) { const a = I.rng() * TAU, r = R * (0.3 + I.rng() * 0.6); spawn("dust", s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.8, Math.cos(a) * 30, -8, 0.6, 4, "#b8a27a", -6, 0.9, false); }
      });
      for (const st of sh.be.stun) at(sh, st.t, () => { livePos(st.tg); spawn("glow", st.tg.x, bodyY(st.tg), 0, 0, 0.16, 12, "#ffe27a", 0, 1, true); burst(st.tg.x, bodyY(st.tg), 3 + L, 60, "#fff6c8", 0.3, 1.3); });
      if (L === 2) {
        const et = sh.be.echoT;
        hitAt(sh, et, 1, false, { x: sh.x, y: sh.y, r: R * 1.15, echo: true });
        snd(sh, et, a => SND.burst(a));
        at(sh, et, s => { burst(s.x, s.y - 6, 26, 160, "#ffe27a", 0.5, 2, { up: 30 }); spawn("glow", s.x, s.y - 6, 0, 0, 0.3, R, "#fff3c4", 0, 1, true); });
      }
    }

    // ───── 推進
    function finish(sh, quiet) {
      if (sh.done) return;
      // 還沒到的命中回呼照樣送出（引擎若靠它對齊扣血，不會漏）
      for (; sh.ei < sh.ev.length; sh.ei++) { const e = sh.ev[sh.ei]; if (e.hit) try { e.fn(sh); } catch (err) {} }
      sh.done = true; if (I.sh === sh) I.sh = null;
      if (sh.onEnd && !quiet) try { sh.onEnd(sh); } catch (e) {}
    }
    function skipShow(sh) {
      if (sh.done || sh.skipped) return;
      sh.skipped = true; sh.T = Math.min(sh.T, sh.t + 0.15); sh.stops.length = 0;
      for (; sh.ei < sh.ev.length; sh.ei++) { const e = sh.ev[sh.ei]; if (e.hit) try { e.fn(sh); } catch (err) {} }
    }
    function step(dt) {
      dt = clamp(+dt || 0, 0, 0.1);
      stepParticles(dt);
      const sh = I.sh; if (!sh) return false;
      sh.t += dt;
      while (sh.ei < sh.ev.length && sh.ev[sh.ei].t <= sh.t) { const e = sh.ev[sh.ei++]; try { e.fn(sh); } catch (err) {} }
      if (sh.t >= sh.T) finish(sh, false);
      return !!I.sh;
    }
    function update(dt) { I.extT = nowS(); return step(dt); }

    function timeScale() {
      const sh = I.sh; if (!sh) return 1;
      const t = sh.t, tr = sh.tr;
      for (const w of sh.stops) if (t >= w[0] && t < w[1]) return I.hitstopScale;
      if (sh.skipped || tr.slowT <= 0) return 1;
      const a = sh.slow0, b = a + tr.slowT;
      if (t >= a && t < b) return tr.slow;
      if (t >= b && t < b + 0.15) return lerp(tr.slow, 1, (t - b) / 0.15);
      return 1;
    }
    function shakeAmp(sh, t) {
      let A = 0;
      for (const s of sh.shakes) { const u = (t - s.t0) / s.D; if (u >= 0 && u < 1) A = Math.max(A, s.A * (1 - u) * (1 - u)); }
      if (sh.skipped) A *= clamp((sh.T - t) / 0.15, 0, 1);
      return A;
    }
    function camera() {
      const sh = I.sh;
      if (!sh || I.reduced || I.camOff) return { zoom: 1, tx: 0, ty: 0, fx: 150, fy: 200, shakeX: 0, shakeY: 0, active: !!sh };
      const t = sh.t, tr = sh.tr;
      let k = 0;
      if (tr.zoom > 1) {
        const zin = 0.14, hold = sh.zoomHold, out = 0.26;
        k = t < zin ? easeOut(t / zin) : t < hold ? 1 : t < hold + out ? 1 - easeInOut((t - hold) / out) : 0;
        if (sh.skipped) k *= clamp((sh.T - t) / 0.15, 0, 1);
      }
      const A = shakeAmp(sh, t);
      let sx = 0, sy = 0;
      if (A > 0) { sx = A * (Math.sin(t * 91.7) * 0.6 + Math.sin(t * 57.3 + 1.7) * 0.4); sy = A * (Math.sin(t * 79.1 + 0.6) * 0.6 + Math.sin(t * 43.9 + 2.9) * 0.4); }
      let z = 1 + (tr.zoom - 1) * k;
      if (A > 0) z = Math.max(z, 1 + (2 * A + 1) / FW * 1.1);   // 震動時補一點放大，邊緣不露底
      const fx = sh.fx, fy = sh.fy;
      let tx = fx * (1 - z), ty = fy * (1 - z);
      tx = clamp(tx + sx, FW * (1 - z), 0); ty = clamp(ty + sy, FH * (1 - z), 0);
      return { zoom: z, tx, ty, fx, fy, shakeX: sx, shakeY: sy, active: true };
    }
    // 合約格式（TGUI.camMerge 用）：螢幕＝z×p＋(1−z)×中心＋d → d＝t−(1−z)×中心
    function cameraTransform() {
      const sh = I.sh; if (!sh || I.reduced || I.camOff) return null;
      const c = camera(); if (c.zoom === 1 && !c.tx && !c.ty) return null;
      return { z: c.zoom, x: c.fx, y: c.fy, dx: c.tx - (1 - c.zoom) * c.fx, dy: c.ty - (1 - c.zoom) * c.fy };
    }
    function cameraMatrix(s, ox, oy) { const c = camera(); s = s || 1; return [s * c.zoom, 0, 0, s * c.zoom, (ox || 0) + s * c.tx, (oy || 0) + s * c.ty]; }
    function applyCamera(ctx, s, ox, oy) { const m = cameraMatrix(s, ox, oy); ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); }

    // ═════ 繪圖小工具
    function txt(ctx, s, x, y, size, fill, o) {
      o = o || {};
      ctx.font = (o.w || "900") + " " + size + "px " + (o.zh ? FONT_ZH : FONT_EN);
      ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      if (o.glow && !I.lite) { ctx.strokeStyle = o.glow; ctx.lineWidth = size * 0.6; ctx.strokeText(s, x, y); }
      ctx.strokeStyle = o.ink || INK; ctx.lineWidth = Math.max(2, size * 0.24); ctx.strokeText(s, x, y);
      ctx.fillStyle = fill; ctx.fillText(s, x, y);
    }
    function shieldPath(ctx, x, y, w, h) {   // 鳶形盾：底尖在 (x,y)
      ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w / 2, y - h * 0.48);
      ctx.quadraticCurveTo(x + w / 2, y - h * 0.12, x, y); ctx.quadraticCurveTo(x - w / 2, y - h * 0.12, x - w / 2, y - h * 0.48); ctx.closePath();
    }
    function crescent(ctx, X, Y, r, ori, sp, thick, u) {   // 斬擊弧：ori＝弧鼓起方向；u＝揮出進度
      const cx = X - Math.cos(ori) * r, cy = Y - Math.sin(ori) * r, a0 = ori - sp, a1 = ori - sp + 2 * sp * u;
      const ox = Math.cos(ori) * thick, oy = Math.sin(ori) * thick;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, false); ctx.arc(cx - ox, cy - oy, r, a1, a0, true); ctx.closePath();
    }
    function star4(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4 - PI / 2, rr = i & 1 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    const toScreen = (c, x, y) => [x * c.zoom + c.tx, y * c.zoom + c.ty];
    I.vis = { x0: 0, x1: FW, y0: 0, y1: FH };   // 目前鏡頭看得到的世界範圍（拉近時文字不要跑出畫面）
    const vx = (x, m) => clamp(x, I.vis.x0 + m, I.vis.x1 - m), vy = (y, m) => clamp(y, I.vis.y0 + m, I.vis.y1 - m);

    // ═════ 世界層（套鏡頭）
    function drawParticles(ctx) {
      if (!I.nP) return;
      // 先畫一般合成（塵土、碎片、字母），再用 lighter 畫發光（火花、光點、光暈）
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass ? "lighter" : "source-over";
        for (let i = 0; i < MAX_P; i++) {
          const p = I.P[i]; if (!p.on || p.add !== !!pass) continue;
          const u = p.t / p.T, a = 1 - u;
          if (p.k === "spark") {
            const L = Math.min(9, Math.hypot(p.vx, p.vy) * 0.045) + p.s;
            const m = Math.hypot(p.vx, p.vy) || 1;
            ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.s * (0.6 + a * 0.6);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / m * L, p.y - p.vy / m * L); ctx.stroke();
          } else if (p.k === "glow") {
            const r = p.s * (0.6 + 0.4 * easeOut(u)) * (I.lite ? 0.6 : 1), spr = radialSprite("g" + p.c, hexRgb(p.c), [[0, 0.55], [0.45, 0.22], [1, 0]]);
            if (spr) { ctx.globalAlpha = a; ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2); }
            else { ctx.globalAlpha = 0.3 * a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, TAU); ctx.fill(); }
          } else if (p.k === "dust") {
            ctx.globalAlpha = 0.5 * a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.6 + u), 0, TAU); ctx.fill();
          } else if (p.k === "chip") {
            ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = p.c;
            const c = Math.cos(p.rot) * p.s, s = Math.sin(p.rot) * p.s;
            ctx.beginPath(); ctx.moveTo(p.x + c, p.y + s); ctx.lineTo(p.x - s * 0.7, p.y + c * 0.7); ctx.lineTo(p.x - c * 0.8, p.y - s * 0.8); ctx.closePath(); ctx.fill();
          } else if (p.k === "letter") {
            ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.4); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.3);
            txt(ctx, p.ch, 0, 0, p.s, p.c); ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    function drawAura(ctx, sh) {   // 騎士身上的光（放招時）
      const t = sh.t, a = env(t, 0, sh.T, 0.06, 0.3) * (0.35 + 0.1 * sh.lv);
      if (a <= 0) return;
      const r = 16 + sh.lv * 6 + Math.sin(t * 30) * 1.2;
      const spr = radialSprite("aura" + sh.col.spark, sh.col.spark, [[0, 0.45], [0.06, 0.45], [1, 0]]);
      if (!spr) return;
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a; ctx.drawImage(spr, sh.x - r, sh.y - 10 - r, r * 2, r * 2);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    function drawTitleTag(ctx, sh) {   // 普通級：招式名小字（騎士頭上）
      const a = env(sh.t, 0.02, sh.T, 0.06, 0.15); if (a <= 0) return;
      const y = sh.y + 14 + easeOut(sh.t / 0.2) * 2;   // 腳下（頭上留給英文字）
      ctx.globalAlpha = a; txt(ctx, sh.info.name, vx(sh.x, 26), vy(y, 8), 9, GOLDL, { zh: true }); ctx.globalAlpha = 1;
    }

    function drawWall(ctx, sh) {
      const w = sh.wall, t = sh.t, f = sh.f, L = sh.lv;
      const pushK = t < w.hit ? 0 : easeOut((t - w.hit) / 0.12);
      const px = f.x * w.push * pushK, py = f.y * w.push * pushK;
      const gone = w.burstT && t >= w.burstT;
      const fade = env(t, 0, sh.T, 0.01, 0.22);
      // 地面光帶（牆腳）
      if (!gone && t > 0.02) {
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = sh.col.arcHex; ctx.lineWidth = 3 + L;
        ctx.beginPath(); w.shields.forEach((q, i) => i ? ctx.lineTo(q.x + px, q.y + py + 1) : ctx.moveTo(q.x + px, q.y + py + 1)); ctx.stroke();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      }
      // 衝擊帶（往前推出）
      for (let b = 0; b < (L >= 1 ? 2 : 1); b++) {
        const u = (t - w.hit - b * 0.06) / 0.28; if (u < 0 || u > 1) continue;
        const d = w.push + w.reach * easeOut(u), a = (1 - u);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(" + sh.col.arc + "," + (0.75 * a).toFixed(3) + ")"; ctx.lineWidth = (7 + L * 2) * a + 1;
        ctx.beginPath(); w.shields.forEach((q, i) => { const x = q.x + f.x * d, y = q.y + f.y * d - 6; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (0.9 * a).toFixed(3) + ")"; ctx.lineWidth = 1.4;
        ctx.stroke(); ctx.globalCompositeOperation = "source-over";
      }
      if (gone) return;
      // 盾：依 y 排序（前後遮擋）
      const order = w.shields.slice().sort((a, b) => a.y - b.y);
      const charge = w.burstT ? env(t, w.burstT - 0.28, w.burstT, 0.2, 0) : 0;
      for (const q of order) {
        const ru = (t - q.rt) / 0.11; if (ru <= 0) continue;
        const k = easeOutBack(ru), x = q.x + px, y = q.y + py, sw = 10 + L * 0.6, shh = 15 + L * 1.2;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.scale(1, clamp(k, 0, 1.2)); ctx.translate(-x, -y);
        shieldPath(ctx, x, y, sw, shh);
        ctx.fillStyle = "rgba(34,62,112,.9)"; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = GOLD; ctx.stroke();
        shieldPath(ctx, x, y - 2, sw - 4, shh - 4.5); ctx.fillStyle = "rgba(" + sh.col.arc + ",.32)"; ctx.fill();
        const fl = Math.max(t >= w.hit ? 1 - (t - w.hit) / 0.18 : 0, charge * (0.5 + 0.5 * Math.sin(t * 40)));
        if (fl > 0) { shieldPath(ctx, x, y, sw, shh); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,255,255," + (0.7 * fl).toFixed(3) + ")"; ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
        if (q.ch) txt(ctx, q.ch, x, y - shh * 0.55, 8.5 + L * 0.5, GOLDL);
        else { star4(ctx, x, y - shh * 0.55, 3.2); ctx.fillStyle = GOLDL; ctx.fill(); }
        ctx.restore();
      }
      // 字：普通＝「STOP!」小字；華麗＝大字從劍飛到牆上
      if (L === 0) {
        const a = env(t, w.hit, sh.T, 0.04, 0.15); if (a > 0) { const pop = 1 + 0.5 * Math.max(0, 1 - (t - w.hit) / 0.1); ctx.globalAlpha = a; txt(ctx, "STOP!", vx(w.cx + f.x * 14, 22), vy(w.cy - 26 - (t - w.hit) * 8, 10), Math.round(sh.tr.word * pop), "#ffe27a"); ctx.globalAlpha = 1; }
      } else if (L === 1 || !w.flat) {
        const end = L === 2 ? Math.min(w.burstT, 0.92) : sh.T, u = clamp((t - 0.06) / 0.18, 0, 1), a = env(t, 0.06, end, 0.05, 0.2);
        if (a > 0) {
          const x = lerp(sh.sword.x, w.cx + f.x * 10, easeOut(u)), y = lerp(sh.sword.y, w.cy - 34, easeOut(u));
          const pop = t > w.hit ? 1 + 0.35 * Math.max(0, 1 - (t - w.hit) / 0.12) : 0.6 + 0.4 * u;
          const word = L === 2 ? "STAY BACK!" : "STOP!", size = Math.round(sh.tr.word * (L === 2 ? 0.85 : 1) * pop);
          ctx.globalAlpha = a; txt(ctx, word, vx(x, L === 2 ? 64 : 30), vy(y, 12), size, "#ffe27a", { glow: "rgba(255,200,90,.35)" }); ctx.globalAlpha = 1;
        }
      }
    }

    function drawTense(ctx, sh) {
      const t = sh.t, L = sh.lv;
      // 劍路殘影：騎士 → 第一刀 → 第二刀 → 第三刀
      const path = [[sh.sword.x, sh.sword.y]].concat(sh.slashes.map(s => [s.sx, s.sy]));
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const s = sh.slashes[i], u = (t - (s.t - 0.05)) / 0.3; if (u < 0 || u > 1) continue;
        const a = 1 - u, [x0, y0] = path[i], [x1, y1] = path[i + 1];
        ctx.strokeStyle = rgba(TENSE[i].col, 0.55 * a); ctx.lineWidth = 1 + L * 0.8 + a * 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      // 三刀
      for (let i = 0; i < 3; i++) {
        const s = sh.slashes[i], T = TENSE[i], dt = t - s.t; if (dt < -0.04) continue;
        const life = 0.32 + L * 0.12, u = clamp((dt + 0.04) / 0.08, 0, 1), fa = dt < 0.06 ? 1 : 1 - clamp((dt - 0.06) / life, 0, 1);
        if (fa <= 0) continue;
        const thick = (4 + L * 2) * (0.35 + 0.65 * fa), r = s.r * (1 + 0.12 * (1 - fa));
        crescent(ctx, s.sx, s.sy, r, s.ori, 1.05 + L * 0.1, thick, u);
        ctx.fillStyle = rgba(T.col, 0.85 * fa); ctx.fill();
        crescent(ctx, s.sx, s.sy, r, s.ori, 0.95 + L * 0.1, thick * 0.35, u);
        ctx.fillStyle = rgba(T.core, fa); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // 傳說級最後：十字斬（三色疊）
      if (sh.finT) {
        const dt = t - sh.finT;
        if (dt > -0.03 && dt < 0.4) {
          const u = clamp((dt + 0.03) / 0.07, 0, 1), fa = dt < 0.05 ? 1 : 1 - (dt - 0.05) / 0.35, len = 46;
          ctx.globalCompositeOperation = "lighter";
          for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) {
            const a = PI / 4 * sg + (i - 1) * 0.06, dx = Math.cos(a) * len, dy = Math.sin(a) * len;
            ctx.strokeStyle = rgba(TENSE[i].col, 0.8 * fa); ctx.lineWidth = (6 - i * 1.6) * fa + 1;
            ctx.beginPath(); ctx.moveTo(sh.aim.x - dx, sh.aim.y - dy); ctx.lineTo(sh.aim.x - dx + 2 * dx * u, sh.aim.y - dy + 2 * dy * u); ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      // 字樣：在目標群上方排成一列，由左到右 過去／現在／未來（目標擠在一起時字也不會疊）
      const colW = [30, 52, 58][L], top = Math.min(sh.slashes[0].sy, sh.slashes[1].sy, sh.slashes[2].sy);
      const rowX = vx(sh.aim.x, colW + [16, 26, 36][L]);
      for (let i = 0; i < 3; i++) {
        const s = sh.slashes[i], T = TENSE[i], dt = t - s.t; if (dt < 0) continue;
        const end = L === 2 ? 0.92 : sh.T, a = env(t, s.t, end, 0.03, 0.18); if (a <= 0) continue;
        const word = T.w[L], pop = 1 + (L ? 0.6 : 0.4) * Math.max(0, 1 - dt / 0.12);
        const rise = easeOut(dt / 0.35) * (6 + L * 3), fly = 1 - easeOut(dt / 0.14);   // 從刀口飛到列上的位置
        const x = lerp(rowX + (i - 1) * colW, s.sx, fly), y = vy(lerp(top - 20 - L * 4 - rise, s.sy, fly), 12);
        ctx.globalAlpha = a; txt(ctx, word, x, y, Math.round(sh.tr.word * (L === 2 ? 0.75 : 1) * pop), T.col, L ? { glow: rgba(T.col, 0.3) } : null); ctx.globalAlpha = 1;
      }
    }

    function drawBe(ctx, sh) {
      const b = sh.be, t = sh.t, L = sh.lv, R = b.R;
      // 引光：劍尖往上的光柱
      const pa = env(t, 0, b.h + 0.12, 0.04, 0.12);
      if (pa > 0) {
        const top = sh.sword.y - (60 + L * 50), w = 4 + L * 3 + Math.sin(t * 50) * 0.8;
        const g = ctx.createLinearGradient(0, top, 0, sh.sword.y);
        g.addColorStop(0, "rgba(255,226,150,0)"); g.addColorStop(0.6, "rgba(255,226,150," + (0.5 * pa).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,250,230," + (0.9 * pa).toFixed(3) + ")");
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(sh.sword.x - w / 2, top, w, sh.sword.y - top);
        ctx.globalCompositeOperation = "source-over";
      }
      // 地面光圈與地裂
      const ga = env(t, b.h, sh.T, 0.03, 0.3);
      if (ga > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,215,94," + (0.1 * ga * (1 + L * 0.2)).toFixed(3) + ")";
        ctx.beginPath(); ctx.ellipse(sh.x, sh.y, R * easeOut((t - b.h) / 0.3), R * 0.8 * easeOut((t - b.h) / 0.3), 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        if (b.cracks.length) {
          const grow = easeOut((t - b.h) / 0.16);
          for (const pts of b.cracks) {
            const n = Math.max(1, Math.ceil((pts.length - 1) * grow));
            ctx.beginPath(); ctx.moveTo(sh.x, sh.y); for (let j = 1; j <= n; j++) ctx.lineTo(sh.x + pts[j][0], sh.y + pts[j][1]);
            ctx.strokeStyle = "rgba(12,10,20," + (0.7 * ga).toFixed(3) + ")"; ctx.lineWidth = 2.6; ctx.stroke();
            ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,180,80," + (0.8 * ga).toFixed(3) + ")"; ctx.lineWidth = 1.1; ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      // 衝擊波環
      const rings = [[b.h, R, 0.34], [b.h + 0.07, R * 0.8, 0.34], [b.h + 0.14, R * 0.6, 0.3]].slice(0, L + 1);
      if (b.echoT) rings.push([b.echoT, R * 1.15, 0.4]);
      ctx.globalCompositeOperation = "lighter";
      for (const [t0, rr, D] of rings) {
        const u = (t - t0) / D; if (u < 0 || u > 1) continue;
        const r = rr * easeOut(u), a = 1 - u;
        ctx.strokeStyle = "rgba(255,226,140," + (0.85 * a).toFixed(3) + ")"; ctx.lineWidth = (5 + L * 1.5) * a + 1;
        ctx.beginPath(); ctx.ellipse(sh.x, sh.y - 2, r, r * 0.8, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (0.8 * a).toFixed(3) + ")"; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // 暈眩星星（跟著怪移動）
      for (const st of b.stun) {
        const a = env(t, st.t, sh.T, 0.05, 0.2); if (a <= 0) continue;
        const tg = livePos(st.tg); if (tg.ref && tg.ref.hp <= 0) continue;
        const hx = tg.x, hy = tg.y - (tg.fly ? 26 : 19);
        ctx.globalAlpha = a;
        for (let k = 0; k < 3; k++) {
          const ph = st.ph + t * 7 + k * TAU / 3, sx = hx + Math.cos(ph) * 6.5, sy = hy + Math.sin(ph) * 2.4;
          star4(ctx, sx, sy, 2.6 + (Math.sin(ph) > 0 ? 0.6 : 0)); ctx.fillStyle = "#ffe27a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // am／is／are：普通＝從劍冒出小字；華麗／傳說＝從天砸下
      //   第二輪 P2：鏡頭拉近後可視範圍變小，騎士靠邊時整組再往畫面內推（三個字一起移，間距不變、不被切掉）
      let shift = 0;
      if (L && b.words.length === 3) { const sp2 = Math.abs(b.words[2].x - b.words[0].x) / 2, gc = (b.words[0].x + b.words[2].x) / 2, m = 26; shift = clamp(gc, I.vis.x0 + sp2 + m, Math.max(I.vis.x0 + sp2 + m, I.vis.x1 - sp2 - m)) - gc; }
      for (const w of b.words) {
        const B = BE[w.i], size = sh.tr.word * (L === 2 ? 1.1 : 1);
        let x, y, a, sc = 1;
        if (L === 0) {
          const dt = t - b.h; if (dt < 0) continue;
          a = env(t, b.h, sh.T, 0.03, 0.18);
          const u = easeOut(dt / 0.25); x = sh.x + Math.cos(w.a * 1.25) * 30 * u; y = sh.sword.y - 4 + Math.sin(w.a * 1.25) * 18 * u;
          sc = 1 + 0.4 * Math.max(0, 1 - dt / 0.1);
        } else {
          const t0 = w.land - [0, 0.13, 0.17][L]; if (t < t0) continue;
          const end = L === 2 ? 1.0 : sh.T; a = env(t, t0, end, 0.02, 0.18);
          if (t < w.land) {
            const u = easeIn((t - t0) / (w.land - t0)); x = w.x + shift; y = lerp(w.y - 130, w.y - 8, u);
            // 落下殘影
            ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = rgba(B.col, 0.5 * a); ctx.lineWidth = size * 0.5;
            ctx.beginPath(); ctx.moveTo(x, y - size * 0.6); ctx.lineTo(x, y - size * 0.6 - 30 * u - 8); ctx.stroke(); ctx.globalCompositeOperation = "source-over";
          } else { const dt = t - w.land; x = w.x + shift; y = w.y - 8 - Math.abs(Math.sin(dt * 14)) * 4 * Math.max(0, 1 - dt / 0.3); sc = 1 + 0.35 * Math.max(0, 1 - dt / 0.12); }
        }
        if (a <= 0) continue;
        ctx.globalAlpha = a; txt(ctx, B.w, vx(x, 16), vy(y, 12), Math.round(size * sc), B.col, L ? { glow: rgba(B.col, 0.3) } : null); ctx.globalAlpha = 1;
      }
    }

    function drawWorld(ctx) {
      const sh = I.sh, c = I.dc || camera();
      I.vis.x0 = -c.tx / c.zoom; I.vis.x1 = (FW - c.tx) / c.zoom; I.vis.y0 = -c.ty / c.zoom; I.vis.y1 = (FH - c.ty) / c.zoom;
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (sh) {
        drawAura(ctx, sh);
        if (sh.ult === "wall") drawWall(ctx, sh); else if (sh.ult === "tense") drawTense(ctx, sh); else drawBe(ctx, sh);
      }
      drawParticles(ctx);
      if (sh && sh.lv === 0) drawTitleTag(ctx, sh);
      ctx.restore();
    }

    // ═════ 螢幕層（不套鏡頭；邏輯座標 300×400）
    function drawScreenUnder(ctx) {   // 背景壓暗（中央留光，騎士與附近的怪看得清楚）
      const sh = I.sh; if (!sh || !sh.tr.darken || I.lite) return;
      const a = sh.tr.darken * env(sh.t, 0, sh.T - 0.12, 0.1, 0.32); if (a <= 0) return;
      const c = I.dc || camera(), [kx, ky] = toScreen(c, sh.fx, sh.fy);
      // 聚光：焦點半徑 95 內漸層（中心不壓暗），外面整片同一個暗度（純色填滿比整片縮放貼圖便宜很多）
      const spr = radialSprite("dark2", "5,3,18", [[0, 0], [0.3, 0.06], [0.7, 0.6], [1, 1]]);
      ctx.globalAlpha = a;
      if (spr) radialFill(ctx, spr, kx, ky, 95, "rgb(5,3,18)"); else { ctx.fillStyle = "rgb(5,3,18)"; ctx.globalAlpha = a * 0.6; ctx.fillRect(0, 0, FW, FH); }
      ctx.globalAlpha = 1;
    }
    function drawSpeedLines(ctx, sh, c) {
      const a = env(sh.t, 0.06, 0.7, 0.06, 0.2) * 0.3; if (a <= 0) return;
      const [kx, ky] = toScreen(c, sh.fx, sh.fy), rot = sh.t * 0.6;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,240,200," + a.toFixed(3) + ")";
      for (let i = 0; i < 32; i++) {
        const an = i / 32 * TAU + rot + (i % 3) * 0.05, r0 = 95 + (i * 37 % 40), r1 = 330;
        ctx.lineWidth = 0.8 + (i % 4) * 0.5;
        ctx.beginPath(); ctx.moveTo(kx + Math.cos(an) * r0, ky + Math.sin(an) * r0); ctx.lineTo(kx + Math.cos(an) * r1, ky + Math.sin(an) * r1); ctx.stroke();
      }
      ctx.restore();
    }
    function portrait(s) {   // 切入圖的騎士半身像（離屏快取）
      if (!HAS_DOC) return null;
      const st = I.sh && I.sh.opts.stage, key = "p|" + (st == null ? "d" : st) + "|" + Math.round(s * 10);
      if (I.cache[key] !== undefined) return I.cache[key];
      let cv = null;
      try {
        const k = 3.4, bw = 44, bh = 46; cv = document.createElement("canvas"); cv.width = Math.ceil(bw * k * s); cv.height = Math.ceil(bh * k * s);
        const g = cv.getContext("2d"); g.setTransform(k * s, 0, 0, k * s, 0, 0); g.lineJoin = "round"; g.lineCap = "round";
        const A = W.ART;
        if (A && typeof A.drawKnight === "function" && st != null) A.drawKnight(g, bw / 2, 36, { stage: st, t: 0, anim: "attack", attack: 0.55, dir: -1, noFx: true });
        else if (A && typeof A.hero === "function") A.hero(g, "knight", bw / 2, 36, 0, { dir: -1, attack: 0.55, noFx: true });
        else {   // 退路：簡單頭盔剪影
          g.fillStyle = "#aab8c8"; g.beginPath(); g.arc(bw / 2, 20, 9, 0, TAU); g.fill(); g.fillStyle = INK; g.fillRect(bw / 2 - 8, 19, 12, 2.4);
          g.fillStyle = "#d0506a"; g.beginPath(); g.ellipse(bw / 2 + 2, 9, 6, 3, -0.4, 0, TAU); g.fill();
          g.fillStyle = "#2c4f86"; g.fillRect(bw / 2 - 10, 29, 20, 14);
        }
      } catch (e) { cv = null; }
      I.cache[key] = cv; return cv;
    }
    function drawCutin(ctx, sh, s) {
      const t = sh.t, a0 = 0.04, a1 = 0.28, b0 = 0.6, b1 = 0.76;
      if (t < a0 || t > b1) return;
      let dx = 0, al = 1;
      if (I.reduced) al = env(t, a0, b1, 0.1, 0.12);
      else if (t < a1) dx = (1 - easeOutBack((t - a0) / (a1 - a0))) * 330; else if (t > b0) dx = -easeIn((t - b0) / (b1 - b0)) * 330;
      const cy = sh.bandY, h = 66;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(dx, 0);
      ctx.beginPath(); ctx.moveTo(-20, cy - h / 2 + 9); ctx.lineTo(320, cy - h / 2 - 9); ctx.lineTo(320, cy + h / 2 - 9); ctx.lineTo(-20, cy + h / 2 + 9); ctx.closePath();
      ctx.fillStyle = "rgba(12,17,40,.9)"; ctx.fill();
      ctx.save(); ctx.clip();
      // 帶內的流光（往左跑）
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0, n = I.lite ? 0 : 14; i < n; i++) {
        const y = cy - h / 2 + 4 + (i * 53 % (h - 8)), len = 30 + (i * 29 % 50), x = ((i * 97 - t * 900) % 420 + 420) % 420 - 60;
        ctx.strokeStyle = "rgba(" + sh.col.spark + "," + (0.12 + (i % 3) * 0.06).toFixed(2) + ")"; ctx.lineWidth = 1 + (i % 2);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - len * 0.05); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
      // 騎士半身像：上半身衝出帶子上緣（切入圖常見構圖），腳被帶子下緣切掉
      const pc = portrait(s);
      if (pc) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(-20, cy - h / 2 + 9); ctx.lineTo(320, cy - h / 2 - 9); ctx.lineTo(320, cy + h / 2 - 9); ctx.lineTo(-20, cy + h / 2 + 9); ctx.closePath();
        ctx.rect(168, cy - h / 2 - 58, 160, 60); ctx.clip();
        ctx.drawImage(pc, 173, cy + 28 - 41 * 3.4, 44 * 3.4, 46 * 3.4); ctx.restore();
      }
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-20, cy - h / 2 + 9); ctx.lineTo(320, cy - h / 2 - 9); ctx.moveTo(-20, cy + h / 2 + 9); ctx.lineTo(320, cy + h / 2 - 9); ctx.stroke();
      txt(ctx, TIERS[3].stars + " " + TIERS[3].name, 16, cy - 18, 9, "#ffe27a", { zh: true, align: "left" });
      let fs = 22; ctx.font = "900 " + fs + "px " + FONT_ZH; while (fs > 14 && ctx.measureText(sh.info.name).width > 180) { fs--; ctx.font = "900 " + fs + "px " + FONT_ZH; }
      txt(ctx, sh.info.name, 16, cy + 3, fs, GOLDL, { zh: true, align: "left", glow: "rgba(255,200,90,.3)" });
      txt(ctx, sh.info.en, 17, cy + 22, 8.5, "#cfe0ea", { align: "left", w: "800" });
      ctx.restore();
    }
    function drawTitle1(ctx, sh) {   // 普通級（第二輪 P1-15）：畫面中間大字「盾牆！」彈出、停一下、淡出
      const t = sh.t, a = env(t, 0.04, Math.min(sh.T, 0.8), 0.06, 0.22); if (a <= 0) return;
      const u = clamp((t - 0.04) / 0.18, 0, 1), sc = 0.6 + 0.4 * easeOutBack(u), y = sh.y > 220 ? 150 : 250;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(150, y); ctx.scale(sc, sc);
      txt(ctx, sh.info.name + "！", 0, 0, 34, GOLDL, { zh: true, glow: "rgba(255,214,120,.45)" });
      ctx.restore();
    }
    function drawTitle2(ctx, sh) {   // 華麗級：招式名大字飛入（上方）
      const t = sh.t, a = env(t, 0.03, sh.T, 0.08, 0.2); if (a <= 0) return;
      const u = easeOutBack(clamp((t - 0.03) / 0.22, 0, 1)), x = lerp(-60, 150, u), y = sh.y > 200 ? 62 : 330;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(12,17,40,.72)"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 92, y - 17, 184, 34, 9); else ctx.rect(x - 92, y - 17, 184, 34); ctx.fill();
      ctx.strokeStyle = "rgba(225,184,106,.8)"; ctx.lineWidth = 1.2; ctx.stroke();
      txt(ctx, TIERS[2].stars, x - 70, y - 1, 8, "#ffe27a");
      txt(ctx, sh.info.name, x + 4, y - 4, sh.tr.word + 2, GOLDL, { zh: true });
      txt(ctx, sh.info.en, x + 4, y + 11, 7, "#cfe0ea", { w: "800" });
      ctx.restore();
    }
    function drawSubtitle(ctx, sh) {   // 傳說級收尾：一句完整的文法句子
      const t = sh.t, a = env(t, 0.86, sh.T, 0.12, 0.14); if (a <= 0) return;
      let parts;
      if (sh.ult === "tense") parts = TENSE.map(T => [T.w[2], T.col]);
      else if (sh.ult === "be") parts = BE.map(B => [B.subj + " " + B.w, B.col]);
      else parts = WALL_SUB;
      const y = sh.bandY, size = 15, sep = "  ·  ";
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = "900 " + size + "px " + FONT_EN;
      const ws = parts.map(p => ctx.measureText(p[0]).width), sw = ctx.measureText(sep).width;
      const total = ws.reduce((x, y) => x + y, 0) + sw * (parts.length - 1);
      const k = Math.min(1, 270 / total), sc = (1.15 - 0.15 * easeOut((t - 0.86) / 0.15)) * k;
      ctx.translate(150, y); ctx.scale(sc, sc);
      ctx.fillStyle = "rgba(12,17,40,.82)"; const bw = total + 28, bh = 44;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 10); else ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.stroke();
      let x = -total / 2;
      parts.forEach((p, i) => {
        txt(ctx, p[0], x + ws[i] / 2, -5, size, p[1]); x += ws[i];
        if (i < parts.length - 1) { txt(ctx, "·", x + sw / 2, -5, size, "#cfe0ea"); x += sw; }
      });
      txt(ctx, sh.info.note, 0, 13, 8.5, "#cfe0ea", { zh: true, w: "700" });
      ctx.restore();
    }
    function drawFlash(ctx, sh, c) {
      if (I.reduced || sh.flash0 < 0) return;
      const tr = sh.tr, u = (sh.t - sh.flash0) / tr.flashT; if (u < 0 || u > 1) return;
      const a = tr.flashA * (1 - u * u);
      const spr = tr.radialFlash ? radialSprite("flash" + tr.flashRGB, tr.flashRGB, [[0, 1], [0.5, 0.6], [1, 0.3]]) : null;
      if (spr) {   // 中心 a、半徑 150 外 0.3a
        const [kx, ky] = toScreen(c, sh.fx, sh.fy);
        ctx.globalAlpha = a; radialFill(ctx, spr, kx, ky, 150, "rgba(" + tr.flashRGB + ",0.3)"); ctx.globalAlpha = 1;
      } else { ctx.fillStyle = "rgba(" + tr.flashRGB + "," + (tr.radialFlash ? a * 0.6 : a).toFixed(3) + ")"; ctx.fillRect(0, 0, FW, FH); }
    }
    function drawScreenOver(ctx, s) {
      const sh = I.sh; if (!sh) return;
      const c = I.dc || camera();
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (sh.tr.speedLines && !I.reduced && !I.lite) drawSpeedLines(ctx, sh, c);
      if (sh.lv === 0) drawTitle1(ctx, sh);
      if (sh.lv === 1) drawTitle2(ctx, sh);
      if (sh.tr.cutin) drawCutin(ctx, sh, s || 1);
      if (sh.lv === 2) drawSubtitle(ctx, sh);
      drawFlash(ctx, sh, c);
      ctx.restore();
    }

    // index 套的鏡頭（TGUI.view().cam＝合併後的 {z,x,y,dx,dy}）換成 {zoom,tx,ty}
    function hostCam() {
      let v = null; try { v = W.TGUI && W.TGUI.view ? W.TGUI.view() : null; } catch (e) {}
      const c = v && v.cam, z = c && c.z > 0 ? c.z : 1;
      const cx = c && c.x !== undefined ? c.x : 150, cy = c && c.y !== undefined ? c.y : 200;
      return { s: v && v.s || 0, cam: { zoom: z, tx: c ? (1 - z) * cx + (c.dx || 0) : 0, ty: c ? (1 - z) * cy + (c.dy || 0) : 0 } };
    }
    function draw(ctx, a, b) {
      if (!ctx || (!I.sh && !I.nP)) return;
      const t0 = nowS();
      const standalone = typeof a === "number" || !!(a && typeof a === "object" && !a.enemies && (a.s || a.scale));
      ctx.save();
      try {
        if (standalone) {   // 預覽頁：自己套鏡頭
          const s = typeof a === "number" ? a : (a.s || a.scale || 1), ox = a.ox || 0, oy = a.oy || 0;
          I.dc = camera();
          ctx.setTransform(s, 0, 0, s, ox, oy); drawScreenUnder(ctx);
          applyCamera(ctx, s, ox, oy); drawWorld(ctx);
          ctx.setTransform(s, 0, 0, s, ox, oy); drawScreenOver(ctx, s);
        } else {            // 遊戲：drawTop 掛勾，ctx 已套好 index 的鏡頭
          const h = hostCam(), m = ctx.getTransform ? ctx.getTransform() : null;
          const s = h.s || (m ? m.a / (h.cam.zoom || 1) : 1); I.dc = h.cam;
          ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); drawScreenUnder(ctx); ctx.restore();
          drawWorld(ctx);
          ctx.setTransform(s, 0, 0, s, 0, 0); drawScreenOver(ctx, s);
        }
      } catch (e) { if (!I.errLogged) { I.errLogged = true; try { console.error("[KnightFX]", e); } catch (er) {} } }
      I.dc = null;
      ctx.restore();
      const ms = (nowS() - t0) * 1000, st = I.stats;
      st.frames++; st.drawMs = ms; st.drawAvg += (ms - st.drawAvg) / Math.min(st.frames, 60); if (ms > st.drawMax) st.drawMax = ms;
      // 自動省電：連續 4 幀超過 8ms（手機每幀繪圖預算）就切省電模式，之後的演出都用省電版（不切回，避免忽快忽慢）
      if (I.quality === "auto" && !I.lite && I.sh) { I.slowN = ms > 8 ? I.slowN + 1 : 0; if (I.slowN >= 4) { I.lite = st.lite = true; } }
    }

    // 暖機：開局時呼叫一次，先建好切入圖快取與各字型（第一次用字型／建快取約 5～70 毫秒，放在演出當下會掉幀）
    function preload(s, stage) {
      if (!HAS_DOC) return;
      try {
        const keep = I.sh; I.sh = { opts: { stage: stage == null ? null : stage } }; portrait(s || 2); I.sh = keep;
        const c = document.createElement("canvas"); c.width = c.height = 8; const g = c.getContext("2d");
        for (const f of [FONT_EN, FONT_ZH]) for (const w of ["700", "800", "900"]) { g.font = w + " 12px " + f; g.fillText("Ab盾", 0, 6); g.strokeText("Ab盾", 0, 6); }
      } catch (e) {}
    }

    const api = {
      preload, play, playRaw, update, step, draw, drawWorld, drawScreenUnder, drawScreenOver, timeScale, cameraTransform, camera, cameraMatrix, applyCamera,
      active: () => !!I.sh, busy: () => !!I.sh, current: () => I.sh, skip: () => { if (I.sh) skipShow(I.sh); },
      reset: () => { I.sh = null; for (const p of I.P) p.on = false; I.nP = 0; },
      particles: () => I.nP, tierFor, create, ULTS, TIERS, MAX_P, stats: I.stats, _I: I
    };
    Object.defineProperty(api, "reduced", { get: () => I.reduced, set: v => { I.reduced = !!v; }, enumerable: true });
    Object.defineProperty(api, "muted", { get: () => I.muted, set: v => { I.muted = !!v; }, enumerable: true });
    Object.defineProperty(api, "quality", { get: () => I.quality, set: v => { I.quality = v === "low" || v === "high" ? v : "auto"; I.lite = I.quality === "low"; I.slowN = 0; I.stats.lite = I.lite; }, enumerable: true });
    Object.defineProperty(api, "lite", { get: () => I.lite, enumerable: true });
    Object.defineProperty(api, "hitstopScale", { get: () => I.hitstopScale, set: v => { I.hitstopScale = clamp(+v || 0, 0, 1); }, enumerable: true });
    Object.defineProperty(api, "lastExternalUpdate", { get: () => I.extT });
    return api;
  }

  // 等級建議（最後規則由騎士引擎決定）：設計文件＝詠唱答對升 2 級，詠唱答對＋狂熱中或有對應徽章升 3 級；
  // 只給連對數時：連對 8＝傳說、5＝華麗、其他＝普通（跟 juice 的 3／5／8 段對齊）。
  function tierFor(o) {
    if (typeof o === "number") o = { combo: o };
    o = o || {};
    if (o.chanted != null) return o.chanted ? (o.fever || o.badge ? 3 : 2) : 1;
    const n = o.combo || 0; return n >= 8 ? 3 : n >= 5 ? 2 : 1;
  }

  const KF = create();
  root.KnightFX = KF;

  // ═════ 接 TGUI（CONTRACT_v3 §9.3：本檔自己註冊掛勾；index 沒載入本檔＝完全不影響）
  const T = root.TGUI;
  if (T && typeof T.add === "function") {
    T.knightFx = KF;
    T.add("event", (ev, G) => { if (ev && ev.k === "knightUlt") { try { KF.play(ev, G); } catch (e) {} } });
    T.add("frame", (G, run, real) => { KF.update(real); });
    T.add("drawTop", (ctx, G, run) => { KF.draw(ctx, G, run); });
    T.add("timeScale", v => v * KF.timeScale());
    T.add("camera", cam => { const c = KF.cameraTransform(); return c ? (T.camMerge ? T.camMerge(cam, c) : c) : cam; });
    T.add("tap", () => { const sh = KF.current(); if (sh && sh.skippable && sh.t > 0.2) KF.skip(); return false; });   // 不吃掉點擊
  }
})(typeof window !== "undefined" ? window : globalThis);
