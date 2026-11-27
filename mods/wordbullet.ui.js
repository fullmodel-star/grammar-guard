// 外掛：wordbullet（畫面端，只在瀏覽器載入）— 詞彈（2026-11-21 答題雙軌改版）
// ・掛句子的怪頭上畫一個挖空句泡泡（輪到的那隻：完整句子＋金框；其他隻：小泡泡「…」）
// ・畫面底部（地圖下緣）出 2～3 顆大字塊（≥44px），屬於最前面那隻掛句子的怪；不暫停、不放慢
// ・點對：字從城堡飛向那隻怪＝暴擊擊倒；點錯：那顆字塊淡掉，不懲罰
// ・學習紀錄：recordAnswer(q, 第一次就點對, "word", true, info)；點錯過才點對記成錯（收錯題本、下次備戰當復仇題）
// ・v3：第一次點對給能量（引擎 ENERGY_GAIN.byKind.word），info 帶 src "word"
(function () {
  if (!window.TGUI || !window.TG || !TG.wbMake) return;
  const U = window.TGUI, esc = U.esc, app = document.getElementById("app"), cv = document.getElementById("cv");

  const css = document.createElement("style");
  css.textContent = `
.wb-bar{position:absolute;z-index:8;display:flex;flex-direction:column;gap:4px;justify-content:center;align-items:center;padding:6px 8px;pointer-events:none;
  background:linear-gradient(rgba(12,17,34,0),rgba(12,17,34,.72) 38%);border-radius:0 0 8px 8px}
.wb-bar.below{background:none}
.wb-row{display:flex;gap:8px;justify-content:center;align-items:center}
.wb-q{display:none;pointer-events:none;max-width:100%;box-sizing:border-box;padding:3px 12px;border-radius:10px;background:rgba(17,26,42,.9);border:1px solid #E1B86A;
  color:#fff6dc;font:800 16px/1.3 system-ui,"Microsoft JhengHei",sans-serif;text-align:center;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wb-q i{font-style:normal;display:inline-block;min-width:2.6em;border-bottom:2px solid #F3D494;color:#F3D494}
.wb-bar.sent-stack .wb-q,.wb-bar.sent-inline .wb-q{display:-webkit-box}
.wb-bar.sent-inline{flex-direction:row;gap:10px}
.wb-bar.sent-inline .wb-q{flex:1 1 auto;max-width:48%;font-size:14px;text-align:left}
.wb-bar .wb-tag{pointer-events:none;font-size:12px;font-weight:800;color:#F3D494;letter-spacing:1px;writing-mode:vertical-rl;opacity:.85}
.wb-t{pointer-events:auto;min-width:72px;min-height:46px;padding:6px 12px;border-radius:12px;border:1.5px solid #E1B86A;
  background:linear-gradient(#2c4f86,#1B3545);color:#fff6dc;font:800 19px/1.1 system-ui,"Microsoft JhengHei",sans-serif;letter-spacing:.3px;
  box-shadow:0 3px 0 #0c1122,0 0 12px rgba(225,184,106,.35);touch-action:manipulation;transition:opacity .25s,transform .12s}
.wb-t:active{transform:translateY(2px);box-shadow:0 1px 0 #0c1122}
.wb-t.dim{opacity:.22;pointer-events:none;filter:grayscale(1)}
.wb-t.go{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;transform:translateY(-10px) scale(1.08)}
/* 11-24 UIUX P1：390 寬三個長字塊（most important…）一列放不下、被切出畫面 → 放不下時藏「詞彈」標籤、縮字，還是放不下就換行 */
.wb-bar.wb-tight .wb-tag{display:none}
.wb-bar.wb-tight .wb-row{flex-wrap:wrap;gap:5px;max-width:100%}
.wb-bar.wb-tight .wb-t{font-size:15px;min-width:0;max-width:100%;padding:6px 8px;white-space:normal;overflow-wrap:anywhere}
@media (max-width:360px){.wb-row{gap:5px}.wb-bar{padding:5px 4px}.wb-t{min-width:60px;font-size:17px;padding:6px 8px}.wb-q{font-size:15px;padding:3px 8px}}
@media (prefers-reduced-motion:reduce){.wb-t{transition:none}}`;
  document.head.appendChild(css);

  const bar = document.createElement("div"); bar.className = "wb-bar hide"; app.appendChild(bar);
  let curId = null, busy = false, placeKey = "", shownAt = 0;   // 目前字塊屬於哪隻怪；busy＝剛點對、字塊正在收起；placeKey＝句子排法快取；shownAt＝字塊出現的時間（作答秒數）
  const recent = [];

  // 出題：關卡題池（依關卡文法點）裡挑短句；無盡模式依波數等級
  function assign(e, G) {
    if (TG.pfOn && TG.pfOn(G)) { e.wbWord = "詞彈"; return; }   // 先備戰再守城：不出句子，引擎自動發射（備戰答對換來的）
    const lv = Math.min(5, 1 + Math.floor(G.wave / 3));
    let src = U.pool || U.qPool(lv);
    let q = TG.wbPick(src, U.rng, U.S.wrongQ, recent);
    if (!q && U.pool) q = TG.wbPick(U.qPool(lv), U.rng, U.S.wrongQ, recent);
    if (!q) { e.wb = null; return; }   // 找不到短句就不掛
    recent.push(q.id); if (recent.length > 30) recent.shift();
    const n = G.stage ? (G.stage.i < 4 ? 2 : 3) : (G.wave < 6 ? 2 : 3);   // 前幾關 2 選 1，之後 3 選 1
    e.wbq = TG.wbMake(q, U.rng, n);
    e.wbWord = e.wbq.right;
  }

  U.add("event", (ev, G) => {
    const e = ev.e;
    if (ev.k === "spawn" && e && e.wb && !e.wbq) { if (beOn()) e._wbDefer = 1; else assign(e, G); }   // Be 小怪題期間不出新句，結束後補
    else if (ev.k === "wbFire") U.beep(660, .08, "triangle", .04);
    else if (ev.k === "wbHit") { U.fx("暴擊！" + (ev.word || ""), ev.x, ev.y - 10, "#ffd75e"); U.beep(1180, .14, "square", .035); }
  });
  U.add("start", () => { curId = null; busy = false; hide(); });
  U.add("end", () => { hide(); });
  setInterval(() => { if (!U.G || U.G.over) hide(); }, 300);   // 放棄這關（G 變 null）時收掉

  // 11-22（小美 P1）：Be 巨人／魔龍叫出 be 小怪、要玩家點對的那隻時，詞彈整個暫停（字塊列收起、泡泡不畫、不出新句），一次只做一件事
  function beOn() { return !!(U.run && U.run.be); }
  function hide() { if (!bar.classList.contains("hide")) bar.classList.add("hide"); curId = null; }
  function place() {
    const ar = app.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    bar.style.left = (cr.left - ar.left) + "px"; bar.style.width = cr.width + "px";
    // 地圖下方有留空（index.html resize 會為字塊列留 58px）就放在地圖下面，不蓋城堡；空間不夠才疊在地圖下緣
    // 11-22：字塊列上面再顯示一次完整句子（眼睛不用在地圖上方的泡泡與下方字塊之間來回跑）
    //   地圖下方空間夠（手機直放通常有）→ 句子疊在字塊上面；寬螢幕但下方只有 58px → 句子放字塊左邊；都不夠 → 只看地圖上的泡泡
    const wr = document.getElementById("wrap").getBoundingClientRect(), avail = wr.bottom - cr.bottom;
    const key = Math.round(avail) + "|" + Math.round(cr.width) + "|" + curId;
    if (key !== placeKey) {   // 尺寸或句子換了才重新決定（每幀切 class 會一直重排版）
      placeKey = key;
      const modes = (avail >= 96 ? ["stack"] : []).concat(cr.width >= 520 ? ["inline"] : [], ["none"]);
      for (const mode of modes) {   // 句子兩行時 stack 可能放不下 → 退一級
        bar.classList.toggle("sent-stack", mode === "stack"); bar.classList.toggle("sent-inline", mode === "inline");
        if (mode === "none" || bar.offsetHeight <= avail) break;
      }
    }
    const below = avail >= bar.offsetHeight;
    bar.classList.toggle("below", below);
    bar.style.top = (below ? cr.bottom - ar.top + 3 : cr.bottom - ar.top - bar.offsetHeight) + "px";
  }
  function canShow(G) {
    const m = U.sheetMode;
    return G && !G.over && !U.held && !beOn() && (!m || m === "build" || m === "tower") && !document.hidden;
  }
  function render(e) {
    curId = e.id; busy = false; shownAt = performance.now();
    const parts = String(e.wbq.text).split("___");
    const sent = parts.length === 2 ? esc(parts[0]) + "<i>&nbsp;</i>" + esc(parts[1]) : esc(e.wbq.text);
    bar.innerHTML = '<div class="wb-q">' + sent + '</div><div class="wb-row"><span class="wb-tag">詞彈</span>' + e.wbq.opts.map((o, k) => '<button class="wb-t" data-wb="' + k + '">' + esc(o.t) + '</button>').join("") + '</div>';
    bar.querySelectorAll("[data-wb]").forEach(b => b.addEventListener("pointerdown", ev => { ev.preventDefault(); tapTile(+b.dataset.wb, b); }));
    bar.classList.remove("hide", "wb-tight"); place();
    // 字塊列比地圖寬（會被切出畫面）→ 改緊湊版（藏標籤、縮字、可換行），重新擺一次
    const row = bar.querySelector(".wb-row");
    if (row && row.scrollWidth > bar.clientWidth - 8) { bar.classList.add("wb-tight"); placeKey = ""; place(); }
  }
  function tapTile(k, btn) {
    const G = U.G; if (!G || busy || !canShow(G)) return;
    const e = G.enemies.find(x => x.id === curId); if (!e || !e.wb || e.wb.fired || !e.wbq) return;
    const o = e.wbq.opts[k]; if (!o) return;
    if (!o.ok) {   // 點錯：只讓這顆淡掉，不懲罰
      TG.wordBullet(G, e.id, false); btn.classList.add("dim"); U.beep(240, .08, "triangle", .025); return;
    }
    const first = e.wb.miss === 0;
    // v3 統一作答紀錄（合約 §3）：學習紀錄與引擎帶同一個 info（kind word、src word、題目欄位、作答秒數）
    const info = TG.wbInfo(e, { sec: Math.round((performance.now() - (shownAt || performance.now())) / 100) / 10 });
    if (!first) info.try = 2;
    if (TG.wordBullet(G, e.id, true, info) !== "fire") return;
    U.recordAnswer(e.wbq.q, first, "word", true, info);
    btn.classList.add("go"); busy = true;
    setTimeout(() => { if (curId === e.id) { curId = null; busy = false; } }, 220);
  }

  // ───── 畫圖：泡泡＋飛字（每一幀都會呼叫，暫停時也會；順便同步字塊列）
  // (x, y)＝泡泡下緣中央；tx＝尾巴指向的 x（預設 x）；flip＝泡泡在怪下面、尾巴朝上
  function bubble(ctx, x, y, w, h, gold, tx, flip) {
    const r = 5; tx = tx == null ? x : Math.max(x - w / 2 + 8, Math.min(x + w / 2 - 8, tx));
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h);
    if (flip) { ctx.lineTo(tx - 4, y - h); ctx.lineTo(tx, y - h - 5); ctx.lineTo(tx + 4, y - h); }
    ctx.lineTo(x + w / 2 - r, y - h); ctx.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y - h + r);
    ctx.lineTo(x + w / 2, y - r); ctx.quadraticCurveTo(x + w / 2, y, x + w / 2 - r, y);
    if (!flip) { ctx.lineTo(tx + 4, y); ctx.lineTo(tx, y + 5); ctx.lineTo(tx - 4, y); }
    ctx.lineTo(x - w / 2 + r, y); ctx.quadraticCurveTo(x - w / 2, y, x - w / 2, y - r);
    ctx.lineTo(x - w / 2, y - h + r); ctx.quadraticCurveTo(x - w / 2, y - h, x - w / 2 + r, y - h); ctx.closePath();
    ctx.fillStyle = gold ? "rgba(17,26,42,.94)" : "rgba(17,26,42,.8)"; ctx.fill();
    ctx.lineWidth = gold ? 1.6 : 1; ctx.strokeStyle = gold ? "#E1B86A" : "#6c8296"; ctx.stroke();
  }
  // 泡泡不能進到地圖上緣的保留區（魔王血條、Be 題目、地形標籤、開波細條），手感外掛有提供就照它算
  function topZone(G, run) {
    const J = U.juice;
    if (J && J.waveStripY) return J.waveStripY(G, run) + (J.banner ? 26 : 0);
    return run && run.be ? 42 : 22;
  }
  U.add("drawTop", (ctx, G, run) => {
    const be = beOn();
    if (!be) for (const e of G.enemies) if (e._wbDefer) { e._wbDefer = 0; if (e.wb && !e.wbq && !e.wb.fired) assign(e, G); }
    // 字塊列同步
    const front = TG.wbFront(G);
    if (canShow(G) && front && front.wbq && G.waveActive) { if (front.id !== curId && !busy) render(front); else if (!bar.classList.contains("hide")) place(); }
    else if (!busy) hide();
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const t = performance.now() / 1000;
    const zone = topZone(G, run);
    for (const e of G.enemies) {
      if (be || !e.wb || e.wb.fired || !e.wbq) continue;
      const fly = TG.ENEMIES[e.type].fly, by = e.y - (fly ? 30 : 22);
      if (e === front) {
        // 11-22：字放大（10→12px）；泡泡頂端會進到上緣保留區時改畫在怪的下面（尾巴朝上）
        let fs = 12; ctx.font = "bold " + fs + "px system-ui,sans-serif";
        const txt = e.wbq.text.replace("___", "____");
        while (fs > 10 && ctx.measureText(txt).width + 14 > 290) { fs--; ctx.font = "bold " + fs + "px system-ui,sans-serif"; }
        const w = Math.min(290, ctx.measureText(txt).width + 14), h = fs + 8;
        const flip = by - h - 2 < zone;
        const x = Math.max(w / 2 + 3, Math.min(300 - w / 2 - 3, e.x)), y = flip ? e.y + (fly ? 10 : 16) + h : by;
        // 目標光圈
        ctx.strokeStyle = "rgba(243,212,148," + (0.55 + 0.35 * Math.sin(t * 6)) + ")"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y - (fly ? 8 : 0), 11 + Math.sin(t * 6), 0, 7); ctx.stroke();
        bubble(ctx, x, y, w, h, true, e.x, flip);
        // 挖空處畫金色底線
        const parts = e.wbq.text.split("___");
        ctx.fillStyle = "#fff6dc";
        if (parts.length === 2) {
          const wa = ctx.measureText(parts[0]).width, wb = ctx.measureText("____").width, wc = ctx.measureText(parts[1]).width, sx = x - (wa + wb + wc) / 2;
          ctx.textAlign = "left"; ctx.fillText(parts[0], sx, y - h / 2); ctx.fillText(parts[1], sx + wa + wb, y - h / 2);
          ctx.strokeStyle = "#F3D494"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx + wa + 1, y - 3.5); ctx.lineTo(sx + wa + wb - 1, y - 3.5); ctx.stroke();
          ctx.textAlign = "center";
        } else ctx.fillText(txt, x, y - h / 2);
      } else {
        bubble(ctx, e.x, by + 4, 16, 10, false);
        ctx.fillStyle = "#cfdcf0"; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(e.x + k * 4, by - 1, 1.1, 0, 7); ctx.fill(); }
      }
    }
    // 飛字：城堡 → 怪
    const shots = (G.wb && G.wb.shots) || [];
    for (const sh of shots) {
      const tr = sh._tr || (sh._tr = []); tr.push([sh.x, sh.y]); if (tr.length > 7) tr.shift();
      for (let k = 0; k < tr.length; k++) { ctx.fillStyle = "rgba(243,212,148," + (0.08 + 0.1 * k) + ")"; ctx.beginPath(); ctx.arc(tr[k][0], tr[k][1], 2 + k * 0.9, 0, 7); ctx.fill(); }
      ctx.shadowColor = "#ffd75e"; ctx.shadowBlur = 8;
      ctx.font = "bold 12px system-ui,sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "#2a1d08"; ctx.strokeText(sh.word, sh.x, sh.y);
      ctx.fillStyle = "#ffe9a8"; ctx.fillText(sh.word, sh.x, sh.y); ctx.shadowBlur = 0;
    }
    ctx.restore();
  });
  window.addEventListener("resize", () => { if (!bar.classList.contains("hide")) place(); });

  // ───── 瀏覽器機器人：輪到的怪走到 1/5 路線後依答對率點（點錯就點下一顆）
  window.TGBOT = (window.TGBOT || []).concat((T, G, c, yes) => {
    if (!G || G.over || T.sheetMode || bar.classList.contains("hide")) return false;
    const e = G.enemies.find(x => x.id === curId); if (!e || !e.wbq || e.wb.fired || e.d < G.map.routes[e.r].len * 0.2) return false;
    const btns = [...bar.querySelectorAll("[data-wb]")].filter(b => !b.classList.contains("dim"));
    const right = btns.find(b => e.wbq.opts[+b.dataset.wb].ok), wrong = btns.find(b => !e.wbq.opts[+b.dataset.wb].ok);
    const b = yes() || !wrong ? right : wrong; if (!b) return false;
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    c.wb = (c.wb || 0) + 1; if (b === right) c.wbFire = (c.wbFire || 0) + 1;
    return true;
  });
})();
