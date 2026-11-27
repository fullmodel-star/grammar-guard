// 外掛：flow（畫面端）— 上線後 UI/UX 流程修正（2026-11-24 流程組；依據 _research/UIUX檢視_20261124/報告_流程.md P1-1、P1-2、P1-4、P1-5）
//
// 1. 手機返回鍵（P1-1）：接上瀏覽器歷史紀錄。不在主選單（或主選單上開著錯題本）時，歷史紀錄多一筆「守門」；
//    按返回＝吃掉這一筆，改成關掉最上面那一層（試煉之火面板、教學卡、錯題本、子畫面、簡報、地圖、結算），還沒回到主選單就再補一筆。
//    戰鬥中按返回＝打開暫停選單（暫停中再按＝繼續），不會直接丟掉這一局；回到主選單後歷史紀錄的守門會收掉，再按返回才照常離開 App。
// 2. 長頁面頂端固定返回鈕（P1-2）：隊伍、技能樹、裝備／天賦、召喚獸、同伴、每日一關／學習報告、錯題本頂端多一條固定的「‹ 回…」，
//    文字照抄該頁最底下的返回鈕（回隊伍／回主選單／回關卡簡報），按了等於按底下那顆；電腦按 Esc 也一樣。
// 3. 錯題本（P1-4）：主選單「待複習 N 題」與學習報告的入口 → 列出錯題（題目、文法點、看解析），可以一題一題練；
//    第一次就答對＝從錯題本拿掉（S.wrongQ），答錯或第二次才答對就留著。
// 4. 新版更新的時機（P1-5）：index.html 的更新區塊問 TGFLOW.updWhere()／updDecide() 決定「現在套用／顯示提示／等一下」。
//
// 純邏輯在 LOGIC（node 測試 test/flow.test.js）；瀏覽器部分只讀畫面狀態、點既有的按鈕，不改遊戲規則。
(function () {
  "use strict";

  // ════════════════════ 純邏輯 ════════════════════
  // 返回鍵要做什麼。st：{ trial, coach, review, reviewQ, battle, paused, top }（top＝最上面那一層全畫面的 id，主選單＝"ovMenu"）
  //   回傳 { act }：closeTrial／closeCoach／closeReviewQ／closeReview／resume／pause／screen（點該畫面的返回鈕）／none（已在主選單，交給瀏覽器）
  function backPlan(st) {
    st = st || {};
    if (st.trial) return { act: "closeTrial" };
    if (st.coach) return { act: "closeCoach" };
    if (st.reviewQ) return { act: "closeReviewQ" };
    if (st.review) return { act: "closeReview" };
    if (st.battle) return { act: st.paused ? "resume" : "pause" };
    if (st.top && st.top !== "ovMenu") return { act: "screen", id: st.top };
    return { act: "none" };
  }
  // 歷史紀錄要不要有守門那一筆：主選單上什麼都沒開＝不用（按返回照常離開）；其他狀況都要
  function needGuard(st) { return backPlan(st).act !== "none"; }

  // 有新版時現在要做什麼。c：{ where, touched, sinceOpen, idle, visible }
  //   where：menu（主選單、沒有局）／battle（戰鬥進行中）／paused（戰鬥中、暫停選單開著）／end（結算、全破畫面）／other（地圖、簡報、子畫面）
  //   apply＝直接換新版（只在主選單、孩子沒在操作時）；banner＝顯示提示（孩子自己按；主選單、結算、暫停選單才顯示）；
  //   wait＝先不要（戰鬥中不蓋按鈕；地圖、簡報、子畫面頂端有返回鈕，也先不蓋，回主選單再說；背景分頁）
  //   不會永遠卡住：打開（或切回）App 10 秒內停在主選單沒操作、或在主選單閒置 30 秒＝直接換；主選單、結算、暫停時一直有提示可以按。
  const UPD = { OPEN_MS: 10000, IDLE_MS: 30000 };
  function updDecide(c) {
    c = c || {};
    if (c.visible === false) return "wait";
    if (c.where === "battle" || c.where === "other") return "wait";
    if (c.where === "menu" && !c.touched && (+c.sinceOpen || 0) < UPD.OPEN_MS) return "apply";
    if (c.where === "menu" && (+c.idle || 0) >= UPD.IDLE_MS) return "apply";
    return "banner";
  }
  // 提示文字要誠實：暫停中更新＝這一局重來；結算畫面更新＝成績已經存好；其他＝回主選單
  function updText(where) {
    if (where === "paused" || where === "battle") return "這一局會重新開始，存檔都會保留";
    if (where === "end") return "會回到主選單；這一局的成績已經存好";
    return "會回到主選單，存檔都會保留";
  }

  // 錯題本清單：S.wrongQ 的題號（依加入順序）對到題庫；題庫裡找不到的（下架）略過
  function wrongList(wrongQ, qdb) {
    const by = new Map(); for (const q of (qdb || [])) if (q && q.id) by.set(q.id, q);
    const out = [];
    for (const id of Object.keys(wrongQ || {})) { if (!wrongQ[id]) continue; const q = by.get(id); if (q) out.push(q); }
    return out;
  }
  // 錯題本練習的結果：第一次就答對＝拿掉；答錯、第二次才答對＝留著（跟戰鬥一樣：第二次答對會收進錯題本）
  function practiceResult(S, id, ok, tried) {
    if (!S || !S.wrongQ || !id) return false;
    if (ok && !tried) { const had = !!S.wrongQ[id]; delete S.wrongQ[id]; return had; }
    S.wrongQ[id] = 1; return false;
  }

  const LOGIC = { backPlan, needGuard, updDecide, updText, wrongList, practiceResult, UPD };
  if (typeof module === "object" && module.exports) module.exports = LOGIC;

  // ════════════════════ 以下只在瀏覽器 ════════════════════
  if (typeof window === "undefined" || typeof document === "undefined" || !window.TGUI || !window.TG) return;
  const W = window, U = W.TGUI, TG = W.TG, esc = U.esc, app = document.getElementById("app");
  const $ = id => document.getElementById(id);
  const vis = el => !!el && el.isConnected && !el.classList.contains("hide");
  const uic = n => (U.uic ? U.uic(n, false) : "");

  const css = document.createElement("style");
  css.textContent = `
.fl-top{position:sticky;top:0;z-index:5;align-self:stretch;flex:0 0 auto;display:flex;margin:0 -16px;padding:6px 12px 10px;background:linear-gradient(#0d1528f2 75%,#0d152800);pointer-events:none}
.fl-top button{pointer-events:auto;display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 14px 0 8px;border-radius:12px;border:1px solid #4b6478;background:#121c33e6;color:#F3D494;font-weight:800;font-size:15px}
.fl-top button svg{width:20px;height:20px}
#ovKnight .kn-tabs{top:58px}   /* 技能樹的路線分頁本來黏在最上面：讓到頂端返回鈕下面 */
.rv-pr .hd svg{width:24px;height:24px;flex:0 0 auto}
#bWrongBook{font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-height:32px}
#bWrongBook i{font-style:normal;margin-left:2px;opacity:.8}
#ovReview .rv-wrap{width:100%;max-width:640px;display:flex;flex-direction:column;gap:12px;text-align:left}
#ovReview h2{text-align:center;display:flex;align-items:center;justify-content:center;gap:8px}
#ovReview h2 svg{width:28px;height:28px}
#ovReview .rv-help{color:var(--sub);font-size:14px;line-height:1.6}
#ovReview .rv-go{display:flex;gap:8px;flex-wrap:wrap}
#ovReview .rv-go .big{flex:1 1 200px}
#ovReview .rv-it{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
#ovReview .rv-it .s{font-size:16px;line-height:1.5;color:var(--ink)}
#ovReview .rv-it .s em{font-style:normal;display:inline-block;min-width:3em;border-bottom:2px solid #E1B86A;text-align:center}
#ovReview .rv-it .g{font-size:12.5px;color:var(--sub)}
#ovReview .rv-it .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#ovReview .rv-it .r button{min-height:44px;border-radius:10px;padding:0 14px;font-weight:800;border:0;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}
#ovReview .rv-it details{font-size:14px;color:var(--sub)}
#ovReview .rv-it details summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:#cfdcf0}
#ovReview .rv-it details p{margin:4px 0}
#ovReview .rv-empty{text-align:center;padding:20px 8px;color:var(--sub)}
#ovReview .rv-more{color:var(--sub);font-size:13px;text-align:center}
#ovReview .rv-foot{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:4px}
.rv-pr{position:absolute;inset:0;z-index:40;background:rgba(6,9,20,.72);display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(12px + env(safe-area-inset-bottom))}
.rv-pr.hide{display:none}
.rv-pr .box{width:100%;max-width:560px;max-height:100%;overflow:auto;background:var(--panel,#16213a);border:1px solid rgba(225,184,106,.5);border-radius:16px;padding:12px 14px;text-align:left;display:flex;flex-direction:column;gap:10px}
.rv-pr .hd{display:flex;align-items:center;gap:8px;font-weight:800;color:#F3D494}
.rv-pr .hd small{color:var(--sub);font-weight:600;margin-left:auto}
.rv-pr .msg{font-size:14px;line-height:1.6}
.rv-pr .msg .ok{color:var(--ok,#7bd88f);font-weight:800}
.rv-pr .msg .bad{color:#ff9a8a;font-weight:800}
.rv-pr .ft{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;position:sticky;bottom:-12px;background:var(--panel,#16213a);padding:6px 0}
.rv-pr .ft button{min-height:44px;border-radius:11px;padding:0 16px;font-weight:800;border:1px solid #4b6478;background:none;color:#cfdcf0;font-size:15px}
.rv-pr .ft button.main{border:0;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;flex:1 1 auto}
@media (min-width:900px) and (min-height:560px){.rv-pr{align-items:center}}
#ovBrief .bf-more{padding:0;overflow:hidden}
#ovBrief .bf-more>summary{list-style:none;display:flex;align-items:center;gap:8px;min-height:48px;padding:6px 14px;cursor:pointer;color:#F3D494}
#ovBrief .bf-more>summary b{flex:0 0 auto;font-size:15px}
#ovBrief .bf-more>summary span{flex:1 1 auto;min-width:0;font-size:13px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ovBrief .bf-more-in{display:flex;flex-direction:column;gap:10px;padding:0 10px 10px}
`;
  document.head.appendChild(css);

  // ───── 畫面狀態
  const inBattle = () => { const G = U.G; return !!(G && !G.over); };
  const trialOpen = () => vis($("trModal"));
  const coachEl = () => document.querySelector(".co-ov:not(.hide)");
  // 最上面那一層全畫面（#app 底下直接的 .ov，DOM 越後面越上層）
  function topScreen() {
    const list = [...app.querySelectorAll(":scope > .ov")].filter(vis);
    return list.length ? list[list.length - 1] : null;
  }
  function state() {
    const top = topScreen();
    return { trial: trialOpen(), coach: !!coachEl(), review: vis($("ovReview")), reviewQ: vis(prEl), battle: inBattle(), paused: U.sheetMode === "menu", top: top ? top.id : (inBattle() ? null : "ovMenu") };
  }
  // 給 index.html 的更新區塊：現在在哪裡
  function updWhere() {
    if (inBattle()) return U.sheetMode === "menu" ? "paused" : "battle";
    if (vis($("ovEnd")) || vis($("ovFinale"))) return "end";
    const s = state();
    if (s.trial || s.review || s.reviewQ) return "other";
    if (s.top === "ovMenu" || (!s.top)) return "menu";
    return "other";
  }

  // ───── 各畫面的返回鈕（點下去＝原本的返回行為）
  const BACK_SEL = '[data-rv="back"],[data-tm="back"],[data-kn="back"],[data-gq="back"],[data-cr="back"],[data-mm="back"],#cmpBack,#bWorldBack,#bBriefBack,#bToWorld,#bFinBack,#bFinMenu';
  const backBtnOf = ov => { if (!ov) return null; const all = [...ov.querySelectorAll(BACK_SEL)].filter(b => !b.closest(".fl-top")); return all.length ? all[all.length - 1] : null; };
  function doBack() {
    const p = backPlan(state());
    try {
      if (p.act === "closeTrial") { if (W.TGTRIAL && W.TGTRIAL.closePanel) W.TGTRIAL.closePanel(false); else $("trModal").classList.add("hide"); }
      else if (p.act === "closeCoach") { const c = coachEl(), b = c && c.querySelector("[data-co]"); if (b) b.click(); else if (c) c.classList.add("hide"); }
      else if (p.act === "closeReviewQ") prClose();
      else if (p.act === "closeReview") rvClose();
      else if (p.act === "resume") { const b = document.querySelector("#sheet [data-x]"); if (b) b.click(); }
      else if (p.act === "pause") { const b = $("bPause"); if (b) b.click(); }
      else if (p.act === "screen") { const ov = $(p.id), b = backBtnOf(ov); if (b) b.click(); else { U.show("ovMenu"); U.menuInfo(); } }
    } catch (e) { console.error("[flow back]", e); }
    return p.act;
  }

  // ───── 歷史紀錄守門
  const H = W.history;
  let guarded = !!(H && H.state && H.state.tgNav), skipPop = 0, syncT = 0;
  function sync() {
    syncT = 0;
    if (!H || !H.pushState || skipPop > 0) return;
    const need = needGuard(state());
    if (need && !guarded) { try { H.pushState({ tgNav: 1 }, ""); guarded = true; } catch (e) {} }
    else if (!need && guarded && H.state && H.state.tgNav) { guarded = false; skipPop++; try { H.back(); } catch (e) { skipPop--; } }   // 回到主選單：把守門收掉，下一次返回才照常離開
  }
  const later = () => { if (!syncT) syncT = setTimeout(sync, 60); };
  W.addEventListener("popstate", e => {
    if (skipPop > 0) { skipPop--; guarded = !!(e.state && e.state.tgNav); later(); return; }
    guarded = !!(e.state && e.state.tgNav);
    doBack();
    later();
  });

  // ───── 長頁面頂端固定返回鈕
  const TOPBAR = ["ovTeam", "ovKnight", "ovGearMod", "ovCreatures", "ovCmp", "ovModesMod", "ovReview"];
  function topBars() {
    for (const id of TOPBAR) {
      const ov = $(id); if (!vis(ov)) continue;
      const src = backBtnOf(ov); let bar = ov.querySelector(":scope > .fl-top");
      if (!src) { if (bar) bar.remove(); continue; }
      const label = (src.textContent || "").replace(/\s+/g, "").trim() || "返回";
      if (!bar) { bar = document.createElement("div"); bar.className = "fl-top"; bar.innerHTML = '<button type="button" data-fl="back"></button>'; ov.insertBefore(bar, ov.firstChild); bar.firstChild.onclick = () => { const b = backBtnOf(ov); if (b) b.click(); }; }
      else if (ov.firstChild !== bar) ov.insertBefore(bar, ov.firstChild);
      const b = bar.firstChild; if (b.dataset.t !== label) { b.dataset.t = label; b.innerHTML = uic("back") + esc(label); b.setAttribute("aria-label", label); }
    }
  }
  let obsT = 0;
  const onMut = () => { if (obsT) return; obsT = requestAnimationFrame(() => { obsT = 0; try { topBars(); } catch (e) { console.error("[flow topbar]", e); } later(); }); };
  if (W.MutationObserver) new MutationObserver(onMut).observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  // ───── 鍵盤：Esc 關掉最上面那一層（戰鬥中交給 index.html 原本的 Esc：暫停選單／關面板）
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")) return;
    const s = state();
    if (s.battle && !s.trial && !s.reviewQ) return;
    const p = backPlan(s); if (p.act === "none" || p.act === "pause" || p.act === "resume" || p.act === "closeCoach") return;
    e.preventDefault(); doBack();
  });

  // ═════ 錯題本
  const rv = document.createElement("div"); rv.className = "ov hide"; rv.id = "ovReview"; app.appendChild(rv);
  const prEl = document.createElement("div"); prEl.className = "rv-pr hide"; prEl.setAttribute("role", "dialog"); prEl.setAttribute("aria-label", "錯題練習"); app.appendChild(prEl);
  let rvFrom = "menu", queue = [], pr = null, limit = 30;
  const QD = () => (typeof W.QDB !== "undefined" && Array.isArray(W.QDB) ? W.QDB : (typeof QDB !== "undefined" ? QDB : []));   // eslint-disable-line no-undef
  const gpName = q => { try { const G = W.QDB_GP || (typeof QDB_GP !== "undefined" ? QDB_GP : null); return (G && q.gp && G[q.gp] && G[q.gp].name) || ""; } catch (e) { return ""; } };   // eslint-disable-line no-undef
  const list = () => wrongList(U.S.wrongQ, QD());
  const stemHtml = q => esc(q.q || "").replace(/_{3}/g, "<em>？</em>");
  const filled = q => esc(q.q || "").replace("___", "<b>" + esc((q.o || [])[0] || "") + "</b>");
  function rvOpen(from) {
    rvFrom = from || "menu"; limit = 30;
    if (rvFrom === "report") { const m = $("ovModesMod"); if (m) m.classList.add("hide"); }
    U.show(null); rvRender(); rv.classList.remove("hide"); rv.scrollTop = 0;
  }
  function rvClose() {
    prClose(true); rv.classList.add("hide");
    if (rvFrom === "report" && U.openReport) U.openReport(); else { U.show("ovMenu"); U.menuInfo(); }
  }
  function rvRender() {
    const L = list(), n = L.length, shown = L.slice(0, limit);
    const back = rvFrom === "report" ? "回學習報告" : "回主選單";
    rv.innerHTML = '<div class="rv-wrap"><h2>' + uic("book") + '錯題本</h2>' +
      (n ? '<div class="rv-help">一共 <b>' + n + '</b> 題。<b>第一次就答對</b>，這題就從錯題本拿掉；答錯會留著，之後打仗時也會優先再考。</div>' +
           '<div class="rv-go"><button class="big" data-rv="all">' + uic("next") + '開始複習（一題一題來）</button></div>'
         : '<div class="rv-empty">錯題本是空的，太厲害了！<br>打仗時答錯的題目會收進這裡。</div>') +
      shown.map(q => '<div class="rv-it" data-id="' + esc(q.id) + '"><div class="s">' + stemHtml(q) + '</div>' + (q.zh ? '<div class="g">' + esc(q.zh) + '</div>' : '') +
        '<div class="r"><button type="button" data-rv="one" data-id="' + esc(q.id) + '">練一次</button><span class="g">' + esc(gpName(q)) + '</span></div>' +
        '<details><summary>看答案和解析</summary><p>' + filled(q) + '</p>' + (q.e ? '<p>' + esc(q.e) + '</p>' : '') + '</details></div>').join("") +
      (n > shown.length ? '<button class="big ghost" data-rv="more">再顯示 ' + Math.min(30, n - shown.length) + ' 題（還有 ' + (n - shown.length) + ' 題）</button>' : '') +
      '<div class="rv-foot"><button class="big ghost" data-rv="back">' + uic("back") + back + '</button></div></div>';
    if (U.paintIcons) U.paintIcons(rv);
  }
  rv.addEventListener("click", ev => {
    const b = ev.target.closest("[data-rv]"); if (!b || b.closest(".fl-top")) return;
    const a = b.dataset.rv;
    if (a === "back") rvClose();
    else if (a === "more") { limit += 30; rvRender(); }
    else if (a === "all") { queue = list().map(q => q.id); prNext(); }
    else if (a === "one") { queue = [b.dataset.id]; prNext(); }
  });
  // 練習面板（題卡沿用 qcard：第一次答錯先拿掉一個錯選項、給規則提示；第二次才給完整解析）
  function prNext() {
    const by = new Map(QD().map(q => [q.id, q]));
    let q = null; while (queue.length && !q) { const id = queue.shift(); if (U.S.wrongQ[id]) q = by.get(id) || null; }
    if (!q) { prClose(); return; }
    const card = U.qcard && U.qcard.render ? U.qcard.render(q, {}) : null;
    if (!card || !card.ok) { prNext(); return; }
    pr = { q, card, tried: false, done: false, left: queue.length };
    prRender();
  }
  function prRender() {
    const p = pr; if (!p) return;
    prEl.innerHTML = '<div class="box"><div class="hd">' + uic("book") + '錯題練習<small>' + (p.left ? '後面還有 ' + p.left + ' 題' : '最後一題') + '</small></div>' +
      '<div class="rv-q">' + p.card.html + '</div><div class="msg" aria-live="polite"></div>' +
      '<div class="ft"><button type="button" data-pr="close">' + (p.done ? '回錯題本' : '先不練了') + '</button>' + (p.done ? '<button type="button" class="main" data-pr="next">' + (p.left ? '下一題' : '完成') + '</button>' : '') + '</div></div>';
    p.card.bind(prEl.querySelector(".rv-q"), i => prPick(i));
    if (p.done) p.card.reveal(p.pick);
    if (p.msg) prEl.querySelector(".msg").innerHTML = p.msg;
    prEl.classList.remove("hide");
    const nb = prEl.querySelector('[data-pr="next"]'); if (nb) try { nb.focus({ preventScroll: true }); nb.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function prPick(i) {
    const p = pr; if (!p || p.done) return;
    const o = p.card.opts[i]; if (!o) return;
    if (!o.ok && !p.tried && U.qcard.canRetry && U.qcard.canRetry(p.card)) {
      p.tried = true; p.card.mark(i, "gone"); p.card.say(U.qcard.retry(p.q, o.t), true); U.beep && U.beep(260, .15, "triangle", .04); return;
    }
    p.done = true; p.pick = i;
    const removed = practiceResult(U.S, p.q.id, !!o.ok, p.tried); U.save();
    p.msg = o.ok ? (removed ? '<span class="ok">答對了！</span>這題從錯題本拿掉了。' : '<span class="ok">第二次答對了！</span>這題先留在錯題本，下次第一次就答對就會拿掉。')
                 : '<span class="bad">不對喔。</span>這題留在錯題本，看完解析再練一次。';
    p.msg += U.qcard.explain ? U.qcard.explain(p.q, o.ok ? null : o.t, { answer: !o.ok }) : "";
    if (o.ok && U.beep) U.beep(880, .12, "triangle", .04);
    prRender();
  }
  function prClose(silent) { pr = null; queue = []; prEl.classList.add("hide"); prEl.innerHTML = ""; if (!silent && vis(rv)) { const y = rv.scrollTop; rvRender(); rv.scrollTop = y; } }
  prEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-pr]"); if (b) { if (b.dataset.pr === "next") prNext(); else prClose(); return; }
    if (ev.target === prEl) prClose();
  });
  document.addEventListener("keydown", e => {
    if (!pr || !pr.done || vis(prEl) === false) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prNext(); }
  });

  // 主選單「待複習 N 題」（index.html 的 #bWrongBook）
  document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("#bWrongBook"); if (b) rvOpen("menu"); });

  // ═════ 簡報分層（P1-6，依 05_品牌資源\01_品牌規範\05_App套用範本\App文字分層規則.md）
  // 第一屏只放：關卡頭、試煉之火入口（緊接在關卡頭下面）、會出現的怪、本關文法、星星怎麼拿（這關已三星就收進「詳細」）；
  // 出征陣容、英雄挑戰、騎士絕招、裝備、同伴、鐵人、隊伍收進「詳細」。
  // 用 briefBind 掛勾（本檔排在所有簡報外掛之後載入＝其他外掛都綁好了才搬）；只搬 DOM 節點，事件與 id 都不變。
  function briefFold(root, st) {
    if (!root) return;
    const l = root.querySelector(".bf-l"), r = root.querySelector(".bf-r"); if (!l || !r || root.querySelector(".bf-more")) return;
    const three = !!(st && U.S.prog && U.S.prog[st.i] && U.S.prog[st.i].stars >= 3);
    const gram = r.firstElementChild && r.firstElementChild.classList.contains("parch") ? r.firstElementChild : null;   // 本關文法
    const isCore = el => el.classList.contains("bf-hd") || !!el.querySelector(".foes") || (!three && !!el.querySelector(".bf-rule")) || el === gram;
    let trCard = $("trBrief"); while (trCard && trCard.parentElement !== l && trCard.parentElement !== r) trCard = trCard.parentElement;   // 試煉之火入口（trial.ui 的卡）
    const tr = trCard;
    const move = [...l.children, ...r.children].filter(el => !isCore(el) && el !== tr && (el.textContent || "").trim());
    const hd = l.querySelector(":scope > .bf-hd"), wide = !!(W.matchMedia && W.matchMedia("(min-width:900px) and (min-height:560px)").matches);
    if (tr && wide && gram) gram.after(tr);   // 寬螢幕：右欄「本關文法」下面（左欄是關卡頭＋怪）
    else if (tr && hd) hd.after(tr);          // 手機：緊接在關卡頭下面，第一屏看得到
    if (!move.length) return;
    const names = []; for (const el of move) { const h = el.querySelector("h4, .kn-bt b, button span, b"); const t = h ? (h.textContent || "").replace(/[（(].*$/, "").replace(/\s+/g, "").slice(0, 8) : ""; if (t && !names.includes(t)) names.push(t); }
    const d = document.createElement("details"); d.className = "card bf-more";
    d.innerHTML = '<summary><b>詳細</b><span>' + esc(names.slice(0, 4).join("・") + (names.length > 4 ? "…" : "")) + '</span></summary><div class="bf-more-in"></div>';
    const box = d.lastChild; for (const el of move) box.appendChild(el);
    r.appendChild(d);
  }
  U.add("briefBind", (st, root) => { try { briefFold(root, st); } catch (e) { console.error("[flow brief]", e); } });

  W.TGFLOW = { backPlan, updDecide, updText, updWhere, doBack, openWrongBook: rvOpen, closeWrongBook: rvClose, state, sync, UPD };
  U.openWrongBook = rvOpen;
  later();
})();
