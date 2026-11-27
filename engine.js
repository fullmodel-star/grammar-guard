// 文法片語守衛戰 929 — 塔防引擎（純邏輯、無 DOM，可在 node 模擬整局）
// 座標系：地圖 300×400 邏輯單位；時間單位秒。UI 在 index.html。設計見 DESIGN.md。
(function (root) {
  const TG = {};
  const H = Math.hypot;

  // ═════════ 外掛（mods/*.js 用 TG.registerMod 登錄；掛勾清單見 mods/README.md）
  TG.MODS = [];
  TG.registerMod = m => { TG.MODS.push(m); return m; };
  const hook = (name, ...a) => { for (const m of TG.MODS) if (m[name]) m[name](...a); };
  const fold = (name, v, ...a) => { for (const m of TG.MODS) if (m[name]) { const r = m[name](v, ...a); if (r !== undefined) v = r; } return v; };
  const every = (name, ...a) => TG.MODS.every(m => !m[name] || m[name](...a) !== false);
  TG.hook = hook; TG.fold = fold; TG.every = every;

  // ═════════ 地圖：五區各一張（路線可多條，終點都是城堡）
  const MAP_DEFS = [
    { id: "meadow", name: "新手草原", grass: ["#2b5a3a", "#1d4029"], road: ["#5c4630", "#a3825a"],
      paths: [[[-20, 50], [250, 50], [250, 150], [50, 150], [50, 250], [250, 250], [250, 340], [150, 340], [150, 392]]] },
    { id: "forest", name: "時光森林", grass: ["#1f4a3c", "#163328"], road: ["#4a3a2a", "#8a6e4c"],
      paths: [[[-20, 35], [115, 35], [115, 105], [25, 105], [25, 180], [115, 180], [115, 250], [25, 250], [25, 320], [150, 320], [150, 392]],
              [[320, 35], [185, 35], [185, 105], [275, 105], [275, 180], [185, 180], [185, 250], [275, 250], [275, 320], [150, 320], [150, 392]]] },
    { id: "swamp", name: "迷霧沼澤", grass: ["#33473a", "#222f28"], road: ["#3f3b2c", "#77704f"],
      paths: [[[-20, 40], [255, 40], [255, 120], [45, 120], [45, 205], [255, 205], [255, 290], [45, 290], [45, 360], [150, 360], [150, 392]]] },
    { id: "glacier", name: "寒冰山脈", grass: ["#3b5566", "#26394a"], road: ["#6f8597", "#b9cad6"],
      paths: [[[320, 40], [40, 40], [40, 360], [260, 360], [260, 125], [120, 125], [120, 280], [195, 280], [195, 205]]] },
    { id: "volcano", name: "魔龍火山", grass: ["#4a2a24", "#2d1714"], road: ["#3a2420", "#8a5a3c"],
      paths: [[[-20, 200], [55, 200], [55, 40], [150, 40], [150, 360], [245, 360], [245, 60], [285, 60]]] }
  ];
  function mkRoute(path) {
    const seg = []; let len = 0;
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i - 1], [x2, y2] = path[i], L = H(x2 - x1, y2 - y1);
      seg.push({ x1, y1, x2, y2, L, s: len }); len += L;
    }
    return { path, seg, len, end: path[path.length - 1] };
  }
  function nearOnRoute(rt, x, y) {
    let best = { d: 1e9, along: 0, x: 0, y: 0 };
    for (const g of rt.seg) {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1, t = Math.max(0, Math.min(1, ((x - g.x1) * dx + (y - g.y1) * dy) / (g.L * g.L)));
      const px = g.x1 + dx * t, py = g.y1 + dy * t, d = H(x - px, y - py);
      if (d < best.d) best = { d, along: g.s + g.L * t, x: px, y: py };
    }
    return best;
  }
  function nearOnMap(m, x, y) {
    let best = null;
    m.routes.forEach((rt, r) => { const n = nearOnRoute(rt, x, y); if (!best || n.d < best.d) best = Object.assign(n, { r }); });
    return best;
  }
  // 塔位：貼路邊（距最近路線 28~42）、彼此 ≥40、離城堡 ≥40；沿路線順序均勻挑 12 個
  function autoSlots(m) {
    const cand = [];
    for (let x = 18; x <= 282; x += 6) for (let y = 18; y <= 382; y += 6) {
      const n = nearOnMap(m, x, y);
      if (n.d >= 28 && n.d <= 42 && H(x - m.end[0], y - m.end[1]) >= 40) cand.push({ x, y, k: n.r * 10000 + n.along, d: n.d });
    }
    cand.sort((a, b) => a.k - b.k || a.d - b.d);
    const out = [];
    for (const c of cand) if (out.every(o => H(o[0] - c.x, o[1] - c.y) >= 40)) out.push([c.x, c.y]);
    if (out.length <= 12) return out;
    const pick = [];
    for (let i = 0; i < 12; i++) pick.push(out[Math.round(i * (out.length - 1) / 11)]);
    return pick;
  }
  function posOn(rt, d) {
    d = Math.max(0, Math.min(d, rt.len));
    for (const g of rt.seg) if (d <= g.s + g.L) { const t = (d - g.s) / g.L; return { x: g.x1 + (g.x2 - g.x1) * t, y: g.y1 + (g.y2 - g.y1) * t }; }
    return { x: rt.end[0], y: rt.end[1] };
  }
  TG.MAPS = MAP_DEFS.map(def => {
    const m = Object.assign({}, def, { w: 300, h: 400 });
    m.routes = def.paths.map(mkRoute);
    m.end = m.routes[0].end;
    m.slots = autoSlots(m);
    const rt = m.routes[0], p = posOn(rt, rt.len * 0.62); m.heroHome = [p.x, p.y];
    return m;
  });
  TG.posOn = posOn;
  TG.nearOnMap = nearOnMap;
  TG.distToPath = (m, x, y) => nearOnMap(m, x, y).d;

  // ═════════ 世界地圖：5 區 22 關（gps＝自動題文法點；orig＝原創題等級）
  TG.REGIONS = [
    { name: "新手草原", map: 0, color: "#5fae6e", em: "🌿", boss: "beGiant" },
    { name: "時光森林", map: 1, color: "#3f9c7f", em: "🌲", boss: "treant" },
    { name: "迷霧沼澤", map: 2, color: "#8a9a6a", em: "🌫️", boss: "boss" },
    { name: "寒冰山脈", map: 3, color: "#7fb3d8", em: "🏔️", boss: "boss" },
    { name: "魔龍火山", map: 4, color: "#e0704a", em: "🌋", boss: "boss" }
  ];
  const ST = (r, name, gps, orig, boss, rule) => ({ r, name, gps, orig, boss: !!boss, rule: rule || "" });
  // v3（2026-11-22 第 1 組照第 4 組 mods/qkinds.js 的 TG.STAGE_GPS_V3 抄）：第 1 批新文法點 G15～G35 接進關卡；第 20 關改課綱內「進階句型」（老闆裁示）。
  //   lvr＝{文法點: [最低, 最高]}：該文法點只收這個等級範圍（TG.stagePool 支援）；gpW＝文法點目標比例（qkinds 的 pickQuestion 讀）
  TG.STAGES = [
    ST(0, "be 動詞與名詞", ["G01", "G15", "G17", "G18"], [], false, "be 動詞 am／is／are、名詞單複數、a／an／the、There is／There are。"),
    ST(0, "第三人稱單數", ["G03", "G21"], [], false, "第三人稱單數動詞加 -s／-es，以及借 do／does 的否定句和問句。"),
    ST(0, "代名詞・冠詞・疑問詞", ["G16", "G17", "G19", "G20"], [], false, "代名詞主格／受格／所有格、a 與 an、祈使句與 Let's、Who／What／Where／How 等疑問詞。"),
    ST(0, "Be 巨人", ["G01", "G03", "G15", "G16", "G17", "G18", "G19", "G20", "G21"], [1], true, "第一區總複習。Be 巨人會叫出標著 am／is／are 的小怪，點對的那隻才能打傷它！"),
    ST(1, "現在進行式", ["G05", "G23"], [], false, "am／is／are＋V-ing＝正在做；always、usually 等頻率副詞的位置，too 和 either。"),
    ST(1, "過去式", ["G02", "G04", "G21"], [], false, "be 動詞過去式 was／were、一般動詞過去式，以及借 did 的否定句和問句。"),
    ST(1, "助動詞與未來式", ["G06", "G25"], [], false, "can、must、should 後面接原形；will＋原形、be going to＋原形說未來。"),
    ST(1, "介系詞", ["G10", "G22"], [], false, "時間介系詞 in／on／at，地方介系詞 in、on、under、next to、in front of、between。"),
    ST(1, "比較級與數量詞", ["G07", "G24"], [], false, "比較級加 -er 或 more；many／much、some／any、a lot of。"),
    ST(1, "時光樹妖", ["G02", "G04", "G05", "G06", "G07", "G10", "G22", "G23", "G24", "G25"], [2], true, "第二區總複習。時光樹妖會封印你的塔，答對時態題才能解封！"),
    ST(2, "最高級與感覺形容詞", ["G08", "G29"], [], false, "the＋最高級；look、feel、sound 後面接形容詞，-ing 令人…、-ed 感到…。"),
    ST(2, "不定詞與動名詞", ["G09", "G30"], [], false, "want to、enjoy V-ing；It is＋形容詞＋to、It takes…to、too…to。"),
    ST(2, "完成式與過去進行式", ["G11", "G26"], [], false, "have／has＋過去分詞；was／were＋V-ing＝過去某時正在做。"),
    ST(2, "片語動詞與連接詞", ["G14", "G27"], [], false, "動詞＋介副詞要整組記；and、but、or、so 與 not only…but also。"),
    ST(2, "沼澤魔王", ["G08", "G09", "G11", "G14", "G26", "G27", "G29", "G30"], [3], true, "第三區總複習：最高級、不定詞與動名詞、完成式、片語動詞、連接詞。"),
    ST(3, "被動語態與授與動詞", ["G12", "G34"], [], false, "be＋過去分詞＝被…；give／buy＋人＋東西，倒過來加 to／for；used to＋原形。"),
    ST(3, "關係代名詞與副詞子句", ["G13", "G28"], [], false, "人用 who、東西用 which；when、if 說未來也用現在式，because 不和 so 一起用。"),
    ST(3, "間接問句・附加問句・感嘆句", ["G32", "G33", "G35"], [], false, "間接問句用直述句語序、附加問句前肯後否、What／How 感嘆句。"),
    ST(3, "冰原魔王", ["G12", "G13", "G28", "G32", "G33", "G34", "G35"], [4], true, "第四區總複習：被動、關係代名詞、間接問句與各種句型。"),
    ST(4, "進階句型", ["G31", "G30", "G09", "G34"], [], false, "使役與感官動詞＋原形、It 句型與 too…to／so…that、不定詞與動名詞、授與動詞與 used to。"),
    ST(4, "進階片語", ["G14"], [], false, "run into、come up with、take part in、look forward to 等常考片語。"),
    ST(4, "終極魔龍", ["G01", "G03", "G16", "G21", "G04", "G06", "G22", "G25", "G09", "G11", "G14", "G29", "G12", "G13", "G32", "G33", "G30", "G31", "G34"], [3, 4, 5], true, "全部文法大魔王！")
  ];
  // 11-24 第二輪（C 組交接）：第 3、18、21 關不是魔王關，拿掉「原創題等級」（沒有文法點的 o 題只剩 18 題，只放魔王關）；
  //   第 2 關 G21（do／does／did）只收第 1 級：第 2 級有 did（過去式）的題，關卡說明只教 do／does（題池 191 → 161 題）
  TG.STAGES[1].lvr = { G21: [1, 1] };
  TG.STAGES[11].lvr = { G30: [3, 3] };
  TG.STAGES[19].lvr = { G30: [4, 5], G09: [4, 5], G34: [4, 5] }; TG.STAGES[19].gpW = { G31: 35, G30: 35, G09: 15, G34: 15 };
  // 各區怪物血量加成（2026-11-21 全部外掛一起模擬後調：草原簡單、逐區變難、魔王關再 ×1.15）
  TG.REGION_HP_BOOST = [1, 1.05, 2.2, 2.3, 2.1];   // 舊的區域加成（只在 STAGE_HP_BOOST 沒給該關時用）；第 5 區 2.4→2.1（11-21 整合第二輪）：2.4 時七成對在第 20～22 關掉到 1 星或失守，全對卻仍滿血，落差太陡
  TG.BOSS_STAGE_BOOST = 1.15;
  TG.MAX_WAVES = 8;   // 11-21 試玩：後期一關原本 9～12 波、120～236 題，真人要 15～20 分鐘 → 每關最多 8 波
  // 每關波數（11-22）：8 波時模擬試玩一般玩家後期一關 13～19 分鐘、50～60 題 → 第 2 區 7 波、第 3 區 6 波、第 4～5 區 5 波（血量另由 STAGE_HP_BOOST 補；
  //   後期每波主要花在怪走完長路線，減每波怪數幾乎不省時間，只能減波數）
  TG.STAGE_WAVES = i => i < 4 ? 8 : i < 10 ? 7 : i < 15 ? 6 : 5;
  // 開局血量（11-22）：後期關卡怪物血量是前期好幾倍，但開局金幣差不多，第 1～2 波只蓋得出幾座 1 級塔
  //   → 火山區鐵人／英雄挑戰全對也第 1 波必漏。第 1 波 ×(1−OPEN_CUT[0]×進度)、第 2 波 ×(1−OPEN_CUT[1]×進度)，進度＝關卡序號/21。
  TG.OPEN_CUT = [0.5, 0.3];
  TG.openHpMul = (st, w) => st && w >= 1 && w <= TG.OPEN_CUT.length ? 1 - TG.OPEN_CUT[w - 1] * st.i / 21 : 1;
  // 逐關怪物血量加成（11-21 試玩後由「只依區域」改成逐關漸進；魔王關另乘 BOSS_STAGE_BOOST）。
  // 原本第 2→3 區 1.05 → 2.2 一次跳，照真人習慣玩（塔不升滿、少召喚）的第 3 區起全輸。
  // 11-22 重調：一般玩家機器人改成真人累積進度（模擬試玩小明第 16 關只剩 6 命、第 17 關 9 次全輸＝原本 1.5→1.8 的牆），
  //   用二分搜尋逐關找「一般玩家平均剩命≈目標」（前兩區 20→16、第 3 區 14→12、第 4～5 區 12→9）再手動抹平；
  //   第 3 區起波數變少（STAGE_WAVES）所以數值比舊表低。塔堆滿的高手改由塔力加血（POWER_HP_UPS）補。
  // 11-23 第 7 步平衡（召喚 8／火狐 42／同伴大招 7／卡片封頂下修／自願題留 10 點、完美打法改真人進度之後）重找：
  //   第 1 區：第 1 關 1→1.1、第 2 關 1.4→1.75（零答題機器人原本第 1、2 關都過；1.75 時零答題第 2 關 10 個種子輸 8 個、新手 40% 最少剩 6 命）；
  //   第 3～5 區：照舊法二分搜尋，一般玩家（65%、真人進度）每關 8 個種子平均剩命≈12（7～16 的中段），第 3 區的區域係數 NEWCURVE_HP 1.45→1.885、本表同除 1.3
  //   （相鄰兩關差 ≤0.7）。對所有人一樣，不看答對率。
  // 11-25 晚（魔王守城門＋魔王降血 TG.BOSS_HP_K 之後重找）：逐關自動調（一般 65%／13 秒，邊打邊答＋先答題各 8 種子，目標第一次過關 68～84%；
  //   輸在城門＝魔王降血、輸在小怪＝小怪降血）。前兩區原本 100% 一次過 → 第 2～9 關加血（第 2 關是第 1 區第二關，只到 1.8：相鄰差 ≤0.7）；第 17 關（蝙蝠王）降。
  //   數據與工具見 mods/CONTRACT_v3.md §14h。下面舊註解的數字是當時的值。
  TG.STAGE_HP_BOOST = [
    1.1, 1.75, 1.85, 1.45,             // 第 1 區 新手草原（第 1 關＝教學關，全錯也能過；零答題機器人第 2 關起守不住）
    1.85, 1.6, 1.55, 1.3, 1.3, 1.0,    // 第 2 區 時光森林（雙入口；7 波）；11-23 第 6～8 關 1.4／1.3／1.15 → 1.3／1.05／1.0（新手 40%、答對率 0.5 在第 7 關 10 個種子輸 2 個、剩 1～2 命）
                                       //   11-23 同伴／召喚獸提早解鎖（精靈弓手過 3 關、冰鳳過 6 關、冰雪法師過 7 關、光獨角獸過 9 關）：1.4／1.3／1.05／1.0／1.0／0.85 → 1.7／1.55／1.45／1.2／1.2／1.0（約 ×1.2；第 7 關 ×1.4：1.3 時零答題 10 種子贏 9 局、1.45 時輸 8 局，新手最少剩 10 命）
                                       //   （不調時新手 40% 第 5～9 關平均剩 18～20 命、零答題機器人靠同伴打過第 5～9 關；調後新手第 5～10 關平均 ≈15 命（解鎖前 12.2）、零答題 48 局輸 35 局）
    1.0, 1.08, 1.05, 1.0, 1.0,         // 第 3 區（第 14 關 1.12→1.0：regression 一般玩家 2 種子全輸）（11-25 加關卡魔王與挑戰性後磨平尖峰：第 13 關 1.13→1.0、第 14 關 1.27→1.12、第 15 關九頭蛇 1.12→1.0，原本一般或七成玩家 3 種子全輸） 迷霧沼澤（6 波；區域係數 NEWCURVE_HP[2]＝1.885）
                                       //   11-24 老闆裁示拿掉「答對率 <50% 怪血最多 −15%」（答對越多不能讓怪變硬）後補回：第 10／11／12 關 0.92／1.0／1.1 → 0.88／0.95／1.05（約 −4～5%，
                                       //   ＝答對 40% 的孩子原本在第 2、3 區平均吃到的下修 7.5%／5%）。對所有人一樣、不看答對率；只補慢答孩子會卡的第 10～12 關，不整區降（整區降全錯機器人會回到過 11 關的上限）。
                                       //   慢答新手 12 個種子第 10／11／12 關平均剩命：拿掉前 10.9／13.9／12.4、拿掉後不補 10.3／13.4／12.3（第 12 關輸 1 局）、補後 10.6／14.4／12.5（全過）
                                       //   11-24 第二輪（試玩小美 P0-2：第 11 關是慢答孩子的死牆，第 10→11 關實際血量 ×2.4）：第 11、12 關 1.52／1.58 → 1.0／1.1（頭兩關漸進；第 3 波史萊姆血量 第 10→11→12→13 關 108→319→387→437，原本 117→484→556→406）。
                                       //   regression 慢答新手（一題 18～25 秒、答對 40%）調前第 11 關 3 個種子輸 2、第 12 關全輸；調後第 1～12 關不失守。再低（0.82／0.97）全錯機器人會打過第 11、12 關（紅線：答題要有用），所以停在 1.0／1.1，其餘靠第 1 次輸就給 −40% 練習模式。對所有人一樣，不看答對率
    1.13, 0.93, 1.19, 1.01,            // 第 4 區（regression 一般玩家第 17、19 關 2 種子全輸 → 1.3→1.18、1.02→0.92）（11-25 同上：第 17 關 1.48→1.3、第 19 關冰霜巫妖 1.16→1.02） 寒冰山脈（5 波）
    1.34, 1.35, 0.97                   // 第 5 區 魔龍火山（5 波）
    // 11-24 第二輪（B 組）另外兩處：①第 10 關（時光樹妖）1.0 → 0.92：慢答新手（一題 18～25 秒）3 個種子有 1 個輸、其他剩 2～10 命（樹妖封塔要答對才解，答得慢的孩子吃虧最多）。
    //   ②第 13～19、22 關 ×1.08（第 20、21 關不加：試玩小明的牆就在這兩關）：召喚獸進化改點數制（約 14～20 次就進化，原本 45 次）＋能量滿答對換金幣後，真人進度的召喚獸後期約 Lv10 進化（原本 Lv4），
    //   一般玩家第 3～5 區剩命 12.5 → 14.5、全對幾乎全三星；×1.08 後拉回 ≈12（7～16 中段）。對所有人一樣，不看答對率（理由與數據見 _research/第二輪_交接_B.md）
  ];
  // 11-25 挑戰性（老闆：「要有點挑戰性」→ 裁示「一般孩子七到八成一次過」）：依區域整體加血（對所有人一樣，不看答對率）；第 1 關是教學關不加。
  //   模擬（3 種子、加了關卡魔王後）：不加時四種角色都 100% 一次過；本表＋磨平尖峰後 一般 65%／13 秒 邊打邊答 86%、先答題 83%，七成 92／100%，全對 100%（平均星 2.6），
  //   慢答 40% 78／89%（輸了有練習模式）。後三區再 +5% 一般只到 82%、第 14 關又變成 3 種子全輸的牆，所以停在這裡。
  TG.CHALLENGE_K = [1, 1.25, 1.5, 1.5, 1.44];   // 第 1 區不加（答對四成的新手第 2 關就全輸；第 1 區的挑戰交給關卡魔王）
  TG.challengeK = st => (st.i === 0 ? 1 : TG.CHALLENGE_K[st.r] || 1);
  TG.STAGES.forEach((st, i) => {
    st.i = i; st.map = TG.REGIONS[st.r].map;
    st.waves = Math.min(TG.MAX_WAVES, TG.STAGE_WAVES(i));
    const m = TG.MAPS[st.map], avg = m.routes.reduce((x, r) => x + r.len, 0) / m.routes.length;
    st.hpMul = (1 + 0.1 * i + 0.01 * i * i) * Math.pow(avg / 1150, 0.6) * (m.routes.length > 1 ? 0.82 : 1);   // 路線越長血越厚；雙入口分散火力要降
    st.gold = 170 + 15 * st.r;
    st.bossType = st.boss ? TG.REGIONS[st.r].boss : null;
    // 只加怪物血量（不放大英雄／召喚獸傷害）：第 3 區起玩家多了同伴、時態之劍、天賦、冰鳳，不補血量後三區會全部三星
    st.hpBoost = (TG.STAGE_HP_BOOST && TG.STAGE_HP_BOOST[i] !== undefined ? TG.STAGE_HP_BOOST[i] : TG.REGION_HP_BOOST[st.r]) * (st.boss ? TG.BOSS_STAGE_BOOST : 1) * TG.challengeK(st);
  });
  TG.stagePool = (QDB, st) => QDB.filter(q => (q.gp && st.gps.includes(q.gp) && (!st.lvr || !st.lvr[q.gp] || (q.lv >= st.lvr[q.gp][0] && q.lv <= st.lvr[q.gp][1]))) || (q.id[0] === "o" && st.orig.includes(q.lv)));
  // 召喚獸、大招的傷害跟著關卡血量倍率放大，但只放大 POWER_EXP 次方：
  // 後期關卡怪物血量是前期的 8 倍，全額放大會讓召喚獸變成「打掉固定比例血量」，裝備＋同伴一疊就把後期打成三星（2026-11-21 整合時調）
  TG.POWER_EXP = 0.75;   // 和 REGION_HP_BOOST 一起調：單獨改影響小，但沒有它後期召喚獸＋同伴大招仍會把加厚的血量打穿
  TG.powMul = s => Math.pow(s.hpMul || 1, TG.POWER_EXP);
  // 星數（11-21 第二刀 P2-13：三星加上答題表現）：
  //   ★★★＝剩命 ≥ STAR3_LIVES 且本關答對率 ≥ STAR3_ACC；★★＝剩命 ≥ STAR2_LIVES 且答對率 ≥ STAR2_ACC（或剩命夠三星、答對率只夠兩星）；
  //   ★＝過關（不變：新手只要守住就有 1 星）。
  //   答對率（11-22 改）＝本關「選擇題第一次就答對」的比例（TG.stageAcc）：第二次機會才答對算錯；拼字（字盾）、改錯（哥布林）、排句（召喚、冰盾）、詞彈不計。
  //   原本是全部題型＋第二次機會算半題，模擬試玩結算顯示約 80%、實際第一次答對只有 66%，三星太容易。
  //   第二個參數 s 省略＝目前這一局（TG.liveGame，畫面端 TG.starsFor(G.lives) 不用改）；傳 null＝舊制只看剩命。
  //   外掛可用 fold 掛勾 stars(v, s) 改（鐵人挑戰成功＝3）。
  TG.STAR3_LIVES = 18; TG.STAR2_LIVES = 10; TG.STAR3_ACC = 0.7; TG.STAR2_ACC = 0.5;
  TG.STAR_ACC_NAME = "選擇題一次答對率";   // 畫面說明用（結算統計方塊、星數說明）
  // v3（合約 §3.4）：側邊面板是自願答題，「只答 3 題全對＝100%」不公平 → 選擇題答不滿 STAR_MIN_N 題時，沒答的題數當作沒答對（分母至少 STAR_MIN_N）。
  //   營地題（kind mcq）也算進來；略過、逾時不算答題。TG.stageAcc 仍是實際答對率（畫面顯示用），三星判斷用 TG.starAcc。
  TG.STAR_MIN_N = 10;
  TG.starAcc = s => { const a = s && s.acc; if (!a) return null; const n = a.mq || 0; if (!n && !(s.stage && TG.STAR_MIN_N)) return null; return (a.mok || 0) / Math.max(n, s.stage ? TG.STAR_MIN_N : 1, 1); };
  // 11-24 第二輪（B 組，試玩 P1-16「滿命過關只 1 星」）：星星改成「守城 2 顆＋答題 1 顆」，兩邊各自算、加起來：
  //   第 1 顆＝過關；第 2 顆＝守城（剩命 ≥ STAR3_LIVES）；第 3 顆＝答題（本關選擇題「第一次就答對」累計 ≥ STAR_ANS_N 題）。
  //   答題那顆看「答對題數」不看答對率：慢慢答、多答幾題就拿得到（小美 40%、滿命原本只有 1 星），也不會因為多答錯幾題而掉星（答錯不扣）。
  //   STAR_ANS_MODE="rate" 可切回看一次答對率（≥ STAR3_ACC，分母至少 STAR_MIN_N），regression 比較用。
  //   next（給結算顯示「再答對 3 題就多 1 顆星」）：{ need:"answer", more:N } 或 { need:"lives", lives:門檻 }；三星＝null。
  TG.STAR_ANS_MODE = "count"; TG.STAR_ANS_N = 12;
  TG.starAnsInfo = s => {
    const a = (s && s.acc) || {}, ok = a.mok || 0, n = a.mq || 0;
    if (TG.STAR_ANS_MODE === "rate") {
      const acc = TG.starAcc(s) || 0, den = Math.max(n, s && s.stage ? TG.STAR_MIN_N : 1, 1), need = TG.STAR3_ACC;
      const more = acc >= need - 1e-9 ? 0 : Math.max(1, Math.ceil((need * den - ok) / (1 - need) - 1e-9));
      return { ok, n, met: more === 0, more };
    }
    return { ok, n, met: ok >= TG.STAR_ANS_N, more: Math.max(0, TG.STAR_ANS_N - ok) };
  };
  TG.starInfo = function (lives, s) {
    if (s === undefined) s = TG.liveGame;
    const acc = s ? (TG.starAcc(s) || 0) : null;
    if (!s) {   // 傳 null＝舊制只看剩命（相容）
      const st0 = lives >= TG.STAR3_LIVES ? 3 : lives >= TG.STAR2_LIVES ? 2 : 1;
      return { stars: st0, lives, acc, miss: [], next: st0 >= 3 ? null : { need: "lives", lives: st0 >= 2 ? TG.STAR3_LIVES : TG.STAR2_LIVES }, def: st0 - 1, ans: null };
    }
    const A = TG.starAnsInfo(s), def = lives >= TG.STAR3_LIVES ? 1 : 0;
    let stars = 1 + def + (A.met ? 1 : 0);
    stars = Math.max(1, Math.min(3, fold("stars", stars, s, lives) | 0));
    const miss = [];
    let next = null;
    if (stars < 3) {
      if (!A.met) miss.push(TG.STAR_ANS_MODE === "rate" ? TG.STAR_ACC_NAME + " " + Math.round(acc * 100) + "%／要 " + Math.round(TG.STAR3_ACC * 100) + "%" : "選擇題第一次就答對 " + A.ok + " 題／要 " + TG.STAR_ANS_N + " 題");
      if (!def) miss.push("剩命 " + lives + "／要 " + TG.STAR3_LIVES);
      next = !A.met ? { need: "answer", more: A.more } : !def ? { need: "lives", lives: TG.STAR3_LIVES } : null;
    }
    return { stars, lives, acc, miss, next, def, ans: A };
  };
  TG.starsFor = (lives, s) => TG.starInfo(lives, s).stars;
  // 結算一行說明（畫面端可直接顯示；不寫公式，寫「再答對 N 題就多 1 顆星」）
  TG.starRuleText = () => "星星：過關 1 顆、剩命 " + TG.STAR3_LIVES + " 以上再 1 顆、" + (TG.STAR_ANS_MODE === "rate" ? TG.STAR_ACC_NAME + " " + Math.round(TG.STAR3_ACC * 100) + "% 以上" : "選擇題第一次就答對 " + TG.STAR_ANS_N + " 題") + "再 1 顆";
  TG.starText = function (lives, s) {
    const r = TG.starInfo(lives, s);
    if (r.stars >= 3) return "⭐ 三星達成！";
    const nx = r.next, tip = !nx ? "" : nx.need === "answer" ? "再答對 " + nx.more + " 題就多 1 顆星" : "守住 " + nx.lives + " 條命以上就多 1 顆星";
    return "⭐ " + tip + (r.miss.length ? "（" + r.miss.join("、") + "）" : "");
  };
  // 過了第幾關（cleared＝已通關數）解鎖什麼
  TG.UNLOCKS = { 1: "召喚獸「火狐」", 3: "召喚獸「雷狼」", 4: "塔分支（3 級後選專精）", 6: "召喚獸「岩龜」", 8: "無盡模式" };
  TG.SUMMON_UNLOCK = { fox: 1, wolf: 3, turtle: 6 };   // 已通關數 ≥ 多少才有；外掛可加
  TG.summonsUnlocked = cleared => Object.keys(TG.SUMMON_UNLOCK).filter(id => cleared >= TG.SUMMON_UNLOCK[id]);
  TG.branchUnlocked = cleared => cleared >= 4;

  // ═════════ 塔與分支
  TG.TOWERS = {
    arrow:  { name: "弓箭塔", em: "🏹", cost: 50,  dmg: 9,  range: 72, cd: 0.6, color: "#d9a441", fly: true, desc: "射速快、能打飛行怪" },
    mage:   { name: "魔法塔", em: "🔮", cost: 80,  dmg: 8,  range: 66, cd: 1.15, splash: 32, color: "#9b6cff", fly: true, desc: "範圍爆炸、能打飛行怪" },
    ice:    { name: "冰霜塔", em: "❄️", cost: 60,  dmg: 3,  range: 64, cd: 0.9, slow: 0.45, slowT: 1.6, color: "#5fb6f0", desc: "讓地面怪變慢（打不到飛行怪）" },
    cannon: { name: "砲塔",   em: "💣", cost: 110, dmg: 32, range: 84, cd: 2.0, splash: 22, pierce: 6, color: "#e8734a", desc: "重擊、打穿石像護甲（打不到飛行怪）" },
    // v3 書本塔（合約 §4.2）：不攻擊；花能量蓋（TG.energyCost("bookTower")，不花金幣）、之後每答對多 +1 能量（每關最多 TG.BOOK.cap 次）、每關限 1 座、不能升級
    book:   { name: "書本塔", em: "📖", cost: 0, dmg: 0, range: 0, cd: 1, color: "#c9a86a", fly: false, energy: true, desc: "花 3 能量蓋，之後每答對多 1 能量（每關 1 座）" }
  };
  TG.BOOK = { perAnswer: 1, cap: 10, max: 1 };   // 每答對 +1 能量、每關最多給 cap 次、每關最多 max 座（增益卡「書蟲進駐」可改 cap 與蓋塔價）
  TG.BRANCHES = {
    arrow:  { A: { name: "狙擊塔", em: "🎯", desc: "射程加倍、傷害 ×2.2，專挑血最多的打" }, B: { name: "連弩塔", em: "🏹", desc: "一次射 3 隻" } },
    mage:   { A: { name: "雷電塔", em: "⚡", desc: "閃電連鎖打 4 隻" }, B: { name: "奧術塔", em: "🌀", desc: "爆炸更大，15% 把怪變成小青蛙" } },
    ice:    { A: { name: "暴風雪塔", em: "🌨️", desc: "範圍減速" }, B: { name: "永凍塔", em: "🧊", desc: "把怪完全凍住 1.2 秒" } },
    cannon: { A: { name: "火箭塔", em: "🚀", desc: "超遠程、能打飛行怪" }, B: { name: "地雷塔", em: "💥", desc: "在路上埋地雷" } }
  };
  TG.MAX_LV = 6;
  TG.BRANCH_LV = 3;   // 3 → 4 時選分支
  TG.towerStats = function (type, lv, branch) {
    const b = TG.TOWERS[type], k = lv - 1;
    const st = {
      dmg: b.dmg * (1 + 0.55 * k), range: b.range + 6 * k, cd: b.cd * (1 - 0.06 * k),
      splash: b.splash ? b.splash + 3 * k : 0, slow: b.slow ? Math.min(0.7, b.slow + 0.05 * k) : 0,
      slowT: b.slowT || 0, pierce: (b.pierce || 0) + k, fly: !!b.fly, multi: 1, chain: 0, poly: 0, freeze: 0, mine: false, strong: false
    };
    if (branch === "A") {
      if (type === "arrow") { st.range += 60; st.dmg *= 2.2; st.cd *= 2; st.strong = true; st.pierce += 4; }
      if (type === "mage") { st.chain = 4; st.splash = 0; st.dmg *= 1.3; }
      if (type === "ice") { st.splash = 40; }
      if (type === "cannon") { st.range += 50; st.fly = true; }
    } else if (branch === "B") {
      if (type === "arrow") st.multi = 3;
      if (type === "mage") { st.splash += 10; st.poly = 0.15; }
      if (type === "ice") { st.freeze = 1.2; st.cd *= 1.6; }
      if (type === "cannon") { st.mine = true; st.cd *= 0.8; st.dmg *= 1.4; }
    }
    return st;
  };
  // 升級金幣＝塔價 × 係數 × 目前等級；係數依區（11-24 老闆裁示：第 5 區升級打九折 0.45→0.40，讓答對 65%、13 秒一題、塔 3 級的孩子第 21 關不再看運氣；
  //   第 1～4 區、無盡模式照舊 0.45；能量價不動）。s＝局面（看 s.stage.r）；省略 s＝0.45（舊呼叫照常，但戰鬥中顯示與扣款都要傳 s）
  TG.UP_COST_RATE = [0.45, 0.45, 0.45, 0.45, 0.40];
  TG.upCostRate = s => { const r = s && s.stage ? s.stage.r : null, v = r === null ? undefined : TG.UP_COST_RATE[r]; return v === undefined ? 0.45 : v; };
  TG.upgradeCost = (type, lv, s) => Math.round(TG.TOWERS[type].cost * TG.upCostRate(s) * lv);
  TG.questionLevelFor = lv => Math.min(5, lv);   // 無盡模式用：Lv1→2 考第 1 級…

  // ═════════ 英雄
  // 英雄登錄表：role＝melee（會擋路）或 ranged（不擋路、射程遠）。外掛可新增同伴。
  // stats(lv) 回傳 { hp, dmg, cd, block, regen, range, fly }；ultFx(s, h, p) 放大招（p＝1 答對／0.5 答錯）
  TG.HEROES = {
    knight: { name: "文法騎士", em: "🤺", role: "melee", domain: "be 動詞與時態", gps: ["G01", "G02", "G03", "G04", "G05"],
      ult: "盾牆", ultDesc: "擋住附近所有地面怪並重擊", ultCd: 30,
      stats: lv => ({ hp: 260 + 30 * lv, dmg: 14 + 3 * lv, cd: 0.8, block: 2 + Math.floor(lv / 7), regen: 6 + lv, range: 26, fly: false }),
      ultFx: (s, h, p) => {
        const st = TG.HEROES.knight.stats(h.lv);
        h.wallT = 5 * p;
        for (const e of s.enemies.slice()) if (!TG.ENEMIES[e.type].fly && H(e.x - h.x, e.y - h.y) <= 60) TG._hurt(s, e, st.dmg * 4 * p * TG.powMul(s), true);
      } }
  };
  TG.HERO = TG.HEROES.knight;   // 相容舊程式
  TG.heroStats = lv => TG.HEROES.knight.stats(lv);
  TG.heroDef = h => TG.HEROES[h.id] || TG.HEROES.knight;
  // v3：新等級曲線（騎士外掛提供 TG.knightBuildR＝新戰力公式同一步上線）時改讀 _data/knight_tree.json 的 level.xpNeed；否則舊公式
  TG.heroXpNeed = lv => { const L = typeof TG.knightBuildR === "function" && TG.KNIGHT && TG.KNIGHT.LEVEL; return L && Array.isArray(L.xpNeed) ? (lv >= (L.max || 20) ? Infinity : L.xpNeed[lv] || Infinity) : 200 + 100 * lv; };
  TG.HERO_MAX = 20;

  // ═════════ 存檔補預設值（v3 合約 §8.5；2026-11-22 從 index.html 原樣搬來，node 才測得到）
  // key 維持 towerguard:v3。外掛遷移（例如騎士補 S.mods.knight、設 S.ver=4）放 TG.SAVE_MIGRATIONS，最後依序呼叫。
  TG.saveDefaults = () => ({ level: 1, muted: false, wrongQ: {}, wordMiss: {}, mastery: {}, prog: {}, hero: { lv: 1, xp: 0 }, pets: {}, best: 0, qRight: 0, qTotal: 0, mods: {} });
  TG.SAVE_MIGRATIONS = [];
  // 錯題本題號轉換（11-24 第二輪整合）：C 組把 147 題原創題補了文法點，題號 oN → coN（o34 → co34）；另有題目下架。
  //   存檔裡用「題號」當鍵的只有錯題本 S.wrongQ（{ 題號: 1 }）；掌握度（S.mods.gear.mast）、徽章紀錄（hist）、答對率（S.mods.modes.acc）都以文法點為鍵，S.mastery 以單字為鍵，不用轉。
  //   規則：新題庫有這個題號 → 留著；沒有、但 c＋題號（coN）有 → 換成 coN；兩個都沒有（下架）→ 從錯題本拿掉。值一律存成 1。
  //   db＝題庫陣列（或題號 Set）。回傳 { kept, renamed, dropped }。
  TG.wrongQFix = function (S, db) {
    const out = { kept: 0, renamed: 0, dropped: 0 };
    if (!S || !db) return out;
    const ids = db instanceof Set ? db : new Set((Array.isArray(db) ? db : []).map(q => q && q.id).filter(x => typeof x === "string"));
    if (!ids.size) return out;   // 題庫是空的（載入失敗）就不動，免得把整本錯題本清掉
    const w = S.wrongQ && typeof S.wrongQ === "object" && !Array.isArray(S.wrongQ) ? S.wrongQ : {}, nw = {};
    for (const k of Object.keys(w)) {
      if (!w[k]) { out.dropped++; continue; }
      if (ids.has(k)) { nw[k] = 1; out.kept++; }
      else if (/^o\d+$/.test(k) && ids.has("c" + k)) { nw["c" + k] = 1; out.renamed++; }
      else out.dropped++;
    }
    S.wrongQ = nw;
    return out;
  };
  TG.migrateSave = function (S, opts) {
    if (!S.mods) S.mods = {};
    // 存檔欄位型別不對（舊版、手動改壞、null）就補回預設，避免一開就當掉（2026-11-21 QA）
    const D = TG.saveDefaults();
    for (const k in D) { const want = typeof D[k], v = S[k]; if (want === "object" ? (!v || typeof v !== "object" || Array.isArray(v)) : typeof v !== want) S[k] = JSON.parse(JSON.stringify(D[k])); }
    S.hero.lv = Math.max(1, Math.min(TG.HERO_MAX || 20, Math.floor(+S.hero.lv) || 1)); S.hero.xp = Math.max(0, +S.hero.xp || 0); if (S.level !== 2) S.level = 1;
    for (const id in S.pets) { const p = S.pets[id]; if (!p || typeof p !== "object") delete S.pets[id]; else { p.lv = Math.max(1, Math.min(10, Math.floor(+p.lv) || 1)); p.uses = Math.max(0, Math.floor(+p.uses) || 0); } }
    for (const k in S.mods) { const v = S.mods[k]; if (!v || typeof v !== "object" || Array.isArray(v)) delete S.mods[k]; }   // 外掛自己會補預設值
    for (const i in S.prog) { const p = S.prog[i]; if (!p || typeof p !== "object") delete S.prog[i]; else p.stars = Math.max(0, Math.min(3, Math.floor(+p.stars) || 0)); }
    // 錯題本題號轉換（11-24 第二輪整合）：題庫在手邊才做（node 測試沒載題庫＝略過；測試可用 opts.qdb 指定）
    try { const db = (opts && opts.qdb) || globalQDB(); if (db) TG.wrongQFix(S, db); } catch (e) { if (typeof console !== "undefined") console.error("[migrateSave wrongQ]", e); }
    for (const f of TG.SAVE_MIGRATIONS) { try { f(S); } catch (e) { if (typeof console !== "undefined") console.error("[migrateSave]", e); } }
    return S;
  };

  // ═════════ 召喚獸
  TG.SUMMONS = {
    fox:    { name: "火狐", em: "🦊", elem: "火", cost: 8, desc: "從城堡沿路衝出去，一路燒" },
    wolf:   { name: "雷狼", em: "🐺", elem: "雷", cost: 8, desc: "連鎖閃電打 6 隻，飛行怪傷害加倍" },
    turtle: { name: "岩龜", em: "🐢", elem: "岩", cost: 8, desc: "擋在路上，地面怪全部停住" }
  };
  TG.ENERGY_MAX = 12;   // v3（合約 §4.1）：5 → 12；召喚 4 → 6 能量（光獨角獸由 creatures 外掛定價，目標 5）
  // 11-23 第 7 步平衡：召喚 6 → 8、火狐傷害 70 → 42。拆解模擬：高手（真人進度、九成對）每關召喚 7～8 隻火狐（一路燒全路線），
  //   「召喚最多 2 次」一項就讓第 3～5 區剩命 18.5 → 13.5，是三星飽和的最大來源；一般玩家每關只召喚 1～2 次幾乎不受影響。
  //   8 能量時升級（2～5）是最便宜的花法。光獨角獸維持 5（creatures 的 SUMMON_COST_REL −3）、冰鳳 8。
  // 召喚效果表：(s, power, lv, k) ；k＝power×等級加成×關卡血量倍率（傷害用）
  TG.SUMMON_FX = {
    fox: (s, power, lv, k) => s.map.routes.forEach((rt, r) => s.allies.push({ kind: "fox", r, d: rt.len, x: rt.end[0], y: rt.end[1], dmg: 42 * k, hit: {} })),   // 11-23 平衡：70 → 42（見召喚表下方 ENERGY_MAX 旁的說明）
    wolf: (s, power, lv, k) => {
      const tg = s.enemies.slice().sort((a, b) => b.d - a.d).slice(0, 6), pts = [];
      for (const e of tg) { pts.push([e.x, e.y]); TG._hurt(s, e, 55 * k * (TG.ENEMIES[e.type].fly ? 2 : 1), true); }
      s.events.push({ k: "chain", pts });
    },
    turtle: (s, power, lv, k) => s.map.routes.forEach((rt, r) => {
      const front = s.enemies.filter(e => e.r === r && !TG.ENEMIES[e.type].fly).sort((a, b) => b.d - a.d)[0];
      const d = front ? Math.min(rt.len - 20, front.d + 30) : rt.len * 0.7, p = posOn(rt, d);
      s.allies.push({ kind: "turtle", r, x: p.x, y: p.y, t: 8 * power * (1 + TG.PET_LV_STEP * (lv - 1)) });
    })
  };
  // 盟友（召喚物）每步更新表：kind → (s, a, dt)；回傳 false 表示移除
  TG.ALLY_FX = {};

  // ═════════ 怪
  TG.ENEMIES = {
    slime:    { name: "史萊姆", em: "🟢", hp: 38, spd: 30, gold: 5, atk: 4 },
    bat:      { name: "蝙蝠", em: "🦇", hp: 26, spd: 48, gold: 5, atk: 3, fly: true },
    golem:    { name: "石像", em: "🗿", hp: 110, spd: 21, armor: 5, gold: 11, atk: 10 },
    elite:    { name: "字盾騎士", em: "🛡️", hp: 95, spd: 26, gold: 16, shield: true, atk: 8 },
    goblin:   { name: "錯字哥布林", em: "👺", hp: 120, spd: 27, gold: 14, quiz: "fix", atk: 6 },
    splitter: { name: "分裂史萊姆", em: "🫧", hp: 70, spd: 27, gold: 6, split: 2, atk: 5 },
    mini:     { name: "小史萊姆", em: "💧", hp: 22, spd: 36, gold: 2, atk: 2 },
    frog:     { name: "小青蛙", em: "🐸", hp: 8, spd: 26, gold: 3, atk: 1 },
    boss:     { name: "魔龍", em: "🐉", hp: 720, spd: 16, armor: 3, gold: 110, shield: true, lifeDmg: 5, atk: 30, boss: true },
    beGiant:  { name: "Be 巨人", em: "🗿", hp: 820, spd: 14, armor: 2, gold: 150, lifeDmg: 5, atk: 30, boss: true, mech: "be" },
    beMinion: { name: "be 小怪", em: "👾", hp: 45, spd: 28, gold: 3, atk: 4 },
    treant:   { name: "時光樹妖", em: "🌳", hp: 950, spd: 13, armor: 4, gold: 160, lifeDmg: 5, atk: 30, boss: true, mech: "seal" }
  };
  TG.hpScale = w => 1 + 0.2 * (w - 1) + 0.03 * (w - 1) * (w - 1);   // 無盡模式
  TG.stageHpScale = w => 1 + 0.17 * (w - 1);                           // 關卡模式
  TG.SHIELD_TAKE = 0.35;

  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // 無盡模式波次
  TG.waveList = function (n, rng) {
    const list = [], total = Math.min(6 + n * 2, 34);
    const add = (t, c) => { for (let i = 0; i < c; i++) list.push(t); };
    add("elite", n >= 3 ? 1 + Math.floor(n / 4) : 0); add("golem", n >= 4 ? Math.floor(n / 2) : 0);
    add("bat", n >= 2 ? Math.floor(total * 0.25) : 0); add("goblin", n >= 3 ? Math.floor(n / 3) : 0); add("splitter", n >= 5 ? Math.floor(n / 2) : 0);
    while (list.length < total) list.push("slime");
    shuffle(list, rng);
    if (n % 5 === 0) list.push("boss");
    return list;
  };
  // 關卡波次：依關卡序號逐步加入新怪
  TG.stageWave = function (st, w, rng) {
    // 後期關卡多出的怪數（k/2）前兩波只給一部分（11-22 開局尖峰：第 20 關第 1 波原本 16 隻，開局金幣只蓋得出 5～6 座 1 級塔）
    const k = st.i, list = [], total = Math.min(5 + w * 2 + Math.floor(k / 2 * Math.min(1, w / 3)), 30);
    const add = (t, c) => { for (let i = 0; i < c; i++) list.push(t); };
    // 11-24 第二輪評估（試玩小明：第 20、21 關輸在最後一波、漏的多是飛行怪）：最後一波 27～28 隻裡只有 5 隻蝙蝠（22%），小明漏的 14～17 隻是整關累計（全關 19 隻），
    //   主因是塔打不到空中（冰霜塔／砲塔）、絕招一直是只打地面的盾牆 → 不減蝙蝠，改由失敗秘訣建議換「時態三連斬」、多蓋弓箭／魔法塔，加上能量滿答對換金幣。
    //   試過最後一波少 2 隻：regression 一般玩家第 20、21 關勝率不變，地形壓力測試（第 21 關岩漿）反而翻盤，所以不改。
    if (k >= 1) add("bat", Math.floor(total * 0.22));
    // 字盾騎士：第 2～6 關（k<6）第 6 波前每波只出 1 隻（11-21 試玩：第 5 關第 4 波 2 隻字盾＋石像＋雙入口，不知道要點字盾的新手全輸）
    if (k >= 1 && w >= 3) add("elite", 1 + Math.floor(w / (k < 6 ? 6 : 4)));
    if (k >= 2 && w >= 2) add("goblin", (w % 2 === 0 ? 1 : 0) + Math.floor(w / 5));
    if (k >= 4) add("golem", Math.floor(w / 3));
    if (k >= 5) add("splitter", Math.floor(w / 2));
    while (list.length < total) list.push("slime");
    shuffle(list, rng);
    if (w === st.waves) { if (st.bossType) list.push(st.bossType); else list.push("elite", "elite", "golem"); }
    return list;
  };
  TG.spawnGap = n => Math.max(0.45, 1.0 - n * 0.025);

  // ═════════ 局（stage 省略＝無盡模式）
  // opts: { heroLv, heroic, allowTypes:[...], branchOk, summons:{id:lv} }
  // 英雄挑戰（11-21 第二刀 P2-11）：原本只有血量 ×1.25，完美機器人 22 關全三星（等於沒變難）。
  // 現在：怪血 ×HEROIC_HP、速度 ×HEROIC_SPD、題目提高一級（pickQuestion）、2 種塔一定要有一種打得到飛行怪。
  // 11-22：不合法的組合（兩種都打不到飛行怪）原本「自動補弓箭塔」＝變成 3 種塔，比合法的 2 種還好打（模擬試玩小華第 9 關 20 命 vs 9 命）
  //   → 改成把最後一種換成弓箭塔，仍只有 2 種（s.heroicFix＝有換過，畫面可提示「冰霜塔換成弓箭塔」）。畫面選塔時應先用 TG.heroicTypesOk 擋住不能出征。
  TG.HEROIC_HP = 1.3; TG.HEROIC_SPD = 1.1;
  // 各區英雄挑戰血量（11-22）：第 3～5 區有同伴＋裝備＋天賦，1.3 倍時完美機器人幾乎全部三星；第 2 區（雙入口、只能 2 種塔）1.3 倍反而大量 1 星
  // 11-23 第 7 步平衡：第 3～5 區 2.0／2.2／2.6 → 1.0／1.15／1.4。一般關卡第 3～5 區血量重找（一般玩家剩 12 命）、高手的召喚與火狐下修後，
  //   舊倍率讓英雄挑戰全對第 12 關起幾乎全輸（過 11/22）；新倍率全對過 22/22、三星約 11～13/22。
  TG.HEROIC_HPS = [1.3, 1.0, 1.0, 1.15, 1.4];
  // 前兩波只加一部分（第 1 波 35%、第 2 波 70%）：只有 2 種塔、開局塔少，全額加血時火山區全對也第 1 波漏 2～5 隻（模擬試玩小華）
  TG.heroicWaveHp = (st, w) => 1 + (TG.heroicHp(st) - 1) * Math.min(1, 0.35 * Math.max(1, w));
  TG.heroicHp = st => { const v = st && TG.HEROIC_HPS ? TG.HEROIC_HPS[st.r] : undefined; return v !== undefined ? v : TG.HEROIC_HP; };   // 模擬（機器人依關卡輪流 5 種塔組合）：1.0 時全對 30/44 局三星、1.3＋1.1 時 26/44（約六成）；1.7 以上第 2、5 區大量失守，第 3、4 區仍三星（同伴＋裝備撐住）
  TG.FLY_TYPES = Object.keys(TG.TOWERS).filter(k => TG.TOWERS[k].fly);   // 一開始就打得到飛行怪的塔（弓箭、魔法）
  TG.heroicTypesOk = types => !types || types.some(t => TG.FLY_TYPES.includes(t));
  TG.heroicTypesFix = types => (!types || TG.heroicTypesOk(types)) ? types : (types.length > 1 ? types.slice(0, -1) : []).concat(TG.FLY_TYPES[0]);
  // 英雄挑戰紀錄（11-22）：記星數 p.hs（0～3），p.heroic 只在三星時為 true（1 星不算完成）；舊存檔只有 heroic:true 的沿用（不知道星數，當完成）。
  //   畫面端結算：if (run.heroic) TG.heroicRecord(p, stars)；地圖勳章用 TG.heroicStars(p)。
  TG.heroicRecord = (p, stars) => { p.hs = Math.max(p.hs | 0, Math.max(0, Math.min(3, stars | 0))); if (p.hs >= 3) p.heroic = true; return p.hs; };
  TG.heroicStars = p => !p ? 0 : (p.hs | 0) || (p.heroic === true ? 3 : 0);
  TG.newGame = function (stage, opts) {
    opts = opts || {};
    const map = stage ? TG.MAPS[stage.map] : TG.MAPS[0];
    const allowTypes = opts.allowTypes ? (opts.heroic ? TG.heroicTypesFix(opts.allowTypes.slice()) : opts.allowTypes) : null;
    const s = { stage: stage || null, map, maxWave: stage ? stage.waves : 0, won: false, heroic: !!opts.heroic,
      allowTypes, heroicFix: !!(opts.allowTypes && allowTypes && allowTypes.join() !== opts.allowTypes.join()), branchOk: opts.branchOk !== false, summons: opts.summons || {},
      hpMul: stage ? stage.hpMul : 1,   // 英雄挑戰加血改在 spawnEnemy 乘（11-22）：乘在 hpMul 會連召喚獸、大招、英雄傷害一起放大，加血等於白加
      wave: 0, lives: 20, gold: stage ? stage.gold : 150, enemies: [], towers: [], proj: [], mines: [], allies: [], spawn: [], spawnT: 0,
      waveActive: false, eid: 1, tid: 1, pid: 1, kills: 0, leaks: 0, energy: 0, combo: 0, comboFresh: 0, freeUp: false, rushT: 0, tickets: 0, prepDone: -1,
      events: [], over: false, time: 0, rr: 0, rng: opts.rng || Math.random, waveRng: opts.waveRng || null };
    // opts.heroes＝[{ id, lv }]；省略時只有文法騎士
    const list = opts.heroes || [{ id: "knight", lv: opts.heroLv || 1 }];
    s.heroes = list.map((hd, k) => {
      const def = TG.HEROES[hd.id] || TG.HEROES.knight, st = def.stats(hd.lv), rt = map.routes[k % map.routes.length];
      const p = k === 0 ? { x: map.heroHome[0], y: map.heroHome[1] } : posOn(rt, rt.len * (0.45 - 0.1 * k));
      return { id: hd.id, lv: hd.lv, x: p.x, y: p.y, tx: p.x, ty: p.y, home: [p.x, p.y], hp: st.hp, maxHp: st.hp, cd: 0, dead: 0, ultCd: 8, wallT: 0, rage: 0 };   // rage：v3 怒氣（HEROES[id].rageMax 有值才用）
    });
    s.hero = s.heroes[0];
    s.acc = { n: 0, h: [] };
    // 先備戰再守城（2026-11-25 老闆提議：手機直拿時地圖太小）：只在一般關卡生效；英雄挑戰、鐵人、無盡模式不用（TG.pfOn 另外看 s.modes.iron）
    s.prepFirst = !!(opts.prepFirst && stage && !opts.heroic && !opts.iron); s.pfCharge = 0;
    TG._cardsInit(s, opts);   // v3：營地卡片、狂熱、書本塔、城堡護盾（opts.cardPity 保底、opts.cardPicks 卡冊次數、opts.cleared 通關數、opts.wrongBook 錯題本題數）
    TG.liveGame = s;   // pickQuestion 省略 ctx 時看這一局的答對率
    hook("onNewGame", s, opts);
    return s;
  };
  TG.startWave = function (s, rng) {
    if (s.waveActive || s.over) return false;
    s.wave++;
    rng = s.waveRng || rng;   // 每日一關：波次用獨立的種子，跟答題亂數分開（同一天每次都一樣）
    s.spawn = s.stage ? TG.stageWave(s.stage, s.wave, rng) : TG.waveList(s.wave, rng);
    s.spawn = fold("stageWave", s.spawn, s, s.wave, rng);
    // 英雄挑戰第 1 波不出飛行怪（11-22，比照鐵人）：只有 2 種塔、開局只蓋得出幾座，火山區全對也第 1 波就漏蝙蝠
    if (s.heroic && s.stage && s.wave === 1) s.spawn = s.spawn.map(t => (TG.ENEMIES[t] || {}).fly ? "slime" : t);
    s.events.push({ k: "waveStart", wave: s.wave, list: s.spawn.slice() });   // 開波橫幅與怪種預告用（11-21 美術改版）
    s.spawnT = 0; s.waveActive = true;
    s.cardWave = { burst: 0, shock: 0 };   // 卡片每波次數上限重算
    hook("onStartWave", s);
    return true;
  };

  // ───── 答題結果（所有題型共用）：連對加成與能量
  // 第三個參數可省略：{ retry: true }＝答錯後拿掉一個錯選項、第二次才答對（畫面端 11-21 試玩後加）：
  //   算答對（給能量、外掛 onAnswer 收到 true），但連對數不加也不歸零；本局答對率記成半題對。
  // info.kind（11-22，三星答對率用）：mcq＝選擇題（升級、備戰、解封、大招、Be 小怪、地形、九頭蛇新頭）、spell（字盾拼字）、fix（改錯）、order（排句）、word（詞彈）。
  //   沒給 kind 的呼叫先當選擇題記；同一幀接著 TG.summon（畫面端的召喚排句就是「answerResult 後馬上 summon」）會把它撤回；
  //   外掛可在呼叫期間設 s._ansKind（modes 外掛用它把冰霜巫妖的排句標成 order）。
  TG.STAR_KINDS = { mcq: 1 };

  // ───── v3 能量 API（合約 mods/CONTRACT_v3.md §4；2026-11-22 第 0 步空殼：數值＝舊值，行為不變，第 1 組改目標值）
  // 能量只准經過 addEnergy／spendEnergy 改（外掛不可再直接寫 s.energy）。
  // 2026-11-22 第 1 組：目標值上線。first 第一次答對、retry 第二次機會、fast＝fastSec 秒內第一次答對、fever 狂熱中、revenge 復仇題、
  //   book 有書本塔、byKind 依互動種類取代 first（排句 3、詞彈 1；拼字、改錯、Be 小怪＝first）；max＝每題（含卡片的每 N 題獎勵）最多幾格。
  TG.ENERGY_GAIN = { first: 2, retry: 1, fast: 1, fastSec: 10, fever: 1, revenge: 1, book: 1, byKind: { order: 3, word: 1 }, max: 5 };
  // 11-23 第 7 步平衡：同伴大招 5 → 7（瀏覽器實測後段每關同伴大招吃 35～45 能量、升級只花 2～27；5 能量比升級一級還便宜又每 32 秒就能放）。
  TG.ENERGY_COST = { up: [0, 2, 3, 4, 4, 5], compUlt: 7, lavaCool: 2, unseal: 3, infuse: 2, bookTower: 3, chop: 3, iceBreak: 3 };   // up[lv]＝lv→lv+1（一座塔升滿 18 能量）；chop＝九頭蛇降級新頭花能量砍、iceBreak＝冰盾降級花能量破（第⑧a組，2026-11-23 整合時寫進表）
  TG.ENERGY_EVENTS = true;    // 推 energy／energySpend 事件
  TG.UPGRADE_MODE = "energy"; // "quiz"＝舊：升級當場答題；"energy"＝v3：金幣＋能量立刻升級（TG.energyUpgrade）
  TG.NO_ENERGY_SRC = { camp: 1, campReroll: 1 };   // 營地抽卡題的獎勵是增益卡，不直接給能量（營地「只出 1 題」的波＝src prep，照常給能量）
  const isRetry = (s, info) => !!((info && (info.retry || info.try === 2)) || s.retryNext);
  // 這題應給多少能量（純函式；不含卡片「每 N 題」獎勵，那部分在 answerResult 加完後一起夾到 ENERGY_GAIN.max）
  TG.energyGainParts = function (s, correct, info) {
    info = info || {};
    if (!correct || info.prep || TG.NO_ENERGY_SRC[info.src]) return { n: 0, book: false };
    const G = TG.ENERGY_GAIN, kind = info.kind || (info.word ? "word" : "mcq"), retry = isRetry(s, info);
    if (kind === "word") return { n: G.byKind.word !== undefined ? G.byKind.word : 1, book: false };   // 詞彈：小額、不吃加成（擊倒本身就是獎勵）
    let n = retry ? Math.max(G.retry, TG.cardRetryEnergy(s)) : (G.byKind[kind] !== undefined ? G.byKind[kind] : G.first);
    if (!retry && info.sec !== undefined && info.sec !== null && info.sec <= G.fastSec) n += G.fast;
    if (TG.feverOn(s)) n += G.fever;
    if (info.revenge) n += G.revenge + TG.cardRevengeEnergy(s);
    const book = TG.bookActive(s);
    if (book) n += G.book;
    if (info.src === "prep" && TG.pfOn && TG.pfOn(s)) n += TG.PF.gainAdd;   // 先備戰：每輪只答 3 題（11-25 老闆裁示），每題多給能量補回題數少的差（第二次機會答對也加）
    return { n: Math.min(G.max, n), book };
  };
  TG.energyGain = (s, correct, info) => TG.energyGainParts(s, correct, info).n;
  // 答題當下（answerResult 期間，含外掛 onAnswer 給的天賦／每日規則能量）每題合計最多 ENERGY_GAIN.max（s._ansRoom＝這題還能給幾格）
  TG.addEnergy = function (s, n, why) {
    if (s._ansRoom !== undefined && n > 0) n = Math.min(n, Math.max(0, s._ansRoom));
    const v0 = s.energy || 0, v = Math.max(0, Math.min(TG.ENERGY_MAX, v0 + (n || 0)));
    s.energy = v;
    if (s._ansRoom !== undefined && v > v0) s._ansRoom -= v - v0;
    if (TG.ENERGY_EVENTS && v !== v0) s.events.push({ k: "energy", d: v - v0, why: why || "", v });
    return v - v0;
  };
  TG.canSpend = (s, n) => (s.energy || 0) >= n;
  TG.spendEnergy = function (s, n, why) {
    if (!TG.canSpend(s, n)) return false;
    s.energy -= n;
    if (TG.ENERGY_EVENTS) s.events.push({ k: "energySpend", n, why: why || "", v: s.energy });
    return true;
  };
  // what：up(arg=塔)／summon(arg=id)／compUlt／lavaCool／unseal／infuse／bookTower；外掛 fold 掛勾 energyCost(n, what, s, arg) 可改價
  //   卡片（合約 §7.3）：summonCost 合計最多 −3、召喚最便宜 3；upCost 最少 1；書蟲進駐改書本塔價
  TG.energyCost = function (what, s, arg) {
    let n = what === "summon" ? ((TG.SUMMONS[arg] || {}).cost || 0) : what === "up" ? (TG.ENERGY_COST.up[arg && arg.lv] || 0) : (TG.ENERGY_COST[what] || 0);
    if (s && s.cards) {
      if (what === "summon" && n > 0) { const a = Math.max(-3, TG.cardActive(s, "summonCost").add); if (a) n = Math.max(Math.min(n, 3), n + a); }
      else if (what === "up" && n > 0) { const a = TG.cardActive(s, "upCost").add; if (a) n = Math.max(1, n + a); }
      else if (what === "bookTower") { const b = TG.cardBook(s); if (b && b.cost !== undefined) n = b.cost; }
    }
    return Math.max(0, Math.round(fold("energyCost", n, what, s, arg)));
  };
  // ───── v3 狂熱時刻（合約 §5）：取代「連對 3 免費升級（freeUp）」「連對 5 全塔加速（rushT）」；這兩個欄位留著相容（on:false 時照舊）
  //   comboFresh（上次答錯後的連續答對）每到 need 觸發（冷卻中不觸發）；持續 dur 秒（遊戲時間）或答滿 maxQ 題、答錯就結束（答錯不扣任何東西）
  //   效果：每題能量 +energy（ENERGY_GAIN.fever）、全塔攻速 ×towerSpd、騎士怒氣 ×rageMul（騎士外掛讀 TG.feverOn）；不疊第二層。冷卻 cd 秒任何卡片都不能改。
  // 11-23 第 7 步平衡：狂熱全塔攻速 ×1.33 → ×1.5（卡片＋狂熱合計 ×1.45 → ×1.6）。狂熱要連對 5 題，答得越穩越常觸發——讓「答對率」轉成守城差距（九成對 vs 七成對）。
  TG.FEVER = { on: true, need: 5, dur: 12, maxQ: 3, cd: 20, energy: 1, towerSpd: 1.5, rageMul: 1.5, needMin: 4, durMax: 16, maxQMax: 4 };
  TG.feverOn = s => !!(s && s.fever && s.fever.t > 0);
  TG.feverNeed = s => Math.max(TG.FEVER.needMin, TG.FEVER.need + (s && s.cards ? TG.cardActive(s, "feverNeed").add : 0));
  TG.feverLen = s => { const f = TG.cardFeverLen(s); return { dur: Math.min(TG.FEVER.durMax, Math.max(TG.FEVER.dur, f.dur || 0)), maxQ: Math.min(TG.FEVER.maxQMax, Math.max(TG.FEVER.maxQ, f.maxQ || 0)) }; };
  TG.feverStart = function (s) {
    const L = TG.feverLen(s), f = s.fever || (s.fever = { t: 0, q: 0, cd: 0, n: 0 });
    f.t = L.dur; f.q = 0; f.maxQ = L.maxQ; f.n = (f.n || 0) + 1;
    s.events.push({ k: "fever", on: true, dur: L.dur, maxQ: L.maxQ });
    TG._cardEvent(s, "fever");
  };
  TG.feverEnd = function (s, why) {
    const f = s.fever; if (!f || f.t <= 0) return;
    f.t = 0; f.cd = TG.FEVER.cd;
    s.events.push({ k: "feverEnd", why });
  };
  // 書本塔：場上有書本塔、而且本關給過的次數還沒到上限
  TG.bookCap = s => { const b = TG.cardBook(s); return b && b.cap ? b.cap : TG.BOOK.cap; };
  TG.bookActive = s => !!s && !!(s.towers || []).some(t => TG.TOWERS[t.type] && TG.TOWERS[t.type].energy && !(t.sealT > 0)) && (s.bookN || 0) < TG.bookCap(s);
  // ───── v3 題目成本記帳（合約 §2，紅線 2）：依題型 k 優先、沒有題目（拼字）用互動種類 kind
  TG.QCOST = { fill: 1, fill2: 1, trans: 1, dlg: 1, trf: 1, sit: 1, mcq: 1, spell: 1.5, fix: 1.5, order: 3, word: 0 };
  TG.QBUDGET = 45; TG.ORDER_MAX = 4;
  TG.QBUDGET_RESERVE = 10;   // 11-23 第 7 步平衡：6 → 10。自願題（側邊面板、只出 1 題的營地）每關最多 35 點，其餘 10 點留給字盾、哥布林、魔王機制等情境題；
                              //   高手每關的自願題能量約少 12%（總上限 45 點不變，一般玩家平均 31 點幾乎不受影響）
  // 含情境題的總上限（2026-11-23 第②組實測情境題把一關推到 46～74 點）：情境機制出題前問 TG.qSituOk(s, k)，false＝改用「不出題」的降級版
  //   （例：冰盾改花能量破、字盾讓塔慢慢打破、九頭蛇新頭直接長出）；排句在情境題也守 ORDER_MAX。由各外掛（第 8 組）與畫面（第 2 組）接。
  TG.QBUDGET_HARD = 55;
  TG.qSituOk = (s, k) => { if (TG.pfWaveQuiet && TG.pfWaveQuiet(s)) return false; if (!TG.QBUDGET_ON || !s) return true; const b = s.qb || { pts: 0, order: 0 }; return b.pts + TG.qCost(k || "fill") <= TG.QBUDGET_HARD && !(k === "order" && b.order >= TG.ORDER_MAX); };
  TG.QBUDGET_ON = true;    // 2026-11-22 第 1 組打開：自願題（qCanAsk）超過預算、排句滿 4、側邊面板在能量已滿時都不出
  TG.qCost = k => { const v = TG.QCOST[k]; return v === undefined ? 1 : v; };
  TG.qBook = function (s, info, kind) {
    const b = s.qb || (s.qb = { pts: 0, n: 0, order: 0, byK: {}, bySrc: {} });
    const k = kind === "spell" || kind === "fix" || kind === "order" || kind === "word" ? kind : ((info && info.qk) || kind || "mcq");
    b.pts += TG.qCost(k); b.n++; if (k === "order") b.order++; b.byK[k] = (b.byK[k] || 0) + 1;
    const src = (info && info.src) || (info && info.prep ? "prep" : info && info.word ? "word" : "?");
    if (b.bySrc) b.bySrc[src] = (b.bySrc[src] || 0) + TG.qCost(k);
    if (TG.QBUDGET_ON && !b.warned && b.pts >= TG.QBUDGET) { b.warned = true; s.events.push({ k: "qbudget", left: 0 }); }   // 一關只推一次（畫面：「這關的題目答完了，專心守城！」）
    return b;
  };
  TG.qBudgetLeft = s => TG.QBUDGET - ((s && s.qb && s.qb.pts) || 0);
  // 自願題（側邊面板、營地重抽、詠唱、召喚排句）出題前問；空殼永遠 true
  // 11-24 第二輪（B 組，試玩 P1-12）：能量滿「不再」是停題理由——能量滿時答對改給金幣（TG.ENERGY_FULL_GOLD），題量上限照舊。
  // 11-24 第二輪（B 組，試玩 P1-13）：魔王在場時，詠唱題（src chant）改算情境題（不吃 45 點自願額度，只守含情境題的 55 點總上限）。
  //   原因：小華 45 點額度約在第 5 波（195～221 秒）用完，魔王 162～240 秒才出場，魔王在場 8 次絕招 7 次不能詠唱。
  TG.bossOnField = s => !!(s && s.enemies && s.enemies.some(e => TG.ENEMIES[e.type] && TG.ENEMIES[e.type].boss));
  // ───── 先備戰再守城（2026-11-25，老闆提議「遊戲前先作答，作答完畢後再進行遊戲」）
  //   每波開打前在營地一次答 TG.pfCount(s) 題（src "prep"，照常給能量）；守城時不出任何題：
  //   側邊答題面板整個不顯示（地圖變大）、自願題與情境題都不出 → 魔王、冰盾、九頭蛇、字盾、哥布林、Be 巨人走既有的「不出題降級版」、詞彈怪不出現；
  //   騎士絕招的加強改用備戰時充好的次數（s.pfCharge，TG.pfRoundEnd 給）；召喚在守城時不排句、直接召喚（畫面端）。
  // 11-25 試玩修正（老闆裁示）：每輪固定 3 題就能開打（base），想多拿可「再答 3 題」加碼一次（extra）；每輪至少答 1 題（畫面端擋略過）
  TG.PF = { base: 3, extra: 3, gainAdd: 1, storeMax: 12, max: 8, min: 3, cardReserve: 2, chargeRate: 0.6, chargeMax: 2, fogT: 60, endless: 4, summonWords: 5 };
 // 依區域（第 1～5 區）的怪物血量倍率：機器人並排模擬，七成對與全對在後段比邊打邊答吃虧（能量條 12 格、怒氣上限讓一次答完的獎勵溢出）
  TG.PF_HP = [0.92, 0.88, 0.8, 0.72, 0.72];   // 11-25 晚：魔王守城門後並排重找（第 1、2、4、5 區先答題比邊打邊答難、第 3 區比較簡單）
  TG.pfHpMul = st => (st && TG.PF_HP[st.r]) || 1;
  // 先答題守城中，Be 巨人／時光樹妖的不出題招式（11-25 晚；sealT 要和 mods/bosses.js CFG.sealDegT 一樣，畫面提示用那個秒數）
  TG.PF_BOSS = { beEvery: 15, beN: 3, beType: "slime", sealEvery: 18, sealN: 1, sealT: 6 };
  TG.pfOn = s => !!(s && s.prepFirst && !s.over && !(s.modes && s.modes.iron));
  TG.pfWaveQuiet = s => TG.pfOn(s) && !!s.waveActive;   // 守城中（不出題）
  // 這一輪備戰出幾題：剩下的題量平均分給剩下的每一輪（旗子波的抽卡題、重抽各留 1 點），最多 6 題
  TG.pfCount = function (s) {
    if (!TG.pfOn(s)) return 1;
    if (!s.stage) return TG.PF.endless;
    const rounds = Math.max(1, s.maxWave - s.wave);
    const drawn = s.cards ? s.cards.drawn | 0 : 0, maxDraw = (TG.CAMP && TG.CAMP.maxDraw) || 3;
    const flags = Math.min(Math.max(0, maxDraw - drawn), TG.FLAG_WAVES(s.stage).filter(w => w > s.wave).length);
    const left = TG.QBUDGET - ((s.qb && s.qb.pts) || 0) - flags * TG.PF.cardReserve;
    return Math.max(0, Math.min(TG.PF.base, Math.floor(left / rounds)));
  };
  // 這一輪答完基本題後還能加碼幾題（0＝不能）：剩下的題量先留給之後每輪的基本題與抽卡題，有剩才給加碼（最多 TG.PF.extra）
  TG.pfExtra = function (s) {
    if (!TG.pfOn(s) || !s.stage) return 0;
    const rounds = Math.max(1, s.maxWave - s.wave);
    const drawn = s.cards ? s.cards.drawn | 0 : 0, maxDraw = (TG.CAMP && TG.CAMP.maxDraw) || 3;
    const flags = Math.min(Math.max(0, maxDraw - drawn), TG.FLAG_WAVES(s.stage).filter(w => w > s.wave).length);
    const left = TG.QBUDGET - ((s.qb && s.qb.pts) || 0) - flags * TG.PF.cardReserve - (rounds - 1) * TG.PF.base;
    return Math.max(0, Math.min(TG.PF.extra, left));
  };
  // 一輪備戰答完：第一次就答對達六成 → 絕招加強 +1 次（最多存 2 次）；回傳是否充到。另設下一波的自動詞彈顆數 s.pfWb（答對題數 ÷2 進位）
  //   anyOk（可省略）＝這輪答對的題數（含第二次機會）：≥1 → 下一波隱形刺客整波看得到（s.pfReveal；mods/creatures.js）
  TG.pfRoundEnd = function (s, n, firstOk, anyOk) {
    if (!TG.pfOn(s)) return false;
    s.pfReveal = (anyOk === undefined ? firstOk : anyOk) > 0;
    if (!(n > 0)) { s.pfWb = 0; return false; }
    s.pfWb = Math.ceil((firstOk | 0) / 2);   // 下一波的自動詞彈顆數（mods/wordbullet.js；每波上限照原本）
    if (firstOk >= Math.ceil(n * TG.PF.chargeRate)) { s.pfCharge = Math.min(TG.PF.chargeMax, (s.pfCharge | 0) + 1); s.events.push({ k: "pfCharge", n: s.pfCharge }); return true; }
    return false;
  };
  TG.qCanAsk = function (s, k, src) {
    if (TG.pfOn(s) && (src === "panel" || s.waveActive)) return false;   // 先備戰再守城：沒有側邊面板，守城中不出自願題
    if (!TG.QBUDGET_ON || !s) return true;
    const b = s.qb || { pts: 0, order: 0 };
    if (src === "chant" && TG.bossOnField(s)) return TG.qSituOk(s, k);
    // 側邊面板與「只出 1 題」的營地留 QBUDGET_RESERVE 點給之後的情境題（字盾、哥布林、Be 小怪、魔王機制不受上限擋，留空間才不會整關超過 45）
    const reserve = (src === "panel" || src === "prep") && !TG.pfOn(s) ? TG.QBUDGET_RESERVE : 0;   // 先備戰再守城：守城不出情境題，不用預留
    if (b.pts + TG.qCost(k || "fill") > TG.QBUDGET - reserve) return false;
    if (k === "order" && b.order >= TG.ORDER_MAX) return false;
    return true;
  };
  // 側邊答題面板的狀態（分工單介面 1，A 組顯示用）：{ ok:true } 或 { ok:false, why:"quota" }（本關自願題額度用完）
  //   ok 時另帶 full（能量已滿＝答對改拿金幣）、gold（能量滿時第一次答對大約拿幾金幣，給面板標籤「答對改拿 +N 金幣」）。
  //   沒有進行中的局：{ ok:false, why:"off" }。
  TG.ENERGY_FULL_GOLD = 10;   // 能量滿時答對：每 1 格放不進去的能量換 10 金幣（＝營地「都不要」滿格換金幣的比例 TG.CAMP.skipGold）
  TG.fullGold = (s, info) => {
    if (!s) return 0;
    const want = TG.energyGain(s, true, Object.assign({ kind: "mcq", src: "panel", try: 1, qk: "fill" }, info || {}));
    return Math.max(0, want - Math.max(0, TG.ENERGY_MAX - (s.energy || 0))) * TG.ENERGY_FULL_GOLD;
  };
  TG.volState = function (s) {
    if (!s || s.over) return { ok: false, why: "off" };
    if (!TG.qCanAsk(s, "fill", "panel")) return { ok: false, why: "quota" };
    const full = (s.energy || 0) >= TG.ENERGY_MAX;
    return full ? { ok: true, full: true, gold: TG.fullGold(s) } : { ok: true };
  };
  // 統一作答紀錄的題目欄位（合約 §3.2）
  TG.ansInfo = (q, extra) => Object.assign(q ? { qk: TG.kindOf(q), gp: q.gp || null, qid: q.id } : { qk: null, gp: null, qid: null }, extra || {});

  TG.answerResult = function (s, correct, info) {
    let fullGold = 0;   // 11-24：能量滿時換到的金幣（回傳值 { gold } 給畫面）
    const retry = !!(correct && isRetry(s, info));   // s.retryNext：畫面端第二次機會答對時暫設，涵蓋外掛直接呼叫 answerResult 的題
    const kind = (info && info.kind) || s._ansKind || (info && info.word ? "word" : info && info.prep ? "mcq" : null);
    TG.qBook(s, info, kind);   // v3 題目成本記帳
    // 每題能量上限：answerResult 期間 addEnergy 自動夾（s._ansRoom＝這題還能給幾格，外掛 onAnswer 用 addEnergy 就會被夾住）；s._ansE0＝這題作答前的能量（給外掛參考）
    const room0 = s._ansRoom, e00 = s._ansE0; s._ansRoom = TG.ENERGY_GAIN.max; s._ansE0 = s.energy || 0;
    const kh = s.heroes && s.heroes[0], rage0 = kh ? (kh.rage || 0) : 0;   // 每題怒氣上限（增益卡設計 §4：RAGE_PER_ANSWER_MAX）
    // 備戰題（info.prep）：獎勵是升級券，不給能量、不動連對（平衡：完美打法一波 3 題全對＝每波多 1 次免費升級＋多 3 能量，22 關幾乎全三星）
    const prep = !!(info && info.prep);
    if (prep) { /* 舊備戰題（info.prep，相容）：只記答對率與 onAnswer（鐵人答錯照算） */ }
    else if (correct) {
      // v3 能量（合約 §4）：energyGainParts（基本／秒答／狂熱／復仇／書本塔）＋卡片「每 N 題」獎勵，合計夾到 ENERGY_GAIN.max
      const wasFever = TG.feverOn(s), g = TG.energyGainParts(s, correct, info);
      if (g.book) s.bookN = (s.bookN || 0) + 1;
      const extra = TG._cardsAnswer(s, true, info, retry), want = Math.min(TG.ENERGY_GAIN.max, g.n + extra);
      const gotE = TG.addEnergy(s, want, "answer");
      // 11-24 第二輪（P1-12）：能量放不下（滿了）的部分換金幣——答題永遠有用，也補後段「能量夠、金幣不夠」的缺口
      if (want > gotE && (s.energy || 0) >= TG.ENERGY_MAX) {
        // 先備戰再守城（2026-11-25）：一輪答完能量常常放不下 → 多的先存著（s.pfStore，最多 TG.PF.storeMax 格），守城時能量條一空就自動補；存滿才換金幣
        let over = want - gotE;
        if (TG.pfOn(s)) { const put = Math.min(over, Math.max(0, TG.PF.storeMax - (s.pfStore | 0))); if (put > 0) { s.pfStore = (s.pfStore | 0) + put; over -= put; s.events.push({ k: "pfStore", n: put, v: s.pfStore }); } }
        if (over > 0) { fullGold = over * TG.ENERGY_FULL_GOLD; s.gold += fullGold; s.events.push({ k: "fullGold", gold: fullGold, e: over }); }
      }
      if (s.energyBank > 0 && !TG.NO_ENERGY_SRC[info && info.src] && !(info && info.word)) s.energyBank -= TG.addEnergy(s, Math.min(s.energyBank, TG.CARD_BANK.perAnswer), "card");   // 存摺：每答對領 ≤2（每題合計仍 ≤5）
      if (wasFever && kind !== "word") { s.fever.q++; if (s.fever.q >= (s.fever.maxQ || TG.FEVER.maxQ) && !(TG.pfOn(s) && !s.waveActive)) TG.feverEnd(s, "count"); }   // 先備戰再守城：備戰時觸發的狂熱不因題數結束，帶進下一波照秒數算
      if (!retry) {
        s.combo++; s.comboFresh = (s.comboFresh || 0) + 1;
        // 獎勵看「上次答錯後連續答對幾題」（comboFresh）：答錯只降一段後再爬回同一個數字不會再給（防刷：答錯 comboFresh 歸零，要重新連對 need 題）
        if (TG.FEVER.on) {
          if (!wasFever && !TG.feverOn(s) && !(s.fever && s.fever.cd > 0) && s.comboFresh % TG.feverNeed(s) === 0) TG.feverStart(s);
        } else {   // 舊制（FEVER.on=false 時）
          if (s.comboFresh % 3 === 0) { s.freeUp = true; s.events.push({ k: "combo", n: s.combo, reward: "free" }); }
          if (s.comboFresh % 5 === 0) { s.rushT = 10; s.events.push({ k: "combo", n: s.combo, reward: "rush" }); }
        }
      }
    } else {
      const was = s.combo; s.combo = TG.comboDrop(s.combo); s.comboFresh = 0; if (was > 0) s.events.push({ k: "comboDrop", from: was, to: s.combo });
      if (TG.feverOn(s)) TG.feverEnd(s, "wrong");
      TG._cardsAnswer(s, false, info, false);
    }
    TG.accPush(s, correct ? (retry ? 0.5 : 1) : 0);
    if (!prep && !correct && kind !== "word") s.waveWrongN = (s.waveWrongN || 0) + 1;   // 這一波答錯幾題（下一次營地的復仇題）
    const a = s.acc;
    if (info && info.starSkip) s._mcqPend = null;   // 挑戰題等：對錯都不進三星分母（增益卡設計 §9.3）
    else if (TG.STAR_KINDS[kind || "mcq"]) {
      const v = correct && !retry ? 1 : 0;
      a.mq = (a.mq || 0) + 1; a.mok = (a.mok || 0) + v;
      s._mcqPend = kind ? null : { t: s.time, v };
    } else s._mcqPend = null;
    hook("onAnswer", s, correct, info || null);
    if (room0 === undefined) { delete s._ansRoom; delete s._ansE0; } else { s._ansRoom = room0; s._ansE0 = e00; }
    if (kh && (kh.rage || 0) - rage0 > TG.RAGE_PER_ANSWER_MAX) kh.rage = rage0 + TG.RAGE_PER_ANSWER_MAX;   // 狂熱 ×1.5 × 卡片 × 技能樹疊起來也只到 35
    return { gold: fullGold };   // 11-24：能量滿時答對換到的金幣（0＝沒換）；舊呼叫不看回傳值
  };
  // 連對分段（11-21 雙軌改版）：答錯不歸零，降到「比現在小的最高一段」：6→5、5→3、4→3、2→0
  TG.COMBO_TIERS = [3, 5, 8];
  TG.comboDrop = c => { let t = 0; for (const x of TG.COMBO_TIERS) if (x < c) t = x; return t; };

  // ───── 備戰（波間答題，11-21 雙軌改版）：每波開打前（含第 1 波）出 PREP_N 題、遊戲暫停、不限時。
  // 答對 1 題＝1 張升級券（第二次機會才答對也給券）；復仇題（上一波答錯的題）答對再 +REVENGE_GOLD 金幣。
  // 有券升級＝付金幣＋1 券直接升級（不答題）；沒券照舊當場答題升級。無盡模式每 PREP_ENDLESS_EVERY 波一次。
  // 11-22 調整（模擬試玩：完美打法每關約 21 張券、第 5 關囤 11 張用不完，戰鬥中的限時答題幾乎消失；新手每關備戰 21～24 題、佔全部答題 95%）：
  //   每次 PREP_N 3→2 題；手上最多 TICKET_MAX 張券，滿了就不出備戰（除非上一波有答錯的題＝復仇題，複習照樣有獎勵），
  //   滿了還答對改給 TICKET_OVER_GOLD 金幣；第 1 關第 1 波前不出（先讓孩子蓋塔、知道遊戲在玩什麼，第 1 波打完才第一次備戰）。
  TG.PREP_N = 2; TG.REVENGE_GOLD = 15; TG.PREP_ENDLESS_EVERY = 2;
  TG.TICKET_MAX = 3; TG.TICKET_OVER_GOLD = 10;
  TG.PREP_TIME_HEROIC = 12;   // 英雄挑戰的備戰每題限時（秒）；一般 0＝不限時（畫面端用 TG.prepTime(G)）
  TG.prepTime = s => (s && s.heroic ? TG.PREP_TIME_HEROIC : 0);
  // 現在（波與波之間）該不該出備戰；同一個空檔只出一次（s.prepDone 記已出過的 wave）
  //   v3（UPGRADE_MODE "energy"）：升級券退場 → 不再因券滿而略過（營地每個波間都有：旗子波抽卡、其他波只出 1 題）
  TG.prepDue = s => !!s && !s.over && !s.waveActive && s.prepDone !== s.wave &&
    (s.stage ? s.wave < s.maxWave && !(s.stage.i === 0 && s.wave === 0) : s.wave % TG.PREP_ENDLESS_EVERY === 0) &&
    (TG.UPGRADE_MODE === "energy" || (s.tickets || 0) < TG.TICKET_MAX || (s.waveWrongN || 0) > 0);
  TG.prepMark = s => { s.prepDone = s.wave; s.waveWrongN = 0; };
  // 備戰作答：info＝{ retry, revenge }；回傳拿到的金幣
  //   v3 相容殼：UPGRADE_MODE "energy" 時不給券，改走一般答題（src "prep"＝營地只出 1 題的波，照常給能量）；復仇題照舊 +REVENGE_GOLD 金幣
  TG.prepAnswer = function (s, ok, info) {
    info = info || {}; let gold = 0;
    if (TG.UPGRADE_MODE === "energy") {
      if (ok && info.revenge) { gold = TG.REVENGE_GOLD; s.gold += gold; }
      TG.answerResult(s, ok, Object.assign({ kind: "mcq", src: "prep" }, info, { prep: false }));
      return gold;
    }
    if (ok) {
      const full = (s.tickets || 0) >= TG.TICKET_MAX;   // 券滿：改給金幣（事件 over:true，畫面顯示「券已滿，改拿 N 金幣」）
      if (full) gold += TG.TICKET_OVER_GOLD; else s.tickets = (s.tickets || 0) + 1;
      if (info.revenge) gold += TG.REVENGE_GOLD;
      s.gold += gold;
      s.events.push({ k: "ticket", n: s.tickets, revenge: !!info.revenge, gold, over: full });
    }
    TG.answerResult(s, ok, Object.assign({ prep: true }, info));
    return gold;
  };
  // 用升級券升級（不答題、立刻成功）：一樣付金幣（連對的免費升級照樣抵金幣），扣 1 券；答錯鎖住的塔也能用券（鎖是防亂猜，用券不是猜）
  //   v3 相容殼：UPGRADE_MODE "energy" 時「用券升級」＝能量升級（TG.canEnergyUpgrade／TG.energyUpgrade），畫面的券按鈕自動變成能量升級
  TG.canTicketUpgrade = (s, tw, branch) => TG.UPGRADE_MODE === "energy" ? TG.canEnergyUpgrade(s, tw, branch) : !!tw && (s.tickets || 0) > 0 && tw.lv < TG.MAX_LV && !tw.pending && !(tw.sealT > 0) &&
    !(TG.needsBranch(tw) && (!s.branchOk || !branch)) && s.gold >= (s.freeUp ? 0 : TG.upgradeCost(tw.type, tw.lv, s));
  TG.ticketUpgrade = function (s, id, branch) {
    if (TG.UPGRADE_MODE === "energy") return TG.energyUpgrade(s, id, branch);
    const tw = s.towers.find(t => t.id === id);
    if (!TG.canTicketUpgrade(s, tw, branch)) return false;
    const free = s.freeUp, c = free ? 0 : TG.upgradeCost(tw.type, tw.lv, s), nb = TG.needsBranch(tw);
    s.gold -= c; if (free) s.freeUp = false; s.tickets--;
    tw.lv++; tw.invested += c; if (nb) tw.branch = branch; tw.failN = 0;
    s.events.push({ k: "upgrade", tw, lv: tw.lv, branch: nb ? branch : null, ticket: true });
    return true;
  };
  // ───── v3 能量升級（合約 §4.2）：金幣（照舊 upgradeCost）＋能量（ENERGY_COST.up[lv]）立刻升級，不答題。
  //   增益卡「加班工匠」存的免能量升級（s.freeUpN，最多 2 次）先用；書本塔不能升級。
  TG.canEnergyUpgrade = (s, tw, branch) => !!tw && !(TG.TOWERS[tw.type] || {}).energy && tw.lv < TG.MAX_LV && !tw.pending && !(tw.sealT > 0) &&
    !(TG.needsBranch(tw) && (!s.branchOk || !branch)) && s.gold >= TG.upgradeCost(tw.type, tw.lv, s) &&
    ((s.freeUpN || 0) > 0 || TG.canSpend(s, TG.energyCost("up", s, tw)));
  TG.energyUpgrade = function (s, id, branch) {
    const tw = s.towers.find(t => t.id === id);
    if (!TG.canEnergyUpgrade(s, tw, branch)) return false;
    const c = TG.upgradeCost(tw.type, tw.lv, s), nb = TG.needsBranch(tw), free = (s.freeUpN || 0) > 0, e = free ? 0 : TG.energyCost("up", s, tw);
    if (free) s.freeUpN--; else if (!TG.spendEnergy(s, e, "up")) return false;
    s.gold -= c; tw.lv++; tw.invested += c; tw.energyIn = (tw.energyIn || 0) + e; if (nb) tw.branch = branch; tw.failN = 0;
    s.events.push({ k: "upgrade", tw, lv: tw.lv, branch: nb ? branch : null, energy: true, cost: e, free });
    return true;
  };

  // ═════════ v3 備戰營地與增益卡（合約 §7；資料＝_data/cards_v3.json → node _data/gen_data.mjs → mods/cards.data.js 的 TG.DATA_CARDS）
  // 營地：每個波間都有（TG.campDue＝prepDue）；旗子波（TG.FLAG_WAVES）答 1 題抽卡（答對三選一、答錯二選一），其他波只出 1 題（src "prep"，照常給能量）。
  // 傳說保底（2026-11-22 主對話裁定）：每「一手」擲一次傳說 L＝5%＋保底；沒出 +2%、L 最高 15%（11-23 第 7 步平衡：25%→15%，增益卡設計 §十 旋鈕 1）、出現就重置、跨關保留（s.cards.pity，畫面存 S.mods.camp.pity）；
  //   魔王關最後一次抽卡保證 1 張傳說。組合卡（duo，稀有度＝傳說＋兩派標記）：本關拿過 req.all 兩張 → 下一手保證出現；有效期本波、不佔長效名額、每關 1 張。
  // 略過＝三張都不要：能量 +2（滿了每格換 10 金幣）；沒抽卡（沒答營地題）不能略過（紅線 1：能量只能靠答題）。
  TG.CAMP = { maxDraw: 3, reroll: 1, longMax: 2, pick: { ok: 3, wrong: 2 }, rarity: { common: 65, rare: 30, legend: 5 }, pity: 0.02, pityCap: 0.15,
    skipEnergy: 2, skipGold: 10, factionHeld: 1.5, partner: 3, evoNeed: 3 };
  TG.FLAG_WAVES_DEF = { 5: [2, 4, 5], 6: [2, 4, 6], 7: [3, 5, 7], 8: [3, 6, 8] };
  // 第一批開放的卡（2026-11-22 主對話裁定約 25 張、四派各 ≥5）；null＝效果都實作了的卡全開。其餘卡等之後再開（效果沒實作的卡一律不出現）
  TG.CARD_ON = ["c_whetstone", "c_soup", "c_shield", "c_banner", "c_rage40", "c_oath", "c_unbroken", "c_headband",
    "c_overtime", "c_grant", "c_forge", "c_roar", "c_upsale", "c_branch", "c_burst",
    "c_reload", "c_battery", "c_notes", "c_earphone", "c_snack", "c_cheer",
    "c_scope", "c_chill", "c_review", "c_coinnotes", "c_retry", "c_sentence",
    "c_duo_support"];
  // 卡片封頂（增益卡設計 §4；所有卡相加後夾住）
  // 11-23 第 7 步平衡：塔傷害卡合計封頂 25% → 20%（增益卡設計 §十 旋鈕 1：高手三星飽和）
  TG.CARD_CAPS = { towerDmg: 0.20, towerSpd: 0.30, towerSpdTotal: 1.6, towerRange: 0.10, towerSplash: 0.30, enemySpd: 0.75, heroDmg: 0.5, heroBlock: 2,
    heroTaken: 0.7, allyDmg: 0.4, compDmg: 0.35, compUltCd: 0.5, summonCost: -3, castleShield: 2, freeUp: 2, chantAdd: 0.3, chantMax: 2.0,
    rageInstant: 50, rageLoop: 30, rageKeep: 40, markMul: 1.25, panelGold: 6 };
  // 卡片能量存摺（2026-11-23 紅線 1 修正）：卡片給的能量（能量補給、略過、事件型）一律先存，之後每答對 1 題最多領 perAnswer 格；每關略過最多存 skipMax 格
  TG.CARD_BANK = { perAnswer: 2, skipMax: 6 };
  const ENERGY_OPS = { energy: 1, freeUp: 1, energyGain: 1, bookTower: 1, upCost: 1, summonCost: 1 };
  TG.cardMakesEnergy = c => (c.fx || []).some(f => { const o = TG.cardOp(f); return ENERGY_OPS[o] || ((o === "perCorrect" || o === "onEvent") && (f.give || []).some(g => ENERGY_OPS[TG.cardOp(g)])); });
  TG.RAGE_PER_ANSWER_MAX = 35;   // 每題（含狂熱、卡片、技能樹）怒氣最多 +35
  TG.ULT_MIN_GAP = 10;   // 兩次騎士絕招（怒氣制）至少隔幾秒（全域規則，卡片的回怒氣再快也一樣；騎士外掛另有 30 秒施放間隔）
  TG.CARD_CUSTOM = {};   // 程式特例：TG.CARD_CUSTOM[id] = (s, card, phase, f) => {}；phase＝"take"｜"answer"｜"waveEnd"
  // 效果代號（合約 §7.3＋2026-11-22 新增 9 類：perCorrect onEvent energyGain fever chantMul towerSplash compDmg mark heal）；
  //   JSON 寫成 {op:"custom", id:"perCorrect"} 也認得（feverLen＝fever）
  const CARD_ALIAS = { perCorrect: "perCorrect", onEvent: "onEvent", energyGain: "energyGain", feverLen: "fever", fever: "fever", chantMul: "chantMul",
    towerSplash: "towerSplash", compDmg: "compDmg", mark: "mark", heal: "heal", burstAmmo: "burstAmmo", grammarShock: "grammarShock", comboHits: "comboHits", bookTower: "bookTower" };
  const CARD_OPS = new Set(["energy", "gold", "towerSpd", "towerDmg", "towerRange", "enemySpd", "rage", "rageGain", "summonCost", "upCost", "freeUp", "castleShield",
    "feverNeed", "panelGold", "heroDmg", "heroBlock", "compUltCd", "allyDmg", "perCorrect", "onEvent", "energyGain", "fever", "chantMul", "towerSplash", "compDmg",
    "mark", "heal", "burstAmmo", "grammarShock", "comboHits", "bookTower"]);
  const INSTANT_OPS = { energy: 1, gold: 1, rage: 1, castleShield: 1, freeUp: 1 };
  TG.cardOp = f => !f ? "" : f.op === "custom" ? (CARD_ALIAS[f.id] || "custom:" + f.id) : f.op;
  const opOk = (f, s) => {
    const op = TG.cardOp(f);
    if (op.indexOf("custom:") === 0) return typeof TG.CARD_CUSTOM[f.id] === "function";
    if (!CARD_OPS.has(op)) return false;
    if (op === "onEvent") return ["ult", "fever", "summon"].includes(f.on) && (f.give || []).every(g => opOk(g, s));
    if (op === "perCorrect") return (!f.stack || CARD_OPS.has(f.stack.op)) && (f.give || []).every(g => opOk(g, s));
    if (op === "energyGain") return f.src === "revenge" || f.src === "retry";   // harder（挑戰題）、chant 要畫面與騎士配合，之後再開
    if (op === "rageGain" || op === "chantMul") return TG.heroRageMax(s, 0) > 0;   // 騎士怒氣制上線才有用（看這一局的 s.kn，不看全域 def.rageMax）
    return true;
  };
  TG.cardFxOk = (fx, s) => Array.isArray(fx) && fx.length > 0 && fx.every(f => opOk(f, s));
  TG.cardData = () => (TG.DATA_CARDS && Array.isArray(TG.DATA_CARDS.cards) ? TG.DATA_CARDS : null);
  // 一張卡目前的樣子（進化：卡冊選滿 evoNeed 次且進化版效果都實作了；無盡模式改寫 dur）
  TG.cardDef = function (id, s) {
    const D = TG.cardData(); if (!D) return null;
    const c = D.cards.find(x => x.id === id); if (!c) return null;
    const o = Object.assign({}, c, { evolved: false });
    const picks = (s && s.cardPicks) || {};
    if (c.evo && c.evo.fx && (picks[id] | 0) >= TG.CAMP.evoNeed && TG.cardFxOk(c.evo.fx, s)) Object.assign(o, { name: c.evo.name || c.name, desc: c.evo.desc || c.desc, fx: c.evo.fx, evolved: true });
    if (s && !s.stage && c.endless && c.endless.dur) o.dur = c.endless.dur;
    return o;
  };
  TG.cardOn = (c, s) => !!c && (!TG.CARD_ON || TG.CARD_ON.includes(c.id)) && TG.cardFxOk(c.fx, s);
  TG.cardCleared = s => s.cleared !== undefined && s.cleared !== null ? s.cleared : (s.stage ? s.stage.i : 22);
  // 出現條件（合約 req＋增益卡擴充鍵）；認不得的鍵＝不出現
  TG.cardReqOk = function (s, req) {
    if (!req) return true;
    const C = s.cards || {}, taken = C.taken || [];
    for (const k in req) {
      const v = req[k];
      if (v === null || v === undefined) continue;
      if (k === "all") { if (!v.every(id => taken.includes(id))) return false; }
      else if (k === "lv") { if (((s.heroes && s.heroes[0] && s.heroes[0].lv) || 1) < v) return false; }
      else if (k === "stage") { if (TG.cardCleared(s) < v) return false; }
      else if (k === "summon") { if (!s.summons || s.summons[v] === undefined) return false; }
      else if (k === "summons") { if (Object.keys(s.summons || {}).length < v) return false; }
      else if (k === "companion") { if (!!v !== ((s.heroes || []).length > 1)) return false; }
      else if (k === "wrongBook") { if ((s.wrongBook | 0) < v) return false; }
      else if (k === "secondChance") { if (!!v === !!(s.heroic || (s.modes && s.modes.iron) || s.noSecondChance)) return false; }
      else if (k === "notHeroic") { if (!!v === !!s.heroic) return false; }
      else return false;
    }
    return true;
  };
  TG.FLAG_WAVES = function (st) {
    if (!st) return [];
    const D = TG.cardData(), t = (D && D.rules && D.rules.draw && D.rules.draw.flagWaves) || TG.FLAG_WAVES_DEF, n = st.waves;
    const a = t[n] || TG.FLAG_WAVES_DEF[n];
    return Array.isArray(a) ? a.filter(w => w >= 1 && w <= n) : [Math.max(2, Math.ceil(n * 3 / 8)), Math.max(3, Math.ceil(n * 6 / 8)), n].filter((w, i, x) => x.indexOf(w) === i);
  };
  TG.campDue = s => TG.prepDue(s);
  // "camp"＝旗子波（抽卡）｜"quick"＝其他波只出 1 題｜null＝現在沒有營地。無盡模式每次營地都抽卡（不受每關 3 次限制）
  TG.campKind = function (s) {
    if (!TG.campDue(s)) return null;
    if (!s.stage) return TG.cardData() ? "camp" : "quick";
    return TG.cardData() && TG.FLAG_WAVES(s.stage).includes(s.wave + 1) && (s.cards ? s.cards.drawn : 0) < TG.CAMP.maxDraw ? "camp" : "quick";
  };
  TG.campIsLastFlag = s => { const f = TG.FLAG_WAVES(s.stage); return !!s.stage && f.length > 0 && f[f.length - 1] === s.wave + 1; };
  TG._cardsInit = function (s, opts) {
    s.cards = { held: [], drawn: 0, pity: Math.max(0, Math.min(TG.CAMP.pityCap - TG.CAMP.rarity.legend / 100, +opts.cardPity || 0)), long: 0, taken: [], hand: null, duoTaken: false, factions: [] };
    s.cardPicks = opts.cardPicks || {}; s.cleared = opts.cleared; s.wrongBook = opts.wrongBook | 0;
    s.cardTmp = []; s.castleShield = 0; s.freeUpN = 0; s.bookN = 0; s.energyBank = 0; s.skipBanked = 0; s.cardWave = { burst: 0, shock: 0 }; s.cardBurst = 0; s.cardCombo = null;
    s.fever = { t: 0, q: 0, cd: 0, n: 0 };
  };
  // 抽一手 n 張（不重複）；o：{ reroll:true 重抽（不算抽卡次數）, exclude:[id…], tutorial:true（存檔第一次進營地固定三張） }
  TG.campDraw = function (s, n, rng, o) {
    o = o || {}; rng = rng || s.rng || Math.random;
    const D = TG.cardData(), C = s.cards; if (!D || !C) return [];
    n = Math.max(1, n || TG.CAMP.pick.ok);
    if (!o.reroll) C.drawn++;
    const exclude = new Set(o.exclude || []), out = [];
    const cnt = id => C.taken.filter(x => x === id).length;
    // 答錯（二選一）的手牌：只出「本波、不產生能量」的卡（紅線 1：全錯也不會因卡片累積能量）
    const wrongHand = o.wrong !== undefined ? !!o.wrong : n <= TG.CAMP.pick.wrong;
    const ok = c => (!wrongHand || (c.dur !== "stage" && c.dur !== "now" && !TG.cardMakesEnergy(c))) && TG.cardOn(c, s) && !exclude.has(c.id) && !out.some(x => x.id === c.id) && TG.cardReqOk(s, c.req) &&
      cnt(c.id) < (c.dur === "stage" ? 1 : (c.max || 1)) && !C.held.some(h => h.id === c.id && h.dur === "stage") &&
      !(c.dur === "stage" && C.long >= TG.CAMP.longMax);
    const defs = D.cards.map(c => TG.cardDef(c.id, s));
    const pickW = (list, wf) => { const ws = list.map(wf), sum = ws.reduce((a, b) => a + b, 0); let r = rng() * sum; for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; } return list[list.length - 1]; };
    const partnerIds = new Set();
    for (const d of defs) if (d.duo && d.req && Array.isArray(d.req.all) && !C.duoTaken) { const has = d.req.all.filter(id => C.taken.includes(id)); if (has.length) d.req.all.forEach(id => { if (!C.taken.includes(id)) partnerIds.add(id); }); }
    const w = c => (C.factions.includes(c.faction) ? TG.CAMP.factionHeld : 1) * (partnerIds.has(c.id) ? TG.CAMP.partner : 1);
    if (o.tutorial && D.rules && D.rules.draw && D.rules.draw.tutorial) for (const id of D.rules.draw.tutorial.firstCampEver || []) { const c = defs.find(x => x.id === id); if (c && ok(c) && out.length < n) out.push(c); }
    // ① 組合卡：前置拿齊 → 保證 1 格
    if (!C.duoTaken && out.length < n) { const duos = defs.filter(c => c.duo && ok(c)); if (duos.length) out.push(duos[Math.floor(rng() * duos.length)]); }
    // ② 傳說：每手擲一次（保底）；魔王關最後一次抽卡保證
    const base = TG.CAMP.rarity.legend / 100, L = Math.min(TG.CAMP.pityCap, base + C.pity);
    const forceLegend = !o.reroll && !!s.stage && s.stage.boss && TG.campIsLastFlag(s);
    let legend = false;
    if (out.length < n && (forceLegend || rng() < L)) { const pool = defs.filter(c => c.rarity === "legend" && !c.duo && ok(c)); if (pool.length) { out.push(pickW(pool, w)); legend = true; } }
    // ③ 其餘：普通 65：稀有 30；沒得出就降級／換另一種
    const tot = TG.CAMP.rarity.common + TG.CAMP.rarity.rare;
    let guard = 0;
    while (out.length < n && guard++ < 20) {
      const want = rng() * tot < TG.CAMP.rarity.common ? "common" : "rare";
      let pool = defs.filter(c => c.rarity === want && !c.duo && ok(c));
      if (!pool.length) pool = defs.filter(c => (c.rarity === "common" || c.rarity === "rare") && !c.duo && ok(c));
      if (!pool.length) break;
      out.push(pickW(pool, w));
    }
    C.pity = legend ? 0 : Math.min(TG.CAMP.pityCap - base, C.pity + TG.CAMP.pity);
    C.hand = out.map(c => c.id);
    return out.map(c => ({ id: c.id, name: c.name, desc: c.desc, rarity: c.rarity, faction: c.faction || null, duo: c.duo || null, dur: c.dur, fx: c.fx, evolved: c.evolved, icon: c.icon || null }));
  };
  const instantFx = function (s, f, why) {
    const op = TG.cardOp(f), h = s.heroes && s.heroes[0];
    if (op === "energy") s.energyBank = (s.energyBank || 0) + (f.v || 0);   // 紅線 1：卡片能量先存進「能量存摺」，之後每答對 1 題才領（TG.CARD_BANK）
    else if (op === "gold") s.gold += (f.v || 0) + (f.perRegion || 0) * (s.stage ? s.stage.r : 0);
    else if (op === "rage" && h) {
      const def = TG.heroDef(h), v = Math.min(TG.CARD_CAPS.rageInstant, f.v || 0);
      const rm = TG.heroRageMax(s, 0);
      if (rm) { if (s.kn && typeof TG.knightAddRage === "function") TG.knightAddRage(s, v, "card"); else h.rage = Math.min(rm, (h.rage || 0) + v); }
      else h.ultCd = Math.max(0, h.ultCd - def.ultCd * v / 100);   // 舊冷卻制騎士：怒氣換成冷卻縮短（100 怒氣＝一整段冷卻）
    }
    else if (op === "castleShield") s.castleShield = Math.min(TG.CARD_CAPS.castleShield, (s.castleShield || 0) + (f.n || 1));
    else if (op === "freeUp") s.freeUpN = Math.min(TG.CARD_CAPS.freeUp, (s.freeUpN || 0) + (f.n || 1));
  };
  // 拿卡：立即類效果馬上套用；其他效果放進 s.cards.held（left＝還剩幾波，本關卡＝Infinity）
  TG.campTake = function (s, id) {
    const C = s.cards; if (!C) return false;
    if (C.hand && !C.hand.includes(id)) return false;
    const c = TG.cardDef(id, s); if (!c || !TG.cardOn(c, s)) return false;
    C.hand = null; C.taken.push(id);
    if (c.faction && !C.factions.includes(c.faction) && C.factions.length < 2) C.factions.push(c.faction);
    if (c.duo) C.duoTaken = true;
    const keep = [];
    for (const f of c.fx) {
      const op = TG.cardOp(f);
      if (INSTANT_OPS[op]) instantFx(s, f, "card");
      else if (op === "heal") { const h = s.heroes && s.heroes[0]; if (h) { if (h.dead > 0 && f.revive) { h.dead = 0; h.hp = h.maxHp; } else if (f.full && h.dead <= 0) h.hp = h.maxHp; } if (f.taken) keep.push(f); }
      else if (op.indexOf("custom:") === 0) { TG.CARD_CUSTOM[f.id](s, c, "take", f); keep.push(f); }
      else keep.push(f);
    }
    if (keep.length && c.dur !== "now") {
      const left = c.dur === "stage" ? Infinity : c.dur === "wave" ? 1 : (c.dur && c.dur.waves) || 1;
      C.held.push({ id, dur: c.dur === "stage" ? "stage" : c.dur === "wave" ? "wave" : "waves", left, fx: keep, st: {}, rarity: c.rarity });
      if (c.dur === "stage") C.long++;
    }
    if (s.kn) s.kn.chantAdd = TG.cardChantAdd(s);   // 詠唱大師：騎士外掛讀 s.kn.chantAdd
    s.events.push({ k: "card", id, rarity: c.rarity, evolved: c.evolved });
    return true;
  };
  // 略過這一手：能量 +skipEnergy（滿了每格換 skipGold 金幣）；回傳拿到的能量
  TG.campSkip = function (s) {
    const C = s.cards; if (!C || !C.hand) return 0;
    C.hand = null;
    const got = Math.max(0, Math.min(TG.CAMP.skipEnergy, TG.CARD_BANK.skipMax - (s.skipBanked || 0)));   // 每關略過最多存 skipMax 格
    s.skipBanked = (s.skipBanked || 0) + got; s.energyBank = (s.energyBank || 0) + got;
    s.gold += (TG.CAMP.skipEnergy - got) * TG.CAMP.skipGold;
    s.events.push({ k: "campSkip", bank: got });
    return got;
  };
  // 目前生效中、同一個 op 的效果彙總：{ n, mul（相乘）, add（相加）, v（相加）, list }；perCorrect 疊層（stack）也算進對應 op 的 mul
  TG.cardActive = function (s, op) {
    const r = { n: 0, mul: 1, add: 0, v: 0, list: [] };
    const C = s && s.cards; if (!C) return r;
    for (const h of C.held) for (const f of h.fx) {
      const o = TG.cardOp(f);
      if (o === op) { r.n++; r.list.push(f); if (f.mul !== undefined) r.mul *= f.mul; if (f.add !== undefined) r.add += f.add; if (f.v !== undefined) r.v += f.v; }
      else if (o === "perCorrect" && f.stack && f.stack.op === op && h.st.stack) { r.n++; r.list.push(f); r.mul *= 1 + h.st.stack; }
    }
    return r;
  };
  const fxMatch = (f, tw) => (!f.type || f.type === tw.type || f.type === tw.branch) && (!f.branch || (f.branch === "any" ? !!tw.branch : tw.branch === f.branch));
  // 塔的卡片倍率（傷害、射程、爆炸、攻速；依塔種／分支篩）。塔傷害合計最多 +20%、攻速卡片 +30%、含狂熱 ×1.6
  TG.cardTowerMods = function (s, tw) {
    const r = { dmg: 1, range: 0, splash: 1, spd: 1 };
    const C = s && s.cards; if (!C) return r;
    let dP = 0, sP = 0, rA = 0, spl = 1;
    for (const h of C.held) for (const f of h.fx) {
      const o = TG.cardOp(f);
      if (o === "towerDmg" && fxMatch(f, tw)) dP += (f.mul || 1) - 1;
      else if (o === "towerSpd" && fxMatch(f, tw)) sP += (f.mul || 1) - 1;
      else if (o === "towerRange" && fxMatch(f, tw)) rA += f.add || 0;
      else if (o === "towerSplash") spl *= f.mul || 1;
      else if (o === "perCorrect" && f.stack && f.stack.op === "towerDmg") dP += h.st.stack || 0;
    }
    for (const t of s.cardTmp || []) if (t.t > 0 && (!t.near || H(tw.x - t.x, tw.y - t.y) <= t.near)) { if (t.op === "towerSpd") sP += (t.mul || 1) - 1; else if (t.op === "towerDmg") dP += (t.mul || 1) - 1; }
    r.dmg = 1 + Math.min(TG.CARD_CAPS.towerDmg, dP); r.spd = 1 + Math.min(TG.CARD_CAPS.towerSpd, sP); r.range = rA; r.splash = Math.min(1 + TG.CARD_CAPS.towerSplash, spl);
    return r;
  };
  // 塔攻速總倍率：狂熱 ×1.5 × 卡片，合計最多 ×1.6；舊制連對加速（rushT，FEVER.on=false 時）照舊 1/0.75
  TG.towerSpdMul = function (s, tw) {
    const fever = TG.feverOn(s) ? TG.FEVER.towerSpd : 1, card = TG.cardTowerMods(s, tw).spd, rush = !TG.FEVER.on && s.rushT > 0 ? 1 / 0.75 : 1;
    return fever > 1 || card > 1 ? Math.min(TG.CARD_CAPS.towerSpdTotal, fever * card) * rush : rush;
  };
  TG.cardRetryEnergy = s => { let v = 0; for (const f of TG.cardActive(s, "energyGain").list) if (f.src === "retry" && f.set) v = Math.max(v, f.set); return v; };
  TG.cardRevengeEnergy = s => { let v = 0; for (const f of TG.cardActive(s, "energyGain").list) if (f.src === "revenge") v += f.add || 0; return v; };
  TG.cardFeverLen = s => { const r = { dur: 0, maxQ: 0 }; for (const f of TG.cardActive(s, "fever").list) { r.dur = Math.max(r.dur, f.dur || 0); r.maxQ = Math.max(r.maxQ, f.maxQ || 0); } return r; };
  TG.cardBook = s => { const l = TG.cardActive(s, "bookTower").list; return l.length ? l[l.length - 1] : null; };
  TG.cardRageMul = s => TG.cardActive(s, "rageGain").mul;            // 給騎士外掛：怒氣獲得倍率（每題怒氣仍最多 35）
  TG.cardChantAdd = s => Math.min(TG.CARD_CAPS.chantAdd, TG.cardActive(s, "chantMul").add);
  TG.chantMul = s => Math.min(TG.CARD_CAPS.chantMax, ((TG.KNIGHT && TG.KNIGHT.CHANT && TG.KNIGHT.CHANT.mul) || 1.5) + TG.cardChantAdd(s));
  let cardFxLock = false;   // 百分比傷害、爆炸造成的擊殺不再觸發別張卡（不連鎖）
  const pctBlast = function (s, x, y, r, pct, bossPct, from, id) {
    cardFxLock = true;
    for (const o of s.enemies.slice()) {
      if (o === from || (r && H(o.x - x, o.y - y) > r)) continue;
      const boss = TG.ENEMIES[o.type].boss;
      TG._hurt(s, o, boss ? o.maxHp * bossPct : (from ? from.maxHp : o.maxHp) * pct, true);
    }
    cardFxLock = false;
    s.events.push({ k: "cardFx", id, x, y, r: r || 0 });
  };
  // 答題時的卡片效果；回傳要額外給的能量（每 N 題獎勵；呼叫端合計後夾到 ENERGY_GAIN.max）。答錯不清掉任何疊層。
  TG._cardsAnswer = function (s, ok, info, retry) {
    const C = s.cards; if (!C || !C.held.length || !ok) return 0;
    const src = info && info.src; if (src === "camp" || src === "campReroll") return 0;   // 營地抽卡題本身不算
    let extra = 0; const h0 = s.heroes && s.heroes[0];
    for (const h of C.held) for (const f of h.fx) {
      const o = TG.cardOp(f), st = h.st;
      if (o === "perCorrect") {
        if (f.stack) st.stack = Math.min(f.stack.max || 0, (st.stack || 0) + (f.stack.step || 0));
        if (f.every) { st.n = (st.n || 0) + 1; if (st.n % f.every === 0 && (st.times || 0) < (f.maxTimes || Infinity)) { st.times = (st.times || 0) + 1; for (const g of f.give || []) { if (TG.cardOp(g) === "energy") extra += g.v || 0; else instantFx(s, g, "card"); } } }
      } else if (o === "panelGold") { if (src === "panel") s.gold += Math.min(TG.CARD_CAPS.panelGold, f.v || 0); }
      else if (o === "burstAmmo") { st.n = (st.n || 0) + 1; if (st.n % (f.every || 2) === 0) s.cardBurst = Math.min(f.store || 3, (s.cardBurst || 0) + 1); }
      else if (o === "grammarShock") {
        st.n = (st.n || 0) + 1;
        if (st.n % (f.every || 3) === 0 && s.cardWave.shock < (f.perWave || 2) && s.enemies.length) { s.cardWave.shock++; pctBlast(s, 150, 200, 0, f.pct || 0.1, f.bossPct || 0.02, null, h.id); }
      } else if (o === "comboHits") s.cardCombo = { n: f.hits || 5, mul: f.mul || 1.6 };
      else if (o === "mark") {
        const live = s.enemies.filter(e => !e.shield && s.towers.some(t => !(TG.TOWERS[t.type] || {}).energy && H(e.x - t.x, e.y - t.y) <= TG.TOWERS[t.type].range + 20)).sort((a, b) => b.hp - a.hp).slice(0, f.n || 1);
        for (const e of live) { e.cardMarkT = f.t || 5; e.cardMarkMul = Math.min(TG.CARD_CAPS.markMul, TG.ENEMIES[e.type].boss ? (f.bossMul || 1.1) : (f.mul || 1.2)); }
      } else if (o.indexOf("custom:") === 0) TG.CARD_CUSTOM[f.id](s, h, "answer", f);
    }
    return extra;
  };
  // 事件型卡片（onEvent）：on＝ult（騎士放絕招）｜fever（狂熱開始）｜summon（召喚完成）
  TG._cardEvent = function (s, on) {
    const C = s.cards; if (!C || !C.held.length) return;
    const k = s.heroes && s.heroes[0];
    for (const h of C.held) for (const f of h.fx) {
      if (TG.cardOp(f) !== "onEvent" || f.on !== on) continue;
      for (const g of f.give || []) {
        const o = TG.cardOp(g);
        if (g.t) s.cardTmp.push({ op: o, mul: g.mul, add: g.add, t: g.t, near: g.near || 0, x: k ? k.x : 150, y: k ? k.y : 200 });
        else if (o === "rage" && on === "ult" && k) {   // 絕招回怒氣：取大不相加、最多 rageLoop（30）、保留怒氣合計 ≤ rageKeep（40）
          const def = TG.heroDef(k), v = Math.min(TG.CARD_CAPS.rageLoop, g.v || 0);
          if (TG.heroRageMax(s, 0)) k.rage = Math.min(TG.CARD_CAPS.rageKeep, Math.max(k.rage || 0, v));
          else k.ultCd = Math.max(TG.ULT_MIN_GAP, k.ultCd - def.ultCd * v / 100);
        } else instantFx(s, g, "card");
      }
    }
  };
  // 本波結束：卡片剩餘波數 −1，到 0 移除（推 cardEnd）
  TG._cardsWaveEnd = function (s) {
    const C = s.cards; if (!C) return;
    for (const h of C.held.slice()) {
      if (h.left === Infinity) continue;
      if (--h.left <= 0) { C.held.splice(C.held.indexOf(h), 1); if (h.dur === "stage") C.long--; s.events.push({ k: "cardEnd", id: h.id }); }
    }
    if (s.kn) s.kn.chantAdd = TG.cardChantAdd(s);
  };

  // ───── 本局答對率（難度自動調整用；只看本局最近 ACC_GAME_WIN 題，答滿 ACC_GAME_MIN 題才啟動）
  TG.ACC_GAME_MIN = 3;
  TG.ACC_GAME_WIN = 12;
  TG.accPush = (s, v) => { const a = s.acc || (s.acc = { n: 0, h: [] }); a.n++; a.sum = (a.sum || 0) + v; a.h.push(v); if (a.h.length > TG.ACC_GAME_WIN) a.h.shift(); };
  // 本關全部答題的答對率（三星條件用；第二次機會才答對算半題）；還沒答題回傳 null
  //   11-22：改成選擇題第一次就答對的比例（見 TG.starInfo 註解）；舊算法（全部題型、第二次機會算半題）留在 TG.stageAccAll
  TG.stageAcc = s => { const a = s && s.acc; return a && a.mq ? (a.mok || 0) / a.mq : null; };
  TG.stageAccAll = s => { const a = s && s.acc; return a && a.n ? (a.sum || 0) / a.n : null; };
  TG.starAccInfo = s => { const a = (s && s.acc) || {}; return { n: a.mq || 0, ok: a.mok || 0, acc: TG.stageAcc(s) }; };   // 結算可顯示「選擇題一次答對 ok／n 題」
  TG.gameAcc = s => { const a = s && s.acc; return a && a.h.length >= TG.ACC_GAME_MIN ? a.h.reduce((x, y) => x + y, 0) / a.h.length : null; };
  // ───── 之後出場的怪物血量倍率（已在場上的怪不變）（spawnEnemy）：
  // ① （11-24 老闆裁示拿掉）原本的「低答對率下修」TG.lowAccHpMul（本局答對率 <50% 怪血最多 −15%）等於答對變多時怪物相對變硬，
  //   違反「答對越多，不能讓怪變硬」。怪血不再看答對率；弱的孩子改由對所有人一樣的逐關血量與練習模式照顧（見 STAGE_HP_BOOST、mods/coach.js）。
  // ② 戰力加血（高手加成）TG.powerHpMul（11-22 老闆裁示：「複習就該給獎勵」，答得好不可以讓怪變硬 → 不看答對率，改看隊伍有多強）。
  //   戰力 TG.teamPower(s)＝開局時的隊伍養成相對於「照進度正常玩」的基準（＝test/regression.js 的 realProg，模擬試玩小明的存檔）：
  //     英雄等級 ÷ (1＋關卡序號/2)、同伴等級 ÷ (起始等級＋0.4×加入後關數)、召喚獸等級 ÷ (1＋解鎖後關數/6)、裝備（件數＋升星）÷ 該進度的件數，
  //     加權平均（0.4／0.25／0.2／0.15）；再加上場上的塔力（依等級換算的投資額 ÷ 全部 3 級，超過 1 的部分）。
  //   照進度玩＝約 1.0 → 不加；英雄、同伴、召喚獸練得比進度高很多（約 1.35 以上）→ 加滿該區上限 POWER_HP_UPS。
  //   一般玩家、新手（養成跟著進度走、塔不升滿）不受影響。英雄挑戰、鐵人（s.noPowerUp）不加。
  //   先試過、不採用的做法（模擬）：①只看塔的投資額／等級：後期每關只有 5～6 波、金幣有限，完美打法和一般玩家的塔幾乎一樣
  //   （平均 2.8 級 vs 2.1 級、沒有塔到 4 級），分不出來；②看怪倒下的位置、③看連續幾波沒漏怪：都是負回饋，高手會穩在「差一點漏」仍滿命，
  //   一般玩家偶爾守得好反而被加血而失守。完美打法真正的優勢在召喚、破盾、連對加速（都是答對換來的，依裁示不懲罰）。
  TG.POWER_LO = 1.05; TG.POWER_FULL = 1.35;
  TG.POWER_HP_UPS = [0, 0.2, 0.8, 0.85, 1.2];   // v3 第 1 組（舊戰力公式，新戰力公式上線前用）：1.15／1.2／1.65 → 0.8／0.85／1.2。升級改吃能量、答題有時間成本後完美打法變弱，九成對第 3～5 區三星掉到 8/24
  // v3（合約 §10，2026-11-22 第 1 組）：塔改用能量升級後塔等級＝答題數 → 塔力權重歸 0（答得好不懲罰）；高手平衡改調能量價格、上限、卡片時效。
  TG.POWER_TOWER_W = 0; TG.POWER_TOWER_CAP = Infinity;
  TG.towerEq = (type, lv) => TG.TOWERS[type].cost * (1 + 0.45 * lv * (lv - 1) / 2);   // 從 1 級升到 lv 級的總投資（不管有沒有用免費升級）
  // 場上的塔力：所有塔依等級換算的投資額 ÷ 同樣的塔全部 3 級（一般玩家上限＝1）；書本塔不算
  TG.towerPower = s => { const t = ((s && s.towers) || []).filter(x => !(TG.TOWERS[x.type] || {}).energy); if (!t.length) return 0; return t.reduce((a, x) => a + TG.towerEq(x.type, x.lv), 0) / t.reduce((a, x) => a + TG.towerEq(x.type, 3), 0); };
  // v3 新戰力公式（合約 §8.2a；_data/knight_tree.json 的 teamPower）：騎士外掛提供 TG.knightBuildR（配裝倍率 R）後，加難改成
  //   1 ＋ U[區] × clamp((R − R_LO) ÷ R_SPAN, 0, 1)；不看答對率、答題數、塔等級、英雄／同伴／召喚獸等級、徽章、裝備星數。
  //   **必須和新等級曲線同一步**：騎士外掛沒提供 knightBuildR 時照舊公式（舊等級曲線）。
  TG.POWER_R = { lo: 1.15, span: 0.35, ups: [0, 0.05, 0.1, 0.1, 0.15] };
  TG.powerNew = () => typeof TG.knightBuildR === "function";
  // 新等級曲線＋騎士技能樹／怒氣上線時的各區怪物血量（與上面同一步才生效）：英雄等級變高（第 0 關 Lv3、第 16 關 Lv14）、絕招改怒氣，
  //   不調的話零答題機器人光靠英雄就守住第 1 區、全錯玩家過 17 關、一般玩家後三區平均剩 20 命（2026-11-23 第 1 組全外掛模擬）。對所有人一樣，不看答對率。
  //   第 2 區 1.05（1.1～1.15 時新手第 6～7 關失守）；第 3～5 區 1.45／1.5／1.6（第 5 組試算：一般玩家後三區回到 7～16 命）。第 7 步整體平衡時和第 5 組一起重校。
  TG.NEWCURVE_HP = [1.3, 1.05, 1.885, 1.5, 1.6];   // 11-23 第 7 步：第 3 區 1.45→1.885（和 STAGE_HP_BOOST 第 3 區同除 1.3 對調，相鄰關差才 ≤0.7；實際血量見該表說明）
  TG.teamPowerDisplay = s => typeof TG.knightPowerDisplay === "function" ? TG.knightPowerDisplay(s) : Math.round(100 * TG.teamPower(s));
  TG.teamPower = function (s) {
    const st = s && s.stage; if (!st) return 1;
    const i = st.i, ratio = (v, b) => v / Math.max(1, b), parts = [];
    const hero = s.heroes && s.heroes[0]; if (hero) parts.push([0.4, ratio(hero.lv, 1 + i / 2)]);
    const C = TG.COMP, comp = C && s.heroes ? s.heroes.find(h => C.ids && C.ids.includes(h.id)) : null;
    // 同伴／召喚獸的基準等級直接讀 COMP.unlock／startLv、SUMMON_UNLOCK（11-23 提早解鎖：同伴 3／7／12 關、起始 Lv4／7／11，冰鳳 6、光獨角獸 9），
    //   和 test/regression.js 的 realProg 同一套（同伴每關 +0.4 級取整、召喚獸每 6 關 +1 級）→ 照進度玩仍是 1.0；改解鎖時點不必改這裡
    if (comp) parts.push([0.25, ratio(comp.lv, C.startLv[comp.id] + Math.floor(0.4 * Math.max(0, i - C.unlock[comp.id])))]);
    const pets = Object.keys(s.summons || {}); if (pets.length) parts.push([0.2, pets.reduce((a, id) => a + ratio(s.summons[id] || 1, 1 + Math.floor(Math.max(0, i - (TG.SUMMON_UNLOCK[id] || 0)) / 6)), 0) / pets.length]);
    const gbase = (i >= 3) + (i >= 4) + (i >= 6);
    if (gbase && s.gearOn) { const ids = Object.keys(s.gearOn), stars = ids.reduce((a, id) => a + Math.max(1, ((s.gearLv || {})[id] | 0) || 1), 0); parts.push([0.15, Math.max(ids.length, stars) / gbase]); }
    const w = parts.reduce((a, p) => a + p[0], 0);
    return w ? parts.reduce((a, p) => a + p[0] * p[1], 0) / w : 1;
  };
  TG.powerHpMul = s => {
    if (!s || !s.stage || s.heroic || s.noPowerUp) return 1;
    if (TG.powerNew()) {
      const P = TG.POWER_R, tp = TG.KNIGHT && TG.KNIGHT.TEAM_POWER, ups = (tp && Array.isArray(tp.U_byRegion) && tp.U_byRegion) || P.ups, U = ups[s.stage.r] || 0;
      if (!U) return 1;
      if (s.buildR === undefined) s.buildR = +TG.knightBuildR(s) || 1;
      return 1 + U * Math.max(0, Math.min(1, (s.buildR - P.lo) / P.span));
    }
    const u = TG.POWER_HP_UPS[s.stage.r] || 0; if (!u) return 1;
    if (s.teamPow === undefined) s.teamPow = TG.teamPower(s);
    const p = s.teamPow + TG.POWER_TOWER_W * Math.min(TG.POWER_TOWER_CAP, Math.max(0, TG.towerPower(s) - 1));   // v3（合約 §10）：塔改用能量升級後第 1 組把 POWER_TOWER_W 設 0（答得好不懲罰）
    return p > TG.POWER_LO ? 1 + u * Math.min(1, (p - TG.POWER_LO) / (TG.POWER_FULL - TG.POWER_LO)) : 1;
  };
  TG.HIGH_ACC = 0.85;   // 答對率 >85%：選擇題有 UP_CHANCE 機率抽高一級的題（答對率現在只用在這裡和三星門檻）
  // 答對率 >85%：選擇題也有 UP_CHANCE 機率抽高一級的題（見 pickQuestion）
  TG.UP_CHANCE = 0.35;
  TG.accUp = s => { const r = TG.gameAcc(s); return r !== null && r > TG.HIGH_ACC; };

  // ───── 塔
  TG.canBuildType = (s, type) => !s.allowTypes || s.allowTypes.includes(type) || !!(TG.TOWERS[type] || {}).energy;   // 書本塔不是戰鬥塔，英雄挑戰也能蓋
  // 蓋塔價格（外掛掛勾 towerCost 可改，例如每日一關「蓋塔便宜 20%」）
  TG.towerCost = (s, type) => Math.max(0, Math.round(fold("towerCost", TG.TOWERS[type].cost, type, s)));
  TG.build = function (s, slot, type) {
    const t = TG.TOWERS[type];
    if (!t || !TG.canBuildType(s, type) || s.towers.some(x => x.slot === slot) || !s.map.slots[slot] || !every("canBuildSlot", s, slot)) return null;
    const cost = TG.towerCost(s, type); if (s.gold < cost) return null;
    if (t.energy) {   // 書本塔：花能量、每關限 TG.BOOK.max 座
      if ((s.bookBuilt | 0) >= TG.BOOK.max) return null;   // 賣掉也不能再蓋（每關限 1 座）
      if (!TG.spendEnergy(s, TG.energyCost("bookTower", s), "bookTower")) return null;
      s.bookBuilt = (s.bookBuilt | 0) + 1;
    }
    s.gold -= cost;
    const [x, y] = s.map.slots[slot];
    const tw = { id: s.tid++, slot, type, lv: 1, branch: null, x, y, cd: 0, invested: cost, lockT: 0, sealT: 0 };
    s.towers.push(tw); return tw;
  };
  TG.sellValue = tw => Math.floor(tw.invested * 0.6);
  TG.sell = function (s, id) {
    const i = s.towers.findIndex(t => t.id === id); if (i < 0) return 0;
    const v = TG.sellValue(s.towers[i]); s.gold += v; s.towers.splice(i, 1); return v;
  };
  TG.needsBranch = tw => tw.lv === TG.BRANCH_LV && !tw.branch;
  TG.upgradeBlocked = (s, tw) => TG.needsBranch(tw) && !s.branchOk;
  // 升級分兩步：先付錢鎖定，答完題再結算。3→4 要帶 branch。
  // 答錯：全額退錢、這座塔鎖 WRONG_LOCK 秒（11-21 試玩後由「退一半、鎖 5 秒」改：答錯像懲罰，怕挫折的孩子就不敢升級）。
  // 同一座塔連續答錯才逐次加長（2→4→6 秒封頂），避免不扣錢之後變成「亂猜狂按」；答對就歸零。
  TG.WRONG_LOCK = 2; TG.WRONG_LOCK_MAX = 6;
  TG.wrongLock = n => Math.min(TG.WRONG_LOCK_MAX, TG.WRONG_LOCK * Math.max(1, n));
  TG.beginUpgrade = function (s, id, branch) {
    const tw = s.towers.find(t => t.id === id);
    if (!tw || tw.lv >= TG.MAX_LV || tw.lockT > 0 || tw.pending || (TG.TOWERS[tw.type] || {}).energy) return null;
    if (TG.needsBranch(tw) && (!s.branchOk || !branch)) return null;
    const free = s.freeUp, c = free ? 0 : TG.upgradeCost(tw.type, tw.lv, s); if (s.gold < c) return null;
    s.gold -= c; tw.pending = { cost: c, branch: branch || null, free: !!free }; if (free) s.freeUp = false;
    return { tower: tw, cost: c, qlv: TG.questionLevelFor(tw.lv), mastery: TG.needsBranch(tw) };
  };
  TG.finishUpgrade = function (s, id, correct, info) {
    const tw = s.towers.find(t => t.id === id); if (!tw || !tw.pending) return false;
    const p = tw.pending;
    if (correct) { tw.lv++; tw.invested += p.cost; if (p.branch) tw.branch = p.branch; tw.failN = 0; s.events.push({ k: "upgrade", tw, lv: tw.lv, branch: p.branch || null }); }   // upgrade 事件：畫面演出用（11-21 美術改版）
    else { s.gold += p.cost; tw.failN = (tw.failN || 0) + 1; tw.lockT = TG.wrongLock(tw.failN); if (p.free) s.freeUp = true; }   // 免費升級答錯也把免費券還回去
    tw.pending = null;
    s.upFail = correct ? null : tw;   // 外掛 onAnswer 可看「剛剛升級答錯的塔」（錯中學天賦）
    TG.answerResult(s, correct, Object.assign({ kind: "mcq" }, info));
    s.upFail = null;
    return correct;
  };

  // ───── 字盾、錯字哥布林、Be 巨人、時光樹妖
  TG.breakShield = function (s, eid, info) {   // v3：info（可省略）併進作答紀錄，src 固定 shield
    const e = s.enemies.find(x => x.id === eid); if (!e || !e.shield) return false;
    e.shield = false; s.gold += 12; TG.answerResult(s, true, Object.assign({ qk: null, gp: null }, info || {}, { kind: "spell", src: "shield" })); s.events.push({ k: "shield", e }); return true;
  };
  TG.fixGoblin = function (s, eid, correct, info) {
    const e = s.enemies.find(x => x.id === eid); if (!e) return false;
    TG.answerResult(s, correct, Object.assign({}, info || {}, { kind: "fix", src: "goblin" }));
    e.quizDone = true;
    if (correct) { kill(s, e, 4); return true; }
    return false;   // 11-24 第二輪（試玩小美 P2-4）：拿掉「答錯牠變快 ×1.15」——答錯不扣任何東西，哥布林照原速繼續走（只是沒秒殺）
  };
  TG.setBeAnswer = function (s, callId, answer) {
    for (const e of s.enemies) if (e.callId === callId) e.correct = e.label === answer;
  };
  // v3（合約 §3.3）：多收 info（畫面傳 TG.ansInfo(題目)＋sec 等），answerResult 帶 {kind:"mcq", src:"be", qk, gp, qid}
  TG.tapBeMinion = function (s, eid, info) {
    const e = s.enemies.find(x => x.id === eid); if (!e || !e.callId) return null;
    const group = s.enemies.filter(x => x.callId === e.callId), ai = Object.assign({}, info || {}, { kind: "mcq", src: "be" });
    if (e.correct) {
      for (const g of group) kill(s, g, 0);
      const boss = s.enemies.find(x => x.id === e.bossId);
      if (boss) hurt(s, boss, boss.maxHp * 0.12, true);
      TG.answerResult(s, true, ai); s.events.push({ k: "beOk", e }); return true;
    }
    for (const g of group) { g.spd *= 1.5; g.callId = null; }
    TG.answerResult(s, false, ai); s.events.push({ k: "beBad", e }); return false;
  };
  TG.unseal = function (s, ids, correct, info) {
    TG.answerResult(s, correct, Object.assign({}, info || {}, { kind: "mcq", src: "seal" }));
    if (correct) for (const tw of s.towers) if (ids.includes(tw.id)) tw.sealT = 0;
    return correct;
  };

  // ───── 英雄
  TG.moveHero = function (s, x, y, idx) {
    const h = s.heroes[idx || 0], n = nearOnMap(s.map, x, y);
    if (!h || n.d > 40 || h.dead > 0) return false;
    h.tx = n.x; h.ty = n.y; return true;
  };
  // v3（合約 §8.1）：TG.heroRageMax(s, idx) 有值＝大招看怒氣 h.rage；0＝舊的冷卻 ultCd（同伴、沒有 s.kn 的騎士局面都走這條）
  //   怒氣制另有全域最短間隔 TG.ULT_MIN_GAP（10 秒；卡片回怒氣再快也一樣）
  // 這一局這位英雄的怒氣上限（0＝冷卻制）。騎士外掛（mods/knight.js）會覆寫成「有 s.kn 才是怒氣制」；引擎與畫面一律問它，不看全域 def.rageMax
  TG.heroRageMax = (s, idx) => { const h = s && s.heroes && s.heroes[idx || 0]; return h ? (TG.heroDef(h).rageMax || 0) : 0; };
  TG.heroUltReady = (s, idx) => { const h = s.heroes[idx || 0]; if (!h || h.dead > 0) return false; const rm = TG.heroRageMax(s, idx); return rm ? (h.rage || 0) >= rm && s.time - (h.lastCast === undefined ? -1e9 : h.lastCast) >= TG.ULT_MIN_GAP : h.ultCd <= 0; };
  // 答題大招（相容包裝）：冷卻制＝舊行為（答對 1、答錯 0.5）；怒氣制（TG.heroRageMax 有值）＝詠唱：答對 ×TG.chantMul、答錯 ×1（不懲罰）
  TG.heroUlt = function (s, correct, idx) {
    if (!TG.heroUltReady(s, idx)) return false;
    const h = s.heroes[idx || 0], def = TG.heroDef(h);
    if (TG.heroRageMax(s, idx)) {
      TG.answerResult(s, correct, { kind: "mcq", src: "chant" });
      return TG.heroCast(s, idx, correct ? TG.chantMul(s) : 1, { tier: correct ? 2 : 1, chant: true, chantOk: !!correct });
    }
    const p = correct ? 1 : 0.5;
    h.ultCd = def.ultCd; def.ultFx(s, h, p);
    TG.answerResult(s, correct, { kind: "mcq", src: "ult" });
    s.events.push({ k: "ult", p, idx: idx || 0, id: h.id });
    if (!(idx || 0)) TG._cardEvent(s, "ult");
    return true;
  };
  // v3：不答題直接放大招（怒氣滿、詠唱完）。mul＝威力倍率（1 直接放、1.5 詠唱答對）；info 會傳給 ultFx（tier 等）。不呼叫 answerResult。
  TG.heroCast = function (s, idx, mul, info) {
    if (!TG.heroUltReady(s, idx)) return false;
    const h = s.heroes[idx || 0], def = TG.heroDef(h), p = mul === undefined ? 1 : mul;
    if (TG.heroRageMax(s, idx)) h.rage = 0; else h.ultCd = def.ultCd;
    h.lastCast = s.time;
    def.ultFx(s, h, p, info || {});
    s.events.push({ k: "ult", p, idx: idx || 0, id: h.id, cast: true, tier: (info && info.tier) || 1 });
    if (!(idx || 0) && !(info && info.echo)) TG._cardEvent(s, "ult");   // 卡片「放絕招時」（重放不觸發）
    return true;
  };
  // v3 騎士外觀進化段數 0～4（Lv5／10／15／20 換造型；art/knight-art.js 的 ART.knightStage(lv) 必須與此相同）
  TG.KNIGHT_EVO_LV = [5, 10, 15, 20];
  TG.heroEvo = h => (h && (h.id || "knight") === "knight") ? TG.KNIGHT_EVO_LV.filter(l => (h.lv || 1) >= l).length : 0;

  // ───── 召喚獸（power：句子重組表現 0.5~1.4；s.summons[id]＝召喚獸等級）
  // 外掛掛勾 canSummon(s, id) 回傳 false ＝ 現在不能召喚（例如光獨角獸每關 1 次）
  TG.canSummon = (s, id) => !!TG.SUMMONS[id] && s.summons[id] !== undefined && TG.canSpend(s, TG.energyCost("summon", s, id)) && every("canSummon", s, id);   // v3：價格一律 energyCost（卡片、外掛可改價）
  // 召喚獸目前的外觀（外掛可覆寫，例如進化後換名字與 emoji）
  TG.summonLook = (id, lv) => { const b = TG.SUMMONS[id] || { name: id, em: "❔" }; return { name: b.name, em: b.em, evolved: false }; };
  // 11-24 第二輪（試玩小美 P2-4「排句錯 2 次威力減半」像答錯加罰）：改成「排對才有全威力」的加成制，錯 2 次以上從 ×0.5 放寬到 ×0.75
  //   （召喚照樣成功、能量照樣花；排對的孩子仍然多拿 1/3 威力＝答得好有回報）。畫面字樣請改「全部排對：威力最大」，不要寫「減半」。
  TG.SUMMON_SLOPPY = 0.75;
  TG.summonPower = (words, mistakes) => Math.max(0.5, (0.6 + 0.1 * Math.min(words, 8)) * (mistakes >= 2 ? TG.SUMMON_SLOPPY : 1));
  TG.PET_LV_STEP = 0.1;   // 召喚獸每升 1 級威力 +10%（Lv10＝×1.9，進化另 ×1.5，見 creatures）
  TG.summon = function (s, id, power) {
    if (!TG.canSummon(s, id)) return false;
    // 畫面端召喚＝排句答完（answerResult 沒給 kind）馬上 summon：把那一題從選擇題答對率撤回
    const pd = s._mcqPend; if (pd && pd.t === s.time && s.acc) { s.acc.mq--; s.acc.mok -= pd.v; } s._mcqPend = null;
    TG.spendEnergy(s, TG.energyCost("summon", s, id), "summon");   // v3：能量一律經過 spendEnergy（canSummon 已確認夠）
    const lv = s.summons[id] || 1;
    power = fold("summonPower", power, id, lv, s);   // 外掛：進化倍率等
    const k = power * (1 + TG.PET_LV_STEP * (lv - 1)) * TG.powMul(s) * (1 + Math.min(TG.CARD_CAPS.allyDmg, TG.cardActive(s, "allyDmg").mul - 1));   // 卡片：召喚獸傷害（合計 +40%）
    TG.SUMMON_FX[id](s, power, lv, k);
    s.events.push({ k: "summon", id, power }); hook("onSummon", s, id, power, lv);
    TG._cardEvent(s, "summon");
    return true;
  };

  // ═════════ 內部：生怪、傷害、擊殺
  function spawnEnemy(s, type, at) {
    const b = TG.ENEMIES[type];
    let mul = s.stage ? TG.stageHpScale(s.wave) * s.hpMul : TG.hpScale(s.wave);
    if (b.boss && s.stage) mul *= 1.3;   // 魔王要撐得夠久，文法機制才發動得了
    if (type === "mini" || type === "beMinion" || type === "frog" || b.minion) mul = Math.sqrt(mul);
    if (s.stage) mul *= (s.stage.hpBoost || 1) * (TG.powerNew() ? TG.NEWCURVE_HP[s.stage.r] || 1 : 1) * (b.boss ? 1 : TG.openHpMul(s.stage, s.wave));   // 區域加成小怪也全額套用（模擬調曲線時就是這樣算的）；開局兩波減量
    if (s.stage && s.modes && s.modes.iron) mul /= TG.challengeK(s.stage);   // 11-25 挑戰性加血不套用鐵人（自己的難度表 IRON_HP）；英雄挑戰改在 modes.js 的 HEROIC_HPS 除掉
    if (s.stage) mul *= TG.powerHpMul(s) * (s.heroic ? TG.heroicWaveHp(s.stage, s.wave) : 1) * (TG.pfOn(s) ? TG.pfHpMul(s.stage) : 1);   // 先備戰再守城：答題獎勵一次拿完（能量、怒氣會溢出），依區域少一點血（對所有人一樣，不看答對率）   // 戰力加血（高手加成，不看答對率）× 英雄挑戰（11-24 拿掉低答對率下修）
    mul = fold("enemyHpMul", mul, type, s);
    const hp = Math.round(b.hp * mul);
    const r = at ? at.r : (s.rr++ % s.map.routes.length);
    const e = { id: s.eid++, type, r, d: at ? at.d : 0, hp, maxHp: hp, spd: b.spd * (s.heroic ? TG.HEROIC_SPD : 1), armor: b.armor || 0, shield: !!b.shield,
      slowF: 0, slowT: 0, frozenT: 0, word: null, mechT: b.mech ? 3 : 0 };
    const p = posOn(s.map.routes[r], e.d); e.x = p.x; e.y = p.y;
    s.enemies.push(e); s.events.push({ k: "spawn", e });
    hook("onSpawn", s, e);
    return e;
  }
  TG._spawn = spawnEnemy;
  function kill(s, e, bonus) {
    const i = s.enemies.indexOf(e); if (i < 0) return;
    s.enemies.splice(i, 1); s.kills++; s.gold += TG.ENEMIES[e.type].gold + (bonus || 0);
    s.events.push({ k: "kill", e });
    hook("onKill", s, e);
    const b = TG.ENEMIES[e.type];
    if (b.split) for (let k = 0; k < b.split; k++) spawnEnemy(s, "mini", { r: e.r, d: Math.max(0, e.d - 8 * k) });
    // 增益卡「爆裂彈藥庫」：只有塔打倒的怪會引爆（每波上限、爆炸擊殺不再引爆）
    if (dmgSrc === "tower" && !cardFxLock && s.cardBurst > 0 && s.cards) {
      const f = TG.cardActive(s, "burstAmmo").list[0];
      if (f && s.cardWave.burst < (f.perWave || 6)) { s.cardBurst--; s.cardWave.burst++; pctBlast(s, e.x, e.y, f.r || 36, f.pctOfVictim || 0.4, f.bossPct || 0.02, e, "c_burst"); }
    }
  }
  let dmgSrc = null;   // 目前這段傷害的來源（"tower"＝塔的子彈、連鎖、地雷）
  function hurt(s, e, dmg, pierce) {
    if (e.hp <= 0 || s.enemies.indexOf(e) < 0) return;
    let d = dmg - (pierce === true ? 0 : Math.max(0, e.armor - (pierce || 0)));
    d = Math.max(1, d);
    if (e.cardMarkT > 0 && !e.shield) d *= e.cardMarkMul || 1;   // 增益卡「弱點標記」（盾沒破不算）
    if (e.shield) d *= TG.SHIELD_TAKE;
    d = fold("damageTaken", d, e, s);
    if (d <= 0) return;
    e.hp -= d;
    if (e.hp <= 0) kill(s, e);
  }
  TG._kill = kill; TG._hurt = hurt;
  // 11-25 晚：飛行魔王停在城門攻城時算「落地」（e.atGate），所有塔、英雄、地雷都打得到（不然只有弓箭／魔法塔能打，城門前常常一座都沒有）
  TG.isFlying = e => !!TG.ENEMIES[e.type].fly && !e.atGate;
  function canHit(st, e) { return st.fly || !TG.isFlying(e); }
  function target(s, tw, st) {
    let best = null;
    for (const e of s.enemies) {
      if (!canHit(st, e) || H(e.x - tw.x, e.y - tw.y) > st.range || !every("targetable", e, s, tw)) continue;
      if (!best || (st.strong ? e.hp > best.hp : e.d > best.d)) best = e;
    }
    return best;
  }

  // ═════════ 每一步
  TG.update = function (s, dt) {
    if (s.over) return;
    s.time += dt; s._mcqPend = null;
    hook("beforeUpdate", s, dt);
    if (s.over) return;
    if (s.rushT > 0) s.rushT -= dt;
    const fv = s.fever;   // v3 狂熱計時（遊戲時間）
    if (s.pfStore > 0 && (s.energy || 0) < TG.ENERGY_MAX && TG.pfOn(s)) s.pfStore -= TG.addEnergy(s, Math.min(s.pfStore, TG.ENERGY_MAX - (s.energy || 0)), "answer");   // 先備戰：存著的能量自動補進能量條（都是答對換來的）
    if (fv) { if (fv.t > 0) { fv.t -= dt; if (fv.t <= 0) { fv.t = 0; fv.cd = TG.FEVER.cd; s.events.push({ k: "feverEnd", why: "time" }); } } else if (fv.cd > 0) fv.cd -= dt; }
    if (s.cardTmp && s.cardTmp.length) { for (const t of s.cardTmp) t.t -= dt; s.cardTmp = s.cardTmp.filter(t => t.t > 0); }
    if (s.waveActive && s.spawn.length) {
      s.spawnT -= dt;
      if (s.spawnT <= 0) { spawnEnemy(s, s.spawn.shift()); s.spawnT = TG.spawnGap(s.wave + (s.stage ? Math.floor(s.stage.i / 3) : 0)); }
    }
    const cardsOn = !!(s.cards && s.cards.held.length);
    for (const h of s.heroes) {
      const hs = fold("heroStats", TG.heroDef(h).stats(h.lv), h, s);
      if (cardsOn) {   // 增益卡：騎士多擋（+2 封頂）；同伴普攻（+35% 封頂）
        if (h === s.heroes[0]) hs.block += Math.min(TG.CARD_CAPS.heroBlock, TG.cardActive(s, "heroBlock").add);
        else { const c = TG.cardActive(s, "compDmg"); if (c.n) { hs.dmg *= 1 + Math.min(TG.CARD_CAPS.compDmg, c.mul - 1); hs.range += c.list.reduce((a, f) => a + (f.range || 0), 0); } }
      }
      h.st = hs; h.maxHp = hs.hp; h.blockedN = 0;
      if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) { h.hp = hs.hp; h.x = h.tx = h.home[0]; h.y = h.ty = h.home[1]; } }
      else {
        const dx = h.tx - h.x, dy = h.ty - h.y, L = H(dx, dy), stp = 75 * dt;
        if (L > stp) { h.x += dx / L * stp; h.y += dy / L * stp; } else { h.x = h.tx; h.y = h.ty; }
      }
      if (h.ultCd > 0) h.ultCd -= h !== s.heroes[0] && cardsOn ? dt / Math.max(TG.CARD_CAPS.compUltCd, TG.cardActive(s, "compUltCd").mul) : dt;   // 增益卡：同伴大招冷卻（最多 ×0.5）
      if (h.wallT > 0) h.wallT -= dt;
      h.moving = h.dead <= 0 && H(h.tx - h.x, h.ty - h.y) > 2;
    }
    for (const a of s.allies.slice()) {
      if (a.kind === "turtle") { a.t -= dt; if (a.t <= 0) s.allies.splice(s.allies.indexOf(a), 1); }
      else if (TG.ALLY_FX[a.kind] && TG.ALLY_FX[a.kind](s, a, dt) === false) s.allies.splice(s.allies.indexOf(a), 1);
    }
    // 11-24 第二輪（P2-7）：含情境題的總量到 55 點上限 → 字盾、錯字哥布林改不出題的降級版：
    //   字盾自己裂開（不能再拼字，塔照常打；不給破盾的金幣與能量）、哥布林變成一般怪（頭上不再寫「改錯！」）。畫面收到 shieldFade 可提示「題目答完了，字盾自己裂開」。
    if (TG.QBUDGET_ON && s.enemies.length) {
      const noSpell = !TG.qSituOk(s, "spell"), noFix = !TG.qSituOk(s, "fix");
      if (noSpell || noFix) for (const e of s.enemies) {
        if (noSpell && e.shield) { e.shield = false; e.shieldFade = true; s.events.push({ k: "shieldFade", e }); }
        if (noFix && TG.ENEMIES[e.type].quiz && !e.quizDone) { e.quizDone = true; e.noQuiz = true; }
      }
    }
    const enemySpdCard = cardsOn ? Math.max(TG.CARD_CAPS.enemySpd, TG.cardActive(s, "enemySpd").mul) : 1;   // 增益卡全場減速（合計最多 −25%）
    let heroTaken = 1; if (cardsOn) for (const f of TG.cardActive(s, "heal").list) if (f.taken) heroTaken *= f.taken;
    heroTaken = Math.max(TG.CARD_CAPS.heroTaken, heroTaken);
    for (const e of s.enemies.slice()) {
      if (s.enemies.indexOf(e) < 0) continue;
      const b = TG.ENEMIES[e.type];
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
      if (e.frozenT > 0) e.frozenT -= dt;
      if (e.cardMarkT > 0) e.cardMarkT -= dt;
      if (b.mech) {
        e.mechT -= dt;
        if (e.mechT <= 0) {
          if ((b.mech === "be" || b.mech === "seal") && TG.pfWaveQuiet(s) && TG.PF_BOSS) {
            // 11-25 晚：先答題守城中不出題 → 超大魔王改放「不出題」的招（原本只 mechSkip，比關卡魔王還無聊）：
            //   Be 巨人叫 TG.PF_BOSS.beN 隻普通小怪（事件 sbMech summon）；時光樹妖封 TG.PF_BOSS.sealN 座塔 sealT 秒（事件 bossSeal deg:true，可花能量 unseal 立刻解）
            const P = TG.PF_BOSS;
            if (b.mech === "be") {
              e.mechT = P.beEvery; e.pfN = (e.pfN || 0) + 1;
              for (let k = 0; k < P.beN; k++) spawnEnemy(s, P.beType, { r: e.r, d: Math.max(0, e.d - 6 - k * 10) });
              s.events.push({ k: "sbMech", e, mech: "summon", n: e.pfN, pf: true });
            } else {
              e.mechT = P.sealEvery;
              const live = shuffle(s.towers.filter(t => t.sealT <= 0 && !(TG.TOWERS[t.type] || {}).energy), s.rng);
              const ids = live.slice(0, P.sealN).map(t => { t.sealT = P.sealT; return t.id; });
              if (ids.length) { e.pfN = (e.pfN || 0) + 1; s.events.push({ k: "bossSeal", ids, id: e.pfN, eid: e.id, boss: e, deg: true, t: P.sealT, pf: true }); }
            }
          } else if ((b.mech === "be" || b.mech === "seal") && !TG.qSituOk(s, "fill")) {
            // 11-24 第二輪（試玩小華 P2-7：第 4、10 關情境題超過 55 點）：含情境題的總量到上限 → 這次機制不發動（不出題、也不封塔／不叫小怪），魔王照常走
            e.mechT = b.mech === "be" ? 15 : 18; s.events.push({ k: "mechSkip", mech: b.mech, boss: e });
          } else if (b.mech === "be") {
            e.mechT = 15; const callId = s.eid * 100 + 1, labels = shuffle(["am", "is", "are"], s.rng);
            labels.forEach((lab, k) => { const m = spawnEnemy(s, "beMinion", { r: e.r, d: Math.max(0, e.d - 6 - k * 10) }); m.label = lab; m.callId = callId; m.bossId = e.id; });
            s.events.push({ k: "beCall", callId, boss: e });
          } else if (b.mech === "seal") {
            e.mechT = 18;
            const live = shuffle(s.towers.filter(t => t.sealT <= 0), s.rng);
            const ids = live.slice(0, 2).map(t => { t.sealT = 15; return t.id; });
            if (ids.length) s.events.push({ k: "seal", ids, boss: e });
          } else {
            hook("bossMech", s, e);          // 外掛魔王：自己設定 e.mechT
            if (e.mechT <= 0) e.mechT = 15;
          }
        }
      }
      let stop = e.frozenT > 0;
      if (!b.fly && !stop) {
        for (const a of s.allies) if (a.kind === "turtle" && a.r === e.r && H(a.x - e.x, a.y - e.y) < 14) { stop = true; break; }
        if (!stop) for (const h of s.heroes) {
          if (h.dead > 0 || h.moving || TG.heroDef(h).role !== "melee" || !every("heroBlock", h, e, s)) continue;
          const near = H(h.x - e.x, h.y - e.y);
          if ((h.wallT > 0 && near <= 60) || (near <= 16 && h.blockedN < h.st.block)) {
            stop = true; h.blockedN++;
            h.hp -= b.atk * dt * Math.sqrt(s.hpMul) * (h.wallT > 0 ? 0.5 : 1) * (heroTaken !== 1 && h === s.heroes[0] ? heroTaken : 1);
            break;
          }
        }
        if (!stop && !every("enemyMove", s, e, dt)) stop = true;
      }
      if (!stop) e.d += fold("enemySpeed", e.spd * (1 - e.slowF), e, s) * enemySpdCard * dt;
      const rt = s.map.routes[e.r];
      // 11-25 魔王守城門（老闆裁示「魔王停在城門打＋降血」）：關卡魔王／超大魔王（e.sbGate，stageboss 外掛 onSpawn 設）走到終點前 TG.SB.gateD 停下，
      //   不漏進城（停的位置 TG.gateDist：各地圖選城門前塔位打得到的一點）；在城門下每 TG.gateEvery(s, e) 秒扣 1 命（城堡護盾卡、守護結界天賦各可擋 1 下），塔、英雄照常可以打。打倒才結束這一波；命扣光就輸（不會卡住）。
      const gd = e.sbGate && TG.gateDist ? rt.len - TG.gateDist(s, e) : Infinity;
      if (e.d >= gd) {
        e.d = gd;
        if (!e.atGate) { e.atGate = true; e.gateT = 0; e.armor = 0; s.events.push({ k: "sbGate", e }); }   // 攻城時盔甲打開（護甲歸 0），城門邊只有 2～3 個塔位，冰霜塔也打得痛
        e.gateT += dt;
        const every = TG.gateEvery(s, e);
        if (e.gateT >= every) {
          e.gateT -= every; let ld = 1;
          if (s.gGuard) { s.gGuard = false; ld = 0; s.events.push({ k: "gearGuard" }); }
          else if (s.castleShield > 0) { s.castleShield--; ld = 0; s.events.push({ k: "cardShield", left: s.castleShield }); }
          s.lives -= ld; s.gateHits = (s.gateHits || 0) + ld;
          s.events.push({ k: "sbGateHit", e, n: ld });
          hook("onGateHit", s, e, ld);
          if (s.lives <= 0) { s.lives = 0; s.over = true; s.events.push({ k: "over" }); return; }
        }
        const p = posOn(rt, e.d); e.x = p.x; e.y = p.y;
        continue;
      }
      if (e.d >= rt.len) {
        // 增益卡「城堡護盾」：守護結界天賦（gear 的 s.gGuard）先用；魔王只抵 1 命
        let ld = b.lifeDmg || 1;
        if (s.castleShield > 0 && !s.gGuard) { s.castleShield--; ld -= 1; s.events.push({ k: "cardShield", left: s.castleShield }); }
        s.lives -= ld; s.leaks++;
        s.enemies.splice(s.enemies.indexOf(e), 1); s.events.push({ k: "leak", e });
        hook("onLeak", s, e);
        if (s.lives <= 0) { s.lives = 0; s.over = true; s.events.push({ k: "over" }); return; }
        continue;
      }
      const p = posOn(rt, e.d); e.x = p.x; e.y = p.y;
    }
    // 英雄
    s.heroes.forEach((h, idx) => {
      if (h.dead > 0) return;
      const hs = h.st;
      if (h.hp <= 0) { h.dead = 10; h.hp = 0; s.events.push({ k: "heroDown", idx, id: h.id }); return; }
      if (h.blockedN === 0) h.hp = Math.min(hs.hp, h.hp + hs.regen * dt);
      h.cd -= dt;
      if (h.cd <= 0) {
        let tg = null;
        for (const e of s.enemies) if ((hs.fly || !TG.isFlying(e)) && H(e.x - h.x, e.y - h.y) <= hs.range && every("targetable", e, s, h) && (!tg || e.d > tg.d)) tg = e;
        let km = 1;   // 增益卡：騎士普攻（磨刀石、連擊架式；卡片合計 +50%）
        if (tg && idx === 0 && cardsOn) { const cc = s.cardCombo, hd = TG.cardActive(s, "heroDmg").mul; let p = hd - 1; if (cc && cc.n > 0) { p += cc.mul - 1; cc.n--; } km = 1 + Math.min(TG.CARD_CAPS.heroDmg, p); }
        if (tg) { h.cd = hs.cd; s.events.push({ k: "slash", x: tg.x, y: tg.y, idx, ranged: TG.heroDef(h).role === "ranged" }); hurt(s, tg, hs.dmg * km * Math.sqrt(s.hpMul), 2); }
      }
    });
    // 火狐
    for (const a of s.allies.slice()) if (a.kind === "fox") {
      a.d -= 140 * dt; const p = posOn(s.map.routes[a.r], a.d); a.x = p.x; a.y = p.y;
      for (const e of s.enemies.slice()) if (e.r === a.r && !a.hit[e.id] && Math.abs(e.d - a.d) < 16) { a.hit[e.id] = 1; hurt(s, e, a.dmg, true); }
      if (a.d <= 0) s.allies.splice(s.allies.indexOf(a), 1);
    }
    // 塔（v3：攻速＝狂熱 ×1.5 × 增益卡，合計最多 ×1.6；書本塔不攻擊）
    dmgSrc = "tower";
    for (const tw of s.towers) {
      if (tw.lockT > 0) tw.lockT -= dt;
      if (tw.sealT > 0) { tw.sealT -= dt; continue; }
      if ((TG.TOWERS[tw.type] || {}).energy) continue;
      tw.cd -= dt; if (tw.cd > 0) continue;
      let st = fold("towerStats", TG.towerStats(tw.type, tw.lv, tw.branch), tw, s);
      if (cardsOn || (s.cardTmp && s.cardTmp.length)) {
        const cm = TG.cardTowerMods(s, tw);
        if (cm.dmg !== 1 || cm.range || cm.splash !== 1) st = Object.assign({}, st, { dmg: st.dmg * cm.dmg, range: st.range + Math.min(cm.range, st.range * TG.CARD_CAPS.towerRange), splash: st.splash ? st.splash * cm.splash : 0 });
      }
      const e = target(s, tw, st);
      if (!e) continue;
      tw.cd = st.cd / TG.towerSpdMul(s, tw);
      s.events.push({ k: "shot", tw });
      if (st.mine) { s.mines.push({ x: e.x, y: e.y, r: e.r, dmg: st.dmg, splash: st.splash + 6, t: 25 }); continue; }
      if (st.chain) {
        const pts = [[tw.x, tw.y]]; let cur = e, dmg = st.dmg; const done = {};
        for (let k = 0; k < st.chain && cur; k++) {
          done[cur.id] = 1; pts.push([cur.x, cur.y]); const c = cur;
          let nx = null; for (const o of s.enemies) if (!done[o.id] && canHit(st, o) && H(o.x - c.x, o.y - c.y) < 50 && (!nx || H(o.x - c.x, o.y - c.y) < H(nx.x - c.x, nx.y - c.y))) nx = o;
          hurt(s, c, dmg, st.pierce); dmg *= 0.75; cur = nx;
        }
        s.events.push({ k: "chain", pts }); continue;
      }
      const tgs = [e];
      if (st.multi > 1) for (const o of s.enemies) { if (tgs.length >= st.multi) break; if (o !== e && canHit(st, o) && H(o.x - tw.x, o.y - tw.y) <= st.range) tgs.push(o); }
      for (const t of tgs) s.proj.push({ id: s.pid++, x: tw.x, y: tw.y, tid: t.id, tx: t.x, ty: t.y, type: tw.type, st });
    }
    // 地雷
    for (const m of s.mines.slice()) {
      m.t -= dt;
      const hit = s.enemies.find(e => e.r === m.r && !TG.isFlying(e) && H(e.x - m.x, e.y - m.y) < 10);
      if (hit) { for (const o of s.enemies.slice()) if (!TG.isFlying(o) && H(o.x - m.x, o.y - m.y) <= m.splash) hurt(s, o, m.dmg, 8); s.events.push({ k: "boom", x: m.x, y: m.y, r: m.splash, type: "cannon" }); s.mines.splice(s.mines.indexOf(m), 1); }
      else if (m.t <= 0) s.mines.splice(s.mines.indexOf(m), 1);
    }
    // 砲彈
    for (const p of s.proj.slice()) {
      const e = s.enemies.find(x => x.id === p.tid);
      if (e) { p.tx = e.x; p.ty = e.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, L = H(dx, dy), step = 300 * dt;
      if (L > step) { p.x += dx / L * step; p.y += dy / L * step; continue; }
      s.proj.splice(s.proj.indexOf(p), 1);
      const st = p.st;
      if (st.splash) {
        for (const o of s.enemies.slice()) if (H(o.x - p.tx, o.y - p.ty) <= st.splash && canHit(st, o)) {
          hurt(s, o, st.dmg, st.pierce);
          if (st.slow && s.enemies.includes(o)) { o.slowF = Math.max(o.slowF, st.slow); o.slowT = st.slowT; }
        }
        s.events.push({ k: "boom", x: p.tx, y: p.ty, r: st.splash, type: p.type });
        if (st.poly && e && s.enemies.includes(e) && !TG.ENEMIES[e.type].boss && !e.callId && e.type !== "frog" && s.rng() < st.poly) {
          s.enemies.splice(s.enemies.indexOf(e), 1); const fr = spawnEnemy(s, "frog", { r: e.r, d: e.d }); s.events.push({ k: "poly", e: fr });
        }
      } else if (e && s.enemies.includes(e)) {
        hurt(s, e, st.dmg, st.pierce);
        if (s.enemies.includes(e)) {
          if (st.freeze) e.frozenT = TG.ENEMIES[e.type].boss ? st.freeze * 0.3 : st.freeze;
          else if (st.slow) { e.slowF = Math.max(e.slowF, st.slow); e.slowT = st.slowT; }
        }
      }
    }
    dmgSrc = null;
    hook("afterUpdate", s, dt);
    if (s.over) return;
    if (s.waveActive && !s.spawn.length && !s.enemies.length) {
      s.waveActive = false; const bonus = 20 + 5 * s.wave; s.gold += bonus; s.events.push({ k: "clear", bonus });
      TG._cardsWaveEnd(s);   // 本波卡到期
      if (s.stage && s.wave >= s.maxWave) { s.won = true; s.over = true; s.events.push({ k: "win", stars: TG.starsFor(s.lives, s) }); }
    }
  };

  // ═════════ 題目
  // ctx（可省略）：{ up: 要不要有機會抽高一級, all: 全題庫 }。省略時 up 看目前這一局（最近一次 newGame）的答對率、
  // all 用瀏覽器全域的 QDB（questions_db.js 的 const QDB 不在 window 上，要直接用名字取）——畫面端不用改呼叫方式就有效果。
  // 高一級找不到題就照舊。
  TG.liveGame = null;
  // ───── v3 題型（合約 §1；欄位見 _research/題庫擴充規格 §2.1）：q.k 省略＝fill（挖空選擇）。
  // 用途 use → 允許的題型；第 1 期只有 fill（第 4 組讓 makeFix／makeOrder 認得手寫題後再把 fix／order 加進去；第 2 期新題型要題卡也會畫才加）
  TG.QK_ALL = ["fill", "fill2", "fix", "order", "trans", "dlg", "trf", "sit"];
  TG.kindOf = q => (q && q.k) || "fill";
  TG.QK_USE = { choice: ["fill"], camp: ["fill"], fix: ["fill"], order: ["fill"], word: ["fill"], be: ["fill"] };
  TG.kindOk = (q, use) => (TG.QK_USE[use] || TG.QK_USE.choice).includes(TG.kindOf(q));
  TG.questionFor = (src, use, ctx) => { ctx = ctx || {}; return TG.pickQuestion(src, ctx.lv === undefined ? null : ctx.lv, ctx.rng || Math.random, ctx.wrong, ctx.recent, Object.assign({}, ctx, { use: use || "choice" })); };
  const globalQDB = () => { try { if (typeof QDB !== "undefined" && Array.isArray(QDB)) return QDB; } catch (e) {} return Array.isArray(root.QDB) ? root.QDB : null; };
  // 11-22：高一級改成「先照常挑一題，再換成更難的一題」（TG.harderOf）。原本的 harderPool 只看題池裡最高等級＋1 的同文法點題，
  //   多數關卡題池已含該文法點最高級 → 是空的，高手與英雄挑戰其實都沒遇到更難的題（模擬試玩小華）。
  TG.pickQuestion = function (QDB, lv, rng, wrong, recent, ctx) {
    wrong = wrong || {}; recent = recent || []; ctx = ctx || {};
    const up = ctx.up !== undefined ? !!ctx.up : TG.accUp(TG.liveGame);
    const heroic = ctx.heroic !== undefined ? !!ctx.heroic : !!(TG.liveGame && TG.liveGame.heroic);
    const raw = lv === null ? QDB : QDB.filter(q => q.lv === lv), use = ctx.use || "choice";
    const kf = raw.filter(q => TG.kindOk(q, use)), src = kf.length ? kf : raw;   // v3 題型過濾（篩完是空的就退回原題池，避免當機）
    const pool = src.filter(q => !recent.includes(q.id));
    const base = pool.length ? pool : src;
    const ws = base.map(q => (wrong[q.id] ? 5 : 1) * (q.id[0] === "o" ? 1.5 : 1));
    let r = rng() * ws.reduce((a, b) => a + b, 0), pick = base[base.length - 1];
    for (let i = 0; i < base.length; i++) { r -= ws[i]; if (r <= 0) { pick = base[i]; break; } }
    // 英雄挑戰：每題都換高一級；答對率 >85%：UP_CHANCE 機率換高一級。錯題本的題（wrong）不換，讓孩子複習原題
    if (pick && !wrong[pick.id] && (heroic || (up && rng() < TG.UP_CHANCE))) {
      const all = ctx.all || globalQDB() || QDB;
      // 題池全是短句（詞彈）時，換的題也要是短句
      const keep = TG.wbShort && src.length && src.every(TG.wbShort) ? TG.wbShort : null;
      const h = TG.harderOf(pick, all, rng, recent, { keep, use, stage: ctx.stage !== undefined ? ctx.stage : (TG.liveGame && TG.liveGame.stage) });
      if (h) return h;
    }
    return pick;
  };
  const choiceOk = q => !!q && typeof q.q === "string" && q.q.includes("___") && Array.isArray(q.o) && q.o.length >= 2;
  // 比 q 難的一題：① 同文法點（原創題＝原創題）高一級 → ② 後面關卡（同區域下一關優先）的文法點、等級 ≥ q（優先更高級）→ ③ 任何文法點高一級；都沒有回傳 null
  TG.HARDER_LATER_FROM = 2;   // 第 3 區起，高一級題才可以借後面關卡的文法點
  TG.harderOf = function (q, all, rng, recent, o) {
    if (!q || !all || !all.length) return null;
    o = o || {}; recent = recent || [];
    const ok = x => x.id !== q.id && choiceOk(x) && TG.kindOk(x, o.use || "choice") && (!o.keep || o.keep(x));
    const choose = list => { list = list.filter(ok); if (!list.length) return null; const f = list.filter(x => !recent.includes(x.id)), L = f.length ? f : list; return L[Math.floor(rng() * L.length)]; };
    const orig = q.id && q.id[0] === "o";
    let h = choose(all.filter(x => x.lv === q.lv + 1 && (orig ? x.id[0] === "o" : (q.gp && x.gp === q.gp))));
    if (h) return h;
    const st = o.stage;
    // 11-24 第二輪（C 組交接：第 5 關換到第 6 關的過去式題）：第 1～2 區（區域序號 < HARDER_LATER_FROM）不往後面關卡拿題，
    //   也不從任意文法點拿；只換「到這一關為止學過的文法點」高一級（沒有就不換，照原題出）
    if (st && TG.STAGES[st.i] === st && st.r < TG.HARDER_LATER_FROM) {
      const seen = new Set(); for (let j = 0; j <= st.i; j++) for (const g of TG.STAGES[j].gps) seen.add(g);
      return choose(all.filter(x => x.lv === q.lv + 1 && x.gp && seen.has(x.gp)));
    }
    if (st && TG.STAGES[st.i] === st) {
      const mine = new Set(st.gps);
      for (let j = st.i + 1; j < TG.STAGES.length && !h; j++) {
        const P = TG.stagePool(all, TG.STAGES[j]).filter(x => !(x.gp && mine.has(x.gp)));
        h = choose(P.filter(x => x.lv > q.lv)) || choose(P.filter(x => x.lv === q.lv));
      }
      if (h) return h;
    }
    return choose(all.filter(x => x.lv === q.lv + 1));
  };
  // 同一個文法點（原創題＝原創題）高一級的題目，隨機挑一題（避開 recent）；沒有回傳 null
  TG.bumpQuestion = function (q, all, rng, recent) {
    if (!q || !all || !all.length) return null;
    const orig = q.id && q.id[0] === "o";
    const c = all.filter(x => x.lv === q.lv + 1 && (orig ? x.id[0] === "o" : (q.gp && x.gp === q.gp)));
    const fresh = c.filter(x => !(recent || []).includes(x.id)), list = fresh.length ? fresh : c;
    return list.length ? list[Math.floor(rng() * list.length)] : null;
  };
  // 高一級題池：src（lv 不是 null 時只看該級）裡出現的文法點（原創題看「原創」），在 all 裡找等級＝最高等級＋1 的題；找不到回傳 []
  TG.harderPool = function (src, all, lv) {
    const base = lv === null || lv === undefined ? src : src.filter(q => q.lv === lv);
    if (!base.length) return [];
    const top = Math.max(...base.map(q => q.lv)), gps = new Set(base.filter(q => q.gp).map(q => q.gp)), orig = base.some(q => q.id[0] === "o");
    return all.filter(q => q.lv === top + 1 && ((q.gp && gps.has(q.gp)) || (orig && q.id[0] === "o")));
  };
  TG.shuffleOptions = (q, rng) => shuffle(q.o.map((t, i) => ({ t, ok: i === 0 })), rng);
  const TOK = /[A-Za-z0-9']+|[^\sA-Za-z0-9']/g;
  // 改錯題：把一個干擾選項放回空格，變成錯的句子；bad＝錯字在 tokens 裡的位置
  TG.makeFix = function (q, rng) {
    const ds = q.o.slice(1), wrong = ds[Math.floor(rng() * ds.length)];
    const [a, b] = q.q.split("___");
    const pre = a.match(TOK) || [], mid = wrong.match(TOK) || [], post = b.match(TOK) || [];
    return { tokens: pre.concat(mid, post), bad: mid.map((_, i) => pre.length + i), wrong, right: q.o[0], full: a + q.o[0] + b };
  };
  // 句子重組：正解句子切字後打亂（句尾標點固定）
  // 字塊（shuffled）裡的句首字改成小寫：原本「唯一大寫的字＝第一個字」等於送提示（11-21 試玩 P1-9）。
  // I、I'm 與專有名詞保留大寫：原句其他位置也大寫的同一個字、或 PROPER 名單（人名、地名、星期、月份）。
  // words／full 維持原句寫法（答完顯示整句用）；畫面比對一律 toLowerCase，所以不影響判對。
  TG.PROPER = new Set(("tom mary john ken jack mike amy tony lisa linda sam ben bob tim anna emma david peter paul kate lucy nick alice jane joe jim " +
    "sara sarah mr mrs ms dr taiwan taipei japan china america english chinese french london paris tokyo boston australia canada france germany korea " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december christmas god").split(" "));
  TG.tileCase = function (w, words) {
    if (!/^[A-Z]/.test(w)) return w;
    const bare = x => x.replace(/[^A-Za-z']/g, "");
    if (/^I('|$)/.test(bare(w))) return w;
    const lw = bare(w).toLowerCase().replace(/'.*$/, "");
    if (words.some((x, j) => j > 0 && /^[A-Z]/.test(x) && bare(x).toLowerCase().replace(/'.*$/, "") === lw)) return w;
    if (TG.PROPER.has(lw) && lw !== "may") return w;   // May 當句首多半是助動詞
    return w[0].toLowerCase() + w.slice(1);
  };
  TG.makeOrder = function (q, rng) {
    const full = q.q.replace("___", q.o[0]);
    const m = full.match(/^(.*?)([.?!]*)$/);
    const words = m[1].split(/\s+/).filter(Boolean);
    let sh, tries = 0;
    do { sh = shuffle(words.slice(), rng); } while (sh.join(" ") === words.join(" ") && tries++ < 10);
    const tile = TG.tileCase(words[0], words);
    if (tile !== words[0]) { const i = sh.indexOf(words[0]); if (i >= 0) sh[i] = tile; }
    return { words, shuffled: sh, tail: m[2], full };
  };
  TG.orderable = q => { if (!TG.kindOk(q, "order")) return false; const w = q.q.replace("___", q.o[0]).split(/\s+/); return w.length >= 4 && w.length <= 8 && new Set(w.map(x => x.toLowerCase())).size === w.length; };

  // ═════════ 單字（字盾）
  TG.cleanPool = (WORDS, level) => WORDS.filter(w => /^[a-z]+$/.test(w.word) && w.word.length >= 3 && w.word.length <= 9 && w.level <= level);
  TG.wordForWave = function (pool, wave, rng, mistakes) {
    const minL = Math.min(3 + Math.floor((wave - 1) / 4), 6), maxL = minL + 3;
    const cand = pool.filter(w => w.word.length >= minL && w.word.length <= maxL);
    const list = cand.length ? cand : pool;
    const miss = mistakes ? list.filter(w => mistakes[w.word]) : [];
    if (miss.length && rng() < 0.4) return miss[Math.floor(rng() * miss.length)];
    return list[Math.floor(rng() * list.length)];
  };
  TG.makeTiles = function (word, rng, decoys) {
    const letters = word.split(""), abc = "etaoinshrdlucmwfgypbvk";
    for (let i = 0; i < decoys; i++) letters.push(abc[Math.floor(rng() * abc.length)]);
    return shuffle(letters, rng).map((ch, id) => ({ id, ch, used: false }));
  };
  TG.press = function (word, idx, ch) {
    ch = String(ch).toLowerCase();
    if (word[idx] !== ch) return { res: "wrong", idx };
    idx++; return { res: idx >= word.length ? "done" : "ok", idx };
  };

  TG.mulberry = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  if (typeof module !== "undefined" && module.exports) module.exports = TG; else root.TG = TG;
})(typeof window !== "undefined" ? window : globalThis);
