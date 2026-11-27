// 外掛：qpanel（畫面端）— v3 側邊答題面板（不暫停、不放慢，想答才答；主要的能量來源）
// 負責：第 2 組（戰鬥畫面流程）。合約：mods/CONTRACT_v3.md §6.1（TGUI.qbus）、§6.2（本檔）、§3（作答紀錄）。
//
// 2026-11-22 第 2 組實作（enabled:true，qbus 改由本檔出題）：
//   ・版面：直版手機＝地圖下方一條（#app 的 flex 子項，放在 #wrap 與按鈕列之間；詞彈字塊列仍在 #wrap 內地圖正下方）；
//     空間不夠時預設收成 50px 的「答一題」橫條（點開＝改成展開版、地圖跟著縮小；情境題來了先浮在地圖下緣、不改版面）。
//     橫向手機＝地圖右邊一欄（216px；放不下就收成直條、點開浮在地圖右側）；寬螢幕（≥900×560）＝右欄上方，操作說明 #tip 往下讓位（--qph）。
//   ・出題：佇列 TGUI.qbus 有題就先出（情境題 prio≥1 排前面、有倒數）；沒有就出「自願題」src:"panel"（能量滿、題量用完就不出）。
//     自願題還沒作答時，情境題可以把它換掉（自願題是本檔自己產生的、丟掉沒有損失）；已經答錯一次（第二次機會中）的題不換。
//   ・作答：TG.answerResult(G, ok, info)＋TGUI.recordAnswer(q, ok, "choice", ok, info) → item.onResult(ok, info)。
//     只有自願題由本檔呼叫 answerResult；qbus 項目（解封、九頭蛇、詠唱）的 onResult 自己呼叫引擎（第 6、8a 組都這樣寫），本檔只記學習紀錄；項目帶 qpResult:true 才代呼叫。
//     第二次機會答對：G.retryNext＝true 期間呼叫引擎（和舊的 askQuestion 相同）。略過、逾時不算答題（合約 §3.4）。
//   ・倒數用真實時間，只在遊戲在跑時扣（暫停、營地、教學卡、其他題目面板開著時都停）；英雄挑戰的自願題限時 10 秒（逾時＝略過）。
//   ・暫停／繼續：面板是獨立元素，暫停時只蓋上「暫停中」、題目與佇列原樣保留。
//   ・機器人：TGUI.qpanel.bot(yes) 依答對率點選項；test/browser/bot.js 另外模擬「答一題 4～8 秒不能操作地圖」。
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.TGUI || !window.TG) return;
  const U = window.TGUI, TG = window.TG, esc = U.esc;
  const app = document.getElementById("app"), barEl = document.querySelector(".bar"), hudEl = document.querySelector(".hud");
  if (!app || !barEl) return;
  const mq = q => window.matchMedia ? matchMedia(q) : { matches: false };
  const LAND = mq("(orientation:landscape) and (max-height:500px)"), WIDE = mq("(min-width:900px) and (min-height:560px)");
  const RM = mq("(prefers-reduced-motion:reduce)");

  const css = document.createElement("style"); css.id = "qpanelUI";
  css.textContent = `
.qp{position:relative;z-index:9;flex:none;color:#eef2fa;background:radial-gradient(130% 120% at 50% 0,#1d2c4a 0,#111a2a 60%,#0c1122);border-top:1px solid rgba(225,184,106,.55);box-shadow:0 -4px 14px #0008;display:flex;flex-direction:column;overflow:hidden;font-size:14px}
.qp::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(1px 1px at 14% 22%,#fff7 50%,transparent 51%),radial-gradient(1px 1px at 72% 14%,#fff6 50%,transparent 51%),radial-gradient(1.4px 1.4px at 58% 70%,#f3d49488 50%,transparent 51%),radial-gradient(1px 1px at 90% 48%,#fff4 50%,transparent 51%)}
.qp>*{position:relative}
.qp.port{height:var(--qpH,180px);padding:6px 10px 6px}
.qp.portMini{height:52px;padding:4px 8px}
.qp.land{width:216px;height:auto;align-self:stretch;padding:8px;border-top:0;border-left:1px solid rgba(225,184,106,.55)}
.qp.landMini{width:52px;align-self:stretch;padding:6px 4px;border-top:0;border-left:1px solid rgba(225,184,106,.55)}
.qp.wide{position:absolute;right:0;top:40px;width:410px;max-height:calc(100% - 140px);padding:10px 14px 12px;border-top:0;border-left:2px solid #ffffff20;border-bottom:1px solid rgba(225,184,106,.45);z-index:6}
.qp.float{position:absolute;z-index:12;box-shadow:0 -6px 22px #000c;border:1px solid rgba(225,184,106,.7);border-radius:14px}
.qp.float.portMini{left:6px;right:6px;bottom:var(--qpFb,64px);height:auto;max-height:62%;padding:8px 10px}
.qp.float.landMini{right:calc(124px + env(safe-area-inset-right));top:6px;bottom:6px;width:min(300px,46vw);padding:8px}
.qp-hd{display:flex;align-items:center;gap:6px;min-height:28px;flex:none}
.qp.land .qp-hd,.qp.float.landMini .qp-hd{flex-wrap:wrap;row-gap:4px;margin-bottom:4px}
.qp.land .qp-rw,.qp.float.landMini .qp-rw{order:9;flex-basis:100%;justify-content:flex-start;margin-top:-2px}
.qp.land .qc-dense .qc-stem,.qp.float.landMini .qc-dense .qc-stem{font-size:16px;line-height:1.35}
.qp.land .qp-tt,.qp.float.landMini .qp-tt{white-space:normal;flex:1 1 0;min-width:0;font-size:13px;line-height:1.3;letter-spacing:0}   /* 11-24 UIUX：橫向詠唱題標題「加強『時態三連斬』：答對絕…」被切 → 允許換行 */
.qp.land .qp-sp,.qp.float.landMini .qp-sp{display:none}
.qp.land .qc-dense .qc-zh,.qp.float.landMini .qc-dense .qc-zh{margin-bottom:4px}
.qp-tt{display:flex;align-items:center;gap:4px;font-weight:900;font-size:14px;color:#F3D494;letter-spacing:1px;white-space:nowrap;font-family:"Noto Serif TC","Songti TC","PMingLiU",serif}
.qp-tt svg{width:16px;height:16px;flex:none}
.qp-rw{font-size:12px;color:#ffe9a8;background:rgba(225,184,106,.14);border:1px solid rgba(225,184,106,.45);border-radius:8px;padding:1px 6px;white-space:nowrap;display:flex;align-items:center;gap:2px}
.qp-rw svg{width:12px;height:12px}
.qp-rw.fv{color:#ffd2a0;border-color:#ff9d3c;background:rgba(255,120,40,.18)}
.qp-sp{flex:1}
.qp-cnt{font-size:12px;color:#a9b9d0;white-space:nowrap}
.qp-b{background:none;border:1px solid #4b6478;color:#a9b9d0;border-radius:9px;min-width:44px;min-height:44px;padding:0 8px;font-size:12px;font-weight:700}
.qp-hd{margin:-7px 0 -5px}
.qp.away{display:none!important}
.qp.port.tall{height:calc(var(--qpH,180px) + var(--qpT,96px))}
.qp-more{position:sticky;bottom:0;display:flex;justify-content:center;pointer-events:none;margin-top:-26px;height:26px;align-items:flex-end}
.qp-more span{pointer-events:auto;font-size:12px;font-weight:800;color:#2a1d08;background:linear-gradient(#ffe9a8,#E1B86A);border-radius:10px 10px 0 0;padding:2px 10px;box-shadow:0 -2px 8px #0008}
.qp .qc-hint{color:#ffe9a8;margin-top:4px}
.qp-body.qp-res .qc-stem{position:sticky;top:0;z-index:2;font-size:15px;line-height:1.35;margin:0 0 2px;padding:2px 0 4px;background:#141e31;box-shadow:0 5px 6px -5px #000c}
.qp-body.qp-res .qc-zh{font-size:12px;line-height:1.35;margin-bottom:2px}
.qp .qc-retry{margin-top:6px}
.qp-b:active{border-color:#E1B86A}
.qp-timer{height:5px;border-radius:3px;background:#ffffff1a;overflow:hidden;margin:3px 0 4px;flex:none}
.qp-timer i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff7070,#f2c14e)}
.qp-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.qp .qc-res:empty{display:none}
.qp-top{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#ffe9a8;margin-top:4px}
.qp-top .ok{color:#7fe3b0;font-weight:900}
.qp-top .bad{color:#ffb0b0;font-weight:900}
.qp-next{margin-left:auto;min-height:40px;min-width:76px;border:0;border-radius:10px;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;font-weight:800;padding:0 12px}
.qp-msg{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;color:#cfdcf0;font-size:13px;line-height:1.45;padding:4px}
.qp-msg b{color:#F3D494;font-size:14px}
.qp-msg svg{width:22px;height:22px}
.qp-open{display:flex;align-items:center;gap:8px;width:100%;height:100%;min-height:44px;border:1px solid rgba(225,184,106,.6);border-radius:12px;background:linear-gradient(#2a3d58,#182638);color:#F3D494;padding:0 10px;font-weight:900;font-size:15px}
.qp-open svg{width:20px;height:20px;flex:none}
.qp-open small{font-size:12px;color:#cfdcf0;font-weight:700}
.qp-open .qp-sp{flex:1}
.qp-open .qp-dot{min-width:20px;height:20px;border-radius:10px;background:#e0566a;color:#fff;font-size:12px;display:grid;place-items:center;padding:0 5px}
.qp-open.urgent{animation:qpPulse 1s ease-in-out infinite}
.qp-open:disabled{opacity:.55}
.qp.landMini .qp-open{flex-direction:column;justify-content:center;padding:6px 2px;gap:4px;font-size:13px;writing-mode:vertical-rl;letter-spacing:2px}
.qp.landMini .qp-open small{display:none}
.qp-dim{position:absolute;inset:0;z-index:3;background:#0c1122b0;display:grid;place-items:center;color:#a9b9d0;font-size:13px;font-weight:700;letter-spacing:1px}
.qp.gain{box-shadow:0 -4px 14px #0008,inset 0 0 0 2px #f3d494}
@keyframes qpPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,86,106,.0)}50%{box-shadow:0 0 0 4px rgba(224,86,106,.55)}}
@media (max-width:360px){.qp-tt{font-size:13px}.qp-rw{font-size:12px;white-space:normal}}
@media (min-width:900px) and (min-height:560px){.qp-tt{font-size:16px}}
@media (prefers-reduced-motion:reduce){.qp-open.urgent{animation:none;border-color:#e0566a}}`;
  document.head.appendChild(css);

  const el = document.createElement("div"); el.id = "qpanel"; el.className = "qp hide"; el.setAttribute("aria-label", "答題面板");
  app.insertBefore(el, barEl);

  const BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill="#ffd75e" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5 1 1.5 1.5 2 2.5 2.5-.5-3 0-5.5.5-7.5z" fill="#ff9d3c" stroke="#0c1122" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5c-2.5-1.8-5.5-2-8.5-1.2v13c3-.8 6-.6 8.5 1.2 2.5-1.8 5.5-2 8.5-1.2v-13c-3-.8-6-.6-8.5 1.2z" fill="#f3e6c6" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6.5v13" stroke="#8a6a3a" stroke-width="1.3"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#5fd39a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const P = {
    ver: 1,
    enabled: true,
    cfg: { maxQueue: 3, nextDelay: 0.6, skip: true, okShow: 0.7, wrongShow: 3.2, heroicTime: 10 },
    pump, show, hide: () => setVis(false), busy, bot, key, expand, collapse,
    cur: () => cur, layoutName: () => lay,
    relayout: () => layout(true)
  };
  U.qpanel = P;

  let cur = null;          // { item, q, opts, gone, tried, firstWrong, done, t0, left, T, card, ok }
  let wait = 0;            // 真實秒：多久後出下一題
  let pref = null;         // 使用者選的 "open"／"mini"（null＝自動）
  let lay = "";            // port／portMini／land／landMini／wide
  let floatOn = false;     // 收起狀態下情境題浮出來
  let portRoomy = true;    // 直版：展開後地圖還夠大
  let vis = false, lastHtmlKey = "", lastStatus = "";
  let tallOn = false;      // 直版：答錯時暫時把面板長高，提示／解析一定看得到（第二輪 P1-5）
  const bus = () => U.qbus;
  const G0 = () => U.G, R0 = () => U.run;
  const live = () => { const G = G0(); return !!(G && !G.over && R0() && !(TG.pfOn && TG.pfOn(G))); };   // 先備戰再守城（2026-11-25）：整局不顯示側邊面板，地圖用滿
  // 其他題目面板、暫停選單、營地、教學卡開著＝面板不能用（倒數也停）
  const inert = () => { const m = U.sheetMode; return U.held || (!!m && m !== "build" && m !== "tower"); };
  const secondChanceOn = () => { const G = G0(), run = R0(); return !(run && run.heroic) && !(G && G.modes && G.modes.iron); };
  const stats = () => { const run = R0(); if (!run) return {}; return run.qp || (run.qp = { n: 0, ok: 0, skip: 0, timeout: 0, bySrc: {}, shown: 0 }); };
  const isVol = it => !!it && it.src === "panel" && !it._bus;

  // 自願題可不可以出（第二輪 P1-10／分工單介面 1）：
  //   引擎有 TG.volState(s)（第 B 組）→ { ok:true } 或 { ok:false, why:"quota" }；能量滿不再是停題理由（答對改給金幣 TG.ENERGY_FULL_GOLD）
  //   退路（引擎還沒有 volState）：能量滿＝"full"（舊規則：停題）；其他擋題＝"budget"（這關的練習題答完了）。
  //   舊版把「保留給情境題的額度用完」也當成「能量滿了」，畫面寫「能量滿了（1／12）」——已改。
  function volState() {
    const G = G0(); if (!G) return "none";
    if (typeof TG.volState === "function") {
      let r = null; try { r = TG.volState(G); } catch (e) { r = null; }
      if (r && typeof r === "object") return r.ok ? "ok" : r.why === "off" ? "none" : r.why === "full" ? "full" : "budget";
    }
    if (TG.qCanAsk && !TG.qCanAsk(G, "fill", "panel")) return (G.energy || 0) >= TG.ENERGY_MAX ? "full" : "budget";
    if ((G.energy || 0) >= TG.ENERGY_MAX) return "full";
    const noBudget = TG.qBudgetLeft && TG.qBudgetLeft(G) < (TG.qCost ? TG.qCost("fill") : 1);
    if (R0() && R0().qbudgetOut && noBudget) return "budget";
    return "ok";
  }
  const fullNow = G => (G.energy || 0) >= TG.ENERGY_MAX;
  const fullGold = () => +TG.ENERGY_FULL_GOLD > 0 ? +TG.ENERGY_FULL_GOLD : 0;   // 能量滿時答對每格換幾金幣（第 B 組；沒有＝0）
  // 獎勵標籤要跟實得一致（P2）：慢慢答拿 first 格、10 秒內答對多 fast 格 →「答對 +2（10 秒內 +3）」
  function gainPair(G) {
    let slow = 0, fast = 0;
    const fs = (TG.ENERGY_GAIN && TG.ENERGY_GAIN.fastSec) || 10;
    try { slow = TG.energyGain(G, true, { kind: "mcq", src: "panel", try: 1, sec: fs + 30, qk: "fill" }); fast = TG.energyGain(G, true, { kind: "mcq", src: "panel", try: 1, sec: 1, qk: "fill" }); } catch (e) { slow = fast = 1; }
    return { slow, fast, fs };
  }
  function gainText(G) {
    const p = gainPair(G);
    if (fullNow(G) && fullGold()) {
      let g = 0, gf = 0; try { g = typeof TG.fullGold === "function" ? TG.fullGold(G, { sec: p.fs + 30 }) : p.slow * fullGold(); gf = typeof TG.fullGold === "function" ? TG.fullGold(G, { sec: 1 }) : p.fast * fullGold(); } catch (e) { g = p.slow * fullGold(); }
      // 11-24 整合：和平常的「答對 +2（10 秒內 +3）」一樣，把快答多拿的也寫出來（截圖：標籤 +20、實拿 +30 對不上）
      //   標籤要短（390 寬要放得下「略過」「收起」）：寫成「+20～30」
      return "能量滿：答對拿 +" + Math.round(g) + (gf > g ? "～" + Math.round(gf) : "") + " 金幣";
    }
    if (!(p.fast > 0)) return "答對有獎勵";
    return "答對 +" + p.slow + (p.fast > p.slow ? "（" + p.fs + " 秒內 +" + p.fast + "）" : " 能量");
  }
  function busy() { return !!(cur && !cur.done); }

  // ───── 版面
  function setVis(v) {
    if (vis === v) return; vis = v; el.classList.toggle("hide", !v);
    if (!v) { app.style.removeProperty("--qph"); floatOn = false; }
    if (U.relayout) U.relayout();
  }
  function decide() {
    if (WIDE.matches) return "wide";
    const wb = document.querySelector(".wb-bar") ? 1 : 0;
    if (LAND.matches) {
      const free = app.clientWidth - (hudEl ? hudEl.offsetWidth : 92) - barEl.offsetWidth - (wb ? 116 : 0) - 12;
      const roomy = Math.min(free - 216, (app.clientHeight - 8) * 0.75) >= 230;
      if (pref === "mini") return "landMini";
      if (pref === "open") return roomy ? "land" : "landMini";
      return roomy ? "land" : "landMini";
    }
    const H = app.clientHeight, openH = Math.round(Math.max(192, Math.min(212, H * 0.25)));   // 兩排選項＋題幹＋中文要放得下
    const fit = (R0() && R0().qpFit) || 0;   // 11-24 UIUX P0：題目放不下時面板長高（這一局只長不縮，地圖不會每題跳動）
    app.style.setProperty("--qpH", Math.max(openH, fit) + "px");
    const left = H - (hudEl ? hudEl.offsetHeight : 44) - barEl.offsetHeight - (wb ? 58 : 0) - openH - 8;
    portRoomy = left >= 300;   // 展開後地圖高度至少 300px（約 0.75 倍）才改版面；不然展開＝浮在地圖下緣，地圖不縮
    if (pref === "mini" || pref === "float") return "portMini";
    if (pref === "open") return portRoomy ? "port" : "portMini";
    return portRoomy ? "port" : "portMini";
  }
  function layout(force) {
    if (!vis) return;
    const L = decide();
    const wantFloat = (L === "portMini" || L === "landMini") && (floatOn || pref === "float" || (pref === "open" && L === "landMini") || (pref === "open" && L === "portMini"));
    // 第二輪 P0-1：浮動答題卡（320 寬、橫向收起時點開）在營地、暫停選單、說明卡等暫停面板開著時先藏起來（層級 12 會蓋住營地），關掉再恢復
    const cls = "qp " + L + (wantFloat ? " float" : "") + (wantFloat && inert() ? " away" : "") + (tallOn && L === "port" ? " tall" : "");
    if (el.className !== cls) {
      const sizeChange = L !== lay;
      el.className = cls; lay = L; lastHtmlKey = "";
      if (sizeChange && U.relayout && !force) U.relayout();
      render();
    }
    if (L === "portMini" && wantFloat) app.style.setProperty("--qpFb", (barEl.offsetHeight + el.offsetHeight > 0 ? barEl.offsetHeight + 54 : 64) + "px");
    if (L === "wide") app.style.setProperty("--qph", el.offsetHeight + "px");
  }
  window.addEventListener("resize", () => { if (vis) setTimeout(() => layout(true), 0); });
  const miniNow = () => (lay === "portMini" || lay === "landMini") && !el.classList.contains("float");
  function expand() {
    if (lay === "portMini") { pref = portRoomy ? "open" : "float"; floatOn = false; layout(); }
    else if (lay === "landMini") { pref = "open"; floatOn = true; layout(); }
    if (!cur) pump(bus());
  }
  function collapse() { pref = "mini"; floatOn = false; layout(); }
  // 第二輪 P1-7：收起狀態下，每關第一次有自願題時自動展開一次；之後答完自願題自動收回（不讓答題卡一直蓋著地圖）
  function autoOpen() {
    const run = R0(); if (!run || run.qpAuto || !miniNow() || run.qpUserMini) return;
    run.qpAuto = true;
    if (lay === "portMini") { pref = portRoomy ? "open" : "float"; floatOn = false; }
    else { pref = "open"; floatOn = true; }
    layout();
  }
  function autoFold() {
    if (!(lay === "portMini" || lay === "landMini") || !el.classList.contains("float")) return false;
    if (bus() && bus().list().some(x => (x.prio || 0) >= 1)) return false;   // 還有情境題在排隊：先別收
    pref = "mini"; floatOn = false; layout(); return true;
  }
  function setTall(v) {
    v = !!v && lay === "port"; if (v === tallOn) return;
    tallOn = v;
    if (v) { const hudH = hudEl ? hudEl.offsetHeight : 44, room = app.clientHeight - hudH - barEl.offsetHeight - el.offsetHeight - 220; app.style.setProperty("--qpT", Math.max(48, Math.min(110, room)) + "px"); }
    layout(true); if (U.relayout) U.relayout();
  }
  // 11-24 UIUX P0（手機答題選項被蓋住）：直版面板出題時，題幹＋選項放不下就把面板長高，4 個選項不用捲就看得到、按得到
  //   上限：地圖區至少留 240px；這一局只長不縮（記在 run.qpFit）。長高後重排一次版面（地圖跟著縮）
  function fitPort(body) {
    if (lay !== "port" || tallOn || !body || !cur || cur.done || cur.resHtml) return false;
    const over = body.scrollHeight - body.clientHeight; if (over <= 2) return false;
    const run = R0(); if (!run) return false;
    const hudH = hudEl ? hudEl.offsetHeight : 44, wb = document.querySelector(".wb-bar") ? 58 : 0;
    const maxH = app.clientHeight - hudH - barEl.offsetHeight - wb - 240;
    const want = Math.min(maxH, el.offsetHeight + over + 4);
    if (want <= el.offsetHeight + 1 || want <= (run.qpFit || 0)) return false;
    run.qpFit = Math.round(want);
    if (U.relayout) U.relayout(); else layout(true);
    return true;
  }
  // 選項或解析被截在下面時，面板底部提示「往下還有」（P1-4 退路）
  function moreHint(body) {
    if (!body) return;
    const old = body.querySelector(".qp-more"); if (old) old.remove();
    const need = body.scrollHeight > body.clientHeight + 6 && body.scrollTop + body.clientHeight < body.scrollHeight - 6;
    if (need) { const d = document.createElement("div"); d.className = "qp-more"; d.innerHTML = '<span>往下還有，滑一下</span>'; body.appendChild(d); }
    body.onscroll = () => { clearTimeout(body._mt); body._mt = setTimeout(() => moreHint(body), 80); };
  }
  // 只捲面板自己（不動地圖版面）：讓提示／解析出現在可視範圍
  function showRes(body) {
    if (!body) return;
    const r = body.querySelector(".qc-res"); if (!r || !r.innerHTML) { body.classList.remove("qp-res"); return; }
    // 11-24 整合（主對話截圖：390 第一次答錯捲到提示，題目前半句被捲出去、只看得到「small.」）：
    //   有提示／解析時題幹縮成小字、固定在面板頂端（sticky），往下捲到提示時題目還在；捲動量扣掉題幹高度
    body.classList.add("qp-res");
    const st = body.querySelector(".qc-stem"), stH = st ? st.offsetHeight : 0;
    const br = body.getBoundingClientRect(), rr = r.getBoundingClientRect();
    const top = rr.top - br.top + body.scrollTop, bottom = top + rr.height;
    if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = Math.max(0, Math.min(top - stH - 4, bottom - body.clientHeight));
  }

  // ───── 出題
  function pump(b) {
    b = b || bus(); if (!b || !live()) return;
    const G = G0();
    // 綁定的怪死了／漏了＝取消
    for (const it of b.list()) if (it.eid && !G.enemies.some(e => e.id === it.eid)) b.cancel(it.id);
    if (cur && !cur.done) {
      // 自願題還沒動過：情境題可以換掉它（不搶「正在作答」的題＝已經答錯一次的題）
      const top = b.peek();
      if (top && (top.prio || 0) >= 1 && isVol(cur.item) && !cur.tried) { cur = null; }
      else return;
    }
    if (cur && cur.done) return;   // 正在顯示結果，等 wait 倒數
    if (wait > 0) return;
    const it = b.take();
    if (it) { it._bus = true; try { b.emit("show", it); } catch (e) {} show(it); return; }
    if (volState() === "ok") show({ src: "panel", prio: 0, use: "choice", title: "答題", deadline: R0().heroic ? P.cfg.heroicTime : 0 });
    else render();
  }
  function show(item) {
    const G = G0(), run = R0(); if (!G || !run) return;
    let q = item.q || null;
    try { if (!q) q = U.pickQ ? U.pickQ({ use: item.use || "choice", lv: item.lv, gpPref: item.gpPref }) : null; } catch (e) { console.error("[qpanel pick]", e); }
    if (!q || !Array.isArray(q.o)) { if (item._bus && item.onCancel) try { item.onCancel(); } catch (e) {} render(); return; }
    const opts = TG.shuffleOptions(q, U.rng);
    const T = item.deadline > 0 ? item.deadline : Infinity;
    cur = { item, q, opts, gone: [], tried: false, firstWrong: null, done: false, t0: performance.now(), left: T, T, ok: null };
    stats().shown++;
    if ((item.prio || 0) >= 1 && miniNow()) { floatOn = true; layout(); }
    else if (isVol(item) && miniNow()) autoOpen();
    lastHtmlKey = ""; render();
  }
  function render() {
    if (!vis) return;
    const G = G0(); if (!G) return;
    if (miniNow()) { renderMini(G); return; }
    let h = "";
    const fever = TG.feverOn && TG.feverOn(G);
    const waitN = bus() ? bus().size() : 0;
    if (cur) {
      const it = cur.item, vol = isVol(it);
      const key = "q|" + cur.q.id + "|" + cur.gone.join(",") + "|" + cur.done + "|" + lay + "|" + el.className + "|" + fever + "|" + waitN + "|" + fullNow(G);   // 11-24 整合：題目出著時能量才滿，標籤也要改成「答對改拿金幣」
      if (key === lastHtmlKey) return; lastHtmlKey = key;
      let gpName = ""; try { gpName = cur.q.gp && typeof QDB_GP !== "undefined" && QDB_GP[cur.q.gp] ? QDB_GP[cur.q.gp].name : ""; } catch (e) {}
      h += '<div class="qp-hd"><span class="qp-tt">' + (vol ? BOOK : FLAME) + esc(vol ? "答題" : String(it.title || "答題").replace(/^[^一-鿿A-Za-z0-9（(]+/, "")) + '</span>' +
        (vol ? '<span class="qp-rw' + (fever ? ' fv' : '') + '">' + (fever ? FLAME + '狂熱 ' : BOLT) + esc(gainText(G)) + '</span>' : '') +
        '<span class="qp-sp"></span>' + (waitN ? '<span class="qp-cnt">還有 ' + waitN + ' 題</span>' : '') +
        (!cur.done && P.cfg.skip && (it.prio || 0) < 1 ? '<button class="qp-b" data-qp="skip">略過</button>' : '') +
        (lay === "port" || lay === "land" || el.classList.contains("float") ? '<button class="qp-b" data-qp="mini" aria-label="收起答題面板">收起</button>' : '') + '</div>';
      if (isFinite(cur.T)) h += '<div class="qp-timer"><i id="qpBar" style="width:' + Math.max(0, cur.left / cur.T * 100) + '%"></i></div>';
      // 題卡（第 3 組 TGUI.qcard）：直版手機用精簡＋壓高度（dense，卡片寬 ≥480 時 4 個短選項排一列）；暫停／重畫時帶回 opts、gone
      const card = U.qcard.render(cur.q, { compact: true, dense: lay !== "wide", opts: cur.opts, gone: cur.gone, keys: true, label: lay === "wide" ? gpName : "" });
      if (!card.ok) { cur = null; wait = P.cfg.nextDelay; lastHtmlKey = ""; return; }   // 畫不出來的題（不該發生）：換下一題
      cur.card = card; cur.opts = card.opts;
      h += '<div class="qp-body">' + card.html + '</div>';
      el.innerHTML = h + dimHtml();
      const body = el.querySelector(".qp-body");
      card.bind(body, i => pick(i));
      if (cur.done) card.reveal(cur.pickI);
      if (cur.resHtml) { card.say(cur.resHtml); showRes(body); }   // 只捲面板自己：答錯時提示／解析一定看得到（P1-5）
      fitPort(body);
      moreHint(body);
      syncH();
      bindBtns();
      return;
    }
    // 沒有題目：說明為什麼
    const vs = volState();
    const key = "s|" + vs + "|" + lay + "|" + el.className + "|" + Math.floor(G.energy || 0);
    if (key === lastHtmlKey) return; lastHtmlKey = key;
    let msg;
    if (vs === "full") msg = BOLT + '<b>能量滿了（' + Math.floor(G.energy || 0) + '／' + TG.ENERGY_MAX + '）</b>先點塔升級、召喚神獸或灌注絕招，用掉能量再回來答題';
    else if (vs === "budget") msg = CHECK + '<b>這關的練習題答完了</b>專心守城（情境題還會出現）';
    else msg = BOOK + '<b>準備下一題…</b>';
    setTimeout(syncH, 0);
    el.innerHTML = '<div class="qp-hd"><span class="qp-tt">' + BOOK + '答題</span><span class="qp-sp"></span>' + (lay === "port" || lay === "land" || el.classList.contains("float") ? '<button class="qp-b" data-qp="mini">收起</button>' : '') + '</div><div class="qp-msg">' + msg + '</div>' + dimHtml();
    bindBtns();
  }
  // 寬螢幕：右欄操作說明 #tip 跟著面板高度往下讓位
  function syncH() { if (lay === "wide" && vis) { const h = el.offsetHeight + "px"; if (app.style.getPropertyValue("--qph") !== h) app.style.setProperty("--qph", h); } }
  function renderMini(G) {
    const vs = volState(), waitN = bus() ? bus().size() : 0, urgent = !!(cur && (cur.item.prio || 0) >= 1) || (bus() && bus().list().some(x => (x.prio || 0) >= 1));
    const key = "m|" + vs + "|" + waitN + "|" + urgent + "|" + lay + "|" + !!cur + "|" + Math.floor(G.energy || 0);
    if (key === lastHtmlKey) return; lastHtmlKey = key;
    const lbl = cur || waitN ? (urgent ? "有題目在等你" : "答一題") : vs === "full" ? "能量滿了" : vs === "budget" ? "練習題答完了" : "答一題";
    el.innerHTML = '<button class="qp-open' + (urgent ? ' urgent' : '') + '" data-qp="open"' + (!cur && !waitN && vs !== "ok" ? ' disabled' : '') + '>' + (urgent ? FLAME : BOLT) + '<b>' + lbl + '</b><small>' + (vs === "ok" ? esc(gainText(G)) : (G.energy || 0) + '／' + TG.ENERGY_MAX) + '</small><span class="qp-sp"></span>' + (waitN ? '<span class="qp-dot">' + waitN + '</span>' : '') + '</button>' + dimHtml();
    bindBtns();
  }
  function dimHtml() {
    const m = U.sheetMode;
    if (m === "menu") return '<div class="qp-dim">暫停中</div>';
    if (inert()) return '<div class="qp-dim">' + (m === "camp" || m === "prep" ? "營地中" : U.held ? "看說明中" : "先答完另一題") + '</div>';
    return "";
  }
  function bindBtns() {
    el.querySelectorAll("[data-qp]").forEach(b => b.onclick = () => {
      const k = b.dataset.qp;
      if (inert()) return;
      if (k === "skip") skip();
      else if (k === "mini") { const run = R0(); if (run) run.qpUserMini = true; if (el.classList.contains("float")) { floatOn = false; if (pref === "open" || pref === "float") pref = "mini"; layout(); } else collapse(); }
      else if (k === "open") expand();
      else if (k === "next") next();
    });
  }
  // ───── 作答
  function pick(i) {
    const R = cur, G = G0(), run = R0();
    if (!R || R.done || !G || !run || inert() || !R.card) return;
    if (!R.opts[i] || R.gone.includes(i)) return;
    const ok = !!R.opts[i].ok;
    const noRetry = R.item.noRetry || R.item.second === false || R.item.src === "chant";   // 詠唱題不給第二次機會（第⑥組）
    if (!ok && !R.tried && !noRetry && U.qcard.canRetry(R.card) && secondChanceOn()) {
      R.tried = true; R.firstWrong = i;
      R.card.mark(i, "gone"); R.gone = R.card.gone.slice();
      if (isFinite(R.T) && R.left < 6) { R.left = 6; if (R.left > R.T) R.T = R.left; }
      R.resHtml = U.qcard.retry(R.q, R.opts[i].t); R.card.say(R.resHtml);
      U.beep(260, .15, "triangle", .04);
      setTall(true); { const body = el.querySelector(".qp-body"); showRes(body); moreHint(body); }
      lastHtmlKey = "q|" + R.q.id + "|" + R.gone.join(",") + "|" + R.done + "|" + lay + "|" + el.className + "|" + (TG.feverOn && TG.feverOn(G)) + "|" + (bus() ? bus().size() : 0) + "|" + fullNow(G);
      return;
    }
    finish(ok, i, false);
  }
  function finish(ok, i, timeout) {
    const R = cur, G = G0(), run = R0(); if (!R || R.done) return;
    R.done = true; R.pickI = i; R.ok = ok;
    const it = R.item, st = stats();
    const retry = !!(ok && R.tried);
    const info = U.ansInfo(R.q, { kind: "mcq", src: it.src || "panel", try: R.tried ? 2 : 1, sec: Math.round((performance.now() - R.t0) / 100) / 10, retryOk: !!(ok && R.tried) });
    if (it.revenge) info.revenge = true;
    if (timeout) {
      // 逾時：不算答題（不進分母、不給獎勵、不扣，合約 §3.4）；情境題照 onResult(false,{timeout:true}) 通知
      st.timeout++;
      R.resHtml = '<div class="qp-top"><span class="bad">時間到。</span></div>' + U.qcard.explain(R.q, null);
      try { if (it.onResult) it.onResult(false, Object.assign({ timeout: true }, info)); } catch (e) { console.error("[qpanel onResult]", e); }
      try { bus() && bus().emit("result", it, false, Object.assign({ timeout: true }, info)); } catch (e) {}
      wait = 2.2;
    } else {
      st.n++; if (ok && !R.tried) st.ok++; st.bySrc[info.src] = (st.bySrc[info.src] || 0) + 1;
      const e0 = G.energy || 0, g0 = G.gold || 0;
      if (G) G.retryNext = retry;
      try {
        // 引擎獎勵：自願題由本檔呼叫 answerResult；qbus 項目（解封、九頭蛇、詠唱…）由 onResult 裡的引擎函式自己呼叫（和舊的 askQuestion 相同，避免記兩次）
        //   項目帶 qpResult:true＝要本檔代呼叫
        if (isVol(it) || it.qpResult) TG.answerResult(G, ok, Object.assign({ retry }, info));
        U.recordAnswer(R.q, ok && !R.tried, "choice", ok, info);
        if (it.onResult) it.onResult(ok, Object.assign({ retry }, info));
      } catch (e) { console.error("[qpanel answer]", e); }
      finally { if (G) G.retryNext = false; }
      try { bus() && bus().emit("result", it, ok, info); } catch (e) {}
      const dE = (G.energy || 0) - e0, dG = Math.round((G.gold || 0) - g0);
      const gainT = dE > 0 ? '能量 +' + dE : dG > 0 ? '金幣 +' + dG + (fullNow(G) ? '（能量滿了）' : '') : '';
      const pickT = i >= 0 ? R.opts[i].t : null, firstT = R.firstWrong != null ? R.opts[R.firstWrong].t : null;
      if (ok && !R.tried) { R.resHtml = '<div class="qp-top"><span class="ok">答對了！</span>' + gainT + '</div>'; wait = P.cfg.nextDelay + P.cfg.okShow; flashGain(); }
      else if (ok) { R.resHtml = '<div class="qp-top"><span class="ok">第二次答對了！</span>' + gainT + '（收進錯題本）</div>' + U.qcard.explain(R.q, firstT, { answer: false }); wait = P.cfg.nextDelay + 2.2; flashGain(); }
      else { R.resHtml = '<div class="qp-top"><span class="bad">不對喔。</span><button class="qp-next" data-qp="next">下一題</button></div>' + U.qcard.explain(R.q, pickT || firstT); wait = P.cfg.nextDelay + P.cfg.wrongShow; setTall(true); }
    }
    if ((it.prio || 0) >= 1 && floatOn && !(bus() && bus().list().some(x => (x.prio || 0) >= 1))) setTimeout(() => { if (cur === R || !cur) { floatOn = false; layout(); } }, Math.round(wait * 1000));
    lastHtmlKey = ""; render();
  }
  function flashGain() { if (RM.matches) return; el.classList.add("gain"); setTimeout(() => el.classList.remove("gain"), 420); }
  function next() { if (cur && cur.done) { const was = cur; cur = null; wait = 0; lastHtmlKey = ""; afterDone(was); pump(bus()); render(); } }
  // 一題結束（結果顯示完）：面板縮回原高度；收起狀態點開的浮動卡答完自願題就收回（P1-7）
  function afterDone(R) { setTall(false); if (R && isVol(R.item)) autoFold(); }
  function skip() {
    const R = cur; if (!R || R.done) return;
    if ((R.item.prio || 0) >= 1) return;   // 情境題不能略過（有倒數，逾時＝沒解開）
    stats().skip++; setTall(false);
    if (R.item._bus) { try { R.item.onCancel && R.item.onCancel(); } catch (e) {} try { bus().emit("cancel", R.item); } catch (e) {} }
    cur = null; wait = P.cfg.nextDelay; lastHtmlKey = ""; render();
  }
  function key(k) {
    if (!vis || inert() || !cur || cur.done || miniNow()) return false;
    const i = +k - 1; if (!(i >= 0 && i < cur.opts.length)) return false;
    pick(i); return true;
  }
  // 機器人：依答對率作答；回傳 true＝這一輪點了題目
  function bot(yes) {
    if (!vis || inert() || !cur || cur.done) return false;
    const R = cur, i = R.card && R.card.right >= 0 ? R.card.right : R.opts.findIndex(o => o.ok);
    const wr = R.opts.map((o, k) => k).filter(k => k !== i && !R.gone.includes(k));
    const pickI = yes() || !wr.length ? i : wr[0];
    if (miniNow()) expand();
    pick(pickI);
    return true;
  }

  // ───── 每幀（遊戲在跑時）：倒數、出下一題、刷新狀態
  U.add("frame", (G, run, real) => {
    if (!live()) return;
    if (!vis) { setVis(true); layout(); }
    if (inert()) { refreshDim(); return; }
    refreshDim();
    if (cur && !cur.done) {
      if (cur.item.eid && !G.enemies.some(e => e.id === cur.item.eid)) { const it = cur.item; cur = null; try { it.onCancel && it.onCancel(); } catch (e) {} lastHtmlKey = ""; render(); }
      else if (isFinite(cur.T)) {
        cur.left -= real; const b = el.querySelector("#qpBar"); if (b) b.style.width = Math.max(0, cur.left / cur.T * 100) + "%";
        if (cur.left <= 0) {
          if (isVol(cur.item)) { stats().timeout++; cur = null; wait = P.cfg.nextDelay; lastHtmlKey = ""; render(); }   // 英雄挑戰的自願題逾時＝略過（不記、不扣）
          else finish(false, -1, true);
        }
      }
      // 自願題顯示中但能量已滿 → 收掉（能量滿就停止出題，紅線 2）
      if (cur && !cur.done && isVol(cur.item) && !cur.tried && volState() !== "ok") { cur = null; lastHtmlKey = ""; render(); }
    } else if (cur && cur.done) {
      wait -= real; if (wait <= 0) { const was = cur; cur = null; wait = 0; lastHtmlKey = ""; afterDone(was); }
    } else if (wait > 0) wait -= real;
    if (!cur) pump(bus());
    render();
  });
  let dimK = "";
  function refreshDim() { const k = U.sheetMode + "|" + U.held; if (k !== dimK) { dimK = k; lastHtmlKey = ""; layout(true); render(); } }
  // 暫停時 frame 不跑：另外每 0.3 秒同步「暫停中」遮罩與可見性
  setInterval(() => {
    if (!live()) { if (vis) { setVis(false); } cur = null; return; }
    refreshDim();
  }, 300);
  U.add("start", () => { cur = null; wait = 0.8; floatOn = false; tallOn = false; if (pref === "float" || (pref === "open" && !WIDE.matches)) pref = null; lastHtmlKey = ""; setVis(live()); layout(true); render(); });
  U.add("end", () => { cur = null; setVis(false); });
  U.add("event", ev => { if (ev.k === "qbudget" || ev.k === "energy" || ev.k === "energySpend") { lastHtmlKey = ""; } });
})();
