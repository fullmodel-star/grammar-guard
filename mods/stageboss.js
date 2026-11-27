// 外掛：stageboss（引擎端，node 可載入）— 每關大魔王＋每區超大魔王（2026-11-25 老闆裁示：「每一關要有一個大魔王，每個地圖結束後要有一個超大魔王」）
// ・不是魔王關的 17 關，最後一波多一隻「關卡魔王」（取代原本最後一波的 2 字盾＋1 石像）：拿該區出現過的怪放大改造（畫法 art/art-sprites.js 的
//   ART.defStageBoss，畫面端 mods/stageboss.ui.js 開局登錄），名字跟那關的文法有關，各有一招。招式都不出題，兩種玩法（先答題／邊打邊答）一樣。
//   招式：summon＝叫小怪、guard＝護盾（受到傷害 ×0.3）、dash＝衝刺（速度 ×2）、heal＝回血（自己＋附近的怪）
// ・5 個區域魔王（第 4、10、15、19、22 關）＝「超大魔王」：畫大 1.25 倍、登場演出（畫面端），血量 ×TG.SUPER_BOSS_HP。
// 事件：sbIntro { e, super }（魔王登場）、sbMech { e, mech, n }（放招）、sbGate { e }（第一次停在城門）、sbGateHit { e, n }（城門扣命）、sbKill { e, super, gold }（被打倒）
// 11-25 晚：魔王守城門（engine.js 敵人移動段）＋血量 TG.BOSS_HP_K，規格見 mods/CONTRACT_v3.md §14h
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  // 關卡序號（0 起）→ 關卡魔王。base＝畫法與屬性的原型（要是該區已出現過的怪）
  TG.STAGE_BOSS = {
    0:  { id: "sbBeSlime",   name: "Be 史萊姆王",   base: "slime",    mech: "summon", minion: "mini",   color: "rgba(150,90,255,.22)" },
    1:  { id: "sbThirdS",    name: "三單 S 騎士王", base: "elite",    mech: "guard",                    color: "rgba(80,170,255,.22)" },
    2:  { id: "sbWhoGob",    name: "疑問詞哥布林王", base: "goblin",  mech: "dash",                     color: "rgba(255,120,60,.22)" },
    4:  { id: "sbIngGolem",  name: "進行式石像王",   base: "golem",   mech: "guard",                    color: "rgba(90,220,160,.22)" },
    5:  { id: "sbPastBat",   name: "過去式蝙蝠王",   base: "bat",     mech: "summon", minion: "bat", n: 2, color: "rgba(200,120,255,.22)" },
    6:  { id: "sbWillKnight", name: "未來式騎士王", base: "elite",    mech: "dash",                     color: "rgba(255,215,94,.25)" },
    7:  { id: "sbPrepSplit", name: "介系詞分裂王",   base: "splitter", mech: "summon", minion: "mini",  color: "rgba(80,200,255,.22)" },
    8:  { id: "sbMoreGob",   name: "比較級哥布林王", base: "goblin",  mech: "heal",                     color: "rgba(120,255,120,.2)" },
    10: { id: "sbMostGolem", name: "最高級石像王",   base: "golem",   mech: "heal",                     color: "rgba(255,180,90,.22)" },
    11: { id: "sbToPriest",  name: "不定詞祭司王",   base: "priest",  mech: "heal",                     color: "rgba(255,240,140,.22)" },
    12: { id: "sbHaveKnight", name: "完成式騎士王", base: "elite",    mech: "guard",                    color: "rgba(160,120,255,.22)" },
    13: { id: "sbUpSplit",   name: "片語分裂王",     base: "splitter", mech: "summon", minion: "mini",  color: "rgba(120,255,200,.22)" },
    15: { id: "sbPassGolem", name: "被動石像王",     base: "golem",   mech: "guard",                    color: "rgba(150,210,255,.25)" },
    16: { id: "sbWhoBat",    name: "關係詞蝙蝠王",   base: "bat",     mech: "dash",                     color: "rgba(150,230,255,.25)" },
    17: { id: "sbAskGob",    name: "問句哥布林王",   base: "goblin",  mech: "summon", minion: "frog", n: 3, color: "rgba(255,150,200,.22)" },
    19: { id: "sbMakePriest", name: "句型祭司王",   base: "priest",   mech: "heal",                     color: "rgba(255,120,80,.22)" },
    20: { id: "sbPhraseKnight", name: "片語騎士王", base: "elite",    mech: "dash",                     color: "rgba(255,90,90,.22)" }
  };
  // 數值（模擬調整；改了要回寫 mods/CONTRACT_v3.md §14h）
  TG.SB = {
    hp: 360, spd: 17, gold: 60, lifeDmg: 3, atk: 18, armor: [0, 1, 2, 3, 3],   // 依區域的護甲
    every: { summon: 9, guard: 10, dash: 9, heal: 10 }, first: 4,
    summonMax: 4, summonN: 3, guardT: 3, guardMul: 0.3, dashT: 2.2, dashMul: 2, dashMulFly: 1.4, healSelf: 0.08, healNear: 0.06, healR: 60,
    // 11-25 晚 守城門（engine.js 敵人移動段）：魔王走到終點前 gateD 停下，每 gateEvery 秒扣 1 命（超大魔王 gateEverySuper），打倒才過關；
    //   打倒給 killGold（超大 killGoldSuper）；gateDMap＝各地圖停在終點前幾格（選城門前塔位打得到的一點：森林最後 64 格旁邊沒有塔位，要停在 96；寒冰停 2（城堡在螺旋中心，旁邊 3 個塔位））；停在城門時護甲歸 0
    gateD: 40, gateDMap: [40, 96, 40, 2, 40], gateEvery: 2, gateEverySuper: 1.5, killGold: 40, killGoldSuper: 80
  };
  TG.SUPER_BOSS_HP = 1.0;   // 超大魔王血量倍率（舊的單一值，保留相容）
  // 每關魔王（st.bossType 那隻）血量倍率（11-25 晚，守城門後要打得死；只乘魔王本身，小怪不動；不看答對率）
  TG.BOSS_HP_K = [1, 0.45, 0.5, 0.25, 0.6, 0.25, 0.21, 0.32, 1, 0.22, 0.15, 0.15, 0.15, 0.2, 0.35, 0.16, 0.1, 0.4, 0.25, 0.15, 0.15, 0.25];
  TG.gateDist = (s, e) => { const v = s && s.stage ? TG.SB.gateDMap[s.stage.map] : undefined; return v === undefined ? TG.SB.gateD : v; };
  TG.gateEvery = (s, e) => (TG.isSuperBoss(s, e) ? TG.SB.gateEverySuper : TG.SB.gateEvery);
  TG.isGateBoss = (s, e) => !!(s && s.stage && e && e.type === s.stage.bossType && TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss);
  TG.MECH_NAME = { summon: "叫小怪", guard: "護盾", dash: "衝刺", heal: "回血" };

  // 登錄怪物資料、把關卡魔王掛到關卡上（st.bossType；st.boss 仍是 false＝不是魔王關，世界地圖、簡報照舊分辨）
  for (const k in TG.STAGE_BOSS) {
    // 11-25 晚：原型怪不在（例：只載 engine＋stageboss、沒載 creatures 的祭司）也照登錄——魔王數值都來自 TG.SB，原型只決定畫法與會不會飛
    //   （原本 !b 就略過，node 單獨載入時第 12、20 關沒有魔王，模擬和瀏覽器不一樣）
    const d = TG.STAGE_BOSS[k], st = TG.STAGES[+k], b = TG.ENEMIES[d.base] || {};
    if (!st || st.boss) continue;
    TG.ENEMIES[d.id] = { name: d.name, em: "👑", hp: TG.SB.hp, spd: TG.SB.spd, armor: TG.SB.armor[st.r] || 0, gold: TG.SB.gold, lifeDmg: TG.SB.lifeDmg, atk: TG.SB.atk,
      boss: true, sb: d.mech, sbBase: d.base, fly: !!b.fly, mech: "sb_" + d.mech };
    st.bossType = d.id; st.sboss = d.id;
  }
  TG.isStageBoss = type => !!(TG.ENEMIES[type] && TG.ENEMIES[type].sb);
  TG.isSuperBoss = (s, e) => !!(s && s.stage && s.stage.boss && e && TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss && e.type === s.stage.bossType);

  function cast(s, e) {
    const b = TG.ENEMIES[e.type], C = TG.SB, m = b.sb;
    e.sbN = (e.sbN || 0) + 1;
    if (m === "summon") {
      const d = TG.STAGE_BOSS[s.stage ? s.stage.i : -1] || {}, n = d.n || C.summonN, t = d.minion || "mini";
      if (e.sbN > C.summonMax || !TG.ENEMIES[t]) return;
      for (let i = 0; i < n; i++) TG._spawn(s, t, { r: e.r, d: Math.max(0, e.d - 6 - i * 9) });
    } else if (m === "guard") e.sbGuardT = C.guardT;
    else if (m === "dash") e.sbDashT = C.dashT;
    else if (m === "heal") {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * C.healSelf);
      for (const o of s.enemies) if (o !== e && H(o.x - e.x, o.y - e.y) < C.healR) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * C.healNear);
    }
    s.events.push({ k: "sbMech", e, mech: m, n: e.sbN });
  }

  TG.registerMod({
    name: "stageboss",
    onSpawn(s, e) {
      const b = TG.ENEMIES[e.type]; if (!b || !b.boss) return;
      if (b.sb) e.mechT = TG.SB.first;
      if (TG.isGateBoss(s, e)) e.sbGate = true;   // 守城門（engine.js）
      if (b.sb || TG.isSuperBoss(s, e)) s.events.push({ k: "sbIntro", e, super: !b.sb });
    },
    onKill(s, e) {
      if (!e.sbGate) return;
      const sup = TG.isSuperBoss(s, e), g = sup ? TG.SB.killGoldSuper : TG.SB.killGold;
      s.gold += g; s.sbKilled = (s.sbKilled || 0) + 1;
      s.events.push({ k: "sbKill", e, super: sup, gold: g });
    },
    bossMech(s, e) {
      const b = TG.ENEMIES[e.type]; if (!b || !b.sb) return;
      e.mechT = TG.SB.every[b.sb] || 10;
      if (e.atGate && b.sb !== "summon") return;   // 11-25 晚：在城門攻城時不放護盾／衝刺／回血（回血魔王在城門邊補血，城門邊只有 2～3 座塔，全對也打不死）
      cast(s, e);
    },
    beforeUpdate(s, dt) {
      for (const e of s.enemies) { if (e.sbGuardT > 0) e.sbGuardT -= dt; if (e.sbDashT > 0) e.sbDashT -= dt; }
    },
    damageTaken(d, e) { return e.sbGuardT > 0 ? d * TG.SB.guardMul : d; },
    enemySpeed(v, e) { return e.sbDashT > 0 ? v * (TG.ENEMIES[e.type].fly ? TG.SB.dashMulFly : TG.SB.dashMul) : v; },   // 11-25 晚：會飛的魔王英雄擋不住，衝刺只 ×1.4（關係詞蝙蝠王原本 0／15 被打倒）
    enemyHpMul(mul, type, s) {
      if (!s || !s.stage || type !== s.stage.bossType) return mul;
      const k = TG.BOSS_HP_K[s.stage.i]; mul *= k === undefined ? 1 : k;
      return s.stage.boss ? mul * TG.SUPER_BOSS_HP : mul;
    }
  });
  if (typeof module !== "undefined") module.exports = TG;
})(typeof window !== "undefined" ? window : globalThis);
