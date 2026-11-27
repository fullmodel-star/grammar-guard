// 外掛：qkinds（引擎端，node 可載入）— v3 題型工具、抽題、掌握度與文法徽章計算
// 負責：第 4 組（題庫）。合約：mods/CONTRACT_v3.md §1、§8.4；題庫規格 _research/題庫擴充規格_2026-11-22.md §2、§5。
// 載入順序：引擎端外掛最前（qkinds → creatures → …），其他外掛載入時就能用這裡的函式。
// 測試：test/qkinds.test.js；題庫檢查：node _data/verify_qdb.js。
//
// 2026-11-22 第 4 組實作（QKINDS_VER 1）：
//   1. 手寫改錯（k:"fix"，帶 bad 字串，可以是多字段如 "to eat"）：TG.makeFix 依 bad 轉成字的位置（點其中任一字都算對）；
//      回傳多 opts（第二步要選的正確寫法，o[0] 是正解）、hand:true、wt。→ TG.QK_USE.fix 加 "fix"。
//   2. 手寫排句（k:"order"，q 沒有 ___、o 是空陣列）：TG.makeOrder／TG.orderable 認得；回傳多 alts（可接受的其他語序，
//      已去標點切成字）、trap、tail。→ TG.QK_USE.order 加 "order"。
//      2026-11-23：排句畫面（index.html orderTap，第②組）已支援 o.alts 與 o.fixedTail → TG.QK_ORDER.alt／tail 改 true（關掉＝不出這類排句）。
//      2026-11-23：test/regression.js 的 makeFix 迴圈已只跑挖空題 → build_db.py 預設匯出 fill,fix,order，手寫排句進題庫。
//   3. 抽題（TG.pickQuestion 取代 engine.js 的空殼版，原版留在 TG._pickQuestionV0）：
//      題型過濾篩完是空的時，改從全題庫找「同用途」的題，絕不退回別的題型（新題型不會被當挖空題出）；
//      同一局同一 fam 只出一次（記在每局的 recent 陣列上，題池用完才退回「最近 40 題」）；同文法點 sig 最近 4 次 ×0.2；
//      同一 sk 連續第 3 題 ×0.3；關卡有 gpW（文法點目標比例）時照比例抽。記憶是空的時與舊版逐位元相同（同樣的亂數用量）。
//   4. 第 1 批新文法點的關卡分配提案：TG.STAGE_GPS_V3（給第①組照抄進 TG.STAGES；TG.stagePoolV3 只給檢查用）。
//   5. 掌握度與三階徽章（合約 §8.4）：TG.masteryPush／masteryOf／badgeTier／badgeTiers／badgeUpdate／badgeNeedsCare。
//   第 2 期新題型（fill2 trans dlg trf sit）：題卡（第 3 組）會畫了，把題型加進 TG.QK_CARD_OK，再加進 TG.QK_USE.choice／camp。
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  if (!TG) return;

  TG.QKINDS_VER = 1;

  // ───── 題型用途（合約 §1.3）。只動 fix、order；choice／camp／word／be 維持只有挖空（fill）
  const addUse = (use, k) => { const a = TG.QK_USE[use] || (TG.QK_USE[use] = ["fill"]); if (!a.includes(k)) a.push(k); };
  addUse("fix", "fix");
  addUse("order", "order");
  TG.QK_CARD_OK = [];                          // 題卡會畫的非 fill 題型（第 2 期由第 3 組通知後加）；verify_qdb.js 用來擋外洩
  TG.QK_ORDER = { alt: true, tail: true };     // 2026-11-23：第②組排句畫面已支援 o.alts（其他語序）與 o.fixedTail（句尾固定段）
  TG.QK_SENT = ["trans", "dlg", "trf", "sit"]; // 選項是整句的題型（快答門檻 1.5 秒）

  // ───── 小工具
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRe = s => new RegExp("(?<![A-Za-z'])" + esc(s) + "(?![A-Za-z'])");
  const TOK = /[A-Za-z0-9']+|[^\sA-Za-z0-9']/g;   // 與 engine.js makeFix 相同的切字
  TG.qWords = s => String(s || "").replace(/[^A-Za-z0-9' ]+/g, " ").trim().split(/\s+/).filter(Boolean);   // 去標點切字（排句比對用）
  TG.qFam = q => (q && (q.fam || q.id)) || null;
  // 選項組合簽名：選項排序後小寫串起來（沒有選項的題回 null）
  TG.qSig = q => q && Array.isArray(q.o) && q.o.length >= 2 ? q.o.map(x => String(x).toLowerCase().trim()).sort().join("|") : null;
  // 完整正解句：fill／fill2 代入正解、fix 改回正確、order 原句＋tail、句子型＝正解整句
  TG.qFull = function (q) {
    if (!q) return "";
    const k = TG.kindOf(q);
    if (k === "fill" || k === "fill2") { let s = q.q; for (const p of String((q.o && q.o[0]) || "").split("｜")) s = s.replace("___", p); return s; }
    if (k === "fix") { const m = q.bad ? wordRe(q.bad).exec(q.q) : null; return m && q.o ? q.q.slice(0, m.index) + q.o[0] + q.q.slice(m.index + m[0].length) : q.q; }
    if (k === "order") return q.q + (q.tail || "");
    return q.o && q.o[0] ? q.o[0] : q.q;
  };

  // ───── 改錯（手寫題）
  TG._makeFixV0 = TG._makeFixV0 || TG.makeFix;
  TG.makeFix = function (q, rng) {
    if (q && TG.kindOf(q) === "fix" && q.bad) {
      const m = wordRe(q.bad).exec(q.q);
      if (m) {
        const a = q.q.slice(0, m.index), b = q.q.slice(m.index + m[0].length);
        const pre = a.match(TOK) || [], mid = m[0].match(TOK) || [], post = b.match(TOK) || [];
        return { tokens: pre.concat(mid, post), bad: mid.map((_, i) => pre.length + i), wrong: q.bad, right: q.o[0], full: a + q.o[0] + b,
          opts: q.o.slice(), hand: true, wt: q.wt || null };
      }
    }
    if (!q || !Array.isArray(q.o) || q.o.length < 2 || typeof q.q !== "string" || !q.q.includes("___"))   // 做不出改錯題（排句等）：不當掉
      return { tokens: (q && typeof q.q === "string" ? q.q.match(TOK) : null) || [], bad: [], wrong: null, right: null, full: q ? TG.qFull(q) : "", none: true };
    return TG._makeFixV0(q, rng);
  };

  // ───── 排句（手寫題）
  TG._makeOrderV0 = TG._makeOrderV0 || TG.makeOrder;
  TG.makeOrder = function (q, rng) {
    const o = TG._makeOrderV0(q, rng);
    if (q && TG.kindOf(q) === "order") {
      if (q.tail) { o.tail = q.tail; o.full = q.q + q.tail; o.fixedTail = true; }   // tail 固定顯示在句尾，學生只排 q
      o.alts = (q.alt || []).map(TG.qWords).filter(w => w.length === o.words.length);   // 比對一律忽略標點與大小寫
      if (q.trap) o.trap = q.trap;
    }
    return o;
  };
  // 學生排的字（依序）是不是可接受的語序（原句或 alt；忽略標點與大小寫）——給排句畫面用
  TG.orderAccepts = function (o, picked) {
    const n = x => TG.qWords(x).join(" ").toLowerCase(), p = n((picked || []).join(" "));
    return [o.words].concat(o.alts || []).some(w => n(w.join(" ")) === p);
  };
  TG._orderableV0 = TG._orderableV0 || TG.orderable;
  TG.orderable = q => {
    if (!q) return false;
    if (TG.kindOf(q) === "order") {
      if (q.alt && q.alt.length && !TG.QK_ORDER.alt) return false;
      if (q.tail && !TG.QK_ORDER.tail) return false;
    }
    return TG._orderableV0(q);
  };

  // ───── 抽題（合約 §1.4；題庫規格 §5.1–5.2）
  // 每局記憶掛在該局的 recent 陣列上（index.html 每局新建 run.recent）；也可用 ctx.mem 指定（null＝不記）
  const MEMS = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  TG.qMem = function (recent) {
    if (!MEMS || !recent || typeof recent !== "object") return null;
    let m = MEMS.get(recent); if (!m) { m = { fam: {}, sig: {}, sk: [], n: 0 }; MEMS.set(recent, m); } return m;
  };
  TG.QPICK = { SIG_Q: 4, SIG_W: 0.2, SK_RUN: 2, SK_W: 0.3 };
  TG.qMark = function (mem, q) {
    if (!mem || !q) return;
    const f = TG.qFam(q); if (f) mem.fam[f] = 1;
    const s = TG.qSig(q), g = q.gp || "orig";
    if (s) { const a = mem.sig[g] || (mem.sig[g] = []); a.push(s); while (a.length > TG.QPICK.SIG_Q) a.shift(); }
    mem.sk.push(q.sk || null); while (mem.sk.length > TG.QPICK.SK_RUN) mem.sk.shift();
    mem.n++;
  };
  const globalQDB = () => { try { if (typeof QDB !== "undefined" && Array.isArray(QDB)) return QDB; } catch (e) {} return Array.isArray(root.QDB) ? root.QDB : null; };
  TG._pickQuestionV0 = TG._pickQuestionV0 || TG.pickQuestion;
  TG.pickQuestion = function (QDB, lv, rng, wrong, recent, ctx) {
    wrong = wrong || {}; recent = recent || []; ctx = ctx || {};
    const up = ctx.up !== undefined ? !!ctx.up : TG.accUp(TG.liveGame);
    const heroic = ctx.heroic !== undefined ? !!ctx.heroic : !!(TG.liveGame && TG.liveGame.heroic);
    const use = ctx.use || "choice", mem = ctx.mem !== undefined ? ctx.mem : TG.qMem(recent);
    const lvOk = q => lv === null || q.lv === lv;
    const raw = lv === null ? QDB : QDB.filter(q => q.lv === lv);
    let src = raw.filter(q => TG.kindOk(q, use));
    if (!src.length) {   // 題池裡沒有這個用途的題型：從全題庫找同用途的題，絕不把別的題型當這個用途出
      const all = ctx.all || globalQDB() || [];
      src = all.filter(q => TG.kindOk(q, use) && lvOk(q));
      if (!src.length) src = all.filter(q => TG.kindOk(q, use));
      if (!src.length) src = raw.filter(q => TG.kindOf(q) === "fill");   // 挖空題在每個用途都畫得出來
      if (!src.length) return null;
    }
    const famSeen = mem && mem.n ? q => !!mem.fam[TG.qFam(q)] : null;
    let pool = src.filter(q => !recent.includes(q.id) && !(famSeen && famSeen(q)));
    if (!pool.length && famSeen) pool = src.filter(q => !recent.includes(q.id));   // 這局題池的 fam 都出過了：退回「最近 40 題」
    const base = pool.length ? pool : src;
    // 權重：錯題 ×5、原創 ×1.5（照舊）× 選項組合輪替 × 子規則連續 × 關卡文法點比例
    const st = ctx.stage !== undefined ? ctx.stage : (TG.liveGame && TG.liveGame.stage);
    const gpW = st && st.gpW, cnt = {};
    let B = 0;
    if (gpW) for (const q of base) if (q.gp && gpW[q.gp] !== undefined) { cnt[q.gp] = (cnt[q.gp] || 0) + 1; B++; }
    const skLast = mem && mem.sk.length >= TG.QPICK.SK_RUN && mem.sk.every(x => x && x === mem.sk[0]) ? mem.sk[0] : null;
    const W = TG.QPICK;
    const ws = base.map(q => {
      let w = (wrong[q.id] ? 5 : 1) * (q.id[0] === "o" ? 1.5 : 1);
      if (mem && mem.n) {
        const s = TG.qSig(q), Q = mem.sig[q.gp || "orig"];
        if (s && Q && Q.includes(s)) w *= W.SIG_W;
        if (skLast && q.sk === skLast) w *= W.SK_W;
      }
      if (gpW && q.gp && cnt[q.gp]) { const tot = Object.keys(cnt).reduce((a, g) => a + (gpW[g] || 0), 0) || 1; w *= (gpW[q.gp] / tot) * B / cnt[q.gp]; }
      return w;
    });
    let r = rng() * ws.reduce((a, b) => a + b, 0), pick = base[base.length - 1];
    for (let i = 0; i < base.length; i++) { r -= ws[i]; if (r <= 0) { pick = base[i]; break; } }
    // 英雄挑戰：每題都換高一級；答對率 >85%：UP_CHANCE 機率換高一級。錯題本的題（wrong）不換
    if (pick && !wrong[pick.id] && (heroic || (up && rng() < TG.UP_CHANCE))) {
      const all = ctx.all || globalQDB() || QDB;
      const keep0 = TG.wbShort && src.length && src.every(TG.wbShort) ? TG.wbShort : null;
      const keep = famSeen ? (x => (!keep0 || keep0(x)) && !famSeen(x)) : keep0;
      const h = TG.harderOf(pick, all, rng, recent, { keep, use, stage: st });
      if (h) { TG.qMark(mem, h); return h; }
    }
    TG.qMark(mem, pick);
    return pick;
  };
  // 第二次回補（題庫規格 §5.3）：同一子規則、不同 fam、題型盡量不同、同用途；找不到回 null
  TG.qSibling = function (q, all, rng, o) {
    o = o || {}; rng = rng || Math.random; all = all || globalQDB() || [];
    if (!q || !q.sk) return null;
    const use = o.use || "choice", f = TG.qFam(q);
    // 11-25 題庫組查出：復仇題的姊妹題原本不看本局出過什麼 → 同一局同題重複（第 3 關模擬 83% 的局有題目出現 2 次以上）。o.recent／o.mem＝本局最近 40 題與 fam 記憶，出過的排除
    const seenId = new Set(o.recent || []), famSeen = (o.mem && o.mem.fam) || {};
    const c = all.filter(x => x.sk === q.sk && TG.qFam(x) !== f && x.id !== q.id && TG.kindOk(x, use) && (!o.keep || o.keep(x)) && !seenId.has(x.id) && !famSeen[TG.qFam(x)]);
    if (!c.length) return null;
    const diff = c.filter(x => TG.kindOf(x) !== TG.kindOf(q)), L = diff.length ? diff : c;
    return L[Math.floor(rng() * L.length)];
  };

  // ───── 第 1 批新文法點的關卡分配（題庫規格 §1.3、撰寫者 C 的 README_C.md 第 5 節）
  // 給第①組照抄：TG.STAGES[i].gps ＝ STAGE_GPS_V3[i].gps；orig 照下表；name、rule 可一起換。
  // lvr＝{文法點: [最低, 最高]} 只收這個等級範圍（stagePool 要支援，見報告）；gpW＝{文法點: 目標比例}（pickQuestion 已支援，放進 STAGES 就生效）。
  // Be 小怪仍只用 G01；時光樹妖解封題限時態（G02 G04 G05 G25）；九頭蛇新頭仍只用 G14；冰盾排句優先 G32（各外掛自己的規則，第⑧組）。
  TG.STAGE_GPS_V3 = [
    { gps: ["G01", "G15", "G17", "G18"], orig: [], name: "be 動詞與名詞", rule: "be 動詞 am／is／are、名詞單複數、a／an／the、There is／There are。" },
    { gps: ["G03", "G21"], orig: [], lvr: { G21: [1, 1] }, name: "第三人稱單數", rule: "第三人稱單數動詞加 -s／-es，以及借 do／does 的否定句和問句。" },
    { gps: ["G16", "G17", "G19", "G20"], orig: [], name: "代名詞・冠詞・疑問詞", rule: "代名詞主格／受格／所有格、a 與 an、祈使句與 Let's、Who／What／Where／How 等疑問詞。" },
    { gps: ["G01", "G03", "G15", "G16", "G17", "G18", "G19", "G20", "G21"], orig: [1], boss: true },
    { gps: ["G05", "G23"], orig: [], name: "現在進行式", rule: "am／is／are＋V-ing＝正在做；always、usually 等頻率副詞的位置，too 和 either。" },
    { gps: ["G02", "G04", "G21"], orig: [], name: "過去式", rule: "be 動詞過去式 was／were、一般動詞過去式，以及借 did 的否定句和問句。" },
    { gps: ["G06", "G25"], orig: [], name: "助動詞與未來式", rule: "can、must、should 後面接原形；will＋原形、be going to＋原形說未來。" },
    { gps: ["G10", "G22"], orig: [], name: "介系詞", rule: "時間介系詞 in／on／at，地方介系詞 in、on、under、next to、in front of、between。" },
    { gps: ["G07", "G24"], orig: [], name: "比較級與數量詞", rule: "比較級加 -er 或 more；many／much、some／any、a lot of。" },
    { gps: ["G02", "G04", "G05", "G06", "G07", "G10", "G22", "G23", "G24", "G25"], orig: [2], boss: true },
    { gps: ["G08", "G29"], orig: [], name: "最高級與感覺形容詞", rule: "the＋最高級；look、feel、sound 後面接形容詞，-ing 令人…、-ed 感到…。" },
    { gps: ["G09", "G30"], orig: [], lvr: { G30: [3, 3] }, name: "不定詞與動名詞", rule: "want to、enjoy V-ing；It is＋形容詞＋to、It takes…to、too…to。" },
    { gps: ["G11", "G26"], orig: [], name: "完成式與過去進行式", rule: "have／has＋過去分詞；was／were＋V-ing＝過去某時正在做。" },
    { gps: ["G14", "G27"], orig: [], name: "片語動詞與連接詞", rule: "動詞＋介副詞要整組記；and、but、or、so 與 not only…but also。" },
    { gps: ["G08", "G09", "G11", "G14", "G26", "G27", "G29", "G30"], orig: [3], boss: true },
    { gps: ["G12", "G34"], orig: [], name: "被動語態與授與動詞", rule: "be＋過去分詞＝被…；give／buy＋人＋東西，倒過來加 to／for；used to＋原形。" },
    { gps: ["G13", "G28"], orig: [], name: "關係代名詞與副詞子句", rule: "人用 who、東西用 which；when、if 說未來也用現在式，because 不和 so 一起用。" },
    { gps: ["G32", "G33", "G35"], orig: [], name: "間接問句・附加問句・感嘆句", rule: "間接問句用直述句語序、附加問句前肯後否、What／How 感嘆句。" },
    { gps: ["G12", "G13", "G28", "G32", "G33", "G34", "G35"], orig: [4], boss: true },
    { gps: ["G31", "G30", "G09", "G34"], orig: [], lvr: { G30: [4, 5], G09: [4, 5], G34: [4, 5] }, gpW: { G31: 35, G30: 35, G09: 15, G34: 15 },
      name: "進階句型", rule: "使役與感官動詞＋原形、It 句型與 too…to／so…that、不定詞與動名詞、授與動詞與 used to（取代超綱的假設語氣、過去完成式）。" },
    { gps: ["G14"], orig: [] },   // 11-24 第二輪：非魔王關不放沒文法點的原創題（第 3、18 關同）
    { gps: ["G01", "G03", "G16", "G21", "G04", "G06", "G22", "G25", "G09", "G11", "G14", "G29", "G12", "G13", "G32", "G33", "G30", "G31", "G34"], orig: [3, 4, 5], boss: true }
  ];
  // 只給檢查用（verify_qdb.js、test/qkinds.test.js）：照提案表算第 i 關題池
  TG.stagePoolV3 = function (QDB, i) {
    const p = TG.STAGE_GPS_V3[i]; if (!p) return [];
    return QDB.filter(q => (q.gp && p.gps.includes(q.gp) && (!p.lvr || !p.lvr[q.gp] || (q.lv >= p.lvr[q.gp][0] && q.lv <= p.lvr[q.gp][1]))) ||
      (q.id[0] === "o" && p.orig.includes(q.lv)));
  };

  // ───── 掌握度與徽章（合約 §8.4；題庫規格 §5.4–5.5；門檻以 knight_tree.json 的 badges 為準）
  // d＝S.mods.gear；d.mast＝{ gp: [[ok, k, lv, t, n?], …] }（n＝選項數，可省略＝依題型預設）、d.btier＝{ gp: 0～3 }、d.bday＝{ gp: { 2: "YYYY-MM-DD" } }
  TG.MASTERY = {
    KEEP: 30, HALF_DAYS: 14, CONF_N: 12,
    KW: { fill: 1.0, dlg: 1.0, fix: 1.1, fill2: 1.2, trans: 1.2, sit: 1.2, trf: 1.3, order: 0.6 },   // 題型權重
    LVW: [0.8, 1.0, 1.2],                                                                       // lv − 該點最低 lv：0／1／≥2
    FAST: { fill: 0.8, sentence: 1.5 },                                                         // 快答（答對）不收（秒）
    // 猜題校正用的「選項數」（紀錄沒寫 n 時）：挖空 3～4 選 1 取 3.5；改錯先點錯字（一句約 8 個字可點）；排句幾乎猜不中
    NOPT: { fill: 3.5, fill2: 4, fix: 8, order: 20, trans: 4, dlg: 4, trf: 4, sit: 4 },
    TIER: { bronze: { m: 60, n: 10 }, silver: { m: 75, kinds: 3, topOk: 3 }, gold: { m: 85, kinds: 4, needOne: ["trans", "trf", "sit"], days: 2 } },
    // 沒有 QDB_GP.lvMin／lvMax 時的備用（題庫規格 1.2 的 lv 範圍）
    LV: { G01: [1, 1], G02: [2, 3], G03: [1, 2], G04: [2, 3], G05: [2, 3], G06: [2, 2], G07: [2, 3], G08: [3, 4], G09: [3, 4], G10: [2, 3], G11: [3, 4], G12: [3, 4],
      G13: [4, 4], G14: [3, 5], G15: [1, 2], G16: [1, 2], G17: [1, 1], G18: [1, 2], G19: [1, 1], G20: [1, 2], G21: [1, 2], G22: [1, 2], G23: [2, 2], G24: [2, 2],
      G25: [2, 2], G26: [3, 3], G27: [2, 3], G28: [3, 3], G29: [3, 3], G30: [3, 4], G31: [4, 4], G32: [4, 4], G33: [4, 4], G34: [3, 3], G35: [3, 3] }
  };
  // knight_tree.json 的門檻（有 TG.DATA_KNIGHT 就用它；第一次算徽章時才讀，載入順序不影響）
  let tiersSynced = false;
  function syncTiers() {
    if (tiersSynced) return; tiersSynced = true;
    const b = TG.DATA_KNIGHT && TG.DATA_KNIGHT.badges, T = TG.MASTERY.TIER;
    if (!b || !b.tiers) { tiersSynced = false; return; }
    const t = b.tiers;
    if (t.bronze) { T.bronze.m = t.bronze.M ?? T.bronze.m; T.bronze.n = t.bronze.minN ?? T.bronze.n; }
    if (t.silver) { T.silver.m = t.silver.M ?? T.silver.m; T.silver.kinds = t.silver.minKinds ?? T.silver.kinds; T.silver.topOk = t.silver.topLvCorrect ?? T.silver.topOk; }
    if (t.gold) { T.gold.m = t.gold.M ?? T.gold.m; T.gold.kinds = t.gold.minKinds ?? T.gold.kinds; T.gold.needOne = t.gold.mustInclude || T.gold.needOne; T.gold.days = t.gold.minDays ?? T.gold.days; }
  }
  // 第 1 期：銀牌題型數與最高等級答對數看 knight_tree.json badges.phase1（11-24 起 1 種題型＋最高等級答對 5 題）、金牌關閉
  TG.badgePhase = () => {
    const p = TG.DATA_KNIGHT && TG.DATA_KNIGHT.badges && TG.DATA_KNIGHT.badges.phase1;
    // 11-24 第二輪：第 1 期另可指定 silverTopOk（銀牌要答對最高等級題幾題；省略＝TIER.silver.topOk）
    return { silverKinds: p && p.silverMinKinds !== undefined ? p.silverMinKinds : 2, gold: p && p.goldEnabled !== undefined ? !!p.goldEnabled : false,
      silverTopOk: p && p.silverTopOk !== undefined ? p.silverTopOk : null };
  };
  const DAY = 86400000;
  const dayStr = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const gpTable = () => { try { if (typeof QDB_GP !== "undefined" && QDB_GP) return QDB_GP; } catch (e) {} return root.QDB_GP || null; };
  TG.gpLvRange = function (gp, rows) {
    const G = gpTable(), g = G && G[gp];
    if (g && g.lvMin && g.lvMax) return [g.lvMin, g.lvMax];
    if (TG.MASTERY.LV[gp]) return TG.MASTERY.LV[gp];
    const lvs = (rows || []).map(r => r[2]).filter(x => x >= 1);
    return lvs.length ? [Math.min(...lvs), Math.max(...lvs)] : [1, 5];
  };
  // ev = { gp, ok, k, lv, t(ms), try, sec, n? }；只收第一次作答、快答（答對）不收；回傳 d
  TG.masteryPush = function (d, ev) {
    if (!d || !ev || !ev.gp) return d;
    if (ev.try === 2 || ev.retry) return d;                                   // 第二次機會不算證據
    const k = ev.k || "fill", sent = TG.QK_SENT.includes(k);
    const fast = sent ? TG.MASTERY.FAST.sentence : (k === "fill" || k === "fill2") ? TG.MASTERY.FAST.fill : 0;
    if (ev.ok && fast && typeof ev.sec === "number" && ev.sec < fast) return d;   // 反射式快答答對：照常給遊戲獎勵，但不算掌握度
    d.mast = d.mast || {};
    const a = d.mast[ev.gp] || (d.mast[ev.gp] = []);
    const row = [ev.ok ? 1 : 0, k, ev.lv || 1, typeof ev.t === "number" ? ev.t : Date.now()];
    if (ev.n) row.push(ev.n);
    a.push(row);
    while (a.length > TG.MASTERY.KEEP) a.shift();
    return d;
  };
  // 細項（給畫面與測試）：{ m, n, p, g, kinds, topOk, days }
  TG.masteryInfo = function (d, gp, now) {
    const rows = (d && d.mast && d.mast[gp] || []).slice(-TG.MASTERY.KEEP);
    const M = TG.MASTERY, out = { m: 0, n: rows.length, p: 0, g: 0, kinds: [], topOk: 0, days: 0 };
    if (!rows.length) return out;
    now = typeof now === "number" ? now : Date.now();
    const [lo, hi] = TG.gpLvRange(gp, rows);
    let sw = 0, so = 0, sg = 0;
    for (const [ok, k, lv, t, n] of rows) {
      const lw = M.LVW[Math.max(0, Math.min(2, (lv || lo) - lo))];
      const w = (M.KW[k] || 1) * lw * Math.pow(0.5, Math.max(0, now - t) / DAY / M.HALF_DAYS);
      sw += w; so += w * (ok ? 1 : 0); sg += w / (n || M.NOPT[k] || 4);
    }
    const p = sw ? so / sw : 0, g = sw ? sg / sw : 0;   // g＝亂猜也會對的比例（＝1／平均選項數）
    const adj = Math.max(0, g < 1 ? (p - g) / (1 - g) : 0), conf = Math.min(1, rows.length / M.CONF_N);
    out.p = p; out.g = g; out.m = Math.round(100 * adj * conf);
    out.kinds = [...new Set(rows.map(r => r[1]))];
    out.topOk = rows.filter(r => r[0] && r[2] >= hi).length;
    out.days = new Set(rows.filter(r => r[0]).map(r => dayStr(r[3]))).size;
    return out;
  };
  TG.masteryOf = (d, gp, now) => TG.masteryInfo(d, gp, now).m;
  // 現在的條件算得到幾階（不看歷史）
  TG.badgeTierNow = function (d, gp, now) {
    syncTiers();
    const I = TG.masteryInfo(d, gp, now), T = TG.MASTERY.TIER, ph = TG.badgePhase();
    let t = 0;
    if (I.m >= T.bronze.m && I.n >= T.bronze.n) t = 1;
    if (t === 1 && I.m >= T.silver.m && I.kinds.length >= ph.silverKinds && I.topOk >= (ph.silverTopOk !== null ? ph.silverTopOk : T.silver.topOk)) t = 2;
    if (t === 2 && ph.gold && I.m >= T.gold.m && I.kinds.length >= T.gold.kinds && I.kinds.some(k => T.gold.needOne.includes(k)) && I.days >= T.gold.days) t = 3;
    return t;
  };
  // 歷史最高（存檔的 btier、舊徽章 badges[gp]＝銅、舊 key「片語」＝G14 銅）
  const storedTier = (d, gp) => Math.max(d && d.btier && d.btier[gp] || 0, d && d.badges && d.badges[gp] ? 1 : 0, gp === "G14" && d && d.badges && d.badges["片語"] ? 1 : 0);
  // → 0 無、1 銅、2 銀、3 金（已拿到的不收回）
  TG.badgeTier = (d, gp, now) => Math.max(storedTier(d, gp), TG.badgeTierNow(d, gp, now));
  // 拿到了但現在的掌握度不夠 → 顯示「需要保養」
  TG.badgeNeedsCare = (d, gp, now) => storedTier(d, gp) > 0 && TG.badgeTierNow(d, gp, now) < storedTier(d, gp);
  // → { gp: 0～3 }（歷史最高＋現在算得到的）；舊 key「文法」不屬於任何組、不列
  TG.badgeTiers = function (d, now) {
    const o = {}, gps = new Set();
    for (const src of [d && d.mast, d && d.btier, d && d.badges]) if (src) for (const k in src) gps.add(k === "片語" ? "G14" : k);
    for (const gp of gps) { if (!/^G\d\d$/.test(gp)) continue; const t = TG.badgeTier(d, gp, now); if (t) o[gp] = t; }
    return o;
  };
  // 寫回存檔（gear.ui 的 answer 掛勾在 masteryPush 之後呼叫）：升階時記 d.btier、d.bday；回傳 { tier, prev, up }
  TG.badgeUpdate = function (d, gp, now) {
    now = typeof now === "number" ? now : Date.now();
    const prev = storedTier(d, gp), tier = Math.max(prev, TG.badgeTierNow(d, gp, now));
    if (tier > (d.btier && d.btier[gp] || 0)) {
      d.btier = d.btier || {}; d.bday = d.bday || {};
      const bd = d.bday[gp] || (d.bday[gp] = {});
      for (let t = (d.btier[gp] || 0) + 1; t <= tier; t++) if (!bd[t]) bd[t] = dayStr(now);
      d.btier[gp] = tier;
    }
    return { tier, prev, up: tier > prev };
  };
  // 徽章組（knight_tree.json 的 badges.groups，id＝A～F、members＝文法點）裡達到 tier 的文法點數；tier 可用 1／2／3 或 "bronze"／"silver"／"gold"
  TG.badgeSetCount = function (tiers, groupId, tier) {
    const T = { bronze: 1, silver: 2, gold: 3 }, need = typeof tier === "string" ? (T[tier] || 1) : (tier || 1);
    const groups = (TG.DATA_KNIGHT && TG.DATA_KNIGHT.badges && TG.DATA_KNIGHT.badges.groups) || [], g = groups.find(x => x.id === groupId);
    return g && Array.isArray(g.members) ? g.members.filter(gp => (tiers && tiers[gp] || 0) >= need).length : 0;
  };
})(typeof window !== "undefined" ? window : globalThis);
