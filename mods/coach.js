// 外掛：coach（引擎端，node 可載入）— 練習模式、失敗秘訣（2026-11-21 模擬試玩 P0-4）
// 畫面端（教學泡泡、第一次見到新怪的暫停說明卡、失敗畫面）在 coach.ui.js。
// 存檔（畫面端放 TGUI.S.mods.coach）：{ seen:{tut1,elite,goblin,summon}, loss:{關卡序號:連輸次數} }
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);

  // ═════ 練習模式：同一關連輸 2 次後，失敗畫面提供（過關最多 1 星、經驗減半＝index.html 結算處理）
  // 11-22（模擬試玩小美：新手第 8～9 關練習模式也過不了）：怪物血量 −20%→−30%、起始金幣 +50→+80；
  //   連輸 3 次以上（畫面端開局傳 practice: 連輸次數）再加碼到 −40%、+120。
  // 11-24 第二輪（試玩小美 P0-2：第 11 關 −30% 練習模式也過不了，只有第 4 次的 −40% 3 勝 2；她只打 3 次）：
  //   第 3 區起（關卡區域 ≥ early.fromRegion，第 11 關起）輸第 1 次就提供練習模式，而且直接給加碼版（−40%、+120）。第 1～2 區照舊（輸 2 次才給）。
  TG.PRACTICE = { hpMul: 0.7, gold: 80, after: 2, more: { after: 3, hpMul: 0.6, gold: 120 }, early: { fromRegion: 2, after: 1 } };
  const stOf = st => typeof st === "number" ? TG.STAGES[st] : st && typeof st === "object" ? st : (TG.liveGame && TG.liveGame.stage) || null;
  TG.practiceEarly = st => { const x = stOf(st); return !!(x && x.r >= TG.PRACTICE.early.fromRegion); };
  TG.practiceAfter = st => TG.practiceEarly(st) ? TG.PRACTICE.early.after : TG.PRACTICE.after;   // 同一關輸幾次後提供練習模式
  // lv＝連輸次數（開局 opts.practice 傳的值）；st＝關卡（序號或關卡物件，省略＝目前這一局的關卡）
  TG.practiceCfg = (lv, st) => (TG.practiceEarly(st) || (typeof lv === "number" && lv >= TG.PRACTICE.more.after)) ? TG.PRACTICE.more : TG.PRACTICE;
  TG.practiceText = (lv, st) => { const c = TG.practiceCfg(lv, st); return "怪物血量 −" + Math.round((1 - c.hpMul) * 100) + "%、金幣 +" + c.gold; };
  TG.registerMod({
    name: "coach",
    onNewGame(s, opts) {
      opts = opts || {};
      // 鐵人、每日一關、英雄挑戰不能同時開練習模式
      s.practice = !!(opts.practice && s.stage && !opts.iron && !opts.daily && !opts.heroic);
      s.practiceCfg = s.practice ? TG.practiceCfg(opts.practice, s.stage) : null;
      if (s.practice) s.gold += s.practiceCfg.gold;
      if (s.practice) s.noPowerUp = true;   // 11-24 UI/UX 流程 P2-6：練習模式是給卡關的孩子，不再因隊伍戰力加怪血（頂列也不掛「高手加成」）
    },
    enemyHpMul(mul, type, s) { return s.practice ? mul * (s.practiceCfg || TG.PRACTICE).hpMul : mul; }
  });

  // ═════ 存檔資料（補預設值）
  TG.coachData = function (d) {
    d = d && typeof d === "object" && !Array.isArray(d) ? d : {};
    if (!d.seen || typeof d.seen !== "object" || Array.isArray(d.seen)) d.seen = {};
    if (!d.loss || typeof d.loss !== "object" || Array.isArray(d.loss)) d.loss = {};
    for (const k of Object.keys(d.loss)) { const n = Math.floor(+d.loss[k]); if (!(n > 0)) delete d.loss[k]; else d.loss[k] = Math.min(n, 99); }
    return d;
  };
  // 結算時記連輸次數：一般模式過關歸零；回傳是否該提供練習模式
  TG.coachRecord = function (d, stI, won, practice) {
    if (won) { if (!practice) delete d.loss[stI]; return false; }
    d.loss[stI] = (d.loss[stI] || 0) + 1;
    return d.loss[stI] >= TG.practiceAfter(stI);
  };

  // ═════ 失敗秘訣：依本局紀錄挑 1～2 句最有用的
  // r = { wave, maxWave, slots, towers, maxTowerLv, goldLeft, summonsHave, summonReady, summons, shields, leaks:{怪物種類:隻數}, canHitFly,
  //       energy（選填，沒給就看剛結束的這一局 TG.liveGame）, gearIdle（選填：有裝備沒裝／天賦星星沒用＝true） }
  // v3（第 8b 組）：升級券退場，秘訣一律講「能量」（答對題目累積；升級＝金幣＋能量、召喚、同伴大招都花能量）
  TG.COACH_ENERGY_IDLE = 4;   // 輸的時候手上還有幾格能量沒用就提醒
  TG.coachTips = function (r, max) {
    r = r || {}; const L = r.leaks || {}, E = TG.ENEMIES;
    const count = f => Object.keys(L).filter(k => E[k] && f(E[k])).reduce((a, k) => a + (L[k] || 0), 0);
    const total = count(() => true), fly = count(b => b.fly), shield = count(b => b.shield && !b.boss), quiz = count(b => b.quiz);
    const out = [];
    // 11-25 晚老闆新規則：最後一波魔王走到城門會停下來敲城門、一定要打倒才過關。試玩（小安、小美）：魔王害輸時秘訣完全沒提魔王 → 輸的時候魔王還在場上就放第一條
    //   r.boss（畫面端傳，選填）＝{ name, fly, gate（停在城門敲過）, super }；沒給就不出這條
    if (r.boss && r.boss.name) {
      const B = r.boss;
      out.push({ k: "boss", t: "👑 最後一波的" + (B.super ? "超大魔王" : "魔王") + "「" + B.name + "」會停在城門一直敲，一定要打倒牠：路的後段（靠近城堡）多蓋幾座塔、先升級，牠出來時放絕招" +
        (B.fly ? "；牠會飛，要用弓箭塔或魔法塔。" : "。") });
    }
    const lg = TG.liveGame && TG.liveGame.over ? TG.liveGame : null;
    const en = r.energy !== undefined ? Math.floor(+r.energy || 0) : lg ? Math.floor(lg.energy || 0) : 0, gold = r.goldLeft | 0;
    const idleE = en >= TG.COACH_ENERGY_IDLE;
    // 11-24 第二輪（試玩小明 P1-4：金幣剩 4、能量 5 格，秘訣卻叫他「去升級」）：升級要金幣＋能量，先看當下金幣夠不夠升級最便宜的塔
    //   r.upGold＝升級最便宜那座塔要幾金幣（選填；沒給就看剛結束的這一局；沒有能升的塔＝null）
    const upGold = r.upGold !== undefined ? r.upGold : TG.coachUpGold(lg);
    const pfL = !!(lg && TG.pfOn && (lg.prepFirst && !(lg.modes && lg.modes.iron)));   // 先備戰再守城（11-25 試玩：秘訣還在教邊打邊答；局已結束 pfOn 會因 over 為 false，直接看 prepFirst）
    //   r.canUp（A 組畫面傳：當下金幣夠不夠升級）優先
    const goldOk = r.canUp !== undefined && r.canUp !== null ? !!r.canUp : upGold === null || upGold === undefined ? gold >= 150 : gold >= upGold;
    // 11-22（模擬試玩小美：新手輸的時候手上常有 650～740 金幣沒用）；v3 改看能量
    if (idleE && (goldOk || gold >= 150)) {
      const has = [en + " 格能量", gold >= 150 ? gold + " 金幣" : ""].filter(Boolean).join("和");
      out.push({ k: "spend", t: "⚡ 你還有 " + has + "沒用：打仗時點塔→「升級」，付金幣和能量塔馬上變強" + (idleE ? "；能量也能召喚神獸" : "") + "。留到輸掉就浪費了。" });
    } else if (gold >= 150 && !idleE) {
      // 11-24 UI/UX 流程 P2-8：題目用完、能量 0、金幣堆著（第 2 關第 6 波起）→ 不叫孩子去升級（升級要能量，他做不到），講清楚原因
      let quota = r.quotaOut;
      if (quota === undefined) { try { quota = !!(lg && typeof TG.qCanAsk === "function" && !(TG.pfOn && TG.pfOn(lg)) && !TG.qCanAsk(lg, "fill", "panel")); } catch (e) { quota = false; } }
      const free = (r.slots || 0) > (r.towers || 0) && !((r.towers || 0) < Math.ceil((r.slots || 0) / 2));   // 塔太少時下面的「build」秘訣會講蓋塔，這裡不重複
      out.push({ k: "noEnergy", t: "🪙 還剩 " + gold + " 金幣，但升級要金幣＋能量，能量不夠。" + (pfL ? "能量靠營地備戰答題：答完 3 題可以按「再答 3 題」多拿。" : quota ? "這關的練習題後來答完了，能量只能在營地答題拿，營地的題目要把握。" : "多答側邊的題目就有能量。") + (free ? "金幣可以先拿去多蓋新塔（蓋塔只要金幣）。" : "") });
    } else if (idleE) {
      out.push({ k: "poor", t: "🪙 能量夠、金幣不夠升級：先多蓋便宜的弓箭塔（" + TG.TOWERS.arrow.cost + " 金幣），波數一出來就按開戰拿提早開戰獎金；能量滿了照樣答題，答對會改給金幣。" });
    }
    if (!pfL && (shield >= 2 || (shield >= 1 && !r.shields)))   // 先答題玩法：字盾自己裂開、哥布林是一般怪，不教點牠
      out.push({ k: "shield", t: "🛡️ 有 " + shield + " 隻字盾騎士衝進城堡：點牠、照中文拼出英文單字就能破盾，破盾後塔才打得動。" });
    if (r.summonsHave && !r.summons && (r.summonReady || r.wave >= 3))
      out.push({ k: "summon", t: pfL ? "⚡ 這局一次都沒召喚：營地答對題目會累積上方的「能量」，守城時按下方召喚獸按鈕就直接召喚，神獸會幫你打一大片。" : "⚡ 這局一次都沒召喚：答對題目會累積上方的「能量」，夠了就按下方召喚獸按鈕、把句子排好，神獸會幫你打一大片。" });
    if (r.towers > 0 && (r.maxTowerLv || 1) <= 1)
      out.push({ k: "upgrade", t: "⬆ 塔都還是 1 級：點塔→「升級」，付金幣和能量塔就變強；能量靠答對題目累積（答錯不扣）。" });
    if (fly >= 3 && fly >= total * 0.4) {
      // 11-24 第二輪（試玩小明：第 21 關三連敗都輸在最後一波飛行怪，絕招一直是只打地面的盾牆）：騎士絕招不是三連斬、三連斬已解鎖 → 建議換
      const ult = r.ult !== undefined ? r.ult : lg && lg.kn ? lg.kn.ult : null;
      const t3 = r.tense3Ok !== undefined ? !!r.tense3Ok : !!(lg && lg.kn && TG.knightUltOk && TG.knightUltOk("tense3", (lg.heroes && lg.heroes[0] && lg.heroes[0].lv) || 1, lg.kn.tiers || {}, lg.stage ? lg.stage.i : 0));
      const swap = ult && ult !== "tense3" && t3 ? "出征前把騎士絕招換成「時態三連斬」（打得到飛行怪）；" : "";
      out.push({ k: "fly", t: r.canHitFly ? "🦇 漏掉的多是飛行怪（" + fly + " 隻）：" + swap + "在牠們飛過的路邊多蓋或升級弓箭塔、魔法塔。"
                                         : "🦇 漏掉的多是飛行怪（" + fly + " 隻）：冰霜塔和砲塔打不到空中，要蓋弓箭塔或魔法塔" + (swap ? "；也可以" + swap.replace(/；$/, "") : "") + "。" });
    }
    if (quiz >= 2 && !pfL)
      out.push({ k: "goblin", t: "👺 有 " + quiz + " 隻錯字哥布林跑進城堡：點牠、找出句子裡錯的那個字，答對直接秒殺。" });
    if ((r.towers || 0) < Math.ceil((r.slots || 0) / 2) && (r.goldLeft || 0) >= 60)
      out.push({ k: "build", t: "🪙 結束時還剩 " + r.goldLeft + " 金幣：錢別留著，多蓋幾座塔。" });
    // 11-24 第二輪（試玩小明：三件裝備都穿著，還說「裝備還沒配」，其實是天賦星星沒用）：分開寫
    //   r.talentFree＝還有幾顆星星可學天賦（夠學下一個才算）、r.gearFree＝有打造好的裝備沒穿；都沒給就從存檔（TGUI.S）自己算；再沒有才看舊的 r.gearIdle
    //   A 組畫面傳的 r.gearIdleKind（"talent" 天賦星星沒用／"slot" 有裝備沒穿／null）＋ r.talentLeft（剩幾顆星星）也收
    const gi = (r.talentFree !== undefined || r.gearFree !== undefined) ? { talentFree: r.talentFree | 0, gearFree: !!r.gearFree }
      : r.gearIdleKind !== undefined ? { talentFree: r.gearIdleKind === "talent" ? Math.max(1, r.talentLeft | 0) : 0, gearFree: r.gearIdleKind === "slot" } : TG.coachGearInfo();
    if (gi) {
      if (gi.talentFree > 0) out.push({ k: "talent", t: "⭐ 還有 " + gi.talentFree + " 顆星星可以學天賦：回主選單「隊伍」→「天賦」（例如「城牆」城堡多 2 條命）。" });
      if (gi.gearFree) out.push({ k: "gear", t: "🧰 還有打造好的裝備沒穿：回主選單「隊伍」→「裝備」把它穿上。" });
    } else {
      const idle = r.gearIdle !== undefined ? !!r.gearIdle : !!(lg && lg.stage && lg.stage.i >= 3 && (!Object.keys(lg.gearOn || {}).length || !Object.keys(lg.talentsOn || {}).length));
      if (idle) out.push({ k: "gear", t: "🧰 還有星星可學天賦、或裝備沒穿：回主選單「隊伍」看看紅點（例如「城牆」天賦城堡多 2 條命）。" });
    }
    if (!out.length) out.push({ k: "general", t: "💪 差一點！多升級塔、怪多的時候召喚神獸；答對越多能量越多，塔和神獸越強。" });
    return out.slice(0, max || 2);
  };

  // 升級最便宜那座塔要幾金幣（失敗秘訣判斷「能量夠、金幣不夠」用）；沒有能升的塔＝null
  TG.coachUpGold = function (s) {
    if (!s || !s.towers || !s.towers.length) return null;
    let best = null;
    for (const t of s.towers) {
      const d = TG.TOWERS[t.type]; if (!d || d.energy || (TG.MAX_LV && t.lv >= TG.MAX_LV)) continue;
      const c = TG.upgradeCost(t.type, t.lv, s); if (best === null || c < best) best = c;
    }
    return best;
  };
  // 存檔（畫面端 TGUI.S）裡：還有幾顆星星可以學下一個天賦、有沒有打造好卻沒穿的裝備；node 沒有畫面＝null
  //   totalStars／cleared 可省略（省略＝從 TGUI 讀）
  TG.coachGearInfo = function (S, totalStars, cleared) {
    try {
      const U = root.TGUI;
      S = S || (U && U.S); if (!S || !TG.gearData || !TG.GEAR) return null;
      const g = TG.gearData((S.mods || {}).gear), eq = g.eq || {};
      const stars = totalStars !== undefined ? totalStars : U && U.totalStars ? U.totalStars() : Object.values(S.prog || {}).reduce((a, p) => a + ((p && p.stars) || 0), 0);
      const cl = cleared !== undefined ? cleared : U && U.cleared ? U.cleared() : 0;
      const gearFree = (TG.GEAR_SLOTS || []).some(sl => !eq[sl.id] && Object.keys(g.owned || {}).some(id => g.owned[id] && TG.GEAR[id] && TG.GEAR[id].slot === sl.id));
      let talentFree = 0;
      if (TG.talentAvail && TG.TALENTS && cl >= 3) {
        const owned = g.talents || {}, left = TG.talentAvail(owned, stars);
        if (Object.keys(TG.TALENTS).some(id => TG.talentCan(owned, id, stars))) talentFree = left;
      }
      return { talentFree, gearFree };
    } catch (e) { return null; }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = TG;
})(typeof window !== "undefined" ? window : globalThis);
