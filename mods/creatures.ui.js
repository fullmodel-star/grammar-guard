// 外掛：creatures（畫面端，只在瀏覽器載入）— 新怪的畫面提示、冰鳳／光獨角獸特效、召喚獸進化外觀、召喚獸圖鑑
// 存檔：TGUI.S.mods.creatures = { seen:{assassin,priest}, evo:{召喚獸id:1} }（舊存檔沒有也沒關係）
(function () {
  if (!window.TGUI || !window.TG || !TG.SUMMON_EVO) return;
  const U = window.TGUI, esc = U.esc;
  const D = () => { const m = U.S.mods || (U.S.mods = {}); return (m.creatures = TG.creaturesData(m.creatures)); };
  const ORDER = () => Object.keys(TG.SUMMONS).sort((a, b) => (TG.SUMMON_UNLOCK[a] || 0) - (TG.SUMMON_UNLOCK[b] || 0));
  let lightT = 0, chillFx = 0, uniFx = 0;

  // ───── 樣式（只作用在本外掛的 class）
  const css = document.createElement("style");
  css.textContent = `
.cr-wrap{width:100%;max-width:640px;display:flex;flex-direction:column;gap:12px;text-align:left}
.cr-wrap>h2{display:flex;align-items:center;justify-content:center;gap:8px}
.cr-wrap>h2 svg{width:26px;height:26px}
.cr-help{font-size:13px;color:var(--sub);line-height:1.6;background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;border-radius:12px;padding:8px 12px}
.cr-help svg{width:15px;height:15px;vertical-align:-2px}
.cr-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:10px}
.cr-pet{background:linear-gradient(#1a2840,#131f34);border:1px solid #2e4560;box-shadow:inset 0 0 0 1px rgba(225,184,106,.16),0 4px 12px #0006;border-radius:14px;padding:12px;display:flex;gap:12px;align-items:flex-start}
.cr-pet.evo{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.5),0 0 16px rgba(225,184,106,.25)}
.cr-em{width:72px;height:72px;flex:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 62%,#2f4868,#121c2e 72%);border:1px solid #3a5068;border-radius:14px}
.cr-pet.evo .cr-em{background:radial-gradient(circle at 50% 62%,#6a5a2a,#1c1a14 75%);border-color:#E1B86A}
.cr-em canvas{width:64px;height:64px;display:block;box-shadow:none;border-radius:0;touch-action:auto}
.cr-pet.lock .cr-em canvas{filter:brightness(0);opacity:.55}
.cr-body h4{font-family:var(--serif)}
.cr-body{flex:1;min-width:0;font-size:13px;line-height:1.55;color:var(--sub)}
.cr-body h4{margin:0 0 2px;font-size:16px;color:var(--ink);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cr-tag{font-size:11px;font-weight:700;border-radius:8px;padding:1px 7px;background:var(--card);color:var(--ink)}
.cr-tag.evo{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}
.cr-body b{color:var(--ink);font-weight:700}
.cr-bar{height:6px;background:#ffffff1a;border-radius:3px;overflow:hidden;margin:4px 0 2px}
.cr-bar i{display:block;height:100%;background:linear-gradient(90deg,#E1B86A,#ffe9a8)}
.cr-foot{display:flex;justify-content:center;padding-bottom:8px}
@media (min-width:900px){.cr-wrap{max-width:900px}.cr-list{grid-template-columns:repeat(2,1fr)}}`;   /* 底部按鈕列很多顆時的排版已移到 index.html */
  document.head.appendChild(css);

  // ───── 召喚獸圖鑑（全畫面）
  const ov = document.createElement("div");
  ov.className = "ov hide"; ov.id = "ovCreatures";
  document.getElementById("app").appendChild(ov);
  function close() { ov.classList.add("hide"); U.show("ovMenu"); U.menuInfo(); }
  function open() { U.show(null); render(); ov.classList.remove("hide"); ov.scrollTop = 0; }
  function card(id) {
    const b = TG.SUMMONS[id], need = TG.SUMMON_UNLOCK[id] || 0, unlocked = U.cleared() >= need;
    const pg = TG.petProgress(U.S.pets && U.S.pets[id]), look = TG.summonLook(id, pg.lv), evo = TG.SUMMON_EVO[id];
    if (!unlocked) {
      return '<div class="cr-pet lock" data-pet="' + id + '"><div class="cr-em">' + U.icHtml("summon", id, 1, 64, 64) + '</div><div class="cr-body">' +
        '<h4>？？？<span class="cr-tag">' + esc(b.elem) + '</span></h4>' + U.uic("lock", "s") + ' 過 ' + need + ' 關後解鎖<br>' + esc(TG.SUMMON_COUNTER[id] || "") + '</div></div>';
    }
    // 11-24 第二輪（整合）：進化改點數制（creatures.js TG.petProgress 的 pct／leftUses），不再寫死「每用 5 次升 1 級」
    const done = pg.evolved, pct = done ? 100 : (Number.isFinite(pg.pct) ? pg.pct : Math.round(100 * (1 - pg.left / ((TG.EVO_LV - 1) * 5))));
    const leftN = Number.isFinite(pg.leftUses) ? pg.leftUses : pg.left;
    return '<div class="cr-pet' + (done ? ' evo' : '') + '" data-pet="' + id + '"><div class="cr-em">' + U.icHtml("summon", id, pg.lv, 64, 64) + '</div><div class="cr-body">' +
      '<h4>' + esc(look.name) + '<span class="cr-tag">' + esc(b.elem) + '</span>' + (done ? '<span class="cr-tag evo">已進化</span>' : '') + '</h4>' +
      esc(b.desc) + (done ? '（效果 ×' + TG.EVO_MUL + '）' : '') + '<br>' +
      '<b>Lv' + pg.lv + '</b>　用了 <b>' + pg.uses + '</b> 次' +
      '<div class="cr-bar"><i style="width:' + pct + '%"></i></div>' +
      (done ? '已進化成「' + esc(evo.name) + '」！' : '再召喚約 <b>' + leftN + '</b> 次（句子都排對）進化成「' + esc(evo.name) + '」') +
      '</div></div>';
  }
  function render() {
    const ids = ORDER(), got = ids.filter(id => U.cleared() >= (TG.SUMMON_UNLOCK[id] || 0)).length;
    ov.innerHTML = '<div class="cr-wrap"><h2>' + U.icHtml("summon", "fox", 1, 30, 30) + '召喚獸圖鑑　' + got + '／' + ids.length + '</h2>' +
      '<div class="cr-help">戰鬥中答對題目累積能量 ' + U.uic("bolt", "s") + '，按下方召喚獸按鈕、把句子排好就能召喚。每召喚 1 次 +1 點、句子全部排對再 +1 點，每 ' + (TG.PET_PTS_PER_LV || 3) + ' 點升 1 級，<b>Lv' + TG.EVO_LV + ' 進化</b>（約召喚 14～20 次）：換新外型，效果 ×' + TG.EVO_MUL + '。</div>' +
      '<div class="cr-list">' + ids.map(card).join("") + '</div>' +
      '<div class="cr-foot"><button class="big ghost" data-cr="back">' + U.uic("back", false) + '回主選單</button></div></div>';
    U.paintIcons(ov);
    ov.querySelector('[data-cr="back"]').onclick = close;
  }
  U.openCreatures = open;   // 隊伍頁（mods/team.ui.js）點召喚獸格時開圖鑑
  U.add("menu", { label: () => "召喚獸", icon: { kind: "summon", id: "fox", lv: 1 }, onClick: open, unlockAt: 1 });   // unlockAt：過幾關後主選單才出現（11-21 試玩 P3-17）

  // ───── 戰鬥底部按鈕：進化後換 emoji；光獨角獸顯示「已用／滿血」
  function decorate(G) {
    if (!G) return;
    document.querySelectorAll("#sumBtns [data-sum]").forEach(b => {
      const id = b.dataset.sum, look = TG.summonLook(id, G.summons[id]);
      if (b.firstChild && b.firstChild.nodeType === 3 && b.firstChild.nodeValue !== look.em) { b.firstChild.nodeValue = look.em; b.title = look.name; }
      if (id === "unicorn") {
        const st = TG.unicornState(G), sm = b.querySelector("small"), txt = st === "used" ? "已用" : st === "full" ? "不能用" : "⚡" + TG.summonCost(G, "unicorn");   // full＝鐵人模式；滿血（gold）照常可叫，多的命換金幣
        if (sm && sm.textContent !== txt) sm.textContent = txt;
      } else if (id === "phoenix") {
        // v3：價格跟 energyCost 走（卡片／每日規則改價時按鈕上的數字跟著變；保留閃電圖示）
        const sm = b.querySelector("small"), want = String(TG.summonCost(G, id));
        const tn = sm && [...sm.childNodes].reverse().find(n => n.nodeType === 3);
        if (tn && tn.nodeValue !== want) tn.nodeValue = want;
      }
    });
  }
  U.add("start", G => { lightT = 0; chillFx = 0; uniFx = 0; decorate(G); });
  U.add("frame", (G, run, real) => {
    if (lightT > 0) lightT -= real; if (chillFx > 0) chillFx -= real; if (uniFx > 0) uniFx -= real;
    decorate(G);
  });

  // ───── 事件：第一次遇到新怪說明、真言光、治療、冰鳳、光獨角獸、進化
  const FIRST = {
    assassin: "🥷 隱形刺客！塔打不到，答對任何題就會現形",
    priest: "👼 治療祭司會幫附近的怪補血，先打倒它！"
  };
  U.add("event", (ev, G) => {
    if (ev.k === "spawn" && FIRST[ev.e.type]) {
      const d = D();
      if (!d.seen[ev.e.type]) { d.seen[ev.e.type] = 1; U.save(); U.toast(ev.e.type === "assassin" && TG.pfOn && TG.pfOn(G) ? "🥷 隱形刺客！備戰時答對題目，這一波就看得到牠；沒答對也會每 10 秒現形一下" : FIRST[ev.e.type]); U.beep(420, .3, "triangle", .05); }
    } else if (ev.k === "trueLight") { lightT = 0.6; U.fx("✨ 真言光！刺客現形", 150, 60, "#ffe680"); U.beep(1320, .25, "sine", .04); }
    else if (ev.k === "heal") U.fx("✚", ev.x, ev.y - 6, "#7dffa8");
    else if (ev.k === "chill") { chillFx = 0.8; U.fx("❄️ 全場減速 " + Math.round(ev.t) + " 秒", 150, 200, "#bfe6ff"); }
    else if (ev.k === "unicorn") { uniFx = 1; U.fx(ev.n ? "城堡 +" + ev.n + " 命" + (ev.gold ? "、+" + ev.gold + " 金幣" : "") : ev.gold ? "+" + ev.gold + " 金幣" : "城堡已經滿血", 150, 330, "#ffd6f5"); }
    else if (ev.k === "summon") {
      // index.html 在召喚後同一個步驟就更新了 S.pets，這裡看得到新等級
      const p = U.S.pets && U.S.pets[ev.id], d = D();
      if (p && TG.isEvolved(p.lv) && !d.evo[ev.id]) {
        d.evo[ev.id] = 1; U.save();
        const e = TG.SUMMON_EVO[ev.id];
        if (G && G.summons[ev.id] !== undefined) G.summons[ev.id] = p.lv;
        // 11-22：1.9 秒後才出提示（等召喚演出）；這段時間玩家可能已經退出關卡 → 只在同一局還在進行時才出
        setTimeout(() => { if (U.G === G && G && !G.over) U.toast("🌟 " + TG.SUMMONS[ev.id].name + " 進化成 " + e.em + e.name + "！效果 ×" + TG.EVO_MUL); }, 1900);
      }
    }
  });

  // ───── 隱形中的刺客：不畫本體（enemyDraw 掛勾回傳 true ＝ 引擎預設的 emoji 與血條都不畫），只畫一團霧影
  U.add("enemyDraw", (ctx, e, G) => {
    if (!TG.ENEMIES[e.type].invis || (TG.crRevealed ? TG.crRevealed(G) : (G.cr && G.cr.revealT > 0))) return false;
    const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 16);
    g.addColorStop(0, "rgba(200,210,230,.55)"); g.addColorStop(1, "rgba(200,210,230,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 16, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(30,34,50,.6)"; ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, 7); ctx.fill();
    ctx.fillStyle = "#e6ecff"; ctx.font = "bold 10px sans-serif"; ctx.fillText("？", e.x, e.y + 1);
    return true;
  });

  // ───── 地圖繪圖：顯形時畫光圈、祭司治療範圍、冰鳳／真言光全場效果
  U.add("drawGround", (ctx, G) => {
    for (const e of G.enemies) {
      if (!TG.ENEMIES[e.type].healer) continue;
      ctx.fillStyle = "#7dffa812"; ctx.strokeStyle = "#7dffa855"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(e.x, e.y, TG.HEAL_R, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  // 狀態小標籤（真言光、減速）：11-22 從地圖下緣（會蓋住城牆血量牌，火山／冰原城堡在中下方時擠在一起）
  //   改到地圖上緣的標籤列、靠右排（左邊是地形標籤）；y 由手感外掛算（避開魔王血條與 Be 題目），沒有就退回 4／42。
  function tagRow(G, run) { const J = U.juice; return J && J.labelY ? J.labelY(G, run) : (run && run.be ? 42 : 4); }
  function rpill(ctx, text, fg, bg, xr, y) {
    ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 12; ctx.fillStyle = bg; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(xr - w, y, w, 16, 8); else ctx.rect(xr - w, y, w, 16);
    ctx.fill(); ctx.fillStyle = fg; ctx.fillText(text, xr - 6, y + 8.5); ctx.restore();
    return xr - w - 4;
  }
  U.add("drawTop", (ctx, G, run) => {
    const c = G.cr || {}, shown = c.revealT > 0 || !!(TG.crRevealed && TG.crRevealed(G) && G.enemies.some(e => TG.ENEMIES[e.type].invis));
    const ty = tagRow(G, run); let xr = 296;
    if (shown) for (const e of G.enemies) {
      if (!TG.ENEMIES[e.type].invis) continue;
      ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, 7); ctx.stroke();
    }
    if (c.chillT > 0) { ctx.fillStyle = "rgba(150,210,255," + (0.10 + Math.min(0.15, chillFx * 0.2)) + ")"; ctx.fillRect(0, 0, 300, 400); }
    if (shown && G.enemies.some(e => TG.ENEMIES[e.type].invis)) xr = rpill(ctx, "真言光 " + Math.ceil(c.revealT) + " 秒", "#ffe680", "#3a2c00dd", xr, ty);
    if (c.chillT > 0) xr = rpill(ctx, "減速 " + Math.ceil(c.chillT) + " 秒", "#bfe6ff", "#0d2238e6", xr, ty);
    if (lightT > 0) { ctx.fillStyle = "rgba(255,236,150," + (lightT * 0.4) + ")"; ctx.fillRect(0, 0, 300, 400); }
    if (uniFx > 0) {
      const m = G.map; ctx.globalAlpha = Math.min(1, uniFx);
      ctx.strokeStyle = "#ffd6f5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.end[0], Math.min(m.end[1], 380), 18 + (1 - uniFx) * 26, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });

  // ───── 測試機器人（test/browser/bot.js 會呼叫）：圖鑑不該在戰鬥中開著
  window.TGBOT = (window.TGBOT || []).concat((T, G, c) => {
    if (!ov.classList.contains("hide")) { ov.classList.add("hide"); return true; }
    if (G && !G._crBot) { G._crBot = true; c.cr = { hidden: 0, heal: 0, chill: 0, uni: 0 }; }
    // 像玩家一樣用新召喚獸：城堡掉 5 條命以上叫光獨角獸、魔王在場叫冰鳳（句子重組面板由內建機器人處理）
    if (G && !G.over && !T.sheetMode && G.waveActive) {
      const id = TG.canSummon(G, "unicorn") && G.lives <= TG.livesCap(G) - 5 ? "unicorn"
        : TG.canSummon(G, "phoenix") && G.enemies.some(e => TG.ENEMIES[e.type].boss) ? "phoenix" : null;
      if (id) { T.openOrder(id); if (T.sheetMode === "order") { c.cr[id === "unicorn" ? "uniCall" : "chillCall"] = 1; return true; } }
    }
    if (G && c.cr) {
      const cr = G.cr || {};
      if (G.enemies.some(e => TG.ENEMIES[e.type].invis) && !(cr.revealT > 0)) c.cr.hidden++;
      if (G.enemies.some(e => TG.ENEMIES[e.type].healer)) c.cr.heal++;
      if (cr.chillT > 0) c.cr.chill++;
      if (cr.uniUsed) c.cr.uni = 1;
    }
    return false;
  });

  U.menuInfo();
})();
