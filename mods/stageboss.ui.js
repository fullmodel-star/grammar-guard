// 外掛：stageboss（畫面端）— 關卡魔王與超大魔王的外觀、登場演出、放招提示、敲城門警告、打倒演出、簡報說明（2026-11-25；引擎端 mods/stageboss.js）
// 11-25 晚老闆新規則：魔王（每關最後一波的關卡魔王、每區最後的超大魔王）走到城門會停下來敲城門（約每 2 秒扣 1 命，超大魔王更快），一定要打倒才過關。
//   引擎事件（mods/stageboss.js＋engine.js）：sbGate { e }（魔王第一次停到城門；之後 e.atGate＝true）、sbGateHit { e, n }（敲一下，n＝扣幾命，0＝被擋下）、sbKill { e, super, gold }（魔王被打倒）。
(function () {
  "use strict";
  const U = window.TGUI, TG = window.TG, ART = window.ART;
  if (!U || !TG || !TG.STAGE_BOSS) return;
  const esc = U.esc;
  const nowS = () => (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
  const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // 外觀：關卡魔王＝原型怪放大 2 倍＋色調＋王冠；超大魔王＝區域魔王畫大 1.25 倍
  if (ART && ART.defStageBoss) for (const k in TG.STAGE_BOSS) { const d = TG.STAGE_BOSS[k]; if (TG.ENEMIES[d.id]) ART.defStageBoss(d.id, d.base, { color: d.color, scale: d.base === "golem" || d.base === "goblin" ? 1.8 : 2 }); }
  if (ART && ART.superBoss) { const done = {}; for (const st of TG.STAGES) if (st.boss && st.bossType && !done[st.bossType]) { done[st.bossType] = 1; ART.superBoss(st.bossType, 1.25); } }

  // 登場橫幅副標用的短句（手感外掛的中央橫幅副標是畫布 11px、不會自動縮字，300 寬內要放得下：控制在 18 個字內）
  const MECH_SHORT = {
    summon: d => "招式：叫小怪，每次叫出 " + (d.n || TG.SB.summonN) + " 隻",
    guard: () => "招式：護盾，張開時塔只打出三成傷害",
    dash: () => "招式：衝刺，突然變兩倍快",
    heal: () => "招式：回血，幫自己和旁邊的怪補血"
  };
  // 簡報「最後一波魔王」卡名字下面的招式短句（11-25 試玩：原本的「👑 魔王招式」卡藏在「詳細」最底下、摘要被切成「魔王招式：B」→ 併進這張卡）
  const MECH_BRIEF = {
    summon: d => "叫小怪：每隔一段時間叫出 " + (d.n || TG.SB.summonN) + " 隻",
    guard: () => "護盾：張開 " + TG.SB.guardT + " 秒，這時塔只打出三成傷害",
    dash: () => "衝刺：突然變兩倍快，路的後段要多蓋塔",
    heal: () => "回血：幫自己和旁邊的怪補血，越快打倒越好"
  };
  // 超大魔王（區域魔王）的招式短句：先答題玩法守城不出題，說法不同（.pfon／.pfoff 由 index.html 依簡報上的「玩法」切換顯示）
  const pfSpan = (on, off) => on === off ? esc(on) : '<span class="pfoff">' + esc(off) + '</span><span class="pfon">' + esc(on) + '</span>';
  const SUPER_BRIEF = {
    be: ["很硬，路的後段多蓋塔、多升級", "會叫出 am／is／are 小怪，點對的那隻才打得傷牠"],
    seal: ["很硬，路的後段多蓋塔、多升級", "會封住塔，答對題目就能解封"],
    hydra: ["會長新頭：過幾秒自己枯掉，有能量可以點牠砍頭", "會長新頭：答對片語題就砍掉它"],
    lich: ["會張冰盾：撐幾秒就被塔磨掉，有能量可以點牠破盾", "會張冰盾：把句子排好就能打破"],
    dragon: ["三個階段，輪流用前面魔王的招式", "三個階段，輪流用前面魔王的招式"]
  };
  // 敲城門的秒數讀引擎（TG.SB.gateEvery／gateEverySuper；mods/stageboss.js），沒有就寫約 2 秒
  const secTxt = v => (Math.round(v * 10) / 10).toString();
  const gateTxt = sup => { const C = TG.SB || {}, v = sup ? (C.gateEverySuper || C.gateEvery) : C.gateEvery;
    return "走到城門會停下來一直敲（約每 " + (v ? secTxt(v) : "2") + " 秒扣 1 命" + (sup && !C.gateEverySuper ? "，敲得更快" : "") + "），一定要打倒牠才過關"; };
  const atGate = e => !!(e && (e.atGate || e.sbAtGate));   // 引擎：e.atGate（停在城門）；e.sbGate 只是「這隻會守城門」的標記
  // index.html 的簡報「會出現的怪 → 最後一波魔王」卡呼叫：回傳放在名字下面的 HTML
  function briefLines(st) {
    if (!st || !st.bossType) return "";
    const b = TG.ENEMIES[st.bossType]; if (!b) return "";
    const d = TG.STAGE_BOSS[st.i] || {}, sup = !!st.boss;
    let mech = "";
    if (!sup && b.sb && MECH_BRIEF[b.sb]) mech = esc(MECH_BRIEF[b.sb](d));
    else if (sup && SUPER_BRIEF[b.mech]) mech = pfSpan(SUPER_BRIEF[b.mech][0], SUPER_BRIEF[b.mech][1]);
    const fly = b.fly ? '<span class="sb-l">🦇 會飛：要用弓箭塔、魔法塔才打得到</span>' : "";
    return (mech ? '<span class="sb-l sb-m">' + mech + '</span>' : "") + fly + '<span class="sb-l sb-g">🏰 ' + esc(gateTxt(sup)) + '</span>';
  }

  const FX = { summon: ["叫小怪！", "#ffd75e"], guard: ["護盾！", "#9bd4ff"], dash: ["衝刺！", "#ff9d5c"], heal: ["回血！", "#7fe3b0"] };
  const J = () => U.juice && typeof U.juice.centerBanner === "function" ? U.juice : null;

  // 沒有手感外掛時的備用 DOM 橫幅（2.4 秒）
  let banner = null, bannerT = 0;
  function showBanner(txt, sub, big) {
    const app = document.getElementById("app") || document.body;
    if (!banner) {
      banner = document.createElement("div"); banner.id = "sbBanner"; app.appendChild(banner);
      const css = document.createElement("style"); css.textContent =
        "#sbBanner{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.9);z-index:14;pointer-events:none;text-align:center;padding:10px 16px;border-radius:14px;background:linear-gradient(180deg,rgba(60,12,30,.92),rgba(24,8,20,.92));border:2px solid #e0566a;box-shadow:0 0 24px rgba(224,86,106,.6);color:#ffe2d6;opacity:0;transition:opacity .25s,transform .25s;width:max-content;max-width:86%;box-sizing:border-box}" +
        "#sbBanner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}#sbBanner b{display:block;font-family:var(--serif,serif);font-size:clamp(17px,5.2vw,21px);color:#ffd0a0;letter-spacing:1px;line-height:1.3}" +
        "#sbBanner small{display:block;font-size:13px;margin-top:4px;color:#ffe9d0}#sbBanner.big{border-color:#ffd75e;box-shadow:0 0 34px rgba(255,215,94,.75)}#sbBanner.big b{font-size:clamp(18px,5.6vw,23px);color:#ffe07a}" +
        "@media (prefers-reduced-motion:reduce){#sbBanner{transition:none}}";
      document.head.appendChild(css);
    }
    banner.className = big ? "big" : ""; banner.innerHTML = "<b>" + esc(txt) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "");
    requestAnimationFrame(() => banner.classList.add("on")); bannerT = 2.4;
  }

  // ───── 畫面狀態（真實時間，結算後的打倒演出也照常播）
  let floats = [], rings = [], gateWarn = null, killShow = null, lastLives = null;
  const gateSeen = new WeakSet();
  const castleXY = G => { const m = G && G.map, e = m && m.end; return e ? { x: e[0], y: Math.min(e[1], 380) } : { x: 150, y: 380 }; };
  const headTop = e => (ART && ART.enemyTop ? ART.enemyTop(e.type) : -34);
  // 放招飄字（11-25 試玩：「叫小怪！」被傷害數字蓋住看不到）：自己畫，深色圓角底、從頭頂上方再往上飄，畫在傷害數字上面
  function addFloat(text, x, y, col, size) { floats.push({ text, x, y, col, size: size || 12, t0: nowS(), T: 1.4 }); if (floats.length > 8) floats.shift(); }
  function healRings(G, e) {
    const t0 = nowS(), z = ART && ART.enemySize ? ART.enemySize(e.type) : { w: 40, h: 50, foot: 16 }, fy = e.y + (z.foot || 0);
    rings.push({ x: e.x, y: fy - z.h * 0.45, r0: z.w * 0.35, r1: z.w * 0.9 + 10, t0, T: 0.9, w: 3.5 });
    rings.push({ x: e.x, y: fy - z.h * 0.45, r0: z.w * 0.2, r1: z.w * 0.7 + 6, t0: t0 + 0.18, T: 0.8, w: 2.5 });
    const R = (TG.SB && TG.SB.healR) || 60;
    for (const o of G.enemies) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < R) rings.push({ x: o.x, y: o.y - 10, r0: 4, r1: 16, t0: t0 + 0.1, T: 0.7, w: 2 });
    if (rings.length > 24) rings.splice(0, rings.length - 24);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function pill(ctx, text, x, y, size, col, bg, edge) {
    ctx.font = "900 " + size + "px system-ui,'Microsoft JhengHei',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + size * 1.1, h = size + 8, xx = Math.max(w / 2 + 2, Math.min(298 - w / 2, x));
    ctx.fillStyle = bg; roundRect(ctx, xx - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.fillStyle = col; ctx.fillText(text, xx, y + 0.5);
  }

  U.add("start", () => { floats = []; rings = []; gateWarn = null; killShow = null; lastLives = null; bannerT = 0; if (banner) banner.classList.remove("on"); });
  U.add("frame", (G, run, real) => {
    if (bannerT > 0 && (bannerT -= real) <= 0 && banner) banner.classList.remove("on");
    lastLives = G.lives;
  });
  U.add("end", () => { bannerT = 0; if (banner) banner.classList.remove("on"); gateWarn = null; });
  U.add("event", (ev, G, run) => {
    if (ev.k === "sbIntro" && ev.e) {
      const b = TG.ENEMIES[ev.e.type] || {};
      // 有手感外掛：關卡魔王把招式短句併進牠那張「魔王登場」；超大魔王也併成同一張（11-25 試玩小安：第 4 關原本連播兩張約 4.6 秒、蓋住六成地圖）
      const j = J();
      if (ev.super) {
        const o = { upgrade: true, label: "區域最後一關", name: "超大魔王「" + b.name + "」", sub: "一定要打倒牠，才能破這一區", col: "#ffe07a", T: 2.6 };
        if (j) j.centerBanner(o);
        else showBanner("超大魔王「" + b.name + "」來襲！", o.sub, true);
        U.beep(110, .5, "sawtooth", .06); setTimeout(() => U.beep(90, .6, "sawtooth", .06), 250);
      } else {
        const d = TG.STAGE_BOSS[G.stage ? G.stage.i : -1] || {}, sub = MECH_SHORT[b.sb] ? MECH_SHORT[b.sb](d) : "";
        if (j) j.centerBanner({ merge: true, name: "魔王「" + b.name + "」", sub, col: "#ffd75e", T: 2.4 });
        else showBanner("魔王「" + b.name + "」登場！", sub, false);
        U.beep(160, .4, "square", .05);
      }
    } else if (ev.k === "sbMech" && ev.e) {
      const f = FX[ev.mech];
      if (f) addFloat(f[0], ev.e.x, ev.e.y + headTop(ev.e) - 16, f[1], 12);
      if (ev.mech === "heal") healRings(G, ev.e);
    } else if (ev.k === "sbGate" && ev.e) {
      if (gateSeen.has(ev.e)) return; gateSeen.add(ev.e);
      // 只跳一次（同一局第一次有魔王到城門）；畫在畫布上，不蓋按鈕
      if (!gateWarn || gateWarn.done) gateWarn = { t0: nowS(), T: 2.6, done: false, once: true, e: ev.e };
      U.beep(140, .25, "square", .06); setTimeout(() => U.beep(140, .25, "square", .06), 280);
    } else if (ev.k === "sbGateHit" && ev.e) {
      // 每敲一下：城門跳「咚！−1」；被城堡護盾卡／守護結界擋下＝「擋下了！」
      const c = castleXY(G); addFloat(ev.n > 0 ? "咚！−" + ev.n : "擋下了！", c.x + (ev.e.x < c.x ? 26 : -26), Math.min(c.y, 380) - 18, ev.n > 0 ? "#ffb0a0" : "#bfe6ff", 13);
      if (ev.n > 0) U.beep(95, .12, "square", .05);
    } else if (ev.k === "sbKill" && ev.e) {
      const b = TG.ENEMIES[ev.e.type] || {}, sup = !!ev.super, e = ev.e;
      const gold = (ev.gold | 0) || (b.gold | 0);   // 引擎給的打倒獎金（TG.SB.killGold）；沒有就寫牠本身的金幣
      killShow = { t0: nowS(), T: sup ? 2.6 : 1.9, sup, x: e.x, y: e.y + headTop(e) * 0.5, name: b.name || "魔王", gold, bonus: !!ev.gold };
      if (gold) addFloat((ev.gold ? "魔王獎金 +" : "+") + gold + " 金幣", e.x, e.y + headTop(e) - 20, "#ffe07a", sup ? 15 : 13);
      // 打倒魔王常常就是最後一隻怪：結算畫面等演出播完再出來（index.html 讀 run.sbHoldUntil）
      if (run) run.sbHoldUntil = performance.now() + (sup ? 2400 : 1700);
      gateWarn = null;
      const fs = sup ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
      fs.forEach((f, i) => setTimeout(() => U.beep(f, .22, "triangle", .05), i * 90));
    }
  });

  // 護盾、衝刺中：魔王身邊畫一圈（藍＝護盾、橘＝衝刺）。依 ART.enemySize 圈住整隻（腳底＝e.y＋foot，身體中心＝腳底＋b−h/2）
  const lastX = new WeakMap(), dirOf = new WeakMap();   // 衝刺速度線畫在身後：自己記左右方向
  U.add("drawTop", (ctx, G) => {
    const now = performance.now() / 1000, t = nowS();
    for (const e of G.enemies) {
      if (!(e.sbGuardT > 0 || e.sbDashT > 0)) continue;
      const z = ART && ART.enemySize ? ART.enemySize(e.type) : { w: 40, h: 50, foot: 16, b: 0 }, bd = ART && ART.ENEMY_DEFS && ART.ENEMY_DEFS[e.type];
      const fy = e.y + (z.foot || 0), bb = bd ? bd.body.b : 0, pul = Math.sin(now * 10) * 1.5;
      ctx.save(); ctx.lineWidth = 2.5;
      if (e.sbGuardT > 0) {
        const cy = fy + bb - z.h / 2, rx = z.w * 0.62 + 6 + pul, ry = z.h * 0.56 + 4 + pul;
        ctx.fillStyle = "rgba(155,212,255,.14)"; ctx.strokeStyle = "rgba(155,212,255,.9)";
        ctx.beginPath(); ctx.ellipse(e.x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        const px = lastX.get(e); if (px !== undefined && Math.abs(e.x - px) > 0.02) dirOf.set(e, e.x > px ? 1 : -1); lastX.set(e, e.x);
        const rx = z.w * 0.7 + 4 + pul, ry = Math.max(6, z.w * 0.24), dir = dirOf.get(e) || 1;
        ctx.strokeStyle = "rgba(255,157,92,.9)"; ctx.beginPath(); ctx.ellipse(e.x, fy + 1, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,190,120,.75)";
        for (const k of [0.35, 0.65]) { const yy = fy + bb - z.h * k, x0 = e.x - dir * (z.w * 0.55 + 2); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - dir * (10 + 4 * Math.sin(now * 14 + k * 9)), yy); ctx.stroke(); }
      }
      ctx.restore();
    }
    // 回血：綠色光圈（11-25 試玩小明：護盾、衝刺都有圈，只有回血沒有）
    if (rings.length) {
      ctx.save();
      rings = rings.filter(r => t - r.t0 < r.T);
      for (const r of rings) {
        const u = (t - r.t0) / r.T; if (u < 0) continue;
        ctx.globalAlpha = Math.max(0, 1 - u); ctx.strokeStyle = "#7fe3b0"; ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - u) * (1 - u)), 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.18 * Math.max(0, 1 - u); ctx.fillStyle = "#7fe3b0"; ctx.fill();
      }
      ctx.restore();
    }
    // 魔王在敲城門：城門一圈紅光一直閃（引擎設 e.atGate）
    const gateOn = G.enemies.filter(atGate);
    if (gateOn.length) {
      const c = castleXY(G), p = 0.5 + 0.5 * Math.sin(now * 9), sup = gateOn.some(e => !(TG.ENEMIES[e.type] || {}).sb);
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.25 * p; ctx.fillStyle = "#ff3b3b"; ctx.beginPath(); ctx.arc(c.x, c.y, (sup ? 34 : 30) + 4 * p, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.7 + 0.3 * p; ctx.strokeStyle = "#ff8a8a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, (sup ? 40 : 34) + 6 * p, 0, 7); ctx.stroke();
      ctx.restore();
    }
    // 敲城門警告：只跳一次，畫在城門上方（不蓋按鈕；2.6 秒）
    if (gateWarn && !gateWarn.done) {
      const u = (t - gateWarn.t0) / gateWarn.T;
      if (u >= 1) gateWarn.done = true;
      else {
        const c = castleXY(G), a = Math.min(1, u / 0.08, (1 - u) / 0.15), y = Math.max(44, Math.min(330, gateWarn.e ? gateWarn.e.y + headTop(gateWarn.e) - 26 : c.y - 70))   /* 畫在魔王頭頂上方，不蓋住魔王 */, sh = reduced ? 0 : Math.sin(t * 40) * 1.5 * Math.max(0, 1 - u * 3);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(90,8,16,.92)"; roundRect(ctx, 22 + sh, y - 17, 256, 34, 9); ctx.fill();
        ctx.strokeStyle = "#ff6a6a"; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = "900 14px system-ui,'Microsoft JhengHei',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 3; ctx.strokeStyle = "#2a0006"; ctx.strokeText("魔王在敲城門！快打倒牠！", 150 + sh, y + 0.5);
        ctx.fillStyle = "#ffe2d6"; ctx.fillText("魔王在敲城門！快打倒牠！", 150 + sh, y + 0.5);
        ctx.restore();
      }
    }
    // 放招飄字、金幣飄字：深色圓角底＋往上飄（畫在傷害數字上面）
    if (floats.length) {
      floats = floats.filter(f => t - f.t0 < f.T);
      for (const f of floats) {
        const u = (t - f.t0) / f.T, a = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
        ctx.save(); ctx.globalAlpha = Math.max(0, a);
        pill(ctx, f.text, f.x, Math.max(16, f.y - 16 * (1 - (1 - u) * (1 - u))), f.size, f.col, "rgba(10,14,32,.88)", f.col);
        ctx.restore();
      }
    }
    // 打倒魔王：金光爆開＋大字（超大魔王更大、更久）
    if (killShow) {
      const k = killShow, u = (t - k.t0) / k.T;
      if (u >= 1) killShow = null;
      else {
        const a = Math.min(1, u / 0.08, (1 - u) / 0.2), R = (k.sup ? 70 : 50) * (0.4 + 0.6 * Math.min(1, u / 0.35));
        ctx.save();
        ctx.globalAlpha = 0.5 * a; ctx.fillStyle = "#ffd75e"; ctx.beginPath(); ctx.arc(k.x, k.y, R, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = "#fff3b8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(k.x, k.y, R * 1.25, 0, 7); ctx.stroke();
        if (!reduced) { ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6 + u * 1.2, r0 = R * 0.9, r1 = R * (1.4 + 0.3 * Math.sin(i * 2.3)); ctx.beginPath(); ctx.moveTo(k.x + Math.cos(an) * r0, k.y + Math.sin(an) * r0); ctx.lineTo(k.x + Math.cos(an) * r1, k.y + Math.sin(an) * r1); ctx.stroke(); } }
        // 大字：畫面中線，上下置中於地圖 40% 處
        const pop = reduced ? 1 : 1 + 0.35 * Math.max(0, 1 - u / 0.12), fs = (k.sup ? 30 : 24) * pop, y = 150;
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(40,24,4,.85)"; roundRect(ctx, 14, y - fs * 0.9, 272, fs * 1.8 + (k.sup ? 14 : 12), 12); ctx.fill();
        ctx.strokeStyle = "#ffd75e"; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = "900 " + fs.toFixed(1) + "px system-ui,'Microsoft JhengHei',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const big = k.sup ? "打倒超大魔王！" : "打倒魔王！";
        ctx.lineWidth = 5; ctx.strokeStyle = "#3a1c00"; ctx.strokeText(big, 150, y); ctx.fillStyle = "#ffe07a"; ctx.fillText(big, 150, y);
        ctx.font = "bold " + (k.sup ? 13 : 12) + "px system-ui,'Microsoft JhengHei',sans-serif"; ctx.fillStyle = "#fff3d6";
        ctx.fillText(k.name + (k.gold ? (k.bonus ? "　獎金 +" : "　+") + k.gold + " 金幣" : ""), 150, y + fs * 0.62 + 6, 260);
        ctx.restore();
      }
    }
  });
  window.TGSB = { showBanner, briefLines, gateTxt };
})();
