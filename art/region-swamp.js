// 區域套件：迷霧沼澤（REGION 2）— 第二刀。介面見 art/CONTRACT.md「第二刀」與 art/art-map.js 的 ART.REGION_KITS 說明。
// 地貌故事：左上「朽木樹洞」（怪從中空巨木鑽出）→ 一路泥沼、浮萍、垂苔枯樹、蘆葦、發光蘑菇、鬼火 → 路過水道處改走木棧道
// → 越靠近城堡越乾、出現石板地與燈籠。全部自繪向量；裝飾避開路（≥18）、塔位、水、出怪口與城堡。
// 第 3 區另有「迷霧」機制（terrain.ui.js 在 drawTop 蓋霧）：本檔不加會遮視線的濃霧，ambient 只做泡泡、鬼火、螢光、燈籠閃爍。
(function () {
  "use strict";
  const ART = window.ART = window.ART || {};
  ART.REGION_KITS = ART.REGION_KITS || {};
  const PI2 = Math.PI * 2, HY = Math.hypot;

  // 沼澤自己的配色（描邊沿用 T.ol / T.olw）
  const K = {
    mudRing: "rgba(22,30,18,.5)", mudBank: "#4a4a30", mudBank2: "#5b5a3a",
    water: ["#5a8a66", "#2f5544", "#1a3328"], waterHi: "rgba(190,235,200,.55)", waterShade: "rgba(6,14,10,.5)",
    weed: ["#86b850", "#9fcc5e", "#6f9e42", "#b6dc72"], pad: "#5f9a4a", padD: "#3f6e36", padFlower: "#f0b4dc",
    bark: ["#7a6650", "#56483a", "#3a3028"], barkLine: "rgba(10,8,6,.5)", barkHi: "#9a8466",
    hollow: ["#000000", "#1a1026"], hollowRim: "#8a7658",
    canopy: [["#5e7e4e", "#344a32"], ["#6a8650", "#3a5236"]], moss: "#a6c08e", moss2: "#7f9c6c",
    cattail: "#5e7e48", cattailHead: "#6e4a2c", shroom: "#7ef0d0", shroomStem: "#d8efe4", shroomGlow: "rgba(110,245,210,A)",
    plank: ["#b8966a", "#a2805a", "#8c6c4a"], plankTop: "rgba(255,236,200,.35)", beam: "#5a4230", post: "#6a4e36", postTop: "#9a7a58", rope: "#cdb080",
    lanternCore: "#fff4b8", lanternGlow: "rgba(210,255,150,A)", lanternFrame: "#2c2418",
    bone: "#e2dac2", boneD: "#a89e84", hull: ["#7a5a3e", "#5a4230"],
    dry: "rgba(196,168,108,A)", dryTuft: ["#b4a46a", "#968a58"], flag: ["#9aa294", "#80887c", "#b4baa8"]
  };

  // ── 發光小圖（ambient 每幀用；預先畫好再 drawImage）
  const glowCache = {};
  function glowSprite(col) {
    if (glowCache[col]) return glowCache[col];
    if (typeof document === "undefined") return null;
    const k = document.createElement("canvas"); k.width = k.height = 48; const g = k.getContext("2d");
    const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, col.replace("A", 1)); gr.addColorStop(0.35, col.replace("A", 0.45)); gr.addColorStop(1, col.replace("A", 0));
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return (glowCache[col] = k);
  }

  // ── 這次建圖的資料（ambient 用）
  let S = null;

  // ── 形狀小工具
  function blob(cx, cy, rx, ry, R, amp, n) {   // 有機外形（半徑加正弦雜訊）；amp<0＝只往外鼓（蓋住舊水窪用）
    n = n || 20; const p1 = R() * PI2, p2 = R() * PI2, a1 = Math.abs(amp) * (0.75 + R() * 0.5), a2 = Math.abs(amp) * 0.5 * (0.6 + R() * 0.8), pts = [];
    for (let i = 0; i < n; i++) {
      const th = i / n * PI2; let k = a1 * Math.sin(3 * th + p1) + a2 * Math.sin(5 * th + p2);
      k = amp < 0 ? 1 + Math.abs(k) : 1 + k;
      pts.push([cx + Math.cos(th) * rx * k, cy + Math.sin(th) * ry * k]);
    }
    return { cx, cy, rx, ry, pts };
  }
  function smooth(c, pts) {
    const n = pts.length; c.beginPath();
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    c.closePath();
  }
  const scaled = (o, s, dx, dy) => o.pts.map(([x, y]) => [o.cx + (x - o.cx) * s + (dx || 0), o.cy + (y - o.cy) * s + (dy || 0)]);
  function inPoly(pts, x, y) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
  function polyDist(pts, x, y) {   // 到外形的距離（裡面＝0）
    if (inPoly(pts, x, y)) return 0;
    let d = 1e9;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [x1, y1] = pts[j], [x2, y2] = pts[i], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0; d = Math.min(d, HY(x - x1 - dx * t, y - y1 - dy * t)); }
    return d;
  }
  const segD = (g, x, y) => { const dx = g.x2 - g.x1, dy = g.y2 - g.y1, t = g.L ? Math.max(0, Math.min(1, ((x - g.x1) * dx + (y - g.y1) * dy) / (g.L * g.L))) : 0; return HY(x - g.x1 - dx * t, y - g.y1 - dy * t); };

  // ── 規劃：水道（棧道）＋泥沼＋舊水窪改畫
  function planSwamp(H) {
    const P = H.P, R = H.R, L = P.castle;
    const zonesE = P.zones.filter(z => z !== L.bbox);
    const inEntry = (x, y, pad) => zonesE.some(z => x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad);
    const slotClose = (x, y, r) => P.slots.some(([sx, sy]) => HY(sx - x, (sy - y) * 1.5) < r);
    const dryY = L.type === "bottom" ? Math.min(300, L.bbox.y0 - 4) : 400;
    const castleBlock = (x, y, pad) => {
      pad = pad || 0;
      if (L.type === "bottom") {
        if (y > L.wallTop - 10 - pad) return true;
        if (Math.abs(x - L.gx) < 24 + pad && y > L.gateTop - 14 - pad) return true;
        return L.towers.some(t => Math.abs(x - t.x) < t.r + 7 + pad && y > 404 - t.h - 8 - t.roof - 16 - pad);
      }
      const b = L.bbox; return x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad;
    };
    const pools = [], crossings = [];
    const overlaps = (o, gap) => pools.some(q => HY((o.cx - q.cx) / (o.rx + q.rx) , (o.cy - q.cy) / (o.ry + q.ry)) < 1.9 && (inPoly(q.pts, o.cx, o.cy) || o.pts.some(([x, y]) => polyDist(q.pts, x, y) < gap)));
    const okPool = o => o.pts.every(([x, y]) => P.distRoad(x, y) >= 16.5 && !slotClose(x, y, 19) && !inEntry(x, y, 4) && y <= dryY && y >= -8 && x >= -26 && x <= 326 && !castleBlock(x, y, 8)) && !slotClose(o.cx, o.cy, 24);

    // 1) 水道：在直路中段，找一段兩側都沒塔位的地方，讓水從路下穿過（之後鋪木棧道）
    const segs = []; P.routes.forEach(rt => rt.seg.forEach(g => segs.push(g)));
    const cand = [];
    segs.forEach((g, gi) => {
      if (g.L < 90) return;
      const ux = (g.x2 - g.x1) / g.L, uy = (g.y2 - g.y1) / g.L;
      for (let d = 46; d <= g.L - 46; d += 6) {
        const x = g.x1 + ux * d, y = g.y1 + uy * d;
        if (x < 30 || x > 270 || y < 20) continue;
        const along = 21, perp = 31, rr = mulberryLite(gi * 1000 + d);
        const o = blob(x, y, ux ? along : perp, ux ? perp : along, rr, 0.1, 22);
        const ok = o.pts.every(([px, py]) => segs.every(h => h === g || segD(h, px, py) >= 17.5) && !slotClose(px, py, 21) && !inEntry(px, py, 4) && !castleBlock(px, py, 8) && py <= dryY + 6 && py >= 4);
        if (!ok) continue;
        let cl = 99; for (const [sx, sy] of P.slots) cl = Math.min(cl, HY(sx - x, sy - y));
        cand.push({ o, g, ux, uy, x, y, s: Math.min(cl, 60) - Math.abs(y - 200) * 0.05 - Math.abs(x - 150) * 0.04 });
      }
    });
    cand.sort((a, b) => b.s - a.s);
    for (const cd of cand) {
      if (crossings.length >= 2) break;
      if (crossings.some(q => q.g === cd.g || HY(q.x - cd.x, q.y - cd.y) < 110)) continue;
      crossings.push(cd); cd.o.cross = true; pools.push(cd.o);
    }
    // 2) 舊水窪（plan 找的位置）改畫成沼澤水塘，順便放大一點
    for (const q of P.ponds) {
      let o = null;
      for (const g of [5, 3.5, 2.2]) { const t = blob(q.x, q.y, q.rx + g, q.ry + g, R, -0.1, 20); if (okPool(t) && !overlaps(t, 6)) { o = t; break; } }
      if (!o) { o = blob(q.x, q.y, q.rx + 2.2, q.ry + 2.2, R, 0, 20); }
      if (!overlaps(o, 0)) pools.push(o);
    }
    // 3) 再補幾片泥沼（邊緣可伸出畫面）
    const sizes = [[40, 18], [34, 17], [29, 15], [25, 14], [21, 12], [17, 10], [14, 8]];
    for (const [rx, ry] of sizes) {
      if (pools.length >= 13) break;
      const cs = [];
      for (let x = -8; x <= 308; x += 9) for (let y = 0; y <= dryY; y += 8) {
        if (P.distRoad(x, y) < ry + 15 || slotClose(x, y, 24)) continue;
        cs.push({ x, y, s: Math.min(P.distRoad(x, y), 50) + R() * 6 });
      }
      cs.sort((a, b) => b.s - a.s);
      let tries = 0;
      for (const cd of cs) {
        if (pools.length >= 13 || tries > 160) break;
        if (pools.some(q => HY((cd.x - q.cx) / (rx + q.rx), (cd.y - q.cy) / (ry + q.ry)) < 0.9)) continue;   // 明顯和既有水塘重疊：先跳過（省建圖時間）
        tries++;
        const o = blob(cd.x, cd.y, rx, ry, R, 0.14, 22);
        if (okPool(o) && !overlaps(o, 12)) pools.push(o);
      }
    }
    const waterDist = (x, y) => { let d = 1e9; for (const o of pools) { if (HY((x - o.cx) / (o.rx * 1.5 + 30), (y - o.cy) / (o.ry * 1.5 + 30)) > 1) continue; d = Math.min(d, polyDist(o.pts, x, y)); } return d; };
    return { pools, crossings, inEntry, slotClose, castleBlock, waterDist, dryY };
  }
  function mulberryLite(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ── 畫泥沼水面：泥岸→水→內陰影→倒影→浮萍→睡蓮葉→泡泡
  function drawPool(H, o) {
    const c = H.c, T = H.T, R = H.R, f = H.f;
    smooth(c, scaled(o, 1.16, 0, 1.4)); c.fillStyle = K.mudRing; c.fill();
    smooth(c, scaled(o, 1.08, 0, 0.8)); c.fillStyle = R() < 0.5 ? K.mudBank : K.mudBank2; c.fill();
    smooth(c, o.pts);
    const g = c.createLinearGradient(0, o.cy - o.ry * 1.2, 0, o.cy + o.ry * 1.2); g.addColorStop(0, K.water[2]); g.addColorStop(0.45, K.water[1]); g.addColorStop(1, K.water[0]);
    c.fillStyle = g; c.fill(); c.strokeStyle = T.ol; c.lineWidth = T.olw * 1.15; c.stroke();
    c.save(); smooth(c, o.pts); c.clip();
    c.lineJoin = "round";
    smooth(c, scaled(o, 1, 0, 2.6)); c.strokeStyle = K.waterShade; c.lineWidth = 5; c.stroke();          // 上緣內陰影
    smooth(c, scaled(o, 1, 0, -2)); c.strokeStyle = "rgba(170,220,180,.22)"; c.lineWidth = 2.2; c.stroke(); // 下緣反光
    // 水面反光短線
    const nl = Math.max(2, Math.round(o.rx / 7));
    c.strokeStyle = K.waterHi; c.lineWidth = 0.8; c.lineCap = "round";
    for (let i = 0; i < nl; i++) { const x = o.cx + (R() - 0.5) * o.rx * 1.2, y = o.cy + (R() - 0.2) * o.ry * 0.7, w = 2 + R() * 3; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + w, y); c.stroke(); }
    // 浮萍：沿岸一團一團
    const nc = Math.max(2, Math.round(o.rx * o.ry / 70));
    const dots = [];   // 一次收集、依顏色批次填（建圖快很多）
    for (let k = 0; k < nc; k++) {
      const a = R() * PI2, rr0 = 0.62 + R() * 0.3, gx = o.cx + Math.cos(a) * o.rx * rr0, gy = o.cy + Math.sin(a) * o.ry * rr0, n = 7 + Math.floor(R() * 9);
      for (let i = 0; i < n; i++) dots.push([gx + (R() - 0.5) * 8, gy + (R() - 0.5) * 4, 0.6 + R() * 0.9, Math.floor(R() * K.weed.length)]);
    }
    const batch = (col, dy, pick) => { c.beginPath(); for (const [x, y, r, ci] of dots) if (pick < 0 || ci === pick) { c.moveTo(x + r, y + dy); c.arc(x, y + dy, r, 0, PI2); } c.fillStyle = col; c.fill(); };
    batch("rgba(6,16,8,.45)", 0.35, -1);
    K.weed.forEach((col, ci) => batch(col, 0, ci));
    // 睡蓮葉
    const np = o.rx > 22 ? 3 : o.rx > 15 ? 2 : 1;
    for (let i = 0; i < np; i++) {
      const a = R() * PI2, d = R() * 0.55, x = o.cx + Math.cos(a) * o.rx * d, y = o.cy + Math.sin(a) * o.ry * d, r = 2.4 + R() * 1.6, rot = R() * PI2;
      c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, rot + 0.35, rot + PI2 - 0.15); c.lineTo(x, y); c.closePath(); f.paint(R() < 0.5 ? K.pad : K.padD, T.ol, T.olw * 0.55);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(rot + PI2 / 2) * r * 0.7, y - Math.sin(rot + PI2 / 2) * r * 0.4); c.strokeStyle = "rgba(20,40,20,.5)"; c.lineWidth = 0.4; c.stroke();
      if (i === 0 && R() < 0.75) { for (let j = 0; j < 5; j++) { const b = j * PI2 / 5; f.circ(x + 0.6 + Math.cos(b) * 0.95, y - 0.9 + Math.sin(b) * 0.7, 0.8); c.fillStyle = K.padFlower; c.fill(); } f.circ(x + 0.6, y - 0.9, 0.55); c.fillStyle = "#fff6c8"; c.fill(); }
    }
    // 靜止的小泡泡
    for (let i = 0; i < 3; i++) { const x = o.cx + (R() - 0.5) * o.rx, y = o.cy + (R() - 0.5) * o.ry * 0.8; f.circ(x, y, 0.6 + R() * 0.6); c.strokeStyle = "rgba(200,240,210,.65)"; c.lineWidth = 0.45; c.stroke(); }
    c.restore();
  }

  // ── 池中的故事物件：沉船、巨獸肋骨
  function wreck(H, o) {   // 半沉的小船：船尾泡在水裡、船頭翹起
    const c = H.c, T = H.T, f = H.f, x = o.cx - o.rx * 0.15, y = o.cy + 2;
    c.save(); c.translate(x, y); c.rotate(-0.12); c.lineJoin = "round"; c.lineCap = "round";
    f.ell(1, 0.6, 16, 2.8); c.fillStyle = "rgba(6,14,10,.5)"; c.fill();
    const hull = () => { c.beginPath(); c.moveTo(-14, 0); c.lineTo(-13, -4); c.quadraticCurveTo(2, -5.5, 15, -12.5); c.quadraticCurveTo(16.5, -5, 11, 0.4); c.closePath(); };
    hull(); f.paint(K.hull[0], T.ol, T.olw);
    c.save(); hull(); c.clip();
    for (const dy of [2.4, 4.8]) { c.beginPath(); c.moveTo(-14, -4 + dy); c.quadraticCurveTo(2, -5.5 + dy, 16, -12.5 + dy * 1.1); c.strokeStyle = K.hull[1]; c.lineWidth = 0.8; c.stroke(); }
    c.restore();
    c.beginPath(); c.moveTo(-12, -3.6); c.quadraticCurveTo(2, -5, 14, -11.6); c.quadraticCurveTo(7, -6.2, -12, -1.8); c.closePath(); f.paint("#2a1e14", null);   // 船艙
    c.beginPath(); c.moveTo(-13, -4); c.quadraticCurveTo(2, -5.5, 15, -12.5); c.strokeStyle = "#a07c56"; c.lineWidth = 1.1; c.stroke();                      // 船緣亮邊
    f.rr(1, -10.5, 1.8, 7, 0.6); f.paint(K.hull[1], T.ol, T.olw * 0.6);                                                                                  // 斷掉的槳架
    c.beginPath(); c.moveTo(1.9, -10.5); c.lineTo(3.4, -12.2); c.lineTo(2.8, -10); c.closePath(); f.paint(K.hull[1], T.ol, 0.5);
    mossStrand(H, 13.6, -11.4, 5); mossStrand(H, 9, -8.4, 3.5);
    f.ell(-1, 0.4, 16, 1.6); c.strokeStyle = K.waterHi; c.lineWidth = 0.7; c.stroke();
    c.restore();
  }
  function ribs(H, o) {
    const c = H.c, T = H.T, f = H.f, x0 = o.cx - o.rx * 0.35, y = o.cy + 1.5;
    c.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * 4.2, h = 7.5 - Math.abs(i - 1.3) * 1.3;
      c.beginPath(); c.moveTo(x - 1.5, y); c.quadraticCurveTo(x - 2.4, y - h, x + 2.4, y - h * 1.05);
      c.strokeStyle = T.ol; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = K.bone; c.lineWidth = 1.3; c.stroke();
      f.ell(x - 1.5, y + 0.3, 2, 0.7); c.strokeStyle = K.waterHi; c.lineWidth = 0.5; c.stroke();
    }
    c.beginPath(); c.moveTo(x0 - 3, y - 0.5); c.lineTo(x0 + 15, y - 0.8); c.strokeStyle = T.ol; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = K.boneD; c.lineWidth = 1; c.stroke();
  }

  // ── 木棧道（水道上的路面）
  function boardwalk(H, cr) {
    const c = H.c, T = H.T, f = H.f, R = H.R;
    const along = cr.ux ? cr.o.rx : cr.o.ry, span = along * 1.12;
    c.save(); c.translate(cr.x, cr.y); c.rotate(Math.atan2(cr.uy, cr.ux));
    // 底下陰影＋橫梁
    f.rr(-span, -12, span * 2, 27, 1); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
    for (const yy of [-14.2, 12.2]) { f.rr(-span - 1, yy, span * 2 + 2, 2.4, 0.8); f.paint(K.beam, T.ol, T.olw * 0.6); }
    // 木板（垂直路的方向）
    for (let x = -span; x < span - 0.5; x += 4.3) {
      const j = (R() - 0.5) * 1.4, w = 3.9, top = -13.6 + j * 0.6, h = 27.2 + j;
      f.rr(x, top, w, h, 0.8); f.paint(K.plank[Math.floor(R() * 3)], T.ol, T.olw * 0.5);
      c.fillStyle = K.plankTop; c.fillRect(x + 0.7, top + 1, 0.8, h - 2);
      c.fillStyle = "rgba(30,20,10,.6)"; f.circ(x + w / 2, top + 1.8, 0.4); c.fill(); f.circ(x + w / 2, top + h - 1.8, 0.4); c.fill();
      if (R() < 0.18) { c.beginPath(); c.moveTo(x + 1.2, top + 5 + R() * 6); c.lineTo(x + 2.6, top + 12 + R() * 6); c.strokeStyle = "rgba(40,26,12,.5)"; c.lineWidth = 0.45; c.stroke(); }
    }
    // 兩端與中間的木樁＋繩
    const posts = [-span - 1.5, 0, span + 1.5];
    for (const yy of [-16.5, 15.5]) {
      c.beginPath(); c.moveTo(posts[0], yy - 4); c.quadraticCurveTo(posts[0] / 2, yy - 1.6, 0, yy - 4); c.quadraticCurveTo(posts[2] / 2, yy - 1.6, posts[2], yy - 4);
      c.strokeStyle = T.ol; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = K.rope; c.lineWidth = 0.7; c.stroke();
      for (const px of posts) { f.rr(px - 1.7, yy - 5.5, 3.4, 7.5, 0.8); f.paint(K.post, T.ol, T.olw * 0.6); f.ell(px, yy - 5.5, 1.7, 0.75); f.paint(K.postTop, null); }
    }
    c.restore();
  }

  // ── 出怪口：中空巨木（朽木樹洞）
  function hollowTree(H, e) {
    const c = H.c, T = H.T, f = H.f, R = H.R;
    c.save();
    if (e.side === "R") { c.translate(300, 0); c.scale(-1, 1); }
    c.translate(0, e.y);
    c.lineCap = "round"; c.lineJoin = "round";
    f.ell(22, 18, 34, 7); c.fillStyle = "rgba(0,0,10,.4)"; c.fill();
    // 樹根（先畫，樹幹蓋在上面）
    const roots = [[38, 15, 48, 19, 58, 26], [22, 17, 26, 23, 31, 27], [2, 17, 2, 23, 6, 28], [34, -18, 44, -22, 56, -28]];
    for (const [x1, y1, cx, cy, x2, y2] of roots) {
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.strokeStyle = T.ol; c.lineWidth = 6.2; c.stroke();
      c.strokeStyle = K.bark[1]; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.moveTo(x1, y1 - 0.8); c.quadraticCurveTo(cx, cy - 0.8, x2, y2 - 0.6); c.strokeStyle = K.barkHi; c.lineWidth = 0.8; c.stroke();
    }
    // 樹幹（往上伸出畫面）
    const trunk = () => { c.beginPath(); c.moveTo(-12, 22); c.lineTo(-12, -62); c.lineTo(30, -62); c.bezierCurveTo(31, -46, 37, -34, 40, -24); c.bezierCurveTo(42, -16, 34, -14, 32, -8); c.lineTo(32, 8); c.bezierCurveTo(36, 12, 44, 14, 52, 19); c.quadraticCurveTo(40, 23, 28, 20); c.quadraticCurveTo(12, 25, -2, 20); c.closePath(); };
    trunk(); c.fillStyle = (() => { const g = c.createLinearGradient(-12, 0, 44, 0); g.addColorStop(0, K.bark[2]); g.addColorStop(0.55, K.bark[1]); g.addColorStop(1, K.bark[0]); return g; })(); c.fill();
    c.strokeStyle = T.ol; c.lineWidth = T.olw * 1.3; c.stroke();
    c.save(); trunk(); c.clip();
    for (let i = 0; i < 8; i++) { const x = -8 + i * 5.5 + R() * 2; c.beginPath(); c.moveTo(x, -60); c.bezierCurveTo(x + 3, -38, x - 3, -22, x + (i - 3) * 1.4, 20); c.strokeStyle = K.barkLine; c.lineWidth = 0.9; c.stroke(); }
    c.beginPath(); c.moveTo(33, -44); c.bezierCurveTo(35, -34, 38, -26, 37, -20); c.moveTo(36, 12); c.quadraticCurveTo(42, 15, 48, 17); c.strokeStyle = K.barkHi; c.lineWidth = 1.3; c.stroke();
    // 苔蘚斑
    for (const [x, y, r] of [[4, -34, 5], [26, -30, 3.5], [-4, 8, 4], [38, 15, 3]]) { f.ell(x, y, r, r * 0.55); c.fillStyle = "rgba(110,150,80,.55)"; c.fill(); }
    c.restore();
    // 樹洞
    f.ell(18, -0.5, 12.5, 15); c.fillStyle = (() => { const g = c.createRadialGradient(16, 1, 1, 18, 0, 16); g.addColorStop(0, K.hollow[1]); g.addColorStop(1, K.hollow[0]); return g; })(); c.fill();
    c.strokeStyle = T.ol; c.lineWidth = T.olw * 1.5; c.stroke();
    c.beginPath(); c.ellipse(18, -0.5, 12.5, 15, 0, -2.5, 0.9); c.strokeStyle = K.hollowRim; c.lineWidth = 2.2; c.stroke();
    c.beginPath(); c.ellipse(18, -0.5, 14.2, 16.8, 0, -2.6, -0.6); c.strokeStyle = K.barkHi; c.lineWidth = 0.7; c.stroke();
    // 樹洞邊的木刺
    for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.5, tx = 18 + Math.cos(a) * 12.1, ty = -0.5 + Math.sin(a) * 14.6; f.poly([[tx - 1.4, ty - 0.4], [tx + 1.4, ty - 0.4], [tx - Math.cos(a) * 2.8, ty - Math.sin(a) * 2.8 + 1]]); f.paint(K.hollowRim, T.ol, 0.5); }
    f.glow(19, 1, 19, T.enemyGlow, 0.4);
    for (const [x, y] of [[14, -4], [20, 5]]) { f.glow(x, y, 4, T.eyeGlow, 0.7); f.circ(x - 1.1, y, 0.75); f.paint(T.enemyEye, null); f.circ(x + 1.1, y, 0.75); f.paint(T.enemyEye, null); }
    for (let i = 0; i < 4; i++) { f.circ(28 + i * 4, -2 + R() * 6, 4.5 - i * 0.6); c.fillStyle = "rgba(160,220,170,.16)"; c.fill(); }
    // 伸出的大樹枝＋垂苔（在路的上方，不擋路）
    c.beginPath(); c.moveTo(30, -31); c.bezierCurveTo(40, -34, 48, -30, 62, -37); c.strokeStyle = T.ol; c.lineWidth = 5.6; c.stroke(); c.strokeStyle = K.bark[1]; c.lineWidth = 3.4; c.stroke();
    c.beginPath(); c.moveTo(44, -32); c.lineTo(52, -42); c.strokeStyle = T.ol; c.lineWidth = 3.6; c.stroke(); c.strokeStyle = K.bark[1]; c.lineWidth = 1.8; c.stroke();
    for (const [x, y, h] of [[32, -32, 9], [39, -32.5, 12], [47, -32, 8], [55, -35, 10], [8, -40, 10], [18, -36, 7]]) mossStrand(H, x, y, h);
    // 樹上的發光層孔菌
    for (const [x, y, s] of [[-2, -26, 1], [2, -19, 0.8], [-6, -12, 0.7], [36, -22, 0.8]]) {
      f.glow(x + 2, y, 6 * s, K.shroomGlow, 0.45);
      c.beginPath(); c.ellipse(x + 2, y, 4 * s, 1.8 * s, 0, Math.PI, 0); c.closePath(); f.paint(K.shroom, T.ol, T.olw * 0.55);
    }
    // 根旁的小骨頭（溫和）
    bones(H, 42, 32, 0.8);
    c.restore();
  }
  function mossStrand(H, x, y, h) {
    const c = H.c;
    c.beginPath(); c.moveTo(x - 1.6, y); c.quadraticCurveTo(x - 1.2, y + h * 0.5, x + 0.3, y + h); c.quadraticCurveTo(x + 0.6, y + h * 0.5, x + 1.6, y); c.closePath();
    c.fillStyle = K.moss2; c.fill(); c.strokeStyle = "rgba(12,17,34,.55)"; c.lineWidth = 0.5; c.stroke();
    c.beginPath(); c.moveTo(x - 0.4, y + 1); c.quadraticCurveTo(x - 0.3, y + h * 0.5, x + 0.3, y + h * 0.9); c.strokeStyle = K.moss; c.lineWidth = 0.7; c.stroke();
  }
  function bones(H, x, y, s) {
    const c = H.c, T = H.T, f = H.f;
    c.lineCap = "round";
    for (const a of [0.5, -0.6]) { c.beginPath(); c.moveTo(x - Math.cos(a) * 5 * s, y - Math.sin(a) * 2 * s); c.lineTo(x + Math.cos(a) * 5 * s, y + Math.sin(a) * 2 * s); c.strokeStyle = T.ol; c.lineWidth = 2.4 * s; c.stroke(); c.strokeStyle = K.bone; c.lineWidth = 1.1 * s; c.stroke(); }
    f.circ(x + 5 * s, y - 2.6 * s, 2.6 * s); f.paint(K.bone, T.ol, T.olw * 0.55);
    f.rr(x + 3.6 * s, y - 1.2 * s, 2.8 * s, 1.6 * s, 0.5); f.paint(K.bone, T.ol, T.olw * 0.45);
    f.circ(x + 4.1 * s, y - 2.8 * s, 0.6 * s); c.fillStyle = T.ol; c.fill(); f.circ(x + 6 * s, y - 2.8 * s, 0.6 * s); c.fill();
  }

  // ── 裝飾物
  function mossTree(H, x, y, s) {   // 垂苔沼澤樹（板根＋扁樹冠＋垂掛苔蘚）
    const c = H.c, T = H.T, f = H.f, R = H.R;
    f.shadow(x + 2.5 * s, y + 0.5, 10 * s, 3.4 * s);
    c.beginPath(); c.moveTo(x - 6 * s, y + 0.5); c.quadraticCurveTo(x - 2.4 * s, y - 2 * s, x - 1.8 * s, y - 10 * s); c.lineTo(x - 1.2 * s, y - 18 * s); c.lineTo(x + 1.6 * s, y - 18 * s); c.lineTo(x + 2 * s, y - 10 * s); c.quadraticCurveTo(x + 2.6 * s, y - 2 * s, x + 6.5 * s, y + 0.5); c.quadraticCurveTo(x + 2 * s, y - 0.6 * s, x + 0.3 * s, y + 1); c.quadraticCurveTo(x - 1.6 * s, y - 0.6 * s, x - 6 * s, y + 0.5); c.closePath();
    f.paint(K.bark[1], T.ol, T.olw * 0.9);
    c.beginPath(); c.moveTo(x + 1 * s, y - 16 * s); c.lineTo(x + 1.4 * s, y - 4 * s); c.strokeStyle = K.barkHi; c.lineWidth = 0.7; c.stroke();
    for (const [a, b, cc, d] of [[0, -15, -8, -20], [0.5, -16, 8, -22]]) { c.beginPath(); c.moveTo(x + a * s, y + b * s); c.lineTo(x + cc * s, y + d * s); c.strokeStyle = T.ol; c.lineWidth = 3 * s; c.lineCap = "round"; c.stroke(); c.strokeStyle = K.bark[1]; c.lineWidth = 1.4 * s; c.stroke(); }
    const g = K.canopy[Math.floor(R() * K.canopy.length)];
    f.union([() => f.ell(x - 7 * s, y - 21 * s, 6.5 * s, 3.6 * s), () => f.ell(x + 7 * s, y - 22 * s, 6.8 * s, 3.8 * s), () => f.ell(x, y - 25 * s, 8 * s, 4.4 * s)], g[1]);
    f.ell(x - 1.5 * s, y - 26.5 * s, 5 * s, 2.4 * s); f.paint(g[0], null); f.ell(x + 6.5 * s, y - 23.4 * s, 3.6 * s, 1.8 * s); f.paint(g[0], null);
    f.ell(x - 3 * s, y - 27.6 * s, 1.8 * s, 0.8 * s); f.paint("rgba(255,255,255,.3)", null);
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const mx = x + (-12 + i * 24 / (n - 1) + (R() - 0.5) * 2) * s, my = y - (20.5 - Math.abs(i - (n - 1) / 2) * 0.6) * s; mossStrand(H, mx, my, (5 + R() * 6) * s); }
  }
  function snag(H, x, y, s) {   // 枯樹＋垂苔
    H.f.deadTree(x, y, s);
    for (const [a, b, h] of [[-6, -15, 7], [5, -18, 6], [8, -21, 8], [-8, -19, 5]]) if (H.R() < 0.8) mossStrand(H, x + a * s, y + b * s, h * s);
  }
  function cattails(H, x, y) {
    const c = H.c, T = H.T, f = H.f, R = H.R, n = 3 + Math.floor(R() * 3);
    c.lineCap = "round";
    for (let i = 0; i < n; i++) {   // 葉片
      const qx = x + (i - n / 2) * 1.8, h = 5 + R() * 4, lean = (i - n / 2) * 0.9;
      c.beginPath(); c.moveTo(qx, y); c.quadraticCurveTo(qx + lean * 0.3, y - h * 0.6, qx + lean, y - h); c.strokeStyle = T.ol; c.lineWidth = 1.7; c.stroke(); c.strokeStyle = K.cattail; c.lineWidth = 0.9; c.stroke();
    }
    for (let i = 0; i < 3; i++) {   // 香蒲穗
      if (i === 2 && R() < 0.5) break;
      const qx = x + (i - 1) * 2.4 + (R() - 0.5), h = 9 + R() * 4;
      c.beginPath(); c.moveTo(qx, y); c.lineTo(qx + (i - 1) * 0.6, y - h - 2.4); c.strokeStyle = T.ol; c.lineWidth = 1.3; c.stroke(); c.strokeStyle = "#8a9a62"; c.lineWidth = 0.55; c.stroke();
      f.rr(qx + (i - 1) * 0.5 - 1.1, y - h - 1.2, 2.2, 4.6, 1.1); f.paint(K.cattailHead, T.ol, T.olw * 0.5);
    }
  }
  function glowShroom(H, x, y) {
    const c = H.c, T = H.T, f = H.f, R = H.R, n = 2 + Math.floor(R() * 2);
    f.glow(x + 2, y - 3, 9, K.shroomGlow, 0.42);
    for (let k = 0; k < n; k++) {
      const mx = x + k * 3.2 - 1, my = y + (k % 2) * 1.2, s = k ? 0.7 : 1, h = (4.5 + R() * 2) * s;
      f.rr(mx - 0.55 * s, my - h, 1.1 * s, h, 0.4); f.paint(K.shroomStem, T.ol, T.olw * 0.45);
      c.beginPath(); c.ellipse(mx, my - h, 2.6 * s, 2 * s, 0, Math.PI, 0); c.closePath(); f.paint(K.shroom, T.ol, T.olw * 0.55);
      f.circ(mx - 0.8 * s, my - h - 1 * s, 0.45 * s); c.fillStyle = "#eafff8"; c.fill();
    }
  }
  function stump(H, x, y, s) {
    const c = H.c, T = H.T, f = H.f;
    f.shadow(x + 1.5, y + 0.5, 6 * s, 2.2 * s);
    f.cyl(x, y, 4.2 * s, 4.5 * s, K.bark[1], "#8a7456");
    f.ell(x, y - 4.5 * s, 2.6 * s, 1.1 * s); c.strokeStyle = "rgba(60,44,28,.7)"; c.lineWidth = 0.5; c.stroke();
    f.ell(x - 1.6 * s, y - 4.8 * s, 2 * s, 0.8 * s); c.fillStyle = "rgba(120,160,90,.75)"; c.fill();
  }
  function log(H, x, y, s, flip) {   // 倒木（長滿苔、有小蘑菇）
    const c = H.c, T = H.T, f = H.f;
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
    f.ell(1, 0.8, 14 * s, 2.6 * s); c.fillStyle = "rgba(0,0,10,.4)"; c.fill();
    f.rr(-12 * s, -6 * s, 22 * s, 6.4 * s, 3 * s); f.paint(K.bark[1], T.ol, T.olw * 0.8);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-9 * s + i * 6 * s, -4.4 * s); c.lineTo(-6 * s + i * 6 * s, -4.6 * s); c.strokeStyle = K.barkLine; c.lineWidth = 0.6; c.stroke(); }
    f.ell(10 * s, -2.8 * s, 2.6 * s, 3.3 * s); f.paint("#9a8060", T.ol, T.olw * 0.7);
    f.ell(10 * s, -2.8 * s, 1.3 * s, 1.7 * s); c.strokeStyle = "rgba(70,50,30,.7)"; c.lineWidth = 0.5; c.stroke();
    c.beginPath(); c.moveTo(-11 * s, -5 * s); c.quadraticCurveTo(-4 * s, -8 * s, 4 * s, -5.6 * s); c.quadraticCurveTo(0, -4.6 * s, -11 * s, -4 * s); c.closePath(); c.fillStyle = "rgba(120,160,90,.85)"; c.fill();
    for (const [mx, sc] of [[-6, 1], [-3.5, 0.75]]) { c.beginPath(); c.ellipse(mx * s, -6 * s, 1.8 * sc * s, 1.4 * sc * s, 0, Math.PI, 0); c.closePath(); f.paint(K.shroom, T.ol, 0.45); }
    c.restore();
    f.glow(x - 5 * s * (flip ? -1 : 1), y - 6 * s, 6, K.shroomGlow, 0.3);
  }
  function lanternPost(H, x, y) {   // 沼澤燈籠（木桿＋吊燈；ambient 再加閃爍）
    const c = H.c, T = H.T, f = H.f;
    f.shadow(x + 1.5, y + 0.5, 4.5, 1.6);
    f.rr(x - 1, y - 17, 2, 17.5, 0.6); f.paint(K.post, T.ol, T.olw * 0.6);
    f.rr(x - 1, y - 16.5, 7, 1.5, 0.5); f.paint(K.post, T.ol, T.olw * 0.5);
    c.beginPath(); c.moveTo(x + 5, y - 15); c.lineTo(x + 5, y - 13.2); c.strokeStyle = T.ol; c.lineWidth = 0.6; c.stroke();
    f.glow(x + 5, y - 10, 11, K.lanternGlow, 0.5);
    f.rr(x + 2.8, y - 13.2, 4.4, 5.8, 1.2); f.paint(K.lanternCore, K.lanternFrame, 0.9);
    c.beginPath(); c.moveTo(x + 5, y - 13); c.lineTo(x + 5, y - 7.6); c.strokeStyle = K.lanternFrame; c.lineWidth = 0.5; c.stroke();
    f.poly([[x + 2.4, y - 13.2], [x + 5, y - 15], [x + 7.6, y - 13.2]]); f.paint(K.lanternFrame, null);
  }
  function flagstone(H, x, y, s) {
    const c = H.c, T = H.T, f = H.f, R = H.R, n = 6, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * PI2 + R() * 0.4, r = (3.4 + R() * 1.6) * s; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62]); }
    f.poly(pts.map(([px, py]) => [px + 0.4, py + 0.9])); c.fillStyle = "rgba(0,0,10,.35)"; c.fill();
    f.poly(pts); f.paint(K.flag[Math.floor(R() * 2)], T.ol, T.olw * 0.55);
    f.poly(pts.slice(3).concat([pts[0]]).map(([px, py]) => [px, py - 0.5])); c.fillStyle = "rgba(255,255,255,.12)"; c.fill();
  }

  // ═════ 套件本體
  ART.REGION_KITS[2] = {
    replaceDecor: true,
    preRoad(H) {
      const c = H.c, T = H.T, P = H.P, R = H.R, L = P.castle;
      if (T.cave) T.cave = ["朽木樹洞", null];   // 出怪口換成中空巨木，地名跟著改
      S = planSwamp(H);
      S.lanterns = []; S.bub = []; S.wisp = []; S.fly = [];
      // 地面：整體提亮一點（怪在暗綠地上更清楚）＋苔蘚斑
      c.fillStyle = "rgba(130,160,110,.07)"; c.fillRect(0, 0, 300, 400);
      for (let i = 0; i < 16; i++) { const x = R() * 300, y = R() * 330, r = 14 + R() * 22; H.f.circ(x, y, r); c.fillStyle = H.f.rg(x, y, 0, r, ["rgba(140,180,100,.13)", "rgba(140,180,100,0)"]); c.fill(); }
      // 靠近城堡：乾地＋石板（地貌講故事：沼澤到這裡收乾）
      if (L.type === "bottom") {
        const gx = L.gx; c.save(); c.translate(gx, 410); c.scale(1.6, 1); H.f.circ(0, 0, 125); c.fillStyle = H.f.rg(0, 0, 10, 125, [K.dry.replace("A", 0.62), K.dry.replace("A", 0.4), K.dry.replace("A", 0)]); c.fill(); c.restore();
        for (let gy = S.dryY + 6; gy < L.wallTop - 4; gy += 10) for (let gxx = 6; gxx < 296; gxx += 12) {
          const x = gxx + (R() - 0.5) * 5, y = gy + (R() - 0.5) * 4, k = R();
          if (P.distRoad(x, y) < 18 || S.slotClose(x, y, 18) || S.castleBlock(x, y, 2)) continue;
          const dg = HY((x - gx) * 0.8, y - 400); if (k < 0.62 - dg / 230) flagstone(H, x, y, 1.05 + R() * 0.4);
        }
        // 乾草（黃綠小草叢）與乾裂紋
        c.lineCap = "round";
        for (let i = 0; i < 150; i++) {
          const x = R() * 300, y = S.dryY - 20 + R() * (L.wallTop - S.dryY + 14);
          if (P.distRoad(x, y) < 16 || S.slotClose(x, y, 14) || HY((x - gx) / 1.6, y - 410) > 120) continue;
          const sz = 1.6 + R() * 1.4; c.strokeStyle = K.dryTuft[i % 2]; c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(x - sz * 0.6, y - sz); c.lineTo(x, y); c.lineTo(x + sz * 0.6, y - sz); c.moveTo(x, y); c.lineTo(x, y - sz * 1.2); c.stroke();
        }
        for (let i = 0; i < 10; i++) {
          let x = 10 + R() * 280, y = S.dryY + 4 + R() * (L.wallTop - S.dryY - 14);
          if (P.distRoad(x, y) < 17 || S.slotClose(x, y, 18) || S.castleBlock(x, y, 4)) continue;
          c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += 2 + R() * 3; y += (R() - 0.5) * 3; c.lineTo(x, y); }
          c.strokeStyle = "rgba(60,46,26,.45)"; c.lineWidth = 0.6; c.stroke();
        }
      }
      for (const o of S.pools) drawPool(H, o);
      // 池中故事物件：最大的非水道池放沉船，次大的放巨獸肋骨
      const big = S.pools.filter(o => !o.cross && o.rx >= 17 && o.cx - o.rx > 6 && o.cx + o.rx < 294).sort((a, b) => b.rx * b.ry - a.rx * a.ry);
      if (big[0]) wreck(H, big[0]);
      if (big[1]) ribs(H, big[1]);
      // ambient 的發射點
      const RA = mulberryLite(2929);
      for (const o of S.pools) { const n = o.cross ? 1 : o.rx > 20 ? 3 : 2; for (let i = 0; i < n && S.bub.length < 14; i++) { const a = RA() * PI2, d = RA() * 0.5; const x = o.cx + Math.cos(a) * o.rx * d, y = o.cy + Math.sin(a) * o.ry * d; if (P.distRoad(x, y) < 15) continue; S.bub.push({ x, y, p: 2.2 + RA() * 2.4, ph: RA() }); } }
      const wsrc = S.pools.filter(o => !o.cross).slice(0, 4).map(o => [o.cx, o.cy - 8]);
      for (const e of P.entries) wsrc.push([e.side === "L" ? 26 : 274, e.y + 34]);
      for (const [x, y] of wsrc) if (S.wisp.length < 5) S.wisp.push({ x, y, p: RA() * PI2, s: 0.7 + RA() * 0.6 });
      for (let i = 0; i < 40 && S.fly.length < 8; i++) { const x = RA() * 300, y = 30 + RA() * 300; if (P.distRoad(x, y) < 16) continue; S.fly.push({ x, y, p: RA() * PI2, s: 0.6 + RA() * 0.8 }); }
    },
    postRoad(H) {
      if (!S) return;
      for (const cr of S.crossings) boardwalk(H, cr);
    },
    entrance(H, e) { hollowTree(H, e); return true; },
    decor(H) {
      if (!S) return;
      const P = H.P, R = H.R, items = [], tall = [];
      const land = (x, y, rd, sd) => P.distRoad(x, y) >= (rd || 18) && !S.slotClose(x, y, sd || 19) && !S.inEntry(x, y, 2) && S.waterDist(x, y) >= 4 && !S.castleBlock(x, y, 2) && x > -4 && x < 304;
      const wildOf = (x, y) => Math.max(0, 1 - Math.min(...P.entries.map(e => HY(x - e.x, y - e.y))) / 140);
      // 池邊的香蒲
      for (const o of S.pools) {
        const m = o.pts.length;
        for (let i = 0; i < m; i += 3) { const [px, py] = o.pts[i]; const x = o.cx + (px - o.cx) * 1.12, y = o.cy + (py - o.cy) * 1.12 + 1; if (R() < 0.45 && P.distRoad(x, y) >= 18 && !S.slotClose(x, y, 17) && !S.inEntry(x, y, 2) && !S.castleBlock(x, y, 2)) items.push({ y, f: () => cattails(H, x, y) }); }
      }
      // 網格散佈
      for (let gx = 4; gx < 300; gx += 10.5) for (let gy = 6; gy < 400; gy += 10.5) {
        const x = gx + (R() - 0.5) * 7, y = gy + (R() - 0.5) * 7, k = R(), r2 = R();
        if (!land(x, y)) continue;
        const wild = wildOf(x, y), dry = y > S.dryY;
        let isTall = !dry && k < (wild > 0.3 ? 0.17 : 0.12) && P.distRoad(x, y) > 24 && tall.every(p => HY(p[0] - x, p[1] - y) > 17);
        if (isTall && (P.distRoad(x, y - 22) < 17 || P.slotNear(x, y - 16, 19) || S.inEntry(x, y - 24, 2) || S.castleBlock(x, y - 26, 2) || P.distRoad(x - 10, y - 20) < 15 || P.distRoad(x + 10, y - 20) < 15)) isTall = false;
        if (isTall) { tall.push([x, y]); const s = 0.8 + r2 * 0.3; items.push({ y, f: () => (wild > 0.35 || r2 < 0.35 ? snag : mossTree)(H, x, y, s) }); continue; }
        if (dry) { if (k < 0.03) items.push({ y, f: () => H.f.rock(x, y, 0.5 + r2 * 0.3, R) }); continue; }
        if (k < 0.2 && S.waterDist(x, y) < 14) items.push({ y, f: () => cattails(H, x, y) });
        else if (k < 0.21) items.push({ y, f: () => H.f.rock(x, y, 0.45 + r2 * 0.35, R) });
        else if (k < 0.255 + wild * 0.05) items.push({ y, f: () => glowShroom(H, x, y) });
        else if (k < 0.27) items.push({ y, f: () => stump(H, x, y, 0.8 + r2 * 0.3) });
        else if (k < 0.32) items.push({ y, f: () => H.f.reedClump(x, y, R) });
      }
      // 倒木兩根、骨頭一處（遠離路的空地）
      const grid = []; for (let x = 14; x <= 286; x += 8) for (let y = 20; y <= S.dryY; y += 8) grid.push([x, y]);
      let nl = 0;
      for (let i = 0; i < grid.length && nl < 2; i++) {   // 用固定跳號走訪（散開又固定），找到兩處就停
        const [x, y] = grid[(i * 7919 + 13) % grid.length];
        if (P.distRoad(x, y) < 24 || P.entries.some(e => HY(x - (e.side === "L" ? 44 : 256), y - e.y - 49) < 36) || tall.some(p => HY(p[0] - x, p[1] - y) < 20) || !(land(x - 13, y, 19) && land(x + 13, y, 19) && land(x, y - 7, 19))) continue;
        tall.push([x, y]); const fl = nl % 2 === 1; items.push({ y, f: () => log(H, x, y, 0.9, fl) }); nl++;
      }
      // 沼澤燈籠：沿路每隔一段放一盞（靠近路但不壓路、不擋塔位）；最後一盞在城堡前
      const rt = P.routes[0], seg = rt.seg;
      const posAt = d => { for (const g of seg) if (d <= g.s + g.L) { const t = (d - g.s) / g.L; return { x: g.x1 + (g.x2 - g.x1) * t, y: g.y1 + (g.y2 - g.y1) * t, dx: Math.sign(g.x2 - g.x1), dy: Math.sign(g.y2 - g.y1) }; } return null; };
      const lampAt = [0.16, 0.36, 0.56, 0.76, 0.93];
      for (const fr of lampAt) {
        let done = false;
        for (let dd = 0; dd < 60 && !done; dd += 6) for (const sg of [1, -1]) {
          if (done) break;
          const p = posAt(fr * rt.len + dd * sg); if (!p) continue;
          for (const side of [1, -1]) {
            const x = p.x + (p.dy ? side * 20 : 0), y = p.y + (p.dx ? side * 20 : 0) + (p.dx && side < 0 ? 0 : 0);
            if (P.distRoad(x, y) < 18.5 || S.slotClose(x, y, 20) || S.slotClose(x + 5, y - 10, 16) || S.inEntry(x, y, 2) || S.castleBlock(x, y, 4) || S.waterDist(x, y) < 3 || x < 6 || x > 290) continue;
            if (S.lanterns.some(q => HY(q[0] - x, q[1] - y) < 40)) continue;
            S.lanterns.push([x + 5, y - 10]); items.push({ y, f: () => lanternPost(H, x, y) }); done = true; break;
          }
        }
      }
      items.sort((a, b) => a.y - b.y).forEach(it => it.f());
    },
    ambient(ctx, t, H) {
      if (!S) return;
      // 泡泡：慢慢鼓起→破掉成小圈
      ctx.lineWidth = 0.55;
      for (const b of S.bub) {
        const u = ((t / b.p + b.ph) % 1 + 1) % 1;
        if (u < 0.72) { const r = 0.4 + u * 1.5; ctx.strokeStyle = "rgba(200,245,215," + (0.25 + u * 0.7).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(b.x, b.y - u * 1.2, r, 0, PI2); ctx.stroke(); ctx.fillStyle = "rgba(240,255,245,.7)"; ctx.fillRect(b.x - r * 0.45, b.y - u * 1.2 - r * 0.55, 0.5, 0.5); }
        else if (u < 0.9) { const v = (u - 0.72) / 0.18, r = 1.6 + v * 3.2; ctx.strokeStyle = "rgba(200,245,215," + (0.7 * (1 - v)).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(b.x, b.y - 0.8, r, r * 0.45, 0, 0, PI2); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = "lighter";
      // 燈籠閃爍
      const gl = glowSprite(K.lanternGlow);
      if (gl) for (const [x, y] of S.lanterns) { const r = 9 + Math.sin(t * 7 + x) * 0.9 + Math.sin(t * 13 + y) * 0.5; ctx.globalAlpha = 0.32; ctx.drawImage(gl, x - r, y - r, r * 2, r * 2); }
      // 鬼火：藍綠色小火團慢慢飄，忽明忽暗，帶兩顆尾巴
      const gw = glowSprite("rgba(120,255,225,A)");
      if (gw) for (const w of S.wisp) {
        const vis = Math.max(0, Math.sin(t * 0.35 * w.s + w.p) * 0.6 + 0.55); if (vis <= 0.02) continue;
        for (let k = 1; k >= 0; k--) {
          const tt = t - k * 0.3, x = w.x + Math.sin(tt * 0.45 * w.s + w.p) * 14, y = w.y + Math.sin(tt * 0.7 * w.s + w.p * 1.7) * 6 - Math.sin(tt * 2.1 + w.p) * 1.5;
          const r = (k ? 4 : 7) * (0.9 + 0.1 * Math.sin(t * 9 + w.p)), a = vis * (k ? 0.32 : 0.8) * (0.8 + 0.2 * Math.sin(t * 5.3 + w.p));
          ctx.globalAlpha = Math.min(1, a); ctx.drawImage(gw, x - r, y - r, r * 2, r * 2);
          if (!k) { ctx.globalAlpha = Math.min(1, vis); ctx.fillStyle = "#e8fff8"; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, PI2); ctx.fill(); }
        }
      }
      // 螢光：黃綠小點
      const gf = glowSprite("rgba(210,255,120,A)");
      if (gf) for (const m of S.fly) {
        const x = m.x + Math.sin(t * 0.6 * m.s + m.p) * 7, y = m.y + Math.cos(t * 0.45 * m.s + m.p * 1.3) * 5, a = Math.max(0, 0.15 + 0.5 * Math.sin(t * 2.3 * m.s + m.p));
        if (a < 0.03) continue;
        ctx.globalAlpha = a; ctx.drawImage(gf, x - 3.5, y - 3.5, 7, 7); ctx.fillStyle = "#f4ffd0"; ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  };
})();
