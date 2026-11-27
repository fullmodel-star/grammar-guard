// 外掛：terrain（畫面端，只在瀏覽器載入）。迷霧／夜戰＋冰面／岩漿的簡報卡、提示、繪圖、底部按鈕與機器人應對。
// v3（2026-11-22）：拿掉「驅霧／照明」答題鈕（任何答對本來就會驅霧）；岩漿「冷卻」鈕改成花能量立刻全冷卻（不答題），
//   任何題目答對會自動冷卻最燙的 1 座。這支外掛不再出任何題目。
(function () {
  if (!window.TGUI || !window.TG) return;
  const U = window.TGUI, TG = window.TG, D = TG.TERRAIN;

  // 存檔：S.mods.terrain = { seen:{fog:1,...}, clears, cools }（舊存檔沒有這欄也能用）
  function mem() {
    const S = U.S; if (!S.mods || typeof S.mods !== "object") S.mods = {};
    let m = S.mods.terrain; if (!m || typeof m !== "object") m = S.mods.terrain = {};
    if (!m.seen || typeof m.seen !== "object") m.seen = {};
    m.clears = +m.clears || 0; m.cools = +m.cools || 0;
    return m;
  }
  const isSight = G => G && (G.terrain === "fog" || G.terrain === "night");

  // ── 規則文字（簡報卡）
  // 先備戰再守城（11-25 試玩）：守城不出題 → 改說「備戰答對＝下一波整波沒霧／照亮」（簡報時看玩法選擇，開局後看這一局）
  const pfW = () => { try { const G = U.G; if (G && !G.over && TG.pfOn) return TG.pfOn(G); return !!(window.TGPF && TGPF.want()); } catch (e) { return false; } };
  const RULE = () => ({
    fog: [
      "霧裡的塔看不遠（射程 ×0.7）。",
      pfW() ? "✔ <b>備戰時答對題目</b> → 下一波整波沒霧，射程恢復。" : "✔ <b>任何題目答對</b> → 全場驅霧 " + D.fog.clearT + " 秒，射程恢復。",
      "🤺 英雄身邊的塔看得清，可以移動英雄去幫忙。"
    ],
    night: [
      "夜晚塔看不遠（射程 ×0.8）。英雄身上有光，附近的塔不受影響。",
      pfW() ? "✔ <b>備戰時答對題目</b> → 下一波整波照亮全場。" : "✔ <b>任何題目答對</b> → 放照明彈，照亮全場 " + D.night.clearT + " 秒。",
      "🧊 淺藍色的冰面很滑：地面怪走上去會忽快忽慢（飛行怪不受影響）。"
    ],
    lava: [
      "約每 " + D.lava.every + " 秒岩漿噴發，噴發前 " + D.lava.warn + " 秒會出現紅圈。",
      "🔥 空塔位被岩漿封住 " + D.lava.blockT + " 秒，不能蓋塔。",
      "🌡️ 塔被噴到會「烤熱」停火 " + D.lava.hotT + " 秒。✔ <b>任何題目答對</b> → 最燙的那座立刻冷卻。",
      "🧯 下方「冷卻」按鈕：花 ⚡" + costTxt() + " 能量，烤熱的塔全部立刻恢復。答錯也不會更糟。"
    ]
  });   // 函式：岩漿冷卻的能量價格開局時才算（卡片／每日規則可能改價）
  function costTxt(G) { try { return TG.energyCost("lavaCool", G || U.G || null); } catch (e) { return (TG.ENERGY_COST && TG.ENERGY_COST.lavaCool) || 2; } }
  const START_PF = { fog: "🌫️ 迷霧：塔看不遠，備戰時答對題目，下一波就沒霧！", night: "🌙 夜戰：英雄身邊有光，備戰時答對題目，下一波就照亮全場！小心冰面" };
  const START = {
    fog: "🌫️ 迷霧：塔看不遠，答對題目就能驅霧！",
    night: "🌙 夜戰：英雄身邊有光，答對放照明彈！小心冰面",
    lava: "🌋 岩漿：紅圈會噴發，塔被烤熱時答對題目就會冷卻！"
  };

  U.add("brief", st => {
    const t = st && st.terrain; if (!t || !D[t]) return "";
    const fresh = !mem().seen[t];
    return '<div class="card"><h4>' + D[t].em + " 本關地形：" + D[t].name + (fresh ? ' <span class="reward">新！</span>' : "") + "</h4>" +
      RULE()[t].map(x => "<div>" + x + "</div>").join("") + "</div>";
  });

  U.add("start", (G, run) => {
    if (!G.terrain) return;
    run.trToast = 2;           // 開場提示晚一點出，避免被「先蓋塔」的提示蓋掉
    run.trA = 1;               // 霧／夜色的濃度（0～1，畫面淡入淡出用）
    const m = mem(); m.seen[G.terrain] = 1; U.save();
  });

  U.add("frame", (G, run, real) => {
    if (!G.terrain) return;
    if (run.trToast > 0 && (run.trToast -= real) <= 0) U.toast((TG.pfOn && TG.pfOn(G) && START_PF[G.terrain]) || START[G.terrain]);
    if (isSight(G)) { const target = G.tr.clearT > 0 ? 0 : 1; run.trA += Math.sign(target - run.trA) * Math.min(Math.abs(target - run.trA), real * 1.5); }
  });

  U.add("event", (ev, G) => {
    if (ev.k === "terrainClear" && ev.fresh) {
      U.fx(ev.terrain === "fog" ? "霧散了！" : "照明彈！", 150, 70, "#fff6c2"); U.beep(1050, .25, "sine", .04);
      const m = mem(); m.clears++;
    } else if (ev.k === "lavaWarn") {
      U.toast("🌋 岩漿快噴發了！小心紅圈"); U.beep(160, .3, "sawtooth", .04);
    } else if (ev.k === "lavaErupt") {
      if (ev.hot.length) U.toast("🔥 " + ev.hot.length + " 座塔被烤熱！答對題目冷卻，或按 🧯 花能量全冷卻");
      else if (ev.blocked.length) U.toast("🌋 岩漿封住了 " + ev.blocked.length + " 個塔位");
      U.beep(90, .5, "sawtooth", .06);
    } else if (ev.k === "lavaCool") {
      const m = mem(); m.cools++;
      for (const id of ev.ids || []) { const tw = G && G.towers.find(t => t.id === id); if (tw) U.fx(ev.all ? "全部冷卻！" : "冷卻！", tw.x, tw.y - 18, "#bfe6ff"); }
      if (ev.all) U.beep(1250, .2, "sine", .04); else U.beep(980, .1, "sine", .03);
    }
  });

  // ── 岩漿「冷卻」鈕：花能量立刻全冷卻（不答題、不開面板；能量只經過引擎 spendEnergy）
  function coolAll() {
    const G = U.G; if (!G || G.terrain !== "lava" || G.over) return false;
    if (!TG.terrainHot(G).length) return false;
    if (!TG.terrainCanCoolAll(G)) { U.toast("能量不夠（要 ⚡" + costTxt(G) + "）：答對任何題目也會冷卻最燙的那座"); return false; }
    const n = TG.terrainHot(G).length, ok = TG.terrainCoolAll(G);
    if (ok) U.toast("❄️ " + n + " 座塔冷卻完成！");
    if (U.renderBar) U.renderBar();
    return ok;
  }
  U.add("bar", {
    em: "🧯", label: "冷卻",
    show: G => G && G.terrain === "lava",
    state: G => {
      const n = TG.terrainHot(G).length, c = costTxt(G), can = n > 0 && TG.canSpend(G, c);
      return { disabled: !can, ready: can, label: n ? "冷卻×" + n + " ⚡" + c : "冷卻 ⚡" + c };
    },
    onClick: coolAll
  });

  // 點烤熱的塔：提示怎麼冷卻（不開題目、不關任何面板；塔面板照常打開）；點被封的塔位 → 提示秒數
  let hintT = 0;
  U.add("tap", (x, y, G) => {
    if (!G || G.terrain !== "lava") return false;
    const i = G.map.slots.findIndex(([sx, sy]) => Math.hypot(sx - x, sy - y) < 18); if (i < 0) return false;
    const tw = G.towers.find(t => t.slot === i);
    if (tw && (G.tr.hot[tw.id] || 0) > 0) {
      const now = performance.now();
      if (now - hintT > 4000) { hintT = now; U.toast("🔥 烤熱中：答對任何題目會冷卻最燙的塔，或按 🧯 花 ⚡" + costTxt(G) + " 全冷卻"); }
      return false;
    }
    if (!tw && TG.terrainBlocked(G, i)) { if (U.sheetMode === "build" || U.sheetMode === "tower") U.closeSheet(); U.toast("岩漿還在燒，" + Math.ceil(G.tr.block[i]) + " 秒後才能蓋塔"); return true; }
    return false;
  });

  // ── 繪圖
  function strokeAlong(ctx, rt, d0, d1) {
    ctx.beginPath();
    for (let d = d0, k = 0; d <= d1 + 0.01; d += 6, k++) { const p = TG.posOn(rt, Math.min(d, d1)); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }
  U.add("drawGround", (ctx, G) => {
    if (G.terrain === "night") {
      ctx.save(); ctx.lineCap = "butt";
      for (const z of G.tr.ice) {
        const rt = G.map.routes[z.r];
        ctx.strokeStyle = "rgba(214,244,255,.62)"; ctx.lineWidth = 22; strokeAlong(ctx, rt, z.d0, z.d1);
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]); strokeAlong(ctx, rt, z.d0, z.d1); ctx.setLineDash([]);
      }
      ctx.restore();
      // 冰上滑行的怪：腳下白色殘影
      for (const e of G.enemies) if (e.iceMul) { ctx.fillStyle = e.iceMul > 1.15 ? "rgba(255,255,255,.55)" : "rgba(170,220,255,.4)"; ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, 9, 3, 0, 0, 7); ctx.fill(); }
    }
    if (G.terrain === "lava") {
      G.map.slots.forEach(([x, y], i) => {
        const t = G.tr.block[i] || 0; if (t <= 0 || G.towers.some(w => w.slot === i)) return;
        const g = ctx.createRadialGradient(x, y, 2, x, y, 16); g.addColorStop(0, "#ffd36b"); g.addColorStop(.5, "#ff6a2a"); g.addColorStop(1, "rgba(120,20,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(x, y - 6); ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(5, -1, 3.5, 3); ctx.quadraticCurveTo(0, 6, -3.5, 3); ctx.quadraticCurveTo(-5, -1, 0, -6); ctx.fillStyle = "#ff7a2e"; ctx.fill(); ctx.strokeStyle = "#2a0f05"; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 2, 1.6, 2.4, 0, 0, 7); ctx.fillStyle = "#ffd75e"; ctx.fill(); ctx.restore();   // 11-21 美術改版：自繪火焰取代 emoji
        ctx.font = "bold 9px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(Math.ceil(t) + "s", x, y + 9);
      });
    }
  });

  let oc = null, octx = null;
  function overlay(ctx, G, run) {
    const A = Math.max(0, Math.min(1, run.trA == null ? 1 : run.trA)); if (A <= 0.01) return;
    if (!oc) { oc = document.createElement("canvas"); oc.width = 150; oc.height = 200; octx = oc.getContext("2d"); }
    const o = octx, fog = G.terrain === "fog", t = G.time || 0, light = D[G.terrain].light;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "source-over"; o.clearRect(0, 0, 150, 200);
    o.setTransform(.5, 0, 0, .5, 0, 0);
    if (fog) {
      // 11-22：原本全場一層 .5 的灰霧＋.35 霧團，霧開著時地景幾乎看不清 → 改成「邊緣濃、中間淡」：
      //   全場薄霧 .2、四周往外加到約 .55（地圖邊緣與出怪口仍是一片白，看得出「需要驅霧」），霧團 .22 繼續飄
      o.fillStyle = "rgba(196,210,200,.2)"; o.fillRect(0, 0, 300, 400);
      const vg = o.createRadialGradient(150, 200, 70, 150, 200, 260);
      vg.addColorStop(0, "rgba(204,216,208,0)"); vg.addColorStop(0.55, "rgba(204,216,208,.16)"); vg.addColorStop(1, "rgba(212,222,214,.42)");
      o.fillStyle = vg; o.fillRect(0, 0, 300, 400);
      for (let i = 0; i < 7; i++) {   // 飄動的霧團
        const x = (i * 97 + t * 6 * (i % 2 ? 1 : -1)) % 360 - 30, y = 30 + i * 55, r = 55 + (i % 3) * 15;
        const g = o.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(225,232,226,.22)"); g.addColorStop(1, "rgba(225,232,226,0)");
        o.fillStyle = g; o.fillRect(x - r, y - r, r * 2, r * 2);
      }
    } else { o.fillStyle = "rgba(8,12,38,.55)"; o.fillRect(0, 0, 300, 400); }
    o.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, a) => { const g = o.createRadialGradient(x, y, r * .35, x, y, r); g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); o.fillStyle = g; o.beginPath(); o.arc(x, y, r, 0, 7); o.fill(); };
    for (const tw of G.towers) {
      const r = TG.fold("towerStats", TG.towerStats(tw.type, tw.lv, tw.branch), tw, G).range;
      hole(tw.x, tw.y, Math.max(18, r), fog ? .75 : .55);
    }
    for (const h of G.heroes) if (h.dead <= 0) hole(h.x, h.y, light, 1);
    ctx.save(); ctx.globalAlpha = A; ctx.drawImage(oc, 0, 0, 300, 400); ctx.restore();
    // 英雄光圈的邊
    if (A > .3) for (const h of G.heroes) if (h.dead <= 0) { ctx.strokeStyle = fog ? "rgba(255,255,255,.25)" : "rgba(255,230,140,.3)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(h.x, h.y, light, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
  // 魔王狀態列（bosses.ui.js 畫在上方 x 50～250、y 3～28；Be 巨人題目橫幅時往下移到 42）出現時，地形標籤改放到它下面，不疊在一起（11-21 試玩 P3-18）
  function pillY(G, run) {
    if (U.juice && U.juice.labelY) return U.juice.labelY(G, run);   // 11-22：和手感外掛的標籤列同一條（避開魔王血條、Be 題目）
    if (!G || !G.enemies.some(e => TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss)) return run && run.be ? 42 : 4;
    return run && run.be ? 71 : 32;
  }
  function pill(ctx, text, bg, y) {
    y = y || 4;
    ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 12; ctx.fillStyle = bg; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4, y, w, 16, 8); else ctx.rect(4, y, w, 16);
    ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(text, 10, y + 8.5); ctx.restore();
  }
  U.add("drawTop", (ctx, G, run) => {
    if (!G.terrain || !run) return;
    if (isSight(G)) {
      overlay(ctx, G, run);
      const c = G.tr.clearT;
      const py = pillY(G, run);
      if (G.terrain === "fog") pill(ctx, c > 0 ? "☀️ 看得清 " + Math.ceil(c) + "s" : "🌫️ 迷霧：答對題目驅霧", c > 0 ? "#3d7a4fdd" : "#4c5a52dd", py);
      else pill(ctx, c > 0 ? "🔦 照明 " + Math.ceil(c) + "s" : "🌙 夜晚：答對題目照明", c > 0 ? "#7a6a2ddd" : "#1c2550dd", py);
      return;
    }
    if (G.terrain === "lava") {
      const pulse = .5 + .5 * Math.sin((G.time || 0) * 10);
      for (const i of G.tr.warn) {
        const [x, y] = G.map.slots[i];
        ctx.strokeStyle = "rgba(255,70,40," + (.5 + .5 * pulse) + ")"; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#ffdd55"; ctx.fillText("！" + Math.max(1, Math.ceil(G.tr.lavaT)), x, y - 23);
      }
      for (const tw of G.towers) {
        const h = G.tr.hot[tw.id] || 0; if (h <= 0) continue;
        ctx.fillStyle = "rgba(255,90,30," + (.3 + .2 * pulse) + ")"; ctx.beginPath(); ctx.arc(tw.x, tw.y, 15, 0, 7); ctx.fill();
        ctx.strokeStyle = "#ffb03a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tw.x, tw.y, 15, 0, 7); ctx.stroke();
        ctx.font = "bold 10px sans-serif"; const s = "🔥" + Math.ceil(h) + "s", w = ctx.measureText(s).width + 6;
        ctx.fillStyle = "#4a1404e6"; ctx.fillRect(tw.x - w / 2, tw.y - 30, w, 12); ctx.fillStyle = "#ffd2a0"; ctx.fillText(s, tw.x, tw.y - 24);
      }
      pill(ctx, G.waveActive || G.tr.warn.length ? "🌋 噴發倒數 " + Math.max(0, Math.ceil(G.tr.lavaT)) + "s" : "🌋 岩漿（開戰後才噴）", "#6a2414dd", pillY(G, run));
    }
  });

  // ── 瀏覽器機器人：岩漿把塔烤熱、怪多、能量夠就按冷卻（花能量，不答題）；迷霧／夜晚沒有按鈕了（答對任何題自動驅霧）
  window.TGBOT = (window.TGBOT || []).concat((T, G, c) => {
    if (!G || G.over || T.sheetMode || !G.terrain) return false;
    if (G.terrain === "lava" && G.enemies.length >= 3 && TG.terrainHot(G).some(id => G.tr.hot[id] > 2) && TG.terrainCanCoolAll(G)) {
      if (coolAll()) { c.lavaCool = (c.lavaCool || 0) + 1; return true; }
    }
    return false;
  });
})();
