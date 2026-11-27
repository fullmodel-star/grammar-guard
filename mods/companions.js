// 外掛：companions（引擎端，node 可載入）。規格見 mods/README.md 與 DESIGN.md §六。
// 同伴 3 位：精靈弓手（遠程・片語動詞）、冰雪法師（遠程控場・比較級最高級）、龍騎士（近戰擋路・被動與關係代名詞）。
// 成長做成「改機制」：每 5 級學會一招（多射一箭、普攻減速、龍息留下火焰…），不只加數字。
// v3（合約 §4，第 8b 組）：同伴大招不再答題 → 花能量 TG.energyCost("compUlt")＋冷卻（COMP.ult），全效果；能量只經過 spendEnergy。
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;
  const isFly = e => !!(TG.ENEMIES[e.type] && TG.ENEMIES[e.type].fly);
  const isBoss = e => !!(TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss);

  // ───── 同伴登錄（TG.HEROES 共用格式）
  const COMP = {
    ids: ["elf", "mage", "dragon"],
    unlock: { elf: 3, mage: 7, dragon: 12 },         // 已通關數 ≥ 多少才有（11-23 提早：10／14／18 → 3／7／12，老闆核准）
    // 剛加入時的等級：11-23 提早解鎖後 4／7／11（原 6／9／12），比當時騎士（Lv6／9／12）略低，靠「落後騎士經驗加倍」追上；
    //   照真人進度（每關 +0.4 級）到第 22 關約 Lv11／12／14，和原本後期加入時的等級（Lv10／11／13）差不多，不會因為早加入就爆強
    startLv: { elf: 4, mage: 7, dragon: 11 },
    MAX: 20,
    // 每 5 級學會的招式（畫面顯示用；效果寫在下方 stats／ultFx／afterUpdate）
    perks: {
      elf: [[5, "連射：普攻一次射 2 隻"], [10, "箭雨覆蓋所有路線"], [15, "箭雨讓怪變慢 3 秒"], [20, "箭雨冷卻縮短 8 秒"]],
      mage: [[5, "寒氣：普攻讓怪變慢"], [10, "碎冰：被冰封的怪多受 30% 傷害"], [15, "冰封多 1 秒"], [20, "冰爆：普攻範圍傷害"]],
      dragon: [[5, "鐵壁：多擋 1 隻怪"], [10, "龍息留下火焰 4 秒"], [15, "龍息與普攻燒得到飛行怪"], [20, "龍爪：普攻範圍傷害"]]
    }
  };
  TG.COMP = COMP;
  const has = (lv, n) => lv >= n;

  TG.HEROES.elf = {
    name: "精靈弓手", em: "🧝", color: "#3fae6a", role: "ranged", domain: "片語動詞", gps: ["G14"],
    ult: "箭雨", ultDesc: "一整條路上的怪都被箭射中（打得到飛行怪）", ultCd: 32,
    stats: lv => ({ hp: 200 + 20 * lv, dmg: 4 + 1 * lv, cd: 0.8, block: 0, regen: 5 + lv, range: 84 + lv, fly: true }),
    ultFx: (s, h, p) => {
      const st = TG.HEROES.elf.stats(h.lv), n = s.map.routes.length;
      let routes;
      if (has(h.lv, 10)) routes = s.map.routes.map((_, r) => r);
      else {   // 選怪最多的那條路（同數就選離英雄最近的路）
        const cnt = new Array(n).fill(0); for (const e of s.enemies) cnt[e.r] = (cnt[e.r] || 0) + 1;
        const near = TG.nearOnMap(s.map, h.x, h.y).r;
        let best = near; for (let r = 0; r < n; r++) if (cnt[r] > cnt[best]) best = r;
        routes = [best];
      }
      const dmg = st.dmg * 1.8 * p * TG.powMul(s);
      for (const e of s.enemies.slice()) if (routes.includes(e.r)) {
        TG._hurt(s, e, dmg * (isBoss(e) ? 0.6 : 1), true);
        if (has(h.lv, 15) && s.enemies.includes(e)) { e.slowF = Math.max(e.slowF, 0.5); e.slowT = Math.max(e.slowT, 3); }
      }
      if (has(h.lv, 20)) h.ultCd -= 8;   // 引擎先設好冷卻才呼叫 ultFx，這裡直接扣
      s.events.push({ k: "cmpRain", routes, p });
    }
  };
  TG.HEROES.mage = {
    name: "冰雪法師", em: "🧙", color: "#5fb6f0", role: "ranged", domain: "比較級與最高級", gps: ["G07", "G08"],
    ult: "冰封", ultDesc: "全場的怪凍住 3 秒（魔王只凍 1 秒）", ultCd: 36,
    // 11-23：攻擊 3＋0.8×等級、冷卻 1.2 → 4＋1.1×等級、0.9。提早解鎖後畫面預設帶「最新解鎖」的同伴＝第 8～12 關都是法師，
    //   舊數值下一般玩家（65%）每關都帶法師時第 3～5 區平均剩 9.1 命、6 種子輸 5 局（帶弓手 12.4、龍騎士 11.5）；調後 11.3 命、輸 1 局。
    //   Lv10 每秒傷害 9.2 → 16.7（弓手含連射約 30；法師主打減速冰封）。再強（4＋1.3×等級）七成對受益太多、「答得越好守得越好」差距不到 2 命
    stats: lv => ({ hp: 190 + 20 * lv, dmg: 4 + 1.1 * lv, cd: 0.9, block: 0, regen: 5 + lv, range: 72 + lv, fly: true }),
    ultFx: (s, h, p) => {
      const st = TG.HEROES.mage.stats(h.lv), base = 3 + (has(h.lv, 15) ? 1 : 0);
      for (const e of s.enemies.slice()) {
        const t = (isBoss(e) ? 1 : base) * p;
        TG._hurt(s, e, st.dmg * 0.6 * p * TG.powMul(s), true);
        if (!s.enemies.includes(e)) continue;
        e.frozenT = Math.max(e.frozenT || 0, t);
        if (has(h.lv, 10)) e.cmpIceT = Math.max(e.cmpIceT || 0, t);
      }
      s.events.push({ k: "cmpFreeze", p, t: base * p });
    }
  };
  TG.HEROES.dragon = {
    name: "龍騎士", em: "🐲", color: "#e0704a", role: "melee", domain: "被動語態與關係代名詞", gps: ["G12", "G13"],
    ult: "龍息", ultDesc: "朝怪最多的方向噴出一直線火焰，高傷害", ultCd: 32,
    stats: lv => ({ hp: 300 + 30 * lv, dmg: 8 + 2 * lv, cd: 1.0, block: 2 + (has(lv, 5) ? 1 : 0), regen: 6 + lv, range: 28, fly: has(lv, 15) }),
    ultFx: (s, h, p) => {
      const st = TG.HEROES.dragon.stats(h.lv), L = 140, W = 18, fly = has(h.lv, 15);
      const line = COMP.bestLine(s, h.x, h.y, L, W, fly);
      const dmg = st.dmg * 3.5 * p * TG.powMul(s);
      for (const e of s.enemies.slice()) if ((fly || !isFly(e)) && COMP.segDist(e.x, e.y, h.x, h.y, line.x2, line.y2) <= W) TG._hurt(s, e, dmg * (isBoss(e) ? 0.7 : 1), true);
      if (has(h.lv, 10)) { s.cmpFires = s.cmpFires || []; s.cmpFires.push({ x1: h.x, y1: h.y, x2: line.x2, y2: line.y2, w: W, t: 4, dps: st.dmg * 0.9 * TG.powMul(s) * p, fly }); }
      s.events.push({ k: "cmpBreath", x1: h.x, y1: h.y, x2: line.x2, y2: line.y2, p });
    }
  };

  // ───── 幾何：點到線段距離、龍息找方向（16 個方向挑打到最多怪的）
  COMP.segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2));
    return H(px - (x1 + dx * t), py - (y1 + dy * t));
  };
  COMP.bestLine = (s, x, y, L, W, fly) => {
    let best = null;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
      let n = 0, hp = 0;
      for (const e of s.enemies) if ((fly || !isFly(e)) && COMP.segDist(e.x, e.y, x, y, x2, y2) <= W) { n++; hp += e.hp; }
      if (!best || n > best.n || (n === best.n && hp > best.hp)) best = { n, hp, x2, y2 };
    }
    return best;
  };

  // ───── 解鎖、等級、經驗（畫面端與測試共用）
  COMP.unlocked = cleared => COMP.ids.filter(id => cleared >= COMP.unlock[id]);
  COMP.firstUnlock = () => Math.min(...COMP.ids.map(id => COMP.unlock[id]));
  COMP.canBring = (st, cleared) => COMP.unlocked(cleared).length > 0 || !!(st && st.i >= COMP.firstUnlock());
  COMP.rec = (data, id) => {   // data＝S.mods.companions（舊存檔沒有也行）
    if (!data.lv || typeof data.lv !== "object" || Array.isArray(data.lv)) data.lv = {};
    if (!data.xp || typeof data.xp !== "object" || Array.isArray(data.xp)) data.xp = {};
    // 存檔防呆（11-21 QA）：lv:"abc" 會變 NaN、1e9 會直接帶上場 → 整數、夾在 起始等級～MAX；經驗夾在 0～升級所需
    const lv = Math.floor(+data.lv[id]);
    data.lv[id] = Number.isFinite(lv) && lv >= 1 ? Math.max(COMP.startLv[id] || 1, Math.min(COMP.MAX, lv)) : (COMP.startLv[id] || 1);
    const xp = Math.floor(+data.xp[id]);
    data.xp[id] = data.lv[id] >= COMP.MAX || !Number.isFinite(xp) || xp < 0 ? 0 : Math.min(xp, COMP.xpNeed(data.lv[id]) - 1);
    return { lv: data.lv[id], xp: data.xp[id] };
  };
  // 同伴自己的經驗曲線（11-21 第二刀 P2-14）：原本跟騎士一樣 200＋100×等級，精靈弓手 Lv6→20 要 20,300 經驗
  //   ≈ 113 場三星（一場約 8 分鐘＝15 小時）；改成 120＋40×等級 → 8,680 經驗 ≈ 48 場三星（約 6.5 小時；落後騎士時經驗加倍會更快）
  COMP.XP_BASE = 120; COMP.XP_STEP = 40;
  COMP.xpNeed = lv => COMP.XP_BASE + COMP.XP_STEP * lv;
  COMP.xpToMax = id => { let t = 0; for (let l = COMP.startLv[id]; l < COMP.MAX; l++) t += COMP.xpNeed(l); return t; };
  // 過關經驗：贏 60+40×星（英雄挑戰 +80）；輸了也給 25（陪練），無盡模式依波數；落後騎士等級時 ×2 追趕
  COMP.xpFor = (won, stars, heroic, endlessWave, behind) => {
    let xp = endlessWave ? Math.min(240, 10 * endlessWave) : won ? 60 + 40 * stars + (heroic ? 80 : 0) : 25;
    return behind ? xp * 2 : xp;
  };
  // 加經驗，回傳 [{lv, perk}] 每升一級一筆
  COMP.gainXp = (data, id, xp) => {
    COMP.rec(data, id);
    const ups = [];
    if (data.lv[id] >= COMP.MAX) { data.xp[id] = 0; return ups; }
    data.xp[id] += xp;
    while (data.lv[id] < COMP.MAX && data.xp[id] >= COMP.xpNeed(data.lv[id])) {
      data.xp[id] -= COMP.xpNeed(data.lv[id]); data.lv[id]++;
      const pk = COMP.perks[id].find(x => x[0] === data.lv[id]);
      ups.push({ lv: data.lv[id], perk: pk ? pk[1] : null });
    }
    if (data.lv[id] >= COMP.MAX) data.xp[id] = 0;
    return ups;
  };
  COMP.idxOf = s => s.heroes.findIndex((h, i) => i > 0 && COMP.ids.includes(h.id));

  // ───── v3 同伴大招：花能量＋冷卻、不答題（合約 §4.1 ENERGY_COST.compUlt；卡片／每日規則可用 fold 掛勾 energyCost 改價）
  COMP.ultCost = (s, idx) => TG.energyCost("compUlt", s, idx);
  // 能不能放：是同伴、冷卻好了、沒倒下、能量夠
  COMP.canUlt = (s, idx) => !!s && idx > 0 && !!s.heroes[idx] && COMP.ids.includes(s.heroes[idx].id) && TG.heroUltReady(s, idx) && TG.canSpend(s, COMP.ultCost(s, idx));
  // 放大招：扣能量（spendEnergy）→ TG.heroCast（設冷卻、ultFx 全效果、推 ult 事件；不呼叫 answerResult＝不算答題）
  COMP.ult = function (s, idx) {
    if (!COMP.canUlt(s, idx)) return false;
    const cost = COMP.ultCost(s, idx);
    if (!TG.spendEnergy(s, cost, "compUlt")) return false;
    return TG.heroCast(s, idx, 1, { src: "compUlt", cost });
  };

  // 解鎖說明（別的外掛若也用同一個通關數，就接在後面）
  const addUnlock = (k, txt) => { TG.UNLOCKS[k] = TG.UNLOCKS[k] ? TG.UNLOCKS[k] + "、" + txt : txt; };
  addUnlock(COMP.unlock.elf, "同伴「精靈弓手」");
  addUnlock(COMP.unlock.mage, "同伴「冰雪法師」");
  addUnlock(COMP.unlock.dragon, "同伴「龍騎士」");

  // ───── 機器人用：帶哪位、何時放大招
  COMP.botPick = cleared => { const u = COMP.unlocked(cleared); return u.length ? u[cleared % u.length] : null; };
  // 理想進度（每關 +0.6 級；11-23 提早解鎖前是 +0.8，早加入的同伴照 0.8 會在第 22 關到 Lv17，比原本 Lv14 強太多）。regression 另用真人進度 realProg（+0.4）蓋掉
  COMP.botLv = (id, cleared) => Math.min(COMP.MAX, COMP.startLv[id] + Math.max(0, Math.floor((cleared - COMP.unlock[id]) * 0.6)));
  COMP.wantUlt = (s, h) => {
    const n = s.enemies.length; if (!n) return false;
    if (h.id === "elf") { const cnt = {}; for (const e of s.enemies) cnt[e.r] = (cnt[e.r] || 0) + 1; return Math.max(...Object.values(cnt)) >= 5 || s.enemies.some(isBoss); }
    if (h.id === "mage") { const rt = s.map.routes; return n >= 7 || s.enemies.some(e => (isBoss(e) || n >= 4) && e.d > rt[e.r].len * 0.7); }
    if (h.id === "dragon") return COMP.bestLine(s, h.x, h.y, 140, 18, has(h.lv, 15)).n >= 3 || s.enemies.some(e => isBoss(e) && H(e.x - h.x, e.y - h.y) < 120);
    return n >= 4;
  };

  // 機器人（regression 與瀏覽器共用，11-23 第 7 步平衡）：有塔金幣夠升級、但放完大招能量就不夠升級 → 先留能量升級；
  //   魔王在場或有怪走過路線 80% 照放（危急時大招優先）。s._botMaxLv＝機器人自己的升級上限（一般 3 級、完美 6 級；省略＝6）。
  COMP.botSaveForUp = function (s, idx) {
    if (s.enemies.some(e => isBoss(e) || e.d > s.map.routes[e.r].len * 0.8)) return false;
    const maxLv = s._botMaxLv || TG.MAX_LV || 6;
    const tw = s.towers.filter(t => !TG.TOWERS[t.type].energy && t.lv < maxLv && !(t.sealT > 0) && !TG.upgradeBlocked(s, t)).sort((a, b) => a.lv - b.lv)[0];
    if (!tw || s.gold < TG.upgradeCost(tw.type, tw.lv, s) + 20) return false;
    return (s.energy || 0) < COMP.ultCost(s, idx) + TG.energyCost("up", s, tw);
  };

  TG.registerMod({
    name: "companions",
    onNewGame(s) { s.cmpFires = []; },
    // 普攻的額外招式：讀這一步的 slash 事件（每個事件只處理一次）
    afterUpdate(s, dt) {
      for (const ev of s.events) {
        if (ev.k !== "slash" || ev._cmp) continue;
        ev._cmp = 1;
        const h = s.heroes[ev.idx]; if (!h || !COMP.ids.includes(h.id)) continue;
        const st = h.st || TG.HEROES[h.id].stats(h.lv), dmg = st.dmg * Math.sqrt(s.hpMul);
        const tgt = s.enemies.find(e => H(e.x - ev.x, e.y - ev.y) < 2);
        if (h.id === "elf" && has(h.lv, 5)) {   // 連射：再射一隻
          const o = s.enemies.filter(e => e !== tgt && H(e.x - h.x, e.y - h.y) <= st.range && TG.every("targetable", e, s, h)).sort((a, b) => b.d - a.d)[0];
          if (o) { TG._hurt(s, o, dmg * 0.8, 2); s.events.push({ k: "cmpShot", x1: h.x, y1: h.y, x2: o.x, y2: o.y, _cmp: 1 }); }
        }
        if (h.id === "mage") {
          if (has(h.lv, 5) && tgt) { tgt.slowF = Math.max(tgt.slowF, 0.3); tgt.slowT = Math.max(tgt.slowT, 1.5); }
          if (has(h.lv, 20)) for (const o of s.enemies.slice()) if (o !== tgt && H(o.x - ev.x, o.y - ev.y) <= 26) TG._hurt(s, o, dmg * 0.5, 2);
        }
        if (h.id === "dragon" && has(h.lv, 20)) for (const o of s.enemies.slice()) if (o !== tgt && (st.fly || !isFly(o)) && H(o.x - ev.x, o.y - ev.y) <= 26) TG._hurt(s, o, dmg * 0.5, 2);
      }
      // 龍息火焰、碎冰計時
      if (s.cmpFires && s.cmpFires.length) for (const f of s.cmpFires.slice()) {
        f.t -= dt;
        for (const e of s.enemies.slice()) if ((f.fly || !isFly(e)) && COMP.segDist(e.x, e.y, f.x1, f.y1, f.x2, f.y2) <= f.w) TG._hurt(s, e, f.dps * dt, true);
        if (f.t <= 0) s.cmpFires.splice(s.cmpFires.indexOf(f), 1);
      }
      for (const e of s.enemies) if (e.cmpIceT > 0) e.cmpIceT -= dt;
    },
    damageTaken(d, e) { return e.cmpIceT > 0 && e.frozenT > 0 ? d * 1.3 : d; },
    botOpts(opts, st, cleared) {
      const id = COMP.botPick(cleared); if (!id) return;
      const base = opts.heroes || [{ id: "knight", lv: opts.heroLv || 1 }];
      opts.heroes = base.concat([{ id, lv: COMP.botLv(id, cleared) }]);
    },
    // 機器人：怪多、能量夠就放（v3 不答題，yes 用不到）
    botAct(s) {
      s.heroes.forEach((h, idx) => {
        if (idx === 0 || !COMP.canUlt(s, idx)) return;
        if (COMP.wantUlt(s, h) && !COMP.botSaveForUp(s, idx)) COMP.ult(s, idx);
      });
    }
  });

  if (typeof module !== "undefined" && module.exports) module.exports = COMP;
})(typeof window !== "undefined" ? window : globalThis);
