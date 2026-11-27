// 外掛：wordbullet（引擎端，node 可載入）— 詞彈（2026-11-21 答題雙軌改版）
// 部分怪頭上掛一句挖空短句；畫面底部出 2～3 顆字塊（屬於最前面那隻掛句子的怪），
// 點對＝字從城堡飛向那隻怪、打到直接擊倒（掛句子的一律不是魔王）；點錯只讓那顆字塊淡掉，不懲罰。
// 不暫停、不放慢、不增加怪數：只在原本的怪身上掛旗標 e.wb。
//   e.wb = { miss: 0, fired: false }   miss＝點錯幾次；fired＝已經發射（字在飛）
//   s.wb = { left, n, shots: [{ eid, x, y, word, t }] }
// 事件：wbFire { e, word, x, y }（發射）、wbHit { e, x, y, word, first }（打中；first＝第一次就點對）
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  const H = Math.hypot;

  TG.PF_WB_AT = 0.1;         // 先備戰的自動詞彈：怪走到路線一成就發射（11-25 試玩：原本 1/4，約六成還沒發射怪就被打死、孩子看不到）
  TG.WB_FROM_STAGE = 2;      // 第 3 關（序號 2）起（11-24 第二輪：詞彈說明卡移到第 3 關，怪也跟著從第 3 關才出；原本第 2 關＝序號 1）
  TG.WB_MAX_PER_WAVE = 3;
  TG.WB_SPEED = 360;         // 飛字速度（邏輯單位／秒）
  TG.WB_BONUS = 2;           // 擊倒額外金幣
  TG.WB_DMG = 1;             // 打中扣掉最大血量的比例（≥1＝直接擊倒）
  // 每波掛幾隻：第 1～2 波 1 隻、3～5 波 2 隻、6 波起 3 隻；無盡模式第 2 波起
  TG.wbQuota = s => {
    if (s.stage ? s.stage.i < TG.WB_FROM_STAGE : s.wave < 2) return 0;
    const base = Math.min(TG.WB_MAX_PER_WAVE, 1 + Math.floor(s.wave / 3));
    // 先備戰再守城（2026-11-25）：守城不出詞彈題；改成「上一輪備戰第一次答對的題數 ÷2（進位）」顆自動詞彈（TG.pfRoundEnd 設 s.pfWb），掛到怪身上、走到路線 1/4 自動發射
    return TG.pfOn && TG.pfOn(s) ? Math.min(base, s.pfWb | 0) : base;
  };
  // 哪些怪可以掛句子：不是魔王、不是小怪、本身沒有別的題（字盾、改錯、Be 小怪）、不隱形
  const NO = { mini: 1, frog: 1, beMinion: 1 };
  TG.wbEligible = type => {
    const b = TG.ENEMIES[type];
    return !!b && !b.boss && !b.minion && !b.shield && !b.quiz && !b.invis && !NO[type];
  };

  // ───── 出題（純函式，畫面端與測試共用）
  // 短句：挖空句 ≤8 字、≤42 字元；正解與干擾選項都 ≤14 字元
  TG.wbShort = q => !!q && q.wb !== false && (!TG.kindOk || TG.kindOk(q, "word")) &&   // v3：只收 fill 題型（mods/CONTRACT_v3.md §1.3）
    typeof q.q === "string" && q.q.includes("___") && Array.isArray(q.o) && q.o.length >= 2 &&
    q.q.length <= 42 && q.q.split(/\s+/).length <= 8 && q.o.every(o => typeof o === "string" && o.length <= 14) &&
    !(q.gp === "G14" && /^a/.test(q.id || ""));   // 11-21 第二刀：詞彈不顯示中文，自動片語題（干擾項只靠中文排除）可能兩解 → 不用；原創片語題（o／c）干擾項代回不成片語，可用
  // 做成字塊：n＝2 或 3 顆（正解＋1～2 個干擾），順序打亂
  TG.wbMake = function (q, rng, n) {
    n = Math.max(2, Math.min(3, n || 3, q.o.length));
    const ds = q.o.slice(1);
    for (let i = ds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ds[i], ds[j]] = [ds[j], ds[i]]; }
    const opts = [{ t: q.o[0], ok: true }].concat(ds.slice(0, n - 1).map(t => ({ t, ok: false })));
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return { q, text: q.q, opts, right: q.o[0] };
  };
  // 從題池挑一題短句（優先錯題本；最近出過的避開）
  TG.wbPick = function (pool, rng, wrong, recent) {
    const src = (pool || []).filter(TG.wbShort);
    if (!src.length) return null;
    const fresh = recent && recent.length ? src.filter(q => !recent.includes(q.id)) : src;
    return TG.pickQuestion(fresh.length ? fresh : src, null, rng, wrong || {}, [], { up: false });
  };

  // ───── 目前輪到哪一隻（走得最遠、還沒發射的掛句子怪）
  TG.wbFront = s => {
    let best = null, bp = -1;
    for (const e of s.enemies) {
      if (!e.wb || e.wb.fired) continue;
      const p = e.d / s.map.routes[e.r].len;
      if (p > bp) { bp = p; best = e; }
    }
    return best;
  };
  // 點字塊：ok＝點的是正解。點錯只記 miss（不扣分、不算答錯）；點對就發射。
  // 第一次就點對＝算答對（能量、連對）；點錯過才點對＝照樣發射，但不算答題（不給能量、不加連對，畫面端記成錯題）。
  // v3（合約 §3、§4）：第一次點對走 answerResult 帶 { kind:"word", src:"word", qk, gp, qid, try:1, sec }，
  //   能量由引擎 energyGain 依 ENERGY_GAIN.byKind.word 給（目標 1；空殼期＝舊規則 0）；舊旗標 word:true 保留相容。
  //   info（可省略）：畫面端給的作答紀錄（題目欄位、秒數）；沒給時用掛在怪身上的題目 e.wbq.q 補題目欄位。
  TG.wbInfo = function (e, info) {
    const q = e && e.wbq && e.wbq.q;
    return Object.assign(TG.ansInfo ? TG.ansInfo(q || null) : {}, info || {}, { kind: "word", src: "word", word: true, try: 1 });
  };
  TG.wordBullet = function (s, eid, ok, info) {
    const e = s.enemies.find(x => x.id === eid);
    if (!e || !e.wb || e.wb.fired) return null;
    if (!ok) { e.wb.miss++; return "miss"; }
    e.wb.fired = true;
    const first = e.wb.miss === 0 && !(TG.pfOn && TG.pfOn(s)), from = s.map.end;   // 先備戰的自動詞彈不算答題
    const sh = { eid, x: from[0], y: Math.min(from[1], 380), word: e.wbWord || "", first, t: 0 };
    (s.wb || (s.wb = { left: 0, n: 0, shots: [] })).shots.push(sh);
    s.events.push({ k: "wbFire", e, word: sh.word, x: sh.x, y: sh.y });
    if (first) TG.answerResult(s, true, TG.wbInfo(e, info));
    return "fire";
  };

  TG.registerMod({
    name: "wordbullet",
    onNewGame(s) { s.wb = { left: 0, n: 0, shots: [] }; },
    onStartWave(s) {
      const w = s.wb || (s.wb = { left: 0, n: 0, shots: [] });
      w.left = TG.wbQuota(s);
      w.pending = s.spawn.filter(TG.wbEligible).length;   // 這一波還會出幾隻可以掛的怪
    },
    onSpawn(s, e) {
      const w = s.wb; if (!w) return;
      if (!TG.wbEligible(e.type)) return;
      w.pending = Math.max(0, (w.pending || 0) - 1);
      if (w.left <= 0) return;
      // 平均分散在整波：剩下的可掛怪數 ≤ 還要掛的數量就一定掛，否則依比例抽
      const chance = w.left / Math.max(1, w.pending + 1);
      if (w.pending + 1 <= w.left || s.rng() < chance) { e.wb = { miss: 0, fired: false }; w.left--; w.n++; }
    },
    afterUpdate(s, dt) {
      const w = s.wb; if (!w) return;
      if (TG.pfOn && TG.pfOn(s)) for (const e of s.enemies) if (e.wb && !e.wb.fired && e.d >= s.map.routes[e.r].len * TG.PF_WB_AT) { if (!e.wbWord) e.wbWord = "詞彈"; TG.wordBullet(s, e.id, true); e.wb.miss = -1; }   // 先備戰：自動發射（不算答題）
      if (!w.shots.length) return;
      for (const sh of w.shots.slice()) {
        sh.t += dt;
        const e = s.enemies.find(x => x.id === sh.eid);
        if (!e) { w.shots.splice(w.shots.indexOf(sh), 1); continue; }   // 飛到一半怪已經死了／漏掉
        const dx = e.x - sh.x, dy = e.y - sh.y, L = H(dx, dy), step = TG.WB_SPEED * dt;
        if (L > step) { sh.x += dx / L * step; sh.y += dy / L * step; continue; }
        w.shots.splice(w.shots.indexOf(sh), 1);
        s.events.push({ k: "wbHit", e, x: e.x, y: e.y, word: sh.word, first: sh.first });
        e._critT = 0.3; s.events.push({ k: "crit", e });   // 手感外掛（juice.ui.js）畫暴擊
        if (TG.WB_DMG >= 1 || e.hp <= e.maxHp * TG.WB_DMG) TG._kill(s, e, TG.WB_BONUS);
        else TG._hurt(s, e, e.maxHp * TG.WB_DMG, true);
      }
    },
    // 模擬測試：怪走到路線 1/4 後輪到牠，依答對率點（點錯就再點另一顆，等於第二次一定對）
    botAct(s, yes) {
      if (TG.pfOn && TG.pfOn(s)) return;   // 先備戰：自動發射，不用點
      const e = TG.wbFront(s); if (!e || e.d < s.map.routes[e.r].len * 0.25) return;
      if (yes()) TG.wordBullet(s, e.id, true);
      else { TG.wordBullet(s, e.id, false); TG.wordBullet(s, e.id, true); }
      s._nWb = (s._nWb || 0) + 1;
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
