/* 929 文法片語守衛戰：精靈繪圖（塔／怪／魔王／英雄／召喚獸／投射物／UI 圖示）
   樣稿 B「星夜奇幻」＋老闆修正（描邊 ×1.2、地面調亮一階）。全部 canvas 自繪向量，不用圖檔／字型／emoji。
   介面見 art/CONTRACT.md「精靈」段：座標＝遊戲邏輯座標 300×400（呼叫前 ctx 已設好縮放），t＝秒。
   效能：同種／同級／同分支／同幀的圖第一次畫到離屏 canvas（解析度＝目前縮放×devicePixelRatio），之後每幀只 drawImage。
   第二刀新增：一般怪依 ART.setRegion 區域換配件／偏色／描邊（快取 key 含區域；st.region 可強制指定）；字盾騎士 st.letter＝盾上字母（沒給畫書）；
   魔王腳邊護甲標（TG.ENEMIES[type].armor>0，st.noBadge 關閉）；英雄閒置 4 幀呼吸＋st.attack 揮砍弧光；召喚獸 st.spawnT 0~1 登場光；ART.icon 塔依實際外型縮放。 */
(function (root) {
  "use strict";
  const ART = root.ART = root.ART || {};
  const PI = Math.PI, PI2 = PI * 2;
  let c = null;        // 目前畫布（離屏或主畫布）
  let NOFX = false;    // true＝只畫本體（不畫影子／發光），做閃白、凍結剪影用

  // ═════ 主題（樣稿 B，描邊 0.95→1.14；地面調亮一階）
  const T = {
    ol: "#0c1122", olw: 1.14, lightLeft: false, night: true, region: 1,
    grass: ["#325a51", "#1d3537"], patchL: "rgba(100,165,125,.24)", patchD: "rgba(4,10,20,.26)", tuft: "#56886f", tuft2: "#41695a",
    roadShadow: "rgba(0,0,0,.42)", roadEdge: "#3a2e1e", roadFill: "#c8b488", roadCenter: "rgba(240,228,194,.36)", pebble: "#b29c6a", pebble2: "#d6c396", pebbleOl: "rgba(50,36,18,.55)", cobble: true,
    verge: "#4a7a62", verge2: "#386654",
    water: "#4a9cc4", waterDeep: "#1d4a6e", waterLight: "rgba(220,240,255,.7)", lily: "#3f7a58", lotus: "#f0d2a1", reed: "#4a6a50", reedTop: "#8a6a4a",
    wood: "#8a6a48", woodLight: "#ad8a5e", woodDark: "#4a3624", rope: "#cdb080",
    trunk: "#4a3428", leaf: [["#5a9a76", "#2e5c4a"], ["#68a67e", "#356a54"]], pine: [["#5aa78a", "#24504a"], ["#68b494", "#2c5c52"], ["#4f9880", "#1f4640"]], pineRatio: .72, fruit: null, berry: "#c49ad8",
    rock: ["#9aaaba", "#647488", "#3c4858"], facetRock: true, moss: "#4f7a5a",
    flowers: ["#a8dcff", "#cdb4ff", "#f3d494"], flowerCenter: "#fff6c8", flowerGlow: "rgba(160,210,255,A)",
    mushCap: "#a676c0", mushStem: "#d8cfe6", mushDot: "#f3d494", mushGlow: "rgba(200,140,240,A)",
    chasm: ["#0d1222", "#020309"], chasmLight: "rgba(160,190,255,.18)", cliff: ["#4c586c", "#2a3242"], cliffRim: "#9aaac0", caveMouth: ["#000000", "#161b2c"], mist: "rgba(180,110,240,.20)", mistDeep: "rgba(70,24,110,.6)", warnFlag: "#c8455a", thorn: "#5a3266", darkTrunk: "#2a2024", darkLeaf: ["#15292c", "#0f1f23"], signInk: "#2a1a10",
    stone: ["#c4ccd6", "#8e9aaa", "#58637a"], stoneTop: "#dfe5ec", stoneLine: "rgba(10,15,30,.45)", plank: ["#a07e58", "#7a5c3e", "#4e3a28"], plankTop: "#b89874",
    gold: "#E1B86A", goldL: "#F3D494", slit: "#0c1122", roofA: ["#5583c6", "#335d9a", "#1d355e"], roofLine: "rgba(0,0,0,.35)", bannerA: "#9e3a4a", flagRed: "#d0506a",
    archerCloth: "#3f6e5c", archerHood: "#2c5a48", skin: "#f0c8a0",
    mageStone: ["#a898d0", "#71619e", "#463a6e"], mageStoneTop: "#bcafde", mageRoof: ["#6a58b0", "#45368a", "#261c52"], orb: ["#ffffff", "#dcc2ff", "#8a5cff"], orbGlow: "rgba(170,130,255,A)", windowLit: "#ffd68a", crystalMage: "#8af0ff", rune: "#c8a8ff", runeGlow: "rgba(150,110,255,A)",
    ice: ["#effcff", "#7fc6ea"], iceGlow: "rgba(120,200,255,A)", frost: "rgba(190,230,255,.55)", iceSpark: "#effcff",
    sandbag: "#b8a074", iron: ["#8a94a4", "#4d5664", "#2a3038"], bronze: ["#f7ce83", "#c8924a", "#8a5a28"], bannerC: "#c8603a",
    slotFill: "rgba(225,184,106,.10)", slotRim: "#E1B86A", slotStone: "#64748a", slotPlus: "#F3D494",
    eyeWhite: "#fff2c8", pupil: "#120a1e", enemyEye: "#ffcf5a", eyeGlow: "rgba(255,200,90,A)", enemyGlow: "rgba(220,90,255,A)",
    slime: ["#f2a8ff", "#c65ae8", "#7a2aa8"], batWing: ["#7a46ae", "#3a1c62"], batVein: "rgba(255,255,255,.22)", batBody: "#52307e", golem: ["#aaa6bc", "#7a7690", "#4c4864"], rune2: "#ff6ae6", armorIcon: "#b8c6d8",
    hpBg: "#0c1122", hpEnemy: "#ff5b6b", hpBoss: "#ff4a7a", hpAlly: "#6ac8ff",
    bossAura: "rgba(255,190,90,A)", bossRingFill: "rgba(225,184,106,.32)", bossRing: "#f7ce83", bark: ["#7a5c50", "#4e3834", "#2c1e22"], barkLine: "rgba(0,0,0,.5)", bossLeaf: ["#7656aa", "#46327a"], bossBloom: "#ff9ae0", bossEye: "#ffcf5a", bossMouth: "#0a0610", clockFace: "#f0e2c0", bossPlate: "#1B3545", bossPlateText: "#F3D494",
    allyRing: "#6ac8ff", allyRingFill: "rgba(106,200,255,.18)", cape: "#2c4f86", armor: ["#eef2f6", "#aab8c8", "#6a7a8e"], blade: "#e8f0f8", plume: "#d0506a", shield: "#2c4f86",
    wall: ["#aeb8c2", "#7c8898", "#4f5a6a"], wallTopC: "#ccd4dc", crack: "#141420", plaque: "#1B3545", plaqueText: "#F3D494", hpWall: "#ff6b7a", hpEmpty: "rgba(255,255,255,.12)", gateDark: "#05070e", portcullis: "#b08e5a", crest: "#2c4f86", roofC: ["#5a88c8", "#2c4f86", "#1a3360"], castleFlag: "#E1B86A", castleBanner: "#2c4f86",
    windowGlow: "rgba(255,200,110,A)", torch: "rgba(255,170,70,A)", torchCore: "#ffe2a0", firefly: "rgba(255,236,150,A)",
    orbTrail: "rgba(170,130,255,.6)", iceBeam: "#9bd8ff", smokeRGB: "200,205,215", hitCol: "#f7ce83", dmgCol: "#fff2c8", frozenTint: "rgba(160,215,255,.42)",
    rangeFill: "rgba(225,184,106,.10)", rangeLine: "rgba(243,212,148,.85)",
    wildTint: "rgba(40,14,60,.55)", homeTint: "rgba(255,200,120,.10)",
    shadowRGB: "0,0,10", shadowA: .42, labels: true, labelHalo: "rgba(12,17,34,.9)", labelInk: "#F3D494", labelFamily: "'Noto Serif TC','PMingLiU','MingLiU',serif", labelFont: "900", vignette: "rgba(4,7,18,.5)",
    accent: "#3f9c7f",
    // ── 精靈專用（第一刀新增）
    snipeBanner: "#b8303e", repBanner: "#2f7a54", tesla: ["#d6e0ee", "#7a8cac", "#3c4a6c"], copper: ["#f6c080", "#c0763a", "#6a3a1a"], spark: "#fff6a8", sparkGlow: "rgba(255,236,110,A)",
    arcane: ["#ffc8f6", "#d064e4", "#6a2490"], arcaneGlow: "rgba(255,120,235,A)", deepIce: ["#dcfbff", "#52bce4", "#1a5a90"], cloud: ["#ffffff", "#d4e6f6", "#8aa8c8"],
    rocket: ["#f6efe0", "#cfc2a8", "#8e8068"], nose: "#d84a50", mineCol: ["#7a8478", "#454e44", "#22281f"], hazard: "#f2c440", blink: "#ff4a3a",
    eliteArmor: ["#a090d0", "#62509a", "#33285a"], eliteShield: ["#eef3f8", "#b4c0d0", "#6e7c90"], plumeE: "#d04a6e",
    gob: ["#bcd482", "#7e9e4c", "#46602c"], gobCloth: "#6e4a92", sign: "#efe0b8",
    split: ["#d8d0ff", "#8e80f6", "#4434b0"], mini: ["#ffdcff", "#e890f6", "#a448ca"], frog: ["#b0ee8e", "#5aac4a", "#2e6a2a"],
    imp: ["#a482da", "#62409e", "#321e5c"], assassin: ["#585078", "#2c2744", "#120f1e"], scarf: "#a43ae0",
    robe: ["#f6f0ff", "#cec2ea", "#8a7cb0"], robeTrim: "#7a4ab8", healGlow: "rgba(150,255,170,A)", heal: "#a8ffb8",
    drag: ["#b48ced", "#6c46ac", "#341c60"], dragBelly: ["#f4dcaa", "#c8a060"], dragWing: ["#8a56c8", "#3a1c6a"], fireGlow: "rgba(255,140,60,A)",
    giant: ["#ccc0aa", "#8e826e", "#4e4638"], giantRune: "#ffb04a", giantGlow: "rgba(255,170,70,A)",
    hyd: ["#8cd6ac", "#3e8068", "#1e4038"], hydBelly: "#dfe6a6", lich: ["#6e7cbc", "#323a70", "#161c40"], bone: ["#f6f8fa", "#c4cad6"], soul: "#7ae8ff", soulGlow: "rgba(120,230,255,A)",
    dk: ["#9a3a48", "#4a1420", "#1c060c"], dkBelly: ["#ffb070", "#c0603a"], dkWing: ["#6a1e2c", "#24060e"], dkCrack: "#ff8a3a", dkGlow: "rgba(255,110,40,A)",
    elfCloak: ["#5ac888", "#2e8a5a", "#1a5a38"], hair: "#f4d47a", mageRobe: ["#8ad4ff", "#3a7ac8", "#1e3e7a"], fur: "#f4f8ff",
    mount: ["#f6a070", "#cc5a3a", "#6a2420"], riderArmor: ["#ffd6aa", "#d0663e", "#7a2a1a"],
    fox: ["#ffb878", "#f0722a", "#a83e14"], flame: ["#fff6b8", "#ffb040", "#ff5a20"], wolf: ["#d2dcee", "#7a8cac", "#3a4664"], boltY: "#fff07a",
    turtle: ["#b0d878", "#5e9a40", "#2e5a24"], shellRock: ["#bcb096", "#827660", "#4a4234"],
    phoenix: ["#effcff", "#8ad8ff", "#3a8ad0"], aurora: ["#9affe8", "#8ad0ff", "#e8a8ff"],
    uni: ["#ffffff", "#e6eaf6", "#a8b0c8"], mane: ["#ffc8ee", "#c4b0ff", "#a0e8ff"], horn: "#f3d494"
  };
  ART.theme = T;

  // 區域配色（第一刀只換主色調；第二刀 art-map 再換地景）
  const REG = [
    { name: "草原", accent: "#5fae6e", grass: ["#43744a", "#284a30"], patchL: "rgba(160,220,120,.24)", patchD: "rgba(10,25,10,.22)", tuft: "#72ac62", tuft2: "#548a4a", verge: "#62a056", verge2: "#4a8446",
      leaf: [["#7cbc68", "#3e7a3a"], ["#8ec874", "#4a8a44"]], pine: [["#6cb87c", "#2e6a40"], ["#7cc488", "#367446"], ["#62aa72", "#28603a"]], water: "#4aa8d0", waterDeep: "#1d5a7e", wildTint: "rgba(30,40,20,.45)" },
    { name: "森林", accent: "#3f9c7f", grass: ["#325a51", "#1d3537"], patchL: "rgba(100,165,125,.24)", patchD: "rgba(4,10,20,.26)", tuft: "#56886f", tuft2: "#41695a", verge: "#4a7a62", verge2: "#386654",
      leaf: [["#5a9a76", "#2e5c4a"], ["#68a67e", "#356a54"]], pine: [["#5aa78a", "#24504a"], ["#68b494", "#2c5c52"], ["#4f9880", "#1f4640"]], water: "#4a9cc4", waterDeep: "#1d4a6e", wildTint: "rgba(40,14,60,.55)" },
    { name: "沼澤", accent: "#8a9a6a", grass: ["#43582e", "#22321c"], patchL: "rgba(180,220,80,.20)", patchD: "rgba(10,20,5,.32)", tuft: "#86a44a", tuft2: "#62803a", verge: "#72923e", verge2: "#567030",
      leaf: [["#90aa56", "#4a6430"], ["#a0ba62", "#566e34"]], pine: [["#7e9e5c", "#3a5030"], ["#8aaa66", "#425a36"], ["#74945a", "#34482c"]], water: "#6e9e4a", waterDeep: "#2e4a22", wildTint: "rgba(40,50,10,.5)" },
    { name: "冰原", accent: "#7fb3d8", grass: ["#5a7690", "#30445c"], patchL: "rgba(235,248,255,.32)", patchD: "rgba(10,20,40,.26)", tuft: "#b0cade", tuft2: "#8eaac4", verge: "#a2bed2", verge2: "#7e9eb8",
      leaf: [["#90bccc", "#4a7a8c"], ["#a0c8d6", "#56869a"]], pine: [["#80acb8", "#2e5a66"], ["#90bac4", "#386672"], ["#749eaa", "#28505c"]], water: "#8ad4f2", waterDeep: "#3a7ab0", wildTint: "rgba(20,30,70,.5)" },
    { name: "火山", accent: "#e0704a", grass: ["#603e36", "#2c1a1c"], patchL: "rgba(255,120,60,.18)", patchD: "rgba(20,5,5,.34)", tuft: "#946048", tuft2: "#704838", verge: "#84503e", verge2: "#643c30",
      leaf: [["#90704e", "#4e3424"], ["#9e7c56", "#5a3c2a"]], pine: [["#6e5e4c", "#3a2a22"], ["#7a6854", "#423026"], ["#64544a", "#34261e"]], water: "#ff7a30", waterDeep: "#a8301a", wildTint: "rgba(60,10,10,.5)" }
  ];
  ART.REGIONS = REG;
  ART.setRegion = function (i) {
    i = Math.max(0, Math.min(REG.length - 1, i | 0));
    const r = REG[i];
    for (const k in r) if (k !== "name") T[k] = Array.isArray(r[k]) ? r[k].map(v => Array.isArray(v) ? v.slice() : v) : r[k];
    T.region = i;
    return T;
  };

  // ═════ 小工具（搬自 art-core.js；roundRect 自己畫，舊手機也能跑）
  const ell = (x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, PI2); };
  const circ = (x, y, r) => ell(x, y, r, r);
  const poly = (pts, close) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (close !== false) c.closePath(); };
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2)); c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function paint(fill, stroke, lw) { if (fill) { c.fillStyle = fill; c.fill(); } if (stroke !== null) { c.strokeStyle = stroke || T.ol; c.lineWidth = lw || T.olw; c.stroke(); } }
  const line = (pts, col, lw) => { poly(pts, false); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };
  // 有外框的粗線（四肢、脖子、樹枝）
  function limb(pts, col, w) { line(pts, T.ol, w + T.olw * 2); line(pts, col, w); }
  const lg = (x1, y1, x2, y2, stops) => { const g = c.createLinearGradient(x1, y1, x2, y2); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const rg = (x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  function shadow(x, y, rx, ry, a) { if (NOFX) return; ell(x, y, rx, ry); c.fillStyle = `rgba(${T.shadowRGB},${a == null ? T.shadowA : a})`; c.fill(); }
  function glow(x, y, r, col, a) { if (NOFX) return; c.save(); c.globalCompositeOperation = "lighter"; circ(x, y, r); c.fillStyle = rg(x, y, 0, r, [col.replace("A", a), col.replace("A", 0)]); c.fill(); c.restore(); }
  function union(shapes, fill, lw) { c.strokeStyle = T.ol; c.lineWidth = (lw || T.olw) * 2; for (const s of shapes) { s(); c.stroke(); } c.fillStyle = fill; for (const s of shapes) { s(); c.fill(); } }
  function cyl(x, y, r, h, side, top) {
    const ry = r * 0.42;
    c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, ry, 0, PI, 0, true); c.lineTo(x + r, y - h); c.closePath();
    paint(side); if (top) { ell(x, y - h, r, ry); paint(top); }
  }
  const sideGrad = (x, r, a, b, d) => lg(x - r, 0, x + r, 0, T.lightLeft ? [a, b, d] : [d, b, a]);
  const sg3 = (x, r, p) => sideGrad(x, r, p[0], p[1], p[2]);
  function star(x, y, r, fill, lw) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, k = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } c.closePath(); paint(fill, null); c.lineWidth = lw || T.olw * 0.8; c.strokeStyle = T.ol; c.stroke(); }
  function banner(x, y, w, h, col, emblem) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h - 2.5); c.lineTo(x - w / 2, y + h); c.closePath(); paint(col); rr(x - w / 2 - 0.8, y - 1, w + 1.6, 1.6, 0.6); paint(T.gold, T.ol, 0.5); if (emblem) emblem(x, y + h * 0.42); }
  // 三角旗：fr 讓旗尾擺動
  function pennant(x, y, h, col, fr) {
    const w = fr ? 1.6 : -0.6;
    c.strokeStyle = T.ol; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
    c.beginPath(); c.moveTo(x, y - h); c.quadraticCurveTo(x + 4, y - h + w, x + 8.5, y - h + 2 + w * 0.6); c.quadraticCurveTo(x + 4, y - h + 3 - w, x, y - h + 4.6); c.closePath(); paint(col, T.ol, 0.7);
  }
  function crystal(x, y, w, h, ang, col) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const pts = [[-w / 2, 0], [-w / 2, -h * 0.72], [0, -h], [w / 2, -h * 0.72], [w / 2, 0]];
    poly(pts); paint(col[1], null);
    poly(T.lightLeft ? [[-w / 2, 0], [-w / 2, -h * 0.72], [0, -h], [0, 0]] : [[0, 0], [0, -h], [w / 2, -h * 0.72], [w / 2, 0]]); paint(col[0], null);
    c.beginPath(); c.moveTo(-w / 4, -h * 0.2); c.lineTo(-w / 4, -h * 0.68); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 0.8; c.stroke();
    poly(pts); paint(null);
    c.restore();
  }
  // 閃電折線（固定亂數，同一 seed 同一形狀）
  function zig(x1, y1, x2, y2, seed, n, amp) {
    let s = seed * 9301 + 49297; const R = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pts = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const k = i / n, o = (R() - 0.5) * 2 * amp; pts.push([x1 + dx * k + nx * o, y1 + dy * k + ny * o]); }
    pts.push([x2, y2]); return pts;
  }
  // 怪物陣營眼：發光黃眼
  function gEyes(x, y, gap, rx, ry, col, gcol) { for (const s of [-1, 1]) { glow(x + s * gap, y, Math.max(2.5, rx * 3), gcol || T.eyeGlow, 0.7); ell(x + s * gap, y, rx, ry); paint(col || T.enemyEye, null); } }
  function eyes(x, y, gap, r, angry) {
    for (const s of [-1, 1]) { ell(x + s * gap, y, r, r * 1.2); paint(T.eyeWhite, T.ol, 0.6); circ(x + s * gap + 0.3, y + 0.3, r * 0.55); paint(T.pupil, null); circ(x + s * gap - r * 0.25, y - r * 0.4, r * 0.25); paint("#fff", null); }
    if (angry) { c.strokeStyle = T.ol; c.lineWidth = 1; c.beginPath(); c.moveTo(x - gap - r, y - r * 1.6); c.lineTo(x - gap + r, y - r * 1.0); c.moveTo(x + gap + r, y - r * 1.6); c.lineTo(x + gap - r, y - r * 1.0); c.stroke(); }
  }
  function armorBadge(x, y) { c.beginPath(); c.moveTo(x, y - 3.2); c.lineTo(x + 3, y - 2.2); c.lineTo(x + 2.6, y + 0.8); c.lineTo(x, y + 2.8); c.lineTo(x - 2.6, y + 0.8); c.lineTo(x - 3, y - 2.2); c.closePath(); paint(T.armorIcon, T.ol, 0.7); c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x, y + 1.6); c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 0.6; c.stroke(); }

  // ═════ 離屏快取
  const cache = new Map(); let cachePx = 0;
  // 上限：一般約 12e6 像素（48MB）；dpr ≥ 3 的手機或記憶體 ≤ 4GB 的裝置降到 6e6（11-22）
  // 淘汰改「最近最少使用」（LRU）：Map 依插入順序，命中時刪掉再放回尾端 → 最前面就是最久沒用的。
  //   原本先進先出，無盡模式第 2 分鐘撞上限後連常用的塔／怪都一直被丟掉重畫。
  const CACHE_MAX = (() => {
    try {
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      const mem = typeof navigator !== "undefined" && navigator.deviceMemory;
      return dpr >= 3 || (mem && mem <= 4) ? 6e6 : 12e6;
    } catch (e) { return 12e6; }
  })();
  function mkCanvas(w, h) {
    if (typeof document !== "undefined" && document.createElement) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    return null;
  }
  function qOf(ctx) { const m = ctx.getTransform ? ctx.getTransform() : null; const s = m ? Math.hypot(m.a, m.b) : 1; return Math.min(4, Math.max(1, Math.ceil(s * 2) / 2)); }
  // box＝{w,h,ox,oy}：邏輯單位；(ox,oy)＝錨點在框內的位置
  function sprite(key, box, q, fn) {
    const k = key + "@" + q;
    let e = cache.get(k);
    if (e) { if (cache.size > 1) { cache.delete(k); cache.set(k, e); } return e; }   // LRU：移到最新
    const W = Math.ceil(box.w * q), Hh = Math.ceil(box.h * q), cv = mkCanvas(W, Hh);
    if (!cv) return null;
    const g = cv.getContext("2d"), pc = c, pn = NOFX;
    g.setTransform(q, 0, 0, q, box.ox * q, box.oy * q); g.lineJoin = "round"; g.lineCap = "round";
    c = g;
    try { fn(g, cv); } finally { c = pc; NOFX = pn; }
    e = { cv, box }; cache.set(k, e); cachePx += W * Hh;
    while (cachePx > CACHE_MAX && cache.size > 1) { const it = cache.entries().next().value; if (it[0] === k) break; cache.delete(it[0]); cachePx -= it[1].cv.width * it[1].cv.height; }
    return e;
  }
  // 剪影上色（閃白／凍結／暗化）：用不含影子與光暈的本體版本
  function tinted(key, box, q, fn, col) {
    return sprite(key + "|tint" + col, box, q, (g, cv) => {
      const base = sprite(key + "|nofx", box, q, () => { NOFX = true; fn(); });
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(base.cv, 0, 0);
      g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
    });
  }
  function blit(ctx, e, x, y, mirror, alpha) {
    if (!e) return;
    const b = e.box;
    if (alpha != null && alpha < 1) { if (alpha <= 0) return; ctx.globalAlpha = alpha; }
    if (mirror) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(e.cv, -b.ox, -b.oy, b.w, b.h); ctx.restore(); }
    else ctx.drawImage(e.cv, x - b.ox, y - b.oy, b.w, b.h);
    if (alpha != null && alpha < 1) ctx.globalAlpha = 1;
  }
  ART.clearCache = () => { cache.clear(); cachePx = 0; };
  ART.cacheInfo = () => ({ n: cache.size, px: cachePx, max: CACHE_MAX });

  // ═════════════════════════════ 塔 ═════════════════════════════
  // 錨點＝塔位中心；1–2 木造、3 石塔加屋頂、4–6 依分支換整個輪廓；5、6 級更高、更亮、多裝飾。
  function plinth(x, y, lv) {
    shadow(x + 1.5, y + 2.5, 15, 6);
    if (lv >= 3) { cyl(x, y + 2, 13.5, 5.5, sg3(x, 13.5, T.stone), T.stoneTop); ell(x, y - 3.5, 13.5, 5.67); c.strokeStyle = T.gold; c.lineWidth = 1.1; c.stroke(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 5.2, y - 0.8 + Math.abs(i) * -0.5 + 3); c.lineTo(x + i * 5.2, y + 6.5 - Math.abs(i) * 0.8); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); } }
    else { cyl(x, y + 2, 12, 4, sg3(x, 12, T.plank), T.plankTop); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x - 9, y - 2 + i * 1.9); c.lineTo(x + 9, y - 2 + i * 1.9); c.strokeStyle = T.woodDark; c.lineWidth = 0.4; c.stroke(); } }
  }
  // 4–6 級底座：兩層石台＋分支色飾環；5 級金鉚釘；6 級金色光環
  function plinthHi(x, y, lv, acc) {
    if (lv >= 6 && !NOFX) { ell(x, y + 3, 21, 8.6); c.fillStyle = rg(x, y + 3, 3, 21, ["rgba(255,214,120,.55)", "rgba(255,214,120,0)"]); c.fill(); ell(x, y + 3, 19, 7.8); c.strokeStyle = "rgba(247,206,131,.9)"; c.lineWidth = 0.9; c.setLineDash([2.4, 2]); c.stroke(); c.setLineDash([]); }
    shadow(x + 1.5, y + 3.5, 16.5, 6.5);
    cyl(x, y + 5, 15, 3.4, sg3(x, 15, T.stone), T.stoneTop);
    cyl(x, y + 1.6, 13, 5.4, sg3(x, 13, T.stone), T.stoneTop);
    ell(x, y - 3.8, 13, 5.46); c.strokeStyle = acc; c.lineWidth = 1.5; c.stroke();
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 5, y - 0.6 - Math.abs(i) * 0.4 + 2.4); c.lineTo(x + i * 5, y + 7 - Math.abs(i) * 0.9); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
    if (lv >= 5) for (let i = -2; i <= 2; i++) { circ(x + i * 5.4, y + 2.4 + (2 - Math.abs(i)) * 0.9, 0.95); paint(T.gold, T.ol, 0.4); }
    return y - 3.8;
  }
  function lvStars(x, y, lv) {
    const K = ART.textK || 1, r = (lv >= 5 ? 2.8 : 2.6) * K, gap = (lv >= 5 ? 5.6 : 6) * K;   // 11-25：手機直拿 ART.textK=1.3（index resize() 設定，變了會清快取）
    for (let i = 0; i < lv; i++) { const sx = x + (i - (lv - 1) / 2) * gap; if (lv >= 6) glow(sx, y + 10.5, 4.5, T.bossAura, 0.5); star(sx, y + 10.5, r, lv >= 4 ? T.goldL : T.gold, 0.9); }
  }
  function fireGlow(x, y, r, col) { glow(x, y, r, col || T.bossAura, 0.85); circ(x, y, r * 0.22); paint("#fff8e0", null); }

  // ───── 弓箭塔
  function towerArrow(x, y, lv, br, fr, fire) {
    if (lv >= 4) return br === "B" ? arrowRepeater(x, y, lv, fr, fire) : arrowSniper(x, y, lv, fr, fire);
    plinth(x, y, lv); const b = y - (lv >= 3 ? 3.5 : 2);
    if (lv < 3) {
      c.lineCap = "round";
      for (const dx of [-5, 5]) { c.strokeStyle = T.ol; c.lineWidth = 2.8; c.beginPath(); c.moveTo(x + dx, b - 2); c.lineTo(x + dx * 0.9, b - 15); c.stroke(); c.strokeStyle = T.woodDark; c.lineWidth = 1.3; c.stroke(); }
      for (const dx of [-7.5, 7.5]) { c.strokeStyle = T.ol; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x + dx, b + 1); c.lineTo(x + dx * 0.88, b - 14); c.stroke(); c.strokeStyle = T.wood; c.lineWidth = 1.8; c.stroke(); }
      c.strokeStyle = T.woodDark; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - 7, b - 1); c.lineTo(x + 6.5, b - 12); c.moveTo(x + 7, b - 1); c.lineTo(x - 6.5, b - 12); c.stroke();
      rr(x - 10, b - 18, 20, 5, 1.2); paint(sideGrad(x, 10, T.woodLight, T.wood, T.woodDark));
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 2.8, b - 18); c.lineTo(x + i * 2.8, b - 13); c.strokeStyle = T.woodDark; c.lineWidth = 0.4; c.stroke(); }
      if (lv === 2) { // 2 級：布篷＋第二面旗
        for (const dx of [-8.5, 8.5]) limb([[x + dx, b - 17], [x + dx, b - 31]], T.woodDark, 1.1);
        poly([[x - 12, b - 29], [x, b - 37], [x + 12, b - 29], [x + 9, b - 27.5], [x + 4.5, b - 29], [x, b - 27.5], [x - 4.5, b - 29], [x - 9, b - 27.5]]); paint(lg(x, b - 37, x, b - 28, ["#e86a7e", T.bannerA]));
        c.beginPath(); c.moveTo(x, b - 37); c.lineTo(x - 4.5, b - 29); c.moveTo(x, b - 37); c.lineTo(x + 4.5, b - 29); c.strokeStyle = "rgba(255,240,220,.55)"; c.lineWidth = 0.7; c.stroke();
        pennant(x - 10, b - 15, 7, T.gold, !fr);
      }
      // 小弓手（開火：拉滿弓）
      ell(x - 0.5, b - 19.5, 3.6, 2.4); paint(T.archerCloth);
      circ(x - 0.5, b - 23, 2.6); paint(T.skin); c.beginPath(); c.arc(x - 0.5, b - 23.4, 2.9, PI * 1.05, PI * 1.95); c.lineTo(x - 0.5, b - 27.5); c.closePath(); paint(T.archerHood);
      const bw = fire ? 5.4 : 4.5;
      c.beginPath(); c.arc(x + 3.5, b - 21.5, bw, -1.2, 1.2); c.strokeStyle = T.ol; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = T.woodLight; c.lineWidth = 1; c.stroke();
      if (fire) { c.beginPath(); c.moveTo(x + 3.5 + Math.cos(-1.2) * bw, b - 21.5 + Math.sin(-1.2) * bw); c.lineTo(x + 1, b - 21.5); c.lineTo(x + 3.5 + Math.cos(1.2) * bw, b - 21.5 + Math.sin(1.2) * bw); c.strokeStyle = "#eee"; c.lineWidth = 0.5; c.stroke(); fireGlow(x + 9.5, b - 21.5, 6); }
      pennant(x + 9, b - 16, 9, T.flagRed, fr);
    } else {
      cyl(x, b, 10, 21, sg3(x, 10, T.stone), null);
      for (let r = 1; r < 5; r++) { c.beginPath(); c.moveTo(x - 10, b - r * 4.4); c.lineTo(x + 10, b - r * 4.4); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); for (let k = -1; k <= 1; k++) { const xx = x + k * 6 + (r % 2) * 3; c.beginPath(); c.moveTo(xx, b - r * 4.4); c.lineTo(xx, b - r * 4.4 + 4.4); c.stroke(); } }
      rr(x - 1.3, b - 15, 2.6, 6, 1.3); paint(fire ? T.windowLit : T.slit, null);
      cyl(x, b - 20, 12, 3.5, sg3(x, 12, T.stone), T.stoneTop);
      for (let k = -2; k <= 2; k++) { rr(x + k * 4.8 - 1.7, b - 27.5 + Math.abs(k) * 0.6, 3.4, 4, 0.6); paint(T.stone[1]); }
      poly([[x - 12.5, b - 25], [x, b - 46], [x + 12.5, b - 25]]); paint(sg3(x, 12.5, T.roofA));
      c.beginPath(); c.ellipse(x, b - 25, 12.5, 4, 0, 0, PI); paint(T.roofA[2]);
      for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - 12.5 + k * 2.6, b - 25 - k * 4.6 + 2); c.quadraticCurveTo(x, b - 25 - k * 4.6 + 5.5, x + 12.5 - k * 2.6, b - 25 - k * 4.6 + 2); c.strokeStyle = T.roofLine; c.lineWidth = 0.6; c.stroke(); }
      pennant(x, b - 46, 7, T.gold, fr);
      banner(x - 5.5, b - 18, 6, 10, T.bannerA, (bx, by) => { c.strokeStyle = T.gold; c.lineWidth = 0.9; c.beginPath(); c.moveTo(bx, by - 2.5); c.lineTo(bx, by + 2.5); c.moveTo(bx - 1.5, by - 1); c.lineTo(bx, by - 2.6); c.lineTo(bx + 1.5, by - 1); c.stroke(); });
      glow(x - 1, b - 12, 7, T.windowGlow, fire ? 0.8 : 0.35);
      if (fire) fireGlow(x, b - 12, 8);
    }
  }
  // 狙擊塔：細高石尖塔＋瞭望台＋長弩、紅白靶旗（剪影＝高瘦針）
  function arrowSniper(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.snipeBanner), H = 30 + k * 5;
    c.beginPath(); c.moveTo(x - 7.5, b); c.lineTo(x - 5, b - H); c.lineTo(x + 5, b - H); c.lineTo(x + 7.5, b); c.ellipse(x, b, 7.5, 3.1, 0, 0, PI); c.closePath(); paint(sg3(x, 7.5, T.stone));
    for (let r = 1; r * 5 < H - 2; r++) { const w = 7.5 - 2.5 * (r * 5 / H); c.beginPath(); c.moveTo(x - w, b - r * 5); c.lineTo(x + w, b - r * 5); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); const xx = x + ((r % 2) ? -2 : 2); c.beginPath(); c.moveTo(xx, b - r * 5); c.lineTo(xx, b - r * 5 + 5); c.stroke(); }
    rr(x - 6.6, b - H * 0.45 - 1.5, 13.2, 3, 0.8); paint(T.snipeBanner, T.ol, 0.6);
    rr(x - 1.1, b - H * 0.7 - 3, 2.2, 5, 1.1); paint(fire ? T.windowLit : T.slit, null);
    // 靶旗
    banner(x - 4.8, b - H + 3, 7.5, 12 + k, T.snipeBanner, (bx, by) => { circ(bx, by, 2.6); paint("#fff4e8", T.ol, 0.5); circ(bx, by, 1.4); paint(T.snipeBanner, null); circ(bx, by, 0.5); paint("#fff4e8", null); });
    // 瞭望台
    const p = b - H; cyl(x, p, 10.5, 3, sideGrad(x, 10.5, T.woodLight, T.wood, T.woodDark), T.plankTop);
    for (const dx of [-8.5, -3, 3, 8.5]) limb([[x + dx, p - 1], [x + dx, p - 5.5]], T.wood, 0.9);
    c.beginPath(); c.ellipse(x, p - 5.2, 9.5, 3.4, 0, PI * 0.05, PI * 0.95); c.strokeStyle = T.ol; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = T.woodLight; c.lineWidth = 1; c.stroke();
    // 射手（兜帽）
    ell(x + 3, p - 6, 3.4, 2.6); paint(T.archerCloth); circ(x + 3, p - 9.5, 2.4); paint(T.skin);
    c.beginPath(); c.arc(x + 3, p - 9.8, 2.7, PI * 1.05, PI * 1.95); c.lineTo(x + 3.5, p - 13.8); c.closePath(); paint(T.archerHood);
    // 長弩（朝左上；開火時後座）
    c.save(); c.translate(x + 1.5 + (fire ? 1.4 : 0), p - 8 + (fire ? 0.8 : 0)); c.rotate(-0.38);
    rr(-18, -1.4, 23, 2.8, 1); paint(sideGrad(0, 3, T.woodLight, T.wood, T.woodDark));
    rr(-8, -4.2, 7.5, 2.2, 1); paint(T.iron[1], T.ol, 0.6); circ(-8, -3.1, 1.1); paint(k >= 1 ? "#bff0ff" : "#8ab4d0", T.ol, 0.4);
    c.beginPath(); c.moveTo(-14.5, -7); c.quadraticCurveTo(-18.5, 0, -14.5, 7); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = k >= 2 ? T.gold : T.woodDark; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.moveTo(-14.5, -7); c.lineTo(fire ? -15.5 : -10, 0); c.lineTo(-14.5, 7); c.strokeStyle = "#e8e0d0"; c.lineWidth = 0.5; c.stroke();
    poly([[-21, 0], [-18, -1.3], [-18, 1.3]]); paint("#eef4f8", T.ol, 0.5);
    if (fire) fireGlow(-22, 0, 7);
    if (k >= 1) glow(-8, -3.1, 4, T.iceGlow, 0.8);
    c.restore();
    // 塔尖旗
    pennant(x - 5, p - 2, 13 + k * 2, T.flagRed, fr);
    if (k >= 2) { star(x - 5, p - 16 - k * 2, 2.2, T.goldL); glow(x - 5, p - 16 - k * 2, 6, T.bossAura, 0.6); }
  }
  // 連弩塔：寬矮八角木石堡＋三（六級五）把扇形連弩、綠旗（剪影＝寬扇形）
  function arrowRepeater(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.repBanner), h = 11 + k * 2.5;
    cyl(x, b, 13, h, sg3(x, 13, T.stone), null);
    for (let r = 1; r * 4 < h; r++) { c.beginPath(); c.moveTo(x - 13, b - r * 4); c.lineTo(x + 13, b - r * 4); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
    for (const dx of [-7, 0, 7]) { rr(x + dx - 1, b - h + 3, 2, 4.5, 1); paint(fire ? T.windowLit : T.slit, null); }
    const tp = b - h;
    cyl(x, tp, 14.5, 3, sideGrad(x, 14.5, T.woodLight, T.wood, T.woodDark), T.plankTop);
    for (let i = -3; i <= 3; i++) { rr(x + i * 4 - 1.2, tp - 6.4 + Math.abs(i) * 0.5, 2.4, 4, 0.5); paint(T.wood, T.ol, 0.6); }
    // 綠旗（兩側）
    for (const s of [-1, 1]) banner(x + s * 9, b - h + 6, 5.5, 9 + k, T.repBanner, (bx, by) => { c.strokeStyle = T.goldL; c.lineWidth = 0.7; c.beginPath(); for (const a of [-0.5, 0, 0.5]) { c.moveTo(bx, by + 2.2); c.lineTo(bx + Math.sin(a) * 3, by - 2.2 + Math.abs(a)); } c.stroke(); });
    // 轉台
    rr(x - 6, tp - 9, 12, 6, 2); paint(sg3(x, 6, T.iron));
    const n = k >= 2 ? 5 : 3, spread = k >= 2 ? 0.42 : 0.55;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread;
      c.save(); c.translate(x, tp - 7); c.rotate(a); if (fire) c.translate(0, 1.2);
      rr(-1.4, -15, 2.8, 14, 1); paint(sideGrad(0, 1.4, T.woodLight, T.wood, T.woodDark));
      c.beginPath(); c.moveTo(-6, -10.5); c.quadraticCurveTo(0, -15.5, 6, -10.5); c.strokeStyle = T.ol; c.lineWidth = 2.5; c.stroke(); c.strokeStyle = k >= 2 ? T.gold : T.woodDark; c.lineWidth = 1.1; c.stroke();
      c.beginPath(); c.moveTo(-6, -10.5); c.lineTo(0, fire ? -9 : -11.5); c.lineTo(6, -10.5); c.strokeStyle = "#e8e0d0"; c.lineWidth = 0.5; c.stroke();
      if (!fire) { poly([[0, -19], [-1.2, -16], [1.2, -16]]); paint("#eef4f8", T.ol, 0.5); }
      else fireGlow(0, -18, 5);
      c.restore();
    }
    if (k >= 1) for (const s of [-1, 1]) { rr(x + s * 11 - 1.8, tp - 8, 3.6, 6, 1); paint(T.woodDark, T.ol, 0.6); for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo(x + s * 11 - 1 + j, tp - 8); c.lineTo(x + s * 11 - 1 + j, tp - 10.5); c.strokeStyle = T.flagRed; c.lineWidth = 0.8; c.stroke(); } }
    pennant(x + 12, tp - 2, 10 + k * 2, T.repBanner, fr);
  }

  // ───── 魔法塔
  function towerMage(x, y, lv, br, fr, fire) {
    if (lv >= 4) return br === "B" ? mageArcane(x, y, lv, fr, fire) : mageThunder(x, y, lv, fr, fire);
    if (lv >= 3 && !NOFX) { ell(x, y + 2, 18, 7.5); c.setLineDash([2, 2]); c.strokeStyle = T.rune; c.lineWidth = 1; c.stroke(); c.setLineDash([]); glow(x, y + 2, 18, T.runeGlow, 0.25); }
    plinth(x, y, lv); const b = y - (lv >= 3 ? 3.5 : 2);
    if (lv < 3) {
      cyl(x, b, 6.5, 9, sg3(x, 6.5, T.mageStone), T.mageStoneTop);
      for (const a of [-1, 1]) { poly([[x + a * 4, b - 9], [x + a * 7, b - 15], [x + a * 2.5, b - 11]]); paint(T.mageStone[1]); }
      const oy = b - 18 - (fr ? 0.8 : 0);
      glow(x, oy, 10, T.orbGlow, fire ? 0.95 : 0.55);
      circ(x, oy, 4.6); paint(rg(x - 1.4, oy - 1.4, 0.5, 5, T.orb));
      circ(x - 1.6, oy - 1.8, 1.2); paint("rgba(255,255,255,.85)", null);
      if (lv === 2) { // 2 級：符文環＋兩顆浮石
        ell(x, oy, 9, 3, -0.2); c.strokeStyle = T.gold; c.lineWidth = 0.9; c.setLineDash([2, 1.6]); c.stroke(); c.setLineDash([]);
        for (const s of [-1, 1]) { const sx = x + s * 9, sy = oy + (fr ? s : -s) * 1.5 + 4; poly([[sx - 2, sy], [sx, sy - 2.6], [sx + 2, sy], [sx, sy + 1.6]]); paint(T.mageStone[0], T.ol, 0.6); glow(sx, sy, 4, T.orbGlow, 0.5); }
      }
      if (fire) fireGlow(x, oy, 9, T.orbGlow);
    } else {
      cyl(x, b, 10.5, 5, sg3(x, 10.5, T.mageStone), T.mageStoneTop);
      c.beginPath(); c.moveTo(x - 8.5, b - 5); c.lineTo(x - 6, b - 28); c.lineTo(x + 6, b - 28); c.lineTo(x + 8.5, b - 5); c.ellipse(x, b - 5, 8.5, 3.5, 0, 0, PI); c.closePath();
      paint(sg3(x, 8.5, T.mageStone));
      for (const yy of [-11, -20]) { c.beginPath(); c.ellipse(x, b + yy, 7.4 + yy * 0.06, 2.6, 0, 0, PI); c.strokeStyle = T.gold; c.lineWidth = 1.1; c.stroke(); }
      c.beginPath(); c.moveTo(x - 2, b - 13); c.lineTo(x - 2, b - 17); c.quadraticCurveTo(x, b - 20.5, x + 2, b - 17); c.lineTo(x + 2, b - 13); c.closePath(); paint(T.windowLit, T.ol, 0.6);
      glow(x, b - 16, 6, T.orbGlow, fire ? 0.9 : 0.45);
      ell(x, b - 28, 9.5, 3.4); paint(T.gold);
      c.beginPath(); c.moveTo(x - 10, b - 28.5); c.quadraticCurveTo(x - 4, b - 38, x - 1, b - 46); c.quadraticCurveTo(x + 3, b - 52, x + 8, b - 51); c.quadraticCurveTo(x + 3, b - 47, x + 4, b - 40); c.quadraticCurveTo(x + 6, b - 33, x + 10, b - 28.5); c.quadraticCurveTo(x, b - 25.5, x - 10, b - 28.5); c.closePath();
      paint(sg3(x, 10, T.mageRoof));
      star(x - 2, b - 34, 1.6, T.gold); star(x + 3.5, b - 40, 1.2, T.gold);
      const cy = b - 34 + (fr ? -1 : 0);
      glow(x + 14, cy, 7, T.orbGlow, 0.55);
      poly([[x + 14, cy - 5], [x + 16.5, cy], [x + 14, cy + 5], [x + 11.5, cy]]); paint(T.crystalMage);
      poly([[x + 14, cy - 5], [x + 14, cy + 5], [x + 11.5, cy]]); paint("rgba(255,255,255,.35)", null);
      glow(x - 13, b - 20, 4, T.orbGlow, 0.5); circ(x - 13, b - 20 + (fr ? 1 : 0), 1.5); paint(T.orb[0], null);
      if (fire) fireGlow(x + 14, cy, 9, T.orbGlow);
    }
  }
  // 雷電塔：鐵芯＋銅線圈＋頂端電球、四周電弧（剪影＝線圈尖柱＋發光球）
  function mageThunder(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.spark), H = 27 + 4 * k;
    cyl(x, b, 10, 7, sg3(x, 10, T.mageStone), T.mageStoneTop);
    banner(x - 5, b - 6, 5, 8, "#24345a", (bx, by) => { poly([[bx + 0.6, by - 3], [bx - 1.6, by + 0.4], [bx, by + 0.4], [bx - 0.8, by + 3], [bx + 1.8, by - 0.6], [bx + 0.2, by - 0.6]]); paint(T.spark, null); });
    poly([[x - 3.2, b - 7], [x - 1.4, b - 7 - H], [x + 1.4, b - 7 - H], [x + 3.2, b - 7]]); paint(sg3(x, 3.2, T.tesla));
    const nR = 3 + (k >= 1 ? 1 : 0);
    for (let i = 0; i < nR; i++) { const ry = b - 11 - i * (H - 8) / nR, rx = 9 - i * 1.6; ell(x, ry, rx, rx * 0.34); paint(sg3(x, rx, T.copper)); c.beginPath(); c.ellipse(x, ry - 0.4, rx * 0.8, rx * 0.22, 0, PI, 0); c.strokeStyle = "rgba(255,240,210,.7)"; c.lineWidth = 0.6; c.stroke(); }
    if (k >= 1) for (const s of [-1, 1]) { limb([[x + s * 8, b - 6], [x + s * 11, b - 20]], T.tesla[1], 1.3); circ(x + s * 11, b - 21, 1.8); paint(T.spark, T.ol, 0.6); glow(x + s * 11, b - 21, 5, T.sparkGlow, 0.7); }
    const sy = b - 9 - H, sr = 4.8 + k * 0.6;
    glow(x, sy, 13 + k * 3, T.sparkGlow, fire ? 1 : 0.7);
    circ(x, sy, sr); paint(rg(x - 1.2, sy - 1.2, 0.5, sr, ["#ffffff", T.spark, "#e0a030"]));
    if (!NOFX) {
      const arcs = fr ? [[-12, 6], [10, 9], [3, -10]] : [[-9, -8], [12, 2], [-4, 11]];
      for (let i = 0; i < arcs.length + (fire ? 2 : 0); i++) { const [dx, dy] = arcs[i % arcs.length]; const pts = zig(x, sy, x + dx * (fire ? 1.3 : 1), sy + dy * (fire ? 1.3 : 1), i + fr * 7, 4, 2.2); line(pts, "rgba(255,250,200,.95)", 0.9); }
    }
    if (k >= 2) { // 六級：頭頂小雷雲
      union([() => circ(x - 6, sy - 9, 4), () => circ(x + 1, sy - 11, 5), () => circ(x + 7, sy - 8.5, 3.6)], "#3a4466");
      circ(x, sy - 12.5, 2.4); paint("rgba(255,255,255,.25)", null);
    }
  }
  // 奧術塔：漂浮的三段塔身＋巨大品紅水晶＋環繞符文環（剪影＝斷開的浮空塔）
  function mageArcane(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.arcane[1]), bob = fr ? -1 : 0;
    if (!NOFX) { ell(x, y + 2, 19, 7.8); c.setLineDash([2.2, 1.8]); c.strokeStyle = T.arcane[0]; c.lineWidth = 0.9; c.stroke(); c.setLineDash([]); glow(x, y + 2, 19, T.arcaneGlow, 0.25); }
    cyl(x, b, 9, 5, sg3(x, 9, T.mageStone), T.mageStoneTop);
    // 浮空中段（八角柱）
    const my = b - 9 + bob, mh = 11 + k * 2;
    c.beginPath(); c.moveTo(x - 7, my); c.lineTo(x - 7, my - mh); c.lineTo(x - 3.5, my - mh - 2.4); c.lineTo(x + 3.5, my - mh - 2.4); c.lineTo(x + 7, my - mh); c.lineTo(x + 7, my); c.lineTo(x + 3.5, my + 2.4); c.lineTo(x - 3.5, my + 2.4); c.closePath(); paint(sg3(x, 7, T.mageStone));
    poly([[x - 7, my - mh], [x - 3.5, my - mh - 2.4], [x + 3.5, my - mh - 2.4], [x + 7, my - mh], [x + 3.5, my - mh + 2.4], [x - 3.5, my - mh + 2.4]]); paint(T.mageStoneTop);
    circ(x, my - mh / 2, 2.8); c.strokeStyle = T.gold; c.lineWidth = 0.9; c.stroke(); poly([[x, my - mh / 2 - 2.2], [x + 1.9, my - mh / 2 + 1.2], [x - 1.9, my - mh / 2 + 1.2]]); c.stroke();
    glow(x, my - mh / 2, 6, T.arcaneGlow, 0.5);
    for (const s of [-1, 1]) { const sx = x + s * 11, sy = my - 4 - (fr ? s : -s) * 1.5; poly([[sx - 2.2, sy], [sx, sy - 3], [sx + 2.2, sy], [sx, sy + 2]]); paint(T.mageStone[0], T.ol, 0.6); }
    // 頂部水晶
    const cy = my - mh - 6 + bob, ch = 18 + k * 3;
    glow(x, cy - ch * 0.5, 14 + k * 3, T.arcaneGlow, fire ? 1 : 0.65);
    ell(x, cy - ch * 0.48, 14 + k, 4.4, -0.25); if (!NOFX) { c.strokeStyle = T.gold; c.lineWidth = 1; c.setLineDash([2.6, 1.8]); c.stroke(); c.setLineDash([]); }
    crystal(x, cy, 9 + k, ch, 0, [T.arcane[0], T.arcane[1]]);
    if (k >= 1) { ell(x, cy - ch * 0.55, 11, 3.4, 0.5); if (!NOFX) { c.strokeStyle = T.arcane[0]; c.lineWidth = 0.8; c.stroke(); } }
    const oa = fr ? 0.9 : 2.6;
    for (let i = 0; i < 2 + (k >= 2 ? 2 : 0); i++) { const a = oa + i * PI2 / (2 + (k >= 2 ? 2 : 0)), ox = x + Math.cos(a) * (14 + k), oy = cy - ch * 0.48 + Math.sin(a) * 4.4; circ(ox, oy, 1.6); paint("#fff0fc", T.ol, 0.5); glow(ox, oy, 4, T.arcaneGlow, 0.8); }
    if (fire) fireGlow(x, cy - ch * 0.6, 10, T.arcaneGlow);
  }

  // ───── 冰霜塔
  function towerIce(x, y, lv, br, fr, fire) {
    if (lv >= 4) return br === "B" ? iceGlacier(x, y, lv, fr, fire) : iceBlizzard(x, y, lv, fr, fire);
    if (lv >= 3 && !NOFX) { ell(x, y + 2, 19, 8); paint(rg(x, y + 2, 2, 19, [T.frost, "rgba(255,255,255,0)"]), null); for (let i = 0; i < 7; i++) { const a = i * 0.9 + fr * 0.4; circ(x + Math.cos(a) * 16, y + 2 + Math.sin(a) * 6.5, 1.1); paint("rgba(255,255,255,.85)", null); } }
    plinth(x, y, lv); const b = y - (lv >= 3 ? 3.5 : 2);
    if (lv < 3) {
      if (lv === 2) { crystal(x - 7, b + 1, 4, 8, -0.45, T.ice); crystal(x + 8.5, b + 1, 3.6, 7, 0.55, T.ice); }
      crystal(x + 5, b, 4.5, 9 + (lv === 2 ? 2 : 0), 0.35, T.ice); crystal(x - 1, b + 0.5, 7, 17 + (lv === 2 ? 3 : 0), -0.05, T.ice);
      glow(x, b - 10, 9, T.iceGlow, fire ? 0.8 : 0.35);
      if (fire) fireGlow(x - 1, b - 17, 7, T.iceGlow);
    } else {
      glow(x, b - 18, 18, T.iceGlow, fire ? 0.75 : 0.45);
      crystal(x - 3, b - 1, 5, 14, -0.15, T.ice);
      crystal(x - 7, b + 1, 7, 23, -0.38, T.ice); crystal(x + 7.5, b + 1, 7, 25, 0.35, T.ice);
      crystal(x, b + 1.5, 10, 36, 0, T.ice);
      c.save(); c.translate(x, b - 41 - (fr ? 1 : 0)); c.rotate(fr * 0.3); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.lineCap = "round";
      for (let i = 0; i < 3; i++) { c.rotate(PI / 3); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); }
      c.strokeStyle = T.iceSpark; c.lineWidth = 1.1; for (let i = 0; i < 3; i++) { c.rotate(PI / 3); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); }
      c.restore(); glow(x, b - 41, 6, T.iceGlow, 0.6);
      if (fire) fireGlow(x, b - 30, 9, T.iceGlow);
    }
  }
  function snowflake(x, y, r, col, lw) { c.save(); c.translate(x, y); c.lineCap = "round"; for (const [cl, w] of [[T.ol, lw + 1.4], [col, lw]]) { c.strokeStyle = cl; c.lineWidth = w; for (let i = 0; i < 3; i++) { c.rotate(PI / 3); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(r * 0.55, 0); c.lineTo(r * 0.8, -r * 0.25); c.moveTo(r * 0.55, 0); c.lineTo(r * 0.8, r * 0.25); c.moveTo(-r * 0.55, 0); c.lineTo(-r * 0.8, -r * 0.25); c.moveTo(-r * 0.55, 0); c.lineTo(-r * 0.8, r * 0.25); c.stroke(); } } c.restore(); }
  // 暴風雪塔：冰柱頂著一朵大雪雲、雲下飄雪、風旋（剪影＝柱頂大雲）
  function iceBlizzard(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.ice[1]);
    if (!NOFX) { ell(x, y + 2, 21, 8.6); paint(rg(x, y + 2, 2, 21, [T.frost, "rgba(255,255,255,0)"]), null); }
    crystal(x - 6, b + 1, 5, 13, -0.4, T.ice); crystal(x + 6.5, b + 1, 5, 14, 0.4, T.ice);
    crystal(x, b + 1.5, 9, 26 + k * 3, 0, T.ice);
    banner(x + 7.5, b - 8, 5, 8, "#2c4f86", (bx, by) => snowflake(bx, by, 1.9, "#ffffff", 0.5));
    const cy = b - 32 - k * 3, w = 1 + k * 0.12;
    glow(x, cy, 20 + k * 3, T.iceGlow, fire ? 0.9 : 0.55);
    // 雲下飄雪
    if (!NOFX) for (let i = 0; i < 7 + k * 2; i++) { const sx = x + ((i * 37) % 22) - 11, sy = cy + 7 + ((i * 13 + fr * 5) % 13); circ(sx, sy, 0.9); paint("#ffffff", null); }
    // 風旋
    if (!NOFX) for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * 3, cy + 2, 15 * w, s > 0 ? -0.6 + fr * 0.2 : PI - 0.3 + fr * 0.2, s > 0 ? 0.6 + fr * 0.2 : PI + 0.9 + fr * 0.2); c.strokeStyle = "rgba(230,248,255,.8)"; c.lineWidth = 1; c.stroke(); }
    union([() => circ(x - 9 * w, cy + 1, 5.5 * w), () => circ(x - 2 * w, cy - 4 * w, 7.5 * w), () => circ(x + 7 * w, cy - 1.5, 6.2 * w), () => circ(x + 12 * w, cy + 2, 4.2 * w), () => rr(x - 13 * w, cy, 27 * w, 6.4, 3.2)], T.cloud[1]);
    circ(x - 3 * w, cy - 6 * w, 4.4 * w); paint(T.cloud[0], null); circ(x + 6 * w, cy - 3, 3.2 * w); paint(T.cloud[0], null);
    rr(x - 12 * w, cy + 3.4, 24 * w, 2.6, 1.3); paint(T.cloud[2], null);
    if (k >= 1) for (let i = -2; i <= 2; i++) { poly([[x + i * 4.4 - 1.2, cy + 6], [x + i * 4.4 + 1.2, cy + 6], [x + i * 4.4, cy + 9 + (i % 2 ? 0 : 2)]]); paint(T.ice[0], T.ol, 0.5); }
    if (k >= 2) { snowflake(x, cy - 13, 3.6, T.iceSpark, 1); glow(x, cy - 13, 7, T.iceGlow, 0.8); }
    if (fire) fireGlow(x, cy + 9, 9, T.iceGlow);
  }
  // 永凍塔：巨大六角冰柱、內含發光冰核、底部冰刺（剪影＝方正厚冰塊）
  function iceGlacier(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.deepIce[1]), H = 26 + k * 4, W = 11 + k;
    glow(x, b - H * 0.5, 18 + k * 2, T.iceGlow, fire ? 0.85 : 0.5);
    for (const [dx, a, h] of [[-12, -0.75, 9], [12, 0.75, 9], [-8, -0.35, 11], [9, 0.4, 11]]) crystal(x + dx, b + 2, 4.4, h, a, [T.deepIce[0], T.deepIce[1]]);
    const top = b - H;
    const L = [[x - W, b - 2], [x - W, top + 3], [x, top + 3 + W * 0.42], [x, b + 2.4]], Rr = [[x, b + 2.4], [x, top + 3 + W * 0.42], [x + W, top + 3], [x + W, b - 2]];
    poly(L); paint(lg(x - W, 0, x, 0, [T.deepIce[2], T.deepIce[1]]), null);
    poly(Rr); paint(lg(x, 0, x + W, 0, [T.deepIce[1], T.deepIce[0]]), null);
    poly([[x - W, top + 3], [x, top + 3 - W * 0.42], [x + W, top + 3], [x, top + 3 + W * 0.42]]); paint(T.deepIce[0], null);
    // 冰核
    const cy = b - H * 0.5; glow(x, cy, 9, T.iceGlow, 0.9);
    snowflake(x - W * 0.45, cy, 3.4 + k * 0.4, "#ffffff", 0.9);
    // 裂紋
    line([[x + 2, top + 9], [x + 5, top + 14], [x + 3.5, top + 18]], "rgba(255,255,255,.75)", 0.6);
    line([[x - W + 2, b - 6], [x - W + 5, b - 10]], "rgba(255,255,255,.6)", 0.6);
    poly([[x - W, b - 2], [x - W, top + 3], [x, top + 3 - W * 0.42], [x + W, top + 3], [x + W, b - 2], [x, b + 2.4]]); paint(null);
    line([[x, top + 3 + W * 0.42], [x, b + 2.4]], T.ol, 0.7);
    // 頂冠冰刺
    for (const [dx, h, a] of [[-5, 8 + k * 2, -0.25], [5, 7 + k * 2, 0.3], [0, 12 + k * 3, 0]]) crystal(x + dx, top + 3.5, 4, h, a, [T.deepIce[0], T.deepIce[1]]);
    if (k >= 2) { glow(x, top - 10, 8, T.iceGlow, 0.9); star(x, top - 11 - k, 2.2, "#effcff"); }
    if (fire) fireGlow(x - 2, cy, 11, T.iceGlow);
    if (!NOFX && fr) { circ(x + W + 3, top + 6, 0.9); paint("#fff", null); circ(x - W - 2, top + 14, 0.8); paint("#fff", null); }
  }

  // ───── 砲塔
  function towerCannon(x, y, lv, br, fr, fire) {
    if (lv >= 4) return br === "B" ? cannonMine(x, y, lv, fr, fire) : cannonRocket(x, y, lv, fr, fire);
    plinth(x, y, lv); const b = y - (lv >= 3 ? 3.5 : 2);
    if (lv < 3) {
      for (const [dx, dy] of [[-8, 0], [-3, 2], [3, 2], [8, 0]]) { ell(x + dx, b + dy - 1, 3.4, 2); paint(T.sandbag, T.ol, 0.7); }
      if (lv === 2) for (const [dx, dy] of [[-5.5, -2.6], [5.5, -2.6]]) { ell(x + dx, b + dy - 1, 3.2, 1.9); paint("#c8b088", T.ol, 0.7); }
      rr(x - 6, b - 8, 12, 6, 1.4); paint(sideGrad(x, 6, T.woodLight, T.wood, T.woodDark));
      c.save(); c.translate(x + 1 + (fire ? 1.2 : 0), b - 8 + (fire ? 0.8 : 0)); c.rotate(-0.75);
      rr(-3.6, -14, 7.2, 15, 2.6); paint(sideGrad(0, 3.6, T.iron[0], T.iron[1], T.iron[2]));
      ell(0, -14, 3.6, 1.8); paint(T.iron[2]); ell(0, -14, 2.2, 1.1); paint("#111", null);
      rr(-3.9, -6, 7.8, 1.8, 0.8); paint(lv === 2 ? T.bronze[1] : T.iron[0], T.ol, 0.5);
      if (lv === 2) { rr(-3.9, -11, 7.8, 1.6, 0.8); paint(T.bronze[1], T.ol, 0.5); }
      if (fire) fireGlow(0, -17, 8, T.fireGlow);
      c.restore();
      for (const dx of [-6.5, 6.5]) { circ(x + dx, b - 4, 3); paint(T.woodDark); circ(x + dx, b - 4, 1); paint(T.iron[0], null); }
    } else {
      cyl(x, b, 12.5, 9, sg3(x, 12.5, T.stone), T.stoneTop);
      for (let k = -2; k <= 2; k++) { rr(x + k * 5 - 1.8, b - 12.5 + Math.abs(k) * 0.7 + 4.5, 3.6, 3.6, 0.6); paint(T.stone[1]); }
      for (let r = 1; r < 3; r++) { c.beginPath(); c.moveTo(x - 12.5, b - r * 3); c.lineTo(x + 12.5, b - r * 3); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
      for (const [dx, dy] of [[8, -10], [11, -10], [9.5, -12.4]]) { circ(x + dx, b + dy, 1.8); paint(T.iron[2], T.ol, 0.5); }
      for (const dx of [-6, 6]) { circ(x + dx, b - 11, 3.6); paint(T.woodDark); circ(x + dx, b - 11, 1.3); paint(T.gold, null); }
      c.save(); c.translate(x + 1 + (fire ? 1.5 : 0), b - 13 + (fire ? 0.8 : 0)); c.rotate(-0.55);
      c.beginPath(); c.moveTo(-5.5, 3); c.lineTo(-4, -20); c.lineTo(4, -20); c.lineTo(5.5, 3); c.quadraticCurveTo(0, 6.5, -5.5, 3); c.closePath(); paint(sideGrad(0, 5.5, T.iron[0], T.iron[1], T.iron[2]));
      rr(-5, -21.5, 10, 3, 1.2); paint(T.bronze[1]);
      rr(-5.6, -6, 11.2, 2.2, 1); paint(T.bronze[1], T.ol, 0.6);
      ell(0, -21.5, 4.6, 2.2); paint(T.bronze[1]); ell(0, -21.6, 3, 1.4); paint("#120a06", null);
      circ(0, 4, 2.4); paint(T.bronze[1]);
      if (fire) fireGlow(0, -25, 10, T.fireGlow);
      c.restore();
      banner(x + 9, b - 8, 5, 8, T.bannerC, (bx, by) => { circ(bx, by, 1.2); paint(T.gold, null); });
    }
  }
  function rocketShape(len, gold) {
    rr(-2.4, -len, 4.8, len, 1.6); paint(lg(-2.4, 0, 2.4, 0, [T.rocket[2], T.rocket[0], T.rocket[1]]));
    poly([[-2.4, -len], [0, -len - 5.2], [2.4, -len]]); paint(gold ? T.gold : T.nose);
    rr(-2.5, -len * 0.55, 5, 1.5, 0.5); paint(T.nose, T.ol, 0.5);
    for (const s of [-1, 1]) { poly([[s * 2.4, -4.5], [s * 4.8, 0.4], [s * 2.4, -0.5]]); paint(T.nose); }
  }
  // 火箭塔：石台＋斜發射架＋三（五級四）枚火箭（剪影＝斜指天空的火箭群）
  function cannonRocket(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.nose);
    cyl(x, b, 12, 7, sg3(x, 12, T.stone), T.stoneTop);
    for (let i = -2; i <= 2; i++) { rr(x + i * 4.6 - 1.6, b - 9.6 + Math.abs(i) * 0.6, 3.2, 3, 0.5); paint(T.stone[1]); }
    // 發射架
    for (const s of [-1, 1]) limb([[x + s * 7, b - 8], [x + s * 3 - 4, b - 24]], T.iron[1], 1.6);
    rr(x - 12, b - 15, 20, 3, 1); paint(sg3(x, 10, T.iron));
    for (let i = 0; i < 5; i++) { rr(x - 11 + i * 4, b - 15, 2, 3, 0); paint(i % 2 ? T.hazard : "#1a1a1a", null); }
    rr(x - 12, b - 15, 20, 3, 1); paint(null, T.ol, 0.7);
    const n = k >= 1 ? 4 : 3, len = 15 + k * 2;
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * 5.6;
      c.save(); c.translate(x + dx - 1, b - 14 - Math.abs(i - (n - 1) / 2) * 1.5); c.rotate(-0.42);
      if (fire && i === n - 1) { c.translate(0, -6); if (!NOFX) { poly([[-2, 0], [0, 9 + fr * 3], [2, 0]]); paint(lg(0, 0, 0, 10, T.flame), null); glow(0, 3, 7, T.fireGlow, 0.9); } }
      rocketShape(len, k >= 2);
      c.restore();
    }
    banner(x + 10, b - 7, 5, 8, T.nose, (bx, by) => { poly([[bx, by - 2.6], [bx + 1.6, by + 1.6], [bx - 1.6, by + 1.6]]); paint(T.hazard, null); });
    if (k >= 2) glow(x - 8, b - 38, 8, T.bossAura, 0.6);
  }
  function spikyMine(x, y, r, lit) {
    for (let i = 0; i < 8; i++) { const a = i * PI / 4; limb([[x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6], [x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45]], T.mineCol[1], 0.9); }
    circ(x, y, r); paint(rg(x - r * 0.3, y - r * 0.3, 0.3, r, [T.mineCol[0], T.mineCol[1], T.mineCol[2]]));
    circ(x - r * 0.1, y - r * 0.55, r * 0.32); paint(lit ? T.blink : "#5a1a14", T.ol, 0.5);
    if (lit) glow(x - r * 0.1, y - r * 0.55, r * 1.6, "rgba(255,80,60,A)", 0.85);
  }
  // 地雷塔：低矮鐵碉堡＋黃黑警戒帶＋一旁堆著尖刺地雷（剪影＝低寬圓頂）
  function cannonMine(x, y, lv, fr, fire) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.hazard), hh = 13 + k * 1.5;
    // 圓頂
    c.beginPath(); c.moveTo(x - 12.5, b); c.bezierCurveTo(x - 12.5, b - hh * 1.2, x + 12.5, b - hh * 1.2, x + 12.5, b); c.ellipse(x, b, 12.5, 4.4, 0, 0, PI); c.closePath();
    paint(sg3(x, 12.5, T.mineCol));
    // 警戒帶
    c.save(); c.beginPath(); c.moveTo(x - 12.5, b - 1); c.lineTo(x - 12.5, b - 4.6); c.ellipse(x, b - 4.6, 12.5, 4.4, 0, PI, 0, true); c.lineTo(x + 12.5, b - 1); c.ellipse(x, b - 1, 12.5, 4.4, 0, 0, PI); c.closePath(); c.clip();
    c.fillStyle = T.hazard; c.fillRect(x - 13, b - 12, 26, 18);
    for (let i = -8; i < 8; i++) { poly([[x + i * 3.4, b + 4], [x + i * 3.4 + 1.7, b + 4], [x + i * 3.4 + 5.7, b - 10], [x + i * 3.4 + 4, b - 10]]); c.fillStyle = "#1a1a1a"; c.fill(); }
    c.restore();
    c.beginPath(); c.moveTo(x - 12.5, b - 4.6); c.ellipse(x, b - 4.6, 12.5, 4.4, 0, PI, 0, true); c.strokeStyle = T.ol; c.lineWidth = 0.7; c.stroke();
    // 觀察孔
    rr(x - 5, b - hh * 0.62, 10, 2.6, 1.3); paint(fire ? "#ffb060" : "#2a0e06", T.ol, 0.6); glow(x, b - hh * 0.55, 6, T.fireGlow, fire ? 0.9 : 0.4);
    // 艙蓋＋潛望鏡
    ell(x + 1, b - hh * 0.9, 4.6, 1.8); paint(T.mineCol[0], T.ol, 0.7);
    rr(x + 3, b - hh * 0.9 - 6, 2, 6, 0.6); paint(T.iron[1], T.ol, 0.6); rr(x + 3, b - hh * 0.9 - 7.4, 4.2, 2, 0.6); paint(T.iron[1], T.ol, 0.6);
    for (let i = -2; i <= 2; i++) { circ(x + i * 4.6, b - hh * 0.3 - (2 - Math.abs(i)) * 0.8, 0.7); paint(k >= 2 ? T.gold : T.mineCol[0], null); }
    // 地雷堆
    spikyMine(x - 11, b + 3, 3, fr === 1); spikyMine(x + 12, b + 3.5, 2.8, fr === 0);
    if (k >= 1) spikyMine(x - 13, b - 2.5, 2.4, false);
    // 警告三角旗
    limb([[x - 6, b - hh * 0.75], [x - 7, b - hh - 10]], T.woodDark, 0.9);
    poly([[x - 7, b - hh - 10], [x - 0.5, b - hh - 7.6], [x - 7, b - hh - 5]]); paint(T.hazard, T.ol, 0.7);
    c.fillStyle = "#1a1a1a"; c.font = "900 4px system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("!", x - 5, b - hh - 7.5);
    if (fire) { fireGlow(x + 1, b - hh * 0.9, 7, T.fireGlow); }
  }
  // ───── 書本塔（v3 合約 §4.2：花能量蓋、之後每答對多給能量；不攻擊；⑦ 畫外型）
  // 主體＝打開的魔法書。1–2 級 X 形木書架、3 級石碑書台＋藍屋頂、4–6 級拱形彩窗石碑＋浮空魔法書（5 級飛舞書頁＋羽毛筆、6 級金書＋光環）。
  // gl＝答對時書頁發光（ART.tower 的 st.glow 0~1；> 0.15 換發光版，並即時畫往上飄的能量光點）
  const BOOK = {
    cover: ["#d8707a", "#9a3440", "#4e1622"], royal: ["#8a7ae8", "#4a38a8", "#1e1660"], goldCov: ["#fff0b0", "#e1a84a", "#8a5422"],
    page: ["#fffaea", "#f2e2b4", "#c9ad72"], pageLit: ["#ffffff", "#fff6c8", "#ffd66a"], ink: "rgba(96,64,34,.55)", inkLit: "rgba(255,160,30,.95)",
    energy: "rgba(255,214,100,A)", energy2: "rgba(140,230,255,A)", ribbon: ["#e0566a", "#3f9c7f", "#5a8ae0"]
  };
  ART.BOOK_THEME = BOOK;
  // (x,y)＝書溝底；w＝單頁寬、h＝頁高；k＝裝飾等級 0..3（書籤數、金護角）
  function openBook(x, y, w, h, cov, gl, k) {
    const pg = gl ? BOOK.pageLit : BOOK.page;
    if (gl) glow(x, y - h * 0.5, w * 2.1, BOOK.energy, 0.55);
    c.beginPath(); c.moveTo(x, y + 2.4); c.quadraticCurveTo(x - w * 0.5, y - 0.1, x - w - 1.7, y + 1.1); c.lineTo(x - w - 1.7, y - h + 0.1);
    c.quadraticCurveTo(x - w * 0.5, y - h - 1.4, x, y - h + 1.1); c.quadraticCurveTo(x + w * 0.5, y - h - 1.4, x + w + 1.7, y - h + 0.1); c.lineTo(x + w + 1.7, y + 1.1); c.quadraticCurveTo(x + w * 0.5, y - 0.1, x, y + 2.4); c.closePath();
    paint(lg(x - w - 2, 0, x + w + 2, 0, [cov[2], cov[1], cov[0], cov[1], cov[2]]));
    if (k >= 2) for (const s of [-1, 1]) for (const [yy, d] of [[y + 1.1, -3], [y - h + 0.1, 3]]) { poly([[x + s * (w + 1.7), yy], [x + s * (w - 1.4), yy + d * 0.2], [x + s * (w + 1.7), yy + d]]); paint(T.gold, T.ol, 0.5); }
    for (const s of [-1, 1]) {
      const P = dy => { c.beginPath(); c.moveTo(x, y + dy); c.quadraticCurveTo(x + s * w * 0.45, y - 2.5 + dy, x + s * w, y - 1.1 + dy); c.lineTo(x + s * w, y - h - 1.1 + dy); c.quadraticCurveTo(x + s * w * 0.45, y - h - 2.5 + dy, x, y - h + dy); c.closePath(); };
      P(1.2); paint(pg[2], T.ol, 0.7);
      P(0); paint(lg(x, 0, x + s * w, 0, [pg[2], pg[1], pg[0]]), T.ol, 0.8);
      const n = h > 10 ? 5 : 4;
      for (let i = 1; i <= n; i++) {
        const yy = y - h + i * h / (n + 1) + 0.2;
        c.beginPath(); c.moveTo(x + s * w * 0.16, yy - 0.9); c.quadraticCurveTo(x + s * w * 0.5, yy - 2.3, x + s * w * (i === n ? 0.6 : 0.84), yy - 1.5);
        c.strokeStyle = gl ? BOOK.inkLit : BOOK.ink; c.lineWidth = gl ? 0.8 : 0.55; c.stroke();
      }
    }
    line([[x, y + 0.6], [x, y - h + 0.6]], "rgba(110,72,36,.55)", 0.6);
    for (let i = 0; i < Math.min(3, k); i++) { const rx = x - 1.6 + i * 1.6, L = 4.4 + i * 0.7; poly([[rx - 0.7, y + 1.2], [rx + 0.7, y + 1.2], [rx + 0.8, y + L + 0.8], [rx, y + L], [rx - 0.8, y + L + 0.8]]); paint(BOOK.ribbon[i], T.ol, 0.4); }
    if (gl && !NOFX) { glow(x, y - h * 0.55, w * 1.1, BOOK.energy, 0.35); for (const s of [-1, 1]) sparkle(x + s * w * 0.5, y - h * 0.62, 1.7, "#fffbe0"); }
  }
  function candle(x, y, fr, h) {
    rr(x - 2.6, y - 1.2, 5.2, 2.2, 0.8); paint(T.bronze[1], T.ol, 0.6);
    rr(x - 1.3, y - 1 - h, 2.6, h, 0.6); paint(lg(x - 1.3, 0, x + 1.3, 0, ["#d8c8a4", "#fffaf0", "#f4ead2"]), T.ol, 0.6);
    const fy = y - 1 - h - 2.2, ft = fr ? 0.6 : 0;
    glow(x, fy, 6.5, T.torch, 0.8);
    c.beginPath(); c.moveTo(x, fy - 2.4 - ft); c.quadraticCurveTo(x + 1.7, fy + 0.4, x, fy + 1.4); c.quadraticCurveTo(x - 1.7, fy + 0.4, x, fy - 2.4 - ft); c.closePath(); paint("#ffd27a", null); circ(x, fy + 0.3, 0.6); paint("#fff8e0", null);
  }
  function bookStack(x, y, n, sc) {
    const cols = [["#6a9ae8", "#2c4f86"], ["#4fb08f", "#24604c"], ["#d0666a", "#7a2a34"], ["#e2b25a", "#8a5a20"]]; sc = sc || 1;
    for (let i = 0; i < n; i++) {
      const w = (8.4 - i * 0.9) * sc, hh = 2.6 * sc, yy = y - i * hh, dx = (i % 2 ? 0.8 : -0.6) * sc, cl = cols[i % 4];
      rr(x + dx - w / 2, yy - hh, w, hh, 0.7); paint(lg(x + dx - w / 2, 0, x + dx + w / 2, 0, [cl[1], cl[0], cl[1]]), T.ol, 0.7);
      rr(x + dx + w / 2 - 1.9, yy - hh + 0.55, 1.3, hh - 1.1, 0.3); paint("#f2e2b4", null);
    }
    return y - n * 2.6 * sc;
  }
  function towerBook(x, y, lv, br, fr, gl) {
    if (lv >= 4) return bookHi(x, y, lv, fr, gl);
    plinth(x, y, lv); const b = y - (lv >= 3 ? 3.5 : 2);
    if (lv < 3) {
      if (lv === 2) bookStack(x - 10.5, b + 2.6, 2, 0.8);
      limb([[x - 6.5, b + 1.5], [x + 2.5, b - 11]], T.woodDark, 1.5); limb([[x + 6.5, b + 1.5], [x - 2.5, b - 11]], T.wood, 1.7);
      if (lv === 2) line([[x - 4.6, b - 2.4], [x + 4.6, b - 2.4]], T.woodDark, 1.1);
      poly([[x - 10.5, b - 10], [x + 10.5, b - 10], [x + 9.5, b - 13.2], [x - 9.5, b - 13.2]]); paint(sideGrad(x, 10.5, T.woodLight, T.wood, T.woodDark));
      const w = lv === 2 ? 8.8 : 7.6, h = lv === 2 ? 10.4 : 9;
      openBook(x, b - 12.6, w, h, BOOK.cover, gl, lv - 1);
      if (lv === 2) { candle(x + 11.5, b + 2.4, fr, 6); pennant(x - 13.5, b - 1, 8, T.gold, fr); }
    } else {
      // 3 級：石碑（刻星徽，答對時發光）＋藍屋頂＋前方石柱書台
      rr(x - 9.5, b - 37, 19, 33, 1.6); paint(sg3(x, 9.5, T.stone));
      for (let r = 1; r < 7; r++) { c.beginPath(); c.moveTo(x - 9.5, b - 4 - r * 4.6); c.lineTo(x + 9.5, b - 4 - r * 4.6); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
      circ(x, b - 30.5, 4.4); paint(gl ? "#ffe9a0" : T.stone[2], T.ol, 0.7);
      star(x, b - 30.5, 2.7, gl ? "#ffffff" : T.gold, 0.6);
      if (gl) glow(x, b - 30.5, 10, BOOK.energy, 0.85);
      poly([[x - 12.5, b - 36], [x, b - 49], [x + 12.5, b - 36]]); paint(sg3(x, 12.5, T.roofA));
      c.beginPath(); c.ellipse(x, b - 36, 12.5, 3.6, 0, 0, PI); paint(T.roofA[2]);
      for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x - 12.5 + k * 3.6, b - 36 - k * 4.3 + 1.6); c.quadraticCurveTo(x, b - 36 - k * 4.3 + 4.4, x + 12.5 - k * 3.6, b - 36 - k * 4.3 + 1.6); c.strokeStyle = T.roofLine; c.lineWidth = 0.6; c.stroke(); }
      pennant(x, b - 49, 7, T.gold, fr);
      cyl(x, b + 1, 5.2, 11, sg3(x, 5.2, T.stone), T.stoneTop);
      c.beginPath(); c.ellipse(x, b - 4.5, 5.2, 2.2, 0, 0, PI); c.strokeStyle = T.gold; c.lineWidth = 1; c.stroke();
      poly([[x - 11, b - 9.5], [x + 11, b - 9.5], [x + 10, b - 12.6], [x - 10, b - 12.6]]); paint(sg3(x, 11, T.stone));
      openBook(x, b - 12, 9.8, 11, BOOK.cover, gl, 2);
      candle(x - 12.5, b + 2.8, fr, 7);
    }
  }
  function bookHi(x, y, lv, fr, gl) {
    const k = lv - 4, b = plinthHi(x, y, lv, T.gold), bob = fr ? -1 : 0, H = 40 + k * 4, ay = b - H + 11;
    // 拱形石碑＋彩繪玻璃窗（答對時變金色）
    c.beginPath(); c.moveTo(x - 11, b - 1); c.lineTo(x - 11, ay); c.arc(x, ay, 11, PI, 0); c.lineTo(x + 11, b - 1); c.closePath(); paint(sg3(x, 11, ["#e2d6c0", "#ab9c84", "#6a5e4e"]));   // 暖色石（和紫色魔法塔分開）
    for (let r = 1; r * 5 < H - 14; r++) { c.beginPath(); c.moveTo(x - 11, b - 1 - r * 5); c.lineTo(x - 7, b - 1 - r * 5); c.moveTo(x + 7, b - 1 - r * 5); c.lineTo(x + 11, b - 1 - r * 5); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
    c.beginPath(); c.moveTo(x - 6, b - 14); c.lineTo(x - 6, ay); c.arc(x, ay, 6, PI, 0); c.lineTo(x + 6, b - 14); c.closePath();
    paint(lg(x, ay - 6, x, b - 14, gl ? ["#ffffff", "#ffd66a", "#ff9a4a"] : ["#8ad8ff", "#6a5ad0", "#2a1e6a"]), T.ol, 0.8);
    line([[x, ay - 6], [x, b - 14]], T.ol, 0.6); line([[x - 6, ay + 3], [x + 6, ay + 3]], T.ol, 0.6);
    glow(x, ay + 1, 10, gl ? BOOK.energy : T.orbGlow, gl ? 0.6 : 0.4);
    c.beginPath(); c.arc(x, ay, 11, PI, 0); c.strokeStyle = T.gold; c.lineWidth = 1.2; c.stroke();
    star(x, b - H - 2.4, 2.6 + k * 0.3, T.goldL); glow(x, b - H - 2.4, 6, T.bossAura, 0.55);
    // 兩側書堆（5 級起右堆頂上有藍水晶）
    bookStack(x - 13, b + 4, 3 + (k >= 1 ? 1 : 0), 0.85);
    const rt = bookStack(x + 13.5, b + 4, 2 + (k >= 2 ? 1 : 0), 0.85);
    if (k >= 1) { crystal(x + 13.5, rt + 0.6, 3.2, 7.5, 0.12, T.ice); glow(x + 13.5, rt - 3.5, 5, T.iceGlow, 0.6); }
    // 書台
    cyl(x, b + 1, 6, 7, sg3(x, 6, T.stone), T.stoneTop); c.beginPath(); c.ellipse(x, b - 2.6, 6, 2.5, 0, 0, PI); c.strokeStyle = T.gold; c.lineWidth = 1.1; c.stroke();
    // 浮空魔法書＋符文環
    const w = 10.4 + k * 0.9, h = 11.6 + k * 0.7, by = b - 12 + bob;
    if (!NOFX) { glow(x, b - 7, 9, gl ? BOOK.energy : T.orbGlow, 0.55); ell(x, by - h * 0.45, w + 6, 4.2, -0.12); c.strokeStyle = gl ? "rgba(255,232,160,.95)" : "rgba(243,212,148,.7)"; c.lineWidth = 0.9; c.setLineDash([2.2, 1.8]); c.stroke(); c.setLineDash([]); }
    openBook(x, by, w, h, k >= 2 ? BOOK.goldCov : k >= 1 ? BOOK.royal : BOOK.cover, gl, 3);
    if (k >= 1) {
      for (let i = 0; i < 2 + (k >= 2 ? 1 : 0); i++) {
        const a = (fr ? 0.5 : 0) + i * 2.3 + 0.4, px = x + Math.cos(a) * (w + 6.5), py = by - h * 0.5 + Math.sin(a) * 5.5 - 2;
        c.save(); c.translate(px, py); c.rotate(Math.cos(a) * 0.45);
        rr(-2.1, -2.7, 4.2, 5.4, 0.5); paint(gl ? "#fffbe0" : BOOK.page[1], T.ol, 0.6); line([[-1.2, -1], [1.2, -1]], BOOK.ink, 0.45); line([[-1.2, 0.7], [1.2, 0.7]], BOOK.ink, 0.45);
        c.restore();
      }
      // 羽毛筆＋墨水瓶（左前）
      rr(x - 9.5, b + 2.2, 4.4, 3.6, 1.2); paint(lg(0, b + 2, 0, b + 6, ["#3a4a7a", "#141a34"]), T.ol, 0.6);
      c.beginPath(); c.moveTo(x - 7.3, b + 2.6); c.quadraticCurveTo(x - 5, b - 4, x - 1.4, b - 9.5); c.quadraticCurveTo(x - 4.2, b - 3.6, x - 7.3, b + 2.6); c.closePath(); paint("#f4f8ff", T.ol, 0.6);
      line([[x - 7.3, b + 2.6], [x - 2.4, b - 7.6]], "#9aa8c0", 0.4);
    }
    if (k >= 2 && !NOFX) { ell(x, b - H - 9, 8, 2.4); c.strokeStyle = T.goldL; c.lineWidth = 1; c.setLineDash([2, 1.6]); c.stroke(); c.setLineDash([]); glow(x, b - H - 9, 11, T.bossAura, 0.45); }
  }
  // 能量光點（即時畫，≤ 7 顆）：從書頁往上飄
  const BOOK_C = [0, -19, -20, -21, -21.6, -22, -22.3];
  function bookMotes(ctx, x, y, lv, t, a) {
    const by = y + BOOK_C[lv], pa = ctx.globalAlpha;
    for (let i = 0; i < 7; i++) {
      const p = ((t || 0) * 0.85 + i / 7) % 1, s = Math.sin(i * 2.17 + p * 3.2);
      const mx = x + s * (3 + p * 9), my = by - 2 - p * 26, al = a * Math.sin(p * PI);
      if (al <= 0.02) continue;
      liveGlow(ctx, mx, my, 3.6 - p, i % 3 ? BOOK.energy : BOOK.energy2, al);
      ctx.globalAlpha = pa * al; ctx.fillStyle = i % 3 ? "#fff3b0" : "#dffaff";
      ctx.beginPath(); ctx.moveTo(mx, my - 1.5); ctx.lineTo(mx + 0.95, my); ctx.lineTo(mx, my + 1.5); ctx.lineTo(mx - 0.95, my); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = pa;
  }

  const TOWER_FN = { arrow: towerArrow, mage: towerMage, ice: towerIce, cannon: towerCannon, book: towerBook };
  // 每種外型的大概高度（給血條／標籤定位）
  function towerTop(type, lv, br) {
    if (type === "book") return [0, -27, -29, -56, -50, -55, -64][lv] || -30;
    if (lv < 3) return type === "arrow" ? (lv === 2 ? -40 : -30) : type === "mage" ? -26 : type === "ice" ? -24 : -22;
    if (lv === 3) return type === "ice" ? -50 : type === "cannon" ? -38 : -52;
    const k = lv - 4;
    if (type === "arrow") return br === "B" ? -40 - k * 3 : -60 - k * 7;
    if (type === "mage") return br === "B" ? -56 - k * 6 : -52 - k * 5;
    if (type === "ice") return br === "B" ? -46 - k * 6 : -54 - k * 4;
    return br === "B" ? -34 - k * 2 : -46 - k * 3;
  }
  ART.towerTop = (type, lv, branch) => towerTop(type, Math.max(1, Math.min(6, lv | 0 || 1)), branch || "A");

  // 疊加層：封印鎖鏈、升級鷹架、暫時鎖定
  function chainLine(x1, y1, x2, y2) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(L / 3.2), a = Math.atan2(y2 - y1, x2 - x1);
    for (let i = 0; i <= n; i++) { const k = i / n, cx = x1 + (x2 - x1) * k, cy = y1 + (y2 - y1) * k; ell(cx, cy, i % 2 ? 1.9 : 2.2, i % 2 ? 0.9 : 1.4, a + (i % 2 ? 0 : 0)); c.strokeStyle = T.ol; c.lineWidth = 1.9; c.stroke(); c.strokeStyle = i % 2 ? "#9aa4b4" : "#c8d0dc"; c.lineWidth = 0.8; c.stroke(); }
  }
  function sealOverlay(top) {
    const mid = top * 0.45;
    // 樹妖的紫藤
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 13, 4); c.bezierCurveTo(s * 4, -2, s * 16, mid * 0.6, s * 3, mid); c.strokeStyle = T.ol; c.lineWidth = 3.2; c.stroke(); c.strokeStyle = "#5a2a6e"; c.lineWidth = 1.6; c.stroke(); for (let i = 1; i < 4; i++) { const yy = mid * i / 4; poly([[s * (9 - i * 1.5), yy], [s * (12 - i * 1.5), yy - 1.5], [s * (9.5 - i * 1.5), yy + 1.4]]); paint("#7a3a8e", null); } }
    chainLine(-13, top * 0.8, 13, top * 0.15); chainLine(13, top * 0.8, -13, top * 0.15);
    // 鎖頭
    const ly = top * 0.47;
    c.beginPath(); c.arc(0, ly - 2.4, 3, PI, 0); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = "#c8d0dc"; c.lineWidth = 1.1; c.stroke();
    rr(-4.2, ly - 2.6, 8.4, 6.8, 1.6); paint(lg(0, ly - 3, 0, ly + 4, [T.goldL, T.bronze[2]]));
    circ(0, ly + 0.2, 1.1); paint(T.ol, null); rr(-0.5, ly + 0.6, 1, 2.2, 0.4); paint(T.ol, null);
  }
  function scaffoldOverlay(top) {
    const h = Math.min(-26, top + 6);
    for (const dx of [-14, 14]) limb([[dx, 5], [dx * 0.92, h]], T.woodLight, 1.2);
    for (const [y1, y2] of [[2, h * 0.5], [h * 0.5, h]]) { line([[-14, y1], [14 * 0.92, y2]], T.woodDark, 0.8); line([[14, y1], [-14 * 0.92, y2]], T.woodDark, 0.8); }
    for (const yy of [h * 0.5, h]) { rr(-15.5, yy - 1, 31, 2.2, 0.6); paint(T.woodLight, T.ol, 0.7); }
    // 升級箭頭牌
    poly([[0, h - 11], [5, h - 5.5], [2, h - 5.5], [2, h - 1.5], [-2, h - 1.5], [-2, h - 5.5], [-5, h - 5.5]]); paint(T.goldL, T.ol, 0.8);
    glow(0, h - 6, 9, T.bossAura, 0.7);
  }
  function hourglass(x, y) {
    rr(x - 3.6, y - 5.6, 7.2, 1.4, 0.5); paint(T.wood, T.ol, 0.6); rr(x - 3.6, y + 4.2, 7.2, 1.4, 0.5); paint(T.wood, T.ol, 0.6);
    poly([[x - 2.8, y - 4.2], [x + 2.8, y - 4.2], [x + 0.5, y], [x + 2.8, y + 4.2], [x - 2.8, y + 4.2], [x - 0.5, y]]); paint("rgba(220,240,255,.85)", T.ol, 0.7);
    poly([[x - 1.6, y + 4], [x + 1.6, y + 4], [x, y + 1.6]]); paint(T.goldL, null);
  }
  const TBOX = { w: 72, h: 104, ox: 36, oy: 84 };
  const OVBOX = { w: 44, h: 84, ox: 22, oy: 74 };
  ART.tower = function (ctx, type, lv, branch, x, y, t, st) {
    st = st || {}; lv = Math.max(1, Math.min(6, lv | 0 || 1));
    const fn = TOWER_FN[type] || towerArrow, br = lv >= 4 && type !== "book" ? (branch === "B" ? "B" : "A") : "";
    const glw = type === "book" ? Math.max(+st.glow || 0, +st.firing || 0) : 0;   // 書本塔：st.glow 0~1＝答對時書頁發光（沒給就看 firing）
    const fr = Math.floor((t || 0) * 2.5) & 1, fire = (type === "book" ? glw : (st.firing || 0)) > 0.15 && !st.sealed ? 1 : 0;
    const q = qOf(ctx), key = "t|" + type + "|" + lv + "|" + br + "|" + fr + "|" + fire;
    const draw = () => { fn(0, 0, lv, br, fr, fire); if (!st.noStars) lvStars(0, 0, lv); };
    const keyS = key + (st.noStars ? "|ns" : "");
    blit(ctx, sprite(keyS, TBOX, q, draw), x, y);
    const top = towerTop(type, lv, br);
    if (st.sealed) { blit(ctx, tinted(keyS, TBOX, q, draw, "rgba(40,16,60,.45)"), x, y); blit(ctx, sprite("ov|seal|" + Math.round(top / 6), OVBOX, q, () => sealOverlay(top)), x, y); }
    else if (st.locked) { blit(ctx, tinted(keyS, TBOX, q, draw, "rgba(8,12,28,.5)"), x, y); blit(ctx, sprite("ov|hg", { w: 12, h: 16, ox: 6, oy: 8 }, q, () => hourglass(0, 0)), x, y + top - 6); }
    if (glw > 0.02 && !st.sealed && !st.locked) bookMotes(ctx, x, y, lv, t, Math.min(1, glw));
    if (st.pending) {
      blit(ctx, sprite("ov|scaf|" + Math.round(top / 6), OVBOX, q, () => scaffoldOverlay(top)), x, y);
      // 旋轉光圈（即時畫，很便宜）
      ctx.save(); ctx.translate(x, y + 2); ctx.beginPath(); ctx.ellipse(0, 0, 17, 7, 0, 0, PI2); ctx.setLineDash([4, 3]); ctx.lineDashOffset = -(t || 0) * 14; ctx.strokeStyle = "rgba(247,206,131,.95)"; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
  };

  // ═════════════════════════════ 怪 ═════════════════════════════
  // 每支函式以「腳底」為原點 (x,y)；fr＝走路幀 0..3。陣營＝墨紫＋發光黃眼。
  function bossRing(x, y, rx, col, fillCol, fr) {
    if (NOFX) return;
    glow(x, y - 4, rx * 1.3, T.bossAura, 0.3);
    ell(x, y + 1, rx * 1.08, rx * 0.44); paint(rg(x, y + 1, 4, rx * 1.08, [fillCol, "rgba(0,0,0,0)"]), null);
    ell(x, y + 1, rx, rx * 0.4); c.strokeStyle = col; c.lineWidth = 1.4; c.stroke();
    ell(x, y + 1, rx * 0.8, rx * 0.32); c.setLineDash([3, 2.4]); c.lineDashOffset = -fr * 1.4; c.strokeStyle = col; c.lineWidth = 0.9; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    for (let i = 0; i < 12; i++) { const a = i * PI2 / 12 + fr * PI / 24; c.beginPath(); c.moveTo(x + Math.cos(a) * rx * 0.88, y + 1 + Math.sin(a) * rx * 0.352); c.lineTo(x + Math.cos(a) * rx, y + 1 + Math.sin(a) * rx * 0.4); c.strokeStyle = col; c.lineWidth = i % 3 ? 0.8 : 1.6; c.stroke(); }
  }
  function slimeBody(x, y, pal) {
    c.beginPath(); c.moveTo(x - 8.5, y); c.bezierCurveTo(x - 9.5, y - 8, x - 4.5, y - 13.5, x, y - 13.5); c.bezierCurveTo(x + 4.5, y - 13.5, x + 9.5, y - 8, x + 8.5, y); c.quadraticCurveTo(x + 5, y + 1.5, x + 3, y + 0.4); c.quadraticCurveTo(x, y + 2, x - 3, y + 0.4); c.quadraticCurveTo(x - 6, y + 1.5, x - 8.5, y); c.closePath();
    paint(lg(x, y - 13.5, x, y + 1, pal));
    ell(x - 3.6, y - 9.6, 2.6, 1.6, -0.5); paint("rgba(255,255,255,.6)", null);
  }
  function enSlime(x, y, fr) {
    const sq = [1, 0.9, 1, 1.08][fr], hop = [0, 0, -1.6, -0.6][fr];
    shadow(x, y + 0.8, 9 * (fr === 2 ? 0.85 : 1), 2.9);
    glow(x, y - 6, 13, T.enemyGlow, 0.35);
    c.save(); c.translate(x, y + hop); c.scale(1.1 * (1 + (1 - sq) * 0.8), 1.1 * sq);
    slimeBody(0, 0, T.slime); eyes(0, -6.5, 2.9, 1.8, true);
    c.beginPath(); c.arc(0, -3, 1.6, 0.2, PI - 0.2); c.strokeStyle = T.ol; c.lineWidth = 0.8; c.stroke();
    c.restore();
  }
  function enBat(x, y, fr) {
    const by = y - 13 + [0, 1, 1.6, 0.6][fr], wk = [1, 0.45, -0.55, 0.45][fr];
    shadow(x, y + 0.5, 6.5 - (by - y + 13) * 0.4, 2, T.shadowA * 0.7);
    glow(x, by, 13, T.enemyGlow, 0.3);
    for (const s of [-1, 1]) {
      c.save(); c.translate(x + s * 2.5, by - 1); c.scale(1, wk); c.translate(-(x + s * 2.5), -(by - 1));
      c.beginPath(); c.moveTo(x + s * 2.5, by - 2); c.quadraticCurveTo(x + s * 9, by - 9, x + s * 15, by - 6); c.lineTo(x + s * 13, by + 0.5); c.quadraticCurveTo(x + s * 11.5, by - 1, x + s * 9.5, by + 1.5); c.quadraticCurveTo(x + s * 7.5, by - 0.5, x + s * 5.5, by + 2.5); c.quadraticCurveTo(x + s * 4, by + 1, x + s * 2.5, by + 2); c.closePath();
      paint(lg(x, by - 9, x, by + 3, T.batWing));
      c.beginPath(); c.moveTo(x + s * 4, by - 1); c.lineTo(x + s * 9.5, by + 0.5); c.moveTo(x + s * 5, by - 2.5); c.lineTo(x + s * 12.5, by - 1); c.strokeStyle = T.batVein; c.lineWidth = 0.5; c.stroke();
      c.restore();
    }
    for (const s of [-1, 1]) { poly([[x + s * 1.2, by - 4], [x + s * 3.6, by - 8.5], [x + s * 3.8, by - 3]]); paint(T.batBody); }
    ell(x, by, 4.4, 4.8); paint(T.batBody);
    gEyes(x, by - 1, 1.7, 1.1, 1.2);
    poly([[x - 1.3, by + 1.8], [x - 0.8, by + 3.4], [x - 0.3, by + 1.8]]); paint("#fff", null); poly([[x + 1.3, by + 1.8], [x + 0.8, by + 3.4], [x + 0.3, by + 1.8]]); paint("#fff", null);
  }
  function enGolem(x, y, fr) {
    const sw = [0, 1, 0, -1][fr];
    shadow(x, y + 0.8, 10.5, 3.2);
    glow(x, y - 10, 15, T.enemyGlow, 0.3);
    for (const s of [-1, 1]) { rr(x + s * 4 - 2.5, y - 4.5 - (s * sw > 0 ? 1.2 : 0), 5, 5, 1.2); paint(T.golem[1]); }
    c.save(); c.translate(x, y - 4); c.rotate(sw * 0.04); c.translate(-x, -(y - 4));
    rr(x - 8.5, y - 18, 17, 14.5, 3.5); paint(sg3(x, 8.5, T.golem));
    for (const s of [-1, 1]) { rr(x + s * 11 - 3.2, y - 16 + (s * sw < 0 ? 0.8 : 0), 6.4, 11, 2.5); paint(sg3(x + s * 11, 3.2, T.golem)); }
    rr(x - 5, y - 24.5, 10, 7.5, 2.4); paint(T.golem[0]);
    c.beginPath(); c.moveTo(x - 3, y - 15); c.lineTo(x, y - 12); c.lineTo(x - 1.5, y - 9); c.lineTo(x + 2, y - 6.5); c.moveTo(x, y - 12); c.lineTo(x + 3.5, y - 13.5); c.strokeStyle = T.rune2; c.lineWidth = 1.3; c.stroke();
    glow(x, y - 11, 6, T.enemyGlow, 0.5);
    for (const s of [-1, 1]) { glow(x + s * 2.2, y - 21, 3, T.eyeGlow, 0.7); rr(x + s * 2.2 - 1.3, y - 21.6, 2.6, 1.3, 0.5); paint(T.enemyEye, null); }
    ell(x - 7, y - 17.5, 3, 1.3); paint(T.moss, null);
    c.restore();
    armorBadge(x + 12, y - 26);
  }
  // 字盾騎士：紫甲、大盾上有字母
  function enElite(x, y, fr, v) {
    const sw = [0, 1, 0, -1][fr];
    shadow(x, y + 0.8, 9.5, 3);
    glow(x, y - 12, 14, T.enemyGlow, 0.25);
    // 披風
    c.beginPath(); c.moveTo(x - 4, y - 18); c.quadraticCurveTo(x + 9, y - 10, x + 8 + sw, y - 1); c.lineTo(x - 2, y - 2); c.closePath(); paint("#6a2a4e");
    for (const s of [-1, 1]) { rr(x + s * 3 - 2, y - 7 - (s * sw > 0 ? 1.2 : 0), 4, 7.4, 1.2); paint(T.eliteArmor[2]); }
    rr(x - 6, y - 19, 12, 13, 3); paint(sg3(x, 6, T.eliteArmor));
    rr(x - 6.2, y - 9.6, 12.4, 1.8, 0.6); paint(T.gold, T.ol, 0.5);
    for (const s of [-1, 1]) { ell(x + s * 6.5, y - 17.5, 3.4, 2.6); paint(T.eliteArmor[0]); }
    // 長槍
    limb([[x + 8.5, y + 0.5], [x + 8.5, y - 31]], T.woodDark, 1.1);
    poly([[x + 8.5, y - 36], [x + 10.4, y - 30.5], [x + 6.6, y - 30.5]]); paint(T.blade, T.ol, 0.7);
    circ(x + 8.5, y - 15, 1.8); paint(T.eliteArmor[1]);
    // 頭盔＋羽飾
    c.beginPath(); c.moveTo(x, y - 27.5); c.quadraticCurveTo(x + 4, y - 33, x + 8.5, y - 30); c.quadraticCurveTo(x + 4.5, y - 30.5, x + 1, y - 26); c.closePath(); paint(T.plumeE);
    circ(x, y - 23, 5); paint(sg3(x, 5, T.eliteArmor));
    rr(x - 3.6, y - 24, 7.2, 1.8, 0.8); paint(T.pupil, null);
    gEyes(x, y - 23.1, 1.6, 0.9, 0.6);
    // 大盾（字母）
    const sx = x - 5.5, sy = y - 21;
    c.beginPath(); c.moveTo(sx - 6.5, sy); c.lineTo(sx + 6.5, sy); c.lineTo(sx + 6.5, sy + 8); c.quadraticCurveTo(sx + 6, sy + 14, sx, sy + 17); c.quadraticCurveTo(sx - 6, sy + 14, sx - 6.5, sy + 8); c.closePath();
    paint(lg(sx - 6, sy, sx + 6, sy + 16, T.eliteShield));
    c.beginPath(); c.moveTo(sx - 5, sy + 1.4); c.lineTo(sx + 5, sy + 1.4); c.lineTo(sx + 5, sy + 8); c.quadraticCurveTo(sx + 4.6, sy + 12.6, sx, sy + 15.2); c.quadraticCurveTo(sx - 4.6, sy + 12.6, sx - 5, sy + 8); c.closePath(); c.strokeStyle = T.gold; c.lineWidth = 1; c.stroke();
    // st.letter（單字首字母）→ 畫那個字母；沒有就畫一本打開的書（不要固定畫 A 誤導玩家）
    const L = typeof v === "string" && v ? v : "";
    if (L) {
      c.font = "900 " + (L === "W" || L === "M" ? 8.6 : 10) + "px Georgia,'Times New Roman',serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "#24305a"; c.fillText(L, sx, sy + 7.6);
    } else {
      const bx = sx, by = sy + 7.8;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(bx, by - 2.6); c.quadraticCurveTo(bx + s * 2, by - 3.6, bx + s * 4, by - 2.9); c.lineTo(bx + s * 4, by + 2.4); c.quadraticCurveTo(bx + s * 2, by + 1.7, bx, by + 2.9); c.closePath(); paint(s < 0 ? "#fbf6e6" : "#efe6cc", "#24305a", 0.6); }
      c.strokeStyle = "rgba(36,48,90,.75)"; c.lineWidth = 0.45; c.beginPath();
      for (const s of [-1, 1]) for (const k of [-1, 0.2, 1.4]) { c.moveTo(bx + s * 0.9, by + k - 0.3); c.lineTo(bx + s * 3.2, by + k - 0.6); }
      c.stroke();
      line([[bx, by - 2.6], [bx, by + 2.9]], "#24305a", 0.7);
    }
  }
  // 錯字哥布林：尖耳、舉著寫錯字的句子牌（紅色波浪底線）
  function enGoblin(x, y, fr) {
    const bob = [0, -1, 0, -1][fr], sw = [0, 1, 0, -1][fr];
    shadow(x, y + 0.8, 8.5, 2.8);
    glow(x, y - 10, 13, T.enemyGlow, 0.25);
    for (const s of [-1, 1]) { rr(x + s * 2.8 - 1.8, y - 6 - (s * sw > 0 ? 1.2 : 0), 3.6, 6.4, 1.2); paint(T.gob[2]); rr(x + s * 2.8 - 2.4 + s * 0.6, y - 1.4, 4.4, 1.8, 0.8); paint("#3a2a1e", null); }
    c.save(); c.translate(0, bob);
    // 舉牌的手臂＋棍子
    limb([[x + 4, y - 12], [x + 8, y - 17]], T.gob[1], 2);
    limb([[x + 8.5, y - 14], [x + 9.5, y - 31]], T.woodLight, 1.1);
    // 句子牌
    c.save(); c.translate(x + 9.5, y - 34); c.rotate(0.08 * sw);
    rr(-9, -6, 18, 10, 1.6); paint(T.sign, T.ol, T.olw);
    c.fillStyle = "#3a2a1e"; for (const [dx, w] of [[-7, 5], [-1, 4], [4, 3.5]]) c.fillRect(dx, -3.6, w, 1.3);
    c.fillRect(-7, -0.4, 7, 1.3);
    c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(1 + i * 0.85, 0.8 + (i % 2 ? -0.7 : 0.7)); c.strokeStyle = "#e0303e"; c.lineWidth = 0.8; c.stroke();
    c.restore();
    // 身體（紫背心）
    c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x - 4.2, y - 14); c.lineTo(x + 4.2, y - 14); c.lineTo(x + 5, y - 5); c.closePath(); paint(lg(x, y - 14, x, y - 5, ["#8a64b0", T.gobCloth]));
    rr(x - 5.2, y - 7, 10.4, 1.6, 0.6); paint("#3a2a1e", null);
    limb([[x - 4, y - 12], [x - 6.5, y - 7.5]], T.gob[1], 2);
    // 頭＋長尖耳
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 4, y - 20.5); c.quadraticCurveTo(x + s * 10, y - 23, x + s * 13, y - 25.5); c.quadraticCurveTo(x + s * 9, y - 18.5, x + s * 4, y - 17); c.closePath(); paint(T.gob[1]); c.beginPath(); c.moveTo(x + s * 5, y - 19.5); c.quadraticCurveTo(x + s * 9, y - 21, x + s * 11, y - 23.5); c.strokeStyle = "#e89a9a"; c.lineWidth = 0.7; c.stroke(); }
    ell(x, y - 19, 5.6, 5); paint(sg3(x, 5.6, T.gob));
    gEyes(x, y - 20.2, 2.2, 1.2, 1);
    c.strokeStyle = T.ol; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - 3.6, y - 22.6); c.lineTo(x - 0.9, y - 21.6); c.moveTo(x + 3.6, y - 22.6); c.lineTo(x + 0.9, y - 21.6); c.stroke();
    poly([[x, y - 19.5], [x + 1.6, y - 16.6], [x - 0.4, y - 17.2]]); paint(T.gob[2], null);
    c.beginPath(); c.moveTo(x - 3, y - 16); c.quadraticCurveTo(x, y - 14, x + 3, y - 16); c.closePath(); paint("#2a0e14", T.ol, 0.6);
    for (const dx of [-1.6, 1.4]) { poly([[x + dx - 0.6, y - 15.7], [x + dx + 0.6, y - 15.7], [x + dx, y - 14.6]]); paint("#fff", null); }
    c.restore();
  }
  // 分裂史萊姆：雙峰身體＋中縫虛線，每峰一隻大眼
  function enSplitter(x, y, fr) {
    const sq = [1, 0.92, 1, 1.06][fr];
    shadow(x, y + 0.8, 11.5, 3.2);
    glow(x, y - 8, 15, T.enemyGlow, 0.3);
    c.save(); c.translate(x, y); c.scale(1 + (1 - sq) * 0.7, sq);
    c.beginPath(); c.moveTo(-12, 0); c.bezierCurveTo(-13.5, -9, -9, -17, -5, -16.5); c.quadraticCurveTo(-1.5, -16, 0, -12.5); c.quadraticCurveTo(1.5, -16, 5, -16.5); c.bezierCurveTo(9, -17, 13.5, -9, 12, 0); c.quadraticCurveTo(6, 2, 0, 1); c.quadraticCurveTo(-6, 2, -12, 0); c.closePath();
    paint(lg(0, -17, 0, 1, T.split));
    c.setLineDash([1.6, 1.6]); c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 0); c.strokeStyle = "rgba(20,10,60,.55)"; c.lineWidth = 0.9; c.stroke(); c.setLineDash([]);
    for (const [bx, by, r] of [[-7, -4, 1.3], [8, -3, 1], [4, -7, 0.8], [-3, -2, 0.7]]) { circ(bx, by, r); paint("rgba(255,255,255,.45)", null); }
    for (const s of [-1, 1]) { ell(s * 5.2, -12.6, 2.2, 1.2, s * 0.5); paint("rgba(255,255,255,.6)", null); }
    for (const s of [-1, 1]) { ell(s * 5.6, -8.5, 2.6, 3); paint(T.eyeWhite, T.ol, 0.6); circ(s * 5.6 + s * 0.5, -8, 1.4); paint(T.pupil, null); circ(s * 5.6 - 0.6, -9.4, 0.6); paint("#fff", null); }
    c.beginPath(); c.moveTo(-3, -3.5); c.quadraticCurveTo(0, -1.5, 3, -3.5); c.strokeStyle = T.ol; c.lineWidth = 0.8; c.stroke();
    c.restore();
  }
  // 小史萊姆：水滴形
  function enMini(x, y, fr) {
    const sq = [1, 0.88, 1, 1.1][fr], hop = [0, 0, -1.5, -0.5][fr];
    shadow(x, y + 0.6, 5.2, 1.8);
    glow(x, y - 5, 8, T.enemyGlow, 0.3);
    c.save(); c.translate(x, y + hop); c.scale(1 + (1 - sq) * 0.8, sq);
    c.beginPath(); c.moveTo(0, -12); c.bezierCurveTo(2.5, -8, 6.2, -5.5, 6, -2); c.quadraticCurveTo(5.6, 0.8, 0, 0.8); c.quadraticCurveTo(-5.6, 0.8, -6, -2); c.bezierCurveTo(-6.2, -5.5, -2.5, -8, 0, -12); c.closePath();
    paint(lg(0, -12, 0, 1, T.mini));
    ell(-2.2, -5.5, 1.4, 0.9, -0.6); paint("rgba(255,255,255,.65)", null);
    for (const s of [-1, 1]) { circ(s * 1.9, -3.4, 1.05); paint(T.pupil, null); circ(s * 1.9 - 0.35, -3.8, 0.38); paint("#fff", null); }
    c.restore();
  }
  // 小青蛙（奧術塔變形結果）
  function enFrog(x, y, fr) {
    const hop = [0, -2.2, -1, 0][fr];
    shadow(x, y + 0.6, 6.5, 2);
    c.save(); c.translate(x, y + hop);
    for (const s of [-1, 1]) { ell(s * 5, -1.6, 2.8, 1.8); paint(T.frog[1]); }
    ell(0, -4, 6.5, 4.4); paint(lg(0, -8, 0, 0, [T.frog[0], T.frog[1]]));
    ell(0, -2.6, 4, 2.2); paint("#e8f4b0", null);
    for (const s of [-1, 1]) { circ(s * 3.2, -8, 2.2); paint(T.frog[0]); circ(s * 3.2, -8.2, 1.3); paint("#fff", null); circ(s * 3.2 + 0.2, -8, 0.7); paint(T.pupil, null); }
    c.beginPath(); c.moveTo(-3, -5); c.quadraticCurveTo(0, -3.4, 3, -5); c.strokeStyle = T.ol; c.lineWidth = 0.7; c.stroke();
    for (const s of [-1, 1]) { ell(s * 4.4, -4.6, 1.1, 0.6); paint("rgba(255,140,160,.75)", null); }
    c.restore();
  }
  // be 小怪：圓身小惡魔，一對角＋短尾
  function enImp(x, y, fr) {
    const bob = [0, -1, -1.4, -0.6][fr], sw = [0, 1, 0, -1][fr];
    shadow(x, y + 0.6, 6.5, 2.2);
    glow(x, y - 7, 11, T.enemyGlow, 0.3);
    c.save(); c.translate(x, y + bob);
    c.beginPath(); c.moveTo(5, -3); c.quadraticCurveTo(10, -2, 9.5 + sw * 0.5, -7); c.strokeStyle = T.ol; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = T.imp[1]; c.lineWidth = 1; c.stroke();
    poly([[9.5 + sw * 0.5, -9], [11 + sw * 0.5, -6.6], [8.4 + sw * 0.5, -6.6]]); paint(T.imp[1]);
    for (const s of [-1, 1]) { rr(s * 3 - 1.5, -2.5 - (s * sw > 0 ? 1 : 0), 3, 3, 1); paint(T.imp[2]); }
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5, -10); c.quadraticCurveTo(s * 10, -11, s * 10.5, -7.5); c.quadraticCurveTo(s * 8, -8.5, s * 5.5, -6.5); c.closePath(); paint(T.imp[2]); }
    circ(0, -7.5, 6.2); paint(sg3(0, 6.2, T.imp));
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.2, -12.6); c.quadraticCurveTo(s * 4.6, -15, s * 4.2, -17); c.quadraticCurveTo(s * 5.6, -14, s * 4.6, -12); c.closePath(); paint("#e8dcc8"); }
    gEyes(0, -8.4, 2.3, 1.3, 1.5);
    c.beginPath(); c.moveTo(-2.8, -4.8); c.quadraticCurveTo(0, -3, 2.8, -4.8); c.closePath(); paint("#1a0a20", T.ol, 0.5);
    poly([[1, -4.5], [1.8, -4.5], [1.4, -3.5]]); paint("#fff", null);
    c.restore();
  }
  // 隱形刺客：暗影兜帽、圍巾飄、窄眼（繪製時半透明）
  function enAssassin(x, y, fr) {
    const sw = [0, 1, 0, -1][fr];
    shadow(x, y + 0.6, 7.5, 2.4, T.shadowA * 0.6);
    glow(x, y - 12, 15, T.enemyGlow, 0.6);
    // 圍巾
    c.beginPath(); c.moveTo(x + 2, y - 15); c.quadraticCurveTo(x + 8, y - 15 + sw, x + 14, y - 12 + sw * 2); c.lineTo(x + 13, y - 9.5 + sw * 2); c.quadraticCurveTo(x + 8, y - 12, x + 2, y - 12.5); c.closePath(); paint(T.scarf);
    for (const s of [-1, 1]) { rr(x + s * 2.6 - 1.6, y - 6 - (s * sw > 0 ? 1.2 : 0), 3.2, 6.4, 1.2); paint(T.assassin[2]); }
    c.beginPath(); c.moveTo(x - 6, y - 4); c.quadraticCurveTo(x - 7, y - 14, x - 3, y - 19); c.lineTo(x + 3, y - 19); c.quadraticCurveTo(x + 7, y - 14, x + 6, y - 4); c.lineTo(x + 3, y - 2.5); c.lineTo(x, y - 4.5); c.lineTo(x - 3, y - 2.5); c.closePath(); paint(sg3(x, 7, T.assassin));
    // 匕首
    c.save(); c.translate(x - 6.5, y - 9); c.rotate(-0.6 - sw * 0.1); rr(-0.7, -7.5, 1.4, 7, 0.5); paint(T.blade, T.ol, 0.6); rr(-1.8, -0.6, 3.6, 1.2, 0.4); paint(T.scarf, T.ol, 0.4); c.restore();
    // 兜帽
    c.beginPath(); c.moveTo(x - 5.6, y - 17); c.quadraticCurveTo(x - 6, y - 25, x + 0.5, y - 27); c.quadraticCurveTo(x + 6, y - 25, x + 5.6, y - 17); c.quadraticCurveTo(x, y - 15.5, x - 5.6, y - 17); c.closePath(); paint(sg3(x, 6, T.assassin));
    ell(x, y - 20.5, 3.8, 3); paint("#05040a", null);
    for (const s of [-1, 1]) { glow(x + s * 1.5, y - 20.8, 4.5, T.eyeGlow, 1); poly([[x + s * 0.3, y - 21.6], [x + s * 3.2, y - 21.4], [x + s * 2.6, y - 20]]); paint(T.enemyEye, null); }
    // 暗影輪廓光（深色地面上也看得出來）
    c.beginPath(); c.moveTo(x - 5.6, y - 17); c.quadraticCurveTo(x - 6, y - 25, x + 0.5, y - 27); c.quadraticCurveTo(x + 6, y - 25, x + 5.6, y - 17); c.strokeStyle = "rgba(200,140,255,.75)"; c.lineWidth = 0.7; c.stroke();
  }
  // 治療祭司：白長袍、兜帽裡黃眼、光環、綠光法杖＋腳下治療光
  function enPriest(x, y, fr) {
    const bob = [0, -0.5, -1, -0.5][fr];
    if (!NOFX) { ell(x, y + 0.5, 13, 5); paint(rg(x, y + 0.5, 1, 13, [T.healGlow.replace("A", 0.45), T.healGlow.replace("A", 0)]), null); ell(x, y + 0.5, 11.5, 4.4); c.setLineDash([2, 2]); c.lineDashOffset = fr; c.strokeStyle = "rgba(170,255,190,.8)"; c.lineWidth = 0.8; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; }
    shadow(x, y + 0.6, 7.5, 2.4);
    c.save(); c.translate(0, bob);
    // 法杖
    limb([[x - 8, y + 0.5], [x - 8, y - 25]], T.woodLight, 1.1);
    glow(x - 8, y - 27.5, 8, T.healGlow, 0.8); circ(x - 8, y - 27.5, 2.6); paint(rg(x - 8.6, y - 28, 0.3, 2.6, ["#ffffff", T.heal, "#3aa860"]));
    c.beginPath(); c.arc(x - 8, y - 27.5, 3.8, PI * 0.8, PI * 2.2); c.strokeStyle = T.gold; c.lineWidth = 0.8; c.stroke();
    // 長袍
    c.beginPath(); c.moveTo(x - 4, y - 19); c.quadraticCurveTo(x - 7.5, y - 8, x - 8.5, y); c.quadraticCurveTo(x, y + 1.6, x + 8.5, y); c.quadraticCurveTo(x + 7.5, y - 8, x + 4, y - 19); c.closePath(); paint(sg3(x, 8.5, T.robe));
    rr(x - 1.3, y - 18, 2.6, 18, 0.6); paint(T.robeTrim, null);
    c.beginPath(); c.moveTo(x - 8.5, y); c.quadraticCurveTo(x, y + 1.6, x + 8.5, y); c.strokeStyle = T.robeTrim; c.lineWidth = 1.2; c.stroke();
    limb([[x - 4, y - 16], [x - 7.6, y - 12]], T.robe[1], 2.2);
    // 兜帽＋光環
    c.beginPath(); c.ellipse(x, y - 29.5, 5.2, 1.7, 0, 0, PI2); c.strokeStyle = T.ol; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = T.goldL; c.lineWidth = 1.1; c.stroke(); glow(x, y - 29.5, 7, T.bossAura, 0.5);
    c.beginPath(); c.moveTo(x - 5.4, y - 18); c.quadraticCurveTo(x - 6, y - 26, x, y - 27.5); c.quadraticCurveTo(x + 6, y - 26, x + 5.4, y - 18); c.quadraticCurveTo(x, y - 16.5, x - 5.4, y - 18); c.closePath(); paint(sg3(x, 6, T.robe));
    ell(x, y - 21.5, 3.6, 3); paint("#140a24", null);
    gEyes(x, y - 21.8, 1.4, 0.75, 0.75);
    c.restore();
    if (!NOFX) for (let i = 0; i < 3; i++) { const px = x + [-10, 9, 3][i], py = y - 6 - ((i * 7 + fr * 3) % 12); c.fillStyle = "rgba(190,255,200,.9)"; c.fillRect(px - 0.4, py - 1.6, 0.8, 3.2); c.fillRect(px - 1.6, py - 0.4, 3.2, 0.8); }
  }

  // ───── 魔王
  // 魔龍（一般魔王）與終極魔龍共用骨架，P 換配色與細節
  function dragon(x, y, fr, P) {
    const s = P.s, flap = [0, -3, -5, -2][fr] * (P.flap || 1);
    bossRing(x, y, 27 * s, P.ring || T.bossRing, P.ringFill || T.bossRingFill, fr);
    shadow(x, y + 1, 23 * s, 6.5 * s);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (P.rage && !NOFX) for (let i = 0; i < 6; i++) { const a = i * PI2 / 6 + fr * 0.5, fx = Math.cos(a) * 22, fy = -24 + Math.sin(a) * 14; glow(fx, fy, 6, T.dkGlow, 0.7); poly([[fx - 1.6, fy + 2], [fx, fy - 3.6], [fx + 1.6, fy + 2]]); paint("#ffd27a", null); }
    if (P.cracks || P.rage) glow(0, -22, 30, P.rage ? T.dkGlow : T.fireGlow, P.rage ? 0.55 : 0.3);
    // 尾巴
    limb([[5, -6], [15, -3], [23, -6], [26.5, -13]], P.body[1], 4.4);
    poly([[26.5, -19], [30, -12], [25, -11.5], [23, -14]]); paint(P.body[2]);
    // 翅膀
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 6, -30); c.lineTo(sd * 12, -40); c.quadraticCurveTo(sd * 22, -50 + flap, sd * 33, -52 + flap); c.quadraticCurveTo(sd * 30, -42 + flap * 0.6, sd * 31, -30 + flap * 0.4); c.quadraticCurveTo(sd * 27, -33, sd * 24, -29.5); c.quadraticCurveTo(sd * 22, -26.5, sd * 18, -23); c.quadraticCurveTo(sd * 14, -26, sd * 9, -22); c.closePath();
      paint(lg(0, -52, 0, -22, P.wing));
      c.beginPath(); for (const [ex, ey] of [[31, -30 + flap * 0.4], [24, -29.5], [18, -23]]) { c.moveTo(sd * 12, -40); c.lineTo(sd * ex, ey); } c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 0.8; c.stroke();
      limb([[sd * 6, -32], [sd * 12, -40], [sd * 22, -48 + flap * 0.8], [sd * 33, -52 + flap]], P.body[1], 1.6);
      poly([[sd * 33, -52 + flap], [sd * 36, -55 + flap], [sd * 34.5, -50 + flap]]); paint("#f0e6d0", T.ol, 0.6);
    }
    // 腳
    for (const sd of [-1, 1]) { ell(sd * 8, -6, 5.2, 6.6); paint(sg3(sd * 8, 5.2, P.body)); rr(sd * 8 - 4.2, -2, 8.4, 3.2, 1.6); paint(P.body[2]); for (let i = -1; i <= 1; i++) { poly([[sd * 8 + i * 2.6 - 0.8, 1], [sd * 8 + i * 2.6 + 0.8, 1], [sd * 8 + i * 2.6, 2.8]]); paint("#f0e6d0", null); } }
    // 身體
    c.beginPath(); c.moveTo(-10, -2); c.bezierCurveTo(-14.5, -14, -10.5, -30, 0, -32); c.bezierCurveTo(10.5, -30, 14.5, -14, 10, -2); c.quadraticCurveTo(0, 2, -10, -2); c.closePath(); paint(sg3(0, 12, P.body));
    c.beginPath(); c.moveTo(-6, -3); c.bezierCurveTo(-8, -12, -6, -24, 0, -26); c.bezierCurveTo(6, -24, 8, -12, 6, -3); c.quadraticCurveTo(0, 0, -6, -3); c.closePath(); paint(lg(0, -26, 0, 0, P.belly), null);
    for (let i = 1; i < 6; i++) { const yy = -3 - i * 4, w = 5 + Math.sin(i / 6 * PI) * 2; c.beginPath(); c.moveTo(-w, yy); c.quadraticCurveTo(0, yy + 1.4, w, yy); c.strokeStyle = "rgba(90,50,20,.45)"; c.lineWidth = 0.6; c.stroke(); }
    // 背刺
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const yy = -26 + i * 7; poly([[sd * (9.5 - i * 0.2), yy], [sd * (13 - i * 0.3), yy - 3], [sd * (10.6 - i * 0.2), yy + 2.4]]); paint(P.horn, T.ol, 0.6); }
    if (P.cracks) {
      const cr = [[[-7, -10], [-4, -14], [-6, -19]], [[7, -8], [4, -13], [6, -17], [3, -21]], [[-2, -28], [1, -24]], [[-9, -24], [-7, -28]], [[9, -22], [8, -27]]];
      for (const p of cr) { line(p, "#3a0a06", 2.6); line(p, P.cracks, 1.4); }
      glow(0, -15, 12, T.dkGlow, 0.7);
      for (const sd of [-1, 1]) line([[sd * 14, -38], [sd * 22, -45], [sd * 26, -40]], P.cracks, 0.9);
    }
    // 小手
    for (const sd of [-1, 1]) limb([[sd * 8, -21], [sd * 11.5, -15], [sd * 8.5, -11.5]], P.body[1], 2.6);
    // 脖子＋頭
    poly([[-5, -27], [-4, -37], [4, -37], [5, -27]]); paint(P.body[1]);
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 3.5, -46.5); c.quadraticCurveTo(sd * 9.5, -50.5, sd * 11, -58); c.quadraticCurveTo(sd * 7, -51.5, sd * 2, -44.5); c.closePath(); paint(P.horn); }
    union([() => ell(0, -44, 7, 5.4), () => rr(-4.8, -44, 9.6, 8, 3.4)], P.body[0]);
    rr(-4, -39.4, 8, 3.6, 1.6); paint(P.belly[0], null);
    for (const sd of [-1, 1]) { circ(sd * 1.6, -38.6, 0.55); paint(T.ol, null); }
    for (const sd of [-1, 1]) { glow(sd * 3, -45, 4.6, P.rage ? T.dkGlow : T.eyeGlow, 0.85); poly([[sd * 1, -46], [sd * 5.6, -46.8], [sd * 4.6, -44]]); paint(P.rage ? "#fff0d0" : T.enemyEye, T.ol, 0.6); }
    c.strokeStyle = T.ol; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-6, -48.4); c.lineTo(-1, -47); c.moveTo(6, -48.4); c.lineTo(1, -47); c.stroke();
    if (P.fire) { c.beginPath(); c.moveTo(-3.4, -37); c.quadraticCurveTo(0, -33.6, 3.4, -37); c.closePath(); paint("#3a0a06", T.ol, 0.6); glow(0, -35, 7, T.fireGlow, 0.9); poly([[-1.6, -36], [0, -31.5 - fr], [1.6, -36]]); paint("#ffd27a", null); }
    else { c.beginPath(); c.moveTo(-3.4, -37); c.lineTo(3.4, -37); c.strokeStyle = T.ol; c.lineWidth = 0.8; c.stroke(); }
    if (P.crown) { poly([[-5.5, -48], [-5.5, -52.5], [-3.2, -50], [-1.5, -54], [0, -50.4], [1.5, -54], [3.2, -50], [5.5, -52.5], [5.5, -48]]); paint(lg(0, -54, 0, -48, [T.goldL, T.bronze[2]])); circ(0, -49.6, 0.9); paint("#ff4a5a", null); }
    c.restore();
  }
  function enBoss(x, y, fr) { dragon(x, y, fr, { s: 1, body: T.drag, belly: T.dragBelly, wing: T.dragWing, horn: "#f0e2c4" }); }
  function enDragonKing(x, y, fr, ph) {
    ph = Math.max(1, Math.min(3, ph || 1));
    dragon(x, y, fr, { s: 1.08, body: ph >= 3 ? ["#d0503c", "#7a1c1c", "#300808"] : T.dk, belly: T.dkBelly, wing: ph >= 3 ? ["#a83020", "#3a0808"] : T.dkWing, horn: T.gold, crown: true, flap: ph === 1 ? 0.5 : ph === 2 ? 1 : 1.4,
      cracks: ph >= 2 ? T.dkCrack : null, fire: ph >= 2, rage: ph >= 3, ring: ph >= 3 ? "#ff8a4a" : T.bossRing, ringFill: ph >= 3 ? "rgba(255,90,40,.36)" : T.bossRingFill });
  }
  // Be 巨人：渾圓土石巨人、胸口刻著發光的 BE、大拳頭
  function enGiant(x, y, fr) {
    const sw = [0, 1, 0, -1][fr];
    bossRing(x, y, 25, T.bossRing, T.bossRingFill, fr);
    shadow(x, y + 1, 20, 6);
    for (const s of [-1, 1]) { rr(x + s * 7 - 4.5, y - 9.5 - (s * sw > 0 ? 1.4 : 0), 9, 10, 3); paint(sg3(x + s * 7, 4.5, T.giant)); }
    c.save(); c.translate(x, y - 6); c.rotate(sw * 0.03); c.translate(-x, -(y - 6));
    for (const s of [-1, 1]) { circ(x + s * 15, y - 32, 6.5); paint(sg3(x + s * 15, 6.5, T.giant)); limb([[x + s * 17, y - 28], [x + s * 19.5, y - 17 + s * sw]], T.giant[1], 5); }
    c.beginPath(); c.moveTo(x - 15, y - 8); c.bezierCurveTo(x - 20.5, y - 24, x - 14, y - 40, x, y - 41); c.bezierCurveTo(x + 14, y - 40, x + 20.5, y - 24, x + 15, y - 8); c.quadraticCurveTo(x, y - 3, x - 15, y - 8); c.closePath(); paint(sg3(x, 18, T.giant));
    for (const p of [[[-12, -30], [-8, -27], [-9, -21]], [[10, -33], [13, -27]], [[7, -12], [11, -9]], [[-11, -14], [-7, -11]]]) line(p.map(([a, b2]) => [x + a, y + b2]), "rgba(30,20,10,.5)", 0.8);
    ell(x - 9, y - 35, 4.5, 2); paint(T.moss, null); ell(x + 11, y - 14, 3, 1.4); paint(T.moss, null);
    glow(x, y - 22, 13, T.giantGlow, 0.75);
    c.font = "900 12px Georgia,'Times New Roman',serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.lineWidth = 2.6; c.strokeStyle = "#3a1e08"; c.strokeText("BE", x, y - 21.5); c.fillStyle = T.giantRune; c.fillText("BE", x, y - 21.5);
    rr(x - 6.5, y - 48, 13, 10, 4.5); paint(sg3(x, 6.5, T.giant));
    rr(x - 6, y - 45.5, 12, 1.8, 0.8); paint(T.giant[2], null);
    gEyes(x, y - 42.8, 2.7, 1.4, 0.9);
    for (const s of [-1, 1]) { circ(x + s * 19.5, y - 13 + s * sw, 6.4); paint(sg3(x + s * 19.5, 6.4, T.giant)); line([[x + s * 17, y - 15 + s * sw], [x + s * 21, y - 15.5 + s * sw]], "rgba(30,20,10,.5)", 0.7); }
    c.restore();
    if (!NOFX) for (let i = 0; i < 3; i++) { const a = fr * 0.5 + i * 2.1, px = x + Math.cos(a) * 24, py = y - 30 + Math.sin(a) * 8; poly([[px - 2, py], [px - 0.6, py - 2], [px + 2, py - 1], [px + 1, py + 1.4]]); paint(T.giant[1], T.ol, 0.6); }
  }
  // 時光樹妖（樣稿 B，搬過來；樹枝隨幀擺動）
  function enTreant(x, y, fr) {
    const sw = [0, 1, 0, -1][fr];
    bossRing(x, y, 25, T.bossRing, T.bossRingFill, fr);
    glow(x, y - 4, 34, T.bossAura, 0.4);
    shadow(x, y + 1, 17, 5.5);
    for (const [dx, ex] of [[-9, -17], [-4, -9], [4, 8], [9, 17]]) { c.beginPath(); c.moveTo(x + dx - 2.5, y - 5); c.quadraticCurveTo(x + (dx + ex) / 2, y - 1, x + ex, y + 2.5); c.quadraticCurveTo(x + (dx + ex) / 2 + 1, y - 3.5, x + dx + 2.5, y - 6); c.closePath(); paint(T.bark[1]); }
    for (const s of [-1, 1]) {
      const o = s * sw * 1.4;
      c.beginPath(); c.moveTo(x + s * 8, y - 22); c.quadraticCurveTo(x + s * 18, y - 24, x + s * 21, y - 34 + o); c.lineTo(x + s * 23.5, y - 32.5 + o); c.quadraticCurveTo(x + s * 20, y - 21, x + s * 9, y - 17); c.closePath(); paint(T.bark[1]);
      for (const [a, b2] of [[[21, -34], [19, -40]], [[22.5, -33], [27, -37]], [[22.8, -32.6], [26, -30]]]) limb([[x + s * a[0], y + a[1] + o], [x + s * b2[0], y + b2[1] + o * 1.4]], T.bark[1], 1.2);
    }
    union([() => circ(x - 12, y - 38, 9), () => circ(x + 12, y - 38, 9), () => circ(x, y - 45, 12), () => circ(x - 6, y - 33, 8), () => circ(x + 6, y - 33, 8)], T.bossLeaf[1]);
    circ(x - 4, y - 48, 6.5); paint(T.bossLeaf[0], null); circ(x - 13, y - 40, 4.5); paint(T.bossLeaf[0], null);
    for (const [dx, dy] of [[-9, -44], [8, -47], [13, -36], [-1, -38]]) { circ(x + dx, y + dy, 1.4); paint(T.bossBloom, null); }
    c.beginPath(); c.moveTo(x - 12.5, y - 3); c.quadraticCurveTo(x - 9, y - 14, x - 9.5, y - 30); c.lineTo(x + 9.5, y - 30); c.quadraticCurveTo(x + 9, y - 14, x + 12.5, y - 3); c.quadraticCurveTo(x, y + 1, x - 12.5, y - 3); c.closePath();
    paint(sg3(x, 12, T.bark));
    for (const [x1, y1, x2, y2] of [[-6, -27, -5, -20], [6, -26, 5.5, -19], [-7, -10, -5, -4], [7, -11, 5, -5]]) { c.beginPath(); c.moveTo(x + x1, y + y1); c.lineTo(x + x2, y + y2); c.strokeStyle = T.barkLine; c.lineWidth = 0.7; c.stroke(); }
    for (const s of [-1, 1]) { glow(x + s * 4, y - 22, 5, T.eyeGlow, 0.8); poly([[x + s * 1.6, y - 23.5], [x + s * 6.6, y - 24.5], [x + s * 5.5, y - 21]]); paint(T.bossEye, T.ol, 0.6); }
    c.beginPath(); c.moveTo(x - 4.5, y - 16.5); c.lineTo(x - 2.5, y - 14.5); c.lineTo(x - 1, y - 16); c.lineTo(x + 1, y - 14.3); c.lineTo(x + 2.6, y - 16); c.lineTo(x + 4.5, y - 15.8); c.lineTo(x + 2.5, y - 12.5); c.lineTo(x - 2.5, y - 12.5); c.closePath(); paint(T.bossMouth);
    glow(x, y - 7, 7, T.bossAura, 0.6);
    circ(x, y - 7, 4.4); paint(T.clockFace, T.gold, 1.2);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; circ(x + Math.cos(a) * 3.2, y - 7 + Math.sin(a) * 3.2, 0.45); paint(T.ol, null); }
    const ha = fr * PI / 2; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + Math.sin(ha) * 3, y - 7 - Math.cos(ha) * 3); c.moveTo(x, y - 7); c.lineTo(x + 2.2, y - 6); c.strokeStyle = T.ol; c.lineWidth = 0.9; c.stroke();
    if (!NOFX) for (const [dx, dy, s] of [[-24, -14, 1.3], [23, -18, 1.1], [-19, -50, 1], [21, -50, 1.2]]) { const yy = dy + (fr % 2 ? -1 : 0); glow(x + dx, y + yy, 4, T.bossAura, 0.6); poly([[x + dx, y + yy - 2 * s], [x + dx + 1.2 * s, y + yy], [x + dx, y + yy + 2 * s], [x + dx - 1.2 * s, y + yy]]); paint(T.gold, null); }
  }
  // 沼澤九頭蛇：盤繞的身體＋n 顆頭（依 st.heads；預設 3）
  function enHydra(x, y, fr, n) {
    n = Math.max(1, Math.min(7, n || 3));
    bossRing(x, y, 26, T.bossRing, T.bossRingFill, fr);
    shadow(x, y + 1, 22, 6.5);
    limb([[x - 12, y - 2], [x - 21, y - 1], [x - 25, y - 6], [x - 22, y - 10.5]], T.hyd[1], 3.6);
    for (const [cy, rx, ry] of [[-3.5, 19, 7], [-10, 15.5, 6], [-16, 11.5, 5]]) {
      ell(x, y + cy, rx, ry); paint(sg3(x, rx, T.hyd));
      c.beginPath(); c.ellipse(x, y + cy + ry * 0.25, rx * 0.72, ry * 0.62, 0, 0.18 * PI, 0.82 * PI); c.strokeStyle = T.hydBelly; c.lineWidth = 1.6; c.stroke();
      for (let i = -2; i <= 2; i++) { circ(x + i * rx * 0.28, y + cy - ry * 0.45, 0.8); paint(T.hyd[0], null); }
    }
    const spread = n === 1 ? 0 : Math.min(1.15, 0.38 * (n - 1)), hs = [];
    for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread; hs.push({ a, i }); }
    hs.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
    for (const { a, i } of hs) {
      const sway = Math.sin(fr * PI / 2 + i * 1.7) * 1.6;
      const hx = x + Math.sin(a) * 25 + sway, hy = y - 41 + Math.abs(a) * 10 - ((i % 2) ? 2.5 : 0);
      const bx = x + Math.sin(a) * 5, by = y - 17, cx = x + Math.sin(a) * 19, cy = y - 24;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(cx, cy, hx, hy + 3); c.strokeStyle = T.ol; c.lineWidth = 8.8; c.stroke(); c.strokeStyle = T.hyd[1]; c.lineWidth = 6.4; c.stroke();
      c.beginPath(); c.moveTo(bx + 1.2, by); c.quadraticCurveTo(cx + 1.2, cy, hx + 1, hy + 3); c.strokeStyle = T.hydBelly; c.lineWidth = 1.8; c.stroke();
      c.save(); c.translate(hx, hy); c.rotate(Math.sin(a) * 0.45); c.scale(1.15, 1.15);
      for (let k = 0; k < 3; k++) { poly([[-3 + k * 3, -3.6], [-2 + k * 3, -7.5 + Math.abs(k - 1)], [-0.5 + k * 3, -3.4]]); paint("#c04a7a", T.ol, 0.6); }
      union([() => ell(0, -0.5, 5.4, 4), () => ell(0, 3, 3.8, 3)], T.hyd[0]);
      gEyes(0, -1.2, 2.5, 1.15, 0.9);
      c.strokeStyle = T.ol; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-4, -3); c.lineTo(-1.2, -2.2); c.moveTo(4, -3); c.lineTo(1.2, -2.2); c.stroke();
      c.beginPath(); c.moveTo(-2.6, 3.4); c.quadraticCurveTo(0, 6.8, 2.6, 3.4); c.closePath(); paint("#3a0a1a", T.ol, 0.6);
      for (const s of [-1, 1]) { poly([[s * 1.8, 3.6], [s * 1.1, 3.6], [s * 1.45, 5.2]]); paint("#fff", null); }
      c.restore();
    }
  }
  // 冰霜巫妖：漂浮骷髏法師、冰晶王冠、冰杖、冰藍魂火眼
  function enLich(x, y, fr) {
    const fy = y - 8 + [0, -1, -1.6, -1][fr];
    if (!NOFX) {
      ell(x, y + 1, 23, 9.2); paint(rg(x, y + 1, 3, 23, [T.soulGlow.replace("A", 0.4), T.soulGlow.replace("A", 0)]), null);
      ell(x, y + 1, 21, 8.4); c.strokeStyle = T.soul; c.lineWidth = 1.2; c.stroke();
      for (let i = 0; i < 6; i++) { const a = i * PI / 3 + fr * 0.26; snowflake(x + Math.cos(a) * 21, y + 1 + Math.sin(a) * 8.4, 1.6, T.soul, 0.5); }
    }
    shadow(x, y + 1, 12, 3.6, 0.35);
    glow(x, fy - 22, 26, T.soulGlow, 0.35);
    // 冰杖
    limb([[x + 12, fy + 2], [x + 12, fy - 40]], "#5a6aa0", 1.3);
    glow(x + 12, fy - 44, 9, T.soulGlow, 0.9);
    crystal(x + 12, fy - 39, 4.6, 10, 0, [T.ice[0], T.soul]);
    for (const s of [-1, 1]) crystal(x + 12 + s * 2.6, fy - 38.5, 2.4, 6, s * 0.6, [T.ice[0], T.ice[1]]);
    // 長袍（破爛下擺）
    c.beginPath(); c.moveTo(x - 7, fy - 31); c.quadraticCurveTo(x - 13, fy - 16, x - 14, fy);
    for (let i = 1; i <= 7; i++) c.lineTo(x - 14 + i * 4, fy + (i % 2 ? -3.6 : 1.2));
    c.quadraticCurveTo(x + 13, fy - 16, x + 7, fy - 31); c.closePath(); paint(sg3(x, 14, T.lich));
    poly([[x - 3, fy - 28], [x + 3, fy - 28], [x + 5, fy - 2], [x, fy + 0.6], [x - 5, fy - 2]]); paint(T.lich[2], null);
    for (let i = 0; i < 3; i++) { const yy = fy - 22 + i * 7; line([[x - 2, yy], [x + 2, yy - 1.5], [x - 1, yy - 3]], T.soul, 0.8); }
    rr(x - 9, fy - 19, 18, 2.2, 1); paint(T.soul, T.ol, 0.6);
    // 手
    limb([[x + 6, fy - 25], [x + 10.5, fy - 19]], T.lich[1], 3.4); circ(x + 11.6, fy - 19, 1.8); paint(T.bone[0]);
    limb([[x - 6, fy - 25], [x - 12, fy - 22]], T.lich[1], 3.4); circ(x - 13.4, fy - 22.4, 1.8); paint(T.bone[0]);
    glow(x - 15, fy - 24, 7, T.soulGlow, 0.9); circ(x - 15, fy - 24.5, 1.7); paint("#e8fbff", null);
    // 肩刺
    for (const s of [-1, 1]) { ell(x + s * 7, fy - 29.5, 4.4, 3); paint(T.lich[0]); crystal(x + s * 8.6, fy - 30.5, 2.6, 6, s * 0.7, [T.ice[0], T.ice[1]]); }
    // 兜帽＋骷髏
    c.beginPath(); c.moveTo(x - 7.5, fy - 29); c.quadraticCurveTo(x - 8, fy - 42, x, fy - 44); c.quadraticCurveTo(x + 8, fy - 42, x + 7.5, fy - 29); c.closePath(); paint(T.lich[2]);
    circ(x, fy - 36.5, 5.3); paint(lg(x, fy - 42, x, fy - 31, T.bone));
    rr(x - 3.2, fy - 33, 6.4, 3.6, 1.2); paint(T.bone[1]);
    for (let i = -1; i <= 1; i++) line([[x + i * 1.4, fy - 32.6], [x + i * 1.4, fy - 29.8]], T.ol, 0.5);
    for (const s of [-1, 1]) { ell(x + s * 2.2, fy - 36.8, 1.6, 1.8); paint("#06101e", null); glow(x + s * 2.2, fy - 36.8, 4, T.soulGlow, 1); circ(x + s * 2.2, fy - 36.8, 0.7); paint(T.soul, null); }
    poly([[x, fy - 35], [x - 0.8, fy - 33.6], [x + 0.8, fy - 33.6]]); paint("#06101e", null);
    // 冰晶王冠
    for (const [dx, h, a] of [[-4, 5, -0.4], [-2, 6.5, -0.15], [0, 8, 0], [2, 6.5, 0.15], [4, 5, 0.4]]) crystal(x + dx, fy - 40.5, 2, h, a, [T.ice[0], T.soul]);
    if (!NOFX) for (let i = 0; i < 3; i++) { const a = fr * PI / 2 + i * PI2 / 3, px = x + Math.cos(a) * 17, py = fy - 20 + Math.sin(a) * 6; crystal(px, py, 2.4, 5, a, [T.ice[0], T.ice[1]]); }
  }

  // 敵人登錄：fn、框（錨點＝腳底）、腳底偏移、身體範圍（凍結殼／護盾用）
  const EN = {
    slime:    { fn: enSlime, box: { w: 30, h: 28, ox: 15, oy: 22 }, foot: 5, body: { w: 20, h: 16, b: 0 }, fps: 6 },
    bat:      { fn: enBat, box: { w: 38, h: 34, ox: 19, oy: 28 }, foot: 7, body: { w: 26, h: 16, b: -5 }, fps: 9, fly: true },
    golem:    { fn: enGolem, box: { w: 40, h: 38, ox: 20, oy: 32 }, foot: 8, body: { w: 28, h: 26, b: 0 }, fps: 4 },
    elite:    { fn: enElite, box: { w: 36, h: 44, ox: 18, oy: 39 }, foot: 8, body: { w: 24, h: 30, b: 0 }, fps: 5, v: st => { const m = /[A-Za-z]/.exec(String(st.letter || "")); return m ? m[0].toUpperCase() : ""; } },
    goblin:   { fn: enGoblin, box: { w: 46, h: 50, ox: 21, oy: 44 }, foot: 7, body: { w: 24, h: 26, b: 0 }, fps: 6 },
    splitter: { fn: enSplitter, box: { w: 34, h: 28, ox: 17, oy: 23 }, foot: 6, body: { w: 26, h: 18, b: 0 }, fps: 5 },
    mini:     { fn: enMini, box: { w: 20, h: 22, ox: 10, oy: 18 }, foot: 4, body: { w: 13, h: 13, b: 0 }, fps: 8 },
    frog:     { fn: enFrog, box: { w: 22, h: 20, ox: 11, oy: 16 }, foot: 4, body: { w: 15, h: 12, b: 0 }, fps: 6 },
    beMinion: { fn: enImp, box: { w: 28, h: 28, ox: 14, oy: 23 }, foot: 5, body: { w: 18, h: 18, b: 0 }, fps: 7 },
    assassin: { fn: enAssassin, box: { w: 38, h: 34, ox: 18, oy: 30 }, foot: 6, body: { w: 16, h: 27, b: 0 }, fps: 8, alpha: true },
    priest:   { fn: enPriest, box: { w: 36, h: 44, ox: 18, oy: 38 }, foot: 7, body: { w: 20, h: 30, b: 0 }, fps: 4 },
    boss:     { fn: enBoss, box: { w: 86, h: 82, ox: 43, oy: 68 }, foot: 16, body: { w: 40, h: 54, b: 0 }, fps: 5, boss: true },
    beGiant:  { fn: enGiant, box: { w: 72, h: 70, ox: 36, oy: 58 }, foot: 15, body: { w: 44, h: 48, b: 0 }, fps: 3, boss: true },
    treant:   { fn: enTreant, box: { w: 72, h: 78, ox: 36, oy: 66 }, foot: 15, body: { w: 46, h: 58, b: 0 }, fps: 3, boss: true },
    hydra:    { fn: enHydra, box: { w: 80, h: 76, ox: 40, oy: 62 }, foot: 15, body: { w: 50, h: 52, b: 0 }, fps: 4, boss: true, v: st => st.heads > 0 ? Math.min(7, st.heads | 0 || 1) : st.heads === 0 ? 1 : 3 },
    lich:     { fn: enLich, box: { w: 58, h: 74, ox: 29, oy: 62 }, foot: 14, body: { w: 30, h: 50, b: -6 }, fps: 4, boss: true },
    dragonKing: { fn: enDragonKing, box: { w: 100, h: 94, ox: 50, oy: 78 }, foot: 19, body: { w: 46, h: 64, b: 0 }, fps: 5, boss: true, v: st => Math.max(1, Math.min(3, st.phase || 1)) }
  };
  ART.ENEMY_DEFS = EN;
  // 11-25 關卡魔王（老闆裁示：每關一隻大魔王、放大改造）：拿現有怪的畫法放大 s 倍＋專屬色調＋腳下光環＋王冠。
  //   o = { scale, color（色調）, aura（光環色）}；mods/stageboss.js 登錄怪物資料、mods/stageboss.ui.js 開局時呼叫本函式。
  ART.defStageBoss = function (id, base, o) {
    o = o || {};
    const b = EN[base] || EN.slime, s = o.scale || 2, col = o.color || "rgba(255,200,80,.28)", au = o.aura || "#ffd75e";
    const top = (b.body.b - b.body.h) * s, padT = 16, arx = b.body.w * s * 0.62 + 3, ary = b.body.w * s * 0.2 + 2;
    // 王冠戴在「頭頂」：量原型頭部一條窄帶（避開騎士的槍、祭司的杖；哥布林的牌子伸到頭的正上方，改量頭的左半邊）最高的不透明點，每幀量一次（蝙蝠上下飄、王冠跟著動）；量不到就用身體範圍頂端
    const cx0 = base === "goblin" ? -4.5 : -2.5, sink = base === "priest" ? 7 : 2.5;   // 祭司兜帽頂是尖的：王冠往下套深一點，不要頂在尖端上飄著
    const headTop = (fr, v) => { const r = measureBox("crown|" + base + "|" + fr + "|" + v, () => b.fn(0, 0, fr, v), cx0, -b.box.oy - 4, 3.5, b.box.oy + 4); return r ? r.y * s : top; };
    EN[id] = {
      fn: (x, y, fr, v) => {
        if (!NOFX) { ell(x, y + 1, arx, ary); paint("rgba(0,0,0,.18)", au, 1.4); }
        c.save(); c.translate(x, y); c.scale(s, s); b.fn(0, 0, fr, v); c.restore();
        if (!NOFX && col) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = col; c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); }
        c.save(); c.translate(x, y + headTop(fr, v) - 5 + sink); c.scale(1.25, 1.25); crownG(); c.restore();
      },
      // 框：下緣要包住腳下光環（分裂史萊姆原本被切掉光環底邊）
      box: { w: Math.ceil(Math.max(b.box.ox * s, arx)) + Math.ceil(Math.max((b.box.w - b.box.ox) * s, arx)) + 8, h: Math.ceil(b.box.oy * s) + padT + Math.ceil(Math.max((b.box.h - b.box.oy) * s, ary + 2.5)) + 4, ox: Math.ceil(Math.max(b.box.ox * s, arx)) + 4, oy: Math.ceil(b.box.oy * s) + padT },
      // 身體範圍往上多算 12（含王冠）：頭上血條不壓王冠、圖示不切掉王冠
      foot: b.foot * s, body: { w: b.body.w * s, h: b.body.h * s + 12, b: b.body.b * s }, fps: b.fps, boss: true, fly: b.fly, v: b.v, alpha: b.alpha, sboss: base
    };
    return EN[id];
  };
  // 11-25 超大魔王（每區最後一關）：原本的區域魔王畫大一點（只放大一次）
  ART.superBoss = function (id, k) {
    const d = EN[id]; if (!d || d.superK) return;
    k = k || 1.25; const fn = d.fn;
    d.fn = (x, y, fr, v) => { c.save(); c.translate(x, y); c.scale(k, k); fn(0, 0, fr, v); c.restore(); };
    // 框四周多留一點（原本的框貼著腳下光環，放大後光環底邊被切）
    d.box = { w: Math.ceil(d.box.w * k) + 8, h: Math.ceil(d.box.h * k) + 16, ox: Math.ceil(d.box.ox * k) + 4, oy: Math.ceil(d.box.oy * k) + 2 };
    d.foot *= k; d.body = { w: d.body.w * k, h: d.body.h * k, b: d.body.b * k }; d.superK = k;
    if (typeof ART.clearCache === "function") ART.clearCache();
  };
  // 凍結冰殼、減速藍霧、護盾泡泡
  function iceShell(bd) {
    const w = bd.w, h = bd.h, b = bd.b;
    const P = [[-w / 2 - 1, b + 1.5], [-w / 2 - 2.5, b - h * 0.45], [-w / 2 + w * 0.12, b - h - 1.5], [w * 0.04, b - h - 3.5], [w / 2 - w * 0.12, b - h - 1], [w / 2 + 2.5, b - h * 0.5], [w / 2 + 1, b + 1.5], [0, b + 3]];
    poly(P); paint("rgba(175,228,255,.40)", "rgba(240,252,255,.95)", 0.9);
    line([[-w / 2 + w * 0.12, b - h - 1.5], [-w * 0.1, b - h * 0.5], [0, b + 3]], "rgba(255,255,255,.55)", 0.6);
    line([[w * 0.04, b - h - 3.5], [w * 0.15, b - h * 0.45], [w / 2 + 1, b + 1.5]], "rgba(255,255,255,.4)", 0.6);
    line([[-w / 2 - 1, b - h * 0.2], [-w * 0.3, b - h * 0.85]], "rgba(255,255,255,.85)", 1.1);
    for (const [dx, dy] of [[-w * 0.3, -h * 0.75], [w * 0.28, -h * 0.3]]) { c.save(); c.translate(dx, b + dy); c.fillStyle = "#fff"; c.fillRect(-0.3, -1.6, 0.6, 3.2); c.fillRect(-1.6, -0.3, 3.2, 0.6); c.restore(); }
  }
  function slowMist(w) {
    ell(0, 0, w * 0.62, w * 0.22); paint(rg(0, 0, 1, w * 0.62, ["rgba(120,190,255,.55)", "rgba(120,190,255,0)"]), null);
    for (const [dx, r, a0] of [[-w * 0.25, w * 0.18, 3.6], [w * 0.22, w * 0.16, 0.2], [0, w * 0.22, 4.6]]) { c.beginPath(); c.arc(dx, -w * 0.12, r, a0, a0 + 2.4); c.strokeStyle = "rgba(170,220,255,.85)"; c.lineWidth = 0.8; c.stroke(); }
  }
  function shieldBubble(r) {
    circ(0, 0, r); paint(rg(0, 0, r * 0.55, r, ["rgba(124,200,255,0)", "rgba(124,200,255,.32)"]), null);
    circ(0, 0, r); c.strokeStyle = "rgba(170,225,255,.95)"; c.lineWidth = 1.1; c.stroke();
    c.beginPath(); c.arc(0, 0, r - 2, PI * 1.1, PI * 1.45); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 1.1; c.stroke();
    for (let i = 0; i < 6; i++) { const a = i * PI / 3 + 0.3; c.beginPath(); for (let k = 0; k < 6; k++) { const b2 = k * PI / 3; c.lineTo(Math.cos(a) * r * 0.78 + Math.cos(b2) * 1.6, Math.sin(a) * r * 0.78 + Math.sin(b2) * 1.6); } c.closePath(); c.strokeStyle = "rgba(170,225,255,.6)"; c.lineWidth = 0.5; c.stroke(); }
  }
  // ═════ 區域變體（第二刀）：一般怪依 ART.setRegion 的區域加配件＋偏色＋描邊；剪影不變（玩家仍認得種類）
  // 0 草原＝頭上小草葉；1 森林＝原樣；2 沼澤＝苔蘚＋水滴、偏綠紫、亮描邊；3 冰原＝積雪＋冰晶、偏藍紫、深描邊＋身下深影；4 火山＝熔岩裂紋發光、偏紅紫、亮描邊
  const RV = [
    { deco: "leaf" },
    null,
    { deco: "moss", tint: "rgba(70,170,80,.2)", rim: "rgba(214,255,180,.92)", ring: "rgba(210,255,170,A)" },
    { deco: "snow", tint: "rgba(80,120,255,.22)", rim: "rgba(14,20,52,.8)", contact: "rgba(12,22,58,.38)" },
    { deco: "lava", tint: "rgba(255,70,40,.2)", rim: "rgba(255,200,140,.9)", ring: "rgba(255,170,90,A)" }
  ];
  // 各怪的配件錨點（腳底原點；隨走路幀變）：caps＝頭頂（積雪／苔蘚／草葉）[x,y,半寬]；spots＝身上（裂紋／冰晶／苔斑）[x,y]
  const ANCH = {
    slime: fr => { const sq = [1, 0.9, 1, 1.08][fr], hop = [0, 0, -1.6, -0.6][fr], sx = 1.1 * (1 + (1 - sq) * 0.8), sy = 1.1 * sq; return { caps: [[0, hop - 13.3 * sy, 4.6 * sx]], spots: [[-5.6 * sx, hop - 2.8 * sy, 0.85], [5.4 * sx, hop - 2.4 * sy, 0.85]] }; },
    bat: fr => { const by = -13 + [0, 1, 1.6, 0.6][fr]; return { caps: [[0, by - 4.7, 3]], spots: [[0.4, by + 3, 0.55]] }; },
    golem: fr => { const sw = [0, 1, 0, -1][fr]; return { caps: [[0, -24.4, 4.8], [-11, -16 + (-sw < 0 ? 0.8 : 0), 3], [11, -16 + (sw < 0 ? 0.8 : 0), 3]], spots: [[-4, -8], [4.5, -15]] }; },
    elite: () => ({ caps: [[0, -27.6, 4], [6.5, -19.8, 2.8]], spots: [[3, -12.5], [1.5, -5]] }),
    goblin: fr => { const bob = [0, -1, 0, -1][fr]; return { caps: [[0, -23.6 + bob, 4.4], [9.5, -39.6 + bob, 8.6, 1]], spots: [[-1.5, -10 + bob], [2.5, -12.5 + bob]] }; },
    splitter: fr => { const sq = [1, 0.92, 1, 1.06][fr], sx = 1 + (1 - sq) * 0.7; return { caps: [[-5 * sx, -16.2 * sq, 3.8 * sx], [5 * sx, -16.2 * sq, 3.8 * sx]], spots: [[-8 * sx, -4.5 * sq], [8.5 * sx, -5 * sq]] }; },
    mini: fr => { const sq = [1, 0.88, 1, 1.1][fr], hop = [0, 0, -1.5, -0.5][fr], sx = 1 + (1 - sq) * 0.8; return { caps: [[0, hop - 10.6 * sq, 2.6 * sx]], spots: [[3 * sx, hop - 1.6 * sq, 0.6]] }; },
    beMinion: fr => { const bob = [0, -1, -1.4, -0.6][fr]; return { caps: [[0, -13.3 + bob, 4.2]], spots: [[-4.4, -5 + bob, 0.7], [4.6, -5.4 + bob, 0.7]] }; },
    assassin: () => ({ caps: [[0.5, -26.6, 4.4]], spots: [[-3, -9], [3.2, -12]] }),
    priest: fr => { const bob = [0, -0.5, -1, -0.5][fr]; return { caps: [[0, -27.2 + bob, 4.4]], spots: [[-4.2, -5 + bob], [4.4, -9 + bob]] }; }
  };
  ART.REGION_ENEMIES = Object.keys(ANCH);
  const MOSS = ["#a8d860", "#5e9a3a", "#2e5a22"];
  // flat＝牌子之類的平頂（只鋪一條薄邊，不蓋住牌面）
  function decoCap(kind, x, y, w, fr, i, flat) {
    if (kind === "leaf") {
      if (i) return;   // 草原只在頭上插一片
      line([[x, y + 0.6], [x + 0.6, y - 2.6]], T.ol, 1.5); line([[x, y + 0.6], [x + 0.6, y - 2.6]], "#3e7a34", 0.6);
      for (const s of [-1, 1]) { ell(x + 0.6 + s * 1.9, y - 2.6 - (s > 0 ? 0.7 : 0), 2, 0.95, s * -0.5); paint(s > 0 ? "#9ad86c" : "#6cb450", T.ol, 0.55); }
    } else if (kind === "snow") {
      if (flat) {
        union([() => rr(x - w * 1.04, y - 0.9, w * 2.08, 1.8, 0.9), () => circ(x - w * 0.5, y - 0.8, 1.2), () => circ(x + w * 0.15, y - 0.9, 1.4), () => circ(x + w * 0.7, y - 0.6, 1)], "#f8fcff", 0.5);
        for (const dx of [-0.75, 0.1, 0.8]) { const ix = x + w * dx; poly([[ix - 0.6, y + 0.8], [ix + 0.6, y + 0.8], [ix, y + 2.3]]); paint("#dff4ff", T.ol, 0.4); }
        return;
      }
      union([() => ell(x, y + 0.5, w * 1.12, w * 0.4), () => circ(x - w * 0.45, y - 0.05, w * 0.46), () => circ(x + w * 0.32, y - 0.35, w * 0.56)], "#f8fcff", 0.5);
      c.beginPath(); c.ellipse(x, y + 0.45, w * 1.0, w * 0.26, 0, 0.15, PI - 0.15); c.strokeStyle = "rgba(140,190,230,.9)"; c.lineWidth = 0.6; c.stroke();
      circ(x + w * 0.2, y - w * 0.45, w * 0.16); paint("#ffffff", null);
      for (const [dx, h] of [[-0.85, 2], [0.8, 1.5]]) { if (w < 3 && dx > 0) continue; const ix = x + w * dx; poly([[ix - 0.7, y + w * 0.38], [ix + 0.7, y + w * 0.38], [ix, y + w * 0.38 + h]]); paint("#dff4ff", T.ol, 0.45); }
    } else if (kind === "moss") {
      if (flat) {
        rr(x - w * 1.02, y - 0.9, w * 2.04, 1.7, 0.8); paint(MOSS[1], T.ol, 0.5);
        rr(x - w * 0.9, y - 0.8, w * 1.1, 0.6, 0.3); paint(MOSS[0], null);
        for (const dx of [-0.8, 0.85]) { const ix = x + w * dx; line([[ix, y + 0.7], [ix, y + 1.9 + (fr & 1) * 0.6]], MOSS[2], 0.8); }
        return;
      }
      // 頭頂一小撮苔蘚，苔汁只從兩側邊緣往下滴（不蓋住眼睛）
      union([() => ell(x, y + 0.3, w * 0.98, w * 0.3), () => circ(x - w * 0.3, y - 0.1, w * 0.34), () => circ(x + w * 0.38, y, w * 0.28)], MOSS[1], 0.5);
      ell(x - w * 0.2, y - w * 0.12, w * 0.45, w * 0.15); paint(MOSS[0], null);
      if (w >= 3.4) for (const [k, sd] of [[0, -1], [1, 1]]) {
        const dx = x + sd * w * 0.86, len = 1 + ((k + fr) % 2) * 0.7, dy = y + w * 0.2;
        line([[dx, dy], [dx, dy + len]], T.ol, 1.5); line([[dx, dy], [dx, dy + len]], MOSS[1], 0.65);
        circ(dx, dy + len + 0.35, 0.6); paint("#bff0a0", T.ol, 0.4);
      }
    } else if (kind === "lava") {
      if (NOFX) return;
      for (let k = 0; k < 2; k++) { const px = x + (k ? 0.45 : -0.4) * w, py = y - 1.5 - ((fr + k * 2) % 4) * 1.2; glow(px, py, 2.4, T.fireGlow, 0.9); circ(px, py, 0.5); paint("#ffd27a", null); }
    }
  }
  // sc＝大小（小怪的臉小，裂紋要跟著縮）
  function decoSpot(kind, x, y, fr, i, sc) {
    sc = sc || 1;
    if (kind === "snow") {
      // 霜斑：淡藍白小片＋閃光（不用深色描邊，免得縮小後看起來像髒點）
      ell(x, y, 2 * sc, 1.15 * sc, -0.3); paint("rgba(225,246,255,.85)", "rgba(120,170,215,.9)", 0.4);
      ell(x - 0.5 * sc, y - 0.35 * sc, 0.9 * sc, 0.4 * sc, -0.3); paint("#ffffff", null);
      if (!i && !NOFX && fr % 2 === 0) { c.fillStyle = "#ffffff"; c.fillRect(x + 1.5 * sc - 0.25, y - 2.6 * sc, 0.5, 2.2 * sc); c.fillRect(x + 1.5 * sc - 1.1 * sc, y - 1.75 * sc, 2.2 * sc, 0.5); }
    } else if (kind === "moss") {
      ell(x, y, 1.7 * sc, 0.95 * sc, 0.3); paint(MOSS[1], "rgba(20,40,14,.7)", 0.4); circ(x - 0.5 * sc, y - 0.3 * sc, 0.45 * sc); paint(MOSS[0], null);
      if (!i) { const dy = y - 1 + fr * 0.8, dx = x + 2.6 * sc; c.beginPath(); c.moveTo(dx, dy - 1.4); c.quadraticCurveTo(dx + 1, dy, dx, dy + 0.5); c.quadraticCurveTo(dx - 1, dy, dx, dy - 1.4); paint("#c4ecff", T.ol, 0.4); }
    } else if (kind === "lava") {
      const k = 0.78 * sc, P = (dx, dy) => [x + dx * k, y + dy * k];
      const pts = [P(-2.6, -1.8), P(-0.4, -0.2), P(-0.9, 2), P(0.2, 2.9)], br = [P(-0.4, -0.2), P(2.2, -1)];
      for (const [col, w] of [["rgba(40,6,0,.85)", 1.45], ["#ff8a2a", 0.8], ["#fff0a0", 0.3]]) { line(pts, col, w); line(br, col, w * 0.85); }
      glow(x - 0.3 * k, y + 0.2 * k, 3.6 * k, T.fireGlow, [0.55, 0.75, 0.95, 0.75][fr]);
    }
  }
  // 暫存畫布（區域變體做剪影描邊／偏色用，不進快取）
  let scrA = null, scrB = null;
  function scratch(cv, w, h) { if (!cv) return mkCanvas(w, h); cv.width = w; cv.height = h; return cv; }
  function enemyRegionDraw(d, type, fr, v, reg, q) {
    const R = RV[reg], A = ANCH[type](fr), box = d.box, bd = d.body;
    if (!NOFX) {
      if (R.contact) { ell(0, 0.9, bd.w * 0.55, bd.w * 0.19); c.fillStyle = R.contact; c.fill(); }
      if (R.ring) { ell(0, 0.9, bd.w * 0.6, bd.w * 0.21); c.fillStyle = rg(0, 0.9, 1, bd.w * 0.6, [R.ring.replace("A", 0.34), R.ring.replace("A", 0)]); c.fill(); }
    }
    let colorize = null;
    const W = Math.ceil(box.w * q), H = Math.ceil(box.h * q), g = c;
    if (!NOFX && (R.rim || R.tint) && (scrA = scratch(scrA, W, H)) && (scrB = scratch(scrB, W, H))) {
      const ga = scrA.getContext("2d"); ga.setTransform(q, 0, 0, q, box.ox * q, box.oy * q); ga.lineJoin = "round"; ga.lineCap = "round";
      const pc = c; c = ga; NOFX = true; try { d.fn(0, 0, fr, v); } finally { c = pc; NOFX = false; }
      const gb = scrB.getContext("2d");
      colorize = col => { gb.setTransform(1, 0, 0, 1, 0, 0); gb.globalCompositeOperation = "source-over"; gb.clearRect(0, 0, W, H); gb.drawImage(scrA, 0, 0); gb.globalCompositeOperation = "source-atop"; gb.fillStyle = col; gb.fillRect(0, 0, W, H); gb.globalCompositeOperation = "source-over"; return scrB; };
      if (R.rim) {   // 外描邊：剪影往 8 方向各偏 0.75 單位
        const cv = colorize(R.rim), o = 0.75 * q;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        for (let k = 0; k < 8; k++) { const a = k * PI / 4; g.drawImage(cv, Math.round(Math.cos(a) * o), Math.round(Math.sin(a) * o)); }
        g.restore();
      }
    }
    d.fn(0, 0, fr, v);
    if (colorize && R.tint) { const cv = colorize(R.tint); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(cv, 0, 0); g.restore(); }
    A.caps.forEach(([cx, cy, w, flat], i) => decoCap(R.deco, cx, cy, w, fr, i, flat));
    A.spots.forEach(([sx, sy, sc], i) => decoSpot(R.deco, sx, sy, fr, i, sc));
  }
  // 魔王護甲標（小盾，畫在腳邊右下，不擠頭頂的血條與畫面上方的魔王名牌）
  function armorOf(type, st) {
    if (st.armor != null) return +st.armor || 0;
    const TG = root.TG, b = TG && TG.ENEMIES && TG.ENEMIES[type];
    return b ? (b.armor || 0) : (EN[type] && EN[type].boss ? 1 : 0);
  }
  const SEED = st => (st.id != null ? (st.id * 0.37) % 4 : 0);
  ART.enemy = function (ctx, type, x, y, t, st) {
    st = st || {};
    const d = EN[type] || EN.slime, q = qOf(ctx), frozen = !!st.frozen, rate = st.slowed ? 0.45 : 1;
    const fr = frozen ? 0 : Math.floor((t || 0) * d.fps * rate + SEED(st)) & 3;
    const v = d.v ? d.v(st) : 0, reg = st.region != null ? st.region | 0 : T.region;
    const rv = !d.boss && ANCH[type] && RV[reg] ? reg : -1;
    const key = "e|" + type + "|" + fr + "|" + v + (rv >= 0 ? "|r" + rv : "");
    const draw = rv >= 0 ? () => enemyRegionDraw(d, type, fr, v, rv, q) : () => d.fn(0, 0, fr, v);
    const yy = y + d.foot, mir = (st.dir || 1) < 0;
    let alpha = 1;
    if (d.alpha) alpha = (st.revealed ? 0.92 : 0.62) + 0.1 * Math.sin((t || 0) * 5 + SEED(st));
    blit(ctx, sprite(key, d.box, q, draw), x, yy, mir, alpha);
    if (d.boss && !st.noBadge && armorOf(type, st) > 0) blit(ctx, sprite("ov|barmor", { w: 12, h: 12, ox: 6, oy: 6 }, q, () => { c.scale(1.3, 1.3); armorBadge(0, 0); }), x + d.body.w * 0.52, yy - 4);
    if (st.flash > 0) blit(ctx, tinted(key, d.box, q, draw, "#ffffff"), x, yy, mir, Math.min(1, st.flash) * 0.9);
    const bd = d.body;
    if (frozen) { blit(ctx, tinted(key, d.box, q, draw, "rgba(150,215,255,.5)"), x, yy, mir); blit(ctx, sprite("ov|ice|" + type, d.box, q, () => iceShell(bd)), x, yy); }
    else if (st.slowed) blit(ctx, sprite("ov|mist|" + Math.round(bd.w / 4), { w: bd.w * 1.4 + 4, h: bd.w * 0.7 + 4, ox: bd.w * 0.7 + 2, oy: bd.w * 0.45 + 2 }, q, () => slowMist(bd.w)), x, yy);
    if (st.shield) { const r = Math.round(Math.max(bd.w, bd.h) * 0.58 + 3); blit(ctx, sprite("ov|sh|" + r, { w: r * 2 + 4, h: r * 2 + 4, ox: r + 2, oy: r + 2 }, q, () => shieldBubble(r)), x, yy + bd.b - bd.h / 2); }
  };
  // 身體頂端相對 y 的位移（畫血條、名牌用；負值）
  ART.enemyTop = type => { const d = EN[type] || EN.slime; return d.foot + d.body.b - d.body.h - 2; };
  ART.enemySize = type => { const d = EN[type] || EN.slime; return { w: d.body.w, h: d.body.h, foot: d.foot, boss: !!d.boss, fly: !!d.fly }; };

  // ═════════════════════════════ 英雄 ═════════════════════════════
  const BREATH = [0, -0.35, -0.7, -0.35], SWAY = [0, 0.7, 1.3, 0.6];
  const KNIGHT_ROT = [0.55, 1.05, 1.9, 1.35];   // 劍的角度：閒置／揮到一半／劈到底／收劍
  function allyRing(x, y) { if (NOFX) return; ell(x, y + 1, 11.5, 4.4); paint(T.allyRingFill, null); c.strokeStyle = T.allyRing; c.lineWidth = 1.3; c.stroke(); }
  // 文法騎士（樣稿 B）
  function heroKnight(x, y, fr, atk) {
    allyRing(x, y); shadow(x, y + 1, 7, 2.6);
    const b = BREATH[fr], sw = SWAY[fr];
    // 披風（下襬隨呼吸飄）
    c.beginPath(); c.moveTo(x - 4, y - 12 + b); c.quadraticCurveTo(x - 8 - sw * 0.5, y - 4, x - 6.5 - sw, y + 0.2); c.quadraticCurveTo(x - 3.5 - sw * 0.6, y - 1 + sw * 0.4, x - 0.5, y + 0.2); c.quadraticCurveTo(x + 3, y - 0.8, x + 6.5 - sw * 0.3, y); c.quadraticCurveTo(x + 8, y - 4, x + 4, y - 12 + b); c.closePath(); paint(T.cape);
    c.beginPath(); c.moveTo(x - 3, y - 10 + b); c.quadraticCurveTo(x - 5.5 - sw * 0.4, y - 5, x - 5 - sw * 0.8, y - 1); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 0.7; c.stroke();
    for (const s of [-1, 1]) { rr(x + s * 2.3 - 1.6, y - 2.5, 3.2, 3, 0.8); paint(T.armor[2]); }
    rr(x - 4.5, y - 13 + b, 9, 11, 2.5); paint(sg3(x, 4.5, T.armor));
    rr(x - 4.6, y - 7 + b, 9.2, 1.8, 0.6); paint(T.gold, T.ol, 0.5);
    c.save(); c.translate(x + 6, y - 9 + b); c.rotate(KNIGHT_ROT[atk] || 0.55);
    rr(-0.9, -13, 1.8, 12, 0.6); paint(T.blade, T.ol, 0.6); rr(-2.8, -1.4, 5.6, 1.6, 0.6); paint(T.gold, T.ol, 0.5); rr(-0.7, 0, 1.4, 3, 0.5); paint(T.woodDark, null);
    c.restore();
    circ(x, y - 16.5 + b, 4.6); paint(sg3(x, 4.6, T.armor));
    rr(x - 3.2, y - 17 + b, 6.4, 1.5, 0.6); paint(T.pupil, null);
    c.beginPath(); c.moveTo(x - 0.5, y - 21 + b); c.quadraticCurveTo(x - 6, y - 26 + b - sw * 0.3, x - 8 - sw * 0.9, y - 19 + b + sw * 0.3); c.quadraticCurveTo(x - 4, y - 22 + b, x + 0.5, y - 20.5 + b); c.closePath(); paint(T.plume);
    const sb = b * 0.5;
    c.beginPath(); c.moveTo(x - 9.5, y - 12 + sb); c.lineTo(x - 2.5, y - 12 + sb); c.lineTo(x - 2.8, y - 6 + sb); c.quadraticCurveTo(x - 6, y - 2.4 + sb, x - 6, y - 2.4 + sb); c.quadraticCurveTo(x - 9.2, y - 5 + sb, x - 9.5, y - 6 + sb); c.closePath(); paint(T.shield);
    star(x - 6, y - 8 + sb, 1.9, T.gold);
  }
  // 精靈弓手：綠斗篷、金髮尖耳、長弓、背箭筒
  function heroElf(x, y, fr, atk) {
    allyRing(x, y); shadow(x, y + 1, 6.5, 2.4);
    const b = BREATH[fr], sw = SWAY[fr];
    c.beginPath(); c.moveTo(x - 4, y - 14 + b); c.quadraticCurveTo(x - 8.5 - sw * 0.5, y - 5, x - 6.5 - sw, y + 0.2); c.quadraticCurveTo(x - 2, y - 1 + sw * 0.4, x + 1, y + 0.2); c.lineTo(x + 6.5 - sw * 0.3, y); c.quadraticCurveTo(x + 8.5, y - 5, x + 4, y - 14 + b); c.closePath(); paint(T.elfCloak[2]);
    // 箭筒
    c.save(); c.translate(x + 4, y - 13 + b); c.rotate(0.35); rr(-1.8, -6, 3.6, 9, 1.2); paint(T.woodDark); for (let i = -1; i <= 1; i++) { poly([[i * 1.1, -6], [i * 1.1 - 0.9, -9], [i * 1.1 + 0.9, -9]]); paint(T.flagRed, null); } c.restore();
    for (const s of [-1, 1]) { rr(x + s * 2.1 - 1.5, y - 4, 3, 4.4, 1); paint("#5a3a24"); }
    rr(x - 4, y - 13.5 + b, 8, 10, 2.5); paint(sg3(x, 4, T.elfCloak));
    rr(x - 4.1, y - 7.5 + b, 8.2, 1.5, 0.5); paint("#6a4a2a", T.ol, 0.5);
    // 長弓（左手）
    const bx = x - 5.5, by = y - 11 + b, br2 = 9.5;
    c.beginPath(); c.arc(bx + 6, by, br2, PI - 1.15, PI + 1.15); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = T.woodLight; c.lineWidth = 1.2; c.stroke();
    const ty = Math.sin(1.15) * br2, tx = bx + 6 - Math.cos(1.15) * br2;
    c.beginPath(); c.moveTo(tx, by - ty); c.lineTo(atk ? bx + 5 : tx, by); c.lineTo(tx, by + ty); c.strokeStyle = "#eee8d8"; c.lineWidth = 0.55; c.stroke();
    if (atk) { line([[bx + 5, by], [bx - 7, by]], T.woodLight, 0.9); poly([[bx - 9, by], [bx - 6.5, by - 1.2], [bx - 6.5, by + 1.2]]); paint("#e8eef2", T.ol, 0.4); glow(bx - 8, by, 5, "rgba(140,255,170,A)", 0.7); }
    limb([[x - 3, y - 11 + b], [bx + 0.6, by]], T.elfCloak[1], 1.8);
    // 頭
    for (const s of [-1, 1]) { poly([[x + s * 3.4, y - 18 + b], [x + s * 7.4, y - 20.5 + b], [x + s * 3.6, y - 16 + b]]); paint(T.skin); }
    circ(x, y - 17.5 + b, 4); paint(T.skin);
    c.beginPath(); c.moveTo(x - 4.3, y - 16 + b); c.quadraticCurveTo(x - 5, y - 22.5 + b, x, y - 22.6 + b); c.quadraticCurveTo(x + 5, y - 22.5 + b, x + 4.3, y - 16 + b); c.quadraticCurveTo(x + 2, y - 19.6 + b, x - 1, y - 19 + b); c.quadraticCurveTo(x - 3, y - 18.4 + b, x - 4.3, y - 13 + b); c.closePath(); paint(T.hair);
    for (const s of [-1, 1]) { circ(x + s * 1.5, y - 17 + b, 0.6); paint(T.pupil, null); }
    // 兜帽尖
    c.beginPath(); c.moveTo(x - 4.6, y - 19 + b); c.quadraticCurveTo(x - 3, y - 25 + b, x + 2.5 + sw * 0.5, y - 26 + b + sw * 0.2); c.quadraticCurveTo(x + 1, y - 23.6 + b, x + 4.6, y - 19.5 + b); c.quadraticCurveTo(x, y - 23 + b, x - 4.6, y - 19 + b); c.closePath(); paint(T.elfCloak[1]);
  }
  // 冰雪法師：藍袍白毛邊、寬簷尖帽、雪花法杖、白鬍子
  function heroMage(x, y, fr, atk) {
    allyRing(x, y); shadow(x, y + 1, 7, 2.5);
    const b = BREATH[fr], sw = SWAY[fr];
    // 法杖
    limb([[x + 7, y + 0.5], [x + 7.5, y - 22 + b]], T.woodLight, 1);
    glow(x + 7.5, y - 24.5 + b, atk ? 10 : 7, T.iceGlow, 0.9);
    snowflake(x + 7.5, y - 24.5 + b, 2.8, T.iceSpark, 0.8);
    // 長袍
    c.beginPath(); c.moveTo(x - 4.2, y - 15 + b); c.quadraticCurveTo(x - 7.5 - sw * 0.3, y - 7, x - 8 - sw * 0.6, y); c.quadraticCurveTo(x, y + 1.6, x + 8 - sw * 0.2, y); c.quadraticCurveTo(x + 7.5, y - 7, x + 4.2, y - 15 + b); c.closePath(); paint(sg3(x, 8, T.mageRobe));
    c.beginPath(); c.moveTo(x - 8 - sw * 0.6, y - 0.6); c.quadraticCurveTo(x, y + 1.2, x + 8 - sw * 0.2, y - 0.6); c.strokeStyle = T.ol; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = T.fur; c.lineWidth = 2; c.stroke();
    rr(x - 0.9, y - 14 + b, 1.8, 13, 0.5); paint(T.fur, null);
    limb([[x + 4, y - 12 + b], [x + 7, y - 10 + b]], T.mageRobe[1], 2.2);
    limb([[x - 4, y - 12 + b], [x - 7, y - 8 + b]], T.mageRobe[1], 2.2);
    if (atk) { glow(x - 8, y - 8 + b, 6, T.iceGlow, 0.9); circ(x - 8, y - 8 + b, 1.4); paint("#effcff", null); }
    // 臉＋鬍子
    circ(x, y - 17.5 + b, 3.8); paint(T.skin);
    c.beginPath(); c.moveTo(x - 3.6, y - 17 + b); c.quadraticCurveTo(x - 3, y - 11 + b, x, y - 10 + b); c.quadraticCurveTo(x + 3, y - 11 + b, x + 3.6, y - 17 + b); c.quadraticCurveTo(x, y - 15 + b, x - 3.6, y - 17 + b); c.closePath(); paint(T.fur);
    for (const s of [-1, 1]) { circ(x + s * 1.4, y - 18 + b, 0.55); paint(T.pupil, null); }
    // 寬簷尖帽
    ell(x, y - 20.5 + b, 7.6, 2.4); paint(T.mageRobe[2]);
    c.beginPath(); c.moveTo(x - 4.6, y - 20.8 + b); c.quadraticCurveTo(x - 2, y - 27 + b, x + 1, y - 31 + b); c.quadraticCurveTo(x + 4, y - 33 + b, x + 7 + sw * 0.5, y - 31.5 + b + sw * 0.3); c.quadraticCurveTo(x + 3.6, y - 29.5 + b, x + 3.4, y - 26 + b); c.quadraticCurveTo(x + 4, y - 23 + b, x + 4.6, y - 20.8 + b); c.closePath(); paint(sg3(x, 5, T.mageRobe));
    rr(x - 4.6, y - 22.6 + b, 9.2, 1.8, 0.6); paint(T.fur, T.ol, 0.5);
    star(x + 0.5, y - 26 + b, 1.2, T.goldL);
  }
  // 龍騎士：紅甲騎士騎在橘紅小飛龍上、長槍
  function heroDragon(x, y, fr, atk) {
    allyRing(x, y); shadow(x, y + 1, 10, 3);
    const b = BREATH[fr] * 1.15, wf = [0, -1.4, -2.6, -1.4][fr];
    // 翅膀
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x - 1 + s * 2, y - 12 + b); c.quadraticCurveTo(x + s * 8, y - 24 + wf, x + s * 14, y - 25 + wf); c.quadraticCurveTo(x + s * 11, y - 18, x + s * 12, y - 13); c.quadraticCurveTo(x + s * 7, y - 14, x + s * 3, y - 9); c.closePath(); paint(lg(x, y - 25, x, y - 10, [T.mount[1], T.mount[2]])); }
    // 尾
    const tw = SWAY[fr] * 0.8;
    limb([[x - 6, y - 7 + b], [x - 12, y - 5], [x - 14, y - 9 - tw]], T.mount[1], 2.4); poly([[x - 14, y - 12 - tw], [x - 16, y - 8 - tw], [x - 12.5, y - 8.5 - tw]]); paint(T.mount[2]);
    for (const [dx, s] of [[-5, -1], [-2, 1], [3, -1], [6, 1]]) { rr(x + dx - 1.4, y - 4 - (s * (fr & 2 ? 1 : -1) > 0 ? 1 : 0), 2.8, 4.4, 1); paint(T.mount[2]); }
    ell(x, y - 7.5 + b, 9, 5.4); paint(sg3(x, 9, T.mount));
    ell(x + 1, y - 5.8 + b, 6, 2.6); paint("#ffd6a0", null);
    // 脖子＋頭（朝右）
    limb([[x + 6, y - 9 + b], [x + 9.5, y - 15 + b]], T.mount[1], 3.4);
    for (const s of [-1, 1]) { poly([[x + 9 + s * 1.2, y - 19 + b], [x + 7 + s * 2.4, y - 24 + b], [x + 10 + s * 1.6, y - 19.8 + b]]); paint("#f0e2c4", T.ol, 0.6); }
    union([() => ell(x + 10, y - 17.5 + b, 3.6, 3), () => rr(x + 10, y - 18.5 + b, 5.6, 3.6, 1.6)], T.mount[0]);
    circ(x + 10.4, y - 18.4 + b, 0.8); paint(T.pupil, null);
    if (atk) { glow(x + 17, y - 17 + b, 7, T.fireGlow, 0.9); poly([[x + 15.5, y - 18 + b], [x + 21, y - 19.5 + b], [x + 20, y - 15 + b]]); paint("#ffb040", null); }
    // 騎士
    rr(x - 4, y - 18 + b, 7, 9, 2.4); paint(sg3(x, 3.5, T.riderArmor));
    circ(x - 0.5, y - 21 + b, 3.6); paint(sg3(x, 3.6, T.riderArmor));
    rr(x - 2.6, y - 21.6 + b, 5, 1.3, 0.5); paint(T.pupil, null);
    c.beginPath(); c.moveTo(x - 0.5, y - 24.4 + b); c.quadraticCurveTo(x - 5, y - 28 + b, x - 7, y - 22 + b); c.quadraticCurveTo(x - 3.6, y - 25 + b, x + 0.3, y - 23.6 + b); c.closePath(); paint(T.gold);
    // 長槍
    c.save(); c.translate(x + 2, y - 13 + b); c.rotate(atk ? -0.25 : -0.85);
    rr(-0.7, -20, 1.4, 22, 0.5); paint(T.woodLight, T.ol, 0.6); poly([[0, -25], [1.8, -19.5], [-1.8, -19.5]]); paint(T.blade, T.ol, 0.6);
    poly([[0.7, -18], [5.5, -16.5], [0.7, -14.5]]); paint(T.flagRed, T.ol, 0.5);
    c.restore();
  }
  const HERO = { knight: heroKnight, elf: heroElf, mage: heroMage, dragon: heroDragon };
  const HBOX = { w: 48, h: 52, ox: 24, oy: 40 };
  // 攻擊特效（即時畫，很便宜）：a＝st.attack（1＝剛出手→0）；騎士／龍騎士＝揮砍弧光，弓手＝放箭光圈，法師＝冰霜爆環
  function heroFx(ctx, id, x, y, mir, a, b) {
    const p = 1 - a, al = Math.min(1, a * 1.5);
    ctx.save(); ctx.translate(x, y); if (mir) ctx.scale(-1, 1);
    ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    if (id === "knight" || id === "dragon") {
      const kn = id === "knight", px = kn ? 6 : 2, py = (kn ? -9 : -13) + b, r1 = kn ? 15 : 25, r0 = kn ? 9.5 : 19;
      const a0 = kn ? -2.05 : -2.0, a1 = a0 + (kn ? 2.55 : 1.5) * Math.min(1, p * 1.7 + 0.35), am = Math.max(a0, a1 - (kn ? 1.7 : 1.1));
      ctx.beginPath(); ctx.arc(px, py, r1, am, a1); ctx.arc(px, py, r0 + (r1 - r0) * 0.55, a1, am, true); ctx.closePath();
      const gr = ctx.createRadialGradient(px, py, r0, px, py, r1); gr.addColorStop(0, "rgba(140,200,255,0)"); gr.addColorStop(0.7, "rgba(200,230,255," + (0.55 * al) + ")"); gr.addColorStop(1, "rgba(255,250,225," + (0.95 * al) + ")");
      ctx.fillStyle = gr; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, r1, am + (a1 - am) * 0.35, a1); ctx.strokeStyle = "rgba(255,255,255," + al + ")"; ctx.lineWidth = 1.1; ctx.stroke();
      if (a > 0.55) liveGlow(ctx, px + Math.cos(a1) * r1, py + Math.sin(a1) * r1, 6, T.bossAura, al);
    } else {
      const ex = id === "elf" ? -13.5 : -8, ey = (id === "elf" ? -11 : -8) + b, r = 2 + p * 8;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, PI2); ctx.strokeStyle = (id === "elf" ? "rgba(160,255,180," : "rgba(190,235,255,") + (0.9 * al) + ")"; ctx.lineWidth = 1.3 * al + 0.3; ctx.stroke();
      for (let i = 0; i < 4; i++) { const ang = i * PI / 2 + p * 1.2, d0 = r * 0.5, d1 = r * 1.15; ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * d0, ey + Math.sin(ang) * d0); ctx.lineTo(ex + Math.cos(ang) * d1, ey + Math.sin(ang) * d1); ctx.strokeStyle = "rgba(255,255,255," + (0.8 * al) + ")"; ctx.lineWidth = 0.8; ctx.stroke(); }
      liveGlow(ctx, ex, ey, 6 + p * 4, id === "elf" ? "rgba(140,255,170,A)" : T.iceGlow, al * 0.8);
    }
    ctx.restore();
  }
  ART.hero = function (ctx, id, x, y, t, st) {
    st = st || {}; const fn = HERO[id] || heroKnight, hid = HERO[id] ? id : "knight", q = qOf(ctx);
    // 閒置 4 幀：呼吸起伏＋披風飄動；攻擊：騎士分 3 段揮劍姿勢（1＝揮到一半、2＝劈到底、3＝收劍），其他英雄 1 段
    const fr = Math.floor((t || 0) * 2.8) & 3, a = Math.max(0, Math.min(1, +st.attack || 0));
    const atk = a > 0.1 ? (hid === "knight" ? (a > 0.7 ? 1 : a > 0.4 ? 2 : 3) : 1) : 0;
    const key = "h|" + hid + "|" + fr + "|" + atk, draw = () => fn(0, 0, fr, atk);
    const yy = y + 5, mir = (st.dir || 1) < 0;
    blit(ctx, sprite(key, HBOX, q, draw), x, yy, mir, st.alpha);
    if (st.flash > 0) blit(ctx, tinted(key, HBOX, q, draw, "#ffffff"), x, yy, mir, Math.min(1, st.flash) * 0.8);
    if (a > 0.05 && !st.noFx && st.alpha !== 0) heroFx(ctx, hid, x, yy, mir, a, BREATH[fr] * (hid === "dragon" ? 1.15 : 1));
  };
  ART.heroTop = id => id === "mage" ? -29 : id === "dragon" ? -24 : -23;

  // ═════════════════════════════ 召喚獸 ═════════════════════════════
  // 側面四足走跑腿位（4 幀）
  const LEGS = [[2, -2, -1.5, 1.5], [0.5, -0.5, 1.5, -1.5], [-2, 2, 1.5, -1.5], [-0.5, 0.5, -1.5, 1.5]];
  function legs4(x, y, fr, xs, len, w, col) { const L = LEGS[fr]; xs.forEach((lx, i) => { const o = L[i]; limb([[x + lx, y - len], [x + lx + o, y - 0.6]], col, w); }); }
  function flameTail(x, y, ang, len, w, fr, i) {
    c.save(); c.translate(x, y); c.rotate(ang + Math.sin(fr * PI / 2 + i) * 0.12);
    c.beginPath(); c.moveTo(0, -w * 0.5); c.bezierCurveTo(len * 0.4, -w * 1.2, len * 0.8, -w * 0.6, len, 0); c.bezierCurveTo(len * 0.75, w * 0.3, len * 0.4, w * 1.1, 0, w * 0.5); c.closePath();
    paint(lg(0, 0, len, 0, [T.fox[1], T.flame[1], T.flame[0]]));
    c.beginPath(); c.moveTo(len * 0.35, -w * 0.2); c.quadraticCurveTo(len * 0.7, -w * 0.3, len * 0.9, 0); c.strokeStyle = "rgba(255,250,210,.8)"; c.lineWidth = 0.7; c.stroke();
    c.restore();
  }
  // 火狐／九尾狐
  function sumFox(x, y, fr, evo) {
    const s = evo ? 1.3 : 1;
    shadow(x, y + 0.6, 10 * s, 2.6 * s);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (evo) glow(0, -9, 18, T.fireGlow, 0.5);
    const n = evo ? 5 : 1;
    for (let i = 0; i < n; i++) flameTail(-6, -9, PI + (n === 1 ? 0.5 : -0.1 + i * 0.32), evo ? 12 : 11, 3.4, fr, i);
    legs4(0, 0, fr, [-5, -3, 3.5, 5.5], 6, 1.5, T.fox[2]);
    ell(0, -8, 8, 4.4); paint(sg3(0, 8, T.fox));
    ell(2, -6.4, 4.4, 2.2); paint("#fff4e6", null);
    // 頭
    for (const e of [-1, 1]) { poly([[7 + e * 1.6, -15], [8 + e * 2.2, -20.5], [10 + e * 1.4, -15.5]]); paint(T.fox[1]); poly([[7.8 + e * 1.6, -15.6], [8.2 + e * 1.9, -18.8], [9.4 + e * 1.4, -15.8]]); paint("#3a1a10", null); }
    union([() => ell(8.5, -13, 4.2, 3.6), () => poly([[10, -14.6], [15, -12.2], [10, -10.5]])], T.fox[0]);
    poly([[10, -12], [15, -12.2], [11, -10.4]]); paint("#fff4e6", null);
    circ(15, -12.3, 0.8); paint(T.ol, null);
    ell(9.6, -14, 0.9, 1); paint(T.pupil, null);
    if (evo) { poly([[8, -16.6], [8.8, -18], [9.6, -16.6], [8.8, -15.6]]); paint(T.goldL, T.ol, 0.4); if (!NOFX) for (let i = 0; i < 3; i++) { const px = -4 + i * 5, py = -18 - ((i * 5 + fr * 3) % 7); glow(px, py, 3, T.fireGlow, 0.9); circ(px, py, 0.7); paint("#fff4b0", null); } }
    c.restore();
  }
  // 雷狼／雷霆天狼
  function sumWolf(x, y, fr, evo) {
    const s = evo ? 1.3 : 1.1, P = evo ? ["#ffffff", "#bfe2ff", "#5a7ab0"] : T.wolf;
    shadow(x, y + 0.6, 11 * s, 2.8 * s);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (evo) glow(0, -10, 20, "rgba(140,200,255,A)", 0.6);
    // 尾
    c.beginPath(); c.moveTo(-7, -10); c.quadraticCurveTo(-13, -12 + (fr % 2), -15, -16); c.quadraticCurveTo(-12, -9, -7, -7.5); c.closePath(); paint(P[1]);
    legs4(0, 0, fr, [-5.5, -3.5, 4, 6], 6.5, 1.7, P[2]);
    ell(0, -9, 8.5, 4.6); paint(sg3(0, 8.5, P));
    // 雷鬃
    for (let i = 0; i < 5; i++) { const bx = -4 + i * 2.6; poly([[bx - 1.2, -12.6], [bx + 0.4, -17 - (i % 2) * 1.5], [bx + 0.2, -14.6], [bx + 1.6, -13]]); paint(T.boltY, T.ol, 0.5); }
    // 頭
    poly([[6, -12], [9, -19], [10.5, -13]]); paint(P[1]);
    union([() => ell(9, -13.5, 4.2, 3.6), () => poly([[11, -15], [16.5, -12.6], [11, -10.6]])], P[0]);
    circ(16.4, -12.7, 0.8); paint(T.ol, null);
    poly([[9.2, -14.8], [11.6, -14.6], [10.8, -13.6]]); paint(evo ? "#7ad8ff" : T.boltY, null); glow(10.4, -14.3, 3, "rgba(255,240,120,A)", 0.8);
    if (evo) { for (const e of [-1, 1]) line(zig(8 + e, -16, 6 + e * 3, -23, 3 + e, 3, 1), T.boltY, 1); if (!NOFX) for (let i = 0; i < 3; i++) { const a = fr * 0.8 + i * 2.1; line(zig(Math.cos(a) * 12, -10 + Math.sin(a) * 6, Math.cos(a) * 17, -12 + Math.sin(a) * 8, i + fr, 3, 1.4), "rgba(255,250,190,.95)", 0.8); } }
    c.restore();
  }
  // 岩龜／玄武
  function sumTurtle(x, y, fr, evo) {
    const s = evo ? 1.35 : 1.1;
    shadow(x, y + 0.8, 12 * s, 3.4 * s);
    c.save(); c.translate(x, y); c.scale(s, s);
    if (evo) glow(0, -8, 20, T.bossAura, 0.4);
    for (const [dx, dy] of [[-9, -1.5], [9, -1.5], [-6, 0.5], [6, 0.5]]) { ell(dx, dy, 2.8, 2.2); paint(T.turtle[1]); }
    const hb = fr % 2 ? -0.6 : 0;
    // 殼
    c.beginPath(); c.moveTo(-11.5, -3); c.bezierCurveTo(-12, -13, -6, -16, 0, -16); c.bezierCurveTo(6, -16, 12, -13, 11.5, -3); c.quadraticCurveTo(0, 0, -11.5, -3); c.closePath(); paint(sg3(0, 12, T.shellRock));
    for (const [px, py, w] of [[-5.5, -10, 3.4], [0, -12.5, 3.8], [5.5, -10, 3.4], [-3, -5.5, 3], [3, -5.5, 3]]) { poly([[px - w, py], [px - w * 0.5, py - w * 0.8], [px + w * 0.5, py - w * 0.8], [px + w, py], [px + w * 0.5, py + w * 0.8], [px - w * 0.5, py + w * 0.8]]); paint(T.shellRock[0], "rgba(40,30,20,.6)", 0.6); }
    c.beginPath(); c.moveTo(-11.5, -3); c.quadraticCurveTo(0, 0, 11.5, -3); c.strokeStyle = evo ? T.gold : T.turtle[2]; c.lineWidth = 1.6; c.stroke();
    // 頭（從殼前緣探出來）
    ell(0, -0.6 + hb, 4.2, 3.4); paint(sg3(0, 4.2, T.turtle));
    for (const e of [-1, 1]) { circ(e * 1.7, -1.4 + hb, 0.85); paint(T.pupil, null); circ(e * 1.7 - 0.3, -1.8 + hb, 0.3); paint("#fff", null); }
    c.beginPath(); c.moveTo(-1.2, 0.8 + hb); c.quadraticCurveTo(0, 1.6 + hb, 1.2, 0.8 + hb); c.strokeStyle = T.ol; c.lineWidth = 0.6; c.stroke();
    if (evo) {
      // 山峰殼＋纏繞的蛇
      for (const [px, h, w] of [[-4, 10, 5], [3, 13, 6], [8, 8, 4]]) { poly([[px - w, -13], [px, -13 - h], [px + w, -13]]); paint(sg3(px, w, ["#a8b4c4", "#6a7a8e", "#3a4658"])); poly([[px - w * 0.35, -13 - h * 0.65], [px, -13 - h], [px + w * 0.35, -13 - h * 0.65], [px, -13 - h * 0.55]]); paint("#ffffff", null); }
      c.beginPath(); c.moveTo(-12, -6); c.bezierCurveTo(-16, -14, -8, -20, 0, -18); c.bezierCurveTo(8, -16, 14, -19, 13, -25); c.strokeStyle = T.ol; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = "#3a8a6a"; c.lineWidth = 2.4; c.stroke();
      ell(13, -26.5, 2.6, 2); paint("#4aa07a"); circ(13.8, -27, 0.6); paint(T.enemyEye, null);
    }
    c.restore();
  }
  // 冰鳳／極光冰凰（飛行，地上畫影子）
  function sumPhoenix(x, y, fr, evo) {
    const s = evo ? 1.3 : 1.05, by = -15 + [0, -1, -1.6, -0.6][fr], wk = [1, 0.55, -0.2, 0.55][fr];
    const P = evo ? T.aurora : [T.phoenix[0], T.phoenix[1], T.phoenix[2]];
    shadow(x, y + 0.6, 8 * s, 2.2 * s, T.shadowA * 0.6);
    c.save(); c.translate(x, y); c.scale(s, s);
    glow(0, by, evo ? 20 : 14, evo ? "rgba(170,255,230,A)" : T.iceGlow, 0.55);
    // 尾羽
    const nT = evo ? 3 : 2;
    for (let i = 0; i < nT; i++) {
      const a = (i - (nT - 1) / 2) * 0.42, ex = Math.sin(a) * 10 + Math.sin(fr + i) * 1.2, ey = by + 15 + (evo ? 3 : 0) - Math.abs(a) * 3;
      c.beginPath(); c.moveTo(-1.6, by + 3); c.quadraticCurveTo(ex - 4.2, (by + ey) / 2 + 2, ex - 1.6, ey); c.quadraticCurveTo(ex, ey + 2.6, ex + 1.6, ey); c.quadraticCurveTo(ex + 4.2, (by + ey) / 2 + 2, 1.6, by + 3); c.closePath();
      paint(lg(0, by, 0, ey + 2, [P[1], P[2]]));
      circ(ex, ey - 0.6, 1.2); paint(evo ? P[0] : "#ffffff", null);
    }
    // 翅膀
    for (const e of [-1, 1]) {
      c.save(); c.translate(e * 2, by - 1); c.scale(1, wk);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(e * 7, -9, e * 16, -8); c.lineTo(e * 14, -5); c.lineTo(e * 16.5, -3.5); c.lineTo(e * 13, -1.5); c.lineTo(e * 14.5, 0.5); c.lineTo(e * 10, 1); c.quadraticCurveTo(e * 5, 3, 0, 2.5); c.closePath();
      paint(lg(0, -9, 0, 3, [P[0], P[1], P[2]]));
      c.beginPath(); c.moveTo(e * 3, -1); c.lineTo(e * 12, -4); c.moveTo(e * 3, 0.5); c.lineTo(e * 11, -0.5); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 0.5; c.stroke();
      c.restore();
    }
    ell(0, by, 3.6, 5); paint(lg(0, by - 5, 0, by + 5, [P[0], P[1]]));
    circ(0, by - 6, 3); paint(P[0]);
    poly([[0, by - 5.6], [2.8, by - 4.8], [0, by - 4.2]]); paint(T.goldL, T.ol, 0.5);
    circ(0.8, by - 6.6, 0.6); paint(T.pupil, null);
    for (let i = 0; i < (evo ? 3 : 2); i++) { c.beginPath(); c.moveTo(-0.6 + i * 0.6, by - 8.6); c.quadraticCurveTo(-2 + i * 2, by - 12, -3 + i * 3, by - 13 - (i === 1 ? 1.5 : 0)); c.strokeStyle = T.ol; c.lineWidth = 1.8; c.stroke(); c.strokeStyle = evo ? P[2] : P[1]; c.lineWidth = 0.8; c.stroke(); }
    if (evo && !NOFX) for (let i = 0; i < 4; i++) { const px = -9 + i * 6, py = by + 6 + ((i * 3 + fr * 2) % 6); circ(px, py, 0.8); paint("#ffffff", null); }
    c.restore();
  }
  // 光獨角獸／聖光天馬
  function sumUnicorn(x, y, fr, evo) {
    const s = evo ? 1.25 : 1.05;
    shadow(x, y + 0.6, 11 * s, 2.8 * s);
    c.save(); c.translate(x, y); c.scale(s, s);
    glow(0, -12, evo ? 22 : 15, T.bossAura, evo ? 0.5 : 0.3);
    const M = evo ? ["#ff9aa8", "#ffd27a", "#9affc8", "#9ad0ff", "#d4a8ff"] : T.mane;
    // 尾
    c.beginPath(); c.moveTo(-8, -11); c.quadraticCurveTo(-14, -10 + (fr % 2), -13, -3); c.quadraticCurveTo(-11, -8, -7.5, -8.5); c.closePath(); paint(lg(-13, -11, -8, -3, [M[0], M[1], M[2]]));
    if (evo) for (const e of [1, -1]) { c.save(); c.translate(-1, -13); c.scale(1, [1, 0.7, 0.4, 0.7][fr]); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, -10, -12 + e, -13); c.lineTo(-10, -9); c.lineTo(-12, -7); c.lineTo(-8.5, -5); c.lineTo(-9.5, -2.5); c.quadraticCurveTo(-4, -1, 0, 1); c.closePath(); paint(e > 0 ? "#ffffff" : "#e8ecf8"); c.restore(); }
    legs4(0, 0, fr, [-5.5, -3.5, 4, 6], 7.5, 1.6, T.uni[2]);
    for (const lx of [-5.5, -3.5, 4, 6]) { rr(lx - 1.1 + LEGS[fr][[-5.5, -3.5, 4, 6].indexOf(lx)], -1.6, 2.2, 1.6, 0.5); paint(T.horn, null); }
    ell(0, -10.5, 8.5, 4.6); paint(sg3(0, 8.5, T.uni));
    // 脖子＋頭
    poly([[4.5, -13], [7, -19], [10.5, -18], [9, -10.5]]); paint(T.uni[1]);
    union([() => ell(10, -19, 3.4, 2.8), () => rr(10, -20.2, 5.4, 3.6, 1.6)], T.uni[0]);
    circ(10.6, -19.6, 0.7); paint(T.pupil, null); circ(14.6, -18, 0.5); paint("#a8a0b8", null);
    poly([[8.2, -21], [9, -23.4], [9.8, -21.2]]); paint(T.uni[1]);
    // 角
    poly([[10.6, -21.6], [14.5, -29], [12.2, -21]]); paint(lg(10, -21, 14, -29, ["#fff6d8", T.horn]));
    for (let i = 1; i < 4; i++) line([[10.9 + i * 0.85, -21.8 - i * 1.6], [11.8 + i * 0.85, -21.4 - i * 1.6]], "rgba(140,90,30,.6)", 0.5);
    glow(14.5, -29, 5, T.bossAura, 0.9);
    // 鬃毛
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(9 - i * 1.6, -21 + i * 2.4); c.quadraticCurveTo(5 - i * 2, -21 + i * 2.6 + (fr % 2), 4.5 - i * 1.4, -16 + i * 2.2); c.quadraticCurveTo(6 - i * 1.4, -18 + i * 2.4, 8.4 - i * 1.4, -18.6 + i * 2.4); c.closePath(); paint(M[i % M.length]); }
    if (evo && !NOFX) for (let i = 0; i < 4; i++) { const px = -8 + i * 5, py = -22 - ((i * 4 + fr * 2) % 6); star(px, py, 1.4, "#fff6c8", 0.5); }
    c.restore();
  }
  const SUM = { fox: sumFox, wolf: sumWolf, turtle: sumTurtle, phoenix: sumPhoenix, unicorn: sumUnicorn };
  const SBOX = { w: 60, h: 56, ox: 30, oy: 44 };
  ART.summon = function (ctx, id, evolved, x, y, t, st) {
    st = st || {}; const fn = SUM[id] || sumFox, q = qOf(ctx), evo = evolved ? 1 : 0;
    const fr = Math.floor((t || 0) * (id === "turtle" ? 3 : 9)) & 3, key = "s|" + id + "|" + evo + "|" + fr;
    // 登場光：st.spawnT 0（剛召喚）→1（結束）；有給才畫。光柱＋地面光環＋往上飄的星點，本體淡入並從上方落地
    const sp = st.spawnT != null && st.spawnT >= 0 && st.spawnT < 1 ? +st.spawnT : -1;
    let al = st.alpha, dy = 0;
    if (sp >= 0) { summonSpawnFx(ctx, x, y + 5, sp, evo, false); al = (al == null ? 1 : al) * Math.min(1, sp * 3); dy = -7 * (1 - Math.min(1, sp * 2.2)) * (1 - Math.min(1, sp * 2.2)); }
    blit(ctx, sprite(key, SBOX, q, () => fn(0, 0, fr, evo)), x, y + 5 + dy, (st.dir || 1) < 0, al);
    if (sp >= 0) summonSpawnFx(ctx, x, y + 5, sp, evo, true);
  };
  function summonSpawnFx(ctx, x, y, k, evo, front) {
    const f = 1 - k, col = evo ? "255,214,120" : "170,225,255";
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (!front) {
      const w = 5 + 11 * f, top = y - 46 - 10 * f;
      const g = ctx.createLinearGradient(0, top, 0, y); g.addColorStop(0, "rgba(" + col + ",0)"); g.addColorStop(0.55, "rgba(" + col + "," + (0.5 * f) + ")"); g.addColorStop(1, "rgba(255,255,255," + (0.85 * f) + ")");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.55, top); ctx.lineTo(x + w * 0.55, top); ctx.lineTo(x + w, y); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill();
      liveGlow(ctx, x, y - 4, 18 * (0.6 + f * 0.6), evo ? T.bossAura : T.iceGlow, f);
    } else {
      const rx = 6 + 18 * Math.sqrt(k);
      ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.38, 0, 0, PI2); ctx.strokeStyle = "rgba(" + col + "," + (0.95 * f) + ")"; ctx.lineWidth = 1.6 * f + 0.4; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, rx * 0.62, rx * 0.24, 0, 0, PI2); ctx.strokeStyle = "rgba(255,255,255," + (0.7 * f) + ")"; ctx.lineWidth = 0.8; ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * PI2 / 6 + 0.4, r = 6 + 10 * k, px = x + Math.cos(a) * r, py = y - 4 - k * (14 + (i % 3) * 6) + Math.sin(a) * r * 0.35, s = 1.6 * f + 0.3; ctx.fillStyle = "rgba(255,255,240," + f + ")"; ctx.fillRect(px - s * 0.25, py - s, s * 0.5, s * 2); ctx.fillRect(px - s, py - s * 0.25, s * 2, s * 0.5); }
    }
    ctx.restore();
  }

  // ═════════════════════════════ 投射物（即時畫；光暈用快取貼圖） ═════════════════════════════
  const GBOX = { w: 20, h: 20, ox: 10, oy: 10 };
  function liveGlow(ctx, x, y, r, col, a) {
    const e = sprite("g|" + col, GBOX, 4, () => { circ(0, 0, 10); c.fillStyle = rg(0, 0, 0, 10, [col.replace("A", 1), col.replace("A", 0.35), col.replace("A", 0)]); c.fill(); });
    if (!e) return;
    const pa = ctx.globalAlpha, po = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = pa * (a == null ? 1 : a);
    ctx.drawImage(e.cv, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa; ctx.globalCompositeOperation = po;
  }
  function arrowAt(x1, y1, x2, y2, fletch, len, w) {
    const a = Math.atan2(y2 - y1, x2 - x1); c.save(); c.translate(x2, y2); c.rotate(a);
    c.strokeStyle = T.ol; c.lineWidth = w + 1; c.beginPath(); c.moveTo(-len, 0); c.lineTo(0, 0); c.stroke(); c.strokeStyle = T.woodLight; c.lineWidth = w * 0.5; c.stroke();
    poly([[2, 0], [-1.4, -1.6], [-1.4, 1.6]]); paint("#e8eef2", T.ol, 0.5);
    poly([[-len, 0], [-len - 2.2, -1.8], [-len + 1.5, 0], [-len - 2.2, 1.8]]); paint(fletch, null);
    c.restore();
  }
  ART.proj = function (ctx, kind, x1, y1, x2, y2, t) {
    t = t || 0; const pc = c; c = ctx; ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    try {
      switch (kind) {
        case "arrow": case "multi": arrowAt(x1, y1, x2, y2, T.flagRed, 9, 0.9); break;
        case "elf": case "elfArrow": { const tl = Math.min(L, 14); ctx.strokeStyle = "rgba(150,255,180,.45)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x2 - ux * tl, y2 - uy * tl); ctx.lineTo(x2, y2); ctx.stroke(); arrowAt(x1, y1, x2, y2, "#5ad08a", 9, 0.9); liveGlow(ctx, x2, y2, 5, "rgba(140,255,170,A)", 0.6); break; }
        case "snipe": { const tl = Math.min(L, 26); const g = ctx.createLinearGradient(x2 - ux * tl, y2 - uy * tl, x2, y2); g.addColorStop(0, "rgba(255,220,150,0)"); g.addColorStop(1, "rgba(255,220,150,.9)"); ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x2 - ux * tl, y2 - uy * tl); ctx.lineTo(x2, y2); ctx.stroke(); arrowAt(x1, y1, x2, y2, T.snipeBanner, 12, 1.3); liveGlow(ctx, x2, y2, 7, T.bossAura, 0.8); break; }
        case "bolt": case "mage": { const mx = (x1 + x2) / 2 - uy * 6, my = (y1 + y2) / 2 + ux * 6, tl = Math.min(1, 22 / L); ctx.strokeStyle = T.orbTrail; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x2 + (mx - x2) * tl * 2, y2 + (my - y2) * tl * 2); ctx.quadraticCurveTo(x2 + (mx - x2) * tl, y2 + (my - y2) * tl, x2, y2); ctx.stroke(); liveGlow(ctx, x2, y2, 8, T.orbGlow, 0.9); circ(x2, y2, 2.5); paint(T.orb[0], null); break; }
        case "arcane": { liveGlow(ctx, x2, y2, 9, T.arcaneGlow, 0.9); for (let i = 0; i < 3; i++) { const b = t * 10 + i * PI2 / 3; circ(x2 + Math.cos(b) * 4.4, y2 + Math.sin(b) * 4.4, 0.9); paint("#ffe0fa", null); } circ(x2, y2, 2.8); paint(rg(x2 - 0.8, y2 - 0.8, 0.3, 2.8, ["#ffffff", T.arcane[0], T.arcane[1]]), T.ol, 0.6); break; }
        case "chain": case "lightning": { const pts = zig(x1, y1, x2, y2, Math.floor(t * 24), Math.max(3, Math.round(L / 9)), 3.2); ctx.globalCompositeOperation = "lighter"; line(pts, "rgba(140,190,255,.55)", 3.6); line(pts, "rgba(255,250,210,.95)", 1.1); ctx.globalCompositeOperation = "source-over"; liveGlow(ctx, x2, y2, 8, T.sparkGlow, 0.9); break; }
        case "ice": case "beam": { ctx.strokeStyle = T.iceBeam; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 0.8; ctx.stroke(); liveGlow(ctx, x2, y2, 8, T.iceGlow, 0.8); for (let i = 0; i < 4; i++) { const b = i * 1.6 + t * 3; poly([[x2 + Math.cos(b) * 5, y2 + Math.sin(b) * 4], [x2 + Math.cos(b + 0.3) * 2, y2 + Math.sin(b + 0.3) * 2], [x2 + Math.cos(b - 0.3) * 2, y2 + Math.sin(b - 0.3) * 2]]); paint("#eaf8ff", null); } break; }
        case "frost": case "shard": { for (let i = 1; i <= 3; i++) { circ(x2 - ux * i * 4, y2 - uy * i * 4, 1.2 - i * 0.25); paint("rgba(230,248,255,.8)", null); } liveGlow(ctx, x2, y2, 7, T.iceGlow, 0.8); ctx.translate(x2, y2); ctx.rotate(a + PI / 2); crystal(0, 4, 3.6, 9, 0, [T.deepIce[0], T.deepIce[1]]); break; }
        case "ball": case "cannon": { for (let i = 1; i <= 3; i++) { const k = i * 4; circ(x2 - ux * k * 1.4, y2 - uy * k * 1.4, 0.8 + i * 0.5); paint(`rgba(${T.smokeRGB},${0.55 - i * 0.13})`, null); } circ(x2, y2, 2.9); paint(rg(x2 - 0.9, y2 - 0.9, 0.3, 2.9, [T.iron[0], T.iron[2]]), T.ol, 0.8); circ(x2 - 0.9, y2 - 0.9, 0.8); paint("rgba(255,255,255,.6)", null); break; }
        case "rocket": { for (let i = 1; i <= 4; i++) { circ(x2 - ux * (6 + i * 3.4), y2 - uy * (6 + i * 3.4), 0.9 + i * 0.6); paint(`rgba(${T.smokeRGB},${0.5 - i * 0.1})`, null); } liveGlow(ctx, x2 - ux * 6, y2 - uy * 6, 6, T.fireGlow, 0.9); ctx.translate(x2, y2); ctx.rotate(a + PI / 2); ctx.scale(0.75, 0.75); poly([[-1.8, 6], [0, 10 + (Math.floor(t * 20) % 2) * 2], [1.8, 6]]); paint(T.flame[1], null); ctx.translate(0, 6); rocketShape(9, false); break; }
        case "mine": { spikyMine(x2, y2, 2.8, Math.floor(t * 3) % 2 === 0); break; }
        case "fire": case "fireball": { for (let i = 1; i <= 4; i++) { circ(x2 - ux * i * 3, y2 - uy * i * 3, 2.6 - i * 0.45); paint(i < 2 ? T.flame[1] : `rgba(255,${120 - i * 20},40,${0.8 - i * 0.15})`, null); } liveGlow(ctx, x2, y2, 9, T.fireGlow, 0.95); circ(x2, y2, 2.8); paint(rg(x2, y2, 0.3, 2.8, [T.flame[0], T.flame[1], T.flame[2]]), null); break; }
        case "breath": { const w = Math.min(14, L * 0.35); ctx.globalCompositeOperation = "lighter"; poly([[x1, y1], [x2 - uy * w, y2 + ux * w], [x2 + uy * w, y2 - ux * w]]); ctx.fillStyle = (() => { const g = ctx.createLinearGradient(x1, y1, x2, y2); g.addColorStop(0, "rgba(255,240,170,.9)"); g.addColorStop(0.5, "rgba(255,140,50,.6)"); g.addColorStop(1, "rgba(255,60,20,0)"); return g; })(); ctx.fill(); ctx.globalCompositeOperation = "source-over"; break; }
        case "heal": { ctx.strokeStyle = "rgba(160,255,180,.55)"; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = "rgba(240,255,240,.95)"; ctx.lineWidth = 0.8; ctx.stroke(); liveGlow(ctx, x2, y2, 8, T.healGlow, 0.9); ctx.fillStyle = "#eaffee"; ctx.fillRect(x2 - 0.6, y2 - 3, 1.2, 6); ctx.fillRect(x2 - 3, y2 - 0.6, 6, 1.2); break; }
        default: liveGlow(ctx, x2, y2, 5, T.bossAura, 0.8); circ(x2, y2, 2); paint("#fff4d0", null);
      }
    } finally { ctx.restore(); c = pc; }
  };
  // 連鎖閃電：一串點
  ART.chain = function (ctx, pts, t, alpha) {
    if (!pts || pts.length < 2) return;
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    for (let i = 1; i < pts.length; i++) ART.proj(ctx, "chain", pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], (t || 0) + i);
    ctx.restore();
  };
  // 依引擎的砲彈資料挑種類：p＝G.proj 一筆（{type, st}）
  ART.projKind = function (p) {
    const st = p && p.st || {};
    if (p.type === "arrow") return st.strong ? "snipe" : "arrow";
    if (p.type === "mage") return st.chain ? "chain" : st.poly ? "arcane" : "bolt";
    if (p.type === "ice") return st.freeze ? "frost" : "ice";
    if (p.type === "cannon") return st.fly ? "rocket" : "ball";
    return "bolt";
  };

  // ═════════════════════════════ UI 圖示 ═════════════════════════════
  // ART.icon(canvas, kind, id, lv[, branch])：kind＝tower／enemy／hero／summon；塔的分支可寫 id＝"arrow:A"；召喚獸 lv≥10（或 lv===true）＝進化外型
  // 量外型範圍（只畫本體、不含光暈），結果記住；拿不到像素（舊瀏覽器／跨來源）就回 null 用預估框
  const BBOX = new Map();
  function measureBox(key, draw, x0, y0, w, h) {
    if (BBOX.has(key)) return BBOX.get(key);
    const S = 3, W = Math.ceil(w * S), H = Math.ceil(h * S), cv = mkCanvas(W, H);
    let r = null;
    if (cv) {
      const g = cv.getContext("2d"), pc = c, pn = NOFX;
      g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); g.lineJoin = "round"; g.lineCap = "round";
      c = g; NOFX = true;
      try {
        draw();
        const px = g.getImageData(0, 0, W, H).data;
        let x1 = W, y1 = H, x2 = -1, y2 = -1;
        for (let yy = 0; yy < H; yy++) { const row = yy * W * 4; for (let xx = 0; xx < W; xx++) if (px[row + xx * 4 + 3] > 40) { if (xx < x1) x1 = xx; if (xx > x2) x2 = xx; if (yy < y1) y1 = yy; if (yy > y2) y2 = yy; } }
        if (x2 >= 0) r = { x: x0 + x1 / S, y: y0 + y1 / S, w: (x2 - x1 + 1) / S, h: (y2 - y1 + 1) / S };
      } catch (e) { r = null; } finally { c = pc; NOFX = pn; }
    }
    BBOX.set(key, r); return r;
  }
  ART.icon = function (canvas, kind, id, lv, branch) {
    if (!canvas || !canvas.getContext) return;
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    let bx, by, bw, bh, draw;
    id = String(id || "");
    if (kind === "tower") {
      const m = id.split(/[:.\/]/), type = m[0] || "arrow"; let L = Math.max(1, Math.min(6, (lv | 0) || 1)), br = (m[1] || branch || "").toUpperCase();
      if (br && L < 4) L = 4; br = L >= 4 ? (br === "B" ? "B" : "A") : "";
      const top = towerTop(type, L, br); bx = -21; bw = 42; by = top - 3; bh = -top + 11;
      draw = () => (TOWER_FN[type] || towerArrow)(0, 0, L, br, 0, 0);
      // 依實際外型（量剪影的像素範圍）縮放填滿：高塔不再縮成一小根、矮塔也不會留一大片空
      const bb = measureBox("tw|" + type + "|" + L + "|" + br, draw, -40, top - 24, 80, -top + 40);
      if (bb) { const pad = 1.2; bx = bb.x - pad; by = bb.y - pad; bw = bb.w + pad * 2; bh = bb.h + pad * 2; }
    } else if (kind === "enemy") {
      const d = EN[id] || EN.slime, bd = d.body, v = d.v ? d.v({ heads: lv || undefined, phase: lv || 1 }) : 0;
      bw = Math.max(bd.w, bd.h) + 6; bh = bw; bx = -bw / 2; by = bd.b - bd.h / 2 - bh / 2;
      draw = () => d.fn(0, 0, 0, v);
    } else if (kind === "hero") {
      bx = -15; by = -31; bw = 30; bh = 34; if (id === "dragon") { bx = -17; bw = 36; }
      draw = () => (HERO[id] || heroKnight)(0, 0, 0, 0);
    } else {
      const evo = lv === true || (lv | 0) >= 10;
      const sc = evo ? 1.3 : 1.1; bw = 34 * sc; bh = 34 * sc; bx = -bw / 2 + 1; by = -bh + 4 - (id === "phoenix" ? 4 : 0);
      draw = () => (SUM[id] || sumFox)(0, 0, 0, evo ? 1 : 0);
    }
    const s = Math.min(W / bw, H / bh);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.setTransform(s, 0, 0, s, W / 2 - (bx + bw / 2) * s, H / 2 - (by + bh / 2) * s);
    g.lineJoin = "round"; g.lineCap = "round";
    const pc = c; c = g; try { draw(); } finally { c = pc; g.setTransform(1, 0, 0, 1, 0, 0); }
  };

  // 開局前把會用到的圖先畫進快取（避免第一隻怪出場時卡一下）
  ART.prewarm = function (ctx, opt) {
    opt = opt || {};
    for (const ty of opt.enemies || []) for (let f = 0; f < 4; f++) { const d = EN[ty]; if (!d) continue; ART.enemy(ctx, ty, -999, -999, f / d.fps + 0.001, {}); }
    for (const [ty, lv, br] of opt.towers || []) for (let f = 0; f < 2; f++) ART.tower(ctx, ty, lv, br, -999, -999, f / 2.5 + 0.001, {});
  };
  // ═════════════════════════════ v3：增益卡、營地／面板小圖示、能量格、狂熱條、怒氣光環 ═════════════════════════════
  // 圖形全部 canvas 自繪；字只用來寫「A」「A+」「!」「−1」這類小標（不用 emoji 當圖形）。
  function at(x, y, s, rot, fn) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (s !== 1) c.scale(s, s); try { fn(); } finally { c.restore(); } }
  function sparkle(x, y, r, col) { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y); c.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r); c.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y); c.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r); c.closePath(); c.fillStyle = col || "#fff6c8"; c.fill(); }
  function txt(s, x, y, size, fill, stroke) { c.font = "900 " + size + "px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; if (stroke !== null) { c.lineJoin = "round"; c.lineWidth = size * 0.3; c.strokeStyle = stroke || T.ol; c.strokeText(s, x, y); } c.fillStyle = fill; c.fillText(s, x, y); }
  const hexA = (hex, a) => { let h = String(hex || "#888888").replace("#", ""); if (h.length === 3) h = h.replace(/./g, m => m + m); const n = parseInt(h, 16) || 0; return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };
  function heartPath(x, y, r) { c.beginPath(); c.moveTo(x, y + r); c.bezierCurveTo(x - r * 1.7, y - r * 0.15, x - r * 0.85, y - r * 1.55, x, y - r * 0.5); c.bezierCurveTo(x + r * 0.85, y - r * 1.55, x + r * 1.7, y - r * 0.15, x, y + r); c.closePath(); }

  // 四派（顏色同 _data/cards_v3.json 的 factions）
  const FAC = {
    guard:   { name: "守護", color: "#7fb3d8", pal: ["#e2f2fd", "#7fb3d8", "#2f5f8e"], glow: "rgba(127,190,235,A)" },
    flame:   { name: "烈焰", color: "#e0704a", pal: ["#ffe6a8", "#ff9a4a", "#b8402a"], glow: "rgba(255,130,70,A)" },
    thunder: { name: "雷鳴", color: "#f2c14e", pal: ["#fff8c8", "#f2c14e", "#a87a1a"], glow: "rgba(255,220,90,A)" },
    frost:   { name: "冰霜", color: "#9bd4ff", pal: ["#f2fbff", "#9bd4ff", "#3a7ab8"], glow: "rgba(150,215,255,A)" },
    none:    { name: "中立", color: "#c8b4ff", pal: ["#f6f0ff", "#c8b4ff", "#6a58b0"], glow: "rgba(200,180,255,A)" }
  };
  ART.FACTION_ART = FAC;
  const facOf = f => FAC[f] || FAC.none;
  const FLAME = ["#fff2b0", "#ffae4a", "#e0582a"], REDF = ["#fff0c0", "#ff7a3a", "#c8203a"], GOLD3 = ["#fff2c0", "#E1B86A", "#8a5a28"];

  // ───── 基本圖元（原點置中、半徑約 10；用 at() 放大縮小組合）
  function swordG(blade, gcol) {
    if (gcol) glow(0, -4, 10, gcol, 0.75);
    poly([[-1.7, 2], [-1.7, -8], [0, -11], [1.7, -8], [1.7, 2]]); paint(lg(-1.7, 0, 1.7, 0, ["#9aaabb", blade || "#e4ecf4", "#ffffff"]));
    line([[0, 1], [0, -8.5]], "rgba(110,130,160,.55)", 0.5);
    rr(-5.2, 1.8, 10.4, 2.4, 1.1); paint(lg(0, 1.8, 0, 4.2, [T.goldL, T.bronze[1]]));
    rr(-1.1, 4.2, 2.2, 4.4, 0.8); paint(T.woodDark); circ(0, 9.5, 1.6); paint(T.goldL);
  }
  function shieldPath() { c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(4.5, -7.6, 8.6, -8); c.lineTo(8.2, 1); c.quadraticCurveTo(7, 7.5, 0, 11); c.quadraticCurveTo(-7, 7.5, -8.2, 1); c.lineTo(-8.6, -8); c.quadraticCurveTo(-4.5, -7.6, 0, -10); c.closePath(); }
  function shieldG(pal, emblem) {
    shieldPath(); paint(lg(-8, -9, 8, 9, [pal[2], pal[1], pal[0]]), T.ol, 1.4);
    c.save(); shieldPath(); c.clip(); c.fillStyle = "rgba(255,255,255,.16)"; c.fillRect(0, -11, 10, 23); c.restore();
    at(0, 0.4, 0.84, 0, () => { shieldPath(); c.strokeStyle = T.gold; c.lineWidth = 1.2; c.stroke(); });
    if (emblem) emblem();
  }
  function flameG(pal) {
    c.beginPath(); c.moveTo(0, -11); c.bezierCurveTo(2.5, -6, 7.8, -3.5, 7.8, 2.6); c.bezierCurveTo(7.8, 7.6, 4.2, 10.6, 0, 10.6); c.bezierCurveTo(-4.2, 10.6, -7.8, 7.6, -7.8, 2.6);
    c.bezierCurveTo(-7.8, -1.2, -5.4, -3.2, -4.4, -6.8); c.bezierCurveTo(-2.8, -4.6, -1.8, -4.2, -1.2, -3.6); c.bezierCurveTo(-1.6, -6.4, -1, -9, 0, -11); c.closePath();
    paint(lg(0, -11, 0, 10.6, [pal[1], pal[2]]), T.ol, 1.3);
    c.beginPath(); c.moveTo(0.4, -3.4); c.bezierCurveTo(2, -0.4, 4.4, 1.6, 4.4, 4.6); c.bezierCurveTo(4.4, 7.4, 2.4, 8.8, 0, 8.8); c.bezierCurveTo(-2.4, 8.8, -4.4, 7.4, -4.4, 4.6); c.bezierCurveTo(-4.4, 2.2, -1.6, 0.6, 0.4, -3.4); c.closePath();
    paint(lg(0, -3, 0, 9, [pal[0], pal[1]]), null);
    ell(0, 6, 2, 2.4); c.fillStyle = "rgba(255,255,240,.85)"; c.fill();
  }
  function boltG(pal) { pal = pal || FAC.thunder.pal; poly([[3.2, -11], [-6, 1.2], [-0.6, 1.2], [-3.6, 11], [6.4, -2.4], [1, -2.4], [5.4, -11]]); paint(lg(-6, -11, 6, 11, [pal[0], pal[1], pal[2]]), T.ol, 1.3); line([[3.2, -9], [-3, 0]], "rgba(255,255,255,.75)", 0.8); }
  function flakeG(col) { snowflake(0, 0, 9.6, col || "#e6f8ff", 1.5); poly([0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * PI / 3) * 2.6, Math.sin(i * PI / 3) * 2.6])); paint("#ffffff", T.ol, 0.6); }
  function hourglassG(sandTop, sandBot, frame) {
    frame = frame || T.wood;
    for (const s of [-1, 1]) limb([[s * 6.4, -9], [s * 6.4, 9]], frame, 1.3);
    poly([[-5.2, -8.4], [5.2, -8.4], [1, 0], [5.2, 8.4], [-5.2, 8.4], [-1, 0]]); paint("rgba(215,238,255,.38)", T.ol, 1.1);
    if (sandTop) { poly([[-3.8, -5.6], [3.8, -5.6], [0.6, -0.8], [-0.6, -0.8]]); paint(sandTop, null); }
    if (sandBot) { poly([[-4.6, 8], [4.6, 8], [1.6, 4.2], [-1.6, 4.2]]); paint(sandBot, null); line([[0, -0.8], [0, 6]], sandBot, 0.7); }
    rr(-7.6, -11.2, 15.2, 2.8, 1.2); paint(lg(0, -11.2, 0, -8.4, [T.woodLight, frame]));
    rr(-7.6, 8.4, 15.2, 2.8, 1.2); paint(lg(0, 8.4, 0, 11.2, [T.woodLight, frame]));
    line([[-3.4, -7], [-1.2, -2.4]], "rgba(255,255,255,.7)", 0.7);
  }
  function bookG(cov, gl) { openBook(0, 6.5, 9, 12.5, cov || BOOK.cover, gl, 2); }
  function coinG(r) { r = r || 6; circ(0, 0, r); paint(rg(-r * 0.3, -r * 0.3, 0.5, r, [T.goldL, T.gold, T.bronze[2]]), T.ol, 1.1); circ(0, 0, r * 0.68); c.strokeStyle = "rgba(138,90,40,.7)"; c.lineWidth = 0.7; c.stroke(); sparkle(0, 0, r * 0.45, "#fff6d0"); }
  function bagG() {
    const col = ["#e8bc7a", "#b9763a", "#6e4420"];
    c.beginPath(); c.moveTo(-3, -5.5); c.bezierCurveTo(-9.5, -2, -10, 9.5, 0, 9.8); c.bezierCurveTo(10, 9.5, 9.5, -2, 3, -5.5); c.closePath(); paint(rg(-2, 1, 1, 11, col));
    poly([[-3.4, -5.4], [-5.4, -9.6], [-1.4, -8.2], [0, -10.6], [1.4, -8.2], [5.4, -9.6], [3.4, -5.4]]); paint(col[1]);
    rr(-4.2, -6.8, 8.4, 2.2, 0.8); paint(T.gold, T.ol, 0.8);
    at(0, 2.6, 0.62, 0, () => coinG(6));
  }
  function wrenchG() {
    rr(-1.9, -3, 3.8, 14, 1.8); paint(sg3(0, 1.9, T.iron)); circ(0, -6, 4.8); paint(sg3(0, 4.8, T.iron));
    rr(-1.7, -12, 3.4, 6.6, 0.6); paint("#141c30", T.ol, 0.6); circ(0, 8.6, 1); paint("#141c30", null);
  }
  function hammerG() { rr(-1.3, -4, 2.6, 15, 1); paint(sg3(0, 1.3, [T.woodLight, T.wood, T.woodDark])); rr(-6.5, -10, 13, 6, 1.4); paint(sg3(0, 6.5, T.iron)); rr(-6.5, -10, 2.4, 6, 0.8); paint(T.iron[0], null); }
  function anvilG() { poly([[-10, -4.5], [5.5, -4.5], [10.5, -6.4], [10, -4], [6.5, -0.6], [3, 0.6], [3, 4], [6.5, 6.2], [-6.5, 6.2], [-3, 4], [-3, 0.6], [-7.5, -0.8]]); paint(lg(0, -6.4, 0, 6.2, [T.iron[0], T.iron[1], T.iron[2]])); line([[-9, -3.6], [5, -3.6]], "rgba(255,255,255,.55)", 0.8); }
  function bombG(face, col, letter) {
    c.beginPath(); c.moveTo(1.5, -7); c.quadraticCurveTo(4, -12, 8, -10.5); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = "#cdb080"; c.lineWidth = 1.2; c.stroke();
    glow(8, -10.5, 5.5, T.fireGlow, 0.9); sparkle(8, -10.5, 3, "#fff3a0");
    circ(0, 1.5, 8.6); paint(rg(-2.6, -1.4, 0.5, 9, col || ["#6a7a94", "#2c3448", "#0e121e"]));
    rr(-2.8, -8.4, 5.6, 3.4, 1); paint(T.iron[1]);
    circ(-3.4, -2, 1.8); c.fillStyle = "rgba(255,255,255,.4)"; c.fill();
    if (face) { for (const s of [-1, 1]) { ell(s * 2.8, 0.6, 1.1, 1.6); paint("#fff2c8", null); } c.beginPath(); c.arc(0, 2.6, 3.8, 0.25, PI - 0.25); c.strokeStyle = "#fff2c8"; c.lineWidth = 1.3; c.stroke(); }
    if (letter) txt(letter, 0.4, 2.4, 8, "#fff2c8", null);
  }
  function towerG(roof, flag) {
    rr(-5.4, -4, 10.8, 14.5, 1); paint(sg3(0, 5.4, T.stone));
    for (const yy of [0, 4, 8]) line([[-5.4, yy], [5.4, yy]], T.stoneLine, 0.5);
    poly([[-7, -3.6], [0, -13.4], [7, -3.6]]); paint(sg3(0, 7, roof || T.roofA));
    rr(-1.1, -0.6, 2.2, 4.4, 1.1); paint(T.windowLit, null);
    if (flag) pennant(0, -13, 6, flag, 0);
  }
  function foxG(pal) {
    pal = pal || T.fox;
    poly([[0, 8.5], [-8.4, -0.5], [-8, -10], [-3.2, -4.8], [3.2, -4.8], [8, -10], [8.4, -0.5]]); paint(lg(0, -10, 0, 8.5, [pal[0], pal[1], pal[2]]));
    for (const s of [-1, 1]) { poly([[s * 7.2, -8], [s * 4.6, -5], [s * 7.4, -2.6]]); paint("#3a1a10", null); poly([[0, 8.5], [s * 7, 0.5], [s * 1.6, 2]]); paint("#fff6ec", null); ell(s * 3.2, -1, 1.1, 1.6); paint("#1a0e08", null); }
    circ(0, 7.4, 1.3); paint("#1a0e08", null);
  }
  function wolfG(pal) {
    pal = pal || T.wolf;
    poly([[0, 10.4], [-5.4, 2.4], [-8.8, -1.6], [-7.4, -11], [-3, -5.6], [3, -5.6], [7.4, -11], [8.8, -1.6], [5.4, 2.4]]); paint(lg(0, -11, 0, 10, [pal[0], pal[1], pal[2]]));
    for (const s of [-1, 1]) { poly([[s * 6.6, -9], [s * 4.2, -5.8], [s * 6.8, -3.6]]); paint(pal[2], null); poly([[0, 10.4], [s * 4.6, 2.8], [s * 1.2, 3.4]]); paint("#eef3fa", null); poly([[s * 1.8, -1.4], [s * 5.2, -2.6], [s * 4.4, -0.2]]); paint(T.boltY, null); }
    ell(0, 9.2, 1.5, 1.1); paint("#10141e", null);
  }
  function shellG() {
    for (const dx of [-7, 7]) { ell(dx, 5.6, 2.6, 2); paint(T.turtle[1]); }
    circ(-10.6, 1.2, 2.8); paint(T.turtle[0]); circ(-11.4, 0.6, 0.6); paint("#10141e", null);
    c.beginPath(); c.moveTo(-10, 4); c.bezierCurveTo(-10, -9.5, 10, -9.5, 10, 4); c.closePath(); paint(rg(-2, -3, 1, 11, T.shellRock));
    for (const [hx, hy] of [[0, -2.6], [-5.4, 1.2], [5.4, 1.2]]) { poly([0, 1, 2, 3, 4, 5].map(i => [hx + Math.cos(i * PI / 3) * 2.7, hy + Math.sin(i * PI / 3) * 2.3])); c.strokeStyle = T.shellRock[2]; c.lineWidth = 0.8; c.stroke(); }
    rr(-10.6, 3, 21.2, 2.4, 1); paint(T.turtle[1]);
  }
  function wingsG(pal) {
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 1.4, 1); c.bezierCurveTo(s * 5, -9, s * 11, -11.5, s * 13, -7.4); c.bezierCurveTo(s * 10.6, -6.4, s * 11.6, -3.6, s * 12.6, -1.6);
      c.bezierCurveTo(s * 9.6, -1.4, s * 9.8, 1.4, s * 10.8, 3.6); c.bezierCurveTo(s * 7, 4.6, s * 3.6, 4, s * 1.4, 3); c.closePath();
      paint(lg(s * 1.4, 2, s * 13, -8, [pal[2], pal[1], pal[0]])); line([[s * 3, 0], [s * 10, -6]], "rgba(255,255,255,.5)", 0.6); line([[s * 3.4, 2], [s * 9.6, 0.4]], "rgba(255,255,255,.35)", 0.5);
    }
  }
  function owlG() {
    for (const s of [-1, 1]) { poly([[s * 2.6, -5.6], [s * 7.6, -9.8], [s * 7.2, -3.6]]); paint("#6a4a2e"); }
    ell(0, 2, 8, 9.4); paint(rg(0, 0, 1, 10, ["#d8b080", "#8a6040", "#4e3420"]));
    ell(0, -0.6, 6.8, 4.8); paint("#f2e0b8", null);
    for (const s of [-1, 1]) { circ(s * 3.1, -0.6, 2.7); paint("#ffd84a", T.ol, 0.8); circ(s * 3.1, -0.4, 1.25); paint("#1a1008", null); circ(s * 3.1 - 0.5, -1.2, 0.45); paint("#fff", null); }
    poly([[-1.1, 1.8], [1.1, 1.8], [0, 4]]); paint("#e0a030", T.ol, 0.6);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-2.4 + i * 2.4, 7, 1.2, 0, PI); c.strokeStyle = "rgba(60,36,20,.6)"; c.lineWidth = 0.6; c.stroke(); }
    rr(-4.4, -9.4, 8.8, 3.2, 0.6); paint("#1c1c30");
    poly([[-9, -9.8], [0, -13.4], [9, -9.8], [0, -6.4]]); paint("#2c2c4a");
    line([[0, -9.9], [6.6, -8.8], [7, -4.6]], T.gold, 0.8); circ(7, -4.2, 0.95); paint(T.gold, null);
  }
  function bowlG() {
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, -4); c.bezierCurveTo(i * 4 - 2.4, -6.5, i * 4 + 2.4, -8.5, i * 4, -11.4); c.strokeStyle = "rgba(240,246,255,.8)"; c.lineWidth = 1.2; c.stroke(); }
    c.beginPath(); c.moveTo(-10.5, -1.5); c.lineTo(10.5, -1.5); c.bezierCurveTo(10.5, 6.5, 5, 10, 0, 10); c.bezierCurveTo(-5, 10, -10.5, 6.5, -10.5, -1.5); c.closePath(); paint(lg(-10, 0, 10, 0, ["#8a5226", "#d89a5a", "#f0d6a0"]));
    ell(0, -1.5, 10.5, 2.8); paint("#f0a040"); rr(-6.5, 3.6, 13, 1.4, 0.6); paint("#c8423a", null);
  }
  function bentoG() {
    rr(-11, -7.5, 22, 16, 2.4); paint(lg(0, -7.5, 0, 8.5, ["#d8604e", "#8a2a26"])); rr(-9.4, -5.8, 18.8, 12.6, 1.6); paint("#2a1a18", null); line([[1.4, -5.8], [1.4, 6.8]], "#8a2a26", 1.2);
    for (let i = 0; i < 3; i++) at(-4.2, -2.6 + i * 3.4, 1, -0.08 + i * 0.06, () => { rr(-4, -1.3, 8, 2.6, 0.5); paint(["#fff6e0", "#e8f4ff", "#fff0f4"][i], T.ol, 0.6); line([[-2.8, 0], [1.6, 0]], "#5a8ae0", 0.5); c.beginPath(); c.moveTo(2.1, -0.3); c.lineTo(2.7, 0.5); c.lineTo(3.5, -0.8); c.strokeStyle = "#d0405a"; c.lineWidth = 0.6; c.stroke(); });
    heartPath(5.6, 1, 3.4); paint("#ffffff", T.ol, 0.8); rr(3.4, 2.2, 4.4, 1.8, 0.4); paint("#1e3a2a", null);
  }
  function batteryG() {
    rr(-2.6, -11.6, 5.2, 2.8, 0.8); paint(T.iron[0]); rr(-6.4, -9.4, 12.8, 19.4, 2.4); paint(lg(-6.4, 0, 6.4, 0, ["#22324e", "#4a6a98", "#2a3a58"]));
    rr(-4.6, -7.4, 9.2, 15.4, 1.4); paint(lg(0, 8, 0, -7.4, ["#3fb37a", "#b8ffd0"]), null); at(0, 0.4, 0.62, 0, () => boltG(["#fffbe0", T.boltY, "#d09a20"]));
  }
  function notesG() {
    rr(-8, -10, 16, 20, 1.6); paint(lg(-8, 0, 8, 0, ["#2c4f86", "#5a8ad0", "#3a62a0"]));
    for (let i = 0; i < 5; i++) { circ(-8, -7.4 + i * 3.7, 1.2); paint("#d8dee8", T.ol, 0.6); }
    for (const [x0, y0, r, col] of [[7, -7, 0.3, "#ffe066"], [8, -1.4, -0.15, "#ff9ac0"], [6.6, 4.8, 0.22, "#8ae0a8"]]) at(x0, y0, 1, r, () => { rr(-2.6, -2.2, 5.2, 4.4, 0.4); paint(col, T.ol, 0.6); });
    txt("A+", -0.6, 0.4, 7.2, "#fff6c8", T.ol);
  }
  function phonesG() {
    c.beginPath(); c.arc(0, 1, 8.6, PI * 1.05, PI * 1.95); c.strokeStyle = T.ol; c.lineWidth = 4.4; c.stroke(); c.strokeStyle = "#e0566a"; c.lineWidth = 2.2; c.stroke();
    for (const s of [-1, 1]) { rr(s * 8.6 - 2.8, -0.6, 5.6, 8.6, 2.4); paint(lg(0, -0.6, 0, 8, ["#ff8a9a", "#c03a50"])); }
  }
  function boneG() {
    union([() => circ(-8, -2.4, 2.8), () => circ(-8, 2.4, 2.8), () => circ(8, -2.4, 2.8), () => circ(8, 2.4, 2.8), () => rr(-8, -2.6, 16, 5.2, 1)], "#f0cc8e");
    for (const [dx, dy] of [[-4, -0.8], [0, 1], [4, -0.6], [-8.6, -2.4], [8.4, 2]]) { circ(dx, dy, 0.7); paint("#9a6a30", null); }
  }
  function handG(col) {
    union([() => rr(-4.8, -2, 9.6, 10, 3.4), () => rr(-4.8, -10, 2.3, 10, 1.1), () => rr(-2.3, -11.4, 2.3, 10, 1.1), () => rr(0.2, -11, 2.3, 10, 1.1), () => rr(2.6, -9.2, 2.2, 9, 1.1),
      () => { c.save(); c.translate(-5.2, 2); c.rotate(-0.75); rr(-1.2, -6, 2.4, 7.5, 1.1); c.restore(); }], col || T.skin);
  }
  function targetG() { for (const [r, col] of [[10, "#f4f0e8"], [7.4, "#e0485a"], [4.8, "#f4f0e8"], [2.4, "#e0485a"]]) { circ(0, 0, r); paint(col, T.ol, r === 10 ? 1.3 : 0.6); } }
  function spyglassG() {
    at(0, 0, 1, -0.6, () => {
      rr(-2.4, -2, 4.8, 13, 1.2); paint(sg3(0, 2.4, T.bronze)); rr(-3.2, -8, 6.4, 7, 1.2); paint(sg3(0, 3.2, T.bronze)); rr(-4, -12.4, 8, 5, 1.4); paint(sg3(0, 4, T.bronze));
      ell(0, -12.4, 4, 1.4); paint("#9bd8ff", T.ol, 0.8); for (const yy of [-7.6, -1.6]) { rr(-3.4, yy, 6.8, 1.2, 0.5); paint(T.goldL, T.ol, 0.5); }
    });
  }
  function eraserG() { at(0, 0, 1, -0.5, () => { rr(-4, -8, 8, 16, 1.6); paint("#f29ab0"); rr(-4, 1.5, 8, 6.5, 1.2); paint("#5a8ae0"); }); }
  function bulbG(on) {
    if (on) glow(0, -3, 13, "rgba(255,236,140,A)", 0.85);
    c.beginPath(); c.arc(0, -3, 6.6, PI * 0.78, PI * 2.22); c.lineTo(2.6, 4.4); c.lineTo(-2.6, 4.4); c.closePath(); paint(rg(-1.6, -5, 0.5, 7, ["#ffffff", "#fff0a0", "#f2c14e"]));
    rr(-3, 4.4, 6, 4.6, 1); paint(sg3(0, 3, T.iron)); line([[-3, 6.4], [3, 6.4]], T.ol, 0.5); line([[-1.6, -4], [0, -1.4], [1.6, -4]], "#d09a20", 0.8);
  }
  function stairsG() {
    poly([[-11, 9], [-11, 4.5], [-5.5, 4.5], [-5.5, 0], [0, 0], [0, -4.5], [5.5, -4.5], [5.5, -9], [11, -9], [11, 9]]); paint(lg(-11, 9, 11, -9, ["#24508a", "#4a8ad8", "#9bd4ff"]));
    line([[-11, 4.5], [-5.5, 4.5], [-5.5, 0], [0, 0], [0, -4.5], [5.5, -4.5], [5.5, -9], [11, -9]], "rgba(255,255,255,.55)", 0.7);
  }
  function crownG() {
    poly([[-7, 3], [-8, -5], [-3.6, -1.6], [0, -7.4], [3.6, -1.6], [8, -5], [7, 3]]); paint(lg(0, -7.4, 0, 3, [T.goldL, T.gold, T.bronze[1]]));
    rr(-7.2, 2.4, 14.4, 2.6, 0.8); paint(T.bronze[1]); for (const [px, py] of [[-8, -5], [0, -7.4], [8, -5]]) { circ(px, py, 1.2); paint("#e0485a", T.ol, 0.5); }
  }
  function medalG() {
    poly([[-5, -11], [-1.4, -11], [1.6, -2], [-2, -2]]); paint("#e0485a"); poly([[5, -11], [1.4, -11], [-1.6, -2], [2, -2]]); paint("#3a62a0");
    circ(0, 3.4, 6.4); paint(rg(-2, 1, 0.5, 7, [T.goldL, T.gold, T.bronze[2]])); star(0, 3.4, 3.4, "#fff6c8", 0.6);
  }
  function tagG(s) { poly([[-9, -4.6], [4, -4.6], [10, 0], [4, 4.6], [-9, 4.6]]); paint(lg(0, -4.6, 0, 4.6, ["#ff7a7a", "#c8303e"])); circ(5.2, 0, 1.2); paint("#1a1220", T.ol, 0.5); if (s) txt(s, -2.4, 0.4, 6.4, "#fff6c8", T.ol); }
  function pawG(col) { ell(0, 2, 3.4, 2.8); paint(col, T.ol, 0.6); for (const [dx, dy] of [[-3.6, -1.8], [-1.3, -3.8], [1.3, -3.8], [3.6, -1.8]]) { ell(dx, dy, 1.2, 1.5); paint(col, T.ol, 0.5); } }
  function runeG(F, letters, flat) {
    const ry = flat ? 0.42 : 1;
    glow(0, 0, 15, F.glow, 0.6);
    ell(0, 0, 10.5, 10.5 * ry); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = F.pal[1]; c.lineWidth = 1.3; c.stroke();
    ell(0, 0, 7, 7 * ry); c.strokeStyle = F.pal[0]; c.lineWidth = 0.8; c.setLineDash([1.6, 1.2]); c.stroke(); c.setLineDash([]);
    for (const off of [0, PI]) { poly([0, 1, 2].map(i => [Math.cos(off - PI / 2 + i * PI2 / 3) * 7, Math.sin(off - PI / 2 + i * PI2 / 3) * 7 * ry])); c.strokeStyle = F.pal[0]; c.lineWidth = 0.9; c.stroke(); }
    if (letters) for (let i = 0; i < letters.length; i++) { const a = -PI / 2 + i * PI2 / letters.length; txt(letters[i], Math.cos(a) * 8.8, Math.sin(a) * 8.8 * ry, flat ? 2.4 : 3.2, "#fff6d0", null); }
  }
  function headbandG() {
    c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(0, -5, 10, 0); c.strokeStyle = T.ol; c.lineWidth = 6; c.stroke(); c.strokeStyle = "#d8404e"; c.lineWidth = 3.8; c.stroke();
    c.beginPath(); c.moveTo(-9, -1.4); c.quadraticCurveTo(0, -5.6, 9, -1.4); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 0.8; c.stroke();
    for (const [a, b] of [[[13, 3], [11, 9]], [[14.5, 0], [15, 6]]]) { c.beginPath(); c.moveTo(9, -0.6); c.quadraticCurveTo(a[0], a[1], b[0], b[1]); c.lineTo(b[0] + 2, b[1] - 1.2); c.quadraticCurveTo(a[0] + 1.6, a[1] - 2.2, 10, -2); c.closePath(); paint("#c8303e", T.ol, 0.8); }
    circ(9.6, -0.8, 2); paint("#e8505e", T.ol, 0.8);
  }
  function flagG(col, emb) {
    limb([[-6, 11], [-6, -11]], T.woodDark, 1.4); circ(-6, -11.8, 1.5); paint(T.gold);
    c.beginPath(); c.moveTo(-5.4, -10); c.bezierCurveTo(0, -12.5, 4, -7.5, 10, -9.6); c.lineTo(10, 1); c.bezierCurveTo(4, 3, 0, -2, -5.4, 0.4); c.closePath(); paint(lg(-5.4, 0, 10, 0, [col[1], col[0], col[1]]));
    if (emb) emb();
  }
  function crateG() {
    poly([[-10, -3], [-8.6, -9.6], [10, -7.8], [10, -3]]); paint(sg3(0, 10, [T.woodLight, T.wood, T.woodDark]));
    rr(-10, -3, 20, 13, 1.4); paint(sg3(0, 10, [T.woodLight, T.wood, T.woodDark]));
    for (const yy of [1.4, 5.8]) line([[-10, yy], [10, yy]], T.woodDark, 0.7); line([[-9, -2], [9, 9]], T.woodDark, 1);
  }
  function upArrowG(col) { poly([[0, -11], [8, -2], [3.4, -2], [3.4, 10], [-3.4, 10], [-3.4, -2], [-8, -2]]); paint(lg(0, -11, 0, 10, col || [T.goldL, T.gold])); }
  function cannonG() {
    at(0, -1, 1, -0.5, () => { rr(-3.6, -12, 7.2, 15, 2.4); paint(sg3(0, 3.6, T.iron)); ell(0, -12, 3.6, 1.6); paint("#120a06", T.ol, 0.6); rr(-3.9, -4, 7.8, 1.8, 0.8); paint(T.bronze[1], T.ol, 0.5); });
    circ(-1, 5, 4.2); paint(T.woodDark); circ(-1, 5, 1.4); paint(T.gold, null);
  }
  function arcsG(n) { const cols = ["#ff6a7a", "#ffb04a", "#f2e04e", "#5fd39a", "#6ab4ff"]; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(0, 4, 4.6 + i * 2, PI * 1.08, PI * 1.92); c.strokeStyle = T.ol; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = cols[i % 5]; c.lineWidth = 1.2; c.stroke(); } }
  function dummyG() {
    limb([[0, 11], [0, -2]], T.woodDark, 1.6); limb([[-8.6, -0.6], [8.6, -0.6]], T.wood, 1.4);
    ell(0, 2.6, 4.8, 6.2); paint("#d8b868"); for (let i = -1; i <= 1; i++) line([[i * 2 - 1, -2.6], [i * 2 + 1, 7.6]], "#a88a3a", 0.5);
    circ(0, -6.2, 4.2); paint("#e8cc80"); rr(-4.7, -8.6, 9.4, 2.2, 0.6); paint("#ffffff", T.ol, 0.6); circ(0, 2.6, 1.8); paint("#e0485a", null);
    line([[-1.8, -5.6], [-0.8, -5.6]], T.ol, 0.6); line([[0.8, -5.6], [1.8, -5.6]], T.ol, 0.6);
  }
  function noteG(col) { ell(-1.4, 4, 2.2, 1.7, -0.4); paint(col, T.ol, 0.6); limb([[0.6, 3.6], [0.6, -5]], col, 0.8); c.beginPath(); c.moveTo(0.6, -5); c.quadraticCurveTo(3.6, -3.6, 3.2, -0.6); c.strokeStyle = col; c.lineWidth = 1.1; c.stroke(); }
  function rainbowG() { const cols = ["#ff6a7a", "#ffb04a", "#f2e04e", "#5fd39a", "#6ab4ff", "#b48aff"]; for (let i = 0; i < cols.length; i++) { c.beginPath(); c.arc(0, 7, 11.6 - i * 1.5, PI, 0); c.strokeStyle = cols[i]; c.lineWidth = 1.6; c.stroke(); } c.beginPath(); c.arc(0, 7, 12.4, PI, 0); c.strokeStyle = T.ol; c.lineWidth = 0.8; c.stroke(); c.beginPath(); c.arc(0, 7, 2.7, PI, 0); c.stroke(); }
  function boardG() {
    rr(-11.5, -8.5, 23, 15.5, 1.4); paint(sg3(0, 11.5, [T.woodLight, T.wood, T.woodDark])); rr(-9.8, -6.8, 19.6, 12, 0.8); paint("#2a5444", null);
    txt("ABC", -3, -2.6, 4.6, "#eef8f0", null); c.beginPath(); c.moveTo(1.6, 1.2); c.lineTo(3.6, 3.4); c.lineTo(8, -2.2); c.strokeStyle = "#ffe08a"; c.lineWidth = 1.3; c.stroke();
    line([[-8, 2.4], [-1, 2.4]], "rgba(238,248,240,.6)", 0.6);
  }
  function headG(skin, hair, hat) { circ(0, 0, 3.8); paint(skin || T.skin, T.ol, 0.8); c.beginPath(); c.arc(0, -0.6, 4, PI * 1.05, PI * 1.95); c.closePath(); paint(hair || "#5a3a24", null); if (hat) { poly([[-4.4, -2], [0.6, -9], [4.4, -2]]); paint(hat, T.ol, 0.7); } for (const s of [-1, 1]) { circ(s * 1.4, 0.6, 0.55); paint("#1a1008", null); } }
  function cloudG(col) { union([() => circ(-6, 1, 4.4), () => circ(0, -1.4, 5.6), () => circ(6, 1, 4.2), () => rr(-9, 0, 18, 5, 2.4)], col || "#eef4ff"); }
  function iceCubeG() { rr(-6, -6, 12, 12, 2); paint(lg(-6, -6, 6, 6, ["rgba(240,250,255,.95)", "rgba(150,210,250,.85)"]), T.ol, 1); line([[-4, -3], [-1, -4.4]], "#ffffff", 0.8); }
  function batG(col) { c.beginPath(); c.moveTo(0, -1.5); c.quadraticCurveTo(-4, -5, -9, -3); c.quadraticCurveTo(-7, -1, -7.6, 1.6); c.quadraticCurveTo(-5, 0, -3.6, 2.4); c.quadraticCurveTo(-2, 1, 0, 2.6); c.quadraticCurveTo(2, 1, 3.6, 2.4); c.quadraticCurveTo(5, 0, 7.6, 1.6); c.quadraticCurveTo(7, -1, 9, -3); c.quadraticCurveTo(4, -5, 0, -1.5); c.closePath(); paint(col || T.batBody, T.ol, 0.8); for (const s of [-1, 1]) { circ(s * 1, -0.3, 0.5); paint(T.enemyEye, null); } }

  // ───── 卡片圖示（名稱＝cards_v3.json 的 icon；每張一個主圖＋小配件；畫在半徑約 22 的方框裡）
  const ICONS = {
    "headband": () => { at(-1, 5, 1.55, 0, headbandG); at(-1, -9, 0.78, 0, () => flameG(REDF)); },
    "whetstone": () => { at(0, 10, 1, 0, () => { rr(-14, -3.5, 28, 7.5, 2.2); paint(lg(0, -3.5, 0, 4, ["#c4ccd8", "#6a7484"])); }); at(1, -4, 1.45, 0.9, () => swordG()); for (let i = 0; i < 5; i++) { glow(-6 - i * 2.4, 4 - i * 2.2, 2.6, T.fireGlow, 0.9); sparkle(-6 - i * 2.4, 4 - i * 2.2, 1.8 - i * 0.2, "#ffc060"); } },
    "soup": () => { at(0, 6, 1.6, 0, bowlG); at(0, 2.4, 0.4, 0, () => shieldG(FAC.guard.pal)); },
    "castle-shield": () => { at(0, 4, 1.55, 0, () => towerG(T.roofC, T.gold)); ell(0, 0, 18.5, 19.5); paint(rg(-5, -6, 2, 20, ["rgba(200,235,255,.06)", "rgba(150,210,255,.22)", "rgba(110,190,255,.42)"]), "rgba(200,236,255,.95)", 1.2); c.beginPath(); c.arc(0, 0, 15.5, PI * 1.15, PI * 1.45); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 1.4; c.stroke(); for (const [sx, sy] of [[-11, -8], [12, -4], [8, 12]]) sparkle(sx, sy, 2.4, "#ffffff"); },
    "banner": () => { at(0, 0, 1.75, 0, () => flagG(["#4a7ac8", "#24406e"], () => { at(2.4, -4.8, 0.36, 0, () => shieldG(GOLD3)); txt("A", 2.4, -4.6, 3.6, "#24406e", null); })); for (const dx of [-14, -8]) line([[dx, 21], [dx + 1.5, 16]], T.tuft, 1.4); },
    "chant": () => { at(0, 2, 1.7, 0, () => swordG("#f4fbff", "rgba(150,220,255,A)")); for (const [s, x, y] of [["a", -11, -10], ["b", 11, -6], ["c", -12, 4], ["d", 12, 8]]) { glow(x, y, 4, T.iceGlow, 0.7); txt(s, x, y, 7, "#e6fbff", "#1a3a6a"); } },
    "rage-hourglass": () => { at(0, 0, 1.75, 0, () => hourglassG(null, null, "#8a3a2a")); at(0, 9.4, 0.62, 0, () => flameG(REDF)); for (const [x, y] of [[-1, -6], [1, -2.6]]) { circ(x, y, 0.9); paint("#ff7a3a", null); } },
    "oath": () => { at(-9, -6, 1, 0, () => headG(T.skin, "#6a3a1a")); at(9, -8, 1, 0, () => headG(T.skin, "#d0a040")); at(0, 4, 1.75, 0, () => shieldG(FAC.guard.pal, () => star(0, 0.4, 3.8, T.goldL))); line([[-16, 20], [16, 20]], T.tuft, 1.4); },
    "combo-slash": () => { at(0, 2, 2.1, 0, () => arcsG(5)); at(0, 3, 1.25, -0.5, () => swordG()); },
    "turtle-wall": () => { at(0, 0, 1.75, 0, shellG); at(1, -2.4, 0.42, 0, () => shieldG(FAC.guard.pal)); line(zig(-16, 13, 16, 13, 3, 6, 2.2), "#ffcf7a", 1.4); line(zig(-12, 17, 12, 17, 5, 5, 1.6), "rgba(255,207,122,.6)", 1); },
    "phoenix-armor": () => { glow(0, 0, 22, T.bossAura, 0.5); at(0, -2, 1.6, 0, () => wingsG(["#fff2b0", "#ffae4a", "#e0482a"])); at(0, 3, 1.2, 0, () => shieldG(GOLD3, () => { line([[-2, -6], [1, -1], [-1.4, 3], [1.6, 7]], "#fff6c8", 1.1); glow(0, 0, 7, T.bossAura, 0.8); })); },
    "twin-swords": () => { glow(0, -12, 12, T.bossAura, 0.7); at(4, 3, 1.6, -0.55, () => swordG("#fffbe8", "rgba(255,230,140,A)")); at(-4, 3, 1.6, 0.55, () => swordG("#fffbe8", "rgba(255,230,140,A)")); line([[-5.2, -12], [5.2, -12]], T.goldL, 1.6); sparkle(0, -12, 3.6, "#ffffff"); },
    "wrench": () => { at(8, 2, 1.2, 0, () => towerG()); at(8, -16, 0.5, 0, () => upArrowG()); at(-5, 4, 1.5, -0.7, wrenchG); },
    "gold-bag": () => { at(-11, 6, 1, -0.45, () => { rr(-2.6, -9, 5.2, 18, 2.4); paint(lg(-2.6, 0, 2.6, 0, ["#24508a", "#4a8ad8", "#9bd4ff"])); line([[-1, -6], [-1, 6]], "rgba(255,255,255,.7)", 0.5); line([[1, -6], [1, 6]], "rgba(255,255,255,.7)", 0.5); }); at(3, 3, 1.7, 0, bagG); },
    "anvil": () => { at(0, 9, 1.5, 0, anvilG); at(4, -6, 1.2, -0.65, hammerG); for (let i = 0; i < 4; i++) sparkle(-9 + i * 2.6, 0 - i * 2.4, 2, "#ffc060"); txt("A+", -10, -12, 7.5, "#ffd56a", T.ol); },
    "roar": () => { at(-7, 5, 1.12, 0, () => foxG()); at(8, 4, 1.12, 0, () => wolfG()); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -4, 6 + i * 4, PI * 1.2, PI * 1.8); c.strokeStyle = ["#ff9a4a", "#f2c14e", "#9bd4ff"][i]; c.lineWidth = 1.5; c.stroke(); } at(-14, -12, 0.9, 0, () => noteG("#ffd56a")); at(14, -14, 0.8, 0, () => noteG("#9bd4ff")); },
    "training": () => { at(0, 1, 1.85, 0, dummyG); },
    "sale-tag": () => { at(-1, 2, 1.8, -0.35, () => tagG("−1")); at(12, -12, 0.6, 0, () => boltG()); },
    "smile-bomb": () => { const cols = ["#ff6a7a", "#ffb04a", "#f2e04e", "#5fd39a", "#6ab4ff", "#b48aff"]; for (let i = 0; i < 12; i++) { const a = i * PI / 6; line([[Math.cos(a) * 14, Math.sin(a) * 14 + 2], [Math.cos(a) * 20, Math.sin(a) * 20 + 2]], cols[i % 6], 1.6); } at(0, 2, 1.45, 0, () => bombG(true)); },
    "branch-medal": () => { glow(0, -8, 14, T.bossAura, 0.5); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 4); c.quadraticCurveTo(0, -6, s * 13, -16); c.strokeStyle = T.ol; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = s < 0 ? "#ffd56a" : "#9bd4ff"; c.lineWidth = 2.2; c.stroke(); } limb([[0, 4], [0, -2]], "#ffd56a", 2.2); at(0, 9, 1.1, 0, medalG); },
    "fire-trail": () => { c.beginPath(); c.moveTo(-18, 18); c.quadraticCurveTo(-2, 10, 0, 0); c.quadraticCurveTo(2, -10, 18, -16); c.strokeStyle = T.ol; c.lineWidth = 9; c.stroke(); c.strokeStyle = "#8a5a3a"; c.lineWidth = 7; c.stroke(); for (const [x, y, s] of [[-12, 12, 0.5], [-2, 5, 0.6], [2, -6, 0.55], [12, -13, 0.5]]) at(x, y - 4, s, 0, () => flameG(FLAME)); for (const [x, y] of [[-6, 16], [6, 2], [14, -6]]) at(x, y, 0.62, 0.6, () => pawG("#ffd8a8")); },
    "bomb-crate": () => { at(-6, -3, 0.72, -0.2, () => bombG(false, null, "A")); at(6, -5, 0.78, 0.25, () => bombG(false, ["#e07a5a", "#a03a2a", "#4a120a"], "B")); at(0, 7, 1.45, 0, crateG); },
    "evolve-spark": () => { for (let i = 0; i < 9; i++) { const a = -PI / 2 + (i - 4) * 0.32; at(Math.cos(a) * 11, Math.sin(a) * 11 + 4, 0.55, a + PI / 2, () => flameG(FLAME)); } at(0, 6, 1.2, 0, () => foxG()); sparkle(13, -14, 4, "#ffffff"); glow(13, -14, 6, T.bossAura, 0.8); },
    "quick-reload": () => { for (let i = 0; i < 3; i++) at(-2 + i * 5, 2 - i * 4, 1, -0.75, () => { line([[0, 9], [0, -8]], T.ol, 2.4); line([[0, 9], [0, -8]], T.woodLight, 1.2); poly([[0, -12], [-2, -7.6], [2, -7.6]]); paint("#e8eef2", T.ol, 0.6); poly([[0, 8], [-2.2, 11.4], [0, 10], [2.2, 11.4]]); paint(T.flagRed, null); }); for (let i = 0; i < 3; i++) line([[-18, 4 + i * 4], [-11, 4 + i * 4]], "rgba(255,255,255,.8)", 1.1); },
    "battery": () => { glow(0, 0, 18, FAC.thunder.glow, 0.45); at(0, 0, 1.75, 0, batteryG); },
    "sticky-notes": () => { at(0, 0, 1.75, 0, notesG); },
    "earphone": () => { for (let i = 0; i < 10; i++) { const a = i * PI2 / 10; at(Math.cos(a) * 17, Math.sin(a) * 17, 0.42, a + PI / 2, () => flameG(FLAME)); } at(0, 5, 1.05, 0, () => bookG()); at(0, -1, 1.3, 0, phonesG); },
    "bone-cookie": () => { at(0, 2, 1.8, -0.35, boneG); for (const [x, y] of [[-12, -10], [11, -12], [14, 10]]) sparkle(x, y, 2.8, "#fff6c8"); },
    "high-five": () => { glow(0, -8, 10, "rgba(255,240,180,A)", 0.8); at(-7, 4, 1.25, -0.4, () => handG()); at(7, 4, 1.25, 0.4, () => { c.scale(-1, 1); handG("#c99a6a"); }); for (const [x, y, r] of [[-12, -13, 2.6], [12, -13, 2.2], [0, -17, 2]]) { heartPath(x, y, r); paint("#ff7a92", T.ol, 0.6); } },
    "fire-hourglass": () => { for (let i = 0; i < 10; i++) { const a = i * PI2 / 10; at(Math.cos(a) * 17, Math.sin(a) * 18, 0.42, a + PI / 2, () => flameG(REDF)); } at(0, 0, 1.4, 0, () => hourglassG(T.goldL, T.goldL, T.bronze[1])); },
    "thunder-wolf": () => { line(zig(4, 10, 20, -2, 7, 5, 2.4), T.ol, 3.4); line(zig(4, 10, 20, -2, 7, 5, 2.4), T.boltY, 1.6); at(-4, 3, 1.5, 0, () => wolfG()); at(15, -14, 0.6, 0, () => batG()); at(8, -18, 0.45, 0, () => batG()); },
    "target-mark": () => { at(0, 1, 1.85, 0, targetG); txt("!", 0, 1.6, 12, "#fff6c8", T.ol); },
    "volley": () => { const cols = ["#ff8a6a", "#ffd56a", "#8ad8ff"]; for (let i = 0; i < 3; i++) { const x = -12 + i * 12; c.save(); c.globalCompositeOperation = "lighter"; rr(x - 2, -20, 4, 24, 2); c.fillStyle = lg(0, -20, 0, 4, [hexA(cols[i], 0), hexA(cols[i], 0.9)]); c.fill(); c.restore(); at(x, 10, 0.95, 0, () => towerG()); } },
    "herd": () => { for (let i = 0; i < 12; i++) { const a = i * PI / 6; line([[Math.cos(a) * 9, Math.sin(a) * 9], [Math.cos(a) * 21, Math.sin(a) * 21]], "rgba(255,214,120,.55)", 1.4); } at(0, 13, 1.5, 0, () => runeG(FAC.none, null, true)); at(-12, 4, 0.62, 0, () => foxG()); at(12, 4, 0.62, 0, () => wolfG()); at(0, -2, 0.7, 0, () => foxG(["#effcff", "#8ad8ff", "#3a8ad0"])); at(-6, -13, 0.55, 0, () => wolfG(["#ffffff", "#e6eaf6", "#a8b0c8"])); at(7, -13, 0.55, 0, () => foxG(T.turtle)); },
    "spyglass": () => { txt("?", 14, -14, 10, "rgba(160,190,230,.6)", null); at(-2, 3, 1.55, 0, spyglassG); glow(-9, -6, 6, T.iceGlow, 0.9); sparkle(-9, -6, 3.4, "#e6fbff"); },
    "snowflake": () => { glow(0, 0, 18, T.iceGlow, 0.5); at(0, 0, 1.9, 0.26, () => flakeG("#e6f8ff")); txt("A", 0, 0.6, 9, "#2a6aa8", "#effcff"); },
    "bento": () => { at(0, 1, 1.65, 0, bentoG); },
    "coin-notes": () => { for (let i = 2; i >= 0; i--) at(-2 + i * 2.4, i * -1.6, 1, -0.06 * i, () => { rr(-10, -12, 18, 22, 1); paint(["#fffaf0", "#f4ecd8", "#e8dcc0"][i], T.ol, 0.9); if (!i) for (let k = 0; k < 4; k++) line([[-7, -7 + k * 4], [4, -7 + k * 4]], "rgba(90,110,150,.6)", 0.8); }); at(7, 9, 0.95, 0, () => coinG(6)); },
    "spell-book": () => { at(0, -8, 1, 0, () => runeG(FAC.frost, "ABCDEF", true)); at(0, 6, 1.5, 0, () => bookG(["#7ab4e8", "#2c5a9a", "#122a5a"], true)); },
    "eraser-bulb": () => { at(-6, 6, 1.3, 0, eraserG); line([[-15, 15], [-3, 15]], "rgba(255,255,255,.4)", 1.2); at(7, -4, 1.3, 0, () => bulbG(true)); },
    "bookworm": () => { at(0, 6, 1.5, 0, () => bookG()); for (let i = 0; i < 4; i++) { circ(-6 + i * 3.2, -2 - Math.sin(i * 0.9) * 4, 2.6); paint(i === 3 ? "#9ae07a" : "#7ac85a", T.ol, 0.8); } for (const dx of [-1.2, 1.6]) { circ(3.6 + dx, -5.2, 1.3); c.strokeStyle = T.ol; c.lineWidth = 0.8; c.stroke(); } },
    "stairs-star": () => { at(-2, 6, 1.5, 0, stairsG); at(11, -11, 1, 0, () => { glow(0, 0, 8, T.bossAura, 0.7); star(0, 0, 5.6, T.goldL); at(0, -6, 0.42, 0, crownG); }); },
    "snow-phoenix": () => { at(0, -1, 1.6, 0, () => wingsG(T.phoenix)); circ(0, 1, 3.6); paint(T.phoenix[0]); poly([[0, 2], [2.4, 3.2], [0, 4]]); paint(T.horn, null); for (const [x, y, r] of [[-12, 12, 3], [0, 15, 2.6], [12, 12, 3]]) snowflake(x, y, r, "#e6f8ff", 0.8); },
    "owl-god": () => { at(0, 13, 1.45, 0, cloudG); at(0, -2, 1.5, 0, owlG); c.beginPath(); c.moveTo(11, -10); c.quadraticCurveTo(16, -16, 20, -12); c.strokeStyle = "rgba(255,246,200,.9)"; c.lineWidth = 1.2; c.stroke(); sparkle(20, -12, 2.4, "#ffffff"); },
    "rainbow-sentence": () => { at(0, 4, 1.75, 0, rainbowG); for (const [s, x, y] of [["A", -14, 2], ["B", -8, -10], ["C", 0, -14], ["D", 8, -10], ["E", 14, 2]]) { glow(x, y, 3.6, "rgba(255,246,200,A)", 0.7); txt(s, x, y, 5, "#ffffff", T.ol); } },
    "fox-cannon": () => { at(-3, 7, 1.35, 0, () => foxG()); at(7, -5, 0.95, 0, cannonG); glow(12, -15, 6, T.fireGlow, 0.9); sparkle(12, -15, 3, "#fff3a0"); },
    "fortress-knight": () => { at(7, 0, 1.55, 0, () => towerG(T.roofC, "#3a62a0")); at(-6, 6, 1.2, 0, () => shieldG(FAC.guard.pal)); at(-14, 2, 0.8, -0.3, () => swordG()); },
    "book-cannon": () => { at(-3, 7, 1.4, 0, () => bookG(null, true)); at(6, -5, 0.95, 0.4, cannonG); for (const [s, x, y] of [["A", 12, -16], ["B", 18, -10]]) txt(s, x, y, 5.6, "#ffe9a0", T.ol); },
    "wolf-rider": () => { line(zig(-20, 10, 0, 18, 9, 5, 2.4), T.boltY, 1.6); at(-1, 5, 1.45, 0, () => wolfG()); at(9, -8, 1.1, 0.5, () => swordG()); at(-8, -12, 0.75, 0, () => headG(T.skin, "#6a3a1a")); },
    "rune-circle": () => { at(0, 0, 1.9, 0, () => runeG(FAC.none, "ABCDEF")); },
    "sentence-sword": () => { at(0, 1, 1.75, 0.3, () => { swordG("#f4fbff"); for (let i = 0; i < 4; i++) { const y = -8 + i * 2.8; c.beginPath(); c.moveTo(-4, y + 1.6); c.quadraticCurveTo(0, y - 1.4, 4, y + 0.4); c.strokeStyle = T.ol; c.lineWidth = 2; c.stroke(); c.strokeStyle = i % 2 ? "#8af0ff" : "#ffd56a"; c.lineWidth = 1.1; c.stroke(); } }); },
    "frost-bolt": () => { at(-4, -3, 1.5, 0, () => boltG(["#ffffff", "#9bd4ff", "#3a7ab8"])); at(9, 9, 1.05, 0, () => { batG(); iceCubeG(); }); },
    "teamwork": () => { at(0, -4, 1.45, 0, boardG); at(-9, 12, 1, 0, () => headG(T.skin, T.hair)); at(9, 12, 1, 0, () => headG(T.skin, "#2a3a6a", T.mageRobe[1])); }
  };
  ART.CARD_ICONS = Object.keys(ICONS);
  const EMB = {
    guard: () => shieldG(FAC.guard.pal, () => { poly([[-3.6, 4.4], [-3.6, -2.6], [-2.2, -2.6], [-2.2, -1.2], [-0.7, -1.2], [-0.7, -2.6], [0.7, -2.6], [0.7, -1.2], [2.2, -1.2], [2.2, -2.6], [3.6, -2.6], [3.6, 4.4]]); paint(T.goldL, T.ol, 0.5); rr(-0.9, 1.2, 1.8, 3.2, 0.9); paint(T.ol, null); }),
    flame: () => flameG(FAC.flame.pal),
    thunder: () => boltG(FAC.thunder.pal),
    frost: () => { snowflake(0, 0, 9.4, FAC.frost.pal[0], 1.5); crystal(0, 4.4, 4.4, 9, 0, [FAC.frost.pal[0], FAC.frost.pal[1]]); },
    none: () => { sparkle(0, 0, 10, FAC.none.pal[1]); sparkle(0, 0, 5, "#ffffff"); }
  };
  function iconRaw(name, fac) {
    const f = ICONS[name];
    if (f) return f();
    // 沒有對應圖：派系徽記放大＋依名稱固定亂數的小星點（仍可分辨）
    let h = 7; for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    at(0, 0, 1.7, 0, EMB[fac] || EMB.none);
    for (let i = 0; i < 3; i++) { const a = (h % 360) / 57 + i * 2.1; sparkle(Math.cos(a) * 17, Math.sin(a) * 17, 2.6, "#fff6c8"); }
  }

  // ───── 卡面（邏輯尺寸 60×84；普通＝石銀框、稀有＝藍銀框＋藍寶石、傳說＝金框＋紅寶石＋外光，流光另外即時畫）
  const CW = 60, CH = 84, CPAD = 5;
  const RAR = {
    common: { name: "普通", rim: ["#e0e6ee", "#97a3b4", "#4a5466"], ribbon: ["#64748e", "#38465e"], gem: ["#ffffff", "#c4ccd6", "#7a8698"], n: 1 },
    rare:   { name: "稀有", rim: ["#e4f6ff", "#5aa4e6", "#1d4680"], ribbon: ["#4074c4", "#1d3a70"], gem: ["#e8f8ff", "#5ab8ff", "#1a5aa8"], n: 2 },
    legend: { name: "傳說", rim: ["#fff4c4", "#e7b45a", "#8a5422"], ribbon: ["#c03850", "#6a1428"], gem: ["#fffbe0", "#ffd04a", "#c07a14"], n: 3 }
  };
  ART.RARITY_ART = RAR;
  const DUR_UI = { now: "now", wave: "wave", stage: "long" };
  function gemG(x, y, r, pal) { poly([[x, y - r], [x + r * 0.8, y], [x, y + r], [x - r * 0.8, y]]); paint(lg(x - r, y - r, x + r, y + r, [pal[0], pal[1], pal[2]]), T.ol, 0.6); poly([[x, y - r], [x + r * 0.8, y], [x, y]]); c.fillStyle = "rgba(255,255,255,.45)"; c.fill(); }
  function medallion(x, y, r, fac) { const F = facOf(fac); circ(x, y, r); paint(rg(x - r * 0.3, y - r * 0.3, 0.5, r, ["#24304e", "#0c1122"]), T.ol, 1.1); circ(x, y, r - 0.9); c.strokeStyle = F.color; c.lineWidth = 1.2; c.stroke(); at(x, y, r / 13.5, 0, EMB[fac] || EMB.none); }
  function cardFace(card, o) {
    const R = RAR[card.rarity] || RAR.common, leg = card.rarity === "legend", rare = card.rarity === "rare";
    const duo = Array.isArray(card.duo) && card.duo.length === 2 ? card.duo : null, F = facOf(duo ? duo[0] : card.faction), F2 = duo ? facOf(duo[1]) : F;
    if (leg && !NOFX) { rr(-3.5, -3.5, CW + 7, CH + 7, 8.5); c.fillStyle = "rgba(255,196,90,.18)"; c.fill(); rr(-1.8, -1.8, CW + 3.6, CH + 3.6, 7); c.fillStyle = "rgba(255,214,120,.28)"; c.fill(); }
    rr(0, 0, CW, CH, 5); paint(lg(0, 0, CW, CH, [R.rim[0], R.rim[1], R.rim[2], R.rim[1]]), T.ol, 1.6);
    rr(2.8, 2.8, CW - 5.6, CH - 5.6, 3.6); paint(lg(0, 0, 0, CH, ["#1f2c48", "#0c1122"]), null);
    rr(2.8, 2.8, CW - 5.6, CH - 5.6, 3.6); c.fillStyle = rg(duo ? 16 : 30, 30, 2, 40, [hexA(F.color, 0.32), hexA(F.color, 0)]); c.fill();
    if (duo) { rr(2.8, 2.8, CW - 5.6, CH - 5.6, 3.6); c.fillStyle = rg(44, 30, 2, 34, [hexA(F2.color, 0.32), hexA(F2.color, 0)]); c.fill(); }
    rr(2.8, 2.8, CW - 5.6, CH - 5.6, 3.6); c.strokeStyle = leg ? "rgba(255,236,170,.55)" : "rgba(255,255,255,.18)"; c.lineWidth = 0.6; c.stroke();
    // 圖框
    rr(6, 9, 48, 42, 3.6); c.fillStyle = rg(30, 28, 2, 32, [hexA(F.color, 0.55), hexA(duo ? F2.color : F.color, 0.16), "#0b1020"]); c.fill();
    let s = 0; for (const ch of String(card.id || card.icon || "")) s = (s * 33 + ch.charCodeAt(0)) >>> 0;
    for (let i = 0; i < 9; i++) { s = (s * 1103515245 + 12345) >>> 0; const sx = 8 + (s % 44), sy = 11 + ((s >>> 8) % 38); circ(sx, sy, 0.35 + ((s >>> 16) % 3) * 0.18); c.fillStyle = "rgba(255,250,230,.7)"; c.fill(); }
    at(30, 30, 0.88, 0, () => iconRaw(card.icon, card.faction));
    rr(6, 9, 48, 42, 3.6); c.strokeStyle = T.ol; c.lineWidth = 1.6; c.stroke(); rr(6.6, 9.6, 46.8, 40.8, 3.2); c.strokeStyle = hexA(R.rim[0], 0.55); c.lineWidth = 0.6; c.stroke();
    // 持續時間徽章（右下）：立刻／本波／本關（長效）／N 波
    const d = card.dur, dx = 50.5, dy = 47;
    if (d && !(o && o.noDur)) {
      circ(dx, dy, 4.6); paint(rg(dx, dy, 0.5, 4.6, ["#2a3858", "#0c1122"]), T.ol, 0.9); circ(dx, dy, 3.9); c.strokeStyle = R.rim[1]; c.lineWidth = 0.7; c.stroke();
      if (typeof d === "object" && d.waves) txt(String(d.waves), dx, dy + 0.3, 5.2, "#fff6dc", null);
      else at(dx, dy, 0.3, 0, () => uiRaw(DUR_UI[d] || "now"));
    }
    // 派系徽記（組合卡兩枚）
    medallion(8.6, 8.6, 6.8, duo ? duo[0] : card.faction || "none");
    if (duo) { medallion(51.4, 8.6, 6.8, duo[1]); line([[16, 6], [44, 6]], T.goldL, 0.6); }
    // 頂部飾頭
    if (leg) { for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.32; line([[30 + Math.cos(a) * 4, 2.6 + Math.sin(a) * 4], [30 + Math.cos(a) * 8.4, 2.6 + Math.sin(a) * 8.4]], "rgba(255,236,170,.9)", 0.7); } star(30, 2.6, 4.4, T.goldL, 0.9); circ(30, 2.6, 1.3); paint("#e0485a", null); }
    else if (rare) gemG(30, 2.4, 3.2, R.gem);
    else { circ(30, 2.2, 1.6); paint(R.rim[1], T.ol, 0.6); }
    // 四角
    if (rare) for (const [x, y] of [[CW - 3.2, CH - 3.2], [3.2, CH - 3.2]].concat(duo ? [] : [[CW - 3.2, 3.2]])) gemG(x, y, 2.4, R.gem);
    if (leg) for (const [x, y, sx, sy] of [[3.2, CH - 3.2, 1, -1], [CW - 3.2, CH - 3.2, -1, -1]].concat(duo ? [] : [[CW - 3.2, 3.2, -1, 1]])) {
      c.beginPath(); c.moveTo(x, y + sy * 9); c.quadraticCurveTo(x + sx * 1.4, y + sy * 1.4, x + sx * 9, y); c.strokeStyle = T.ol; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = T.goldL; c.lineWidth = 1.1; c.stroke();
      circ(x + sx * 2.6, y + sy * 2.6, 1.6); paint("#e0485a", T.ol, 0.6);
    }
    // 名稱緞帶
    poly([[2, 52.6], [CW - 2, 52.6], [CW - 4.6, 57.6], [CW - 2, 62.6], [2, 62.6], [4.6, 57.6]]); paint(lg(0, 52.6, 0, 62.6, [R.ribbon[0], R.ribbon[1]]), T.ol, 1);
    line([[4, 53.8], [CW - 4, 53.8]], leg ? T.goldL : "rgba(255,255,255,.3)", 0.6);
    // 說明框
    rr(6, 64.6, 48, 12.6, 2.4); paint("rgba(8,12,26,.72)", "rgba(255,255,255,.14)", 0.6);
    if (o && o.text) {
      const nm = String(card.name || ""); txt(nm, 30, 57.9, Math.min(6.4, 48 / Math.max(1, nm.length)), "#fff6dc", T.ol);
      const ds = String(card.desc || ""), two = ds.length > 9;
      let n1 = two ? Math.ceil(ds.length / 2) : ds.length;
      if (two) { let best = -1; for (let i = 1; i < ds.length - 1; i++) if (/[ 、，,]/.test(ds[i]) && (best < 0 || Math.abs(i - n1) < Math.abs(best - n1))) best = i; if (best > 0 && Math.abs(best - n1) <= 4) n1 = best + 1; else while (n1 > 1 && n1 < ds.length && /[0-9.+×%→−\-]/.test(ds[n1]) && /[0-9.+×%→−\-]/.test(ds[n1 - 1])) n1--; }
      const fs = Math.min(4.8, 44 / Math.max(1, Math.max(n1, ds.length - n1)));
      if (two) { txt(ds.slice(0, n1).trim(), 30, 68.2, fs, "#e8eef6", null); txt(ds.slice(n1).trim(), 30, 73.8, fs, "#e8eef6", null); } else txt(ds, 30, 70.9, fs, "#e8eef6", null);
    }
    // 稀有度寶石
    for (let i = 0; i < R.n; i++) gemG(30 + (i - (R.n - 1) / 2) * 6.4, 80.6, 2.4, R.gem);
  }
  function cardBackFace() {
    rr(0, 0, CW, CH, 5); paint(lg(0, 0, CW, CH, ["#3a5a8a", "#1d3360", "#0c1838"]), T.ol, 1.6);
    rr(3.6, 3.6, CW - 7.2, CH - 7.2, 3.2); c.strokeStyle = T.gold; c.lineWidth = 0.9; c.stroke();
    for (let i = 0; i < 14; i++) { circ(8 + (i * 37) % 44, 8 + (i * 53) % 68, 0.5); c.fillStyle = "rgba(255,246,210,.75)"; c.fill(); }
    at(30, 42, 1, 0, () => { glow(0, 0, 18, T.bossAura, 0.35); runeG(FAC.none, null); at(0, 2, 0.95, 0, () => bookG(BOOK.royal)); });
  }
  const CARDBOX = { w: CW + CPAD * 2, h: CH + CPAD * 2, ox: CPAD, oy: CPAD };
  function cardQ(ctx, k) { return Math.min(8, Math.max(1, Math.ceil(qOf(ctx) * k * 2) / 2)); }
  function blitCard(ctx, e, x, y, k, alpha) { if (!e) return; const pa = ctx.globalAlpha; if (alpha != null) ctx.globalAlpha = pa * alpha; ctx.drawImage(e.cv, x - CPAD * k, y - CPAD * k, CARDBOX.w * k, CARDBOX.h * k); ctx.globalAlpha = pa; }
  function rrCtx(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // 傳說流光：斜向光帶掃過整張卡（淡）＋金框（亮）；四角星閃
  function cardSheen(ctx, x, y, k, t) {
    const w = CW * k, h = CH * k, p = ((t || 0) % 2.6) / 2.6, bx = x - w * 0.5 + p * w * 2;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [ring, a, bw] of [[false, 0.13, 6], [true, 0.8, 8]]) {
      ctx.save(); rrCtx(ctx, x, y, w, h, 5 * k);
      if (ring) { rrCtx(ctx, x + 2.8 * k, y + 2.8 * k, w - 5.6 * k, h - 5.6 * k, 3.6 * k); ctx.clip("evenodd"); } else ctx.clip();
      ctx.translate(bx, y + h / 2); ctx.rotate(0.38);
      const g = ctx.createLinearGradient(-bw * k, 0, bw * k, 0); g.addColorStop(0, "rgba(255,236,170,0)"); g.addColorStop(0.5, "rgba(255,246,210," + a + ")"); g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g; ctx.fillRect(-bw * k, -h, bw * 2 * k, h * 2); ctx.restore();
    }
    for (let i = 0; i < 3; i++) { const tw = Math.max(0, Math.sin((t || 0) * 3 + i * 2.1)); if (tw < 0.2) continue; liveGlow(ctx, x + [3.2, CW - 3.2, 30][i] * k, y + [CH - 3.2, CH - 3.2, 2.6][i] * k, 4.5 * k * tw, T.bossAura, tw); }
    ctx.restore();
  }
  // ART.drawCard(ctx, card, x, y, w, t, o)：(x,y)＝卡片左上角、w＝寬（高＝w×1.4）；card＝cards_v3.json 的一筆（至少 rarity／faction／icon）
  // o＝{ text:true 畫名稱與說明（預設不畫，建議 HTML 疊字）, sel 選中外光, dim 變暗（不能選）, noSheen, noDur, back:true 畫卡背, alpha }
  ART.drawCard = function (ctx, card, x, y, w, t, o) {
    o = o || {}; card = card || {}; const k = (w || CW) / CW, q = cardQ(ctx, k);
    if (o.sel) { const pa = ctx.globalAlpha; ctx.globalAlpha = pa * (0.75 + 0.25 * Math.sin((t || 0) * 5)); liveGlow(ctx, x + CW * k / 2, y + CH * k / 2, CH * k * 0.7, T.bossAura, 0.55); ctx.globalAlpha = pa; }
    if (o.back) { blitCard(ctx, sprite("cardBack", CARDBOX, q, cardBackFace), x, y, k, o.alpha); return; }
    const key = "card|" + (card.id || card.icon) + "|" + card.rarity + "|" + (card.duo ? card.duo.join("+") : card.faction) + "|" + (o.text ? 1 : 0) + "|" + (o.noDur ? 1 : 0) + "|" + (typeof card.dur === "object" ? JSON.stringify(card.dur) : card.dur);
    blitCard(ctx, sprite(key, CARDBOX, q, () => cardFace(card, o)), x, y, k, o.alpha);
    if (card.rarity === "legend" && !o.noSheen && !o.dim) cardSheen(ctx, x, y, k, t);
    if (o.dim) { ctx.save(); rrCtx(ctx, x, y, CW * k, CH * k, 5 * k); ctx.fillStyle = "rgba(6,10,22,.55)"; ctx.fill(); ctx.restore(); }
  };
  ART.CARD_SIZE = { w: CW, h: CH };
  function fitCanvas(canvas, bw, bh, pad) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height, s = Math.min(W / (bw + pad * 2), H / (bh + pad * 2));
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); return { g, s, x: (W - bw * s) / 2, y: (H - bh * s) / 2 };
  }
  // ART.card(canvas, card, o)：把整張卡畫滿一個 canvas（DOM 用；傳說卡要流光就每幀用新的 o.t 再呼叫一次，靜態部分有快取）
  ART.card = function (canvas, card, o) { if (!canvas || !canvas.getContext) return; o = o || {}; const f = fitCanvas(canvas, CW, CH, o.pad == null ? 2 : o.pad); ART.drawCard(f.g, card, f.x, f.y, CW * f.s, o.t || 0, o); };

  // ───── 卡片圖示／派系徽記（單獨用：卡冊、營地清單、HUD 生效中的卡）
  const ICBOX = { w: 52, h: 52, ox: 26, oy: 26 };
  ART.drawCardIcon = function (ctx, name, x, y, size, o) {
    o = o || {}; const k = (size || 48) / 48, q = Math.min(8, Math.max(1, Math.ceil(qOf(ctx) * k * 2) / 2)), fac = o.faction || "none";
    const e = sprite("cicon|" + name + "|" + fac + "|" + (o.bg ? 1 : 0), ICBOX, q, () => {
      if (o.bg) { const F = facOf(fac); circ(0, 0, 23); paint(rg(0, -4, 2, 24, [hexA(F.color, 0.5), "#0e1528"]), T.ol, 1.4); circ(0, 0, 21.6); c.strokeStyle = F.color; c.lineWidth = 1; c.stroke(); at(0, 0, 0.82, 0, () => iconRaw(name, fac)); }
      else iconRaw(name, fac);
    });
    if (e) ctx.drawImage(e.cv, x - ICBOX.ox * k, y - ICBOX.oy * k, ICBOX.w * k, ICBOX.h * k);
  };
  ART.cardIcon = function (canvas, name, o) { if (!canvas || !canvas.getContext) return; const f = fitCanvas(canvas, 52, 52, 0); ART.drawCardIcon(f.g, name, f.x + 26 * f.s, f.y + 26 * f.s, 48 * f.s, o); };
  ART.drawEmblem = function (ctx, fac, x, y, size, o) {
    const k = (size || 24) / 24, q = Math.min(8, Math.max(1, Math.ceil(qOf(ctx) * k * 2) / 2)), plain = o && o.plain;
    const e = sprite("emb|" + fac + "|" + (plain ? 1 : 0), { w: 28, h: 28, ox: 14, oy: 14 }, q, () => plain ? at(0, 0, 1.1, 0, EMB[fac] || EMB.none) : medallion(0, 0, 12, fac));
    if (e) ctx.drawImage(e.cv, x - 14 * k, y - 14 * k, 28 * k, 28 * k);
  };
  ART.emblem = function (canvas, fac, o) { if (!canvas || !canvas.getContext) return; const f = fitCanvas(canvas, 24, 24, 0); ART.drawEmblem(f.g, fac, f.x + 12 * f.s, f.y + 12 * f.s, 24 * f.s, o); };

  // ───── 營地／側邊答題面板／狂熱／怒氣等小圖示（原點置中、半徑約 11）
  function cardMini(x, y, rot, pal, fac) { at(x, y, 1, rot, () => { rr(-4.6, -6.4, 9.2, 12.8, 1.4); paint(lg(-4.6, -6.4, 4.6, 6.4, [pal[0], pal[1], pal[2]]), T.ol, 0.9); rr(-3.2, -4.8, 6.4, 6.4, 0.8); paint("#16203a", null); if (fac) at(0, -1.6, 0.26, 0, EMB[fac]); }); }
  function energyGem(full, pal) {
    const P = () => poly([[0, -10], [7, -5], [7, 5], [0, 10], [-7, 5], [-7, -5]]);
    if (!full) { P(); paint("rgba(18,26,46,.92)", "#56698a", 1.1); at(0, 0, 0.62, 0, () => { P(); c.strokeStyle = "rgba(120,140,180,.35)"; c.lineWidth = 0.9; c.setLineDash([1.4, 1.2]); c.stroke(); c.setLineDash([]); }); return; }
    pal = pal || ["#fff8d0", "#ffd25a", "#e0861a"];
    glow(0, 0, 13, pal === EN_FEVER ? "rgba(255,120,60,A)" : "rgba(255,210,90,A)", 0.55);
    P(); paint(lg(-7, -10, 7, 10, [pal[0], pal[1], pal[2]]), T.ol, 1.2);
    poly([[0, -10], [7, -5], [0, -1.4], [-7, -5]]); c.fillStyle = "rgba(255,255,255,.42)"; c.fill();
    poly([[0, 10], [7, 5], [0, 1.4]]); c.fillStyle = "rgba(120,40,0,.22)"; c.fill();
    sparkle(-2.2, -4.4, 2.2, "#ffffff");
  }
  const EN_FEVER = ["#fff0c0", "#ff8a4a", "#c8303e"];
  const UI = {
    camp: () => { poly([[-11, 7], [-2, -10], [7, 7]]); paint(lg(-11, 0, 7, 0, ["#2a6a5a", "#4fb08f", "#2a6a5a"])); poly([[-2, -10], [-4.6, 7], [0.6, 7]]); paint("#16302a", null); limb([[-2, -10], [-2, -14]], T.woodDark, 0.8); poly([[-2, -14], [2.6, -12.8], [-2, -11.6]]); paint(T.flagRed, T.ol, 0.5);
      for (const r of [-0.5, 0.5]) at(6, 9, 1, r, () => { rr(-5.6, -1.1, 11.2, 2.2, 1); paint(T.wood, T.ol, 0.7); });
      glow(6, 4, 9, T.torch, 0.9); at(6, 3.4, 0.62, 0, () => flameG(FLAME)); },
    flag: () => { limb([[-6, 11], [-6, -11]], T.woodDark, 1.3); circ(-6, -11.6, 1.4); paint(T.gold); c.beginPath(); c.moveTo(-5.4, -10); c.bezierCurveTo(0, -12.5, 4, -7.5, 10, -9.6); c.lineTo(10, 1.4); c.bezierCurveTo(4, 3.4, 0, -1.6, -5.4, 0.8); c.closePath(); paint(lg(-5, 0, 10, 0, ["#5a2a7a", "#8a3aa8", "#5a2a7a"])); gEyes(2.4, -4.6, 2.6, 1.1, 1.5); },
    panel: () => { rr(-8, -10, 16, 20, 2); paint(lg(0, -10, 0, 10, ["#f6ead0", "#dcc89a"]), T.ol, 1.1); rr(-8, -10, 16, 4.4, 2); paint("#3a62a0", null); txt("?", 0, 2, 11, "#2c4f86", null); for (const yy of [-6.4]) line([[-5, yy + 4.6], [5, yy + 4.6]], "rgba(90,70,40,.3)", 0.6);
      c.beginPath(); c.moveTo(4, 10); c.quadraticCurveTo(8, 2, 12, -6); c.quadraticCurveTo(9, 3, 4, 10); c.closePath(); paint("#f4f8ff", T.ol, 0.7); },
    question: () => { circ(0, 0, 10); paint(rg(-3, -3, 1, 11, [T.goldL, T.gold, T.bronze[2]]), T.ol, 1.2); txt("?", 0, 0.8, 13, "#1B3545", null); },
    skip: () => { for (const dx of [-4.5, 3]) { poly([[dx - 3, -8], [dx + 4.5, 0], [dx - 3, 8], [dx - 3, 3.6], [dx + 0.6, 0], [dx - 3, -3.6]]); paint("#cfe0ee", T.ol, 1); } },
    reroll: () => { cardMini(0, 0, 0, ["#e4f6ff", "#5aa4e6", "#1d4680"], "none"); for (const s of [-1, 1]) { c.beginPath(); c.arc(0, 0, 10, s > 0 ? -1.1 : PI - 1.1, s > 0 ? 0.6 : PI + 0.6); c.strokeStyle = T.ol; c.lineWidth = 3.2; c.stroke(); c.strokeStyle = T.goldL; c.lineWidth = 1.6; c.stroke(); const a = s > 0 ? 0.6 : PI + 0.6, ex = Math.cos(a) * 10, ey = Math.sin(a) * 10; poly([[ex + Math.cos(a + 1.9) * 3.4, ey + Math.sin(a + 1.9) * 3.4], [ex + Math.cos(a - 0.4) * 3, ey + Math.sin(a - 0.4) * 3], [ex - Math.cos(a) * 3, ey - Math.sin(a) * 3]]); paint(T.goldL, T.ol, 0.6); } },
    cards: () => { cardMini(-6, 2, -0.35, RAR.common.rim, "guard"); cardMini(6, 2, 0.35, RAR.legend.rim, "flame"); cardMini(0, -0.6, 0, RAR.rare.rim, "frost"); },
    energy: () => energyGem(true),
    energyEmpty: () => energyGem(false),
    energyFever: () => { energyGem(true, EN_FEVER); at(0, -10, 0.36, 0, () => flameG(FLAME)); },
    fever: () => { for (let i = 0; i < 8; i++) { const a = i * PI / 4; at(Math.cos(a) * 7.4, Math.sin(a) * 7.4, 0.42, a + PI / 2, () => flameG(REDF)); } glow(0, 0, 12, T.bossAura, 0.8); star(0, 0.4, 6.4, T.goldL, 1); txt("5", 0, 1.2, 5.4, "#8a3a14", null); },
    rage: () => { glow(0, 0, 12, "rgba(255,90,60,A)", 0.7); at(0, 1, 1.05, 0, () => flameG(REDF)); at(0, 0, 0.8, 0.35, () => swordG()); },
    chant: () => { at(0, 3, 1, 0, () => bookG()); for (const [s, x, y] of [["a", -7, -8], ["b", 0, -11], ["c", 7, -8]]) { glow(x, y, 3.4, T.iceGlow, 0.8); txt(s, x, y, 5.4, "#e6fbff", "#1a3a6a"); } },
    forecast: () => { at(-1, 2, 0.9, 0, spyglassG); at(8, -7, 0.7, 0, () => batG()); },
    weak: () => { at(0, 0, 1, 0, () => shieldG(["#c4ccd6", "#8e9aaa", "#4a5466"])); line([[-1, -9], [2, -3], [-2, 1], [1.6, 7]], T.ol, 2.2); line([[-1, -9], [2, -3], [-2, 1], [1.6, 7]], "#ff6a5a", 1); },
    timer: () => { rr(-2, -12, 4, 2.6, 0.8); paint(T.iron[1]); circ(0, 1, 9.4); paint("#f4f6fa", T.ol, 1.3); c.beginPath(); c.moveTo(0, 1); c.arc(0, 1, 7.4, -PI / 2, 0.4); c.closePath(); c.fillStyle = "rgba(224,86,106,.75)"; c.fill(); line([[0, 1], [0, -5]], T.ol, 1.2); circ(0, 1, 1.1); paint(T.ol, null); },
    now: () => { glow(0, 0, 11, T.sparkGlow, 0.7); sparkle(0, 0, 10, "#fff6a8"); sparkle(0, 0, 4.4, "#ffffff"); },
    wave: () => { at(0, 0, 0.95, 0, () => hourglassG(T.goldL, T.goldL, T.bronze[1])); },
    long: () => { for (const s of [-1, 1]) { ell(s * 4, 0, 6, 3.6); c.strokeStyle = T.ol; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = s < 0 ? T.goldL : "#9bd4ff"; c.lineWidth = 1.7; c.stroke(); } },
    book: () => { at(0, 2, 1, 0, () => { limb([[-5, 9], [3, -1]], T.woodDark, 1.3); limb([[5, 9], [-3, -1]], T.wood, 1.4); bookG(null, true); }); }
  };
  ART.UI_ICONS = Object.keys(UI);
  function uiRaw(name) { (UI[name] || UI.question)(); }
  // ART.drawUi(ctx, name, x, y, size)：小圖示（快取）；ART.uiIcon(canvas, name)：畫滿 canvas
  ART.drawUi = function (ctx, name, x, y, size) {
    const k = (size || 24) / 24, q = Math.min(8, Math.max(1, Math.ceil(qOf(ctx) * k * 2) / 2));
    const e = sprite("ui|" + name, { w: 30, h: 30, ox: 15, oy: 15 }, q, () => uiRaw(name));
    if (e) ctx.drawImage(e.cv, x - 15 * k, y - 15 * k, 30 * k, 30 * k);
  };
  ART.uiIcon = function (canvas, name) { if (!canvas || !canvas.getContext) return; const f = fitCanvas(canvas, 26, 26, 0); ART.drawUi(f.g, name, f.x + 13 * f.s, f.y + 13 * f.s, 26 * f.s); };

  // ───── 能量格：state＝"empty"｜"full"｜"new"（剛拿到：外圈白光，t 驅動）｜"fever"（狂熱中）｜"cost"（升級預覽：會被花掉的格子閃紅框）
  ART.energyCell = function (ctx, x, y, size, state, t) {
    const nm = state === "empty" ? "energyEmpty" : state === "fever" ? "energyFever" : "energy";
    ART.drawUi(ctx, nm, x, y, size);
    const k = (size || 24) / 24;
    if (state === "new") { const a = 0.55 + 0.45 * Math.sin((t || 0) * 10); liveGlow(ctx, x, y, 13 * k, "rgba(255,255,230,A)", a); }
    else if (state === "cost") { ctx.save(); ctx.globalAlpha *= 0.55 + 0.45 * Math.sin((t || 0) * 8); ctx.strokeStyle = "#ff5a6a"; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.moveTo(x, y - 10.5 * k); ctx.lineTo(x + 7.6 * k, y - 5.3 * k); ctx.lineTo(x + 7.6 * k, y + 5.3 * k); ctx.lineTo(x, y + 10.5 * k); ctx.lineTo(x - 7.6 * k, y + 5.3 * k); ctx.lineTo(x - 7.6 * k, y - 5.3 * k); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  };
  // ART.energyBar(ctx, x, y, w, h, n, max, t, o)：一排 max 格（預設 12），前 n 格亮；o＝{ fever, cost（最右邊幾格標成要花）, newN（最右邊幾格剛拿到）}
  ART.energyBar = function (ctx, x, y, w, h, n, max, t, o) {
    o = o || {}; max = max || 12; const step = w / max, sz = Math.min(h * 1.1, step * 1.5);
    for (let i = 0; i < max; i++) {
      const cx = x + step * (i + 0.5), cy = y + h / 2;
      let st = i < n ? (o.fever ? "fever" : "full") : "empty";
      if (i < n && o.newN && i >= n - o.newN) st = "new";
      ART.energyCell(ctx, cx, cy, sz, st, t);
      if (i < n && o.cost && i >= n - o.cost) ART.energyCell(ctx, cx, cy, sz, "cost", t);
    }
  };
  // ART.feverBar(ctx, x, y, w, h, pct, t, on)：狂熱條；on＝狂熱中（火焰舌頭會跳），pct 0~1（狂熱中＝剩餘時間；平時＝連對進度）
  ART.feverBar = function (ctx, x, y, w, h, pct, t, on) {
    pct = Math.max(0, Math.min(1, pct || 0)); t = t || 0; const r = h / 2;
    ctx.save(); rrCtx(ctx, x, y, w, h, r); ctx.fillStyle = "rgba(10,14,30,.85)"; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.12); ctx.strokeStyle = T.ol; ctx.stroke();
    if (pct > 0) {
      const fw = Math.max(h, w * pct);
      ctx.save(); rrCtx(ctx, x, y, fw, h, r); ctx.clip();
      const g = ctx.createLinearGradient(x, 0, x + fw, 0); g.addColorStop(0, on ? "#c8303e" : "#8a4a2a"); g.addColorStop(0.6, on ? "#ff7a3a" : "#d08a3a"); g.addColorStop(1, on ? "#ffe08a" : "#f2c14e");
      ctx.fillStyle = g; ctx.fillRect(x, y, fw, h);
      if (on) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,230,150,.45)"; for (let i = 0; i < Math.ceil(fw / (h * 0.9)); i++) { const fx = x + i * h * 0.9 + h * 0.45, fh = h * (0.45 + 0.3 * Math.sin(t * 9 + i * 1.7)); ctx.beginPath(); ctx.moveTo(fx - h * 0.3, y + h); ctx.quadraticCurveTo(fx, y + h - fh * 2, fx + h * 0.3, y + h); ctx.fill(); } }
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.28)"; rrCtx(ctx, x + r * 0.6, y + h * 0.14, Math.max(0, fw - r * 1.2), h * 0.24, h * 0.12); ctx.fill();
    }
    ctx.restore();
    ART.drawUi(ctx, "fever", x, y + h / 2, h * 2.1);
  };

  // ───── 怒氣光環（knight-art 沒做；怒氣滿時騎士身上的火焰光環）
  // ART.rageAura(ctx, x, y, t, o)：o＝{ stage 0~4, layer:"back"｜"front"｜"both"（預設 both） }；(x,y)＝與 ART.drawKnight 相同錨點（腳底在 y+5）
  // 自動接上：knight-art.js 載入後，ART.drawKnight 收到 o.rage ≥ ART.RAGE_AURA_MIN（預設 1＝滿）就先畫背光、再畫騎士、最後畫前景火星。
  const RBOX = { w: 60, h: 76, ox: 30, oy: 60 };
  function rageLayer(s, fr, front) {
    const sc = 1 + s * 0.06, gold = s >= 3;
    if (!front) {
      ell(0, 0, 16 * sc, 6 * sc); c.fillStyle = rg(0, 0, 2, 16 * sc, ["rgba(255,120,60,.55)", "rgba(255,80,40,0)"]); c.fill();
      c.beginPath(); c.ellipse(0, 0, 14 * sc, 5.2 * sc, 0, PI, PI2); c.strokeStyle = gold ? "rgba(255,220,130,.95)" : "rgba(255,160,80,.95)"; c.lineWidth = 1.3; c.stroke();
      c.save(); c.globalCompositeOperation = "lighter";
      ell(0, -15 * sc, 17 * sc, 22 * sc); c.fillStyle = rg(0, -13 * sc, 2, 22 * sc, gold ? ["rgba(255,210,110,.5)", "rgba(255,150,60,.22)", "rgba(255,90,40,0)"] : ["rgba(255,150,70,.5)", "rgba(255,80,50,.22)", "rgba(230,40,60,0)"]); c.fill();
      const H = 36 * sc, n = 5;
      for (const [wm, hm, a] of [[1, 1, 1], [0.62, 0.78, 1.25]]) {
        c.beginPath(); c.moveTo(-13 * sc * wm, 1);
        for (let i = 0; i <= n; i++) {
          const xx = (-13 + i * 26 / n) * sc * wm, hh = H * hm * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.9 + fr * 0.9 + wm))) * (1 - Math.abs(i - n / 2) / n * 0.8);
          c.quadraticCurveTo(xx - 2.6 * sc * wm, -hh * 0.5, xx, -hh); c.quadraticCurveTo(xx + 1.4 * sc * wm, -hh * 0.4, xx + 2.6 * sc * wm, -hh * 0.12);
        }
        c.lineTo(13 * sc * wm, 1); c.closePath();
        c.fillStyle = lg(0, 2, 0, -H * hm, gold ? ["rgba(255,226,130," + 0.6 * a + ")", "rgba(255,150,60," + 0.4 * a + ")", "rgba(255,90,60,0)"] : ["rgba(255,170,80," + 0.6 * a + ")", "rgba(255,90,50," + 0.4 * a + ")", "rgba(230,40,80,0)"]); c.fill();
      }
      c.restore();
    } else {
      c.beginPath(); c.ellipse(0, 0, 14 * sc, 5.2 * sc, 0, 0, PI); c.strokeStyle = gold ? "rgba(255,230,150,1)" : "rgba(255,180,90,1)"; c.lineWidth = 1.5; c.stroke();
      for (let i = 0; i < 6; i++) { const a = 0.25 + i * 0.52, fx = Math.cos(a) * 14 * sc, fy = Math.sin(a) * 5.2 * sc, fh = (3.4 + 2 * Math.abs(Math.sin(i * 2.3 + fr * 1.4))) * sc; c.beginPath(); c.moveTo(fx - 1.6, fy); c.quadraticCurveTo(fx - 0.4, fy - fh * 0.6, fx + 0.3, fy - fh); c.quadraticCurveTo(fx + 0.8, fy - fh * 0.4, fx + 1.6, fy); c.closePath(); paint(lg(0, fy - fh, 0, fy, ["#fff2b0", "#ff7a3a"]), null); }
    }
  }
  ART.RAGE_AURA_MIN = 1;
  ART.rageAura = function (ctx, x, y, t, o) {
    o = o || {}; const s = Math.max(0, Math.min(4, (o.stage == null ? 1 : o.stage) | 0)), layer = o.layer || "both", fr = Math.floor((t || 0) * 8) & 3, q = qOf(ctx), yy = y + 5;
    const pa = ctx.globalAlpha, pulse = 0.82 + 0.18 * Math.sin((t || 0) * 6);
    if (layer !== "front") { ctx.globalAlpha = pa * pulse; blit(ctx, sprite("rage|b|" + s + "|" + fr, RBOX, q, () => rageLayer(s, fr, false)), x, yy); ctx.globalAlpha = pa; }
    if (layer !== "back") {
      blit(ctx, sprite("rage|f|" + s + "|" + fr, RBOX, q, () => rageLayer(s, fr, true)), x, yy);
      for (let i = 0; i < 6; i++) { const p = ((t || 0) * 0.7 + i / 6) % 1, ex = x + Math.sin(i * 2.4 + (t || 0) * 1.5) * 11 * (1 - p * 0.4), ey = yy - 2 - p * 40; liveGlow(ctx, ex, ey, 1 + 2.6 * (1 - p), s >= 3 ? "rgba(255,210,110,A)" : "rgba(255,140,60,A)", (1 - p) * 0.95); }
    }
  };
  (function hookKnightRage() {
    const wrap = f => {
      if (typeof f !== "function" || f.__rage) return f;
      const w = function (ctx, x, y, o) {
        const r = o && o.rage;
        if (!(r >= ART.RAGE_AURA_MIN) || o.noFx || o.alpha === 0) return f.apply(this, arguments);
        const st = { stage: o.stage != null ? o.stage : (ART.knightStage ? ART.knightStage(o.lv) : 1) };
        ART.rageAura(ctx, x, y, o.t, Object.assign({ layer: "back" }, st));
        const out = f.apply(this, arguments);
        ART.rageAura(ctx, x, y, o.t, Object.assign({ layer: "front" }, st));
        return out;
      };
      w.__rage = true; w.__orig = f; return w;
    };
    let fn = wrap(ART.drawKnight);
    try { Object.defineProperty(ART, "drawKnight", { configurable: true, enumerable: true, get() { return fn; }, set(v) { fn = wrap(v); } }); } catch (e) { /* 舊環境：不自動接，⑥ 可直接呼叫 ART.rageAura */ }
  })();

  // ───── 給 HTML 用的圖片網址（<img src>）：kind＝"card"(卡片圖示)｜"ui"｜"emblem"｜"face"(name＝卡片物件)；結果記住
  const URLS = new Map();
  ART.iconURL = function (kind, name, px, o) {
    const key = kind + "|" + (typeof name === "object" ? (name.id || name.icon) : name) + "|" + px + "|" + (o ? JSON.stringify(o) : "");
    if (URLS.has(key)) return URLS.get(key);
    const cv = mkCanvas(px, kind === "face" ? Math.round(px * CH / CW) : px); if (!cv || !cv.toDataURL) return "";
    if (kind === "card") ART.cardIcon(cv, name, o); else if (kind === "emblem") ART.emblem(cv, name, o); else if (kind === "face") ART.card(cv, name, Object.assign({ noSheen: true }, o)); else ART.uiIcon(cv, name);
    let u = ""; try { u = cv.toDataURL("image/png"); } catch (e) { u = ""; }
    URLS.set(key, u); return u;
  };

  ART.SPRITES_VERSION = "929-art-3";   // v3 第 1 期（⑦）：書本塔、增益卡卡面／圖示／徽記、營地與 HUD 小圖示、能量格、狂熱條、怒氣光環
})(typeof window !== "undefined" ? window : globalThis);
