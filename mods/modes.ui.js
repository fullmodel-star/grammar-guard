// 外掛：modes（畫面端，只在瀏覽器載入）— 鐵人挑戰、每日一關、難度自動調整、學習報告
// 存檔：TGUI.S.mods.modes = { iron:{關卡序號:1}, acc:{文法點:{n,r,h}}, daily:{plan,last,streak,best} }
(function () {
  if (!window.TGUI || !window.TG || !TG.dailyPlan) return;
  const U = window.TGUI, esc = U.esc;
  const D = () => { const m = U.S.mods || (U.S.mods = {}); return (m.modes = TG.modesData(m.modes)); };
  const GPS = typeof QDB_GP !== "undefined" ? QDB_GP : (window.QDB_GP || {});
  const keyName = k => (GPS[k] ? GPS[k].name : /^O\d$/.test(k) ? "綜合題・第 " + k.slice(1) + " 級" : k);
  const today = () => TG.dayKey(new Date());
  const fmtDay = k => k.slice(0, 4) + "/" + k.slice(4, 6) + "/" + k.slice(6, 8);
  // 待開局設定（鐵人開關）：簡報開啟時清空；「再玩一次」沿用（同一關）。每日一關改走 startStage 的 extra
  let pending = { st: -1, iron: false, daily: null };
  // 第二刀：每日規則與標題改用自繪圖示（TGUI.uic）
  const RULE_IC = { fast: "wind", tough: "rock", cheap: "hammer", energy: "bolt", rich: "coin" };
  const ic = k => U.uic(k, false);

  // ───── 樣式（只作用在 mm- 開頭的 class）
  const css = document.createElement("style");
  css.textContent = `
.mm-wrap{width:100%;max-width:640px;display:flex;flex-direction:column;gap:12px;text-align:left}
.mm-wrap h2{font-size:22px;display:flex;align-items:center;justify-content:center;gap:8px}
.mm-wrap h2 svg{width:28px;height:28px}
.mm-help{font-size:13px;color:var(--sub);line-height:1.6;background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:12px;padding:8px 12px}
.mm-help b{color:#F3D494}
.mm-big{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;box-shadow:inset 0 0 0 1px rgba(225,184,106,.16),0 4px 12px #0006;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}
.mm-big.parch{background:radial-gradient(120% 140% at 50% 30%,#f3e6c6,#dcc697 72%,#c8ad78);border-color:#8a6a3a;color:#3a2a14}
.mm-big.parch .mm-sub{color:#6a5330!important}
.mm-big .t{font-size:20px;font-weight:900;font-family:var(--serif);display:flex;align-items:center;gap:8px}
.mm-big .t small{font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;font-weight:800;background:#1B3545;color:#F3D494;border-radius:5px;padding:1px 7px}
.mm-big svg{width:20px;height:20px;vertical-align:-4px}
.mm-rules{display:flex;flex-wrap:wrap;gap:6px}
.mm-rule{display:inline-flex;align-items:center;gap:5px;background:#1B3545;color:#eef2fa;border:1px solid #4b6478;border-radius:20px;padding:5px 12px 5px 8px;font-size:14px;font-weight:800}
.mm-rule.hard{background:#4a2230;border-color:#a3593a}
.mm-sec{font-weight:900;color:#F3D494;font-family:var(--serif);display:flex;align-items:center;gap:6px}
.mm-sec svg{width:20px;height:20px}
.mm-streak{display:flex;align-items:center;gap:8px;font-size:15px}.mm-streak b{font-size:22px;color:#F3D494}.mm-streak svg{width:28px;height:28px}
.mm-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding-bottom:8px}
.mm-bars{display:flex;flex-direction:column;gap:7px}
.mm-bar{display:grid;grid-template-columns:minmax(0,9.5em) 1fr 3.2em;gap:8px;align-items:center;font-size:13px}
.mm-bar .n{overflow-wrap:anywhere;line-height:1.3}
.mm-bar .n small{display:block;color:var(--sub);font-size:11px}
.mm-bar .b{height:14px;background:#ffffff14;border-radius:7px;overflow:hidden}
.mm-bar .b i{display:block;height:100%;border-radius:7px}
.mm-bar .p{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.mm-bar.none{opacity:.5}
.mm-wb{display:flex;align-items:center;gap:8px;width:100%;min-height:48px;border:1px solid #a3593a;border-radius:12px;background:linear-gradient(#2a2433,#1b1826);color:#ffd2b0;padding:8px 12px;text-align:left;font-size:14px;font-weight:700;cursor:pointer}
.mm-wb span{flex:1}.mm-wb i{font-style:normal;font-size:20px}.mm-wb svg{width:22px;height:22px}
.mm-sug{display:grid;gap:8px}
.mm-sug button{border:1px solid #4b6478;border-radius:12px;background:linear-gradient(#22344a,#152336);color:var(--ink);padding:10px 12px;text-align:left;font-size:14px;font-weight:700;line-height:1.5;min-height:44px}
.mm-sug button svg{width:16px;height:16px;vertical-align:-3px}
.mm-sug button small{display:block;color:var(--sub);font-size:12px}
.mm-legend{font-size:12px;color:var(--sub);display:flex;gap:12px;flex-wrap:wrap}
.mm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
@media (min-width:900px){.mm-wrap{max-width:760px}.mm-bar{grid-template-columns:14em 1fr 3.5em}}`;
  document.head.appendChild(css);
  const color = r => (r < 0.6 ? "var(--bad)" : r > 0.9 ? "var(--ok)" : "var(--gold)");

  // ───── 全畫面（每日一關／學習報告）
  const ov = document.createElement("div");
  ov.className = "ov hide"; ov.id = "ovModesMod";
  document.getElementById("app").appendChild(ov);
  function open(kind) { U.show(null); ov.classList.remove("hide"); ov.dataset.kind = kind; render(); ov.scrollTop = 0; }
  function close() { ov.classList.add("hide"); U.show("ovMenu"); U.menuInfo(); }
  U.openReport = () => open("report");   // 錯題本「回學習報告」用（mods/flow.ui.js）
  function render() { if (ov.dataset.kind === "report") renderReport(); else renderDaily(); }

  function todayPlan() {
    const d = D(), k = today();
    if (!d.daily.plan || d.daily.plan.date !== k || !TG.STAGES[d.daily.plan.stage]) { d.daily.plan = TG.dailyPlan(k, TG.unlockedStages(U.S.prog)); U.save(); }
    return d.daily.plan;
  }
  function renderDaily() {
    const d = D(), p = todayPlan(), st = TG.STAGES[p.stage], got = d.daily.last === p.date;
    const rw = TG.dailyReward(d.daily.last === TG.prevDayKey(p.date) ? d.daily.streak + 1 : 1);
    const rules = p.rules.map(k => { const r = TG.DAILY_RULES[k]; return '<span class="mm-rule' + (r.hard ? ' hard' : '') + '">' + ic(RULE_IC[k] || "star") + esc(r.name) + '</span>'; }).join("");
    ov.innerHTML = '<div class="mm-wrap"><h2>' + ic("cal") + '每日一關</h2>' +
      '<div class="mm-big parch"><div class="mm-sub" style="font-size:13px">' + fmtDay(p.date) + '　每天換一關、怪物出場順序固定</div>' +
      '<div class="t"><small>第 ' + (st.r + 1) + ' 區・' + esc(TG.REGIONS[st.r].name) + '</small></div><div class="t">第 ' + (st.i + 1) + ' 關・' + esc(st.name) + '</div>' +
      '<div class="mm-sub" style="font-size:13px">今日規則</div><div class="mm-rules">' + rules + '</div></div>' +
      '<div class="mm-big"><div class="mm-streak">' + ic("flame") + '連續 <b>' + (d.daily.streak || 0) + '</b> 天<span style="color:var(--sub);font-size:13px">（最高 ' + (d.daily.best || 0) + ' 天）</span></div>' +
      (got ? '<div class="reward">' + ic("check") + ' 今天的獎勵領過了，明天再來！（還是可以再玩）</div>'
           : '<div>過關獎勵（本週第 ' + rw.day + ' 天）：英雄經驗 +' + rw.xp + '、召喚獸練習 +' + rw.petUses + ' 次' + (rw.shards ? '、碎片 +' + rw.shards : '') + (rw.milestone ? '（' + esc(rw.milestone) + '里程碑）' : '') + '<br><span style="color:var(--sub);font-size:13px">每天限領一次；連續天數越多經驗越多（最多 ' + TG.dailyXpCfg().max + '）；7 天一輪，第 7 天加碼送碎片；連續 7／14／30／60／100 天還有里程碑獎勵。</span></div>') + '</div>' +
      '<div class="mm-row"><button class="big ghost" data-mm="back">' + ic("back") + '回主選單</button><button class="big" data-mm="go">' + ic("swords") + '出征！</button></div></div>';
  }
  function startDaily() {
    const p = todayPlan(), st = TG.STAGES[p.stage];
    const daily = { date: p.date, seed: p.seed, rules: p.rules.slice() };
    ov.classList.add("hide");
    pending = { st: -1, iron: false, daily: null };
    // seed：index.html 每次開局都用它重建亂數；「再玩一次」會原樣帶回這份設定（run.extra），波次完全一樣
    U.startStage(st, { seed: p.seed, daily, heroic: false, allowTypes: null });   // 每日一關不帶英雄挑戰限制
  }

  // 11-24 UI/UX 流程 P1-4：學習報告第一區＝錯題本入口（mods/flow.ui.js 的 U.openWrongBook）；沒有 flow 外掛就列前 5 題文字
  function wbHtml() {
    const ids = Object.keys(U.S.wrongQ || {}).filter(k => U.S.wrongQ[k]), n = ids.length;
    if (typeof U.openWrongBook === "function")
      return '<div class="mm-sec">' + ic("book") + '錯題本</div><button class="mm-wb" data-mm="wrong">' + ic("book") + '<span>' + (n ? '待複習 <b>' + n + '</b> 題：打開錯題本，一題一題練' : '錯題本是空的，答錯的題目會收進這裡') + '</span><i>›</i></button>';
    if (!n || typeof QDB === "undefined") return "";
    const by = new Map(QDB.map(q => [q.id, q])), L = ids.map(id => by.get(id)).filter(Boolean).slice(0, 5);
    return '<div class="mm-sec">' + ic("book") + '錯題本（' + n + ' 題）</div><div class="mm-help">' + L.map(q => esc(q.q).replace("___", "<b>" + esc(q.o[0]) + "</b>")).join("<br>") + '</div>';
  }
  function renderReport() {
    const d = D();
    const multi = {};   // 有 2 種以上等級的文法點才會換題（只有一級的就不標）
    if (typeof QDB !== "undefined") { const lv = {}; for (const q of QDB) { const k = TG.accKey(q); (lv[k] = lv[k] || new Set()).add(q.lv); } for (const k in lv) multi[k] = lv[k].size > 1; }
    const keys = Object.keys(GPS).sort().concat([1, 2, 3, 4, 5].map(n => "O" + n));
    const bars = keys.map(k => {
      const a = d.acc[k], h = a ? a.h : [], r = h.length ? h.reduce((x, y) => x + y, 0) / h.length : null;
      const lv = multi[k] ? TG.accLevel(d, k) : 0, tag = lv < 0 ? "・會出簡單一點、多 5 秒" : lv > 0 ? "・會出難一點" : "";
      return '<div class="mm-bar' + (r === null ? ' none' : '') + '"><div class="n">' + esc(keyName(k)) + '<small>' + (h.length ? "最近 " + h.length + " 題" + tag : "還沒練習") + '</small></div>' +
        '<div class="b">' + (r === null ? '' : '<i style="width:' + Math.max(3, Math.round(r * 100)) + '%;background:' + color(r) + '"></i>') + '</div>' +
        '<div class="p">' + (r === null ? '—' : Math.round(r * 100) + '%') + '</div></div>';
    }).join("");
    const sug = TG.suggestStages(d, U.S.prog, 3);
    const sugHtml = sug.length ? '<div class="mm-sug">' + sug.map(x => { const st = TG.STAGES[x.i];
      return '<button data-mm="stage" data-st="' + st.i + '">' + ic("flag") + ' 第 ' + (st.i + 1) + ' 關・' + esc(st.name) + '<small>練「' + esc(keyName(x.k)) + '」（最近答對 ' + Math.round(x.r * 100) + '%）→ 點一下看關卡</small></button>'; }).join("") + '</div>'
      : '<div class="mm-help">目前沒有特別弱的文法（每種至少答 5 題才會判斷）。繼續挑戰新關卡吧！</div>';
    const tot = U.S.qTotal || 0, right = U.S.qRight || 0;
    ov.innerHTML = '<div class="mm-wrap"><h2>' + ic("chart") + '學習報告</h2>' +
      '<div class="mm-help">全部答題：' + right + '／' + tot + ' 題答對' + (tot ? '（' + Math.round(right * 100 / tot) + '%）' : '') + '。每種文法看<b>最近 20 題</b>。低於 60% 會自動出簡單一點的題、多給 5 秒；高於 90% 會出難一點的題。</div>' +
      wbHtml() +
      '<div class="mm-sec">' + ic("retry") + '建議重玩</div>' + sugHtml +
      '<div class="mm-sec" style="margin-top:4px">' + ic("chart") + '各種文法答對率</div>' +
      '<div class="mm-legend"><span><i style="background:var(--bad)"></i>低於 60%</span><span><i style="background:var(--gold)"></i>60～90%</span><span><i style="background:var(--ok)"></i>高於 90%</span></div>' +
      '<div class="mm-bars">' + bars + '</div>' +
      '<div class="mm-row"><button class="big ghost" data-mm="back">' + ic("back") + '回主選單</button></div></div>';
  }
  ov.addEventListener("click", ev => {
    const b = ev.target.closest("[data-mm]"); if (!b) return;
    const a = b.dataset.mm;
    if (a === "back") return close();
    if (a === "wrong") { if (U.openWrongBook) U.openWrongBook("report"); return; }
    if (a === "go") return startDaily();
    if (a === "stage") { ov.classList.add("hide"); U.openBrief(TG.STAGES[+b.dataset.st]); }
  });

  // ───── 主選單
  U.add("menu", { label: () => { const d = D(); return "每日一關" + (d.daily.last === today() ? "（今天已完成）" : d.daily.streak ? "（連續 " + d.daily.streak + " 天）" : ""); }, icon: "cal", onClick: () => open("daily"), unlockAt: 4 });
  U.add("menu", { label: () => "學習報告", icon: "chart", onClick: () => open("report"), unlockAt: 2 });   // unlockAt：過幾關後主選單才出現（11-21 試玩 P3-17）

  // ───── 簡報：鐵人挑戰開關
  U.add("brief", st => {
    const d = D(), badge = !!d.iron[st.i];
    if (!TG.ironOpen(U.S.prog, st.i)) return badge ? '<div class="card"><h4>' + ic("swords") + '鐵人徽章</h4>已取得</div>' : "";
    return '<div class="card"><h4>' + ic("swords") + '鐵人挑戰' + (badge ? '　<span class="reward">已取得鐵人徽章</span>' : '（三星後開放）') + '</h4>' +
      '<label><input type="checkbox" id="chkIron"> ' + esc(TG.IRON_RULE) + '</label></div>';
  });
  U.add("briefBind", (st, root) => {
    pending = { st: st.i, iron: false, daily: null };
    const ch = root.querySelector("#chkIron");
    if (ch) ch.onchange = () => { pending.iron = ch.checked; };
  });

  // ───── 開局
  U.add("opts", (opts, st) => {
    if (!st || pending.st !== st.i || opts.daily) return opts;
    if (pending.iron && TG.ironOpen(U.S.prog, st.i)) opts.iron = true;
    return opts;
  });
  // 世界地圖：拿過鐵人徽章的關卡標 ⚔️
  U.add("worldNode", st => (D().iron[st.i] ? '<span title="鐵人徽章">' + ic("swords") + '</span>' : ""));
  U.add("start", (G, run) => {
    const m = G.modes; if (!m) return;
    if (m.iron) setTimeout(() => { if (U.G === G && !G.over) U.toast("⚔️ 鐵人挑戰：" + TG.IRON_RULE); }, 1900);
    if (m.daily) setTimeout(() => { if (U.G === G && !G.over) U.toast("📅 每日一關：" + m.daily.rules.map(k => TG.DAILY_RULES[k].name).join("、")); }, 1900);
  });

  // ───── 難度自動調整
  U.add("answer", (q, ok) => { TG.accRecord(D(), q, ok); });
  U.add("qsrc", src => TG.adjustPool(src, D()));
  U.add("qtime", (sec, q) => sec + TG.accExtraTime(D(), q));

  // ───── 戰鬥中提示
  U.add("event", (ev, G) => {
    if (ev.k === "ironWrong") { U.toast(ev.n > ev.max ? "⚔️ 答錯 " + ev.n + " 題，超過可錯題數，鐵人挑戰結束" : "⚔️ 鐵人：答錯 " + ev.n + " 題（目前最多可錯 " + ev.max + " 題）"); }
  });
  U.add("drawTop", (ctx, G) => {
    const m = G.modes; if (!m || (!m.iron && !m.daily)) return;
    const acc = m.iron ? TG.ironAcc(m) : null;
    const t = (m.iron ? "⚔️鐵人 ✘" + m.wrong + "/" + m.allow + (acc === null ? "" : " 答對" + Math.round(acc * 100) + "%") : "") + (m.iron && m.daily ? " " : "") + (m.daily ? "📅" + m.daily.rules.map(k => TG.DAILY_RULES[k].em).join("") : "");
    ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const w = ctx.measureText(t).width + 10;
    ctx.fillStyle = "#000a"; ctx.fillRect(3, 384, w, 14); ctx.fillStyle = m.iron ? "#ffd2d2" : "#fff6c2"; ctx.fillText(t, 8, 391.5); ctx.restore();
  });

  // ───── 結算
  U.add("end", (G, run, won) => {
    const m = G.modes, out = []; let title = null; if (!m || !G.stage) return out;
    const d = D();
    if (m.iron) {
      if (won) { const first = !d.iron[G.stage.i]; d.iron[G.stage.i] = 1; const acc = TG.ironAcc(m); out.push((first ? "拿到鐵人徽章" : "鐵人徽章已經有了") + "：答錯 " + m.wrong + "／" + m.n + " 題" + (acc === null ? "" : "（答對率 " + Math.round(acc * 100) + "%）")); title = "⚔️ 鐵人成功！第 " + (G.stage.i + 1) + " 關・" + G.stage.name; }
      else {
        const why = m.fail === "wrong" ? "答錯 " + m.wrong + " 題，超過可錯的 " + m.allow + " 題（城堡其實還在）" : "漏掉一隻怪（只有 1 條命）";
        out.push("鐵人挑戰失敗：" + why);
        out.push("看看下面答錯的題目和解析，下次再挑戰！");
        title = "鐵人挑戰失敗";   // end 掛勾回傳 { title } 換掉結算標題
      }
    }
    if (m.daily) {
      if (!won) out.push("每日一關沒守住，今天還可以再挑戰");
      // 跨午夜：昨天開打、今天打完仍可領（只要沒領過更新的日子，連續天數不會倒退）；更早的就過期（2026-11-21 QA）
      else if (m.daily.date !== today() && !(m.daily.date === TG.prevDayKey(today()) && !(d.daily.last && d.daily.last >= m.daily.date))) out.push("這是 " + fmtDay(m.daily.date) + " 的每日一關，獎勵已過期");
      else {
        const r = TG.dailyClaim(d.daily, m.daily.date);
        if (!r) out.push("今天的每日獎勵已經領過了");
        else {
          out.push("每日一關完成！連續 " + r.streak + " 天");
          // v3：經驗量照 knight_tree.json xp.dailyReward（TG.dailyReward），不吃每日答題額度；升級交給騎士引擎 TG.knightLevelUp（第 5 組；還沒做時用舊曲線）
          const S = U.S; S.hero.xp += r.xp; out.push("英雄經驗 +" + r.xp + "（每日獎勵）");
          const lv0 = S.hero.lv;
          if (TG.KNIGHT && TG.KNIGHT.VER >= 1 && typeof TG.knightLevelUp === "function") TG.knightLevelUp(S.hero);
          else while (S.hero.lv < TG.HERO_MAX && S.hero.xp >= TG.heroXpNeed(S.hero.lv)) { S.hero.xp -= TG.heroXpNeed(S.hero.lv); S.hero.lv++; }
          if (S.hero.lv > lv0) out.push("英雄升到 Lv" + S.hero.lv + "！");
          const pets = TG.summonsUnlocked(U.cleared());
          if (pets.length) {
            const id = pets[TG.dailySeed(m.daily.date) % pets.length], p = S.pets[id] = S.pets[id] || { lv: 1, uses: 0 };
            for (let k = 0; k < r.petUses; k++) {   // 11-24 第二輪：進化點數制（TG.petUse，每次當作排對）；沒有 petUse 時照舊每 5 次升 1 級
              if (TG.petUse) { const pu = TG.petUse(p, true); if (pu.up) out.push(TG.SUMMONS[id].name + " 升到 Lv" + pu.lv + "！"); }
              else { p.uses = (p.uses || 0) + 1; if (p.uses % 5 === 0 && p.lv < 10) { p.lv++; out.push(TG.SUMMONS[id].name + " 升到 Lv" + p.lv + "！"); } }
            }
            out.push(TG.SUMMONS[id].name + " 練習 +" + r.petUses + " 次");
          }
          // 第 7 天加碼與里程碑：碎片放進裝備外掛的存檔（11-21 第二刀）
          if (r.shards && TG.gearData) { const mm = S.mods || (S.mods = {}); mm.gear = TG.gearData(mm.gear); mm.gear.shards += r.shards; out.push("碎片 +" + r.shards + "（" + (r.milestone ? r.milestone + "里程碑" : "本週第 7 天加碼") + "）"); }
        }
      }
    }
    // 三星條件說明（11-21 第二刀：三星要剩命 ≥18 且答對率 ≥70%）：差在哪
    if (won && !m.iron && !G.practice && TG.starText) out.push(TG.starText(G.lives, G));
    U.save();
    return title ? { title, lines: out } : out;
  });

  // ───── 測試機器人：本外掛的全畫面不會在戰鬥中出現；保險起見關掉
  window.TGBOT = (window.TGBOT || []).concat(() => {
    if (!ov.classList.contains("hide")) { ov.classList.add("hide"); return true; }
    return false;
  });
  window.TGMODES = { open, startDaily, todayPlan, get pending() { return pending; }, arm(stI, o) { pending = Object.assign({ st: stI, iron: false, daily: null }, o); } };

  U.menuInfo();
})();
