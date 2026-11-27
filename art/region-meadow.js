// 區域套件：新手草原（REGION 0）— 第二刀（2026-11-21）。介面見 art/CONTRACT.md「第二刀」與 art/art-map.js 的 ART.REGION_KITS 說明。
// 主題：月光下的田園。地貌講故事——出怪口是暗林小徑（灌木缺口＋野狼警示牌＋路上狼腳印），越往城堡越整齊：
//   入口一帶＝荒草、石頭、荊棘；中段＝牧場（風車、綿羊、花海、乾草堆、小溪與兩座木橋）；城堡前＝犁田、麥田、稻草人、農舍、花籬笆。
// 全部自繪向量（canvas Path）；不用 emoji、不用外部圖檔。裝飾避開路（distRoad ≥ 18）、塔位、城堡、水。
// ambient：風車扇葉轉動、蝴蝶、蜜蜂、麥田螢火蟲、農舍炊煙（粒子共 20 個）。
(function () {
  "use strict";
  const ART = window.ART = window.ART || {};
  ART.REGION_KITS = ART.REGION_KITS || {};
  const PI2 = Math.PI * 2, HY = Math.hypot;

  // 草原配色（在 B 星夜主題家族內，偏暖）
  const K = {
    soil: "#6e5034", soilL: "#8c6845", soilD: "#4a3424", sprout: "#8ccc70", sprout2: "#5e9c52",
    wheat: "#b8903e", wheatL: "#f0d88a", wheatM: "#d8b45e", wheatD: "#7c5c26",
    hay: ["#9c722e", "#d2a650", "#f0cf7a"], hayLine: "#80601f",
    plaster: ["#a8987a", "#d6c8a8", "#efe4c8"], roof: ["#7a3428", "#a84a36", "#c8664a"], roofLine: "rgba(30,8,4,.35)",
    timber: "#5e4028", door: "#4e3220", win: "#ffdc8e",
    wool: "#eef0f6", woolS: "#c4cada", face: "#2c2838",
    sail: "#efe4c8", sailLine: "#a8946c",
    signRed: "#c8455a", wolf: "#2a1a28", paw: "rgba(52,34,20,.5)",
    hedge: [["#2c4a3c", "#1a3028"], ["#34543f", "#1e362c"]]
  };

  // ── 幾何：避讓檢查（路、塔位、水、自家小溪、城堡、出怪口、已放的大件）
  function streamDist(S, x, y) {
    if (!S.stream) return 1e9;
    let d = 1e9; const p = S.stream;
    for (let i = 1; i < p.length; i++) {
      const x1 = p[i - 1][0], y1 = p[i - 1][1], x2 = p[i][0], y2 = p[i][1], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2)) : 0;
      d = Math.min(d, HY(x - x1 - dx * t, y - y1 - dy * t));
    }
    return d;
  }
  function inCastle(P, x, y) {
    const L = P.castle;
    if (L.type === "bottom") {
      if (y > L.wallTop - 7) return true;
      if (Math.abs(x - L.gx) < 24 && y > L.gateTop - 10) return true;
      return L.towers.some(t => Math.abs(x - t.x) < t.r + 5 && y > 404 - t.h - 8 - t.roof - 18);
    }
    const b = L.bbox; return x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 - 4 && y < b.y1 + 4;
  }
  function nearEntry(P, x, y, r) { return P.entries.some(e => HY(x - e.x, y - e.y) < r); }
  function hitRes(S, x, y, pad) { return S.res.some(b => x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad); }
  // 底點 (x,y) 半徑 r、往上高 h 的東西放得下嗎
  function fits(H, S, x, y, r, h, opt) {
    const P = H.P; opt = opt || {};
    if (x < -2 || x > 302 || y < 4 || y > 400) return false;
    for (const [px, py] of [[x, y], [x - r, y], [x + r, y], [x, y - h], [x - r * 0.7, y - h * 0.6], [x + r * 0.7, y - h * 0.6]]) {
      if (P.distRoad(px, py) < (py === y ? 18 : 16)) return false;
      if (P.slotNear(px, py, py === y ? 19 : 16)) return false;
      if (inCastle(P, px, py)) return false;
    }
    if (P.distWater(x, y) < 4 + r || streamDist(S, x, y) < 7 + r) return false;
    if (!opt.entryOk && nearEntry(P, x, y, 40)) return false;
    if (!opt.resOk && hitRes(S, x, y, r * 0.6)) return false;
    return true;
  }
  const reserve = (S, x0, y0, x1, y1) => S.res.push({ x0, y0, x1, y1 });

  // ── 版面：草原地圖手調位置；其他地圖每件都過 fits()，放不下就略過
  function layout(H) {
    const P = H.P, m = H.m, meadow = m.id === "meadow";
    const S = { res: [], stream: null, bridges: [], fields: [], mill: null, house: null, hives: [], sheep: [], hay: [], bales: [], scare: null, bloom: [], trees: [], bugs: [], flies: [] };
    if (meadow) {
      // 小溪：北邊樹林流下來，過兩座木橋，流進牧場池塘
      const o = P.ponds[0];
      if (o && Math.abs(o.x - 150) < 12 && Math.abs(o.y - 199) < 12) {
        const ex = o.x + o.rx * 0.68, ey = o.y - o.ry * 0.74;
        S.stream = [[214, -6], [211, 10], [216, 26], [212, 50], [210, 70], [218, 88], [212, 106], [205, 126], [202, 150], [196, 166], [ex + 8, ey - 7], [ex, ey]];
        if (!S.stream.some(([x, y]) => P.slotNear(x, y, 20))) S.bridges.push({ x: 212, y: 50 }, { x: 202, y: 150 });
        else S.stream = null;
      }
      S.fields.push({ k: "plow", x0: 70, y0: 271, x1: 128, y1: 311 });
      S.fields.push({ k: "wheat", x0: 172, y0: 270, x1: 232, y1: 321 });
      S.scare = { x: 203, y: 302 };
      S.mill = { x: 208, y: 231 };
      S.house = { x: 31, y: 347 };
      S.hives = [{ x: 281, y: 316 }, { x: 293, y: 322 }];
      S.sheep = [{ x: 283, y: 112, s: 1, d: -1 }, { x: 292, y: 128, s: 0.8, d: 1 }, { x: 276, y: 134, s: 0.95, d: 1 }, { x: 285, y: 188, s: 1, d: -1 }, { x: 128, y: 230, s: 0.95, d: 1 }];
      S.hay = [{ x: 237, y: 229, s: 0.9 }, { x: 122, y: 330, s: 1 }];
      S.bales = [{ x: 58, y: 316 }, { x: 152, y: 312 }];
      S.bloom = [{ x: 100, y: 217, rx: 16, ry: 9 }, { x: 287, y: 298, rx: 11, ry: 6 }, { x: 34, y: 205, rx: 10, ry: 7 }];
      S.trees = [[80, 30, "dark", 1.05], [94, 27, "bush", 1], [126, 30, "round", 0.95], [152, 25, "bush", 0.9], [180, 30, "round", 1], [240, 29, "round", 0.95], [264, 24, "pine", 1], [292, 31, "round", 1.05],
        [62, 126, "round", 0.95], [18, 140, "dark", 0.9], [12, 234, "round", 1], [287, 272, "fruit", 1], [94, 133, "bush", 0.9], [234, 132, "bush", 0.85], [285, 160, "round", 0.9]];
    } else {
      // 通用（未知地圖）：只放風車、田、羊，位置自動找
      const tryPut = (w, h, fn) => { for (let y = 360; y > 60; y -= 7) for (let x = 20; x < 280; x += 7) if (fits(H, S, x, y, w, h)) { fn(x, y); return; } };
      tryPut(10, 44, (x, y) => { S.mill = { x, y }; });
    }
    // 出怪口的警示牌、地名標籤留白（散佈的小件不要蓋上去）
    for (const e of P.entries) if (e.side === "L" && e.y <= 120) { reserve(S, 38, e.y - 46, 70, e.y - 15); reserve(S, 18, e.y + 42, 70, e.y + 56); reserve(S, -6, e.y - 50, 40, e.y - 15); }
    // 檢查每件大東西，放不下的拿掉；放下的登記佔位
    S.fields = S.fields.filter(fd => {
      for (let x = fd.x0; x <= fd.x1; x += 4) for (let y = fd.y0; y <= fd.y1; y += 4) if (H.P.distRoad(x, y) < 17.5 || H.P.slotNear(x, y, 19) || H.P.distWater(x, y) < 3) return false;
      reserve(S, fd.x0 - 2, fd.y0 - 4, fd.x1 + 2, fd.y1 + 2); return true;
    });
    if (S.mill && !fits(H, S, S.mill.x, S.mill.y, 10, 44)) S.mill = null;
    if (S.mill) { S.mill.hy = S.mill.y - 31; S.mill.r = 17; reserve(S, S.mill.x - 14, S.mill.y - 50, S.mill.x + 14, S.mill.y + 3); }
    if (S.house && !fits(H, S, S.house.x, S.house.y, 18, 30, { resOk: true })) S.house = null;
    if (S.house) reserve(S, S.house.x - 20, S.house.y - 34, S.house.x + 20, S.house.y + 3);
    const keep = (arr, r, h, w) => arr.filter(o => { if (!fits(H, S, o.x, o.y, r, h)) return false; reserve(S, o.x - (w || r), o.y - h, o.x + (w || r), o.y + 2); return true; });
    S.hives = keep(S.hives, 6, 13);
    S.sheep = keep(S.sheep, 7, 10);
    S.hay = keep(S.hay, 8, 11);
    S.bales = keep(S.bales, 6, 8);
    S.logs = keep(meadow ? [{ x: 172, y: 116 }, { x: 22, y: 172 }] : [], 8, 6);
    S.bloom = S.bloom.filter(b => { if (!fits(H, S, b.x, b.y + b.ry, b.rx, b.ry * 2 + 3, { resOk: true })) return false; reserve(S, b.x - b.rx, b.y - b.ry - 2, b.x + b.rx, b.y + b.ry); return true; });
    if (S.scare && !S.fields.some(f => f.k === "wheat")) S.scare = null;
    S.trees = S.trees.filter(([x, y, k, s]) => {
      const h = k === "bush" ? 9 * s : 22 * s, r = k === "bush" ? 6 * s : 8 * s;
      if (!fits(H, S, x, y, r, h, { entryOk: true })) return false; reserve(S, x - r, y - h, x + r, y + 2); return true;
    });
    // 環境粒子錨點（蝴蝶在花叢、蜜蜂在蜂箱、螢火蟲在麥田與牧場）
    const R = H.f.mulberry(4096);
    const anchors = [].concat(S.bloom.map(b => [b.x, b.y - 4]), S.bloom.length ? [[S.bloom[0].x + 10, S.bloom[0].y - 2]] : [], S.house ? [[S.house.x + 26, S.house.y - 30]] : [], [[130, 96]], S.fields.filter(f => f.k === "wheat").map(f => [(f.x0 + f.x1) / 2 - 8, f.y0 + 6]));
    for (let i = 0; i < 6 && anchors.length; i++) { const a = anchors[i % anchors.length]; S.flies.push({ x: a[0], y: a[1], p: R() * PI2, s: 0.7 + R() * 0.6, col: ["#fff2a0", "#ffc4e0", "#b4e2ff", "#fff8e8"][i % 4] }); }
    const ff = [];
    for (const fd of S.fields) for (let i = 0; i < 4; i++) ff.push([fd.x0 + 6 + R() * (fd.x1 - fd.x0 - 12), fd.y0 + 4 + R() * (fd.y1 - fd.y0 - 8)]);
    if (S.mill) ff.push([S.mill.x - 30, S.mill.y - 20]);
    S.glows = ff.slice(0, 8).map(([x, y]) => ({ x, y, p: R() * PI2, s: 0.6 + R() * 0.8 }));
    for (const hv of S.hives) for (let i = 0; i < 2 && S.bugs.length < 3; i++) S.bugs.push({ x: hv.x, y: hv.y - 8, p: R() * PI2, s: 1 + R() });
    return S;
  }

  // ═════ 平面地形（路之前）：暖光、小溪、田地
  function warmWash(H) {
    const { c, P } = H, [ex, ey] = P.end;
    c.save(); c.globalCompositeOperation = "soft-light";
    c.fillStyle = H.f.rg(ex, ey - 40, 0, 230, ["rgba(255,214,140,.55)", "rgba(255,214,140,0)"]); c.fillRect(0, 0, 300, 400);
    c.restore();
    // 牧場一帶：割過的草紋（淡淡的斜條，越靠城堡越整齊）
    c.save(); c.lineCap = "round";
    c.strokeStyle = "rgba(190,235,150,.07)"; c.lineWidth = 4.5; c.beginPath();
    for (let y = 170; y < 360; y += 10) for (let x = 4; x < 300; x += 22) {
      const xx = x + ((y / 10) % 2) * 11;
      if (P.distRoad(xx, y) < 21 || P.slotNear(xx, y, 18) || nearEntry(P, xx, y, 130) || P.distWater(xx, y) < 8) continue;
      c.moveTo(xx - 7, y); c.lineTo(xx + 7, y);
    }
    c.stroke();
    c.restore();
  }
  function streamSpline(c, p, dy) {
    c.beginPath(); c.moveTo(p[0][0], p[0][1] + (dy || 0));
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; c.quadraticCurveTo(p[i][0], p[i][1] + (dy || 0), mx, my + (dy || 0)); }
    const l = p[p.length - 1]; c.lineTo(l[0], l[1] + (dy || 0));
  }
  function drawStream(H, S) {
    const { c, T, f } = H, p = S.stream; if (!p) return;
    c.save(); c.lineJoin = "round"; c.lineCap = "round";
    streamSpline(c, p, 1.5); c.strokeStyle = "rgba(0,0,10,.3)"; c.lineWidth = 13; c.stroke();
    streamSpline(c, p); c.strokeStyle = T.ol; c.lineWidth = 12; c.stroke();
    streamSpline(c, p); c.strokeStyle = "#5a7a44"; c.lineWidth = 9.6; c.stroke();   // 岸邊濕草
    streamSpline(c, p); c.strokeStyle = T.waterDeep; c.lineWidth = 7.4; c.stroke();
    streamSpline(c, p); c.strokeStyle = T.water; c.lineWidth = 3.6; c.stroke();
    c.setLineDash([2.5, 4]); streamSpline(c, p); c.strokeStyle = T.waterLight; c.lineWidth = 1; c.stroke(); c.setLineDash([]);
    c.restore();
    // 岸邊：石頭、蘆葦、小花
    const P = H.P;
    for (const [x, y, k] of [[219, 18, "rock"], [205, 82, "reed"], [224, 96, "rock"], [198, 118, "reed"], [214, 120, "flw"], [205, 26, "reed"], [190, 176, "reed"]]) {
      if (P.distRoad(x, y) < 17 || P.slotNear(x, y, 17)) continue;
      if (k === "rock") f.rock(x, y, 0.55, H.R); else if (k === "reed") f.reedClump(x, y, H.R); else f.flowers(x, y, H.R);
    }
  }
  function fieldPlow(H, fd) {
    const { c, T, f } = H, { x0, y0, x1, y1 } = fd, w = x1 - x0, h = y1 - y0;
    f.shadow((x0 + x1) / 2 + 1.5, y1 + 1, w / 2 + 2, 3, 0.25);
    f.rr(x0 - 1.6, y0 - 1.6, w + 3.2, h + 3.2, 4); f.paint(K.soilD, T.ol, T.olw);
    f.rr(x0, y0, w, h, 3); f.paint(K.soil, null);
    c.save(); f.rr(x0, y0, w, h, 3); c.clip();
    for (let y = y0 + 3.5, r = 0; y < y1 - 1; y += 5, r++) {
      c.fillStyle = K.soilL; c.fillRect(x0, y - 1.5, w, 2.3);
      c.fillStyle = "rgba(20,10,4,.38)"; c.fillRect(x0, y + 0.9, w, 1.1);
      c.beginPath();
      for (let x = x0 + 3 + (r % 2) * 2.2; x < x1 - 2; x += 4.4) { c.moveTo(x - 1.2, y - 2.6); c.lineTo(x, y - 0.8); c.lineTo(x + 1.2, y - 2.6); c.moveTo(x, y - 0.8); c.lineTo(x, y - 3.2); }
      c.strokeStyle = K.sprout2; c.lineWidth = 1.5; c.lineCap = "round"; c.stroke();
      c.strokeStyle = K.sprout; c.lineWidth = 0.75; c.stroke();
    }
    c.fillStyle = H.f.lg(0, y0, 0, y1, ["rgba(255,230,170,.12)", "rgba(0,0,0,.10)"]); c.fillRect(x0, y0, w, h);
    c.restore();
    f.rr(x0 - 1.6, y0 - 1.6, w + 3.2, h + 3.2, 4); f.paint(null, T.ol, T.olw);
  }
  function fieldWheat(H, fd) {
    const { c, T, f } = H, { x0, y0, x1, y1 } = fd, w = x1 - x0, h = y1 - y0;
    f.shadow((x0 + x1) / 2 + 1.5, y1 + 1, w / 2 + 2, 3, 0.25);
    f.rr(x0 - 1.6, y0 - 1.6, w + 3.2, h + 3.2, 4); f.paint(K.wheatD, T.ol, T.olw);
    f.rr(x0, y0, w, h, 3); f.paint(f.lg(0, y0, 0, y1, [K.wheatM, K.wheat]), null);
    c.save(); f.rr(x0, y0, w, h + 0.5, 3); c.clip(); c.lineCap = "round";
    const R = f.mulberry(31 + x0);
    for (let y = y0 + 4, r = 0; y < y1 + 2; y += 4.6, r++) {
      c.fillStyle = "rgba(90,60,20,.32)"; c.fillRect(x0, y + 0.6, w, 1);
      const stalks = new Path2D(), heads = new Path2D();
      for (let x = x0 + 1.5 + (r % 2) * 1.7; x < x1 - 1; x += 3.4) {
        const lean = (R() - 0.5) * 1.6, hh = 3.6 + R() * 1.2;
        stalks.moveTo(x, y); stalks.lineTo(x + lean, y - hh);
        heads.ellipse(x + lean * 1.1, y - hh - 0.6, 0.85, 1.6, lean * 0.25, 0, PI2);
      }
      c.strokeStyle = K.wheatD; c.lineWidth = 0.7; c.stroke(stalks);
      c.fillStyle = K.wheatL; c.fill(heads);
      c.strokeStyle = "rgba(124,92,38,.7)"; c.lineWidth = 0.35; c.stroke(heads);
    }
    c.restore();
    f.rr(x0 - 1.6, y0 - 1.6, w + 3.2, h + 3.2, 4); f.paint(null, T.ol, T.olw);
    // 上緣麥穗探出田埂（剪影）
    c.save(); c.lineCap = "round";
    for (let x = x0 + 2; x < x1 - 1; x += 3.1) {
      const hh = 2.4 + Math.abs(Math.sin(x * 3.7)) * 1.6;
      c.strokeStyle = T.ol; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y0 + 1); c.lineTo(x + 0.3, y0 - hh); c.stroke();
      c.strokeStyle = K.wheatM; c.lineWidth = 0.7; c.stroke();
      f.ell(x + 0.35, y0 - hh - 0.6, 0.95, 1.7); f.paint(K.wheatL, T.ol, 0.45);
    }
    c.restore();
  }
  function blooms(H, b) { // 花海：一片密花（星夜裡微微發光）
    const { c, T, f } = H, R = f.mulberry(Math.round(b.x * 7 + b.y));
    f.ell(b.x, b.y, b.rx + 2, b.ry + 1.5); c.fillStyle = "rgba(120,190,110,.35)"; c.fill();
    f.glow(b.x, b.y, b.rx * 1.3, "rgba(255,220,240,A)", 0.22);
    const cols = ["#ffc8e4", "#fff2a0", "#ffffff", "#ffb0c4", "#d4c0ff"], n = Math.round(b.rx * b.ry * 0.32), pts = [];
    for (let i = 0; i < n; i++) { const a = R() * PI2, d = Math.sqrt(R()); pts.push([b.x + Math.cos(a) * b.rx * d, b.y + Math.sin(a) * b.ry * d, cols[Math.floor(R() * cols.length)]]); }
    pts.sort((p, q) => p[1] - q[1]);
    const stems = new Path2D(); for (const [x, y] of pts) { stems.moveTo(x, y + 2); stems.lineTo(x, y); }
    c.strokeStyle = "#4f8c55"; c.lineWidth = 0.6; c.stroke(stems);
    for (const [x, y, col] of pts) {
      const pp = new Path2D(); for (let i = 0; i < 5; i++) { const a = i * PI2 / 5; pp.moveTo(x + Math.cos(a) * 1.15 + 0.85, y + Math.sin(a) * 1.15); pp.arc(x + Math.cos(a) * 1.15, y + Math.sin(a) * 1.15, 0.85, 0, PI2); }
      c.strokeStyle = "rgba(12,17,34,.55)"; c.lineWidth = 0.5; c.stroke(pp); c.fillStyle = col; c.fill(pp);
      f.circ(x, y, 0.6); f.paint(col === "#fff2a0" ? "#e8a040" : "#fff6c8", null);
    }
  }

  // ═════ 路之後：木橋（溪過路）
  function bridge(H, br) {
    const { c, T, f } = H, x = br.x, y = br.y;
    f.shadow(x + 1, y + 17, 12, 2.4, 0.35);
    f.rr(x - 10.5, y - 15.5, 21, 31, 1.5); f.paint(T.woodDark, T.ol, T.olw);
    for (let i = 0; i < 6; i++) { f.rr(x - 9.8 + i * 3.3, y - 14.6 + (i % 2) * 0.5, 2.9, 29, 0.7); f.paint(i % 2 ? T.wood : T.woodLight, T.ol, 0.45); }
    c.strokeStyle = "rgba(255,240,200,.18)"; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke();
    for (const yy of [y - 15.5, y + 15.5]) {
      f.rr(x - 12, yy - 1.3, 24, 2.6, 1); f.paint(T.woodLight, T.ol, 0.65);
      for (const xx of [x - 11, x + 11]) { f.rr(xx - 1.7, yy - 4.6, 3.4, 6.2, 0.8); f.paint(T.woodDark, T.ol, 0.65); f.circ(xx, yy - 4.6, 1.2); f.paint(T.woodLight, null); }
    }
  }

  // ═════ 出怪口：林間小徑（灌木缺口＋野狼警示牌＋狼腳印）
  function wolfHead(H, x, y, s, col, eye) {
    const { f } = H;
    f.poly([[-3.4, 2.6], [-3.8, -0.8], [-3.2, -4.6], [-1.6, -1.8], [0.2, -2], [1.4, -4.8], [2.2, -1.4], [4.6, 0], [5, 1.4], [2.4, 2], [1.2, 3.4], [-1.6, 3.6]].map(([a, b]) => [x + a * s, y + b * s]));
    f.paint(col, null);
    if (eye) { f.circ(x + 1.6 * s, y - 0.4 * s, 0.6 * s); f.paint(eye, null); }
  }
  function wolfSign(H, x, y) {
    const { c, T, f } = H;
    f.shadow(x + 1, y + 0.5, 5, 1.6);
    f.rr(x - 1, y - 13, 2, 13.5, 0.6); f.paint(T.woodDark, T.ol, 0.65);
    c.save(); c.translate(x, y - 17); c.rotate(-0.07);
    f.rr(-12, -6, 24, 12, 1.6); f.paint(f.lg(0, -6, 0, 6, [T.woodLight, T.wood]), T.ol, T.olw);
    c.beginPath(); c.moveTo(-11, -1.5); c.lineTo(11, -1.5); c.moveTo(-11, 2.5); c.lineTo(11, 2.5); c.strokeStyle = "rgba(60,36,20,.45)"; c.lineWidth = 0.5; c.stroke();
    // 紅三角警示＋狼頭
    f.poly([[-7, -4.6], [-1.6, 4.4], [-12.4 + 0, 4.4]].map(([a, b]) => [a + 0.2, b])); f.paint("#f3e2c0", K.signRed, 1.2);
    wolfHead(H, -6.6, 1.4, 0.62, K.wolf, null);
    c.fillStyle = T.signInk; c.font = "900 5px system-ui,'Microsoft JhengHei',sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("野狼", 5, 0.4);
    // 爪痕
    c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(7.5 + i * 1.3, -5); c.lineTo(5 + i * 1.3, 5); } c.strokeStyle = "rgba(30,16,8,.55)"; c.lineWidth = 0.55; c.stroke();
    for (const xx of [-10.2, 10.2]) { f.circ(xx, -4, 0.6); f.paint("#3a2a1a", null); }
    c.restore();
  }
  function hedgeBush(H, x, y, s, g) {
    const { f } = H;
    f.shadow(x + 1, y + 0.5, 7 * s, 2.4 * s);
    f.union([() => f.circ(x - 3.6 * s, y - 3.2 * s, 3.8 * s), () => f.circ(x + 3.4 * s, y - 3 * s, 3.6 * s), () => f.circ(x, y - 5.6 * s, 4.4 * s)], g[1]);
    f.circ(x - 1.2 * s, y - 7 * s, 2.4 * s); f.paint(g[0], null);
  }
  function entrance(H, e) {
    const { c, T, f, P } = H;
    if (e.side !== "L" || e.y > 120) return false;   // 只處理左上入口；其他交給預設洞穴
    const y = e.y;
    // 路的起點沒入暗林
    c.fillStyle = f.lg(0, 0, 44, 0, ["rgba(10,4,22,.82)", "rgba(10,4,22,.35)", "rgba(10,4,22,0)"]); c.fillRect(0, y - 17, 44, 34);
    // 狼腳印（一路走進來）
    for (let i = 0; i < 5; i++) {
      const px = 10 + i * 8.5, py = y + (i % 2 ? 4 : -3);
      c.fillStyle = K.paw; f.ell(px, py, 1.5, 1.2); c.fill();
      for (let k = 0; k < 3; k++) { f.ell(px + 1.8, py - 1.3 + k * 1.3, 0.55, 0.5); c.fill(); }
    }
    // 上方灌木牆＋暗樹（缺口＝路）
    for (const [x, yy, s] of [[4, 12, 1.25], [24, 6, 1.1]]) f.darkTree(x, yy, s);
    for (const [x, yy, s, k] of [[-2, 31, 1.15, 0], [12, 32, 1.05, 1], [27, 31, 1.0, 0], [-3, 21, 1.05, 1], [16, 20, 0.9, 0]]) hedgeBush(H, x, yy, s, K.hedge[k]);
    f.thornBush(36, 31, 0.8);
    // 暗處的眼睛
    for (const [x, yy] of [[9, 24], [21, 15]]) { f.glow(x, yy, 4, T.eyeGlow, 0.65); f.circ(x - 1.1, yy, 0.75); f.paint(T.enemyEye, null); f.circ(x + 1.1, yy, 0.75); f.paint(T.enemyEye, null); }
    // 下方：路緣一小叢荊棘（避開塔位）
    if (!P.slotNear(4, y + 52, 18)) hedgeBush(H, 3, y + 54, 0.9, K.hedge[0]);
    if (!P.slotNear(-3, y + 24, 19)) { hedgeBush(H, -3, y + 25, 1.05, K.hedge[1]); f.thornBush(2, y + 25, 0.6); }
    wolfSign(H, 54, y - 19);
    return true;
  }

  // ═════ 大件裝飾
  function windmill(H, w) {
    const { c, T, f } = H, x = w.x, y = w.y;
    f.shadow(x + 5, y + 0.5, 15, 4);
    // 石基
    f.rr(x - 11, y - 5, 22, 5.5, 1.5); f.paint(f.lg(x - 11, 0, x + 11, 0, [T.stone[2], T.stone[1], T.stone[0]]), T.ol, T.olw);
    // 塔身（白灰泥、右亮左暗）
    f.poly([[x - 9, y - 4.5], [x - 6.2, y - 30], [x + 6.2, y - 30], [x + 9, y - 4.5]]); f.paint(f.lg(x - 9, 0, x + 9, 0, K.plaster), T.ol, T.olw);
    c.beginPath(); c.moveTo(x - 7.8, y - 15); c.lineTo(x + 7.8, y - 15); c.strokeStyle = K.timber; c.lineWidth = 1.2; c.stroke();
    for (const [sx, sy] of [[-5, -9], [4, -22], [-3, -26], [5, -11]]) { f.rr(x + sx - 1.4, y + sy - 0.8, 2.8, 1.6, 0.5); f.paint("rgba(90,70,50,.35)", null); }
    // 門＋窗（暖光）
    c.beginPath(); c.moveTo(x - 3, y - 4.5); c.lineTo(x - 3, y - 9); c.quadraticCurveTo(x, y - 12.5, x + 3, y - 9); c.lineTo(x + 3, y - 4.5); c.closePath(); f.paint(K.door, T.ol, 0.7);
    f.glow(x + 0.5, y - 21, 7, T.windowGlow, 0.55);
    f.rr(x - 1.6, y - 23.5, 3.2, 4, 1.4); f.paint(K.win, T.ol, 0.6);
    // 屋頂（尖帽）
    c.beginPath(); c.moveTo(x - 8, y - 29); c.quadraticCurveTo(x - 6, y - 37, x, y - 42); c.quadraticCurveTo(x + 6, y - 37, x + 8, y - 29); c.closePath(); f.paint(f.lg(x - 8, 0, x + 8, 0, K.roof), T.ol, T.olw);
    c.beginPath(); c.moveTo(x - 4.5, y - 34); c.quadraticCurveTo(x, y - 32.6, x + 4.5, y - 34); c.strokeStyle = K.roofLine; c.lineWidth = 0.6; c.stroke();
    f.circ(x, y - 42.5, 1.1); f.paint(T.gold, T.ol, 0.5);
    // 軸座（扇葉由 ambient 畫，會轉）
    f.rr(x - 2.4, w.hy - 2, 4.8, 4, 1); f.paint(K.timber, T.ol, 0.65);
  }
  function farmhouse(H, h) {
    const { c, T, f } = H, x = h.x, y = h.y;
    f.shadow(x + 3, y + 0.5, 21, 4);
    // 煙囪（屋頂後）
    f.rr(x + 6, y - 32, 4.6, 10, 0.8); f.paint(f.lg(x + 6, 0, x + 10.6, 0, [T.stone[2], T.stone[0]]), T.ol, 0.8);
    f.rr(x + 5.4, y - 33.4, 5.8, 2.2, 0.6); f.paint(T.stone[1], T.ol, 0.6);
    // 牆
    f.rr(x - 15, y - 14, 30, 14.5, 0.8); f.paint(f.lg(x - 15, 0, x + 15, 0, K.plaster), T.ol, T.olw);
    c.beginPath(); c.moveTo(x - 15, y - 7.5); c.lineTo(x + 15, y - 7.5); c.moveTo(x - 7.5, y - 14); c.lineTo(x - 7.5, y); c.moveTo(x + 7.5, y - 14); c.lineTo(x + 7.5, y);
    c.moveTo(x - 15, y - 14); c.lineTo(x - 7.5, y - 7.5); c.moveTo(x + 15, y - 14); c.lineTo(x + 7.5, y - 7.5);
    c.strokeStyle = K.timber; c.lineWidth = 1.1; c.stroke();
    // 屋頂（瓦）
    f.poly([[x - 19, y - 13], [x - 12.5, y - 27], [x + 12.5, y - 27], [x + 19, y - 13]]); f.paint(f.lg(x - 19, 0, x + 19, 0, K.roof), T.ol, T.olw);
    c.beginPath(); for (const k of [0.3, 0.6]) { const yy = y - 13 - 14 * k, dx = 19 - 6.5 * k; c.moveTo(x - dx + 0.8, yy); c.lineTo(x + dx - 0.8, yy); } c.strokeStyle = K.roofLine; c.lineWidth = 0.7; c.stroke();
    f.rr(x - 13, y - 28.4, 26, 2.4, 1); f.paint(K.roof[0], T.ol, 0.6);
    // 門、窗（暖光）、門燈
    for (const wx of [-11.3, 4.8]) { f.glow(wx + 3.2, y - 6, 9, T.windowGlow, 0.5); f.rr(x + wx, y - 6.2, 6.4, 4.4, 0.6); f.paint(K.win, T.ol, 0.7); c.beginPath(); c.moveTo(x + wx + 3.2, y - 6.2); c.lineTo(x + wx + 3.2, y - 1.8); c.strokeStyle = K.timber; c.lineWidth = 0.6; c.stroke(); }
    c.beginPath(); c.moveTo(x - 2.6, y + 0.3); c.lineTo(x - 2.6, y - 6); c.quadraticCurveTo(x, y - 8.6, x + 2.6, y - 6); c.lineTo(x + 2.6, y + 0.3); c.closePath(); f.paint(K.door, T.ol, 0.75);
    f.circ(x + 1.4, y - 2.8, 0.45); f.paint(T.gold, null);
    f.glow(x + 17.5, y - 9, 6, T.torch, 0.6); f.rr(x + 17, y - 9, 1, 9, 0.4); f.paint(T.woodDark, null); f.circ(x + 17.5, y - 9.6, 1.3); f.paint(T.torchCore, T.ol, 0.45);
    // 門前小石徑
    for (let i = 0; i < 3; i++) { f.ell(x - 0.5 + i * 0.8, y + 3 + i * 2.6, 2.4 - i * 0.2, 1); f.paint(T.pebble2, T.pebbleOl, 0.4); }
    h.smoke = [x + 8.3, y - 34];
  }
  function sheep(H, o) {
    const { c, T, f } = H, x = o.x, y = o.y, s = o.s, d = o.d;
    f.shadow(x + 1, y + 0.6, 6.5 * s, 2 * s);
    c.beginPath(); for (const lx of [-3, -1, 1.8, 3.6]) { c.moveTo(x + lx * s, y - 2 * s); c.lineTo(x + lx * s, y); } c.strokeStyle = K.face; c.lineWidth = 1.1 * s; c.lineCap = "round"; c.stroke();
    f.union([() => f.circ(x - 3 * s, y - 4.6 * s, 3 * s), () => f.circ(x + 2.8 * s, y - 4.6 * s, 3 * s), () => f.circ(x - 0.2 * s, y - 6.2 * s, 3.5 * s), () => f.circ(x, y - 3.4 * s, 3 * s)], K.wool, T.olw * 0.85);
    f.ell(x - 0.4 * s, y - 2.6 * s, 4.6 * s, 1.3 * s); f.paint(K.woolS, null);
    f.circ(x - 1.2 * s, y - 7.4 * s, 1.5 * s); f.paint("#ffffff", null);
    // 臉朝 d 方向（深色臉＋耳朵）
    const hx = x + d * 5.4 * s, hy = y - 5.6 * s;
    f.ell(hx - d * 1.4 * s, hy - 1.2 * s, 1.5 * s, 0.7 * s, d * 0.5); f.paint(K.face, T.ol, 0.4);
    f.ell(hx, hy, 2 * s, 2.5 * s, d * -0.25); f.paint(K.face, T.ol, 0.6);
    f.circ(hx - d * 0.4 * s, hy - 2.6 * s, 1.3 * s); f.paint(K.wool, null);
    f.circ(hx + d * 0.7 * s, hy - 0.4 * s, 0.4 * s); f.paint("#fff6e0", null);
  }
  function haystack(H, o) {
    const { c, T, f } = H, x = o.x, y = o.y, s = o.s;
    f.shadow(x + 2, y + 0.5, 9 * s, 2.6 * s);
    const dome = () => { c.beginPath(); c.moveTo(x - 8 * s, y); c.quadraticCurveTo(x - 8.6 * s, y - 8.6 * s, x - 0.5 * s, y - 11 * s); c.quadraticCurveTo(x + 8.4 * s, y - 9 * s, x + 8 * s, y); c.closePath(); };
    dome(); f.paint(f.lg(x - 8 * s, 0, x + 8 * s, 0, K.hay), T.ol, T.olw);
    c.save(); dome(); c.clip(); c.beginPath();
    for (let i = 0; i < 4; i++) { const yy = y - 2 - i * 2.6 * s; c.moveTo(x - 8 * s, yy); c.quadraticCurveTo(x, yy - 1.6 * s, x + 8 * s, yy + 0.4); }
    for (let i = 0; i < 6; i++) { const xx = x - 6 * s + i * 2.4 * s; c.moveTo(xx, y - 1); c.lineTo(xx + 0.8 * s, y - 4 * s); }
    c.strokeStyle = K.hayLine; c.lineWidth = 0.5; c.stroke(); c.restore();
    c.beginPath(); c.moveTo(x - 1.2 * s, y - 10.6 * s); c.lineTo(x - 2.6 * s, y - 13 * s); c.moveTo(x, y - 11 * s); c.lineTo(x + 0.6 * s, y - 13.6 * s); c.moveTo(x + 0.8 * s, y - 10.8 * s); c.lineTo(x + 2.6 * s, y - 12.8 * s);
    c.strokeStyle = T.ol; c.lineWidth = 1.4; c.stroke(); c.strokeStyle = K.hay[2]; c.lineWidth = 0.6; c.stroke();
  }
  function bale(H, o) { // 捲起來的乾草捆
    const { c, T, f } = H, x = o.x, y = o.y;
    f.shadow(x + 1.5, y + 0.5, 7, 2);
    f.rr(x - 6, y - 8, 9, 8, 3.5); f.paint(f.lg(0, y - 8, 0, y, [K.hay[2], K.hay[0]]), T.ol, T.olw * 0.9);
    f.ell(x + 3, y - 4, 3, 4); f.paint(K.hay[1], T.ol, T.olw * 0.9);
    c.beginPath(); c.arc(x + 3, y - 4, 1.8, 0, PI2 * 0.8); c.strokeStyle = K.hayLine; c.lineWidth = 0.5; c.stroke();
    c.beginPath(); c.moveTo(x - 2, y - 8); c.lineTo(x - 2, y); c.strokeStyle = "#8a4a3a"; c.lineWidth = 0.8; c.stroke();
  }
  function skep(H, o) { // 草編蜂箱（放在小木架上）
    const { c, T, f } = H, x = o.x, y = o.y;
    f.shadow(x + 1, y + 0.5, 6, 1.8);
    c.beginPath(); c.moveTo(x - 4.5, y); c.lineTo(x - 4.5, y - 3); c.moveTo(x + 4.5, y); c.lineTo(x + 4.5, y - 3); c.strokeStyle = T.ol; c.lineWidth = 1.6; c.stroke(); c.strokeStyle = T.woodDark; c.lineWidth = 0.8; c.stroke();
    f.rr(x - 6.5, y - 4.2, 13, 2, 0.6); f.paint(T.wood, T.ol, 0.6);
    const dome = () => { c.beginPath(); c.moveTo(x - 5.6, y - 4.2); c.bezierCurveTo(x - 6.2, y - 11, x - 3, y - 14, x, y - 14); c.bezierCurveTo(x + 3, y - 14, x + 6.2, y - 11, x + 5.6, y - 4.2); c.closePath(); };
    dome(); f.paint(f.lg(x - 6, 0, x + 6, 0, K.hay), T.ol, T.olw);
    c.save(); dome(); c.clip(); c.beginPath(); for (let i = 1; i < 4; i++) { const yy = y - 4.2 - i * 2.5; c.moveTo(x - 7, yy); c.quadraticCurveTo(x, yy + 1.2, x + 7, yy); } c.strokeStyle = K.hayLine; c.lineWidth = 0.6; c.stroke(); c.restore();
    f.ell(x, y - 5.8, 1.5, 1.1); f.paint("#2a1a0c", null);
  }
  function scarecrow(H, o) {
    const { c, T, f } = H, x = o.x, y = o.y;
    f.shadow(x + 1, y + 0.5, 4, 1.4);
    f.rr(x - 0.9, y - 17, 1.8, 17.5, 0.5); f.paint(T.woodDark, T.ol, 0.6);
    f.rr(x - 9, y - 14.5, 18, 1.6, 0.5); f.paint(T.wood, T.ol, 0.55);
    // 衣服（補丁藍外套）
    f.poly([[x - 5.5, y - 14.6], [x + 5.5, y - 14.6], [x + 4.4, y - 6.4], [x - 4.4, y - 6.4]]); f.paint("#4a6a9e", T.ol, T.olw * 0.9);
    f.rr(x + 0.6, y - 12, 2.6, 2.4, 0.3); f.paint("#c8664a", T.ol, 0.4);
    // 手袖稻草
    c.beginPath(); for (const sd of [-1, 1]) { c.moveTo(x + sd * 8.6, y - 13.6); c.lineTo(x + sd * 10.6, y - 15); c.moveTo(x + sd * 8.6, y - 13.6); c.lineTo(x + sd * 10.8, y - 13); c.moveTo(x + sd * 8.6, y - 13.6); c.lineTo(x + sd * 10, y - 11.4); }
    c.strokeStyle = T.ol; c.lineWidth = 1.3; c.lineCap = "round"; c.stroke(); c.strokeStyle = K.wheatL; c.lineWidth = 0.6; c.stroke();
    // 頭（麻布）＋草帽
    f.circ(x, y - 18.4, 3.4); f.paint("#dcc496", T.ol, T.olw * 0.9);
    f.circ(x - 1.2, y - 18.6, 0.5); f.paint(K.face, null); f.circ(x + 1.2, y - 18.6, 0.5); f.paint(K.face, null);
    c.beginPath(); c.arc(x, y - 17.6, 1.4, 0.3, Math.PI - 0.3); c.strokeStyle = K.face; c.lineWidth = 0.45; c.stroke();
    f.ell(x, y - 20.6, 6, 1.5); f.paint("#c89a4a", T.ol, 0.7);
    c.beginPath(); c.moveTo(x - 3, y - 20.8); c.quadraticCurveTo(x - 2.6, y - 25, x, y - 25); c.quadraticCurveTo(x + 2.6, y - 25, x + 3, y - 20.8); c.closePath(); f.paint("#d8ac58", T.ol, 0.7);
    f.rr(x - 3, y - 22.2, 6, 1.2, 0.3); f.paint("#c8455a", null);
    // 停在手臂上的小鳥（友善）
    f.ell(x - 7.4, y - 16.2, 1.4, 1); f.paint("#3a3a52", T.ol, 0.4); f.circ(x - 8.4, y - 17, 0.8); f.paint("#3a3a52", null);
  }
  function stump(H, x, y, s) {
    const { f } = H;
    f.shadow(x + 1, y + 0.5, 4.5 * s, 1.6 * s);
    f.cyl(x, y, 3.4 * s, 3.4 * s, f.lg(x - 3.4 * s, 0, x + 3.4 * s, 0, ["#3e2c20", "#5a4030", "#7a5a40"]), "#c8a878");
    f.ell(x, y - 3.4 * s, 1.6 * s, 0.6 * s); f.paint(null, "#8a6a48", 0.4);
  }
  function log(H, o) { // 倒木（荒地一側）：樹皮＋年輪＋小蘑菇
    const { c, T, f } = H, x = o.x, y = o.y;
    f.shadow(x + 1, y + 0.6, 9, 2);
    f.rr(x - 8, y - 5.6, 14, 5.6, 2.6); f.paint(f.lg(0, y - 5.6, 0, y, ["#7a5a40", "#5a4030", "#3e2c20"]), T.ol, T.olw);
    c.beginPath(); c.moveTo(x - 6, y - 3.6); c.lineTo(x - 1, y - 3.2); c.moveTo(x - 4, y - 1.6); c.lineTo(x + 2, y - 1.8); c.strokeStyle = "rgba(30,18,10,.6)"; c.lineWidth = 0.5; c.stroke();
    f.ell(x + 6, y - 2.8, 2.2, 2.8); f.paint("#c8a878", T.ol, T.olw * 0.9);
    f.ell(x + 6, y - 2.8, 1.1, 1.4); f.paint(null, "#8a6a48", 0.45);
    f.ell(x - 3, y - 5.4, 3, 0.9); f.paint(T.moss, null);
    f.mushroom(x - 7, y + 0.5, H.R);
  }
  function tallGrass(H, x, y, s, col) {
    const { c, T } = H;
    c.beginPath(); for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; c.moveTo(x + (i - 2) * 0.8 * s, y); c.quadraticCurveTo(x + (i - 2) * 1.2 * s, y - 4 * s, x + Math.sin(a) * 7 * s, y - (6 + (i % 2) * 2) * s); }
    c.lineCap = "round"; c.strokeStyle = T.ol; c.lineWidth = 1.7 * s; c.stroke(); c.strokeStyle = col; c.lineWidth = 0.8 * s; c.stroke();
  }
  function fruitTree(H, x, y, s) {
    const { f, T } = H;
    f.shadow(x + 2.5 * s, y + 0.5, 9 * s, 3.4 * s);
    f.rr(x - 1.6 * s, y - 8 * s, 3.2 * s, 8.4 * s, 1); f.paint(T.trunk);
    f.union([() => f.circ(x - 5 * s, y - 11 * s, 5.6 * s), () => f.circ(x + 5 * s, y - 11.5 * s, 5.4 * s), () => f.circ(x, y - 16 * s, 7 * s)], "#3f7a48");
    f.circ(x - 1.5 * s, y - 17.5 * s, 4.4 * s); f.paint("#80c472", null); f.circ(x - 5.6 * s, y - 12.5 * s, 2.8 * s); f.paint("#80c472", null);
    for (const [a, b] of [[-5, -10], [3, -14], [5, -9], [-2, -19], [0, -11]]) { f.circ(x + a * s, y + b * s, 1.3 * s); f.paint("#ff8a7a", T.ol, 0.5); }
  }

  // ═════ 裝飾總管：大件＋小件散佈（依荒野度分三段：荒→牧場→農田）
  function decor(H) {
    const { P, T, f } = H, S = H._mw; if (!S) return;
    const items = [], R = f.mulberry(2026);
    const add = (y, fn) => items.push({ y, fn });
    if (S.mill) add(S.mill.y, () => windmill(H, S.mill));
    if (S.house) add(S.house.y, () => farmhouse(H, S.house));
    for (const o of S.sheep) add(o.y, () => sheep(H, o));
    for (const o of S.hay) add(o.y, () => haystack(H, o));
    for (const o of S.bales) add(o.y, () => bale(H, o));
    for (const o of S.hives) add(o.y, () => skep(H, o));
    for (const o of S.logs) add(o.y, () => log(H, o));
    if (S.scare) add(S.scare.y, () => scarecrow(H, S.scare));
    for (const [x, y, k, s] of S.trees) add(y, () => k === "dark" ? f.darkTree(x, y, s) : k === "pine" ? f.treePine(x, y, s, H.R) : k === "bush" ? f.bush(x, y, s, H.R) : k === "fruit" ? fruitTree(H, x, y, s) : f.treeRound(x, y, s, H.R));
    // 小件散佈
    const wildOf = (x, y) => Math.max(0, 1 - Math.min(...P.entries.map(e => HY(x - e.x, y - e.y))) / 150);
    const homeOf = (x, y) => Math.max(0, 1 - HY(x - P.end[0], (y - P.end[1]) * 1.2) / 170);
    for (let gx = 5; gx < 300; gx += 11) for (let gy = 5; gy < 400; gy += 11) {
      const x = gx + (R() - 0.5) * 7, y = gy + (R() - 0.5) * 7, k = R(), w = wildOf(x, y), hm = homeOf(x, y);
      if (!fits(H, S, x, y, 4, 7)) continue;
      if (w > 0.4) {   // 荒：荊棘、石頭、樹樁、高草、蘑菇
        if (k < 0.08) add(y, () => f.thornBush(x, y, 0.75 + R() * 0.25));
        else if (k < 0.2) add(y, () => f.rock(x, y, 0.5 + R() * 0.4, H.R));
        else if (k < 0.26) add(y, () => stump(H, x, y, 0.85 + R() * 0.3));
        else if (k < 0.42) add(y, () => tallGrass(H, x, y, 0.9 + R() * 0.3, R() < 0.5 ? "#4f7d55" : "#6a8a50"));
        else if (k < 0.46) add(y, () => f.mushroom(x, y, H.R));
        else if (k < 0.52) add(y, () => hedgeBush(H, x, y, 0.75, K.hedge[k < 0.49 ? 0 : 1]));
      } else if (hm > 0.35) {   // 農田一帶：整齊，只有小花與矮叢
        if (k < 0.16) add(y, () => f.flowers(x, y, H.R));
        else if (k < 0.22) add(y, () => f.bush(x, y, 0.8, H.R));
        else if (k < 0.28) add(y, () => tallGrass(H, x, y, 0.75, "#7ab468"));
      } else {   // 牧場：灌木、野花、高草、偶有石頭
        if (k < 0.12) add(y, () => f.bush(x, y, 0.85 + R() * 0.25, H.R));
        else if (k < 0.3) add(y, () => f.flowers(x, y, H.R));
        else if (k < 0.4) add(y, () => tallGrass(H, x, y, 0.85, R() < 0.5 ? "#6ead66" : "#8cbf62"));
        else if (k < 0.44) add(y, () => f.rock(x, y, 0.45 + R() * 0.3, H.R));
      }
    }
    // 城堡前的花籬笆（家園感）
    const L = P.castle;
    if (L.type === "bottom") {
      const fy = L.wallTop - 5, segs = []; let run = null;
      for (let x = 6; x <= 294; x += 9) {
        const ok = Math.abs(x - L.gx) > 22 && !L.towers.some(t => Math.abs(x - t.x) < t.r + 8) && P.distRoad(x, fy - 3) > 15 && !P.slotNear(x, fy - 3, 15);
        if (ok) { if (!run) run = [x, x]; else run[1] = x; } else if (run) { segs.push(run); run = null; }
      }
      if (run) segs.push(run);
      for (const [a, b] of segs) if (b - a >= 18) add(fy, () => f.fence(a, b, fy));
    }
    // 牧場邊的木柵欄（羊圈一角）
    for (const [x0, x1, y] of [[262, 298, 146]]) {
      let ok = true; for (let x = x0; x <= x1; x += 4) if (P.distRoad(x, y - 3) < 16 || P.slotNear(x, y - 3, 17)) ok = false;
      if (ok) add(y, () => rail(H, x0, x1, y));
    }
    items.sort((a, b) => a.y - b.y).forEach(it => it.fn());
  }
  function rail(H, x0, x1, y) {
    const { T, f } = H;
    for (let x = x0; x <= x1; x += 9) {
      f.rr(x - 0.9, y - 7, 1.8, 7.5, 0.6); f.paint(T.wood, T.ol, 0.55);
      if (x + 9 <= x1) { f.rr(x, y - 5.6, 9, 1.5, 0.4); f.paint(T.woodLight, T.ol, 0.45); f.rr(x, y - 2.6, 9, 1.5, 0.4); f.paint(T.woodLight, T.ol, 0.45); }
    }
  }

  // ═════ 每幀環境：風車扇葉、蝴蝶、蜜蜂、螢火蟲、炊煙（粒子共 ≤ 20；不建漸層、不配置陣列）
  let GS = null;
  function glowSprite() {
    if (GS) return GS;
    const k = document.createElement("canvas"); k.width = k.height = 32; const g = k.getContext("2d");
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,240,160,1)"); gr.addColorStop(0.35, "rgba(255,226,120,.45)"); gr.addColorStop(1, "rgba(255,220,120,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (GS = k);
  }
  function ambient(ctx, t, H) {
    const S = H && H._mw; if (!S) return;
    const ol = H.T.ol;
    // 風車扇葉
    if (S.mill) {
      const hx = S.mill.x, hy = S.mill.hy, r = S.mill.r, a0 = t * 0.9;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a0);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.moveTo(0, -1.5); ctx.lineTo(0, -r); }
      ctx.lineCap = "round"; ctx.strokeStyle = ol; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = K.timber; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.rect(0.8, -r + 0.5, 4.6, r - 5); }
      ctx.fillStyle = K.sail; ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 0.75; ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.moveTo(3.1, -r + 0.5); ctx.lineTo(3.1, -4.5); for (let j = 1; j < 4; j++) { const yy = -r + 0.5 + j * (r - 5) / 4; ctx.moveTo(0.8, yy); ctx.lineTo(5.4, yy); } }
      ctx.strokeStyle = K.sailLine; ctx.lineWidth = 0.45; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(hx, hy, 1.9, 0, PI2); ctx.fillStyle = H.T.gold; ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 0.7; ctx.stroke();
    }
    // 炊煙
    if (S.house && S.house.smoke) {
      const [sx, sy] = S.house.smoke;
      for (let i = 0; i < 3; i++) {
        const q = ((t * 0.35 + i / 3) % 1), x = sx + Math.sin(q * 5 + i) * 2 + q * 6, y = sy - q * 18;
        ctx.globalAlpha = 0.42 * (1 - q); ctx.fillStyle = "#c8d0e0"; ctx.beginPath(); ctx.arc(x, y, 1.6 + q * 3, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 螢火蟲（麥田、牧場）
    const gsp = glowSprite();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < S.glows.length; i++) {
      const g = S.glows[i], x = g.x + Math.sin(t * 0.6 * g.s + g.p) * 7, y = g.y + Math.cos(t * 0.45 * g.s + g.p * 1.7) * 4 - 3;
      const a = 0.25 + 0.5 * Math.max(0, Math.sin(t * 1.8 * g.s + g.p));
      ctx.globalAlpha = a; ctx.drawImage(gsp, x - 4.5, y - 4.5, 9, 9);
      ctx.globalAlpha = Math.min(1, a + 0.3); ctx.fillStyle = "#fff8c8"; ctx.fillRect(x - 0.55, y - 0.55, 1.1, 1.1);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // 蜜蜂（繞蜂箱）
    for (let i = 0; i < S.bugs.length; i++) {
      const b = S.bugs[i], a = t * 2.2 * b.s + b.p, x = b.x + Math.cos(a) * 7 + Math.sin(t * 9 + i) * 0.6, y = b.y + Math.sin(a * 1.3) * 3.5;
      ctx.fillStyle = ol; ctx.fillRect(x - 1.1, y - 0.8, 2.2, 1.6); ctx.fillStyle = "#ffd24a"; ctx.fillRect(x - 0.7, y - 0.5, 1.4, 1);
    }
    // 蝴蝶
    ctx.lineWidth = 0.5; ctx.strokeStyle = ol;
    for (let i = 0; i < S.flies.length; i++) {
      const b = S.flies[i], x = b.x + Math.sin(t * 0.55 * b.s + b.p) * 13 + Math.sin(t * 1.7 + b.p) * 2.5, y = b.y + Math.sin(t * 0.9 * b.s + b.p * 2) * 6 - 5 + Math.sin(t * 5 + i) * 0.8;
      const fl = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + b.p)), dir = Math.cos(t * 0.55 * b.s + b.p) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(x - 1.5 * fl, y - 0.9, 1.7 * fl + 0.2, 1.4, -0.4 * dir, 0, PI2);
      ctx.moveTo(x + 1.5 * fl + 1.7 * fl + 0.2, y - 0.9); ctx.ellipse(x + 1.5 * fl, y - 0.9, 1.7 * fl + 0.2, 1.4, 0.4 * dir, 0, PI2);
      ctx.moveTo(x - 1 * fl + 1.1 * fl + 0.15, y + 0.9); ctx.ellipse(x - 1 * fl, y + 0.9, 1.1 * fl + 0.15, 0.9, 0.3, 0, PI2);
      ctx.moveTo(x + 1 * fl + 1.1 * fl + 0.15, y + 0.9); ctx.ellipse(x + 1 * fl, y + 0.9, 1.1 * fl + 0.15, 0.9, -0.3, 0, PI2);
      ctx.fillStyle = b.col; ctx.fill(); ctx.stroke();
      ctx.fillStyle = ol; ctx.fillRect(x - 0.35, y - 1.6, 0.7, 3.2);
    }
  }

  ART.REGION_KITS[0] = {
    replaceDecor: true,
    preRoad(H) {
      H._mw = layout(H);
      H.T.cave = ["野狼小徑", null];   // 出怪口地名（drawLabels 讀主題）
      warmWash(H);
      drawStream(H, H._mw);
      for (const fd of H._mw.fields) (fd.k === "wheat" ? fieldWheat : fieldPlow)(H, fd);
      for (const b of H._mw.bloom) blooms(H, b);
    },
    postRoad(H) { const S = H._mw; if (S) for (const br of S.bridges) bridge(H, br); },
    entrance,
    decor,
    ambient
  };
})();
