// 外掛：bosses（畫面端，只在瀏覽器載入）。用 window.TGUI 的掛勾，見 mods/README.md。
// 九頭蛇新頭、魔龍封印 → 題目佇列 TGUI.qbus（v3 合約 §6.1：情境題 prio 1、綁定魔王、不搶面板）；
// 冰盾 → 自建「句子重組」面板（bossOrder；排句題第 1 期側邊面板還不能畫，所以自己排隊：等畫面空出來才開，不再關掉別人的面板）；
// 魔龍換階段 → 橫幅。
(function () {
  if (!window.TGUI || !window.TG || !TG.BOSSES) return;
  const T = window.TGUI, B = TG.BOSSES, C = B.CFG;
  const MECH = e => e && TG.ENEMIES[e.type] && TG.ENEMIES[e.type].mech;
  const findE = (G, id) => G && G.enemies.find(x => x.id === id && B.isMine(x));
  let iceQ = [], cur = null, banner = null, stat = null, hintShown = false, freeT = 0;
  let heads = {}, seals = {}, ices = {};   // 已經丟進 qbus、還沒結算的題：key → { qid, eid, id, ids }（ices＝排句滿 4 題後的冰盾選擇題）
  const costOf = (what, G) => (B.cost ? B.cost(what, G) : 3);
  // v3 情境題降級（事件帶 deg:true＝這關題目已經答很多，這次不出題）：提示一次就好，之後只畫標籤
  let degHint = false;
  function degToast(txt) { if (!degHint) { degHint = true; T.toast((TG.pfOn && TG.pfOn(T.G) ? "守城時不出題，魔王招式改成自己慢慢解除；" : "這關的題目答很多了，魔王招式改成自己慢慢解除；") + txt); } }
  const BUS = () => T.qbus || null;
  // 玩家自己點魔王時，只有這些「不是在答題」的面板可以收起來讓位；答題中的面板一律不動（v3：禁止強制關面板插隊）
  const SOFT = { build: 1, tower: 1 };
  const busyAnswering = () => !!T.sheetMode && !SOFT[T.sheetMode];

  const INFO = {
    hydra: { em: "🐍", short: "會長出新頭：答對片語題就砍掉它", pf: "會長新頭：過幾秒自己枯掉，⚡3 可點牠砍" },
    lich: { em: "🧙", short: "會張開冰盾：把句子排好就能打破", pf: "會張冰盾：撐幾秒被塔磨掉，⚡3 可點牠破" },
    dragon: { em: "🐲", short: "三個階段，會用前面魔王的招式", pf: "三個階段，會用前面魔王的招式" }
  };
  // 11-25 試玩小明 P1-5：先答題玩法守城不出題，「答對片語題就砍掉它」「答對題目可以存能量」都不對 → 先答題時換說法
  const pfNow = G => !!(TG.pfOn && TG.pfOn(G || T.G));
  const shortOf = inf => (pfNow() && inf.pf ? inf.pf : inf.short) || "";
  const PHASE_TXT = { 2: "長出新頭＋冰盾！", 3: "四招輪流，而且更快！" };

  const J = () => (T.juice && T.juice.centerBanner ? T.juice : null);
  function hideBeToast() {
    try { const el = document.getElementById("toast"); if (el && /召喚小怪|be 小怪/i.test(el.textContent)) el.classList.add("hide"); } catch (e) {}
  }
  T.add("start", () => {
    const bus = BUS();
    if (bus) { for (const k in heads) bus.cancel(heads[k].qid); for (const k in seals) bus.cancel(seals[k].qid); }
    if (bus) for (const k in ices) bus.cancel(ices[k].qid);
    iceQ = []; cur = null; banner = null; stat = { chop: 0, ice: 0, seal: 0 }; hintShown = false; freeT = 0; heads = {}; seals = {}; ices = {}; degHint = false;
  });

  // ───── 引擎事件
  T.add("event", (ev, G) => {
    const k = ev.k;
    if (k === "bossIntro") {
      const b = TG.ENEMIES[ev.boss.type], inf = INFO[ev.mech] || {};
      // 11-22：有手感外掛時交給它的中央橫幅（和「魔王登場」併成同一張，不再上下疊兩條）
      if (J()) J().centerBanner({ merge: true, name: b.name + " 出現了！", sub: shortOf(inf), col: "#ffd75e", T: 2.4 });
      else banner = { text: b.em + " " + b.name + " 出現了！", sub: shortOf(inf), t: 2.6, T: 2.6, c: "#ffd75e" };
      T.beep(160, .5, "sawtooth", .05);
    } else if (k === "bossHead") {
      if (ev.deg) degToast("點魔王花 ⚡" + costOf("chop", G) + " 可以立刻砍頭");
      else { pushHead(G, ev.eid, ev.id); T.toast(TG.ENEMIES[ev.boss.type].em + " 長出新頭！答對片語題砍掉它"); }
      T.beep(220, .3, "sawtooth", .04);
    } else if (k === "bossHeadFade") {
      T.fx("新頭自己枯掉了", ev.boss.x, ev.boss.y - 10, "#c8d8c0");
    } else if (k === "bossHeadOk") {
      if (stat) stat.chop++;
      T.fx("砍掉了！", ev.boss.x, ev.boss.y - 10, "#5fd39a"); T.beep(1040, .2, "triangle", .05);
    } else if (k === "bossHeadBad") {
      if (ev.why === "wrong") T.fx("沒砍到，頭還在", ev.boss.x, ev.boss.y - 10, "#ffd2a0");   // 11-24：答錯不回血、不暴走
      else T.fx("時間到！頭長回來…牠回血變快", ev.boss.x, ev.boss.y - 10, "#ff9d9d");
    } else if (k === "bossIce") {
      if (ev.deg) degToast("冰盾撐不久，點魔王花 ⚡" + costOf("iceBreak", G) + " 可以立刻打破");
      else if (ev.mode === "mcq") { pushIceQ(G, ev.eid, ev.id); T.toast("🧊 冰盾！答對題目打破它"); }
      else { iceQ.push({ k: "ice", eid: ev.eid, id: ev.id }); T.toast("🧊 冰盾！把句子排好打破它"); }
      T.beep(1300, .3, "sine", .04);
    } else if (k === "bossIceBreak") {
      if (stat) stat.ice++;
      T.fx("冰盾碎了！", ev.boss.x, ev.boss.y - 10, "#bfe6ff"); T.beep(1500, .15, "square", .03);
    } else if (k === "bossIceHold") {
      T.fx("冰盾多撐 " + ev.t + " 秒", ev.boss.x, ev.boss.y - 10, "#bfe6ff");
    } else if (k === "bossIceMelt") {
      if (cur && cur.eid === ev.eid && !cur.done && T.sheetMode === "bossOrder") { cur = null; T.closeSheet(); }
      T.fx("冰盾融化了", ev.boss.x, ev.boss.y - 10, "#bfe6ff");
    } else if (k === "bossPhase") {
      if (J()) J().centerBanner({ label: TG.ENEMIES[ev.boss.type] ? TG.ENEMIES[ev.boss.type].name : "", name: "第 " + ev.phase + " 階段", sub: PHASE_TXT[ev.phase] || "", col: "#ff9d3c", T: 2.2 });
      else banner = { text: "🐲 第 " + ev.phase + " 階段", sub: PHASE_TXT[ev.phase] || "", t: 2.6, T: 2.6, c: "#ff9d3c" };
      T.beep(120, .6, "sawtooth", .06);
    } else if (k === "beCall") {
      // 11-22（小美 P1）：Be 小怪題目已經畫在地圖上緣（index.html 的題目橫幅，含「點標對答案的小怪」），
      //   上方提示「Be 巨人召喚小怪！點對的那隻」剛好蓋在題目句上 → 這則提示直接收掉；魔龍也不再另外出提示
      hideBeToast();
    } else if (k === "bossSeal") {
      if (ev.deg) degToast("封印 " + C.sealDegT + " 秒就解開，點被封的塔花 ⚡" + costOf("unseal", G) + " 可以立刻解");
      else { pushSeal(G, ev); T.toast("🐲 魔龍封印了 " + ev.ids.length + " 座塔！答對解封題就能解開"); }
      T.beep(180, .4, "square", .05);
    } else if (k === "bossUnseal") {
      if (stat) stat.seal++; T.toast("封印解除！");
    }
  });

  // ───── 情境題進 qbus（九頭蛇新頭、魔龍封印）：prio 1、綁定魔王 eid（魔王死了／漏了自動取消）
  //   出題、作答、學習紀錄（recordAnswer）由 qbus 的出題端負責（空殼期＝舊的 askQuestion；② 的側邊面板上線後＝qpanel）
  //   這裡只管結算：onResult(ok, info) → 引擎（answerResult 帶 kind／src 與同一個 info）
  const qTimeFor = G => (G && G.heroic ? 10 : 15);
  function pushHead(G, eid, id) {
    const bus = BUS(), e = findE(G, eid); if (!bus || !e) return null;
    const key = eid + ":" + id; if (heads[key]) return heads[key].qid;
    const name = TG.ENEMIES[e.type].em + (MECH(e) === "dragon" ? " 魔龍長出新頭" : " 砍掉新長的頭");
    const rec = heads[key] = { eid, id, qid: null };
    rec.qid = bus.push({
      src: "hydra", prio: 1, use: "choice", lv: 3, gpPref: ["G14"], deadline: qTimeFor(G), title: name + "（片語）", eid,
      onResult(ok, info) {
        delete heads[key];
        if (TG.bossHeadAnswer(T.G, eid, id, ok, info) === null) T.toast("這顆頭已經不在了，還是練習到了！");
      },
      onCancel() { delete heads[key]; }
    });
    return rec.qid;
  }
  function pushSeal(G, ev) {
    const bus = BUS(); if (!bus || !G) return null;
    const key = ev.eid + ":" + ev.id; if (seals[key]) return seals[key].qid;
    const rec = seals[key] = { eid: ev.eid, id: ev.id, ids: ev.ids.slice(), qid: null };
    rec.qid = bus.push({
      src: "seal", prio: 1, use: "choice", lv: 2, gpPref: ["G02", "G04", "G05", "G11"], deadline: 10,
      title: "🔓 解除封印（" + ev.ids.length + " 座塔）", eid: ev.eid,
      onResult(ok, info) {
        delete seals[key];
        const r = B.unseal(T.G, rec.ids, ok, info);
        if (r === null) T.toast("封印已經自己解開了，還是練習到了！");
        else if (ok) { if (stat) stat.seal++; T.toast("封印解除！"); }
      },
      onCancel() { delete seals[key]; }
    });
    return rec.qid;
  }
  // 排句滿 4 題後的冰盾：改出選擇題（1 點），一樣走 qbus
  function pushIceQ(G, eid, id) {
    const bus = BUS(), e = findE(G, eid); if (!bus || !e) return null;
    const key = eid + ":" + id; if (ices[key]) return ices[key].qid;
    const rec = ices[key] = { eid, id, qid: null };
    rec.qid = bus.push({
      src: "lich", prio: 1, use: "choice", lv: 3, deadline: qTimeFor(G), title: "🧊 打破冰盾（答對就碎）", eid,
      onResult(ok, info) { delete ices[key]; if (TG.bossIceAnswer(T.G, eid, id, ok, info) === null) T.toast("冰盾已經不在了，還是練習到了！"); },
      onCancel() { delete ices[key]; }
    });
    return rec.qid;
  }
  const iceQValid = (G, x) => { const e = findE(G, x.eid); return !!(e && e.bm.ice > 0 && e.bm.iceId === x.id && e.bm.iceTried !== x.id); };
  const headValid = (G, h) => { const e = findE(G, h.eid); return !!(e && e.bm.head && e.bm.head.id === h.id); };
  const sealValid = (G, x) => !!findE(G, x.eid) && B.stillSealed(G, x.ids).length > 0;
  const queued = qid => { const bus = BUS(); return !!bus && bus.list().some(x => x.id === qid); };

  // ───── 冰盾排隊：畫面空出來才開（不打斷別人的題目、不關掉任何面板）
  const valid = (G, it) => {
    const e = findE(G, it.eid); if (!e) return false;
    return e.bm.ice > 0 && e.bm.iceId === it.id && e.bm.iceTried !== it.id && (!e.bm.iceMode || e.bm.iceMode === "order");
  };
  T.add("frame", (G, run, real) => {
    if (banner && (banner.t -= real) <= 0) banner = null;
    // 還在排隊的情境題：頭逾時／封印自己結束／魔王不在了 → 從 qbus 撤掉（已經顯示的那題讓玩家答完）
    const bus = BUS();
    if (bus) {
      for (const k of Object.keys(heads)) if (!headValid(G, heads[k]) && queued(heads[k].qid)) bus.cancel(heads[k].qid);
      for (const k of Object.keys(seals)) if (!sealValid(G, seals[k]) && queued(seals[k].qid)) bus.cancel(seals[k].qid);
      for (const k of Object.keys(ices)) if (!iceQValid(G, ices[k]) && queued(ices[k].qid)) bus.cancel(ices[k].qid);
    }
    if (cur && !cur.done && T.sheetMode !== "bossOrder") {        // 玩家按 ✕ 關掉了（或按了暫停）
      cur = null;
      if (!hintShown) { hintShown = true; T.toast("想打破冰盾，點魔王就能再打開"); }
    }
    if (cur && !cur.done && !valid(G, cur)) { cur = null; if (T.sheetMode === "bossOrder") T.closeSheet(); }   // 只關自己的面板
    iceQ = iceQ.filter(it => valid(G, it));
    freeT = T.sheetMode || T.held ? 0 : freeT + real;
    if (!iceQ.length || G.over) return;
    if (freeT < 0.4) return;            // 上一個面板剛關，停一下再跳（不要連續轟炸）
    // 舊面板模式（側邊面板還沒上線）：qbus 裡還有情境題就先讓它出，一次一題
    if (bus && !(T.qpanel && T.qpanel.enabled) && bus.list().some(x => (x.prio || 0) >= 1)) return;
    openIce(iceQ.shift());
  });

  // ───── 冰盾：句子重組面板
  function openIce(it) {
    const G = T.G, e = findE(G, it.eid); if (!e) return;
    iceQ = iceQ.filter(x => !(x.k === "ice" && x.eid === it.eid && x.id === it.id));
    const all = (T.pool || QDB), src = all.filter(TG.orderable), list = src.length ? src : QDB.filter(TG.orderable);
    const q = list[Math.floor(T.rng() * list.length)], o = TG.makeOrder(q, T.rng);
    cur = { k: "ice", eid: it.eid, id: it.id, q, o, picked: [], used: {}, mistakes: 0, done: false, t0: performance.now() };
    render();
  }
  function render(res) {
    const c = cur; if (!c) return;
    const e = T.esc, full = c.picked.length === c.o.words.length;
    T.openSheet("bossOrder", '<h3>🧊 打破冰盾：把句子排好<small>錯 2 次冰盾多撐 ' + C.lich.holdT + ' 秒</small>' + (c.done ? '' : '<button class="x" data-x>✕</button>') + '</h3>' +
      (c.q.zh ? '<div class="zh">中文：' + e(c.q.zh) + '</div>' : '') +
      '<div class="answer">' + c.picked.map(w => e(w)).join(" ") + (full ? e(c.o.tail) : '') + '</div>' +
      (c.done ? '' : '<div class="chips">' + c.o.shuffled.map((w, k) => '<button class="chip' + (c.used[k] ? ' used' : '') + '" data-bord="' + k + '">' + e(w) + '</button>').join("") + '</div><div class="stats">排錯 ' + c.mistakes + ' 次</div>') +
      (res || ''), true);
    document.querySelectorAll("#sheet [data-bord]").forEach(b => b.onclick = () => tapChip(+b.dataset.bord, b));
  }
  function tapChip(k, btn) {
    const c = cur; if (!c || c.done || T.sheetMode !== "bossOrder" || k < 0 || c.used[k]) return;
    const w = c.o.shuffled[k], need = c.o.words[c.picked.length];
    if (w.toLowerCase() !== need.toLowerCase()) {
      c.mistakes++; T.beep(160, .12, "square", .03);
      const el = btn || document.querySelector('#sheet [data-bord="' + k + '"]');
      if (el) el.classList.add("bad");
      setTimeout(() => { if (cur === c && !c.done && T.sheetMode === "bossOrder") render(); }, 250);
      return;
    }
    c.picked.push(w); c.used[k] = true; T.beep(500 + c.picked.length * 40, .06, "triangle", .04);
    if (c.picked.length < c.o.words.length) return render();
    c.done = true;
    const ok = c.mistakes < 2, e = T.esc;
    // v3 統一作答紀錄（合約 §3）：學習紀錄與引擎帶同一個 info（kind order、src lich、作答秒數）
    const info = TG.ansInfo(c.q, { kind: "order", src: "lich", try: 1, sec: Math.round((performance.now() - (c.t0 || performance.now())) / 100) / 10 });
    T.recordAnswer(c.q, ok, "order", ok, info);
    const r = TG.bossIceOrder(T.G, c.eid, c.id, c.mistakes, info);
    T.speak(c.o.full);
    let msg;
    if (r === null) msg = '冰盾已經不在了，還是練習到了！';
    else if (ok) msg = '✔ 冰盾碎了！魔王被震傷。';
    else msg = '✘ 排錯 ' + c.mistakes + ' 次，冰盾會多撐 ' + C.lich.holdT + ' 秒。沒關係，下一面冰盾再來！';
    render('<div class="explain">' + msg + '<br>正確句子：<b>' + e(c.o.full) + '</b>' + (c.q.e ? '<br>' + e(c.q.e) : '') + '</div>' +
      (ok ? '' : '<div class="row"><button class="main" data-ok>知道了</button></div>'));
    if (ok) setTimeout(() => { if (cur === c && T.sheetMode === "bossOrder") { cur = null; T.closeSheet(); } }, 1300);
  }

  // ───── 點魔王：重開冰盾面板，或讓排隊中的砍頭題馬上出（玩家自己點的；答題中的面板一律不關）
  T.add("tap", (x, y, G, run) => {
    let best = null, bd = 26;
    for (const e of G.enemies) if (B.isMine(e)) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    if (!best) return false;
    if (run.be && G.enemies.some(m => m.callId === run.be.callId && Math.hypot(m.x - x, m.y - y) < bd)) return false;   // 讓 Be 小怪先
    const m = best.bm, bus = BUS();
    const pump = () => { if (busyAnswering()) { T.toast("先把這題答完，魔王題馬上來"); return true; } if (T.sheetMode) T.closeSheet(); bus.pump(); return true; };
    const spend = (what, fn, label) => {
      if (fn(G, best.id)) return true;
      T.toast("能量不夠（要 ⚡" + costOf(what, G) + "）：" + (pfNow(G) ? "下一輪備戰多答幾題就有" : "答對題目可以存能量") + (label ? "，" + label : "")); return true;
    };
    const iq = m.ice > 0 && ices[best.id + ":" + m.iceId];
    if (iq && bus && queued(iq.qid)) return pump();
    if (m.ice > 0 && (m.iceDeg || m.iceTried === m.iceId)) return spend("iceBreak", B.breakIce, "冰盾一下子就會被塔磨掉");
    if (m.head && m.head.deg) return spend("chop", B.chopHead, "新頭過幾秒會自己枯掉");
    if (m.ice > 0 && m.iceTried !== m.iceId && m.iceMode !== "mcq") {
      if (cur && cur.eid === best.id && cur.id === m.iceId && T.sheetMode === "bossOrder") return true;   // 已經開著
      if (busyAnswering()) { T.toast("先把這題答完，再來打破冰盾"); return true; }
      if (T.sheetMode) T.closeSheet();   // 建塔／塔面板：玩家自己點魔王，收起來讓位
      openIce({ k: "ice", eid: best.id, id: m.iceId }); return true;
    }
    const h = m.head && heads[best.id + ":" + m.head.id];
    if (h && bus && queued(h.qid)) return pump();
    return false;
  });
  // 魔龍在場時點被封的塔：花能量立刻解封（題目還在佇列的那次，答對一樣免費解）
  T.add("tap", (x, y, G) => {
    // 11-25：先答題守城時時光樹妖的不出題封印（6 秒）也能花能量解（引擎組交件待辦）
    if (!G || !G.enemies.some(e => (B.isMine(e) && MECH(e) === "dragon") || (TG.pfWaveQuiet && TG.pfWaveQuiet(G) && TG.ENEMIES[e.type] && TG.ENEMIES[e.type].mech === "seal"))) return false;
    const tw = G.towers.find(t => t.sealT > 0 && Math.hypot(t.x - x, t.y - y) < 16); if (!tw) return false;
    if (!B.unsealPay(G, [tw.id])) T.toast("能量不夠（要 ⚡" + costOf("unseal", G) + "）：封印 " + Math.ceil(tw.sealT) + " 秒後自己解開");
    return true;
  });

  // ───── 繪圖：冰盾、頭數、階段、狀態列、換階段橫幅
  function tag(ctx, text, x, y, fg, bg) {
    ctx.font = "bold 9px sans-serif"; const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - 6.5, w, 13); ctx.fillStyle = fg; ctx.fillText(text, x, y);
  }
  T.add("drawTop", (ctx, G, run) => {
    const now = performance.now() / 1000;
    let top = null;
    for (const e of G.enemies) {
      if (!B.isMine(e)) continue;
      top = top || e;
      const m = e.bm, R = 16, mech = MECH(e);
      ctx.save();
      if (m.rageT > 0) { ctx.fillStyle = "rgba(255,70,70,0.25)"; ctx.beginPath(); ctx.arc(e.x, e.y, R + 4, 0, 7); ctx.fill(); }
      if (m.invT > 0) {
        ctx.strokeStyle = "rgba(255,215,94," + (0.6 + 0.4 * Math.sin(now * 12)) + ")"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, R + 7 + 2 * Math.sin(now * 8), 0, 7); ctx.stroke();
      }
      if (m.ice > 0) {
        ctx.fillStyle = "rgba(170,220,255,0.38)"; ctx.strokeStyle = "#e6f6ff"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, rx = e.x + Math.cos(a) * (R + 9), ry = e.y + Math.sin(a) * (R + 9); i ? ctx.lineTo(rx, ry) : ctx.moveTo(rx, ry); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#7cc8ff"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(e.x, e.y, R + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, m.ice / (m.iceMax || 1))); ctx.stroke();
      }
      if (m.head) {
        ctx.strokeStyle = "rgba(255,120,120," + (0.5 + 0.5 * Math.sin(now * 10)) + ")"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, R + 5, 0, 7); ctx.stroke();
      }
      ctx.restore();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const ty = e.y - R - 15;
      if (m.ice > 0 && m.iceTried !== m.iceId) tag(ctx, m.iceMode === "mcq" ? "答題破盾" : "點我排句子", e.x, ty, "#e6f6ff", "#0d2a44e6");
      else if (m.ice > 0 && (m.iceDeg || m.iceTried === m.iceId)) tag(ctx, "點我 ⚡" + costOf("iceBreak", G) + " 破盾", e.x, ty, "#e6f6ff", "#0d2a44e6");
      else if (m.head) tag(ctx, m.head.deg ? "點我 ⚡" + costOf("chop", G) + " 砍頭" : "答題砍頭", e.x, ty, "#ffe0e0", "#4a1414e6");
      else if (m.invT > 0) tag(ctx, "無敵", e.x, ty, "#2a2000", "#ffd75ee6");
      else if (mech === "hydra") tag(ctx, "頭 ×" + m.heads, e.x, ty, "#e6ffe6", "#173a20e6");
      else if (mech === "dragon") tag(ctx, "第 " + m.phase + " 階段", e.x, ty, "#fff0dc", "#4a2410e6");
    }
    if (top) bossBar(ctx, top, run);
    if (banner) {
      const a = Math.min(1, banner.t / 0.4, (banner.T - banner.t) / 0.25 + 0.2);
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#000000b0"; ctx.fillRect(0, 160, 300, 50);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = banner.c; ctx.font = "bold 18px sans-serif"; ctx.fillText(banner.text, 150, 178);
      ctx.fillStyle = "#eef5ef"; ctx.font = "11px sans-serif"; ctx.fillText(banner.sub, 150, 199);
      ctx.restore();
    }
  });
  function bossBar(ctx, e, run) {
    const b = TG.ENEMIES[e.type], m = e.bm, mech = MECH(e), x0 = 50, w = 200, y0 = run && run.bbY != null ? (run.bbLow ? 400 - 25 - 4 : run.bbY) : run && run.be ? 42 : 3;   // 11-25：魔王在地圖上緣時移到下緣（index.html 算 run.bbLow）
    ctx.save(); if (run && run.bbA != null) ctx.globalAlpha = run.bbA;
    ctx.fillStyle = "#0b1510d9"; ctx.fillRect(x0, y0, w, 25);
    ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, w - 1, 24);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif";
    ctx.fillText(b.em + " " + b.name + (mech === "dragon" ? "・第" + m.phase + "階段" : ""), x0 + 6, y0 + 8);
    let st = "", sc = "#a7c0ae";
    if (m.invT > 0) { st = "換階段・無敵"; sc = "#ffd75e"; }
    else if (m.ice > 0) { st = "冰盾 " + Math.ceil(m.ice) + " 秒"; sc = "#9fd8ff"; }
    else if (m.head) { st = m.head.deg ? "新頭：會自己枯掉" : "新頭：答片語題"; sc = "#ff9d9d"; }
    else if (m.rageT > 0) { st = "暴走加速中"; sc = "#ff7070"; }
    else if (mech === "hydra") st = "頭 ×" + m.heads;
    ctx.textAlign = "right"; ctx.fillStyle = sc; ctx.font = "9px sans-serif"; ctx.fillText(st, x0 + w - 6, y0 + 8);
    const bw = w - 12, by = y0 + 17;
    ctx.fillStyle = "#000a"; ctx.fillRect(x0 + 6, by, bw, 4);
    ctx.fillStyle = m.ice > 0 ? "#7cc8ff" : "#e8734a"; ctx.fillRect(x0 + 6, by, bw * Math.max(0, e.hp / e.maxHp), 4);
    if (mech === "dragon") { ctx.fillStyle = "#fff"; for (const t of C.dragon.thr) ctx.fillRect(x0 + 6 + bw * t - 0.5, by - 1, 1.2, 6); }
    ctx.restore();
  }

  // ───── 關卡簡報：只在這三關說明魔王機制
  const PF_BRIEF = {
    hydra: "每隔一段時間長出一顆<b>新頭</b>（頭越多牠走越快），新頭過幾秒會自己枯掉。",
    lich: "會張開<b>冰盾</b>，這時塔幾乎打不動牠；冰盾撐幾秒就會被塔磨掉。",
    dragon: "血量掉到 2/3、1/3 時會<b>換階段</b>，換的時候會短暫無敵。三個階段輪流用前面魔王的招式：封印塔、長新頭、冰盾，最後一階段更快！"
  };
  T.add("brief", st => {
    const type = st && st.bossType, b = type && TG.ENEMIES[type];
    if (!b || !INFO[b.mech]) return "";
    const e = T.esc, pool = TG.stagePool(QDB, st);
    let body = "";
    if (b.mech === "hydra") {
      const ex = pool.find(q => q.gp === "G14");
      body = "每隔一段時間長出一顆<b>新頭</b>，會跳出一題<em>片語動詞</em>題" + (ex ? "（例：" + e(ex.q).replace("___", "<em>" + e(ex.o[0]) + "</em>") + "）" : "") + "。<br>" +
        "✔ 答對：砍掉新頭，九頭蛇受重傷。<br>✘ 答錯：沒砍到，頭先留著（牠不會回血）。<br>⏰ 時間到沒答：頭長回來，牠回一點血、暫時變快。";
    } else if (b.mech === "lich") {
      body = "會張開<b>冰盾</b>，這時塔幾乎打不動牠。<br>冰盾出現時會跳出<em>句子重組</em>：把字排成正確的句子就能打破冰盾，還會震傷牠。<br>" +
        "排錯 2 次以上，冰盾會多撐 " + C.lich.holdT + " 秒。不小心關掉了，點巫妖就能再打開。";
    } else {
      body = "血量掉到 2/3、1/3 時會<b>換階段</b>，換的時候會短暫無敵。<br>" +
        "第 1 階段：叫出 am／is／are 小怪（點對的那隻）＋封印塔（答時態題解封）。<br>" +
        "第 2 階段：長新頭（片語題）＋冰盾（句子重組）。<br>第 3 階段：四招輪流，而且更快！";
    }
    body = '<span class="pfoff">' + body + "<br>這關題目答很多之後，魔王的招式會改成自己慢慢解除；存下的能量也可以直接砍頭、破盾、解封。</span>" +
      '<span class="pfon">' + (PF_BRIEF[b.mech] || "") + "<br>先答題玩法守城時不出題：招式都會自己慢慢解除，存下的能量可以點魔王直接" + (b.mech === "hydra" ? "砍頭" : b.mech === "lich" ? "破盾" : "砍頭、破盾、解封") + "。</span>";
    const beaten = ((T.S.mods && T.S.mods.bosses && T.S.mods.bosses.beaten) || {})[type];
    return '<div class="card"><h4>' + b.em + ' 魔王機制：' + e(b.name) + (beaten ? '　<span style="color:var(--ok)">已打倒 ' + beaten + ' 次</span>' : '') + '</h4>' + body + '</div>';
  });

  // ───── 結算：記錄打倒過哪些魔王（存在 S.mods.bosses）
  T.add("end", (G, run, won) => {
    const st = G.stage, type = st && st.bossType, b = type && TG.ENEMIES[type];
    if (!b || !INFO[b.mech]) return [];
    const out = [];
    if (stat && stat.chop) out.push("🐍 砍掉 " + stat.chop + " 顆頭");
    if (stat && stat.ice) out.push("🧊 打破 " + stat.ice + " 面冰盾");
    if (stat && stat.seal) out.push("🔓 解開 " + stat.seal + " 次封印");
    if (won) {
      const S = T.S; S.mods = S.mods || {};
      const my = S.mods.bosses = (S.mods.bosses && typeof S.mods.bosses === "object") ? S.mods.bosses : {};
      my.beaten = my.beaten || {};
      const first = !my.beaten[type];
      my.beaten[type] = (my.beaten[type] || 0) + 1;
      T.save();
      out.unshift((first ? "🏆 第一次打倒" : "🏆 又打倒了") + b.name + "！");
    }
    return out;
  });

  // ───── 瀏覽器測試機器人：冰盾面板（題目面板由內建機器人處理）
  window.TGBOT = (window.TGBOT || []).concat((TT, G, c, yes) => {
    if (TT.sheetMode !== "bossOrder" || !cur) return false;
    if (cur.done) { const b = document.querySelector("#sheet [data-ok]"); if (b) b.click(); else { cur = null; T.closeSheet(); } return true; }
    const need = cur.o.words[cur.picked.length].toLowerCase();
    let k = cur.o.shuffled.findIndex((w, i) => !cur.used[i] && w.toLowerCase() === need);
    if (!yes()) { const kk = cur.o.shuffled.findIndex((w, i) => !cur.used[i] && w.toLowerCase() !== need); if (kk >= 0) k = kk; }
    tapChip(k); c.bossOrder = (c.bossOrder || 0) + 1;
    return true;
  });
  // pushSeal：給 index（②）把時光樹妖的封印也改走 qbus 時共用（傳 { eid, id, ids }）
  window.TGBOSSUI = { get cur() { return cur; }, get queue() { return iceQ; }, get heads() { return heads; }, get seals() { return seals; }, get ices() { return ices; }, tapChip, openIce, pushHead, pushSeal, pushIceQ };
})();
