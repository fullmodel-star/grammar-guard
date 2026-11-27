// 區域套件：魔龍火山（REGION 4）— 第二刀。介面見 art/CONTRACT.md「第二刀」與 art/art-map.js 的 ART.REGION_KITS 說明。
// 地景：灰燼地面（降飽和、亮一階，墨紫色怪在上面才清楚）、發光熔岩河＋熔岩池（ambient 亮度脈動＋流光）、遠景冒煙火山口、
//       玄武岩柱群、黑曜石、焦黑樹、龍骨、巨爪痕、路邊發光裂縫；出怪口＝熔岩裂谷洞；右側＝黑曜石＋金飾的最後防線要塞（側門朝左）。
// 規則：全部自繪向量；裝飾熔岩一律離塔位中心 ≥ 24（岩漿封塔位機制只畫在塔位上，玩家不會把裝飾當成機制）；
//       城牆血量牌／裂痕／旗子／火把由 castleOverlay 依 L 座標畫，本檔造型對齊那些位置（旗桿底 L.flags、火把 L.torches、裂痕 L.cracks）。
(function () {
  "use strict";
  const ART = window.ART = window.ART || {};
  ART.REGION_KITS = ART.REGION_KITS || {};
  const PI2 = Math.PI * 2, HY = Math.hypot;

  // ═════ 配色（火山專用；描邊沿用主題 T.ol / T.olw）
  const C = {
    ground: ["#664643", "#533836", "#3b272a"], ashL: "rgba(196,176,164,.12)", ashD: "rgba(16,6,6,.30)",
    speck: ["#75605b", "#4c3b3b", "#87716a", "#3e3032"], hair: "rgba(18,8,8,.42)",
    stone: ["#6c6070", "#4f4554", "#352e3a"], stoneTop: "#857a88", mortar: "rgba(10,6,14,.55)",
    obs: ["#433a54", "#272033", "#15111d"], obsHi: "rgba(200,210,255,.6)",
    basalt: ["#5a4a54", "#3e333c", "#251e25"], basaltTop: ["#9a8a90", "#6e5e66"],
    lava: ["#fff3b0", "#ffc24c", "#ff7c24", "#d2400f", "#6a1a08"], crust: "rgba(58,18,10,.85)",
    bone: "#e4d8c2", boneD: "#a8977e", char: "#201618", charL: "#3a2a2a",
    gold: "#E1B86A", goldL: "#F3D494", goldD: "#8e6a2e"
  };

  // 小工具：取 H 的繪圖函式
  const F = H => H.f;
  const ol = H => H.T.ol, olw = H => H.T.olw;
  function free(H, x, y, o) {   // o：{ road, slot, zone, water, river, occ }
    const P = H.P;
    if (P.distRoad(x, y) < (o.road == null ? 18 : o.road)) return false;
    if (P.slotNear(x, y, o.slot == null ? 19 : o.slot)) return false;
    if (P.inZone(x, y, o.zone == null ? 2 : o.zone)) return false;
    if (P.distWater(x, y) < (o.water == null ? 7 : o.water)) return false;
    const V = H.vol;
    if (V && riverDist(V, x, y) < (o.river == null ? 9 : o.river)) return false;
    if (V && V.occ.some(q => HY(q[0] - x, q[1] - y) < q[2] + (o.occ || 0))) return false;
    if (V && V.labels.some(b => x > b[0] && x < b[2] && y > b[1] && y < b[3])) return false;
    return true;
  }
  function segD(x1, y1, x2, y2, x, y) { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0; return HY(x - x1 - dx * t, y - y1 - dy * t); }
  function riverDist(V, x, y) { let d = 1e9; for (const r of V.rivers) for (let i = 1; i < r.length; i++) d = Math.min(d, segD(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1], x, y)); return d; }
  function smoothPath(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]); }
  function sampleSmooth(pts, step) {   // 取樣平滑曲線（環境流光用）
    const out = []; const q = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) q.push(pts[i], [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]);
    q.push(pts[pts.length - 1]);
    let px = q[0][0], py = q[0][1]; out.push([px, py]);
    const put = (x, y) => { if (HY(x - px, y - py) >= step) { out.push([x, y]); px = x; py = y; } };
    for (let i = 1; i + 1 < q.length; i += 2) { const a = q[i - 1], b = q[i], e = q[i + 1]; for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; put(u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1]); } }
    if (q.length % 2 === 0) { const l = q[q.length - 1]; put(l[0], l[1]); }
    return out;
  }
  function mk(w, h) { if (typeof document === "undefined") return null; const k = document.createElement("canvas"); k.width = Math.max(1, w); k.height = Math.max(1, h); return k; }
  function softSprite(col, size) { const k = mk(size, size); if (!k) return null; const g = k.getContext("2d"), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, col.replace("A", 1)); gr.addColorStop(0.45, col.replace("A", 0.42)); gr.addColorStop(1, col.replace("A", 0)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return k; }

  // ═════ 地面：灰燼（重畫整張地面，取代通用的紅褐草地與熔岩縫）
  function drawAshGround(H) {
    const c = H.c, f = F(H), P = H.P, R = H.R;
    c.fillStyle = f.lg(0, 0, 0, 400, C.ground); c.fillRect(0, 0, 300, 400);
    for (let i = 0; i < 30; i++) { const x = R() * 300, y = R() * 400, r = 16 + R() * 36; f.circ(x, y, r); c.fillStyle = f.rg(x, y, 0, r, i % 3 ? [C.ashL, "rgba(0,0,0,0)"] : [C.ashD, "rgba(0,0,0,0)"]); c.fill(); }
    for (let i = 0; i < 12; i++) { const x = R() * 300, y = R() * 400, r = 22 + R() * 30; f.circ(x, y, r); c.fillStyle = f.rg(x, y, 0, r, ["rgba(170,56,30,.16)", "rgba(170,56,30,0)"]); c.fill(); }
    for (const e of P.entries) { f.circ(e.x, e.y, 120); c.fillStyle = f.rg(e.x, e.y, 0, 120, ["rgba(70,10,4,.45)", "rgba(70,10,4,0)"]); c.fill(); }
    { const [ex, ey] = P.end; f.circ(ex, ey, 120); c.fillStyle = f.rg(ex, ey, 0, 120, ["rgba(255,186,110,.12)", "rgba(255,186,110,0)"]); c.fill(); }
    // 頂端煙霾（遠景火山口在這裡）
    c.fillStyle = f.lg(0, 0, 0, 46, ["rgba(18,8,10,.42)", "rgba(18,8,10,0)"]); c.fillRect(0, 0, 300, 46);
    // 灰燼細點與碎石（取代草叢）
    for (let i = 0; i < 560; i++) {
      const x = R() * 300, y = R() * 400; if (P.distRoad(x, y) < 15.5) continue;
      c.fillStyle = C.speck[(R() * C.speck.length) | 0];
      if (R() < 0.7) c.fillRect(x, y, 0.7 + R() * 0.9, 0.5 + R() * 0.5);
      else { f.ell(x, y, 0.9 + R() * 0.9, 0.55 + R() * 0.4); c.fill(); }
    }
    // 乾裂的地紋（不發光，只是質感）
    c.lineCap = "round"; c.lineJoin = "round";
    for (let i = 0; i < 34; i++) {
      let x = R() * 300, y = R() * 400; if (P.distRoad(x, y) < 18) continue;
      c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (R() - 0.5) * 10; y += (R() - 0.5) * 8; c.lineTo(x, y); }
      c.strokeStyle = C.hair; c.lineWidth = 0.6; c.stroke();
    }
  }

  // ═════ 遠景火山口（畫面頂端邊緣，岩漿從口冒光、側面有熔岩流痕）
  function cone(H, cx, by, hw, py) {
    const c = H.c, f = F(H), hgt = by - py;
    const body = [[cx - hw, by], [cx - hw * 0.62, by - hgt * 0.42], [cx - hw * 0.3, py + 1.5], [cx - hw * 0.2, py], [cx + hw * 0.2, py], [cx + hw * 0.32, py + 1.5], [cx + hw * 0.66, by - hgt * 0.45], [cx + hw, by]];
    f.glow(cx, py, hw * 0.75, "rgba(255,110,40,A)", 0.32);
    f.poly(body); f.paint(f.lg(0, py, 0, by, ["#4c3b42", "#2c2228"]), ol(H), olw(H) * 0.8);
    f.poly([[cx + hw * 0.2, py], [cx + hw * 0.32, py + 1.5], [cx + hw * 0.66, by - hgt * 0.45], [cx + hw, by], [cx + hw * 0.2, by]]); f.paint("rgba(10,4,8,.32)", null);
    f.poly([[cx - hw * 0.2, py], [cx - hw * 0.3, py + 1.5], [cx - hw * 0.5, by - hgt * 0.3], [cx - hw * 0.38, by - hgt * 0.36]]); f.paint("rgba(170,140,140,.18)", null);
    // 火山口
    f.ell(cx, py + 0.6, hw * 0.2, 1.9); f.paint(f.lg(0, py - 1, 0, py + 2.5, [C.lava[1], C.lava[3]]), ol(H), olw(H) * 0.7);
    f.ell(cx - hw * 0.04, py + 0.2, hw * 0.1, 0.7); f.paint(C.lava[0], null);
    // 側面熔岩流痕
    c.lineCap = "round";
    for (const [s, k] of [[-1, 0.55], [1, 0.35]]) {
      const pts = [[cx + s * hw * 0.08, py + 1.5], [cx + s * hw * 0.2, py + hgt * 0.35], [cx + s * hw * k, py + hgt * 0.7], [cx + s * hw * (k + 0.06), by - 1]];
      f.poly(pts, false); c.strokeStyle = "rgba(255,110,30,.3)"; c.lineWidth = 3; c.stroke();
      f.poly(pts, false); c.strokeStyle = C.lava[2]; c.lineWidth = 1; c.stroke();
      f.poly(pts.slice(0, 3), false); c.strokeStyle = C.lava[1]; c.lineWidth = 0.4; c.stroke();
    }
  }

  // ═════ 熔岩河＋熔岩池
  function planLava(H) {
    const P = H.P, V = H.vol, o = P.ponds[0];
    if (!o) return;
    V.pool = o;
    // 流進池子（從左邊界）＋流出（往下邊界）；每點都要離路 ≥ 24、離塔位 ≥ 26，不合格的那條就不畫
    const inR = [[-6, o.y - 46], [6, o.y - 36], [o.x - o.rx * 0.78, o.y - 22], [o.x - o.rx * 0.55, o.y - 6]];
    const outR = [[o.x + o.rx * 0.5, o.y + 6], [o.x + o.rx * 0.7, o.y + 24], [o.x + o.rx * 0.62, o.y + 46], [o.x + o.rx * 0.95, o.y + 66], [o.x + o.rx * 0.8, 406]];
    const ok = r => r.every(([x, y]) => P.distRoad(x, y) >= 24 && !P.slotNear(x, y, 26) && !P.inZone(x, y, 4));
    if (o.y - 46 > 236 && ok(inR)) V.rivers.push(inR);
    if (o.y + 46 < 380 && ok(outR)) V.rivers.push(outR);
  }
  function drawRiver(H, pts) {
    const c = H.c, f = F(H);
    c.lineCap = "round"; c.lineJoin = "round";
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [w, a] of [[26, 0.07], [17, 0.09], [11, 0.12]]) { smoothPath(c, pts); c.strokeStyle = "rgba(255,90,24," + a + ")"; c.lineWidth = w; c.stroke(); }
    c.restore();
    smoothPath(c, pts); c.strokeStyle = ol(H); c.lineWidth = 11.5; c.stroke();
    smoothPath(c, pts); c.strokeStyle = "#2c1c1c"; c.lineWidth = 9.4; c.stroke();
    smoothPath(c, pts); c.strokeStyle = C.lava[3]; c.lineWidth = 6.6; c.stroke();
    smoothPath(c, pts); c.strokeStyle = C.lava[2]; c.lineWidth = 4.4; c.stroke();
    smoothPath(c, pts); c.strokeStyle = C.lava[1]; c.lineWidth = 2; c.stroke();
    c.setLineDash([3, 5]); smoothPath(c, pts); c.strokeStyle = C.lava[0]; c.lineWidth = 0.8; c.stroke(); c.setLineDash([]);
    // 漂浮的冷卻岩殼
    const s = sampleSmooth(pts, 7), R = H.R;
    for (let i = 2; i < s.length - 1; i += 2) { if (R() < 0.45) continue; const [x, y] = s[i]; f.ell(x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, 1.4 + R() * 1.2, 0.8 + R() * 0.5, R() * 3); f.paint(C.crust, null); }
    // 岸邊碎石
    for (let i = 1; i < s.length; i += 3) { const [x, y] = s[i], a = R() * PI2; const rx = x + Math.cos(a) * 7, ry = y + Math.sin(a) * 4 + 2; if (H.P.distRoad(rx, ry) > 16 && !H.P.slotNear(rx, ry, 18) && R() < 0.5) f.rock(rx, ry, 0.38 + R() * 0.2, R); }
  }
  function drawPool(H, o) {
    const c = H.c, f = F(H), R = H.R, { x, y, rx, ry } = o;
    f.glow(x, y, rx * 1.7, "rgba(255,100,30,A)", 0.4);
    f.ell(x + 1, y + 2, rx + 4, ry + 3.6); f.paint("rgba(0,0,0,.3)", null);
    f.ell(x, y, rx + 3.4, ry + 3); f.paint(f.lg(0, y - ry - 3, 0, y + ry + 3, ["#4a3434", "#241818"]), ol(H), olw(H));
    f.ell(x, y + 0.4, rx, ry); f.paint(f.lg(0, y - ry, 0, y + ry, [C.lava[0], C.lava[1], C.lava[2], C.lava[3]]), ol(H), olw(H) * 0.7);
    // 岩殼板塊（中間有發光縫）
    for (let i = 0; i < 6; i++) {
      const a = R() * PI2, d = 0.25 + R() * 0.5, px = x + Math.cos(a) * rx * d, py = y + Math.sin(a) * ry * d, s = 2.4 + R() * 3;
      const pts = []; for (let k = 0; k < 5; k++) { const b = k * PI2 / 5 + R() * 0.5; pts.push([px + Math.cos(b) * s, py + Math.sin(b) * s * 0.45]); }
      f.poly(pts); f.paint(C.crust, "rgba(255,220,140,.55)", 0.4);
    }
    // 冒泡
    for (let i = 0; i < 4; i++) { const bx = x - rx * 0.55 + i * rx * 0.36 + R() * 3, by = y - ry * 0.25 + (i % 2) * ry * 0.4; f.ell(bx, by, 1.4, 0.8); f.paint(null, C.lava[0], 0.6); }
    f.ell(x - rx * 0.4, y - ry * 0.45, rx * 0.28, ry * 0.16, -0.1); f.paint("rgba(255,250,215,.55)", null);
    // 岸邊石頭
    for (let i = 0; i < 6; i++) { const a = i * PI2 / 6 + 0.5; f.rock(x + Math.cos(a) * (rx + 4), y + Math.sin(a) * (ry + 3) + 2, 0.45 + R() * 0.25, R); }
  }
  // 預先畫好熔岩發光層（ambient 每幀只貼一次、改亮度＝脈動）
  function buildGlowLayer(V) {
    const shapes = V.rivers.slice(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const r of shapes) for (const [x, y] of r) grow(x, y, 12);
    if (V.pool) grow(V.pool.x, V.pool.y, V.pool.rx + 10);
    for (const cm of V.claws) grow(cm.x, cm.y, 22);
    if (x0 > x1) return;
    x0 = Math.max(-2, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(302, Math.ceil(x1)); y1 = Math.min(402, Math.ceil(y1));
    const K = 1.5, k = mk(Math.ceil((x1 - x0) * K), Math.ceil((y1 - y0) * K)); if (!k) return;
    const g = k.getContext("2d"); g.setTransform(K, 0, 0, K, -x0 * K, -y0 * K); g.lineCap = "round"; g.lineJoin = "round";
    for (const r of shapes) { smoothPath(g, r); g.strokeStyle = "rgba(255,120,40,.55)"; g.lineWidth = 9; g.stroke(); smoothPath(g, r); g.strokeStyle = "rgba(255,210,120,.7)"; g.lineWidth = 3; g.stroke(); }
    if (V.pool) { const o = V.pool; g.beginPath(); g.ellipse(o.x, o.y, o.rx + 2, o.ry + 2, 0, 0, PI2); const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.rx + 2); gr.addColorStop(0, "rgba(255,220,130,.75)"); gr.addColorStop(1, "rgba(255,110,40,.25)"); g.fillStyle = gr; g.fill(); }
    for (const cm of V.claws) for (const p of cm.lines) { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = "rgba(255,150,60,.6)"; g.lineWidth = 2.4; g.stroke(); }
    V.glow = { k, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ═════ 巨爪痕（三道彎曲深溝，底部有熔岩光；溫和不血腥）
  function planClaws(H) {
    const V = H.vol, cands = [[205, 150], [200, 130], [208, 175], [100, 140], [195, 320]];
    for (const [x, y] of cands) if (free(H, x, y, { road: 34, slot: 40, river: 30 })) { V.claws.push(mkClaw(x, y, -0.55)); V.occ.push([x, y, 24]); return; }
  }
  function mkClaw(cx, cy, rot) {
    const lines = [], ca = Math.cos(rot), sa = Math.sin(rot);
    for (let i = -1; i <= 1; i++) { const p = []; for (let k = 0; k <= 6; k++) { const t = k / 6, lx = i * 7 + Math.sin(t * Math.PI) * 3, ly = -15 + t * 30; p.push([cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]); } lines.push(p); }
    return { x: cx, y: cy, lines };
  }
  function drawClaw(H, cm) {
    const c = H.c; c.lineCap = "round"; c.lineJoin = "round";
    for (const p of cm.lines) {
      const seg = (w, col) => { for (let i = 1; i < p.length; i++) { const t = Math.sin(i / p.length * Math.PI); c.beginPath(); c.moveTo(p[i - 1][0], p[i - 1][1]); c.lineTo(p[i][0], p[i][1]); c.strokeStyle = col; c.lineWidth = Math.max(0.3, w * (0.35 + t)); c.stroke(); } };
      seg(5.2, "rgba(150,120,110,.35)");   // 被掀起的亮邊
      seg(4.2, ol(H)); seg(3, "#1e1214"); seg(1.5, C.lava[3]); seg(0.6, C.lava[1]);
    }
  }

  // ═════ 裝飾物件
  function basaltCluster(H, x, y, s, R) {   // 玄武岩柱群：緊靠的六角柱，高低錯落、平頂較亮
    const c = H.c, f = F(H), w = 2.9 * s, hh = 1.5 * s;
    f.shadow(x + 3 * s, y + 1.5, 10 * s, 3.2 * s);
    const cols = [], n = 4 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const back = i % 2 === 1;
      cols.push({ cx: x + (i - (n - 1) / 2) * w * 1.5, by: y + (back ? -hh * 1.6 : 0), h: (back ? 11 : 6) * s + R() * 6 * s + (i === 1 || i === 2 ? 3 * s : 0) });
    }
    cols.sort((p, q) => p.by - q.by);
    for (const k of cols) {
      const { cx, by } = k, top = by - k.h;
      const face = (pts, col) => { f.poly(pts); f.paint(col, null); };
      face([[cx - w, top], [cx - w / 2, top + hh], [cx - w / 2, by + hh], [cx - w, by]], C.basalt[2]);
      face([[cx - w / 2, top + hh], [cx + w / 2, top + hh], [cx + w / 2, by + hh], [cx - w / 2, by + hh]], C.basalt[1]);
      face([[cx + w / 2, top + hh], [cx + w, top], [cx + w, by], [cx + w / 2, by + hh]], C.basalt[0]);
      f.poly([[cx - w, top], [cx - w, by], [cx - w / 2, by + hh], [cx + w / 2, by + hh], [cx + w, by], [cx + w, top]]); f.paint(null, ol(H), olw(H) * 0.8);
      c.beginPath(); c.moveTo(cx - w / 2, top + hh); c.lineTo(cx - w / 2, by + hh); c.moveTo(cx + w / 2, top + hh); c.lineTo(cx + w / 2, by + hh); c.strokeStyle = "rgba(8,4,8,.5)"; c.lineWidth = 0.45; c.stroke();
      c.beginPath(); c.moveTo(cx - w * 0.75, by + hh * 0.4); c.lineTo(cx - w * 0.75, by - k.h * 0.4); c.strokeStyle = "rgba(255,120,50,.5)"; c.lineWidth = 0.6; c.stroke();   // 熔岩反光
      f.poly([[cx - w, top], [cx - w / 2, top - hh], [cx + w / 2, top - hh], [cx + w, top], [cx + w / 2, top + hh], [cx - w / 2, top + hh]]); f.paint(f.lg(0, top - hh, 0, top + hh, C.basaltTop), ol(H), olw(H) * 0.7);
    }
  }
  function obsidian(H, x, y, s, R) {   // 黑曜石碎晶：黑紫亮面＋冷白反光
    const c = H.c, f = F(H);
    f.shadow(x + 1, y + 0.5, 5 * s, 1.8 * s);
    for (let k = 0; k < 3; k++) {
      const cx = x + (k - 1) * 2.8 * s, h = (k === 1 ? 7.5 : 4.5 + R() * 1.5) * s, w = 1.8 * s, a = (k - 1) * 0.38;
      c.save(); c.translate(cx, y); c.rotate(a);
      f.poly([[-w, 0], [-w * 0.8, -h * 0.7], [0, -h], [w, -h * 0.6], [w, 0]]); f.paint(C.obs[1], ol(H), olw(H) * 0.6);
      f.poly([[0, 0], [0, -h], [w, -h * 0.6], [w, 0]]); f.paint(C.obs[2], null);
      c.beginPath(); c.moveTo(-w * 0.55, -h * 0.15); c.lineTo(-w * 0.4, -h * 0.68); c.lineTo(-0.1, -h * 0.92); c.strokeStyle = C.obsHi; c.lineWidth = 0.5; c.stroke();
      c.restore();
    }
  }
  function charTree(H, x, y, s, R) {   // 焦黑樹：扭曲枝幹、枝梢餘燼
    const c = H.c, f = F(H);
    f.shadow(x + 2, y + 0.5, 6.5 * s, 2.3 * s);
    const lean = (R() - 0.5) * 2, br = [[0, 0, lean, -11], [lean, -11, lean - 1, -16], [lean * 0.5, -5, -5.5, -12], [-5.5, -12, -7.5, -15.5], [lean * 0.8, -8, 5.5, -14], [5.5, -14, 8, -15], [lean - 1, -16, lean + 1.5, -19.5]];
    c.lineCap = "round"; c.lineJoin = "round";
    for (const pass of [0, 1]) for (const [a, b, cc, d] of br) {
      const thick = b === 0 ? 2.8 : b > -9 ? 1.6 : 1;
      c.beginPath(); c.moveTo(x + a * s, y + b * s); c.quadraticCurveTo(x + ((a + cc) / 2 + 0.8) * s, y + ((b + d) / 2) * s, x + cc * s, y + d * s);
      c.strokeStyle = pass ? C.char : ol(H); c.lineWidth = (pass ? thick : thick + 1.6) * s; c.stroke();
    }
    c.beginPath(); c.moveTo(x - 0.4 * s, y - 1 * s); c.lineTo(x + (lean * 0.6 - 0.2) * s, y - 8 * s); c.strokeStyle = C.charL; c.lineWidth = 0.6 * s; c.stroke();
    for (const [ex, ey] of [[-7.5, -15.5], [8, -15], [lean + 1.5, -19.5]]) { if (R() < 0.35) continue; f.glow(x + ex * s, y + ey * s, 3 * s, "rgba(255,130,40,A)", 0.55); f.circ(x + ex * s, y + ey * s, 0.7 * s); f.paint("#ffb24a", null); }
    // 樹根的燒焦裂口
    c.beginPath(); c.moveTo(x - 1.5 * s, y + 0.2); c.lineTo(x + 0.5 * s, y - 2.5 * s); c.strokeStyle = C.lava[2]; c.lineWidth = 0.5; c.stroke();
  }
  function ashMound(H, x, y, s, R) {
    const f = F(H);
    f.ell(x, y, 6 * s, 2.3 * s); f.paint("rgba(150,132,126,.55)", null);
    f.ell(x - 1.4 * s, y - 0.8 * s, 3.4 * s, 1.1 * s); f.paint("rgba(205,190,182,.45)", null);
  }
  function smallVent(H, x, y, R) { // 冒煙小熔岩孔（一定離塔位很遠）
    const f = F(H);
    f.glow(x, y - 1, 7, "rgba(255,120,40,A)", 0.45);
    f.ell(x, y, 4.2, 2); f.paint("#2a1714", ol(H), 0.7); f.ell(x, y - 0.2, 2.4, 1); f.paint(C.lava[2], null); f.ell(x - 0.3, y - 0.4, 1.1, 0.45); f.paint(C.lava[0], null);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + R(); F(H).rock(x + Math.cos(a) * 5.5, y + Math.sin(a) * 2.6 + 1, 0.3, R); }
  }
  function boneBits(H, x, y, R) {   // 散落的小骨頭（荒野）
    const c = H.c; c.lineCap = "round";
    for (let i = 0; i < 2; i++) { const a = R() * PI2, x0 = x + i * 3, y0 = y + i; const dx = Math.cos(a) * 3, dy = Math.sin(a) * 1.4;
      c.beginPath(); c.moveTo(x0 - dx, y0 - dy); c.lineTo(x0 + dx, y0 + dy); c.strokeStyle = ol(H); c.lineWidth = 2.2; c.stroke(); c.strokeStyle = C.bone; c.lineWidth = 1.1; c.stroke();
      for (const sg of [-1, 1]) { F(H).circ(x0 + sg * dx, y0 + sg * dy, 0.9); F(H).paint(C.bone, ol(H), 0.45); } }
  }
  // 龍骨：彎曲脊椎＋肋骨＋長角頭骨，半埋在灰裡（溫和，像化石）
  function dragonBones(H, x, y, R) {
    const c = H.c, f = F(H);
    f.ell(x - 4, y + 3, 32, 7); f.paint("rgba(130,112,106,.35)", null);
    const sp = []; for (let i = 0; i <= 10; i++) { const t = i / 10; sp.push([x - 30 + t * 50, y + Math.sin(t * Math.PI * 1.2) * -5 + t * 2]); }
    c.lineCap = "round"; c.lineJoin = "round";
    // 肋骨（後排先畫）
    for (let i = 2; i <= 7; i++) {
      const [bx, by] = sp[i], len = 9 + Math.sin(i / 10 * Math.PI) * 6;
      for (const sg of [-1, 1]) {
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + 3, by + sg * len * 0.6 - 2, bx - 1.5, by + sg * len * 0.55 + (sg > 0 ? 3 : -1));
        c.strokeStyle = ol(H); c.lineWidth = 3; c.stroke(); c.strokeStyle = sg > 0 ? C.bone : C.boneD; c.lineWidth = 1.5; c.stroke();
      }
    }
    // 脊椎
    smoothPath(c, sp); c.strokeStyle = ol(H); c.lineWidth = 3.6; c.stroke(); smoothPath(c, sp); c.strokeStyle = C.bone; c.lineWidth = 2; c.stroke();
    for (let i = 0; i < sp.length; i += 1) { f.circ(sp[i][0], sp[i][1], 1.25); f.paint(C.bone, ol(H), 0.5); }
    // 尾巴尖
    c.beginPath(); c.moveTo(sp[0][0], sp[0][1]); c.quadraticCurveTo(sp[0][0] - 6, sp[0][1] + 4, sp[0][0] - 10, sp[0][1] + 1); c.strokeStyle = ol(H); c.lineWidth = 2.6; c.stroke(); c.strokeStyle = C.bone; c.lineWidth = 1.2; c.stroke();
    // 頭骨（朝右）
    const hx = sp[10][0] + 6, hy = sp[10][1] - 1;
    f.poly([[hx - 5, hy - 4], [hx + 2, hy - 5.5], [hx + 9, hy - 3], [hx + 13, hy - 0.5], [hx + 12, hy + 1.6], [hx + 6, hy + 2.4], [hx + 1, hy + 4], [hx - 4, hy + 3]]); f.paint(C.bone, ol(H), olw(H) * 0.8);
    f.poly([[hx + 1, hy + 2.6], [hx + 6, hy + 2.4], [hx + 11, hy + 1.8], [hx + 7, hy + 4.6], [hx + 1.5, hy + 5]]); f.paint(C.boneD, ol(H), olw(H) * 0.6);
    f.ell(hx + 1.6, hy - 1.4, 1.8, 1.3); f.paint("#2a1c1e", null);            // 眼窩
    f.circ(hx + 10.5, hy - 0.6, 0.5); f.paint("#2a1c1e", null);               // 鼻孔
    for (let i = 0; i < 3; i++) { f.poly([[hx + 5 + i * 2, hy + 2.2], [hx + 6 + i * 2, hy + 2.2], [hx + 5.6 + i * 2, hy + 3.6]]); f.paint("#fff8ea", null); }
    // 角
    for (const [ax, ay, bx, by] of [[hx - 3, hy - 3.5, hx - 11, hy - 10], [hx - 1, hy - 4.5, hx - 6, hy - 12]]) {
      f.poly([[ax - 1.2, ay + 0.6], [ax + 1.4, ay - 0.4], [bx, by]]); f.paint(C.boneD, ol(H), 0.6);
    }
    // 埋進灰裡的前緣
    f.ell(x + 2, y + 9, 22, 2.4); f.paint("rgba(120,100,96,.4)", null);
  }

  // ═════ 路邊發光裂縫（從路緣向外裂，一定離塔位中心 ≥ 24）
  function roadFissures(H) {
    const c = H.c, P = H.P, R = H.R, V = H.vol; let n = 0;
    c.lineCap = "round"; c.lineJoin = "round";
    for (const rt of P.routes) for (let d = 30; d < rt.len - 30 && n < 11; d += 7) {
      if (R() > 0.16) continue;
      let g = null; for (const s of rt.seg) if (d <= s.s + s.L) { g = s; break; } if (!g) continue;
      const t = (d - g.s) / g.L, x = g.x1 + (g.x2 - g.x1) * t, y = g.y1 + (g.y2 - g.y1) * t;
      const dx = Math.sign(g.x2 - g.x1), dy = Math.sign(g.y2 - g.y1), sg = R() < 0.5 ? -1 : 1;
      const nx = dy ? sg : 0, ny = dx ? sg : 0;   // 垂直於路的方向
      let px = x + nx * 13.5, py = y + ny * 13.5; const pts = [[px, py]]; let ok = true;
      const L = 7 + R() * 6;
      for (let k = 1; k <= 3; k++) { px += nx * L / 3 + (dx ? 0 : 0) + (R() - 0.5) * 4 * (nx ? 0.6 : 1); py += ny * L / 3 + (R() - 0.5) * 4 * (ny ? 0.6 : 1); pts.push([px, py]); }
      for (const [qx, qy] of pts) if (P.slotNear(qx, qy, 24) || P.inZone(qx, qy, 4) || P.distWater(qx, qy) < 5 || riverDist(V, qx, qy) < 7 || qx < 2 || qx > 298 || qy > 396) ok = false;
      if (!ok || P.distRoad(pts[3][0], pts[3][1]) < 18) continue;
      n++;
      const seg = (w, col) => { for (let i = 1; i < pts.length; i++) { c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.strokeStyle = col; c.lineWidth = Math.max(0.25, w * (1.25 - i * 0.28)); c.stroke(); } };
      c.save(); c.globalCompositeOperation = "lighter"; seg(5, "rgba(255,100,30,.22)"); c.restore();
      seg(2.6, ol(H)); seg(1.3, C.lava[2]); seg(0.5, C.lava[0]);
    }
  }

  // ═════ 出怪口：熔岩裂谷洞（玄武岩崖壁裡的發光洞口，路從洞裡出來）
  function lavaRift(H, e) {
    const c = H.c, f = F(H), R = H.R;
    c.save();
    if (e.side === "R") { c.translate(300, 0); c.scale(-1, 1); }
    c.translate(0, e.y);
    f.glow(6, 0, 40, "rgba(255,90,30,A)", 0.3);
    // 崖壁（路的上方）
    const mass = [[-6, -58], [8, -60], [22, -55], [32, -45], [35, -32], [32, -21], [24, -15], [16, -16], [8, -18], [-6, -17]];
    f.poly(mass); f.paint(f.lg(0, -60, 0, -15, ["#54434a", "#2c2228"]), ol(H), olw(H) * 1.1);
    f.poly([[8, -60], [22, -55], [32, -45], [35, -32], [24, -36], [14, -46]]); f.paint("rgba(12,6,10,.35)", null);
    // 崖頂的六角柱頭
    for (const [x, y, w] of [[2, -54, 4.4], [12, -55, 3.8], [22, -49, 3.6], [6, -46, 3.2], [28, -38, 3]]) {
      f.poly([[x - w, y], [x - w * 0.5, y - w * 0.5], [x + w * 0.5, y - w * 0.5], [x + w, y], [x + w * 0.5, y + w * 0.5], [x - w * 0.5, y + w * 0.5]]); f.paint(f.lg(0, y - w, 0, y + w, C.basaltTop), ol(H), olw(H) * 0.6);
    }
    // 路下方的小岩塊（避開左下塔位）
    f.poly([[-6, 14], [3, 13.5], [6, 18], [3, 23], [-6, 24]]); f.paint(f.lg(0, 13, 0, 24, ["#4c3c42", "#2a2026"]), ol(H), olw(H));
    // 洞口：深處熔岩光，地上一層岩漿亮面
    f.ell(6, -1, 12.5, 15); f.paint(f.rg(2, 6, 1, 16, ["#ffb04a", "#d8481a", "#4a0e06", "#120406"]), ol(H), olw(H) * 1.4);
    c.beginPath(); c.ellipse(6, -1, 12.5, 15, 0, -1.9, 0.5); c.strokeStyle = "#b07258"; c.lineWidth = 1.6; c.stroke();
    // 黑曜石鐘乳尖牙
    for (let i = 0; i < 5; i++) { const a = -2.35 + i * 0.4, tx = 6 + Math.cos(a) * 12, ty = -1 + Math.sin(a) * 14.4, L = 3.6 + (i % 2) * 1.6; f.poly([[tx - 1.6, ty - 0.4], [tx + 1.6, ty - 0.4], [tx - Math.cos(a) * 0.4, ty + L]]); f.paint(C.obs[1], ol(H), 0.5); c.beginPath(); c.moveTo(tx - 0.7, ty); c.lineTo(tx - 0.2, ty + L * 0.6); c.strokeStyle = C.obsHi; c.lineWidth = 0.4; c.stroke(); }
    // 崖壁的熔岩脈
    c.lineCap = "round"; c.lineJoin = "round";
    for (const p of [[[17, -15], [21, -25], [18, -34], [23, -42]], [[3, -17], [6, -29], [1, -40]], [[26, -17], [31, -26]]]) {
      c.save(); c.globalCompositeOperation = "lighter"; f.poly(p, false); c.strokeStyle = "rgba(255,100,30,.28)"; c.lineWidth = 3.2; c.stroke(); c.restore();
      f.poly(p, false); c.strokeStyle = ol(H); c.lineWidth = 1.8; c.stroke(); f.poly(p, false); c.strokeStyle = C.lava[2]; c.lineWidth = 0.8; c.stroke(); f.poly(p, false); c.strokeStyle = C.lava[0]; c.lineWidth = 0.35; c.stroke();
    }
    // 洞裡的眼睛
    for (const [x, y] of [[2, -5], [9, 2]]) { f.glow(x, y, 4, H.T.eyeGlow, 0.7); f.circ(x - 1.1, y, 0.75); f.paint(H.T.enemyEye, null); f.circ(x + 1.1, y, 0.75); f.paint(H.T.enemyEye, null); }
    // 骨樁警示旗
    c.strokeStyle = ol(H); c.lineWidth = 2.4; c.beginPath(); c.moveTo(31, -17); c.lineTo(31, -31); c.stroke(); c.strokeStyle = C.bone; c.lineWidth = 1.1; c.stroke();
    f.poly([[31, -31], [39, -28.5], [35, -27], [38.5, -25], [31, -25]]); f.paint(H.T.warnFlag, ol(H), 0.6);
    c.restore();
    return true;
  }

  // ═════ 要塞的地基（地面層與城堡層都畫：城堡層會在 bbox 下緣被裁切，地面層補下半段）
  function foundation(H, X0, B0) {
    const c = H.c, f = F(H);
    f.ell(X0 + 16, B0 + 22, 26, 4.5); f.paint("rgba(0,0,6,.38)", null);
    // 底部熔岩縫（低調；離右下塔位夠遠）
    c.save(); c.globalCompositeOperation = "lighter"; c.beginPath(); c.moveTo(X0 + 8, B0 + 20.5); c.lineTo(306, B0 + 20.5); c.strokeStyle = "rgba(255,100,30,.25)"; c.lineWidth = 4; c.stroke(); c.restore();
    f.rr(X0 - 3, B0 + 2, 312 - X0, 18.5, 1.5); f.paint(f.lg(0, B0 + 2, 0, B0 + 20.5, [C.stone[1], C.stone[2]]), ol(H), olw(H));
    for (let r = 0; r < 3; r++) for (let x = X0 - 3 + (r % 2) * 5; x < 306; x += 10) { c.beginPath(); c.rect(x, B0 + 6 + r * 4.9, Math.min(10, 306 - x), 4.9); c.strokeStyle = C.mortar; c.lineWidth = 0.5; c.stroke(); }
    c.beginPath(); c.moveTo(X0 - 2, B0 + 20.5); c.lineTo(306, B0 + 20.5); c.strokeStyle = C.lava[2]; c.lineWidth = 0.9; c.stroke();
    f.rr(X0 - 5, B0 - 1.5, 314 - X0, 5, 1.2); f.paint(C.stoneTop, ol(H), olw(H) * 0.9);
    c.beginPath(); c.moveTo(X0 - 4, B0 + 3.4); c.lineTo(306, B0 + 3.4); c.strokeStyle = C.gold; c.lineWidth = 0.9; c.stroke();
    // 金色鉚飾
    for (let x = X0 + 2; x < 304; x += 8) { f.circ(x, B0 + 1, 0.7); f.paint(C.goldL, null); }
  }
  // 地面層：右緣外牆（往下延伸的黑曜石城垛）＋金頂方尖碑火盆
  function outerWorks(H, L) {
    const c = H.c, f = F(H), P = H.P;
    if (L.type !== "side" || L.flip) return;
    const y0 = L.bottom + 20, x0 = 291;
    let y1 = y0; while (y1 < y0 + 90 && !P.slotNear(x0 + 6, y1 + 8, 21) && P.distRoad(x0, y1 + 10) > 30) y1 += 2;
    if (y1 - y0 > 24) {
      f.shadow(x0 + 2, y1 + 2, 9, 3);
      f.rr(x0, y0 - 2, 10, y1 - y0 + 2, 0); f.paint(f.lg(x0, 0, x0 + 10, 0, [C.stone[2], C.stone[1]]), ol(H), olw(H));
      f.rr(x0 + 2.5, y0 - 2, 8, y1 - y0 + 2, 0); f.paint(f.lg(x0, 0, x0 + 10, 0, [C.stone[0], C.stone[1]]), null);
      for (let y = y0 + 4; y < y1; y += 7) { c.beginPath(); c.moveTo(x0 + 2.5, y); c.lineTo(306, y); c.strokeStyle = C.mortar; c.lineWidth = 0.5; c.stroke(); }
      for (let y = y0 + 2; y < y1 - 3; y += 8) { f.poly([[x0 - 0.5, y + 4], [x0 + 1.4, y - 1.5], [x0 + 3.3, y + 4]]); f.paint(C.obs[1], ol(H), 0.55); f.circ(x0 + 1.4, y - 1.4, 0.55); f.paint(C.goldL, null); }
      // 南端小角樓
      const ty = y1; f.cyl(x0 + 6, ty + 2, 6, 11, f.lg(x0, 0, x0 + 12, 0, [C.stone[2], C.stone[1], C.stone[0]]), C.stoneTop);
      f.ell(x0 + 6, ty - 9, 6, 2.5); f.paint(null, C.gold, 0.9);
      for (const dx of [-4, 0, 4]) { f.poly([[x0 + 6 + dx - 1.4, ty - 9.5], [x0 + 6 + dx, ty - 14.5], [x0 + 6 + dx + 1.4, ty - 9.5]]); f.paint(C.obs[1], ol(H), 0.55); f.circ(x0 + 6 + dx, ty - 14.4, 0.55); f.paint(C.goldL, null); }
      f.rr(x0 + 4.8, ty - 6, 2.4, 5, 1.2); f.paint("#ffcf7a", ol(H), 0.5); f.glow(x0 + 6, ty - 3.5, 7, H.T.windowGlow, 0.45);
    }
    // 方尖碑火盆（守在地基左邊）
    for (const [x, y] of [[L.x0 - 10, L.bottom + 14]]) {
      if (!free(H, x, y, { road: 20, slot: 24, zone: -6, river: 10, occ: -99 })) continue;
      f.shadow(x + 2, y + 1, 6, 2.2);
      f.poly([[x - 3.6, y], [x - 2.4, y - 15], [x, y - 18.5], [x + 2.4, y - 15], [x + 3.6, y]]); f.paint(f.lg(x - 3.6, 0, x + 3.6, 0, [C.obs[0], C.obs[1], C.obs[2]]), ol(H), olw(H) * 0.9);
      c.beginPath(); c.moveTo(x - 1.6, y - 2); c.lineTo(x - 1.2, y - 14); c.strokeStyle = C.obsHi; c.lineWidth = 0.5; c.stroke();
      f.rr(x - 4.4, y - 2.4, 8.8, 2.6, 0.8); f.paint(C.gold, ol(H), 0.6);
      f.poly([[x - 2.4, y - 15], [x, y - 18.5], [x + 2.4, y - 15]]); f.paint(C.gold, ol(H), 0.6);
      // 碑頂火盆
      f.glow(x, y - 21, 9, "rgba(255,150,60,A)", 0.6);
      c.beginPath(); c.moveTo(x - 3.2, y - 19.5); c.lineTo(x + 3.2, y - 19.5); c.lineTo(x + 2, y - 17.6); c.lineTo(x - 2, y - 17.6); c.closePath(); f.paint(C.goldD, ol(H), 0.55);
      c.beginPath(); c.moveTo(x - 2.4, y - 19.6); c.quadraticCurveTo(x - 1.6, y - 23.5, x, y - 25); c.quadraticCurveTo(x + 0.6, y - 22.5, x + 2.4, y - 19.6); c.closePath(); f.paint("#ff9a3a", null); f.ell(x, y - 20.6, 1, 1.6); f.paint("#ffe9a6", null);
    }
  }

  // ═════ 右側要塞（城堡層；L＝castleLayout 的 side 版面：x0、top、bottom、gy、tw、torches、flags、cracks）
  function fortress(H, L) {
    if (L.type !== "side") return false;
    const c = H.c, f = F(H), T = H.T;
    c.save(); if (L.flip) { c.translate(300, 0); c.scale(-1, 1); }
    const X0 = L.x0, T0 = L.top, B0 = L.bottom, GY = L.gy, KX = X0 + 4, tw = L.tw;
    const fl = L.flags && L.flags[0] ? L.flags[0] : { x: tw.x, y: 14 };
    foundation(H, X0, B0);
    // 主堡身：玄武岩方塊＋金線
    f.rr(KX, T0 - 2, 310 - KX, B0 - T0 + 3, 0); f.paint(f.lg(0, T0 - 2, 0, B0, [C.stone[0], C.stone[1], C.stone[2]]), T.ol, T.olw * 1.1);
    for (let r = 0; (r + 1) * 6.4 + T0 < B0; r++) for (let x = KX + (r % 2) * 4.5; x < 306; x += 9) { c.beginPath(); c.rect(x, T0 + 1 + r * 6.4, Math.min(9, 306 - x), 6.4); c.strokeStyle = C.mortar; c.lineWidth = 0.5; c.stroke(); }
    c.fillStyle = "rgba(255,150,80,.08)"; c.fillRect(KX, GY - 30, 8, 60);   // 門邊火光映在牆上
    // 亮著的窗（畫面只到 x=300）
    for (const wy of [GY - 13, GY + 13]) { f.rr(298.6 - 1.3, wy - 4.5, 2.6, 8, 1.3); f.paint("#ffcf7a", T.ol, 0.7); f.glow(298.6, wy, 7, T.windowGlow, 0.45); }
    // 城頂步道＋金線
    f.rr(KX - 2, T0 - 8, 312 - KX, 6.5, 0.8); f.paint(f.lg(0, T0 - 8, 0, T0 - 1.5, [C.stoneTop, C.stone[0]]), T.ol, T.olw);
    c.beginPath(); c.moveTo(KX - 1, T0 - 1.5); c.lineTo(306, T0 - 1.5); c.strokeStyle = C.gold; c.lineWidth = 1; c.stroke();
    // 左上黑曜石尖柱（扶壁）
    f.poly([[X0 + 2, B0 - 40], [X0 + 2, T0 - 6], [X0 + 5, T0 - 15], [X0 + 8, T0 - 6], [X0 + 8, B0 - 40]]); f.paint(f.lg(X0 + 2, 0, X0 + 8, 0, [C.obs[0], C.obs[1], C.obs[2]]), T.ol, T.olw);
    c.beginPath(); c.moveTo(X0 + 3.4, B0 - 42); c.lineTo(X0 + 3.4, T0 - 6); c.lineTo(X0 + 5, T0 - 12); c.strokeStyle = C.obsHi; c.lineWidth = 0.5; c.stroke();
    f.rr(X0 + 1.4, T0 - 2, 7.2, 1.8, 0.6); f.paint(C.gold, T.ol, 0.5);
    // 主塔：黑曜石圓塔＋金環＋尖頂，塔尖＝旗桿底（L.flags）
    const tx = fl.x, tr = tw.r + 0.5, tip = fl.y, rb = tip + 8, band = rb + 1.5, tb = T0 + 6;
    f.shadow(tx + 2, tb + 1, tr + 2, 2.6, 0.35);
    f.cyl(tx, tb, tr, tb - band, f.lg(tx - tr, 0, tx + tr, 0, [C.obs[2], C.obs[1], C.obs[0]]), null);
    for (let y = tb - 4.5; y > band + 1; y -= 4.5) { c.beginPath(); c.moveTo(tx - tr, y); c.quadraticCurveTo(tx, y + 2.4, tx + tr, y); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.5; c.stroke(); }
    c.beginPath(); c.moveTo(tx - tr + 1.6, tb - 1); c.lineTo(tx - tr + 1.6, band + 1); c.strokeStyle = C.obsHi; c.lineWidth = 0.5; c.stroke();
    // 拱窗
    c.beginPath(); c.moveTo(tx - 1.8, band + 9); c.lineTo(tx - 1.8, band + 4.6); c.quadraticCurveTo(tx, band + 2, tx + 1.8, band + 4.6); c.lineTo(tx + 1.8, band + 9); c.closePath(); f.paint("#ffcf7a", T.ol, 0.6); f.glow(tx, band + 6, 7, T.windowGlow, 0.5);
    f.cyl(tx, band + 0.8, tr + 1.2, 2.2, f.lg(tx - tr, 0, tx + tr, 0, [C.goldD, C.gold, C.goldL]), null);
    f.poly([[tx - tr - 1.4, rb], [tx, tip], [tx + tr + 1.4, rb]]); f.paint(f.lg(tx - tr, 0, tx + tr, 0, [C.obs[2], C.obs[1], C.obs[0]]), T.ol, T.olw);
    c.beginPath(); c.ellipse(tx, rb, tr + 1.4, 1.5, 0, 0, Math.PI); f.paint(C.obs[2], T.ol, T.olw * 0.8);
    c.beginPath(); c.moveTo(tx, tip + 0.5); c.lineTo(tx + 0.4, rb + 1.2); c.moveTo(tx - 0.3, tip + 1); c.lineTo(tx - tr * 0.55, rb + 0.8); c.moveTo(tx + 0.3, tip + 1); c.lineTo(tx + tr * 0.6, rb + 0.8); c.strokeStyle = C.gold; c.lineWidth = 0.7; c.stroke();
    f.circ(tx, tip + 0.4, 1.2); f.paint(C.gold, T.ol, 0.5);
    // 王城藍旗（從塔腳垂下，金邊＋星）
    f.banner(tx + 0.5, tb - 1, 8.5, 22, T.castleBanner, (bx, by) => f.star(bx, by, 2.3, C.gold));
    c.beginPath(); c.moveTo(tx - 4.5, tb - 1); c.lineTo(tx + 5.5, tb - 1); c.strokeStyle = C.gold; c.lineWidth = 1.4; c.stroke();
    // 尖頂城垛（黑曜石＋金尖；塔兩側）
    for (const x of [KX + 1.5, tx + tr + 2.5]) { f.poly([[x - 2.2, T0 - 7.5], [x, T0 - 13], [x + 2.2, T0 - 7.5]]); f.paint(C.obs[1], T.ol, 0.7); f.circ(x, T0 - 12.8, 0.7); f.paint(C.goldL, null); }
    // 側門門廊（朝左，路從這裡進城）
    const PX0 = X0 - 2, PX1 = X0 + 12, PT = GY - 20;
    f.rr(PX0, PT, PX1 - PX0, B0 - PT, 0); f.paint(f.lg(PX0, 0, PX1, 0, [C.obs[0], C.obs[1], C.obs[2]]), T.ol, T.olw);
    c.beginPath(); c.moveTo(PX0 + 0.8, PT + 1); c.lineTo(PX0 + 0.8, B0 - 1); c.strokeStyle = C.gold; c.lineWidth = 0.9; c.stroke();
    // 門廊尖頂＋金角飾
    f.poly([[PX0 - 3, PT + 1], [(PX0 + PX1) / 2, PT - 10], [PX1 + 3, PT + 1]]); f.paint(f.lg(0, PT - 10, 0, PT + 1, [C.obs[0], C.obs[2]]), T.ol, T.olw);
    c.beginPath(); c.moveTo(PX0 - 2, PT + 0.4); c.lineTo((PX0 + PX1) / 2, PT - 9); c.lineTo(PX1 + 2, PT + 0.4); c.strokeStyle = C.gold; c.lineWidth = 0.9; c.stroke();
    for (const [x, s] of [[PX0 - 3, -1], [PX1 + 3, 1]]) { c.beginPath(); c.moveTo(x, PT + 1); c.quadraticCurveTo(x + s * 2.4, PT - 1, x + s * 2.2, PT - 5); c.strokeStyle = T.ol; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = C.gold; c.lineWidth = 1; c.stroke(); }
    f.crestBook((PX0 + PX1) / 2, PT - 2.6, 3.3);
    // 門洞＋金色柵門
    const ax0 = PX0 + 1.5, ax1 = PX1 - 1, at = GY - 16, ab = GY + 14, spring = GY - 8, cx = (ax0 + ax1) / 2;
    const arch = () => { c.beginPath(); c.moveTo(ax0, ab); c.lineTo(ax0, spring); c.quadraticCurveTo(cx, at - 4, ax1, spring); c.lineTo(ax1, ab); };
    arch(); c.closePath(); f.paint(f.lg(0, at, 0, ab, ["#0a0612", "#05070e"]), null);
    arch(); c.closePath(); c.save(); c.clip(); f.circ(cx, ab - 3, 11); c.fillStyle = f.rg(cx, ab - 3, 0, 11, ["rgba(255,170,80,.32)", "rgba(255,170,80,0)"]); c.fill(); c.restore();
    for (let i = 0; i < 3; i++) { const x = ax0 + 2 + i * (ax1 - ax0 - 4) / 2; c.beginPath(); c.moveTo(x, spring - (i === 1 ? 5 : 1.5)); c.lineTo(x, ab - 2); c.strokeStyle = C.gold; c.lineWidth = 0.9; c.stroke(); f.poly([[x - 0.9, ab - 2.5], [x + 0.9, ab - 2.5], [x, ab - 0.6]]); f.paint(C.gold, null); }
    for (let y = spring + 2; y < ab - 3; y += 6) { c.beginPath(); c.moveTo(ax0 + 0.6, y); c.lineTo(ax1 - 0.6, y); c.strokeStyle = "rgba(225,184,106,.75)"; c.lineWidth = 0.7; c.stroke(); }
    arch(); f.paint(null, T.ol, T.olw * 1.8); arch(); f.paint(null, C.gold, 0.9);
    // 火把座（火把本體由 castleOverlay 畫在 L.torches）
    for (const [x, y] of L.torches || []) { f.rr(x - 0.4, y + 3.6, 3.2, 1.6, 0.6); f.paint(C.gold, T.ol, 0.45); }
    c.restore();
    return true;
  }

  // ═════ 裝飾配置（取代通用裝飾）
  function placeAll(H) {
    const P = H.P, V = H.vol, R = H.R, items = [];
    const L = P.castle;
    // 外牆、方尖碑
    items.push({ y: (L.bottom || 84) + 20, f: () => { if (L.type === "side") foundation(H, L.x0, L.bottom); } });
    items.push({ y: (L.bottom || 84) + 60, f: () => outerWorks(H, L) });
    if (L.type === "side" && !L.flip) { V.occ.push([L.x0 - 10, L.bottom + 6, 12]); V.occ.push([300, L.bottom + 60, 12]); }
    // 龍骨
    for (const [x, y] of [[92, 252], [96, 262], [200, 330], [90, 120]]) {
      if ([[x - 40, y], [x + 26, y], [x, y - 12], [x, y + 12], [x - 18, y - 10], [x + 10, y + 10]].every(([qx, qy]) => free(H, qx, qy, { road: 22, slot: 24, river: 12 }))) { items.push({ y: y + 6, f: () => dragonBones(H, x, y, R) }); V.occ.push([x - 6, y, 40]); break; }
    }
    // 玄武岩柱群（固定幾處＋隨機）
    for (const [x, y, s] of [[288, 275, 1.15], [212, 22, 0.9], [20, 140, 1.05], [128, 380, 0.95], [232, 120, 0.9]]) {
      if (free(H, x, y, { road: 24, slot: 22, river: 12 }) && free(H, x, y - 14, { road: 16, slot: 18, river: 0 })) { items.push({ y, f: () => basaltCluster(H, x, y, s, R) }); V.occ.push([x, y, 14]); }
    }
    // 格點散佈（避開路、塔位、城堡、水、熔岩河、主景、地名）
    const placed = [];
    for (let gx = 6; gx < 300; gx += 12) for (let gy = 6; gy < 400; gy += 12) {
      const x = gx + (R() - 0.5) * 8, y = gy + (R() - 0.5) * 8, k = R();
      if (!free(H, x, y, {})) continue;
      const d = P.distRoad(x, y), wild = Math.max(0, 1 - Math.min(...P.entries.map(e => HY(x - e.x, y - e.y))) / 120);
      let tall = k < (wild > 0.3 ? 0.26 : 0.17) && d > 25 && placed.every(p => HY(p[0] - x, p[1] - y) > 15);
      if (tall && (P.distRoad(x, y - 18) < 16 || P.slotNear(x, y - 14, 19) || P.inZone(x, y - 20, 2))) tall = false;
      if (tall) placed.push([x, y]);
      const s = 0.85 + R() * 0.3;
      if (tall) items.push({ y, f: () => charTree(H, x, y, s, R) });
      else if (k < 0.3) items.push({ y, f: () => F(H).rock(x, y, 0.5 + R() * 0.45, R) });
      else if (k < 0.37) items.push({ y, f: () => obsidian(H, x, y, 0.8 + R() * 0.35, R) });
      else if (k < 0.43) items.push({ y, f: () => ashMound(H, x, y, 0.8 + R() * 0.5, R) });
      else if (k < 0.46 && wild > 0.2) items.push({ y, f: () => boneBits(H, x, y, R) });
      else if (k < 0.47 && !P.slotNear(x, y, 30) && d > 24) items.push({ y, f: () => smallVent(H, x, y, R) });
    }
    items.sort((a, b) => a.y - b.y).forEach(it => it.f());
  }

  ART.REGION_KITS[4] = {
    replaceDecor: true,
    preRoad(H) {
      H.vol = { rivers: [], occ: [], claws: [], labels: [], pool: null, glow: null, smoke: [], pts: [] };
      const V = H.vol, P = H.P;
      // 地名「熔岩洞穴」的位置（drawLabels 規則）先保留，不放裝飾
      for (const e of P.entries.slice(0, 1)) { const x = e.side === "L" ? 44 : 256, y = e.y + 49; V.labels.push([x - 24, y - 7, x + 24, y + 7], [x - 24, e.y - 33, x + 24, e.y - 19]); }
      drawAshGround(H);
      // 遠景火山口（頂端邊緣；離路 ≥ 18、離塔位夠遠才畫）
      for (const [cx, by, hw, py] of [[100, 21, 34, 3], [212, 15, 20, 2]]) {
        if ([[cx - hw, by], [cx + hw, by], [cx, by], [cx - hw * 0.5, by], [cx + hw * 0.5, by]].every(([x, y]) => P.distRoad(x, y) >= 18 && !P.slotNear(x, y, 22) && !P.inZone(x, y, 2))) { cone(H, cx, by, hw, py); V.smoke.push([cx, py]); V.occ.push([cx, by - 4, hw * 0.8]); }
      }
      planLava(H); planClaws(H);
      for (const r of V.rivers) drawRiver(H, r);
      if (V.pool) drawPool(H, V.pool);
      for (const cm of V.claws) drawClaw(H, cm);
      for (const r of V.rivers) V.pts = V.pts.concat([sampleSmooth(r, 2)]);
      buildGlowLayer(V);
    },
    postRoad(H) {
      if (!H.vol) return;
      const c = H.c;
      // 路面落灰（讓路面不那麼黃，和灰燼地面一致）
      c.save(); c.lineJoin = "round"; c.lineCap = "round";
      for (const rt of H.P.routes) { c.beginPath(); rt.path.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = "rgba(120,104,100,.12)"; c.lineWidth = 25; c.stroke(); }
      c.restore();
      roadFissures(H);
    },
    entrance(H, e) { return lavaRift(H, e); },
    decor(H) { if (H.vol) placeAll(H); },
    castle(H, L) { return fortress(H, L); },
    ambient(ctx, t, H) {
      const V = H && H.vol; if (!V) return;
      if (!V.spr) V.spr = { glint: softSprite("rgba(255,230,150,A)", 24), smoke: softSprite("rgba(40,28,30,A)", 48) };
      ctx.globalCompositeOperation = "lighter";
      // 熔岩亮度脈動（一張預畫好的發光層）
      const G = V.glow; if (G) { ctx.globalAlpha = 0.22 + 0.16 * Math.sin(t * 1.6) + 0.06 * Math.sin(t * 4.3); ctx.drawImage(G.k, G.x, G.y, G.w, G.h); }
      // 沿河流動的亮點（5 顆）
      const gl = V.spr.glint;
      if (gl) for (let i = 0; i < 5; i++) { const pts = V.pts[i % V.pts.length]; if (!pts || pts.length < 3) continue; const n = pts.length, u = ((t * 9 + i * n / 2.6) % n + n) % n, p = pts[u | 0]; const a = Math.sin(u / n * Math.PI); ctx.globalAlpha = 0.55 * a; ctx.drawImage(gl, p[0] - 3.2, p[1] - 3.2, 6.4, 6.4); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      // 火山口的煙（每座 2 團，往右上飄、漸淡）
      const sm = V.spr.smoke;
      if (sm) for (let j = 0; j < V.smoke.length; j++) { const [sx, sy] = V.smoke[j]; for (let i = 0; i < 2; i++) { const k = ((t * 0.09 + i * 0.5 + j * 0.27) % 1), r = 5 + k * 12; ctx.globalAlpha = 0.5 * Math.sin(k * Math.PI); ctx.drawImage(sm, sx + k * 26 - r, sy - 2 - k * 9 + Math.sin(t + i) * 1.5 - r, r * 2, r * 2); } }
      // 飄落的灰（5 片；連同通用火星 26＋流光 5＋煙 4＝40）
      ctx.fillStyle = "rgba(205,195,190,.55)";
      for (let i = 0; i < 5; i++) { const sp = 7 + (i % 3) * 3, y = ((i * 71 + t * sp) % 420) - 10, x = ((i * 113 + 37) % 300) + Math.sin(t * 0.7 + i * 1.7) * 7; ctx.globalAlpha = 0.6; ctx.fillRect(x, y, 1.3, 0.9); }
      ctx.globalAlpha = 1;
    }
  };
})();
