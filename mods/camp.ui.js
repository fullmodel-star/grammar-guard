// 外掛：camp（畫面端）— v3 備戰營地（取代「備戰」：旗子波抽增益卡、其他波只出 1 題；遊戲暫停）
// 負責：第 2 組（戰鬥畫面流程）。合約：mods/CONTRACT_v3.md §7（引擎 TG.campDue／campKind／campDraw／campTake 由第 1 組做）。
// 卡片資料：TG.DATA_CARDS（mods/cards.data.js，由 _data/cards_v3.json 經 node _data/gen_data.mjs 產生；可能是 null）。
//
// 2026-11-22 第 2 組實作（enabled:true）：index.html 的 frame()／startWave() 在 TG.campDue（沒有就用 TG.prepDue）時呼叫 TGUI.camp.open(G, run)。
//   ・畫面三塊：上一波戰果（擊倒、漏怪、答題、獲得能量；數字跳動）、下一波怪種＋弱點、答 1 題。
//   ・TG.campKind(G)：「camp」＝旗子波，答對 TG.CAMP.pick.ok 選 1、答錯 pick.wrong 選 1（卡片翻牌、稀有度光框）；
//     「quick」＝只答 1 題（能量）；null＝這個空檔不開營地。引擎還沒有 campKind（空殼期）＝一律 quick。
//   ・重抽：卡片出來後、還沒選之前，可自願多答 1 題（src:"campReroll"，TG.qCanAsk 擋題量）；答對換一組新卡、答錯保留原本的卡。每次營地 1 次。
//   ・略過：沒答題就收＝不抽卡；引擎有 TG.campSkip(G) 就呼叫（「略過換 2 能量」由第 1 組決定）。
//   ・作答：TG.answerResult(G, ok, info)＋TGUI.recordAnswer(q, ok, "choice", ok, info)（info.src "camp"／"campReroll"；復仇題 revenge:true）。
//   ・卡冊：持有中的卡（剩幾波）、組合卡「還差哪張」（讀 req.all）。
//   ・暫停／繼續：index.html 的 resumeFromPause 呼叫 TGUI.camp.render() 原樣放回（狀態都在本檔）。
//   ・機器人：TGUI.camp.bot(yes)。
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.TGUI || !window.TG) return;
  const U = window.TGUI, TG = window.TG, esc = U.esc;
  const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion:reduce)") : { matches: false };
  const LANDQ = window.matchMedia ? matchMedia("(orientation:landscape) and (max-height:500px)") : { matches: false };

  const css = document.createElement("style"); css.id = "campUI";
  css.textContent = `
.sheet.camp{background:radial-gradient(1px 1px at 12% 18%,#fff8 50%,transparent 51%),radial-gradient(1px 1px at 78% 12%,#fff6 50%,transparent 51%),radial-gradient(1.5px 1.5px at 62% 30%,#f3d49488 50%,transparent 51%),radial-gradient(1px 1px at 30% 60%,#fff5 50%,transparent 51%),radial-gradient(130% 90% at 50% 0,#22345a 0,#121c33 55%,#0a0f1e);border-top:2px solid #E1B86A;box-shadow:0 -1px 0 rgba(225,184,106,.35),0 -10px 30px #000c;color:#eef2fa;max-height:88dvh}
.cp-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}
.cp-tt b{display:block;font-family:"Noto Serif TC","Songti TC","PMingLiU",serif;font-weight:900;font-size:21px;letter-spacing:2px;color:#F3D494;text-shadow:0 0 10px rgba(225,184,106,.45)}
.cp-tt small{display:block;font-size:12px;color:#a9b9d0;margin-top:1px}
.cp-flag{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#ffe2a0;background:linear-gradient(#5a2a2e,#3a1c26);border:1px solid #e0566a;border-radius:10px;padding:4px 8px;white-space:nowrap}
.cp-flag svg{width:16px;height:16px}
.cp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px}
.cp-st{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:10px;background:linear-gradient(#1f3046,#152336);border:1px solid #2e4560;font-size:11.5px;color:#a9b9d0;font-weight:700}
.cp-st svg{width:18px;height:18px}
.cp-st b{font-size:20px;color:#fff;font-variant-numeric:tabular-nums;line-height:1.1}
.cp-st.good b{color:#ffe9a8}
.cp-st.bad b{color:#ffb0b0}
.cp-run{font-size:12px;color:#cfdcf0;text-align:center;margin:-2px 0 8px}
.cp-run b{color:#F3D494}
.cp-fc{background:rgba(63,105,166,.16);border:1px solid rgba(110,150,210,.35);border-radius:10px;padding:6px 8px;margin-bottom:8px}
.cp-fc h4{margin:0 0 4px;font-size:13px;color:#cfdcf0;display:flex;align-items:center;gap:4px}
.cp-fc h4 small{color:#8ea3c0;font-weight:400}
.cp-fc h4 svg,.cp-fc h4 .uic svg{width:18px;height:18px;flex:none}
.cp-foes{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.cp-foe{display:flex;align-items:center;gap:2px;font-size:12px;color:#eef2fa;font-weight:700}
.cp-foe canvas{width:30px;height:30px;box-shadow:none;border-radius:0}
.cp-foe.boss{color:#ffb0b0}
.cp-weak{margin-top:4px;display:grid;gap:2px;font-size:12px;color:#ffe2a0;line-height:1.4}
.cp-weak span::before{content:"弱點 ";color:#8ea3c0}
.cp-pf{display:flex;align-items:center;gap:10px;margin:2px 0 6px}.cp-pf b{font-size:16px;color:#F3D494;letter-spacing:1px;white-space:nowrap}
.cp-dots{display:flex;gap:5px;flex-wrap:wrap}.cp-dots i{width:10px;height:10px;border-radius:50%;background:#ffffff26;border:1px solid #ffffff40}.cp-dots i.d{background:#5fd39a;border-color:#5fd39a}.cp-dots i.c{background:#F3D494;border-color:#F3D494;box-shadow:0 0 0 3px rgba(243,212,148,.25)}
.cp-pfend{font-size:14px;color:#ffe7b0;background:rgba(95,211,154,.12);border:1px solid rgba(95,211,154,.45);border-radius:9px;padding:6px 10px;margin-bottom:6px;line-height:1.5}.cp-pfend b{color:#7fe3b0}
.sheet.camp .cp.pfq .cp-ft2{position:static;margin:8px 0 0;padding:0 0 env(safe-area-inset-bottom);background:none}
.cp.lean .cp-hd small{display:none}.cp.lean .cp-hd{margin-bottom:2px}
@media (orientation:landscape) and (max-height:500px){.sheet.camp .cp.cards .cp-ft2{position:static;margin:8px 0 0;padding:0;background:none}}
/* 11-25 老闆（手機直拿「字再大一點」）：題卡字放大後，先答題的題目畫面面板可以長到頂列下緣；矮螢幕（≤700 高）第 2 題起收起「備戰營地」標題（「備戰答題 N／M」還在）、提示列變薄，320×568 四個選項不用捲 */
@media (max-width:700px) and (orientation:portrait){.sheet.camp:has(.cp.pfq){max-height:calc(100dvh - 44px)}}
@media (max-width:700px) and (orientation:portrait) and (max-height:700px){.sheet.camp:has(.cp.pfq){padding-top:10px}.cp.pfq.lean .cp-tt{display:none}.cp.pfq.lean .cp-hd{margin:0}.cp.pfq .cp-pf{margin:0 0 4px}.cp.pfq .cp-note{margin-bottom:5px;padding:3px 8px;font-size:12.5px}.sheet.camp .cp.pfq .cp-ft2{margin-top:6px}}
.cp-btn.sm{min-height:44px;padding:0 14px;font-size:13px;opacity:.85;margin-right:auto}.cp-must{margin-right:auto;font-size:12px;color:#a9b6c9;align-self:center}
.cp-note{font-size:13px;color:#cfdcf0;background:rgba(225,184,106,.10);border:1px solid rgba(225,184,106,.35);border-radius:9px;padding:5px 9px;margin-bottom:8px;line-height:1.45}
.cp-note.rev{color:#ffe2a0;background:rgba(224,86,106,.16);border-color:rgba(224,86,106,.55)}
.cp-top{font-size:14px;font-weight:700;color:#ffe9a8;margin:2px 0}
.cp-top .ok{color:#7fe3b0;font-weight:900}
.cp-top .bad{color:#ffb0b0;font-weight:900}
.cp-res{margin-top:8px;font-size:14px;line-height:1.6;background:#0a1222;border:1px solid #22344a;border-radius:10px;padding:7px 10px}
.cp-res:empty{display:none}
.cp-res b{color:#F3D494}
.cp-res .why{color:#ffd2b0}
.cp-res .ok{color:#7fe3b0;font-weight:900}
.cp-res .bad{color:#ffb0b0;font-weight:900}
.cp-timer{height:6px;border-radius:3px;background:#ffffff1a;overflow:hidden;margin:2px 0 8px}
.cp-timer i{display:block;height:100%;background:#E1B86A;width:100%}
.cp-pick{font-size:14px;font-weight:800;color:#F3D494;margin:6px 0 6px;text-align:center;letter-spacing:1px}
.cp-cards{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:8px;perspective:900px;margin-bottom:6px}
.cp-card{position:relative;border:0;padding:0;background:none;min-height:168px;text-align:center;color:#eef2fa;border-radius:12px}
.cp-in{position:absolute;inset:0;transform-style:preserve-3d;animation:cpFlip .62s cubic-bezier(.3,1.4,.5,1) both;animation-delay:var(--d,0ms)}
.cp-back,.cp-face{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.cp-back{transform:rotateY(180deg);background:radial-gradient(circle at 50% 45%,#3a4f78 0,#1b2740 60%,#0f1626);border:2px solid #8a6a3a;box-shadow:inset 0 0 0 3px #0c1122,inset 0 0 0 4px rgba(243,212,148,.45)}
.cp-back::after{content:"";position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border:2px solid rgba(243,212,148,.6);transform:rotate(45deg);border-radius:6px}
.cp-face{display:flex;flex-direction:column;align-items:center;gap:3px;padding:16px 6px 7px;background:linear-gradient(#24364f,#152236);border:2px solid #6c8296;box-shadow:inset 0 3px 0 var(--fc,#7fb3d8)}
.cp-card.r-rare .cp-face{border-color:#6ac8ff;background:linear-gradient(#22406a,#14243e);box-shadow:inset 0 3px 0 var(--fc),0 0 12px rgba(106,200,255,.45)}
.cp-card.r-legend .cp-face{border-color:#F3D494;background:linear-gradient(#4a3a1e,#251a10 70%);box-shadow:inset 0 3px 0 var(--fc),0 0 16px rgba(243,212,148,.6)}
.cp-card.r-legend .cp-face::after{content:"";position:absolute;inset:0;border-radius:10px;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,240,190,.35) 45%,transparent 60%);background-size:250% 100%;animation:cpShine 2.4s linear infinite}
.cp-rar{position:absolute;top:-1px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:900;padding:0 7px;border-radius:0 0 7px 7px;background:#6c8296;color:#0c1122;letter-spacing:1px}
.cp-card.r-rare .cp-rar{background:#6ac8ff}
.cp-card.r-legend .cp-rar{background:linear-gradient(#ffe9a8,#E1B86A)}
.cp-ic{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(#ffffff22,#0000);margin-top:2px}
.cp-ic svg{width:34px;height:34px}
.cp-nm{font-size:14.5px;font-weight:900;color:#fff;line-height:1.2}
.cp-ds{font-size:12px;color:#d6e2f2;line-height:1.35;flex:1;text-wrap:balance}
.cp-ft{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}
.cp-ft i{font-style:normal;font-size:12px;color:#0c1122;background:var(--fc,#7fb3d8);border-radius:6px;padding:0 5px;font-weight:800}
.cp-ft i.d{background:#ffffff26;color:#cfdcf0}
.cp-card:not(:disabled):active .cp-face{transform:scale(.97)}
.cp-card.art{min-height:0;display:flex;flex-direction:column;gap:3px}
.cp-card.art .cp-in{position:relative;inset:auto;display:block;width:100%;aspect-ratio:60/84}
.cp-card.art .cp-back,.cp-card.art .cp-face{background:none;border:0;box-shadow:none;padding:0;display:block}
.cp-card.art .cp-face::after{display:none}
.cp-cv{position:absolute;inset:0;width:100%;height:100%;box-shadow:none;border-radius:0;touch-action:auto}
.cp-card.art .cp-nm{position:absolute;left:8%;right:8%;top:62.6%;height:12%;display:flex;align-items:center;justify-content:center;font-size:clamp(12px,3.4vw,15px);text-shadow:0 1px 0 #0c1122,0 0 3px #0c1122;white-space:nowrap;overflow:hidden}
.cp-card.art .cp-ds{position:absolute;left:11%;right:11%;top:77%;height:15%;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1.2;color:#e8eef6;text-wrap:balance}
.cp-cap{font-size:12px;color:#cfdcf0;font-weight:700;text-align:center;line-height:1.3;text-wrap:balance}
.cp-card.art.chosen .cp-face{outline:none}
.cp-card.art.chosen .cp-cap{color:#7fe3b0}
.cp-card.art.faded{opacity:.55}
.cp-card.chosen .cp-face{outline:3px solid #5fd39a;outline-offset:2px}
.cp-card.faded{opacity:.3}
.cp-held{margin-top:8px;border-top:1px solid rgba(225,184,106,.25);padding-top:6px;font-size:12px;color:#a9b9d0}
.cp-held b{color:#cfdcf0}
.cp-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.cp-chip{display:inline-flex;align-items:center;gap:3px;border-radius:8px;padding:2px 7px;background:#1b2a40;border:1px solid var(--fc,#4b6478);color:#eef2fa;font-size:12px}
.cp-chip small{color:#8ea3c0}
.cp-duo{color:#ffe2a0;margin-top:3px}
.cp-ft2{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap}
/* 11-24 UI/UX 流程 P1-3：答完題後的主要按鈕（回去佈陣／看增益卡）固定在面板底部，手機不用往下滑 */
.sheet.camp .cp-ft2{position:sticky;bottom:calc(-14px - env(safe-area-inset-bottom,0px));z-index:3;margin:10px -14px calc(-14px - env(safe-area-inset-bottom));padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(#0f182d00,#0f182df2 30%);}
.cp-btn{border:1px solid #4b6478;background:none;color:#cfdcf0;border-radius:11px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:700}
.cp-btn.main{border:0;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;flex:1 1 auto}
.cp-btn:disabled{opacity:.4}
@media (orientation:landscape) and (max-height:500px){.sheet.camp{max-height:none}
  .cp-hd{margin-bottom:4px}.cp-tt b{font-size:17px}
  .cp-stats{display:flex;gap:4px;margin-bottom:4px}.cp-st{flex:1;flex-direction:row;justify-content:center;gap:4px;padding:2px 4px;font-size:12px}.cp-st svg{width:15px;height:15px}.cp-st b{font-size:15px}
  .cp-run{display:none}.cp-fc{padding:3px 8px;margin-bottom:4px}.cp-fc h4{margin:0}.cp-weak{display:none}.cp-foe canvas{width:22px;height:22px}.cp-note{margin-bottom:4px;padding:3px 8px}}
.cp-dtrow{display:flex;justify-content:center;margin:-2px 0 4px}
.cp-dt{min-height:44px;padding:4px 14px;font-size:13px;border-style:dashed}
.cp-card.art .cp-ds{font-size:12px;line-height:1.15;top:76%;height:17%}
.cp-ft i,.cp-rar,.cp-cap{font-size:12px}.cp-st{font-size:12px}.cp-foe small,.cp-fc h4 small{font-size:12px}
@media (min-width:900px) and (min-height:560px){.sheet.camp{max-height:none}}
@keyframes cpFlip{0%{transform:rotateY(180deg) scale(.85)}60%{transform:rotateY(-12deg) scale(1.03)}100%{transform:rotateY(0) scale(1)}}
@keyframes cpShine{0%{background-position:150% 0}100%{background-position:-100% 0}}
@keyframes cpPop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}
.cp-st b.pop{animation:cpPop .35s ease-out}
@media (max-width:360px){.cp-tt b{font-size:18px;letter-spacing:1px}.cp-st b{font-size:17px}.cp-card{min-height:158px}.cp-nm{font-size:13px}.cp-ds{font-size:12px;text-wrap:balance}.cp-cards{gap:5px}.cp-face{padding:15px 3px 6px}}
@media (max-height:720px){.cp-stats{margin-bottom:6px}.cp-st{padding:4px 2px}.cp-fc{margin-bottom:6px;padding:5px 8px}}
@media (prefers-reduced-motion:reduce){.cp-in{animation:none}.cp-card.r-legend .cp-face::after{animation:none}.cp-st b.pop{animation:none}}`;
  document.head.appendChild(css);

  const SV = b => '<svg viewBox="0 0 24 24" aria-hidden="true">' + b + '</svg>';
  const ICON = {
    snow: SV('<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="#0c1122" stroke-width="3.4" stroke-linecap="round"/><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="#bfe6ff" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2" fill="none" stroke="#bfe6ff" stroke-width="1.6" stroke-linecap="round"/>'),
    kill: SV('<path d="M5 19L17 7M8 5l11 11" stroke="#0c1122" stroke-width="3.4" stroke-linecap="round"/><path d="M5 19L17 7M8 5l11 11" stroke="#e8f0f8" stroke-width="1.6" stroke-linecap="round"/><path d="M15 5l4 0 0 4" fill="none" stroke="#E1B86A" stroke-width="2" stroke-linecap="round"/>'),
    leak: SV('<path d="M4 20V9l3 2V7l3 2V5l2 2 2-2v4l3-2v4l3-2v11z" fill="#8a96a8" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 20v-5h2v5" fill="#1a1410"/>'),
    q: SV('<path d="M12 6.5c-2.5-1.8-5.5-2-8.5-1.2v13c3-.8 6-.6 8.5 1.2 2.5-1.8 5.5-2 8.5-1.2v-13c-3-.8-6-.6-8.5 1.2z" fill="#f3e6c6" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6.5v13" stroke="#8a6a3a" stroke-width="1.3"/>'),
    bolt: SV('<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill="#ffd75e" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/>'),
    flag: SV('<path d="M6 21V3" stroke="#0c1122" stroke-width="2.4"/><path d="M6 4c4-2 7 2 12 0v9c-5 2-8-2-12 0z" fill="#e0566a" stroke="#0c1122" stroke-width="1.5" stroke-linejoin="round"/>')
  };
  const FAC0 = { guard: { name: "守護", color: "#7fb3d8" }, flame: { name: "烈焰", color: "#e0704a" }, thunder: { name: "雷鳴", color: "#f2c14e" }, frost: { name: "冰霜", color: "#9bd4ff" } };
  const RAR0 = { common: "普通", rare: "稀有", legend: "傳說" };
  const D = () => TG.DATA_CARDS || null;
  const fac = f => (D() && D().factions && D().factions[f]) || FAC0[f] || { name: "中立", color: "#a9b9d0" };
  const rarName = r => (D() && D().rarity && D().rarity[r] && D().rarity[r].name) || RAR0[r] || "普通";
  const cardById = id => ((D() && D().cards) || []).find(c => c.id === id) || null;
  function facIcon(f) {
    if (f === "frost") return ICON.snow;
    if (f === "flame") return U.uic("flame", false) || ICON.bolt;
    if (f === "thunder") return ICON.bolt;
    return U.uic("shield", false);
  }
  function cardIcon(c) {
    try { if (window.ART && typeof ART.cardIcon === "function") { const s = ART.cardIcon(c.icon || c.id, c); if (s) return s; } } catch (e) {}
    const s = c.icon ? U.uic(c.icon, false) : "";
    return s || facIcon(c.faction);
  }
  function durText(d, left) {
    if (left != null && typeof left === "number" && isFinite(left)) return left >= 99 ? "本關" : "剩 " + left + " 波";
    if (d === "now") return "立刻";
    if (d === "wave") return "本波";
    if (d === "stage") return "本關";
    if (d && typeof d === "object" && d.waves) return d.waves + " 波";
    return "";
  }
  // 弱點表（依怪物資料推）：一行一個重點
  function weakOf(t) {
    const e = TG.ENEMIES[t] || {}, m = e.mech;
    // 11-25：先答題玩法守城不出題 → 區域魔王不寫「答對題目」；關卡魔王寫新規則（走到城門會停下來敲，一定要打倒）
    const pf = !!(TG.pfOn && TG.pfOn(U.G));
    if (m === "be") return pf ? "Be 巨人很硬：走到城門會停下來敲，路的後段多蓋塔" : "Be 巨人：點對 am／is／are 的小怪";
    if (m === "seal") return pf ? "時光樹妖很硬：走到城門會停下來敲，路的後段多蓋塔" : "時光樹妖會封塔：答對題目解封";
    if (m === "hydra") return pf ? "九頭蛇長新頭：過幾秒自己枯掉，有能量可以點牠砍" : "九頭蛇長新頭：答對片語題";
    if (m === "lich") return pf ? "冰霜巫妖的冰盾：撐幾秒就被塔磨掉" : "冰霜巫妖的冰盾：排對句子才打得破";
    if (e.sb) return e.name + (e.fly ? "會飛（弓箭塔、魔法塔）" : "") + "：走到城門會停下來敲，一定要打倒";
    if (m === "dragon") return "終極魔龍會輪流用各種魔王技";
    if (e.fly) return e.name + "會飛：弓箭塔、魔法塔才打得到";
    if (e.shield) return e.name + "：點牠拼單字破盾";
    if (e.quiz === "fix") return e.name + "：點牠找錯字，直接打倒";
    if (e.invis) return e.name + "會隱形：答對題目讓牠現形";
    if (e.healer) return e.name + "會補血：先集中火力打牠";
    if (e.split) return e.name + "會分裂：用範圍攻擊的塔";
    if (e.armor && !e.boss) return e.name + "護甲厚：砲塔打得穿";
    if (e.spd >= 36) return e.name + "跑很快：冰霜塔讓牠變慢";
    return "";
  }

  let st = null, timer = 0;
  const camp = { ver: 1, enabled: true, open, close, closed, isOpen, render, key, bot, state: () => st };
  U.camp = camp;
  function isOpen() { return !!(st && st.G === U.G && U.G && !U.G.over); }

  function open(G, run) {
    if (!G || G.over || !run) return false;
    const kind = typeof TG.campKind === "function" ? TG.campKind(G) : "quick";   // 先問（campKind 會看 campDue），再標記這個空檔已開過
    (TG.campMark || TG.prepMark)(G);
    if (!kind) return true;   // 這個空檔不開營地
    // 「只出 1 題」的波是自願題：題量用完（TG.qCanAsk(s,"fill","prep") 為 false）就不開，直接回去佈陣（抽卡的旗子波照開）
    // 先備戰再守城（2026-11-25）：每波開打前連續答一輪（TG.pfCount 題，src "prep"），旗子波答完這輪再答抽卡題；守城時不出題
    const pfN = TG.pfOn && TG.pfOn(G) && typeof TG.pfCount === "function" ? TG.pfCount(G) : 0;
    if (kind === "quick" && ((TG.pfOn && TG.pfOn(G)) ? pfN <= 0 : (TG.qCanAsk && !TG.qCanAsk(G, "fill", "prep")))) { (run.campLog || (run.campLog = [])).push({ w: G.wave, kind, noBudget: true }); return true; }
    const choiceable = q => !!q && typeof q.q === "string" && q.q.includes("___") && Array.isArray(q.o) && q.o.length >= 2 && (!TG.kindOk || TG.kindOk(q, "camp"));
    let rev = null;
    for (const q of (run.waveWrong || []).slice().reverse()) if (choiceable(q)) { rev = q; break; }
    run.waveWrong = [];
    const sn = run.wsnap, w = G.wave;
    // 第二輪 P2（11-24 小安）：每關第一個營地的戰果從開局算起（原本只算「這一波開打後」，開打前答的題、第 1 波前的漏怪都不見，畫面全是 0）
    const first = !run.campStatsN; run.campStatsN = (run.campStatsN || 0) + (w > 0 ? 1 : 0);
    const b0 = first ? { kills: 0, lives: run.lives0 != null ? run.lives0 : (G.livesMax || G.lives0 || (sn ? sn.lives : G.lives)), qT: 0, qR: 0, e: 0 } : sn;
    const stats = b0 && w > 0 ? { kills: Math.max(0, G.kills - b0.kills), leaks: Math.max(0, b0.lives - G.lives), q: run.qTotal - b0.qT, ok: run.qRight - b0.qR, e: Math.max(0, (run.eGot || 0) - b0.e), first } : null;
    st = { G, run, kind, w, stats, rev, phase: "ask", reroll: false, rerollUsed: false, draws: null, picked: null, q: null, animStats: true, flip: 0, skipped: false,
      pf: pfN > 0 ? { n: pfN, i: 0, ok: 0, ok2: 0, ans: 0, end: false, done: false, extraUsed: false, e0: (G.energy || 0) + (G.pfStore || 0) } : null };
    // 11-25 試玩：先答題時戰果的「答題／獲得能量」改看上一輪備戰（答題都在營地裡，波中的增量永遠是 0）
    if (st.pf && stats && run.pfLast) { stats.q = run.pfLast.n; stats.ok = run.pfLast.ok; stats.e = run.pfLast.e; }
    newQuestion();
    render();
    return true;
  }
  const pfPrep = () => !!(st && st.pf && !st.reroll && st.pf.i < st.pf.n);   // 現在這題是備戰輪的題（不是抽卡題）
  function newQuestion() {
    const G = st.G, revenge = !st.reroll && !!st.rev;
    if (st.pf) st.rev = null;   // 一輪多題：復仇題只出第一題
    let q = revenge ? st.rev : null;
    // 第二次回補（題庫規格 §5.3）：復仇題改出同一子規則、不同題組的姊妹題（第④組 TG.qSibling；舊題沒有 sk 就照原題）
    // 11-25：姊妹題排除本局出過的題與題組；找不到就出原題（原題這局出過也不再出，改一般抽題）；用了要記進本局記憶，之後一般抽題才不會再抽到
    const R = st.run, mem = TG.qMem ? TG.qMem(R.recent) : null;
    if (q && TG.qSibling) { let sib = null; try { sib = TG.qSibling(q, U.pool || null, U.rng, { use: "camp", recent: R.recent, mem }); } catch (e) {} if (sib && Array.isArray(sib.o)) q = sib; else if ((R.recent || []).includes(q.id)) q = null; }
    if (q) { if (R.recent) { R.recent.push(q.id); if (R.recent.length > 40) R.recent.shift(); } if (TG.qMark) TG.qMark(mem, q); }
    if (!q) { try { q = U.pickQ({ use: "camp", lv: G.stage ? null : Math.min(5, 1 + Math.floor(G.wave / 3)) }); } catch (e) { console.error("[camp pick]", e); } }
    const tl = TG.prepTime ? TG.prepTime(G) : 0;
    st.q = q ? { q, opts: TG.shuffleOptions(q, U.rng), gone: [], tried: false, firstWrong: null, done: false, ok: null, revenge, t0: performance.now(), T: tl > 0 ? tl : Infinity, left: tl > 0 ? tl : Infinity, res: "" } : null;
    st.phase = q ? "ask" : (st.kind === "camp" ? "cards" : "done");
    if (!q && st.kind === "camp") drawCards(false);
  }
  function drawCards(ok, reroll) {
    const G = st.G, C = TG.CAMP || { pick: { ok: 3, wrong: 2 } }, M = mdata();
    const o = { reroll: !!reroll, exclude: reroll && st.draws ? st.draws.map(c => c.id) : [] };
    if (!reroll && !M.seen) o.tutorial = true;   // 存檔第一次進營地：引擎給固定的教學三張（cards_v3.json rules.draw.tutorial）
    let d = [];
    try { d = typeof TG.campDraw === "function" ? TG.campDraw(G, ok ? C.pick.ok : C.pick.wrong, U.rng, o) || [] : []; } catch (e) { console.error("[camp draw]", e); d = []; }
    if (d.length && !reroll) { M.seen = 1; }
    st.draws = d.filter(Boolean); st.flip++;
    st.phase = st.draws.length ? "cards" : "done";
  }

  // ───── 畫面
  function render() {
    if (!st) return;
    const G = st.G;
    // 11-25 試玩（320 第 4 個選項、橫拿第 3～4 個選項被底部按鈕蓋住）：先答題的題目畫面按鈕列不浮在上面，排在選項後面；抽卡畫面加 cards 樣式
    const pfq = !!(st.pf && st.phase === "ask" && (pfPrep() || st.lastPf));
    let h = '<div class="cp' + (pfq ? ' pfq' : '') + (st.phase === "cards" ? ' cards' : '') + (st.pf && st.pf.i > 0 && st.phase === "ask" ? ' lean' : '') + '">';
    const flag = st.kind === "camp";
    h += '<div class="cp-hd"><div class="cp-tt"><b>備戰營地</b><small>' + (st.w > 0 ? (st.stats && st.stats.first && st.w > 1 ? '開局到第 ' + st.w + ' 波' : '第 ' + st.w + ' 波') + '守住了' : '開戰前準備') + '・遊戲暫停' + (st.q && isFinite(st.q.T) && st.phase === "ask" ? '・每題 ' + st.q.T + ' 秒' : '') + '</small></div>' +
      (flag ? '<span class="cp-flag">' + ICON.flag + '大波來襲・抽增益卡</span>' : '') + '</div>';
    const lean = !!(st.pf && st.pf.i > 0 && st.phase === "ask");   // 備戰輪第 2 題起只留題目（手機一屏看得完），戰果、預告、持有卡第一題看過了
    if (st.stats && !lean) {
      const s = st.stats;
      h += '<div class="cp-stats">' + tile(ICON.kill, s.kills, "擊倒", "good") + tile(ICON.leak, s.leaks, "漏怪", s.leaks ? "bad" : "") + tile(ICON.q, s.q, "答題" + (s.q ? "（對 " + s.ok + "）" : ""), "") + tile(ICON.bolt, s.e, "獲得能量", "good") + '</div>';
    }
    const run = st.run, held = heldCards();
    if (run.qTotal && !(st.stats && st.stats.first) && !lean) h += '<div class="cp-run">本關累計：答對 <b>' + run.qRight + '</b> 題・能量 <b>+' + Math.round(run.eGot || 0) + '</b>' + (held.length ? '・增益卡 <b>' + held.length + '</b> 張' : '') + '</div>';
    if (!lean) h += forecastHtml(G);
    if (st.phase === "ask" && st.q) h += askHtml();
    else if (st.phase === "cards") h += cardsHtml();
    else h += doneHtml();
    if (!lean) h += heldHtml(held);
    h += footHtml() + '</div>';
    U.openSheet("camp", h);
    const sheet = document.getElementById("sheet");
    sheet.classList.add("camp");
    if (U.paintIcons) U.paintIcons(sheet);
    if (st.phase === "ask" && st.q && st.qcard) {
      const c = st.qcard; c.bind(sheet.querySelector(".cp-q"), i => pick(i));
      if (st.q.done) c.reveal(st.q.pickI);
      if (st.q.res) c.say(st.q.res, true);
    }
    sheet.querySelectorAll("[data-cpc]").forEach(b => b.addEventListener("click", () => choose(+b.dataset.cpc)));
    if (st.phase === "cards") {
      // 保險：翻牌動畫若被瀏覽器暫停（背景分頁、省電、捲動容器外），1.2 秒後直接停在正面，卡片一定看得到
      setTimeout(() => sheet.querySelectorAll(".cp-in").forEach(x => { if (x.isConnected) x.style.animation = "none"; }), 1200);
      paintCards(sheet); const cs = sheet.querySelector(".cp-cards"); if (cs && !st.picked) try { cs.scrollIntoView({ block: "nearest" }); } catch (e) {} }
    sheet.querySelectorAll("[data-cp]").forEach(b => b.addEventListener("click", () => act(b.dataset.cp)));
    if (st.animStats) { st.animStats = false; countUp(sheet); }
    // 11-24 UI/UX 流程 P1-3：答完題（解析出來了）就把主要按鈕捲進畫面；電腦按 Enter／空白鍵＝按主要按鈕
    const mb = sheet.querySelector(".cp-ft2 .cp-btn.main");
    if (mb && st.phase === "ask" && st.q && st.q.done) { try { mb.scrollIntoView({ block: "nearest" }); mb.focus({ preventScroll: true }); } catch (e) {} }
    // 第二輪 P1-8（11-24 小安）：橫向手機一屏放不下，題目一出來就捲到題目（選項才看得到，不用孩子自己滑）
    if (LANDQ.matches && st.phase === "ask" && st.q && !st.q.done) { const n = sheet.querySelector(".cp-pf") || sheet.querySelector(".cp-note") || sheet.querySelector(".cp-q"); if (n) { const sr = sheet.getBoundingClientRect(), nr = n.getBoundingClientRect(); sheet.scrollTop += Math.max(0, nr.top - sr.top - 6); } }   // 11-25：先答題捲到進度列（原本捲到題目，進度點被捲出畫面）
    tick();
  }
  function tile(ic, v, lbl, cls) { return '<div class="cp-st ' + cls + '">' + ic + '<b data-to="' + (v | 0) + '">' + (v | 0) + '</b>' + esc(lbl) + '</div>'; }
  function countUp(root) {
    const els = [...root.querySelectorAll(".cp-st b[data-to]")]; if (!els.length || RM.matches) return;
    const t0 = performance.now(), T = 650;
    els.forEach(b => b.textContent = "0");
    // 動畫被瀏覽器暫停（背景分頁、省電）時數字會停在 0（11-24 試玩看到「擊倒 0、漏怪 0」）→ 1 秒後一定補成最後的數字
    setTimeout(() => els.forEach(b => { if (b.isConnected) b.textContent = String(+b.dataset.to); }), 1000);
    const step = now => {
      const k = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - k, 3);
      for (const b of els) { if (!b.isConnected) return; b.textContent = String(Math.round(+b.dataset.to * e)); }
      if (k < 1) requestAnimationFrame(step); else els.forEach(b => { if (+b.dataset.to > 0) b.classList.add("pop"); });
    };
    requestAnimationFrame(step);
  }
  function forecastHtml(G) {
    let f = null; try { f = U.waveForecast ? U.waveForecast() : null; } catch (e) { f = null; }
    if (!f) return '<div class="cp-fc"><h4>' + (U.uic("castle", false) || "") + '撐過下一波就過關！</h4></div>';
    const list = f.list || [];
    const foes = list.map(([t, n]) => { const E = TG.ENEMIES[t] || {}; return '<span class="cp-foe' + (E.boss ? ' boss' : '') + '">' + (U.icHtml ? U.icHtml("enemy", t, E.boss ? 1 : 0, 30, 30) : "") + '×' + n + '<small>' + esc(E.name || t) + '</small></span>'; }).join("");
    const weak = []; for (const [t] of list) { const w = weakOf(t); if (w && !weak.includes(w)) weak.push(w); }
    weak.sort((a, b) => (/巨人|樹妖|九頭蛇|巫妖|魔龍/.test(b) ? 1 : 0) - (/巨人|樹妖|九頭蛇|巫妖|魔龍/.test(a) ? 1 : 0));
    return '<div class="cp-fc"><h4>' + (U.uic("wave", false) || "") + '下一波<small>第 ' + f.w + (G.maxWave ? '／' + G.maxWave : '') + ' 波・預估</small></h4><div class="cp-foes">' + (foes || '<small>—</small>') + '</div>' +
      (weak.length ? '<div class="cp-weak">' + weak.slice(0, 3).map(w => '<span>' + esc(w) + '</span>').join("") + '</div>' : '') + '</div>';
  }
  // 營地題的入口：抽卡題 camp、重抽 campReroll、「只出 1 題」的波＝prep（第 1 組：照常給能量；抽卡題的獎勵是卡、不給能量）
  function qsrc() { return st.reroll ? "campReroll" : pfPrep() ? "prep" : st.kind === "camp" ? "camp" : "prep"; }
  function gainText() { let n = 0; try { n = TG.energyGain(st.G, true, { kind: "mcq", src: qsrc(), try: 1, sec: 1, revenge: st.q && st.q.revenge, qk: "fill" }); } catch (e) {} return n; }
  function askHtml() {
    const Q = st.q, C = TG.CAMP || { pick: { ok: 3, wrong: 2 } };
    let note;
    if (st.reroll) note = '<div class="cp-note">重抽題：答對換一組新卡；答錯保留原本的卡</div>';
    else if (st.pf && (pfPrep() || (st.lastPf && Q.done))) {   // 11-25 試玩：答完時標題停在這一題（原本先跳下一號）、最後一題也留著進度
      const P = st.pf, n = gainText(), cur = Q.done ? P.i - 1 : P.i;
      note = '<div class="cp-pf"><b>備戰答題 ' + (cur + 1) + '／' + P.n + '</b><span class="cp-dots">' + Array.from({ length: P.n }, (x, k) => '<i class="' + (k < cur || (k === cur && Q.done) ? 'd' : k === cur ? 'c' : '') + '"></i>').join("") + '</span></div>' +
        (Q.done ? '' : '<div class="cp-note' + (Q.revenge ? ' rev' : '') + '">' + (Q.revenge ? '復仇題：上一波答錯的這題，' : '') + '答對' + (n > 0 ? '能量 +' + n : '有獎勵') + (cur === 0 && !P.extraUsed ? '・答完 ' + P.n + ' 題就開打，守城時不會跳題目' : '') + '</div>'); }
    else if (st.kind === "camp") note = '<div class="cp-note' + (Q.revenge ? ' rev' : '') + '">' + (Q.revenge ? '復仇題（上一波答錯的這題）・' : '') + '答對從 <b>' + C.pick.ok + '</b> 張增益卡選 1 張；答錯也有 ' + C.pick.wrong + ' 張可選</div>';
    else { const n = gainText(); note = '<div class="cp-note' + (Q.revenge ? ' rev' : '') + '">' + (Q.revenge ? '復仇題：上一波答錯的這題，' : '') + '答對' + (n > 0 ? '能量 +' + n : '有獎勵') + '，戰鬥中點塔就能升級</div>'; }
    const card = U.qcard.render(Q.q, { compact: false, opts: Q.opts, gone: Q.gone, keys: true });   // 題卡（第 3 組），有自己的結果區
    st.qcard = card;
    return note + (isFinite(Q.T) ? '<div class="cp-timer"><i id="cpBar" style="width:' + Math.max(0, Q.left / Q.T * 100) + '%"></i></div>' : '') + '<div class="cp-q">' + card.html + '</div>';
  }
  const hasArt = () => !!(window.ART && typeof ART.card === "function");
  // 第二輪 P1-18（11-24 小美）：卡面改寫「看得到的效果」（cards_v3.json 的 plain：「塔打得更快」「怪走慢一點」），數值（desc）收進「看詳細數值」
  //   派別、組合卡到第 2 區才顯示（第 1 區孩子只要看懂這張卡會讓什麼變好）
  function plainOf(c) { const src = cardById(c.id) || {}; const p = c.evolved && src.evo && src.evo.plain ? src.evo.plain : src.plain; return p || c.desc || ""; }
  const showFaction = () => { const G = st && st.G; return !G || !G.stage || (G.stage.r | 0) >= 1; };
  function cardHtml(c, i) {
    const f = fac(c.faction), r = c.rarity || "common", detail = !!st.detail, fOn = showFaction();
    const chosen = st.picked && st.picked.id === c.id, faded = st.picked && !chosen;
    const face = detail ? (c.desc || "") : plainOf(c);
    const nw = t => '<span style="white-space:nowrap">' + t + '</span>';   // 11-24：320 寬斷成「本／波」→ 每一段不拆開，只在「・」之間換行
    const tags = nw(esc(rarName(r))) + (fOn ? "・" + nw(esc(c.duo ? fac(c.duo[0]).name + "＋" + fac(c.duo[1]).name : f.name)) : "") + (durText(c.dur) ? "・" + nw(esc(durText(c.dur))) : "");
    const open = '<button class="cp-card r-' + esc(r) + (chosen ? ' chosen' : '') + (faded ? ' faded' : '') + (hasArt() ? ' art' : '') + '" data-cpc="' + i + '"' + (st.picked ? ' disabled' : '') + ' style="--fc:' + esc(f.color) + ';--d:' + (i * 130) + 'ms" aria-label="' + esc(rarName(r) + "：" + (c.name || "") + "，" + plainOf(c)) + '">' +
      '<span class="cp-in"' + (st.flipDone ? ' style="animation:none"' : '') + '>';
    // 第 7 組卡面（ART.card：框、稀有度寶石、派系徽記、圖示、名稱緞帶）＋HTML 疊字；沒有 ART.card 時用本檔的簡易卡面
    if (hasArt()) return open + '<span class="cp-back"><canvas class="cp-cv" data-cpart="' + i + '" data-back="1"></canvas></span><span class="cp-face"><canvas class="cp-cv" data-cpart="' + i + '"></canvas>' +
      '<b class="cp-nm">' + esc(c.name || "增益卡") + '</b><span class="cp-ds' + (detail ? ' num' : '') + '">' + esc(face) + '</span></span></span><span class="cp-cap">' + tags + '</span></button>';
    return open + '<span class="cp-back"></span><span class="cp-face"><span class="cp-rar">' + esc(rarName(r)) + '</span><span class="cp-ic">' + cardIcon(c) + '</span><b class="cp-nm">' + esc(c.name || "增益卡") + '</b><span class="cp-ds">' + esc(face) + '</span>' +
      '<span class="cp-ft">' + (fOn ? '<i>' + esc(c.duo ? fac(c.duo[0]).name + "＋" + fac(c.duo[1]).name : f.name) + '</i>' : '') + (durText(c.dur) ? '<i class="d">' + esc(durText(c.dur)) + '</i>' : '') + '</span></span></span></button>';
  }
  // 卡面畫進 canvas；傳說卡每幀換 t 重畫流光（靜態部分 ART 有快取）
  let artRaf = 0;
  function paintCards(root) {
    if (!hasArt() || !st || !st.draws) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), list = [];
    root.querySelectorAll("canvas[data-cpart]").forEach(cv => {
      const c = st.draws[+cv.dataset.cpart]; if (!c) return;
      const w = Math.max(40, Math.round(cv.clientWidth * dpr)), h = Math.round(w * 1.4);
      if (cv.width !== w) { cv.width = w; cv.height = h; }
      const o = { t: performance.now() / 1000, back: !!cv.dataset.back, sel: !!(st.picked && st.picked.id === c.id), dim: !!(st.picked && st.picked.id !== c.id) };
      try { ART.card(cv, c, o); } catch (e) { console.error("[camp card art]", e); }
      if (!o.back && c.rarity === "legend" && !o.dim) list.push([cv, c, o]);
      if (o.sel) list.push([cv, c, o]);
    });
    cancelAnimationFrame(artRaf);
    if (!list.length || RM.matches) return;
    const step = () => {
      if (!st || U.sheetMode !== "camp" || !list[0][0].isConnected) return;
      const t = performance.now() / 1000;
      for (const [cv, c, o] of list) { o.t = t; try { ART.card(cv, c, o); } catch (e) {} }
      artRaf = requestAnimationFrame(step);
    };
    artRaf = requestAnimationFrame(step);
  }
  function cardsHtml() {
    const n = st.draws.length;
    const msg = st.picked ? '拿到「' + esc(st.picked.name || "") + '」了！' : st.lastWrong ? (st.reroll ? '沒答對，保留原本的卡，' : '沒答對也有 ' + n + ' 張可選，') + '選 1 張' : '選 1 張增益卡';
    const html = '<div class="cp-pick">' + msg + '</div><div class="cp-cards" style="--n:' + n + '">' + st.draws.map(cardHtml).join("") + '</div>' +
      '<div class="cp-dtrow"><button class="cp-btn cp-dt" data-cp="detail" aria-pressed="' + !!st.detail + '">' + (st.detail ? '看白話說明' : '看詳細數值') + '</button></div>';
    st.flipDone = true;   // 之後重畫（暫停回來、選卡）不再翻牌
    return html;
  }
  function doneHtml() {
    if (st.q && st.q.done) return '<div class="cp-res">' + st.q.res + '</div>';
    return '<div class="cp-note">這次沒有題目可以出，直接回去佈陣吧！</div>';
  }
  function heldCards() { const G = st && st.G; return (G && G.cards && Array.isArray(G.cards.held)) ? G.cards.held : []; }
  function heldHtml(held) {
    const all = (D() && D().cards) || [];
    let duo = [];
    // 第二輪 P1-11（11-24 小華）：組合卡提示只列「有開放」的卡（TG.CARD_ON）；看「本關拿過」的卡（引擎 s.cards.taken，跟組合卡出現條件一樣），不是只看持有中；
    //   第 1 區不顯示（組合卡到第 2 區才介紹）；本關已經出過組合卡（每關 1 張）就不再提示
    const G = st && st.G, C = (G && G.cards) || {};
    if (all.length && showFaction() && !C.duoTaken) {
      const taken = new Set((Array.isArray(C.taken) ? C.taken : []).concat(held.map(h => h.id)));
      const on = id => !TG.CARD_ON || TG.CARD_ON.includes(id);
      for (const c of all) {
        if (!c.duo || !on(c.id) || taken.has(c.id) || !c.req || !Array.isArray(c.req.all) || !c.req.all.every(on)) continue;
        const miss = c.req.all.filter(id => !taken.has(id));
        if (miss.length && miss.length < c.req.all.length) duo.push('再拿「' + ((cardById(miss[0]) || {}).name || miss[0]) + '」，就可能出現組合卡「' + c.name + '」');
      }
    }
    if (!held.length && !duo.length) return "";
    return '<div class="cp-held"><b>持有中的增益卡</b>' + (held.length ? '<div class="cp-chips">' + held.map(h => { const c = cardById(h.id) || { name: h.id, faction: null }; const f = fac(c.faction); return '<span class="cp-chip" style="--fc:' + esc(f.color) + '">' + esc(c.name) + '<small>' + esc(durText(h.dur, h.left)) + '</small></span>'; }).join("") + '</div>' : '') +
      duo.slice(0, 2).map(t => '<div class="cp-duo">' + esc(t) + '</div>').join("") + '</div>';
  }
  function canReroll() {
    const C = TG.CAMP || {};
    return st.kind === "camp" && !st.picked && !st.rerollUsed && (C.reroll == null || C.reroll > 0) && (!TG.qCanAsk || TG.qCanAsk(st.G, "fill", "campReroll"));
  }
  // 「都不要」＝略過這一手（引擎 TG.campSkip：能量 +skipEnergy；沒抽卡就不能換能量，紅線 1）
  // 第二輪 P1-10（11-24 小明）：「都不要（能量 +2）」其實是存進能量存摺、之後答對才領（存滿每關上限就換金幣）→ 照實際寫
  function skipLabel() {
    const C = TG.CAMP || {}, v = C.skipEnergy; if (!v || typeof TG.campSkip !== "function") return "都不要";
    const G = st && st.G, cap = TG.CARD_BANK && TG.CARD_BANK.skipMax, got = cap != null && G ? Math.max(0, Math.min(v, cap - (G.skipBanked || 0))) : v;
    if (!TG.CARD_BANK) return "都不要（能量 +" + v + "）";
    return got > 0 ? "都不要（存 " + got + " 能量，答對再領）" : "都不要（+" + (v * (C.skipGold || 0)) + " 金幣）";
  }
  function footHtml() {
    let b = "";
    if (st.phase === "ask") {
      if (st.q && st.q.done && st.lastPf) b = pfPrep() ? '<button class="cp-btn main" data-cp="next">下一題（' + (st.pf.i + 1) + '／' + st.pf.n + '）</button>'
        : (canExtra() ? '<button class="cp-btn" data-cp="extra">再答 ' + TG.pfExtra(st.G) + ' 題（多拿能量）</button>' : '') + '<button class="cp-btn main" data-cp="next">' + (st.kind === "camp" ? "最後 1 題：抽增益卡" : closeLabel()) + '</button>';
      else if (st.q && st.q.done) b = '<button class="cp-btn main" data-cp="next">' + (st.kind === "camp" && st.draws && st.draws.length ? "看增益卡" : st.pf ? closeLabel() : "回去佈陣") + '</button>';
      else if (st.reroll) b = '<button class="cp-btn" data-cp="noReroll">不重抽了</button>';
      else if (pfPrep()) b = canPfSkip() ? '<button class="cp-btn sm" data-cp="skip">略過</button>' : '<span class="cp-must">這輪至少答 1 題</span>';   // 11-25 試玩：全部略過也能過關 → 每輪至少答 1 題；略過鈕改小、放左邊
      else b = '<button class="cp-btn" data-cp="skip">略過</button>';
    } else if (st.phase === "cards") {
      if (st.picked) b = '<button class="cp-btn main" data-cp="close">' + (st.pf ? closeLabel() : "回去佈陣") + '</button>';
      else b = (canReroll() ? '<button class="cp-btn" data-cp="reroll">重抽（再答 1 題）</button>' : '') + '<button class="cp-btn" data-cp="skip">' + skipLabel() + '</button>';
    } else b = '<button class="cp-btn main" data-cp="close">回去佈陣</button>';
    return '<div class="cp-ft2">' + b + '</div>';
  }

  // ───── 作答
  function pick(i) {
    if (!st || st.phase !== "ask" || !st.q || st.q.done) return;
    const Q = st.q, G = st.G;
    if (!Q.opts[i] || Q.gone.includes(i)) return;
    const ok = !!Q.opts[i].ok, c = st.qcard;
    const sc = !(st.run.heroic) && !(G.modes && G.modes.iron);
    if (!ok && !Q.tried && c && U.qcard.canRetry(c) && sc) {
      Q.tried = true; Q.firstWrong = i;
      c.mark(i, "gone"); Q.gone = c.gone.slice();
      if (isFinite(Q.T) && Q.left < 6) { Q.left = 6; if (Q.left > Q.T) Q.T = Q.left; }
      Q.res = U.qcard.retry(Q.q, Q.opts[i].t); c.say(Q.res, true);
      U.beep(260, .15, "triangle", .04);
      return;
    }
    finish(ok, i);
  }
  function finish(ok, i) {
    const Q = st.q, G = st.G, run = st.run; if (Q.done) return;
    Q.done = true; Q.ok = ok; Q.pickI = i;
    const retry = !!(ok && Q.tried), src = qsrc(), wasPf = pfPrep(); st.lastPf = wasPf;
    const info = U.ansInfo(Q.q, { kind: "mcq", src, try: Q.tried ? 2 : 1, sec: Math.round((performance.now() - Q.t0) / 100) / 10, retryOk: !!(ok && Q.tried) });
    if (Q.revenge) info.revenge = true;
    const e0 = G.energy || 0;
    G.retryNext = retry;
    try { TG.answerResult(G, ok, Object.assign({ retry }, info)); U.recordAnswer(Q.q, ok && !Q.tried, "choice", ok, info); }
    catch (e) { console.error("[camp answer]", e); }
    finally { G.retryNext = false; }
    const dE = (G.energy || 0) - e0;
    (run.campLog || (run.campLog = [])).push({ w: st.w, kind: st.kind, src, ok, try: Q.tried ? 2 : 1 });
    const pickT = i >= 0 ? Q.opts[i].t : null, firstT = Q.firstWrong != null ? Q.opts[Q.firstWrong].t : null;
    const top = t => '<div class="cp-top">' + t + '</div>';
    if (ok && !Q.tried) Q.res = top('<span class="ok">答對了！</span>' + (dE > 0 ? ' 能量 +' + dE : '')) + (Q.q.e ? U.qcard.explain(Q.q, null, { answer: false }) : '');
    else if (ok) Q.res = top('<span class="ok">第二次答對了！</span>' + (dE > 0 ? ' 能量 +' + dE : '') + '（這題會收進錯題本，之後再複習）') + U.qcard.explain(Q.q, firstT, { answer: false });
    else Q.res = top('<span class="bad">' + (i < 0 ? '時間到。' : '不對喔。') + '</span>') + U.qcard.explain(Q.q, pickT || firstT);
    if (wasPf) { pfStep(ok && !Q.tried, ok, true); Q.res = pfEndLine() + Q.res; render(); return; }
    if (st.kind === "camp") {
      if (st.reroll) { st.lastWrong = !ok; if (ok) drawCards(true, true); else st.phase = "cards"; }
      else { st.lastWrong = !ok; drawCards(ok); }
      st.flipDone = false;
      st.phase = "ask";   // 先看完解析，按「看增益卡」才翻牌（引擎沒給卡＝按鈕變「回去佈陣」）
    }
    render();
  }
  // 備戰輪往前一題；整輪答完：TG.pfRoundEnd（答對六成＝絕招加強 +1 次）
  // 11-25 試玩修正（老闆裁示）：每輪 3 題，答完可「再答 3 題」加碼一次；每輪至少答 1 題；離開這一輪時才結算（TG.pfRoundEnd 只呼叫一次）
  function pfStep(firstOk, anyOk, answered) {
    const P = st.pf; if (!P) return;
    P.i++; if (answered) P.ans++; if (firstOk) P.ok++; else if (anyOk) P.ok2++;
    if (P.i >= P.n) P.end = true;
  }
  const chargeNeed = P => Math.ceil(P.n * ((TG.PF && TG.PF.chargeRate) || 0.6));
  const canExtra = () => { const P = st && st.pf; return !!(P && P.end && !P.extraUsed && !P.done && TG.pfExtra && TG.pfExtra(st.G) > 0); };
  const canPfSkip = () => { const P = st.pf; return !!P && (P.ans >= 1 || P.n - P.i > 1); };
  const closeLabel = () => st.G.wave === 0 ? "去蓋塔，蓋好按開始" : "回去佈陣（快開打了）";   // 11-25 試玩：原本寫「開始守城」，第 1 波前其實還要自己按開始
  function pfFinish() {
    const P = st.pf; if (!P || P.done) return false;
    P.done = true; let charged = false;
    try { charged = !!(TG.pfRoundEnd && TG.pfRoundEnd(st.G, P.n, P.ok, P.ok + P.ok2)); } catch (e) { console.error("[camp pf]", e); }
    st.run.pfLast = { n: P.ans, ok: P.ok + P.ok2, e: Math.max(0, (st.G.energy || 0) + (st.G.pfStore || 0) - P.e0), charged };
    return charged;
  }
  function pfToast() { const L = st.run.pfLast; if (L && L.n) U.toast("這輪答對 " + L.ok + " 題" + (L.charged ? "：絕招會自動加強" : ""), { ms: 2200 }); }
  function pfEndLine() {
    const P = st.pf; if (!P || !P.end) return "";
    const ch = st.G.pfCharge | 0, sto = st.G.pfStore | 0, all = P.ok + P.ok2, will = P.ok >= chargeNeed(P);
    return '<div class="cp-pfend">這輪答對 <b>' + all + '</b> 題' + (P.ok2 ? '（第二次才答對 ' + P.ok2 + ' 題）' : '') +
      (will ? '・守城時放絕招會<b>自動加強</b>' + (ch ? '（已存 ' + ch + ' 次）' : '') : '・第一次就答對 ' + chargeNeed(P) + ' 題，絕招會自動加強' + (ch ? '（已存 ' + ch + ' 次）' : '')) +
      (sto > 0 ? '・能量條滿了，多的 ' + sto + ' 格先存著，用掉就自動補' : '') + (canExtra() ? '・想多拿能量可以再答 ' + TG.pfExtra(st.G) + ' 題' : '') + '</div>';
  }
  function act(k) {
    if (!st) return;
    // 先備戰再守城：備戰題的「下一題」「略過這題」只往前一題；整輪答完、旗子波接著答抽卡題
    if (k === "extra" && canExtra()) { const P = st.pf; P.n += TG.pfExtra(st.G); P.end = false; P.extraUsed = true; newQuestion(); render(); return; }
    if (st.pf && (k === "next" || k === "skip") && (pfPrep() || (st.q && st.q.done && st.lastPf))) {
      if (k === "skip" && pfPrep() && !(st.q && st.q.done)) { if (!canPfSkip()) return; pfStep(false, false, false); (st.run.campLog || (st.run.campLog = [])).push({ w: st.w, kind: st.kind, skip: true, pf: true }); }
      if (pfPrep()) { newQuestion(); render(); return; }
      pfFinish();
      if (st.kind === "camp") { newQuestion(); render(); return; }
      if (k === "skip") pfToast();
      close(); return;
    }
    if (k === "skip") {
      st.skipped = true; let got = 0;
      try { if (st.phase === "cards" && typeof TG.campSkip === "function") got = TG.campSkip(st.G) || 0; } catch (e) { console.error("[camp skip]", e); }
      (st.run.campLog || (st.run.campLog = [])).push({ w: st.w, kind: st.kind, skip: true, got });
      if (got) U.toast(TG.CARD_BANK ? "存進 " + got + " 格能量：之後每答對 1 題多領 " + (TG.CARD_BANK.perAnswer || 2) + " 格" : "略過：能量 +" + got); close();
    }
    else if (k === "next") { if (st.kind === "camp" && st.draws && st.draws.length) { st.phase = "cards"; render(); } else close(); }
    else if (k === "reroll") { if (!canReroll()) return; st.rerollUsed = true; st.reroll = true; st.prev = st.draws; newQuestion(); if (!st.q) { st.reroll = false; st.phase = "cards"; } render(); }
    else if (k === "noReroll") { st.reroll = false; st.phase = "cards"; render(); }
    else if (k === "close") close();
    else if (k === "detail") { st.detail = !st.detail; render(); }
  }
  function choose(i) {
    if (!st || st.phase !== "cards" || st.picked || !st.draws) return;
    const c = st.draws[i]; if (!c) return;
    let ok = false;
    try { ok = typeof TG.campTake === "function" ? !!TG.campTake(st.G, c.id) : false; } catch (e) { console.error("[camp take]", e); }
    if (!ok) { U.toast("這張卡現在不能拿"); return; }
    st.picked = c;
    (st.run.campCards || (st.run.campCards = [])).push(c.id);
    const M = mdata(); M.picks[c.id] = (M.picks[c.id] | 0) + 1; U.save();   // 卡冊次數（引擎 opts.cardPicks：選滿 TG.CAMP.evoNeed 次會出進化版）
    U.beep(c.rarity === "legend" ? 1320 : c.rarity === "rare" ? 1100 : 880, .2, "triangle", .05);
    render();
  }
  function close() { const was = st; st = null; stop(); if (was && U.sheetMode === "camp") U.closeSheet(); }
  // index.html closeSheet 在營地開著時呼叫（例如外部強制收面板）：收掉狀態
  function closed() { st = null; stop(); const sh = document.getElementById("sheet"); if (sh) sh.classList.remove("camp"); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  // 英雄挑戰的營地題限時（真實時間；遊戲暫停中另外算，暫停選單開著時不扣）
  function tick() {
    stop();
    if (!st || st.phase !== "ask" || !st.q || st.q.done || !isFinite(st.q.T)) return;
    let last = performance.now();
    timer = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      if (!st || !st.q || st.q.done) return stop();
      if (U.sheetMode !== "camp" || U.held) return;
      st.q.left -= dt; const b = document.getElementById("cpBar"); if (b) b.style.width = Math.max(0, st.q.left / st.q.T * 100) + "%";
      if (st.q.left <= 0) { stop(); finish(false, -1); }
    }, 100);
  }
  function key(k) {
    if (!st || U.sheetMode !== "camp") return false;
    const i = +k - 1;
    if (st.phase === "ask" && st.q && !st.q.done) { pick(i); return true; }
    if (st.phase === "cards" && !st.picked) { choose(i); return true; }
    return false;
  }
  // 11-24 UI/UX 流程 P2-14：電腦營地答完後，Enter／空白鍵＝主要按鈕（回去佈陣／看增益卡）；選卡時 1～3 選卡
  if (typeof document !== "undefined") document.addEventListener("keydown", e => {
    if (!st || U.sheetMode !== "camp" || e.ctrlKey || e.metaKey || e.altKey || U.held) return;
    if (e.key === "Enter" || e.key === " ") {
      const b = document.querySelector("#sheet .cp-ft2 .cp-btn.main"); if (!b) return;
      e.preventDefault(); b.click(); return;
    }
    if (st.phase === "cards" && !st.picked && /^[1-4]$/.test(e.key)) { e.preventDefault(); key(e.key); }
  });
  // 機器人：作答依答對率；選卡挑稀有度最高的；其餘按主要按鈕
  function bot(yes) {
    if (!st || U.sheetMode !== "camp") return false;
    if (st.phase === "ask" && st.q && !st.q.done) {
      const Q = st.q, i = st.qcard && st.qcard.right >= 0 ? st.qcard.right : Q.opts.findIndex(o => o.ok), wr = Q.opts.map((o, k) => k).filter(k => k !== i && !Q.gone.includes(k));
      pick(yes() || !wr.length ? i : wr[0]); return true;
    }
    if (st.phase === "cards" && !st.picked && st.draws && st.draws.length) {
      if (canReroll() && st.draws.every(c => c.rarity === "common") && yes()) { act("reroll"); return true; }
      const R = { legend: 3, rare: 2, common: 1 }; let bi = 0;
      st.draws.forEach((c, k) => { if ((R[c.rarity] || 0) > (R[st.draws[bi].rarity] || 0)) bi = k; });
      choose(bi); if (!st.picked) act("skip"); return true;
    }
    const b = document.querySelector('#sheet [data-cp="next"], #sheet [data-cp="close"], #sheet [data-cp="noReroll"]');
    if (b) b.click(); else close();
    return true;
  }
  // 存檔 S.mods.camp：{ pity 傳說保底（跨關保留）, picks 卡冊次數, seen 進過營地 }；開局交給引擎（合約 §7.1，引擎 TG._cardsInit 讀 opts）
  function mdata() {
    const S = U.S; S.mods = S.mods || {};
    let m = S.mods.camp; if (!m || typeof m !== "object" || Array.isArray(m)) m = S.mods.camp = {};
    if (!m.picks || typeof m.picks !== "object" || Array.isArray(m.picks)) m.picks = {};
    if (!(+m.pity >= 0)) m.pity = 0;
    return m;
  }
  U.add("opts", o => {
    const M = mdata(), S = U.S;
    if (o.cardPity === undefined) o.cardPity = M.pity;
    if (o.cardPicks === undefined) o.cardPicks = Object.assign({}, M.picks);
    if (o.cleared === undefined) o.cleared = U.cleared();
    if (o.wrongBook === undefined) o.wrongBook = Object.keys(S.wrongQ || {}).length;
    return o;
  });
  U.add("start", (G, run) => { st = null; stop(); if (G && run) run.lives0 = G.lives; });
  U.add("end", G => { st = null; stop(); try { if (G && G.cards && +G.cards.pity >= 0) { mdata().pity = G.cards.pity; U.save(); } } catch (e) {} });
})();
