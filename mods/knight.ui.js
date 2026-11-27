// 外掛：knight（畫面端）— v3 文法騎士畫面：怒氣鈕、詠唱流程、技能樹畫面、絕招選擇、外觀進化通知、結算經驗
// 負責：第 6 組（騎士畫面與演出）。合約：mods/CONTRACT_v3.md §8.6、§9；演出由 mods/knight.fx.ui.js（KnightFX，§9.3）負責，本檔不重複播。
//
// 對外（TGUI.knight）：
//   onUlt(idx) → true＝本檔處理了（怒氣制騎士）；false＝交回 index 舊的答題大招（同伴、或騎士引擎還沒開怒氣）
//   ultState(G) → { mode:"rage"|"cd", ready, label, pct, rage, max, gap, full, chanting, dead, ult, ultName }
//   paintUlt(btn, G)  把底部大招鈕畫成怒氣環（第 2 組在 hud() 裡呼叫，取代舊的 bu.disabled／small 文字那幾行）
//   openTree(fromStage)／openUltPick(fromStage)  技能樹畫面（含絕招選擇）；fromStage＝關卡物件（返回簡報）或省略（返回主選單）
//   endXp(G, run, info) → { xp, answerXp, stageXp, from, to, ups, lines, detailLines, html, unlocks }；info＝{ won, stars, first, heroic, practice }
//        第 2 組在 endGame 用它取代舊的「60＋40×星」經驗段：html 放進結算（經驗條動畫會自己播）；lines＝獎勵列表的一行摘要
//        （細節在 html 卡裡，不重複）；只放文字不放 html 時改用 detailLines（含解鎖、外觀進化）
//   checkEvo()  有新的外觀階段沒看過（S.mods.knight.seenEvo）就跳華麗進化通知
//   state()     技能樹資料快照（測試／截圖用）
// 只在騎士引擎（mods/knight.js，第 5 組）已實作（TG.KNIGHT.VER ≥ 1）時啟用技能樹、絕招選擇、開局參數、經驗；之前一律不動，遊戲行為不變。
// 技能樹的「能不能學、差什麼」在本檔本地判斷（要寫出原因給孩子看）；存檔前一律再過 TG.knightValid（引擎是最後把關）。
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.TGUI || !window.TG) return;
  const W = window, U = W.TGUI, TG = W.TG;
  const HAS_DOC = typeof document !== "undefined" && !!document.createElement;
  const reduced = (() => { try { return !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } })();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const K = () => TG.KNIGHT || {};
  const live = () => !!(TG.KNIGHT && TG.KNIGHT.VER >= 1);
  const S = () => U.S || {};
  const nowReal = () => (W.performance && W.performance.now ? W.performance.now() : Date.now()) / 1000;

  // ───── 存檔（格式由第 5 組定義，合約 §8.5；這裡只補缺的預設值）
  function kd() {
    const s = S(); s.mods = s.mods || {};
    const d = s.mods.knight = s.mods.knight && typeof s.mods.knight === "object" ? s.mods.knight : {};
    if (!d.v) d.v = 1;
    if (!d.tree || typeof d.tree !== "object") d.tree = {};
    if (!d.ult) d.ult = "wall";
    if (!["ask", "auto", "off"].includes(d.chant)) d.chant = "ask";
    if (typeof d.seenEvo !== "number") d.seenEvo = 0;
    return d;
  }
  const heroLv = () => { const h = S().hero; return Math.max(1, (h && +h.lv) || 1); };
  const stageOf = lv => TG.heroEvo ? TG.heroEvo({ id: "knight", lv }) : 0;
  const cleared = () => { try { return U.cleared ? U.cleared() : 0; } catch (e) { return 0; } };
  function tiersNow() { try { return (TG.badgeTiers && TG.badgeTiers((S().mods || {}).gear || {})) || {}; } catch (e) { return {}; } }
  const TIER_N = { bronze: 1, silver: 2, gold: 3 }, TIER_ZH = { bronze: "銅", silver: "銀", gold: "金" };
  const tierN = t => typeof t === "string" ? (TIER_N[t] || 1) : (t || 1);
  function setCount(tiers, g, t) {
    try { if (TG.badgeSetCount) return TG.badgeSetCount(tiers, g, t); } catch (e) {}
    const grp = groupOf(g); return grp ? grp.members.filter(gp => (tiers[gp] || 0) >= tierN(t)).length : 0;
  }
  const groups = () => ((K().BADGES || {}).groups) || [];
  const groupOf = id => groups().find(g => g.id === id) || null;
  const STAGE_NAMES = ["見習騎士", "鐵衛騎士", "銀翼騎士", "金獅騎士", "星光傳說騎士"];
  const stageInfo = i => { const a = W.ART && W.ART.KNIGHT_STAGES && W.ART.KNIGHT_STAGES[i]; return { name: (a && a.name) || STAGE_NAMES[i] || "", desc: (a && a.desc) || "" }; };
  // 文法點中文名（題庫有 QDB_GP 就用題庫的；新文法點還沒進題庫時用這張表）
  const GP_ZH = { G01: "be 動詞現在式", G02: "be 動詞過去式", G03: "第三人稱單數", G04: "過去式", G05: "進行式", G06: "助動詞", G07: "比較級", G08: "最高級",
    G09: "不定詞與動名詞", G10: "時間介系詞", G11: "完成式", G12: "被動語態", G13: "關係代名詞", G14: "片語動詞", G15: "名詞單複數", G16: "代名詞", G17: "冠詞",
    G18: "There is／are", G19: "祈使句", G20: "疑問詞", G21: "do／does／did", G22: "地方介系詞", G23: "頻率副詞", G24: "數量詞", G25: "未來式", G26: "過去進行式",
    G27: "連接詞", G28: "副詞子句", G29: "連綴動詞", G30: "It 句型與 too…to", G31: "感官與使役動詞", G32: "間接問句", G33: "附加問句", G34: "授與動詞與 used to", G35: "感嘆句" };
  function gpName(gp) {
    try { /* global QDB_GP */ if (typeof QDB_GP !== "undefined" && QDB_GP && QDB_GP[gp] && QDB_GP[gp].name) return QDB_GP[gp].name; } catch (e) {}
    return GP_ZH[gp] || gp;
  }

  // ───── 技能樹（本地判斷，給畫面寫原因用）
  const nodes = () => K().TREE || [];
  const nodeById = id => nodes().find(n => n.id === id) || null;
  const paths = () => (K().PATHS && K().PATHS.length ? K().PATHS : [{ id: "guard", name: "守護" }, { id: "blade", name: "劍術" }, { id: "chant", name: "詠唱" }]);
  const totalPts = lv => TG.knightPoints ? TG.knightPoints(lv) : 2 * Math.max(0, lv - 1);
  const spentOf = tree => nodes().reduce((a, n) => a + (tree[n.id] ? n.cost : 0), 0);
  const capLimit = () => ((K().RULES || {}).capstoneLimit) || 1;
  function badgeNeed(n, tiers) {
    if (!n.badge) return null;
    const have = setCount(tiers, n.badge.group, n.badge.tier), g = groupOf(n.badge.group);
    return { group: n.badge.group, name: g ? g.name : n.badge.group + " 組", tier: n.badge.tier, tierZh: TIER_ZH[n.badge.tier] || "", need: n.badge.n, have, ok: have >= n.badge.n, members: g ? g.members : [] };
  }
  // 依層數由低到高收：等級不夠／前置沒學／徽章不夠／點數不夠／終極超過上限 → 退（比照 TG.knightValid；引擎有實作時存檔前再過一次引擎版）
  function localValid(tree, lv, tiers) {
    const out = {}, list = nodes().slice().sort((a, b) => a.tier - b.tier || (a.badge ? 1 : 0) - (b.badge ? 1 : 0));
    let left = totalPts(lv), caps = 0;
    for (const n of list) {
      if (!tree || !tree[n.id]) continue;
      if (lv < n.lv || (n.need && !out[n.need]) || n.cost > left) continue;
      const b = badgeNeed(n, tiers); if (b && !b.ok) continue;
      if (n.capstone && caps >= capLimit()) continue;
      out[n.id] = 1; left -= n.cost; if (n.capstone) caps++;
    }
    return out;
  }
  function validTree(tree, lv, tiers) {
    if (live() && typeof TG.knightValid === "function") { try { const v = TG.knightValid(tree, lv, tiers); if (v && typeof v === "object") return v; } catch (e) {} }
    return localValid(tree, lv, tiers);
  }
  // 單一節點的狀態：own 已學、can 可以學、why 不能學的原因（中文短句陣列）、drop 可以取消嗎
  function nodeState(n, tree, lv, tiers) {
    const own = !!tree[n.id], left = totalPts(lv) - spentOf(tree), why = [];
    if (lv < n.lv) why.push("需要 Lv" + n.lv + "（還差 " + (n.lv - lv) + " 級）");
    if (n.need && !tree[n.need]) { const p = nodeById(n.need); why.push("先學「" + (p ? p.name : n.need) + "」"); }
    const b = badgeNeed(n, tiers);
    if (b && !b.ok) why.push("還差 " + (b.need - b.have) + " 枚" + b.name + b.tierZh + "牌（目前 " + b.have + "／" + b.need + "）");
    if (n.capstone && !own) { const other = nodes().find(m => m.capstone && m.id !== n.id && tree[m.id]); if (other) why.push("終極技能只能選 1 個（已選「" + other.name + "」）"); }
    if (!own && n.cost > left && !why.length) why.push("點數不夠（要 " + n.cost + " 點，剩 " + left + " 點）");
    const kids = nodes().filter(m => m.need === n.id && tree[m.id]);
    let can = !own && !why.length;
    if (can && live() && typeof TG.knightCanLearn === "function") { try { can = !!TG.knightCanLearn(tree, n.id, lv, tiers); } catch (e) {} }   // 引擎最後把關
    if (!own && !can && !why.length) why.push("現在不能學（會擠掉已學的技能）");
    return { own, can, why, badge: b, drop: own && !kids.length, kids };
  }
  // 絕招解鎖（本地版；引擎有 TG.knightUltOk 時以引擎為準）。回傳 { ok, why }
  function ultUnlock(id, lv, tiers, cl) {
    const u = (K().ULTS || {})[id]; if (!u) return { ok: false, why: "沒有這招" };
    const cond = c => {
      if (c.lv && lv < c.lv) return false;
      if (c.stageCleared && cl < c.stageCleared) return false;
      if (c.badgeGroupAny && !c.badgeGroupAny.some(g => setCount(tiers, g, c.tier) >= (c.n || 1))) return false;
      if (c.badgeAll && !c.badgeAll.every(gp => (tiers[gp] || 0) >= tierN(c.tier))) return false;
      return true;
    };
    const condTxt = c => {
      const a = [];
      if (c.lv) a.push("Lv" + c.lv);
      if (c.stageCleared) a.push("通關第 " + c.stageCleared + " 關");
      if (c.badgeGroupAny) a.push(c.badgeGroupAny.map(g => (groupOf(g) || { name: g }).name).join("或") + "任 " + (c.n || 1) + " 枚" + (TIER_ZH[c.tier] || "") + "牌");
      if (c.badgeAll) a.push(c.badgeAll.map(gpName).join("、") + "都拿到" + (TIER_ZH[c.tier] || "") + "牌");
      return a.join("且");
    };
    const u0 = u.unlock || {};
    let ok = (!u0.lv || lv >= u0.lv) && (!u0.any || u0.any.some(cond));
    if (live() && typeof TG.knightUltOk === "function") { try { ok = !!TG.knightUltOk(id, lv, tiers, cl); } catch (e) {} }
    if (ok) return { ok: true, why: "" };
    const parts = [];
    if (u0.lv) parts.push("Lv" + u0.lv);
    if (u0.any) parts.push(u0.any.map(condTxt).join("，或 "));
    return { ok: false, why: "解鎖：" + parts.join("，並且 ") };
  }
  // ───── 文字分層（05_品牌資源…/App文字分層規則.md）：第一層＝一句白話（不放半徑、秒數、倍率），精確數值放第二層「詳細」
  const ULT_SHORT = { wall: "擋住一大片地面怪", tense3: "連砍三刀，還能打飛行怪", beWrath: "震暈周圍所有怪" };
  const ULT_LOCK_SHORT = { tense3: "Lv5 且過第 6 關就解鎖", beWrath: "Lv10 解鎖（徽章可提早）" };
  const NODE_SHORT = {
    g1: "騎士更耐打、會回血", g2: "多擋 1 隻怪", g3: "擋怪時怒氣漲更快", gA: "擋住的怪受傷更多", g4: "盾牆更大、撐更久", gB: "站著不動更會擋",
    g5: "快倒下時自動張盾", g6: "放絕招就順便張盾牆",
    b1: "普攻更痛", b2: "出劍更快", b3: "砍穿盔甲，打魔王更痛", bC: "答對時態題，下一刀超痛", b4: "三連斬更痛", bD: "打倒怪會順手再砍一刀",
    b5: "普攻也打得到飛行怪", b6: "三連斬多砍一刀",
    c1: "答對時怒氣漲更多", c2: "詠唱更從容，答錯也加成", c3: "絕招更常放", cE: "營地答對多拿怒氣", c4: "Be 之怒更大、暈更久", cF: "詠唱答對，全場怪更怕痛",
    c5: "可以多詠唱一題，更強", c6: "兩題全對，絕招最強"
  };
  const PATH_SHORT = { guard: "穩穩擋住怪，最適合新手", blade: "專打魔王和飛行怪", chant: "英文答越準，絕招越強" };
  const CHANT_HELP = "多答一題（詠唱）：答對絕招更強；答錯也照樣放出";
  const nodeShort = n => NODE_SHORT[n.id] || n.name;
  function ultList() { const u = K().ULTS || {}; return ["wall", "tense3", "beWrath"].filter(id => u[id]).map(id => Object.assign({ id }, u[id])); }
  const ultName = id => ((K().ULTS || {})[id] || {}).name || "絕招";

  // ───── 開局參數（合約 §8.6）：opts.knight＝{ tree, ult, chant, tiers, cleared }（tiers／cleared 給騎士引擎複查徽章節點與絕招解鎖）
  function knightOpts() {
    const d = kd(), lv = heroLv(), ti = tiersNow(), cl = cleared();
    const tree = validTree(d.tree, lv, ti);
    const ult = ultUnlock(d.ult, lv, ti, cl).ok ? d.ult : "wall";
    return { tree, ult, chant: d.chant, tiers: ti, cleared: cl };
  }

  // ───── 底部大招鈕
  function minGap(G) {
    if (typeof TG.knightCastWait === "function") { try { return Math.max(0, +TG.knightCastWait(G) || 0); } catch (e) {} }
    const mi = (K().RAGE && K().RAGE.minCastInterval) || 30, kn = G.kn || {};
    return kn.lastCast == null ? 0 : Math.max(0, kn.lastCast + mi - (G.time || 0));
  }
  // 怒氣制＝這一局有 s.kn（騎士引擎 onNewGame 收到 opts.knight 才建）。＝TG.knightRageOn(G)；上限問 TG.heroRageMax(G, 0)。不看 TG.HEROES.knight.rageMax：那是全域旗標，
  //   簡報縮圖等「拋棄式局面」newGame 沒帶 opts.knight 時會被刪掉（已回報第 5 組）
  function ragey(G) { const h = G && G.heroes && G.heroes[0]; return !!(h && (h.id || "knight") === "knight" && (typeof TG.knightRageOn === "function" ? TG.knightRageOn(G) : G.kn && typeof G.kn === "object")); }
  const rageMaxOf = G => (typeof TG.heroRageMax === "function" && TG.heroRageMax(G, 0)) || K().RAGE_MAX || 100;
  function ultState(G) {
    G = G || U.G;
    const h = G && G.heroes && G.heroes[0];
    if (!h) return { mode: "cd", ready: false, label: "", pct: 0 };
    const def = TG.heroDef(h), dead = h.dead > 0;
    if (!ragey(G)) {
      const rd = TG.heroUltReady(G, 0), cd = def.ultCd || 30;
      return { mode: "cd", ready: rd, dead, pct: rd ? 1 : clamp(1 - (h.ultCd || 0) / cd, 0, 1), label: dead ? "倒下" : rd ? "大招" : Math.ceil(h.ultCd || 0) + "s" };
    }
    const max = rageMaxOf(G), rage = clamp(h.rage || 0, 0, max), pct = rage / max, full = rage >= max, gap = minGap(G);
    const chanting = !!(CH.cur && CH.cur.G === G);
    let ready = false;
    if (!dead && !chanting) {
      if (typeof TG.knightReady === "function") { try { ready = !!TG.knightReady(G, 0); } catch (e) { ready = false; } }
      else ready = TG.heroUltReady(G, 0) && gap <= 0;
    }
    const label = dead ? "倒下" : chanting ? "詠唱中" : ready ? "絕招" : full && gap > 0 ? Math.ceil(gap) + " 秒" : Math.floor(pct * 100) + "%";
    return { mode: "rage", ready, dead, chanting, full, gap, rage, max, pct, label, ult: G.kn.ult || "wall", ultName: ultName(G.kn.ult || "wall") };
  }
  function paintUlt(btn, G) {
    if (!btn) return;
    const st = ultState(G);
    if (st.mode !== "rage") { btn.classList.remove("kn-rage", "kn-full"); btn.style.removeProperty("--kn-pct"); btn.disabled = !st.ready; btn.classList.toggle("ready", !!st.ready); const sm = btn.querySelector("small"); if (sm && sm.textContent !== st.label) sm.textContent = st.label; return st; }
    injectCss();
    btn.classList.add("kn-rage"); btn.classList.toggle("ready", st.ready); btn.classList.toggle("kn-full", st.full && !st.ready);
    btn.classList.toggle("kn-big", !!st.ready && !(U.qpanel && U.qpanel.busy && U.qpanel.busy()));   // 11-24 UIUX P0：側邊面板出題時不放大（原本放大往上蓋到第 3、4 個選項），只在原位發光   // 第二輪 P2：怒氣滿了按鈕放大＋跳動（樣式在 index.html），原本只多一圈金光很難注意到
    const p = st.pct.toFixed(3); if (btn.style.getPropertyValue("--kn-pct") !== p) btn.style.setProperty("--kn-pct", p);
    btn.disabled = st.dead;   // 沒滿也可以點：點了會說還差什麼
    const sm = btn.querySelector("small"); if (sm && sm.textContent !== st.label) sm.textContent = st.label;
    // 先備戰再守城（11-25 試玩）：絕招鈕角標「加強×N」＝備戰存的自動加強次數
    const pc = TG.pfOn && TG.pfOn(G) ? (G.pfCharge | 0) : 0; let bd = btn.querySelector(".kn-pfc");
    if (pc > 0) { if (!bd) { bd = document.createElement("span"); bd.className = "kn-pfc"; btn.appendChild(bd); } const t = "加強×" + pc; if (bd.textContent !== t) bd.textContent = t; } else if (bd) bd.remove();
    const al = st.ready ? "放出絕招：" + st.ultName : "怒氣 " + Math.floor(st.pct * 100) + "%"; if (btn.getAttribute("aria-label") !== al) btn.setAttribute("aria-label", al);
    return st;
  }

  // ───── 詠唱（qbus.push src:"chant"）
  const CH = { cur: null };
  function ownTree(G) { return (G && G.kn && G.kn.tree) || kd().tree || {}; }
  function chantRules(G) {
    const base = K().CHANT || {}, r = { time: base.time || 12, okMul: base.okMul || 1.5, wrongMul: base.wrongMul || 1, extra: null, perfectTier: 0 };
    const t = ownTree(G);
    for (const n of nodes()) {
      if (!t[n.id] || !n.fx || !n.fx.chant) continue;
      const c = n.fx.chant;
      if (c.time) r.time = Math.max(r.time, c.time);
      if (c.wrongMul) r.wrongMul = Math.max(r.wrongMul, c.wrongMul);
      if (c.extraQ) r.extra = Math.max(r.extra || 0, c.extraQ.bothOkMul || 0);
      if (c.perfectTier) r.perfectTier = Math.max(r.perfectTier, c.perfectTier);
    }
    // 騎士引擎的詠唱計畫（含營地卡等加成）優先
    if (G && G.kn && typeof TG.knightChantPlan === "function") {
      try { const P = TG.knightChantPlan(G); if (P) { if (P.time) r.time = P.time; if (P.okMul) r.okMul = P.okMul; if (P.wrongMul) r.wrongMul = P.wrongMul; if (P.questions < 2) r.extra = null; r.can = P.can !== false; } } catch (e) {}
    }
    return r;
  }
  const chantMul = (r, c) => c.ok <= 0 ? r.wrongMul : c.max > 1 && c.ok >= c.max ? (r.extra || r.okMul) : r.okMul;
  function chantGps(G) {
    // 本關文法點（引擎有 G.stage.gps）；優先掌握度最低的點（④ 的 TG.masteryOf 有實作時）
    const gps = (G && G.stage && G.stage.gps) ? G.stage.gps.slice() : null;
    if (!gps || !gps.length) return null;
    try {
      const d = (S().mods || {}).gear || {}, now = Date.now();
      if (TG.masteryOf) gps.sort((a, b) => TG.masteryOf(d, a, now) - TG.masteryOf(d, b, now));
    } catch (e) {}
    return gps;
  }
  function canChant(G) {
    if (!U.qbus || typeof U.qbus.push !== "function") return false;
    if (G && G.kn && typeof TG.knightChantPlan === "function") { try { return TG.knightChantPlan(G).can !== false; } catch (e) {} }
    try { if (TG.qCanAsk && !TG.qCanAsk(G, "fill", "chant")) return false; } catch (e) {}
    return true;
  }
  function startChant(G) {
    const r = chantRules(G);
    CH.cur = { G, n: 0, ok: 0, oks: [], max: r.extra ? 2 : 1, r, id: null, t0: nowReal() };
    pushChantQ(G);
  }
  function pushChantQ(G) {
    const c = CH.cur; if (!c) return;
    const nm = ultName(G.kn && G.kn.ult);
    c.id = U.qbus.push({
      src: "chant", prio: 1, use: "choice", deadline: c.r.time, second: false, noRetry: true,
      title: c.n ? "再答一題：兩題都對，絕招最強" : "加強「" + nm + "」：答對絕招更強",
      gpPref: chantGps(G),
      onResult: (ok, info) => onChantResult(G, ok, info),
      onCancel: () => finishChant(G)
    });
  }
  function onChantResult(G, ok, info) {
    const c = CH.cur; if (!c || c.G !== G) return;
    if (G.over || U.G !== G) { CH.cur = null; return; }
    const first = !!ok && !(info && (info.retry || info.try === 2));   // 詠唱沒有第二次機會：第二次才答對＝當作沒答對（但照樣記紀錄、給能量）
    // 合約 §8.6：詠唱題另走 answerResult { kind:"mcq", src:"chant" }（騎士引擎不給怒氣；能量、題量、三星照常）
    try { TG.answerResult(G, !!ok, Object.assign({}, info || {}, { kind: "mcq", src: "chant" })); } catch (e) { if (W.console) console.error("[knight chant]", e); }
    c.n++; c.oks.push(first); if (first) c.ok++;
    if (first && c.n < c.max && canChant(G)) { pushChantQ(G); return; }
    finishChant(G);
  }
  function finishChant(G) {
    const c = CH.cur; CH.cur = null; if (!c || c.G !== G || G.over) return;
    if (G.kn && typeof TG.knightCast === "function") { castK(G, c.oks.length ? c.oks : [false]); return; }   // 騎士引擎算倍率、演出等級、退還怒氣
    const mul = chantMul(c.r, c), chantOk = c.ok > 0, perfect = c.max > 1 && c.ok >= c.max;
    let tier = 1; try { tier = TG.knightTier ? TG.knightTier(G, chantOk) : (chantOk ? 2 : 1); } catch (e) {}
    if (perfect && c.r.perfectTier) tier = Math.max(tier, c.r.perfectTier);
    cast(G, mul, { tier, chant: true, chantOk, chantN: c.ok, chantQ: c.n, perfect });
  }
  function cast(G, mul, info) {
    const h = G.heroes[0];
    if (!h || h.dead > 0 || !TG.heroUltReady(G, 0)) { toast("騎士倒下了：絕招沒有放出去，怒氣保留"); return false; }
    const ok = TG.heroCast(G, 0, mul, info);
    if (ok && info && info.chant) {
      const t = info.perfect ? "兩題全對！絕招最強" : info.chantOk ? "答對了！絕招加強" : "沒答對，照樣放出絕招";
      try { U.fx && U.fx(t, h.x, h.y - 30, info.chantOk ? "#ffe07a" : "#cfe0ea"); } catch (e) {}
    }
    return ok;
  }
  // 騎士引擎版：TG.knightCast(s, oks) → { mul, tier, perfect, refund, chant } 或 false；oks＝null 直接放
  function castK(G, oks, label) {
    const h = G.heroes[0];
    if (!h || h.dead > 0 || !TG.knightReady(G)) { toast("騎士倒下了：絕招沒有放出去，怒氣保留"); return false; }
    let r = false; try { r = TG.knightCast(G, oks); } catch (e) { if (W.console) console.error("[knight cast]", e); }
    if (r && r.chant) {
      const okFirst = !!(oks && oks[0]);
      const t = label || (r.perfect ? "兩題全對！絕招最強" : okFirst ? "答對了！絕招加強" : "沒答對，照樣放出絕招");
      try { U.fx && U.fx(t, h.x, h.y - 30, okFirst ? "#ffe07a" : "#cfe0ea"); } catch (e) {}
    }
    return r;
  }
  const castDirect = G => (G.kn && typeof TG.knightCast === "function") ? castK(G, null) : cast(G, 1, { tier: 1, chant: false });
  function onUlt(idx) {
    const G = U.G;
    if (idx || !G || G.over || !ragey(G)) return false;   // 同伴、舊流程：交回 index
    if (CH.cur && CH.cur.G === G) { toast("先回答側邊那一題，答完就放絕招"); return true; }
    const st = ultState(G);
    if (!st.ready) {
      if (st.dead) toast("騎士倒下了，等他復活");
      else if (st.full && st.gap > 0) toast("絕招剛放過，再 " + Math.ceil(st.gap) + " 秒才能再放");
      else toast("怒氣 " + Math.floor(st.pct * 100) + "%：" + (TG.pfOn && TG.pfOn(G) ? "騎士擋住怪、備戰時答對題目，就會累積" : "答對題目、讓騎士擋住怪，就會累積"));
      return true;
    }
    // 先備戰再守城（2026-11-25）：守城時不出詠唱題 → 用備戰時充好的加強次數（G.pfCharge，TG.pfRoundEnd 給）；沒有就直接放
    if (TG.pfOn && TG.pfOn(G)) {
      if ((G.pfCharge | 0) > 0 && G.kn && typeof TG.knightCast === "function") {
        G.pfCharge--;   // 11-25 試玩：一次只用 1 次加強（原本連珠詠唱會一次扣 2 次、還寫「全對」）
        castK(G, [true], "備戰充能！絕招加強" + (G.pfCharge > 0 ? "（還有 " + G.pfCharge + " 次）" : ""));
      } else castDirect(G);
      return true;
    }
    const mode = kd().chant;
    if (mode === "off" || !canChant(G)) { castDirect(G); return true; }
    if (mode === "auto") { startChant(G); return true; }
    openPick(G); return true;
  }

  // 怒氣滿時的二選一小視窗（不暫停遊戲；6 秒沒選就收起來，怒氣不會不見）
  let pickEl = null, pickT = 0;
  function openPick(G) {
    if (!HAS_DOC) { startChant(G); return; }
    injectCss();
    const app = document.getElementById("app") || document.body;
    if (!pickEl) { pickEl = document.createElement("div"); pickEl.id = "knPick"; pickEl.className = "kn-pick hide"; pickEl.setAttribute("role", "dialog"); pickEl.setAttribute("aria-label", "選擇放絕招的方式"); app.appendChild(pickEl); }
    const r = chantRules(G), nm = ultName(G.kn && G.kn.ult);
    pickEl.innerHTML = '<div class="kn-pick-t">' + esc(nm) + '・怒氣滿了！</div>' +
      '<div class="kn-pick-b"><button class="kn-btn" data-kn="direct"><b>直接放</b><small>馬上放出</small></button>' +
      '<button class="kn-btn main" data-kn="chant"><b>多答一題</b><small>答對絕招更強</small></button></div>' +
      '<div class="kn-pick-s">答錯也照樣放出，怒氣不會浪費</div>';
    try {
      const b = document.getElementById("bUlt"), ar = app.getBoundingClientRect();
      if (b) { const br = b.getBoundingClientRect(), w = Math.min(300, ar.width - 16); pickEl.style.width = w + "px"; pickEl.style.left = clamp(br.left - ar.left + br.width / 2 - w / 2, 8, ar.width - w - 8) + "px"; pickEl.style.bottom = Math.max(8, ar.bottom - br.top + 8) + "px"; }
    } catch (e) {}
    pickEl.classList.remove("hide"); pickT = nowReal();
    pickEl.onclick = ev => {
      const t = ev.target.closest("[data-kn]"); if (!t) return;
      closePick(); const g = U.G; if (!g || g.over || !ultState(g).ready) return;
      if (t.dataset.kn === "chant" && canChant(g)) startChant(g); else castDirect(g);
    };
  }
  function closePick() { if (pickEl) pickEl.classList.add("hide"); }

  // ───── 灌注鈕（第二輪 P2，11-24 小華）：引擎早就有「花 2 能量換 20 怒氣，每波 1 次」（TG.knightInfuse），畫面上沒有按鈕
  //   第 1 關不放（教學節奏：第 1 關只教蓋塔、答題、升級）；能量滿、沒事做的時候特別好用
  const infuseCost = G => { try { return TG.energyCost("infuse", G); } catch (e) { return 2; } };
  U.add("bar", {
    em: "", icon: "flame", label: "灌注",
    show: G => !!(G && ragey(G) && typeof TG.knightInfuse === "function" && !(G.stage && G.stage.i === 0 && cleared() < 1)),
    state: G => {
      const can = typeof TG.knightCanInfuse === "function" && TG.knightCanInfuse(G), used = !!(G.kn && G.kn.infWave === G.wave);
      return { disabled: !can, ready: can && (G.energy || 0) >= TG.ENERGY_MAX - 1, label: used ? "這波用過" : "灌注" + infuseCost(G) };
    },
    onClick: G => {
      if (!G || G.over) return;
      if (G.kn && G.kn.infWave === G.wave) { toast("灌注每波只能用 1 次"); return; }
      if (typeof TG.knightInfuse === "function" && TG.knightInfuse(G)) { toast("灌注：花 " + infuseCost(G) + " 能量，騎士怒氣 +" + (((K().RAGE || {}).infuse || {}).rage || 20)); try { U.beep && U.beep(660, .12, "triangle", .04); } catch (e) {} }
      else toast("灌注要 " + infuseCost(G) + " 格能量，而且怒氣還沒滿");
    }
  });

  // ───── 簡易光柱（KnightFX 不存在時才用；juice 有 ultFx 就交給它）
  U.add("event", (ev, G) => {
    if (!ev || ev.k !== "knightUlt" || (ev.hit || 0) !== 0) return;
    if (W.KnightFX) return;   // 演出由 KnightFX 播（§9.3），本檔不重複
    const J = U.juice; if (J && typeof J.ultFx === "function") J.ultFx(ev, G);
  });
  U.add("frame", (G) => {
    if (pickEl && !pickEl.classList.contains("hide") && (nowReal() - pickT > 6 || !G || G.over || !ultState(G).ready)) closePick();
  });
  U.add("start", (G, run) => {
    CH.cur = null; closePick();
    // 絕招演出的切入圖與字型先在開局畫好（避免第一次放絕招那一幀卡頓）
    if (W.KnightFX && typeof W.KnightFX.preload === "function" && G && G.kn) setTimeout(() => { try { const v = U.view ? U.view() : null; W.KnightFX.preload(v && v.s, TG.heroEvo(G.heroes[0])); } catch (e) {} }, 400);
    if (run) { const h = S().hero || { lv: 1, xp: 0 }; run._kn0 = { lv: h.lv || 1, xp: h.xp || 0 }; run._knAx = 0; run._knUps = []; }
  });

  // ───── 每題經驗（合約 §8.5：⑥ 呼叫 ⑤ 的 knightXpFor／knightLevelUp）
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function dayRec() { const h = S().hero; if (!h) return { d: today(), ax: 0 }; if (!h.day || typeof h.day !== "object" || h.day.d !== today()) h.day = { d: today(), ax: 0 }; return h.day; }
  function levelUp(h) {
    if (typeof TG.knightLevelUp === "function") return TG.knightLevelUp(h) || 0;
    const need = (K().LEVEL || {}).xpNeed, max = (K().LEVEL || {}).max || TG.HERO_MAX || 20; let n = 0;
    if (!need) return 0;
    while (h.lv < max && need[h.lv] && h.xp >= need[h.lv]) { h.xp -= need[h.lv]; h.lv++; n++; }
    return n;
  }
  U.add("answer", (q, ok, kind, G, run, info) => {
    if (!live() || !run || !G || typeof TG.knightXpFor !== "function") return;
    const retryOk = !ok && !!(info && info.retryOk);   // 第二次才答對：index 的 recordAnswer 傳 ok=false，需要 info.retryOk（第 2 組補）
    if (!ok && !retryOk) return;
    const h = S().hero; if (!h) return;
    const xi = Object.assign({ kind }, info || {}, retryOk ? { try: 2, retry: true } : {}), lv0 = h.lv;
    let x = 0, n = 0;
    if (typeof TG.knightGainXp === "function") {   // 騎士引擎：換日、每日額度、升級一次做完
      try { const r = TG.knightGainXp(h, xi, true); x = r.xp || 0; n = r.ups || 0; } catch (e) { x = 0; }
    } else {
      const day = dayRec(); try { x = Math.max(0, Math.round(+TG.knightXpFor(xi, true, day.ax) || 0)); } catch (e) { x = 0; }
      if (x) { h.xp = (h.xp || 0) + x; day.ax += x; n = levelUp(h); }
    }
    if (!x) return;
    run._knAx = (run._knAx || 0) + x;
    if (n > 0) {
      for (let l = lv0 + 1; l <= h.lv; l++) (run._knUps || (run._knUps = [])).push(l);
      try { const hh = G.heroes[0]; U.fx && U.fx("騎士 Lv" + h.lv + "！", hh.x, hh.y - 34, "#ffe07a"); } catch (e) {}
    }
  });

  // ───── 結算經驗（第 2 組在 endGame 呼叫）
  function stageXpLocal(info) {
    const st = ((K().XP || {}).stage) || { winBase: 20, perStar: 10, firstClear: 30, heroic: 40, practiceStageMul: 0.5 };
    if (!info.won) return 0;
    let x = st.winBase + st.perStar * (info.stars || 0) + (info.first ? st.firstClear : 0) + (info.heroic ? st.heroic : 0);
    if (info.practice) x = Math.round(x * (st.practiceStageMul || 0.5));
    return x;
  }
  function endXp(G, run, info) {
    if (!live()) return null;   // 引擎還沒換新曲線：第 2 組照舊流程
    info = info || {};
    const h = S().hero; if (!h) return null;
    const won = info.won != null ? !!info.won : !!(G && G.won);
    const k0 = run && run._kn0 ? run._kn0 : { lv: h.lv, xp: h.xp };
    let stageXp = 0;
    if (G && !G.stage) {   // 無盡模式：每波 5，最多 120
      const w = Math.max(0, (G.wave || 1) - 1), en = ((K().XP || {}).endless) || { perWave: 5, max: 120 };
      stageXp = typeof TG.knightStageXp === "function" ? (w ? TG.knightStageXp(0, { endlessWave: w }) : 0) : Math.min(en.max, en.perWave * w);
    } else if (typeof TG.knightStageXp === "function") {
      try { stageXp = Math.max(0, Math.round(+TG.knightStageXp(info.stars || 0, { won, win: won, first: !!info.first, firstClear: !!info.first, heroic: !!info.heroic, practice: !!info.practice }) || 0)); } catch (e) { stageXp = 0; }
    } else stageXp = stageXpLocal(Object.assign({}, info, { won }));
    h.xp = (h.xp || 0) + stageXp;
    levelUp(h);
    const ups = []; for (let l = k0.lv + 1; l <= h.lv; l++) ups.push(l);   // 這一關（答題中＋結算）升到的每一級
    const ax = (run && run._knAx) || 0, xp = ax + stageXp;
    const unlocks = unlocksBetween(k0.lv, h.lv);
    // lines：給結算「獎勵」列表的一行摘要（升級、解鎖等細節在 html 經驗卡裡，不重複列）；detailLines：沒有放 html 時用的完整版
    const sum = "騎士經驗 +" + xp + (ax && stageXp ? "（答題 " + ax + "＋過關 " + stageXp + "）" : "") + (ups.length ? "，升到 Lv" + h.lv + "！" : "");
    const lines = xp > 0 || ups.length ? [sum] : [];
    const detailLines = lines.concat(unlocks.map(u => u.text));
    try { U.save && U.save(); } catch (e) {}
    const res = { xp, answerXp: ax, stageXp, from: { lv: k0.lv, xp: k0.xp }, to: { lv: h.lv, xp: h.xp }, ups, unlocks, lines, detailLines };
    res.html = endXpHtml(res);
    if (HAS_DOC) setTimeout(() => mountEndXp(res), 0);
    return res;
  }
  function unlocksBetween(a, b) {
    const out = []; if (b <= a) return out;
    const ti = tiersNow(), cl = cleared();
    for (const u of ultList()) { const was = ultUnlock(u.id, a, ti, cl).ok, now = ultUnlock(u.id, b, ti, cl).ok; if (!was && now) out.push({ kind: "ult", id: u.id, text: "解鎖絕招：" + u.name + "（出征簡報可以換）" }); }
    const nn = nodes().filter(n => n.lv > a && n.lv <= b);
    if (nn.length) out.push({ kind: "node", ids: nn.map(n => n.id), text: "新的技能可以點：" + nn.map(n => n.name).join("、") });
    for (let s = stageOf(a) + 1; s <= stageOf(b); s++) out.push({ kind: "evo", stage: s, text: "外觀進化：" + stageInfo(s).name });
    const tl = K().UNLOCK_LV || [3];
    if (a < tl[0] && b >= tl[0]) out.push({ kind: "tree", text: "技能樹開放了！主選單「騎士技能樹」" });
    return out;
  }
  const needAt = lv => { const n = (K().LEVEL || {}).xpNeed; return n && n[lv] ? n[lv] : 0; };
  const maxLv = () => (K().LEVEL || {}).max || TG.HERO_MAX || 20;
  function barPct(lv, xp) { const n = needAt(lv); return lv >= maxLv() || !n ? 1 : clamp(xp / n, 0, 1); }
  function endXpHtml(r) {
    const lv = r.to.lv, st = stageOf(lv), pts = totalPts(lv) - spentOf(validTree(kd().tree, lv, tiersNow()));
    const n = needAt(lv), maxed = lv >= maxLv();
    return '<div class="kn-endxp card" id="knEndXp">' +
      '<div class="kn-ex-hd"><canvas class="kn-ic" data-kn-ic="' + st + '|idle" width="64" height="64" aria-hidden="true"></canvas>' +
      '<div class="kn-ex-ti"><small>' + esc(stageInfo(st).name) + '</small><b>文法騎士 <span class="kn-ex-lv">Lv' + lv + '</span></b>' +
      '<span class="kn-ex-gain">+' + r.xp + ' 經驗' + (r.answerXp && r.stageXp ? '<i>答題 ' + r.answerXp + '・過關 ' + r.stageXp + '</i>' : '') + '</span></div></div>' +
      '<div class="kn-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(barPct(lv, r.to.xp) * 100) + '"><i style="width:' + (barPct(lv, r.to.xp) * 100).toFixed(1) + '%"></i></div>' +
      '<div class="kn-ex-num">' + (maxed ? '已經滿級，答題經驗會存起來' : r.to.xp + '／' + n + '（再 ' + Math.max(0, n - r.to.xp) + ' 升 Lv' + (lv + 1) + '）') + '</div>' +
      (r.ups.length ? '<div class="kn-ex-up">' + r.ups.map(l => '<span>升到 Lv' + l + '！</span>').join("") + '</div>' : '') +
      (r.unlocks.length ? '<ul class="kn-ex-ul">' + r.unlocks.map(u => '<li>' + esc(u.text) + '</li>').join("") + '</ul>' : '') +
      (pts > 0 && lv >= 3 && learnInfo().can > 0 ? '<button class="kn-btn main kn-ex-go" data-kn="tree">去點技能樹（有新技能可學）</button>' : '') +
      '</div>';
  }
  function mountEndXp(r) {
    const el = document.getElementById("knEndXp"); if (!el || el.dataset.kn) return;
    el.dataset.kn = "1"; paintIcons(el);
    const go = el.querySelector('[data-kn="tree"]'); if (go) go.onclick = () => openTree(null);
    const bar = el.querySelector(".kn-bar i"), lvEl = el.querySelector(".kn-ex-lv"), gain = el.querySelector(".kn-ex-gain");
    const done = () => { setTimeout(checkEvo, reduced ? 300 : 700); };
    if (reduced || !bar || !W.requestAnimationFrame) { done(); return; }
    // 經驗條：從出征前的位置一路填，每升一級閃一下再從 0 開始（總長 ≤ 3 秒）
    const segs = []; let lv = r.from.lv, p0 = barPct(r.from.lv, r.from.xp);
    while (lv < r.to.lv) { segs.push({ lv, a: p0, b: 1 }); lv++; p0 = 0; }
    segs.push({ lv: r.to.lv, a: p0, b: barPct(r.to.lv, r.to.xp) });
    const per = Math.min(0.7, 2.6 / segs.length), t0 = nowReal(), up = el.querySelector(".kn-ex-up");
    if (up) up.style.visibility = "hidden";
    let si = -1;
    const tick = () => {
      if (!document.body.contains(el)) return;
      const t = (nowReal() - t0) / per, i = Math.min(segs.length - 1, Math.floor(t)), u = i >= segs.length - 1 ? Math.min(1, t - i) : t - i;
      const s = segs[i], e = 1 - Math.pow(1 - clamp(u, 0, 1), 3);
      if (i !== si) { si = i; if (lvEl) lvEl.textContent = "Lv" + s.lv; if (i > 0) { el.classList.remove("kn-flash"); void el.offsetWidth; el.classList.add("kn-flash"); } }
      bar.style.width = ((s.a + (s.b - s.a) * e) * 100).toFixed(1) + "%";
      if (gain) gain.firstChild.nodeValue = "+" + Math.round(r.xp * clamp(t / segs.length, 0, 1)) + " 經驗";
      if (t < segs.length) W.requestAnimationFrame(tick);
      else { if (up) up.style.visibility = ""; if (lvEl) lvEl.textContent = "Lv" + r.to.lv; if (gain) gain.firstChild.nodeValue = "+" + r.xp + " 經驗"; done(); }
    };
    W.requestAnimationFrame(tick);
  }

  // ───── 外觀進化通知（5／10／15／20 級）
  let evoEl = null;
  function checkEvo() {
    if (!live() || !HAS_DOC) return false;
    // 第二輪 P2（11-24 小明）：彈窗是結算經驗條跑完 0.7 秒才跳，孩子先按「下一關」時會疊在簡報／戰鬥上（遊戲不暫停）→ 戰鬥中不跳，留到下次結算
    try { const g = U.G; if (g && !g.over) return false; const end = document.getElementById("ovEnd"); if (g && g.over && end && end.classList.contains("hide")) return false; } catch (e) {}
    const d = kd(), st = stageOf(heroLv());
    if (st <= d.seenEvo) return false;
    showEvo(d.seenEvo, st); return true;
  }
  function showEvo(from, to) {
    injectCss();
    const app = document.getElementById("app") || document.body;
    if (!evoEl) { evoEl = document.createElement("div"); evoEl.id = "knEvo"; evoEl.className = "kn-evo hide"; evoEl.setAttribute("role", "dialog"); evoEl.setAttribute("aria-modal", "true"); app.appendChild(evoEl); }
    const a = stageInfo(from), b = stageInfo(to), lvN = (TG.KNIGHT_EVO_LV || [5, 10, 15, 20])[to - 1] || heroLv();
    evoEl.innerHTML = '<div class="kn-evo-burst" aria-hidden="true"></div><div class="kn-evo-box">' +
      '<div class="kn-evo-kick">Lv' + lvN + ' 外觀進化</div><h2>騎士進化！</h2>' +
      '<div class="kn-evo-pair"><figure class="old"><canvas class="kn-ic" data-kn-ic="' + from + '|idle" width="96" height="96" aria-hidden="true"></canvas><figcaption>' + esc(a.name) + '</figcaption></figure>' +
      '<span class="kn-evo-arrow" aria-hidden="true"></span>' +
      '<figure class="new"><canvas class="kn-ic" data-kn-ic="' + to + '|attack" width="168" height="168" aria-hidden="true"></canvas><figcaption>' + esc(b.name) + '</figcaption></figure></div>' +
      '<p>' + esc(b.desc ? "換上" + b.desc.replace(/、/g, "、") + "！" : "換上新盔甲！") + '<br>絕招的光芒也跟著變得更華麗。</p>' +
      '<button class="big kn-evo-ok" data-kn="evoOk">太帥了！</button></div>';
    paintIcons(evoEl);
    evoEl.classList.remove("hide");
    const ok = evoEl.querySelector("[data-kn=evoOk]");
    ok.onclick = () => { const d = kd(); d.seenEvo = Math.max(d.seenEvo, to); try { U.save(); } catch (e) {} evoEl.classList.add("hide"); setTimeout(checkEvo, 200); };
    try { ok.focus({ preventScroll: true }); } catch (e) {}
    try { if (!S().muted && U.beep) { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => U.beep(f, 0.22, "triangle", 0.04), i * 90)); } } catch (e) {}
  }

  // ───── 圖示（ART.knightIcon；沒有 knight-art 時退回 ART.icon 的騎士）
  const icCache = {};
  function iconCanvas(stage, pose, px) {
    const key = stage + "|" + pose + "|" + px; if (icCache[key]) return icCache[key];
    const c = document.createElement("canvas"); c.width = c.height = px;
    try {
      if (W.ART && W.ART.knightIcon) W.ART.knightIcon(c, stage, pose);
      else if (W.ART && W.ART.icon) W.ART.icon(c, "hero", "knight", 1);
    } catch (e) {}
    return (icCache[key] = c);
  }
  // 節點小徽：路線符號（盾／劍／書卷），畫在圖示右下角
  function emblem(g, path, x, y, r, col) {
    g.save(); g.translate(x, y);
    g.fillStyle = "#0c1122"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = col; g.lineWidth = Math.max(1, r * 0.16); g.stroke();
    g.fillStyle = col; const k = r * 0.55; g.beginPath();
    if (path === "guard") { g.moveTo(0, -k); g.lineTo(k * 0.85, -k * 0.55); g.lineTo(k * 0.7, k * 0.35); g.lineTo(0, k); g.lineTo(-k * 0.7, k * 0.35); g.lineTo(-k * 0.85, -k * 0.55); g.closePath(); g.fill(); }
    else if (path === "blade") { g.moveTo(0, -k * 1.05); g.lineTo(k * 0.22, k * 0.35); g.lineTo(-k * 0.22, k * 0.35); g.closePath(); g.fill(); g.fillRect(-k * 0.6, k * 0.35, k * 1.2, k * 0.2); g.fillRect(-k * 0.12, k * 0.55, k * 0.24, k * 0.45); }
    else { g.fillRect(-k * 0.75, -k * 0.7, k * 1.5, k * 1.3); g.fillStyle = "#0c1122"; for (let i = 0; i < 3; i++) g.fillRect(-k * 0.5, -k * 0.4 + i * k * 0.38, k * (i === 2 ? 0.6 : 1), k * 0.13); }
    g.restore();
  }
  const PATH_COL = { guard: "#7fb4ff", blade: "#ffb36a", chant: "#c49bff" };
  function paintIcons(root) {
    if (!root || !root.querySelectorAll) return;
    const d = Math.min(2, W.devicePixelRatio || 1);
    root.querySelectorAll("canvas[data-kn-ic]").forEach(c => {
      const [st, pose, path] = c.dataset.knIc.split("|"), css = +c.getAttribute("width") || 48, px = Math.round(css * d);
      if (c.dataset.knDone === c.dataset.knIc) return;
      c.dataset.knDone = c.dataset.knIc; c.style.width = c.style.height = css + "px"; c.width = c.height = px;
      const g = c.getContext("2d"); if (!g) return;
      g.clearRect(0, 0, px, px); g.drawImage(iconCanvas(+st || 0, pose || "idle", px), 0, 0);
      if (path) emblem(g, path, px * 0.8, px * 0.8, px * 0.18, PATH_COL[path] || "#E1B86A");
    });
  }

  // ───── 技能樹畫面
  let ov = null, back = null, tab = "guard", msg = "", resetArm = false;
  function toast(t) { try { U.toast && U.toast(t); } catch (e) {} }
  function treeState() {
    const d = kd(), lv = heroLv(), ti = tiersNow(), tree = localValid(d.tree, lv, ti);
    const total = totalPts(lv), spent = spentOf(tree);
    return { d, lv, ti, tree, total, spent, left: total - spent };
  }
  // 第二輪 P2（紅點要準）：「自動點完三格之後」還學得起幾招；學不了時告訴孩子下一招幾級開
  function learnInfo() {
    const stt = treeState(); let tree = stt.tree;
    if (!stt.d.tut && stt.lv >= 3 && !Object.keys(tree).length && typeof TG.knightAutoFirst === "function") { const t = {}; try { TG.knightAutoFirst(t, stt.lv, stt.ti); } catch (e) {} tree = localValid(t, stt.lv, stt.ti); }
    const left = totalPts(stt.lv) - spentOf(tree);
    const can = left > 0 ? nodes().filter(n => !tree[n.id] && nodeState(n, tree, stt.lv, stt.ti).can).length : 0;
    const nx = can ? null : nodes().filter(n => !tree[n.id] && !n.badge && n.lv > stt.lv).sort((a, b) => a.lv - b.lv)[0] || null;
    return { lv: stt.lv, left, can, next: nx ? { lv: nx.lv, name: nx.name } : null };
  }
  function autoFirst(stt) {
    // 第一次開技能樹（3 級以上、什麼都沒點）：自動點三條路線的第 1 格，剩下的點數孩子自己選（研究 1-1）
    const d = stt.d; if (d.tut || stt.lv < 3 || Object.keys(stt.tree).length) return false;
    const ids = (K().RULES || {}).autoFirstTime || ["g1", "b1", "c1"];
    if (live() && typeof TG.knightAutoFirst === "function") { const t = {}; try { TG.knightAutoFirst(t, stt.lv, stt.ti); } catch (e) {} d.tree = t; }
    else { const t = {}; ids.forEach(id => { t[id] = 1; }); d.tree = localValid(t, stt.lv, stt.ti); }
    d.tut = 1;
    try { U.save(); } catch (e) {}
    const li = learnInfo();
    msg = "已幫你點好三條路線的第 1 格" + (li.left > 0 ? (li.can ? "，剩 " + li.left + " 點自己選（新手推薦「守護」）" : li.next ? "。剩下 " + li.left + " 點先存著：升到 Lv" + li.next.lv + " 就能學「" + li.next.name + "」" : "") : "");
    return true;
  }
  function openTree(from, focus) {
    if (!HAS_DOC) return;
    injectCss();
    back = from || null; resetArm = false; msg = "";
    if (!ov) { ov = document.createElement("div"); ov.className = "ov hide"; ov.id = "ovKnight"; (document.getElementById("app") || document.body).appendChild(ov); ov.onclick = onTreeClick; }
    try { U.show && U.show(null); } catch (e) {}
    const st = treeState(); autoFirst(st);
    ov.classList.remove("hide"); renderTree(); ov.scrollTop = 0;
    if (focus === "ult") { const u = ov.querySelector("#knUlt"); if (u) try { u.scrollIntoView({ block: "start" }); } catch (e) {} }
  }
  function closeTree() {
    if (ov) ov.classList.add("hide");
    try { if (back && U.openBrief) U.openBrief(back); else { U.show("ovMenu"); U.menuInfo && U.menuInfo(); } } catch (e) {}
  }
  function nodeCard(n, stt) {
    const s = nodeState(n, stt.tree, stt.lv, stt.ti), stage = stageOf(n.lv);
    const pose = n.path === "guard" ? "block" : n.path === "blade" ? "attack" : "idle";
    const cls = "kn-node" + (s.own ? " own" : s.can ? " can" : " lock") + (n.badge ? " badge" : "") + (n.capstone ? " cap" : "");
    let badgeHtml = "";
    if (s.badge) {
      const b = s.badge;
      badgeHtml = '<div class="kn-bdg' + (b.ok ? " ok" : "") + '"><b>' + (b.ok ? "徽章條件達成" : "差 " + (b.need - b.have) + " 枚" + esc(b.name) + b.tierZh + "牌") + '</b>' +
        '<span class="kn-bdg-n">' + b.have + '／' + b.need + '</span><div class="kn-chips">' +
        b.members.map(gp => { const t = stt.ti[gp] || 0; return '<span class="kn-chip t' + t + '" title="' + esc(gpName(gp)) + '">' + esc(gpName(gp)) + (t ? "・" + ["", "銅", "銀", "金"][t] : "") + '</span>'; }).join("") +
        '</div></div>';
    }
    const btn = s.own ? (s.drop ? '<button class="kn-btn" data-kn="drop" data-id="' + n.id + '">取消（退 ' + n.cost + ' 點）</button>' : '<span class="kn-own">已學會</span>')
      : '<button class="kn-btn main" data-kn="learn" data-id="' + n.id + '"' + (s.can ? "" : " disabled") + '>學習（' + n.cost + ' 點）</button>';
    return '<div class="' + cls + '" data-node="' + n.id + '"><div class="kn-node-hd"><canvas class="kn-ic" data-kn-ic="' + stage + '|' + pose + '|' + n.path + '" width="44" height="44" aria-hidden="true"></canvas>' +
      '<div class="kn-node-ti"><b>' + esc(n.name) + '</b><small>Lv' + n.lv + '・' + n.cost + ' 點' + (n.capstone ? '・終極（三選一）' : '') + (n.badge ? '・徽章技能' : '') + '</small></div></div>' +
      '<div class="kn-node-d">' + esc(nodeShort(n)) + '</div>' +
      (!s.own && s.why.length ? '<div class="kn-why">' + s.why.map(esc).join("<br>") + '</div>' : '') + badgeHtml +
      '<details class="kn-more"><summary>詳細</summary><p>' + esc(n.desc || "") + '</p>' + (s.badge && !s.badge.ok ? '<p>多答上面這些文法的題目，拿到' + s.badge.tierZh + '牌就能學；不拿也能正常過關。</p>' : '') + '</details>' + btn + '</div>';
  }
  function renderTree() {
    const stt = treeState(), lv = stt.lv, st = stageOf(lv), n = needAt(lv), xp = (S().hero || {}).xp || 0, maxed = lv >= maxLv();
    const tl = K().UNLOCK_LV || [3, 5, 7, 10, 15, 20];
    const pathSpent = p => nodes().filter(x => x.path === p && stt.tree[x.id]).reduce((a, x) => a + x.cost, 0);
    const pathTot = p => nodes().filter(x => x.path === p).reduce((a, x) => a + x.cost, 0);
    const tabs = paths().map(p => '<button class="kn-tab' + (tab === p.id ? " on" : "") + '" data-kn="tab" data-p="' + p.id + '" aria-pressed="' + (tab === p.id) + '"><b>' + esc(p.name) + '</b><small>' + pathSpent(p.id) + '／' + pathTot(p.id) + '</small></button>').join("");
    const cols = paths().map(p => {
      const ns = nodes().filter(x => x.path === p.id), rows = [];
      for (const lvl of tl) { const r = ns.filter(x => x.lv === lvl); if (r.length) rows.push('<div class="kn-row' + (r.length > 1 ? " two" : "") + '"><div class="kn-lvtag' + (lv >= lvl ? " on" : "") + '">Lv' + lvl + '</div><div class="kn-row-n">' + r.map(x => nodeCard(x, stt)).join("") + '</div></div>'); }
      return '<section class="kn-path' + (tab === p.id ? " on" : "") + '" data-path="' + p.id + '"><h3 style="--pc:' + (PATH_COL[p.id] || "#E1B86A") + '">' + esc(p.name) + '<small>' + pathSpent(p.id) + '／' + pathTot(p.id) + ' 點</small></h3><p class="kn-role">' + esc(PATH_SHORT[p.id] || p.role || "") + '</p>' + rows.join("") + '</section>';
    }).join("");
    const d = stt.d, cl = cleared();
    const ults = ultList().map(u => { const k = ultUnlock(u.id, lv, stt.ti, cl), on = d.ult === u.id && k.ok;
      return '<div class="kn-ult' + (on ? " on" : "") + (k.ok ? "" : " lock") + '"><button class="kn-ult-pick" data-kn="ult" data-id="' + u.id + '"' + (k.ok ? "" : " disabled") + ' aria-pressed="' + on + '"><b>' + esc(u.name) + (on ? '<i>出征用這招</i>' : '') + '</b><span>' + esc(ULT_SHORT[u.id] || "") + '</span>' + (k.ok ? '' : '<em>' + esc(ULT_LOCK_SHORT[u.id] || "還沒解鎖") + '</em>') + '</button>' +
        '<details class="kn-more"><summary>詳細</summary><p>' + esc(u.desc || "") + '</p>' + (k.ok ? '' : '<p>' + esc(k.why) + '</p>') + '</details></div>'; }).join("");
    const chants = [["ask", "每次問我"], ["auto", "都多答一題"], ["off", "直接放"]].map(([k, t]) => '<button class="kn-seg' + (d.chant === k ? " on" : "") + '" data-kn="chantMode" data-m="' + k + '" aria-pressed="' + (d.chant === k) + '">' + t + '</button>').join("");
    ov.innerHTML = '<div class="kn-wrap">' +
      '<div class="kn-head"><canvas class="kn-ic" data-kn-ic="' + st + '|idle" width="72" height="72" aria-hidden="true"></canvas><div class="kn-head-ti"><small>' + esc(stageInfo(st).name) + '</small><h2>文法騎士 Lv' + lv + '</h2>' +
        '<div class="kn-bar sm"><i style="width:' + (barPct(lv, xp) * 100).toFixed(1) + '%"></i></div><span class="kn-xp">' + (maxed ? '已經滿級' : '經驗 ' + xp + '／' + n) + '</span></div>' +
        '<div class="kn-pts"><b>' + stt.left + '</b><small>可用點數</small><span>共 ' + stt.total + ' 點</span></div></div>' +
      (lv < tl[0] ? '<div class="kn-msg">技能樹 Lv' + tl[0] + ' 開放（還差 ' + (tl[0] - lv) + ' 級）。答對題目就會拿到經驗，先看看有哪些技能吧！</div>' : '') +
      (msg ? '<div class="kn-msg ok" role="status">' + esc(msg) + '</div>' : '') +
      '<section class="kn-sec" id="knUlt"><h3>絕招（出征前選 1 招）</h3><div class="kn-ults">' + ults + '</div>' +
        '<div class="kn-chant"><span>怒氣滿了以後</span><div class="kn-segs" role="group" aria-label="怒氣滿了以後">' + chants + '</div></div>' +
        '<p class="kn-help">' + CHANT_HELP + '</p></section>' +
      '<div class="kn-tabs" role="group" aria-label="三條路線">' + tabs + '</div>' +
      '<div class="kn-cols">' + cols + '</div>' +
      '<details class="kn-more kn-rules"><summary>技能點怎麼算</summary><p>每升 1 級得 2 點，20 級共 ' + totalPts(maxLv()) + ' 點；全部點滿要 ' + nodes().reduce((a, x) => a + x.cost, 0) + ' 點，所以最多點滿一條半。終極技能三選一。徽章技能是額外加分，不拿也能過關。重置免費。</p></details>' +
      '<div class="kn-foot"><button class="big ghost" data-kn="back">' + (U.uic ? U.uic("back", false) : "") + (back ? "回關卡簡報" : "回主選單") + '</button>' +
        '<button class="big ghost" data-kn="reset"' + (stt.spent ? "" : " disabled") + '>' + (resetArm ? "再按一次：全部重點" : "免費重置") + '</button></div>' +
      '</div>';
    paintIcons(ov);
  }
  function onTreeClick(ev) {
    const t = ev.target.closest("[data-kn]"); if (!t || t.disabled) return;
    const k = t.dataset.kn, d = kd(), lv = heroLv(), ti = tiersNow();
    if (k !== "reset") resetArm = false;
    if (k === "back") return closeTree();
    if (k === "tab") { tab = t.dataset.p; renderTree(); return; }
    if (k === "learn" || k === "drop") {
      const n = nodeById(t.dataset.id); if (!n) return;
      const cur = localValid(d.tree, lv, ti), s = nodeState(n, cur, lv, ti);
      if (k === "learn" && s.can) { if (live() && typeof TG.knightLearn === "function") { if (!TG.knightLearn(cur, n.id, lv, ti)) return; } else cur[n.id] = 1; msg = "學會了「" + n.name + "」！"; }
      else if (k === "drop" && s.drop) { delete cur[n.id]; msg = "取消了「" + n.name + "」，退回 " + n.cost + " 點"; }
      else return;
      d.tree = validTree(cur, lv, ti); save(); renderTreeKeep(n.id); return;
    }
    if (k === "reset") {
      if (!resetArm) { resetArm = true; renderTree(); return; }
      resetArm = false; if (typeof TG.knightReset === "function") { try { TG.knightReset(d.tree); } catch (e) { d.tree = {}; } } else d.tree = {}; msg = "已全部重置，點數都退回來了"; save(); renderTree(); return;
    }
    if (k === "ult") { const id = t.dataset.id; if (ultUnlock(id, lv, ti, cleared()).ok) { d.ult = id; msg = "出征會帶「" + ultName(id) + "」"; save(); renderTreeKeep(); } return; }
    if (k === "chantMode") { d.chant = t.dataset.m; save(); renderTreeKeep(); return; }
  }
  function renderTreeKeep(id) {
    const y = ov.scrollTop; renderTree(); ov.scrollTop = y;
    if (id) { const el = ov.querySelector('[data-node="' + id + '"] .kn-btn, [data-node="' + id + '"] .kn-own'); if (el) try { el.focus({ preventScroll: true }); } catch (e) {} }
  }
  function save() { try { U.save && U.save(); } catch (e) {} }

  // ───── 出征簡報卡：選絕招（1 招）＋詠唱方式＋技能樹入口
  function briefCard(stg) {
    if (!live()) return "";
    // 第二輪 P1-18（教學節奏）：第 1 關（還沒過過）只教蓋塔、答題、升級 → 簡報先不放「絕招三選一」「怒氣滿了」設定
    if (stg && stg.i === 0 && cleared() < 1) return "";
    const d = kd(), lv = heroLv(), ti = tiersNow(), cl = cleared(), stt = treeState();
    if (!ultUnlock(d.ult, lv, ti, cl).ok) d.ult = "wall";
    const ults = ultList().map(u => { const k = ultUnlock(u.id, lv, ti, cl), on = d.ult === u.id;
      return '<button class="kn-ult sm' + (on ? " on" : "") + (k.ok ? "" : " lock") + '" data-knb="ult" data-id="' + u.id + '"' + (k.ok ? "" : " disabled") + ' aria-pressed="' + on + '"><b>' + esc(u.name) + '</b>' + (k.ok ? '<span>' + esc(ULT_SHORT[u.id] || "") + '</span>' : '<em>' + esc(ULT_LOCK_SHORT[u.id] || "還沒解鎖") + '</em>') + '</button>'; }).join("");
    const more = '<details class="kn-more"><summary>三招的詳細說明</summary>' + ultList().map(u => { const k = ultUnlock(u.id, lv, ti, cl); return '<p><b>' + esc(u.name) + '</b>：' + esc(u.desc || "") + (k.ok ? '' : '（' + esc(k.why) + '）') + '</p>'; }).join("") + '<p>' + CHANT_HELP + '。</p></details>';
    const chants = [["ask", "每次問我"], ["auto", "都多答一題"], ["off", "直接放"]].map(([k, t]) => '<button class="kn-seg' + (d.chant === k ? " on" : "") + '" data-knb="chantMode" data-m="' + k + '" aria-pressed="' + (d.chant === k) + '">' + t + '</button>').join("");
    return '<div class="card kn-brief" id="knBrief"><h4>' + (U.uic ? U.uic("swords", false) : "") + '騎士絕招（選 1 招）</h4><div class="kn-ults row">' + ults + '</div>' +
      '<div class="kn-chant"><span>怒氣滿了</span><div class="kn-segs" role="group" aria-label="怒氣滿了以後">' + chants + '</div></div>' + more +
      '<button class="kn-btn kn-brief-tree" data-knb="tree">技能樹' + (lv >= 3 && learnInfo().can > 0 ? '（有新技能可學）' : '') + '</button></div>';
  }
  function briefBind(st, root) {
    const el = root && root.querySelector && root.querySelector("#knBrief"); if (!el) return;
    el.onclick = ev => {
      const t = ev.target.closest("[data-knb]"); if (!t || t.disabled) return;
      const d = kd();
      if (t.dataset.knb === "tree") { openTree(st); return; }
      if (t.dataset.knb === "ult") d.ult = t.dataset.id;
      if (t.dataset.knb === "chantMode") d.chant = t.dataset.m;
      save();
      const nu = document.createElement("div"); nu.innerHTML = briefCard(st); el.replaceWith(nu.firstChild); briefBind(st, root);
    };
  }

  // ───── 掛勾
  U.add("brief", st => briefCard(st));
  U.add("briefBind", (st, root) => briefBind(st, root));
  U.add("opts", (opts, st) => { if (!live() || !opts) return opts; try { opts.knight = knightOpts(); } catch (e) { if (W.console) console.error("[knight opts]", e); } return opts; });
  // 主選單入口：騎士引擎還沒實作時 label 丟例外＝index 會略過這一格（行為不變）
  U.add("menu", {
    label: () => { if (!live()) throw new Error("knight off"); const s = learnInfo(); return "騎士技能樹" + (s.lv >= 3 && s.can > 0 ? "（有新技能可學）" : "（Lv" + s.lv + "）"); },
    icon: { kind: "hero", id: "knight", lv: 1 },
    badge: () => { const s = learnInfo(); return s.lv >= 3 && s.can > 0; },
    onClick: () => openTree(null)
  });

  // ───── 騎士外觀（合約 §8.7）：一次接上，血條高度與 4 處圖示跟著階段
  function install() {
    try {
      if (W.ART && typeof W.ART.installKnightStages === "function") {
        W.ART.installKnightStages(() => stageOf(heroLv()));
        return true;
      }
    } catch (e) { if (W.console) console.error("[knight art]", e); }
    return false;
  }
  install();
  if (HAS_DOC) injectCss();   // 簡報卡、結算卡由 index 直接插 HTML，樣式要先在
  if (HAS_DOC && W.addEventListener) W.addEventListener("DOMContentLoaded", () => { install(); setTimeout(checkEvo, 600); });

  // ───── 瀏覽器機器人：怒氣滿＋騎士附近 ≥3 隻就放；二選一小視窗輪流選詠唱／直接放（詠唱題由 qpanel／舊面板的機器人回答）
  if (HAS_DOC) W.TGBOT = (W.TGBOT || []).concat((T, G, c) => {
    if (!G || G.over) return false;
    if (pickEl && !pickEl.classList.contains("hide")) { c.knPick = (c.knPick || 0) + 1; const b = pickEl.querySelector(c.knPick % 3 ? '[data-kn="chant"]' : '[data-kn="direct"]'); if (b) b.click(); return true; }
    if (T.sheetMode || !ragey(G)) return false;
    const st = ultState(G); if (!st.ready || !G.waveActive) return false;
    const h = G.heroes[0], near = G.enemies.filter(e => Math.hypot(e.x - h.x, e.y - h.y) < 90).length;
    if (near < 3) return false;
    if (onUlt(0)) { c.knUlt = (c.knUlt || 0) + 1; return true; }
    return false;
  });

  // ───── 樣式（星夜奇幻：深藍底、金邊、按鈕 ≥44px；320 寬單欄、900 以上三欄）
  function injectCss() {
    if (!HAS_DOC || document.getElementById("knCss")) return;
    const s = document.createElement("style"); s.id = "knCss";
    s.textContent = `
#bUlt.kn-rage{overflow:visible}
#bUlt .kn-pfc{position:absolute;top:-8px;right:-6px;z-index:4;padding:1px 5px;border-radius:9px;background:#ffd75e;color:#2a1a00;font-size:11px;font-weight:900;line-height:16px;white-space:nowrap;box-shadow:0 1px 3px #0008;pointer-events:none}
#bUlt.kn-rage::before{content:"";position:absolute;inset:-2px;border-radius:14px;padding:3px;pointer-events:none;
  background:conic-gradient(from -90deg,#ffd75e calc(var(--kn-pct,0)*360deg),rgba(255,255,255,.14) 0);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
#bUlt.kn-rage.ready{box-shadow:0 0 0 2px #ffd75e,0 0 18px rgba(255,215,94,.75);animation:knGlow 1.1s ease-in-out infinite alternate}
#bUlt.kn-rage.kn-full{box-shadow:0 0 10px rgba(255,215,94,.35)}
#bUlt.kn-rage.ready.kn-big{z-index:3;transform:scale(1.14);animation:knGlow 1.1s ease-in-out infinite alternate,knBounce 1s ease-in-out infinite}
#bUlt.kn-rage.ready.kn-big small{color:#ffe07a;font-weight:900}
@keyframes knBounce{0%,100%{transform:scale(1.1)}50%{transform:scale(1.24) translateY(-3px)}}
#bUlt.kn-rage:disabled{opacity:.55}
@keyframes knGlow{from{box-shadow:0 0 0 2px #ffd75e,0 0 10px rgba(255,215,94,.45)}to{box-shadow:0 0 0 2px #fff0b8,0 0 24px rgba(255,215,94,.95)}}
.kn-btn{min-height:44px;border-radius:12px;border:1px solid #4b6478;background:linear-gradient(#26384f,#172539);color:#eef2fa;font-weight:800;padding:8px 12px;box-shadow:0 3px 0 #0a1222;font-size:14px}
.kn-btn.main{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;border-color:#8a6a3a;box-shadow:0 3px 0 #6b4a1c}
.kn-btn:disabled{opacity:.45;filter:saturate(.3);cursor:default}
.kn-btn:focus-visible,.kn-ult:focus-visible,.kn-seg:focus-visible,.kn-tab:focus-visible{outline:3px solid #8af0ff;outline-offset:2px}
.kn-pick{position:absolute;z-index:40;background:linear-gradient(#1c2a46,#111a30);border:1px solid #E1B86A;border-radius:14px;padding:10px;box-shadow:0 8px 24px #000a,0 0 18px rgba(225,184,106,.3);text-align:center}
.kn-pick-t{font-weight:900;color:#F3D494;margin-bottom:8px;font-size:15px}
.kn-pick-b{display:flex;gap:8px}.kn-pick-b .kn-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:56px}
.kn-pick-b small{font-size:12.5px;font-weight:700;opacity:.9}   /* 11-24 UIUX：戰鬥中要快速看的說明至少 12px */
.kn-pick-s{font-size:13px;color:#c4d2e6;margin-top:6px;font-weight:700}
#ovKnight{padding:14px 12px 24px;text-align:left}
.kn-wrap{width:100%;max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.kn-head{display:flex;align-items:center;gap:10px;background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:14px;padding:10px;box-shadow:inset 0 0 0 1px rgba(225,184,106,.16)}
.kn-head .kn-ic{flex:none;filter:drop-shadow(0 0 8px rgba(225,184,106,.35))}
.kn-head-ti{flex:1;min-width:0}.kn-head-ti small{color:#F3D494;font-size:12px}.kn-head h2{margin:0;font-size:20px;text-align:left}
.kn-xp{font-size:12px;color:#a9b9d0}
.kn-pts{flex:none;display:flex;flex-direction:column;align-items:center;min-width:64px;background:#0c1122;border:1px solid #E1B86A;border-radius:12px;padding:6px 8px}
.kn-pts b{font-size:26px;line-height:1;color:#ffd75e;font-family:var(--serif,serif)}.kn-pts small{font-size:12px;color:#F3D494}.kn-pts span{font-size:12px;color:#a9b9d0}
.kn-bar{height:12px;border-radius:7px;background:#0c1122;border:1px solid #3a4f6e;overflow:hidden;margin:6px 0 3px}
.kn-bar.sm{height:8px}
.kn-bar i{display:block;height:100%;background:linear-gradient(90deg,#8a6a3a,#ffd75e,#fff3c4);border-radius:7px}
.kn-msg{background:#13213a;border:1px solid #3e5a80;border-radius:12px;padding:8px 12px;font-size:14px;color:#dfe8ff}
.kn-msg.ok{border-color:#E1B86A;color:#ffeab0}
.kn-sec{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:14px;padding:10px 12px}
.kn-sec h3,.kn-path h3{margin:0 0 8px;font-family:var(--serif,serif);color:#F3D494;font-size:17px}
.kn-ults{display:grid;grid-template-columns:1fr;gap:8px}
.kn-ult{min-height:44px;text-align:left;border-radius:12px;border:1px solid #4b6478;background:linear-gradient(#22344a,#152336);color:#eef2fa;padding:8px 10px;display:flex;flex-direction:column;gap:2px;font-size:13px}
.kn-ult b{font-size:15px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.kn-ult b i{font-style:normal;font-size:12px;background:#E1B86A;color:#2a1d08;border-radius:6px;padding:0 6px}
.kn-ult span{color:#c8d4e8;line-height:1.5}.kn-ult em{font-style:normal;color:#ffc9a8;font-size:12px;line-height:1.5}
.kn-ult.on{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.55),0 0 14px rgba(225,184,106,.3);background:linear-gradient(#2c3a52,#1a2640)}
.kn-ult.lock{opacity:.75}
div.kn-ult{padding:0;gap:0;overflow:hidden}
.kn-ult-pick{display:flex;flex-direction:column;gap:2px;width:100%;min-height:52px;text-align:left;background:none;border:0;color:inherit;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer}
.kn-ult-pick:disabled{cursor:default}
.kn-ult-pick b{font-size:15px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.kn-more{font-size:12px;color:#c8d4e8;line-height:1.6}
.kn-more>summary{min-height:44px;display:flex;align-items:center;gap:6px;cursor:pointer;color:#8fc8ff;font-weight:800;font-size:13px;list-style:none;padding:0 2px}
.kn-more>summary::-webkit-details-marker{display:none}
.kn-more>summary::before{content:"";width:0;height:0;border-left:6px solid currentColor;border-top:5px solid transparent;border-bottom:5px solid transparent;transition:transform .15s}
.kn-more[open]>summary::before{transform:rotate(90deg)}
.kn-more p{margin:0 0 6px;text-align:left;max-width:none;color:#c8d4e8;font-size:12px}
div.kn-ult .kn-more{padding:0 10px 2px;border-top:1px solid rgba(255,255,255,.06)}
.kn-brief .kn-more{margin-top:4px}
.kn-rules{background:#13213a;border:1px solid #2e4560;border-radius:12px;padding:0 12px}
.kn-chant{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#a9b9d0}
.kn-segs{display:flex;flex:1;min-width:220px;border:1px solid #4b6478;border-radius:12px;overflow:hidden}
.kn-seg{flex:1;min-height:44px;border:0;background:#152336;color:#dfe8ff;font-weight:800;font-size:13px;padding:4px 6px}
.kn-seg+.kn-seg{border-left:1px solid #4b6478}.kn-seg.on{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}
.kn-help{margin:0;font-size:12px;color:#a9b9d0;line-height:1.6;text-align:left;max-width:none}
.kn-tabs{display:flex;gap:6px;position:sticky;top:-14px;z-index:2;background:#0c1426;padding:6px 0;margin:0 -2px}
.kn-tab{flex:1;min-height:48px;border-radius:12px;border:1px solid #4b6478;background:linear-gradient(#22344a,#152336);color:#eef2fa;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
.kn-tab b{font-size:15px}.kn-tab small{font-size:12px;color:#a9b9d0}
.kn-tab.on{border-color:#E1B86A;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}.kn-tab.on small{color:#4a3510}
.kn-cols{display:block}
.kn-path{display:none}.kn-path.on{display:block}
.kn-path h3{display:flex;align-items:baseline;gap:8px;border-left:4px solid var(--pc);padding-left:8px}.kn-path h3 small{font-size:12px;color:#a9b9d0;font-family:inherit}
.kn-role{margin:0 0 8px;font-size:12px;color:#a9b9d0;text-align:left;max-width:none}
.kn-row{display:flex;gap:8px;margin-bottom:8px;position:relative}
.kn-lvtag{flex:none;width:40px;text-align:center;font-size:12px;font-weight:900;color:#7d8aa3;padding-top:12px}
.kn-lvtag.on{color:#ffd75e}
.kn-row::before{content:"";position:absolute;left:19px;top:34px;bottom:-10px;width:2px;background:#2e4560}
.kn-row:last-child::before{display:none}
.kn-row-n{flex:1;min-width:0;display:grid;grid-template-columns:1fr;gap:8px}
.kn-node{border-radius:12px;border:1px solid #3a4f6e;background:linear-gradient(#1c2a44,#121c30);padding:8px 10px;display:flex;flex-direction:column;gap:5px;font-size:13px}
.kn-node.own{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.45),0 0 12px rgba(225,184,106,.22);background:linear-gradient(#2a3550,#18233a)}
.kn-node.can{border-color:#6aa8ff;box-shadow:0 0 10px rgba(106,168,255,.25)}
.kn-node.lock .kn-ic{filter:grayscale(.85) brightness(.75)}
.kn-node.badge{background:radial-gradient(circle at 90% 0,rgba(196,155,255,.16),transparent 55%),linear-gradient(#1c2746,#131b33)}
.kn-node.cap{border-style:double;border-width:3px}
.kn-node-hd{display:flex;align-items:center;gap:8px}.kn-node-hd .kn-ic{flex:none;border-radius:10px;background:radial-gradient(circle at 50% 40%,#2b3d62,#0e1628)}
.kn-node-ti{display:flex;flex-direction:column;min-width:0}.kn-node-ti b{font-size:15px}.kn-node-ti small{font-size:12px;color:#a9b9d0}
.kn-node-d{color:#eef2fa;line-height:1.55;font-size:14px;font-weight:700}
.kn-why{color:#ffc9a8;font-size:12px;line-height:1.5}
.kn-own{align-self:flex-start;font-size:12px;font-weight:900;color:#2a1d08;background:#E1B86A;border-radius:8px;padding:3px 10px}
.kn-node .kn-btn{align-self:stretch}
.kn-bdg{border:1px dashed #6a5aa8;border-radius:10px;padding:6px 8px;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12px;color:#e6dcff}
.kn-bdg.ok{border-color:#E1B86A;color:#ffeab0}
.kn-bdg-n{margin-left:auto;font-weight:900}
.kn-bdg small{flex-basis:100%;color:#a9b9d0}
.kn-chips{flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px}
.kn-chip{font-size:12px;border-radius:8px;padding:1px 7px;background:#0c1122;border:1px solid #3a4f6e;color:#a9b9d0}
.kn-chip.t1{border-color:#b07a48;color:#f0c89a}.kn-chip.t2{border-color:#cfd6de;color:#fff}.kn-chip.t3{border-color:#ffd75e;color:#ffd75e}
.kn-foot{display:flex;gap:8px;flex-wrap:wrap}.kn-foot .big{flex:1 1 140px}
.kn-brief .kn-ults.row{grid-template-columns:repeat(3,minmax(0,1fr))}
.kn-ult.sm{padding:6px 7px}.kn-ult.sm b{font-size:14px}.kn-ult.sm span,.kn-ult.sm em{font-size:12px}
.kn-brief-tree{width:100%;margin-top:8px}
@media (max-width:400px){.kn-brief .kn-ults.row{grid-template-columns:1fr}.kn-segs{min-width:0;flex-basis:100%}}
@media (min-width:900px){
  .kn-wrap{max-width:1000px}
  .kn-tabs{display:none}
  .kn-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .kn-path{display:block}
  .kn-ults{grid-template-columns:repeat(3,minmax(0,1fr))}
}
.kn-endxp{display:flex;flex-direction:column;gap:4px}
.kn-ex-hd{display:flex;align-items:center;gap:10px}.kn-ex-hd .kn-ic{flex:none}
.kn-ex-ti{display:flex;flex-direction:column;min-width:0}.kn-ex-ti small{color:#F3D494;font-size:12px}.kn-ex-ti b{font-size:17px}
.kn-ex-lv{color:#ffd75e;font-family:var(--serif,serif);font-size:20px}
.kn-ex-gain{font-weight:900;color:#ffe07a}.kn-ex-gain i{font-style:normal;font-weight:400;color:#a9b9d0;font-size:12px;margin-left:6px}
.kn-ex-num{font-size:12px;color:#a9b9d0}
.kn-ex-up{display:flex;flex-wrap:wrap;gap:6px}.kn-ex-up span{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;font-weight:900;border-radius:8px;padding:2px 10px;font-size:13px}
.kn-ex-ul{margin:2px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:#dfe8ff}
.kn-ex-go{margin-top:6px}
.kn-endxp.kn-flash{animation:knFlash .45s ease-out}
@keyframes knFlash{0%{box-shadow:0 0 0 2px #fff3c4,0 0 30px rgba(255,215,94,.9)}100%{box-shadow:inset 0 0 0 1px rgba(225,184,106,.16),0 4px 14px #0006}}
.kn-evo{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(circle at 50% 42%,rgba(40,52,100,.92),rgba(5,8,20,.96) 70%);overflow:auto}
.kn-evo-burst{position:absolute;left:50%;top:42%;width:640px;height:640px;margin:-320px 0 0 -320px;pointer-events:none;opacity:.5;
  background:repeating-conic-gradient(from 0deg,rgba(255,215,94,.28) 0 6deg,transparent 6deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,#000 30%,transparent 68%);mask:radial-gradient(circle,#000 0,#000 30%,transparent 68%);animation:knSpin 18s linear infinite}
@keyframes knSpin{to{transform:rotate(360deg)}}
.kn-evo-box{position:relative;width:100%;max-width:420px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.kn-evo-kick{font-size:13px;letter-spacing:3px;color:#8af0ff;font-weight:900}
.kn-evo h2{margin:0;font-family:var(--serif,serif);font-size:32px;color:#F3D494;text-shadow:0 2px 0 #0c1122,0 0 18px rgba(225,184,106,.55)}
.kn-evo-pair{display:flex;align-items:center;justify-content:center;gap:10px}
.kn-evo-pair figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}
.kn-evo-pair figcaption{font-size:13px;color:#a9b9d0}.kn-evo-pair .new figcaption{font-size:18px;font-weight:900;color:#ffe9a8}
.kn-evo-pair .old{opacity:.6;filter:saturate(.6)}
.kn-evo-pair .new canvas{filter:drop-shadow(0 0 16px rgba(255,215,94,.65));animation:knPop .7s cubic-bezier(.3,1.6,.5,1) both}
@keyframes knPop{0%{transform:scale(.4);opacity:0}100%{transform:none;opacity:1}}
.kn-evo-arrow{width:0;height:0;border-left:14px solid #E1B86A;border-top:10px solid transparent;border-bottom:10px solid transparent}
.kn-evo p{color:#dfe8ff;font-size:14px;line-height:1.7;margin:0}
.kn-evo-ok{min-width:180px}
@media (max-width:360px){.kn-evo-pair .new canvas{width:128px!important;height:128px!important}.kn-evo-pair .old canvas{width:64px!important;height:64px!important}.kn-evo h2{font-size:26px}.kn-head h2{font-size:18px}}
@media (prefers-reduced-motion:reduce){#bUlt.kn-rage.ready,#bUlt.kn-rage.ready.kn-big{animation:none}.kn-evo-burst{animation:none}.kn-evo-pair .new canvas{animation:none}.kn-endxp.kn-flash{animation:none}}
`;
    document.head.appendChild(s);
  }

  // ───── 對外
  Object.assign(U.knight = U.knight || {}, {
    ver: 1, onUlt, ultState, paintUlt, openTree, openUltPick: from => openTree(from, "ult"), endXp, checkEvo, closeTree,
    state: () => { const s = treeState(); return { lv: s.lv, tree: s.tree, total: s.total, spent: s.spent, left: s.left, ult: s.d.ult, chant: s.d.chant }; },
    // 測試用（純函式）
    _nodeState: nodeState, _localValid: localValid, _ultUnlock: ultUnlock, _chantRules: chantRules, _chantMul: chantMul, _knightOpts: knightOpts,
    _unlocksBetween: unlocksBetween, _endXpHtml: endXpHtml, _chant: CH, _install: install, _briefCard: briefCard, _short: { ULT_SHORT, ULT_LOCK_SHORT, NODE_SHORT, PATH_SHORT, CHANT_HELP }
  });
})();
