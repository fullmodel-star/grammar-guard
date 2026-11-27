// 外掛：terrain（引擎端，node 可載入）。規格見 mods/README.md 與 DESIGN.md §三。
// 特殊地形關：
//   迷霧（第 3 區，序號 10～14）：塔射程 ×0.7；英雄身邊的塔看得清；任何題目答對 → 全場驅霧 20 秒（11-24 第二輪 10→20）。
//   夜戰＋結冰路面（第 4 區，序號 15～18）：塔射程 ×0.8；英雄身邊有光圈；答對放照明彈 6 秒；
//     路上有冰面，地面怪走在冰上忽快忽慢（用時間與怪物編號算，模擬可重現）。
//   岩漿（第 5 區，序號 19～21）：約每 25 秒噴發，先警告 3 秒；空塔位被封 15 秒；
//     有塔的位置塔被「烤熱」停火 6 秒。v3（2026-11-22）：任何題目答對 → 冷卻 1 座最燙的塔；
//     花 TG.energyCost("lavaCool") 能量（TG.terrainCoolAll）→ 立刻全部冷卻。答錯不加罰。
//   v3 拿掉「驅霧／照明」與「答題冷卻」兩個答題入口（任何答對本來就會驅霧；答題集中到側邊面板）。
// 狀態放 s.tr；地形種類 s.terrain（"fog"|"night"|"lava"|null）。
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  const DEF = TG.TERRAIN = {
    // 11-24 第二輪（試玩小美 P0-2：約 1 分鐘才答對 1 題，霧幾乎一直在＝答得慢吃兩次虧）：答對 1 題驅霧 10 → 20 秒
    fog:   { name: "迷霧", em: "🌫️", rangeMul: 0.7, light: 70, clearT: 20, hpMul: 1 },
    night: { name: "夜戰＋結冰路面", em: "🌙", rangeMul: 0.8, light: 80, clearT: 6, hpMul: 1.1,
             ice: [[0.12, 0.2], [0.39, 0.47], [0.66, 0.74]] },   // 冰面：路線長度的比例區段
    lava:  { name: "岩漿", em: "🌋", first: 12, every: 25, warn: 3, blockT: 15, hotT: 6, coolTime: 8, n: 2, hpMul: 1.1 }
  };
  // 模擬玩家：
  //   panel＝霧濃／夜暗、怪多時，約每幾秒在「側邊面板」自願答 1 題（驅霧是答對的副作用）。
  //     v3 拿掉驅霧鈕後，真人改在側邊面板答題；regression 的機器人經濟模型（第 1 組，合約 §6.2）還沒接上前先由這裡代答，
  //     接上後把 panel 設 0 停用（不然會重複答題）。
  //   lavaSpendHot＝岩漿把至少幾座塔烤熱時，能量夠就花能量全冷卻。
  const BOT = TG.terrainBot = { panel: 12, lavaSpendHot: 1 };
  // 依區域指定地形（第 3／4／5 區）
  TG.STAGES.forEach(st => { st.terrain = st.r === 2 ? "fog" : st.r === 3 ? "night" : st.r === 4 ? "lava" : st.terrain || null; });

  const alive = h => h && h.dead <= 0;
  // (x,y) 是否在英雄光圈內（迷霧／夜晚都看得清）
  TG.terrainLit = function (s, x, y) {
    const d = s.terrain && DEF[s.terrain]; if (!d || !d.light) return true;
    return s.heroes.some(h => alive(h) && H(h.x - x, h.y - y) <= d.light);
  };
  // 這座塔現在的射程倍率（1 ＝ 不打折）
  TG.terrainRangeMul = function (s, tw) {
    const t = s.terrain; if (t !== "fog" && t !== "night") return 1;
    if (s.tr.clearT > 0 || TG.terrainLit(s, tw.x, tw.y)) return 1;
    return DEF[t].rangeMul;
  };
  TG.terrainIceZones = function (map) {
    return map.routes.map((rt, r) => DEF.night.ice.map(([a, b]) => ({ r, d0: rt.len * a, d1: rt.len * b })));
  };
  TG.terrainOnIce = (s, e) => !!s.tr && s.tr.ice.some(z => z.r === e.r && e.d >= z.d0 && e.d <= z.d1);
  // 冰面上的速度倍率：0.5～1.5 之間擺盪，每隻怪相位不同（可重現，不用亂數）
  TG.terrainIceMul = (s, e) => 1 + 0.5 * Math.sin(s.time * 2.4 + e.id * 1.9);
  TG.terrainHot = s => !s.tr ? [] : s.towers.filter(t => (s.tr.hot[t.id] || 0) > 0).map(t => t.id);
  TG.terrainBlocked = (s, slot) => !!s.tr && (s.tr.block[slot] || 0) > 0;
  // 最燙的那座（剩餘秒數最多；一樣多取先蓋的）
  TG.terrainHottest = s => {
    let best = null, bt = 0;
    if (s.tr) for (const t of s.towers) { const h = s.tr.hot[t.id] || 0; if (h > bt) { bt = h; best = t; } }
    return best;
  };
  // 任何答對：冷卻 1 座最燙的塔（onAnswer 自動呼叫）；回傳冷卻的塔 id 或 null
  TG.terrainCoolOne = function (s) {
    const tw = TG.terrainHottest(s); if (!tw) return null;
    s.tr.hot[tw.id] = 0;
    s.events.push({ k: "lavaCool", ids: [tw.id], one: true });
    return tw.id;
  };
  // 花能量立刻全部冷卻（不答題）：能量不夠或沒有烤熱的塔 → false；能量只經過 spendEnergy（合約 §4.2）
  TG.terrainCoolCost = s => TG.energyCost("lavaCool", s);
  TG.terrainCanCoolAll = s => !!s.tr && TG.terrainHot(s).length > 0 && TG.canSpend(s, TG.terrainCoolCost(s));
  TG.terrainCoolAll = function (s) {
    if (!TG.terrainCanCoolAll(s)) return false;
    if (!TG.spendEnergy(s, TG.terrainCoolCost(s), "lavaCool")) return false;
    const ids = TG.terrainHot(s);
    for (const id of ids) s.tr.hot[id] = 0;
    s.events.push({ k: "lavaCool", ids, all: true });
    return true;
  };

  function erupt(s) {
    const tr = s.tr, d = DEF.lava;
    const hot = [], blocked = [];
    for (const slot of tr.warn) {
      const tw = s.towers.find(t => t.slot === slot);
      if (tw) { tr.hot[tw.id] = d.hotT; hot.push(tw.id); }
      else { tr.block[slot] = d.blockT; blocked.push(slot); }
    }
    tr.eruptions++;
    s.events.push({ k: "lavaErupt", slots: tr.warn.slice(), hot, blocked });
    tr.warn = [];
  }
  function warn(s) {
    const tr = s.tr, cand = s.map.slots.map((_, i) => i).filter(i => !TG.terrainBlocked(s, i));
    const pick = [];
    while (pick.length < DEF.lava.n && cand.length) pick.push(cand.splice(Math.floor(s.rng() * cand.length), 1)[0]);
    tr.warn = pick;
    if (pick.length) s.events.push({ k: "lavaWarn", slots: pick.slice() });
  }

  TG.registerMod({
    name: "terrain",
    onNewGame(s, opts) {
      const t = opts && opts.terrain !== undefined ? opts.terrain : (s.stage && s.stage.terrain);
      s.terrain = DEF[t] ? t : null;
      s.tr = { clearT: 0, clears: 0, ice: s.terrain === "night" ? [].concat(...TG.terrainIceZones(s.map)) : [],
        lavaT: DEF.lava.first, warn: [], block: {}, hot: {}, eruptions: 0 };
    },
    enemyHpMul(mul, type, s) {
      // 平衡（模擬結果）：不答題時地形讓塔明顯變弱；常答題（驅霧／冷卻）的玩家反而更輕鬆，
      // 所以不降怪血，第 4、5 區還略加 10%，讓「答題＝力量」的差距留在地形上。
      return s.terrain ? mul * DEF[s.terrain].hpMul : mul;
    },
    beforeUpdate(s, dt) {
      const tr = s.tr; if (!tr || !s.terrain) return;
      if (tr.clearT > 0) tr.clearT = Math.max(0, tr.clearT - dt);
      if (s.terrain !== "lava") return;
      for (const k in tr.block) if (tr.block[k] > 0) tr.block[k] = Math.max(0, tr.block[k] - dt);
      for (const k in tr.hot) if (tr.hot[k] > 0) tr.hot[k] = Math.max(0, tr.hot[k] - dt);
      if (!s.waveActive && !tr.warn.length) return;   // 備戰時岩漿不噴
      const before = tr.lavaT;
      tr.lavaT -= dt;
      if (before > DEF.lava.warn && tr.lavaT <= DEF.lava.warn) warn(s);
      if (tr.lavaT <= 0) { erupt(s); tr.lavaT = DEF.lava.every; }
    },
    onAnswer(s, correct) {
      const t = s.terrain; if (!correct || !s.tr) return;
      if (t === "lava") { TG.terrainCoolOne(s); return; }
      if (t !== "fog" && t !== "night") return;
      const fresh = s.tr.clearT <= 0;
      s.tr.clearT = Math.max(s.tr.clearT, TG.pfOn && TG.pfOn(s) && !s.waveActive && TG.PF ? TG.PF.fogT : DEF[t].clearT); s.tr.clears++;   // 先備戰再守城：備戰答對＝下一波整波沒霧（60 秒）
      s.events.push({ k: "terrainClear", terrain: t, fresh, t: s.tr.clearT });
    },
    towerStats(st, tw, s) {
      const m = TG.terrainRangeMul(s, tw);
      if (m !== 1) st.range *= m;
      return st;
    },
    targetable(e, s, tw) {
      // 烤熱的塔停火（tw 有 slot 才是塔；英雄不受影響）
      if (s.terrain === "lava" && tw && tw.slot !== undefined && (s.tr.hot[tw.id] || 0) > 0) return false;
    },
    enemySpeed(v, e, s) {
      if (s.terrain !== "night" || TG.ENEMIES[e.type].fly) return;
      if (TG.terrainOnIce(s, e)) { e.iceMul = TG.terrainIceMul(s, e); return v * e.iceMul; }
      e.iceMul = 0;
    },
    canBuildSlot(s, slot) {
      if (TG.terrainBlocked(s, slot)) return false;
    },
    // ── 模擬玩家（v3：沒有地形答題鈕了；驅霧／冷卻 1 座是「任何答對」的副作用）
    botAct(s, yes) {
      const t = s.terrain, tr = s.tr; if (!t || !tr || !(BOT.panel > 0)) return;
      if (tr.botT > 0) tr.botT -= 0.5;
      if ((t === "fog" || t === "night") && tr.clearT <= 0 && !(tr.botT > 0) && s.waveActive && s.enemies.length >= 4 && TG.qCanAsk(s, "fill", "panel")) {
        TG.answerResult(s, yes(), { kind: "mcq", src: "panel", qk: "fill", try: 1 }); tr.botT = BOT.panel;
      }
    },
    botEvent(s, ev, yes) {
      if (ev.k !== "lavaErupt" || !ev.hot.length) return;
      // 岩漿把塔烤熱：先在側邊面板答 1 題（答對＝冷卻最燙的 1 座，代答規則同 botAct 的 panel），還有烤熱的塔、能量夠就花能量全部冷卻
      if (BOT.panel > 0 && TG.qCanAsk(s, "fill", "panel")) TG.answerResult(s, yes(), { kind: "mcq", src: "panel", qk: "fill", try: 1 });
      if (TG.terrainHot(s).length >= BOT.lavaSpendHot) TG.terrainCoolAll(s);
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
