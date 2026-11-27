// 外掛：gear（畫面端，只在瀏覽器載入）— 裝備、文法徽章、星星天賦
// 存檔：TGUI.S.mods.gear = { shards, hist:{文法點:[0/1…]}, badges:{}, owned:{}, eq:{weapon,armor,acc}, talents:{},
//   v3 三階徽章（合約 §8.4）：mast（掌握度紀錄，TG.masteryPush 寫）、btier:{文法點:1 銅／2 銀／3 金}、bday:{文法點:{階:日期}} }
(function () {
  if (!window.TGUI || !window.TG || !TG.GEAR) return;
  const U = window.TGUI, esc = U.esc;
  const D = () => { const m = U.S.mods || (U.S.mods = {}); return (m.gear = TG.gearData(m.gear)); };
  const GPS = typeof QDB_GP !== "undefined" ? QDB_GP : (window.QDB_GP || {});
  // v3 第 1 批新文法點的名稱（題庫 QDB_GP 還沒有時先用這張表；依 _research/騎士技能樹與徽章 §5.2）
  const GP_NAME = { G15: "名詞", G16: "代名詞", G17: "冠詞", G18: "There is／are", G19: "祈使句", G20: "疑問詞", G21: "do／does／did", G22: "地方介系詞",
    G23: "頻率副詞", G24: "數量詞", G25: "未來式", G26: "過去進行式", G27: "連接詞", G28: "副詞子句", G29: "連綴動詞與分詞形容詞", G30: "It 句型與 too…to",
    G31: "感官與使役動詞", G32: "間接問句", G33: "附加問句", G34: "授與動詞與 used to", G35: "感嘆句" };
  const badgeName = k => (GPS[k] ? GPS[k].name : GP_NAME[k] ? GP_NAME[k] : k === "片語" ? "綜合片語" : /^G\d\d$/.test(k) ? "文法 " + k.slice(1) : "綜合文法");
  const TIER = TG.BADGE_TIER_NAME || ["", "銅", "銀", "金"];
  const TIER_CLR = ["", "#d89a5b", "#cfd8e6", "#ffd75e"];
  // 門檻（knight_tree.json badges.tiers／phase1；第 1 期銀牌只要 2 種題型、金牌關閉）
  const BCFG = () => { const B = (TG.DATA_KNIGHT && TG.DATA_KNIGHT.badges) || {}, t = B.tiers || {}, p1 = B.phase1 || {};
    return { bM: (t.bronze || {}).M || 60, bN: (t.bronze || {}).minN || 10, sM: (t.silver || {}).M || 75, sK: p1.silverMinKinds || (t.silver || {}).minKinds || 2, gold: p1.goldEnabled === true }; };
  const masteryOn = () => TG.QKINDS_VER >= 1;
  const stars = () => U.totalStars();
  // 11-22 第 3 層：存檔裡不合法的天賦（父天賦沒學、累積星數沒到門檻、星星不夠＝手改存檔）自動退掉、星星退回
  const DT = () => { const d = D(), out = TG.talentPrune(d.talents, stars());
    if (out.length) { try { U.save(); U.toast("星星不夠，已退回天賦：" + out.map(id => TG.TALENTS[id] ? TG.TALENTS[id].name : id).join("、")); } catch (e) {} }
    return { d, pruned: out }; };
  // 第二刀：自繪圖示（TGUI.uic）取代 emoji
  const IC = { weapon: "sword", armor: "shield", acc: "ring", dagger: "dagger", sword: "sword", spear: "spear", plate: "shield", cloak: "cloak", thorn: "thorn", amulet: "amulet", glove: "glove", ring: "ring",
    gold: "coin", wall: "castle", charge: "bolt", eye: "eye", learn: "book", guard: "spark", revive: "revive", surge: "battery", pierce: "target",
    notes: "scroll", focus: "swords", chain: "shield", quake: "rock", reso: "crown" };
  const ic = k => U.uic(IC[k] || "star", false);

  // ───── 11-22：說明依星數更新（時態之劍 ★★★ 原本仍寫「持續 10 秒」）。基本說明裡會變的那一段換成目前星數的數值，另起一行寫「目前 ★N」
  const STAR_FIX = {
    sword: [/持續 \d+ 秒/, st => st],
    amulet: [/多 \d+ 秒/, st => st.replace(/^片語題/, "")],
    glove: [/多受 \d+% 傷害/, st => st],
    cloak: [/倒下 \d+ 秒就復活/, st => "倒下 " + st.replace(/[^\d]/g, "") + " 秒就復活"],
    plate: [/傷害減半/, st => st.replace(/^傷害/, "傷害")],
    dagger: [/攻擊速度加倍/, st => "攻擊速度" + st.replace(/^攻速/, "")]
  };
  function descFor(id, lv) {
    const g = TG.GEAR[id]; if (!g) return "";
    const st = lv >= 2 ? (g.star || [])[lv - 2] : "";
    if (!st) return esc(g.desc);
    const fx = STAR_FIX[id]; let d = g.desc;
    if (fx && fx[0].test(d)) d = d.replace(fx[0], fx[1](st));
    return esc(d) + '<br><b style="color:#F3D494">目前 ' + "★".repeat(lv) + "：" + esc(st) + "</b>";
  }
  // ───── 11-22：建議裝備。同一格有「更強」的已打造裝備沒裝上（或格子空著）就標示。強弱＝打造價 × 星數（越貴、星越多越強）
  const power = (d, id) => (TG.GEAR[id] ? TG.GEAR[id].cost * Math.max(1, TG.gearLv(d, id)) : 0);
  function recommend(d) {
    const out = {};
    for (const sl of TG.GEAR_SLOTS) {
      const cur = d.eq[sl.id] && d.owned[d.eq[sl.id]] ? d.eq[sl.id] : null;
      let best = null;
      for (const id of Object.keys(TG.GEAR)) if (TG.GEAR[id].slot === sl.id && d.owned[id] && (!best || power(d, id) > power(d, best))) best = id;
      if (best && best !== cur && (!cur || power(d, best) > power(d, cur))) out[sl.id] = best;
    }
    return out;
  }

  // ───── 樣式（只作用在本外掛的 class）
  const css = document.createElement("style");
  css.textContent = `
.gq-wrap{width:100%;max-width:640px;display:flex;flex-direction:column;gap:12px;text-align:left}
.gq-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.gq-head h2{font-size:22px;display:flex;align-items:center;gap:8px}
.gq-head h2 svg{width:26px;height:26px}
.gq-pill{display:inline-flex;align-items:center;gap:4px;background:#111a2a;border:1px solid #E1B86A;color:#F3D494;border-radius:20px;padding:5px 12px;font-weight:800;font-size:14px;white-space:nowrap}
.gq-pill svg{width:18px;height:18px}
.gq-help{font-size:13px;color:var(--sub);line-height:1.6;background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:12px;padding:8px 12px}
.gq-help svg{width:15px;height:15px;vertical-align:-2px}
.gq-help b{color:#F3D494}
.gq-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.gq-slot{background:radial-gradient(circle at 50% 40%,#22344a,#111a2a);border-radius:12px;padding:8px 4px;text-align:center;font-size:12px;color:var(--sub);border:1px dashed #4b6478}
.gq-slot.on{border:1px solid #E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.4),0 0 12px rgba(225,184,106,.25)}
.gq-slot b{display:flex;justify-content:center;align-items:center;height:38px}
.gq-slot b svg{width:34px;height:34px}
.gq-slot:not(.on) b svg{opacity:.3;filter:grayscale(1)}
.gq-slot span{display:block;color:var(--ink);font-size:13px;font-weight:700;word-break:keep-all;overflow-wrap:anywhere}
.gq-sec{font-size:16px;font-weight:900;color:#F3D494;margin:6px 0 -4px;font-family:var(--serif);display:flex;align-items:center;gap:6px}
.gq-sec svg{width:24px;height:24px;flex:none}
.gq-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:8px}
.gq-item{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;box-shadow:inset 0 0 0 1px rgba(225,184,106,.14),0 3px 10px #0006;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.gq-item.on{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.5),0 0 14px rgba(225,184,106,.25)}
.gq-item.lock{opacity:.6}
.gq-item h5{margin:0;font-size:15px;display:flex;gap:6px;align-items:center}
.gq-item h5{font-family:var(--serif);font-weight:900;color:#F3D494}
.gq-item h5 i{font-style:normal;width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:9px;background:radial-gradient(circle at 50% 40%,#2f4868,#121c2e);border:1px solid #3a5068}
.gq-item h5 i svg{width:26px;height:26px}
.gq-item.lock h5 i svg{filter:grayscale(1);opacity:.6}
.gq-item h5 small{color:#F3D494;font-size:13px;letter-spacing:1px;text-shadow:0 0 6px rgba(243,212,148,.5)}
.gq-item .d{font-size:13px;color:var(--sub);line-height:1.5;flex:1}
.gq-req{font-size:12px;color:var(--sub);line-height:1.5}
.gq-req.ok{color:var(--ok)}
.gq-item button{border:1px solid #4b6478;border-radius:10px;padding:10px;font-weight:800;background:linear-gradient(#26384f,#172539);min-height:44px;font-size:14px;display:inline-flex;align-items:center;justify-content:center;gap:4px}
.gq-item button svg{width:16px;height:16px}
.gq-item button.main{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;border-color:#8a6a3a}
.gq-item button:disabled{opacity:.45}
.gq-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,136px),1fr));gap:6px}
.gq-badge{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:10px;padding:7px 8px;font-size:12px;color:var(--sub);display:flex;gap:8px;align-items:center}
.gq-badge>b{display:flex;filter:grayscale(1);opacity:.4}
.gq-badge>b svg{width:26px;height:26px}
.gq-badge.got{border-color:#8a6a3a}
.gq-badge.got>b{filter:none;opacity:1}
.gq-badge div{flex:1;min-width:0}
.gq-badge strong{color:var(--ink);font-size:13px;display:block;line-height:1.3}
.gq-bar{height:5px;background:#ffffff1a;border-radius:3px;overflow:hidden;margin-top:3px}
.gq-tier{display:inline-block;font-style:normal;font-size:11px;font-weight:900;color:#2a1d08;border-radius:7px;padding:0 6px;margin-left:5px;vertical-align:1px}
.gq-bar i{display:block;height:100%;background:var(--ok)}
.gq-foot{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding-bottom:8px}
.gq-brief{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.gq-brief button{border:1px solid #4b6478;background:linear-gradient(#26384f,#172539);color:var(--ink);border-radius:10px;padding:8px 12px;font-size:13px;font-weight:800;min-height:44px;display:inline-flex;align-items:center;gap:5px}
.gq-brief button svg{width:18px;height:18px}
.gq-rec{display:inline-block;font-style:normal;font-size:11px;font-weight:900;color:#2a1d08;background:linear-gradient(#ffe9a8,#E1B86A);border-radius:8px;padding:1px 7px;margin-left:auto;font-family:system-ui,"Microsoft JhengHei",sans-serif;letter-spacing:0;text-shadow:none;animation:gqRec 1.6s ease-in-out infinite}
.gq-slot .gq-rec{display:block;margin:4px auto 0;width:max-content;max-width:100%;white-space:normal}
.gq-item.rec,.gq-slot.rec{border-color:#ffd75e;box-shadow:inset 0 0 0 1px rgba(255,215,94,.6),0 0 16px rgba(255,215,94,.35)}
@keyframes gqRec{50%{filter:brightness(1.25)}}
@media (prefers-reduced-motion:reduce){.gq-rec{animation:none}}
.gq-lo{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}.gq-lo span{display:inline-flex;align-items:center;gap:3px}.gq-lo svg{width:18px;height:18px}
.gq-sec3{margin-top:14px;padding-top:12px;border-top:1px solid #3a4f6e}
.gq-sec3 svg{filter:drop-shadow(0 0 6px rgba(243,212,148,.55))}
.gq-item.t3{background:radial-gradient(circle at 85% 0%,rgba(158,140,255,.16),transparent 55%),linear-gradient(#1c2746,#131b33);border-color:#4a4f86;box-shadow:inset 0 0 0 1px rgba(180,170,255,.16),0 3px 12px #0007}
.gq-item.t3.on{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.5),0 0 16px rgba(190,170,255,.3)}
.gq-item.t3 h5 i{background:radial-gradient(circle at 50% 40%,#3d3f78,#161a36);border-color:#5a5c9a}
.gq-item.dim{opacity:.58;filter:saturate(.35)}
.gq-t3{margin-left:auto;font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:11px;font-weight:900;color:#d8d2ff;border:1px solid #6a6aa8;border-radius:8px;padding:1px 7px;white-space:nowrap;letter-spacing:0}
.gq-item.dim .gq-t3{color:#cfd6e2;border-color:#56698a}
.gq-sbar i{background:linear-gradient(90deg,#9e8cff,#F3D494)}
@media (min-width:900px){.gq-wrap{max-width:900px}.gq-list{grid-template-columns:repeat(3,1fr)}.gq-badges{grid-template-columns:repeat(4,1fr)}}`;
  document.head.appendChild(css);

  // ───── 全畫面
  const ov = document.createElement("div");
  ov.className = "ov hide"; ov.id = "ovGearMod";
  document.getElementById("app").appendChild(ov);
  let back = null, resetArm = false;   // back：null＝主選單；否則是關卡（回簡報）
  function close() {
    ov.classList.add("hide"); resetArm = false;
    if (back) U.openBrief(back); else { U.show("ovMenu"); U.menuInfo(); }
  }
  function open(kind, from) {
    back = from || null; resetArm = false;
    U.show(null); ov.classList.remove("hide"); ov.dataset.kind = kind;
    render(); ov.scrollTop = 0;
  }
  function render() { if (ov.dataset.kind === "talent") renderTalent(); else renderGear(); }
  const foot = () => '<div class="gq-foot"><button class="big ghost" data-gq="back">' + U.uic("back", false) + (back ? "回關卡簡報" : "回主選單") + '</button>' +
    '<button class="big ghost" data-gq="' + (ov.dataset.kind === "talent" ? "toGear" : "toTalent") + '">' + (ov.dataset.kind === "talent" ? U.uic("bag", false) + "去看裝備" : U.uic("talent", false) + "去看天賦") + '</button></div>';

  function renderGear() {
    const d = D(), rec = recommend(d);
    const slots = TG.GEAR_SLOTS.map(sl => { const id = d.eq[sl.id], g = id && TG.GEAR[id];
      return '<div class="gq-slot' + (g ? ' on' : '') + (rec[sl.id] ? ' rec' : '') + '">' + sl.name + '<b>' + ic(g ? id : sl.id) + '</b><span>' + (g ? esc(g.name) : '空著') + '</span>' +
        (rec[sl.id] ? '<em class="gq-rec">建議換：' + esc(TG.GEAR[rec[sl.id]].name) + '</em>' : '') + '</div>'; }).join("");
    let list = "";
    for (const sl of TG.GEAR_SLOTS) {
      list += '<div class="gq-sec">' + ic(sl.id) + sl.name + '</div><div class="gq-list">';
      for (const [id, g] of Object.entries(TG.GEAR)) {
        if (g.slot !== sl.id) continue;
        const own = !!d.owned[id], on = d.eq[sl.id] === id, reqOk = TG.gearReqOk(d, id);
        const req = g.req ? '<div class="gq-req' + (reqOk ? ' ok' : '') + '">' + (reqOk ? '✔ ' : '') + '需要徽章：' + esc(g.reqText || g.req.map(badgeName).join("、")) + '（任一個）</div>' : '<div class="gq-req ok">不需要徽章</div>';
        let btn;
        if (on) btn = '<button data-gq="off" data-slot="' + sl.id + '">' + U.uic("check", false) + '已裝上（點一下卸下）</button>';
        else if (own) btn = '<button class="main" data-gq="on" data-id="' + id + '">裝上</button>';
        else btn = '<button class="main" data-gq="craft" data-id="' + id + '"' + (TG.gearCanCraft(d, id) ? '' : ' disabled') + '>' + U.uic("hammer", false) + '打造 ' + U.uic("gem", false) + g.cost + '</button>';
        // 升星（11-21 第二刀 P2-14，機制端加：碎片用途）：已打造的裝備可升 ★2、★3
        const glv = TG.gearLv(d, id), star = !own ? '' : glv < TG.GEAR_STAR_MAX ? '<div class="gq-req">下一星：' + esc(g.star[glv - 1] || "") + '</div><button data-gq="star" data-id="' + id + '"' + (TG.gearCanStar(d, id) ? '' : ' disabled') + '>升到 ★' + (glv + 1) + ' ' + U.uic("gem", false) + TG.gearStarCost(id, glv) + '</button>' : '<div class="gq-req ok">★★★ 已滿星</div>';
        const isRec = rec[sl.id] === id;
        if (isRec) btn = '<button class="main" data-gq="on" data-id="' + id + '">裝上（建議）</button>';
        list += '<div class="gq-item' + (on ? ' on' : '') + (isRec ? ' rec' : '') + (!own && !reqOk ? ' lock' : '') + '"><h5><i>' + ic(id) + '</i>' + esc(g.name) + (own ? ' <small>' + '★'.repeat(glv) + '</small>' : '') + (isRec ? '<span class="gq-rec">建議裝備</span>' : '') + '</h5><div class="d">' + descFor(id, own ? glv : 1) + '</div>' + (own ? '' : req) + btn + star + '</div>';
      }
      list += '</div>';
    }
    // v3 三階徽章：G01～G35；掌握度由 qkinds 計算（空殼時顯示舊的「最近 10 題」進度）
    const C = BCFG(), mOn = masteryOn(), keys = TG.BADGE_GPS || TG.BADGE_KEYS;
    let got = 0;
    const badges = keys.map(k => {
      const tier = TG.gearTier(d, k), h = d.hist[k] || [], n = h.reduce((a, b) => a + b, 0);
      if (tier) got++;
      let line, pct;
      if (mOn) {
        const M = Math.round(TG.masteryOf(d, k, Date.now()) || 0), cnt = Array.isArray(d.mast[k]) ? d.mast[k].length : 0;
        const next = tier >= 2 ? (C.gold ? 85 : 0) : tier >= 1 ? C.sM : C.bM;
        line = (cnt ? '掌握度 ' + M : '還沒練習') + (tier && cnt && (TG.badgeNeedsCare ? TG.badgeNeedsCare(d, k, Date.now()) : M < [0, C.bM, C.sM, 85][tier]) ? '・需要保養' : '') +
          (!next ? '' : tier === 0 ? '（銅牌要 ' + C.bM + '、答 ' + C.bN + ' 題）' : tier === 1 ? '（銀牌要 ' + C.sM + '、' + C.sK + ' 種題型）' : '（金牌要 85）');
        pct = next ? Math.min(100, Math.round(M / next * 100)) : 100;
      } else { line = tier ? '已取得' : h.length ? '最近 ' + h.length + ' 題對 ' + n + ' 題' : '還沒練習'; pct = tier ? 100 : Math.round(Math.min(n, TG.BADGE_NEED) / TG.BADGE_NEED * 100); }
      const tag = tier ? '<em class="gq-tier" style="background:' + TIER_CLR[tier] + '">' + TIER[tier] + '</em>' : '';
      return '<div class="gq-badge' + (tier ? ' got' : '') + '"><b' + (tier ? ' style="filter:drop-shadow(0 0 4px ' + TIER_CLR[tier] + ')"' : '') + '>' + U.uic("medal", false) + '</b><div><strong>' + esc(badgeName(k)) + tag + '</strong>' + line +
        ((tier >= 2 && !C.gold) || tier >= 3 ? '' : '<div class="gq-bar"><i style="width:' + pct + '%"></i></div>') + '</div></div>'; }).join("");
    const gem = U.uic("gem", false);
    const how = mOn ? '同一種文法練熟了拿徽章：<b>銅牌</b>（掌握度 ' + C.bM + '、至少答 ' + C.bN + ' 題）' + gem + TG.badgeTierShards(1) + '，<b>銀牌</b>（掌握度 ' + C.sM + '、答過 ' + C.sK + ' 種題型）' + gem + TG.badgeTierShards(2) +
        (C.gold ? '，<b>金牌</b>' + gem + TG.badgeTierShards(3) : '（金牌之後開放）') + '。掌握度只看第一次作答，已拿到的徽章不會收回。'
      : '同一種文法<b>最近 10 題答對 8 題</b>，就拿到那種文法的銅牌徽章＋' + gem + TG.badgeTierShards(1) + '。';
    ov.innerHTML = '<div class="gq-wrap"><div class="gq-head"><h2>' + U.uic("bag", false) + '文法騎士的裝備</h2><span class="gq-pill">' + gem + '碎片 ' + d.shards + '</span></div>' +
      '<div class="gq-help">碎片怎麼來：' + how + '過關每顆星 ' + gem + '1，第一次過關再 ' + gem + '2。有些裝備要先拿到指定徽章才能打造。<br><b>碎片也能升星</b>：打造好的裝備可以再升到 ★2、★3，效果更強（每件下面有寫下一星的效果）。</div>' +
      '<div class="gq-slots">' + slots + '</div>' + list +
      '<div class="gq-sec">' + U.uic("medal", false) + '文法徽章（' + got + '／' + keys.length + '）</div><div class="gq-badges">' + badges + '</div>' + foot() + '</div>';
  }

  function renderTalent() {
    const { d } = DT(), tot = stars(), avail = TG.talentAvail(d.talents, tot), spent = TG.talentSpent(d.talents);
    const card = (id, t) => {
      const own = !!d.talents[id], parentOk = t.tier === 1 || !!d.talents[t.need], open = TG.talentOpen(id, tot), need = t.minStars || 0;
      let btn;
      if (own) btn = '<button disabled>' + U.uic("check", false) + '已學會</button>';
      else if (!open) btn = '<button disabled>' + U.uic("lock", false) + '需要 ★' + need + '</button>';
      else if (!parentOk) btn = '<button disabled>' + U.uic("lock", false) + '先學「' + esc(TG.TALENTS[t.need].name) + '」</button>';
      else btn = '<button class="main" data-gq="learn" data-id="' + id + '"' + (avail >= t.cost ? '' : ' disabled') + '>學習 ★' + t.cost + '</button>';
      let req = "";
      if (t.tier === 2) req = '<div class="gq-req' + (parentOk ? ' ok' : '') + '">需要：' + esc(TG.TALENTS[t.need].name) + '</div>';
      if (t.tier === 3) req = '<div class="gq-req' + (parentOk ? ' ok' : '') + '">' + (parentOk ? '✔ ' : '') + '需要：' + esc(TG.TALENTS[t.need].name) + '</div>' +
        '<div class="gq-req' + (open ? ' ok' : '') + '">' + (open ? '✔ 累積 ★' + need + ' 已達成' : '累積星星 ' + tot + '／' + need) +
        (open ? '' : '<div class="gq-bar gq-sbar"><i style="width:' + Math.round(Math.min(1, tot / Math.max(1, need)) * 100) + '%"></i></div>') + '</div>';
      const lock = !own && (!parentOk || !open);
      return '<div class="gq-item' + (t.tier === 3 ? ' t3' : '') + (own ? ' on' : '') + (lock ? ' lock' : '') + (t.tier === 3 && !open ? ' dim' : '') + '"><h5><i>' + ic(id) + '</i>' + esc(t.name) +
        (t.tier === 3 ? '<span class="gq-t3">' + (open ? '高階・★' + t.cost : '需要 ★' + need) + '</span>' : '') + '</h5><div class="d">' + esc(t.desc) + '</div>' + req + btn + '</div>';
    };
    const tier = n => Object.entries(TG.TALENTS).filter(([, t]) => t.tier === n).map(([id, t]) => card(id, t)).join("");
    const t3 = Object.values(TG.TALENTS).filter(t => t.tier === 3), t3min = Math.min(...t3.map(t => t.minStars || 0)), all = TG.talentSpent(Object.fromEntries(Object.keys(TG.TALENTS).map(k => [k, 1])));
    ov.innerHTML = '<div class="gq-wrap"><div class="gq-head"><h2>' + U.uic("talent", false) + '星星天賦</h2><span class="gq-pill">' + U.uic("star", false) + '可用 ' + avail + '（共 ' + tot + '）</span></div>' +
      '<div class="gq-help">每一關拿到的最高星數加起來，就是天賦點數。天賦永久有效，可以隨時重置、把星星全部拿回來重新分配。</div>' +
      '<div class="gq-sec">第 1 層</div><div class="gq-list">' + tier(1) + '</div>' +
      '<div class="gq-sec">第 2 層（要先學上面那一個）</div><div class="gq-list">' + tier(2) + '</div>' +
      (t3.length ? '<div class="gq-sec gq-sec3">' + U.uic("crown", false) + '第 3 層・高階天賦</div>' +
        '<div class="gq-help">累積星星到 <b>★' + t3min + '</b> 起陸續開放，還要先學對應的第 2 層。全部天賦學滿要 <b>★' + all + '</b>（' + TG.STAGES.length + ' 關全三星）。' +
        (tot < t3min ? '<br>目前累積 ★' + tot + '，再拿 ★' + (t3min - tot) + ' 就開放第一個。' : '') + '</div>' +
        '<div class="gq-list gq-list3">' + tier(3) + '</div>' : '') +
      '<div class="gq-foot"><button class="big ghost" data-gq="reset"' + (spent ? '' : ' disabled') + '>' + (resetArm ? '再按一次確認重置' : U.uic("retry", false) + '重置天賦（退回 ★' + spent + '）') + '</button></div>' + foot() + '</div>';
  }

  ov.addEventListener("click", ev => {
    const b = ev.target.closest("[data-gq]"); if (!b || b.disabled) return;
    const d = D(), a = b.dataset.gq, id = b.dataset.id;
    if (a === "back") return close();
    if (a === "toGear") { ov.dataset.kind = "gear"; render(); ov.scrollTop = 0; return; }
    if (a === "toTalent") { ov.dataset.kind = "talent"; render(); ov.scrollTop = 0; return; }
    if (a === "craft" && TG.gearCraft(d, id)) { U.toast("打造完成：" + TG.GEAR[id].name); U.beep(880, .2, "triangle", .05); }
    if (a === "star" && TG.gearStar(d, id)) { U.toast(TG.GEAR[id].name + " 升到 ★" + TG.gearLv(d, id)); U.beep(1100, .2, "triangle", .05); }
    if (a === "on") TG.gearEquip(d, id);
    if (a === "off") TG.gearUnequip(d, b.dataset.slot);
    if (a === "learn" && TG.talentLearn(d.talents, id, stars())) { U.toast("學會天賦：" + TG.TALENTS[id].name); U.beep(990, .2, "sine", .05); }
    if (a === "reset") { if (!resetArm) { resetArm = true; render(); return; } const n = TG.talentReset(d.talents); resetArm = false; U.toast("已退回 ★" + n); }
    else resetArm = false;
    U.save(); const y = ov.scrollTop; render(); ov.scrollTop = y;
  });

  // ───── 主選單按鈕
  // unlockAt：過幾關後主選單才出現（11-21 試玩 P3-17：新手一進來 8 個入口太多）
  const GEAR_AT = 2, TALENT_AT = 3;
  const hasRec = () => { try { return Object.keys(recommend(D())).length > 0; } catch (e) { return false; } };
  U.add("menu", { label: () => "裝備" + (hasRec() ? "（建議換裝）" : D().shards ? "（碎片 " + D().shards + "）" : ""), icon: "bag", onClick: () => open("gear"), unlockAt: GEAR_AT });
  U.add("menu", { label: () => { const a = TG.talentAvail(DT().d.talents, stars()); return "天賦" + (a > 0 ? "（可用 ★" + a + "）" : ""); }, icon: "talent", onClick: () => open("talent"), unlockAt: TALENT_AT });

  // ───── 關卡簡報：一行顯示目前裝備與天賦
  const loadoutText = () => {
    const d = D(), eq = TG.gearEquipped(d).map(id => '<span>' + ic(id) + esc(TG.GEAR[id].name) + '</span>');
    const tl = TG.talentValid(DT().d.talents, stars()).map(id => '<span>' + ic(id) + esc(TG.TALENTS[id].name) + '</span>');
    return { eq, tl };
  };
  U.add("brief", st => {
    if (U.cleared() < GEAR_AT) return "";   // 新手關卡簡報不放裝備天賦卡
    const { eq, tl } = loadoutText();
    return '<div class="card"><h4>' + U.uic("bag", false) + '裝備與天賦</h4><div class="gq-lo">裝備：' + (eq.length ? eq.join("") : "還沒有（去「裝備」用碎片打造）") +
      '</div><div class="gq-lo">天賦：' + (tl.length ? tl.join("") : "還沒學（去「天賦」用星星學）") +
      '</div><div class="gq-brief"><button id="gqBriefGear">' + U.uic("bag", false) + (hasRec() ? '換裝備 <span class="gq-rec">有建議</span>' : '換裝備') + '</button><button id="gqBriefTal">' + U.uic("talent", false) + '天賦</button></div></div>';
  });
  U.add("briefBind", (st, el) => {
    const a = el.querySelector("#gqBriefGear"), b = el.querySelector("#gqBriefTal");
    if (a) a.onclick = () => open("gear", st);
    if (b) b.onclick = () => open("talent", st);
  });

  // ───── 開局：把裝備與天賦交給引擎
  U.add("opts", (opts, st) => {
    const d = D();
    opts.gear = TG.gearEquipped(d);
    opts.gearLv = TG.gearLevels(d);   // 裝備星數（升星，11-21 第二刀）
    opts.talents = TG.talentValid(DT().d.talents, stars());
    return opts;
  });
  U.add("start", (G, run) => {
    G._gUI = true;                                   // 時態之劍改看真的題目（answer 掛勾）
    G._gStats = { sword: 0, amulet: 0, guard: 0, badge: 0 };   // 測試用統計
    run._gPrev = G.stage ? ((U.S.prog[G.stage.i] || {}).stars || 0) : 0;
    run._gNew = []; run._gSwordTold = false;
  });

  // ───── 作答：三階徽章（掌握度 mast／btier／bday，合約 §8.4）、時態之劍
  //   ok＝學習紀錄的對錯（第二次機會才答對＝錯）；info＝合約 §3.2（qk、try、sec…）
  U.add("answer", (q, ok, kind, G, run, info) => {
    const d = D(), r = TG.gearRecord(d, q, ok, info || null);
    if (r && r.badge) {
      U.toast("🏅 拿到「" + badgeName(r.gp || r.key) + "」" + TIER[r.tier] + "牌徽章！碎片 +" + r.shards);
      U.beep(1320, .3, "triangle", .05);
      if (run && run._gNew && !run._gNew.includes((r.gp || r.key) + "|" + r.tier)) run._gNew.push((r.gp || r.key) + "|" + r.tier);   // 第二輪 P2：同一個徽章同一關只記一次（結算原本出現兩行）
      if (G && G._gStats) G._gStats.badge++;
    }
    if (ok && G && q && TG.GEAR_TENSE.includes(q.gp) && TG.gearTense(G)) {
      const h = G.heroes.find(x => x.id === "knight");
      if (h) U.fx("⚔️ 攻擊 ×2", h.x, h.y - 6, "#ffd75e");
    }
  });
  // 片語護符：片語題 +5 秒
  U.add("qtime", (sec, q, o) => {
    const G = U.G;
    if (G && G.gearOn && G.gearOn.amulet && q && (q.t === "p" || q.gp === "G14")) { if (G._gStats) G._gStats.amulet++; sec += TG.gearAmuletSec(G); }
    // 第 3 層「大招專注」：騎士的詠唱題（src "chant"）多 3 秒；舊的答題大招（src "ult"）相容。v3 看出題入口 o.src，不再比對標題字串
    //   （這條只管舊的 askQuestion 出題；側邊面板 qpanel 開著時由下方 qbus push 掛勾加秒，不會重複）
    if (G && G.talentsOn && G.talentsOn.focus && o && (o.src === "chant" || o.src === "ult") && !(U.qpanel && U.qpanel.enabled)) { if (G._gStats) G._gStats.focusQ = (G._gStats.focusQ || 0) + 1; sec += TG.T3.focusSec; }
    return sec;
  });
  // 大招專注（側邊面板出題時）：詠唱題排進 qbus 的那一刻把倒數加 3 秒（qpanel 讀 item.deadline；qpanel 關著時走上面的 qtime）
  if (U.qbus && typeof U.qbus.on === "function") U.qbus.on("push", it => {
    const G = U.G;
    if (!it || it.src !== "chant" || !(U.qpanel && U.qpanel.enabled) || !(G && G.talentsOn && G.talentsOn.focus) || !(it.deadline > 0) || it._gFocus) return;
    it._gFocus = true; it.deadline += TG.T3.focusSec; if (G._gStats) G._gStats.focusQ = (G._gStats.focusQ || 0) + 1;
  });
  U.add("event", (ev, G, run) => {
    const stat = { gearSword: "sword", gearGuard: "guard" }[ev.k];
    if (stat && G._gStats) G._gStats[stat]++;
    if (ev.k === "gearSword" && run && !run._gSwordTold) { run._gSwordTold = true; U.toast("⚔️ 時態之劍發光！英雄攻擊 ×2，" + Math.round(G.gSwordT || 10) + " 秒"); }
    if (ev.k === "gearGuard") U.toast("✨ 守護結界擋下了一隻怪，不扣命！");
    // 第 3 層天賦的提示
    if (ev.k === "talentNotes") { U.toast("📝 復仇筆記：答對之前的錯題，" + (ev.gold ? "能量已滿，改拿 " + ev.gold + " 金幣" : "能量 +" + ev.gain)); try { U.renderBar(); } catch (e) {} }
    if (ev.k === "talentFocus") U.fx(ev.gap ? "專注！下一招提早 " + ev.gap + " 秒" : "專注！冷卻 −20%", ev.x, ev.y - 10, "#cfc6ff");
    if (ev.k === "talentLearn" && ev.gain > 0) { const h = G.heroes && G.heroes[0]; if (h) U.fx("錯中學 能量 +" + ev.gain, h.x, h.y - 18, "#9fe0ff"); try { U.renderBar(); } catch (e) {} }
    if (ev.k === "talentChain" && ev.e) U.fx("連破！+" + ev.gold, ev.e.x, ev.e.y - 8, "#7cc8ff");
    if (ev.k === "talentQuake") U.fx(ev.n ? "震波 ×" + ev.n : "震波", ev.x, ev.y - 12, "#ffb070");
    if (ev.k === "talentReso") { U.toast("🔆 八連共鳴：連對 " + ev.n + " 題，能量 +" + ev.gain + "！"); try { U.renderBar(); } catch (e) {} }
  });
  // 時態之劍發光時，騎士身上畫金色光圈
  U.add("drawTop", (ctx, G) => {
    if (!(G.gSwordT > 0)) return;
    const h = G.heroes.find(x => x.id === "knight"); if (!h || h.dead > 0) return;
    ctx.save(); ctx.strokeStyle = "#ffd75e"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(G.time * 10);
    ctx.beginPath(); ctx.arc(h.x, h.y, 16, 0, 7); ctx.stroke(); ctx.restore();
  });

  // ───── 結算：碎片
  U.add("end", (G, run, won) => {
    const d = D(), out = [];
    let n = 0, why = "";
    if (G.stage) {
      if (won) { const s = TG.starsFor(G.lives), first = !run._gPrev; n = TG.gearStageShards(s, first); why = s + " 星" + (first ? "＋第一次過關" : ""); }
      else if (run.qRight >= 3) { n = 1; why = "努力獎"; }
    } else { n = Math.floor(G.wave / 5); why = "撐到第 " + G.wave + " 波"; }
    if (n > 0) { d.shards += n; out.push("碎片 +" + n + "（" + why + "）"); }
    for (const k of [...new Set(run._gNew || [])]) { const [g, t] = k.split("|"); out.push("新徽章：" + badgeName(g) + (t ? "（" + TIER[+t] + "牌）" : "")); }
    const can = Object.keys(TG.GEAR).filter(id => TG.gearCanCraft(d, id));
    if (can.length) out.push("可以打造：" + can.map(id => TG.GEAR[id].name).join("、"));
    return out;
  });

  // ───── 測試機器人（test/browser/bot.js 會呼叫）
  window.TGBOT = (window.TGBOT || []).concat((T, G) => {
    if (!ov.classList.contains("hide")) { ov.classList.add("hide"); return true; }   // 不該在戰鬥中出現；保險
    if (G && !G._gBot) {
      G._gBot = true;
      // 機器人存檔裡沒有裝備時，比照 node 模擬給一套中階裝備與天賦（才測得到效果）
      if (!Object.keys(G.gearOn || {}).length && !Object.keys(G.talentsOn || {}).length) {
        const cleared = G.stage ? G.stage.i : 8, lo = TG.gearBotLoadout(cleared);
        // 第 14 關起比照完美打法（每關 3 星）帶上學得起的第 3 層天賦，瀏覽器實戰才測得到（node 模擬的一般／高手機器人不帶，平衡不變）
        if (cleared >= 13) { const own = Object.fromEntries(lo.talents.map(x => [x, 1])); for (const id of Object.keys(TG.TALENTS)) if (TG.TALENTS[id].tier === 3) TG.talentLearn(own, id, cleared * 3); lo.talents = Object.keys(own); }
        // 片語關或飾品格空著：改帶片語護符（測得到 qtime）
        if (G.stage && (G.stage.gps.includes("G14") || !lo.gear.some(id => TG.GEAR[id].slot === "acc"))) lo.gear = lo.gear.filter(id => TG.GEAR[id].slot !== "acc").concat("amulet");
        TG.gearSetup(G, lo);
      }
    }
    return false;
  });

  U.menuInfo();
})();
