// 外掛：prepfirst（畫面端）— 先備戰再守城（2026-11-25 老闆提議：手機直拿時答題區佔掉下半部，地圖太小）
// 玩法：每波開打前在營地答 3 題（可再答 3 題加碼；引擎 TG.pfCount／TG.pfExtra，答對照常給能量），答完才開打；守城時不出任何題，側邊答題面板整個不顯示。
// 本檔只管：①開局時決定這一局用不用（opts.prepFirst）②簡報畫面「玩法」切換鈕。
//   規則與數值在 engine.js（TG.PF、TG.pfOn、TG.pfCount、TG.pfRoundEnd）；營地多題在 mods/camp.ui.js；守城不出題的處理在 qpanel.ui、knight.ui、index（召喚）、wordbullet、terrain。
// 存檔：S.mods.pf = { mode: "auto" | "on" | "off" }；auto＝手機直拿（寬 ≤700 的直向畫面）用先備戰，其他（電腦、平板、橫向）邊打邊答。
(function () {
  "use strict";
  const U = window.TGUI, TG = window.TG;
  if (!U || !TG) return;
  const PORT = window.matchMedia ? matchMedia("(max-width:700px) and (orientation:portrait)") : { matches: false };
  function mdata() {
    const S = U.S; S.mods = S.mods || {};
    let m = S.mods.pf; if (!m || typeof m !== "object" || Array.isArray(m)) m = S.mods.pf = {};
    if (m.mode !== "on" && m.mode !== "off") m.mode = "auto";
    return m;
  }
  const want = () => { const m = mdata().mode; return m === "on" || (m === "auto" && PORT.matches); };
  U.add("opts", (o, st) => {
    if (o.prepFirst === undefined && st) o.prepFirst = want() && !o.heroic && !o.iron;
    return o;
  });

  // ───── 簡報畫面：「出征」按鈕上方一列「玩法」切換（兩顆按鈕；選了就記住，不再跟著畫面方向自動換）
  const css = '.brief-go.pf-has{flex-wrap:wrap}' +
    '.pf-pick{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 6px;font-size:13px;color:var(--sub,#a9b6c9);background:#0b121f;border-radius:12px;padding:4px 6px}' +
    '.pf-hint{flex:0 0 100%;text-align:center;font-size:12px;color:#cfdcf0;line-height:1.35}' +
    '.pf-pick>span{white-space:nowrap}' +
    '.pf-seg{display:flex;border:1px solid rgba(225,184,106,.5);border-radius:10px;overflow:hidden}' +
    '.pf-seg button{min-height:44px;padding:0 12px;font-size:14px;background:transparent;color:#cfdcf0;border:0;cursor:pointer;white-space:nowrap}' +
    '.pf-seg button+button{border-left:1px solid rgba(225,184,106,.5)}' +
    '.pf-seg button[aria-pressed="true"]{background:rgba(225,184,106,.22);color:#F3D494;font-weight:700}' +
    '@media (max-width:360px){.pf-seg button{padding:0 8px;font-size:13px}.pf-pick>span{font-size:12px}}';
  function injectCss() { if (document.getElementById("pfCss")) return; const s = document.createElement("style"); s.id = "pfCss"; s.textContent = css; document.head.appendChild(s); }
  function paint(root) {
    const go = root && root.querySelector(".brief-go"); if (!go) return;
    injectCss();
    let row = go.querySelector(".pf-pick");
    if (!row) { row = document.createElement("div"); row.className = "pf-pick"; go.insertBefore(row, go.firstChild); go.classList.add("pf-has"); }
    const on = want();
    row.innerHTML = '<span>玩法</span><div class="pf-seg" role="group" aria-label="玩法">' +
      '<button type="button" data-pf="on" aria-pressed="' + on + '">先答題，再守城</button>' +
      '<button type="button" data-pf="off" aria-pressed="' + !on + '">邊打邊答</button></div>' +
      // 11-25 試玩：點了跳的說明被簡報蓋住看不到 → 直接在鈕下面寫一行
      '<div class="pf-hint">' + (on ? '每波開打前先答 3 題，打的時候不跳題目' : '題目在地圖旁邊，邊守城邊答') + '</div>';
    row.querySelectorAll("[data-pf]").forEach(b => b.addEventListener("click", () => {
      mdata().mode = b.dataset.pf; U.save(); paint(root);
    }));
  }
  U.add("briefBind", (st, root) => { try { paint(root); } catch (e) { console.error("[prepfirst brief]", e); } });
  window.TGPF = { want, mdata };
})();
