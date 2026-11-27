// 外掛：trial（畫面端，只在瀏覽器載入）— 試煉之火、挑戰目標、外觀獎勵；鐵人選 2 種塔、英雄挑戰固定隊伍說明
// 第二輪 E 組（2026-11-24）。不改 index.html／modes.ui.js：全部用 UIH 掛勾＋自己插 DOM＋包住 TGUI／ART 的函式。
//   簡報（brief／briefBind）：試煉之火卡片（目前幾火、本關最高、挑戰目標）＋選火面板入口；鐵人勾選時插「選 2 種塔」；英雄挑戰勾選處補「固定隊伍」說明。
//   選火面板：自己的全螢幕層 #trModal（會玩／英文兩軸、每條件一句話＋「詳細」、總火數、外觀獎勵與換裝）。
//   戰鬥：HUD 右下角「試煉 N 火」、被封塔位畫火焰封印、城堡旁插旗、隱藏中文（body.tr-nozh）、沒有第二次機會（包 qcard.canRetry）、
//         倒數題縮短（包 qbus.push 的 deadline）。結算：新紀錄 X 火、挑戰目標達成狀況、新解鎖外觀。騎士披風配色：包 ART.drawKnight 換色。
// 存檔：TGUI.S.mods.trial（格式見 mods/trial.js；TG.trialData 驗證）。
(function () {
  if (!window.TGUI || !window.TG || !TG.trialFire) return;
  const U = window.TGUI, esc = U.esc, C = TG.TRIAL.CONDS, ORDER = TG.TRIAL.ORDER, MAX = TG.TRIAL.MAX;
  const D = () => { const m = U.S.mods || (U.S.mods = {}); return (m.trial = TG.trialData(m.trial)); };
  const stars = i => ((U.S.prog || {})[i] || {}).stars || 0;
  let cur = { st: -1, iron: null };   // 這次簡報：關卡、鐵人選的 2 種塔

  // ───── 圖示（自繪 SVG）
  const flame = (col, sz, n) => '<svg class="tr-fl" viewBox="0 0 24 24" width="' + (sz || 18) + '" height="' + (sz || 18) + '" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 .5 2 1.5 3 3 3-1-3-1-6 0-8z" fill="' + (col || "#ff6a3a") + '" stroke="#0c1122" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12c1 2 3 3 3 5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5z" fill="#ffe08a"/>' + (n != null ? '' : '') + '</svg>';
  const embCol = f => { const e = TG.trialEmblem(f); return e ? e.c : "#6a7a8e"; };
  const MARK = {
    shield: '<path d="M12 6l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V8z" fill="#F3D494" stroke="#0c1122" stroke-width="1.2"/>',
    flame: '<path d="M12 5c.6 2.5 4 4 4 8a4 4 0 0 1-8 0c0-2 1.3-3.3 2-4.6.3 1.3 1 2 2 2-.6-2-.6-4 0-5.4z" fill="#ffd25a" stroke="#0c1122" stroke-width="1.1"/>',
    swords: '<path d="M7 6l10 10M17 6L7 16" stroke="#eef2fa" stroke-width="2.2" stroke-linecap="round"/><path d="M7 6l10 10M17 6L7 16" stroke="#0c1122" stroke-width=".8" stroke-linecap="round"/>',
    dragon: '<path d="M7 15c2-6 8-2 10-7-1 5-5 4-6 8 2-1 4 0 5 2-3-1-6 0-9-3z" fill="#e8c4ff" stroke="#0c1122" stroke-width="1.1" stroke-linejoin="round"/>',
    crown: '<path d="M6 15l1-7 3 3 2-4 2 4 3-3 1 7z" fill="#ffe08a" stroke="#0c1122" stroke-width="1.1" stroke-linejoin="round"/>'
  };
  const flagSvg = (b, sz) => !b || !b.col ? '<svg viewBox="0 0 24 24" width="' + (sz || 30) + '" height="' + (sz || 30) + '"><path d="M5 3v19" stroke="#6a7a8e" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="#6a7a8e" stroke-width="1.6"/></svg>' :
    '<svg viewBox="0 0 24 24" width="' + (sz || 30) + '" height="' + (sz || 30) + '"><path d="M4 2v21" stroke="#4a3624" stroke-width="2"/><path d="M5 3h15l-3 5 3 5H5z" transform="translate(0 1)" fill="' + b.col + '" stroke="#0c1122" stroke-width="1.2" stroke-linejoin="round"/><g transform="translate(.5 -.5) scale(.62) translate(4 6)">' + (MARK[b.mark] || "") + '</g></svg>';
  const capeSvg = (c, sz) => '<svg viewBox="0 0 24 24" width="' + (sz || 30) + '" height="' + (sz || 30) + '"><defs><linearGradient id="trcg' + (c.id) + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (c.c ? c.c[0] : "#3a62a0") + '"/><stop offset="1" stop-color="' + (c.c ? c.c[1] : "#203a68") + '"/></linearGradient></defs><path d="M8 4h8l3 17c-3 1.5-11 1.5-14 0z" fill="url(#trcg' + c.id + ')" stroke="#0c1122" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 4h8" stroke="#E1B86A" stroke-width="2"/></svg>';

  // ───── 樣式（只作用在 tr- 開頭的 class）
  const css = document.createElement("style");
  css.textContent = `
.tr-card .tr-best{margin-left:auto;font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;font-weight:800;color:#ffd2b0;display:inline-flex;align-items:center;gap:3px}
.tr-card .tr-sub{font-size:13px;color:var(--sub);line-height:1.6}
.tr-now{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:2px 0 6px}
.tr-now b.n{font-size:20px;color:#ffb36a}
.tr-chip{display:inline-flex;align-items:center;gap:3px;background:#4a2230;border:1px solid #a3593a;color:#ffe6d2;border-radius:14px;padding:1px 9px 1px 6px;font-size:12px;font-weight:800}
.tr-row{display:flex;gap:8px;flex-wrap:wrap}
.tr-btn{border:1px solid #c4642e;border-radius:12px;background:linear-gradient(#7a3418,#4a1c10);color:#ffe6d2;font-weight:900;font-size:14px;padding:8px 14px;min-height:44px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.tr-btn.ghost{background:none;border-color:#4b6478;color:var(--sub)}
.tr-ft .tr-btn{white-space:nowrap}
@media (max-width:360px){.tr-ft{gap:6px}.tr-ft .tr-btn{padding:8px 9px;font-size:13px}}
.tr-goals{margin-top:8px;border-top:1px solid #2e4560;padding-top:6px}
.tr-goals .h{font-size:13px;font-weight:900;color:#F3D494}
.tr-goals .h small{font-weight:400;color:var(--sub);font-size:12px}
.tr-g{display:flex;gap:6px;align-items:flex-start;font-size:13px;line-height:1.5;margin-top:3px}
.tr-g i{font-style:normal;flex:none;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;background:#ffffff14;color:var(--sub)}
.tr-g.done i{background:#2e7d55;color:#fff}
.tr-g small{color:var(--sub);font-size:12px}
.tr-note{font-size:12px;color:#ffd2b0;margin-top:4px}
#trModal{position:fixed;inset:0;z-index:60;background:radial-gradient(120% 80% at 50% 0%,#24120e,#070b14 60%);display:flex;justify-content:center;overflow:auto;padding:14px 16px 24px;box-sizing:border-box}
#trModal.hide{display:none}
.tr-wrap{width:100%;max-width:720px;display:flex;flex-direction:column;gap:10px;color:var(--ink);text-align:left}
.tr-hd{position:sticky;top:-14px;z-index:2;background:linear-gradient(#2a1410,#1a0e10);border:1px solid #7a3418;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 6px 16px #000a}
.tr-hd h2{margin:0;font-size:20px;font-family:var(--serif);display:flex;align-items:center;gap:8px;color:#ffe6d2}
@media (max-width:520px){.tr-hd h2{flex-wrap:wrap;row-gap:0}.tr-hd h2 small{flex-basis:100%}}
.tr-hd h2 small{font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;color:#d9b8a0;font-weight:700}
.tr-meter{display:flex;gap:3px;align-items:center;flex-wrap:wrap}
.tr-meter span{width:18px;height:22px;opacity:.25;filter:grayscale(1)}
.tr-meter span.on{opacity:1;filter:none}
.tr-meter b{margin-left:8px;font-size:22px;color:#ffb36a;font-variant-numeric:tabular-nums}
.tr-meter b small{font-size:13px;color:#d9b8a0}
.tr-axis{font-size:13px;color:#d9b8a0}
.tr-sec{font-weight:900;color:#F3D494;font-family:var(--serif);font-size:16px;margin-top:4px;display:flex;align-items:center;gap:6px}
.tr-sec small{font-family:system-ui,"Microsoft JhengHei",sans-serif;font-weight:400;font-size:12px;color:var(--sub)}
.tr-cards{display:grid;grid-template-columns:1fr;gap:8px}
@media (min-width:760px){.tr-cards{grid-template-columns:1fr 1fr}}
.tr-c{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:5px}
.tr-c.on{border-color:#c4642e;box-shadow:inset 0 0 0 1px #c4642e66}
.tr-c .t{display:flex;align-items:center;gap:6px;font-weight:900;font-size:15px}
.tr-c .t .f{margin-left:auto;display:inline-flex;gap:1px}
.tr-c .one{font-size:14px;line-height:1.5}
.tr-c details{font-size:12.5px;color:var(--sub);line-height:1.55}
.tr-c summary{cursor:pointer;color:#9fc2e8;font-weight:700;min-height:44px;display:flex;align-items:center}   /* 11-24 UIUX P1：「詳細」原本 24px 高，手指點不準 */
.tr-lv{display:flex;gap:0;flex-wrap:nowrap;border:1px solid #4b6478;border-radius:11px;overflow:hidden;background:#0f1a2c}
.tr-lv button{position:relative;flex:1;min-width:0;min-height:44px;border-radius:0;border:0;border-left:1px solid #2e4560;background:transparent;color:#a9b9d0;font-weight:800;font-size:14px;cursor:pointer;padding:4px 2px}
.tr-lv button:first-child{border-left:0}
/* 11-24 UIUX P1：選中改成分段切換樣式（描邊＋淡底＋勾），橘色實心只留給底部「確定」 */
.tr-lv button.sel{background:rgba(255,179,106,.16);color:#ffe2c4;box-shadow:inset 0 0 0 2px #ffb36a;border-radius:10px}
.tr-lv button.sel::before{content:"✓";margin-right:3px;color:#ffb36a;font-weight:900}
.tr-lv button small{display:block;font-size:12px;font-weight:700;opacity:.85;line-height:1.2}
.tr-lv button:disabled{opacity:.35;cursor:not-allowed}
.tr-looks{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}
.tr-lk{border:1px solid #2e4560;border-radius:12px;background:#131f34;color:var(--ink);padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12.5px;font-weight:800;min-height:84px;cursor:pointer;line-height:1.3;text-align:center}
.tr-lk small{font-weight:400;color:var(--sub);font-size:12px}
.tr-lk.sel{border-color:#F3D494;box-shadow:inset 0 0 0 1px #F3D494}
.tr-lk.lock{opacity:.5;cursor:default}
.tr-tot{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--sub)}
.tr-tot b{color:#ffb36a;font-size:16px}
.tr-ft{position:sticky;bottom:-24px;display:flex;gap:10px;justify-content:center;padding:10px 0;background:linear-gradient(transparent,#050a14 40%)}
.tr-endb{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px auto 6px;padding:6px 14px;border-radius:14px;background:linear-gradient(#7a3418,#4a1c10);border:1px solid #ffb36a;color:#ffe6d2;font-weight:900;font-size:17px;width:max-content;max-width:100%;box-shadow:0 0 16px #ff8a3a66}
.tr-endb small{font-size:12px;font-weight:700;color:#ffd2b0}
.tr-endb.lose{background:#2a2030;border-color:#6a5a7a;box-shadow:none}
.tr-it{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:13px}
.tr-it label{display:inline-flex;align-items:center;gap:3px;min-height:36px;white-space:nowrap}
body.tr-nozh .qc-zh:not(.qc-zh-big),body.tr-nozh .qc-zhs,body.tr-nozh .qc-dlg small,body.tr-nozh .sheet.qmode .zh,body.tr-nozh .sheet.prep .zh,body.tr-nozh .sheet.fix .zh,body.tr-nozh .sheet.question .zh{display:none!important}`;
  document.head.appendChild(css);

  // ───── 簡報卡
  const chips = sel => ORDER.filter(id => sel[id]).map(id => { const l = C[id].lv[sel[id] - 1]; return '<span class="tr-chip">' + flame("#ff8a3a", 13) + esc(C[id].name) + (l.tag ? "（" + esc(l.tag) + "）" : "") + '</span>'; }).join("");
  const goalsHtml = st => {
    const g = (D().goals[String(st.i)]) || {}, ids = TG.trialGoalsFor(st);
    if (!ids.length) return "";
    return '<div class="tr-goals"><div class="h">挑戰目標 <small>（三星之外；不影響星數，達成拿火紋碎片換外觀）</small></div>' +
      ids.map(id => { const x = TG.TRIAL_GOALS[id]; return '<div class="tr-g' + (g[id] ? ' done' : '') + '"><i>' + (g[id] ? '✓' : '') + '</i><span><b>' + esc(x.name) + '</b>　' + esc(x.card) + (g[id] ? ' <small>已達成</small>' : '') + '</span></div>'; }).join("") + '</div>';
  };
  function briefCard(st) {
    const d = D(), best = d.best[String(st.i)] | 0, open = TG.trialOpen(U.S.prog, st.i);
    const head = '<h4>' + flame("#ff6a3a", 20) + '試煉之火' + (best ? '<span class="tr-best">' + flame(embCol(best), 14) + '本關最高 ' + best + ' 火</span>' : '') + '</h4>';
    // 還沒過這關：不放第一屏（11-25 試玩小安：第 1 關簡報最上面就是「試煉之火」）→ 換 id，flow.ui 的簡報分層就把它收進「詳細」
    if (!open) return '<div class="card tr-card" id="trBriefLocked">' + head + '<div class="tr-sub">第一次過這關之後開放：出征前自己選加難條件，過關拿外觀獎勵（不加戰力）。</div>' + goalsHtml(st) + '</div>';
    const sel = d.sel[String(st.i)] || {}, f = TG.trialFire(sel);
    return '<div class="card tr-card" id="trBrief">' + head +
      (f ? '<div class="tr-now">目前 <b class="n">' + f + '</b> 火 ' + chips(sel) + '</div>' : '<div class="tr-sub">自己選加難條件（最多 ' + MAX + ' 火），過關拿披風配色、旗幟、火焰徽記。不選就是一般難度。</div>') +
      '<div class="tr-row"><button class="tr-btn" data-tr="open">' + flame("#ffd25a", 16) + (f ? '改試煉條件' : '選擇試煉條件') + '</button>' + (f ? '<button class="tr-btn ghost" data-tr="clear">不用試煉</button>' : '') + '</div>' +
      '<div class="tr-note hide" id="trModeNote">已勾英雄挑戰或鐵人：這次不套用試煉之火。</div>' + goalsHtml(st) + '</div>';
  }
  U.add("brief", st => { try { return briefCard(st); } catch (e) { console.error("[trial brief]", e); return ""; } });
  function refreshBrief(st) { const el = document.getElementById("trBrief"); if (!el) return; const box = document.createElement("div"); box.innerHTML = briefCard(st); el.replaceWith(box.firstChild); bindBrief(st, document.getElementById("ovBrief")); }
  function bindBrief(st, root) {
    const el = root && root.querySelector("#trBrief"); if (!el) return;
    el.querySelectorAll("[data-tr]").forEach(b => b.onclick = () => {
      if (b.dataset.tr === "open") openPanel(st);
      if (b.dataset.tr === "clear") { delete D().sel[String(st.i)]; U.save(); refreshBrief(st); }
    });
    modeNote(root);
  }
  function modeNote(root) {
    const n = root && root.querySelector("#trModeNote"); if (!n) return;
    const h = root.querySelector("#chkHeroic"), ir = root.querySelector("#chkIron");
    n.classList.toggle("hide", !((h && h.checked) || (ir && ir.checked)) || !TG.trialFire(D().sel[String(cur.st)] || {}));
  }
  U.add("briefBind", (st, root) => {
    cur = { st: st.i, iron: TG.IRON_TYPES_DEF ? TG.IRON_TYPES_DEF.slice() : null };
    bindBrief(st, root);
    // 鐵人：勾選後出現「選 2 種塔」（modes.ui.js 的勾選框旁邊插）
    const ir = root.querySelector("#chkIron");
    if (ir && TG.ironTypes) {
      const box = document.createElement("div"); box.className = "tr-it hide"; box.id = "trIronTypes";
      const fly = (TG.FLY_TYPES || []).map(k => TG.TOWERS[k].name).join("或");
      box.innerHTML = '<span style="width:100%;color:var(--sub)">選 2 種塔（至少 1 種打得到飛行怪：' + esc(fly) + '）：</span>' + Object.entries(TG.TOWERS).filter(([, t]) => !t.energy).map(([k, t]) => '<label><input type="checkbox" data-trit="' + k + '"' + (cur.iron.includes(k) ? ' checked' : '') + '> ' + esc(t.name) + '</label>').join("") + '<span class="tr-note hide" id="trItWarn" style="width:100%"></span>';
      (ir.closest("label") || ir).insertAdjacentElement("afterend", box);
      const sync = () => {
        cur.iron = [...box.querySelectorAll("[data-trit]:checked")].map(x => x.dataset.trit);
        const w = box.querySelector("#trItWarn"), fixd = TG.ironTypes(cur.iron);
        const msg = cur.iron.length !== 2 ? "要剛好選 2 種；沒選好會用「" + TG.ironTypes(null).map(k => TG.TOWERS[k].name).join("＋") + "」" : fixd.join() !== cur.iron.join() ? "這兩種都打不到飛行怪：會把第 2 種換成" + TG.TOWERS[fixd[1]].name : "";
        w.textContent = msg; w.classList.toggle("hide", !msg);
      };
      box.querySelectorAll("[data-trit]").forEach(c => c.onchange = sync);
      const tg = () => { box.classList.toggle("hide", !ir.checked); modeNote(root); };
      ir.addEventListener("change", tg); tg(); sync();
    }
    // 英雄挑戰：補固定隊伍說明（index 的勾選框文字是舊的）
    const h = root.querySelector("#chkHeroic");
    if (h && TG.HEROIC_FIXED) {
      const n = document.createElement("div"); n.className = "tr-note";
      n.textContent = "固定隊伍：騎士固定 " + TG.HEROIC_FIXED.lv + " 級、技能樹用推薦配點，不帶裝備、天賦、同伴，召喚獸固定 " + TG.HEROIC_FIXED.petLv + " 級。練多少都一樣難。";
      (h.closest("label") || h).insertAdjacentElement("afterend", n);
      h.addEventListener("change", () => modeNote(root));
    }
  });

  // ───── 選火面板
  const modal = document.createElement("div"); modal.id = "trModal"; modal.className = "hide";
  document.getElementById("app").appendChild(modal);
  let pSel = {}, pSt = null;
  function openPanel(st) { pSt = st; pSel = Object.assign({}, D().sel[String(st.i)] || {}); renderPanel(); modal.classList.remove("hide"); modal.scrollTop = 0; }
  function closePanel(saveIt) {
    if (saveIt && pSt) { const d = D(), c = TG.trialClean(pSel); if (Object.keys(c).length) d.sel[String(pSt.i)] = c; else delete d.sel[String(pSt.i)]; U.save(); }
    modal.classList.add("hide"); if (pSt) refreshBrief(pSt);
  }
  function condCard(id) {
    const c = C[id], lv = pSel[id] | 0;
    const btn = (k, label) => '<button data-trc="' + id + '" data-lv="' + k + '"' + (lv === k ? ' class="sel" aria-pressed="true"' : ' aria-pressed="false"') + (k && lv !== k && !TG.trialCanSet(pSel, id, k) ? ' disabled' : '') + '>' + label + '</button>';
    const fl = n => Array.from({ length: n }, () => flame("#ff8a3a", 14)).join("");
    return '<div class="tr-c' + (lv ? ' on' : '') + '"><div class="t">' + esc(c.name) + '<span class="f">' + fl(c.lv[c.lv.length - 1].fire) + '</span></div>' +
      '<div class="one">' + esc(c.card) + '</div><details><summary>詳細</summary>' + esc(c.detail) + '</details>' +
      '<div class="tr-lv">' + btn(0, "不要") + c.lv.map((l, k) => btn(k + 1, (l.tag ? "<small>" + esc(l.tag) + "</small>" : "要・") + l.fire + " 火")).join("") + '</div></div>';
  }
  function looksHtml() {
    const d = D(), u = TG.trialUnlocks(d), t = u.totals;
    const cape = u.capes.map(c => '<button class="tr-lk' + (d.look.cape === c.id ? ' sel' : '') + (c.ok ? '' : ' lock') + '" data-trl="cape" data-id="' + c.id + '"' + (c.ok ? '' : ' disabled') + '>' + capeSvg(c, 30) + esc(c.name) + '<small>' + (c.ok ? (d.look.cape === c.id ? "穿著中" : "點一下換上") : esc(TG.trialNeedText(c.need))) + '</small></button>').join("");
    const ban = u.banners.map(b => '<button class="tr-lk' + (d.look.banner === b.id ? ' sel' : '') + (b.ok ? '' : ' lock') + '" data-trl="banner" data-id="' + b.id + '"' + (b.ok ? '' : ' disabled') + '>' + flagSvg(b, 30) + esc(b.name) + '<small>' + (b.ok ? (d.look.banner === b.id ? "插在城堡" : "點一下換上") : esc(TG.trialNeedText(b.need))) + '</small></button>').join("");
    const em = TG.TRIAL_LOOK.EMBLEMS.map(e => '<span class="tr-chip" style="background:#131f34;border-color:' + e.c + '">' + flame(e.c, 14) + esc(e.name) + '：單關 ' + e.min + ' 火' + (t.top >= e.min ? " ✓" : "") + '</span>').join(" ");
    return '<div class="tr-sec">' + flame("#ffd25a", 18) + '外觀獎勵 <small>只有外觀，不加戰力</small></div>' +
      '<div class="tr-tot"><span>各關最高火數加總 <b>' + t.heat + '</b></span><span>單關最高 <b>' + t.top + '</b> 火</span><span>火紋碎片（達成的挑戰目標）<b>' + t.goals + '</b></span></div>' +
      '<div class="tr-axis">騎士披風配色</div><div class="tr-looks">' + cape + '</div><div class="tr-axis">城堡旗幟</div><div class="tr-looks">' + ban + '</div>' +
      '<div class="tr-axis">火焰徽記（世界地圖的關卡旁會顯示）</div><div class="tr-row">' + em + '</div>';
  }
  function renderPanel() {
    const f = TG.trialFire(pSel), st = pSt, best = D().best[String(st.i)] | 0;
    const meter = Array.from({ length: MAX }, (_, k) => '<span class="' + (k < f ? 'on' : '') + '">' + flame(k < f ? (k >= 9 ? "#ffd25a" : k >= 5 ? "#ff5a3a" : "#ff8a3a") : "#555", 18) + '</span>').join("");
    const emb = TG.trialEmblem(f);
    modal.innerHTML = '<div class="tr-wrap"><div class="tr-hd"><h2>' + flame("#ff6a3a", 26) + '試煉之火<small>第 ' + (st.i + 1) + ' 關・' + esc(st.name) + (best ? '・本關最高 ' + best + ' 火' : '') + '</small></h2>' +
      '<div class="tr-meter">' + meter + '<b>' + f + '<small> / ' + MAX + ' 火</small></b></div>' +
      '<div class="tr-axis">會玩 ' + TG.trialAxisFire(pSel, "play") + ' 火・英文 ' + TG.trialAxisFire(pSel, "eng") + ' 火　' + (f ? (emb ? '過關可拿：' + esc(emb.name) + (f > best ? '、新紀錄 ' + f + ' 火' : '（要超過 ' + best + ' 火才算新紀錄）') : '') : '還沒選：就是一般難度') + '</div></div>' +
      '<div class="tr-sec">會玩 <small>考你怎麼蓋塔、花能量</small></div><div class="tr-cards">' + ORDER.filter(id => C[id].axis === "play").map(condCard).join("") + '</div>' +
      '<div class="tr-sec">英文 <small>考你的英文；不會讓怪物變強</small></div><div class="tr-cards">' + ORDER.filter(id => C[id].axis === "eng").map(condCard).join("") + '</div>' +
      '<div class="tr-axis">火數只看你自己勾的條件，跟答對率、等級、裝備都無關。最多 ' + MAX + ' 火（全部勾滿是 ' + TG.trialMaxFire() + ' 火，要自己取捨）。</div>' +
      looksHtml() +
      '<div class="tr-ft"><button class="tr-btn ghost" data-trp="reset">全部不要</button><button class="tr-btn ghost" data-trp="cancel">取消</button><button class="tr-btn" data-trp="ok">' + flame("#ffd25a", 16) + '確定（' + f + ' 火）</button></div></div>';
  }
  modal.addEventListener("click", ev => {
    const c = ev.target.closest("[data-trc]");
    if (c && !c.disabled) { const id = c.dataset.trc, lv = +c.dataset.lv; if (lv) pSel[id] = lv; else delete pSel[id]; pSel = TG.trialClean(pSel); const y = modal.scrollTop; renderPanel(); modal.scrollTop = y; return; }
    const l = ev.target.closest("[data-trl]");
    if (l && !l.disabled) { const d = D(); d.look[l.dataset.trl] = l.dataset.id; U.save(); capeCache.clear(); const y = modal.scrollTop; renderPanel(); modal.scrollTop = y; return; }
    const p = ev.target.closest("[data-trp]");
    if (p) { if (p.dataset.trp === "reset") { pSel = {}; renderPanel(); } else closePanel(p.dataset.trp === "ok"); }
  });

  // ───── 開局
  U.add("opts", (opts, st) => {
    if (!st || !opts) return opts;
    if (!opts.iron && !opts.heroic && !opts.daily && !opts.practice && TG.trialOpen(U.S.prog, st.i)) {
      const sel = TG.trialClean(D().sel[String(st.i)]);
      if (TG.trialFire(sel)) opts.trial = sel;
    }
    if (opts.iron && cur.st === st.i && cur.iron) opts.allowTypes = TG.ironTypes(cur.iron);
    return opts;
  });
  U.add("start", G => {
    document.body.classList.toggle("tr-nozh", TG.trialHas(G, "nozh"));
    if (TG.trialOn(G)) setTimeout(() => { if (U.G === G && !G.over) U.toast("🔥 試煉之火 " + G.trial.fire + " 火：" + ORDER.filter(id => G.trial.sel[id]).map(id => C[id].name).join("、")); }, 2600);
  });
  U.add("frame", G => { const on = !!(G && !G.over && TG.trialHas(G, "nozh")); if (document.body.classList.contains("tr-nozh") !== on) document.body.classList.toggle("tr-nozh", on); });
  U.add("event", (ev) => { if (ev.k === "ironLow") U.toast("⚔️ 鐵人：答錯 " + ev.n + " 題，答對率低於八成（可錯 " + ev.max + " 題）。多答對幾題就能拉回來！"); });

  // 沒有第二次機會：題卡（側邊面板、營地共用）不給第二次
  if (U.qcard && typeof U.qcard.canRetry === "function") {
    const o = U.qcard.canRetry;
    U.qcard.canRetry = function (card) { if (TG.trialHas(U.G, "nosecond") && U.G && !U.G.over) return false; return o.apply(this, arguments); };
  }
  // 答題變快：倒數題（解封、魔王、詠唱…）時間縮短三成；一般題（不限時）不變
  if (U.qbus && typeof U.qbus.push === "function") {
    const o = U.qbus.push;
    U.qbus.push = function (item) { if (item && item.deadline > 0 && TG.trialHas(U.G, "quick")) item = Object.assign({}, item, { deadline: Math.max(4, Math.round(item.deadline * TG.TRIAL.QUICK_DEADLINE * 10) / 10) }); return o.call(this, item); };
  }
  // 被封的塔位：點了提示；測試機器人的 openBuild 也擋下
  const sealed = (G, x, y) => { const t = G && G.trial; if (!t || !t.slots) return -1; for (const k of t.slots) { const p = G.map.slots[k]; if (p && Math.hypot(p[0] - x, p[1] - y) < 18) return k; } return -1; };
  U.add("tap", (x, y, G) => { const k = sealed(G, x, y); if (k >= 0 && !G.towers.some(t => t.slot === k)) { U.toast("🔥 試煉之火：這個塔位被封住了"); return true; } return false; });
  if (window.__TG && typeof window.__TG.openBuild === "function") {
    const o = window.__TG.openBuild;
    window.__TG.openBuild = function (i) { const G = U.G; if (G && G.trial && G.trial.slots && G.trial.slots.includes(i)) return; return o.apply(this, arguments); };
  }

  // ───── 地圖繪製：封印、旗幟、HUD
  const castleOf = G => { try { const rt = G.map.routes[0]; return TG.posOn(rt, rt.len); } catch (e) { return null; } };
  U.add("drawGround", (ctx, G) => {
    const t = G.trial;
    if (t && t.slots) for (const sk of t.slots) {
      const p = G.map.slots[sk]; if (p) {
        const [x, y] = p, k = (performance.now() / 600) % (Math.PI * 2);
        ctx.save(); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = "rgba(120,24,10,.55)"; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = "#ff8a3a"; ctx.setLineDash([3, 2.5]); ctx.lineDashOffset = -k * 4; ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.quadraticCurveTo(x + 7, y - 1, x + 4, y + 5); ctx.quadraticCurveTo(x, y + 9, x - 4, y + 5); ctx.quadraticCurveTo(x - 7, y - 1, x, y - 9);
        ctx.fillStyle = "#ff6a3a"; ctx.fill(); ctx.strokeStyle = "#0c1122"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + 2.5, 2.6, 0, Math.PI * 2); ctx.fillStyle = "#ffe08a"; ctx.fill();
        ctx.restore();
      }
    }
  });
  function drawFlag(ctx, x, y, b) {
    const w = Math.sin(performance.now() / 300) * 1.2;
    ctx.save(); ctx.lineJoin = "round";
    ctx.strokeStyle = "#0c1122"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1, y - 23); ctx.quadraticCurveTo(x + 8, y - 25 + w, x + 15, y - 23); ctx.lineTo(x + 12, y - 18.5 + w * 0.5); ctx.lineTo(x + 15, y - 14); ctx.quadraticCurveTo(x + 8, y - 16 + w, x + 1, y - 14); ctx.closePath();
    ctx.fillStyle = b.col; ctx.fill(); ctx.strokeStyle = "#0c1122"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#F3D494"; ctx.beginPath();
    const cx = x + 7, cy = y - 18.6;
    if (b.mark === "flame") { ctx.moveTo(cx, cy - 3); ctx.quadraticCurveTo(cx + 3, cy, cx + 1.5, cy + 2.5); ctx.lineTo(cx - 1.5, cy + 2.5); ctx.quadraticCurveTo(cx - 3, cy, cx, cy - 3); }
    else if (b.mark === "crown") { ctx.moveTo(cx - 3, cy + 2); ctx.lineTo(cx - 3, cy - 2); ctx.lineTo(cx - 1.5, cy); ctx.lineTo(cx, cy - 3); ctx.lineTo(cx + 1.5, cy); ctx.lineTo(cx + 3, cy - 2); ctx.lineTo(cx + 3, cy + 2); }
    else if (b.mark === "swords") { ctx.strokeStyle = "#eef2fa"; ctx.lineWidth = 1.2; ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3); ctx.stroke(); }
    else if (b.mark === "dragon") { ctx.arc(cx, cy, 2.6, 0, Math.PI * 1.6); ctx.lineTo(cx, cy); }
    else { ctx.moveTo(cx - 2.6, cy - 2.6); ctx.lineTo(cx + 2.6, cy - 2.6); ctx.lineTo(cx + 2.6, cy); ctx.quadraticCurveTo(cx + 2.6, cy + 2.6, cx, cy + 3.4); ctx.quadraticCurveTo(cx - 2.6, cy + 2.6, cx - 2.6, cy); }
    if (b.mark !== "swords") ctx.fill();
    ctx.restore();
  }
  U.add("drawTop", (ctx, G) => {
    // 城堡旁插旗（外觀獎勵；畫在最上層才不會被城堡蓋住）
    const b = TG.TRIAL_LOOK.BANNERS.find(x => x.id === D().look.banner);
    if (b && b.col) { const c = castleOf(G); if (c) drawFlag(ctx, Math.max(6, Math.min(280, c.x + (c.x > 240 ? -28 : 28))), Math.max(30, Math.min(380, c.y - (c.y > 300 ? 14 : -6))), b); }
    const t = G.trial; if (!t) return;
    const txt = "試煉 " + t.fire + " 火";
    ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    const w = ctx.measureText(txt).width + 22, x1 = 297, x0 = x1 - w, y = 384;
    ctx.fillStyle = "rgba(70,20,10,.82)"; ctx.fillRect(x0, y, w, 14); ctx.strokeStyle = "#ff8a3a"; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, 13);
    const fx = x0 + 8, fy = y + 7, col = embCol(t.fire);
    ctx.beginPath(); ctx.moveTo(fx, fy - 5.5); ctx.quadraticCurveTo(fx + 4.5, fy - 1, fx + 3, fy + 3.5); ctx.quadraticCurveTo(fx, fy + 6, fx - 3, fy + 3.5); ctx.quadraticCurveTo(fx - 4.5, fy - 1, fx, fy - 5.5);
    ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = "#ffe6d2"; ctx.fillText(txt, x1 - 4, y + 7.5); ctx.restore();
  });
  // 世界地圖：關卡格旁的火焰徽記（本關最高火數）
  U.add("worldNode", st => { const f = D().best[String(st.i)] | 0; return f ? '<span title="試煉之火最高 ' + f + ' 火" style="display:inline-flex;align-items:center;font-size:12px;font-weight:900;color:' + embCol(f) + '">' + flame(embCol(f), 14) + f + '</span>' : ""; });

  // ───── 結算
  U.add("end", (G, run, won) => {
    document.body.classList.remove("tr-nozh");
    if (!G || !G.stage) return [];
    const d = D(), out = [], before = TG.trialUnlocks(d);
    let badge = null;
    if (G.trial) {
      const r = TG.trialRecord(d, G.stage.i, G.trial.fire, won), emb = TG.trialEmblem(r.best);
      if (won && r.newBest) { out.push("🔥 試煉之火新紀錄 " + G.trial.fire + " 火！" + (emb ? "（" + emb.name + "）" : "")); badge = { win: true, html: flame(embCol(G.trial.fire), 24) + "新紀錄 " + G.trial.fire + " 火！" + (r.prev ? "<small>（原本 " + r.prev + " 火）</small>" : "") }; }
      else if (won) { out.push("🔥 試煉之火 " + G.trial.fire + " 火過關（本關最高 " + r.best + " 火）"); badge = { win: true, html: flame(embCol(G.trial.fire), 22) + G.trial.fire + " 火過關<small>（最高 " + r.best + " 火）</small>" }; }
      else { out.push("🔥 試煉之火 " + G.trial.fire + " 火沒守住（紀錄維持 " + r.best + " 火）：可以先少選幾火再挑戰"); badge = { win: false, html: flame("#8a7a9a", 20) + G.trial.fire + " 火沒守住<small>（紀錄 " + r.best + " 火）</small>" }; }
    }
    if (TG.trialGoalEligible(G) && won) {
      const res = TG.trialGoalCheck(G), fresh = TG.trialGoalRecord(d, G.stage.i, res);
      for (const x of res) out.push("🎯 挑戰目標" + (x.ok ? "達成" : "未達成") + "：" + TG.TRIAL_GOALS[x.id].name + (x.ok ? (fresh.includes(x.id) ? "（新達成，火紋碎片 +1）" : "（之前已達成）") : "（" + x.info + "）"));
    }
    const news = TG.trialNewLooks(before, TG.trialUnlocks(d));
    for (const x of news) out.push("✨ 解鎖新外觀：" + x.kind + "「" + x.name + "」（試煉之火面板可以換上）");
    U.save();
    if (badge) setTimeout(() => { const e = document.getElementById("ovEnd"); if (!e || e.classList.contains("hide") || e.querySelector(".tr-endb")) return; const at = e.querySelector(".stars") || e.querySelector("h2"); if (!at) return; const b = document.createElement("div"); b.className = "tr-endb" + (badge.win ? "" : " lose"); b.innerHTML = badge.html; at.insertAdjacentElement("afterend", b); }, 0);
    return out;
  });

  // ───── 騎士披風配色：包住 ART.drawKnight，把披風顏色換掉（只換外觀）
  //   作法：把原本的騎士畫到暫存畫布，找出「最接近原本披風漸層」的像素換成新配色（保留明暗），結果依姿勢快取。
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PAL = [   // 抄自 art/knight-art.js 的 PAL（披風／其他部件的顏色）；美術改色時這裡跟著改
    { cape: ["#94704a", "#5e452c"], other: ["#e6bc8c", "#b07a48", "#674226", "#4e3320", "#4a3020", "#c8a060"] },
    { cape: ["#3a62a0", "#203a68"], other: ["#cfd6de", "#8e99a7", "#4e5866", "#3e4652", "#5a3e28", "#E1B86A", "#d0506a"] },
    { cape: ["#3a6ab8", "#1c3466"], other: ["#ffffff", "#d2def0", "#8296b4", "#6a7c98", "#F3D494", "#5ab4ee", "#E1B86A"] },
    { cape: ["#c4404e", "#6a1828"], other: ["#fff4c6", "#ecbe5e", "#9a6824", "#7a4e1e", "#fff2c8", "#F3D494", "#e0485e"] },
    { cape: ["#3a3a9a", "#160f40"], other: ["#dfe8ff", "#7482d8", "#272a6c", "#1e2056", "#F3D494", "#8af0ff"] }
  ].map(p => ({ cape: p.cape.map(hex), other: p.other.concat(["#0c1122", "#f0c8a0", "#e8f0f8", "#120a1e", "#4a3624"]).map(hex) }));
  const capeCache = new Map();
  const curCape = () => { try { const id = D().look.cape; const c = TG.TRIAL_LOOK.CAPES.find(x => x.id === id); return c && c.c ? c : null; } catch (e) { return null; } };
  function recolor(g, W, H, s, cape) {
    const P = PAL[Math.max(0, Math.min(4, s | 0))], a = P.cape[0], b = P.cape[1], A = hex(cape.c[0]), B = hex(cape.c[1]);
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
    const img = g.getImageData(0, 0, W, H), px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      const r = px[i], gg = px[i + 1], bb = px[i + 2];
      let t = ((r - a[0]) * ab[0] + (gg - a[1]) * ab[1] + (bb - a[2]) * ab[2]) / L; t = Math.max(-0.25, Math.min(1.25, t));
      const pr = a[0] + ab[0] * t, pg = a[1] + ab[1] * t, pb = a[2] + ab[2] * t;
      const dc = (r - pr) ** 2 + (gg - pg) ** 2 + (bb - pb) ** 2;
      if (dc > 900) continue;
      let near = false; for (const o of P.other) if ((r - o[0]) ** 2 + (gg - o[1]) ** 2 + (bb - o[2]) ** 2 < dc) { near = true; break; }
      if (near) continue;
      const tc = Math.max(0, Math.min(1, t));
      px[i] = Math.max(0, Math.min(255, A[0] + (B[0] - A[0]) * tc + (r - pr)));
      px[i + 1] = Math.max(0, Math.min(255, A[1] + (B[1] - A[1]) * tc + (gg - pg)));
      px[i + 2] = Math.max(0, Math.min(255, A[2] + (B[2] - A[2]) * tc + (bb - pb)));
    }
    g.putImageData(img, 0, 0);
  }
  function installCape() {
    const A = window.ART; if (!A || typeof A.drawKnight !== "function" || A.__trCape) return;
    A.__trCape = true;
    const orig = A.drawKnight;
    A.drawKnight = function (ctx, x, y, o) {
      const cape = curCape();
      if (!cape || !o || o.flash > 0 || !ctx || typeof ctx.getTransform !== "function") return orig.apply(this, arguments);
      try {
        const m = ctx.getTransform(), q = Math.max(1, Math.min(4, Math.round(Math.hypot(m.a, m.b) * 2) / 2));
        const s = o.stage != null ? Math.max(0, Math.min(4, o.stage | 0)) : 1, t = +o.t || 0, fr = Math.floor(t * 2.8) & 3;
        let at = Math.max(0, Math.min(1, +o.attack || 0)); if (o.anim === "attack" && !(at > 0)) at = 0.8;
        const blk = o.anim === "block" || (o.anim !== "attack" && !!o.block), pose = at > 0.1 ? (at > 0.7 ? 1 : at > 0.4 ? 2 : 3) : blk ? 4 : 0;
        const mir = (o.facing || o.dir || 1) < 0, key = cape.id + "|" + s + "|" + fr + "|" + pose + "|" + (o.sel ? 1 : 0) + "|" + (mir ? 1 : 0) + "|" + q;
        let e = capeCache.get(key);
        if (!e) {
          const LW = 56, LH = 64, OX = 28, OY = 50, W = Math.ceil(LW * q), H = Math.ceil(LH * q);
          const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
          const g = cv.getContext("2d", { willReadFrequently: true });
          g.setTransform(q, 0, 0, q, OX * q, OY * q);
          orig.call(this, g, 0, 0, Object.assign({}, o, { noFx: true, flash: 0, alpha: 1 }));
          g.setTransform(1, 0, 0, 1, 0, 0);
          recolor(g, W, H, s, cape);
          e = { cv, ox: OX, oy: OY, w: LW, h: LH };
          if (capeCache.size > 240) capeCache.clear();
          capeCache.set(key, e);
        }
        const al = o.alpha != null ? o.alpha : 1;
        if (al > 0) { if (al < 1) ctx.globalAlpha = al; ctx.drawImage(e.cv, x - e.ox, y - e.oy, e.w, e.h); if (al < 1) ctx.globalAlpha = 1; }
        // 揮砍弧光、粒子：照原本畫（本體用幾乎透明的一層帶過）
        if (!o.noFx && al !== 0) orig.call(this, ctx, x, y, Object.assign({}, o, { alpha: 0.001 }));
      } catch (err) { return orig.apply(this, arguments); }
    };
  }
  installCape();
  setTimeout(installCape, 0);

  // ───── 測試機器人：選火面板不會在戰鬥中出現；開著就關掉
  window.TGBOT = (window.TGBOT || []).concat(() => { if (!modal.classList.contains("hide")) { closePanel(false); return true; } return false; });
  window.TGTRIAL = { openPanel, closePanel, D, get cur() { return cur; } };
})();
