// 外掛：team（畫面端）— 「隊伍」主畫面：主角、同伴、召喚獸、裝備與天賦集中在一頁，可以做事的地方亮紅點；戰鬥中召喚鈕的進化進度條。
// 2026-11-23（老闆：升級、同伴、召喚獸「感覺不到」，入口分散、看不到進化進度）
//
// 只重用既有畫面，不重寫：技能樹 TGUI.knight.openTree、同伴 TGUI.openCompanions、召喚獸圖鑑 TGUI.openCreatures、
//   裝備／天賦＝主選單登錄的那兩格（icon "bag"／"talent"）的 onClick。從隊伍頁點進去，按「回主選單」會回到隊伍頁。
// 解鎖關卡一律動態讀 TG.SUMMON_UNLOCK、TG.COMP.unlock、主選單項目的 unlockAt（不寫死數字）。
// 存檔：TGUI.S.mods.team = { v:1, comp:{同伴id:1}, sum:{召喚獸id:1}, evo:{召喚獸id:1}, gear:0/1, talent:0/1, tipSum:0/1 }
//   ＝「新解鎖看過了沒」（打開對應畫面就算看過）；壞存檔（null、字串、陣列、亂值）一律重建或丟掉該欄。
// 紅點規則（純函式 model()，node 測試 test/team.test.js）：
//   騎士：技能樹已開放（Lv ≥ 第一層等級）、有剩餘技能點、而且至少有 1 個技能現在學得起來
//   同伴：已解鎖但還沒看過
//   召喚獸：已解鎖但還沒看過，或已進化但還沒看過進化
//   裝備：已開放，且有裝備可以升星或可以打造（碎片夠、徽章條件符合），或剛開放還沒看過
//   天賦：已開放，且有天賦現在學得起來，或剛開放還沒看過
(function () {
  "use strict";
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const int = (v, d) => { const n = Math.floor(+v); return Number.isFinite(n) ? n : d; };
  const safe = (f, d) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const STAGE_NAMES = ["見習騎士", "鐵衛騎士", "銀翼騎士", "金獅騎士", "星光傳說騎士"];

  // ───── 存檔（S.mods.team）
  function seenData(S) {
    if (!isObj(S.mods)) S.mods = {};
    if (!isObj(S.mods.team)) S.mods.team = {};
    const d = S.mods.team;
    d.v = 1;
    for (const k of ["comp", "sum", "evo"]) {
      if (!isObj(d[k])) d[k] = {};
      for (const id of Object.keys(d[k])) if (d[k][id] === 1 || d[k][id] === true) d[k][id] = 1; else delete d[k][id];
    }
    for (const k of ["gear", "talent", "tipSum"]) d[k] = d[k] === 1 || d[k] === true ? 1 : 0;
    return d;
  }

  const stageName = (i, ART) => { const a = ART && ART.KNIGHT_STAGES && ART.KNIGHT_STAGES[i]; return (a && a.name) || STAGE_NAMES[i] || ""; };
  const summonIds = TG => Object.keys(TG.SUMMONS || {}).sort((a, b) => ((TG.SUMMON_UNLOCK || {})[a] || 0) - ((TG.SUMMON_UNLOCK || {})[b] || 0));
  const unlockOf = (TG, id) => { const v = int((TG.SUMMON_UNLOCK || {})[id], NaN); return Number.isFinite(v) ? v : Infinity; };   // 沒登錄解鎖關卡＝還拿不到
  function petProg(TG, p) {
    p = isObj(p) ? p : {};
    if (typeof TG.petProgress === "function") return TG.petProgress(p);
    const EV = TG.EVO_LV || 10, lv = clamp(int(p.lv, 1), 1, EV), uses = Math.max(0, int(p.uses, 0)), evolved = lv >= EV;
    return { lv, uses, evolved, left: evolved ? 0 : Math.max(1, (EV - lv) * 5 - (uses % 5)) };
  }
  function cloneObj(v) { try { return isObj(v) ? JSON.parse(JSON.stringify(v)) : {}; } catch (e) { return {}; } }

  // 隊伍頁要的全部資料＋紅點。o＝{ cleared, stars, gearAt, talentAt, ART }；不改存檔裡別人的資料（只補 S.mods.team）
  function model(TG, S, o) {
    o = o || {};
    S = isObj(S) ? S : {};
    const cl = Math.max(0, int(o.cleared, 0)), stars = Math.max(0, int(o.stars, 0)), seen = seenData(S);
    const mods = S.mods, out = {};

    // 主角：文法騎士
    const hero = isObj(S.hero) ? S.hero : {}, lv = clamp(int(hero.lv, 1), 1, TG.HERO_MAX || 20);
    const K = TG.KNIGHT || null, on = !!(K && K.VER >= 1 && K.ON !== false && typeof TG.knightPoints === "function" && typeof TG.knightValid === "function");
    const evoLvs = ((K && K.EVO_LV) || TG.KNIGHT_EVO_LV || [5, 10, 15, 20]).slice().sort((a, b) => a - b);
    const stage = typeof TG.heroEvo === "function" ? safe(() => TG.heroEvo({ id: "knight", lv }), 0) : evoLvs.filter(l => lv >= l).length;
    const nextEvo = evoLvs.find(l => l > lv) || 0;
    const treeLv = (K && K.UNLOCK_LV && K.UNLOCK_LV[0]) || 3;
    let total = 0, spent = 0, canLearn = 0;
    if (on) {
      const kd = isObj(mods.knight) ? mods.knight : {}, raw = isObj(kd.tree) ? kd.tree : {};
      const tiers = typeof TG.badgeTiers === "function" ? safe(() => TG.badgeTiers(cloneObj(mods.gear)), {}) : {};
      const tree0 = safe(() => TG.knightValid(raw, lv, tiers), {}) || {};
      let tree = tree0;
      // 第二輪 P2（11-24 小安）：第一次打開技能樹會自動點好三格（knight.ui autoFirst）。紅點要用「自動點完之後」還學得起的算，
      //   不然寫「有 6 點可以學新技能」、進去卻全部是灰的（left＝目前存檔的剩餘點數；leftAuto＝自動點完後的剩餘點數，畫面文字用）
      if (!kd.tut && lv >= treeLv && !Object.keys(tree).length && typeof TG.knightAutoFirst === "function") {
        const t = {}; safe(() => TG.knightAutoFirst(t, lv, tiers), null); tree = safe(() => TG.knightValid(t, lv, tiers), t) || t;
      }
      total = safe(() => TG.knightPoints(lv), 0); spent = safe(() => TG.knightSpent(tree0), 0); out.knSpentAuto = safe(() => TG.knightSpent(tree), spent);
      if (total - spent > 0 && lv >= treeLv && typeof TG.knightCanLearn === "function")
        canLearn = (K.TREE || []).filter(n => n && safe(() => TG.knightCanLearn(tree, n.id, lv, tiers), false)).length;
      // 學不了的時候告訴孩子下一招幾級開（「再升到 Lv5 就能學『站穩』」）
      if (!canLearn) { const nx = (K.TREE || []).filter(n => n && !tree[n.id] && !n.badge && (n.lv | 0) > lv).sort((a, b) => a.lv - b.lv)[0]; if (nx) out.knNext = { lv: nx.lv, name: nx.name }; }
    }
    const left = Math.max(0, total - spent), leftAuto = Math.max(0, total - (out.knSpentAuto != null ? out.knSpentAuto : spent));
    out.knight = { lv, max: lv >= (TG.HERO_MAX || 20), stage, stageName: stageName(stage, o.ART), nextEvo, nextName: nextEvo ? stageName(stage + 1, o.ART) : "", treeLv, on,
      open: on && lv >= treeLv, total, spent, left, leftAuto, canLearn, next: out.knNext || null, dot: on && lv >= treeLv && leftAuto > 0 && canLearn > 0 };
    delete out.knNext; delete out.knSpentAuto;

    // 同伴
    const C = TG.COMP, cd = isObj(mods.companions) ? mods.companions : {}, clv = isObj(cd.lv) ? cd.lv : {}, cxp = isObj(cd.xp) ? cd.xp : {};
    out.comps = C && Array.isArray(C.ids) ? C.ids.map(id => {
      const h = (TG.HEROES || {})[id] || { name: id }, needRaw = int((C.unlock || {})[id], NaN), need = Number.isFinite(needRaw) ? needRaw : Infinity;
      const unlocked = cl >= need, st = (C.startLv && C.startLv[id]) || 1, MAX = C.MAX || 20;
      const lvc = unlocked ? clamp(int(clv[id], st), st, MAX) : st;
      const xpNeed = typeof C.xpNeed === "function" ? safe(() => C.xpNeed(lvc), 0) : 0;
      const xp = lvc >= MAX ? 0 : clamp(int(cxp[id], 0), 0, Math.max(0, xpNeed - 1));
      const perk = ((C.perks || {})[id] || []).find(p => Array.isArray(p) && p[0] > lvc) || null;
      const isNew = unlocked && !seen.comp[id];
      return { id, name: h.name, unlocked, need, lv: lvc, max: lvc >= MAX, xp, xpNeed, next: perk ? { lv: perk[0], text: perk[1] } : null, isNew, dot: isNew };
    }) : [];

    // 召喚獸
    const pets = isObj(S.pets) ? S.pets : {}, full = petProg(TG, { lv: 1, uses: 0 }).left || 1;
    out.sums = summonIds(TG).map(id => {
      const need = unlockOf(TG, id), unlocked = cl >= need, pg = petProg(TG, pets[id]);
      const evo = (TG.SUMMON_EVO || {})[id] || null, base = TG.SUMMONS[id] || { name: id };
      const look = typeof TG.summonLook === "function" ? safe(() => TG.summonLook(id, pg.lv), null) : null;
      const pct = pg.evolved ? 1 : clamp(1 - pg.left / full, 0, 1);
      const isNew = unlocked && !seen.sum[id], newEvo = unlocked && pg.evolved && !seen.evo[id];
      return { id, baseName: base.name, name: (look && look.name) || base.name, unlocked, need, lv: pg.lv, uses: pg.uses, evolved: pg.evolved, left: pg.left, pct,
        leftUses: Number.isFinite(pg.leftUses) ? pg.leftUses : pg.left,   // 11-24 第二輪：進化點數制，left＝還差幾點；畫面寫「再召喚約 N 次」用 leftUses
        evoName: evo ? evo.name : "", isNew, newEvo, dot: isNew || newEvo };
    });

    // 裝備與天賦（開放關卡＝主選單那兩格的 unlockAt）
    const gearAt = Math.max(0, int(o.gearAt, 2)), talentAt = Math.max(0, int(o.talentAt, 3));
    if (TG.GEAR && typeof TG.gearData === "function") {
      const gd = TG.gearData(cloneObj(mods.gear)), ids = Object.keys(TG.GEAR);
      const canStar = ids.filter(id => gd.owned[id] && safe(() => TG.gearCanStar(gd, id), false));
      const canCraft = ids.filter(id => safe(() => TG.gearCanCraft(gd, id), false));
      const eq = safe(() => TG.gearEquipped(gd), []);
      const open = cl >= gearAt, isNew = open && !seen.gear;
      out.gear = { on: true, open, need: gearAt, shards: gd.shards, owned: ids.filter(id => gd.owned[id]).length, all: ids.length, eq, canStar, canCraft, isNew,
        dot: open && (canStar.length > 0 || canCraft.length > 0 || isNew) };
      const owned = {}; for (const id of safe(() => TG.talentValid(gd.talents, stars), [])) owned[id] = 1;
      const can = Object.keys(TG.TALENTS || {}).filter(id => safe(() => TG.talentCan(owned, id, stars), false));
      const topen = cl >= talentAt, tNew = topen && !seen.talent;
      out.talent = { on: true, open: topen, need: talentAt, stars, avail: safe(() => TG.talentAvail(owned, stars), 0), learned: Object.keys(owned).length,
        all: Object.keys(TG.TALENTS || {}).length, canLearn: can, isNew: tNew, dot: topen && (can.length > 0 || tNew) };
    } else {
      out.gear = { on: false, open: false, need: gearAt, dot: false, canStar: [], canCraft: [], eq: [] };
      out.talent = { on: false, open: false, need: talentAt, dot: false, canLearn: [] };
    }

    const dots = [out.knight.dot, ...out.comps.map(c => c.dot), ...out.sums.map(s => s.dot), out.gear.dot, out.talent.dot];
    out.count = dots.filter(Boolean).length;
    out.any = out.count > 0;
    return out;
  }

  // 打開某個畫面＝那一類的新解鎖都看過了。kind：comp／sum／gear／talent。回傳有沒有改存檔
  function markSeen(TG, S, kind, o) {
    const m = model(TG, S, o), d = seenData(S);
    let ch = false;
    const set = (obj, k) => { if (!obj[k]) { obj[k] = 1; ch = true; } };
    if (kind === "comp") for (const c of m.comps) { if (c.unlocked) set(d.comp, c.id); }
    if (kind === "sum") for (const s of m.sums) { if (s.unlocked) set(d.sum, s.id); if (s.unlocked && s.evolved) set(d.evo, s.id); }
    if (kind === "gear" && m.gear.open && !d.gear) { d.gear = 1; ch = true; }
    if (kind === "talent" && m.talent.open && !d.talent) { d.talent = 1; ch = true; }
    return ch;
  }

  // 召喚鈕的提示文字（戰鬥中長按、滑鼠停留）
  function sumTip(s) {
    if (s.evolved) return s.name + "：已經進化了，效果更強";
    return s.name + " Lv" + s.lv + "：再召喚約 " + s.leftUses + " 次 → 進化成 " + (s.evoName || "新樣子");
  }

  const LOGIC = { seenData, model, markSeen, sumTip, stageName };
  if (typeof module === "object" && module.exports) module.exports = LOGIC;

  // ════════════════════ 以下只在瀏覽器 ════════════════════
  if (typeof window === "undefined" || typeof document === "undefined" || !window.TGUI || !window.TG) return;
  const W = window, U = W.TGUI, TG = W.TG, esc = U.esc;
  const TEAM_AT = 1;   // 過第 1 關（第一隻召喚獸出現）時主選單才出現「隊伍」
  const menuItem = ic => (U.hooks && U.hooks.menu || []).find(it => it && it.icon === ic) || null;
  const atOf = (it, d) => (it && Number.isFinite(+it.unlockAt) ? +it.unlockAt : d);
  const opts = () => ({ cleared: U.cleared(), stars: U.totalStars ? U.totalStars() : 0, gearAt: atOf(menuItem("bag"), 2), talentAt: atOf(menuItem("talent"), 3), ART: W.ART });
  let memo = null, memoT = 0;
  const M = fresh => { const t = Date.now(); if (!fresh && memo && t - memoT < 120) return memo; memo = safe(() => model(TG, U.S, opts()), null); memoT = t; return memo; };
  const drop = () => { memo = null; };
  const seen = kind => { if (safe(() => markSeen(TG, U.S, kind, opts()), false)) { drop(); try { U.save(); } catch (e) {} } };

  // ───── 樣式（前綴 tm-；紅點沿用 index.html 的 .mn-dot）
  const css = document.createElement("style");
  css.textContent = `
#ovTeam{gap:12px}
.tm-wrap{width:100%;max-width:640px;display:flex;flex-direction:column;gap:16px;text-align:left}
.tm-head{display:flex;align-items:center;justify-content:center;gap:8px;margin:0}
.tm-head svg{width:30px;height:30px}
.tm-help{max-width:none!important;margin:-6px 0 0!important;font-size:13px;color:var(--sub);line-height:1.6;text-align:center}
.tm-d{display:inline-block;width:10px;height:10px;border-radius:50%;background:#e0566a;box-shadow:0 0 0 2px #0c1122,0 0 6px rgba(224,86,106,.8);margin:0 4px 0 2px;vertical-align:0}
.tm-top{display:flex;flex-direction:column;gap:16px}
.tm-sec{display:flex;flex-direction:column;gap:8px;min-width:0}
.tm-sec>h3{margin:0;display:flex;align-items:center;gap:6px;font-family:var(--serif);font-weight:900;font-size:16px;color:#F3D494}
.tm-sec>h3 svg{width:20px;height:20px}
.tm-sec>h3 canvas{width:22px;height:22px;box-shadow:none;border-radius:0}
.tm-sec>h3 small{margin-left:auto;font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;font-weight:700;color:var(--sub)}
.tm-grid{display:grid;gap:8px}
.tm-comps{grid-template-columns:1fr}
.tm-sums{grid-template-columns:repeat(auto-fill,minmax(136px,1fr))}
.tm-kit{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.tm-cell{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-width:0;min-height:64px;margin:0;padding:10px 12px;border-radius:14px;border:1px solid #2e4560;background:linear-gradient(#1a2840,#131f34);box-shadow:inset 0 0 0 1px rgba(225,184,106,.16),0 4px 12px #0006;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.tm-cell:active{transform:translateY(1px)}
.tm-cell:focus-visible{outline:2px solid #F3D494;outline-offset:2px}
.tm-cell.hot{border-color:#a8566a;box-shadow:inset 0 0 0 1px rgba(224,86,106,.35),0 0 14px rgba(224,86,106,.2)}
.tm-cell.evo{border-color:#E1B86A;box-shadow:inset 0 0 0 1px rgba(243,212,148,.45),0 0 14px rgba(225,184,106,.22)}
.tm-cell.lock{background:linear-gradient(#162236,#10192a);border-style:dashed}
.tm-av{flex:none;width:52px;height:52px;border-radius:12px;display:grid;place-items:center;background:radial-gradient(circle at 50% 62%,#2f4868,#121c2e 72%);border:1px solid #3a5068;overflow:hidden}
.tm-av canvas{display:block;box-shadow:none;border-radius:0;touch-action:auto;max-width:100%;max-height:100%}
.tm-av svg{width:30px;height:30px}
.tm-cell.evo .tm-av{background:radial-gradient(circle at 50% 62%,#6a5a2a,#1c1a14 75%);border-color:#E1B86A}
.tm-sum.lock .tm-av canvas{filter:brightness(0);opacity:.55}
.tm-comp.lock .tm-av{filter:grayscale(1);opacity:.6}
.tm-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tm-nm{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-family:var(--serif);font-weight:900;font-size:16px;line-height:1.25;color:var(--ink)}
.tm-lv{font-style:normal;font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;font-weight:800;color:#F3D494;background:#0c1122aa;border:1px solid #4b6478;border-radius:8px;padding:0 6px;line-height:18px}
.tm-st{font-size:12px;color:#cfdcf0;font-weight:700}
.tm-line{font-size:13px;color:var(--sub);line-height:1.45}
.tm-line.go{color:#ffd2c2;font-weight:700}
.tm-line svg{width:14px;height:14px;vertical-align:-2px}
.tm-tag{display:inline-block;font-style:normal;font-family:system-ui,"Microsoft JhengHei",sans-serif;font-size:12px;font-weight:800;border-radius:8px;padding:0 6px;line-height:18px;background:#c23a4f;color:#fff}
.tm-tag.gold{background:linear-gradient(#ffe9a8,#E1B86A);color:#2a1d08}
.tm-cell>.mn-dot{top:7px;right:8px}
.tm-hero{min-height:120px;padding:14px;gap:12px}
.tm-hero .tm-av{width:88px;height:88px;border-radius:16px;border-color:#E1B86A;background:radial-gradient(circle at 50% 60%,#3a5a88,#121c2e 74%)}
.tm-hero .tm-nm{font-size:19px;color:#F3D494}
.tm-next{flex:none;width:70px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;line-height:1.3;color:var(--sub);text-align:center}
.tm-next canvas{width:44px;height:52px;box-shadow:none;border-radius:0;opacity:.9}
.tm-sum{flex-direction:column;align-items:center;text-align:center;gap:4px;padding:12px 8px 10px}
.tm-sum .tm-av{width:60px;height:60px}
.tm-sum .tm-nm{justify-content:center;font-size:15px}
.tm-bar{display:block;width:100%;max-width:150px;height:7px;border-radius:4px;background:#ffffff1a;overflow:hidden}
.tm-bar>i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#8fd0ff,#E1B86A)}
.tm-cell.evo .tm-bar>i{background:linear-gradient(90deg,#ffe9a8,#E1B86A)}
.tm-slots{display:flex;gap:4px;margin-top:2px}
.tm-slots span{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:#0c1122aa;border:1px solid #3a5068}
.tm-slots span.on{border-color:#E1B86A}
.tm-slots svg{width:18px;height:18px}
.tm-slots span:not(.on) svg{opacity:.35}
.tm-kit .tm-cell{align-items:flex-start}
.tm-kit .tm-av{width:44px;height:44px}
.tm-more{max-width:none;font-size:12.5px;line-height:1.6;color:var(--sub);background:#0c112266;border:1px solid #2e4560;border-radius:10px;padding:0 10px}
.tm-more summary{padding:0;min-height:44px;display:flex;align-items:center;font-weight:700;color:#cfdcf0}   /* 11-24 UIUX P1：「詳細」32 → 44px 高 */
.tm-more ul{margin:0 0 8px;padding-left:18px}
.tm-foot{display:flex;justify-content:center;padding-bottom:10px}
@media (max-width:380px){.tm-next{display:none}.tm-hero .tm-av{width:72px;height:72px}}
@media (min-width:900px){
  .tm-wrap{max-width:1060px}
  .tm-top{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;align-items:start}
  .tm-comps{grid-template-columns:repeat(3,minmax(0,1fr))}
  .tm-sums{grid-template-columns:repeat(5,minmax(0,1fr))}
  .tm-kit{grid-template-columns:repeat(2,minmax(0,1fr))}
}
.tm-wbtn{position:relative;flex:none;min-width:44px;min-height:44px;border-radius:10px;border:1px solid #E1B86A;background:#1B3545;color:#F3D494;display:inline-flex;align-items:center;justify-content:center;gap:3px;font-weight:800;font-size:13px;padding:0 10px}
.tm-wbtn svg{width:20px;height:20px}
.tm-wbtn>.mn-dot{top:-4px;right:-4px}
.tm-brief{padding:8px 10px}
.tm-bbtn{position:relative;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:12px;border:1px solid #4b6478;background:linear-gradient(#26384f,#172539);color:#eef2fa;font-weight:800;font-size:15px}
.tm-bbtn svg{width:24px;height:24px;flex:none}
.tm-bbtn.hot{border-color:#e0566a;box-shadow:0 0 12px rgba(224,86,106,.35)}
.tm-bbtn>.mn-dot{top:-4px;right:-4px}
.tm-wbtn.hide{display:none}
#sumBtns .tm-evo{position:absolute;left:6px;right:6px;bottom:2px;height:3px;border-radius:2px;background:#ffffff26;overflow:hidden;pointer-events:none}
#sumBtns .tm-evo>i{display:block;height:100%;background:linear-gradient(90deg,#8fd0ff,#E1B86A)}
#sumBtns .tm-evo.done{background:#E1B86A55}
#sumBtns .tm-evo.done>i{background:linear-gradient(90deg,#ffe9a8,#E1B86A)}
#sumBtns .tm-evd{border-color:#E1B86A}
.tm-bub{position:fixed;z-index:80;width:max-content;max-width:min(250px,calc(100vw - 24px));padding:8px 10px;border-radius:10px;background:#0c1122f2;border:1px solid #E1B86A;box-shadow:0 6px 16px #000a;color:var(--ink);font-size:13px;line-height:1.5;pointer-events:none;transform:translate(-50%,-100%);display:flex;gap:8px;align-items:center;text-align:left}
.tm-bub canvas{flex:none;width:40px;height:40px;box-shadow:none;border-radius:0}
.tm-bub b{color:#F3D494}
.tm-bub .tm-bar{margin-top:4px}
.tm-bub.hide{display:none}`;
  document.head.appendChild(css);

  // ───── 隊伍頁（全畫面）
  const app = document.getElementById("app") || document.body;
  const ov = document.createElement("div");
  ov.className = "ov hide"; ov.id = "ovTeam";
  app.appendChild(ov);
  let from = "menu", ret = false;   // from：回到哪（主選單／世界地圖）；ret：剛從隊伍頁點進子畫面，回主選單時改回隊伍頁

  const dot = on => (on ? '<i class="mn-dot" aria-label="這裡可以升級或有新東西"></i>' : "");
  const uic = k => U.uic(k, false);
  function knightCell(k) {
    let line, go = false;
    if (!k.on) line = "技能樹還沒開放";
    else if (k.lv < k.treeLv) line = "升到 Lv" + k.treeLv + " 就能學技能";
    else if (k.dot) { line = "有 " + (k.leftAuto != null ? k.leftAuto : k.left) + " 點技能點，可以學新技能"; go = true; }
    else if (k.left > 0) line = k.max ? "拿到更多文法徽章，就能學徽章技能" : k.next ? "再升到 Lv" + k.next.lv + " 就能學「" + k.next.name + "」" : "再升級或拿徽章，就能學下一招";
    else line = "技能點都用上了，升級會再拿到";
    const nx = k.nextEvo ? '<span class="tm-line">' + uic("up") + " Lv" + k.nextEvo + " 換新外觀「" + esc(k.nextName) + "」</span>" : '<span class="tm-line">' + uic("crown") + " 已經是最高外觀</span>";
    return '<button class="tm-cell tm-hero' + (k.dot ? " hot" : "") + '" data-tm="knight" aria-label="文法騎士，打開技能樹">' +
      '<span class="tm-av">' + U.icHtml("hero", "knight", k.lv, 80, 80) + '</span>' +
      '<span class="tm-tx"><span class="tm-nm">文法騎士<em class="tm-lv">Lv' + k.lv + '</em></span><span class="tm-st">' + esc(k.stageName) + '</span>' +
      '<span class="tm-line' + (go ? " go" : "") + '">' + line + '</span>' + nx + '</span>' +
      (k.nextEvo ? '<span class="tm-next"><canvas data-tmkn="' + (k.stage + 1) + '" data-w="44" data-h="52"></canvas>下一個樣子</span>' : "") + dot(k.dot) + '</button>';
  }
  function compCell(c) {
    const h = TG.HEROES[c.id] || {};
    const line = !c.unlocked ? uic("lock") + " 過第 " + c.need + " 關解鎖" : c.next ? "Lv" + c.next.lv + " 學會：" + esc(c.next.text) : "招式全部學會了";
    return '<button class="tm-cell tm-comp' + (c.unlocked ? "" : " lock") + (c.dot ? " hot" : "") + '" data-tm="comp">' +
      '<span class="tm-av" style="background:radial-gradient(circle at 50% 35%,' + (h.color || "#3a5068") + ',#0c1122)">' + U.icHtml("hero", c.id, 1, 46, 46) + '</span>' +
      '<span class="tm-tx"><span class="tm-nm">' + esc(c.name) + (c.unlocked ? '<em class="tm-lv">Lv' + c.lv + '</em>' : "") + (c.isNew ? '<em class="tm-tag">新</em>' : "") + '</span>' +
      '<span class="tm-line">' + line + '</span></span>' + dot(c.dot) + '</button>';
  }
  function sumCell(s) {
    if (!s.unlocked) return '<button class="tm-cell tm-sum lock" data-tm="sum"><span class="tm-av">' + U.icHtml("summon", s.id, 1, 52, 52) + '</span>' +
      '<span class="tm-nm">？？？</span><span class="tm-line">' + uic("lock") + " 過第 " + s.need + ' 關解鎖</span></button>';
    const line = s.evolved ? "已進化！效果更強" : "再召喚約 " + s.leftUses + " 次進化";
    return '<button class="tm-cell tm-sum' + (s.evolved ? " evo" : "") + (s.dot ? " hot" : "") + '" data-tm="sum" title="' + esc(sumTip(s)) + '">' +
      '<span class="tm-av">' + U.icHtml("summon", s.id, s.lv, 52, 52) + '</span>' +
      '<span class="tm-nm">' + esc(s.name) + '<em class="tm-lv">Lv' + s.lv + '</em></span>' +
      (s.isNew ? '<em class="tm-tag">新</em>' : s.newEvo ? '<em class="tm-tag gold">剛進化</em>' : "") +
      '<span class="tm-bar"><i style="width:' + Math.round(s.pct * 100) + '%"></i></span><span class="tm-line">' + line + '</span>' + dot(s.dot) + '</button>';
  }
  const gname = id => esc((TG.GEAR && TG.GEAR[id] && TG.GEAR[id].name) || id);
  const SLOT_IC = { weapon: "sword", armor: "shield", acc: "ring" };
  function gearCell(g) {
    if (!g.on) return "";
    let line, go = false;
    if (!g.open) line = uic("lock") + " 過第 " + g.need + " 關開放";
    else if (g.canStar.length) { line = "「" + gname(g.canStar[0]) + "」可以升星"; go = true; }
    else if (g.canCraft.length) { line = "可以打造「" + gname(g.canCraft[0]) + "」"; go = true; }
    else if (g.isNew) { line = "新功能：用碎片打造裝備"; go = true; }
    else line = "過關、拿徽章收集碎片";
    const slots = (TG.GEAR_SLOTS || []).map(sl => { const id = g.eq.find(x => TG.GEAR[x] && TG.GEAR[x].slot === sl.id); return '<span class="' + (id ? "on" : "") + '" title="' + esc(sl.name + "：" + (id ? TG.GEAR[id].name : "空著")) + '">' + uic(SLOT_IC[sl.id] || "bag") + "</span>"; }).join("");
    return '<button class="tm-cell' + (g.open ? "" : " lock") + (g.dot ? " hot" : "") + '" data-tm="gear"><span class="tm-av">' + uic("bag") + '</span>' +
      '<span class="tm-tx"><span class="tm-nm">裝備' + (g.isNew ? '<em class="tm-tag">新</em>' : "") + '</span><span class="tm-line' + (go ? " go" : "") + '">' + line + '</span>' +
      (g.open ? '<span class="tm-slots">' + slots + '</span>' : "") + '</span>' + dot(g.dot) + '</button>';
  }
  function talentCell(t) {
    if (!t.on) return "";
    let line, go = false;
    if (!t.open) line = uic("lock") + " 過第 " + t.need + " 關開放";
    else if (t.canLearn.length) { line = "有 ★" + t.avail + "，可以學新天賦"; go = true; }
    else if (t.isNew) { line = "新功能：用星星學天賦"; go = true; }
    else if (t.learned) line = "已學會 " + t.learned + " 個天賦";
    else line = "過關拿星星，就能學天賦";
    return '<button class="tm-cell' + (t.open ? "" : " lock") + (t.dot ? " hot" : "") + '" data-tm="talent"><span class="tm-av">' + uic("talent") + '</span>' +
      '<span class="tm-tx"><span class="tm-nm">星星天賦' + (t.isNew ? '<em class="tm-tag">新</em>' : "") + '</span><span class="tm-line' + (go ? " go" : "") + '">' + line + '</span></span>' + dot(t.dot) + '</button>';
  }
  const li = a => "<ul>" + a.map(x => "<li>" + x + "</li>").join("") + "</ul>";
  function render() {
    const m = M(true); if (!m) { ov.innerHTML = '<div class="tm-wrap"><p>隊伍資料讀不到，請回主選單再試一次。</p><div class="tm-foot"><button class="big ghost" data-tm="back">' + uic("back") + '返回</button></div></div>'; return; }
    const k = m.knight, g = m.gear, t = m.talent;
    const knDet = li([
      k.on ? "技能點：共 " + k.total + " 點，用了 " + k.spent + " 點，剩 " + k.left + " 點（每升 1 級拿 " + ((TG.KNIGHT && TG.KNIGHT.POINTS_PER_LV) || 2) + " 點）" : "技能樹還沒開放",
      "外觀：Lv" + (((TG.KNIGHT && TG.KNIGHT.EVO_LV) || TG.KNIGHT_EVO_LV || [5, 10, 15, 20]).join("、Lv")) + " 各換一次（目前第 " + (k.stage + 1) + " 階「" + esc(k.stageName) + "」）",
      "經驗：答對題目、過關都會加"
    ]);
    const cpDet = li(m.comps.map(c => esc(c.name) + "：" + (c.unlocked ? "Lv" + c.lv + (c.max ? "（最高）" : "，經驗 " + c.xp + "／" + c.xpNeed) : "過第 " + c.need + " 關加入（加入時 Lv" + c.lv + "）")).concat(["第 3 區起出征可以多帶 1 位，在關卡簡報選"]));
    const smDet = li(m.sums.map(s => (s.unlocked ? esc(s.name) + "：Lv" + s.lv + "，召喚過 " + s.uses + " 次" + (s.evolved ? "（已進化）" : "，再召喚約 " + s.leftUses + " 次進化成「" + esc(s.evoName) + "」") : "？？？：過第 " + s.need + " 關解鎖")).concat(["每召喚 1 次 +1 點、句子全部排對再 +1 點，每 " + (TG.PET_PTS_PER_LV || 3) + " 點升 1 級；Lv" + (TG.EVO_LV || 10) + " 進化，效果 ×" + (TG.EVO_MUL || 1.5)]));
    const kitDet = g.on ? li([
      "碎片 " + (g.shards || 0) + "；已打造 " + (g.owned || 0) + "／" + (g.all || 0) + " 件",
      "目前裝備：" + ((TG.GEAR_SLOTS || []).map(sl => { const id = g.eq.find(x => TG.GEAR[x] && TG.GEAR[x].slot === sl.id); return sl.name + " " + (id ? gname(id) : "空著"); }).join("、")),
      t.open ? "天賦：可用 ★" + t.avail + "（共 ★" + t.stars + "），已學 " + t.learned + "／" + t.all + " 個" : "天賦：過第 " + t.need + " 關開放"
    ]) : "";
    const sumGot = m.sums.filter(s => s.unlocked).length, compGot = m.comps.filter(c => c.unlocked).length;
    ov.innerHTML = '<div class="tm-wrap">' +
      '<h2 class="tm-head">' + uic("people") + '隊伍</h2>' +
      '<p class="tm-help">點任何一格就能去那裡升級。<span class="tm-d"></span>紅點＝現在可以升級，或有新夥伴。</p>' +
      '<div class="tm-top"><section class="tm-sec"><h3>' + U.icHtml("hero", "knight", k.lv, 22, 22) + '主角</h3>' + knightCell(k) +
      '<details class="tm-more"><summary>詳細</summary>' + knDet + '</details></section>' +
      (g.on ? '<section class="tm-sec"><h3>' + uic("bag") + '裝備與天賦</h3><div class="tm-grid tm-kit">' + gearCell(g) + talentCell(t) + '</div>' +
        '<details class="tm-more"><summary>詳細</summary>' + kitDet + '</details></section>' : "") + '</div>' +
      (m.comps.length ? '<section class="tm-sec"><h3>' + uic("people") + '同伴<small>' + compGot + '／' + m.comps.length + '</small></h3><div class="tm-grid tm-comps">' + m.comps.map(compCell).join("") + '</div>' +
        '<details class="tm-more"><summary>詳細</summary>' + cpDet + '</details></section>' : "") +
      '<section class="tm-sec"><h3>' + U.icHtml("summon", "fox", 1, 22, 22) + '召喚獸<small>' + sumGot + '／' + m.sums.length + '</small></h3><div class="tm-grid tm-sums">' + m.sums.map(sumCell).join("") + '</div>' +
      '<details class="tm-more"><summary>詳細</summary>' + smDet + '</details></section>' +
      '<div class="tm-foot"><button class="big ghost" data-tm="back">' + uic("back") + (from === "world" ? "回世界地圖" : from === "brief" ? "回關卡簡報" : "回主選單") + '</button></div></div>';
    U.paintIcons(ov);
    paintKnights(ov);
  }
  function paintKnights(root) {
    root.querySelectorAll("canvas[data-tmkn]").forEach(c => {
      if (c.dataset.done) return; c.dataset.done = "1";
      const d = Math.min(3, W.devicePixelRatio || 1), w = +c.dataset.w || 44, h = +c.dataset.h || w;
      c.width = Math.round(w * d); c.height = Math.round(h * d);
      try { if (W.ART && W.ART.knightIcon) W.ART.knightIcon(c, +c.dataset.tmkn); } catch (e) {}
    });
  }
  function open(src) {
    if (src) from = src;
    ret = false; drop();
    U.show(null); render(); ov.classList.remove("hide"); ov.scrollTop = 0;
  }
  function close() {
    ov.classList.add("hide"); ret = false;
    if (from === "world") U.openWorld(); else if (from === "brief" && briefSt && U.openBrief) U.openBrief(briefSt); else { U.show("ovMenu"); U.menuInfo(); }
  }
  // 點格子：打開既有畫面（回來時回到隊伍頁）
  const OPEN = {
    knight: () => !!(U.knight && typeof U.knight.openTree === "function" && (U.knight.openTree(null), true)),
    comp: () => !!(typeof U.openCompanions === "function" && (U.openCompanions(), true)),
    sum: () => !!(typeof U.openCreatures === "function" && (U.openCreatures(), true)),
    gear: () => { const it = menuItem("bag"); return !!(it && (it.onClick(), true)); },
    talent: () => { const it = menuItem("talent"); return !!(it && (it.onClick(), true)); }
  };
  function go(kind) {
    if (kind !== "knight") seen(kind);
    ret = true; ov.classList.add("hide");
    let ok = false; try { ok = OPEN[kind] && OPEN[kind](); } catch (e) { console.error("[team]", e); }
    if (!ok) { ret = false; ov.classList.remove("hide"); U.toast("這個畫面還沒開放"); }
  }
  ov.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tm]"); if (!b) return;
    const k = b.dataset.tm;
    if (k === "back") return close();
    if (OPEN[k]) go(k);
  });
  U.openTeam = open;   // 測試／截圖／其他外掛用

  // ───── 關卡簡報入口（第二輪 P2，11-24 小安）：第 1～3 關結算按「下一關」直接進簡報，孩子根本經過不到主選單的「隊伍」紅點 → 簡報也放一顆
  let briefSt = null;
  U.add("brief", st => {
    briefSt = st;
    if (U.cleared() < TEAM_AT) return "";
    const m = M(true), hot = !!(m && m.any);
    return '<div class="card tm-brief"><button class="kn-btn tm-bbtn' + (hot ? " hot" : "") + '" data-tmb="1">' + uic("people") + '<span>隊伍' + (hot ? "：有東西可以升級" : "：看看夥伴") + '</span>' + dot(hot) + '</button></div>';
  });
  U.add("briefBind", (st, root) => {
    const b = root && root.querySelector && root.querySelector("[data-tmb]"); if (!b) return;
    b.onclick = () => { briefSt = st; open("brief"); };
  });

  // ───── 主選單入口（排第一格；紅點＝隊伍頁任何一格有紅點）
  const item = {
    label: () => { const m = M(); return "隊伍" + (m && m.count ? "（" + m.count + " 個提醒）" : "（全員一覽）"); },
    icon: "people",
    badge: () => { const m = M(); return !!(m && m.any); },
    onClick: () => open("menu"),
    unlockAt: TEAM_AT
  };
  if (U.hooks && Array.isArray(U.hooks.menu)) U.hooks.menu.unshift(item); else U.add("menu", item);
  // 11-24 UI/UX 流程 P2-3：主選單其他格子的紅點改用隊伍頁同一套判斷（原本技能樹格子用自己的規則，結算說有新技能、格子卻沒紅點）
  const SAME = [
    [it => it.icon && typeof it.icon === "object" && it.icon.kind === "hero" && it.icon.id === "knight", m => m.knight.dot],
    [it => it.icon && typeof it.icon === "object" && it.icon.kind === "hero" && it.icon.id !== "knight", m => m.comps.some(c => c.dot)],
    [it => it.icon && typeof it.icon === "object" && it.icon.kind === "summon", m => m.sums.some(s => s.dot)],
    [it => it.icon === "bag", m => m.gear.dot],
    [it => it.icon === "talent", m => m.talent.dot]
  ];
  for (const it of (U.hooks && U.hooks.menu) || []) {
    if (!it || it === item) continue;
    const hit = SAME.find(([f]) => safe(() => f(it), false)); if (!hit) continue;
    const old = it.badge, pick = hit[1];
    it.badge = () => { const m = M(); if (m) return !!safe(() => pick(m), false); return typeof old === "function" ? !!old() : false; };
  }

  // ───── 世界地圖頂列入口（index.html 的 .wm-top 右側；原本的入口都保留）
  const wbtn = document.createElement("button");
  wbtn.className = "tm-wbtn hide"; wbtn.type = "button"; wbtn.setAttribute("aria-label", "隊伍");
  wbtn.onclick = () => open("world");
  const wtop = document.querySelector("#ovWorld .wm-top");
  if (wtop) wtop.appendChild(wbtn);
  let wHtml = "";   // 上次寫進去的內容（不能拿 innerHTML 比：SVG 序列化後字串不同，會和 MutationObserver 互相觸發成無窮迴圈）
  function refreshWorldBtn() {
    const okAt = U.cleared() >= TEAM_AT; wbtn.classList.toggle("hide", !okAt);
    if (!okAt) return;
    const m = M(true), html = uic("people") + "<span>隊伍</span>" + dot(!!(m && m.any));
    if (wHtml !== html) { wHtml = html; wbtn.innerHTML = html; }
  }

  // ───── 看畫面切換：子畫面回主選單時改回隊伍頁、子畫面的「回主選單」字樣改成「回隊伍」、打開圖鑑／同伴／裝備／天賦＝新解鎖看過了
  const vis = id => { const e = document.getElementById(id); return !!e && !e.classList.contains("hide") && e.isConnected; };
  const SUBS = ["ovCreatures", "ovCmp", "ovKnight", "ovGearMod"];
  function relabel(el) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const hits = []; let n;
    while ((n = tw.nextNode())) if (n.nodeValue.indexOf("回主選單") >= 0) hits.push(n);
    for (const t of hits) t.nodeValue = t.nodeValue.replace("回主選單", "回隊伍");
  }
  let busy = false;
  function watch() {
    if (busy) return; busy = true;
    try {
      if (vis("ovCreatures")) seen("sum");
      if (vis("ovCmp")) seen("comp");
      if (vis("ovGearMod")) { const k = document.getElementById("ovGearMod").dataset.kind; seen(k === "talent" ? "talent" : "gear"); }
      if (vis("ovWorld")) { ret = false; refreshWorldBtn(); }
      if (ret) {
        if (vis("ovMenu")) { ret = false; open(); }
        else if (vis("ovBrief") || vis("ovEnd")) ret = false;
        else for (const id of SUBS) if (vis(id)) relabel(document.getElementById(id));
      }
    } catch (e) { console.error("[team watch]", e); }
    busy = false;
  }
  if (W.MutationObserver) new MutationObserver(watch).observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  // ───── 戰鬥：召喚鈕加進化進度條、提示文字（滑鼠停留＝title；手機長按＝泡泡）
  const sumById = id => { const m = M(); return m && m.sums.find(s => s.id === id); };
  let sig = "";
  function decorate(G) {
    const box = document.getElementById("sumBtns"); if (!box || !G) return;
    const btns = box.querySelectorAll("[data-sum]"); if (!btns.length) return;
    const pets = U.S.pets || {};
    let now = btns.length + ":";
    btns.forEach(b => { const p = pets[b.dataset.sum] || {}; now += b.dataset.sum + (p.lv | 0) + "." + (p.uses | 0) + (b.querySelector(".tm-evo") ? "" : "!") + ","; });
    if (now === sig) return;
    sig = now; drop();
    btns.forEach(b => {
      const s = sumById(b.dataset.sum); if (!s) return;
      let bar = b.querySelector(".tm-evo");
      if (!bar) { bar = document.createElement("span"); bar.className = "tm-evo"; bar.innerHTML = "<i></i>"; b.appendChild(bar); }
      bar.firstChild.style.width = Math.round(s.pct * 100) + "%";
      bar.classList.toggle("done", s.evolved);
      b.classList.toggle("tm-evd", s.evolved);
      b.title = sumTip(s);
      b.setAttribute("aria-label", sumTip(s));
      const nm = b.querySelector(".nm"); if (nm && nm.textContent !== s.name) nm.textContent = s.name;   // 進化後名字跟著換（圖示 index 會換）
    });
  }
  U.add("start", () => { sig = ""; hideBub(); });
  U.add("frame", G => { try { decorate(G); } catch (e) {} });

  const bub = document.createElement("div");
  bub.className = "tm-bub hide"; bub.setAttribute("role", "status");
  document.body.appendChild(bub);
  let bubT = 0, pressT = 0, longDone = 0;
  function hideBub() { bub.classList.add("hide"); clearTimeout(bubT); }
  function showBub(b) {
    const s = sumById(b.dataset.sum); if (!s) return;
    bub.innerHTML = (s.evolved ? "" : U.icHtml("summon", s.id, TG.EVO_LV || 10, 40, 40)) +
      '<div><b>' + esc(s.evolved ? s.name : s.name + " Lv" + s.lv) + '</b><br>' + (s.evolved ? "已經進化了，效果更強" : "再召喚約 " + s.leftUses + " 次<br>→ 進化成「" + esc(s.evoName) + "」") +
      '<span class="tm-bar"><i style="width:' + Math.round(s.pct * 100) + '%"></i></span></div>';
    U.paintIcons(bub);
    const r = b.getBoundingClientRect(), x = clamp(r.left + r.width / 2, 130, Math.max(130, W.innerWidth - 130));
    bub.style.left = x + "px"; bub.style.top = Math.max(60, r.top - 8) + "px";
    bub.classList.remove("hide"); clearTimeout(bubT); bubT = setTimeout(hideBub, 2600);
  }
  const sb = document.getElementById("sumBtns");
  if (sb) {
    sb.addEventListener("pointerdown", ev => {
      const b = ev.target.closest("[data-sum]"); if (!b) return;
      clearTimeout(pressT); pressT = setTimeout(() => { longDone = Date.now(); showBub(b); }, 480);
    });
    for (const k of ["pointerup", "pointercancel", "pointerleave"]) sb.addEventListener(k, () => clearTimeout(pressT));
    sb.addEventListener("contextmenu", ev => { if (ev.target.closest("[data-sum]")) ev.preventDefault(); });
    // 長按放開時瀏覽器還是會送 click → 這一下不要打開召喚面板（捕獲階段先攔）
    sb.addEventListener("click", ev => { if (longDone && Date.now() - longDone < 900) { longDone = 0; ev.stopPropagation(); ev.preventDefault(); } }, true);
  }
  // 第一次召喚完：提示一次「長按看進化進度」（看過記在存檔）
  U.add("event", (ev, G) => {
    if (ev.k !== "summon") return;
    const d = seenData(U.S); if (d.tipSum) return;
    d.tipSum = 1; try { U.save(); } catch (e) {}
    setTimeout(() => { if (U.G === G && G && !G.over) U.toast("召喚鈕下面的細條是進化進度，長按可以看還要幾次"); }, 2400);
  });

  // ───── 瀏覽器機器人：戰鬥中隊伍頁不該開著
  W.TGBOT = (W.TGBOT || []).concat((T, G) => {
    if (G && !G.over && !ov.classList.contains("hide")) { ov.classList.add("hide"); return true; }
    return false;
  });

  try { U.menuInfo(); } catch (e) {}
})();
