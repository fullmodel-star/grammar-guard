// 外掛：knight（引擎端，node 可載入）— v3 文法騎士：怒氣、三種絕招、技能樹、經驗曲線、戰力、存檔遷移、機器人
// 負責：第 5 組（騎士引擎）。合約：mods/CONTRACT_v3.md §8（§8.1–8.5、§8.2a）。數值一律讀 _data/knight_tree.json（TG.DATA_KNIGHT → TG.KNIGHT）。
// 載入順序：companions 之後、gear 之前（技能樹的加法先算，gear 的倍率後算；封頂另外排在所有外掛最後，見 ensureCap）。
//
// 開關：只有開局參數 opts.knight = { tree, ult, chant, tiers?, cleared? } 存在時才啟用（s.kn）；沒給＝舊流程（舊測試、空殼期行為不變）。
//   tiers＝徽章階級 { gp: 0～3 }（TG.badgeTiers(S.mods.gear)，選填，給徽章節點、金牌強化、第 3 級演出判斷）；cleared＝已通關數（選填，給絕招解鎖複查）。
//
// 給畫面（第 6 組）用的入口：
//   TG.knightReady(s)／TG.knightCastWait(s)／TG.knightChantPlan(s)／TG.knightCast(s, oks)／TG.knightInfuse(s)／TG.knightTier(s, chantOk)
//   技能樹：TG.knightPoints／knightSpent／knightValid／knightCanLearn／knightLearn／knightAutoFirst／knightUltOk／knightUltsUnlocked
//   經驗：TG.knightXpNeed／knightXpFor／knightGainXp／knightStageXp／knightLevelUp／knightDailyRewardXp
//   戰力：TG.knightPowerDisplay（顯示）／TG.knightBuildR（配裝倍率 R）／TG.knightPowerHpMul（給第 1 組的 powerHpMul）
// 紅線（老闆裁示）：任何絕招都不打 Be 小怪（不傷、不暈、不推，仍要點對主詞）、不會把字盾拿掉（仍要拼字）；怒氣只由答題、擋怪、灌注增加。
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  if (!TG) return;
  const H = Math.hypot;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ═════════ 資料（合約 §8.3；數值以 JSON 為準）
  const D = TG.DATA_KNIGHT || null, tr = (D && D.tree) || {};
  TG.KNIGHT = {
    VER: 1,
    ON: !!D,                                    // knight.data.js 是 null（--empty 基準）時整個外掛不啟用
    BOT: true,                                  // 模擬機器人（regression botOpts）帶 v3 騎士配置。合約 §8.2a：第 1 組以「TG.knightBuildR 存在」切換新戰力公式＋botLvByCleared，
                                                //   本檔一載入三件事同時生效；要看「新曲線但舊騎士」的對照才設 false
    RAGE: (D && D.rage) || { max: 100, minCastInterval: 30, keepAfterCastMax: 40 },
    RAGE_MAX: (D && D.rage && D.rage.max) || 100,
    CHANT: (D && D.chant) || { time: 12, okMul: 1.5, wrongMul: 1 },
    EVO_LV: (D && D.level && D.level.evoLv) || TG.KNIGHT_EVO_LV,
    LEVEL: (D && D.level) || null,              // xpNeed／xpCum／botLvByCleared
    XP: (D && D.xp) || null,
    POINTS_PER_LV: (D && D.level && D.level.pointsPerLevel) || 2,
    UNLOCK_LV: tr.tierLv || [3, 5, 7, 10, 15, 20],
    PATHS: tr.paths || [],
    RULES: tr.rules || {},
    TREE: tr.nodes || [],
    ULTS: (D && D.ults) || { wall: { name: "盾牆", unlock: { lv: 1 } } },
    BADGES: (D && D.badges) || null,            // tiers／phase1／groups（徽章組 A～F）
    CAPS: (D && D.caps) || {},
    TEAM_POWER: (D && D.teamPower) || null
  };
  const K = TG.KNIGHT, R = K.RAGE, CAPS = K.CAPS;
  K.ULT_IDS = Object.keys(K.ULTS).filter(id => K.ULTS[id] && typeof K.ULTS[id] === "object" && K.ULTS[id].name);
  K.CHANT_MODES = ["ask", "auto", "off"];
  K.GOLD_ON = !!(K.BADGES && K.BADGES.phase1 && K.BADGES.phase1.goldEnabled);   // 第 1 期金牌關閉 → fxGold 不會生效
  K.ULT_PATH = { wall: "guard", tense3: "blade", beWrath: "chant" };
  const NODE = {}; for (const n of K.TREE) NODE[n.id] = n;
  const TIER_N = { bronze: 1, silver: 2, gold: 3 };
  const tierNum = t => typeof t === "string" ? (TIER_N[t] || 1) : (t | 0) || 1;
  const keepMax = () => Math.min(R.keepAfterCastMax || 40, CAPS.keepAfterCastMax || 40);
  const castGap = () => Math.max(R.minCastInterval || 30, CAPS.minCastInterval || 0);
  // 本局實際間隔：外掛 fold 掛勾 knightCastGap(間隔, s, idx) 可改（gear「大招專注」：詠唱答對後下一次 −5 秒）
  TG.knightCastGap = s => Math.max(0, +TG.fold("knightCastGap", castGap(), s, 0) || 0);
  const ultCap = () => CAPS.ultScaleMax || 2.5;

  const isBoss = e => !!(TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss);
  const isFly = e => !!(TG.ENEMIES[e.type] && TG.ENEMIES[e.type].fly);
  const isBeMinion = e => !!e.callId || e.type === "beMinion";   // 紅線：絕招一律不碰
  // s.kn 補齊（畫面或測試可能只給 { ult, tree }）；tree／ult 換掉時重算 mods
  const KN_DEF = () => ({ q: [], lastCast: -99, casts: 0, rageLog: { answer: 0, block: 0, infuse: 0, card: 0 }, blockAcc: 0, blockWave: 0, infWave: -1, campWave: -1, beCut: 0,
    lastStandN: 0, standT: 0, critReady: false, critLast: -99, critT: 0, critN: 0, chaseLast: -99, wallT: 0, wallR: 60, wallSelf: 0.5, guardT: 0, hasteT: 0,
    chantVulnT: 0, chantVuln: 0, tierMinNext: 0, chantAdd: 0, tenseAcc: 0, tenseShare: 0.25, tiers: {}, chant: "ask" });
  function KN(s) {
    const kn = s && s.kn; if (!kn || typeof kn !== "object") return null;
    if (!kn._v) { const d = KN_DEF(); for (const k in d) if (kn[k] === undefined || kn[k] === null) kn[k] = d[k]; kn._v = 1; }
    if (!K.ULT_IDS.includes(kn.ult)) kn.ult = "wall";
    if (!kn.tree || typeof kn.tree !== "object") kn.tree = {};
    if (!kn.mods || kn._mt !== kn.tree || kn._mu !== kn.ult) { kn.mods = TG.knightMods(kn.tree, kn.ult, kn.tiers); kn._mt = kn.tree; kn._mu = kn.ult; }
    return kn;
  }
  TG.knightState = KN;
  // 這位英雄這一局用不用怒氣、上限多少（畫面與引擎請改問這個，不要看全域 TG.HEROES.knight.rageMax）
  TG.heroRageMax = (s, idx) => { const h = s && s.heroes && s.heroes[idx || 0]; if (!h) return 0; if ((h.id || "knight") === "knight") return KN(s) ? K.RAGE_MAX : 0; return TG.HEROES[h.id] && TG.HEROES[h.id].rageMax || 0; };
  TG.knightRageOn = s => !!KN(s);
  const knightIdx = s => (s && s.heroes ? s.heroes.findIndex(h => (h.id || "knight") === "knight") : -1);
  const knightOf = s => { const i = knightIdx(s); return i >= 0 ? s.heroes[i] : null; };

  // ═════════ 技能樹（合約 §8.2、§8.3）
  const treeIds = tree => (Array.isArray(tree) ? tree : Object.keys(tree || {}).filter(id => tree[id])).filter(id => NODE[id]);
  // 總技能點：2 ×（lv − 1）＝Lv20 共 38 點（技能點不存檔，用算的）
  TG.knightPoints = lv => K.POINTS_PER_LV * Math.max(0, Math.min(TG.HERO_MAX || 20, lv | 0) - 1);
  TG.knightSpent = tree => treeIds(tree).reduce((a, id) => a + (NODE[id].cost || 0), 0);
  TG.knightPointsLeft = (tree, lv) => TG.knightPoints(lv) - TG.knightSpent(tree);
  // 徽章組（A～F）裡達到 tier 的文法點數（qkinds 有就用它）
  const groupCount = (tiers, gid, tier) => {
    if (TG.badgeSetCount) return TG.badgeSetCount(tiers || {}, gid, tier);
    const g = K.BADGES && (K.BADGES.groups || []).find(x => x.id === gid), need = tierNum(tier);
    return g ? g.members.filter(gp => ((tiers || {})[gp] || 0) >= need).length : 0;
  };
  const badgeOk = (n, tiers) => !n.badge || groupCount(tiers, n.badge.group, n.badge.tier) >= (n.badge.n || 1);
  // 合法的 tree：依 tier 由低到高收（同層主線先、徽章節點後）；等級不夠／前置沒學／徽章不夠／點數不夠／終極超過上限 → 退掉
  TG.knightValid = function (tree, lv, tiers) {
    const ids = treeIds(tree).map((id, i) => ({ id, i, n: NODE[id] }));
    ids.sort((a, b) => a.n.tier - b.n.tier || (a.n.badge ? 1 : 0) - (b.n.badge ? 1 : 0) || a.i - b.i);
    const out = {}, capLim = (K.RULES.capstoneLimit === undefined ? 1 : K.RULES.capstoneLimit);
    let left = TG.knightPoints(lv), caps = 0;
    for (const { id, n } of ids) {
      if (out[id] || (lv | 0) < n.lv || (n.need && !out[n.need]) || !badgeOk(n, tiers) || n.cost > left || (n.capstone && caps >= capLim)) continue;
      out[id] = 1; left -= n.cost; if (n.capstone) caps++;
    }
    return out;
  };
  TG.knightCanLearn = (tree, id, lv, tiers) => {
    if (!NODE[id] || (tree && tree[id])) return false;
    const t = Object.assign({}, TG.knightValid(tree, lv, tiers)); t[id] = 1;
    const v = TG.knightValid(t, lv, tiers);
    return Object.keys(t).every(k => v[k]);   // 學得起來，而且不會把已學的擠掉
  };
  TG.knightLearn = (tree, id, lv, tiers) => { if (!TG.knightCanLearn(tree, id, lv, tiers)) return false; tree[id] = 1; return true; };
  TG.knightReset = tree => { const n = TG.knightSpent(tree); for (const k of Object.keys(tree || {})) delete tree[k]; return n; };   // 重置免費
  // 第一次開技能樹（3 級）自動點三條路線第一格（json.tree.rules.autoFirstTime）；回傳有沒有點
  TG.knightAutoFirst = function (tree, lv, tiers) {
    if (!tree || treeIds(tree).length || (lv | 0) < (K.UNLOCK_LV[0] || 3)) return false;
    let any = false; for (const id of K.RULES.autoFirstTime || []) if (TG.knightLearn(tree, id, lv, tiers)) any = true;
    return any;
  };
  // 參考配置／機器人用：照路線順序點主線（不含徽章節點）
  TG.knightRefTree = function (lv, order) {
    order = order || ["guard", "blade", "chant"];
    const tree = {}, capLim = (K.RULES.capstoneLimit === undefined ? 1 : K.RULES.capstoneLimit);
    let left = TG.knightPoints(lv), caps = 0;
    for (const p of order) for (const n of K.TREE.filter(x => x.path === p && !x.badge).sort((a, b) => a.tier - b.tier)) {
      if ((lv | 0) < n.lv || n.cost > left || (n.need && !tree[n.need]) || (n.capstone && caps >= capLim)) continue;
      tree[n.id] = 1; left -= n.cost; if (n.capstone) caps++;
    }
    return tree;
  };

  // ═════════ 絕招解鎖（json.ults[id].unlock）
  const condOk = (c, lv, tiers, cleared) => {
    if (!c) return true;
    if (c.lv !== undefined && (lv | 0) < c.lv) return false;
    if (c.stageCleared !== undefined && (cleared === undefined || cleared === null || cleared < c.stageCleared)) return false;
    if (c.badgeGroupAny && c.badgeGroupAny.reduce((a, g) => a + groupCount(tiers, g, c.tier), 0) < (c.n || 1)) return false;
    if (c.badgeAll && !c.badgeAll.every(gp => ((tiers || {})[gp] || 0) >= tierNum(c.tier))) return false;
    return true;
  };
  TG.knightUltOk = function (id, lv, tiers, cleared) {
    const u = K.ULTS[id]; if (!u || !K.ULT_IDS.includes(id)) return false;
    const un = u.unlock || {};
    if (un.lv !== undefined && (lv | 0) < un.lv) return false;
    return un.any ? un.any.some(c => condOk(c, lv, tiers, cleared)) : true;
  };
  TG.knightUltsUnlocked = (lv, tiers, cleared) => K.ULT_IDS.filter(id => TG.knightUltOk(id, lv, tiers, cleared));

  // ═════════ 節點效果彙整 → s.kn.mods
  // 合併規則：*Add、加法池（hpMul dmgAdd bossDmgAdd block regenAdd keepAfterCast）相加；乘數（cdMul regenMul answerMul mul radiusMul countsAsMul）相乘；
  //   受傷倍率（selfDamageTaken damageTaken）取小；其餘數值取大；布林取或；物件逐層合併。
  const SUM = new Set(["hpMul", "dmgAdd", "bossDmgAdd", "block", "regenAdd", "keepAfterCast"]);
  const MUL = new Set(["cdMul", "regenMul", "answerMul", "mul", "radiusMul", "countsAsMul"]);
  const MIN = new Set(["selfDamageTaken", "damageTaken"]);
  function mergeFx(dst, src) {
    for (const k of Object.keys(src || {})) {
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)) dst[k] = mergeFx(dst[k] && typeof dst[k] === "object" ? dst[k] : {}, v);
      else if (typeof v === "number") {
        const d = dst[k];
        dst[k] = typeof d !== "number" ? v : (SUM.has(k) || /Add$/.test(k)) ? d + v : MUL.has(k) ? d * v : MIN.has(k) ? Math.min(d, v) : Math.max(d, v);
      } else if (typeof v === "boolean") dst[k] = !!dst[k] || v;
      else dst[k] = v;
    }
    return dst;
  }
  const ultKeyOf = u => u ? ["wall", "tense3", "beWrath"].find(k => u[k]) || null : null;
  TG.knightMods = function (tree, ult, tiers) {
    const C = K.CHANT, B = R.block || { perSec: 1, capPerWave: 15 };
    const M = {
      stat: { hpMul: 0, dmgAdd: 0, bossDmgAdd: 0, cdMul: 1, block: 0, regenAdd: 0, regenMul: 1, pierce: 0, fly: false },
      rage: { answerMul: 1, blockPerSec: B.perSec, blockCap: B.capPerWave, keepAfterCast: 0 },
      chant: { time: C.time, okMul: C.okMul, wrongMul: C.wrongMul, perfectRefund: 0, perfectTier: 0 },
      ult: { wall: {}, tense3: {}, beWrath: {}, any: {} }, rule: {}, nodes: []
    };
    const goldN = (K.BADGES && K.BADGES.groupRules && K.BADGES.groupRules.goldNode && K.BADGES.groupRules.goldNode.n) || 2;
    for (const id of treeIds(tree)) {
      const n = NODE[id]; let fx = n.fx || {};
      if (K.GOLD_ON && n.badge && n.fxGold && groupCount(tiers, n.badge.group, "gold") >= goldN) fx = n.fxGold;
      else if (n.fxAlt && fx.ult && ultKeyOf(fx.ult) && ultKeyOf(fx.ult) !== ult) fx = n.fxAlt;   // 沒裝這招 → 替代效果（點數不浪費）
      for (const op of ["stat", "rage", "chant", "rule"]) if (fx[op]) mergeFx(M[op], fx[op]);
      if (fx.ult) for (const k of Object.keys(fx.ult)) M.ult[k] = mergeFx(M.ult[k] || {}, fx.ult[k]);
      M.nodes.push(id);
    }
    M.rage.keepAfterCast = Math.min(keepMax(), M.rage.keepAfterCast);
    if (M.ult.any.castWall && ult === "wall") delete M.ult.any.castWall;   // 裝盾牆時城牆之誓改成盾牆 +2 秒、半徑 +20（已在 M.ult.wall）
    return M;
  };

  // ═════════ 怒氣（合約 §8.2；json.rage）
  const RAGE_WHY = { answer: 1, block: 1, infuse: 1, card: 1 };   // card＝營地增益卡（答營地題換來的）；其他來源一律拒絕（紅線）
  TG.knightAddRage = function (s, n, why) {
    const kn = KN(s), h = knightOf(s);
    if (!kn || !h || !RAGE_WHY[why] || !(n > 0)) return 0;
    const v0 = h.rage || 0; h.rage = Math.min(K.RAGE_MAX, v0 + n);
    const d = h.rage - v0; kn.rageLog[why] = (kn.rageLog[why] || 0) + d;
    if (d && why !== "block") s.events.push({ k: "knightRage", d, why, v: h.rage });
    return d;
  };
  // 這題該給多少怒氣（純函式；答錯、詠唱題、舊答題大招題＝0）
  TG.knightRageFor = function (s, ok, info) {
    if (!ok) return 0;
    info = info || {};
    const src = info.src, kind = info.kind || (info.word ? "word" : "mcq");
    if (src === "chant" || src === "ult") return 0;
    const G = R.gain || {}, F = R.feverGain || {}, fev = TG.feverOn(s);
    let v;
    if (kind === "word" || info.word) v = fev ? F.wordBullet : G.wordBullet;
    else if (info.try === 2 || info.retry || (s && s.retryNext)) v = fev ? F.choiceRetry : G.choiceRetry;
    else if (src === "camp" || src === "campReroll" || src === "prep" || info.prep) v = fev ? F.other : G.camp;
    else if (kind === "spell" || kind === "fix" || kind === "order") v = fev ? F.other : G[kind];
    else if (src === "be") v = fev ? F.other : G.be;
    else v = fev ? F.choiceFirst : G.choiceFirst;
    const kn = KN(s), mul = kn ? kn.mods.rage.answerMul : 1;
    return Math.round((v || 0) * mul);
  };
  // 灌注：花能量換怒氣，每波 1 次（json.rage.infuse；費用走 TG.energyCost("infuse")）
  TG.knightCanInfuse = s => { const h = knightOf(s); return !!(KN(s) && h && s.kn.infWave !== s.wave && (h.rage || 0) < K.RAGE_MAX && TG.canSpend(s, TG.energyCost("infuse", s))); };
  TG.knightInfuse = function (s) {
    if (!TG.knightCanInfuse(s) || !TG.spendEnergy(s, TG.energyCost("infuse", s), "infuse")) return false;
    s.kn.infWave = s.wave; TG.knightAddRage(s, (R.infuse && R.infuse.rage) || 20, "infuse"); return true;
  };

  // ═════════ 施放：間隔、詠唱、演出等級（合約 §8.2）
  TG.knightCastWait = s => { const kn = KN(s); return kn && typeof kn.lastCast === "number" ? Math.max(0, TG.knightCastGap(s) - ((s.time || 0) - kn.lastCast)) : 0; };
  TG.knightReady = function (s) {
    const h = knightOf(s);
    return !!(KN(s) && h && h.dead <= 0 && (h.rage || 0) >= K.RAGE_MAX && TG.knightCastWait(s) <= 0);
  };
  // 引擎的 heroUltReady／heroCast／heroUlt 都經過 TG.heroUltReady → 騎士（有 s.kn）一律改問 knightReady（30 秒間隔在這裡擋）
  const baseReady = TG.heroUltReady;
  TG.heroUltReady = function (s, idx) {
    const h = s && s.heroes && s.heroes[idx || 0];
    if (h && (h.id || "knight") === "knight") return s.kn ? TG.knightReady(s) : (h.dead <= 0 && h.ultCd <= 0);   // 有沒有怒氣只看 s.kn，不看全域 rageMax
    return baseReady(s, idx);
  };
  const pathGold = kn => {
    if (!K.GOLD_ON || !K.BADGES) return false;
    const p = K.ULT_PATH[kn.ult];
    return (K.BADGES.groups || []).some(g => g.path === p && groupCount(kn.tiers, g.id, "gold") >= 1);
  };
  // 演出等級：1 直接放；2 詠唱答對；3 詠唱答對且（狂熱中 或 魔王在場 或 對應路線徽章組有金牌）。只影響演出、不影響傷害。
  //   狂熱還沒開（TG.FEVER.on=false）時用「連對 ≥ FEVER.need」代替狂熱（DESIGN：連對越多等級越高）。
  TG.knightTier = function (s, chantOk, o) {
    o = o || {}; const kn = KN(s);
    let t = chantOk ? 2 : 1;
    if (chantOk && s) {
      const fever = TG.feverOn(s) || (!TG.FEVER.on && (s.comboFresh || 0) >= TG.FEVER.need);
      if (fever || (s.enemies || []).some(isBoss) || (kn && pathGold(kn))) t = 3;
    }
    if (kn && kn.tierMinNext) t = Math.max(t, kn.tierMinNext);
    if (o.perfect && kn && kn.mods.chant.perfectTier) t = Math.max(t, kn.mods.chant.perfectTier);
    return Math.max(1, Math.min(3, t));
  };
  // 詠唱計畫（畫面問）：can＝題量預算還夠（不夠只能直接放）、time＝倒數秒、questions＝1 或 2（連珠詠唱）
  TG.knightChantPlan = function (s) {
    const M = KN(s) ? s.kn.mods.chant : K.CHANT;
    return { can: TG.qCanAsk(s, "fill", "chant"), time: M.time, questions: M.extraQ ? 2 : 1, okMul: M.okMul, wrongMul: M.wrongMul, kinds: K.CHANT.kinds || ["fill"] };
  };
  // 詠唱結果 → 倍率與演出：oks＝[第 1 題對錯, 第 2 題對錯?]；null／[]＝直接放
  //   s.kn.chantAdd：營地卡「詠唱加成」（第 1 組卡片 op 設；答對倍率 +add，封頂 2.0）
  TG.knightChantResult = function (s, oks) {
    const M = KN(s) ? s.kn.mods.chant : K.CHANT;
    if (!oks || !oks.length) return { mul: 1, tier: TG.knightTier(s, false), perfect: false, refund: 0, chant: false };
    const a = !!oks[0], okMul = Math.max(M.okMul, Math.min(2, M.okMul + ((s && s.kn && s.kn.chantAdd) || 0)));
    let mul, perfect = false;
    if (!a) mul = M.wrongMul;
    else if (M.extraQ && oks.length >= 2) { perfect = !!oks[1]; mul = perfect ? Math.max(okMul, M.extraQ.bothOkMul) : okMul; }
    else mul = okMul;
    mul = Math.min(ultCap(), mul);
    return { mul, tier: TG.knightTier(s, a, { perfect }), perfect, refund: perfect ? (M.perfectRefund || 0) : 0, chant: true };
  };
  // 放絕招（畫面與機器人共用）：詠唱題由畫面先答完（answerResult 帶 src:"chant"，不加怒氣）再呼叫這裡
  TG.knightCast = function (s, oks, idx) {
    if (!TG.knightReady(s)) return false;
    const r = TG.knightChantResult(s, oks), i = idx === undefined ? knightIdx(s) : idx;
    if (!TG.heroCast(s, i, r.mul, { tier: r.tier, refund: r.refund, chant: r.chant, perfect: r.perfect })) return false;
    s.kn.tierMinNext = 0;
    return r;
  };

  // ═════════ 三招（合約 §8.2：ultFx 分派器；p＝1 直接放、1.5 詠唱答對…）
  const baseUltFx = TG.HEROES.knight.ultFx;
  TG.HEROES.knight.ultFx = function (s, h, p, info) {
    if (!KN(s)) { const r = baseUltFx(s, h, p, info); if (TG.HEROES.knight.ultCd) h.ultCd = Math.max(h.ultCd || 0, TG.HEROES.knight.ultCd); return r; }   // 舊流程：一律照舊冷卻（引擎 heroCast 若走了 rageMax 分支也補回）
    let pc = p === undefined ? 1 : p;
    // 舊的答題大招 TG.heroUlt（不傳 info）＝答 1 題的詠唱：答對 okMul、答錯 wrongMul（v3 答錯不減半）
    if (info === undefined) pc = pc >= 1 ? s.kn.mods.chant.okMul : s.kn.mods.chant.wrongMul;
    else pc = Math.max(1, pc);
    castUlt(s, h, pc, info || {});
  };
  function castUlt(s, h, pc, info) {
    const kn = s.kn, M = kn.mods, ult = kn.ult, U = M.ult[ult] || {}, any = M.ult.any || {};
    kn.lastCast = s.time; kn.casts++;
    h.rage = Math.min(K.RAGE_MAX, Math.min(keepMax(), (M.rage.keepAfterCast || 0) + (info.refund || 0)));   // 放完歸零或保留，合計 ≤40
    const counts = U.countsAsMul || 1, pChant = Math.min(ultCap(), pc);
    const ctx = {
      s, h, kn, U, any, ult, castId: kn.casts, t0: s.time,
      tier: Math.max(1, Math.min(3, info.tier || 1)), stage: TG.heroEvo(h),
      scale: Math.min(ultCap(), pc * (U.mul || 1) * counts) / counts,   // 節點倍率（b4 1.25）直接乘；countsAsMul 只算進封頂
      Pc: 1 + 0.5 * (pChant - 1),
      dmg: ((h.st && h.st.dmg) || TG.HEROES.knight.stats(h.lv).dmg) * TG.powMul(s)
    };
    kn.lastScale = ctx.scale;
    ULT[ult](ctx);
    if (any.castWall) openWall(s, h, any.castWall, (K.ULTS.wall || {}).radius || 60, (K.ULTS.wall || {}).selfDamageTaken || 0.5);
    if (any.afterCastGuard) kn.guardT = any.afterCastGuard.time || 0;
    if (any.afterCastHaste) kn.hasteT = any.afterCastHaste.time || 0;
    if (any.afterCastCrit) { kn.critT = any.afterCastCrit.time || 0; kn.critN = 0; }
  }
  // 絕招打一隻怪：Be 小怪不打（紅線）；字盾照引擎規則減傷、不會被拿掉
  function ultHurt(ctx, e, mul, fly) {
    const s = ctx.s;
    if (isBeMinion(e) || s.enemies.indexOf(e) < 0 || (!fly && isFly(e))) return false;
    const hp0 = e.hp;
    TG._hurt(s, e, ctx.dmg * mul * ctx.scale, true);
    ctx.kn.ultDmg = (ctx.kn.ultDmg || 0) + Math.max(0, hp0 - Math.max(0, e.hp));   // 統計（結算、平衡模擬用）
    const ab = ctx.any.armorBreak;
    if (ab && s.enemies.indexOf(e) >= 0) { e.knBrkT = Math.max(e.knBrkT || 0, ab.time || 0); e.knBrk = Math.abs(ab.armor || 0); applyArmor(e); }
    return true;
  }
  const stunFor = (ctx, e, base, cap) => Math.min(cap || 2, base * ctx.Pc) * (isBoss(e) ? 0.3 : 1);
  const tgt = e => ({ x: e.x, y: e.y, id: e.id });
  function ultEvent(ctx, hit, n, targets, text, extra) {
    ctx.s.events.push(Object.assign({ k: "knightUlt", ult: ctx.ult, hit, n, x: ctx.h.x, y: ctx.h.y, tier: ctx.tier, stage: ctx.stage, targets, text, castId: ctx.castId, at: +(ctx.s.time - ctx.t0).toFixed(3) }, extra || {}));
  }
  function openWall(s, h, dur, r, self) {
    const kn = s.kn;
    h.wallT = Math.max(h.wallT || 0, dur); kn.wallT = Math.max(kn.wallT || 0, dur); kn.wallR = r; kn.wallSelf = self;
  }
  function applyArmor(e) {
    if (e._knArm0 === undefined) e._knArm0 = e.armor || 0;
    e.armor = (e.knArmT > 0) ? 0 : Math.max(0, e._knArm0 - ((e.knBrkT > 0) ? (e.knBrk || 0) : 0));
  }
  const ULT = {
    // 盾牆：半徑內地面怪全部擋住（不限擋怪數）、騎士受傷減半；開場重擊（穿甲）
    wall(ctx) {
      const { s, h, U } = ctx, W = K.ULTS.wall;
      const r = (U.radius !== undefined ? U.radius : W.radius) + (U.radiusAdd || 0);
      const dur = Math.min(W.durationCap || 10, (W.duration + (U.durationAdd || 0)) * (W.durationScale === "Pc" ? ctx.Pc : 1));
      const self = Math.min(W.selfDamageTaken, U.selfDamageTaken !== undefined ? U.selfDamageTaken : W.selfDamageTaken);
      openWall(s, h, dur, r, self);
      const hit = [];
      for (const e of s.enemies.slice()) if (!isFly(e) && H(e.x - h.x, e.y - h.y) <= r) { const p = tgt(e); if (ultHurt(ctx, e, W.strike.mul, false)) hit.push(p); }
      ultEvent(ctx, 0, 1, hit, "STOP", { radius: r, dur });
    },
    // 時態三連斬：三刀排進 s.kn.q，依遊戲時間結算（json.ults.tense3.hitAt 依演出等級，對齊 KnightFX 刀光）
    tense3(ctx) {
      const T = K.ULTS.tense3, U = ctx.U, hits = T.hits.slice();
      if (U.extraHit) hits.push(U.extraHit);
      const tab = (T.hitAt && T.hitAt[ctx.tier]) || [], n = hits.length;
      ctx.kn.q = ctx.kn.q.concat(hits.map((hd, i) => ({ at: tab[i] !== undefined ? tab[i] : (T.duration || 0.6) * i / Math.max(1, n - 1), i, n, hd, ctx })));
      runQueue(ctx.s);
    },
    // Be 之怒：am／is／are 三圈各打一次、全部暈眩、護甲歸零；Be 巨人額外扣最大血（每關上限）
    beWrath(ctx) {
      const { s, h, U, kn } = ctx, B = K.ULTS.beWrath, rm = U.radiusMul || 1;
      const stun = U.stun !== undefined ? U.stun : B.stun, armT = U.armorZeroTime !== undefined ? U.armorZeroTime : B.armorZeroTime;
      const rings = B.rings || [];
      let outer = 0;
      rings.forEach((rg, i) => {
        const r = rg.radius * rm, hit = []; outer = Math.max(outer, r);
        for (const e of s.enemies.slice()) if (H(e.x - h.x, e.y - h.y) <= r) { const p = tgt(e); if (ultHurt(ctx, e, rg.mul, B.fly !== false)) hit.push(p); }
        ultEvent(ctx, i, rings.length, hit, rg.label, { radius: r });
      });
      for (const e of s.enemies) {
        if (isBeMinion(e) || H(e.x - h.x, e.y - h.y) > outer) continue;
        e.frozenT = Math.max(e.frozenT || 0, stunFor(ctx, e, stun, B.stunCap));
        if (armT) { e.knArmT = Math.max(e.knArmT || 0, armT); applyArmor(e); }
      }
      const per = B.beBossCutPerStage || 0;
      for (const e of s.enemies.slice()) {
        if (kn.beCut >= per) break;
        const b = TG.ENEMIES[e.type] || {};
        if (b.mech === "be" && H(e.x - h.x, e.y - h.y) <= outer) { TG._hurt(s, e, e.maxHp * (B.beBossMaxHpCut || 0), true); kn.beCut++; }
      }
    }
  };
  // 三連斬每一刀
  function tenseHit(job) {
    const { ctx, hd, i, n } = job, { s, h, U } = ctx, hit = [];
    const inR = r => s.enemies.filter(e => !isBeMinion(e) && (hd.fly !== false || !isFly(e)) && H(e.x - h.x, e.y - h.y) <= r);
    if (hd.onlyMarked) {
      for (const e of inR(hd.radius).filter(e => e.knVulnT > 0)) { const p = tgt(e); if (ultHurt(ctx, e, hd.mul, true)) hit.push(p); }
    } else if (hd.targets) {
      const nT = Math.max(hd.targets, U.futureTargets || 0);
      const list = inR(hd.radius).sort((a, b) => (isBoss(b) - isBoss(a)) || b.hp - a.hp).slice(0, nT);
      const vuln = U.vuln !== undefined ? U.vuln : hd.vuln, vt = U.vulnTime !== undefined ? U.vulnTime : hd.vulnTime;
      for (const e of list) {
        const p = tgt(e);
        if (!ultHurt(ctx, e, hd.mul, true)) continue;
        hit.push(p);
        if (vuln && s.enemies.indexOf(e) >= 0) { e.knVuln = Math.max(e.knVulnT > 0 ? e.knVuln || 0 : 0, vuln); e.knVulnT = Math.max(e.knVulnT || 0, vt || 0); }
      }
    } else {
      for (const e of inR(hd.radius)) {
        const p = tgt(e);
        if (!ultHurt(ctx, e, hd.mul, true)) continue;
        hit.push(p);
        if (s.enemies.indexOf(e) < 0) continue;
        if (hd.pushBack) e.d = Math.max(0, e.d - (isBoss(e) ? (hd.pushBackBoss || 0) : hd.pushBack));
        if (hd.stun) e.frozenT = Math.max(e.frozenT || 0, stunFor(ctx, e, hd.stun, hd.stunCap));
      }
    }
    ultEvent(ctx, i, n, hit, hd.label, { radius: hd.radius });
  }
  function runQueue(s) {
    const kn = KN(s); if (!kn || !kn.q.length) return;
    const due = kn.q.filter(j => s.time - j.ctx.t0 >= j.at - 1e-9);
    if (!due.length) return;
    kn.q = kn.q.filter(j => due.indexOf(j) < 0);
    due.sort((a, b) => a.at - b.at || a.i - b.i).forEach(tenseHit);
  }

  // ═════════ 經驗（合約 §8.2、§8.5；json.level／json.xp）
  TG.knightXpNeed = lv => { const L = K.LEVEL; if (!L) return TG.heroXpNeed(lv); return lv >= L.max ? Infinity : (L.xpNeed[lv] || Infinity); };
  const costPt = (info, kind) => { const k = kind === "spell" || kind === "fix" || kind === "order" || kind === "word" ? kind : ((info && info.qk) || "fill"); return TG.qCost(k); };
  // 這題的英雄經驗＝perCostPoint × 題目成本點 × 第一次 1／第二次 0.5（＋復仇題）；答錯 0；每天前 dailyQuota 點全額、之後半額
  TG.knightXpFor = function (info, ok, dayAx) {
    const X = K.XP; if (!X || !ok) return 0;
    info = info || {};
    const kind = info.kind || (info.word ? "word" : "mcq"), second = info.try === 2 || !!info.retry;
    let raw;
    if (kind === "word") raw = second ? 0 : (X.wordBulletFirstHit || 0);
    else raw = X.perCostPoint * costPt(info, kind) * (second ? X.retryMul : X.firstTryMul) + (info.revenge ? (X.revengeBonus || 0) : 0);
    const Q = X.dailyQuota || { fullAnswerXp: Infinity, afterMul: 1 }, used = Math.max(0, +dayAx || 0);
    const full = Math.max(0, Math.min(raw, Q.fullAnswerXp - used));
    return Math.round(full + (raw - full) * Q.afterMul);
  };
  TG.knightXp = (rightN, dayAx) => { let ax = +dayAx || 0, t = 0; for (let i = 0; i < (rightN | 0); i++) { const x = TG.knightXpFor({ kind: "mcq" }, true, ax); ax += x; t += x; } return t; };   // 空殼相容
  TG.knightDayKey = d => { d = d || new Date(); const p = n => (n < 10 ? "0" : "") + n; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  // 畫面每題呼叫：更新 hero.day（本地日期換日）、加經驗、升級；回傳 { xp, ups }
  TG.knightGainXp = function (hero, info, ok, now) {
    const key = TG.knightDayKey(now);
    if (!hero.day || hero.day.d !== key) hero.day = { d: key, ax: 0 };
    const xp = TG.knightXpFor(info, ok, hero.day.ax);
    hero.day.ax += xp; hero.xp = (hero.xp || 0) + xp;
    return { xp, ups: TG.knightLevelUp(hero) };
  };
  // 過關獎勵經驗（不吃每日額度）：o = { won, firstClear, heroic, practice, endlessWave }
  TG.knightStageXp = function (stars, o) {
    const X = K.XP; if (!X) return 0;
    o = o || {};
    if (o.endlessWave) return Math.min(X.endless.max, X.endless.perWave * o.endlessWave);
    if (o.won === false) return X.stage.lose || 0;
    const S = X.stage;
    let xp = S.winBase + S.perStar * Math.max(0, Math.min(3, stars | 0)) + (o.firstClear ? S.firstClear : 0) + (o.heroic ? S.heroic : 0);
    if (o.practice) xp *= S.practiceStageMul;
    return Math.round(xp);
  };
  TG.knightLevelUp = function (hero) {
    const max = (K.LEVEL && K.LEVEL.max) || TG.HERO_MAX || 20; let ups = 0;
    hero.lv = Math.max(1, hero.lv | 0); hero.xp = Math.max(0, +hero.xp || 0);
    while (hero.lv < max && hero.xp >= TG.knightXpNeed(hero.lv)) { hero.xp -= TG.knightXpNeed(hero.lv); hero.lv++; ups++; }
    if (hero.lv >= max) hero.xp = 0;
    return ups;
  };
  TG.knightDailyRewardXp = streak => { const r = K.XP && K.XP.dailyReward; return r ? Math.min(r.max, r.base + r.perDay * Math.max(0, streak | 0)) : 0; };

  // ═════════ 戰力（合約 §8.2a；json.teamPower）— 一律用「標準作答」估，不看本局答得多好
  const TP = () => K.TEAM_POWER || {};
  const ULT_BASE = { wall: 33, tense3: 34, beWrath: 36 };
  function buildOf(x) {
    if (x && x.heroes) {
      const h = knightOf(x) || { lv: 1 }, kn = x.kn;
      return { lv: h.lv, tree: kn ? kn.tree : {}, ult: kn ? kn.ult : "wall", tiers: kn ? kn.tiers : {}, gear: Object.keys(x.gearOn || {}), gearLv: x.gearLv || {},
        cleared: x.stage ? x.stage.i : 0, comps: x.heroes.filter(o => (o.id || "knight") !== "knight"), summons: x.summons || {} };
    }
    x = x || {};
    return { lv: x.lv || 1, tree: x.tree || {}, ult: x.ult || "wall", tiers: x.tiers || {}, gear: x.gear || [], gearLv: x.gearLv || {}, cleared: x.cleared || 0, comps: x.comps || [], summons: x.summons || {} };
  }
  // 騎士本身的標準戰力（A＋U）×F；o.noBadge／noStars＝R 用（不算徽章節點與金牌、不算裝備星數）
  function knightPower(b, o) {
    o = o || {};
    let tree = TG.knightValid(b.tree, b.lv, o.noBadge ? {} : b.tiers);
    if (o.noBadge) tree = Object.fromEntries(Object.keys(tree).filter(id => !NODE[id].badge).map(id => [id, 1]));
    const M = TG.knightMods(tree, b.ult, o.noBadge ? {} : b.tiers), st = TG.HEROES.knight.stats(b.lv);
    const SA = TP().standardAnswering || { perMin: 4, firstTry: 0.65 }, a = SA.firstTry;
    const g = {}; for (const id of b.gear || []) g[id] = 1;
    const gk = id => o.noStars ? 0 : Math.max(0, Math.min(2, ((b.gearLv || {})[id] | 0 || 1) - 1));
    const tenseShare = 0.3;
    const weapon = g.sword ? 1 + Math.min(1, SA.perMin * a * tenseShare * (10 + 3 * gk("sword")) / 60) : 1;
    const spdE = g.dagger ? 1 + (1 / (0.5 - 0.05 * gk("dagger")) - 1) * 0.45 : 1;
    const chain = g.ring ? (0.6 + 0.2 * gk("ring")) * 0.5 : 0;
    const hit = Math.min(CAPS.atkHitMulMax || 3, weapon * (1 + M.stat.dmgAdd + M.stat.bossDmgAdd * 0.2));
    const cd = st.cd * M.stat.cdMul, spd = Math.min(CAPS.atkSpeedMulMax || 2.8, spdE);
    let A = st.dmg * hit / cd * spd * (1 + chain) * 0.6;
    if (M.rule.tenseCrit) A *= 1 + (M.rule.tenseCrit.mul - 1) * Math.min(1, cd / M.rule.tenseCrit.every) * 0.5;
    if (M.rule.killChase) A *= 1 + 0.15 * M.rule.killChase.mul;
    const rpm = 59 * M.rage.answerMul + Math.min(M.rage.blockCap, 40 * M.rage.blockPerSec) * 0.75;
    const interval = Math.max(castGap(), 60 * (K.RAGE_MAX - Math.min(keepMax(), M.rage.keepAfterCast)) / rpm);
    const C = M.chant, ex = C.extraQ ? a * C.extraQ.bothOkMul + (1 - a) * C.okMul : C.okMul;
    const chantStd = SA.chantAlways === false ? 1 : a * ex + (1 - a) * C.wrongMul;
    const U0 = M.ult[b.ult] || {}, any = M.ult.any || {};
    let U = (ULT_BASE[b.ult] || 33) * st.dmg * Math.min(ultCap(), (U0.mul || 1) * (U0.countsAsMul || 1) * chantStd) / interval;
    if (U0.futureTargets) U *= 1.1;
    if (b.ult === "wall" && (U0.radius > 60 || U0.radiusAdd || U0.durationAdd)) U *= 1 + 0.05 * ((U0.durationAdd || 0) + (U0.radiusAdd || 0) / 10 + (U0.radius > 60 ? 1 : 0));
    if (any.armorBreak) U *= 1.05;
    if (any.afterCastHaste) A *= 1 + (1 / any.afterCastHaste.cdMul - 1) * any.afterCastHaste.time / interval;
    if (any.afterCastCrit) A *= 1 + (any.afterCastCrit.mul - 1) / any.afterCastCrit.everyNth * any.afterCastCrit.time / interval;
    let extraBlock = M.stat.block + (M.rule.standGuard ? (M.rule.standGuard.block || 0) * 0.5 : 0);
    if (any.afterCastGuard) extraBlock += (any.afterCastGuard.block || 0) * any.afterCastGuard.time / interval;
    let effHp = (1 + M.stat.hpMul) / (g.plate ? 1 - (0.5 + 0.08 * gk("plate")) : 1);
    if (M.rule.lastStand) effHp *= 1.15;
    if (any.castWall) effHp *= 1.05;
    const F = (1 + 0.15 * extraBlock) * Math.pow(effHp, 0.3);
    return { A, U, F, interval, chantStd, power: (A + U) * F };
  }
  TG.knightPowerParts = (x, o) => knightPower(buildOf(x), o);
  // 顯示用戰力（含一切：徽章、金牌、裝備星數、同伴、召喚獸）
  TG.knightPowerDisplay = function (x) {
    const b = buildOf(x); let p = knightPower(b).power;
    for (const c of b.comps) { const def = TG.HEROES[c.id]; if (!def) continue; const st = def.stats(c.lv || 1); p += st.dmg / st.cd * 0.6 + st.dmg * 2 / (def.ultCd || 30); }
    for (const id of Object.keys(b.summons)) p += 3 * (1 + 0.1 * ((b.summons[id] || 1) - 1));
    return Math.round(p);
  };
  // 參考配置的裝備：TG.gearBotLoadout(通關數)，件數跟你一樣（★1）
  const refGear = (cleared, n) => {
    const base = TG.gearBotLoadout ? TG.gearBotLoadout(cleared).gear.slice() : [], out = [], slots = {};
    for (const id of base.concat(["dagger", "plate", "glove"])) {
      if (out.length >= n) break;
      const sl = TG.GEAR && TG.GEAR[id] ? TG.GEAR[id].slot : id;
      if (!slots[sl] && out.indexOf(id) < 0) { slots[sl] = 1; out.push(id); }
    }
    return out;
  };
  // 配裝倍率 R＝你的配置 ÷ 同等級、同裝備件數的參考配置（都不算徽章節點、金牌、裝備星數；等級用你的實際等級）
  TG.knightBuildR = function (x) {
    const b = buildOf(x), o = { noBadge: true, noStars: true };
    const ref = { lv: b.lv, tree: TG.knightRefTree(b.lv), ult: "wall", tiers: {}, gear: refGear(b.cleared, (b.gear || []).length), gearLv: {} };
    const p0 = knightPower(ref, o).power;
    return p0 > 0 ? knightPower(b, o).power / p0 : 1;
  };
  // 加難用：powerHpMul = 1 + U[區] × clamp((R − 1.15) ÷ 0.35, 0, 1)；英雄挑戰、鐵人、騎士試煉不加（給第 1 組接 TG.powerHpMul）
  TG.knightPowerHpMul = function (s) {
    if (!s || !s.stage || s.heroic || s.noPowerUp || s.trial) return 1;
    const u = (TP().U_byRegion || [])[s.stage.r] || 0; if (!u) return 1;
    if (s.knR === undefined) s.knR = TG.knightBuildR(s);
    return 1 + u * clamp((s.knR - 1.15) / 0.35, 0, 1);
  };
  TG.knightPowerMul = TG.knightPowerHpMul;   // 空殼舊名（合約 §10）

  // ═════════ 存檔遷移（合約 §8.5）：補 S.hero.day、S.mods.knight，S.ver = 4
  TG.knightSaveDefault = () => ({ v: 1, tree: {}, ult: "wall", chant: "ask", seenEvo: 0 });
  TG.knightMigrate = function (S) {
    if (!S || typeof S !== "object") return S;
    if (!S.hero || typeof S.hero !== "object" || Array.isArray(S.hero)) S.hero = { lv: 1, xp: 0 };
    const max = (K.LEVEL && K.LEVEL.max) || TG.HERO_MAX || 20, h = S.hero;
    h.lv = Math.max(1, Math.min(max, Math.floor(+h.lv) || 1));   // 不降級
    const need = TG.knightXpNeed(h.lv), xp = Math.floor(+h.xp);
    h.xp = h.lv >= max || !Number.isFinite(xp) || xp < 0 ? 0 : Math.min(xp, Number.isFinite(need) ? need - 1 : xp);
    const dy = h.day;
    if (!dy || typeof dy !== "object" || Array.isArray(dy)) h.day = { d: "", ax: 0 };
    else { dy.d = typeof dy.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dy.d) ? dy.d : ""; const ax = +dy.ax; dy.ax = Number.isFinite(ax) && ax > 0 ? ax : 0; }
    if (!S.mods || typeof S.mods !== "object" || Array.isArray(S.mods)) S.mods = {};
    let m = S.mods.knight;
    if (!m || typeof m !== "object" || Array.isArray(m)) m = S.mods.knight = TG.knightSaveDefault();
    m.v = 1;
    const t = m.tree && typeof m.tree === "object" && !Array.isArray(m.tree) ? m.tree : {};
    m.tree = {}; for (const id of Object.keys(t)) if (NODE[id] && t[id]) m.tree[id] = 1;
    if (!K.ULT_IDS.includes(m.ult)) m.ult = "wall";
    if (!K.CHANT_MODES.includes(m.chant)) m.chant = "ask";
    const se = Math.floor(+m.seenEvo); m.seenEvo = Number.isFinite(se) ? Math.max(0, Math.min(K.EVO_LV.length, se)) : 0;
    if (!(+S.ver >= 4)) S.ver = 4;
    return S;
  };
  // 怒氣制與否一律看這一局的 s.kn（TG.heroRageMax／TG.knightRageOn）：引擎、index 怒氣光環、knight.ui 都已改問它們（2026-11-23 整合 G2），
  //   不再設全域旗標 TG.HEROES.knight.rageMax，也不再包 heroUlt／heroCast（拋棄式局面不會影響正式局面）。
  if (K.ON && TG.SAVE_MIGRATIONS && !TG.SAVE_MIGRATIONS.includes(TG.knightMigrate)) TG.SAVE_MIGRATIONS.push(TG.knightMigrate);

  // ═════════ 機器人（regression 的 botOpts／botAct）
  // 依通關數輪流裝已解鎖的絕招（盾牆、三連斬、Be 之怒），技能樹照絕招的路線先點主線（不點徽章節點：徽章是加分不是平衡基準）
  TG.knightBotBuild = function (lv, cleared) {
    const ults = TG.knightUltsUnlocked(lv, {}, cleared), ult = ults[(cleared | 0) % ults.length] || "wall";
    const order = { wall: ["guard", "blade", "chant"], tense3: ["blade", "chant", "guard"], beWrath: ["chant", "blade", "guard"] }[ult];
    return { tree: TG.knightRefTree(lv, order), ult, chant: "auto", tiers: {}, cleared };
  };
  TG.knightBotCast = function (s, yes) {
    if (!TG.knightReady(s)) return false;
    const h = knightOf(s), near = s.enemies.filter(e => H(e.x - h.x, e.y - h.y) < 60).length;
    if (near < 3 && !s.enemies.some(e => isBoss(e) && H(e.x - h.x, e.y - h.y) < 120)) return false;
    const plan = TG.knightChantPlan(s), oks = [];
    if (TG.pfOn && TG.pfOn(s) && (s.pfCharge | 0) > 0) {   // 先備戰再守城：用備戰時充好的加強次數（同畫面端 knight.ui onUlt）
      s.pfCharge--; oks.push(true);   // 一次只用 1 次
    } else if (plan.can) {
      const a = yes(); TG.answerResult(s, a, { kind: "mcq", src: "chant", qk: "fill", try: 1 }); oks.push(a);
      if (a && plan.questions > 1 && TG.qCanAsk(s, "fill", "chant")) { const b = yes(); TG.answerResult(s, b, { kind: "mcq", src: "chant", qk: "fill", try: 1 }); oks.push(b); }
    }
    return !!TG.knightCast(s, oks);
  };

  // ═════════ 局內：開局、每步、受傷、塔
  // 封頂（json.caps：普攻每下 ≤×3、攻速 ≤×2.8、每下×攻速 ≤×5，相對 stats(lv)）要在 gear 等所有 heroStats 之後算 →
  //   第一次開局時才登錄一個排在最後的外掛（此時所有外掛都已載入）
  let capMod = null;
  function ensureCap() {
    if (capMod && TG.MODS.indexOf(capMod) === TG.MODS.length - 1) return;
    if (capMod) TG.MODS.splice(TG.MODS.indexOf(capMod), 1);
    capMod = TG.registerMod({
      name: "knightCap",
      heroStats(st, h, s) {
        if (!KN(s) || (h.id || "knight") !== "knight") return st;
        const b = TG.HEROES.knight.stats(h.lv);
        let hit = st.dmg / b.dmg, spd = b.cd / st.cd;
        if (hit > (CAPS.atkHitMulMax || 3)) { hit = CAPS.atkHitMulMax || 3; st.dmg = b.dmg * hit; }
        if (spd > (CAPS.atkSpeedMulMax || 2.8)) { spd = CAPS.atkSpeedMulMax || 2.8; st.cd = b.cd / spd; }
        if (hit * spd > (CAPS.atkSustainMax || 5)) st.dmg = b.dmg * (CAPS.atkSustainMax || 5) / spd;
        return st;
      }
    });
  }
  TG.knightEnsureCap = ensureCap;
  const tenseList = () => TG.GEAR_TENSE || ["G02", "G04", "G05", "G11"];
  const blockedByKnight = (s, e, h) => !!h && h.dead <= 0 && !h.moving && !isFly(e) && (H(h.x - e.x, h.y - e.y) <= 16 || (s.kn.wallT > 0 && H(h.x - e.x, h.y - e.y) <= s.kn.wallR));

  if (K.ON) TG.registerMod({
    name: "knight",
    onNewGame(s, opts) {
      const ko = opts && opts.knight, h = knightOf(s);
      if (!ko || !h) return;   // 不帶 opts.knight 的局面（簡報縮圖等拋棄式局面）＝舊流程；不碰任何全域設定
      const tiers = ko.tiers && typeof ko.tiers === "object" ? ko.tiers : {};
      const tree = TG.knightValid(ko.tree || {}, h.lv, tiers);
      let ult = K.ULT_IDS.includes(ko.ult) ? ko.ult : "wall";
      if (ko.cleared !== undefined && !TG.knightUltOk(ult, h.lv, tiers, ko.cleared)) ult = "wall";
      const gps = s.stage ? s.stage.gps : [], nq = s.stage ? gps.length + (s.stage.orig || []).length : 0;
      s.kn = Object.assign(KN_DEF(), { ult, tree, tiers, chant: K.CHANT_MODES.includes(ko.chant) ? ko.chant : "ask",
        tenseShare: s.stage ? (nq ? gps.filter(x => tenseList().includes(x)).length / nq : 0) : 0.25 });
      KN(s);
      h.rage = R.startOfStage || 0;
      h.maxHp = h.hp = Math.round(TG.HEROES.knight.stats(h.lv).hp * (1 + s.kn.mods.stat.hpMul));
      ensureCap();
    },
    onStartWave(s) { const kn = KN(s); if (kn) { kn.blockWave = 0; kn.blockAcc = 0; } },
    onAnswer(s, ok, info) {
      const kn = KN(s); if (!kn) return;
      info = info || {};
      const M = kn.mods;
      if (ok) {
        // 時態連擊（bC）：答對時態題 → 下一下普攻爆擊（畫面看真題目的 gp；node 模擬照本關時態題比例）
        if (M.rule.tenseCrit && info.src !== "chant") {
          if (info.gp) { if (tenseList().includes(info.gp)) kn.critReady = true; }
          else if (!s._gUI && info.kind !== "word" && !info.word) { kn.tenseAcc += kn.tenseShare; if (kn.tenseAcc >= 1) { kn.tenseAcc -= 1; kn.critReady = true; } }
        }
        if (info.src === "chant" && M.rule.chantVuln) { kn.chantVulnT = M.rule.chantVuln.time || 0; kn.chantVuln = M.rule.chantVuln.vuln || 0; }
      }
      TG.knightAddRage(s, TG.knightRageFor(s, ok, info), "answer");
      if (ok && M.rule.campRage && (info.src === "camp" || info.src === "campReroll") && kn.campWave !== s.wave) {
        kn.campWave = s.wave; TG.knightAddRage(s, M.rule.campRage, "answer");
        if (M.rule.nextCastTierMin) kn.tierMinNext = Math.max(kn.tierMinNext || 0, M.rule.nextCastTierMin);
      }
    },
    heroStats(st, h, s) {
      const kn = KN(s); if (!kn || (h.id || "knight") !== "knight") return st;
      const M = kn.mods.stat, any = kn.mods.ult.any || {}, sg = kn.mods.rule.standGuard, stance = sg && kn.standT >= (sg.after || 2);
      st.hp *= 1 + M.hpMul;
      st.dmg *= 1 + M.dmgAdd;
      st.cd *= M.cdMul; if (kn.hasteT > 0 && any.afterCastHaste) st.cd *= any.afterCastHaste.cdMul;
      st.block += M.block + (kn.guardT > 0 && any.afterCastGuard ? any.afterCastGuard.block || 0 : 0) + (stance ? sg.block || 0 : 0);
      if (stance) st.range += sg.rangeAdd || 0;
      st.regen = (st.regen + M.regenAdd) * M.regenMul * (stance && sg.regenMul ? sg.regenMul : 1);
      if (M.fly) {
        if (s.gearOn && s.gearOn.spear && kn.mods.rule.spearRangeAdd) st.range = Math.max(st.range, 44 + 6 * (TG.gearK ? TG.gearK(s, "spear") : 0)) + kn.mods.rule.spearRangeAdd;
        st.fly = true;
      }
      st.pierce = Math.max(2, M.pierce || 0);
      return st;
    },
    // 盾牆半徑大於引擎內建的 60 時，60～半徑之間的地面怪也停住
    enemyMove(s, e) {
      const kn = KN(s); if (!kn || !(kn.wallT > 0) || kn.wallR <= 60 || isFly(e)) return;
      const h = knightOf(s);
      if (h && h.dead <= 0 && H(h.x - e.x, h.y - e.y) <= kn.wallR) return false;
    },
    // 易傷（未來斬標記、冠詞盾陣、子句連鎖）取最大值、不相加；上限 vulnMax、魔王 vulnMaxBoss
    damageTaken(d, e, s) {
      const kn = KN(s); if (!kn) return d;
      let v = 0;
      if (e.knVulnT > 0) v = Math.max(v, e.knVuln || 0);
      if (kn.chantVulnT > 0) v = Math.max(v, kn.chantVuln || 0);
      if (kn.mods.rule.blockedVuln && blockedByKnight(s, e, knightOf(s))) v = Math.max(v, kn.mods.rule.blockedVuln);
      if (!v) return d;
      return d * (1 + Math.min(v, isBoss(e) ? (CAPS.vulnMaxBoss || 0.2) : (CAPS.vulnMax || 0.35)));
    },
    towerStats(st, tw, s) {
      const kn = KN(s), w = kn && kn.mods.ult.any && kn.mods.ult.any.wallTowerSpd;
      if (w && kn.wallT > 0) st.cd /= 1 + Math.min(w, CAPS.towerSpdPoolMax || 0.5);
      return st;
    },
    beforeUpdate(s) {
      const kn = KN(s); if (!kn) return;
      const h = knightOf(s); if (h) { kn._hp0 = h.hp; kn._alive = h.dead <= 0; }
    },
    afterUpdate(s, dt) {
      const kn = KN(s); if (!kn) return;
      const h = knightOf(s), idx = knightIdx(s), M = kn.mods, any = M.ult.any || {}, rule = M.rule;
      runQueue(s);
      if (h) {
        // 受傷調整：盾牆中 selfDamageTaken（引擎已算 0.5）、放招後守勢、守位金牌 → 把多扣的補回來
        if (kn._alive && h.dead <= 0 && h.hp < kn._hp0) {
          let f = 1;
          if (kn.wallT > 0 && h.wallT > 0 && kn.wallSelf < 0.5) f = Math.min(f, kn.wallSelf / 0.5);
          if (kn.guardT > 0 && any.afterCastGuard) f = Math.min(f, any.afterCastGuard.damageTaken);
          if (rule.standGuard && rule.standGuard.damageTaken && kn.standT >= (rule.standGuard.after || 2)) f = Math.min(f, rule.standGuard.damageTaken);
          if (f < 1) h.hp += (kn._hp0 - h.hp) * (1 - f);
        }
        // 不屈（g5）：每關 1 次致命傷留 1 滴血＋自動盾牆（不耗怒氣、不算放絕招）；否則復活快 reviveCut 秒
        if (kn._alive && h.dead > 0) {
          const ls = rule.lastStand;
          if (ls && kn.lastStandN < (ls.perStage || 1)) {
            kn.lastStandN++; h.dead = 0; h.hp = ls.keepHp || 1;
            for (let i = s.events.length - 1; i >= 0; i--) if (s.events[i].k === "heroDown" && s.events[i].idx === idx) { s.events.splice(i, 1); break; }
            openWall(s, h, ls.wall || 3, (K.ULTS.wall || {}).radius || 60, (K.ULTS.wall || {}).selfDamageTaken || 0.5);
            s.events.push({ k: "knightLastStand", x: h.x, y: h.y });
          } else if (rule.reviveCut) h.dead = Math.max(0.5, h.dead - rule.reviveCut);
        }
        // 擋怪怒氣：擋住 ≥1 隻地面怪的每一秒 +blockPerSec，每波上限 blockCap
        if (h.dead <= 0 && h.blockedN > 0) {
          kn.blockAcc += dt * M.rage.blockPerSec;
          const whole = Math.floor(kn.blockAcc + 1e-6);
          if (whole > 0) { kn.blockAcc -= whole; const add = Math.min(whole, Math.max(0, M.rage.blockCap - kn.blockWave)); if (add > 0) { kn.blockWave += add; TG.knightAddRage(s, add, "block"); } }
        }
        kn.standT = h.dead > 0 || h.moving ? 0 : kn.standT + dt;
        // 普攻追加：打魔王加成、穿甲補差、爆擊（時態連擊／完成斬替代效果取最大、不相乘）、完成式追擊（不連鎖、不爆擊）
        const st = h.st;
        if (st) for (const ev of s.events) {
          if (ev.k !== "slash" || ev.idx !== idx || ev._kn) continue;
          ev._kn = 1;
          const base = st.dmg * Math.sqrt(s.hpMul || 1), e = s.enemies.find(o => H(o.x - ev.x, o.y - ev.y) < 2);
          if (e) {
            if (M.stat.bossDmgAdd && isBoss(e)) TG._hurt(s, e, base * M.stat.bossDmgAdd, 2);
            if ((st.pierce || 2) > 2 && !TG.HERO_PIERCE_STAT && s.enemies.indexOf(e) >= 0) { const ar = e.armor || 0, x = Math.max(0, ar - 2) - Math.max(0, ar - st.pierce); if (x > 0) TG._hurt(s, e, x, true); }
            let c = 1;
            if (kn.critReady && rule.tenseCrit && s.time - kn.critLast >= rule.tenseCrit.every) { c = Math.max(c, rule.tenseCrit.mul); kn.critReady = false; kn.critLast = s.time; }
            if (kn.critT > 0 && any.afterCastCrit) { kn.critN++; if (kn.critN % (any.afterCastCrit.everyNth || 3) === 0) c = Math.max(c, any.afterCastCrit.mul); }
            if (c > 1 && s.enemies.indexOf(e) >= 0) { TG._hurt(s, e, base * (c - 1), 2); s.events.push({ k: "knightCrit", x: e.x, y: e.y, mul: c }); }
          } else if (rule.killChase && s.time - kn.chaseLast >= (rule.killChase.every || 1)) {
            const kc = rule.killChase;
            let best = null, bd = kc.radius || 40;
            for (const o of s.enemies) { const dd = H(o.x - ev.x, o.y - ev.y); if (dd <= bd && !isBeMinion(o) && (kc.fly || !isFly(o)) && TG.every("targetable", o, s, h)) { best = o; bd = dd; } }
            if (best) { kn.chaseLast = s.time; s.events.push({ k: "chain", pts: [[ev.x, ev.y], [best.x, best.y]] }); TG._hurt(s, best, base * kc.mul, 2); }
          }
        }
      }
      // 計時
      for (const k of ["wallT", "guardT", "hasteT", "critT", "chantVulnT"]) if (kn[k] > 0) kn[k] = Math.max(0, kn[k] - dt);
      for (const e of s.enemies) {
        if (e.knVulnT > 0) e.knVulnT -= dt;
        if (e._knArm0 !== undefined) {
          if (e.knArmT > 0) e.knArmT -= dt;
          if (e.knBrkT > 0) e.knBrkT -= dt;
          if (!(e.knArmT > 0) && !(e.knBrkT > 0)) { e.armor = e._knArm0; delete e._knArm0; } else applyArmor(e);
        }
      }
    },
    botOpts(opts, st, cleared) {
      if (!K.BOT) return;
      opts.knight = TG.knightBotBuild(opts.heroLv || 1, cleared);
    },
    botAct(s, yes) { if (KN(s)) TG.knightBotCast(s, yes); }
  });
})(typeof window !== "undefined" ? window : globalThis);
