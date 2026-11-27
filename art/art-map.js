// 929 文法片語守衛戰 — 美術：地圖與整合（2026-11-21 美術改版第一刀；分工見 art/CONTRACT.md）
// 提供 ART.buildGround / castleOverlay / slot / ambient，以及畫面用的小元件（血條、狀態圖示、魔王血條、標籤、地雷、移動旗、HUD 用 SVG）。
// 樣稿：art/_mockup/B（星夜奇幻）＋兩個修正：描邊加粗 1.2 倍、地面調亮一階。全部自繪向量，不用 emoji、不用外部圖檔。
// 座標＝遊戲邏輯 300×400；地面／路／水／裝飾／出怪口開局一次畫進離屏 canvas，城堡另畫一層（蓋在走進城門的怪上面）。
// 精靈（art-sprites.js）在本檔之前載入；它沒提供的函式（ART.tower／enemy／hero／summon／proj／icon）本檔補簡易替代圖形。
(function (root) {
  "use strict";
  const ART = root.ART = root.ART || {};
  const PI2 = Math.PI * 2, H = Math.hypot;
  const TGx = () => root.TG || {};
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const mkCanvas = (w, h) => { if (typeof document !== "undefined") { const k = document.createElement("canvas"); k.width = w; k.height = h; return k; } return null; };

  // ═════ 主題：B 星夜奇幻（描邊 0.95→1.14、地面亮一階），再依區域換配色
  const BASE = {
    ol: "#0c1122", olw: 1.14, lightLeft: false, night: true,
    grass: ["#33584f", "#1e3637"], patchL: "rgba(110,170,130,.22)", patchD: "rgba(4,10,20,.28)", tuft: "#5a8c74", tuft2: "#426e5e",
    roadShadow: "rgba(0,0,0,.45)", roadEdge: "#2e2418", roadFill: "#c4af84", roadCenter: "rgba(240,226,190,.34)", pebble: "#ad9664", pebble2: "#d3bf92", pebbleOl: "rgba(50,36,18,.55)", cobble: true,
    verge: "#4b7d66", verge2: "#386858",
    water: "#4a9cc4", waterDeep: "#1d4a6e", waterLight: "rgba(220,240,255,.7)", lily: "#3f7a58", lotus: "#f0d2a1", reed: "#4a6a50", reedTop: "#8a6a4a",
    wood: "#8a6a48", woodLight: "#ad8a5e", woodDark: "#4a3624", rope: "#cdb080",
    trunk: "#4a3428", leaf: [["#62a27e", "#33624f"], ["#70ae86", "#3a705a"]], pine: [["#62af92", "#28564f"], ["#70bc9c", "#306258"], ["#57a088", "#234c46"]], pineRatio: .72, fruit: null, berry: "#c49ad8", snowTip: null,
    rock: ["#a2b2c2", "#6a7a8e", "#3c4858"], facetRock: true, moss: "#55805f",
    flowers: ["#a8dcff", "#cdb4ff", "#f3d494"], flowerCenter: "#fff6c8", flowerGlow: "rgba(160,210,255,A)",
    mushCap: "#a676c0", mushStem: "#d8cfe6", mushDot: "#f3d494", mushGlow: "rgba(200,140,240,A)",
    chasm: ["#0d1222", "#020309"], chasmLight: "rgba(160,190,255,.18)", cliff: ["#55627a", "#2e3646"], cliffRim: "#9aaac0", caveMouth: ["#000000", "#161b2c"], mist: "rgba(180,110,240,.20)", mistDeep: "rgba(70,24,110,.6)", warnFlag: "#c8455a", thorn: "#5a3266", darkTrunk: "#2a2024", darkLeaf: ["#18302f", "#112326"], signInk: "#2a1a10",
    stone: ["#c4ccd6", "#8e9aaa", "#58637a"], stoneTop: "#dfe5ec", stoneLine: "rgba(10,15,30,.45)", plank: ["#a07e58", "#7a5c3e", "#4e3a28"], plankTop: "#b89874",
    gold: "#E1B86A", goldL: "#F3D494", slit: "#0c1122", roofA: ["#5583c6", "#335d9a", "#1d355e"], roofLine: "rgba(0,0,0,.35)", flagRed: "#d0506a",
    slotFill: "rgba(225,184,106,.12)", slotRim: "#E1B86A", slotStone: "#6a7a90", slotPlus: "#F3D494",
    enemyEye: "#ffcf5a", eyeGlow: "rgba(255,200,90,A)", enemyGlow: "rgba(220,90,255,A)", pupil: "#120a1e", eyeWhite: "#fff2c8",
    wall: ["#b4bec8", "#808c9c", "#525d6d"], wallTopC: "#d2dae2", crack: "#141420", plaque: "#1B3545", plaqueText: "#F3D494", hpWall: "#ff6b7a", hpEmpty: "rgba(255,255,255,.12)", gateDark: "#05070e", portcullis: "#b08e5a", crest: "#2c4f86", roofC: ["#5a88c8", "#2c4f86", "#1a3360"], castleFlag: "#E1B86A", castleBanner: "#2c4f86",
    windowGlow: "rgba(255,200,110,A)", torch: "rgba(255,170,70,A)", torchCore: "#ffe2a0", firefly: "rgba(255,236,150,A)",
    wildTint: "rgba(40,14,60,.58)", homeTint: "rgba(255,200,120,.12)",
    shadowRGB: "0,0,10", shadowA: .42, labelHalo: "rgba(12,17,34,.9)", labelInk: "#F3D494", labelFamily: "'Noto Serif TC','Songti TC','PMingLiU','MingLiU',serif", vignette: "rgba(4,7,18,.55)",
    nightLight: "rgba(170,200,255,.16)", particle: "firefly", decor: "forest", cave: ["幽暗洞窟", "迷途林"], pond: "pond"
  };
  const REGION_THEME = [
    { // 0 新手草原：亮綠＋花籬笆
      grass: ["#3f7a4e", "#24503b"], patchL: "rgba(160,215,120,.26)", patchD: "rgba(8,26,18,.24)", tuft: "#6ead66", tuft2: "#4f8c55",
      verge: "#62a05c", verge2: "#4b8652", roadFill: "#ccb789", roadEdge: "#3a2c1a",
      leaf: [["#80c472", "#3f7a48"], ["#94d07c", "#4a8650"]], pine: [["#6abd8c", "#2c6250"], ["#78c898", "#336c58"]], pineRatio: .22, fruit: "#ff8f8f", berry: "#ffb4dc",
      flowers: ["#ffc8e4", "#fff2a0", "#ffffff", "#ffb0c4", "#c8b4ff"], flowerGlow: "rgba(255,220,240,A)", mushCap: "#e0786a", wildTint: "rgba(30,20,50,.42)",
      nightLight: "rgba(200,230,255,.2)", vignette: "rgba(4,10,18,.45)", particle: "meadow", decor: "meadow", cave: ["野狼坡洞", null], homeTint: "rgba(255,220,140,.14)"
    },
    {}, // 1 時光森林＝樣稿 B
    { // 2 迷霧沼澤：灰綠＋水窪
      grass: ["#405a4c", "#26382f"], patchL: "rgba(150,180,120,.18)", patchD: "rgba(8,18,12,.42)", tuft: "#62805e", tuft2: "#4a664b",
      verge: "#5a7552", verge2: "#465e42", roadFill: "#aaa07a", roadEdge: "#2c2a1c", pebble: "#8c8462", pebble2: "#b4aa82",
      water: "#5c8a6e", waterDeep: "#22433a", waterLight: "rgba(205,235,205,.55)", lily: "#5c8c4a", lotus: "#e2c4f2",
      leaf: [["#6c8c62", "#3c5440"], ["#7a9262", "#455c3e"]], pine: [["#5c8c74", "#2c4a40"], ["#68967c", "#324f44"]], pineRatio: .25,
      flowers: ["#d2e2a8", "#bcaee8"], flowerGlow: "rgba(190,240,170,A)", mushCap: "#86b85e", mushDot: "#eaffb0", mushGlow: "rgba(150,240,120,A)",
      cliff: ["#4c5c52", "#28342e"], cliffRim: "#8fa69a", mist: "rgba(170,210,170,.22)", moss: "#6a9a5a", wildTint: "rgba(20,30,24,.55)",
      nightLight: "rgba(190,230,200,.14)", particle: "swamp", decor: "swamp", cave: ["毒霧洞", null], pond: "puddle"
    },
    { // 3 寒冰山脈：淺藍白＋雪
      grass: ["#90adc2", "#5f7f98"], patchL: "rgba(255,255,255,.34)", patchD: "rgba(30,50,80,.22)", tuft: "#c4d8e6", tuft2: "#a2bcd0",
      verge: "#d4e4ef", verge2: "#b2cadb", roadFill: "#6f8296", roadEdge: "#25313f", roadCenter: "rgba(220,236,250,.22)", pebble: "#8c9fb3", pebble2: "#b0c2d4", pebbleOl: "rgba(20,30,45,.55)",
      water: "#c6eaf8", waterDeep: "#7fb6d6", waterLight: "rgba(255,255,255,.9)",
      trunk: "#4a3a34", leaf: [["#9ccadb", "#4f8296"]], pine: [["#6aaaa2", "#2c5a5a"], ["#7ab6ae", "#346462"], ["#5e9e98", "#285050"]], pineRatio: .92, snowTip: "#f6fbff", berry: null,
      rock: ["#e2ecf4", "#a2b6c8", "#62768c"], moss: "#f2f8fc", flowers: ["#dff6ff", "#bfe8ff"], flowerGlow: "rgba(190,235,255,A)",
      cliff: ["#8fa6bc", "#4c6278"], cliffRim: "#eaf6ff", caveMouth: ["#020610", "#18263a"], mist: "rgba(200,230,255,.24)", thorn: "#5a6a88", darkTrunk: "#2c2c38", darkLeaf: ["#2a4450", "#1e3440"],
      wildTint: "rgba(20,30,70,.42)", homeTint: "rgba(255,230,180,.14)", nightLight: "rgba(220,235,255,.2)", vignette: "rgba(10,18,40,.5)",
      enemyGlow: "rgba(160,120,255,A)", particle: "snow", decor: "glacier", cave: ["冰封洞窟", null], pond: "ice"
    },
    { // 4 魔龍火山：暗紅褐＋熔岩縫
      grass: ["#5e3c31", "#301b16"], patchL: "rgba(210,100,60,.16)", patchD: "rgba(10,0,0,.4)", tuft: "#76503c", tuft2: "#5a3a2a",
      verge: "#6e4a36", verge2: "#583624", roadFill: "#8e735c", roadEdge: "#22130e", roadCenter: "rgba(240,210,170,.22)", pebble: "#6e5444", pebble2: "#a88a6c",
      water: "#ff8a2a", waterDeep: "#b0300c", waterLight: "rgba(255,232,150,.85)",
      trunk: "#3a2622", leaf: [["#6e5c4a", "#3e3028"]], pine: [["#5c524a", "#2e2622"]], pineRatio: 0, berry: "#ff7a3a",
      rock: ["#78686a", "#4a3e40", "#2a2224"], moss: "#a8442a", flowers: ["#ffb060", "#ff7a3a"], flowerGlow: "rgba(255,140,60,A)", mushCap: "#c0503a", mushGlow: "rgba(255,120,60,A)",
      cliff: ["#4a3634", "#241818"], cliffRim: "#a06a50", caveMouth: ["#1a0400", "#2a0c06"], mist: "rgba(255,120,60,.16)", mistDeep: "rgba(120,30,10,.6)", thorn: "#4a2a26", darkTrunk: "#1e1414", darkLeaf: ["#2a1a18", "#1e1210"],
      wildTint: "rgba(60,10,0,.45)", homeTint: "rgba(255,170,90,.12)", nightLight: "rgba(255,150,90,.12)", vignette: "rgba(18,4,2,.58)",
      particle: "ember", decor: "volcano", cave: ["熔岩裂谷", null], pond: "lava"
    }
  ];
  const mkTheme = i => Object.assign({}, BASE, REGION_THEME[i] || {});
  let region = 1, T = mkTheme(1), c = null;
  ART.mapTheme = T;
  if (!ART.theme) ART.theme = T;
  const prevSetRegion = typeof ART.setRegion === "function" ? ART.setRegion : null;
  ART.setRegion = function (i) {
    region = Math.max(0, Math.min(4, i | 0)); T = mkTheme(region); ART.mapTheme = T;
    if (prevSetRegion) { try { prevSetRegion.call(ART, i); } catch (e) { console.error("[ART.setRegion]", e); } }
    else ART.theme = T;
  };

  // ═════ 小工具（畫在目前的 c 上）
  const ell = (x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot || 0, 0, PI2); };
  const circ = (x, y, r) => ell(x, y, r, r);
  const poly = (pts, close = true) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (close) c.closePath(); };
  const rr = (x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  function paint(fill, stroke, lw) { if (fill) { c.fillStyle = fill; c.fill(); } if (stroke !== null) { c.strokeStyle = stroke || T.ol; c.lineWidth = lw || T.olw; c.stroke(); } }
  const lg = (x1, y1, x2, y2, stops) => { const g = c.createLinearGradient(x1, y1, x2, y2); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const rg = (x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const shadow = (x, y, rx, ry, a) => { ell(x, y, rx, ry); c.fillStyle = `rgba(${T.shadowRGB},${a == null ? T.shadowA : a})`; c.fill(); };
  function glow(x, y, r, col, a) { c.save(); c.globalCompositeOperation = "lighter"; circ(x, y, r); c.fillStyle = rg(x, y, 0, r, [col.replace("A", a), col.replace("A", 0)]); c.fill(); c.restore(); }
  function union(shapes, fill, lw) { c.strokeStyle = T.ol; c.lineWidth = (lw || T.olw) * 2; for (const s of shapes) { s(); c.stroke(); } c.fillStyle = fill; for (const s of shapes) { s(); c.fill(); } }
  function cyl(x, y, r, h, side, top) {
    const ry = r * 0.42;
    c.beginPath(); c.moveTo(x - r, y - h); c.lineTo(x - r, y); c.ellipse(x, y, r, ry, 0, Math.PI, 0, true); c.lineTo(x + r, y - h); c.closePath();
    paint(side); if (top) { ell(x, y - h, r, ry); paint(top); }
  }
  const sideGrad = (x, r, a, b, d) => lg(x - r, 0, x + r, 0, T.lightLeft ? [a, b, d] : [d, b, a]);
  function star(x, y, r, fill) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } c.closePath(); paint(fill, null); c.lineWidth = T.olw * 0.8; c.strokeStyle = T.ol; c.stroke(); }
  function banner(x, y, w, h, col, emblem) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h - 2.5); c.lineTo(x - w / 2, y + h); c.closePath(); paint(col); if (emblem) emblem(x, y + h * 0.42); }
  function label(x, y, t, size) { c.font = "900 " + size + "px " + T.labelFamily; c.textAlign = "center"; c.textBaseline = "middle"; c.lineWidth = 2.6; c.strokeStyle = T.labelHalo; c.strokeText(t, x, y); c.fillStyle = T.labelInk; c.fillText(t, x, y); }

  // 發光小圖（環境粒子、火把每幀用；預先畫好再 drawImage，比每幀建漸層快）
  const glowCache = {};
  function glowSprite(col) {
    if (glowCache[col]) return glowCache[col];
    const k = mkCanvas(64, 64); if (!k) return null; const g = k.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col.replace("A", 1)); gr.addColorStop(0.4, col.replace("A", .45)); gr.addColorStop(1, col.replace("A", 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (glowCache[col] = k);
  }
  function glowFast(ctx, x, y, r, col, a) { const s = glowSprite(col); if (!s) return; ctx.globalAlpha = a; ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

  // ═════ 地圖幾何（全部從 TG.MAPS 讀：路線、塔位、終點）
  let P = null;   // 目前地圖的規劃（路、入口、水、城堡、禁區）
  function posDir(rt, d) {
    d = Math.max(0, Math.min(d, rt.len));
    for (const g of rt.seg) if (d <= g.s + g.L) { const t = (d - g.s) / g.L; return { x: g.x1 + (g.x2 - g.x1) * t, y: g.y1 + (g.y2 - g.y1) * t, dx: Math.sign(g.x2 - g.x1), dy: Math.sign(g.y2 - g.y1) }; }
    return { x: rt.end[0], y: rt.end[1], dx: 0, dy: 1 };
  }
  function segDist(g, x, y) { const dx = g.x2 - g.x1, dy = g.y2 - g.y1, t = g.L ? Math.max(0, Math.min(1, ((x - g.x1) * dx + (y - g.y1) * dy) / (g.L * g.L))) : 0; return H(x - g.x1 - dx * t, y - g.y1 - dy * t); }
  function plan(m) {
    const routes = m.routes, slots = m.slots, end = m.end;
    const distRoad = (x, y) => { let b = 1e9; for (const rt of routes) for (const g of rt.seg) { const d = segDist(g, x, y); if (d < b) b = d; } return b; };
    // 入口：每條路線第一段跨進畫面的位置
    const entries = routes.map((rt, r) => {
      const [x0, y0] = rt.path[0], [x1, y1] = rt.path[1];
      let side = "L", x = 0, y = y0;
      if (x0 < 0) { side = "L"; x = 0; y = y0 + (y1 - y0) * (-x0) / ((x1 - x0) || 1); }
      else if (x0 > 300) { side = "R"; x = 300; y = y0 + (y1 - y0) * (x0 - 300) / ((x0 - x1) || 1); }
      else if (y0 < 0) { side = x0 < 150 ? "L" : "R"; x = x0; y = 0; }
      else { side = x0 < 150 ? "L" : "R"; x = x0; y = y0; }
      return { r, side, x, y };
    });
    const P = { m, routes, slots, end, distRoad, entries, zones: [], ponds: [], stream: null, cracks: [] };
    P.castle = castleLayout(m, P);
    P.zones.push(P.castle.bbox);
    for (const e of entries) {
      if (e.side === "L") P.zones.push({ x0: -10, y0: e.y - 42, x1: 48, y1: e.y + 22 });
      else P.zones.push({ x0: 252, y0: e.y - 42, x1: 310, y1: e.y + 22 });
    }
    P.inZone = (x, y, pad) => P.zones.some(z => x > z.x0 - (pad || 0) && x < z.x1 + (pad || 0) && y > z.y0 - (pad || 0) && y < z.y1 + (pad || 0));
    const slotNear = (x, y, r) => slots.some(([sx, sy]) => H(sx - x, sy - y) < r);
    // 水：森林照樣稿（泉眼→溪→池塘）；其他地圖自動找離路、塔位都夠遠的空地
    if (m.id === "forest") {
      P.stream = [[150, 206], [144, 220], [156, 236], [147, 252], [152, 268], [150, 276]];
      P.ponds.push({ x: 150, y: 287, rx: 33, ry: 13, kind: "pond", dock: true, lily: true });
    } else {
      const kind = REGION_THEME[regionOfMap(m)] && REGION_THEME[regionOfMap(m)].pond || "pond";
      const sizes = kind === "puddle" ? [[17, 7.5], [14, 6.5], [12, 5.5], [10, 5]] : [[30, 12], [26, 11], [22, 10], [18, 8.5], [15, 7]];
      const want = kind === "puddle" ? 5 : 1;
      const fits = (x, y, rx, ry) => {
        if (x - rx < 10 || x + rx > 290 || y - ry < 70 || y + ry > 372) return false;
        for (let i = 0; i < 16; i++) { const a = i * PI2 / 16, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry; if (distRoad(px, py) < 21 || slotNear(px, py, 19) || P.inZone(px, py, 4)) return false; }
        if (distRoad(x, y) < 21 || slotNear(x, y, 19)) return false;
        return !P.ponds.some(o => H(o.x - x, (o.y - y) * 1.6) < o.rx + rx + 26);
      };
      for (const [rx, ry] of sizes) {
        if (P.ponds.length >= want) break;
        const cand = [];
        for (let x = 20; x <= 280; x += 5) for (let y = 74; y <= 366; y += 5) if (fits(x, y, rx, ry)) cand.push({ x, y, s: distRoad(x, y) - H(x - 150, y - 210) * 0.08 });
        cand.sort((a, b) => b.s - a.s);
        for (const cd of cand) { if (P.ponds.length >= want) break; if (fits(cd.x, cd.y, rx, ry)) P.ponds.push({ x: cd.x, y: cd.y, rx, ry, kind, dock: kind === "pond" && !P.ponds.length, lily: kind === "pond" || kind === "puddle" }); }
      }
    }
    P.distWater = (x, y) => {
      let d = 1e9;
      if (P.stream) for (let i = 1; i < P.stream.length; i++) { const [x1, y1] = P.stream[i - 1], [x2, y2] = P.stream[i]; d = Math.min(d, segDist({ x1, y1, x2, y2, L: H(x2 - x1, y2 - y1) }, x, y)); }
      for (const o of P.ponds) { const pe = H((x - o.x) / o.rx, (y - o.y) / o.ry); d = Math.min(d, pe < 1 ? 0 : (pe - 1) * o.ry); }
      return d;
    };
    P.slotNear = slotNear;
    return P;
  }
  function regionOfMap(m) { const TG = TGx(); if (!TG.MAPS || !TG.REGIONS) return 1; const mi = TG.MAPS.indexOf(m); const r = TG.REGIONS.findIndex(x => x.map === mi); return r < 0 ? 1 : r; }

  // ═════ 城堡版面（依每張地圖的終點與附近的路、塔位手調；未知地圖用通用版）
  // bottom：終點在畫面底部 → 底部城牆＋城門樓＋圓塔；keep：終點在中間 → 獨立小城（城門朝來路）；side：終點貼左右邊 → 邊牆城門
  function castleLayout(m, P) {
    const [ex, ey] = m.end;
    const B = { // 樣稿 B（時光森林）
      type: "bottom", gx: ex, wallTop: 371, gateTop: 360,
      towers: [{ x: ex - 31, h: 46, r: 14, roof: 30 }, { x: ex + 31, h: 46, r: 14, roof: 30 }],
      name: { x: ex - 98, w: 44 }, plaque: { x: ex + 58, w: 82 }
    };
    let L;
    if (m.id === "forest") L = B;
    else if (m.id === "meadow") L = Object.assign({}, B, { gateTop: 364, towers: [{ x: 80, h: 46, r: 14, roof: 30 }, { x: 196, h: 20, r: 12, roof: 22 }], name: { x: 8, w: 44 }, plaque: { x: 214, w: 82 } });
    else if (m.id === "swamp") L = Object.assign({}, B, { wallTop: 383, gateTop: 382, towers: [{ x: 222, h: 46, r: 14, roof: 30 }, { x: 96, h: 8, r: 10, roof: 13 }], name: { x: 246, w: 46 }, plaque: { x: 3, w: 80 } });
    else if (m.id === "glacier") L = { type: "keep", gx: ex, front: ey + 9, gateTop: ey - 27, wingTop: ey - 13, wingW: 16, keepT: { x: ex, base: ey - 23, h: 14, r: 11, roof: 20 }, plaque: { x: 109, w: 82, y: 384 } };
    else if (m.id === "volcano") L = { type: "side", gy: ey, x0: ex - 9, top: ey - 30, bottom: ey + 24, plaque: { x: 109, w: 82, y: 384 }, tw: { x: ex + 7, base: ey - 28, h: 14, r: 8, roof: 14 } };
    else if (ey >= 380) L = B;
    else if (ex > 270 || ex < 30) L = { type: "side", gy: ey, x0: ex > 150 ? ex - 9 : ex + 9, flip: ex < 150, top: ey - 30, bottom: ey + 24, plaque: { x: 109, w: 82, y: 384 }, tw: { x: ex + 7, base: ey - 28, h: 14, r: 8, roof: 14 } };
    else L = { type: "keep", gx: ex, front: ey + 9, gateTop: ey - 27, wingTop: ey - 13, wingW: 16, keepT: { x: ex, base: ey - 23, h: 14, r: 11, roof: 20 }, plaque: { x: 109, w: 82, y: ey < 300 ? 384 : 4 } };
    // 範圍框（裝飾避開、城堡層裁切用）
    if (L.type === "bottom") {
      let top = L.gateTop - 10; for (const t of L.towers) top = Math.min(top, 404 - t.h - 8 - t.roof - 14);
      L.bbox = { x0: -6, y0: top, x1: 306, y1: 402 };
      L.flags = L.towers.filter(t => t.h >= 18).map(t => ({ x: t.x, y: 404 - t.h - 8 - t.roof, h: 14 }));
      if (!L.flags.length) L.flags = [{ x: L.gx, y: L.gateTop - 5, h: 14 }];
      L.torches = [[L.gx - 14, Math.min(372, L.gateTop + 12)], [L.gx + 14, Math.min(372, L.gateTop + 12)]];
    } else if (L.type === "keep") {
      const k = L.keepT, tip = k.base - k.h - 4 - k.roof;
      L.bbox = { x0: L.gx - 32, y0: tip - 16, x1: L.gx + 32, y1: L.front + 6 };
      L.flags = [{ x: k.x, y: tip, h: 12 }];
      L.torches = [[L.gx - 18, L.front - 14], [L.gx + 18, L.front - 14]];
    } else {
      L.bbox = { x0: L.x0 - 6, y0: L.top - 30, x1: 306, y1: L.bottom + 6 };
      L.flags = [{ x: L.tw.x, y: Math.max(14, L.tw.base - L.tw.h - 4 - L.tw.roof), h: 12 }];
      L.torches = [[L.x0 - 3, L.gy - 15], [L.x0 - 3, L.gy + 15]];
    }
    // 裂痕位置（城牆受損時依剩餘生命逐條出現）
    const R = mulberry(77 + (m.id || "").length * 13), cr = [];
    for (let i = 0; i < 7; i++) {
      let x, y;
      if (L.type === "bottom") { do { x = 6 + R() * 288; } while (Math.abs(x - L.gx) < 26 || L.towers.some(t => Math.abs(x - t.x) < t.r + 3) || (L.plaque && x > L.plaque.x - 4 && x < L.plaque.x + L.plaque.w + 4) || (L.name && x > L.name.x - 4 && x < L.name.x + L.name.w + 4)); y = L.wallTop + 8 + R() * Math.max(4, 392 - L.wallTop - 14); }
      else if (L.type === "keep") { x = L.gx + (R() < .5 ? -1 : 1) * (14 + R() * 14); y = L.wingTop + 6 + R() * (L.front - L.wingTop - 12); }
      else { x = L.x0 + 3 + R() * 12; y = L.top + 8 + R() * (L.bottom - L.top - 16); if (Math.abs(y - L.gy) < 13) y += 26 * (y < L.gy ? -1 : 1); }
      const pts = [[x, y]]; let px = x, py = y;
      for (let k = 0; k < 3; k++) { px += (R() - .5) * 6; py += 3 + R() * 4; pts.push([px, py]); }
      cr.push(pts);
    }
    L.cracks = cr;
    return L;
  }

  // ═════ 地面
  function drawGround(R) {
    c.fillStyle = lg(0, 0, 0, 400, T.grass); c.fillRect(0, 0, 300, 400);
    for (let i = 0; i < 26; i++) { const x = R() * 300, y = R() * 400, r = 18 + R() * 34; circ(x, y, r); c.fillStyle = rg(x, y, 0, r, i % 2 ? [T.patchL, "rgba(0,0,0,0)"] : [T.patchD, "rgba(0,0,0,0)"]); c.fill(); }
    // 荒野：出怪口一帶變暗偏紫；越靠近城堡越明亮
    for (const e of P.entries) { circ(e.x, e.y, 115); c.fillStyle = rg(e.x, e.y, 0, 115, [T.wildTint, T.wildTint.replace(/[\d.]+\)$/, "0)")]); c.fill(); }
    { const [ex, ey] = P.end; circ(ex, ey, 130); c.fillStyle = rg(ex, ey, 0, 130, [T.homeTint, T.homeTint.replace(/[\d.]+\)$/, "0)")]); c.fill(); }
    if (T.decor === "glacier") { // 雪堆
      for (let i = 0; i < 34; i++) { const x = R() * 300, y = R() * 400, rx = 8 + R() * 18; if (P.distRoad(x, y) < rx * 0.6 + 14) continue; ell(x, y, rx, rx * 0.45); c.fillStyle = "rgba(246,251,255,.55)"; c.fill(); ell(x - rx * 0.2, y - rx * 0.12, rx * 0.6, rx * 0.22); c.fillStyle = "rgba(255,255,255,.5)"; c.fill(); }
    }
    if (T.decor === "swamp") { // 爛泥斑
      for (let i = 0; i < 22; i++) { const x = R() * 300, y = R() * 400, rx = 6 + R() * 14; if (P.distRoad(x, y) < rx + 14) continue; ell(x, y, rx, rx * 0.5, R() * .6 - .3); c.fillStyle = "rgba(30,40,28,.35)"; c.fill(); }
    }
    c.lineCap = "round";
    for (let i = 0; i < 420; i++) { const x = R() * 300, y = R() * 400; if (P.distRoad(x, y) < 16 || P.distWater(x, y) < 3) continue; const s = 1.6 + R() * 1.6; c.strokeStyle = R() < 0.5 ? T.tuft : T.tuft2; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - s * 0.6, y - s); c.lineTo(x, y); c.lineTo(x + s * 0.6, y - s); c.moveTo(x, y); c.lineTo(x + 0.1, y - s * 1.2); c.stroke(); }
    if (T.decor === "volcano") drawLavaCracks(R);
    if (T.night) { c.fillStyle = rg(250, 30, 10, 330, [T.nightLight, T.nightLight.replace(/[\d.]+\)$/, "0)")]); c.fillRect(0, 0, 300, 400); }
  }
  function drawLavaCracks(R) {
    let n = 0;
    for (let k = 0; k < 60 && n < 9; k++) {
      let x = 10 + R() * 280, y = 20 + R() * 340;
      if (P.distRoad(x, y) < 22 || P.slotNear(x, y, 22) || P.inZone(x, y, 6)) continue;
      const pts = [[x, y]]; let ok = true;
      for (let i = 0; i < 4; i++) { x += (R() - .5) * 14; y += 4 + R() * 6; if (P.distRoad(x, y) < 18 || P.slotNear(x, y, 18)) { ok = false; break; } pts.push([x, y]); }
      if (!ok || pts.length < 3) continue; n++;
      c.lineCap = "round"; c.lineJoin = "round";
      poly(pts, false); c.strokeStyle = "rgba(255,110,30,.25)"; c.lineWidth = 6; c.stroke();
      poly(pts, false); c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke();
      poly(pts, false); c.strokeStyle = "#ff8a2a"; c.lineWidth = 1.3; c.stroke();
      poly(pts, false); c.strokeStyle = "#ffe08a"; c.lineWidth = 0.45; c.stroke();
    }
  }
  // ═════ 路（陰影→描邊→路面→亮帶→石板→路緣草叢）
  const strokeRoutes = (w, col, dy) => { for (const rt of P.routes) { c.beginPath(); rt.path.forEach(([x, y], i) => i ? c.lineTo(x, y + (dy || 0)) : c.moveTo(x, y + (dy || 0))); c.strokeStyle = col; c.lineWidth = w; c.stroke(); } };
  function drawRoad(R) {
    c.lineJoin = "round"; c.lineCap = "round";
    strokeRoutes(33, T.roadShadow, 3);
    strokeRoutes(29.5, T.roadEdge);
    strokeRoutes(25, T.roadFill);
    strokeRoutes(13, T.roadCenter);
    for (const rt of P.routes) for (let d = 4; d < rt.len; d += 5.5) {
      const p = posDir(rt, d); if (p.x < -2 || p.x > 302 || p.y > 402) continue;
      const off = (R() - 0.5) * 16, x = p.x + (p.dy ? off : 0), y = p.y + (p.dx ? off : 0);
      const w = 3.5 + R() * 2, h = 2.4 + R() * 1.2; rr(x - w / 2, y - h / 2, w, h, 1.2); paint(R() < 0.5 ? T.pebble : T.pebble2, T.pebbleOl, 0.55);
    }
    for (const rt of P.routes) for (let d = 2; d < rt.len; d += 5) {
      const p = posDir(rt, d);
      for (const sgn of [-1, 1]) { if (R() < 0.62) continue; const x = p.x + (p.dy ? sgn * 13.5 : 0), y = p.y + (p.dx ? sgn * 13.5 : 0); if (P.distRoad(x, y) < 12.5 || P.distWater(x, y) < 2) continue; tuftBig(x + (R() - .5) * 3, y + 1.5, 0.7 + R() * 0.45, R); }
    }
  }
  function tuftBig(x, y, s, R) { c.beginPath(); c.moveTo(x - 3.5 * s, y); c.quadraticCurveTo(x - 3 * s, y - 3 * s, x - 4 * s, y - 5 * s); c.quadraticCurveTo(x - 1.5 * s, y - 3 * s, x - 1 * s, y - 2 * s); c.quadraticCurveTo(x, y - 5 * s, x + 0.5 * s, y - 6.5 * s); c.quadraticCurveTo(x + 1.5 * s, y - 3.5 * s, x + 1.6 * s, y - 2.2 * s); c.quadraticCurveTo(x + 3 * s, y - 4 * s, x + 4.2 * s, y - 4.8 * s); c.quadraticCurveTo(x + 3.4 * s, y - 2 * s, x + 3.5 * s, y); c.closePath(); paint(R() < 0.5 ? T.verge : T.verge2, T.ol, T.olw * 0.6); }

  // ═════ 水：溪＋池塘（草原池塘、沼澤水窪、冰原冰湖、火山熔岩池）
  function drawWater(R) {
    c.lineJoin = "round"; c.lineCap = "round";
    if (P.stream) {
      const S = P.stream, sp = (w, col) => { c.beginPath(); S.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
      sp(10.5, T.ol); sp(7.4, T.waterDeep); sp(3, T.water);
      c.setLineDash([2.5, 3.5]); sp(1, T.waterLight); c.setLineDash([]);
      rock(S[0][0] - 6, S[0][1] + 2, 0.75, R); rock(S[0][0] + 7, S[0][1] + 4, 0.6, R);
    }
    for (const o of P.ponds) pond(o, R);
  }
  function pond(o, R) {
    const { x, y, rx, ry, kind } = o;
    if (kind === "lava") {
      glow(x, y, rx * 1.6, "rgba(255,110,30,A)", 0.35);
      ell(x, y, rx + 2.4, ry + 2.4); paint("#3a2420", T.ol, T.olw);
      ell(x, y, rx, ry); paint(lg(0, y - ry, 0, y + ry, ["#ffd06a", T.water, T.waterDeep]), null);
      for (let i = 0; i < 5; i++) { const a = R() * PI2, d = R() * 0.6; ell(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 2 + R() * 3, 1 + R() * 1.3); paint("rgba(80,24,10,.75)", null); }
      for (let i = 0; i < 3; i++) { circ(x - rx * 0.5 + i * rx * 0.5, y - ry * 0.2 + (i % 2) * 2, 1); paint("#fff2b0", null); }
      for (let i = 0; i < 4; i++) { const a = i * PI2 / 4 + 0.4; rock(x + Math.cos(a) * (rx + 3), y + Math.sin(a) * (ry + 2) + 2, 0.5 + R() * 0.25, R); }
      return;
    }
    if (kind === "ice") {
      ell(x, y, rx + 2.6, ry + 2.6); paint("#f4faff", T.ol, T.olw);
      ell(x, y, rx, ry); paint(lg(0, y - ry, 0, y + ry, [T.water, T.waterDeep]), null);
      c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { const a = R() * PI2; c.beginPath(); c.moveTo(x + Math.cos(a) * rx * 0.15, y + Math.sin(a) * ry * 0.15); c.lineTo(x + Math.cos(a + 0.3) * rx * 0.55, y + Math.sin(a + 0.3) * ry * 0.5); c.lineTo(x + Math.cos(a) * rx * 0.85, y + Math.sin(a) * ry * 0.85); c.stroke(); }
      ell(x - rx * 0.35, y - ry * 0.35, rx * 0.3, ry * 0.18, -0.2); paint("rgba(255,255,255,.55)", null);
      for (let i = 0; i < 3; i++) { const a = R() * PI2; ell(x + Math.cos(a) * (rx + 2), y + Math.sin(a) * (ry + 2), 4 + R() * 3, 1.8); paint("#ffffff", null); }
      return;
    }
    ell(x, y, rx + 1.8, ry + 1.8); paint(T.ol, null);
    ell(x, y, rx, ry); paint(lg(0, y - ry, 0, y + ry, [T.water, T.waterDeep]), null);
    for (let i = 0; i < Math.max(2, Math.round(rx / 8)); i++) { const xx = x - rx * 0.65 + i * (rx * 1.3 / Math.max(1, Math.round(rx / 8) - 1 || 1)) + R() * 3, yy = y - ry * 0.3 + R() * ry * 0.6; c.beginPath(); c.moveTo(xx - 3, yy); c.lineTo(xx + 3, yy); c.strokeStyle = T.waterLight; c.lineWidth = 0.8; c.stroke(); }
    if (o.lily) { const n = rx > 20 ? 3 : 1; for (let i = 0; i < n; i++) { const lx = x - rx * 0.42 + i * rx * 0.36 + R() * 3, ly = y - ry * 0.1 + R() * ry * 0.4, r = (rx > 20 ? 3.6 : 2.4) - i * 0.4; c.beginPath(); c.ellipse(lx, ly, r, r * 0.6, 0, 0.35, PI2 - 0.1); c.lineTo(lx, ly); c.closePath(); paint(T.lily, T.ol, T.olw * 0.6); if (i === 0 && T.lotus) { circ(lx + 0.8, ly - 0.8, 1.4); paint(T.lotus, T.ol, 0.5); } } }
    const reeds = [[x - rx - 2, y - 1], [x - rx + 1, y + 4], [x + rx + 1, y + 3], [x + rx - 2, y + 7]];
    for (const [qx, qy] of reeds) { if (R() < 0.25) continue; c.strokeStyle = T.reed; c.lineWidth = 1; c.beginPath(); c.moveTo(qx, qy); c.lineTo(qx - 0.5, qy - 8); c.stroke(); ell(qx - 0.5, qy - 8.5, 0.95, 2.1); paint(T.reedTop, null); }
    if (o.dock) { c.save(); c.translate(x + rx * 0.84, y + ry * 0.85); rr(-1, -9, 9, 13, 1); paint(T.wood, T.ol, T.olw * 0.7); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-1, -6 + i * 3); c.lineTo(8, -6 + i * 3); c.strokeStyle = T.woodDark; c.lineWidth = 0.5; c.stroke(); } c.restore(); }
  }

  // ═════ 裝飾物
  function treeRound(x, y, s, R) {
    shadow(x + 2.5 * s, y + 0.5, 8.5 * s, 3.4 * s);
    rr(x - 1.7 * s, y - 8 * s, 3.4 * s, 8.4 * s, 1); paint(T.trunk);
    const g = T.leaf[Math.floor(R() * T.leaf.length)];
    union([() => circ(x - 4.6 * s, y - 11 * s, 5.8 * s), () => circ(x + 4.6 * s, y - 11.5 * s, 5.6 * s), () => circ(x, y - 16 * s, 7 * s)], g[1]);
    circ(x - 1.5 * s, y - 17.5 * s, 4.4 * s); paint(g[0], null); circ(x - 5.5 * s, y - 12.5 * s, 3 * s); paint(g[0], null);
    circ(x - 2.6 * s, y - 19 * s, 1.5 * s); paint(T.snowTip ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.45)", null);
    if (T.snowTip) { c.beginPath(); c.ellipse(x - 1, y - 21.5 * s, 5 * s, 2.2 * s, 0, Math.PI, 0); paint(T.snowTip, null); }
    if (T.fruit && R() < 0.6) for (let i = 0; i < 3; i++) { circ(x - 4 * s + i * 4 * s, y - 12 * s - (i % 2) * 4 * s, 1.1 * s); paint(T.fruit, T.ol, 0.5); }
  }
  function treePine(x, y, s, R) {
    shadow(x + 2.5 * s, y + 0.5, 7.5 * s, 3 * s);
    rr(x - 1.3 * s, y - 5 * s, 2.6 * s, 5.4 * s, 0.6); paint(T.trunk);
    const g = T.pine[Math.floor(R() * T.pine.length)];
    for (let i = 0; i < 3; i++) {
      const w = (8.5 - i * 2.1) * s, yb = y - (3 + i * 6.2) * s, yt = yb - 10 * s;
      poly([[x - w, yb], [x, yt], [x + w, yb]]); paint(g[1]);
      poly(T.lightLeft ? [[x - w, yb], [x, yt], [x, yb]] : [[x, yb], [x, yt], [x + w, yb]]); paint(g[0], null);
      if (T.snowTip) { poly([[x - w * 0.55, yt + 5.5 * s], [x, yt], [x + w * 0.55, yt + 5.5 * s], [x + w * 0.2, yt + 4.4 * s], [x - w * 0.15, yt + 5 * s]]); paint(T.snowTip, null); }
      poly([[x - w, yb], [x, yt], [x + w, yb]]); paint(null);
    }
  }
  function bush(x, y, s, R) {
    shadow(x + 1, y + 0.5, 6 * s, 2.4 * s);
    const g = T.leaf[Math.floor(R() * T.leaf.length)];
    union([() => circ(x - 3 * s, y - 2.8 * s, 3.4 * s), () => circ(x + 3 * s, y - 2.8 * s, 3.2 * s), () => circ(x, y - 4.6 * s, 3.8 * s)], g[1]);
    circ(x - 1, y - 6 * s, 2 * s); paint(g[0], null);
    if (T.snowTip) { c.beginPath(); c.ellipse(x, y - 6.6 * s, 4.4 * s, 2 * s, 0, Math.PI, 0); paint(T.snowTip, null); }
    else if (T.berry) for (let i = 0; i < 3; i++) { circ(x - 3 * s + i * 3 * s, y - 2.5 * s - (i % 2) * 2.5 * s, 0.85 * s); paint(T.berry, null); }
  }
  function rock(x, y, s, R) {
    shadow(x + 1, y + 0.6, 6 * s, 2.4 * s);
    const pts = [[x - 6 * s, y], [x - 5 * s, y - 4 * s], [x - 1 * s, y - 6.5 * s], [x + 4 * s, y - 5 * s], [x + 6 * s, y - 1 * s], [x + 4 * s, y + 1 * s]];
    poly(pts); paint(T.rock[1]);
    poly([[x - 5 * s, y - 4 * s], [x - 1 * s, y - 6.5 * s], [x + 4 * s, y - 5 * s], [x + 0.5 * s, y - 2.6 * s]]); paint(T.rock[0], null);
    poly([[x + 4 * s, y - 5 * s], [x + 6 * s, y - 1 * s], [x + 4 * s, y + 1 * s], [x + 0.5 * s, y - 2.6 * s]]); paint(T.rock[2], null);
    poly(pts); paint(null);
    if (T.moss && R() < 0.5) { ell(x - 2 * s, y - 5.4 * s, 2.4 * s, 1 * s); paint(T.moss, null); }
  }
  function flowers(x, y, R) {
    for (let k = 0; k < 3; k++) {
      const fx = x + (R() - 0.5) * 8, fy = y + (R() - 0.5) * 5, col = T.flowers[Math.floor(R() * T.flowers.length)];
      if (T.night) glow(fx, fy - 1, 4, T.flowerGlow, 0.35);
      c.strokeStyle = T.tuft; c.lineWidth = 0.6; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 2); c.stroke();
      for (let i = 0; i < 5; i++) { const a = i * PI2 / 5; circ(fx + Math.cos(a) * 1.25, fy - 2.4 + Math.sin(a) * 1.25, 0.95); paint(col, null); }
      circ(fx, fy - 2.4, 0.75); paint(T.flowerCenter, null);
    }
  }
  function crystals(x, y, R) { // 冰原：冰晶簇
    glow(x, y - 3, 7, "rgba(170,225,255,A)", 0.4);
    for (let k = 0; k < 3; k++) {
      const cx = x + (k - 1) * 2.6, h = (k === 1 ? 7 : 4.5) + R() * 2, w = 1.6, a = (k - 1) * 0.35;
      c.save(); c.translate(cx, y); c.rotate(a);
      poly([[-w, 0], [-w, -h * 0.75], [0, -h], [w, -h * 0.75], [w, 0]]); paint("#d8f4ff", T.ol, 0.55);
      poly([[0, 0], [0, -h], [w, -h * 0.75], [w, 0]]); paint("#8ccbea", null);
      c.restore();
    }
  }
  function mushroom(x, y, R) {
    for (let k = 0; k < 2; k++) {
      const mx = x + k * 4, my = y + k * 1.5, s = k ? 0.75 : 1;
      if (T.night) glow(mx, my - 3, 6, T.mushGlow, 0.4);
      rr(mx - 1 * s, my - 3.2 * s, 2 * s, 3.4 * s, 0.6); paint(T.mushStem, T.ol, T.olw * 0.6);
      c.beginPath(); c.ellipse(mx, my - 3 * s, 3.2 * s, 2.6 * s, 0, Math.PI, 0); c.closePath(); paint(T.mushCap, T.ol, T.olw * 0.6);
      circ(mx - 1 * s, my - 4.4 * s, 0.6 * s); paint(T.mushDot, null); circ(mx + 1.3 * s, my - 3.7 * s, 0.45 * s); paint(T.mushDot, null);
    }
  }
  function reedClump(x, y, R) {
    for (let i = 0; i < 4; i++) { const qx = x + (i - 1.5) * 1.8 + R(), qy = y + R() * 1.5, h = 6 + R() * 4; c.strokeStyle = T.ol; c.lineWidth = 1.6; c.beginPath(); c.moveTo(qx, qy); c.quadraticCurveTo(qx - 0.6, qy - h * 0.6, qx + (i - 1.5) * 0.8, qy - h); c.stroke(); c.strokeStyle = T.reed; c.lineWidth = 0.8; c.stroke(); if (i % 2) { ell(qx + (i - 1.5) * 0.8, qy - h - 0.6, 0.9, 2); paint(T.reedTop, null); } }
  }
  function vent(x, y, R) { // 火山：冒煙熔岩孔
    glow(x, y - 1, 8, "rgba(255,120,40,A)", 0.5);
    ell(x, y, 4.4, 2); paint("#2a1612", T.ol, 0.7); ell(x, y - 0.2, 2.6, 1.1); paint("#ff8a2a", null); ell(x, y - 0.4, 1.2, 0.5); paint("#ffe08a", null);
  }
  function spire(x, y, s, R) { // 火山：玄武岩柱
    shadow(x + 2, y + 0.5, 6 * s, 2.4 * s);
    poly([[x - 4.5 * s, y], [x - 3.4 * s, y - 12 * s], [x - 0.6 * s, y - 17 * s], [x + 2.6 * s, y - 13 * s], [x + 4.6 * s, y]]); paint(T.rock[1]);
    poly([[x - 0.6 * s, y - 17 * s], [x + 2.6 * s, y - 13 * s], [x + 4.6 * s, y], [x + 0.6 * s, y]]); paint(T.rock[2], null);
    poly([[x - 4.5 * s, y], [x - 3.4 * s, y - 12 * s], [x - 0.6 * s, y - 17 * s], [x + 2.6 * s, y - 13 * s], [x + 4.6 * s, y]]); paint(null);
    c.beginPath(); c.moveTo(x - 1.4 * s, y - 3 * s); c.lineTo(x - 0.4 * s, y - 8 * s); c.lineTo(x + 1.2 * s, y - 10 * s); c.strokeStyle = "#ff8a2a"; c.lineWidth = 0.8; c.stroke();
  }
  function fence(x0, x1, y) { // 草原：花籬笆
    for (let x = x0; x <= x1; x += 9) {
      rr(x - 0.9, y - 7, 1.8, 7.5, 0.6); paint(T.wood, T.ol, 0.55);
      if (x + 9 <= x1) { rr(x, y - 5.6, 9, 1.5, 0.4); paint(T.woodLight, T.ol, 0.45); rr(x, y - 2.6, 9, 1.5, 0.4); paint(T.woodLight, T.ol, 0.45); }
    }
    for (let x = x0 + 4; x < x1; x += 7) { const col = T.flowers[Math.floor(Math.abs(Math.sin(x * 12.9)) * T.flowers.length)]; for (let i = 0; i < 5; i++) { const a = i * PI2 / 5; circ(x + Math.cos(a) * 1.1, y - 7.4 + Math.sin(a) * 1.1, 0.85); paint(col, null); } circ(x, y - 7.4, 0.65); paint(T.flowerCenter, null); }
  }
  function deadTree(x, y, s) {
    shadow(x + 2, y + 0.5, 6 * s, 2.4 * s);
    const br = [[0, 0, 0, -14], [0, -8, -6, -15], [0, -10, 5, -18], [-6, -15, -8, -19], [5, -18, 8, -21], [0, -14, 1, -20]];
    for (const [a, b, cc, d] of br) { c.beginPath(); c.moveTo(x + a * s, y + b * s); c.lineTo(x + cc * s, y + d * s); c.strokeStyle = T.ol; c.lineWidth = (b === 0 ? 4.8 : 2.8) * s; c.lineCap = "round"; c.stroke(); c.strokeStyle = T.darkTrunk; c.lineWidth = (b === 0 ? 2.6 : 1.1) * s; c.stroke(); }
    if (T.decor === "volcano") { glow(x, y - 2, 5 * s, "rgba(255,110,40,A)", 0.3); }
  }
  function thornBush(x, y, s) {
    shadow(x, y + 0.5, 6 * s, 2 * s);
    c.lineCap = "round";
    for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.15 + i * 0.175); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 6 * s, x + Math.cos(a) * 7 * s, y + Math.sin(a) * 8 * s); c.strokeStyle = T.ol; c.lineWidth = 2.6 * s; c.stroke(); c.strokeStyle = T.thorn; c.lineWidth = 1.2 * s; c.stroke(); poly([[x + Math.cos(a) * 4.5 * s - 0.8, y + Math.sin(a) * 6 * s], [x + Math.cos(a) * 4.5 * s + 1.8, y + Math.sin(a) * 6 * s - 1.6], [x + Math.cos(a) * 4.5 * s + 0.6, y + Math.sin(a) * 6 * s + 0.8]]); paint(T.thorn, null); }
  }
  function darkTree(x, y, s) {
    shadow(x + 2, y, 8 * s, 3 * s);
    rr(x - 1.6 * s, y - 7 * s, 3.2 * s, 7.4 * s, 0.8); paint(T.darkTrunk);
    for (let i = 0; i < 3; i++) { const w = (9 - i * 2.2) * s, yb = y - (4 + i * 6.5) * s; poly([[x - w, yb], [x - w * 0.4, yb - 4 * s], [x - w * 0.2, yb - 3 * s], [x, yb - 11 * s], [x + w * 0.3, yb - 3.5 * s], [x + w * 0.5, yb - 4.5 * s], [x + w, yb]]); paint(i % 2 ? T.darkLeaf[0] : T.darkLeaf[1]); }
  }

  // ═════ 出怪口：洞穴（左右鏡像）、樣稿 B 的峽谷吊橋與迷途林
  function drawCave(R, e) {
    c.save();
    if (e.side === "R") { c.translate(300, 0); c.scale(-1, 1); }
    c.translate(0, e.y - 35);
    const rockMass = [[-6, -6], [42, -6], [40, 6], [33, 14], [26, 18], [22, 22], [24, 30], [23, 41], [20, 48], [12, 52], [-6, 53]];
    poly(rockMass); paint(lg(0, -6, 0, 56, T.cliff));
    for (const [x, y, s] of [[30, 6, 1.2], [18, 10, 1.4], [6, 15, 1.1], [36, 0, 0.9], [6, 51, 1], [20, 50, 0.7]]) rock(x, y, s, R);
    ell(13, 35, 9.5, 13); paint(rg(11, 36, 1, 13, T.caveMouth), T.ol, T.olw * 1.3);
    c.beginPath(); c.ellipse(13, 35, 9.5, 13, 0, -2.2, 0.6); c.strokeStyle = T.cliffRim; c.lineWidth = 2; c.stroke();
    glow(14, 36, 16, T.enemyGlow, 0.35);
    for (let i = 0; i < 5; i++) { const a = -2.0 + i * 0.42, tx = 13 + Math.cos(a) * 9.2, ty = 35 + Math.sin(a) * 12.6; poly([[tx - 1.6, ty - 0.5], [tx + 1.6, ty - 0.5], [tx + Math.cos(a) * -2.6, ty + 3.2]]); paint(T.cliffRim, T.ol, 0.5); }
    for (const [x, y] of [[10, 30], [15, 39]]) { glow(x, y, 4, T.eyeGlow, 0.7); circ(x - 1.1, y, 0.75); paint(T.enemyEye, null); circ(x + 1.1, y, 0.75); paint(T.enemyEye, null); }
    for (let i = 0; i < 5; i++) { const x = 18 + i * 4, y = 32 + R() * 7; circ(x, y, 5 - i * 0.5); c.fillStyle = T.mist; c.fill(); }
    c.strokeStyle = T.woodDark; c.lineWidth = 1.1; c.beginPath(); c.moveTo(25, 19); c.lineTo(25, 6); c.stroke();
    poly([[25, 6], [33, 8.5], [25, 11]]); paint(T.warnFlag, T.ol, 0.6);
    if (T.decor === "volcano") { glow(13, 40, 12, "rgba(255,110,30,A)", 0.5); ell(13, 45, 6, 2); paint("#ff8a2a", null); }
    if (T.decor === "glacier") { for (let i = 0; i < 6; i++) { const x = 2 + i * 6.5, y = -4 + (i % 2) * 2; poly([[x, y], [x + 3, y], [x + 1.5, y + 6 + (i % 3) * 2]]); paint("#eaf8ff", T.ol, 0.45); } }
    c.restore();
  }
  function drawChasm() { // 樣稿 B：左上峽谷＋吊橋（只在森林）
    c.beginPath(); c.moveTo(44, -2); c.lineTo(55, -2); c.lineTo(58, 12); c.lineTo(55, 26); c.lineTo(59, 44); c.lineTo(54, 58); c.lineTo(50, 66); c.lineTo(47, 54); c.lineTo(43, 40); c.lineTo(46, 22); c.lineTo(42, 10); c.closePath();
    paint(lg(0, 0, 0, 66, [T.chasm[0], T.chasm[1]]));
    c.beginPath(); c.moveTo(46, 4); c.lineTo(49, 20); c.lineTo(47, 40); c.lineTo(50, 56); c.strokeStyle = T.chasmLight; c.lineWidth = 0.8; c.stroke();
    rr(39, 22.5, 24, 25, 1); paint(T.woodDark, T.ol, T.olw * 0.8);
    for (let i = 0; i < 6; i++) { rr(40 + i * 3.8, 23.5 + (i % 2) * 0.6, 3.3, 23, 0.8); paint(i % 2 ? T.wood : T.woodLight, T.ol, 0.5); }
    for (const yy of [21.5, 48.5]) { c.beginPath(); c.moveTo(38, yy); c.quadraticCurveTo(51, yy + 1.8, 64, yy); c.strokeStyle = T.rope; c.lineWidth = 1.1; c.stroke(); for (const xx of [38, 64]) { rr(xx - 1.4, yy - 4.5, 2.8, 5.5, 0.8); paint(T.woodDark, T.ol, 0.6); } }
  }
  function drawForestGap(e) {
    c.save(); c.translate(0, e.y - 35);
    c.fillStyle = lg(300, 0, 255, 0, [T.mistDeep, "rgba(0,0,0,0)"]); c.fillRect(250, 14, 50, 42);
    c.lineCap = "round";
    for (const [x0, y0, dir] of [[300, 50, -1], [300, 19, -1], [262, 19, 1]]) {
      c.strokeStyle = T.thorn; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + dir * 8, y0 - 5, x0 + dir * 16, y0 - 1); c.stroke();
      for (let i = 1; i < 4; i++) { const tx = x0 + dir * i * 4.4, ty = y0 - 2.5 - (i % 2); poly([[tx - 0.8, ty], [tx, ty - 2.4], [tx + 0.8, ty]]); paint(T.thorn, null); }
    }
    for (const [x, y] of [[282, 25], [294, 46]]) { glow(x, y, 4, T.eyeGlow, 0.6); circ(x - 1.1, y, 0.7); paint(T.enemyEye, null); circ(x + 1.1, y, 0.7); paint(T.enemyEye, null); }
    c.save(); c.translate(258, 12); c.rotate(-0.12);
    rr(-0.8, -2, 1.6, 9, 0.5); paint(T.woodDark, T.ol, 0.5);
    rr(-7, -8, 14, 6.5, 1); paint(T.wood, T.ol, T.olw * 0.7);
    c.fillStyle = T.signInk; c.font = "bold 4.6px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("荒野", 0, -4.6);
    c.restore(); c.restore();
  }

  // ═════ 裝飾配置（固定種子；避開路、塔位、水、出怪口、城堡；密度克制，不吃掉怪）
  function placeDecor() {
    const items = [], R2 = mulberry(4242 + region * 31), placed = [], D = T.decor;
    const near = (x, y) => P.distRoad(x, y);
    for (let gx = 4; gx < 300; gx += 10.5) for (let gy = 4; gy < 400; gy += 10.5) {
      const x = gx + (R2() - 0.5) * 7, y = gy + (R2() - 0.5) * 7, d = near(x, y), k = R2();
      if (d < 18 || P.distWater(x, y) < 7 || P.inZone(x, y, 2)) continue;
      if (P.slotNear(x, y, 19)) continue;
      const wild = Math.max(0, 1 - Math.min(...P.entries.map(e => H(x - e.x, y - e.y))) / 125);
      let tall = k < (wild > 0.35 ? 0.3 : 0.2) && d > 25 && placed.every(p => H(p[0] - x, p[1] - y) > 13);
      if (tall && (near(x, y - 20) < 17 || P.slotNear(x, y - 14, 18) || P.inZone(x, y - 22, 2))) tall = false;   // 樹冠不伸進路與塔位
      if (tall) placed.push([x, y]);
      const s1 = 0.85 + R2() * 0.3;
      if (wild > 0.35) {
        if (tall) items.push({ y, f: () => (D === "volcano" ? (R2() < 0.5 ? spire : deadTree) : (R2() < 0.4 ? deadTree : darkTree))(x, y, 0.8 + R2() * 0.3, R2) });
        else if (k < 0.32) items.push({ y, f: () => thornBush(x, y, 0.9 + R2() * 0.3) });
        else if (k < 0.42) items.push({ y, f: () => rock(x, y, 0.55 + R2() * 0.45, R2) });
        else if (k < (D === "volcano" ? 0.45 : 0.5)) items.push({ y, f: () => D === "volcano" ? vent(x, y, R2) : D === "glacier" ? crystals(x, y, R2) : mushroom(x, y, R2) });
      } else if (D === "meadow") {
        if (tall) items.push({ y, f: () => (R2() < T.pineRatio ? treePine : treeRound)(x, y, s1, R2) });
        else if (k < 0.27) items.push({ y, f: () => bush(x, y, s1, R2) });
        else if (k < 0.31) items.push({ y, f: () => rock(x, y, 0.5 + R2() * 0.35, R2) });
        else if (k < 0.5) items.push({ y, f: () => flowers(x, y, R2) });
      } else if (D === "swamp") {
        if (tall) items.push({ y, f: () => (R2() < 0.4 ? deadTree : R2() < 0.5 ? treePine : treeRound)(x, y, s1, R2) });
        else if (k < 0.18) items.push({ y, f: () => bush(x, y, s1, R2) });
        else if (k < 0.3) items.push({ y, f: () => reedClump(x, y, R2) });
        else if (k < 0.36) items.push({ y, f: () => rock(x, y, 0.5 + R2() * 0.4, R2) });
        else if (k < 0.44) items.push({ y, f: () => mushroom(x, y, R2) });
        else if (k < 0.47) items.push({ y, f: () => flowers(x, y, R2) });
      } else if (D === "glacier") {
        if (tall) items.push({ y, f: () => treePine(x, y, s1, R2) });
        else if (k < 0.2) items.push({ y, f: () => bush(x, y, s1, R2) });
        else if (k < 0.3) items.push({ y, f: () => rock(x, y, 0.55 + R2() * 0.45, R2) });
        else if (k < 0.38) items.push({ y, f: () => crystals(x, y, R2) });
      } else if (D === "volcano") {
        if (tall) items.push({ y, f: () => (R2() < 0.55 ? spire : deadTree)(x, y, s1, R2) });
        else if (k < 0.16) items.push({ y, f: () => thornBush(x, y, 0.85 + R2() * 0.3) });
        else if (k < 0.32) items.push({ y, f: () => rock(x, y, 0.55 + R2() * 0.5, R2) });
        else if (k < 0.345) items.push({ y, f: () => vent(x, y, R2) });
        else if (k < 0.375) items.push({ y, f: () => flowers(x, y, R2) });
      } else { // 森林（樣稿 B）
        if (tall) items.push({ y, f: () => (R2() < T.pineRatio ? treePine : treeRound)(x, y, s1, R2) });
        else if (k < 0.3) items.push({ y, f: () => bush(x, y, s1, R2) });
        else if (k < 0.36) items.push({ y, f: () => rock(x, y, 0.55 + R2() * 0.4, R2) });
        else if (k < 0.45) items.push({ y, f: () => flowers(x, y, R2) });
        else if (k < 0.47) items.push({ y, f: () => mushroom(x, y, R2) });
      }
    }
    // 城堡前的籬笆（家園感；草原多一段花籬笆）
    const L = P.castle;
    if (L.type === "bottom") {
      const fy = L.wallTop - 5, segs = [];
      let run = null;
      for (let x = 6; x <= 294; x += 9) {
        const ok = Math.abs(x - L.gx) > 22 && !L.towers.some(t => Math.abs(x - t.x) < t.r + 8) && near(x, fy - 3) > 15 && !P.slotNear(x, fy - 3, 15);
        if (ok) { if (!run) run = [x, x]; else run[1] = x; } else if (run) { segs.push(run); run = null; }
      }
      if (run) segs.push(run);
      for (const [a, b] of segs) if (b - a >= 18) items.push({ y: fy, f: () => D === "meadow" ? fence(a, b, fy) : fenceWood(a, b, fy) });
    }
    if (D === "meadow") { // 草原：路邊幾段花籬笆
      const R3 = mulberry(55); let n = 0;
      for (let k = 0; k < 80 && n < 5; k++) {
        const rt = P.routes[0], p = posDir(rt, 40 + R3() * (rt.len - 120)); if (!p.dx) continue;
        const y = p.y + (R3() < 0.5 ? -19 : 22), x0 = p.x - 14, x1 = p.x + 14;
        let ok = true; for (let x = x0; x <= x1; x += 4) if (near(x, y - 3) < 15 || P.slotNear(x, y - 3, 17) || P.distWater(x, y) < 6 || P.inZone(x, y, 2)) ok = false;
        if (ok) { n++; items.push({ y, f: () => fence(x0, x1, y) }); }
      }
    }
    // 入口兩側高大暗樹（樣稿 B 右上；其他地圖放在入口附近的空地）
    if (P.m.id === "forest") for (const [x, y, s] of [[262, 6, 1.2], [276, 14, 1.35], [292, 8, 1.15], [298, 58, 1.1], [242, 4, 1.0]]) items.push({ y, f: () => darkTree(x, y, s) });
    items.sort((a, b) => a.y - b.y).forEach(it => it.f());
  }
  function fenceWood(x0, x1, y) {
    for (let x = x0; x <= x1; x += 9) { rr(x - 0.9, y - 7, 1.8, 7, 0.6); paint(T.wood, T.ol, 0.5); if (x + 9 <= x1) { rr(x, y - 5.5, 9, 1.5, 0.4); paint(T.woodLight, T.ol, 0.4); rr(x, y - 2.5, 9, 1.5, 0.4); paint(T.woodLight, T.ol, 0.4); } }
  }

  // ═════ 城堡本體（畫在城堡層）
  function roundTower(t, base) {
    const tx = t.x, r = t.r, top = base - t.h;
    cyl(tx, base, r, t.h, sideGrad(tx, r, T.wall[0], T.wall[1], T.wall[2]), null);
    for (let k = 1; k * 8 < t.h; k++) { c.beginPath(); c.moveTo(tx - r, base - k * 8); c.lineTo(tx + r, base - k * 8); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
    if (t.h >= 18) { rr(tx - 1.5, top + 18, 3, 7, 1.5); paint(T.slit, null); if (T.night) glow(tx, top + 21, 8, T.windowGlow, 0.5); }
    const cr = r + 2; cyl(tx, top + 1, cr, 4, sideGrad(tx, cr, T.wall[0], T.wall[1], T.wall[2]), T.wallTopC);
    const n = Math.max(2, Math.round(cr / 4.6)); for (let k = -n + 1; k <= n - 1; k++) { rr(tx + k * 4.6 - 1.6, top - 6 + Math.abs(k) * 0.5, 3.2, 4.5, 0.6); paint(T.wall[1]); }
    const rb = top - 6, rw = cr + 0.5;
    poly([[tx - rw, rb], [tx, rb - t.roof], [tx + rw, rb]]); paint(sideGrad(tx, rw, T.roofC[0], T.roofC[1], T.roofC[2]));
    c.beginPath(); c.ellipse(tx, rb, rw, rw * 0.3, 0, 0, Math.PI); paint(T.roofC[2]);
    for (let k = 1; k < 5; k++) { const f = k / 5; c.beginPath(); c.moveTo(tx - rw * (1 - f), rb - t.roof * f + 1.5); c.quadraticCurveTo(tx, rb - t.roof * f + 5.4 * (1 - f), tx + rw * (1 - f), rb - t.roof * f + 1.5); c.strokeStyle = T.roofLine; c.lineWidth = 0.6; c.stroke(); }
    if (t.h >= 30) banner(tx, base - 18, 9, 15, T.castleBanner, (bx, by) => star(bx, by, 2.3, T.gold));
  }
  function gateArch(x0, x1, top, bottom) { // 門洞（路接進來）＋鐵柵門
    const cx = (x0 + x1) / 2, w = x1 - x0, peak = top, spring = Math.min(bottom - 4, top + w * 0.64);
    const path = () => { c.beginPath(); c.moveTo(x0, bottom); c.lineTo(x0, spring); c.quadraticCurveTo(cx, peak - (spring - peak) * 0.25, x1, spring); c.lineTo(x1, bottom); };
    path(); c.closePath(); paint(T.gateDark, null);
    const nV = Math.max(2, Math.round(w / 5.3)); for (let i = 0; i < nV; i++) { const x = x0 + 3 + i * (w - 6) / (nV - 1); c.beginPath(); c.moveTo(x, spring - (Math.abs(x - cx) < w * 0.3 ? (spring - peak) * 0.55 : 0)); c.lineTo(x, bottom - 3); c.strokeStyle = T.portcullis; c.lineWidth = 1; c.stroke(); }
    for (let y = spring + 2; y < bottom - 4; y += 6) { c.beginPath(); c.moveTo(x0 + 1, y); c.lineTo(x1 - 1, y); c.strokeStyle = T.portcullis; c.lineWidth = 0.8; c.stroke(); }
    path(); paint(null, T.ol, T.olw * 1.1);
  }
  function crestBook(x, y, r) {
    circ(x, y, r); paint(T.crest, T.gold, 1);
    const k = r / 5.6; c.beginPath(); c.moveTo(x - 3.5 * k, y - 1.5 * k); c.quadraticCurveTo(x - 1.5 * k, y - 2.5 * k, x, y - 1 * k); c.quadraticCurveTo(x + 1.5 * k, y - 2.5 * k, x + 3.5 * k, y - 1.5 * k); c.lineTo(x + 3.5 * k, y + 2.5 * k); c.quadraticCurveTo(x + 1.5 * k, y + 1.5 * k, x, y + 3 * k); c.quadraticCurveTo(x - 1.5 * k, y + 1.5 * k, x - 3.5 * k, y + 2.5 * k); c.closePath(); paint("#fff8e6", T.ol, 0.5);
  }
  function crenel(x0, x1, y, step) { for (let x = x0 + 1; x < x1 - 3; x += step || 8.5) { rr(x, y - 4.5, 5, 5, 0.8); paint(T.wall[0]); } }
  function plaqueText(L) { // 牆上名牌「文法王城」
    if (!L.name) return;
    const y = (L.type === "bottom" ? Math.min(L.wallTop + 11, 385) : 0);
    rr(L.name.x, y, L.name.w, 13, 3); paint(T.plaque, T.gold, 1.1); c.fillStyle = T.plaqueText; c.font = "bold 7.4px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("文法王城", L.name.x + L.name.w / 2, y + 6.8);
  }
  function drawCastle(L) {
    if (L.type === "bottom") {
      const wt = L.wallTop, gx = L.gx;
      for (const [x0, x1] of [[-4, gx - 18], [gx + 18, 304]]) {
        rr(x0, wt + 6, x1 - x0, 404 - wt, 0); paint(lg(0, wt + 6, 0, 400, [T.wall[0], T.wall[1]]));
        rr(x0, wt, x1 - x0, 6.5, 0); paint(T.wallTopC);
        crenel(x0, x1, wt);
        for (let r = 0; r * 7 + wt + 8 < 400; r++) for (let x = x0 + (r % 2) * 5; x < x1; x += 10) { c.beginPath(); c.rect(x, wt + 8 + r * 7, Math.min(10, x1 - x), 7); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
      }
      plaqueText(L);
      const g0 = gx - 18, g1 = gx + 18, gt = L.gateTop;
      rr(g0, gt, 36, 404 - gt, 0); paint(lg(0, gt, 0, 400, [T.wall[0], T.wall[1]]));
      rr(g0 - 2, gt - 4, 40, 6, 0); paint(T.wallTopC);
      crenel(g0 - 1, g1 + 2, gt - 4, 7.5);
      const archTop = gt + 8;
      gateArch(gx - 11, gx + 11, Math.min(archTop + 6, 392), 404);
      crestBook(gx, Math.min(archTop + 1, 390), gt > 372 ? 4.2 : 5.6);
      for (const t of L.towers) roundTower(t, 404);
    } else if (L.type === "keep") {
      const gx = L.gx, f = L.front, k = L.keepT;
      shadow(gx + 3, f + 1, 36, 7, 0.4);
      roundTower(k, k.base);
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? gx - 14 - L.wingW : gx + 14, x1 = x0 + L.wingW;
        rr(x0, L.wingTop, L.wingW, f - L.wingTop, 0); paint(lg(0, L.wingTop, 0, f, [T.wall[0], T.wall[1]]));
        rr(x0 - 1, L.wingTop - 3, L.wingW + 2, 4.5, 0); paint(T.wallTopC);
        crenel(x0, x1 + 1, L.wingTop - 3, 6);
        for (let r = 0; r * 7 + L.wingTop + 3 < f; r++) { c.beginPath(); c.moveTo(x0, L.wingTop + 3 + r * 7); c.lineTo(x1, L.wingTop + 3 + r * 7); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
      }
      rr(gx - 14, L.gateTop, 28, f - L.gateTop, 0); paint(lg(0, L.gateTop, 0, f, [T.wall[0], T.wall[1]]));
      rr(gx - 16, L.gateTop - 4, 32, 5.5, 0); paint(T.wallTopC);
      crenel(gx - 15, gx + 17, L.gateTop - 4, 6.5);
      gateArch(gx - 8.5, gx + 8.5, L.gateTop + 14, f);
      crestBook(gx, L.gateTop + 8, 4.4);
      // 底座積雪／石台
      ell(gx, f + 0.5, 34, 3.2); paint(T.decor === "glacier" ? "rgba(246,251,255,.8)" : "rgba(0,0,0,.2)", null);
    } else { // side：右（或左）邊牆，城門朝來路
      c.save(); if (L.flip) { c.translate(300, 0); c.scale(-1, 1); }
      const x0 = L.x0, top = L.top, bot = L.bottom, gy = L.gy;
      shadow(x0 + 6, bot + 1, 18, 4, 0.4);
      roundTower(L.tw, L.tw.base);
      rr(x0, top, 306 - x0, bot - top, 0); paint(lg(x0, 0, 306, 0, [T.wall[2], T.wall[1], T.wall[0]]));
      rr(x0 - 2, top - 5, 308 - x0, 6, 0); paint(T.wallTopC);
      crenel(x0 - 1, 306, top - 5, 7);
      for (let r = 1; r * 7 + top < bot; r++) { c.beginPath(); c.moveTo(x0, top + r * 7); c.lineTo(306, top + r * 7); c.strokeStyle = T.stoneLine; c.lineWidth = 0.5; c.stroke(); }
      // 側門（朝左）：黑色拱門＋柵欄
      c.beginPath(); c.moveTo(x0 + 9, gy + 13); c.lineTo(x0 - 0.5, gy + 13); c.lineTo(x0 - 0.5, gy - 6); c.quadraticCurveTo(x0 + 4, gy - 16, x0 + 9, gy - 8); c.closePath(); paint(T.gateDark, T.ol, T.olw * 1.1);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x0 + 1 + i * 3, gy - 8 + i * 1.2); c.lineTo(x0 + 1 + i * 3, gy + 12); c.strokeStyle = T.portcullis; c.lineWidth = 0.9; c.stroke(); }
      crestBook(x0 + 12, gy - 18, 4);
      if (T.decor === "volcano") { glow(x0 - 4, bot + 2, 14, "rgba(255,110,30,A)", 0.3); }
      c.restore();
    }
  }

  // ═════ 地名
  function drawLabels() {
    const names = T.cave || [];
    P.entries.forEach((e, i) => {
      let t = names[i] !== undefined ? names[i] : null;
      if (P.m.id !== "forest" && i > 0) t = null;
      if (!t) return;
      let x = e.side === "L" ? 44 : 256, y = e.y + 49;
      if (P.m.id === "forest" && e.side === "R") { x = 255; y = 72; }
      if (P.distRoad(x, y) < 15 || P.slotNear(x, y, 16)) { y = e.y - 26; if (y < 8 || P.distRoad(x, y) < 15) return; }
      label(x, y, t, 6.4 * (ART.textK || 1));   // 11-25 畫面放大組：手機直拿 ×1.3（地面圖快取的 key 含 textK，index.html ensureGround）
    });
  }

  // ═════ 對外：開局把整張地圖畫進離屏 canvas
  let GROUND = null;   // { canvas, castle, px, key }
  // ═════ 區域套件（第二刀，2026-11-21）：art/region-<名>.js 用 ART.REGION_KITS[區域序號] = { ... } 註冊，全部選填：
  //   preRoad(H)：地面畫完、路之前（地形：雪堆、熔岩河、水窪、田地）  postRoad(H)：路之後（棧道木板、路面積雪、熔岩光）
  //   entrance(H, e)：回傳 true＝自己畫了出怪口（e＝{x,y,side,dir}）    decor(H)：額外裝飾（在通用裝飾之後）；kit.replaceDecor＝true 時不跑通用裝飾
  //   castle(H, L)：回傳 true＝自己畫了城堡（L＝castleLayout 結果）     ambient(ctx, t, H)：每幀環境粒子（在通用 ambient 之後）
  //   H＝{ c（目前畫布 ctx）, T（主題）, P（plan：distRoad/distWater/inZone/slotNear/entries/castle/slots）, R（固定亂數）, m（地圖）, region, f（小工具） }
  ART.REGION_KITS = ART.REGION_KITS || {};
  function kitH(m, R) {
    return { get c() { return c; }, T, P, R, m, region, f: { ell, circ, poly, rr, paint, lg, rg, shadow, glow, union, cyl, star, banner, label, tuftBig, treeRound, treePine, bush, rock, flowers, crystals, mushroom, reedClump, vent, spire, fence, deadTree, thornBush, darkTree, roundTower, gateArch, crestBook, crenel, plaqueText, drawCastle, drawCave, mulberry } };
  }
  ART.buildGround = function (G, px) {
    const m = (G && G.map) || G || (TGx().MAPS || [])[0];
    px = px || ART._px || 2;
    const W = Math.max(1, Math.round(300 * px)), Hh = Math.max(1, Math.round(400 * px));
    const ground = mkCanvas(W, Hh); if (!ground) return null;
    P = plan(m);
    c = ground.getContext("2d"); c.setTransform(W / 300, 0, 0, Hh / 400, 0, 0);
    const R = mulberry(929);
    const KIT = ART.REGION_KITS[region] || null, KH = KIT ? kitH(m, mulberry(9290 + region)) : null;
    drawGround(R); drawWater(R);
    if (KIT && KIT.preRoad) KIT.preRoad(KH);
    drawRoad(R);
    if (KIT && KIT.postRoad) KIT.postRoad(KH);
    for (const e of P.entries) { if (KIT && KIT.entrance && KIT.entrance(KH, e)) continue; if (m.id === "forest" && e.side === "R") drawForestGap(e); else drawCave(R, e); }
    if (m.id === "forest") drawChasm();
    if (!(KIT && KIT.replaceDecor)) placeDecor();
    if (KIT && KIT.decor) KIT.decor(KH);
    drawLabels();
    // 城堡層：另一張透明 canvas，castleOverlay 每幀裁切貼上（走進城門的怪會被城牆擋住）
    const cast = mkCanvas(W, Hh), cc = cast.getContext("2d");
    c = cc; c.setTransform(W / 300, 0, 0, Hh / 400, 0, 0); if (!(KIT && KIT.castle && KIT.castle(kitH(m, mulberry(9391 + region)), P.castle))) drawCastle(P.castle);
    // 空塔位小圖（每幀 drawImage）
    const sw = Math.ceil(30 * px), sh = Math.ceil(18 * px), sl = mkCanvas(sw, sh); c = sl.getContext("2d"); c.setTransform(px, 0, 0, px, 15 * px, 8 * px); emptySlot(0, 0);
    // 暗角（環境層最後蓋上）
    const vg = mkCanvas(150, 200); c = vg.getContext("2d"); c.setTransform(.5, 0, 0, .5, 0, 0); c.fillStyle = rg(150, 200, 150, 290, ["rgba(0,0,0,0)", T.vignette]); c.fillRect(0, 0, 300, 400);
    GROUND = { canvas: ground, castle: cast, slot: sl, vignette: vg, px: W / 300, plan: P, theme: T, region, motes: motes(P), kit: KIT, kitH: KH };
    ART.ground = GROUND;
    return ground;
  };

  // ═════ 城堡層＋旗子（高度跟著剩餘生命）＋裂痕＋城牆血量牌
  ART.castleOverlay = function (ctx, lives, maxLives, t) {
    const Gd = GROUND; if (!Gd) return;
    const L = Gd.plan.castle, b = L.bbox, k = Gd.px, f = Math.max(0, Math.min(1, lives / (maxLives || 20)));
    const sx = Math.max(0, Math.floor((L.flip ? 300 - b.x1 : b.x0) * k)), sy = Math.max(0, Math.floor(b.y0 * k));
    const sw = Math.min(Gd.castle.width - sx, Math.ceil((b.x1 - b.x0) * k) + 2), sh = Math.min(Gd.castle.height - sy, Math.ceil((b.y1 - b.y0) * k) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(Gd.castle, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
    c = ctx; const TT = T; T = Gd.theme;
    // 裂痕：每少 1/7 生命多一條
    const nCr = Math.min(L.cracks.length, Math.ceil((1 - f) * L.cracks.length - 0.01));
    c.save(); if (L.flip) { c.translate(300, 0); c.scale(-1, 1); }
    for (let i = 0; i < nCr; i++) { const p = L.cracks[i]; poly(p, false); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 1.6; c.stroke(); poly(p, false); c.strokeStyle = T.crack; c.lineWidth = 0.9; c.stroke(); }
    // 火把
    if (T.night) for (const [x, y] of L.torches) { glowFast(c, x, y, 9 + Math.sin(t * 9 + x) * 1.2, T.torch, 0.75); rr(x - 0.8, y + 1, 1.6, 5, 0.6); paint(T.woodDark, null); circ(x, y + 0.2 + Math.sin(t * 13 + x) * 0.3, 1.6); paint(T.torchCore, null); }
    // 旗子：生命越少旗子降越低；剩 0～3 命時換成破旗
    for (const fl of L.flags) {
      const top = fl.y - fl.h, fy = fl.y - fl.h * (0.25 + 0.75 * f), wv = Math.sin(t * 3 + fl.x * 0.1);
      c.strokeStyle = T.ol; c.lineWidth = 1.1; c.beginPath(); c.moveTo(fl.x, fl.y); c.lineTo(fl.x, top); c.stroke();
      circ(fl.x, top - 0.8, 1.1); paint(T.gold, T.ol, 0.5);
      c.beginPath(); c.moveTo(fl.x, fy); c.quadraticCurveTo(fl.x + 6, fy - 1 + wv, fl.x + 12, fy + 2.5 + wv * 1.4); c.quadraticCurveTo(fl.x + 6, fy + 4 + wv, fl.x, fy + 6.5);
      c.closePath(); paint(f > 0.2 ? T.castleFlag : "#9a6a3a", T.ol, 0.75);
      if (f <= 0.2) { c.beginPath(); c.moveTo(fl.x + 8, fy + 1 + wv); c.lineTo(fl.x + 6, fy + 3.2); c.lineTo(fl.x + 9.5, fy + 4 + wv); c.strokeStyle = T.ol; c.lineWidth = 0.6; c.stroke(); }
    }
    c.restore();
    // 城牆血量牌
    const pq = L.plaque; if (pq) {
      const y = pq.y != null ? pq.y : Math.min(L.wallTop + 10, 384), x = pq.x, w = pq.w;
      rr(x, y, w, 15, 3); paint("rgba(27,53,69,.95)", T.gold, 1.1);
      c.beginPath(); c.moveTo(x + 4.5, y + 3.5); c.lineTo(x + 11.5, y + 3.5); c.lineTo(x + 11.3, y + 8); c.quadraticCurveTo(x + 8, y + 12.5, x + 8, y + 12.5); c.quadraticCurveTo(x + 4.7, y + 9.5, x + 4.5, y + 8); c.closePath(); paint(T.hpWall, T.ol, 0.6);
      c.fillStyle = T.plaqueText; c.font = "bold 7.4px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("城牆", x + 14, y + 7.8);
      const segs = 10, sx2 = x + 30, sw2 = 2.1, on = Math.round(f * segs);
      for (let i = 0; i < segs; i++) { rr(sx2 + i * (sw2 + 0.7), y + 4, sw2, 7.5, 0.8); paint(i < on ? T.hpWall : T.hpEmpty, null); }
      c.font = "bold 6.4px system-ui,sans-serif"; c.textAlign = "right"; c.fillText(Math.max(0, Math.round(lives)) + "/" + (maxLives || 20), x + w - 3, y + 8);
    }
    T = TT;
  };

  // ═════ 空塔位
  function emptySlot(x, y) {
    shadow(x + 1, y + 2, 12, 4.6, T.shadowA * 0.6);
    ell(x, y + 1, 11.5, 5.4); paint(T.slotFill, T.slotRim, 1.2);
    for (let i = 0; i < 6; i++) { const a = i * PI2 / 6 + 0.3; rr(x + Math.cos(a) * 10 - 1.6, y + 1 + Math.sin(a) * 4.7 - 1.1, 3.2, 2.2, 0.8); paint(T.slotStone, T.ol, 0.55); }
    c.strokeStyle = T.ol; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(x - 3, y + 1); c.lineTo(x + 3, y + 1); c.moveTo(x, y - 1.6); c.lineTo(x, y + 3.6); c.stroke();
    c.strokeStyle = T.slotPlus; c.lineWidth = 1.6; c.stroke();
  }
  ART.slot = function (ctx, x, y, t, st) {
    st = st || {}; const Gd = GROUND;
    if (st.canBuild === false && !st.hi) ctx.globalAlpha = 0.55;
    if (Gd && Gd.slot) ctx.drawImage(Gd.slot, x - 15, y - 8, 30, 18); else { c = ctx; emptySlot(x, y); }
    ctx.globalAlpha = 1;
    if (st.canBuild && !st.hi) { c = ctx; const a = 0.25 + 0.2 * Math.sin(t * 3 + x * 0.05); ell(x, y + 1, 13.5, 6.4); c.strokeStyle = `rgba(243,212,148,${a})`; c.lineWidth = 1.2; c.stroke(); }
    if (st.hi) {
      c = ctx;
      ell(x, y + 1, 15, 7); c.strokeStyle = T.gold; c.lineWidth = 2; c.stroke();
      ell(x, y + 1, 15, 7); c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 0.7; c.stroke();
      const b = Math.sin(t * 5) * 1.5; poly([[x - 3.5, y - 16 + b], [x + 3.5, y - 16 + b], [x, y - 11 + b]]); paint(T.gold, T.ol, 0.8);
    }
  };

  // ═════ 環境粒子（螢火蟲／花瓣／沼氣／雪／火星）＋暗角
  function motes(P) {
    const R = mulberry(77), out = [];
    for (let i = 0; i < 60 && out.length < 26; i++) { const x = R() * 300, y = R() * 350; if (P.distRoad(x, y) < 14) continue; out.push({ x, y, p: R() * PI2, s: 0.6 + R() * 0.8 }); }
    return out;
  }
  ART.ambient = function (ctx, reg, t) {
    const Gd = GROUND; if (!Gd) return;
    const th = Gd.theme, kind = th.particle, ms = Gd.motes;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (kind === "firefly" || kind === "meadow") {
      const n = kind === "meadow" ? 14 : ms.length;
      for (let i = 0; i < n; i++) { const m = ms[i], x = m.x + Math.sin(t * 0.5 * m.s + m.p) * 6, y = m.y + Math.cos(t * 0.4 * m.s + m.p * 1.3) * 4, a = 0.35 + 0.35 * Math.sin(t * 2 * m.s + m.p); glowFast(ctx, x, y, 5, th.firefly, Math.max(0.05, a)); ctx.fillStyle = "rgba(255,246,200," + Math.max(0.2, a + 0.3).toFixed(2) + ")"; ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
    }
    if (kind === "swamp") {
      for (let i = 0; i < 12; i++) { const m = ms[i]; const x = m.x + Math.sin(t * 0.3 + m.p) * 10, y = m.y + Math.sin(t * 0.7 + m.p) * 3, a = 0.3 + 0.3 * Math.sin(t * 1.3 + m.p); glowFast(ctx, x, y, 6, "rgba(160,255,140,A)", Math.max(0.05, a)); }
    }
    if (kind === "ember") {
      for (let i = 0; i < 26; i++) { const m = ms[i % ms.length], sp = 10 + m.s * 14, y = (m.y + 420 - (t * sp) % 420) % 420 - 10, x = m.x + Math.sin(t * 1.5 + m.p) * 4, a = 0.5 + 0.4 * Math.sin(t * 6 + m.p); glowFast(ctx, x, y, 3.5, "rgba(255,140,50,A)", Math.max(0.1, a)); ctx.fillStyle = "rgba(255,220,140,.9)"; ctx.fillRect(x - 0.5, y - 0.5, 1, 1); }
    }
    ctx.restore();
    if (kind === "meadow") { // 飄落花瓣
      for (let i = 0; i < 10; i++) { const m = ms[(i * 2 + 1) % ms.length], sp = 8 + m.s * 6, y = (m.y + (t * sp) % 420) % 420 - 10, x = m.x + Math.sin(t * 0.9 + m.p) * 10; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.2 + m.p); ctx.fillStyle = i % 2 ? "rgba(255,200,228,.85)" : "rgba(255,246,200,.8)"; ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 0.8, 0, 0, PI2); ctx.fill(); ctx.restore(); }
    }
    if (kind === "snow") {
      for (let i = 0; i < 40; i++) { const m = ms[i % ms.length], sp = 12 + m.s * 10 + (i % 3) * 4, y = ((m.y + i * 37) + (t * sp)) % 420 - 10, x = (m.x + i * 53) % 300 + Math.sin(t * 0.8 + m.p + i) * 5, r = 0.6 + (i % 3) * 0.35; ctx.fillStyle = "rgba(255,255,255," + (0.55 + (i % 3) * 0.15) + ")"; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); }
    }
    if (kind === "swamp") { // 低霧
      for (let i = 0; i < 4; i++) { const x = ((i * 97 + t * 4 * (i % 2 ? 1 : -1)) % 380 + 380) % 380 - 40, y = 60 + i * 90; glowFast(ctx, x, y, 46, "rgba(200,225,205,A)", 0.12); }
    }
    if (Gd.kit && Gd.kit.ambient) { ctx.save(); Gd.kit.ambient(ctx, t, Gd.kitH); ctx.restore(); }   // 區域套件的環境粒子（自己決定混色模式）
    ctx.drawImage(Gd.vignette, 0, 0, 300, 400);
  };

  // ═════ 畫面小元件（index.html 的 draw() 用）
  // 怪物頭頂高度（血條、狀態圖示、標籤放這裡）：精靈檔有 ART.enemyHeight(type) 就用它
  const HEAD = { slime: 18, mini: 13, frog: 11, bat: 27, golem: 31, elite: 30, goblin: 26, splitter: 20, beMinion: 20, assassin: 26, priest: 28 };
  ART.headY = function (type) {
    if (typeof ART.enemyTop === "function") { const h = -ART.enemyTop(type); if (h > 0) return h + 2; }   // 精靈檔：身體頂端相對腳底的位移（負值）
    if (typeof ART.enemyHeight === "function") { const h = ART.enemyHeight(type); if (h > 0) return h + 3; }
    const TG = TGx(), b = TG.ENEMIES && TG.ENEMIES[type];
    return HEAD[type] || (b && b.boss ? 66 : b && b.fly ? 27 : 22);
  };
  // 血條：受傷才顯示、白底紅條
  ART.hpBar = function (ctx, x, y, w, f, col) {
    c = ctx; f = Math.max(0, Math.min(1, f)); const h = 3;
    rr(x - w / 2 - 1, y - 1, w + 2, h + 2, 1.8); paint("#f6f2ea", T.ol, 0.9);
    rr(x - w / 2, y, Math.max(0.6, w * f), h, 1.2); paint(col || "#e23a52", null);
    rr(x - w / 2, y, Math.max(0.6, w * f), h * 0.4, 1); paint("rgba(255,255,255,.35)", null);
  };
  // 狀態圖示（統一在頭上一排）：slow 雪花、frozen 冰塊、shield 字盾、seal 封印鎖、lock 冷卻沙漏
  ART.statusIcons = function (ctx, x, y, list, t) {
    c = ctx; const n = list.length, gap = 8.5;
    list.forEach((k, i) => {
      const cx = x + (i - (n - 1) / 2) * gap, cy = y;
      circ(cx, cy, 3.9); paint(k === "seal" ? "#3a2416" : k === "shield" ? "#1d3a5e" : "#183048", T.ol, 0.8);
      c.lineCap = "round";
      if (k === "slow" || k === "frozen") {
        c.strokeStyle = "#bfe8ff"; c.lineWidth = 0.9;
        for (let j = 0; j < 3; j++) { const a = j * Math.PI / 3 + (k === "slow" ? t * 0.8 : 0); c.beginPath(); c.moveTo(cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6); c.lineTo(cx - Math.cos(a) * 2.6, cy - Math.sin(a) * 2.6); c.stroke(); }
        if (k === "frozen") { circ(cx, cy, 3.9); c.strokeStyle = "#e8f8ff"; c.lineWidth = 0.9; c.stroke(); }
      } else if (k === "shield") {
        c.beginPath(); c.moveTo(cx - 2.4, cy - 2.4); c.lineTo(cx + 2.4, cy - 2.4); c.lineTo(cx + 2.2, cy + 0.4); c.quadraticCurveTo(cx, cy + 3, cx, cy + 3); c.quadraticCurveTo(cx - 2.2, cy + 0.4, cx - 2.4, cy - 2.4); c.closePath(); paint("#7cc8ff", null);
      } else if (k === "seal") {
        rr(cx - 2.2, cy - 0.6, 4.4, 3.2, 0.6); paint(T.gold, null);
        c.beginPath(); c.arc(cx, cy - 0.8, 1.6, Math.PI, 0); c.strokeStyle = T.gold; c.lineWidth = 0.9; c.stroke();
      } else if (k === "lock") {
        poly([[cx - 2, cy - 2.6], [cx + 2, cy - 2.6], [cx - 2, cy + 2.6], [cx + 2, cy + 2.6]]); c.strokeStyle = "#f3d494"; c.lineWidth = 0.9; c.stroke();
      }
    });
  };
  // 文字標籤（字盾單字中文、改錯、be 小怪的答案）
  ART.tag = function (ctx, text, x, y, kind, size) {
    c = ctx; size = size || 9;
    const sty = { word: ["#123049", "#9bd4ff", "#e2f3ff"], fix: ["#4a1420", "#ff8a9a", "#ffe2e6"], label: ["#3a2c08", "#f3d494", "#fff6c2"], dark: ["#0c1122", "#6c8296", "#e8eef4"] }[kind || "dark"] || ["#0c1122", "#6c8296", "#fff"];
    c.font = "bold " + size + "px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    const w = c.measureText(text).width + 8, h = size + 4;
    const xx = Math.max(w / 2 + 1, Math.min(300 - w / 2 - 1, x));
    rr(xx - w / 2, y - h / 2, w, h, h / 2); paint(sty[0], sty[1], 0.9);
    c.fillStyle = sty[2]; c.fillText(text, xx, y + 0.5);
  };
  // 魔王：畫面頂部大血條＋名牌（x 50～250、y 起點 y0，高約 26；和 bosses.ui.js 的狀態列同一區）
  ART.bossBar = function (ctx, name, f, y0, t, opt) {
    c = ctx; opt = opt || {}; f = Math.max(0, Math.min(1, f));
    const x0 = 50, w = 200;
    rr(x0, y0, w, 26, 5); paint("rgba(12,17,34,.88)", T.gold, 1);
    c.font = "900 9.5px " + T.labelFamily; c.textAlign = "center"; c.textBaseline = "middle";
    const tw = c.measureText(name).width;
    const cx = 150 - 6;
    poly([[cx - tw / 2 - 12, y0 + 11], [cx - tw / 2 - 12, y0 + 5], [cx - tw / 2 - 9.8, y0 + 8], [cx - tw / 2 - 7.8, y0 + 4.4], [cx - tw / 2 - 5.8, y0 + 8], [cx - tw / 2 - 3.6, y0 + 5], [cx - tw / 2 - 3.6, y0 + 11]]); paint(T.gold, T.ol, 0.6);
    c.fillStyle = T.goldL; c.fillText(name, cx + 2, y0 + 8.4);
    if (opt.sub) { c.font = "bold 7px system-ui,sans-serif"; c.textAlign = "right"; c.fillStyle = opt.subCol || "#a9c0cb"; c.fillText(opt.sub, x0 + w - 6, y0 + 8.4); }
    const bx = x0 + 6, bw = w - 12, by = y0 + 15.5;
    rr(bx - 1, by - 1, bw + 2, 7, 3); paint("#f6f2ea", T.ol, 0.9);
    rr(bx, by, Math.max(1, bw * f), 5, 2.4); paint(opt.col || "#e23a52", null);
    rr(bx, by, Math.max(1, bw * f), 2, 1.5); paint("rgba(255,255,255,.35)", null);
    if (opt.marks) for (const m of opt.marks) { rr(bx + bw * m - 0.5, by - 1, 1.2, 7, 0); paint(T.ol, null); }
  };
  // 地雷（砲塔分支）
  ART.mine = function (ctx, x, y, t) {
    c = ctx; shadow(x + 0.6, y + 1.4, 4, 1.6, 0.4);
    ell(x, y, 3.6, 2.4); paint("#3a3f4a", T.ol, 0.8); ell(x - 0.8, y - 0.8, 1.4, 0.7); paint("rgba(255,255,255,.3)", null);
    const a = 0.5 + 0.5 * Math.sin(t * 8 + x); glowFast(ctx, x, y - 2.2, 4, "rgba(255,110,50,A)", a); circ(x, y - 2.2, 0.9); paint("#ff7a3c", null);
  };
  // 英雄移動目標旗
  ART.moveFlag = function (ctx, x, y, t) {
    c = ctx; ell(x, y + 1, 4, 1.6); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
    c.strokeStyle = T.ol; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x, y - 10); c.stroke();
    const w = Math.sin(t * 5) * 0.8; c.beginPath(); c.moveTo(x, y - 10); c.quadraticCurveTo(x + 4, y - 9.5 + w, x + 7, y - 8 + w); c.quadraticCurveTo(x + 4, y - 7 + w, x, y - 5.6); c.closePath(); paint("#6ac8ff", T.ol, 0.6);
  };
  // HUD／按鈕用的內嵌 SVG（樣稿 B 的 icons.js；顏色吃 CSS 變數 --ol --gold --goldD --red --blue --stone）
  const SVG = {
    wave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3" stroke="var(--ol)" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4c4-2 7 2 12 0v9c-5 2-8-2-12 0z" fill="var(--blue)" stroke="var(--ol)" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 7.5l2 2 4-3.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    castle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9h3v2h2V9h3v2h2V9h3v2h2V9h3v12h-7v-5a2 2 0 0 0-4 0v5z" fill="var(--stone)" stroke="var(--ol)" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 3v4" stroke="var(--ol)" stroke-width="1.5"/><path d="M12 3l4 1-4 1.6z" fill="var(--red)" stroke="var(--ol)" stroke-width="1"/></svg>',
    coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12.5" r="8.5" fill="var(--goldD)" stroke="var(--ol)" stroke-width="1.8"/><circle cx="12" cy="11.5" r="7.5" fill="var(--goldA)"/><path d="M12 7v9M9.5 9.2c.6-1.4 4.8-1.6 4.9.5.1 2-4.9 1.2-4.9 3.6 0 2 4.6 1.9 5.2.4" fill="none" stroke="var(--goldD)" stroke-width="1.6" stroke-linecap="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2L5 13.5h6L9.5 22 19 9.8h-6.2z" fill="var(--goldA)" stroke="var(--ol)" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c-4.4 0-7-3-7-6.6 0-3.8 3.2-5.6 4-9.4 2.4 1.6 3 3.6 2.8 5.2C13 9.6 14 7.4 13.6 4c3.6 2.6 5.4 6.6 5.4 11 0 4-2.8 7-7 7z" fill="var(--red)" stroke="var(--ol)" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 20c-1.8 0-3-1.2-3-2.8 0-1.8 1.6-2.6 2.2-4.4 1.6 1.2 3.8 2.6 3.8 4.6 0 1.6-1.2 2.6-3 2.6z" fill="var(--goldA)"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    sword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 3.5l-9.8 9.8 1 1 9.8-9.8.3-1.3z" fill="#eef4fa" stroke="var(--ol)" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 13.2l4.3 4.3M8 17.6l-3.6 3.6" stroke="var(--ol)" stroke-width="2.6" stroke-linecap="round"/><path d="M6.5 13.2l4.3 4.3" stroke="var(--goldA)" stroke-width="1.4" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="var(--ol)" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    speed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l8 6-8 6zM12 6l8 6-8 6z" fill="currentColor" stroke="var(--ol)" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  };
  ART.svg = k => SVG[k] || "";

  // ═════ 精靈檔沒提供時的簡易替代（不用 emoji；精靈檔完成後自動被它取代）
  const TOWER_COL = { arrow: "#d9a441", mage: "#9b6cff", ice: "#5fb6f0", cannon: "#e8734a" };
  if (!ART.tower) ART.tower = function (ctx, type, lv, branch, x, y, t, st) {
    c = ctx; st = st || {}; lv = lv || 1;
    const col = TOWER_COL[type] || "#c9a45a", stoneLv = lv >= 3;
    shadow(x + 1.5, y + 2.5, 14, 5.5);
    cyl(x, y + 2, stoneLv ? 13 : 11.5, stoneLv ? 5 : 4, sideGrad(x, 12, ...(stoneLv ? T.stone : T.plank)), stoneLv ? T.stoneTop : T.plankTop);
    const h = 14 + Math.min(lv, 6) * 3, w = stoneLv ? 8 : 7;
    rr(x - w, y - 2 - h, w * 2, h, 2.5); paint(lg(x - w, 0, x + w, 0, [col, col, "#2a2438"]));
    rr(x - 1.5, y - h + 2, 3, 5, 1.5); paint(T.slit, null);
    if (stoneLv) { poly([[x - w - 3, y - 2 - h], [x, y - 2 - h - 13], [x + w + 3, y - 2 - h]]); paint(sideGrad(x, w + 3, ...T.roofA)); }
    else { rr(x - w - 2, y - 5 - h, w * 2 + 4, 4, 1); paint(T.wood); }
    if (lv >= 4) { c.strokeStyle = T.ol; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y - 15 - h); c.lineTo(x, y - 25 - h); c.stroke(); poly([[x, y - 25 - h], [x + 7, y - 23 - h], [x, y - 21 - h]]); paint(branch === "B" ? "#6ac8ff" : T.flagRed, T.ol, 0.6); }
    if (st.firing > 0) glow(x, y - h - 4, 10, "rgba(255,230,150,A)", 0.6 * st.firing);
    for (let i = 0; i < lv; i++) star(x + (i - (lv - 1) / 2) * 5.4, y + 10.5, 2.3, T.gold);
    if (st.sealed) { ell(x, y - h / 2, 13, h / 2 + 6); c.fillStyle = "rgba(40,20,10,.5)"; c.fill(); }
  };
  if (!ART.enemy) ART.enemy = function (ctx, type, x, y, t, st) {
    c = ctx; st = st || {}; const TG = TGx(), b = (TG.ENEMIES && TG.ENEMIES[type]) || {};
    const s = b.boss ? 2.4 : { golem: 1.3, elite: 1.25, goblin: 1.15, mini: 0.7, frog: 0.6, splitter: 1.1 }[type] || 1;
    const by = b.fly ? y - 13 : y, bob = Math.sin(t * 6 + x) * 0.6;
    shadow(x, y + 0.8, 8 * s, 2.8 * s, b.fly ? 0.3 : null);
    if (b.boss) { ell(x, y + 1, 26, 10); c.strokeStyle = "#f7ce83"; c.lineWidth = 1.2; c.stroke(); }
    if (b.fly) { for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * 3, by - 2); c.quadraticCurveTo(x + sd * 10, by - 10 + bob * 3, x + sd * 15, by - 5); c.lineTo(x + sd * 9, by + 1); c.closePath(); paint("#5a3488"); } }
    const body = type === "golem" ? () => rr(x - 8.5 * s / 1.3, by - 20 * s / 1.3 + bob, 17 * s / 1.3, 18 * s / 1.3, 3) : () => { c.beginPath(); c.moveTo(x - 8.5 * s, by); c.bezierCurveTo(x - 9.5 * s, by - 8 * s, x - 4.5 * s, by - 13.5 * s + bob, x, by - 13.5 * s + bob); c.bezierCurveTo(x + 4.5 * s, by - 13.5 * s + bob, x + 9.5 * s, by - 8 * s, x + 8.5 * s, by); c.closePath(); };
    body(); paint(st.flash > 0.3 ? "#ffffff" : type === "golem" ? "#8a86a0" : b.boss ? "#6a3a7a" : "#9a52d0");
    if (st.frozen) { body(); c.fillStyle = "rgba(160,215,255,.45)"; c.fill(); }
    const ey = by - 7 * s + bob; for (const sd of [-1, 1]) { glow(x + sd * 2.6 * s, ey, 3 * s, T.eyeGlow, 0.6); ell(x + sd * 2.6 * s, ey, 1.2 * s, 1.4 * s); paint(T.enemyEye, null); }
    if (st.shield) { c.beginPath(); c.arc(x, by - 7 * s, 11 * s, 0, PI2); c.strokeStyle = "rgba(124,200,255,.8)"; c.lineWidth = 1.4; c.stroke(); }
  };
  if (!ART.hero) ART.hero = function (ctx, id, x, y, t, st) {
    c = ctx; st = st || {};
    ell(x, y + 1, 11, 4.2); c.strokeStyle = st.sel ? "#ffffff" : "#6ac8ff"; c.lineWidth = st.sel ? 1.6 : 1.2; c.stroke(); c.fillStyle = "rgba(106,200,255,.18)"; c.fill();
    shadow(x, y + 1, 7, 2.6);
    const col = st.color || { knight: "#2c4f86", elf: "#3f8a5a", mage: "#6a4ab0", dragon: "#c0503a" }[id] || "#2c4f86";
    c.beginPath(); c.moveTo(x - 4, y - 12); c.quadraticCurveTo(x - 8, y - 4, x - 6.5, y); c.lineTo(x + 6.5, y); c.quadraticCurveTo(x + 8, y - 4, x + 4, y - 12); c.closePath(); paint(col);
    rr(x - 4.5, y - 13, 9, 11, 2.5); paint(sideGrad(x, 4.5, "#eef2f6", "#aab8c8", "#6a7a8e"));
    circ(x, y - 16.5, 4.6); paint(sideGrad(x, 4.6, "#eef2f6", "#aab8c8", "#6a7a8e"));
    rr(x - 3.2, y - 17, 6.4, 1.5, 0.6); paint(T.pupil, null);
    c.save(); c.translate(x + 6, y - 9); c.rotate(0.55 - (st.attack || 0) * 1.2); rr(-0.9, -13, 1.8, 12, 0.6); paint("#e8f0f8", T.ol, 0.6); rr(-2.8, -1.4, 5.6, 1.6, 0.6); paint(T.gold, T.ol, 0.5); c.restore();
  };
  if (!ART.summon) ART.summon = function (ctx, id, evolved, x, y, t) {
    c = ctx; const col = { fox: "#ff8a3d", wolf: "#8fa6c8", turtle: "#6aa84f", phoenix: "#9bd8ff", unicorn: "#f4e8ff" }[id] || "#c8a8ff";
    shadow(x, y + 1, 9, 3);
    if (evolved) glow(x, y - 8, 14, "rgba(255,230,150,A)", 0.4);
    if (id === "turtle") { c.beginPath(); c.moveTo(x - 10, y); c.quadraticCurveTo(x - 9, y - 12, x, y - 12); c.quadraticCurveTo(x + 9, y - 12, x + 10, y); c.closePath(); paint(col); circ(x + 11, y - 4, 3.4); paint("#9ccf6a"); return; }
    for (const sd of [-1, 1]) { poly([[x + sd * 2, y - 12], [x + sd * 6, y - 19], [x + sd * 7, y - 10]]); paint(col); }
    ell(x, y - 7, 8, 7); paint(col);
    for (const sd of [-1, 1]) { circ(x + sd * 2.8, y - 8, 1.1); paint(T.ol, null); }
  };
  if (!ART.proj) ART.proj = function (ctx, kind, x1, y1, x2, y2, t) {
    c = ctx; const a = Math.atan2(y2 - y1, x2 - x1);
    if (kind === "arrow") { c.save(); c.translate(x2, y2); c.rotate(a); c.strokeStyle = T.ol; c.lineWidth = 1.7; c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, 0); c.stroke(); c.strokeStyle = T.woodLight; c.lineWidth = 0.8; c.stroke(); poly([[1.8, 0], [-1.2, -1.4], [-1.2, 1.4]]); paint("#e8eef2", T.ol, 0.5); c.restore(); return; }
    if (kind === "ice") { glow(x2, y2, 7, "rgba(120,200,255,A)", 0.7); circ(x2, y2, 2.2); paint("#eaf8ff", T.ol, 0.6); return; }
    if (kind === "ball" || kind === "fire") { if (kind === "fire") glow(x2, y2, 8, "rgba(255,140,50,A)", 0.7); circ(x2, y2, 2.8); paint(kind === "fire" ? "#ff8a3a" : "#2a3038", T.ol, 0.7); circ(x2 - 0.8, y2 - 0.8, 0.8); paint("rgba(255,255,255,.6)", null); return; }
    glow(x2, y2, 7, "rgba(170,130,255,A)", 0.8); circ(x2, y2, 2.4); paint("#ffffff", null);
  };
  if (!ART.icon) ART.icon = function (canvas, kind, id, lv) {
    const g = canvas.getContext("2d"), W = canvas.width, Hh = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, Hh);
    if (kind === "tower") { const s = Math.min(W / 44, Hh / 70); g.setTransform(s, 0, 0, s, (W - 44 * s) / 2, (Hh - 70 * s) / 2); ART.tower(g, id, lv || 1, null, 22, 56, 0, {}); return; }
    const s = Math.min(W, Hh) / 40; g.setTransform(s, 0, 0, s, (W - 40 * s) / 2, (Hh - 40 * s) / 2);
    if (kind === "enemy") { const b = (TGx().ENEMIES || {})[id] || {}; if (b.boss) { g.translate(20, 34); g.scale(0.45, 0.45); g.translate(-20, -34); } ART.enemy(g, id, 20, 34, 0, {}); }
    else if (kind === "hero") ART.hero(g, id, 20, 35, 0, {});
    else ART.summon(g, id, (lv || 1) >= ((TGx().EVO_LV) || 99), 20, 34, 0);
  };
})(typeof window !== "undefined" ? window : globalThis);
