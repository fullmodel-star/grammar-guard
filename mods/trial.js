// 外掛：trial（引擎端，node 可載入）— 試煉之火（出征前自選加難，只給外觀）＋三星之外的挑戰目標
// 第二輪 E 組（2026-11-24，P1-14；設計：DESIGN_v3 第四節、_research/同類遊戲研究 §3-3 Hades 懲罰契約）。
// 紅線（老闆裁示）：
//   ① 加難只看玩家自己勾的條件，絕不看答對率、答題數、養成程度。
//   ② 不動絕招倍率、怒氣、詠唱（沒有任何條件碰騎士絕招）。
//   ③ 題量上限 45（含情境題 55）不變（沒有任何條件改 QBUDGET／QBUDGET_HARD／ORDER_MAX）。
//   ④「題目高一級」只換出題等級（包 TG.pickQuestion 帶 heroic 旗標給出題），不碰怪物。
//   ⑤ 獎勵只有外觀（披風配色、旗幟、火焰徽記），不給戰力；挑戰目標不影響星數。
// 開局參數：opts.trial ＝ { 條件 id: 等級(1 起) }；只在一般關卡生效（英雄挑戰、鐵人、每日一關、練習模式、無盡模式都不生效）。
// 局面：s.trial ＝ { sel, fire, slot, v:{…} }（沒開試煉＝undefined）；s.trGoal ＝ 挑戰目標的統計（一般關卡都有）。
// 存檔（畫面端 S.mods.trial）：{ v:1, best:{關卡序號:最高通過火數}, sel:{關卡序號:{條件:等級}}, goals:{關卡序號:{目標id:1}}, look:{cape, banner} }
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);

  // ═════ 條件表（卡面一句話 card；數值收進 detail）
  //   axis：play＝會玩、eng＝英文；lv[k]＝第 k+1 級：fire 火數、v 數值
  const CONDS = {
    fast:     { axis: "play", name: "怪物變快",       card: "怪物走得比較快。", lv: [{ fire: 1, v: 0.15, tag: "快 15%" }, { fire: 2, v: 0.30, tag: "快 30%" }], detail: "怪物移動速度 1 火 +15%、2 火 +30%。" },
    tough:    { axis: "play", name: "怪物變硬",       card: "怪物比較耐打。",   lv: [{ fire: 1, v: 0.25, tag: "血 +25%" }, { fire: 2, v: 0.5, tag: "血 +50%" }, { fire: 3, v: 0.8, tag: "血 +80%" }], detail: "怪物血量 1 火 +25%、2 火 +50%、3 火 +80%（魔王也算）。對所有人都一樣，不看答對率。" },
    slot:     { axis: "play", name: "少塔位",         card: "靠近城堡的塔位被封住。", lv: [{ fire: 2, v: 1, tag: "封 1 格" }, { fire: 3, v: 2, tag: "封 2 格" }], detail: "2 火：離城堡最近的 1 個塔位不能蓋塔；3 火：最近的 2 個都不能蓋。地圖上會畫火焰封印。" },
    camp2:    { axis: "play", name: "營地二選一",     card: "營地抽卡只給 2 張。", lv: [{ fire: 1 }], detail: "答對也只從 2 張卡裡選（平常 3 張）；重抽也是 2 張。答錯本來就是 2 張，不會更少。" },
    nosum:    { axis: "play", name: "召喚獸休息",     card: "這關不能召喚。", lv: [{ fire: 2 }], detail: "火狐、雷狼等召喚獸都不能叫；能量改拿去升級塔或放同伴大招。" },
    nozh:     { axis: "eng",  name: "隱藏中文",       card: "題目不顯示中文提示。", lv: [{ fire: 1 }], detail: "選擇題、改錯題不顯示中文；排句題保留中文（沒有中文會一題多解）。結算的錯題解析照樣有中文。" },
    harder:   { axis: "eng",  name: "題目高一級",     card: "題目換成難一級的。", lv: [{ fire: 2 }], detail: "每題換成同文法點高一級的題，沒有更高級就出後面關卡的題。只改題目，怪物不會變。錯題本裡的題照原題出。" },
    quick:    { axis: "eng",  name: "答題變快",       card: "營地題要在 15 秒內答。", lv: [{ fire: 1 }], detail: "營地題限時 15 秒（平常不限時）；解封、魔王這類倒數題的時間縮短三成。側邊面板的一般題還是不限時。" },
    nosecond: { axis: "eng",  name: "沒有第二次機會", card: "答錯不能再選一次。", lv: [{ fire: 1 }], detail: "答錯就算錯，不會拿掉一個錯選項再給一次機會。" }
  };
  const ORDER = ["fast", "tough", "slot", "camp2", "nosum", "nozh", "harder", "quick", "nosecond"];
  TG.TRIAL = { V: 1, MAX: 12, CONDS, ORDER, QUICK_CAMP: 15, QUICK_DEADLINE: 0.7, AXES: { play: "會玩", eng: "英文" } };

  // ═════ 純函式：選擇、火數
  // 清理選擇：只留認得的條件、合法等級；總火數超過上限時，從表的後面開始降級／拿掉（畫面本來就擋得住，這裡是保險）
  TG.trialClean = function (sel) {
    const out = {};
    if (!sel || typeof sel !== "object" || Array.isArray(sel)) return out;
    for (const id of ORDER) { const lv = Math.floor(+sel[id]); if (lv >= 1 && lv <= CONDS[id].lv.length) out[id] = lv; }
    let f = TG.trialFire(out);
    for (let i = ORDER.length - 1; i >= 0 && f > TG.TRIAL.MAX; i--) { const id = ORDER[i]; while (out[id] && f > TG.TRIAL.MAX) { if (out[id] > 1) out[id]--; else delete out[id]; f = TG.trialFire(out); } }
    return out;
  };
  TG.trialFireOf = (id, lv) => (CONDS[id] && lv >= 1 && CONDS[id].lv[lv - 1] ? CONDS[id].lv[lv - 1].fire : 0);
  TG.trialFire = sel => { let f = 0; for (const id of Object.keys(sel || {})) f += TG.trialFireOf(id, sel[id]); return f; };
  TG.trialAxisFire = (sel, axis) => ORDER.filter(id => CONDS[id].axis === axis).reduce((a, id) => a + TG.trialFireOf(id, (sel || {})[id]), 0);
  TG.trialMaxFire = () => ORDER.reduce((a, id) => a + CONDS[id].lv[CONDS[id].lv.length - 1].fire, 0);   // 全部勾滿（14）；上限 12，要自己取捨
  // 能不能再加這一級（不超過上限）
  TG.trialCanSet = (sel, id, lv) => { const t = Object.assign({}, sel); if (lv) t[id] = lv; else delete t[id]; return TG.trialFire(t) <= TG.TRIAL.MAX; };
  // 解鎖時機：第一次通關該關後（理由見 _research/第二輪_交接_E.md：高手第 4 關起就沒挑戰，不必等全破第 1 區；第一次照常玩、先學會這關）
  TG.trialOpen = (prog, i) => ((prog || {})[i] || {}).stars > 0;
  // 被封的塔位：離城堡（第 1 條路線終點）最近的塔位
  TG.trialSlots = function (map, n) {
    if (!map || !map.slots || !map.slots.length || !(n > 0)) return [];
    const rt = map.routes[0], c = TG.posOn(rt, rt.len);
    return map.slots.map(([x, y], k) => ({ k, d: Math.hypot(x - c.x, y - c.y) })).sort((a, b) => a.d - b.d).slice(0, n).map(o => o.k);
  };
  TG.trialSlot = map => (TG.trialSlots(map, 1)[0] !== undefined ? TG.trialSlots(map, 1)[0] : -1);
  const vOf = (sel, id) => (sel[id] ? CONDS[id].lv[sel[id] - 1].v || 0 : 0);
  TG.trialOn = s => !!(s && s.trial && s.trial.fire > 0);
  TG.trialHas = (s, id) => !!(s && s.trial && s.trial.sel[id]);

  // ═════ 挑戰目標（三星之外；不影響星數與戰力）
  const GOALS = {
    noleak:  { name: "全程不漏怪",   card: "一隻怪都沒溜進城堡。", detail: "整關漏怪 0 隻（城堡一滴血都沒掉）。" },
    nosum:   { name: "不召喚過關",   card: "整關不叫召喚獸。", detail: "整關召喚 0 次（同伴大招、騎士絕招不算召喚）。" },
    towers4: { name: "只用 4 座塔",  card: "最多同時 4 座塔。", detail: "場上的戰鬥塔最多 4 座（書本塔不算；賣掉再蓋也算進同時座數）。", max: 4 },
    towers6: { name: "只用 6 座塔",  card: "最多同時 6 座塔。", detail: "場上的戰鬥塔最多 6 座（書本塔不算）。", max: 6 },
    combo10: { name: "連對 10 題",   card: "連續答對 10 題。", detail: "第一次作答就答對、連續 10 題（第二次機會才對、答錯會重算；詞彈、略過不算）。" },
    nobook:  { name: "不蓋書本塔",   card: "不靠書本塔也能守住。", detail: "整關沒有蓋書本塔。" },
    branch:  { name: "練出塔分支",   card: "把一座塔升到分支。", detail: "至少一座塔升到選專精的等級（3 級以上選分支）。" },
    types2:  { name: "只用 2 種塔",  card: "只蓋 2 種戰鬥塔。", detail: "整關蓋過的戰鬥塔種類最多 2 種（書本塔不算）。" }
  };
  // 每關 2～3 個（第 1 關 2 個；分支要第 5 關起才有；第 3 區起「只用 4 座」放寬成 6 座）
  const GOAL_TABLE = [
    ["noleak", "combo10"], ["noleak", "nosum", "combo10"], ["towers4", "noleak", "combo10"], ["noleak", "nosum", "types2"],
    ["branch", "combo10", "nobook"], ["towers4", "noleak", "nosum"], ["branch", "types2", "combo10"], ["noleak", "nobook", "combo10"],
    ["towers4", "nosum", "branch"], ["noleak", "types2", "combo10"], ["nobook", "branch", "noleak"], ["towers6", "combo10", "nosum"],
    ["types2", "noleak", "nobook"], ["branch", "combo10", "towers6"], ["noleak", "nosum", "combo10"], ["types2", "nobook", "branch"],
    ["towers6", "noleak", "combo10"], ["nosum", "types2", "branch"], ["noleak", "combo10", "nobook"], ["towers6", "branch", "nosum"],
    ["types2", "noleak", "combo10"], ["noleak", "nosum", "towers6"]
  ];
  TG.TRIAL_GOALS = GOALS; TG.TRIAL_GOAL_TABLE = GOAL_TABLE;
  TG.trialGoalsFor = st => (st && GOAL_TABLE[st.i] ? GOAL_TABLE[st.i] : []).filter(id => GOALS[id]);
  // 哪些局算挑戰目標：一般關卡（含試煉之火、每日一關）；練習模式、英雄挑戰、鐵人不算
  TG.trialGoalEligible = s => !!(s && s.stage && s.trGoal && !s.practice && !s.trGoal.practice && !s.heroic && !(s.modes && s.modes.iron));
  // 結算判定（要過關才算）：[{ id, ok, info }]
  TG.trialGoalCheck = function (s) {
    if (!s || !s.stage || !s.trGoal) return [];
    const g = s.trGoal, won = !!s.won;
    return TG.trialGoalsFor(s.stage).map(id => {
      let ok = false, info = "";
      if (id === "noleak") { ok = (s.leaks | 0) === 0; info = "漏了 " + (s.leaks | 0) + " 隻"; }
      else if (id === "nosum") { ok = g.sum === 0; info = "召喚了 " + g.sum + " 次"; }
      else if (id === "towers4" || id === "towers6") { ok = g.towersMax <= GOALS[id].max; info = "最多同時 " + g.towersMax + " 座"; }
      else if (id === "combo10") { ok = g.best >= 10; info = "最多連對 " + g.best + " 題"; }
      else if (id === "nobook") { ok = !g.book; info = "蓋了書本塔"; }
      else if (id === "branch") { ok = g.branch; info = "沒有塔升到分支"; }
      else if (id === "types2") { ok = Object.keys(g.types).length <= 2; info = "用了 " + Object.keys(g.types).length + " 種塔"; }
      return { id, ok: won && ok, info: won ? info : "沒有過關" };
    });
  };

  // ═════ 外觀獎勵（只有外觀）
  //   need：heat＝各關最高火數加總、top＝單關最高火數、goals＝達成的挑戰目標數（火紋碎片）
  const CAPES = [
    { id: "base",     name: "原色披風", c: null,                       need: null },
    { id: "ember",    name: "餘燼紅",   c: ["#e0583c", "#7a1e14"],   need: { heat: 6 } },
    { id: "jade",     name: "翡翠綠",   c: ["#3fb27f", "#145a3c"],   need: { goals: 8 } },
    { id: "dusk",     name: "暮光紫",   c: ["#9a62d8", "#3c1e6e"],   need: { heat: 20 } },
    { id: "frost",    name: "霜白藍",   c: ["#cfeaff", "#5a8cc0"],   need: { heat: 40 } },
    { id: "obsidian", name: "黑曜金邊", c: ["#3a3a46", "#0e0e16"],   need: { goals: 30 } },
    { id: "sun",      name: "烈日金",   c: ["#ffd25a", "#b06a10"],   need: { top: 12 } }
  ];
  const BANNERS = [
    { id: "none",   name: "不插旗",   need: null },
    { id: "guard",  name: "守衛旗",   col: "#2c4f86", mark: "shield", need: { goals: 1 } },
    { id: "flame",  name: "火焰旗",   col: "#c4402e", mark: "flame",  need: { top: 3 } },
    { id: "twin",   name: "雙劍旗",   col: "#3a7a5a", mark: "swords", need: { goals: 15 } },
    { id: "dragon", name: "龍紋旗",   col: "#6a2a8a", mark: "dragon", need: { top: 9 } },
    { id: "crown",  name: "王冠旗",   col: "#b8862c", mark: "crown",  need: { heat: 60 } }
  ];
  // 火焰徽記：單關最高火數分 4 階（世界地圖關卡旁、簡報、結算顯示）
  const EMBLEMS = [{ min: 1, id: "red", name: "紅焰徽記", c: "#ff6a3a" }, { min: 6, id: "blue", name: "藍焰徽記", c: "#4ab0ff" }, { min: 9, id: "violet", name: "紫焰徽記", c: "#b46aff" }, { min: 12, id: "gold", name: "金焰徽記", c: "#ffd25a" }];
  TG.TRIAL_LOOK = { CAPES, BANNERS, EMBLEMS };
  TG.trialEmblem = fire => { let e = null; for (const x of EMBLEMS) if (fire >= x.min) e = x; return e; };
  const needOk = (need, t) => !need || ((need.heat === undefined || t.heat >= need.heat) && (need.top === undefined || t.top >= need.top) && (need.goals === undefined || t.goals >= need.goals));
  TG.trialNeedText = need => !need ? "一開始就有" : need.heat !== undefined ? "各關最高火數加起來 " + need.heat + " 火" : need.top !== undefined ? "任一關通過 " + need.top + " 火" : "達成 " + need.goals + " 個挑戰目標";

  // ═════ 存檔
  const objOk = v => !!v && typeof v === "object" && !Array.isArray(v);
  const stageKeyOk = k => /^\d+$/.test(k) && +k < 200;
  TG.trialData = function (d) {
    d = objOk(d) ? d : {};
    d.v = 1;
    const best = objOk(d.best) ? d.best : {}; d.best = {};
    for (const k of Object.keys(best)) { const f = Math.floor(+best[k]); if (stageKeyOk(k) && f > 0) d.best[k] = Math.min(TG.TRIAL.MAX, f); }
    const sel = objOk(d.sel) ? d.sel : {}; d.sel = {};
    for (const k of Object.keys(sel)) if (stageKeyOk(k)) { const c = TG.trialClean(sel[k]); if (Object.keys(c).length) d.sel[k] = c; }
    const goals = objOk(d.goals) ? d.goals : {}; d.goals = {};
    for (const k of Object.keys(goals)) if (stageKeyOk(k) && objOk(goals[k])) { const g = {}; for (const id of Object.keys(goals[k])) if (GOALS[id] && goals[k][id]) g[id] = 1; if (Object.keys(g).length) d.goals[k] = g; }
    const look = objOk(d.look) ? d.look : {};
    d.look = { cape: CAPES.some(c => c.id === look.cape) ? look.cape : "base", banner: BANNERS.some(b => b.id === look.banner) ? look.banner : "none" };
    // 裝備的外觀沒解鎖（存檔被改過）就退回預設
    const t = TG.trialTotals(d);
    if (!needOk((CAPES.find(c => c.id === d.look.cape) || {}).need, t)) d.look.cape = "base";
    if (!needOk((BANNERS.find(b => b.id === d.look.banner) || {}).need, t)) d.look.banner = "none";
    return d;
  };
  TG.trialTotals = function (d) {
    let heat = 0, top = 0, goals = 0;
    for (const k of Object.keys((d && d.best) || {})) { const f = d.best[k] | 0; heat += f; top = Math.max(top, f); }
    for (const k of Object.keys((d && d.goals) || {})) goals += Object.keys(d.goals[k]).length;
    return { heat, top, goals };
  };
  TG.trialUnlocks = function (d) {
    const t = TG.trialTotals(d);
    return { totals: t, capes: CAPES.map(c => Object.assign({ ok: needOk(c.need, t) }, c)), banners: BANNERS.map(b => Object.assign({ ok: needOk(b.need, t) }, b)) };
  };
  // 結算寫紀錄：只在過關時更新最高火數；回傳 { prev, best, newBest }
  TG.trialRecord = function (d, stageI, fire, won) {
    const k = String(stageI), prev = d.best[k] | 0;
    if (won && fire > prev) d.best[k] = Math.min(TG.TRIAL.MAX, fire);
    return { prev, best: d.best[k] | 0, newBest: !!(won && fire > prev) };
  };
  // 結算寫挑戰目標：回傳這次「第一次達成」的目標 id
  TG.trialGoalRecord = function (d, stageI, results) {
    const k = String(stageI), g = d.goals[k] || {}, fresh = [];
    for (const r of results || []) if (r.ok && GOALS[r.id] && !g[r.id]) { g[r.id] = 1; fresh.push(r.id); }
    if (Object.keys(g).length) d.goals[k] = g;
    return fresh;
  };
  // 這次結算新解鎖的外觀（比較前後的 unlocks）
  TG.trialNewLooks = function (before, after) {
    const ids = (u, key) => new Set(u[key].filter(x => x.ok).map(x => x.id));
    const out = [];
    for (const key of ["capes", "banners"]) { const a = ids(before, key); for (const x of after[key]) if (x.ok && !a.has(x.id)) out.push({ kind: key === "capes" ? "披風" : "旗幟", id: x.id, name: x.name }); }
    return out;
  };
  // 舊存檔：有 S.mods.trial 就整理；沒有不新增（畫面第一次用到才建）
  TG.trialMigrate = S => { if (S && S.mods && S.mods.trial !== undefined) S.mods.trial = TG.trialData(S.mods.trial); return S; };
  if (TG.SAVE_MIGRATIONS && !TG.SAVE_MIGRATIONS.includes(TG.trialMigrate)) TG.SAVE_MIGRATIONS.push(TG.trialMigrate);

  // ═════ 包住引擎函式（只在這一局有試煉條件時改行為；其他局原樣呼叫）
  {
    // 營地二選一：答對也只給 2 張（帶 wrong:false，免得被當成「答錯的手牌」而限制卡種）
    const _campDraw = TG.campDraw;
    TG.campDraw = function (s, n, rng, o) {
      if (TG.trialHas(s, "camp2") && (n || TG.CAMP.pick.ok) > 2) { o = Object.assign({}, o || {}); if (o.wrong === undefined) o.wrong = false; n = 2; }
      return _campDraw.call(this, s, n, rng, o);
    };
    // 題目高一級：出題時帶「每題換高一級」旗標（跟英雄挑戰同一條出題路；不碰怪物）
    const _pick = TG.pickQuestion;
    TG.pickQuestion = function (QDB, lv, rng, wrong, recent, ctx) {
      const s = (ctx && ctx.game) || TG.liveGame;
      if (TG.trialHas(s, "harder") && !(ctx && ctx.heroic !== undefined)) ctx = Object.assign({}, ctx || {}, { heroic: true });
      return _pick.call(this, QDB, lv, rng, wrong, recent, ctx);
    };
    // 答題變快：營地題限時 15 秒（英雄挑戰本來 12 秒，取比較短的）
    const _prepTime = TG.prepTime;
    TG.prepTime = function (s) {
      const t = _prepTime.apply(this, arguments);
      return TG.trialHas(s, "quick") ? (t > 0 ? Math.min(t, TG.TRIAL.QUICK_CAMP) : TG.TRIAL.QUICK_CAMP) : t;
    };
  }

  // ═════ 引擎掛勾
  const tr = s => s.trial;
  TG.registerMod({
    name: "trial",
    onNewGame(s, opts) {
      s.trial = undefined;
      s.trGoal = { sum: 0, towersMax: 0, types: {}, book: false, branch: false, combo: 0, best: 0, practice: !!(opts && opts.practice) };
      const ok = !!(opts && opts.trial && s.stage && !s.heroic && !opts.heroic && !opts.iron && !(s.modes && (s.modes.iron || s.modes.daily)) && !opts.daily && !opts.practice && !s.practice);
      if (!ok) return;
      const sel = TG.trialClean(opts.trial), fire = TG.trialFire(sel);
      if (!fire) return;
      const slots = sel.slot ? TG.trialSlots(s.map, vOf(sel, "slot")) : [];
      s.trial = { sel, fire, slots, slot: slots.length ? slots[0] : -1, spd: vOf(sel, "fast"), hp: vOf(sel, "tough") };
      if (sel.nosecond) s.noSecondChance = true;   // 引擎的卡片條件「第二次機會」跟著關（畫面另外關掉題卡的第二次機會）
    },
    enemySpeed(v, e, s) { const t = tr(s); return t && t.spd ? v * (1 + t.spd) : v; },
    enemyHpMul(mul, type, s) { const t = tr(s); return t && t.hp ? mul * (1 + t.hp) : mul; },
    canBuildSlot(s, slot) { const t = tr(s); if (t && t.slots && t.slots.includes(slot)) return false; },
    canSummon(s) { if (TG.trialHas(s, "nosum")) return false; },
    onSummon(s) { if (s.trGoal) s.trGoal.sum++; },
    onAnswer(s, ok, info) {
      const g = s.trGoal; if (!g || !TG.ironCounts || !TG.ironCounts(info)) return;
      const retry = !!(info && (info.retry || info.try === 2)) || !!s.retryNext;
      if (ok && !retry) { g.combo++; if (g.combo > g.best) g.best = g.combo; } else g.combo = 0;
    },
    afterUpdate(s) {
      const g = s.trGoal; if (!g) return;
      let n = 0;
      for (const t of s.towers) {
        if ((TG.TOWERS[t.type] || {}).energy) { g.book = true; continue; }
        n++; g.types[t.type] = 1; if (t.branch) g.branch = true;
      }
      if (n > g.towersMax) g.towersMax = n;
    },
    // 模擬測試（regression 的 botOpts）：預設不開試煉（環境變數 TG_TRIAL＝JSON 時才帶，給校準腳本用）
    botOpts(opts) { try { if (typeof process !== "undefined" && process.env && process.env.TG_TRIAL) opts.trial = JSON.parse(process.env.TG_TRIAL); } catch (e) {} }
  });
})(typeof window !== "undefined" ? window : globalThis);
