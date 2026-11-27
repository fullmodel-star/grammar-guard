// 外掛：modes（引擎端，node 可載入）— 鐵人挑戰、每日一關、難度自動調整、學習報告（資料）
// 規格見 mods/README.md、DESIGN.md §三、§十。
// 存檔（畫面端放 TGUI.S.mods.modes）：{ iron:{關卡序號:1}, acc:{文法點:{n,r,h:[0/1…最近20]}}, daily:{plan,last,streak,best} }
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);

  // ═════ 鐵人挑戰（第二輪 E 組 2026-11-24：換成 DESIGN_v3 第四節的新規則，取代「答錯太多就出局」）
  //   ① 只有 1 條命 ② 整關的怪物合成「1 大波」一次來（s.maxWave＝1，見 stageWave）③ 只能用 2 種塔（至少 1 種打得到飛行怪）
  //   ④ 守住城堡「而且」答對率八成以上才算鐵人成功（給 3 星與鐵人徽章）。中途答錯不會出局（不加答錯懲罰），多答對可以把答對率拉回來。
  //   答對率的分母＝真的作答的題（TG.ironCounts：詞彈、略過、時間到、挑戰卡的題不算）；可錯題數＝答題數 × 兩成（不滿 10 題用 10 算＝前 10 題最多錯 2 題）。
  //   城堡守住但答錯超過可錯題數 → 結算改成「鐵人挑戰失敗」（城堡其實還在），m.fail＝"wrong"（畫面沿用舊的失敗說明）。
  //   1 大波拿不到波間獎金 → 開局另給（TG.ironGold）；開局營地抽 1 次卡（見 campKind 包裝）。
  TG.IRON_V = 3;                  // 鐵人規則版本（3＝第二輪新規則）
  TG.IRON_FREE = 0; TG.IRON_RATE = 0.2; TG.IRON_MIN_N = 10; TG.IRON_ACC = 0.8;
  TG.ironAllow = n => Math.floor(TG.IRON_FREE + TG.IRON_RATE * Math.max(n || 0, TG.IRON_MIN_N) + 1e-9);
  TG.ironCounts = info => !(info && (info.word || info.kind === "word" || info.skip || info.timeout || info.starSkip));
  TG.ironAcc = m => (m && m.n ? (m.n - m.wrong) / m.n : null);   // 鐵人答對率（畫面顯示用）
  TG.ironPass = m => !!m && m.wrong <= TG.ironAllow(m.n);        // 答對率夠不夠八成（過關時才判斷）
  TG.IRON_RULE = "只有 1 條命，所有怪物合成一大波一次來，只能選 2 種塔；守住城堡而且答對率八成以上才算成功（答錯不會中途出局）";
  TG.IRON_WRONG_MAX = TG.ironAllow(0) + 1;   // 舊名（相容）
  TG.IRON_LIVES = 1;              // 只有 1 條命
  TG.IRON_REVEAL_AT = 0.55;       // 隱形刺客走過路線多少比例後自動顯形
  TG.IRON_GOLD = 100;             // 開局多給的金幣
  TG.IRON_GOLD_WAVE = 0.3;        // 再先給「原本波間獎金（20＋5×波）合計」的這個比例（1 大波中間沒有波間獎金）
  TG.ironGold = st => Math.round(TG.IRON_GOLD + (st ? TG.IRON_GOLD_WAVE * Array.from({ length: Math.max(0, st.waves - 1) }, (_, k) => 20 + 5 * (k + 1)).reduce((a, b) => a + b, 0) : 0));
  TG.IRON_TYPES_DEF = ["arrow", "cannon"];   // 沒選塔時的預設 2 種（畫面在簡報讓孩子自己選）
  TG.ironTypes = types => {
    let t = Array.isArray(types) ? types.filter((x, i, a) => TG.TOWERS[x] && !TG.TOWERS[x].energy && a.indexOf(x) === i).slice(0, 2) : [];
    if (t.length < 2) t = TG.IRON_TYPES_DEF.slice();
    return TG.heroicTypesFix ? TG.heroicTypesFix(t) : t;
  };
  // 鐵人各區怪物血量倍率（新規則重新校準；數據見 _research/第二輪_交接_E.md）
  TG.IRON_HP = [1.3, 1.5, 1.75, 2.0, 1.8];   // 模擬（每關 4 局）：全對過 84%、九成對 67%、一般玩家（65%，多半卡在答對率）6%
  TG.ironOpen = (prog, i) => ((prog || {})[i] || {}).stars >= 3;

  // ═════ 英雄挑戰固定隊伍（第二輪 E 組，P1-14）：不帶裝備、天賦、同伴；騎士固定 HEROIC_FIXED.lv 級、技能樹用推薦配點、徽章不算；
  //   召喚獸等級固定、卡冊進化不算 → 跟養成程度脫鉤，不會越練越簡單。做法：包住 TG.newGame，heroic 開局時改寫 opts（畫面、模擬都一樣）。
  TG.HEROIC_FIXED = { lv: 10, petLv: 3 };
  TG.HEROIC_TREE_ORDER = { wall: ["guard", "blade", "chant"], tense3: ["blade", "chant", "guard"], beWrath: ["chant", "blade", "guard"] };
  TG.heroicFixOpts = function (opts, stage) {
    const F = TG.HEROIC_FIXED, o = Object.assign({}, opts), lv = F.lv;
    o.heroLv = lv; o.heroes = [{ id: "knight", lv }];
    o.gear = []; o.gearLv = {}; o.talents = []; o.cardPicks = {};
    const sm = {}; for (const id of Object.keys(opts.summons || {})) sm[id] = F.petLv; o.summons = sm;
    if (opts.knight && typeof TG.knightRefTree === "function") {
      const ko = opts.knight, cl = ko.cleared !== undefined ? ko.cleared : opts.cleared;
      const ult = typeof TG.knightUltOk === "function" && TG.knightUltOk(ko.ult, lv, {}, cl) ? ko.ult : "wall";
      o.knight = { tree: TG.knightRefTree(lv, TG.HEROIC_TREE_ORDER[ult] || TG.HEROIC_TREE_ORDER.wall), ult, chant: ko.chant || "ask", tiers: {}, cleared: cl };
    }
    o.heroicFixed = true;
    return o;
  };
  // 固定隊伍後重新校準的各區怪血（取代 engine.js 的 HEROIC_HPS；數據見 _research/第二輪_交接_E.md）
  TG.HEROIC_HPS = [1.5, 0.7, 0.55, 0.47, 0.33];   // 11-25 晚：拿掉「除以 TG.CHALLENGE_K」（除了之後英雄挑戰比一般關卡還好打：試玩小華 13 局全贏、第 20 關怪血只有一般的 1/4）；挑戰性血量英雄挑戰也照吃   // 90% 答對三星約 57%、一般玩家（65%）過關約 55%（每關 5 局模擬）
  {
    const _newGame = TG.newGame;
    TG.newGame = function (stage, opts) {
      if (opts && opts.heroic && stage && TG.HEROIC_FIXED) opts = TG.heroicFixOpts(opts, stage);
      const s = _newGame.call(this, stage, opts);
      if (opts && opts.heroicFixed) s.heroicFixed = true;
      return s;
    };
    // 鐵人：開局（第 1 大波前）的營地改成抽卡（1 大波之後就沒有營地了）
    const _campKind = TG.campKind;
    TG.campKind = function (s) {
      const k = _campKind.apply(this, arguments);
      if (k && s && s.modes && s.modes.iron && s.wave === 0 && TG.cardData && TG.cardData() && (s.cards ? s.cards.drawn : 0) < TG.CAMP.maxDraw) return "camp";
      return k;
    };
    // 鐵人：城堡守住時才判斷答對率（不到八成＝鐵人挑戰失敗，城堡其實還在）
    const _update = TG.update;
    TG.update = function (s, dt) {
      const r = _update.apply(this, arguments);
      const m = s && s.modes;
      if (m && m.iron && s.over && s.won && !m.checked) {
        m.checked = true; m.allow = TG.ironAllow(m.n);
        if (!TG.ironPass(m)) { s.won = false; m.fail = "wrong"; for (const e of s.events) if (e.k === "win") { e.k = "over"; delete e.stars; } }
      }
      return r;
    };
  }

  // ═════ 每日一關：當日規則（hard＝變難、其他＝幫忙）
  TG.DAILY_RULES = {
    fast:   { em: "💨", name: "怪物速度 +20%", hard: true },
    tough:  { em: "🪨", name: "怪物血量 +15%", hard: true },
    cheap:  { em: "🏗️", name: "蓋塔便宜 20%" },
    energy: { em: "⚡", name: "答對能量加成" },   // v3：答對多 DAILY_ENERGY_BONUS 格（原本「加倍」＝+1；能量改成答對 +2 後名稱改「加成」）
    rich:   { em: "🪙", name: "開局金幣 +60" }
  };
  TG.DAILY_ENERGY_BONUS = 1;
  const HARD = Object.keys(TG.DAILY_RULES).filter(k => TG.DAILY_RULES[k].hard);
  const EASY = Object.keys(TG.DAILY_RULES).filter(k => !TG.DAILY_RULES[k].hard);
  const pad = n => (n < 10 ? "0" : "") + n;
  // 瀏覽器本地日期 → "YYYYMMDD"；種子＝它的數字
  TG.dayKey = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  TG.prevDayKey = key => { const y = +key.slice(0, 4), m = +key.slice(4, 6), d = +key.slice(6, 8); return TG.dayKey(new Date(y, m - 1, d - 1)); };
  TG.dailySeed = key => parseInt(key, 10) | 0;
  // 已解鎖關卡（第 1 關永遠開；其他要前一關有星）
  TG.unlockedStages = prog => TG.STAGES.filter(st => st.i === 0 || ((prog || {})[st.i - 1] || {}).stars > 0).map(st => st.i);
  // 用種子挑關卡與 1～2 條規則（一定有一條幫忙的；一半機率再加一條變難的）
  TG.dailyPlan = function (key, unlocked) {
    const seed = TG.dailySeed(key), r = TG.mulberry(seed ^ 0x5eed);
    const list = unlocked && unlocked.length ? unlocked : [0];
    const stage = list[Math.floor(r() * list.length)];
    const rules = [EASY[Math.floor(r() * EASY.length)]];
    if (r() < 0.5) rules.unshift(HARD[Math.floor(r() * HARD.length)]);
    return { date: key, seed, stage, rules };
  };
  // 每日獎勵（11-21 第二刀 P2-14：原本 5 天後就不再增加）→ 7 天一輪：第 7 天另送召喚獸練習與碎片；連續 7／14／30／60／100 天里程碑再送碎片。
  //   v3（第 8b 組）：英雄經驗改照 knight_tree.json 的 xp.dailyReward＝base＋perDay×連續天數（最多 max；目前 50＋10×天、最多 120），
  //   不吃每日答題經驗額度；原本 100＋20×天＋10×週在新等級曲線下太大（會變成不答題也升級）。
  TG.DAILY_MILESTONES = { 7: { shards: 5, name: "連續一週" }, 14: { shards: 8, name: "連續兩週" }, 30: { shards: 15, name: "連續一個月" }, 60: { shards: 20, name: "連續 60 天" }, 100: { shards: 30, name: "連續 100 天" } };
  TG.dailyXpCfg = () => {
    const x = (TG.DATA_KNIGHT && TG.DATA_KNIGHT.xp && TG.DATA_KNIGHT.xp.dailyReward) || {};
    const num = (v, d) => (Number.isFinite(+v) && +v >= 0 ? +v : d);
    return { base: num(x.base, 50), perDay: num(x.perDay, 10), max: num(x.max, 120) };
  };
  TG.dailyReward = function (streak) {
    streak = Math.max(1, streak | 0);
    const day = (streak - 1) % 7 + 1, ms = TG.DAILY_MILESTONES[streak] || null, c = TG.dailyXpCfg();
    return { day, xp: Math.min(c.max, c.base + c.perDay * streak), petUses: day === 7 ? 5 : 2, shards: (day === 7 ? 3 : 0) + (ms ? ms.shards : 0), milestone: ms ? ms.name : null };
  };
  // 領獎（一天一次）；回傳 null＝今天領過了
  TG.dailyClaim = function (dd, key) {
    if (dd.last === key) return null;
    dd.streak = dd.last && dd.last === TG.prevDayKey(key) ? (dd.streak || 0) + 1 : 1;
    dd.last = key; dd.best = Math.max(dd.best || 0, dd.streak);
    return Object.assign({ streak: dd.streak }, TG.dailyReward(dd.streak));
  };

  // ═════ 難度自動調整：各文法點答對率
  TG.ACC_WIN = 20;      // 只看最近 20 題（跟得上進步）
  TG.ACC_MIN_N = 3;     // 至少答 3 題才調整（11-21 試玩：原本 5 題，新手一關只答 1～10 題，幾乎沒啟動）
  TG.accKey = q => (!q || !q.id || !Array.isArray(q.o)) ? null : (q.gp || ("O" + q.lv));
  TG.modesData = function (d) {
    d = d && typeof d === "object" && !Array.isArray(d) ? d : {};
    if (!d.iron || typeof d.iron !== "object" || Array.isArray(d.iron)) d.iron = {};
    if (!d.acc || typeof d.acc !== "object" || Array.isArray(d.acc)) d.acc = {};
    for (const k of Object.keys(d.acc)) {
      const a = d.acc[k];
      if (!a || typeof a !== "object" || !Array.isArray(a.h)) { delete d.acc[k]; continue; }
      a.n = Math.max(0, a.n | 0); a.r = Math.max(0, Math.min(a.n, a.r | 0)); a.h = a.h.slice(-TG.ACC_WIN).map(x => (x ? 1 : 0));
    }
    if (!d.daily || typeof d.daily !== "object" || Array.isArray(d.daily)) d.daily = {};
    const dd = d.daily; dd.streak = Math.max(0, dd.streak | 0); dd.best = Math.max(dd.streak, dd.best | 0);
    if (dd.last && !/^\d{8}$/.test(dd.last)) dd.last = null;
    return d;
  };
  TG.accRecord = function (d, q, ok) {
    const k = TG.accKey(q); if (!k) return null;
    const a = d.acc[k] || (d.acc[k] = { n: 0, r: 0, h: [] });
    a.n++; if (ok) a.r++;
    a.h.push(ok ? 1 : 0); if (a.h.length > TG.ACC_WIN) a.h.shift();
    return k;
  };
  // 最近答對率（題數不夠回傳 null）
  TG.accRate = function (d, k) {
    const a = d && d.acc && d.acc[k]; if (!a || a.h.length < TG.ACC_MIN_N) return null;
    return a.h.reduce((x, y) => x + y, 0) / a.h.length;
  };
  TG.accLevel = (d, k) => { const r = TG.accRate(d, k); return r === null ? 0 : r < 0.6 ? -1 : r > 0.9 ? 1 : 0; };
  // 題池調整：弱的文法點只留該點最低的等級、強的只留最高的等級（剩不到 3 題就不動）
  TG.adjustPool = function (src, d) {
    if (!src || !src.length || !d) return src;
    const by = {};
    for (const q of src) { const k = TG.accKey(q); if (k) (by[k] = by[k] || []).push(q); }
    let changed = false; const drop = new Set();
    for (const k of Object.keys(by)) {
      const lvF = TG.accLevel(d, k); if (!lvF) continue;
      const lvs = by[k].map(q => q.lv), pick = lvF < 0 ? Math.min(...lvs) : Math.max(...lvs);
      const keep = by[k].filter(q => q.lv === pick);
      if (keep.length < 3 || keep.length === by[k].length) continue;
      for (const q of by[k]) if (q.lv !== pick) drop.add(q);
      changed = true;
    }
    return changed ? src.filter(q => !drop.has(q)) : src;
  };
  TG.accExtraTime = (d, q) => (TG.accLevel(d, TG.accKey(q)) < 0 ? 5 : 0);
  // 學習報告：建議重玩的關卡（弱點優先、單一主題關優先、只挑已解鎖）
  TG.suggestStages = function (d, prog, max) {
    const open = new Set(TG.unlockedStages(prog));
    const weak = Object.keys(d.acc).map(k => ({ k, r: TG.accRate(d, k) })).filter(x => x.r !== null && x.r < 0.7).sort((a, b) => a.r - b.r);
    const out = [];
    for (const w of weak) {
      const hit = TG.STAGES.filter(st => open.has(st.i) && (st.gps.includes(w.k) || (w.k[0] === "O" && st.orig.includes(+w.k.slice(1)))))
        .sort((a, b) => (a.gps.length + a.orig.length) - (b.gps.length + b.orig.length) || a.i - b.i);
      const st = hit.find(x => !out.some(o => o.i === x.i));
      if (st) out.push({ i: st.i, k: w.k, r: w.r });
      if (out.length >= (max || 3)) break;
    }
    return out;
  };

  // ═════ 引擎掛勾
  const M = s => s.modes;
  TG.registerMod({
    name: "modes",
    onNewGame(s, opts) {
      const daily = opts.daily && Array.isArray(opts.daily.rules) ? opts.daily : null;
      s.modes = { iron: !!opts.iron && !!s.stage, v: TG.IRON_V, wrong: 0, n: 0, allow: TG.ironAllow(0), fail: null, daily, rules: {} };
      if (daily) for (const k of daily.rules) if (TG.DAILY_RULES[k]) s.modes.rules[k] = 1;
      // 鐵人（第二輪新規則）：1 條命、1 大波（maxWave 1）、2 種塔、開局另給金幣；守護結界天賦無效；noPowerUp：不吃配裝加血
      if (s.modes.iron) {
        s.lives = TG.IRON_LIVES; s.maxWave = 1; s.modes.waves0 = s.stage.waves; s.gold += TG.ironGold(s.stage); s.gGuard = false; s.noPowerUp = true;
        s.allowTypes = TG.ironTypes(opts.allowTypes || s.allowTypes);
      }
      if (s.modes.rules.rich) s.gold += 60;
      // 每日一關：波次用獨立種子（跟答題、點擊的亂數分開），同一天怎麼玩怪物順序都一樣
      if (daily && !s.waveRng && Number.isFinite(+daily.seed)) s.waveRng = TG.mulberry((+daily.seed) ^ 0x9e3779b9);
    },
    onAnswer(s, correct, info) {
      const m = M(s); if (!m) return;
      // 每日規則「答對能量加成」：這題本來就有給能量時多 DAILY_ENERGY_BONUS 格（經過 addEnergy，引擎在 answerResult 期間自動夾到每題上限；詞彈點字塊不加；答錯什麼都不扣）
      if (correct && m.rules.energy && !(info && (info.word || info.kind === "word")) && TG.energyGain(s, true, info || {}) > 0) TG.addEnergy(s, TG.DAILY_ENERGY_BONUS, "daily");
      if (m.iron && !s.over && TG.ironCounts(info)) {
        m.n++; if (!correct) m.wrong++;
        m.allow = TG.ironAllow(m.n);
        if (!correct) {
          // max＝現在最多可錯幾題（畫面端「答錯 n／max」）。新規則中途不出局：超過時改推 ironLow（畫面提醒「多答對幾題就能拉回八成」）
          s.events.push({ k: m.wrong > m.allow ? "ironLow" : "ironWrong", n: m.wrong, max: m.allow, answered: m.n });
        }
      }
    },
    // 鐵人 1 大波：第 1 波就把整關每一波的怪接在一起（各波照原本順序；其他外掛的 stageWave 照各波波號處理）。
    //   原本前兩段的保護照留：第 1 段沒有飛行怪（開局還來不及蓋打飛行怪的塔）、第 1～2 段沒有隱形刺客。
    stageWave(list, s, w, rng) {
      const m = M(s); if (!m || !m.iron) return list;
      // 11-25 晚：鐵人不出「關卡魔王」（換回原本最後一波的 2 字盾＋1 石像）；超大魔王照出（守城門，碰到城門 1.5 秒就輸）。
      //   理由：鐵人血量表 IRON_HP 是 11-24 沒有關卡魔王時校準的；1 條命時一隻萬血、會飛會衝刺的魔王＝整關只看這一隻（試玩小華第 17 關 7 局全輸、全對也輸），
      //   鐵人的難度是「1 大波＋八成答對率」，不該變成單挑魔王。
      const sb = s.stage && s.stage.sboss;
      const fix = (l, k) => { if (sb && l.includes(sb)) l = l.flatMap(t => t === sb ? ["elite", "elite", "golem"] : [t]);
        return k > 2 ? l : l.map(t => { const b = TG.ENEMIES[t] || {}; return (k === 1 && b.fly) || b.invis ? "slime" : t; }); };
      if (w !== 1 || !s.stage) return fix(list, w);
      const me = this, out = fix(list, 1).slice();
      for (let k = 2; k <= (m.waves0 || s.stage.waves); k++) {
        let l = TG.stageWave(s.stage, k, rng);
        for (const md of TG.MODS) if (md.stageWave && md !== me && md.name !== "modes") { const x = md.stageWave(l, s, k, rng); if (x) l = x; }
        out.push(...fix(l, k));
      }
      return out;
    },
    onLeak(s) { const m = M(s); if (m && m.iron && s.lives <= 0 && !m.fail) m.fail = "leak"; },
    onGateHit(s) { const m = M(s); if (m && m.iron && s.lives <= 0 && !m.fail) m.fail = "leak"; },   // 魔王在城門把最後 1 命打掉（engine 守城門）
    enemySpeed(v, e, s) { const m = M(s); return m && m.rules.fast ? v * 1.2 : v; },
    enemyHpMul(mul, type, s) { const m = M(s); if (!m) return mul; if (m.iron && s.stage && TG.IRON_HP) mul *= TG.IRON_HP[s.stage.r] || 1; return m.rules.tough ? mul * 1.15 : mul; },
    towerCost(c, type, s) { const m = M(s); return m && m.rules.cheap ? c * 0.8 : c; },
    // 鐵人過關＝鐵人成功：星數算 3（只剩 1 條命，照剩命算會變 ★☆☆；星數紀錄本來就取最高）
    stars(v, s) { const m = M(s); if (m && m.iron && s.won) return 3; },
    afterUpdate(s) {
      const m = M(s); if (!m) return;
      // 鐵人：城牆守衛看得見靠近城堡（走過路線 IRON_REVEAL_AT）的隱形刺客（只有 1 條命，刺客趁答題空檔溜過就輸＝考運氣）
      if (m.iron && s.cr && s.enemies.some(e => TG.ENEMIES[e.type].invis && e.d > s.map.routes[e.r].len * TG.IRON_REVEAL_AT)) s.cr.revealT = Math.max(s.cr.revealT || 0, 0.3);
      if (m.iron && s.lives > TG.IRON_LIVES) s.lives = TG.IRON_LIVES;   // 補血（光獨角獸等）不能超過 1 條命
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
