/* 929 文法片語守衛戰 v3：文法騎士外觀進化（DESIGN_v3 第三節「5／10／15／20 級換盔甲造型」）
   全部 canvas 自繪向量（不用 emoji／圖檔／字型），沿用 art-sprites.js 的星夜奇幻主題（ART.theme：描邊色 T.ol、線寬 T.olw、右側受光）。

   ── 五個階段（ART.KNIGHT_STAGES）
     0 見習騎士  Lv 1–4   皮甲、皮帽露臉、短木劍、圓木盾、短褐斗篷
     1 鐵衛騎士  Lv 5–9   鐵甲、桶盔＋紅羽、騎士劍、深藍鳶盾金星（≈原本的騎士）
     2 銀翼騎士  Lv 10–14 銀甲＋肩甲、翼盔、長劍藍寶石、銀框書本盾、藍色地面光
     3 金獅騎士  Lv 15–19 金甲＋尖肩甲、高冠長羽、巨劍、紅底金日盾、紅金披風、金色光環＋火星
     4 星光傳說  Lv 20    星夜甲＋發光符紋、王冠盔＋光環、光之劍、星徽盾、星空披風、光柱＋環繞星塵

   ── 介面（座標＝遊戲邏輯座標 300×400，呼叫前 ctx 已設好縮放；與 ART.hero 同一套錨點：腳底畫在 y+5）
     ART.knightStage(lv)            → 0~4（lv＝騎士等級）
     ART.KNIGHT_STAGES[i]           → { id, name, minLv, desc }
     ART.drawKnight(ctx, x, y, o)   o＝{
         stage（0~4，或給 lv 自動換算）, t（秒，動畫用）,
         anim："idle"｜"attack"｜"block"（可省略：有 attack>0 就是揮砍、block:true 就是擋路）,
         attack（1＝剛出手→0，跟 ART.hero 的 st.attack 一樣；anim:"attack" 沒給時預設 0.8）,
         block（true＝擋路姿勢：盾舉到前方、劍舉在盾上、身體壓低）,
         flash（0~1 受傷閃白）, facing 或 dir（±1，-1＝朝左）, alpha, noFx（不畫揮砍弧光與粒子）, sel（被選中：腳下光圈加亮）}
     ART.knightTop(stage)           → 頭頂相對 y 的位移（畫血條用，取代 ART.heroTop("knight")）
     ART.knightIcon(canvas, stage[, pose]) → 畫到小 canvas（技能樹／外觀預覽／選角用），pose＝"idle"｜"attack"｜"block"
     ART.installKnightStages(getStage)    → 一行接上：把 ART.hero／ART.heroTop／ART.icon 的 "knight" 改走新外觀。
         getStage(st) 回傳階段 0~4（可省略：改讀 st.knightStage，或 st.knightLv 換算）。其他英雄不受影響。
     ART.KNIGHT_ART_VERSION

   ── 整合方式（給整合負責人）
     1. index.html 在 art/art-sprites.js 之後載入 art/knight-art.js；build.mjs 白名單加 art/knight-art.js（knight-art-sheet.html 與 _preview/ 不上線）。
     2. 最省事：開局後呼叫一次
          ART.installKnightStages(() => ART.knightStage(S.mods.knight ? S.mods.knight.lv : 1));
        畫面現有的 ART.hero(ctx, "knight", …, st) 不用改；建議在 st 補 block:(o.blockedN>0||o.wallT>0)，擋路時會換成舉盾姿勢。
        血條高度自動改用 ART.knightTop；蓋塔面板／選角的 ART.icon(canvas,"hero","knight") 也會變成目前階段。
     3. 或不 install，直接在 draw() 的英雄段：if (id==="knight") ART.drawKnight(ctx, o.x, o.y, { stage, t, attack, flash, dir, block }) 。
     4. 絕招演出要跟著升級時可讀 ART.KNIGHT_FX[stage]（揮砍弧光主色／粒子色），給騎士畫面組用。

   ── 效能
     本體（不含揮砍弧光與粒子）依「階段｜呼吸幀(4)｜姿勢(閒置／揮砍3段／擋路)｜解析度」畫到離屏 canvas，同一階同一幀只畫一次；
     閃白用不含光暈的剪影上色版本（也快取）；揮砍弧光與星塵每幀即時畫（≤ 8 個小光點，很便宜）。快取上限約 5e6 像素、最近最少使用淘汰。
*/
(function (root) {
  "use strict";
  const ART = root.ART = root.ART || {};
  const PI = Math.PI, PI2 = PI * 2;
  const FALLBACK_T = { ol: "#0c1122", olw: 1.14, lightLeft: false, gold: "#E1B86A", goldL: "#F3D494", pupil: "#120a1e", skin: "#f0c8a0", shadowRGB: "0,0,10", shadowA: .42, allyRing: "#6ac8ff", allyRingFill: "rgba(106,200,255,.18)", cape: "#2c4f86", blade: "#e8f0f8", plume: "#d0506a", shield: "#2c4f86", woodDark: "#4a3624", bossAura: "rgba(255,190,90,A)" };
  let T = ART.theme || FALLBACK_T;
  let c = null, NOFX = false;

  // ═════ 小工具（同 art-sprites.js 的畫法）
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
  const lg = (x1, y1, x2, y2, stops) => { const g = c.createLinearGradient(x1, y1, x2, y2); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const rg = (x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  function shadow(x, y, rx, ry, a) { if (NOFX) return; ell(x, y, rx, ry); c.fillStyle = `rgba(${T.shadowRGB},${a == null ? T.shadowA : a})`; c.fill(); }
  function glow(x, y, r, col, a) { if (NOFX) return; c.save(); c.globalCompositeOperation = "lighter"; circ(x, y, r); c.fillStyle = rg(x, y, 0, r, [col.replace("A", a), col.replace("A", 0)]); c.fill(); c.restore(); }
  const sg3 = (x, r, p) => lg(x - r, 0, x + r, 0, T.lightLeft ? [p[0], p[1], p[2]] : [p[2], p[1], p[0]]);
  function star(x, y, r, fill, lw) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, k = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } c.closePath(); paint(fill, null); c.lineWidth = lw || T.olw * 0.8; c.strokeStyle = T.ol; c.stroke(); }
  // 四芒星（光點、星徽）
  function star4(g, x, y, r, k) { k = k || 0.28; g.beginPath(); for (let i = 0; i < 8; i++) { const a = -PI / 2 + i * PI / 4, d = i % 2 ? r * k : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); }
  // 在暫時的縮放座標下建路徑（線寬不受影響）
  function scaledPath(x, y, k, fn) { c.save(); c.translate(x, y); c.scale(k, k); fn(); c.restore(); }

  // ═════ 階段資料
  const STAGES = [
    { id: "squire", name: "見習騎士", minLv: 1, desc: "皮甲、圓木盾、短劍" },
    { id: "iron", name: "鐵衛騎士", minLv: 5, desc: "鐵甲、桶盔紅羽、鳶形盾" },
    { id: "silver", name: "銀翼騎士", minLv: 10, desc: "銀甲翼盔、長劍、書本盾" },
    { id: "gold", name: "金獅騎士", minLv: 15, desc: "金甲高冠、巨劍、金日盾、金色光環" },
    { id: "star", name: "星光傳說騎士", minLv: 20, desc: "星夜甲、光環王冠、光之劍、星空披風" }
  ];
  ART.KNIGHT_STAGES = STAGES;
  ART.knightStage = lv => { lv = +lv || 1; return lv >= 20 ? 4 : lv >= 15 ? 3 : lv >= 10 ? 2 : lv >= 5 ? 1 : 0; };

  // 配色：armor＝[亮, 中, 暗]（右側受光）
  const PAL = [
    { scale: 0.95, armor: ["#e6bc8c", "#b07a48", "#674226"], boot: "#4e3320", belt: "#4a3020", buckle: "#c8a060", cape: ["#94704a", "#5e452c"] },
    { scale: 1.0, armor: ["#cfd6de", "#8e99a7", "#4e5866"], boot: "#3e4652", belt: "#5a3e28", buckle: "#E1B86A", cape: ["#3a62a0", "#203a68"], plume: "#d0506a" },
    { scale: 1.06, armor: ["#ffffff", "#d2def0", "#8296b4"], boot: "#6a7c98", belt: "#2c4f86", buckle: "#F3D494", cape: ["#3a6ab8", "#1c3466"], trim: "#5ab4ee", hem: "#E1B86A" },
    { scale: 1.12, armor: ["#fff4c6", "#ecbe5e", "#9a6824"], boot: "#7a4e1e", belt: "#a83448", buckle: "#fff2c8", cape: ["#c4404e", "#6a1828"], trim: "#c4404e", hem: "#F3D494", plume: "#e0485e" },
    { scale: 1.17, armor: ["#dfe8ff", "#7482d8", "#272a6c"], boot: "#1e2056", belt: "#F3D494", buckle: "#8af0ff", cape: ["#3a3a9a", "#160f40"], trim: "#F3D494", hem: "#F3D494", rune: "#8af0ff" }
  ];
  // 演出配色（揮砍弧光 rgb、粒子 rgb）給騎士畫面組
  const FX = [
    { arc: "225,232,240", tip: "rgba(255,240,210,A)", spark: null, r1: 13.5, r0: 8.5 },
    { arc: "200,230,255", tip: "rgba(255,190,90,A)", spark: null, r1: 15, r0: 9.5 },
    { arc: "140,210,255", tip: "rgba(120,200,255,A)", spark: "150,215,255", r1: 16.5, r0: 10 },
    { arc: "255,214,120", tip: "rgba(255,190,90,A)", spark: "255,200,110", r1: 18, r0: 10.5 },
    { arc: "150,240,255", tip: "rgba(150,240,255,A)", spark: "200,245,255", r1: 20, r0: 11 }
  ];
  ART.KNIGHT_FX = FX;

  const BREATH = [0, -0.35, -0.7, -0.35], SWAY = [0, 0.7, 1.3, 0.6];
  const ROT = [0.55, 1.05, 1.9, 1.35];   // 劍角度：閒置／揮到一半／劈到底／收劍（同 art-sprites.js）

  // ═════ 部件
  function allyRing(s, sel) {
    if (NOFX) return;
    ell(0, 1, 11.5 + s * 0.4, 4.4 + s * 0.15); c.fillStyle = T.allyRingFill; c.fill();
    c.strokeStyle = T.allyRing; c.lineWidth = sel ? 1.8 : 1.3; c.stroke();
  }
  // 地面光（2 階起）：銀＝淡藍、金＝暖金＋虛線光環、星光＝金藍光暈＋光柱
  function groundAura(s) {
    if (NOFX || s < 2) return;
    c.save(); c.globalCompositeOperation = "lighter";
    if (s === 2) { ell(0, 1, 14, 5.4); c.fillStyle = rg(0, 1, 2, 14, ["rgba(120,200,255,.38)", "rgba(120,200,255,0)"]); c.fill(); }
    if (s === 3) {
      ell(0, 1, 16, 6.2); c.fillStyle = rg(0, 1, 2, 16, ["rgba(255,205,110,.5)", "rgba(255,205,110,0)"]); c.fill();
    }
    if (s === 4) {
      ell(0, 1, 18, 7); c.fillStyle = rg(0, 1, 2, 18, ["rgba(170,230,255,.5)", "rgba(255,214,120,.22)", "rgba(255,214,120,0)"]); c.fill();
      // 光柱
      c.beginPath(); c.moveTo(-9, 1); c.lineTo(-5, -34); c.lineTo(5, -34); c.lineTo(9, 1); c.closePath();
      c.fillStyle = lg(0, 1, 0, -34, ["rgba(150,220,255,.26)", "rgba(150,220,255,.08)", "rgba(150,220,255,0)"]); c.fill();
    }
    c.restore();
    if (s >= 3) {
      ell(0, 1, s === 4 ? 15.5 : 14, s === 4 ? 6 : 5.4); c.strokeStyle = s === 4 ? "rgba(243,212,148,.85)" : "rgba(247,206,131,.8)"; c.lineWidth = 0.8; c.setLineDash([2.2, 1.8]); c.stroke(); c.setLineDash([]);
    }
  }

  function cape(s, b, sw, blk) {
    const P = PAL[s];
    if (s === 0) {
      // 短褐斗篷（到腰下，鋸齒破邊）
      c.beginPath(); c.moveTo(-4, -12.5 + b); c.quadraticCurveTo(-7.5 - sw * 0.4, -8, -6.5 - sw * 0.8, -4.5);
      c.lineTo(-5 - sw * 0.6, -5.6); c.lineTo(-3.8 - sw * 0.5, -4.2); c.lineTo(-2.4 - sw * 0.3, -5.4); c.lineTo(-1, -4.4);
      c.quadraticCurveTo(2, -6, 4, -12.5 + b); c.closePath(); paint(lg(0, -12, 0, -4, P.cape));
      return;
    }
    const W = [0, 8, 8.8, 9.6, 10.6][s], Y = [0, 0.2, 0.9, 1.4, 1.8][s], tail = [0, 0, 0.6, 1.2, 2.6][s] * (1 + sw * 0.5);
    const top = -12.5 + b;
    c.beginPath(); c.moveTo(-4.2, top);
    c.quadraticCurveTo(-W - sw * 0.5, -4, -W + 1.5 - sw - tail, Y);
    c.quadraticCurveTo(-3.5 - sw * 0.6, Y - 1.2 + sw * 0.4, -0.5, Y);
    c.quadraticCurveTo(3, Y - 1, 6.5 - sw * 0.3, Y - 0.2);
    c.quadraticCurveTo(W, -4, 4.2, top); c.closePath();
    // 填色
    if (s === 4) paint(lg(0, top, 0, Y, ["#3a44a8", "#2a1f78", "#4a2a8a"]));
    else paint(lg(0, top, 0, Y, P.cape));
    // 星空披風：小星點（固定位置）
    if (s === 4 && !NOFX) {
      c.save(); c.clip();
      const pts = [[-6.5, -8, 0.6], [-4, -3, 0.45], [-7.6, -1, 0.5], [-2.2, -7, 0.4], [-5.2, -5.6, 0.35], [-1.2, -1.5, 0.5], [-8.4, -4.2, 0.4], [-3, 0, 0.35]];
      for (const [px, py, r] of pts) { star4(c, px - sw * 0.3, py, r * 2.2, 0.3); c.fillStyle = "#eef6ff"; c.fill(); }
      // 銀河帶
      c.beginPath(); c.moveTo(-9, -1); c.quadraticCurveTo(-5, -5, -1, -10); c.strokeStyle = "rgba(200,180,255,.35)"; c.lineWidth = 1.6; c.stroke();
      c.restore();
    }
    // 光澤
    c.beginPath(); c.moveTo(-3, top + 2); c.quadraticCurveTo(-5.5 - sw * 0.4, -5, -5 - sw * 0.8 - tail * 0.5, Y - 1.2); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 0.7; c.stroke();
    // 金邊下襬
    if (P.hem) {
      c.beginPath(); c.moveTo(-W + 1.5 - sw - tail, Y); c.quadraticCurveTo(-3.5 - sw * 0.6, Y - 1.2 + sw * 0.4, -0.5, Y); c.quadraticCurveTo(3, Y - 1, 6.5 - sw * 0.3, Y - 0.2);
      c.strokeStyle = P.hem; c.lineWidth = s >= 3 ? 1.1 : 0.8; c.stroke();
    }
    void blk;
  }

  function legs(s, crouch) {
    const P = PAL[s];
    for (const k of [-1, 1]) {
      rr(k * 2.3 - 1.65, -2.6 + crouch * 0.3, 3.3, 3.1, 0.8); paint(P.boot);
      if (s >= 2) { rr(k * 2.3 - 1.65, -2.6 + crouch * 0.3, 3.3, 1, 0.4); paint(s === 4 ? T.goldL : P.armor[1], null); }
    }
  }

  function torso(s, b) {
    const P = PAL[s];
    rr(-4.5, -13 + b, 9, 11, 2.5); paint(sg3(0, 4.5, P.armor));
    if (s === 0) {
      // 皮甲：交叉綁繩＋肩帶
      line([[-1.6, -11.6 + b], [1.4, -9 + b], [-1.4, -9 + b], [1.6, -11.6 + b]], "#5a3a20", 0.6);
      line([[-4, -12.2 + b], [3.6, -5.4 + b]], "#6a4628", 1.1);
    } else if (s === 1) {
      for (const k of [-1, 1]) { circ(k * 2.4, -10.6 + b, 0.55); paint("#e8eef4", T.ol, 0.35); }
      line([[0, -12.4 + b], [0, -7.6 + b]], "rgba(255,255,255,.35)", 0.6);
    } else if (s === 2) {
      line([[-3.4, -11.8 + b], [0, -9.2 + b], [3.4, -11.8 + b]], P.trim, 0.8);
      poly([[0, -11 + b], [1.2, -9.6 + b], [0, -8.2 + b], [-1.2, -9.6 + b]]); paint("#5ab4ee", T.ol, 0.45);
      glow(0, -9.6 + b, 3, "rgba(120,200,255,A)", 0.6);
    } else if (s === 3) {
      // 胸口小金日
      circ(0, -9.8 + b, 1.5); paint("#fff2c8", T.ol, 0.45);
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; line([[Math.cos(a) * 1.9, -9.8 + b + Math.sin(a) * 1.9], [Math.cos(a) * 2.8, -9.8 + b + Math.sin(a) * 2.8]], "#9a6824", 0.55); }
      line([[-4.2, -12.3 + b], [4.2, -12.3 + b]], P.trim, 0.9);
    } else {
      // 星座符紋（發光）
      glow(0, -9.6 + b, 3.6, "rgba(140,240,255,A)", 0.4);
      line([[-2.6, -11.4 + b], [0, -9.6 + b], [2.4, -11.2 + b]], P.rune, 0.55); line([[0, -9.6 + b], [-1.2, -7.6 + b]], P.rune, 0.55);
      star4(c, 0, -9.6 + b, 1.9, 0.32); paint("#ffffff", T.ol, 0.4);
      line([[-4.2, -12.4 + b], [4.2, -12.4 + b]], P.trim, 0.8);
    }
    // 腰帶
    rr(-4.6, -7 + b, 9.2, 1.8, 0.6); paint(P.belt, T.ol, 0.5);
    rr(-0.9, -7.2 + b, 1.8, 2.2, 0.4); paint(P.buckle, T.ol, 0.4);
    // 裙甲（2 階起）
    if (s >= 2) { for (const k of [-1, 0, 1]) { rr(k * 2.9 - 1.35, -5.4 + b, 2.7, 2.6, 0.6); paint(P.armor[s === 4 ? 1 : 2], T.ol, 0.45); } }
  }

  function pauldrons(s, b) {
    if (s === 0) return;
    const P = PAL[s], y = -12.4 + b;
    for (const k of [-1, 1]) {
      const rx = [0, 2.4, 2.9, 3.4, 3.4][s], ry = [0, 1.7, 2.0, 2.3, 2.3][s], x = k * 4.3;
      if (s === 3) { poly([[x + k * 1.6, y - 1.2], [x + k * 3.6, y - 4.4], [x + k * 3.4, y - 0.8]]); paint("#fff4c6", T.ol, 0.45); }
      if (s === 4) { poly([[x + k * 1.2, y - 1.6], [x + k * 2.2, y - 4.6], [x + k * 3.4, y - 1.2]]); paint(T.goldL, T.ol, 0.45); }
      ell(x, y, rx, ry); paint(sg3(x, rx, P.armor));
      if (s >= 2) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0.15, PI - 0.15); c.strokeStyle = s === 2 ? P.trim : T.goldL; c.lineWidth = 0.8; c.stroke(); }
      if (s === 4) { circ(x, y - 0.3, 0.7); paint(P.rune, null); }
    }
  }

  // 劍：在 (px,py) 轉 rot 後畫（刀身朝上）
  function sword(s, px, py, rot) {
    c.save(); c.translate(px, py); c.rotate(rot);
    if (s === 0) {
      rr(-0.8, -8.6, 1.6, 7.6, 0.6); paint("#c4ccd6", T.ol, 0.6);
      rr(-2.2, -1.3, 4.4, 1.4, 0.5); paint("#8a6a48", T.ol, 0.5); rr(-0.65, 0, 1.3, 2.6, 0.5); paint(T.woodDark, null);
    } else if (s === 1) {
      rr(-0.9, -13, 1.8, 12, 0.6); paint(T.blade, T.ol, 0.6);
      rr(-2.8, -1.4, 5.6, 1.6, 0.6); paint(T.gold, T.ol, 0.5); rr(-0.7, 0, 1.4, 3, 0.5); paint(T.woodDark, null);
    } else if (s === 2) {
      poly([[-1.1, -1], [-1.1, -13], [0, -15.6], [1.1, -13], [1.1, -1]]); paint(lg(-1.1, 0, 1.1, 0, ["#9aaecc", "#ffffff"]), T.ol, 0.6);
      line([[0, -2], [0, -12.6]], "rgba(70,130,200,.7)", 0.5);
      c.beginPath(); c.moveTo(-3.4, -2.4); c.quadraticCurveTo(0, -0.6, 3.4, -2.4); c.lineTo(3, -1); c.quadraticCurveTo(0, 0.6, -3, -1); c.closePath(); paint("#dfe8f4", T.ol, 0.5);
      circ(0, -1, 0.9); paint("#5ab4ee", T.ol, 0.4);
      rr(-0.7, 0, 1.4, 3, 0.5); paint("#2c4f86", null); circ(0, 3.4, 0.8); paint("#dfe8f4", T.ol, 0.4);
    } else if (s === 3) {
      glow(0, -9, 7, "rgba(255,210,120,A)", 0.45);
      poly([[-1.5, -1], [-1.5, -14.6], [0, -17.4], [1.5, -14.6], [1.5, -1]]); paint(lg(-1.5, 0, 1.5, 0, ["#d8c8a8", "#fffaf0"]), T.ol, 0.65);
      rr(-0.45, -14, 0.9, 12.5, 0.4); paint("#ecbe5e", null);
      // 翼形護手
      c.beginPath(); c.moveTo(-1.4, -1.8); c.quadraticCurveTo(-3.6, -1.6, -4.6, -4); c.quadraticCurveTo(-4, -1, -1.4, -0.2); c.closePath(); paint(T.goldL, T.ol, 0.45);
      c.beginPath(); c.moveTo(1.4, -1.8); c.quadraticCurveTo(3.6, -1.6, 4.6, -4); c.quadraticCurveTo(4, -1, 1.4, -0.2); c.closePath(); paint(T.goldL, T.ol, 0.45);
      rr(-2.2, -1.6, 4.4, 1.6, 0.6); paint("#ecbe5e", T.ol, 0.5);
      rr(-0.75, 0, 1.5, 3.2, 0.5); paint("#7a1e2c", null); circ(0, 3.6, 0.95); paint("#c4404e", T.ol, 0.4);
    } else {
      // 光之劍
      if (!NOFX) {
        c.save(); c.globalCompositeOperation = "lighter";
        rr(-3.4, -20, 6.8, 20, 3.4); c.fillStyle = lg(0, -20, 0, 0, ["rgba(150,240,255,.0)", "rgba(150,240,255,.45)", "rgba(150,240,255,.25)"]); c.fill();
        c.restore();
      }
      poly([[-1.4, -1], [-1.4, -16.4], [0, -19.4], [1.4, -16.4], [1.4, -1]]); paint(lg(0, -19, 0, 0, ["#ffffff", "#c8fbff", "#7ae8ff"]), T.ol, 0.6);
      rr(-0.4, -16, 0.8, 14.5, 0.4); paint("#ffffff", null);
      star4(c, 0, -1.2, 3.6, 0.3); paint(T.goldL, T.ol, 0.45);
      rr(-0.75, 0.6, 1.5, 2.8, 0.5); paint("#272a6c", null); circ(0, 3.8, 0.95); paint("#8af0ff", T.ol, 0.4);
    }
    c.restore();
  }

  function shieldShape(s) {
    // 回傳以 (0,0) 為中心、單位座標的盾形路徑建構函式
    if (s === 1) return () => { c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(3.5, -4); c.lineTo(3.2, 2); c.quadraticCurveTo(0, 5.6, 0, 5.6); c.quadraticCurveTo(-3.3, 3, -3.5, 2); c.closePath(); };
    if (s === 2) return () => { c.beginPath(); c.moveTo(-4, -4.4); c.quadraticCurveTo(0, -5.2, 4, -4.4); c.lineTo(4, 0.6); c.quadraticCurveTo(3.4, 4.4, 0, 6.2); c.quadraticCurveTo(-3.4, 4.4, -4, 0.6); c.closePath(); };
    if (s === 3) return () => { c.beginPath(); c.moveTo(-4.6, -5); c.lineTo(-1.6, -5); c.lineTo(0, -6.2); c.lineTo(1.6, -5); c.lineTo(4.6, -5); c.lineTo(4.6, 1); c.quadraticCurveTo(4, 5, 0, 7.2); c.quadraticCurveTo(-4, 5, -4.6, 1); c.closePath(); };
    return () => { c.beginPath(); c.moveTo(-4.8, -4.4); c.quadraticCurveTo(-2, -4.8, 0, -6.6); c.quadraticCurveTo(2, -4.8, 4.8, -4.4); c.lineTo(4.6, 1.4); c.quadraticCurveTo(3.6, 5.2, 0, 7.4); c.quadraticCurveTo(-3.6, 5.2, -4.6, 1.4); c.closePath(); };
  }
  function shield(s, sx, sy, blk) {
    if (s === 0) {
      // 圓木盾：木紋＋鐵框＋盾心
      circ(sx, sy, 3.9); paint(lg(sx - 3.9, sy, sx + 3.9, sy, ["#6e4c2c", "#a07a52"]));
      for (const k of [-1.3, 1.3]) line([[sx + k, sy - 3.6], [sx + k, sy + 3.6]], "rgba(40,24,10,.55)", 0.45);
      circ(sx, sy, 3.9); c.strokeStyle = "#8a94a4"; c.lineWidth = 0.9; c.stroke(); circ(sx, sy, 4.4); paint(null, T.ol, 0.6);
      circ(sx, sy, 1.15); paint("#aab4c2", T.ol, 0.45);
      return;
    }
    const sh = shieldShape(s);
    const rim = [0, "#2c4f86", "#e8eef6", "#F3D494", "#F3D494"][s], field = [0, "#2c4f86", "#2c4f86", "#b0343f", "#22246a"][s];
    scaledPath(sx, sy, 1, sh); paint(s === 1 ? field : rim);
    if (s >= 2) { scaledPath(sx, sy + 0.25, 0.74, sh); paint(s === 4 ? lg(sx, sy - 5, sx, sy + 5, ["#3a3ea0", "#160f40"]) : field, null); }
    if (s === 1) { star(sx, sy - 0.2, 1.9, T.gold); }
    else if (s === 2) {
      // 打開的書（文法騎士）
      const y = sy - 0.2;
      c.beginPath(); c.moveTo(sx, y - 1.2); c.quadraticCurveTo(sx - 1.4, y - 2, sx - 2.6, y - 1.5); c.lineTo(sx - 2.6, y + 1.5); c.quadraticCurveTo(sx - 1.4, y + 1, sx, y + 1.8); c.closePath(); paint("#f6f2e4", T.ol, 0.45);
      c.beginPath(); c.moveTo(sx, y - 1.2); c.quadraticCurveTo(sx + 1.4, y - 2, sx + 2.6, y - 1.5); c.lineTo(sx + 2.6, y + 1.5); c.quadraticCurveTo(sx + 1.4, y + 1, sx, y + 1.8); c.closePath(); paint("#ffffff", T.ol, 0.45);
      line([[sx - 2, y - 0.6], [sx - 0.6, y - 0.4]], "#5ab4ee", 0.35); line([[sx + 0.6, y - 0.4], [sx + 2, y - 0.6]], "#5ab4ee", 0.35);
    } else if (s === 3) {
      const y = sy + 0.2;
      for (let i = 0; i < 12; i++) { const a = i * PI / 6; poly([[sx + Math.cos(a - 0.18) * 1.6, y + Math.sin(a - 0.18) * 1.6], [sx + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1], [sx + Math.cos(a + 0.18) * 1.6, y + Math.sin(a + 0.18) * 1.6]]); paint(T.goldL, null); }
      circ(sx, y, 1.7); paint("#fff4c6", T.ol, 0.5);
    } else {
      const y = sy + 0.3;
      glow(sx, y, 5.5, "rgba(140,240,255,A)", 0.7);
      star4(c, sx, y, 3.6, 0.26); paint("#eaffff", T.ol, 0.45);
      star4(c, sx, y, 1.6, 0.4); c.save(); c.translate(sx, y); c.rotate(PI / 4); c.translate(-sx, -y); star4(c, sx, y, 2.2, 0.3); c.restore(); paint(T.goldL, null);
    }
    scaledPath(sx, sy, 1, sh); paint(null, T.ol, s >= 3 ? 1.2 : T.olw);
    if (blk && s >= 2 && !NOFX) { c.beginPath(); c.moveTo(sx + 1.6, sy - 3.6); c.lineTo(sx + 2.8, sy - 3.2); c.lineTo(sx + 2.6, sy + 0.4); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 0.6; c.stroke(); }
  }

  function head(s, b, sw) {
    const P = PAL[s], hy = -16.5 + b;
    if (s === 0) {
      // 露臉＋皮帽＋頭帶飄尾
      circ(0, hy + 0.2, 4.3); paint(T.skin);
      for (const k of [-1, 1]) { circ(0.6 + k * 1.5, hy + 0.6, 0.6); paint(T.pupil, null); }
      c.beginPath(); c.moveTo(0.1, hy + 2.4); c.quadraticCurveTo(0.6, hy + 2.9, 1.2, hy + 2.4); c.strokeStyle = "#8a4a3a"; c.lineWidth = 0.45; c.stroke();
      c.beginPath(); c.moveTo(-4.7, hy - 0.4); c.quadraticCurveTo(-4.6, hy - 5.2, 0, hy - 5.1); c.quadraticCurveTo(4.6, hy - 5.2, 4.7, hy - 0.4); c.quadraticCurveTo(0, hy - 1.6, -4.7, hy - 0.4); c.closePath(); paint(sg3(0, 4.7, P.armor));
      line([[-4.4, hy - 0.8], [4.4, hy - 0.8]], "#4a3020", 0.6);
      c.beginPath(); c.moveTo(-4.2, hy - 0.9); c.quadraticCurveTo(-6.5 - sw, hy - 0.2, -7.6 - sw * 1.2, hy + 1.6 + sw * 0.3); c.quadraticCurveTo(-6.2 - sw, hy + 0.6, -4.2, hy + 0.2); c.closePath(); paint("#a8483a");
      return;
    }
    // 頭盔本體
    const hr = [0, 4.6, 4.7, 4.8, 4.8][s];
    if (s === 4) glow(0, hy - 9.5, 6.5, "rgba(255,220,130,A)", 0.5);
    // 後方羽飾／翼
    if (s === 1) {
      c.beginPath(); c.moveTo(-0.5, hy - 4.5); c.quadraticCurveTo(-6, hy - 9.5 - sw * 0.3, -8 - sw * 0.9, hy - 2.5 + sw * 0.3); c.quadraticCurveTo(-4, hy - 5.5, 0.5, hy - 4); c.closePath(); paint(P.plume);
    } else if (s === 3) {
      c.beginPath(); c.moveTo(0, hy - 7.2); c.quadraticCurveTo(-7, hy - 12.5 - sw * 0.3, -11 - sw * 1.1, hy - 2.4 + sw * 0.4); c.quadraticCurveTo(-8.6 - sw, hy - 3.6, -7.4 - sw * 0.8, hy - 0.4); c.quadraticCurveTo(-5, hy - 7, 0.8, hy - 5.4); c.closePath(); paint(lg(0, hy - 12, -10, hy, [P.plume, "#9a2a3a"]));
      c.beginPath(); c.moveTo(-1.5, hy - 7.4); c.quadraticCurveTo(-6, hy - 10, -9 - sw, hy - 4); c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 0.6; c.stroke();
    } else if (s === 4) {
      // 極光飄帶（兩條細長光帶往後飄）
      for (const [dy, len, w, cols] of [[0, 12.5, 1.5, ["#9affe8", "#8ad0ff", "rgba(200,160,255,.85)"]], [2.2, 9.5, 1.1, ["#e8a8ff", "#8ad0ff", "rgba(154,255,232,.8)"]]]) {
        const x0 = -1.5, y0 = hy - 4.6 + dy, tx = x0 - len - sw * 1.3, ty = y0 + 3.2 + sw * 0.4;
        c.beginPath(); c.moveTo(x0 + 1, y0 - w * 0.6); c.quadraticCurveTo(x0 - len * 0.45, y0 - 2.6 - sw * 0.3, tx, ty); c.quadraticCurveTo(x0 - len * 0.5, y0 - 0.4 + w, x0, y0 + w * 0.9); c.closePath();
        paint(lg(x0, y0, tx, ty, cols), T.ol, 0.8);
      }
    }
    if (s === 2) {
      // 翼盔：每側三根羽毛呈扇形（先描粗邊再填色＝聯集外框）
      const fe = [];
      for (const k of [-1, 1]) {
        const bx = k * 3.9, by = hy - 1.2, sway = k < 0 ? sw * 0.06 : 0;
        [[0.28, 6.6], [0.72, 5.4], [1.15, 4.1]].forEach(([a, L]) => { const th = -PI / 2 + k * (a + sway); fe.push([bx + Math.cos(th) * L * 0.5, by + Math.sin(th) * L * 0.5, L * 0.5, 1.25, th]); });
      }
      c.strokeStyle = T.ol; c.lineWidth = T.olw * 2; for (const f of fe) { ell(f[0], f[1], f[2], f[3], f[4]); c.stroke(); }
      for (const f of fe) { ell(f[0], f[1], f[2], f[3], f[4]); c.fillStyle = lg(f[0] - 3, f[1] - 3, f[0] + 3, f[1] + 3, ["#ffffff", "#cfe6fa"]); c.fill(); }
      for (const f of fe) { const th = f[4]; line([[f[0] - Math.cos(th) * f[2] * 0.7, f[1] - Math.sin(th) * f[2] * 0.7], [f[0] + Math.cos(th) * f[2] * 0.6, f[1] + Math.sin(th) * f[2] * 0.6]], "rgba(90,170,230,.75)", 0.4); }
    }
    circ(0, hy, hr); paint(sg3(0, hr, s === 4 ? ["#aab6ff", "#3e44a6", "#171a52"] : P.armor));
    if (s === 1) { rr(-3.2, hy - 0.5, 6.4, 1.5, 0.6); paint(T.pupil, null); for (let i = -1; i <= 1; i++) { circ(i * 1.6, hy + 2.2, 0.32); paint("rgba(10,15,30,.6)", null); } }
    if (s === 2) {
      line([[0, hy - hr + 0.3], [0, hy - 1.6]], P.trim, 0.9);
      rr(-3.3, hy - 0.5, 6.6, 1.4, 0.6); paint(T.pupil, null);
    }
    if (s === 3) {
      // 高冠鰭＋T 字面罩
      c.beginPath(); c.moveTo(-2.6, hy - hr + 0.8); c.quadraticCurveTo(-1, hy - hr - 3.2, 2.6, hy - hr - 1.6); c.quadraticCurveTo(1.6, hy - hr + 0.2, 2.4, hy - hr + 1.2); c.closePath(); paint(sg3(0, 3, P.armor), T.ol, 0.7);
      rr(-3.4, hy - 0.8, 6.8, 1.4, 0.6); paint(T.pupil, null); rr(-0.7, hy - 0.4, 1.4, 3.4, 0.5); paint(T.pupil, null);
      c.beginPath(); c.ellipse(0, hy, hr, hr, 0, PI + 0.5, -0.5); c.strokeStyle = P.trim; c.lineWidth = 0.8; c.stroke();
    }
    if (s === 4) {
      // 發光面罩＋王冠＋光環
      glow(0.4, hy, 3.4, "rgba(140,240,255,A)", 0.5);
      rr(-3.3, hy - 0.5, 6.6, 1.4, 0.6); paint(NOFX ? T.pupil : "#bff8ff", null);
      c.beginPath(); c.moveTo(-3.8, hy - 2.6); c.lineTo(-3.9, hy - 6.2); c.lineTo(-2.2, hy - 4.4); c.lineTo(0, hy - 7.6); c.lineTo(2.2, hy - 4.4); c.lineTo(3.9, hy - 6.2); c.lineTo(3.8, hy - 2.6); c.quadraticCurveTo(0, hy - 3.6, -3.8, hy - 2.6); c.closePath(); paint(lg(0, hy - 7, 0, hy - 2.6, ["#fff2c0", T.gold]), T.ol, 0.6);
      circ(0, hy - 3.6, 0.65); paint("#8af0ff", null);
      // 光環
      c.beginPath(); c.ellipse(0, hy - 9.6, 5.4, 1.7, 0, 0, PI2); c.strokeStyle = T.ol; c.lineWidth = 2.1; c.stroke(); c.strokeStyle = "#ffe6a0"; c.lineWidth = 1.1; c.stroke();
    }
  }

  // 本體（離屏快取的內容）。pose：0 閒置、1~3 揮砍、4 擋路
  function knightBody(s, fr, pose, sel) {
    T = ART.theme || FALLBACK_T;
    const P = PAL[s], blk = pose === 4, crouch = blk ? 0.8 : 0;
    c.save(); c.scale(P.scale, P.scale);
    groundAura(s);
    allyRing(s, sel); shadow(0, 1, 7 + s * 0.5, 2.6);
    const b = BREATH[fr] + crouch, sw = SWAY[fr];
    cape(s, b, sw, blk);
    legs(s, crouch);
    torso(s, b);
    pauldrons(s, b);
    if (!blk) sword(s, 6, -9 + b, ROT[pose] || ROT[0]);
    head(s, b, sw);
    if (blk) sword(s, 4.4, -10.2 + b, 0.42);   // 擋路：劍舉在盾上方待命
    const sb = (BREATH[fr] * 0.5) + crouch;
    if (blk) shield(s, 5.6, -8.6 + sb, true);
    else shield(s, -6, -8 + sb, false);
    c.restore();
  }

  // ═════ 離屏快取
  const cache = new Map(); let cachePx = 0; const CACHE_MAX = 5e6;   // 一隻騎士實際只用一階：4 幀×5 姿勢×（本體＋閃白）在 q=4 約 2.4e6
  const BOX = { w: 58, h: 52, ox: 25, oy: 42 };   // 已量過：星光階光柱頂 ≈ -40、劈到底劍尖 ≈ +32、地面光底 ≈ +10
  function mkCanvas(w, h) {
    if (typeof document !== "undefined" && document.createElement) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    return null;
  }
  function qOf(ctx) { const m = ctx.getTransform ? ctx.getTransform() : null; const s = m ? Math.hypot(m.a, m.b) : 1; return Math.min(4, Math.max(1, Math.ceil(s * 2) / 2)); }
  function sprite(key, q, fn) {
    const k = key + "@" + q;
    let e = cache.get(k);
    if (e) { cache.delete(k); cache.set(k, e); return e; }
    const W = Math.ceil(BOX.w * q), H = Math.ceil(BOX.h * q), cv = mkCanvas(W, H);
    if (!cv) return null;
    const g = cv.getContext("2d"), pc = c, pn = NOFX;
    g.setTransform(q, 0, 0, q, BOX.ox * q, BOX.oy * q); g.lineJoin = "round"; g.lineCap = "round";
    c = g;
    try { fn(g, cv); } finally { c = pc; NOFX = pn; }
    e = { cv }; cache.set(k, e); cachePx += W * H;
    while (cachePx > CACHE_MAX && cache.size > 1) { const it = cache.entries().next().value; if (it[0] === k) break; cache.delete(it[0]); cachePx -= it[1].cv.width * it[1].cv.height; }
    return e;
  }
  function tinted(key, q, fn, col) {
    return sprite(key + "|tint" + col, q, (g, cv) => {
      const base = sprite(key + "|nofx", q, () => { NOFX = true; fn(); });
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(base.cv, 0, 0);
      g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
    });
  }
  function blit(ctx, e, x, y, mirror, alpha) {
    if (!e) return;
    if (alpha != null && alpha < 1) { if (alpha <= 0) return; ctx.globalAlpha = alpha; }
    if (mirror) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(e.cv, -BOX.ox, -BOX.oy, BOX.w, BOX.h); ctx.restore(); }
    else ctx.drawImage(e.cv, x - BOX.ox, y - BOX.oy, BOX.w, BOX.h);
    if (alpha != null && alpha < 1) ctx.globalAlpha = 1;
  }
  ART.knightCacheInfo = () => ({ n: cache.size, px: cachePx, max: CACHE_MAX });
  ART.clearKnightCache = () => { cache.clear(); cachePx = 0; };

  // ═════ 即時特效（不進快取）
  function slashFx(ctx, s, x, y, mir, a, b) {
    const F = FX[s], k = PAL[s].scale, p = 1 - a, al = Math.min(1, a * 1.5);
    ctx.save(); ctx.translate(x, y); if (mir) ctx.scale(-1, 1); ctx.scale(k, k);
    ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    const px = 6, py = -9 + b, r1 = F.r1, r0 = F.r0;
    const a0 = -2.05, a1 = a0 + 2.55 * Math.min(1, p * 1.7 + 0.35), am = Math.max(a0, a1 - 1.7);
    ctx.beginPath(); ctx.arc(px, py, r1, am, a1); ctx.arc(px, py, r0 + (r1 - r0) * 0.55, a1, am, true); ctx.closePath();
    const gr = ctx.createRadialGradient(px, py, r0, px, py, r1);
    gr.addColorStop(0, "rgba(" + F.arc + ",0)"); gr.addColorStop(0.7, "rgba(" + F.arc + "," + (0.55 * al) + ")"); gr.addColorStop(1, "rgba(255,250,225," + (0.95 * al) + ")");
    ctx.fillStyle = gr; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, r1, am + (a1 - am) * 0.35, a1); ctx.strokeStyle = "rgba(255,255,255," + al + ")"; ctx.lineWidth = s >= 3 ? 1.5 : 1.1; ctx.stroke();
    if (s >= 3) { ctx.beginPath(); ctx.arc(px, py, r1 + 2, am + (a1 - am) * 0.55, a1); ctx.strokeStyle = "rgba(" + F.arc + "," + (0.7 * al) + ")"; ctx.lineWidth = 0.9; ctx.stroke(); }
    const tx = px + Math.cos(a1) * r1, ty = py + Math.sin(a1) * r1;
    if (a > 0.5) { const R = 6 + s; ctx.beginPath(); ctx.arc(tx, ty, R, 0, PI2); const g2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, R); g2.addColorStop(0, F.tip.replace("A", al)); g2.addColorStop(1, F.tip.replace("A", 0)); ctx.fillStyle = g2; ctx.fill(); }
    if (s === 4) {
      // 劍尾星屑
      for (let i = 0; i < 5; i++) { const ang = am + (a1 - am) * (i / 5), rr_ = r1 - 1 + (i % 2) * 2.5; star4(ctx, px + Math.cos(ang) * rr_, py + Math.sin(ang) * rr_, 1.4 + (i % 2), 0.28); ctx.fillStyle = "rgba(255,255,255," + (al * (0.4 + i * 0.12)) + ")"; ctx.fill(); }
    }
    ctx.restore();
  }
  const SPARK = new Map();
  function sparkSprite(s, ctx) {
    const q = qOf(ctx), k = s + "@" + q; let e = SPARK.get(k);
    if (e) return e;
    const R = 4, W = Math.ceil(R * 2 * q * 1.4), cv = mkCanvas(W, W); if (!cv) return null;
    const g = cv.getContext("2d"), m = W / 2, F = FX[s];
    const gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, "rgba(" + F.spark + ",.55)"); gr.addColorStop(1, "rgba(" + F.spark + ",0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
    star4(g, m, m, m * 0.5, 0.3); g.fillStyle = "rgba(255,255,255,.9)"; g.fill();
    e = { cv }; SPARK.set(k, e); return e;
  }
  // 環繞粒子：銀 2、金 4（上升火星）、星光 7（環繞星塵）
  function particles(ctx, s, x, y, t, alpha) {
    const F = FX[s]; if (!F.spark) return;
    const n = [0, 0, 2, 4, 7][s], k = PAL[s].scale;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      let px, py, r, a;
      if (s === 4 && i < 4) {
        const ang = t * 1.6 + i * PI2 / 4; px = x + Math.cos(ang) * 12 * k; py = y - 12 * k + Math.sin(ang) * 4 * k; r = 1.6; a = 0.55 + 0.45 * Math.sin(ang);   // 前後環繞：在前方較亮
      } else {
        const ph = (t * (0.45 + 0.07 * i) + i * 0.37) % 1; px = x + Math.sin(i * 2.4 + t * 1.3) * (6 + i % 3 * 2) * k; py = y + 1 - ph * 28 * k; r = s === 3 ? 1.1 : 1.4; a = Math.sin(ph * PI);
      }
      if (a <= 0.02) continue;
      const sp = sparkSprite(s, ctx), R = r * 2.6;
      if (sp) { ctx.globalAlpha = (alpha != null && alpha < 1 ? alpha : 1) * a; ctx.drawImage(sp.cv, px - R, py - R, R * 2, R * 2); }
    }
    ctx.restore();
  }

  function stageOf(o) {
    if (o.stage != null) return Math.max(0, Math.min(4, o.stage | 0));
    if (o.lv != null) return ART.knightStage(o.lv);
    return 1;
  }
  function poseOf(o) {
    let a = Math.max(0, Math.min(1, +o.attack || 0));
    if (o.anim === "attack" && !(a > 0)) a = 0.8;
    const block = o.anim === "block" || (o.anim !== "attack" && !!o.block);
    if (a > 0.1) return { pose: a > 0.7 ? 1 : a > 0.4 ? 2 : 3, a };
    return { pose: block ? 4 : 0, a: 0 };
  }

  ART.drawKnight = function (ctx, x, y, o) {
    o = o || {};
    const s = stageOf(o), t = +o.t || 0, q = qOf(ctx);
    const fr = Math.floor(t * 2.8) & 3, { pose, a } = poseOf(o), sel = !!o.sel;
    const key = "kn|" + s + "|" + fr + "|" + pose + (sel ? "|s" : ""), draw = () => knightBody(s, fr, pose, sel);
    const yy = y + 5, mir = (o.facing || o.dir || 1) < 0;
    blit(ctx, sprite(key, q, draw), x, yy, mir, o.alpha);
    if (o.flash > 0) blit(ctx, tinted(key, q, draw, "#ffffff"), x, yy, mir, Math.min(1, o.flash) * 0.8);
    if (!o.noFx && o.alpha !== 0) {
      if (s >= 2) particles(ctx, s, x, yy, t, o.alpha);
      if (a > 0.05) slashFx(ctx, s, x, yy, mir, a, BREATH[fr] + (pose === 4 ? 0.8 : 0));
    }
  };
  ART.knightTop = stage => { const s = Math.max(0, Math.min(4, stage | 0)); return Math.round([-21, -23, -24.5, -27, -31][s]); };

  ART.knightIcon = function (canvas, stage, pose) {
    if (!canvas || !canvas.getContext) return;
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height, s = Math.max(0, Math.min(4, stage | 0));
    const bx = -19, by = -41, bw = 38, bh = 47, sc = Math.min(W / bw, H / bh);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.setTransform(sc, 0, 0, sc, W / 2 - (bx + bw / 2) * sc, H / 2 - (by + bh / 2) * sc);
    g.lineJoin = "round"; g.lineCap = "round";
    const pc = c; c = g;
    try { knightBody(s, 0, pose === "attack" ? 2 : pose === "block" ? 4 : 0, false); } finally { c = pc; g.setTransform(1, 0, 0, 1, 0, 0); }
  };

  // 一行接上：把 ART.hero／heroTop／icon 的 knight 改走新外觀（只裝一次）
  ART.installKnightStages = function (getStage) {
    if (ART.__knightInstalled) { ART.__knightGetStage = getStage || null; return; }
    ART.__knightInstalled = true; ART.__knightGetStage = getStage || null;
    const pick = (st, h) => {
      const f = ART.__knightGetStage; let v = f ? f(st || {}, h) : null;
      if (v == null && st) v = st.knightStage != null ? st.knightStage : st.knightLv != null ? ART.knightStage(st.knightLv) : null;
      return v == null ? 1 : Math.max(0, Math.min(4, v | 0));
    };
    const oHero = ART.hero, oTop = ART.heroTop, oIcon = ART.icon;
    ART.hero = function (ctx, id, x, y, t, st) {
      if (id && id !== "knight") return oHero.apply(this, arguments);
      st = st || {};
      return ART.drawKnight(ctx, x, y, { stage: pick(st), t, attack: st.attack, block: st.block, flash: st.flash, dir: st.dir, alpha: st.alpha, noFx: st.noFx, sel: st.sel });
    };
    ART.heroTop = id => (id && id !== "knight") ? (oTop ? oTop(id) : -26) : ART.knightTop(pick(null));
    ART.icon = function (canvas, kind, id, lv, branch) {
      if (kind === "hero" && (!id || id === "knight")) return ART.knightIcon(canvas, pick(null));
      return oIcon && oIcon.apply(this, arguments);
    };
  };
  ART.KNIGHT_ART_VERSION = "929-knight-1";
})(typeof window !== "undefined" ? window : globalThis);
