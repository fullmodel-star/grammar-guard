// 手感（juice）外掛：打擊感、升級演出、開波／魔王橫幅、連對火焰條、結算星星、分層音效。2026-11-21 美術改版第一刀
// 只用畫面端掛勾（TGUI.add：event／frame／drawGround／drawTop／start／end），不改引擎、不改 index.html 其他段落。
// 全部自繪（canvas Path／文字），不用 emoji 當特效主體；粒子同時最多 MAX_P 顆；震動與閃紅只在漏怪／魔王登場時、而且有節流。
//
// 給其他負責人的介面（地圖／精靈整合時讀）：
//   e._flashT   0~1：命中閃白（剛被打＝1，約 0.12 秒降到 0）→ ART.enemy 的 st.flash 直接讀它
//   e._kbx/_kby 像素：輕微擊退位移（沿路線往回推，最多約 2px，約 0.1 秒回正）→ 畫怪時加到座標上
//   tw._popT    0~1：升級彈跳計時（1→0，約 0.45 秒）；TGUI.juice.towerScale(tw) 直接回傳縮放倍率（最高 1.3）
//   e._critT    秒：機制端（詞彈）在呼叫 TG._hurt 前設 e._critT=0.3，或 push { k:"crit", e }，傷害數字就顯示成暴擊
//   TGUI.juice.centerBanner({ name, sub, label, col, T, merge })  中央橫幅排隊（魔王登場優先；merge＝併進剛出現的魔王橫幅）（11-22）
//   TGUI.juice.topReserve(G, run)／labelY(G, run)／waveStripY(G, run)  地圖上緣保留區下緣、小標籤列 y、開波細條 y（11-22）
//   window.ART 不存在、或沒有 ART.enemy 時，命中閃白由本外掛在怪的位置疊一層白光代替（有 ART.enemy 就交給精靈畫）
//   v3（11-22，第 6 組）：
//   ・狂熱邊框：只讀 TG.feverOn(G)／G.fever（合約 §5），地圖四周火焰邊框，淡入淡出；減少動態時不跳動、只留靜態邊框
//   ・TGUI.juice.ultFx(ev, G)：騎士絕招的簡易光柱（KnightFX 不存在時由 knight.ui.js 呼叫；有 KnightFX 就不會用到）
//   ・鏡頭（合約 §9.2 camera 掛勾）有縮放／位移時，連對火焰條、狂熱邊框、中央橫幅、開波細條改畫在「螢幕固定」層，不跟著鏡頭跑
//   ・prefers-reduced-motion：不震動（shake 直接不做）、不閃光、不縮放；文字與粒子照常
(function () {
  "use strict";
  const W = typeof window !== "undefined" ? window : globalThis;
  const T = W.TGUI, TG = W.TG;
  if (!T || !TG) return;
  const HAS_DOC = typeof document !== "undefined";
  const MAX_P = 150;                 // 粒子上限（碎片＋污漬＋金幣＋火花＋數字＋光環全部算在內）
  const reduced = (() => { try { return !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } })();
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = Math.random;           // 特效用亂數，不碰遊戲亂數（不影響每日一關的種子）

  // ───── 陣營色（ART.theme.enemyColor 有就用；否則用星夜奇幻預設：墨紫為主）
  const FACTION = {
    slime: "#8a5cd6", bat: "#5b3c9e", golem: "#8c86a6", elite: "#6d7fd1", goblin: "#6fa04a", splitter: "#b07ae0",
    mini: "#a98be8", frog: "#5fae5a", boss: "#c2463a", beGiant: "#a0957e", beMinion: "#7c5ad0", treant: "#8a6a3c",
    hydra: "#3f8f7a", lich: "#8fc8e8", dragonKing: "#b8323a", assassin: "#5a5480", priest: "#e8d48a"
  };
  function factionColor(type) {
    try { const th = W.ART && W.ART.theme, c = th && th.enemyColor && th.enemyColor[type]; if (c) return c; } catch (e) {}
    return FACTION[type] || "#7a52c8";
  }
  const def = e => TG.ENEMIES[e.type] || {};
  const hidden = (e, G) => !!(def(e).invis && !(G && (TG.crRevealed ? TG.crRevealed(G) : (G.cr && G.cr.revealT > 0))));   // 隱形刺客：特效不可洩漏位置
  const bodyY = e => def(e).fly ? e.y - 8 : e.y;

  // ───── 狀態
  const J = {
    P: [], banner: null, boss: null, bq: [], ups: 0, now: 0, last: 0,
    shakeT: 0, shakeA: 0, shakeCD: 0, castleT: 0, comboV: 0, lastTier: 0, tierT: 0,
    pend: [], gold: { x: 170, y: -8, at: -1 }, iconCache: {}, maxSeen: 0, feverV: 0, feverOn: false, reduced
  };

  // ───── 地圖上緣的保留區（11-22 疊層修正）：Be 巨人題目橫幅（y 4～38）、魔王頂部血條（y 3～29，有 Be 題目時 42～68）
  //   topReserve＝這些東西的下緣（沒有＝0）；labelY＝小標籤列（地形、真言光、減速）的 y；傷害數字、詞彈泡泡、開波細條都避開。
  //   畫面端其他外掛可用 TGUI.juice.topReserve(G, run)／labelY(G, run)。
  const bossOn = G => !!(G && G.enemies && G.enemies.some(e => (TG.ENEMIES[e.type] || {}).boss));
  function topReserve(G, run) {
    const be = !!(run && run.be);
    if (bossOn(G) && !(run && run.bbLow)) return (be ? 42 : 3) + 27;   // 11-25：魔王在地圖上緣時 index.html 把血條移到下方（run.bbLow），上緣就不用保留
    return be ? 40 : 0;
  }
  function labelY(G, run) { const r = topReserve(G, run); return r > 0 ? r + 2 : 4; }
  // 小標籤列有沒有東西（地形標籤、真言光、減速）：有的話開波細條再往下讓一列
  const hasLabels = G => !!(G && (G.terrain || (G.cr && (G.cr.chillT > 0 || G.cr.revealT > 0))));

  function addP(p) {
    if (J.P.length >= MAX_P) return null;
    p.t = 0; J.P.push(p); if (J.P.length > J.maxSeen) J.maxSeen = J.P.length; return p;
  }
  const room = n => J.P.length + n <= MAX_P;

  // ───── 音效（Web Audio 合成；尊重存檔靜音 S.muted；各類有節流，避免吵）
  let ac = null, master = null, noiseBuf = null;
  const lastSfx = {};
  function A() {
    if (T.S && T.S.muted) return null;
    try {
      if (!ac) { ac = new (W.AudioContext || W.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination); }
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function gate(k, gap) { const n = J.now; if (lastSfx[k] !== undefined && n - lastSfx[k] < gap) return false; lastSfx[k] = n; return true; }
  function tone(f, d, type, v, f2, delay) {
    const a = A(); if (!a) return;
    try {
      const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.03);
    } catch (e) {}
  }
  function noise(d, v, freq, delay) {
    const a = A(); if (!a) return;
    try {
      if (!noiseBuf) { noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.6), a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = rnd() * 2 - 1; }
      const t0 = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noiseBuf; f.type = "lowpass"; f.frequency.value = freq || 1200;
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + d + 0.02);
    } catch (e) {}
  }
  const SFX = {
    hit: () => { if (gate("hit", 0.07)) tone(1500, 0.035, "triangle", 0.009, 760); },
    crit: () => { if (gate("crit", 0.1)) { tone(980, 0.09, "square", 0.018, 1960); noise(0.06, 0.02, 3000); } },
    death: () => { if (gate("death", 0.05)) { noise(0.13, 0.03, 1300); tone(240, 0.11, "sine", 0.022, 90); } },
    coin: () => { if (gate("coin", 0.085)) { tone(1568, 0.06, "sine", 0.016); tone(2093, 0.09, "sine", 0.012, null, 0.045); } },
    upgrade: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.03, null, i * 0.07)); tone(1568, 0.35, "sine", 0.014, null, 0.28); },
    boss: () => { tone(55, 1.1, "sawtooth", 0.045, 36); tone(82, 0.9, "sine", 0.05, 41); noise(0.7, 0.035, 260); },
    tier: n => { const b = n >= 8 ? 1046 : n >= 5 ? 880 : 784; [1, 1.25, 1.5].forEach((m, i) => tone(b * m, 0.18, "sine", 0.022, null, i * 0.06)); },
    wave: () => { tone(392, 0.22, "triangle", 0.022); tone(523, 0.3, "triangle", 0.022, null, 0.12); },
    star: i => { noise(0.08, 0.03, 900); tone(660 * Math.pow(1.26, i), 0.2, "triangle", 0.028, null, 0.02); },
    ult: n => { if (!gate("ult", 0.3)) return; tone(196, 0.5, "sawtooth", 0.03, 98); noise(0.3, 0.03, 900); if (n >= 2) [784, 988, 1175].forEach((f, i) => tone(f, 0.2, "triangle", 0.02, null, 0.08 + i * 0.06)); },
    fever: () => { if (gate("fever", 1)) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "square", 0.012, null, i * 0.05)); }
  };

  // ───── HUD 金幣欄位置（換算成 300×400 邏輯座標；HUD 在畫布上方，所以 y 通常是負的）
  function goldTarget() {
    if (!HAS_DOC) return J.gold;
    if (J.now - J.gold.at < 1 && J.gold.at >= 0) return J.gold;
    try {
      const cv = document.getElementById("cv"), el = document.getElementById("hGold");
      if (cv && el) {
        const c = cv.getBoundingClientRect(), h = el.getBoundingClientRect();
        if (c.width > 0) { J.gold.x = clamp((h.left + h.width / 2 - c.left) / c.width * 300, 6, 294); J.gold.y = clamp((h.top + h.height / 2 - c.top) / c.height * 400, -40, 12); }
      }
    } catch (e) {}
    J.gold.at = J.now; return J.gold;
  }
  function pulseGold() {
    if (!HAS_DOC || !gate("pulse", 0.08)) return;
    try {
      const el = document.getElementById("hGold"); if (!el) return;
      el.style.display = "inline-block"; el.style.transition = "transform .12s ease-out,color .12s";
      el.style.transform = "scale(1.35)"; el.style.color = "#ffe07a";
      clearTimeout(pulseGold.t); pulseGold.t = setTimeout(() => { el.style.transform = ""; el.style.color = ""; }, 120);
    } catch (e) {}
  }

  // ───── 命中：閃白、擊退、傷害數字（每隻怪 0.1 秒內的傷害合併成一個數字，避免持續傷害洗版）
  function onDamage(e, d, G) {
    e._flashT = 1;
    if (!hidden(e, G)) {
      // 擊退方向：沿路線往回（d 小的方向）
      try {
        const rt = G.map.routes[e.r], q = TG.posOn(rt, (e.d || 0) + 4);   // 往前一點的位置，反方向就是「往回推」（剛出生 d＝0 也算得出來）
        const dx = e.x - q.x, dy = e.y - q.y, L = Math.hypot(dx, dy);
        if (L > 0.01) { e._kbdx = dx / L; e._kbdy = dy / L; e._kb = 1; }
      } catch (err) {}
      if (room(40)) for (let i = 0; i < 2; i++) addP({ k: "spark", x: e.x + (rnd() - .5) * 6, y: bodyY(e) + (rnd() - .5) * 6, vx: (rnd() - .5) * 90, vy: (rnd() - .5) * 90, T: 0.18, c: "#fff6d8", s: 1.4 });
    }
    e._jacc = (e._jacc || 0) + d;
    if (!e._jaccT) { e._jaccT = 0.1; J.pend.push(e); }
  }
  function dmgKind(e, d) {
    if (e._critT > 0 || d >= Math.max(25, (e.maxHp || 1) * 0.3)) return "crit";
    if (e.shield || (e.armor || 0) > 0) return "weak";
    return "norm";
  }
  const NUM = { crit: { size: 15, c: "#ffb02e", T: 0.85 }, norm: { size: 10, c: "#ffffff", T: 0.65 }, weak: { size: 9, c: "#9fb4d8", T: 0.6 } };
  const NUM_MAX = 14;   // 同時最多幾個傷害數字（召喚獸一次打一群時不洗版）
  function emitNumber(e, G) {
    const d = e._jacc || 0; e._jacc = 0; e._jaccT = 0;
    if (d < 0.5 || hidden(e, G)) return;
    const kind = dmgKind(e, d), st = NUM[kind];
    if (kind === "crit") SFX.crit(); else SFX.hit();
    const base = Math.round(d) + (kind === "crit" ? "!" : "");
    const x = e.x + (rnd() - .5) * 8; let y = bodyY(e) - (def(e).boss ? 22 : 14);
    // 頂部保留區（魔王血條、Be 題目）：出生點就放在保留區下面，整段上飄都不會進去，錯開／合併也照常運作（不會全擠在同一條線上）
    const rv = topReserve(G, T.run); if (rv > 0) y = Math.max(y, rv + st.size * 0.6 + 2 + 18);
    // 11-22：同一位置（召喚獸一次打好幾隻）同樣數字合併成「796!×3」；不同數字往上錯開一格，最多疊 2 層，再多就不畫
    let near = 0, nNum = 0, oldest = null;
    for (const p of J.P) {
      if (p.k !== "num" || !p.dmg) continue;
      nNum++; if (!oldest || p.t > oldest.t) oldest = p;
      if (p.t > 0.35 || Math.abs(p.x - x) > 22 || Math.abs(p.y0 - y) > 16) continue;
      if (p.base === base) { p.n = (p.n || 1) + 1; p.text = base + "×" + p.n; p.t = Math.min(p.t, 0.08); return; }
      near++;
    }
    if (near >= 3) return;
    if (nNum >= NUM_MAX) { if (kind !== "crit") return; const i = J.P.indexOf(oldest); if (i >= 0) J.P.splice(i, 1); }
    const y0 = y; y -= near * 10;
    addP({ k: "num", dmg: true, base, n: 1, y0, text: base, x, y, T: st.T, c: st.c, size: st.size, kind });
  }

  // ───── 怪死亡：碎片、地面污漬、金幣飛 HUD
  function onKill(e, G) {
    if (e._jhp !== undefined && e._jhp > e.hp) e._jacc = (e._jacc || 0) + (e._jhp - e.hp);
    emitNumber(e, G);
    const b = def(e), c = factionColor(e.type), big = !!b.boss, y = bodyY(e);
    const n = big ? 10 : 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.6, sp = (big ? 70 : 45) + rnd() * 50;
      addP({ k: "shard", x: e.x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, rot: rnd() * 6, vr: (rnd() - .5) * 14, T: 0.5 + rnd() * 0.25, c: i % 3 === 0 ? "#f4e9ff" : c, s: big ? 3.6 : 2.4 });
    }
    addP({ k: "stain", x: e.x, y: e.y + 2, T: 1, c, s: big ? 15 : 7 });
    if (big) addP({ k: "ring", x: e.x, y, r0: 10, r1: 46, T: 0.5, c: "#ffd75e", w: 3 });
    const gold = b.gold || 0, coins = gold >= 50 ? 3 : gold >= 10 ? 2 : 1;
    for (let i = 0; i < coins; i++) addP({ k: "coin", x0: e.x + (rnd() - .5) * 8, y0: y, x: e.x, y, delay: i * 0.07, T: 0.6 + i * 0.07, last: i === coins - 1 });
    SFX.death();
  }

  // ───── 升級演出
  function upgradeDiff(type, lv, branch, prevBranch) {
    const a = TG.towerStats(type, lv - 1, prevBranch || null), b = TG.towerStats(type, lv, branch || null);
    const from = Math.round(a.dmg), to = Math.round(b.dmg);
    const text = from !== to ? "傷害 " + from + "→" + to : "射程 " + a.range + "→" + b.range;
    return { from, to, rangeFrom: a.range, rangeTo: b.range, text };
  }
  function onUpgrade(ev, G) {
    const tw = ev.tw; if (!tw) return;
    J.ups++;
    tw._popT = 1;
    const prev = ev.branch ? null : (tw.branch || null), br = ev.branch || tw.branch || null;
    const diff = upgradeDiff(tw.type, ev.lv || tw.lv, br, prev);
    let range = diff.rangeTo;
    try { const st = TG.towerStats(tw.type, tw.lv, tw.branch); range = st.range; } catch (e) {}
    const brName = ev.branch && TG.BRANCHES[tw.type] && TG.BRANCHES[tw.type][ev.branch] ? TG.BRANCHES[tw.type][ev.branch].name : "";
    addP({ k: "pillar", x: tw.x, y: tw.y, T: 0.9 });
    addP({ k: "ring", x: tw.x, y: tw.y, r0: 14, r1: range, T: 0.7, c: "#ffd75e", w: 2.5 });
    addP({ k: "num", text: "Lv" + (ev.lv || tw.lv) + "!" + (brName ? " " + brName : ""), x: tw.x, y: tw.y - 26, T: 1.2, c: "#ffe07a", size: 16, kind: "lv" });
    addP({ k: "num", text: diff.text, x: tw.x, y: tw.y - 10, T: 1.3, c: "#cfe9ff", size: 9, kind: "sub" });
    for (let i = 0; i < 12 && room(1); i++) { const a = rnd() * Math.PI * 2; addP({ k: "spark", x: tw.x + Math.cos(a) * 8, y: tw.y + Math.sin(a) * 8, vx: Math.cos(a) * 30, vy: -40 - rnd() * 60, T: 0.7 + rnd() * 0.3, c: "#ffd75e", s: 1.8 }); }
    SFX.upgrade();
    return diff;
  }
  function towerScale(tw) { const p = tw && tw._popT > 0 ? tw._popT : 0; return p > 0 && !J.reduced ? 1 + 0.3 * Math.sin(Math.PI * (1 - p)) : 1; }   // 減少動態：不彈跳縮放

  // ───── 騎士絕招簡易光柱（KnightFX 不存在時的替代；tier 1～3 粒子 10／20／32、光環 1／2／3 圈；不閃光、不震動）
  const ULT_NAME = { wall: "盾牆", tense3: "時態三連斬", beWrath: "Be 之怒" };
  const ULT_R = { wall: [60], tense3: [70, 60, 120], beWrath: [50, 80, 110] };
  function ultFx(ev, G) {
    if (!ev) return null;
    const tier = clamp(ev.tier | 0 || 1, 1, 3), x = ev.x == null ? 150 : ev.x, y = ev.y == null ? 200 : ev.y;
    let col = "#ffd75e";
    try { const f = W.ART && W.ART.KNIGHT_FX && W.ART.KNIGHT_FX[clamp(ev.stage | 0, 0, 4)]; if (f && f.spark) col = "rgb(" + f.spark + ")"; } catch (e) {}
    addP({ k: "pillar", x, y, T: 0.5 + 0.25 * tier });
    const rs = ULT_R[ev.ult] || [70];
    const nr = Math.max(1, Math.min(tier, rs.length));
    for (let i = 0; i < nr; i++) addP({ k: "ring", x, y, r0: 8, r1: rs[Math.min(i, rs.length - 1)], T: 0.45 + 0.12 * i, c: i ? col : "#ffd75e", w: 3 - i * 0.5 });
    const n = [10, 20, 32][tier - 1];
    for (let i = 0; i < n && room(1); i++) { const a = rnd() * Math.PI * 2, sp = 40 + rnd() * 70; addP({ k: "spark", x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, T: 0.5 + rnd() * 0.35, c: i % 3 ? col : "#fff6d8", s: 1.8 }); }
    addP({ k: "num", text: (ULT_NAME[ev.ult] || "絕招") + "！", x, y: y - 34, T: 1.1, c: "#ffe07a", size: 13 + tier * 2, kind: "lv" });
    if (ev.text && typeof ev.text === "string") addP({ k: "num", text: ev.text, x, y: y - 16, T: 0.9, c: "#cfe9ff", size: 10, kind: "sub" });
    SFX.ult(tier);
    return true;
  }

  // ───── 狂熱邊框（只讀 TG.feverOn(G)；地圖四周火焰。真實時間推進，暫停時照常淡出）
  function feverOn(G) { try { return !!(G && TG.feverOn && TG.feverOn(G)); } catch (e) { return false; } }
  let fevGrad = null, fevCtx = null;
  function drawFever(ctx, G) {
    const v = J.feverV; if (v < 0.01) return;
    if (fevCtx !== ctx || !fevGrad) {   // 漸層建一次重複用（同一個 ctx）
      fevCtx = ctx; const mk = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, "rgba(255,120,40,.85)"); g.addColorStop(0.45, "rgba(255,170,60,.35)"); g.addColorStop(1, "rgba(255,170,60,0)"); return g; };
      fevGrad = { t: mk(0, 0, 0, 16), b: mk(0, 400, 0, 384), l: mk(0, 0, 14, 0), r: mk(300, 0, 286, 0) };
    }
    const pulse = reduced ? 1 : 0.82 + 0.18 * Math.sin(J.now * 9);
    ctx.globalAlpha = v * pulse;
    ctx.fillStyle = fevGrad.t; ctx.fillRect(0, 0, 300, 16);
    ctx.fillStyle = fevGrad.b; ctx.fillRect(0, 384, 300, 16);
    ctx.fillStyle = fevGrad.l; ctx.fillRect(0, 0, 14, 400);
    ctx.fillStyle = fevGrad.r; ctx.fillRect(286, 0, 14, 400);
    ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 298, 398);
    // 火苗：上下緣各 9 個（減少動態時高度固定、不晃）
    ctx.globalAlpha = 0.8 * v; ctx.fillStyle = "#ff8a3c";
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const fx = 17 + i * 33, w = 6, h = reduced ? 9 : 7 + 5 * (0.5 + 0.5 * Math.sin(J.now * 11 + i * 1.9));
      ctx.moveTo(fx - w, 400); ctx.quadraticCurveTo(fx - 2, 400 - h * 0.55, fx, 400 - h); ctx.quadraticCurveTo(fx + 2, 400 - h * 0.55, fx + w, 400); ctx.closePath();
      const h2 = h * 0.7; ctx.moveTo(fx - w, 0); ctx.quadraticCurveTo(fx - 2, h2 * 0.55, fx, h2); ctx.quadraticCurveTo(fx + 2, h2 * 0.55, fx + w, 0); ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 鏡頭有變形時（camera 掛勾），把 HUD 類的東西畫在螢幕固定層（邏輯 300×400，不跟鏡頭縮放、不跟震動）
  function fixed(ctx, fn) {
    let v = null; try { v = T.view && T.view(); } catch (e) { v = null; }
    if (v && v.cam && v.s) { ctx.save(); ctx.setTransform(v.s, 0, 0, v.s, 0, 0); try { fn(); } finally { ctx.restore(); } }
    else fn();
  }

  // ───── 可升級提示
  function canUpgrade(tw, G) {
    if (!tw || tw.lv >= TG.MAX_LV || tw.lockT > 0 || tw.sealT > 0 || tw.pending) return false;
    if (TG.needsBranch && TG.needsBranch(tw) && !G.branchOk) return false;
    const cost = G.freeUp ? 0 : TG.upgradeCost(tw.type, tw.lv, G);
    return G.gold >= cost;
  }

  // ───── 連對段數（3／5／8）
  const tierOf = n => n >= 8 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0;
  const TIER_N = [0, 3, 5, 8];
  function checkTier(G) {
    const t = tierOf(G.combo || 0);
    if (t > J.lastTier) {
      J.tierT = 1;
      for (const tw of G.towers) if (room(2)) addP({ k: "ring", x: tw.x, y: tw.y, r0: 10, r1: 26, T: 0.8, c: "#ffd75e", w: 3 });
      addP({ k: "num", text: "連對 " + TIER_N[t] + "！", x: 150, y: 70, T: 1.2, c: t >= 3 ? "#bfe9ff" : "#ffd75e", size: 18, kind: "lv" });
      SFX.tier(TIER_N[t]);
    }
    J.lastTier = t;
  }

  // ───── 開波橫幅、魔王登場
  // 11-22 疊層修正：開波＝地圖上緣細條、1.6 秒（原本地圖中間 2.3 秒，蓋住怪進場那一列）；
  //   魔王登場＝中央大橫幅，優先：出現時開波細條直接收掉；其他中央橫幅（bosses.ui.js 的「出現了」「第 N 階段」）排隊一個接一個播。
  const WAVE_T = 1.6;
  function onWave(ev, G) {
    const counts = {};
    for (const t of ev.list || []) counts[t] = (counts[t] || 0) + 1;
    const types = Object.keys(counts);
    J.banner = { t: 0, T: WAVE_T, wave: ev.wave, max: G.stage ? G.maxWave : 0, types, counts, boss: types.some(t => (TG.ENEMIES[t] || {}).boss) };
    if (J.boss) J.banner = null;   // 魔王橫幅正在播：不疊
    SFX.wave();
  }
  function onBoss(e) {
    if (J.boss && J.boss.kind === "boss" && J.boss.t < J.boss.T) return;   // 同時好幾隻魔王（測試／無盡）只播一次
    J.boss = { kind: "boss", t: 0, T: 1.7, label: "魔王登場", name: def(e).name || "魔王", sub: "", col: "#ffe6a0" };
    J.banner = null;
    shake(0.12, 2);
    SFX.boss();
  }
  // 其他外掛的中央橫幅：{ name, sub, label, col, T, merge }；merge＝剛登場的魔王橫幅還在前段就把 sub 併進去（同一張，不排隊）
  function centerBanner(o) {
    if (!o) return;
    const b = J.boss;
    if (o.merge && b && b.kind === "boss" && b.t < 0.8 && !b.sub) { b.sub = o.sub || ""; b.T = Math.max(b.T, 2.4); return; }
    // upgrade＝把剛出現的「魔王登場」橫幅直接改成這張（超大魔王；11-25 試玩小安：第 4 關原本連播兩張約 4.6 秒、蓋住六成地圖）；已有副標（區域魔王的招式）就保留
    if (o.upgrade && b && b.kind === "boss" && b.t < 0.8) { if (o.label) b.label = o.label; if (o.name) b.name = o.name; if (!b.sub) b.sub = o.sub || ""; if (o.col) b.col = o.col; b.big = true; b.T = Math.max(b.T, o.T || 2.6); return; }
    const it = { kind: "msg", t: 0, T: o.T || 2.2, label: o.label || "", name: o.name || "", sub: o.sub || "", col: o.col || "#ffd75e" };
    if (!b) { J.boss = it; J.banner = null; } else if (J.bq.length < 3) J.bq.push(it);
  }
  function enemyIcon(type) {
    if (J.iconCache[type] !== undefined) return J.iconCache[type];
    let c = null;
    try {
      if (HAS_DOC && W.ART && typeof W.ART.icon === "function") { c = document.createElement("canvas"); c.width = c.height = 40; W.ART.icon(c, "enemy", type); }
    } catch (e) { c = null; }
    J.iconCache[type] = c; return c;
  }

  // ───── 震動（只動畫布本身的 CSS 位移；≤120ms、小幅、有冷卻）
  function shake(dur, amp) {
    if (reduced || J.shakeCD > 0) return;
    J.shakeT = Math.min(dur, 0.12); J.shakeD = J.shakeT; J.shakeA = Math.min(amp, 3); J.shakeCD = 0.35;
  }
  function applyShake() {
    if (!HAS_DOC) return;
    const cv = document.getElementById("cv"); if (!cv) return;
    if (J.shakeT > 0) { const k = J.shakeA * (J.shakeT / (J.shakeD || 0.12)); cv.style.transform = "translate(" + ((rnd() - .5) * 2 * k).toFixed(1) + "px," + ((rnd() - .5) * 2 * k).toFixed(1) + "px)"; J._shook = true; }
    else if (J._shook) { cv.style.transform = ""; J._shook = false; }
  }

  // ───── 每幀推進（真實時間；遊戲暫停時特效照樣播完）
  function step(dt, G) {
    J.now += dt;
    if (J.shakeCD > 0) J.shakeCD -= dt;
    if (J.shakeT > 0) J.shakeT = Math.max(0, J.shakeT - dt);
    if (J.castleT > 0) J.castleT = Math.max(0, J.castleT - dt);
    if (J.tierT > 0) J.tierT = Math.max(0, J.tierT - dt / 0.9);
    { const on = feverOn(G), tv = on ? 1 : 0; if (on && !J.feverOn) SFX.fever(); J.feverOn = on; J.feverV += (tv - J.feverV) * Math.min(1, dt * (on ? 6 : 3)); if (!on && J.feverV < 0.01) J.feverV = 0; }
    if (G) {
      for (const e of G.enemies) {
        if (e._flashT > 0) e._flashT = Math.max(0, e._flashT - dt / 0.12);
        if (e._critT > 0) e._critT -= dt;
        if (e._kb > 0) { e._kb = Math.max(0, e._kb - dt / 0.1); e._kbx = e._kbdx * 2.2 * e._kb; e._kby = e._kbdy * 2.2 * e._kb; }
        else if (e._kbx) { e._kbx = 0; e._kby = 0; }
      }
      for (const tw of G.towers) if (tw._popT > 0) tw._popT = Math.max(0, tw._popT - dt / 0.45);
      if (J.pend.length) {
        const keep = [];
        for (const e of J.pend) { e._jaccT -= dt; if (e._jaccT <= 0) emitNumber(e, G); else keep.push(e); }
        J.pend = keep;
      }
      const tgt = J.P.some(p => p.k === "coin") ? goldTarget() : J.gold;
      const tv = clamp((G.combo || 0) / 8, 0, 1); J.comboV += (tv - J.comboV) * Math.min(1, dt * 8);
      for (let i = J.P.length - 1; i >= 0; i--) {
        const p = J.P[i]; p.t += dt;
        if (p.k === "shard") { p.vy += 170 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
        else if (p.k === "spark") { p.vy += 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else if (p.k === "coin") {
          const u = clamp((p.t - p.delay) / (p.T - p.delay), 0, 1), e2 = u * u * (3 - 2 * u);
          const cx = (p.x0 + tgt.x) / 2, cy = Math.min(p.y0, tgt.y) - 50;
          p.x = (1 - e2) * (1 - e2) * p.x0 + 2 * (1 - e2) * e2 * cx + e2 * e2 * tgt.x;
          p.y = (1 - e2) * (1 - e2) * p.y0 + 2 * (1 - e2) * e2 * cy + e2 * e2 * tgt.y;
          if (u >= 1 && !p.done) { p.done = true; if (p.last) { pulseGold(); SFX.coin(); } }
        }
        if (p.t >= p.T) J.P.splice(i, 1);
      }
    }
    if (J.banner) { J.banner.t += dt; if (J.banner.t >= J.banner.T) J.banner = null; }
    if (J.boss) { if (!ultBusy()) J.boss.t += dt; if (J.boss.t >= J.boss.T) J.boss = J.bq.length ? J.bq.shift() : null; }
    else if (J.bq.length) J.boss = J.bq.shift();
    applyShake();
  }

  // ───── 繪圖
  function drawGround(ctx) {
    for (const p of J.P) {
      if (p.k !== "stain") continue;
      const a = 1 - p.t / p.T;
      ctx.globalAlpha = 0.42 * a; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * (1 + 0.15 * (1 - a)), p.s * 0.45, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.25 * a; ctx.beginPath(); ctx.ellipse(p.x + p.s * 0.7, p.y + 1, p.s * 0.3, p.s * 0.18, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawCoin(ctx, x, y, spin) {
    const w = 3.4 * Math.max(0.25, Math.abs(Math.cos(spin)));
    ctx.fillStyle = "#a8741a"; ctx.beginPath(); ctx.ellipse(x, y + 0.6, w, 3.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.ellipse(x, y, w, 3.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff3b8"; ctx.fillRect(x - w * 0.35, y - 2, Math.max(0.6, w * 0.3), 1.4);
  }
  function drawArrow(ctx, x, y, big) {
    if (big) {   // 11-22：手上升級券 ≥3 張還沒用 → 箭頭放大 1.5 倍＋金色光暈（提醒「券可以用了」）
      const k = 1.5, gl = 0.55 + 0.45 * Math.sin(J.now * 7);
      ctx.save();
      ctx.globalAlpha = 0.5 * gl; ctx.fillStyle = "#ffd75e"; ctx.beginPath(); ctx.arc(x, y - 1, 9, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y);
      drawArrow(ctx, x, y, false); ctx.restore(); return;
    }
    ctx.fillStyle = "#3a2600"; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5.5, y); ctx.lineTo(x + 2.2, y); ctx.lineTo(x + 2.2, y + 4.5); ctx.lineTo(x - 2.2, y + 4.5); ctx.lineTo(x - 2.2, y); ctx.lineTo(x - 5.5, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd75e"; ctx.beginPath(); ctx.moveTo(x, y - 4.6); ctx.lineTo(x + 3.8, y - 0.8); ctx.lineTo(x + 1.3, y - 0.8); ctx.lineTo(x + 1.3, y + 3.4); ctx.lineTo(x - 1.3, y + 3.4); ctx.lineTo(x - 1.3, y - 0.8); ctx.lineTo(x - 3.8, y - 0.8); ctx.closePath(); ctx.fill();
  }
  function drawTop(ctx, G, run) {
    const m = G.map, resv = topReserve(G, run);
    // 城牆閃紅
    if (J.castleT > 0 && m && m.end) {
      const a = J.castleT / 0.5, x = m.end[0], y = Math.min(m.end[1], 380);
      ctx.globalAlpha = 0.55 * a; ctx.fillStyle = "#ff3b3b"; ctx.beginPath(); ctx.arc(x, y, 30 + 10 * (1 - a), 0, 7); ctx.fill();
      ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = "#ff8a8a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 22 + 26 * (1 - a), 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 連對段數：全塔金光
    if (J.tierT > 0) {
      ctx.globalAlpha = 0.35 * J.tierT; ctx.fillStyle = "#ffd75e";
      for (const tw of G.towers) { ctx.beginPath(); ctx.arc(tw.x, tw.y, 17, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 粒子
    for (const p of J.P) {
      const a = 1 - p.t / p.T;
      if (p.k === "shard") {
        ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = p.c;
        const c = Math.cos(p.rot) * p.s, s = Math.sin(p.rot) * p.s;
        ctx.beginPath(); ctx.moveTo(p.x + c, p.y + s); ctx.lineTo(p.x - s * 0.8, p.y + c * 0.8); ctx.lineTo(p.x - c * 0.9, p.y - s * 0.9); ctx.closePath(); ctx.fill();
      } else if (p.k === "spark") {
        ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      } else if (p.k === "coin") {
        if (p.t < p.delay) continue; ctx.globalAlpha = 1; drawCoin(ctx, p.x, p.y, p.t * 14);
      } else if (p.k === "ring") {
        const u = p.t / p.T; ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - (1 - u) * (1 - u)), 0, 7); ctx.stroke();
      } else if (p.k === "pillar") {
        const u = p.t / p.T, w = 18 * (1 - u * 0.6), top = p.y - 130;
        const g = ctx.createLinearGradient(0, top, 0, p.y);
        g.addColorStop(0, "rgba(255,215,94,0)"); g.addColorStop(0.7, "rgba(255,226,140,.55)"); g.addColorStop(1, "rgba(255,246,210,.9)");
        ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(p.x - w / 2, top, w, p.y - top);
        ctx.fillStyle = "rgba(255,250,230,.8)"; ctx.fillRect(p.x - w / 6, top + 20, w / 3, p.y - top - 20);
      }
    }
    ctx.globalAlpha = 1;
    // 命中閃白（沒有精靈時的替代；有 ART.enemy 就由精靈讀 e._flashT 自己畫）
    if (!(W.ART && W.ART.enemy)) {
      ctx.fillStyle = "#ffffff";
      for (const e of G.enemies) if (e._flashT > 0 && !hidden(e, G)) { ctx.globalAlpha = 0.5 * e._flashT; ctx.beginPath(); ctx.arc(e.x, bodyY(e), def(e).boss ? 15 : 9, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 可升級的小金箭頭
    if (!G.over) {
      const many = (G.tickets || 0) >= 3, bob = Math.sin(J.now * (many ? 8 : 6)) * (many ? 4 : 2);
      for (const tw of G.towers) if (canUpgrade(tw, G)) {
        if (many) { ctx.globalAlpha = 0.35 + 0.3 * Math.sin(J.now * 7); ctx.strokeStyle = "#ffd75e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tw.x, tw.y + 2, 17, 7.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
        drawArrow(ctx, tw.x + 11, tw.y - (many ? 22 : 18) + bob, many);
      }
    }
    // 數字與大字
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    for (const p of J.P) {
      if (p.k !== "num") continue;
      const u = p.t / p.T, a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const pop = (p.kind === "crit" || p.kind === "lv") && !reduced ? 1 + 0.5 * Math.max(0, 1 - p.t / 0.12) : 1;
      const rise = p.kind === "lv" ? 14 : p.kind === "sub" ? 10 : 18;
      // 頂部保留區（魔王血條、Be 題目）裡不畫數字：往下推到保留區下緣
      const x = clamp(p.x, 24, 276), y = Math.max(p.y - rise * (1 - (1 - u) * (1 - u)), resv > 0 ? resv + p.size * 0.6 + 2 : -99);
      ctx.globalAlpha = a; ctx.font = "bold " + Math.round(p.size * pop) + "px sans-serif";
      if (p.size >= 10) { ctx.strokeStyle = "#140a28"; ctx.lineWidth = p.size >= 15 ? 3.5 : 2.5; ctx.strokeText(p.text, x, y); }
      ctx.fillStyle = p.c; ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
    fixed(ctx, () => {
      drawFever(ctx, G);
      drawCombo(ctx, G, resv);
      drawBoss(ctx);
      drawBanner(ctx, G, run);
    });
  }
  function drawCombo(ctx, G, resv) {
    const v = J.comboV; if (v < 0.01) return;
    const n = G.combo || 0, tier = tierOf(n);
    const col = tier >= 3 ? "#bfe9ff" : tier === 2 ? "#ff6a4a" : tier === 1 ? "#ffc94a" : "#ff8a3c";
    // 有魔王血條／Be 題目時：火焰條縮成最上緣 2px 細線、不畫火苗（原本蓋住血條上緣與右端）
    if (resv > 0) {
      ctx.fillStyle = "rgba(12,16,40,.55)"; ctx.fillRect(4, 0, 292, 2.4);
      ctx.fillStyle = col; ctx.fillRect(4, 0, 292 * v, 2);
      return;
    }
    const L = 292 * v, x0 = 4, y = 3;
    ctx.fillStyle = "rgba(12,16,40,.55)"; ctx.fillRect(x0, y - 1, 292, 5);
    ctx.fillStyle = col; ctx.fillRect(x0, y, L, 3);
    // 火苗
    const k = Math.min(14, Math.floor(L / 20));
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < k; i++) {
      const fx = x0 + 10 + i * 20 + Math.sin(J.now * 9 + i) * 2, h = 3 + 2.5 * (0.5 + 0.5 * Math.sin(J.now * 13 + i * 1.7)) + tier;
      ctx.beginPath(); ctx.moveTo(fx - 3, y + 1); ctx.quadraticCurveTo(fx - 1, y - h * 0.5, fx, y - h); ctx.quadraticCurveTo(fx + 1, y - h * 0.5, fx + 3, y + 1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffe9a8"; for (const t of [3, 5, 8]) ctx.fillRect(x0 + 292 * t / 8 - 0.5, y - 1, 1, 5);
  }
  // 中央大橫幅（魔王登場／其他外掛排隊的訊息）。11-22：原本從左邊滑進來，畫面卡住或截圖剛好抓到前 0.2 秒時，
  //   只看到左側一塊暗紅方塊（小明 P3）→ 改成原地淡入＋輕微放大，任何一格畫面都是完整的橫幅。
  // 11-25 試玩小華（390 寬）：魔王登場時剛好放絕招，「盾牆 SHIELD WALL」演出疊在魔王橫幅上 → 絕招演出期間中央橫幅暫停、不畫，演完再接著播
  function ultBusy() { try { const k = T.knightFx; return !!(k && typeof k.busy === "function" && k.busy()); } catch (e) { return false; } }
  function drawBoss(ctx) {
    const b = J.boss; if (!b || ultBusy()) return;
    const t = b.t, T = b.T, boss = b.kind === "boss";
    if (boss) {
      const dark = t < 0.15 ? t / 0.15 : t < T - 0.7 ? 1 : Math.max(0, (T - t) / 0.7);
      ctx.globalAlpha = 0.5 * dark; ctx.fillStyle = "#05030f"; ctx.fillRect(0, 0, 300, 400);
    }
    const a = Math.min(1, t / 0.18, Math.max(0, (T - t) / 0.4));
    if (a <= 0) { ctx.globalAlpha = 1; return; }
    const sc = reduced ? 1 : 0.92 + 0.08 * Math.min(1, t / 0.18), y = 186, hh = b.sub ? 27 : 22;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(150, y); ctx.scale(sc, sc); ctx.translate(-150, -y);
    ctx.fillStyle = boss ? "rgba(60,8,16,.92)" : "rgba(14,20,44,.92)"; ctx.fillRect(0, y - hh, 300, hh * 2);
    ctx.fillStyle = boss ? "#e8c766" : b.col; ctx.fillRect(0, y - hh, 300, 2); ctx.fillRect(0, y + hh - 2, 300, 2);
    if (b.big) { ctx.fillStyle = "#ffe07a"; ctx.fillRect(0, y - hh - 3, 300, 2); ctx.fillRect(0, y + hh + 1, 300, 2); }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ny = b.sub ? y - 2 : y + 6;
    if (boss) {   // 王冠
      const cx = 150; ctx.fillStyle = "#ffd75e";
      ctx.beginPath(); ctx.moveTo(cx - 10, ny - 15); ctx.lineTo(cx - 10, ny - 23); ctx.lineTo(cx - 5, ny - 18); ctx.lineTo(cx, ny - 25); ctx.lineTo(cx + 5, ny - 18); ctx.lineTo(cx + 10, ny - 23); ctx.lineTo(cx + 10, ny - 15); ctx.closePath(); ctx.fill();
    }
    if (b.label) { ctx.font = "bold 9px sans-serif"; ctx.fillStyle = boss ? "#ffb3a0" : "#cfe0ea"; ctx.fillText(b.label, boss ? 98 : 150, ny - 18); }
    let fs = 19; ctx.font = "bold " + fs + "px sans-serif";
    while (fs > 12 && ctx.measureText(b.name).width > 284) { fs--; ctx.font = "bold " + fs + "px sans-serif"; }
    ctx.strokeStyle = "#1a0006"; ctx.lineWidth = 3; ctx.strokeText(b.name, 150, ny); ctx.fillStyle = boss ? b.col : b.col; ctx.fillText(b.name, 150, ny);
    if (b.sub) { ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#eef5ef"; ctx.fillText(b.sub, 150, y + 16); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // 開波細條：地圖上緣（避開魔王血條、Be 題目、地形標籤列），一行「第 N 波／M」＋怪種小圖示；放不下的怪種收成「+N」，390 寬不切字
  function waveStripY(G, run) { return (G ? labelY(G, run) : 4) + (hasLabels(G) ? 18 : 0); }
  function drawBanner(ctx, G, run) {
    const b = J.banner; if (!b) return;
    const u = b.t / b.T, a = Math.min(1, u / 0.1, Math.max(0, (1 - u) / 0.15));
    if (a <= 0) return;
    const K = (W.ART && W.ART.textK) || 1;   // 11-25 畫面放大組：手機直拿時字與小圖示 ×1.3
    const y = waveStripY(G, run) - 6 * (1 - Math.min(1, u / 0.1)), h = 24 * K;
    ctx.save(); ctx.globalAlpha = 0.95 * a;
    ctx.fillStyle = "rgba(10,18,44,.86)"; roundRect(ctx, 4, y, 292, h, 7); ctx.fill();
    ctx.strokeStyle = b.boss ? "#ff8a6a" : "#e8c766"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const title = "第 " + b.wave + " 波" + (b.max ? "／" + b.max : "") + (b.boss ? "・魔王來襲" : "");
    ctx.font = "bold " + (12 * K) + "px sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "#050a1c";
    ctx.strokeText(title, 11, y + h / 2 + 0.5); ctx.fillStyle = b.boss ? "#ffb08a" : "#ffd75e"; ctx.fillText(title, 11, y + h / 2 + 0.5);
    let x = 11 + ctx.measureText(title).width + 8;
    const right = 292, gap = 4;
    ctx.font = "bold " + (9 * K) + "px sans-serif";
    const items = b.types.map(t => {
      const ic = enemyIcon(t), name = (TG.ENEMIES[t] || {}).name || t, cnt = "×" + b.counts[t];
      const w = ic ? 18 * K + ctx.measureText(cnt).width + 4 : ctx.measureText(name.slice(0, 3) + cnt).width + 10;
      return { t, ic, name, cnt, w };
    });
    let shown = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], rest = items.length - i - 1, need = it.w + (rest > 0 ? gap + 20 * K : 0);
      if (x + need > right && !(rest === 0 && x + it.w <= right)) break;
      const boss = (TG.ENEMIES[it.t] || {}).boss, iy = y + h / 2;
      ctx.fillStyle = boss ? "rgba(120,20,30,.85)" : "rgba(40,30,80,.9)"; roundRect(ctx, x, iy - 8 * K, it.w, 16 * K, 6); ctx.fill();
      ctx.fillStyle = boss ? "#ffd2c2" : "#e9e2ff";
      if (it.ic) { ctx.drawImage(it.ic, x + 1, iy - 8 * K, 16 * K, 16 * K); ctx.fillText(it.cnt, x + 1 + 18 * K, iy + 0.5); }
      else ctx.fillText(it.name.slice(0, 3) + it.cnt, x + 5, iy + 0.5);
      x += it.w + gap; shown++;
    }
    const more = items.length - shown;
    if (more > 0) { ctx.fillStyle = "#e9e2ff"; ctx.fillText("+" + more, Math.min(x + 1, right - 16 * K), y + h / 2 + 0.5); }
    ctx.restore(); ctx.globalAlpha = 1; ctx.textAlign = "center";
  }

  // ───── 結算：星星逐顆砸下
  function injectCss() {
    if (!HAS_DOC || document.getElementById("jzCss")) return;
    const s = document.createElement("style"); s.id = "jzCss";
    s.textContent = ".jz-star{display:inline-block;animation:jzDrop .5s cubic-bezier(.3,1.6,.5,1) both}.jz-star.off{color:#8a7a50}" +
      "@keyframes jzDrop{0%{transform:translateY(-70px) scale(2.2) rotate(-30deg);opacity:0}60%{transform:translateY(4px) scale(.9);opacity:1}100%{transform:none;opacity:1}}" +
      ".jz-line{color:#ffd75e!important}";
    document.head.appendChild(s);
  }
  function animateStars() {
    if (!HAS_DOC) return;
    setTimeout(() => {
      try {
        const el = document.querySelector("#ovEnd .stars"); if (!el || el.dataset.jz) return;
        injectCss(); el.dataset.jz = "1";
        const chars = Array.from(el.textContent);
        el.innerHTML = chars.map((c, i) => '<span class="jz-star' + (c === "★" ? "" : " off") + '" style="animation-delay:' + (0.3 + i * 0.3).toFixed(2) + 's">' + c + "</span>").join("");
        chars.forEach((c, i) => { if (c === "★") setTimeout(() => SFX.star(i), 300 + i * 300 + 300); });
      } catch (e) {}
    }, 0);
  }

  // ───── 掛勾
  T.add("start", G => {
    J.P.length = 0; J.pend.length = 0; J.banner = null; J.boss = null; J.bq.length = 0; J.ups = 0; J.castleT = 0; J.tierT = 0; J.comboV = 0; J.feverV = 0; J.feverOn = false;
    J.lastTier = tierOf((G && G.combo) || 0); J.shakeT = 0; J.gold.at = -1;
    if (G) for (const e of G.enemies) e._jhp = e.hp;
    applyShake();
  });
  T.add("event", (ev, G) => {
    if (!ev || !G) return;
    const e = ev.e;
    if (ev.k === "spawn" && e) { e._jhp = e.hp; if (def(e).boss) onBoss(e); }
    else if (ev.k === "kill" && e) onKill(e, G);
    else if (ev.k === "leak") { J.castleT = 0.5; shake(0.11, 2.5); }
    else if (ev.k === "upgrade") onUpgrade(ev, G);
    else if (ev.k === "waveStart") onWave(ev, G);
    else if (ev.k === "combo") checkTier(G);
    else if (ev.k === "crit" && e) e._critT = 0.3;
    else if (ev.k === "fever" && ev.on !== false) { if (room(1)) addP({ k: "num", text: "狂熱時刻！", x: 150, y: 96, T: 1.3, c: "#ffb347", size: 20, kind: "lv" }); }
  });
  // 11-22：畫面上方的文字提示（index.html 的 #toast，例如「連對 13 題：下次升級免費」）落在地圖上緣時，
  //   會蓋住魔王血條／Be 巨人題目 → 這段時間把提示移到保留區＋標籤列下面；沒有保留區就還原（只改 inline top，不動 index.html）。
  let toastNat = null;
  function placeToast(G, run) {
    if (!HAS_DOC) return;
    try {
      const el = document.getElementById("toast"), cv = document.getElementById("cv"), app = document.getElementById("app");
      if (!el || !cv || !app) return;
      const resv = G && !G.over ? topReserve(G, run) : 0, lab = !!(G && !G.over && hasLabels(G));
      if ((resv <= 0 && !lab) || el.classList.contains("hide")) { if (el.style.top) el.style.top = ""; return; }
      if (!el.style.top) toastNat = el.offsetTop;
      const c = cv.getBoundingClientRect(), a = app.getBoundingClientRect(), k = c.height / 400;
      const zoneTop = c.top - a.top, zoneBot = zoneTop + (labelY(G, run) + (hasLabels(G) ? 18 : 0)) * k;
      const nat = toastNat == null ? 52 : toastNat, h = el.offsetHeight || 34;
      const want = nat + h > zoneTop && nat < zoneBot ? Math.round(zoneBot + 4) + "px" : "";
      if (el.style.top !== want) el.style.top = want;
    } catch (e) {}
  }
  if (HAS_DOC) setInterval(() => { if (!T.G || T.G.over) placeToast(null, null); }, 500);   // 中途放棄（G 變 null）時還原提示位置
  T.add("frame", (G, run) => {
    placeToast(G, run);
    for (const e of G.enemies) {
      if (e._jhp === undefined) { e._jhp = e.hp; continue; }
      const d = e._jhp - e.hp;
      if (d > 0.01) onDamage(e, d, G);
      e._jhp = e.hp;
    }
  });
  T.add("drawGround", ctx => drawGround(ctx));
  T.add("drawTop", (ctx, G, run) => {
    const nowS = (W.performance && W.performance.now ? W.performance.now() : Date.now()) / 1000;
    const dt = J.last ? clamp(nowS - J.last, 0, 0.1) : 0; J.last = nowS;
    checkTier(G);
    step(dt, G);
    drawTop(ctx, G, run);
  });
  T.add("end", (G, run, won) => {
    placeToast(null, null);
    if (!won) return [];
    animateStars();
    return ["本局答對 " + Math.round((run && run.qRight) || 0) + " 題，換來 " + J.ups + " 次升級"];
  });

  // 對外（測試與其他負責人用）
  T.juice = J;
  Object.assign(J, { MAX_P, step, drawTop, drawGround, upgradeDiff, towerScale, canUpgrade, tierOf, dmgKind, factionColor, onKill, onUpgrade, addP, centerBanner, topReserve, labelY, waveStripY, NUM_MAX, ultFx, feverOn, drawFever });
})();
