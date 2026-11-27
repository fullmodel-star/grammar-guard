// 外掛：companions（畫面端，只在瀏覽器載入）。用 window.TGUI 的掛勾，見 mods/README.md。
// 關卡簡報「選同伴」卡、戰鬥底部同伴大招鈕、主選單「同伴」一覽、過關經驗與升級訊息、大招特效。
(function () {
  if (!window.TGUI || !window.TG || !TG.COMP) return;
  const U = window.TGUI, C = TG.COMP, H = Math.hypot;
  const esc = U.esc;
  const ROLE = { melee: "近戰・會擋路", ranged: "遠程・不擋路" };

  // ───── 存檔：S.mods.companions = { pick, lv:{id:等級}, xp:{id:經驗} }（舊存檔沒有也能用）
  // 11-22 存檔防呆：mods／companions 不是物件（null、字串、陣列）就重建；lv／xp 每位同伴都過 COMP.rec（整數、夾在起始等級～MAX、經驗 0～升級所需）；
  //   pick 只能是同伴 id 或 "none"。等級的引擎端規則在 mods/companions.js 的 COMP.rec（平衡負責），這裡只負責型別與呼叫。
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  function data() {
    const S = U.S; if (!isObj(S.mods)) S.mods = {};
    if (!isObj(S.mods.companions)) S.mods.companions = {};
    const d = S.mods.companions;
    if (!isObj(d.lv)) d.lv = {};
    if (!isObj(d.xp)) d.xp = {};
    for (const id of C.ids) {
      if (C.rec) C.rec(d, id);
      else {
        const lv = Math.floor(+d.lv[id]), mx = C.MAX || 20, st = (C.startLv && C.startLv[id]) || 1;
        d.lv[id] = Number.isFinite(lv) ? Math.max(st, Math.min(mx, lv)) : st;
        const xp = Math.floor(+d.xp[id]); d.xp[id] = Number.isFinite(xp) && xp > 0 && d.lv[id] < mx ? xp : 0;
      }
    }
    for (const k of Object.keys(d.lv)) if (!C.ids.includes(k)) delete d.lv[k];
    for (const k of Object.keys(d.xp)) if (!C.ids.includes(k)) delete d.xp[k];
    if (d.pick !== undefined && d.pick !== "none" && !C.ids.includes(d.pick)) delete d.pick;
    return d;
  }
  const unlocked = () => C.unlocked(U.cleared());
  function lvOf(id) { return unlocked().includes(id) ? C.rec(data(), id).lv : C.startLv[id]; }
  // 目前要帶誰：記住上次；第一次就帶最新解鎖的；"none"＝不帶
  function pick() {
    const d = data(), u = unlocked();
    if (d.pick === "none") return null;
    if (d.pick && u.includes(d.pick)) return d.pick;
    return u.length ? u[u.length - 1] : null;
  }

  // ───── 樣式（只加自己的 class，前綴 cmp）
  const css = document.createElement("style");
  css.textContent =
    ".cmpPick{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}" +
    ".cmpPick button{flex:1 1 0;min-width:64px;min-height:44px;border:1px solid #4b6478;border-radius:12px;background:linear-gradient(#22344a,#152336);color:var(--ink);padding:7px 2px;font-size:12px;line-height:1.3;display:flex;flex-direction:column;align-items:center;gap:2px}" +
    ".cmpPick button.on{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.55),0 0 12px rgba(225,184,106,.3)}" +
    ".cmpPick button:disabled{opacity:.45}" +
    ".cmpAv{width:38px;height:38px;flex:0 0 38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:2px solid #E1B86A;box-shadow:0 0 0 2px #0c1122;line-height:1;overflow:hidden}" +
    ".cmpAv canvas{width:34px;height:34px;display:block;box-shadow:none;border-radius:0;touch-action:auto}" +
    ".cmpAv.lock{filter:grayscale(1);opacity:.6;border-color:#4b6478}" +
    ".cmpDesc{margin-top:6px;font-size:13px;color:var(--sub);line-height:1.6}" +
    ".cmpHead{display:flex;gap:10px;align-items:center}" +
    ".cmpHead .cmpAv{width:58px;height:58px;flex-basis:58px}.cmpHead .cmpAv canvas{width:52px;height:52px}" +
    ".cmpHead b{font-size:18px;font-family:var(--serif);color:#F3D494}.cmpHead small{display:block;color:var(--sub);font-size:12px}" +
    ".cmpXp{height:6px;border-radius:3px;background:#ffffff1a;overflow:hidden;margin:3px 0 6px}.cmpXp i{display:block;height:100%;background:linear-gradient(90deg,#E1B86A,#ffe9a8)}" +
    ".cmpLine{display:flex;gap:6px;align-items:flex-start;margin-top:4px}.cmpLine svg,.cmpPerk svg{width:16px;height:16px;flex:none;vertical-align:-3px}" +
    "#ovCmp>h2,#ovCmp>p,#ovCmp>.card{width:100%;max-width:460px}#ovCmp>h2{display:flex;align-items:center;justify-content:center;gap:8px}#ovCmp>h2 canvas{width:32px;height:32px;box-shadow:none;border-radius:0}" +
    "@media (min-width:900px){#ovCmp{display:grid;grid-template-columns:repeat(3,minmax(0,300px));justify-content:center;align-content:start}#ovCmp>h2,#ovCmp>p,#ovCmp>.big{grid-column:1/-1;justify-self:center}#ovCmp>.card{max-width:none}}" +
    ".cmpPerk{font-size:13px;line-height:1.6;color:var(--sub)}.cmpPerk.on{color:var(--ink)}" +
    ".cmpBtn{margin-top:8px;width:100%;min-height:44px;border:1px solid #4b6478;border-radius:12px;padding:9px;font-weight:800;background:linear-gradient(#26384f,#172539);color:var(--ink)}" +
    ".cmpBtn.on{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;border-color:#8a6a3a}";
  document.head.appendChild(css);

  const av = (id, lock) => { const h = TG.HEROES[id]; return '<span class="cmpAv' + (lock ? " lock" : "") + '" style="background:radial-gradient(circle at 50% 35%,' + h.color + ',#0c1122)">' + U.icHtml("hero", id, 1, 52, 52) + "</span>"; };
  // v3：同伴大招花能量＋冷卻、不答題（COMP.ult）。費用顯示用 TG.energyCost（沒開局時用表上的價格）
  const costNow = () => { const G = U.G, i = G ? C.idxOf(G) : -1; return i > 0 ? C.ultCost(G, i) : ((TG.ENERGY_COST && TG.ENERGY_COST.compUlt) || 5); };
  const domainLine = id => { const h = TG.HEROES[id]; return "大招「" + h.ult + "」：" + h.ultDesc + "。<br>放大招花 " + costNow() + " 格能量（答對題目累積），放完要等 " + h.ultCd + " 秒冷卻。"; };

  // ───── 關卡簡報：選同伴卡
  function pickHtml() {
    const u = unlocked(), cur = pick();
    const btns = C.ids.map(id => {
      const h = TG.HEROES[id], ok = u.includes(id);
      return '<button data-cmp="' + id + '"' + (ok ? "" : " disabled") + (cur === id ? ' class="on"' : "") + ">" + av(id, !ok) +
        "<span>" + h.name + "</span><span style=\"color:var(--sub)\">" + (ok ? "Lv" + lvOf(id) : "過 " + C.unlock[id] + " 關") + "</span></button>";
    }).join("") + '<button data-cmp="none"' + (cur ? "" : ' class="on"') + '>' + av("knight") + '<span>不帶</span><span style="color:var(--sub)">只有騎士</span></button>';
    const desc = cur ? "<b>" + TG.HEROES[cur].name + "</b>（" + ROLE[TG.HEROES[cur].role] + "）<br>" + domainLine(cur) : "這關只帶文法騎士。";
    return '<div class="cmpPick">' + btns + '</div><div class="cmpDesc" id="cmpDesc">' + desc + "</div>";
  }
  U.add("brief", st => {
    if (!C.canBring(st, U.cleared())) return "";
    return '<div class="card" id="cmpCard"><h4>' + U.uic("people", false) + '選同伴（可多帶 1 位）</h4><div id="cmpPickBox">' + pickHtml() + "</div></div>";
  });
  U.add("briefBind", (st, root) => {
    const box = root.querySelector("#cmpPickBox"); if (!box) return;
    box.addEventListener("click", ev => {
      const b = ev.target.closest("[data-cmp]"); if (!b || b.disabled) return;
      data().pick = b.dataset.cmp; U.save(); box.innerHTML = pickHtml(); U.paintIcons(box);
    });
  });

  // ───── 開局：把同伴加進 opts.heroes（騎士永遠第 1 位）
  U.add("opts", (opts, st) => {
    const id = pick(); if (!id || !C.canBring(st, U.cleared())) return opts;
    const base = (opts.heroes || [{ id: "knight", lv: opts.heroLv || U.S.hero.lv }]).filter(h => !C.ids.includes(h.id));
    opts.heroes = base.concat([{ id, lv: lvOf(id) }]);
    return opts;
  });
  U.add("start", G => {
    const i = C.idxOf(G); if (i < 0) return;
    const h = TG.HEROES[G.heroes[i].id];
    setTimeout(() => { if (U.G === G && !G.over) U.toast(h.em + " " + h.name + "加入！點英雄可切換，再點路面移動"); }, 2200);
  });

  // ───── 戰鬥底部：同伴大招鈕
  //   11-24 第二輪（整合）：按鈕維持「大招」，不改成「絕招」——騎士的「絕招」靠答題累積怒氣、可以多答一題加強；同伴的「大招」花能量、不用答題。
  //   兩個規則不同，名字分開孩子才分得出要按哪一顆、要先準備什麼（怒氣或能量）。
  U.add("bar", {
    get em() { const G = U.G, i = G ? C.idxOf(G) : -1; return i > 0 ? TG.HEROES[G.heroes[i].id].em : "🤝"; },
    icon: G => { const i = G ? C.idxOf(G) : -1; return i > 0 ? { kind: "hero", id: G.heroes[i].id, lv: 1 } : null; },   // 第二刀：底部按鈕用 ART 自繪頭像
    label: "大招",
    show: G => C.idxOf(G) > 0,
    // 狀態：倒下／冷卻秒數／能量不夠（顯示還差幾格）／可以放
    state: G => {
      const i = C.idxOf(G); if (i < 0) return { disabled: true };
      const h = G.heroes[i], rd = TG.heroUltReady(G, i), cost = C.ultCost(G, i), can = rd && TG.canSpend(G, cost);
      return { disabled: !can, ready: can, label: h.dead > 0 ? "倒下" : !rd ? Math.ceil(h.ultCd) + "s" : can ? "大招" : "能量" + Math.floor(G.energy || 0) + "/" + cost };
    },
    onClick: G => { const i = C.idxOf(G); if (i > 0) castUlt(G, i); }
  });
  // 按下去就放（不答題）；能量不夠時提示怎麼拿能量
  function castUlt(G, i) {
    const h = G.heroes[i], def = TG.heroDef(h);
    if (C.ult(G, i)) { U.fx(def.ult + "！", h.x, h.y, "#ffd75e"); U.beep(220, .4, "sawtooth", .06); try { U.renderBar(); } catch (e) {} return true; }
    if (TG.heroUltReady(G, i)) U.toast("能量不夠：" + def.name + "的大招要 " + C.ultCost(G, i) + " 格能量，答對題目就會累積");
    return false;
  }
  U.compUlt = castUlt;   // 測試／其他外掛用

  // ───── 特效
  let fxs = [];
  U.add("event", (ev, G) => {
    if (ev.k === "cmpRain") { fxs.push({ k: "rain", routes: ev.routes, t: 0.9, T: 0.9 }); U.beep(900, 0.25, "triangle", 0.04); }
    else if (ev.k === "cmpFreeze") { fxs.push({ k: "freeze", t: 1.2, T: 1.2 }); U.beep(1300, 0.4, "sine", 0.05); }
    else if (ev.k === "cmpBreath") { fxs.push({ k: "breath", x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0.7, T: 0.7 }); U.beep(120, 0.5, "sawtooth", 0.05); }
    else if (ev.k === "cmpShot") fxs.push({ k: "shot", x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0.15, T: 0.15 });
  });
  U.add("frame", (G, run, dt) => { fxs = fxs.filter(f => (f.t -= dt) > 0); });
  U.add("start", () => { fxs = []; });
  U.add("drawGround", (ctx, G) => {
    for (const f of G.cmpFires || []) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.time * 18); ctx.strokeStyle = "#ff7a2c"; ctx.lineCap = "round"; ctx.lineWidth = f.w * 1.6;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.restore();
    }
  });
  U.add("drawTop", (ctx, G, run) => {
    // 選中的遠程同伴：畫出射程
    if (run && G.heroes.length > 1) {
      const h = G.heroes[run.selHero || 0], def = h && TG.HEROES[h.id];
      if (h && h.dead <= 0 && def && C.ids.includes(h.id) && def.role === "ranged" && h.st) {
        ctx.save(); ctx.strokeStyle = def.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(h.x, h.y, h.st.range, 0, 7); ctx.stroke(); ctx.restore();
      }
    }
    for (const f of fxs) {
      const a = Math.max(0, f.t / f.T);
      ctx.save(); ctx.globalAlpha = a;
      if (f.k === "rain") {
        ctx.strokeStyle = "#c9f59a"; ctx.lineWidth = 1.5;
        for (const r of f.routes) {
          const rt = G.map.routes[r]; if (!rt) continue;
          for (let d = 10; d < rt.len; d += 22) {
            const p = TG.posOn(rt, d), off = (1 - a) * 14, j = (d * 7) % 9 - 4;
            ctx.beginPath(); ctx.moveTo(p.x + j - 5, p.y - 14 + off); ctx.lineTo(p.x + j, p.y - 2 + off); ctx.stroke();
          }
        }
      } else if (f.k === "freeze") {
        ctx.fillStyle = "#bfe6ff"; ctx.globalAlpha = a * 0.35; ctx.fillRect(0, 0, 300, 400);
        ctx.globalAlpha = a; ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "#e9f7ff"; ctx.fillText("❄ 冰封 ❄", 150, 200);
      } else if (f.k === "breath") {
        ctx.lineCap = "round"; ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 30 * (0.6 + 0.4 * a);
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = "#fff1c4"; ctx.lineWidth = 10 * a; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      } else if (f.k === "shot") {
        ctx.strokeStyle = "#c9f59a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      }
      ctx.restore();
    }
  });

  // ───── 結算：同伴經驗與升級
  U.add("end", (G, run, won) => {
    const i = C.idxOf(G); if (i < 0) return [];
    const id = G.heroes[i].id, h = TG.HEROES[id], d = data();
    C.rec(d, id);
    const behind = d.lv[id] < U.S.hero.lv;
    const xp = C.xpFor(won, won && G.stage ? TG.starsFor(G.lives) : 0, !!(run && run.heroic), G.stage ? 0 : G.wave, behind);
    if (d.lv[id] >= C.MAX) return [h.name + " 已經是最高等級 Lv" + C.MAX];
    const ups = C.gainXp(d, id, xp), out = [h.name + " 經驗 +" + xp + (behind ? "（追上騎士中，加倍）" : "")];
    for (const u of ups) out.push(h.name + " 升到 Lv" + u.lv + "！" + (u.perk ? "學會：" + u.perk : ""));
    U.save();
    return out;
  });

  // ───── 主選單：同伴一覽
  U.add("menu", { label: () => "同伴（" + unlocked().length + "／3）", icon: { kind: "hero", id: "elf", lv: 1 }, onClick: openRoster, unlockAt: C.unlock.elf });   // 第一位同伴解鎖時才出現（11-21 試玩 P3-17）
  function rosterHtml() {
    const u = unlocked(), cur = pick();
    const cards = C.ids.map(id => {
      const h = TG.HEROES[id], ok = u.includes(id), lv = lvOf(id), xp = data().xp[id] || 0, need = C.xpNeed(lv);
      const perks = C.perks[id].map(([n, t]) => '<div class="cmpPerk' + (ok && lv >= n ? " on" : "") + '">' + U.uic(ok && lv >= n ? "check" : "lock", false) + " Lv" + n + "　" + esc(t) + "</div>").join("");
      return '<div class="card"><div class="cmpHead">' + av(id, !ok) + "<div><b>" + h.name + "</b><small>" + ROLE[h.role] + "</small></div></div>" +
        '<div class="cmpLine">' + U.uic("book", false) + '<span>文法領域：<em>' + esc(h.domain) + '</em></span></div><div class="cmpLine">' + U.uic("spark", false) + "<span>大招「" + esc(h.ult) + "」：" + esc(h.ultDesc) + "</span></div>" +
        (ok ? "<div>等級 Lv" + lv + (lv >= C.MAX ? "（最高）" : "　經驗 " + xp + "／" + need) + '</div><div class="cmpXp"><i style="width:' + (lv >= C.MAX ? 100 : Math.round(xp * 100 / need)) + '%"></i></div>'
          : '<div class="cmpLine" style="color:#F3D494">' + U.uic("lock", false) + '<span>解鎖條件：通過 ' + C.unlock[id] + " 關（目前 " + U.cleared() + " 關）</span></div>") +
        perks +
        (ok ? '<button class="cmpBtn' + (cur === id ? " on" : "") + '" data-cmpset="' + id + '">' + (cur === id ? "已設為出征同伴" : "設為出征同伴") + "</button>" : "") +
        "</div>";
    }).join("");
    return "<h2>" + U.icHtml("hero", "elf", 1, 32, 32) + "同伴</h2><p>第 3 區起，出征可以多帶 1 位同伴。<br>戰鬥中點英雄可以切換，再點路面就能移動。<br>答對題目累積能量，花 " + costNow() + " 格能量就能放出同伴的大招。</p>" + cards +
      '<button class="big ghost" id="cmpBack">' + U.uic("back", false) + '回主選單</button>';
  }
  function openRoster() {
    U.show(null);
    let ov = document.getElementById("ovCmp");
    if (!ov) { ov = document.createElement("div"); ov.className = "ov"; ov.id = "ovCmp"; document.getElementById("app").appendChild(ov); }
    ov.innerHTML = rosterHtml(); ov.classList.remove("hide"); U.paintIcons(ov);
    ov.onclick = ev => {
      const set = ev.target.closest("[data-cmpset]");
      if (set) { const d = data(); d.pick = d.pick === set.dataset.cmpset && pick() === set.dataset.cmpset ? "none" : set.dataset.cmpset; U.save(); ov.innerHTML = rosterHtml(); U.paintIcons(ov); return; }
      if (ev.target.closest("#cmpBack")) { ov.remove(); U.show("ovMenu"); U.menuInfo(); }
    };
  }
  U.openCompanions = openRoster;   // 測試／截圖用

  // ───── 瀏覽器機器人：適當時機放同伴大招；第 2 波時試一次「點同伴→點路面」移動
  window.TGBOT = (window.TGBOT || []).concat((T, G, c) => {
    if (T.sheetMode || !G || G.over) return false;
    const i = C.idxOf(G); if (i < 0) return false;
    const h = G.heroes[i];
    if (!c.cmpMoved && G.wave >= 2 && h.dead <= 0) {
      c.cmpMoved = 1;
      const cv = document.getElementById("cv"), r = cv.getBoundingClientRect();
      const tap = (x, y) => cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + x / 300 * r.width, clientY: r.top + y / 400 * r.height, bubbles: true }));
      tap(h.x, h.y);
      const rt = G.map.routes[h.id === "dragon" ? 0 : G.map.routes.length - 1], p = TG.posOn(rt, rt.len * 0.3);
      if (T.run.selHero === i) { tap(p.x, p.y); if (H(h.tx - p.x, h.ty - p.y) < 3) c.cmpMove = 1; }
      return true;
    }
    if (G.waveActive && C.canUlt(G, i) && C.wantUlt(G, h) && !(C.botSaveForUp && C.botSaveForUp(G, i))) {   // 11-23：先留能量升級（同 node 機器人）
      castUlt(G, i); c.cmpUlt = (c.cmpUlt || 0) + 1; return true; }
    return false;
  });
})();
