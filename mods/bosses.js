// 外掛：bosses（引擎端，node 可載入）。規格見 mods/README.md 與 DESIGN.md §四。
// 後三隻魔王：沼澤九頭蛇（第 15 關）、冰霜巫妖（第 19 關）、終極魔龍（第 22 關）。
// 魔王狀態都放在 e.bm（不和其他外掛的欄位撞名）。
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  // ───── 可調參數（平衡在這裡改）
  const CFG = {
    hydra: { every: 14, headT: 20, hit: 0.12, heal: 0.10, rageT: 5, rageMul: 1.5, headSpd: 0.06, degT: 8, pfDegT: 5, pfChop: 2 },   // degT：降級的頭幾秒後自己枯掉；pfDegT／pfChop：先答題守城中（不出題）頭枯得快、砍頭便宜（11-25 晚）
    lich: { every: 18, iceT: 13, take: 0.15, holdT: 6, shatter: 0.06, degIceT: 7 },                          // degIceT：降級的冰盾幾秒後被塔磨掉
    sealDegT: 6,                                                                                              // 降級的魔龍封印只封幾秒
    dragon: { thr: [0.66, 0.33], invT: 2.5, every: [12, 12, 10],
      plan: [["be", "seal"], ["hydra", "ice"], ["be", "hydra", "seal", "ice"]] },
    beHit: 0.12   // 引擎 tapBeMinion 固定打魔王 12%
  };

  TG.ENEMIES.hydra = { name: "沼澤九頭蛇", em: "🐍", hp: 1000, spd: 15, armor: 3, gold: 170, lifeDmg: 5, atk: 30, boss: true, mech: "hydra" };
  TG.ENEMIES.lich = { name: "冰霜巫妖", em: "🧙", hp: 600, spd: 13, armor: 3, gold: 180, lifeDmg: 5, atk: 30, boss: true, mech: "lich" };
  TG.ENEMIES.dragonKing = { name: "終極魔龍", em: "🐲", hp: 1000, spd: 12, armor: 4, gold: 300, lifeDmg: 5, atk: 34, boss: true, mech: "dragon" };
  const MINE = { hydra: 1, lich: 1, dragon: 1 };
  const isMine = e => !!(e && e.bm && TG.ENEMIES[e.type] && MINE[TG.ENEMIES[e.type].mech]);

  // 區域魔王換掉一般魔龍；關卡名稱跟著改（世界地圖看得出是誰）
  const SET = { 2: ["hydra", "沼澤九頭蛇"], 3: ["lich", "冰霜巫妖"], 4: ["dragonKing", "終極魔龍"] };
  for (const r of Object.keys(SET)) {
    TG.REGIONS[r].boss = SET[r][0];
    for (const st of TG.STAGES) if (st.r === +r && st.boss) { st.bossType = SET[r][0]; st.name = SET[r][1]; }
  }

  const B = TG.BOSSES = { CFG, isMine, BOT: { pay: true } };
  // ───── v3 情境題降級（2026-11-23，整合待辦 E）：機制發動前問 TG.qSituOk(s, 題型)；
  //   超過含情境題的總上限（TG.QBUDGET_HARD）或排句滿 TG.ORDER_MAX → 這一次改成「不出題」的降級版（事件帶 deg:true）：
  //   會走到降級的只有「這關已經答很多題」的玩家（不答題的人永遠拿到有題目的版本，跳過就吃答錯／逾時的後果），
  //   所以降級版是「計時自動解、但比答對差」：九頭蛇新頭不出題，頭數 +1（牠變快）撐 degT 秒後自己枯掉（不回血、不暴走、也沒有砍頭傷害）；
  //   冰盾：排句滿 4 題先改出選擇題（1 點，答對一樣打破）；總題量也滿了才不出題，只撐 degIceT 秒（塔慢慢磨掉，沒有震傷）；
  //   魔龍封印不出題，只封 sealDegT 秒。
  //   三種都可以花能量立刻解（能量只能靠答對取得＝紅線 1）：砍頭／破盾和答對一樣有傷害。
  //   花費走 TG.energyCost（chop／iceBreak 兩個新價目，引擎表沒有時這裡補預設值；數值調整權在第 1 組）；封印沿用 unseal。
  if (TG.ENERGY_COST) {
    if (TG.ENERGY_COST.chop == null) TG.ENERGY_COST.chop = 3;
    if (TG.ENERGY_COST.iceBreak == null) TG.ENERGY_COST.iceBreak = 3;
  }
  B.situOk = (s, k) => !TG.qSituOk || TG.qSituOk(s, k);
  B.cost = (what, s) => {
    const n = TG.energyCost ? TG.energyCost(what, s) : (TG.ENERGY_COST && TG.ENERGY_COST[what]) || 3;
    return what === "chop" && TG.pfWaveQuiet && TG.pfWaveQuiet(s) ? Math.min(n, CFG.hydra.pfChop) : n;   // 11-25 晚：先答題守城中砍頭便宜（能量都拿去升級，3 格常常湊不到）
  };
  const pay = (s, what) => { const n = B.cost(what, s); return TG.canSpend(s, n) && TG.spendEnergy(s, n, what); };
  const ev = (s, k, e, x) => s.events.push(Object.assign({ k, eid: e.id, boss: e }, x || {}));
  const alive = (s, eid) => s.enemies.find(x => x.id === eid && isMine(x));

  // ───── 九頭蛇：長出新頭 → 答片語題
  B.growHead = function (s, e) {
    if (e.bm.head) return false;                 // 上一顆頭還沒處理完，不疊題
    const deg = !B.situOk(s, "fill");
    e.bm.head = { id: ++e.bm.qid, t: deg ? (TG.pfWaveQuiet && TG.pfWaveQuiet(s) ? CFG.hydra.pfDegT : CFG.hydra.degT) : CFG.hydra.headT, deg };
    e.bm.heads++; e.bm.mechN++; if (deg) e.bm.degN = (e.bm.degN || 0) + 1;
    ev(s, "bossHead", e, { id: e.bm.head.id, deg });
    return true;
  };
  // 降級的頭計時到：自己枯掉（頭數回來），不回血、不暴走、沒有砍頭傷害（比逾時輕、比答對差）
  function headFade(s, e) { e.bm.heads = Math.max(0, e.bm.heads - 1); ev(s, "bossHeadFade", e); }
  // 時間到沒答：頭長回來，回一點血、暫時暴走（不答題的後果）
  function headFail(s, e) {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * CFG.hydra.heal);
    e.bm.rageT = CFG.hydra.rageT;
    ev(s, "bossHeadBad", e, { why: "time" });
  }
  // 答錯（11-24 老闆裁示拿掉「答錯會回血」）：沒砍到、頭留著（頭數不減），其他什麼都不加——不回血、不暴走；
  //   和錯字哥布林「答錯不變快」同一原則。逾時（headFail）的回血、暴走與九頭蛇其他機制照舊。
  function headMiss(s, e) { ev(s, "bossHeadBad", e, { why: "wrong" }); }
  // v3（合約 §3）：每個答題入口都帶 kind／src；畫面端把 askQuestion／qbus 給的 info（sec、try、qk、gp、qid、retry）原樣傳進來
  const ansInfo = (base, info) => Object.assign({}, info || {}, base);   // kind／src 以入口為準（不被呼叫端蓋掉）
  B.ansInfo = ansInfo;
  // 玩家答完新頭的題：ok＝答對。回傳 null 表示這顆頭已經不在（逾時或魔王已死）
  // info（可省略）：統一作答紀錄（kind 固定 mcq、src 固定 hydra）；頭已經不在時不記帳（畫面端自己記學習紀錄）
  TG.bossHeadAnswer = function (s, eid, id, ok, info) {
    const e = alive(s, eid);
    if (!e || !e.bm.head || e.bm.head.id !== id || e.bm.head.deg) return null;   // 降級的頭沒有題目
    e.bm.head = null;
    TG.answerResult(s, !!ok, ansInfo({ kind: "mcq", src: "hydra" }, info));
    if (ok) { e.bm.heads = Math.max(0, e.bm.heads - 1); e.bm.chopped++; ev(s, "bossHeadOk", e); TG._hurt(s, e, e.maxHp * CFG.hydra.hit, true); }
    else headMiss(s, e);
    return !!ok;
  };

  // 花能量砍掉目前的頭（降級或不想答題時；有題目的頭也可以花能量直接砍，題目會自動撤掉）。回傳 false＝沒有頭或能量不夠
  B.chopHead = function (s, eid) {
    const e = alive(s, eid);
    if (!e || !e.bm.head || !pay(s, "chop")) return false;
    e.bm.head = null; e.bm.heads = Math.max(0, e.bm.heads - 1); e.bm.chopped++;
    ev(s, "bossHeadOk", e, { energy: true });
    TG._hurt(s, e, e.maxHp * CFG.hydra.hit, true);
    return true;
  };

  // ───── 冰盾：句子重組打破
  B.raiseIce = function (s, e) {
    if (e.bm.ice > 0) return false;
    // 出哪一種題：排句（3 點）→ 排句滿 4 題改出選擇題（1 點，一樣能打破）→ 總題量滿了才降級（不出題）
    const mode = B.situOk(s, "order") ? "order" : B.situOk(s, "fill") ? "mcq" : null, deg = !mode;
    const T = deg ? CFG.lich.degIceT : CFG.lich.iceT;
    e.bm.ice = T; e.bm.iceMax = T; e.bm.iceId++; e.bm.mechN++; e.bm.iceDeg = deg; e.bm.iceMode = mode;
    if (deg) { e.bm.iceTried = e.bm.iceId; e.bm.degN = (e.bm.degN || 0) + 1; }   // 降級：這面冰盾沒有題可答
    ev(s, "bossIce", e, { id: e.bm.iceId, deg, mode });
    return true;
  };
  // 排句滿 4 題時的冰盾選擇題：答對打破＋震傷；答錯冰盾多撐 holdT 秒（和排錯一樣）。info＝作答紀錄（kind mcq、src lich）
  TG.bossIceAnswer = function (s, eid, id, ok, info) {
    const e = alive(s, eid);
    if (!e || !(e.bm.ice > 0) || e.bm.iceId !== id || e.bm.iceTried === id || e.bm.iceMode !== "mcq") return null;
    e.bm.iceTried = id;
    TG.answerResult(s, !!ok, ansInfo({ kind: "mcq", src: "lich" }, info));
    if (ok) { e.bm.ice = 0; ev(s, "bossIceBreak", e); TG._hurt(s, e, e.maxHp * CFG.lich.shatter, true); }
    else { e.bm.ice = CFG.lich.holdT; e.bm.iceMax = CFG.lich.holdT; ev(s, "bossIceHold", e, { t: CFG.lich.holdT }); }
    return !!ok;
  };
  // 花能量立刻打破冰盾（降級、排錯後多撐的冰盾都可以）：和排對一樣碎掉＋震傷。回傳 false＝沒有冰盾或能量不夠
  B.breakIce = function (s, eid) {
    const e = alive(s, eid);
    if (!e || !(e.bm.ice > 0) || !pay(s, "iceBreak")) return false;
    e.bm.ice = 0; e.bm.iceTried = e.bm.iceId;
    ev(s, "bossIceBreak", e, { energy: true });
    TG._hurt(s, e, e.maxHp * CFG.lich.shatter, true);
    return true;
  };
  // 玩家排完句子：mistakes＝排錯次數。<2 打破冰盾並震傷；≥2 冰盾多撐 holdT 秒
  // info（可省略）：統一作答紀錄（kind 固定 order、src 固定 lich；排句不算三星率、題量記 3 點）
  TG.bossIceOrder = function (s, eid, id, mistakes, info) {
    const e = alive(s, eid);
    if (!e || !(e.bm.ice > 0) || e.bm.iceId !== id || e.bm.iceTried === id || (e.bm.iceMode && e.bm.iceMode !== "order")) return null;
    e.bm.iceTried = id;
    const ok = mistakes < 2;
    TG.answerResult(s, ok, ansInfo({ kind: "order", src: "lich" }, info));
    if (ok) { e.bm.ice = 0; ev(s, "bossIceBreak", e); TG._hurt(s, e, e.maxHp * CFG.lich.shatter, true); }
    else { e.bm.ice = CFG.lich.holdT; e.bm.iceMax = CFG.lich.holdT; ev(s, "bossIceHold", e, { t: CFG.lich.holdT }); }
    return ok;
  };

  // ───── 終極魔龍借用的 Be 巨人與時光樹妖（沿用引擎的事件，畫面與機器人都已經會處理）
  B.beCall = function (s, e) {
    if (!B.situOk(s, "fill")) return false;   // 11-25：魔龍的 Be 小怪是情境題，到題量上限（或先備戰的守城中）就不叫，換下一招（原本沒檢查，先備戰模擬時第 22 關超出 45 點才發現）
    const callId = s.eid * 100 + 1, labels = ["am", "is", "are"];
    for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [labels[i], labels[j]] = [labels[j], labels[i]]; }
    labels.forEach((lab, k) => { const m = TG._spawn(s, "beMinion", { r: e.r, d: Math.max(0, e.d - 6 - k * 10) }); m.label = lab; m.callId = callId; m.bossId = e.id; });
    e.bm.mechN++;
    s.events.push({ k: "beCall", callId, boss: e });
    return true;
  };
  // v3：魔龍的封印改發 bossSeal 事件（畫面端 bosses.ui 走 TGUI.qbus 出解封題，不再進 index 的舊題目佇列）；
  //   時光樹妖（引擎內建 mech "seal"）照舊發 seal 事件，由 index 處理（見交件報告：② 改 qbus 時可直接用 B.unseal）
  B.SEAL_T = 15;
  B.seal = function (s, e) {
    const live = s.towers.filter(t => t.sealT <= 0);
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [live[i], live[j]] = [live[j], live[i]]; }
    const deg = !B.situOk(s, "fill");
    const ids = live.slice(0, 2).map(t => { t.sealT = deg ? CFG.sealDegT : B.SEAL_T; return t.id; });
    if (!ids.length) return false;
    e.bm.mechN++; e.bm.sealId = (e.bm.sealId || 0) + 1; if (deg) e.bm.degN = (e.bm.degN || 0) + 1;
    s.events.push({ k: "bossSeal", ids, id: e.bm.sealId, eid: e.id, boss: e, deg });
    return true;
  };
  // 花能量立刻解封（沿用引擎價目 unseal；降級或不想答題時）。回傳 false＝沒有封住的塔或能量不夠
  B.unsealPay = function (s, ids) {
    const left = B.stillSealed(s, ids || s.towers.map(t => t.id));
    if (!left.length || !pay(s, "unseal")) return false;
    for (const tw of s.towers) if (left.includes(tw.id)) tw.sealT = 0;
    s.events.push({ k: "bossUnseal", ids: left, energy: true });
    return true;
  };
  // 解封題答完：答對立刻解封；答錯塔照樣等封印自己結束（不加罰）。info＝統一作答紀錄（kind mcq、src seal）
  // 情境題不受題量上限擋，但照樣記帳（合約 §2.2）。回傳 null＝要解的塔都已經自己解開了（不記帳，畫面端照樣記學習紀錄）
  B.stillSealed = (s, ids) => ids.filter(id => { const t = s.towers.find(x => x.id === id); return t && t.sealT > 0; });
  B.unseal = function (s, ids, ok, info) {
    const left = B.stillSealed(s, ids || []);
    if (!left.length) return null;
    TG.answerResult(s, !!ok, ansInfo({ kind: "mcq", src: "seal" }, info));
    if (ok) for (const tw of s.towers) if (left.includes(tw.id)) tw.sealT = 0;
    return !!ok;
  };
  const DO = { be: B.beCall, seal: B.seal, hydra: B.growHead, ice: B.raiseIce };
  B.dragonMech = function (s, e) {
    const ph = e.bm.phase, plan = CFG.dragon.plan[ph - 1];
    for (let k = 0; k < plan.length; k++) {
      const kind = plan[e.bm.step++ % plan.length];
      if (DO[kind](s, e)) { e.bm.last = kind; break; }
    }
    e.mechT = CFG.dragon.every[ph - 1];
  };
  const floorHp = e => e.bm.phase < 3 ? CFG.dragon.thr[e.bm.phase - 1] * e.maxHp : 0;
  function phaseCheck(s, e) {
    while (e.bm.phase < 3 && e.hp <= floorHp(e) + 1e-6) {
      e.bm.phase++; e.bm.invT = CFG.dragon.invT; e.bm.ice = 0; e.bm.step = 0;
      e.mechT = CFG.dragon.invT + 1;
      ev(s, "bossPhase", e, { phase: e.bm.phase });
    }
  }

  TG.registerMod({
    name: "bosses",
    onSpawn(s, e) {
      const b = TG.ENEMIES[e.type];
      if (!b || !MINE[b.mech]) return;
      e.bm = { heads: b.mech === "hydra" ? 3 : 0, head: null, qid: 0, chopped: 0, rageT: 0, ice: 0, iceMax: 0, iceId: 0, iceTried: 0,
        phase: 1, invT: 0, step: 0, mechN: 0, last: null, born: s.time };
      ev(s, "bossIntro", e, { mech: b.mech });
    },
    bossMech(s, e) {
      if (!isMine(e)) return;
      const mech = TG.ENEMIES[e.type].mech;
      if (mech === "hydra") { e.mechT = B.growHead(s, e) ? CFG.hydra.every : 3; }
      else if (mech === "lich") { e.mechT = B.raiseIce(s, e) ? CFG.lich.every : 3; }
      else if (mech === "dragon") { if (e.bm.invT > 0) e.mechT = e.bm.invT + 0.5; else B.dragonMech(s, e); }
    },
    beforeUpdate(s, dt) {
      for (const e of s.enemies.slice()) {
        if (!isMine(e)) continue;
        const m = e.bm;
        if (m.rageT > 0) m.rageT -= dt;
        if (m.invT > 0) m.invT -= dt;
        if (m.ice > 0) { m.ice -= dt; if (m.ice <= 0) { m.ice = 0; ev(s, "bossIceMelt", e); } }
        if (m.head) { m.head.t -= dt; if (m.head.t <= 0) { const dg = m.head.deg; m.head = null; dg ? headFade(s, e) : headFail(s, e); } }
        if (TG.ENEMIES[e.type].mech === "dragon") phaseCheck(s, e);
      }
    },
    afterUpdate(s) {
      for (const e of s.enemies) if (isMine(e) && TG.ENEMIES[e.type].mech === "dragon") phaseCheck(s, e);
    },
    damageTaken(d, e, s) {
      if (!isMine(e)) return;
      const m = e.bm;
      if (m.invT > 0) return 0;
      if (m.ice > 0) d *= CFG.lich.take;
      if (TG.ENEMIES[e.type].mech === "dragon" && m.phase < 3) {
        const fl = floorHp(e);               // 一次最多打到換階段的那條線，不會一口氣跳兩階段
        if (e.hp - d < fl) d = Math.max(0, e.hp - fl);
      }
      return d;
    },
    enemySpeed(v, e) {
      if (!isMine(e)) return;
      const m = e.bm;
      if (m.heads > 3) v *= 1 + CFG.hydra.headSpd * (m.heads - 3);
      if (m.rageT > 0) v *= CFG.hydra.rageMul;
      return v;
    },
    enemyMove(s, e) { if (isMine(e) && e.bm.invT > 0) return false; },   // 換階段表演：停下來
    // ───── 模擬測試：玩家看到題目後 2～6 秒作答
    // 降級版（deg）沒有題可答：機器人能量夠就花能量解（BOT.pay），不夠就等時間
    botEvent(s, ev2, yes, rng) {
      const later = (k, d) => (s._bossBot = s._bossBot || []).push({ t: s.time + d, k, eid: ev2.eid, id: ev2.id, ids: ev2.ids });
      if (ev2.k === "bossHead") later(ev2.deg ? "chop" : "head", ev2.deg ? 1 + rng() * 2 : 2 + rng() * 2);
      if (ev2.k === "bossIce") later(ev2.deg ? "break" : ev2.mode === "mcq" ? "iceq" : "ice", ev2.deg ? 1 + rng() * 2 : ev2.mode === "mcq" ? 2 + rng() * 2 : 3 + rng() * 3);
      if (ev2.k === "bossSeal") { if (ev2.deg) later("unseal", 1 + rng() * 2); else B.unseal(s, ev2.ids, yes(), { try: 1 }); }   // 有題：和舊的 seal 一樣看到就答
    },
    botAct(s, yes) {
      if (!s._bossBot || !s._bossBot.length) return;
      const due = s._bossBot.filter(x => x.t <= s.time);
      s._bossBot = s._bossBot.filter(x => x.t > s.time);
      for (const x of due) {
        if (x.k === "head") TG.bossHeadAnswer(s, x.eid, x.id, yes(), { try: 1 });
        else if (x.k === "ice") TG.bossIceOrder(s, x.eid, x.id, yes() ? 0 : 2, { try: 1 });
        else if (x.k === "iceq") TG.bossIceAnswer(s, x.eid, x.id, yes(), { try: 1 });
        else if (!B.BOT.pay) continue;
        else if (x.k === "chop") { const e = alive(s, x.eid); if (e && e.bm.head && e.bm.head.id === x.id) B.chopHead(s, x.eid); }
        else if (x.k === "break") { const e = alive(s, x.eid); if (e && e.bm.iceId === x.id) B.breakIce(s, x.eid); }
        else if (x.k === "unseal") B.unsealPay(s, x.ids);
      }
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
