// 外掛：coach（畫面端，只在瀏覽器載入）— 2026-11-21 模擬試玩 P0-2／P0-4
// ・第 1 關手把手教學：每步一個不擋操作的提示泡泡（點塔位蓋塔 → 按開始 → 點塔升級：金幣＋能量）
// ・字盾騎士、錯字哥布林、第一次能召喚時：暫停遊戲，一張說明卡，按「知道了」繼續（看過記在存檔，不重複）
// ・第二刀（11-21）：第一次出現詞彈怪也一張；說明卡改星夜風、圖示用 ART 自繪
// ・v3（第 8b 組）：升級券退場 → 拿掉「備戰／升級券」兩張卡，新增第一次說明卡：側邊答題（panel）、營地（camp）、狂熱時刻（fever）、騎士怒氣與詠唱（rage）。
//   用語和戰鬥畫面一致：能量、營地、狂熱時刻、怒氣、詠唱。
// ・失敗畫面：依本局紀錄給 1～2 句秘訣；同一關連輸 2 次提供練習模式（減血與加金幣見 TG.practiceText，連輸越多加碼；引擎端在 coach.js）
// 存檔：TGUI.S.mods.coach = { seen:{tut1,elite,goblin,summon,twoPaths}, loss:{關卡序號:連輸次數} }
(function () {
  if (!window.TGUI || !window.TG || !TG.coachTips) return;
  const U = window.TGUI, esc = U.esc, app = document.getElementById("app");
  const pfNow = () => !!(window.TG && TG.pfOn && TG.pfOn(U.G));   // 先備戰再守城（2026-11-25）
  const D = () => { const m = U.S.mods || (U.S.mods = {}); return (m.coach = TG.coachData(m.coach)); };

  // ───── 樣式（只作用在 co- 開頭的 class）
  const css = document.createElement("style");
  css.textContent = `
.co-bub{position:absolute;z-index:9;max-width:min(250px,calc(100% - 16px));background:radial-gradient(120% 140% at 50% 30%,#fbf1d6,#ead6a4);color:#2a1d08;border:1px solid #8a6a3a;border-radius:12px;padding:8px 11px;font-size:14px;line-height:1.5;font-weight:800;box-shadow:0 4px 14px #0009;pointer-events:none}
.co-bub small{display:block;font-weight:500;font-size:12px;color:#5a4a20}
.co-bub::after{content:"";position:absolute;left:var(--ax,50%);width:0;height:0;border:8px solid transparent;transform:translateX(-50%)}
.co-bub.down::after{top:100%;border-top-color:#ead6a4}
.co-bub.up::after{bottom:100%;border-bottom-color:#fbf1d6}
.co-bub.flat::after{display:none}
.co-ov{position:absolute;inset:0;z-index:28;background:rgba(6,9,20,.62);display:flex;align-items:flex-end;justify-content:center;padding:16px 16px calc(84px + env(safe-area-inset-bottom))}
.co-card{position:relative;width:100%;max-width:380px;background:radial-gradient(130% 90% at 50% 0,#1d2c4a 0,#111a2a 60%,#0c1122);border:1px solid #E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.25),0 0 0 3px #0c1122,0 10px 30px #000c;border-radius:16px;padding:14px 16px;text-align:left;font-size:15px;line-height:1.65;color:#eef2fa;animation:coIn .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes coIn{0%{transform:translateY(24px) scale(.94);opacity:0}100%{transform:none;opacity:1}}
.co-card .em{float:right;margin:0 0 4px 10px;width:64px;height:64px;display:grid;place-items:center;border-radius:14px;background:radial-gradient(circle at 50% 62%,#2f4868,#121c2e 72%);border:1px solid #E1B86A}
.co-card .em canvas{width:58px;height:58px;display:block;box-shadow:none;border-radius:0;touch-action:auto}
.co-card .em svg{width:40px;height:40px}
.co-card .kick{font-size:12px;font-weight:900;letter-spacing:2px;color:#9fb4d4}
.co-card h3{margin:0 0 6px;font-size:19px;color:#F3D494;font-family:var(--serif,serif);font-weight:900;text-shadow:0 0 10px rgba(225,184,106,.35)}
.co-card p{margin:4px 0;color:#eef2fa}
.co-card b{color:#ffe08a}
.co-card .demo{clear:both;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin:8px 0 2px;padding:8px;border-radius:10px;background:#0a1222;border:1px dashed #4b6478;font-weight:800}
.co-card .demo i{font-style:normal;border:1.5px solid #E1B86A;border-radius:9px;padding:3px 10px;background:linear-gradient(#22344a,#162436)}
.co-card .demo i.ok{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}
.co-card .demo svg{width:22px;height:16px}
.co-card button{display:flex;align-items:center;justify-content:center;width:100%;margin-top:10px;border:1px solid #8a6a3a;border-radius:12px;padding:12px;min-height:48px;font-size:16px;font-weight:900;background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08;box-shadow:0 3px 0 #6b4a1c}
.co-card .pause{font-size:12px;color:#8fa2bd}
@media (prefers-reduced-motion:reduce){.co-card{animation:none}}
@media (min-width:900px) and (min-height:560px){.co-ov{align-items:center;padding:16px 436px 16px 16px}}   /* 11-22：整個畫面都擋住（含右側備戰面板），卡片置中在戰場上 */
/* 第二輪 P1-8（11-24 小安）：橫向手機卡片高 385、頂端被切 79 像素 → 卡片最高＝視窗高 −16、內容可捲；圖放左邊、字縮一點 */
.co-card{max-height:calc(100% - 8px);overflow:auto;overscroll-behavior:contain}
@media (orientation:landscape) and (max-height:500px){
  .co-ov{align-items:center;padding:8px 16px}
  .co-card{max-width:560px;max-height:calc(100dvh - 16px);padding:10px 14px;font-size:14px;line-height:1.5}
  .co-card .em{float:left;margin:0 12px 4px 0;width:52px;height:52px}.co-card .em canvas{width:46px;height:46px}
  .co-card h3{font-size:17px;margin-bottom:2px}.co-card p{margin:2px 0}.co-card .demo{margin:4px 0 0;padding:5px}
  .co-card button{margin-top:6px;min-height:44px;padding:8px}}`;
  document.head.appendChild(css);

  // ───── 教學泡泡
  const bub = document.createElement("div"); bub.className = "co-bub hide"; app.appendChild(bub);
  let tut = null;   // { step, t } 第 1 關教學進度；null＝沒有在教
  function hideBub() { bub.classList.add("hide"); }
  // 把泡泡放在某個點（#app 座標）上方或下方，箭頭指過去
  function placeBub(html, px, py, prefer) {
    if (bub.dataset.h !== html) { bub.innerHTML = html; bub.dataset.h = html; }
    bub.classList.remove("hide", "up", "down", "flat");
    bub.style.maxWidth = "";
    bub.style.left = "0px";   // 先放到左邊再量寬度：原本在右側舊位置量到的是被擠窄的寬度，搬過去後變寬 → 320 寬左右超出 5px（11-22 小美）
    const W = app.clientWidth, bw = Math.min(bub.offsetWidth, W - 16), bh = bub.offsetHeight;
    let left = Math.max(8, Math.min(W - bw - 8, px - bw / 2)), top, cls;
    if (px == null) {   // 置中在地圖上（1440 寬不要橫跨地圖與右側面板）
      const cr = document.getElementById("cv").getBoundingClientRect(), ar = appRect();
      left = Math.max(8, Math.min(W - bw - 8, cr.left - ar.left + (cr.width - bw) / 2)); top = py; cls = "flat"; }
    else if (prefer !== "below" && py - bh - 14 > 4) { top = py - bh - 14; cls = "down"; }
    else { top = py + 14; cls = "up"; }
    // 第二輪 P2（11-24 小安）：泡泡不要蓋住答題面板（「② 按開始第 1 波」原本蓋住第 3、4 個選項／「答一題」橫條）→ 重疊時移到面板上方、不畫箭頭
    try {
      const qp = document.getElementById("qpanel");
      if (qp && !qp.classList.contains("hide") && !qp.classList.contains("away") && qp.offsetParent !== null) {
        const r = qp.getBoundingClientRect(), ar = appRect(), qt = r.top - ar.top, qb = r.bottom - ar.top, ql = r.left - ar.left, qr = r.right - ar.left;
        if (top < qb && top + bh > qt && left < qr && left + bw > ql) {
          if (qt - bh - 8 >= 4) { top = qt - bh - 8; cls = "flat"; }
          else if (ql - 16 >= 160) {   // 11-24 UIUX P1：橫向手機答題面板是滿高的右欄，上方沒位置 → 泡泡改放面板左邊（地圖上），不蓋面板頂端
            bub.style.maxWidth = Math.min(250, ql - 16) + "px";
            const bw2 = bub.offsetWidth; left = Math.max(8, ql - bw2 - 8); top = Math.max(4, Math.min(top, app.clientHeight - bub.offsetHeight - 4)); cls = "flat";
          } else { top = Math.max(4, qt - bh - 8); cls = "flat"; }
        }
      }
    } catch (e) {}
    bub.classList.add(cls);
    bub.style.left = left + "px"; bub.style.top = top + "px";
    if (px != null) bub.style.setProperty("--ax", Math.max(14, Math.min(bw - 14, px - left)) + "px");
  }
  const appRect = () => app.getBoundingClientRect();
  function mapPt(x, y) {   // 地圖邏輯座標（300×400）→ #app 座標
    const cr = document.getElementById("cv").getBoundingClientRect(), ar = appRect();
    return [cr.left - ar.left + x / 300 * cr.width, cr.top - ar.top + y / 400 * cr.height];
  }
  function elPt(el, side) {
    const r = el.getBoundingClientRect(), ar = appRect();
    return [r.left - ar.left + r.width / 2, side === "bottom" ? r.bottom - ar.top : r.top - ar.top];
  }
  // 有面板開著時：泡泡放在面板上緣（手機）或畫面上方（電腦版面板在右邊）
  function overSheet(html) {
    const sh = document.getElementById("sheet"), r = sh.getBoundingClientRect(), ar = appRect();
    if (r.left - ar.left > 40) { const cr = document.getElementById("cv").getBoundingClientRect(); placeBub(html, null, cr.top - ar.top + 8); return; }
    placeBub(html, r.left - ar.left + r.width / 2, r.top - ar.top);
  }
  function emptySlot(G) {
    const used = new Set(G.towers.map(t => t.slot)), h = G.heroes[0];
    let best = -1, bd = 1e9;
    G.map.slots.forEach(([x, y], i) => { if (used.has(i)) return; const d = Math.hypot(x - h.x, y - h.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function upTarget(G) {
    return G.towers.find(t => t.lv < TG.MAX_LV && t.lockT <= 0 && !t.pending && t.sealT <= 0 && !TG.needsBranch(t) && G.gold >= (G.freeUp ? 0 : TG.upgradeCost(t.type, t.lv, G)));
  }
  // v3 能量升級（UPGRADE_MODE "energy"）：升級＝金幣＋能量（TG.energyCost("up", G, 塔)）
  const EN = () => TG.UPGRADE_MODE === "energy";
  const upCost = (G, t) => { try { return TG.energyCost("up", G, t); } catch (e) { return 0; } };
  function tutorial(G, real) {
    if (!tut) return;
    const m = U.sheetMode;
    if (G.towers.some(t => t.lv >= 2) && tut.step !== "done") { tut.step = "done"; tut.t = 4; }
    if (m === "question" || m === "spell" || m === "fix" || m === "order" || m === "menu" || card) return hideBub();   // 答題、暫停時不擋畫面
    if (tut.step === "build") {
      if (G.towers.length) { tut.step = "wave"; }
      else if (m === "build") return overSheet("選一種塔<small>🏹 弓箭塔最便宜，還能打飛行怪</small>");
      else if (!m) { const i = emptySlot(G); if (i < 0) return hideBub(); const [x, y] = mapPt(G.map.slots[i][0], G.map.slots[i][1] - 12); return placeBub("① 點路邊的 ＋ 蓋一座塔", x, y); }
      return;
    }
    if (tut.step === "wave") {
      if (G.wave >= 1) { tut.step = "hero"; tut.t = 6; }
      else if (!m) { const [x, y] = elPt(document.getElementById("bWave"), "top"); return placeBub("② 按「開始第 1 波」<small>怪物會沿著路走向城堡，塔會自動攻擊</small>", x, y); }
      else return hideBub();
    }
    if (tut.step === "hero") {
      tut.t -= real;
      const tw = upTarget(G);
      if (tut.t <= 0 || tw) { tut.step = "upgrade"; }
      else if (!m) { const h = G.heroes[0]; const [x, y] = mapPt(h.x, h.y - 14); return placeBub("點路面可以把英雄 " + TG.heroDef(h).em + " 移過去擋怪", x, y); }
      else return hideBub();
    }
    if (tut.step === "upgrade") {
      if (m === "tower") return overSheet(EN() ? "③ 按「升級」：付金幣和能量，塔馬上變強<small>能量＝答對題目累積的（答錯不扣）</small>" : "③ 按「答題升級」，答對塔就變強<small>選錯還有第二次機會</small>");
      const tw = upTarget(G);
      if (!m && tw) {
        const [x, y] = mapPt(tw.x, tw.y - 16);
        if (!EN()) return placeBub("③ 錢夠了！點你的塔來升級<small>答對一題文法題就能升</small>", x, y);
        const need = upCost(G, tw), have = Math.floor(G.energy || 0);
        return placeBub(have >= need ? "③ 點你的塔來升級<small>付金幣＋" + need + " 格能量就能升</small>" : pfNow() ? "③ 錢夠了！能量要等營地答題才會補<small>這一波打完就會到營地答題；升級要金幣＋" + need + " 格能量（現在 " + have + " 格）</small>" : "③ 錢夠了！再答對題目拿能量<small>升級要金幣＋" + need + " 格能量（現在 " + have + " 格）</small>", x, y);
      }
      return hideBub();
    }
    if (tut.step === "done") {
      tut.t -= real;
      if (tut.t <= 0) { D().seen.tut1 = 1; U.save(); tut = null; return hideBub(); }
      if (!m) { const cr = document.getElementById("cv").getBoundingClientRect(), ar = appRect(); return placeBub("做得好！💪<small>答對題目＝能量：升級塔、召喚神獸、同伴大招都靠能量</small>", null, cr.top - ar.top + 8); }
      return hideBub();
    }
  }

  // ───── 第一次見到：暫停說明卡
  const INFO = {
    // 11-25 試玩：先答題玩法守城不出題 → 字盾直接裂開、哥布林當一般怪、召喚不排句，說明卡跟著換
    elite: { ic: ["enemy", "elite"], title: "字盾騎士來了！", body: () => pfNow() ? ["牠身上有<b>藍色字盾</b>。", "先答題玩法守城時不出題：字盾會<b>自己裂開</b>，交給塔來打就好。"] : ["牠身上有<b>藍色字盾</b>，塔只打得出三分之一的傷害。", "<b>點牠</b>，照中文拼出英文單字就能破盾（還有 +12 金幣）。電腦可以直接打字。"] },
    goblin: { ic: ["enemy", "goblin"], title: "錯字哥布林", body: () => pfNow() ? ["頭上寫著<b>「改錯！」</b>的哥布林。", "先答題玩法守城時不出題：牠就是<b>一般的怪</b>，蓋塔打倒牠。"] : ["頭上寫著<b>「改錯！」</b>，牠帶著一個有錯字的句子。", "<b>點牠</b>，找出句子裡錯的那個字：答對直接秒殺；答錯牠就照原本的速度繼續走。"] },
    twoPaths: { svg: "map", title: "這張地圖有兩條路！", body: ["怪物會從<b>兩個入口</b>同時進來。", "<b>兩條路都要蓋塔</b>，只顧一邊，另一邊的怪會直接走到城堡。"] },
    summon: { ic: ["summon", "fox"], title: "可以召喚神獸了！", body: () => ["答對題目會累積上方的<b>能量</b>。能量夠了，下方召喚獸按鈕會亮起來。", pfNow() ? "守城時按下去就<b>直接召喚</b>，不用答題；波與波之間按，要<b>把句子排好</b>（排得越好越強）。" : "按下去、<b>把句子排好</b>就能召喚；句子越長越強，全部排對：威力最大。"] },
    // 第二刀（11-21 詞彈）
    // v3 第一次說明卡（第 8b 組）：側邊答題、營地、狂熱時刻、騎士怒氣與詠唱
    panel: { svg: "bolt", kick: "新功能", title: "側邊答題：答對拿能量",
      body: () => { const E = TG.ENERGY_GAIN || {}, f = E.first || 1, fs = E.fastSec || 10, fa = f + (E.fast || 0);
        return ["戰鬥中旁邊會出題，<b>遊戲不會停</b>，想答再答。", "第一次就答對拿 <b>" + f + " 格能量</b>" + (fa > f ? "（" + fs + " 秒內答對 " + fa + " 格）" : "") + "，第二次機會答對也有 " + (E.retry || 1) + " 格；<b>答錯不扣任何東西</b>，不會的可以按「略過」。", "能量用來<b>升級塔</b>（金幣＋能量）、<b>召喚神獸</b>、放<b>同伴大招</b>。"]; },
      demo: () => '<i class="ok">答對 ＋能量</i><i>略過</i>' },
    camp: { svg: "flag", kick: "新功能", title: "營地：喘口氣、變更強",
      // 先備戰再守城（2026-11-25）：一輪多題、答完才開打、守城不跳題
      body: () => (pfNow() ? ["每一波開打前會到<b>營地</b>：遊戲暫停、<b>不限時間</b>。", "先答<b>3 題</b>（想多拿可以再答 3 題）：答對拿能量；答對 2 題以上，守城時放絕招會<b>自動加強</b>" + (assassinLater() ? "，有刺客的關卡還會讓<b>刺客現形</b>" : "") + "。插旗子的那一波最後再答 1 題<b>抽增益卡</b>。", "答完就開打：守城時<b>不會跳題目</b>，專心佈陣守城。"]
        : ["每一波開打前會到<b>營地</b>：遊戲暫停、<b>不限時間</b>。可以看上一波的戰果和下一波要來的怪。", "答 1 題：答對拿能量；插旗子的那一波還能<b>抽增益卡</b>（答對三選一、答錯也有二選一）。之前答錯的題會先出，答對有額外獎勵。", "不想答可以直接開戰。"]),
      demo: () => pfNow() ? '<i class="ok">答 3 題</i><i>蓋塔、升級</i><i>開始守城</i>' : '<i class="ok">答 1 題</i><i>抽增益卡</i><i>直接開戰</i>' },
    fever: { svg: "flame", kick: "新功能", title: "狂熱時刻！",
      body: () => { const F = TG.FEVER || {}; if (pfNow()) return ["備戰時連續答對 <b>" + (F.need || 5) + " 題</b>就進入狂熱時刻：之後每題能量多 " + (F.energy || 1) + " 格。", "狂熱會<b>帶進下一波</b>：開打後 " + (F.dur || 12) + " 秒內所有塔打得更快、騎士怒氣漲得更快；答錯只是結束狂熱，<b>不扣任何東西</b>。"]; return ["連續答對 <b>" + (F.need || 5) + " 題</b>就進入狂熱時刻：每題能量多 " + (F.energy || 1) + " 格、所有塔打得更快、騎士怒氣漲得更快。", "持續 " + (F.dur || 12) + " 秒或答 " + (F.maxQ || 3) + " 題；答錯只是結束狂熱，<b>不扣任何東西</b>。"]; },
      demo: () => '<i class="ok">連對 ' + ((TG.FEVER && TG.FEVER.need) || 5) + ' 題</i>→<i>狂熱時刻</i>' },
    rage: { ic: ["hero", "knight"], kick: "新功能", title: "騎士怒氣滿了！",
      body: () => ["<b>答對題目</b>、騎士<b>擋住怪物</b>都會累積怒氣；滿了下方的<b>「絕招」鈕會變大、跳動</b>，按下去放出絕招。", pfNow() ? "備戰時一輪答對<b>六成以上</b>，就存 1 次加強：守城時放絕招會<b>自動加強</b>，不用再答題。" : "可以選<b>多答一題</b>（詠唱）：答對絕招更強；答錯也照樣放出，<b>怒氣不會浪費</b>。"],
      demo: () => pfNow() ? '<i class="ok">備戰答對六成</i>→<i>絕招自動加強</i>' : '<i>直接放</i><i class="ok">多答一題，絕招更強</i>' },
    wordbullet: { ic: ["enemy", "slime"], kick: "新功能", title: "詞彈怪：點字塊打牠！", body: ["頭上<b>掛著句子</b>的怪，句子缺一個字。", "看畫面下方的<b>字塊</b>，點對的那個字：字會從城堡飛過去，<b>一擊打倒</b>！點錯只會讓那顆字塊變淡，不會扣分。"], demo: () => '<i>reads</i><i class="ok">reading</i><i>read</i>' }
  };
  // 營地說明卡：第 3 區（第 11 關）起才有隱形刺客，之前不提（11-25 試玩小安：第 1 關就看到「刺客現形」）
  function assassinLater() { try { const G = U.G; if (!G || !G.stage) return true; return TG.creatureCounts ? [2, 5, 10].some(w => (TG.creatureCounts(G, w) || {}).assassin > 0) : G.stage.i >= 10; } catch (e) { return false; } }
  const queue = []; let card = null, ring = null;   // ring＝說明卡指的那隻怪（畫一圈）
  const ov = document.createElement("div"); ov.className = "co-ov hide"; app.appendChild(ov);
  // 第二輪 P1-18（教學節奏，分工單介面 5）：第 1 關只教蓋塔、答題、升級（＋營地）；怒氣卡第 2 關、詞彈第 3 關、狂熱第 4 關才說明；一波最多一張說明卡
  const MIN_STAGE = { rage: 1, wordbullet: 2, fever: 3 };   // 關卡序號（0 起）
  const stageOk = k => { const G = U.G, m = MIN_STAGE[k]; return !m || !G || !G.stage || G.stage.i >= m; };
  let cardWave = -1;   // 上一張說明卡是在第幾波出的（同一波不再出第二張；營地卡例外：營地畫面一定要先看懂）
  function want(k, eid) { const d = D(); if (d.seen[k] || !stageOk(k) || queue.some(q => q.k === k) || (card && card.k === k)) return; queue.push({ k, eid }); }
  function showCard(it) {
    const G = U.G; if (!G || G.over) return;
    if (U.sheetMode === "build" || U.sheetMode === "tower") U.closeSheet();   // 蓋塔／塔資訊面板先關；營地（備戰）面板留著，說明卡蓋在上面
    card = it; ring = it.eid || null; hideBub(); cardWave = G.wave;
    const I = INFO[it.k];
    const pic = I.ic && U.icHtml ? U.icHtml(I.ic[0], I.ic[1], 1, 58, 58) : I.svg && U.uic ? U.uic(I.svg, false) : (I.em || "");
    ov.innerHTML = '<div class="co-card" role="dialog" aria-label="' + esc(I.title) + '"><span class="em">' + pic + '</span>' + (I.kick ? '<div class="kick">' + esc(I.kick) + '</div>' : '') + '<h3>' + esc(I.title) + '</h3>' +
      (typeof I.body === "function" ? I.body() : I.body).map(t => "<p>" + t + "</p>").join("") + (I.demo ? '<div class="demo">' + I.demo() + '</div>' : '') + '<div class="pause">遊戲暫停中</div><button data-co="ok">知道了，繼續</button></div>';
    if (U.paintIcons) U.paintIcons(ov);
    ov.classList.remove("hide"); U.hold(true);
    const b = ov.querySelector("[data-co]"); b.onclick = closeCard; try { b.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeCard() {
    if (!card) return;
    D().seen[card.k] = 1; U.save();
    ringT = card.eid ? 3 : 0; card = null; ov.classList.add("hide"); U.hold(false);
  }
  let ringT = 0;
  // 備戰面板開著時遊戲暫停、frame 掛勾不會跑：另外輪詢，第一次看到備戰就蓋上說明卡（第二刀）
  // 備戰／暫停時 frame 掛勾不跑：教學泡泡（例如「做得好！」）要收掉，不能疊在備戰面板上（11-22 小美）
  // v3：營地（camp.ui，TGUI.camp.isOpen()）或舊的備戰面板（sheetMode "prep"）第一次打開 → 營地說明卡
  const campOpen = () => { try { return U.sheetMode === "prep" || !!(U.camp && U.camp.enabled && U.camp.isOpen && U.camp.isOpen()); } catch (e) { return false; } };
  setInterval(() => { try { const G = U.G, m = U.sheetMode, co = campOpen(); if ((co || m === "menu" || !G || G.over) && !bub.classList.contains("hide")) hideBub(); if (G && !G.over && !card && co && !D().seen.camp) showCard({ k: "camp" }); } catch (e) {} }, 300);
  function resetUi() { queue.length = 0; card = null; ring = null; ringT = 0; cardWave = -1; ov.classList.add("hide"); hideBub(); tut = null; }

  // ───── 掛勾
  U.add("start", (G, run) => {
    resetUi(); U.hold(false);
    run.co = { summons: 0, leaks: {}, summonReady: false };
    if (G.stage && G.stage.i === 0 && !D().seen.tut1 && !G.practice) {
      tut = { step: "build", t: 0 };
      // 11-22 小美 P2：第 1 關原本開局先跳備戰＋「拿到升級券：點一座塔」（她還沒有塔）。教學順序改成：先蓋塔 → 第 1 波 → 第 1 波打完才第一次備戰（說明卡在那時出現）。
      // 平衡端也會讓第 1 關第 1 波前不出備戰；這裡只是保險（把第 0 波的備戰記成已出過，引擎已經不出時沒有影響）
      if (G.wave === 0 && TG.prepDue && TG.prepDue(G) && TG.prepMark) TG.prepMark(G);
    }
    if (G.stage && TG.MAPS[G.stage.map] && TG.MAPS[G.stage.map].routes.length > 1) want("twoPaths");   // 11-21 平衡 agent 發現：只顧第 1 條路是新手卡關主因之一
    if (G.practice) { const lv = (D().loss || {})[G.stage.i]; setTimeout(() => { if (U.G === G && !G.over) U.toast("🎯 練習模式：" + (TG.practiceText ? TG.practiceText(lv, G.stage.i) : "怪物血量減少、金幣增加")); }, 1900); }
  });
  U.add("event", (ev, G, run) => {
    const co = run && run.co; if (!co) return;
    if (ev.k === "leak" && ev.e) co.leaks[ev.e.type] = (co.leaks[ev.e.type] || 0) + 1;
    else if (ev.k === "fever" && ev.on !== false) want("fever");   // v3 狂熱時刻
    else if (ev.k === "summon") co.summons++;
    else if (ev.k === "spawn" && ev.e) {
      const b = TG.ENEMIES[ev.e.type] || {};
      if (b.shield && !b.boss) want("elite", ev.e.id);
      else if (b.quiz === "fix") want("goblin", ev.e.id);
    }
  });
  U.add("frame", (G, run, real) => {
    if (run && run.co && !run.co.summonReady && Object.keys(G.summons).some(id => TG.canSummon(G, id))) { run.co.summonReady = true; want("summon"); }
    if (ringT > 0) { ringT -= real; if (ringT <= 0) ring = null; }
    const m = U.sheetMode;
    // 第一次營地（面板開著就直接蓋上說明卡）、第一次出現詞彈怪（排隊等沒有面板時說明）
    if (!card && campOpen() && !D().seen.camp) { showCard({ k: "camp" }); if (card) return; }
    if (!D().seen.wordbullet) { const wb = G.enemies.find(e => e.wbq && e.wb && !e.wb.fired); if (wb) want("wordbullet", wb.id); }
    // v3：側邊面板第一次出題、第一次狂熱（保險：事件漏掉時看局面）、騎士怒氣第一次集滿（這一局是怒氣制時才有：TG.heroRageMax）
    const sd = D().seen;
    if (!sd.panel) { try { if (U.qpanel && U.qpanel.enabled && U.qpanel.busy && U.qpanel.busy()) want("panel"); } catch (e) {} }
    if (!sd.fever && TG.feverOn && TG.feverOn(G)) want("fever");
    if (!sd.rage && G.heroes[0] && TG.heroRageMax(G, 0) && TG.heroUltReady(G, 0)) want("rage");
    if (!card && queue.length && (!m || m === "build" || m === "tower") && cardWave !== G.wave) {
      const it = queue.shift();
      if (it.eid && !G.enemies.some(e => e.id === it.eid)) {   // 那隻已經不在了：等下一隻同種怪再說明
        const t = G.enemies.find(e => { const b = TG.ENEMIES[e.type] || {}; return it.k === "elite" ? b.shield && !b.boss && e.shield : it.k === "wordbullet" ? e.wbq && e.wb && !e.wb.fired : b.quiz === "fix" && !e.quizDone; });
        if (t) showCard({ k: it.k, eid: t.id });
      } else showCard(it);
      if (card) return;
    }
    tutorial(G, real);
  });
  U.add("drawTop", (ctx, G) => {
    if (ring) {
      const e = G.enemies.find(x => x.id === ring);
      if (e) { const y = (TG.ENEMIES[e.type] || {}).fly ? e.y - 8 : e.y, p = .5 + .5 * Math.sin(Date.now() / 120);
        ctx.save(); ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2.5; ctx.globalAlpha = .6 + .4 * p; ctx.beginPath(); ctx.arc(e.x, y, 19 + 3 * p, 0, 7); ctx.stroke(); ctx.restore(); }
    }
    if (G.practice) {
      ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const t = "🎯練習模式", w = ctx.measureText(t).width + 10;
      ctx.fillStyle = "#000a"; ctx.fillRect(3, 384, w, 14); ctx.fillStyle = "#c9f59a"; ctx.fillText(t, 8, 391.5); ctx.restore();
    }
  });

  // ───── 結算：秘訣＋練習模式
  U.add("end", (G, run, won) => {
    resetUi(); U.hold(false);
    const st = G.stage; if (!st) return;
    const m = G.modes || {}, d = D();
    if (won && st.i === 0) d.seen.tut1 = 1;
    const special = !!(m.iron || m.daily || run.heroic);
    const offer = special ? false : TG.coachRecord(d, st.i, won, !!G.practice);
    U.save();
    const normal = { label: "⚔️ 一般模式再挑戰", onClick: () => U.startStage(st, { heroic: false, allowTypes: null }) };
    if (won) return G.practice ? { actions: [normal] } : undefined;
    if (m.iron) return;   // 鐵人挑戰失敗有自己的說明
    const co = run.co || { summons: 0, leaks: {} };
    const slots = G.map.slots.length;
    const r = {
      wave: G.wave, maxWave: G.maxWave, slots, towers: G.towers.length,
      maxTowerLv: G.towers.reduce((a, t) => Math.max(a, t.lv), 0), goldLeft: G.gold,
      summonsHave: Object.keys(G.summons).length > 0, summonReady: co.summonReady, summons: co.summons,
      shields: run.shields, leaks: co.leaks, energy: Math.floor(G.energy || 0), gearIdle: gearIdle(),
      canHitFly: G.towers.some(t => { try { return !!TG.towerStats(t.type, t.lv, t.branch).fly; } catch (e) { return false; } })
    };
    // 輸的時候魔王還在場上（最後一波魔王會停在城門敲）→ 秘訣第一條講魔王（coach.js 的 boss 秘訣）
    try {
      const be = G.enemies.find(e => (TG.ENEMIES[e.type] || {}).boss && e.hp > 0);
      if (be) { const bd = TG.ENEMIES[be.type]; r.boss = { name: bd.name, fly: !!bd.fly, gate: !!(be.atGate || be.sbAtGate), super: !bd.sb }; }
    } catch (e) {}
    // 第二輪 P1-10（交給 B 組 coach.js 判斷秘訣用；欄位選填）：
    //   upGold＝最便宜的升級要幾金幣（沒有能升的塔＝null）、canUp＝當下金幣夠不夠升最便宜那座（叫沒錢的孩子「去用能量升級」是說錯原因）
    //   gearIdleKind＝"talent"（天賦星星沒用）｜"slot"（有裝備沒穿）｜null；talentLeft＝還有幾顆天賦星星可以學
    try {
      const ups = G.towers.filter(t => t.lv < TG.MAX_LV && !TG.needsBranch(t) && !((TG.TOWERS[t.type] || {}).energy)).map(t => TG.upgradeCost(t.type, t.lv, G));
      r.upGold = ups.length ? Math.min(...ups) : null; r.canUp = r.upGold != null && G.gold >= r.upGold;
      const gi = gearIdleInfo(); r.gearIdleKind = gi.kind; r.talentLeft = gi.talentLeft;
    } catch (e) {}
    let tipsRaw = TG.coachTips(r, 2) || [];
    // 「差一點」只在真的快守住時說（11-22：只撐到第 4／8 波也寫差一點）
    const pr = G.maxWave ? G.wave / G.maxWave : 0;
    tipsRaw = tipsRaw.map(x => x && x.k === "general" && pr < 0.75 ? { k: "general", t: "💪 先把路邊的空位蓋滿塔、再升級；怪多的時候召喚神獸。答對越多，塔和神獸越強。" } : x);
    // 沒用掉的金幣（11-22 小美 P1；能量由 coach.js 的 spend 秘訣提醒）：coach.js 有給同類秘訣就不重複
    const has = re => tipsRaw.some(x => x && (re.test(x.k || "") || re.test(x.t || "")));
    if (G.gold >= 120 && !has(/build|gold|spend|金幣/)) tipsRaw.push({ k: "gold", t: "🪙 結束時還剩 " + G.gold + " 金幣：錢別留著，多蓋塔或升級。" });
    const tips = tipsRaw.filter(x => x && x.t).slice(0, 3).map(x => x.t);
    const actions = [];
    if (G.practice) actions.push(normal);
    else if (offer) {
      const n = d.loss[st.i];   // 開局傳連輸次數：引擎依次數加碼（TG.practiceCfg）
      tips.push("🎯 這關輸了 " + n + " 次，可以先用「練習模式」熟悉（" + (TG.practiceText ? TG.practiceText(n, st.i) : "怪物變弱、金幣變多") + "；過關最多 1 星、獎勵減半）。");
      actions.push({ label: "🎯 練習模式", main: true, onClick: () => U.startStage(st, { practice: n || true, heroic: false, allowTypes: null }) });
    }
    return { tips, actions };
  });

  // 結算秘訣用：有打造好的裝備沒裝上（該欄位空著）或天賦星星沒用（gear 外掛的存檔；沒有 gear 外掛＝undefined 讓 coach.js 自己判斷）
  function gearIdle() { const i = gearIdleInfo(); return i.kind === undefined ? undefined : !!i.kind; }
  function gearIdleInfo() {
    try {
      if (!TG.gearData || !TG.GEAR) return { kind: undefined, talentLeft: 0 };
      const g = TG.gearData((U.S.mods || {}).gear), eq = g.eq || {};
      const slotIdle = (TG.GEAR_SLOTS || []).some(sl => !eq[sl.id] && Object.keys(g.owned || {}).some(id => g.owned[id] && TG.GEAR[id] && TG.GEAR[id].slot === sl.id));
      const tl = TG.talentAvail && U.cleared() >= 3 ? Math.max(0, TG.talentAvail(g.talents || {}, U.totalStars()) | 0) : 0;
      return { kind: slotIdle ? "slot" : tl > 0 ? "talent" : null, talentLeft: tl };
    } catch (e) { return { kind: undefined, talentLeft: 0 }; }
  }

  // ───── 測試機器人：說明卡出現就按「知道了」
  window.TGBOT = (window.TGBOT || []).concat((T, G, c) => {
    if (card) { const b = ov.querySelector("[data-co]"); if (b) b.click(); else closeCard(); c.coach = (c.coach || 0) + 1; return true; }
    return false;
  });
  window.TGCOACH = { get tut() { return tut; }, get card() { return card; }, get queue() { return queue; }, closeCard, data: D };
})();
