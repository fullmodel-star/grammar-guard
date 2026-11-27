// 外掛：creatures（引擎端，node 可載入）。規格見 mods/README.md 與 DESIGN.md §七、§九。
// 新怪：隱形刺客（塔／英雄打不到，答對任何題 → 真言光顯形 6 秒）、治療祭司（每秒補附近 45 內的其他怪）
// 新召喚獸：冰鳳（全場減速 6 秒）、光獨角獸（城堡補 5 條命，每關 1 次）
// 召喚獸進化：等級 10 進化，效果 ×1.5、換名字與 emoji
// 局內狀態：s.cr = { revealT, chillT, chillF, uniUsed }
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  // ───── 新怪
  // 刺客現形：答對題目後 REVEAL_T 秒；先備戰再守城（11-25 試玩 P0：守城不出題＝刺客永遠打不到）→ 上一輪備戰答對過＝整波現形，
  //   一題都沒答對＝每 10 秒現形 4 秒（不會整波全漏）
  TG.crRevealed = s => !!(s && ((s.cr && s.cr.revealT > 0) || (TG.pfOn && TG.pfOn(s) && (s.pfReveal || (s.time % 10) < 4))));
  TG.ENEMIES.assassin = { name: "隱形刺客", em: "🥷", hp: 58, spd: 38, gold: 9, atk: 6, invis: true };
  TG.ENEMIES.priest = { name: "治療祭司", em: "👼", hp: 75, spd: 23, gold: 12, atk: 4, healer: true, desc: "每秒幫附近的怪補血（不補魔王）" };
  TG.REVEAL_T = 6;          // 真言光秒數
  TG.HEAL_R = 45;           // 治療半徑
  TG.HEAL_PCT = 0.025;      // 每秒補對方最大血量的 2.5%，每次最多補 3 隻
  // 魔王完全不補（11-21 第二刀定案：舊回報寫「魔王只補 1/4」，實際程式一直是不補；魔王血量很厚，補一點也會讓魔王戰拖很久）
  TG.HEAL_MAX = 3;

  // ───── 新召喚獸
  // evoSelf：進化效果自己算（不套 summonPower 的 ×1.5）
  // v3（合約 §4.1）：召喚價格跟著引擎的召喚獸走——冰鳳＝火狐的價格、光獨角獸＝便宜 1 格
  //   （舊制火狐 4 → 冰鳳 4、獨角獸 3；能量版火狐 6 → 冰鳳 6、獨角獸 5＝合約目標）。數值調整權在第 1 組：改 TG.SUMMONS.fox.cost 或下面的 SUMMON_COST_REL。
  //   玩家實際要花多少一律問 TG.energyCost("summon", s, id)（卡片「召喚 −2」、每日規則會用 energyCost 掛勾改價）。
  TG.SUMMON_COST_REL = { phoenix: 0, unicorn: -3 };   // 11-23 第 7 步平衡：召喚 6→8 後獨角獸維持 5（補命型、每關 1 次）、冰鳳跟著 8
  const baseCost = () => (TG.SUMMONS.fox && TG.SUMMONS.fox.cost) || 4;
  TG.SUMMONS.phoenix = { name: "冰鳳", em: "🕊️", elem: "冰", cost: Math.max(1, baseCost() + TG.SUMMON_COST_REL.phoenix), evoSelf: true, desc: "全場怪物減速 6 秒（飛行怪也有效）" };
  TG.SUMMONS.unicorn = { name: "光獨角獸", em: "🦄", elem: "光", cost: Math.max(1, baseCost() + TG.SUMMON_COST_REL.unicorn), evoSelf: true, desc: "城堡補 5 條命；城堡滿血時改送金幣（每關只能用 1 次）" };
  TG.summonCost = (s, id) => TG.energyCost ? TG.energyCost("summon", s, id) : ((TG.SUMMONS[id] || {}).cost || 0);
  // 11-23 提早解鎖（老闆核准：大部分玩家玩不到）：冰鳳 10→6、光獨角獸 15→9（火狐／雷狼／岩龜 1／3／6 不動）
  TG.SUMMON_UNLOCK.phoenix = 6;
  TG.SUMMON_UNLOCK.unicorn = 9;
  const addUnlock = (k, txt) => { TG.UNLOCKS[k] = TG.UNLOCKS[k] ? TG.UNLOCKS[k] + "、" + txt : txt; };
  addUnlock(TG.SUMMON_UNLOCK.phoenix, "召喚獸「冰鳳」");
  addUnlock(TG.SUMMON_UNLOCK.unicorn, "召喚獸「光獨角獸」");

  // ───── 進化（等級在存檔 S.pets[id].lv，引擎收到 s.summons[id]）
  TG.EVO_LV = 10;
  TG.EVO_MUL = 1.5;
  TG.SUMMON_EVO = {
    fox: { name: "九尾狐", em: "🔥" },
    wolf: { name: "雷霆天狼", em: "⚡" },
    turtle: { name: "玄武", em: "⛰️" },
    phoenix: { name: "極光冰凰", em: "🦚" },
    unicorn: { name: "聖光天馬", em: "🌈" }
  };
  TG.SUMMON_COUNTER = { fox: "燒一整條路", wolf: "剋飛行怪", turtle: "擋住地面怪", phoenix: "讓全場變慢", unicorn: "補城堡血" };
  TG.isEvolved = lv => (lv || 1) >= TG.EVO_LV;
  // 寵物進度（11-24 第二輪，試玩小華 P1-7：原本每用 5 次升 1 級、進化要 45 次，每關最多召喚 4 次＝專練十幾關才進化一隻）：
  //   改成「進化點數」：每召喚 1 次 +1 點、排句全部排對（錯不到 2 次）再 +1 點；每 PET_PTS_PER_LV 點升 1 級、Lv10 進化。
  //   從 Lv1 到進化共 27 點：句子都排對約 14 次、答對六成五約 16 次、全排錯 27 次。存檔 S.pets[id] = { lv, uses, xp }（xp＝這一級已累積的點數；舊存檔沒有＝0）。
  //   畫面端召喚成功後改呼叫 TG.petUse(S.pets[id], 排對了沒)，回傳 { up, lv }（up＝升級了，畫面照舊跳「升到 LvN」）；不要再自己 uses%5。
  TG.PET_PTS_PER_LV = 3;
  TG.PET_PTS = { use: 1, ok: 1 };
  TG.petNeed = () => (TG.EVO_LV - 1) * TG.PET_PTS_PER_LV;   // Lv1 到進化要幾點
  TG.petProgress = p => {
    p = p || {};
    const lv = Math.max(1, Math.min(TG.EVO_LV, Math.floor(+p.lv) || 1)), uses = Math.max(0, Math.floor(+p.uses) || 0);
    const xp = Math.max(0, Math.min(TG.PET_PTS_PER_LV - 1, Math.floor(+p.xp) || 0));
    const evolved = TG.isEvolved(lv), need = TG.petNeed();
    const left = evolved ? 0 : Math.max(1, (TG.EVO_LV - lv) * TG.PET_PTS_PER_LV - xp);
    // left＝還差幾點；leftUses＝照「每次都排對」大約還要召喚幾次（畫面寫「再召喚約 N 次進化」）；pct＝進化進度 0～100
    return { lv, uses, xp, evolved, left, need, leftUses: evolved ? 0 : Math.ceil(left / (TG.PET_PTS.use + TG.PET_PTS.ok)), pct: evolved ? 100 : Math.round(100 * (1 - left / need)) };
  };
  TG.petUse = function (p, ok) {
    if (!p || typeof p !== "object") return { up: false, lv: 1 };
    p.lv = Math.max(1, Math.min(TG.EVO_LV, Math.floor(+p.lv) || 1)); p.uses = Math.max(0, Math.floor(+p.uses) || 0) + 1;
    let xp = Math.max(0, Math.floor(+p.xp) || 0) + TG.PET_PTS.use + (ok ? TG.PET_PTS.ok : 0), up = false;
    while (xp >= TG.PET_PTS_PER_LV && p.lv < TG.EVO_LV) { xp -= TG.PET_PTS_PER_LV; p.lv++; up = true; }
    p.xp = p.lv >= TG.EVO_LV ? 0 : xp;
    return { up, lv: p.lv };
  };
  // 召喚獸目前的名字／emoji（依等級）
  TG.summonLook = (id, lv) => {
    const b = TG.SUMMONS[id] || { name: id, em: "❔" }, e = TG.SUMMON_EVO[id];
    return TG.isEvolved(lv) && e ? { name: e.name, em: e.em, evolved: true } : { name: b.name, em: b.em, evolved: false };
  };

  // 進化倍率走引擎掛勾 summonPower（見下方 registerMod）：火狐傷害、雷狼傷害、岩龜秒數，以及其他外掛新增的召喚獸都 ×1.5
  const cr = s => s.cr || (s.cr = { revealT: 0, chillT: 0, chillF: 0, uniUsed: false });
  // 冰鳳：全場減速（新出生的怪也算），進化後 9 秒
  TG.SUMMON_FX.phoenix = (s, power, lv, k) => {
    const c = cr(s), evo = TG.isEvolved(lv);
    c.chillT = 6 * (evo ? TG.EVO_MUL : 1);
    c.chillF = Math.min(0.6, Math.max(0.3, 0.3 + 0.15 * power + 0.01 * ((lv || 1) - 1)));
    s.events.push({ k: "chill", t: c.chillT, f: c.chillF });
  };
  // 城堡命上限＝開局的命（一般 20；天賦加命時更多；鐵人挑戰只有 1 → 光獨角獸用不了）
  TG.livesCap = s => (s.cr && s.cr.cap) || 20;
  // 光獨角獸：補命（上限見 livesCap），每關 1 次；句子排錯 2 次以上只補 3 條
  // 11-21 第二刀 P2-14：原本城堡滿血就不能叫（高手永遠滿血＝永遠練不滿）→ 補不下的命改成金幣（每條 UNICORN_GOLD）
  TG.UNICORN_GOLD = 12;
  TG.unicornHeal = (power, lv) => Math.round(5 * Math.min(1, Math.max(0.5, power)) * (TG.isEvolved(lv) ? TG.EVO_MUL : 1));
  TG.SUMMON_FX.unicorn = (s, power, lv) => {
    const c = cr(s), heal = TG.unicornHeal(power, lv), add = Math.min(heal, Math.max(0, TG.livesCap(s) - s.lives)), gold = (heal - add) * TG.UNICORN_GOLD;
    s.lives += add; s.gold += gold; c.uniUsed = true;
    s.events.push({ k: "unicorn", n: add, gold });   // gold＞0：城堡滿了，多的命換成金幣（畫面顯示「+N 金幣」）
  };
  // 每關限 1 次；鐵人挑戰（城堡只有 1 條命）不能用：走引擎掛勾 canSummon（見下方 registerMod）
  // 狀態：none 沒帶、used 用過、full 不能用（鐵人）、gold 滿血（叫了會變金幣）、ok 會補命
  TG.unicornState = s => !s.summons || s.summons.unicorn === undefined ? "none" : (s.cr && s.cr.uniUsed) ? "used" : TG.livesCap(s) <= 1 ? "full" : s.lives >= TG.livesCap(s) ? "gold" : "ok";

  // 存檔資料（S.mods.creatures）：seen＝看過哪些新怪（第一次會說明）、evo＝已顯示過進化通知
  TG.creaturesData = d => {
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    if (!d.seen || typeof d.seen !== "object" || Array.isArray(d.seen)) d.seen = {};
    if (!d.evo || typeof d.evo !== "object" || Array.isArray(d.evo)) d.evo = {};
    return d;
  };

  // 把 n 隻 type 換掉清單裡的史萊姆（不夠就加在魔王前面），維持總數不灌水
  function inject(list, type, n, rng) {
    for (let i = 0; i < n; i++) {
      const idx = []; list.forEach((t, j) => { if (t === "slime") idx.push(j); });
      if (idx.length) list[idx[Math.floor(rng() * idx.length)]] = type;
      else {
        const bi = list.findIndex(t => TG.ENEMIES[t] && TG.ENEMIES[t].boss);
        if (bi >= 0) list.splice(bi, 0, type); else list.push(type);
      }
    }
    return list;
  }
  TG.creatureCounts = (s, w) => {
    if (s.stage) {
      const k = s.stage.i;
      return { assassin: k >= 10 && w >= 2 ? 1 + Math.floor(w / 5) : 0, priest: k >= 12 && w >= 4 ? 1 + Math.floor(w / 8) : 0 };
    }
    return { assassin: w >= 6 ? 1 + Math.floor((w - 6) / 4) : 0, priest: w >= 6 ? 1 + Math.floor((w - 6) / 5) : 0 };
  };

  TG.registerMod({
    name: "creatures",
    onNewGame(s) { s.cr = { revealT: 0, chillT: 0, chillF: 0, uniUsed: false }; },
    stageWave(list, s, w, rng) {
      const c = TG.creatureCounts(s, w), r = rng || s.rng || Math.random;
      list = list.slice();
      inject(list, "assassin", c.assassin, r);
      inject(list, "priest", c.priest, r);
      return list;
    },
    onAnswer(s, correct) {
      if (!correct) return;
      const c = cr(s);
      c.revealT = TG.REVEAL_T;
      if (s.enemies.some(e => TG.ENEMIES[e.type].invis)) s.events.push({ k: "trueLight" });
    },
    canSummon(s, id) {
      if (id === "unicorn" && ((s.cr && s.cr.uniUsed) || TG.livesCap(s) <= 1)) return false;
      // v3：自己的兩隻召喚獸照 energyCost（含改價掛勾）判斷夠不夠（引擎端的判斷改走 energyCost 前也不會被少扣）
      if ((id === "unicorn" || id === "phoenix") && TG.canSpend && !TG.canSpend(s, TG.summonCost(s, id))) return false;
    },
    summonPower(power, id, lv) {
      if (TG.isEvolved(lv) && TG.SUMMONS[id] && !TG.SUMMONS[id].evoSelf) return power * TG.EVO_MUL;
    },
    // 隱形中的刺客：英雄看不到它，擋不住（顯形後照常擋）
    heroBlock(h, e, s) {
      if (TG.ENEMIES[e.type] && TG.ENEMIES[e.type].invis && !TG.crRevealed(s)) return false;
    },
    // 模擬玩家：城堡掉了 5 條命以上就叫光獨角獸；魔王在場時叫冰鳳
    botAct(s, yes) {
      if (TG.canSummon(s, "unicorn") && s.lives <= TG.livesCap(s) - 5) { TG.summon(s, "unicorn", yes() ? 1.1 : 0.6); return; }
      if (TG.canSummon(s, "phoenix") && s.enemies.some(e => TG.ENEMIES[e.type].boss)) TG.summon(s, "phoenix", yes() ? 1.1 : 0.6);
    },
    targetable(e, s) {
      if (!TG.ENEMIES[e.type] || !TG.ENEMIES[e.type].invis) return true;
      return TG.crRevealed(s);
    },
    enemySpeed(v, e, s) {
      const c = s.cr;
      if (!c || c.chillT <= 0) return v;
      return v * (1 - c.chillF * (TG.ENEMIES[e.type].boss ? 0.5 : 1));
    },
    beforeUpdate(s, dt) {
      const c = cr(s);
      if (c.cap === undefined) c.cap = s.lives;
      if (c.revealT > 0) c.revealT = Math.max(0, c.revealT - dt);
      if (c.chillT > 0) c.chillT = Math.max(0, c.chillT - dt);
    },
    onSpawn(s, e) { if (TG.ENEMIES[e.type].healer) e.healT = 1; },
    afterUpdate(s, dt) {
      for (const p of s.enemies) {
        if (!TG.ENEMIES[p.type].healer) continue;
        p.healT = (p.healT === undefined ? 1 : p.healT) - dt;
        if (p.healT > 0) continue;
        p.healT += 1;
        const tg = s.enemies.filter(o => o !== p && o.hp < o.maxHp && !TG.ENEMIES[o.type].boss && H(o.x - p.x, o.y - p.y) <= TG.HEAL_R)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, TG.HEAL_MAX);
        for (const o of tg) o.hp = Math.min(o.maxHp, o.hp + Math.max(1, o.maxHp * TG.HEAL_PCT));
        const n = tg.length;
        if (n) s.events.push({ k: "heal", x: p.x, y: p.y, n });
      }
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
