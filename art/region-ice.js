// 區域套件：寒冰山脈（REGION 3）— 第二刀。介面見 art/CONTRACT.md「第二刀」與 art/art-map.js 的 ART.REGION_KITS 說明。
// 2026-11-21 第二刀：遠山稜線、冰湖反光裂紋、路邊積雪、雪松（樹頂積雪）、冰柱岩、冰晶簇、雪堆、雪地腳印、巫妖符文石、
// 出怪口改「冰裂隙」、中央冰晶尖塔要塞（城門朝下方來路）；環境：頂端極光帶＋冰晶閃光。
// 全部自繪向量；裝飾避開路（distRoad ≥ 18）、塔位、城堡區、水。城牆血量牌／旗子／火把由 castleOverlay 依 L 畫，
// 城堡造型對齊 L：旗桿在中央尖塔頂（L.flags[0]）、火把在左塔與右堡壘牆面（L.torches）、裂痕重排到牆面上（L.cracks）。
(function () {
  const ART = window.ART = window.ART || {};
  ART.REGION_KITS = ART.REGION_KITS || {};
  const PI2 = Math.PI * 2, HY = Math.hypot;

  // 冰原專用色
  const ICE = {
    snow: "#f8fcff", snowS: "#d4e5f1", snowLine: "rgba(60,95,130,.45)",
    iceL: "#eef9ff", ice: "#c2e8fa", iceM: "#86c6e6", iceD: "#4f8fbc", iceDD: "#2c5b88",
    stone: ["#cfdbe6", "#94a8bc", "#5c7088"], stoneTop: "#e6eef5", stoneLine: "rgba(20,35,60,.42)",
    roof: ["#a6dcf4", "#58a2d0", "#2a5c8c"], glowCold: "rgba(150,220,255,A)", lichGlow: "rgba(170,110,255,A)", lich: "#8a5ad8",
    gateDark: "#060a16", crevasse: ["#03060f", "#16264a"]
  };
  let SPK = [];   // 冰晶閃光點（decor 時登記，ambient 每幀閃）
  const spk = (x, y) => { if (SPK.length < 11) SPK.push([x, y]); };   // 地景最多 11 點，城堡另留幾點
  let AUR = null; // 極光帶離屏圖

  // ───── 小元件（畫在 H.c 上；H.f 的工具也畫在同一張）
  function drift(H, x, y, s) { // 雪堆
    const { ell, paint, lg } = H.f;
    ell(x + 0.8, y + 1, 9 * s, 3.2 * s); paint("rgba(40,70,100,.22)", null);
    ell(x, y, 9 * s, 3.4 * s); paint(lg(0, y - 3.4 * s, 0, y + 3.4 * s, [ICE.snow, ICE.snowS]), ICE.snowLine, 0.6);
    ell(x - 2.4 * s, y - 1.2 * s, 4 * s, 1.2 * s); paint("rgba(255,255,255,.9)", null);
  }
  function snowPine(H, x, y, s, R) { // 雪松：每層樹冠上緣積雪、下緣露一圈墨綠
    const { poly, rr, paint, shadow } = H.f, T = H.T;
    shadow(x + 2.5 * s, y + 0.5, 7.5 * s, 3 * s, 0.3);
    rr(x - 1.3 * s, y - 5 * s, 2.6 * s, 5.4 * s, 0.6); paint(T.trunk);
    const g = T.pine[Math.floor(R() * T.pine.length)];
    for (let i = 0; i < 3; i++) {
      const w = (8.6 - i * 2.1) * s, yb = y - (3 + i * 6.2) * s, yt = yb - 10 * s;
      poly([[x - w, yb], [x, yt], [x + w, yb]]); paint(g[1]);
      poly([[x, yb], [x, yt], [x + w, yb]]); paint(g[0], null);
      poly([[x - w * 0.9, yb - 0.9 * s], [x, yt], [x + w * 0.9, yb - 0.9 * s], [x + w * 0.62, yb - 2.9 * s], [x + w * 0.3, yb - 1.6 * s], [x, yb - 3.4 * s], [x - w * 0.32, yb - 1.8 * s], [x - w * 0.64, yb - 3 * s]]);
      paint(ICE.snow, null);
      poly([[x + w * 0.15, yt + 3 * s], [x, yt], [x + w * 0.9, yb - 0.9 * s], [x + w * 0.62, yb - 2.9 * s]]); paint("rgba(150,190,220,.35)", null);
      poly([[x - w, yb], [x, yt], [x + w, yb]]); paint(null);
    }
  }
  function iceSpire(H, x, y, s) { // 冰柱岩：岩座＋幾根直立冰柱
    const { poly, paint, shadow, ell, glow } = H.f, c = H.c, T = H.T;
    shadow(x + 2, y + 0.6, 8 * s, 2.8 * s, 0.32);
    glow(x, y - 8 * s, 12 * s, ICE.glowCold, 0.22);
    const shards = [[-3.6, 12, 2.8, -0.22], [1.2, 18, 3.4, 0.04], [5.4, 9.5, 2.5, 0.32], [-6.6, 6.5, 2, -0.5]];
    for (const [dx, h, w, a] of shards) {
      c.save(); c.translate(x + dx * s, y); c.rotate(a);
      const hh = h * s, ww = w * s;
      poly([[-ww, 0], [-ww * 0.85, -hh * 0.72], [0, -hh], [ww * 0.85, -hh * 0.72], [ww, 0]]); paint(ICE.ice, T.ol, T.olw * 0.75);
      poly([[0, 0], [0, -hh], [ww * 0.85, -hh * 0.72], [ww, 0]]); paint(ICE.iceM, null);
      poly([[-ww * 0.5, -hh * 0.1], [-ww * 0.45, -hh * 0.62], [-ww * 0.15, -hh * 0.8]], false); c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 0.6; c.stroke();
      poly([[-ww, 0], [-ww * 0.85, -hh * 0.72], [0, -hh], [ww * 0.85, -hh * 0.72], [ww, 0]]); paint(null, T.ol, T.olw * 0.75);
      c.restore();
    }
    // 岩座與積雪
    poly([[x - 8 * s, y + 0.5], [x - 6 * s, y - 3 * s], [x - 1 * s, y - 2 * s], [x + 4 * s, y - 3.4 * s], [x + 8 * s, y + 0.5]]); paint(T.rock[1]);
    poly([[x + 4 * s, y - 3.4 * s], [x + 8 * s, y + 0.5], [x + 1 * s, y + 0.5]]); paint(T.rock[2], null);
    poly([[x - 8 * s, y + 0.5], [x - 6 * s, y - 3 * s], [x - 1 * s, y - 2 * s], [x + 4 * s, y - 3.4 * s], [x + 8 * s, y + 0.5]]); paint(null);
    ell(x - 2 * s, y - 2.2 * s, 4.6 * s, 1.3 * s); paint(ICE.snow, null);
    spk(x + 1.2 * s, y - 17 * s);
  }
  function frozenTree(H, x, y, s) { // 枯樹＋枝頭積雪、冰柱
    const { ell, poly, paint } = H.f;
    H.f.deadTree(x, y, s);
    for (const [bx, by, r] of [[-6, -15, 2.2], [5, -18, 2.4], [-8, -19, 1.6], [8, -21, 1.8], [1, -20, 1.7], [0, -10, 1.4]]) { ell(x + bx * s, y + by * s - 0.6, r * s, r * 0.55 * s); paint(ICE.snow, null); }
    for (const [bx, by] of [[-3, -11.5], [3, -14.2]]) { poly([[x + bx * s - 0.7, y + by * s], [x + bx * s + 0.7, y + by * s], [x + bx * s, y + by * s + 3 * s]]); paint(ICE.iceL, H.T.ol, 0.4); }
    ell(x, y + 0.2, 6 * s, 1.6 * s); paint("rgba(248,252,255,.85)", null);
  }
  function runeStone(H, x, y) { // 巫妖符文石：立石＋發紫光符文＋頂雪
    const { poly, paint, shadow, glow, ell } = H.f, c = H.c, T = H.T;
    shadow(x + 1.5, y + 0.5, 6, 2.2, 0.35);
    glow(x, y - 7, 11, ICE.lichGlow, 0.32);
    const pts = [[x - 4.4, y + 0.4], [x - 4.8, y - 9], [x - 2.2, y - 14], [x + 2.6, y - 13], [x + 4.6, y - 8], [x + 4.2, y + 0.4]];
    poly(pts); paint("#7a8aa6");
    poly([[x + 2.6, y - 13], [x + 4.6, y - 8], [x + 4.2, y + 0.4], [x + 1.4, y + 0.4], [x + 1.2, y - 11]]); paint("#56637e", null);
    poly(pts); paint(null);
    c.lineCap = "round"; c.strokeStyle = "#e2c8ff"; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x - 1.6, y - 10); c.lineTo(x - 0.4, y - 6); c.lineTo(x - 1.8, y - 3); c.moveTo(x - 0.4, y - 6); c.lineTo(x + 1.6, y - 8); c.moveTo(x + 0.6, y - 4); c.lineTo(x + 1.8, y - 2.2); c.stroke();
    c.strokeStyle = ICE.lich; c.lineWidth = 0.45; c.stroke();
    ell(x - 0.8, y - 13.2, 3.4, 1.3, -0.15); paint(ICE.snow, null);
    ell(x, y + 0.4, 6, 1.4); paint("rgba(248,252,255,.8)", null);
  }
  function footprints(H, R) { // 雪地腳印：兩三串隨機小徑，碰到路／塔位／水就停
    const { ell, paint } = H.f, P = H.P;
    const ok = (x, y) => x > 6 && x < 294 && y > 30 && y < 372 && P.distRoad(x, y) > 17 && !P.slotNear(x, y, 16) && P.distWater(x, y) > 4 && !P.inZone(x, y, 4);
    let trails = 0;
    for (let k = 0; k < 40 && trails < 3; k++) {
      let x = 20 + R() * 260, y = 40 + R() * 320; if (!ok(x, y) || P.distRoad(x, y) < 24) continue;
      let a = R() * PI2; const pts = [];
      for (let i = 0; i < 26; i++) { a += (R() - 0.5) * 0.5; const nx = x + Math.cos(a) * 4.2, ny = y + Math.sin(a) * 4.2; if (!ok(nx, ny)) break; x = nx; y = ny; pts.push([x, y, a, i]); }
      if (pts.length < 8) continue;
      trails++;
      for (const [px, py, pa, i] of pts) { const sd = i % 2 ? 1 : -1, ox = Math.cos(pa + Math.PI / 2) * 1.5 * sd, oy = Math.sin(pa + Math.PI / 2) * 1.5 * sd; ell(px + ox, py + oy, 1.15, 0.7, pa); paint("rgba(70,105,140,.32)", null); ell(px + ox - 0.2, py + oy - 0.25, 0.8, 0.4, pa); paint("rgba(255,255,255,.35)", null); }
    }
  }

  ART.REGION_KITS[3] = {
    replaceDecor: true,

    // ── 地面之後、路之前：遠山稜線、冰湖細節、腳印
    preRoad(H) {
      const c = H.c, { poly, paint, ell, lg } = H.f, R = H.R, T = H.T, P = H.P;
      SPK = [];
      // 遠山稜線（畫面最上緣 y 0～26，不進戰場）
      const ridge = (base, hMin, hMax, step, col, colD, snowA, seed) => {
        const r = H.f.mulberry(seed), pk = [];
        for (let x = -18; x < 330; x += step * (0.7 + r() * 0.6)) pk.push([x, base - hMin - r() * (hMax - hMin)]);
        const pts = [[-20, base + 6]]; for (let i = 0; i < pk.length; i++) { pts.push(pk[i]); if (i < pk.length - 1) pts.push([(pk[i][0] + pk[i + 1][0]) / 2 + (r() - 0.5) * 4, base - 1 - r() * 3]); }
        pts.push([330, base + 6]);
        poly(pts); paint(lg(0, base - hMax, 0, base + 6, [col, colD]), null);
        for (let i = 0; i < pk.length; i++) { // 山頂積雪＋陰面
          const [px, py] = pk[i], hh = base - py, w = hh * 0.9;
          poly([[px, py], [px + w * 0.5, py + hh * 0.5], [px + w * 0.15, py + hh * 0.42], [px, py + hh * 0.55]]); paint("rgba(30,50,80,.18)", null);
          poly([[px - w * 0.36, py + hh * 0.4], [px, py], [px + w * 0.34, py + hh * 0.38], [px + w * 0.16, py + hh * 0.3], [px + w * 0.04, py + hh * 0.44], [px - w * 0.14, py + hh * 0.32]]); paint(snowA, null);
        }
        c.beginPath(); pts.slice(1, -1).forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = "rgba(12,17,34,.42)"; c.lineWidth = 0.8; c.lineJoin = "round"; c.stroke();
      };
      ridge(17, 9, 17, 34, "#b4c8d8", "#9fb6c9", "rgba(250,253,255,.95)", 31);
      ridge(23, 5, 12, 26, "#8aa3b9", "#90adc2", "rgba(248,252,255,.95)", 57);
      // 山腳雪原（波浪下緣，融進地面）
      c.beginPath(); c.moveTo(-5, 18); for (let x = -5; x <= 305; x += 10) c.quadraticCurveTo(x + 5, 27 + R() * 2, x + 10, 24 + R() * 2); c.lineTo(305, 18); c.closePath();
      c.fillStyle = lg(0, 16, 0, 28, ["rgba(246,251,255,.0)", "rgba(246,251,255,.75)"]); c.fill();
      // 冰湖：深處、反光帶、裂紋、冰釣洞
      for (const o of P.ponds) {
        if (o.kind !== "ice") continue;
        const { x, y, rx, ry } = o;
        c.save(); ell(x, y, rx, ry); c.clip();
        ell(x + rx * 0.15, y + ry * 0.2, rx * 0.7, ry * 0.6); c.fillStyle = H.f.rg(x + rx * 0.15, y + ry * 0.2, 0, rx * 0.7, ["rgba(40,100,160,.28)", "rgba(40,100,160,0)"]); c.fill();
        c.globalAlpha = 0.5; c.fillStyle = "#ffffff";
        for (const [k, w] of [[-0.45, 0.16], [-0.15, 0.07], [0.3, 0.1]]) { c.beginPath(); c.moveTo(x + rx * k - w * rx, y + ry); c.lineTo(x + rx * k + w * rx, y + ry); c.lineTo(x + rx * k + w * rx + ry * 1.4, y - ry); c.lineTo(x + rx * k - w * rx + ry * 1.4, y - ry); c.closePath(); c.fill(); }
        c.globalAlpha = 1;
        c.lineCap = "round"; c.lineJoin = "round";
        for (let i = 0; i < 3; i++) {
          let px = x + (R() - 0.5) * rx * 0.6, py = y + (R() - 0.5) * ry * 0.5, a = R() * PI2; const pts = [[px, py]];
          for (let k = 0; k < 4; k++) { a += (R() - 0.5) * 1.2; px += Math.cos(a) * rx * 0.18; py += Math.sin(a) * ry * 0.22; pts.push([px, py]); }
          poly(pts, false); c.strokeStyle = "rgba(30,70,110,.55)"; c.lineWidth = 0.9; c.stroke();
          c.save(); c.translate(0.5, 0.5); poly(pts, false); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 0.45; c.stroke(); c.restore();
        }
        c.restore();
        if (rx >= 18) { // 冰釣洞＋小旗
          const hx = x + rx * 0.38, hy = y + ry * 0.12;
          ell(hx, hy, 3.4, 1.7); paint(ICE.snow, T.ol, 0.6); ell(hx, hy + 0.2, 2.2, 1); paint("#16324e", null);
          c.strokeStyle = T.woodDark; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 3.8, hy + 0.6); c.lineTo(hx + 3.8, hy - 7); c.stroke();
          poly([[hx + 3.8, hy - 7], [hx + 8, hy - 6], [hx + 3.8, hy - 4.8]]); paint("#d0506a", T.ol, 0.5);
        }
        spk(x - rx * 0.4, y - ry * 0.3); spk(x + rx * 0.25, y + ry * 0.1);
      }
      footprints(H, R);
    },

    // ── 路之後：路緣積雪、路面薄雪斑
    postRoad(H) {
      const c = H.c, { ell, paint } = H.f, R = H.R, P = H.P;
      for (const rt of P.routes) for (const g of rt.seg) {
        const ux = (g.x2 - g.x1) / (g.L || 1), uy = (g.y2 - g.y1) / (g.L || 1), nx = -uy, ny = ux;
        for (const sd of [-1, 1]) { // 一段一段的雪堆（長 8～26、間隔 10～34），不是整排珠子
          let d = R() * 20;
          while (d < g.L) {
            const len = 8 + R() * 18, ph = R() * 6, pts = [];
            for (let q = 0; q <= len; q += 2.2) {
              const bx = g.x1 + ux * (d + q), by = g.y1 + uy * (d + q); if (d + q > g.L || bx < -4 || bx > 304 || by > 404) break;
              const off = 12.4 + Math.sin(q * 0.5 + ph) * 0.8, x = bx + nx * off * sd, y = by + ny * off * sd;
              if (P.distRoad(x, y) < off - 0.6) break;   // 轉角內側落在別段路面上就停
              pts.push([x, y, (1.4 + 1.6 * Math.sin(Math.PI * q / len)) * (0.8 + 0.3 * Math.sin(q + ph))]);
            }
            for (const [x, y, r] of pts) { ell(x + 0.4, y + 0.9, r + 0.4, (r + 0.4) * 0.6); paint("rgba(30,50,80,.2)", null); }
            for (const [x, y, r] of pts) { ell(x, y, r, r * 0.62); paint(ICE.snow, null); }
            for (const [x, y, r] of pts) if (r > 2) { ell(x - r * 0.25, y - r * 0.2, r * 0.45, r * 0.18); paint("#ffffff", null); }
            d += len + 10 + R() * 24;
          }
        }
        // 路面薄雪斑（很淡，不蓋過冰面與怪）
        for (let d = 6; d < g.L; d += 22 + R() * 18) {
          const bx = g.x1 + ux * d + nx * (R() - 0.5) * 14, by = g.y1 + uy * d + ny * (R() - 0.5) * 14;
          if (bx < 0 || bx > 300) continue;
          ell(bx, by, 3 + R() * 3, 1.4 + R() * 1.2, Math.atan2(uy, ux)); c.fillStyle = "rgba(235,245,252,.32)"; c.fill();
        }
      }
    },

    // ── 出怪口：冰河崖上的冰裂隙（巫妖的紫光從縫裡透出）
    entrance(H, e) {
      const c = H.c, { poly, paint, ell, glow, lg, circ } = H.f, T = H.T, R = H.f.mulberry(313 + Math.round(e.y));
      c.save();
      if (e.side === "R") { c.translate(300, 0); c.scale(-1, 1); }
      c.translate(0, e.y);
      const yTop = -e.y - 2;   // 畫面頂端（區域座標）
      const mass = [[-6, yTop - 10], [62, yTop - 10], [58, -38], [50, -30], [40, -24], [30, -20], [26, -14], [24.5, -4], [26.5, 6], [24.5, 15], [28, 19], [25, 23.5], [14, 25], [-6, 25]];
      poly(mass); paint(lg(0, yTop, 0, 25, [ICE.iceL, ICE.ice, ICE.iceM]));
      // 切面（左上亮、右下暗）
      for (const f of [[[8, -34], [22, -40], [30, -28], [18, -24]], [[34, -36], [46, -40], [44, -30], [36, -26]], [[2, 18], [12, 16], [18, 24], [4, 25]]]) { poly(f); paint("rgba(255,255,255,.55)", null); }
      for (const f of [[[30, -20], [40, -24], [44, -30], [34, -26]], [[24.5, -4], [26.5, 6], [24.5, 15], [20, 6]], [[50, -30], [58, -38], [52, -40], [46, -32]]]) { poly(f); paint("rgba(40,90,140,.35)", null); }
      c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 0.7; c.lineCap = "round";
      c.beginPath(); c.moveTo(12, -36); c.lineTo(20, -30); c.moveTo(38, -34); c.lineTo(42, -29); c.stroke();
      poly(mass); paint(null, T.ol, T.olw * 1.1);
      // 崖頂積雪（掛在邊緣）
      ell(27, 21.5, 4, 1.7); paint(ICE.snow, ICE.snowLine, 0.5);
      // 冰裂隙開口
      const slit = [[-6, -15], [1, -21], [5, -33], [9, -23], [15, -18], [19.5, -6], [17, 5], [20.5, 15], [-6, 17]];
      poly(slit); paint(lg(0, -33, 0, 17, ICE.crevasse), T.ol, T.olw * 1.3);
      c.save(); poly(slit); c.clip();
      glow(5, 0, 20, ICE.lichGlow, 0.55);
      poly([[2, -19], [5, -30], [7, -21], [10, -16]]); paint("rgba(120,160,230,.25)", null);
      c.restore();
      poly([[5, -33], [9, -23], [15, -18], [19.5, -6], [17, 5], [20.5, 15]], false); c.strokeStyle = ICE.iceL; c.lineWidth = 1.4; c.stroke();
      // 開口上方的冰柱
      for (const [x, y, h] of [[1.5, -20, 4], [6.5, -26, 5], [11, -21, 4.5], [15.5, -17, 3.5], [20, -18.5, 4], [30, -19.5, 4.5], [37, -22.5, 3.5]]) { poly([[x - 1.3, y], [x + 1.3, y], [x, y + h]]); paint(ICE.iceL, T.ol, 0.45); }
      // 縫裡的眼睛
      for (const [x, y] of [[5, -5], [9, 7]]) { glow(x, y, 4.5, T.eyeGlow, 0.7); circ(x - 1.1, y, 0.75); paint(T.enemyEye, null); circ(x + 1.1, y, 0.75); paint(T.enemyEye, null); }
      // 寒霧從縫裡飄出
      for (let i = 0; i < 6; i++) { const x = 14 + i * 4.5, y = (R() - 0.5) * 12; ell(x, y, 5.5 - i * 0.5, 3.2 - i * 0.3); c.fillStyle = "rgba(225,242,255,.32)"; c.fill(); }
      // 崖上符文（巫妖領地）＋紫色破旗
      for (const [x, y] of [[16, -31], [48, -35]]) { glow(x, y, 5, ICE.lichGlow, 0.5); c.strokeStyle = "#f0e2ff"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 1.4, y - 1.6); c.lineTo(x, y + 1.6); c.lineTo(x + 1.4, y - 1.6); c.moveTo(x - 1.6, y); c.lineTo(x + 1.6, y); c.stroke(); }
      c.strokeStyle = T.ol; c.lineWidth = 1.8; c.beginPath(); c.moveTo(38, -24); c.lineTo(38, -40); c.stroke(); c.strokeStyle = "#3a3048"; c.lineWidth = 0.9; c.stroke();
      poly([[38, -39.5], [46, -38], [44, -35.5], [47, -33], [41, -32.5], [38, -33]]); paint(ICE.lich, T.ol, 0.6);
      // 開口前的冰塊碎屑（路緣）
      for (const [x, y, s] of [[24, -16, 1], [29, 16.5, 0.85], [34, -16.5, 0.7]]) { poly([[x - 2.4 * s, y + 1], [x - 1.6 * s, y - 2 * s], [x + 1.4 * s, y - 2.4 * s], [x + 2.6 * s, y + 1]]); paint(ICE.ice, T.ol, 0.55); }
      c.restore();
      spk(e.side === "R" ? 300 - 22 : 22, e.y - 36);
      return true;
    },

    // ── 裝飾（取代通用版）：雪松、冰柱岩、冰晶簇、雪堆、凍枯樹、符文石；城堡雪台
    decor(H) {
      const c = H.c, f = H.f, P = H.P, T = H.T, R2 = f.mulberry(4242 + 3 * 31), items = [], placed = [];
      let runes = 0;
      for (let gx = 4; gx < 300; gx += 10.5) for (let gy = 4; gy < 400; gy += 10.5) {
        const x = gx + (R2() - 0.5) * 7, y = gy + (R2() - 0.5) * 7, d = P.distRoad(x, y), k = R2();
        if (y < 30 || d < 18 || P.distWater(x, y) < 7 || P.inZone(x, y, 3) || P.slotNear(x, y, 19)) continue;
        const wild = Math.max(0, 1 - Math.min(...P.entries.map(e => HY(x - e.x, y - e.y))) / 125);
        let tall = k < (wild > 0.35 ? 0.22 : 0.2) && d > 24 && placed.every(p => HY(p[0] - x, p[1] - y) > 13);
        if (tall && (P.distRoad(x, y - 20) < 17 || P.slotNear(x, y - 14, 18) || P.inZone(x, y - 22, 2) || y < 44)) tall = false;
        if (tall) placed.push([x, y]);
        const s1 = 0.85 + R2() * 0.3, pick = R2();
        if (wild > 0.35) {
          if (tall) items.push({ y, f: () => pick < 0.5 ? frozenTree(H, x, y, 0.8 + pick * 0.5) : iceSpire(H, x, y, 0.85 + pick * 0.25) });
          else if (k < 0.3 && runes < 3 && d > 22 && pick < 0.35) { runes++; items.push({ y, f: () => runeStone(H, x, y) }); }
          else if (k < 0.34) items.push({ y, f: () => f.rock(x, y, 0.55 + pick * 0.45, R2) });
          else if (k < 0.42) items.push({ y, f: () => { f.crystals(x, y, R2); spk(x, y - 7); } });
          else if (k < 0.5) items.push({ y, f: () => drift(H, x, y, 0.7 + pick * 0.5) });
        } else {
          if (tall) items.push({ y, f: () => pick < 0.84 ? snowPine(H, x, y, s1, R2) : iceSpire(H, x, y, s1) });
          else if (k < 0.27) items.push({ y, f: () => f.bush(x, y, s1, R2) });
          else if (k < 0.32) items.push({ y, f: () => f.rock(x, y, 0.55 + pick * 0.4, R2) });
          else if (k < 0.37) items.push({ y, f: () => { f.crystals(x, y, R2); spk(x, y - 7); } });
          else if (k < 0.45) items.push({ y, f: () => drift(H, x, y, 0.7 + pick * 0.6) });
        }
      }
      // 城堡雪台（地面層：城堡層之下、讓出路面）
      const L = P.castle;
      if (L && L.type === "keep") {
        const gx = L.gx, fr = L.front;
        f.shadow(gx + 3, fr + 2.5, 38, 7.5, 0.3);
        c.save(); c.beginPath(); c.rect(-10, -10, 320, 420); c.rect(gx + 13.5, fr - 8, -27, 60); c.clip("evenodd");
        f.ell(gx, fr + 2.5, 36, 6.2); f.paint(f.lg(0, fr - 4, 0, fr + 9, [ICE.snow, ICE.snowS]), ICE.snowLine, 0.7);
        for (const sd of [-1, 1]) { f.ell(gx + sd * 27, fr + 4.5, 7, 2.2); f.paint("rgba(255,255,255,.85)", null); }
        c.restore();
      }
      items.sort((a, b) => a.y - b.y).forEach(it => it.f());
    },

    // ── 中央冰城堡：冰晶尖塔要塞（城牆＝雪覆石、尖塔＝冰晶），城門朝下方來路
    castle(H, L) {
      if (!L || L.type !== "keep") return false;
      const c = H.c, f = H.f, T = H.T, { poly, rr, ell, paint, lg, glow, cyl } = f;
      const gx = L.gx, fr = L.front, gt = L.gateTop, tip = (L.flags && L.flags[0] ? L.flags[0].y : fr - 70);
      const sg = (x, r, a, b, d) => lg(x - r, 0, x + r, 0, [d, b, a]);   // 光從右上
      const ol = T.ol, olw = T.olw;
      const crystal = (x0, x1, yb, ytip, tx) => { // 冰晶柱：左亮右暗、中稜高光
        const cx = tx == null ? (x0 + x1) / 2 : tx, w = x1 - x0, ys = ytip + w * 0.75;
        const pts = [[x0, yb], [x0, ys], [cx, ytip], [x1, ys], [x1, yb]];
        poly(pts); paint(ICE.ice);
        poly([[cx, yb], [cx, ytip], [x1, ys], [x1, yb]]); paint(ICE.iceM, null);
        poly([[x1 - w * 0.18, yb], [x1 - w * 0.18, ys + w * 0.1], [x1, ys], [x1, yb]]); paint(ICE.iceD, null);
        c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x0 + w * 0.22, yb - 2); c.lineTo(x0 + w * 0.22, ys + 1); c.lineTo(cx - w * 0.06, ytip + 2.5); c.stroke();
        c.strokeStyle = "rgba(40,90,140,.5)"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(cx, yb); c.lineTo(cx, ytip); c.stroke();
        poly(pts); paint(null, ol, olw);
      };
      const icicles = (x0, x1, y, n, len) => { for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / n, h = len * (0.6 + ((i * 7) % 5) / 10); poly([[x - 1, y], [x + 1, y], [x, y + h]]); paint(ICE.iceL, ol, 0.4); } };
      const snowCap = (x0, x1, y, h) => { // 牆頂積雪（下緣微垂）
        const w = x1 - x0; c.beginPath(); c.moveTo(x0 - 0.8, y + 1); c.quadraticCurveTo(x0 - 0.5, y - h, x0 + w * 0.3, y - h); c.lineTo(x1 - w * 0.3, y - h); c.quadraticCurveTo(x1 + 0.5, y - h, x1 + 0.8, y + 1);
        for (let i = 4; i >= 0; i--) { const x = x0 + w * i / 4; c.quadraticCurveTo(x + w / 8, y + 2.4, x, y + 0.6); }
        c.closePath(); paint(ICE.snow, ICE.snowLine, 0.55);
      };
      const stoneLines = (x0, x1, y0, y1) => { c.strokeStyle = ICE.stoneLine; c.lineWidth = 0.5; for (let r = 0, y = y0 + 6; y < y1 - 1; r++, y += 6) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); for (let x = x0 + (r % 2 ? 4 : 8); x < x1 - 1; x += 8) { c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x, y); c.stroke(); } } };
      const towerBody = (x, base, r, h) => { // 雪覆石圓塔身
        cyl(x, base, r, h, sg(x, r, ICE.stone[0], ICE.stone[1], ICE.stone[2]), null);
        c.strokeStyle = ICE.stoneLine; c.lineWidth = 0.5; for (let k = 1; k * 6.5 < h; k++) { c.beginPath(); c.ellipse(x, base - k * 6.5, r, r * 0.42, 0, 0.15, Math.PI - 0.15); c.stroke(); }
      };
      const ring = (x, top, r) => { // 塔頂垛口環＋積雪
        cyl(x, top + 1, r, 4, sg(x, r, ICE.stone[0], ICE.stone[1], ICE.stone[2]), ICE.stoneTop);
        for (let k = -2; k <= 2; k++) { rr(x + k * (r * 0.42) - 1.6, top - 5.6 + Math.abs(k) * 0.6, 3.2, 4.4, 0.6); paint(ICE.stone[1]); ell(x + k * (r * 0.42), top - 5.8 + Math.abs(k) * 0.6, 2, 0.9); paint(ICE.snow, null); }
        icicles(x - r * 0.8, x + r * 0.8, top + 3.2, 5, 3.2);
      };

      // 1) 後排：兩根斜冰晶＋主堡鼓座＋中央冰晶尖塔
      glow(gx, tip + 16, 26, ICE.glowCold, 0.35);
      crystal(gx - 17, gx - 8, fr - 34, tip + 9, gx - 13);
      crystal(gx + 8, gx + 17, fr - 34, tip + 12, gx + 13);
      towerBody(gx, fr - 26, 12.5, 16);
      ell(gx, fr - 42, 12.5, 5.2); paint(ICE.stoneTop);
      rr(gx - 1.6, fr - 37, 3.2, 6, 1.6); paint("#123050", null); glow(gx, fr - 34, 6, ICE.glowCold, 0.6);
      crystal(gx - 9.5, gx + 9.5, fr - 41, tip, gx);
      glow(gx - 2, tip + 14, 9, ICE.glowCold, 0.5);
      for (const [dx, h] of [[-10, 6], [-6.5, 8], [7, 7], [10.5, 5]]) { poly([[gx + dx - 1.8, fr - 40], [gx + dx, fr - 40 - h], [gx + dx + 1.8, fr - 40]]); paint(dx < 0 ? ICE.iceL : ICE.ice, ol, 0.5); }
      snowCap(gx - 12.5, gx + 12.5, fr - 41.5, 2.2);

      // 2) 城門樓（雪覆石）＋冰磚拱圈＋鐵柵門＋書徽
      const g0 = gx - 13, g1 = gx + 13;
      rr(g0, gt, g1 - g0, fr - gt, 0); paint(lg(0, gt, 0, fr, [ICE.stone[0], ICE.stone[1]]));
      rr(g1 - 5, gt, 5, fr - gt, 0); paint("rgba(30,50,80,.22)", null);
      stoneLines(g0, g1, gt + 4, fr);
      rr(g0 - 1.5, gt - 2.5, g1 - g0 + 3, 4.5, 0); paint(ICE.stoneTop);
      for (let x = g0 - 0.5; x < g1 - 2; x += 6.4) { rr(x, gt - 7, 4.2, 4.8, 0.6); paint(ICE.stone[1]); ell(x + 2.1, gt - 7.2, 2.6, 1); paint(ICE.snow, null); }
      snowCap(g0 - 1.5, g1 + 1.5, gt - 1.6, 1.6);
      icicles(g0 + 1, g1 - 1, gt + 2, 7, 3.6);
      rr(g0, gt, g1 - g0, fr - gt, 0); paint(null, ol, olw);
      // 冰磚拱圈
      const ax0 = gx - 11.5, ax1 = gx + 11.5, aTop = gt + 10.5, spring = fr - 9;
      c.beginPath(); c.moveTo(ax0, fr); c.lineTo(ax0, spring); c.quadraticCurveTo(gx, aTop - 7, ax1, spring); c.lineTo(ax1, fr); c.closePath(); paint(lg(0, aTop, 0, fr, [ICE.iceL, ICE.iceM]), ol, olw);
      for (const t of [0.12, 0.3, 0.5, 0.7, 0.88]) { const a = Math.PI * (1 - t), px = gx + Math.cos(a) * 11.5, py = spring - Math.sin(a) * (spring - aTop + 3); c.beginPath(); c.moveTo(gx + (px - gx) * 0.72, spring + (py - spring) * 0.72); c.lineTo(px, py); c.strokeStyle = "rgba(40,90,140,.55)"; c.lineWidth = 0.6; c.stroke(); }
      f.gateArch(gx - 8.5, gx + 8.5, gt + 14, fr);
      poly([[gx - 2.2, aTop - 0.5], [gx, aTop - 4.5], [gx + 2.2, aTop - 0.5], [gx, aTop + 3]]); paint(ICE.iceL, ol, 0.6);
      f.crestBook(gx, gt + 6, 3.8);

      // 3) 左高塔（冰藍尖頂，掛旗在 castleOverlay 的旗子旁）
      const lx = gx - 22, base = fr + 2, lh = 34, lr = 8.5, ltop = base - lh;
      towerBody(lx, base, lr, lh);
      rr(lx - 1.4, ltop + 9, 2.8, 6, 1.4); paint("#123050", null); glow(lx, ltop + 12, 7, ICE.glowCold, 0.55);
      ring(lx, ltop, 9.6);
      const rb = ltop - 5.4, rw = 10.2, rh = 24;
      poly([[lx - rw, rb], [lx, rb - rh], [lx + rw, rb]]); paint(sg(lx, rw, ICE.roof[0], ICE.roof[1], ICE.roof[2]));
      c.beginPath(); c.ellipse(lx, rb, rw, rw * 0.3, 0, 0, Math.PI); paint(ICE.roof[2]);
      poly([[lx - rw * 0.55, rb - rh * 0.45], [lx, rb - rh], [lx + rw * 0.5, rb - rh * 0.48], [lx + rw * 0.18, rb - rh * 0.4], [lx - rw * 0.05, rb - rh * 0.5], [lx - rw * 0.3, rb - rh * 0.38]]); paint(ICE.snow, null);
      for (const [dx, dy] of [[-6, -4], [4.5, -3], [-1.5, -9]]) { ell(lx + dx, rb + dy, 2.2, 0.9); paint("rgba(255,255,255,.85)", null); }
      poly([[lx - rw, rb], [lx, rb - rh], [lx + rw, rb]]); paint(null, ol, olw);
      icicles(lx - rw + 1, lx + rw - 1, rb + 1.6, 6, 3.4);
      SPK.push([lx, rb - rh + 2]);

      // 4) 右矮堡壘（避開右上塔位）＋側冰晶
      const rx = gx + 22, rh2 = 22, rtop = base - rh2;
      towerBody(rx, base, lr, rh2);
      ring(rx, rtop, 9.6);
      c.save(); c.translate(rx - 5, rtop - 4); c.rotate(-0.28);
      poly([[-2.4, 0], [-2.4, -5], [0, -9], [2.4, -5], [2.4, 0]]); paint(ICE.iceL, ol, 0.6); poly([[0, 0], [0, -9], [2.4, -5], [2.4, 0]]); paint(ICE.iceM, null);
      c.restore();

      // 5) 牆腳積雪（只在兩側，城門前讓路）
      for (const sd of [-1, 1]) {
        const x = gx + sd * 22;
        c.beginPath(); c.moveTo(x - 10, base + 1.5); c.quadraticCurveTo(x - 8, base - 3, x - 3, base - 2.5); c.quadraticCurveTo(x + 2, base - 4.5, x + 7, base - 2); c.quadraticCurveTo(x + 10, base - 1, x + 10, base + 1.5); c.closePath(); paint(lg(0, base - 7, 0, base + 2, [ICE.snow, ICE.snowS]), ICE.snowLine, 0.6);
      }
      for (const sd of [-1, 1]) { const x = gx + sd * 13; ell(x, fr - 0.5, 3.4, 1.8); paint(ICE.snow, ICE.snowLine, 0.5); }

      // 6) 裂痕重排到牆面（castleOverlay 依剩餘生命逐條畫）：左塔、右堡壘、城門樓上半輪流
      const R = f.mulberry(911), cr = [];
      for (let i = 0; i < 7; i++) {
        const k = i % 3; let x, y, step;
        if (k === 0) { x = lx - 5 + R() * 9; y = ltop + 6 + R() * 8; step = 4.5; }
        else if (k === 1) { x = rx - 5 + R() * 9; y = rtop + 4 + R() * 3; step = 3; }
        else { x = gx + (R() < 0.5 ? -1 : 1) * (8 + R() * 3); y = gt + 1 + R() * 2; step = 2.2; }
        const pts = [[x, y]]; let px = x, py = y;
        for (let s = 0; s < 3; s++) { px += (R() - 0.5) * 4; py += step * (0.6 + R() * 0.4); pts.push([px, py]); }
        cr.push(pts);
      }
      L.cracks = cr;
      SPK.push([gx, tip + 6], [gx - 13, tip + 14]);
      return true;
    },

    // ── 每幀：頂端極光帶（很淡）＋冰晶閃光（≤ 16 點）
    ambient(ctx, t, H) {
      if (!AUR && typeof document !== "undefined") {
        const k = document.createElement("canvas"); k.width = 320; k.height = 90; const g = k.getContext("2d");
        const bands = [["rgba(120,255,200,", 18, 16, 0.9], ["rgba(140,200,255,", 34, 12, 1.7], ["rgba(190,140,255,", 10, 10, 2.6]];
        for (const [col, y0, amp, ph] of bands) for (let x = 0; x < 320; x += 2) {
          const y = y0 + Math.sin(x * 0.03 + ph) * amp * 0.5 + Math.sin(x * 0.011 + ph * 2) * amp * 0.4, h = 22 + Math.sin(x * 0.05 + ph) * 8;
          const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, col + "0)"); gr.addColorStop(0.35, col + ".55)"); gr.addColorStop(1, col + "0)");
          g.fillStyle = gr; g.fillRect(x, y, 2.4, h);
        }
        AUR = k;
      }
      ctx.globalCompositeOperation = "lighter";
      if (AUR) {
        const a = 0.13 + 0.05 * Math.sin(t * 0.35);
        ctx.globalAlpha = a; ctx.drawImage(AUR, -10 + Math.sin(t * 0.12) * 8, -6, 320, 90);
        ctx.globalAlpha = a * 0.6; ctx.drawImage(AUR, 0, 0, 320, 90, 310 + Math.sin(t * 0.09 + 1) * 8, 4, -320, 70);
        ctx.globalAlpha = 1;
      }
      const n = Math.min(16, SPK.length);
      ctx.strokeStyle = "#ffffff"; ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const s = Math.sin(t * 1.3 + i * 2.39); if (s < 0.8) continue;
        const [x, y] = SPK[i], k = (s - 0.8) / 0.2, r = 1.2 + k * 2.6;
        ctx.globalAlpha = 0.35 + k * 0.6; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        ctx.fillStyle = "rgba(200,240,255,.9)"; ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    }
  };
})();
