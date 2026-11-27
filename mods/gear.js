// 外掛：gear（引擎端，node 可載入）— 裝備、文法徽章、星星天賦（DESIGN.md §八）
// 規格見 mods/README.md。畫面在 mods/gear.ui.js；測試在 test/gear.test.js。
//
// 開局參數（UI 的 opts 掛勾或模擬的 botOpts 放進來）：
//   opts.gear    ＝ ["sword","plate","ring"]   已裝在文法騎士身上的裝備（每格最多 1 件）
//   opts.talents ＝ ["gold","learn",...]        已學會的天賦
// 局內狀態：s.gearOn（{id:1}）、s.talentsOn（{id:1}）、s.gSwordT（時態之劍剩幾秒）、s.gGuard（守護結界還在不在）
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  // ═════════ 資料表
  // 時態之劍認得的文法點：be 過去、一般過去、進行式、完成式；v3 第 1 批加 do/does/did（G21）、未來式（G25）、過去進行式（G26）
  const TENSE = ["G02", "G04", "G05", "G11", "G21", "G25", "G26"];
  TG.GEAR_TENSE = TENSE;
  TG.GEAR_SLOTS = [
    { id: "weapon", name: "武器", em: "🗡️" },
    { id: "armor", name: "防具", em: "🛡️" },
    { id: "acc", name: "飾品", em: "💍" }
  ];
  // req：需要「任一個」列出的徽章（null＝不用徽章）；reqText 是畫面上的簡短說明
  TG.GEAR = {
    dagger: { slot: "weapon", name: "連擊匕首", em: "🗡️", cost: 4, req: null,
      desc: "連對 3 題以上時，英雄攻擊速度加倍；答錯就恢復原速。" },
    sword:  { slot: "weapon", name: "時態之劍", em: "⚔️", cost: 8, req: TENSE, reqText: "過去式、進行式、完成式或未來式",
      desc: "答對時態題（過去式、進行式、完成式、未來式），英雄攻擊 ×2，持續 10 秒。" },
    spear:  { slot: "weapon", name: "片語長槍", em: "🔱", cost: 8, req: ["G14", "片語"], reqText: "片語動詞或綜合片語",
      desc: "英雄攻擊距離變長，還能刺到飛在空中的蝙蝠。" },
    plate:  { slot: "armor", name: "文法盔甲", em: "🛡️", cost: 5, req: null,
      desc: "英雄受到的傷害減半，但是走路變慢。" },
    cloak:  { slot: "armor", name: "復活斗篷", em: "🧥", cost: 7, req: ["G01", "G03"], reqText: "be 動詞或第三人稱單數",
      desc: "英雄倒下 4 秒就復活（原本 10 秒），復活時張開 2 秒盾牆。" },
    thorn:  { slot: "armor", name: "荊棘甲", em: "🌵", cost: 9, req: ["G06", "G07", "G08", "G10"], reqText: "助動詞、比較級、最高級或時間介系詞",
      desc: "怪物打英雄時會被刺傷；英雄擋越多怪，刺得越多。" },
    amulet: { slot: "acc", name: "片語護符", em: "📿", cost: 6, req: null,
      desc: "片語題的作答時間多 5 秒。" },
    glove:  { slot: "acc", name: "字盾手套", em: "🧤", cost: 5, req: null,
      desc: "字盾變弱：還沒破盾的字盾騎士和魔龍，也會多受 60% 傷害。" },
    ring:   { slot: "acc", name: "關係戒指", em: "💍", cost: 10, req: ["G13", "G12"], reqText: "關係代名詞或被動語態",
      desc: "英雄每次攻擊，都會連鎖打到旁邊 1 隻怪。" }
  };
  // 裝備升星（11-21 第二刀 P2-14：裝備約 15 關就全打造完，之後碎片沒用 → 碎片可以把已打造的裝備升到 ★2、★3）
  //   費用：升 ★2＝打造價、升 ★3＝打造價 ×2（9 件全升滿共 186 碎片＝打造全部 62 的三倍；連打造共 248）。效果見 TG.gearK 與各效果的程式。
  TG.GEAR_STAR_MAX = 3;
  TG.GEAR_SHARDS_MAX = 9999;   // 碎片上限（全部打造＋升滿約 248；存檔壞掉時夾住）
  const STAR_TXT = {
    dagger: ["攻速 ×2.2", "攻速 ×2.5"], sword: ["持續 13 秒", "持續 16 秒"], spear: ["攻擊距離 50", "攻擊距離 56"],
    plate: ["傷害減 58%", "傷害減 66%"], cloak: ["3 秒復活", "2 秒復活"], thorn: ["反傷 ×1.3", "反傷 ×1.6"],
    amulet: ["片語題多 7 秒", "片語題多 9 秒"], glove: ["多受 80% 傷害", "多受 100% 傷害"], ring: ["連鎖傷害 80%", "連鎖傷害 100%"]
  };
  for (const id of Object.keys(TG.GEAR)) TG.GEAR[id].star = STAR_TXT[id] || [];
  // 天賦：tier 1 直接學；tier 2 要先學 need 指定的第 1 層
  TG.TALENTS = {
    gold:   { tier: 1, cost: 3, name: "軍費", em: "💰", desc: "開局多 50 金幣。" },
    wall:   { tier: 1, cost: 3, name: "城牆", em: "🏰", desc: "城堡多 2 條命。" },
    // v3：充能＝開局送「答對 1 題」的能量（引擎 ENERGY_GAIN.first：空殼 1、目標 2），說明跟著數值走
    charge: { tier: 1, cost: 3, name: "充能", em: "⚡", get desc() { return "開局就有 " + TG.talentChargeE() + " 格能量（＝答對 1 題）。"; } },
    eye:    { tier: 1, cost: 3, name: "鷹眼", em: "🎯", desc: "所有塔的射程 +5%。" },
    // v3：升級不再當場答題 → 錯中學改成「答錯後的下一題答對多 1 格能量」（答錯本來就不扣任何東西）
    learn:  { tier: 2, cost: 5, need: "gold", name: "錯中學", em: "📘", desc: "答錯之後，下一題答對多拿 1 格能量。" },
    guard:  { tier: 2, cost: 5, need: "wall", name: "守護結界", em: "✨", desc: "每關第一隻衝進城堡的怪不扣命。" },
    revive: { tier: 2, cost: 5, need: "wall", name: "快速復活", em: "💫", desc: "英雄倒下 6 秒就復活（原本 10 秒）。" },
    surge:  { tier: 2, cost: 5, need: "charge", name: "能量回流", em: "🔋", desc: "每次召喚完，退回 1 格能量。" },
    pierce: { tier: 2, cost: 5, need: "eye", name: "破盾之眼", em: "👁️", desc: "字盾騎士更弱：還沒破盾也多受 30% 傷害。" },
    // 第 3 層（11-22 老闆核准）：完美打法約第 14 關就學完 1、2 層（37 星），剩 29 星沒用 → 高階天賦。
    //   要先學 need 指定的第 2 層，而且「累積星數」（各關最高星數加總）要到 minStars 才開放。
    //   5 個共 29 星＋1、2 層 37 星＝66＝22 關全三星才能全部學滿；門檻 42～60 ≈ 完美打法第 14～20 關。
    //   效果都和答題綁在一起（復仇題、大招題、拼字、詞彈、連對），不是單純加數值。
    // v3（第 8b 組）：復仇筆記／大招專注／八連共鳴改成能量與騎士怒氣版本（id 不變，存檔不用動）
    notes:  { tier: 3, cost: 5, need: "learn",  minStars: 42, name: "復仇筆記", em: "📝", desc: "復仇題（之前答錯的題再出現）答對，多拿 2 格能量（能量滿了改拿 10 金幣）。" },
    focus:  { tier: 3, cost: 6, need: "revive", minStars: 46, name: "大招專注", em: "🎯", desc: "騎士的詠唱題多 3 秒作答；詠唱答對後，下一次絕招可以提早 5 秒放。" },
    chain:  { tier: 3, cost: 6, need: "pierce", minStars: 50, name: "拼字連破", em: "🛡️", desc: "拼對字盾時，旁邊最近的另一隻字盾騎士也一起破盾（魔王除外）。" },
    quake:  { tier: 3, cost: 6, need: "guard",  minStars: 55, name: "詞彈震波", em: "💥", desc: "詞彈第一次就點對時，打中的地方震開：旁邊的怪受傷、變慢 2 秒。" },
    reso:   { tier: 3, cost: 6, need: "surge",  minStars: 60, name: "八連共鳴", em: "🔆", desc: "連對每到 8 題，馬上多 2 格能量（召喚獸更快能再叫）。" }
  };
  TG.TALENT_TIERS = 3;
  // 充能給的能量＝答對 1 題第一次的能量（合約 §4.1 ENERGY_GAIN.first）
  TG.talentChargeE = () => Math.max(1, ((TG.ENERGY_GAIN && TG.ENERGY_GAIN.first) | 0) || 1);
  // 第 2、3 層效果數值（測試、說明共用）
  //   learnE：錯中學多給的能量；notesE：復仇筆記多給的能量（滿了改 notesGold 金幣）；
  //   focusSec：詠唱題多幾秒；focusGap：詠唱答對後，下一次絕招的最短間隔少幾秒（騎士引擎 fold 掛勾 knightCastGap）；
  //   focusCd：舊流程（騎士沒有怒氣、答題大招 src:"ult"）答對時冷卻 ×0.8（相容）
  TG.T3 = { learnE: 1, notesE: 2, notesGold: 10, focusSec: 3, focusGap: 5, focusCd: 0.8, chainR: 90, chainGold: 6, quakeR: 48, quakeHp: 0.3, quakeBoss: 0.05, quakeSlow: 0.4, quakeSlowT: 2, resoEvery: 8, resoGain: 2 };

  // ═════════ 文法徽章（純邏輯；UI 存檔與測試共用）
  // v3（合約 §8.4）：三階徽章 銅／銀／金。掌握度與門檻由 mods/qkinds.js（第 4 組）的 TG.masteryPush／badgeTier 計算，
  //   本外掛負責「何時呼叫、存到哪裡、給多少碎片」：S.mods.gear.mast（掌握度紀錄，masteryPush 寫入）、btier（{gp:0～3} 歷史最高）、bday（{gp:{階:日期}}）。
  //   qkinds 還是空殼（TG.QKINDS_VER < 1）時，沿用舊規則「最近 10 題對 8 題＝銅牌」，遊戲照樣拿得到徽章。
  const GPS35 = []; for (let i = 1; i <= 35; i++) GPS35.push("G" + (i < 10 ? "0" : "") + i);
  TG.BADGE_GPS = GPS35;
  TG.BADGE_KEYS = GPS35.concat(["文法", "片語"]);   // 「文法」「片語」是舊 key（原創題）：只給裝備需求相容，片語讀成 G14
  TG.BADGE_WINDOW = 10;      // 舊規則：看最近幾題
  TG.BADGE_NEED = 8;         // 舊規則：答對幾題（80%）
  TG.BADGE_SHARDS = 5;       // 銅牌送碎片（＝舊徽章）
  TG.BADGE_TIER_NAME = ["", "銅", "銀", "金"];
  // 各階碎片：照 knight_tree.json 的 badges.tiers（銅 5、銀 8、金 12）
  TG.badgeTierShards = tier => {
    const T = TG.DATA_KNIGHT && TG.DATA_KNIGHT.badges && TG.DATA_KNIGHT.badges.tiers, k = ["", "bronze", "silver", "gold"][tier];
    const v = T && T[k] && +T[k].shards; return Number.isFinite(v) ? v : [0, TG.BADGE_SHARDS, 8, 12][tier] || 0;
  };
  TG.badgeKey = q => (q && q.gp) || (q && q.t === "p" ? "片語" : "文法");
  TG.badgeGp = k => (k === "片語" ? "G14" : k);   // 舊 key「片語」→ G14
  TG.gearDay = now => { const d = new Date(now === undefined ? Date.now() : now), p = n => (n < 10 ? "0" : "") + n; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  // 存檔資料預設值（舊存檔缺欄位時補齊）
  TG.gearData = function (d) {
    d = d && typeof d === "object" ? d : {};
    if (typeof d.shards !== "number" || !(d.shards >= 0)) d.shards = 0;
    d.shards = Math.min(TG.GEAR_SHARDS_MAX, Math.floor(d.shards));   // 存檔防呆（11-21 QA）：Infinity／1e308 會讓碎片永遠用不完
    for (const k of ["hist", "badges", "owned", "talents", "glv", "mast", "btier", "bday"]) if (!isObj(d[k])) d[k] = {};
    for (const id of Object.keys(d.glv)) { const v = Math.floor(+d.glv[id]); if (!TG.GEAR[id] || !d.owned[id] || !(v >= 2)) delete d.glv[id]; else d.glv[id] = Math.min(TG.GEAR_STAR_MAX, v); }
    if (!d.eq || typeof d.eq !== "object") d.eq = {};
    for (const sl of TG.GEAR_SLOTS) if (!(sl.id in d.eq) || (d.eq[sl.id] && !(TG.GEAR[d.eq[sl.id]] && d.owned[d.eq[sl.id]] && TG.GEAR[d.eq[sl.id]].slot === sl.id))) d.eq[sl.id] = null;
    // v3 三階徽章：型別防呆＋舊徽章讀成銅牌（「片語」→ G14；已拿到的不收回）
    for (const k of Object.keys(d.btier)) { const v = Math.floor(+d.btier[k]); if (!(v >= 1)) delete d.btier[k]; else d.btier[k] = Math.min(3, v); }
    for (const k of Object.keys(d.bday)) if (!isObj(d.bday[k])) delete d.bday[k];
    for (const k of Object.keys(d.mast)) if (!Array.isArray(d.mast[k])) delete d.mast[k];
    for (const k of Object.keys(d.badges)) if (d.badges[k]) { const g = TG.badgeGp(k); if (/^G\d\d$/.test(g)) d.btier[g] = Math.max(d.btier[g] || 0, 1); }
    return d;
  };
  // 目前的徽章階（0～3）：取存檔歷史最高（不收回）
  TG.gearTier = (d, k) => (d && d.btier && d.btier[TG.badgeGp(k)]) || (d && d.badges && d.badges[k] ? 1 : 0);
  // 記一題作答（畫面 answer 掛勾呼叫）→ { key, gp, badge: 這題是否剛好升階, tier, prev, shards } 或 null（不是文法題）
  //   info：合約 §3.2（qk、try、sec…）；now：毫秒（測試用，省略＝現在）
  TG.gearRecord = function (d, q, ok, info, now) {
    if (!q || (typeof q.id === "string" && q.id.slice(0, 2) === "w:") || (!Array.isArray(q.o) && !q.k)) return null;   // 只記文法／片語題（字盾單字等不算）
    info = info || {}; now = now === undefined ? Date.now() : now;
    const key = TG.badgeKey(q), gp = TG.badgeGp(key), prev = TG.gearTier(d, key);
    const h = d.hist[key] = Array.isArray(d.hist[key]) ? d.hist[key] : [];
    h.push(ok ? 1 : 0); while (h.length > TG.BADGE_WINDOW) h.shift();
    // 舊規則（qkinds 還是空殼時才用）：最近 10 題對 8 題＝銅牌
    if (!(TG.QKINDS_VER >= 1) && !d.badges[key] && h.length >= TG.BADGE_WINDOW && h.reduce((a, b) => a + b, 0) >= TG.BADGE_NEED) d.badges[key] = 1;
    // 掌握度（第一次作答才收、快答不收：由 masteryPush 自己判斷）
    if (q.gp && TG.masteryPush) TG.masteryPush(d, { gp: q.gp, ok: !!ok, k: info.qk || (TG.kindOf ? TG.kindOf(q) : "fill"), lv: q.lv || 1, t: now, try: info.try || 1, sec: info.sec });
    let tier = Math.max(TG.badgeTier ? (TG.badgeTier(d, gp, now) | 0) : 0, d.badges[key] ? 1 : 0);
    tier = Math.min(3, tier);
    let shards = 0;
    if (tier > prev) {
      const day = TG.gearDay(now), bd = d.bday[gp] = isObj(d.bday[gp]) ? d.bday[gp] : {};
      for (let t = prev + 1; t <= tier; t++) { shards += TG.badgeTierShards(t); if (!bd[t]) bd[t] = day; }
      if (/^G\d\d$/.test(gp)) d.btier[gp] = tier;
      d.badges[key] = 1; d.shards = Math.min(TG.GEAR_SHARDS_MAX, d.shards + shards);
    }
    return { key, gp, badge: tier > prev, tier: Math.max(tier, prev), prev, shards };
  };
  // 過關碎片：每顆星 1 個，第一次過關多 2 個
  TG.gearStageShards = (stars, firstClear) => stars + (firstClear ? 2 : 0);
  TG.gearReqOk = (d, id) => { const g = TG.GEAR[id]; return !!g && (!g.req || g.req.some(k => TG.gearTier(d, k) >= 1)); };
  TG.gearCanCraft = (d, id) => !!TG.GEAR[id] && !d.owned[id] && TG.gearReqOk(d, id) && d.shards >= TG.GEAR[id].cost;
  TG.gearCraft = function (d, id) {
    if (!TG.gearCanCraft(d, id)) return false;
    d.shards -= TG.GEAR[id].cost; d.owned[id] = 1;
    const sl = TG.GEAR[id].slot; if (!d.eq[sl]) d.eq[sl] = id;   // 那一格空著就直接裝上
    return true;
  };
  TG.gearEquip = function (d, id) {
    if (!TG.GEAR[id] || !d.owned[id]) return false;
    d.eq[TG.GEAR[id].slot] = id; return true;
  };
  TG.gearUnequip = function (d, slot) { if (slot in d.eq) d.eq[slot] = null; };
  // 升星
  TG.gearLv = (d, id) => (d && d.owned && d.owned[id] ? Math.max(1, Math.min(TG.GEAR_STAR_MAX, (d.glv && d.glv[id]) | 0 || 1)) : 0);
  TG.gearStarCost = (id, lv) => (TG.GEAR[id] ? TG.GEAR[id].cost * lv : Infinity);   // lv＝目前星數（1→2 付打造價、2→3 付兩倍）
  TG.gearCanStar = (d, id) => { const lv = TG.gearLv(d, id); return lv >= 1 && lv < TG.GEAR_STAR_MAX && d.shards >= TG.gearStarCost(id, lv); };
  TG.gearStar = function (d, id) {
    if (!TG.gearCanStar(d, id)) return false;
    const lv = TG.gearLv(d, id); d.shards -= TG.gearStarCost(id, lv); d.glv[id] = lv + 1; return true;
  };
  TG.gearLevels = d => { const o = {}; for (const id of Object.keys(TG.GEAR)) if (d.owned[id]) o[id] = TG.gearLv(d, id); return o; };
  // 全部打造＋升滿要多少碎片（測試、說明用）
  TG.gearSinkTotal = () => Object.keys(TG.GEAR).reduce((a, id) => { let t = TG.GEAR[id].cost; for (let l = 1; l < TG.GEAR_STAR_MAX; l++) t += TG.gearStarCost(id, l); return a + t; }, 0);
  TG.gearEquipped = d => TG.GEAR_SLOTS.map(sl => d.eq[sl.id]).filter(id => id && TG.GEAR[id] && d.owned[id]);
  // 天賦
  TG.talentSpent = owned => Object.keys(owned || {}).reduce((a, id) => a + (TG.TALENTS[id] && owned[id] ? TG.TALENTS[id].cost : 0), 0);
  TG.talentAvail = (owned, totalStars) => totalStars - TG.talentSpent(owned);
  // 累積星數到門檻了沒（第 3 層才有 minStars）
  TG.talentOpen = (id, totalStars) => !!TG.TALENTS[id] && (totalStars || 0) >= (TG.TALENTS[id].minStars || 0);
  TG.talentCan = function (owned, id, totalStars) {
    const t = TG.TALENTS[id];
    return !!t && !owned[id] && (t.tier === 1 || !!owned[t.need]) && TG.talentOpen(id, totalStars) && TG.talentAvail(owned, totalStars) >= t.cost;
  };
  TG.talentLearn = function (owned, id, totalStars) { if (!TG.talentCan(owned, id, totalStars)) return false; owned[id] = 1; return true; };
  TG.talentReset = owned => { const n = TG.talentSpent(owned); for (const k of Object.keys(owned)) delete owned[k]; return n; };
  // 星星不夠（例如存檔被改）時，從高層開始退掉，回傳合法清單：
  //   依層數由低到高收；父天賦沒收到、累積星數沒到門檻、剩的星星付不起的都不收（第 3 層先退、再第 2 層）
  TG.talentValid = function (owned, totalStars) {
    const ids = Object.keys(owned || {}).filter(id => TG.TALENTS[id] && owned[id]);
    ids.sort((a, b) => TG.TALENTS[a].tier - TG.TALENTS[b].tier);
    const out = []; let left = totalStars;
    for (const id of ids) {
      const t = TG.TALENTS[id];
      if (left >= t.cost && TG.talentOpen(id, totalStars) && (t.tier === 1 || out.includes(t.need))) { out.push(id); left -= t.cost; }
    }
    return out;
  };
  // 把存檔裡不合法的天賦直接退掉（星數退回）；回傳被退掉的 id。畫面開天賦／開局前呼叫
  TG.talentPrune = function (owned, totalStars) {
    if (!owned || typeof owned !== "object") return [];
    const keep = TG.talentValid(owned, totalStars), out = [];
    for (const k of Object.keys(owned)) if (!keep.includes(k)) { delete owned[k]; out.push(k); }
    return out;
  };

  // ═════════ 局內效果
  const knight = s => s.heroes && s.heroes.find(h => h.id === "knight");
  const G_ = s => s.gearOn || {}, T_ = s => s.talentsOn || {};
  // 局內裝備星數：k＝星數−1（0～2）
  TG.gearK = (s, id) => Math.max(0, Math.min(TG.GEAR_STAR_MAX, ((s && s.gearLv && s.gearLv[id]) | 0) || 1) - 1);
  TG.gearAmuletSec = s => (s && G_(s).amulet ? 5 + 2 * TG.gearK(s, "amulet") : 0);   // 片語護符多給的秒數（畫面端 qtime 用）
  // 答對時態題 → 時態之劍發光
  TG.gearTense = function (s) {
    if (!s || !G_(s).sword) return false;
    s.gSwordT = 10 + 3 * TG.gearK(s, "sword"); s.events.push({ k: "gearSword" }); return true;
  };
  TG.gearSetup = function (s, opts) {
    opts = opts || {};
    const g = s.gearOn = {}, used = {};
    for (const id of opts.gear || []) { const it = TG.GEAR[id]; if (it && !used[it.slot]) { g[id] = 1; used[it.slot] = 1; } }
    s.gearLv = {}; for (const id of Object.keys(g)) s.gearLv[id] = Math.max(1, Math.min(TG.GEAR_STAR_MAX, ((opts.gearLv || {})[id] | 0) || 1));
    const t = s.talentsOn = {};
    for (const id of opts.talents || []) if (TG.TALENTS[id]) t[id] = 1;
    // 父天賦沒學的不生效（依層數由低到高檢查，第 2 層被拿掉時第 3 層也跟著拿掉）
    for (const id of Object.keys(t).sort((a, b) => TG.TALENTS[a].tier - TG.TALENTS[b].tier)) if (TG.TALENTS[id].tier > 1 && !t[TG.TALENTS[id].need]) delete t[id];
    s._t3Combo = 0; s._t3Stats = { notes: 0, focus: 0, chain: 0, quake: 0, reso: 0, learn: 0 };
    s._gLearn = false; s.gFocusAt = null;
    if (t.gold) s.gold += 50;
    if (t.wall) s.lives += 2;
    if (t.charge) TG.addEnergy(s, TG.talentChargeE(), "talent");   // v3：能量一律經過 addEnergy（合約 §4.2）
    s.gGuard = !!t.guard; s.gSwordT = 0; s.gTenseAcc = 0;
    // 模擬用：這關有多少比例的題目是時態題（node 模擬沒有真的題目）
    const gps = s.stage ? s.stage.gps : [];
    const n = s.stage ? gps.length + s.stage.orig.length : 0;
    s.gTenseShare = s.stage ? (n ? gps.filter(x => TENSE.includes(x)).length / n : 0) : 0.25;
  };

  // ═════════ 第 3 層天賦（全部走既有掛勾：onAnswer、onKill、afterUpdate；不改引擎）
  // 任何題目答完（引擎 answerResult → onAnswer）時檢查（v3：全部看 info 的明確欄位，不再猜標題字串或冷卻跳動）：
  //   復仇筆記：info.revenge 且答對（營地／側邊面板的復仇題；舊的備戰 prepAnswer 也會帶 revenge）→ addEnergy
  //   大招專注：info.src === "chant" 且答對 → 記下時間 s.gFocusAt；騎士引擎問 fold("knightCastGap") 時，
  //            最近一次施放就是這次詠唱 → 間隔少 focusGap 秒。舊流程（騎士沒有怒氣、src "ult" 的答題大招）答對 → 冷卻 ×focusCd
  //   拼字連破：info.kind === "spell"（TG.breakShield 已先把那隻的 shield 拿掉）
  //   八連共鳴：comboFresh（上次答錯後連續答對數）每到 8 的倍數一次 → addEnergy
  TG.talent3Answer = function (s, correct, info) {
    const t = T_(s), P = TG.T3, st = s._t3Stats || (s._t3Stats = { notes: 0, focus: 0, chain: 0, quake: 0, reso: 0, learn: 0 });
    info = info || {};
    if (t.notes && correct && info.revenge) {
      const gain = TG.addEnergy(s, P.notesE, "talent"); let gold = 0;
      if (gain <= 0) { gold = P.notesGold; s.gold += gold; }   // 能量滿了：改給金幣（複習照樣有獎勵）
      st.notes++; s.events.push({ k: "talentNotes", gain, gold });
    }
    if (t.focus && correct) {
      const k = s.heroes && s.heroes[0];
      if (info.src === "chant") {
        s.gFocusAt = s.time; st.focus++;
        if (k) s.events.push({ k: "talentFocus", idx: 0, x: k.x, y: k.y, gap: P.focusGap });
      } else if (info.src === "ult" && k && !TG.heroRageMax(s, 0) && k.ultCd >= TG.heroDef(k).ultCd - 0.01) {   // 相容：舊答題大招（heroUlt 先設好整段冷卻才記答題）
        k.ultCd *= P.focusCd; st.focus++;
        s.events.push({ k: "talentFocus", idx: 0, x: k.x, y: k.y, cd: k.ultCd });
      }
    }
    if (t.chain && correct && info.kind === "spell") {
      const src = s.enemies.filter(x => !x.shield && TG.ENEMIES[x.type] && TG.ENEMIES[x.type].shield && !x._t3Br);
      for (const x of src) x._t3Br = 1;
      const from = src[src.length - 1];
      if (from) {
        let best = null, bd = P.chainR;
        for (const e of s.enemies) {
          if (!e.shield || e === from || TG.ENEMIES[e.type].boss) continue;
          const d = H(e.x - from.x, e.y - from.y); if (d <= bd) { best = e; bd = d; }
        }
        if (best) {
          best.shield = false; best._t3Br = 1; s.gold += P.chainGold; st.chain++;
          s.events.push({ k: "shield", e: best, chain: true });
          s.events.push({ k: "talentChain", e: best, pts: [[from.x, from.y], [best.x, best.y]], gold: P.chainGold });
          s.events.push({ k: "chain", pts: [[from.x, from.y], [best.x, best.y]] });
        }
      }
    }
    if (t.reso) {
      const c = s.comboFresh || 0;
      if (c === 0) s._t3Combo = 0;
      else if (correct && c % P.resoEvery === 0 && c !== s._t3Combo) {
        s._t3Combo = c; st.reso++;
        const gain = TG.addEnergy(s, P.resoGain, "talent");
        s.events.push({ k: "talentReso", n: c, gain });
      }
    }
  };
  // 大招專注：騎士引擎的施放間隔 fold 掛勾用（knightCastGap(gap, s, idx)；第 5 組在 knight.js 呼叫 TG.fold("knightCastGap", 間隔, s, idx)）
  //   最近一次施放（s.kn.lastCast）就是詠唱答對的那一次（時間差 ≤2 秒）→ 下一招提早 focusGap 秒；最少留 1 秒
  TG.gearCastGap = function (s, gap, idx) {
    if (!s || !T_(s).focus || (idx || 0) !== 0 || s.gFocusAt == null || !s.kn || typeof s.kn.lastCast !== "number") return gap;
    return Math.abs(s.kn.lastCast - s.gFocusAt) <= 2 ? Math.max(1, gap - TG.T3.focusGap) : gap;
  };
  // 錯中學：答錯（不含詞彈、逾時、略過）→ 記著；之後第一題答對（不含詞彈）多 learnE 格能量
  TG.talentLearn2 = function (s, correct, info) {
    info = info || {};
    if (info.word || info.timeout || info.skip) return 0;
    if (!correct) { s._gLearn = true; return 0; }
    if (!s._gLearn) return 0;
    s._gLearn = false;
    const gain = TG.addEnergy(s, TG.T3.learnE, "talent"), st = s._t3Stats || (s._t3Stats = {});
    st.learn = (st.learn || 0) + 1;
    s.events.push({ k: "talentLearn", gain });
    return gain;
  };
  // 詞彈震波：詞彈打中（wordbullet 外掛先設 e._critT 再 TG._kill）且第一次就點對（e.wb.miss === 0）
  TG.talentQuake = function (s, e) {
    if (!T_(s).quake || !e || !e.wb || !e.wb.fired || e.wb.miss || e._t3Q || !(e._critT > 0)) return 0;
    e._t3Q = 1;
    const P = TG.T3; let n = 0;
    for (const o of s.enemies.slice()) {
      if (o === e || H(o.x - e.x, o.y - e.y) > P.quakeR) continue;
      const b = TG.ENEMIES[o.type] || {};
      o.slowF = Math.max(o.slowF || 0, P.quakeSlow); o.slowT = Math.max(o.slowT || 0, P.quakeSlowT);
      TG._hurt(s, o, o.maxHp * (b.boss ? P.quakeBoss : P.quakeHp), true); n++;
    }
    (s._t3Stats || (s._t3Stats = {})).quake = ((s._t3Stats || {}).quake || 0) + 1;
    s.events.push({ k: "talentQuake", x: e.x, y: e.y, r: P.quakeR, n });
    s.events.push({ k: "boom", x: e.x, y: e.y, r: P.quakeR, type: "cannon" });
    return n;
  };

  TG.registerMod({
    name: "gear",
    onKill(s, e) { if (T_(s).quake) TG.talentQuake(s, e); },
    onNewGame(s, opts) { TG.gearSetup(s, opts); },
    heroStats(st, h, s) {
      if (h.id !== "knight") return st;
      const g = G_(s);
      if (g.dagger && s.combo >= 3) st.cd *= 0.5 - 0.05 * TG.gearK(s, "dagger");
      if (g.sword && s.gSwordT > 0) st.dmg *= 2;
      if (g.spear) { st.range = Math.max(st.range, 44 + 6 * TG.gearK(s, "spear")); st.fly = true; }
      return st;
    },
    towerStats(st, tw, s) {
      if (T_(s).eye) st.range *= 1.05;
      return st;
    },
    damageTaken(d, e, s) {
      if (!e.shield) return d;
      let m = 1;
      if (G_(s).glove) m *= 1.6 + 0.2 * TG.gearK(s, "glove");
      if (T_(s).pierce) m *= 1.3;
      return d * m;
    },
    beforeUpdate(s, dt) {
      if (s.gSwordT > 0) s.gSwordT -= dt;
      for (const h of s.heroes) { h._gHp = h.hp; h._gX = h.x; h._gY = h.y; h._gDead = h.dead; }
    },
    afterUpdate(s, dt) {
      const g = G_(s), t = T_(s);
      for (const h of s.heroes) {
        const isK = h.id === "knight";
        // 復活時間：斗篷 4 秒（只有騎士）＞ 天賦 6 秒
        const cap = isK && g.cloak ? 4 - TG.gearK(s, "cloak") : t.revive ? 6 : 0;
        if (cap && h.dead > cap) h.dead = cap;
        if (!isK) continue;
        if (g.cloak && h._gDead > 0 && h.dead <= 0) h.wallT = Math.max(h.wallT, 2);   // 剛復活：小盾牆
        if (h._gDead > 0 || h.dead > 0) continue;
        // 受傷：盔甲減半、荊棘反傷
        if (h.hp < h._gHp) {
          let lost = h._gHp - h.hp;
          if (g.plate) { const r = 0.5 + 0.08 * TG.gearK(s, "plate"); h.hp += lost * r; lost *= 1 - r; }
          if (g.thorn) {
            const near = s.enemies.filter(e => !TG.ENEMIES[e.type].fly && H(e.x - h.x, e.y - h.y) <= (h.wallT > 0 ? 60 : 20));
            const each = near.length ? lost * (2.5 + 0.75 * TG.gearK(s, "thorn")) * Math.sqrt(s.hpMul) / near.length : 0;
            for (const e of near) TG._hurt(s, e, each, true);
          }
        }
        // 盔甲：走路變慢（這一步只走 60%）
        if (g.plate && (h.x !== h._gX || h.y !== h._gY)) {
          h.x = h._gX + (h.x - h._gX) * 0.6; h.y = h._gY + (h.y - h._gY) * 0.6;
          h.moving = H(h.tx - h.x, h.ty - h.y) > 2;
        }
      }
      // 關係戒指：騎士每次攻擊連鎖打旁邊 1 隻
      if (g.ring) for (const ev of s.events) {
        if (ev.k !== "slash" || ev._g) continue;
        ev._g = 1;
        const h = s.heroes[ev.idx]; if (!h || h.id !== "knight" || !h.st) continue;
        let best = null, bd = 41;
        for (const e of s.enemies) {
          const d = H(e.x - ev.x, e.y - ev.y);
          if (d < 1 || d >= bd || (!h.st.fly && TG.ENEMIES[e.type].fly) || !TG.every("targetable", e, s, h)) continue;
          best = e; bd = d;
        }
        if (best) { const pts = [[ev.x, ev.y], [best.x, best.y]]; TG._hurt(s, best, h.st.dmg * Math.sqrt(s.hpMul) * (0.6 + 0.2 * TG.gearK(s, "ring")), 2); s.events.push({ k: "chain", pts }); }
      }
    },
    onAnswer(s, correct, info) {
      const g = G_(s), t = T_(s);
      if (t.notes || t.focus || t.chain || t.reso) TG.talent3Answer(s, correct, info);
      // node 模擬沒有真的題目：照這關時態題的比例觸發時態之劍（畫面端用 answer 掛勾看真的題目）
      if (!s._gUI && correct && g.sword) { s.gTenseAcc += s.gTenseShare; if (s.gTenseAcc >= 1) { s.gTenseAcc -= 1; TG.gearTense(s); } }
      // 錯中學（v3）：答錯後的下一題答對多 1 格能量（TG.talentLearn2）
      if (t.learn) TG.talentLearn2(s, correct, info);
      // 相容（舊的答題升級 UPGRADE_MODE "quiz" 才會發生）：剛升級答錯的塔馬上能再試、連對數還原
      if (correct) s._gCombo = s.combo;
      else if (t.learn && s.upFail) { s.upFail.lockT = 0; s.upFail.failN = 0; s.combo = s._gCombo || 0; }   // 剛剛升級答錯的塔（引擎在 finishUpgrade 設 s.upFail）
    },
    // 大招專注：騎士引擎問施放間隔時縮短（見 TG.gearCastGap）
    knightCastGap(gap, s, idx) { return TG.gearCastGap(s, gap, idx); },
    onLeak(s, e) {
      if (!s.gGuard) return;
      s.gGuard = false; s.lives += TG.ENEMIES[e.type].lifeDmg || 1;
      s.events.push({ k: "gearGuard" });
    },
    onSummon(s) { if (T_(s).surge) TG.addEnergy(s, 1, "talent"); },   // 能量回流（v3：經過 addEnergy）
    // 模擬：一般孩子照進度慢慢拿到的中階裝備與天賦（約每關 2 星）
    botOpts(opts, st, cleared) {
      Object.assign(opts, TG.gearBotLoadout(cleared));
    }
  });
  TG.gearBotLoadout = function (cleared) {
    const gear = [];
    if (cleared >= 10) gear.push("sword"); else if (cleared >= 3) gear.push("dagger");
    if (cleared >= 6) gear.push("plate");
    if (cleared >= 16) gear.push("ring"); else if (cleared >= 4) gear.push("glove");
    const owned = {}, stars = cleared * 2;
    for (const id of ["gold", "eye", "charge", "wall", "learn", "pierce", "surge", "revive", "guard"]) TG.talentLearn(owned, id, stars);
    return { gear, talents: Object.keys(owned) };
  };
})(typeof window !== "undefined" ? window : globalThis);
