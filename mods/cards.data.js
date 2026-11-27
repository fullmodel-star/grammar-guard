// 增益卡（營地抽卡）資料：由 node _data/gen_data.mjs 從 _data/cards_v3.json 產生，勿手改（格式見 mods/CONTRACT_v3.md）
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  if (!TG) return;
  TG.DATA_CARDS = {
 "ver": 1,
 "rarity": {
  "common": {
   "name": "普通",
   "w": 65
  },
  "rare": {
   "name": "稀有",
   "w": 30
  },
  "legend": {
   "name": "傳說",
   "w": 5
  }
 },
 "pity": {
  "legendPlusPerCommon": 0.02,
  "unit": "hand",
  "cap": 0.15,
  "reset": "legendShown",
  "persist": true,
  "note": "建議解讀：每『一手』沒有傳說就 +2%（不是每格），上限 15%（11-23 第 7 步平衡由 25% 下修），出現傳說就重置；理由與模擬見 rules.rarity.whyPerHand"
 },
 "factions": {
  "guard": {
   "name": "守護",
   "color": "#7fb3d8",
   "desc": "騎士、城堡、岩龜"
  },
  "flame": {
   "name": "烈焰",
   "color": "#e0704a",
   "desc": "火狐、砲塔、升級工坊"
  },
  "thunder": {
   "name": "雷鳴",
   "color": "#f2c14e",
   "desc": "雷狼、魔法塔、能量狂熱"
  },
  "frost": {
   "name": "冰霜",
   "color": "#9bd4ff",
   "desc": "冰塔、冰鳳、冷靜答題"
  }
 },
 "meta": {
  "title": "文法片語守衛戰 v3 備戰營地增益卡",
  "date": "2026-11-22",
  "doc": "_research/增益卡設計_2026-11-22.md",
  "format": "mods/CONTRACT_v3.md §7.2（合約欄位）＋擴充欄位（引擎可忽略）",
  "extFields": {
   "text": "完整規則（說明頁、卡冊用；卡面只顯示 desc）",
   "link": "這張卡綁什麼：answer（答對）| energy（花能量）| fever（狂熱）| rage（怒氣，只靠答題與擋怪）| none（立即或本波的小加成）",
   "caps": "受哪幾條封頂（見 caps）",
   "evo": "進化版（選滿 3 次後替換 name／desc／fx；null＝沒有進化）",
   "art": "給美術的圖示描述",
   "phase": "建議實作批次：1＝只用 7.3 表的 op 或通用 custom（perCorrect／onEvent）；2＝要動召喚獸內部、書本塔、qbus 題目等級",
   "req 擴充鍵": "summon（要帶這隻召喚獸）、summons（至少帶幾隻）、companion（隊伍要有同伴）、wrongBook（本關錯題本可出題數 ≥）、secondChance（這個模式有第二次機會）、notHeroic（不是英雄挑戰）",
   "fx 擴充參數": "gold.perRegion（每多一區加多少）、towerDmg.branch:'any'（任一分支）、onHit 的 icd／bossMul",
   "plain": "卡面白話說明（第二輪試玩 P1-18：看得到的效果，不寫數值；數值 desc 收進「看詳細數值」）"
  },
  "counts": {
   "total": 53,
   "base": 45,
   "duo": 8,
   "evo": 37,
   "byFaction": {
    "guard": {
     "common": 5,
     "rare": 5,
     "legend": 2,
     "total": 12
    },
    "flame": {
     "common": 5,
     "rare": 4,
     "legend": 2,
     "total": 11
    },
    "thunder": {
     "common": 6,
     "rare": 3,
     "legend": 2,
     "total": 11
    },
    "frost": {
     "common": 5,
     "rare": 4,
     "legend": 2,
     "total": 11
    }
   }
  }
 },
 "rules": {
  "draw": {
   "pick": {
    "ok": 3,
    "retryOk": 3,
    "wrong": 2,
    "note": "營地題第一次或第二次機會答對＝三選一；兩次都錯＝二選一（同樣的稀有度與保底，不懲罰）"
   },
   "maxDrawPerStage": 3,
   "flagWaves": {
    "5": [
     2,
     4,
     5
    ],
    "6": [
     2,
     4,
     6
    ],
    "7": [
     3,
     5,
     7
    ],
    "8": [
     3,
     6,
     8
    ],
    "note": "建議值：在這些波開打前的營地抽卡（＝旗子波），其他營地只出 1 題。要讓組合卡出得來，一關一定要有 3 次抽卡；只給 2 次的話組合卡永遠不會出現。第 1 關第 1 波前沒有營地。"
   },
   "longMax": 2,
   "longNote": "本關卡（dur:stage）同時最多 2 張；已有 2 張時，手牌不出本關卡（立即、本波卡照出）",
   "noDupInHand": true,
   "heldStageCardNotOffered": true,
   "maxPerCard": "看每張卡的 max（省略＝1）；本關卡一律 1",
   "factionWeight": {
    "held": 1.5,
    "partner": 3,
    "note": "本關拿過某派的卡 → 該派其他卡權重 ×1.5（最多兩派）；本關已拿某張組合卡的其中一張 → 另一張權重 ×3（讓組合卡追得到）"
   },
   "reqCheckTaken": "req.all 看「本關拿過的卡」（含已過期的本波卡、已用掉的立即卡），不是只看目前生效中的",
   "downgradeIfEmpty": "某稀有度沒有可出的卡就降一級（傳說→稀有→普通），保底照實際出的稀有度算",
   "tutorial": {
    "firstCampEver": [
     "c_battery",
     "c_reload",
     "c_headband"
    ],
    "note": "存檔第一次進營地固定這三張（能量、塔、騎士各一），教玩家看卡面"
   }
  },
  "rarity": {
   "slots": "非傳說的格子各自擲：普通 65：稀有 30（約 68%：32%）",
   "legendPerHand": "每一手（一次三選一或二選一）先擲一次「有沒有傳說」：機率 L＝5%＋保底；有就其中 1 格是傳說；一手最多 1 張傳說",
   "pity": "這一手沒有出現傳說（＝抽到的都是普通／稀有）→ 下一手 L +2%；出現傳說就重置回 5%；L 最高 15%（11-23 平衡下修）",
   "persist": "保底跨關保留（存檔 S.mods.camp.pity，由 ① 決定欄位名），換關不歸零",
   "bossLast": "魔王關最後一次抽卡保證 1 張傳說（之後保底重置）",
   "whyPerHand": "照合約字面『每張普通 +2%』逐格累加的話，傳說會在 74%～84% 的關卡出現（每關看到約 10 格），失去稀有感；改成每手擲一次，約一半的關卡看到 1 張傳說，答對率 40% 和 90% 的差距只有 45%：50%（見設計文件 §3.3 模擬）"
  },
  "reroll": {
   "perCamp": 1,
   "how": "自願多答 1 題（src:campReroll，吃題量預算；預算用完就不能重抽）。答對（第一或第二次機會）→ 換一手全新的 3 張（不含剛剛那幾張）；答錯 → 保留原本那手，什麼都不扣",
   "pity": "重抽的那一手一樣擲傳說、一樣算保底"
  },
  "skip": {
   "energy": 2,
   "overflowGold": 10,
   "note": "三張都不要 → 能量 +2（滿了每格換 10 金幣）"
  },
  "duo": {
   "appear": "本關拿過 req.all 的兩張 → 下一次抽卡保證有 1 格換成這張組合卡（不參加一般稀有度抽選、不影響保底）；同時符合兩張組合卡就隨機一張",
   "perStage": 1,
   "note": "組合卡實際上幾乎都在第 3 次抽卡（最後一波前）出現，所以 dur 用 wave（＝最後一波），不佔本關卡名額"
  },
  "evolution": {
   "need": 3,
   "how": "卡冊記錄每張卡「被選走」的總次數（跨關、存檔 S.mods.camp.picks[id]）；滿 3 次之後，這張卡再出現時一律是進化版（evo：換 name／desc／fx，稀有度與有效期不變）",
   "exclude": "傳說卡與組合卡沒有進化版",
   "note": "進化只看選卡次數不看答對率，答錯拿二選一的孩子一樣會進化；進化版數值仍受封頂表限制"
  },
  "modes": {
   "endless": "營地每 2 波一次、每次都抽卡（不受每關 3 次限制）；本關卡改成之後 5 波（endless.dur），同時最多 2 張；組合卡 3 波",
   "heroic": "營地題限時 12 秒；c_retry、c_challenge 不出現",
   "iron": "沒有第二次機會 → c_retry 不出現；c_challenge 的題不算錯題",
   "trialFire": "試煉之火「營地只給二選一」→ pick 一律 2（重抽也是 2）",
   "knightTrial": "騎士試煉：營地二選一",
   "practice": "練習模式、守護之光照常抽卡（它們減的是怪血／城堡傷害，和卡片不同類，可以並存）"
  },
  "globalRules": [
   "本關卡（dur:stage）一定要綁答題、能量、狂熱或怒氣（link 不能是 none）",
   "卡片效果只存在這一關（或無盡的 N 波），不存檔、不帶到下一關",
   "卡片不可以讓答錯扣任何東西；答錯最多只是『這題沒有額外獎勵』",
   "兩次騎士絕招之間至少 10 秒（卡片造成的怒氣回補再快也一樣）",
   "狂熱冷卻 20 秒任何卡片都不能縮短",
   "百分比傷害、爆炸造成的擊殺不會再觸發其他百分比傷害卡（不連鎖）",
   "所有加成照 caps 封頂表夾住"
  ]
 },
 "caps": {
  "tower_dmg": {
   "name": "塔傷害",
   "card": "+20%",
   "total": "+20%（目前只有卡片加塔傷害；11-23 第 7 步平衡由 25% 下修）",
   "how": "卡片的塔傷害全部相加後封頂"
  },
  "tower_atkspd": {
   "name": "塔攻速",
   "card": "+30%",
   "total": "×1.6（含狂熱 ×1.5）",
   "how": "卡片相加；再和狂熱相乘；最後夾到 ×1.6"
  },
  "tower_range": {
   "name": "塔射程",
   "card": "+10%",
   "total": "+15%（含鷹眼 +5%）",
   "how": "加值換算成百分比後封頂；地形縮減另外乘"
  },
  "tower_splash": {
   "name": "爆炸範圍",
   "card": "+30%",
   "total": "+30%",
   "how": ""
  },
  "damage_taken": {
   "name": "怪受到傷害",
   "card": "+25%",
   "total": "+25%",
   "how": "標記、岩龜等相加；對還沒破盾的字盾騎士／魔龍無效（盾要靠拼字）"
  },
  "knight_dmg": {
   "name": "騎士普攻",
   "card": "+50%",
   "total": "卡片＋技能樹 +80%；時態之劍 ×2 另乘",
   "how": "時態之劍與連擊匕首同在武器格，不會同時裝"
  },
  "knight_taken": {
   "name": "騎士受傷",
   "card": "×0.7",
   "total": "最低 ×0.3（含文法盔甲、技能樹）",
   "how": "相乘後夾住"
  },
  "knight_block": {
   "name": "騎士擋怪",
   "card": "+2",
   "total": "+3（含技能樹）",
   "how": ""
  },
  "chant_mul": {
   "name": "詠唱倍率",
   "card": "+0.3",
   "total": "×2.0",
   "how": "和技能樹詠唱加成相加"
  },
  "rage_per_answer": {
   "name": "每題怒氣",
   "card": "-",
   "total": "35",
   "how": "基本 20（第二次 10）× 狂熱 × 卡片，加上卡片加值後夾到 35"
  },
  "rage_instant": {
   "name": "立即怒氣",
   "card": "+50",
   "total": "怒氣上限 100，溢出不保留",
   "how": ""
  },
  "rage_loop": {
   "name": "絕招回怒氣",
   "card": "30",
   "total": "30（取最大、不相加）",
   "how": "兩次絕招至少相隔 10 秒（全域規則）"
  },
  "ult_echo": {
   "name": "絕招重放",
   "card": "2 次",
   "total": "2 次",
   "how": "重放不觸發其他放絕招卡"
  },
  "energy_per_answer": {
   "name": "每題能量",
   "card": "+2",
   "total": "5",
   "how": "基本 2＋秒答＋狂熱＋書本塔＋復仇＋卡片（含每 N 題獎勵）相加後夾到 5"
  },
  "energy_instant": {
   "name": "立即能量",
   "card": "+5",
   "total": "能量上限 12，溢出每格 10 金幣",
   "how": ""
  },
  "summon_cost": {
   "name": "召喚費用",
   "card": "−3",
   "total": "最低 3（能量回流退 1 後實付 2）",
   "how": "減價取一種最便宜的算法，不相加超過 −3"
  },
  "summon_power": {
   "name": "召喚威力",
   "card": "+40%",
   "total": "卡片 +40% × 進化 ×1.5",
   "how": "靈獸覺醒＝暫時進化（算進化那一格，不算卡片格）"
  },
  "comp_dmg": {
   "name": "同伴普攻",
   "card": "+35%",
   "total": "+35%",
   "how": ""
  },
  "comp_ult_cd": {
   "name": "同伴大招冷卻",
   "card": "每波最多 −15 秒或 ×0.5",
   "total": "同左",
   "how": ""
  },
  "enemy_slow": {
   "name": "全場減速",
   "card": "−25%",
   "total": "怪速最低原速 30%（凍住不算）",
   "how": "和冰塔、冰鳳減速相乘後夾住"
  },
  "freeze": {
   "name": "凍結",
   "card": "0.4 秒",
   "total": "魔王 ×0.3；同一隻 3 秒內 1 次",
   "how": ""
  },
  "lives": {
   "name": "城堡護盾",
   "card": "同時 2 層",
   "total": "守護結界＋2 層；魔王只抵 1 命",
   "how": "卡片不直接補命"
  },
  "gold": {
   "name": "金幣",
   "card": "立即 ≤126／每題 ≤6",
   "total": "-",
   "how": "金幣只能蓋 1 級塔與付升級金幣部分"
  },
  "fever": {
   "name": "狂熱",
   "card": "門檻最低 4、最長 16 秒／4 題",
   "total": "冷卻 20 秒卡片永遠不能改",
   "how": ""
  },
  "upgrade_discount": {
   "name": "升級省能量",
   "card": "每次 −1；免費券同時 2 張",
   "total": "最少 1（免費券除外）",
   "how": "先用免費券；否則減 1 再狂熱半價、無條件進位"
  },
  "pct_hp": {
   "name": "百分比傷害",
   "card": "非魔王 ≤40%／次；魔王 ≤2%／次",
   "total": "每張卡有每波次數上限",
   "how": "百分比傷害打倒的怪不會再觸發別張百分比卡"
  }
 },
 "customOps": {
  "perCorrect": "每答對 1 題（try 1 或 2，所有 src；營地抽卡題本身不算）計數：有 stack＝每題疊 step 到 max（op 為 towerDmg 等倍率類）；有 every＋give＝每累積 every 題套用一次 give（子效果用 7.3 的立即類 op）；maxTimes＝本關最多觸發次數",
  "onEvent": "on＝ult（騎士放絕招，重放不算）| fever（狂熱開始）| summon（召喚完成，含免費召喚）；give＝子效果陣列，可帶 t（秒，遊戲時間）、near（以騎士為圓心的半徑）",
  "heal": "騎士回滿血（full）、倒下中立刻復活（revive）；taken＝本波受傷倍率",
  "chantMul": "詠唱答對倍率加值（TG.KNIGHT.CHANT.mul＋add，總倍率封頂 2.0）",
  "comboHits": "答對時把騎士『強化普攻次數』設為 hits（不累加），每次普攻用掉 1 次、傷害 ×mul",
  "turtleBoost": "本波岩龜持續時間 ×durMul；被岩龜擋住的怪受傷 ×blockedTaken（盾未破除外）",
  "ultEcho": "接下來 n 次絕招放完後再放一次（威力 mul、不吃詠唱、不觸發 onEvent ult）",
  "towerSplash": "魔法／奧術／砲塔／地雷爆炸半徑 ×mul；可帶 slow、slowT（取較大值，不疊加）",
  "branchPerk": "分支特色加值（見 c_branch 進化版說明）",
  "foxTrail": "火狐經過的位置留火焰 t 秒，地面怪每秒受火狐衝撞傷害 × dpsPct",
  "burstAmmo": "每答對 every 題存 1 顆（上限 store）；塔投射物打倒非魔王怪時引爆：半徑 r 內其他非魔王怪受 victim.maxHp × pctOfVictim，魔王受自身 maxHp × bossPct；每波 perWave 次；爆炸擊殺不再引爆",
  "tempEvolve": "召喚時視為進化（summonPower ×mul、冰鳳／獨角獸走進化分支）；已進化的改 ×ifEvolved",
  "compDmg": "同伴普攻傷害 ×mul、射程 +range（heroStats 對 COMP.ids）",
  "feverLen": "本波狂熱 dur 秒、maxQ 題（只改長度，不改冷卻與效果）",
  "feverRage": "狂熱中每答對多 add 怒氣（受每題 35 上限）",
  "wolfChain": "雷狼連鎖數 +extra；打到的飛行怪減速 flySlow、flySlowT 秒",
  "mark": "答對時標記塔射程內 hp 最高的 n 隻（跳過有盾的）t 秒：damageTaken ×mul（魔王 ×bossMul）",
  "feverVolley": "狂熱開始時所有塔 cd＝0；狂熱期間攻速 ×mul（受 tower_atkspd 上限）",
  "doubleSummon": "下一次花能量召喚時，另外免費召喚 1 隻其他帶進關的召喚獸（威力 ×mul，exclude 除外）",
  "revealInvis": "本波隱形刺客進入任何塔射程即可被瞄準",
  "energyGain": "改特定來源的能量：src＝revenge（復仇題額外能量 +add）| retry（第二次機會答對能量 set）；rage＝另給怒氣",
  "summonIfRecent": "召喚時若前 window 秒內答對 ≥ need 題，威力 ×mul",
  "bookTower": "書本塔每答對 +1 能量的次數上限改 cap；蓋塔費用改 cost；已蓋好的退 refund 能量（不超過當初花的）",
  "harderQ": "本波側邊面板題目用 TG.harderOf 高一級；答對多 energy 能量、rage 怒氣；starExclude＝不進三星答對率與鐵人錯題（對錯都不進）",
  "phoenixBoost": "本波冰鳳減速時間 +addT、減速幅度 +addSlow（上限仍 0.6）",
  "feverBlessing": "狂熱開始時全場怪速 ×slow（魔王 ×bossSlow）t 秒，騎士怒氣 +rage",
  "grammarShock": "每累積答對 every 題：場上非魔王怪受 maxHp × pct、魔王 × bossPct；每波 perWave 次，超過不保留",
  "ultFortress": "騎士放絕招時半徑 r 內塔 cd＝0、t 秒內傷害 ×towerDmg；騎士 t 秒內受傷 ×heroTaken",
  "bookCannon": "每答對 1 題，書本塔射 1 發：最強塔單發傷害 ×mul，半徑 splash 受 ×splashMul，可打飛行",
  "ultSummon": "存 n 次：騎士放絕招時免費召喚本關上一次叫的召喚獸（威力 ×mul；exclude 除外；不觸發能量回流）",
  "feverSummonHalf": "狂熱中召喚費用 ÷2 無條件進位、最低 floor；和其他減價取最便宜",
  "chantReward": "詠唱答對 +energy 能量；絕招後回 ultRefund 怒氣（和不滅鬥志取大）",
  "wolfFreeze": "雷狼閃電命中的怪凍 t 秒（魔王 ×bossMul），同一隻 icd 秒內 1 次",
  "compCdEveryN": "每累積答對 every 題，所有同伴大招冷卻 −sec 秒；每波最多 −perWave 秒"
 },
 "cards": [
  {
   "id": "c_headband",
   "name": "熱血頭帶",
   "desc": "本波怒氣獲得 ×1.5",
   "rarity": "common",
   "faction": "guard",
   "dur": "wave",
   "fx": [
    {
     "op": "rageGain",
     "mul": 1.5
    }
   ],
   "max": 2,
   "link": "answer",
   "caps": [
    "rage_per_answer"
   ],
   "text": "本波騎士得到的怒氣 ×1.5（答對 20→30、第二次機會 10→15、擋怪每秒 1→1.5，擋怪本波上限仍是 15）。和狂熱 ×1.5 相乘後，每題怒氣最多 35。",
   "evo": {
    "name": "燃燒頭帶",
    "desc": "本波怒氣獲得 ×1.7",
    "fx": [
     {
      "op": "rageGain",
      "mul": 1.7
     }
    ],
    "text": "本波怒氣 ×1.7（每題仍最多 35）。",
    "plain": "怒氣漲得超快"
   },
   "icon": "headband",
   "art": "紅色頭帶在風中飄動，額頭位置冒出一小團火焰；紅底。",
   "phase": 1,
   "plain": "怒氣漲得更快"
  },
  {
   "id": "c_whetstone",
   "name": "磨刀石",
   "desc": "本波騎士攻擊 +25%",
   "rarity": "common",
   "faction": "guard",
   "dur": "wave",
   "fx": [
    {
     "op": "heroDmg",
     "mul": 1.25
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "knight_dmg"
   ],
   "text": "本波文法騎士的普攻傷害 +25%（不影響絕招）。",
   "evo": {
    "name": "精鋼磨刀石",
    "desc": "本波騎士攻擊 +35%",
    "fx": [
     {
      "op": "heroDmg",
      "mul": 1.35
     }
    ],
    "text": "本波騎士普攻傷害 +35%。",
    "plain": "騎士砍得超痛"
   },
   "icon": "whetstone",
   "art": "騎士的長劍在發光的灰色磨刀石上擦出一串橘色火花。",
   "phase": 1,
   "plain": "騎士砍得更痛"
  },
  {
   "id": "c_soup",
   "name": "熱湯補給",
   "desc": "騎士回滿血、受傷−20%",
   "rarity": "common",
   "faction": "guard",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "heal",
     "full": true,
     "revive": true,
     "taken": 0.8
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "knight_taken"
   ],
   "text": "騎士立刻回滿血（倒下中就立刻在原地復活）；本波騎士受到的傷害 ×0.8。和文法盔甲、技能樹減傷相乘，最低只受 30%。",
   "evo": {
    "name": "媽媽的熱湯",
    "desc": "騎士回滿血、受傷−30%",
    "fx": [
     {
      "op": "custom",
      "id": "heal",
      "full": true,
      "revive": true,
      "taken": 0.7
     }
    ],
    "text": "回滿血＋本波受傷 ×0.7。",
    "plain": "回滿血更耐打"
   },
   "icon": "soup",
   "art": "一碗冒著熱氣的湯，湯面的油花排成一面小盾牌；暖橘色。",
   "phase": 1,
   "plain": "騎士回滿血"
  },
  {
   "id": "c_shield",
   "name": "城堡護盾",
   "desc": "擋下 1 隻漏進城的怪",
   "rarity": "common",
   "faction": "guard",
   "dur": "now",
   "fx": [
    {
     "op": "castleShield",
     "n": 1
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "lives"
   ],
   "text": "存 1 層護盾到本關結束：下一隻衝進城堡的怪不扣命；魔王衝進來只抵 1 命、其餘照扣。「守護結界」天賦先用，用完才用護盾。同時最多存 2 層。",
   "evo": {
    "name": "雙層護盾",
    "desc": "擋下 2 隻漏進城的怪",
    "fx": [
     {
      "op": "castleShield",
      "n": 2
     }
    ],
    "text": "一次存 2 層（同時最多仍是 2 層）。",
    "plain": "城堡多擋 2 隻怪"
   },
   "icon": "castle-shield",
   "art": "城門前罩著一層半透明的藍色泡泡盾，泡泡上映出小星星。",
   "phase": 1,
   "plain": "城堡多擋 1 隻怪"
  },
  {
   "id": "c_banner",
   "name": "戰旗",
   "desc": "絕招後附近塔變快",
   "rarity": "common",
   "faction": "guard",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "onEvent",
     "on": "ult",
     "give": [
      {
       "op": "towerSpd",
       "mul": 1.2,
       "t": 6,
       "near": 80
      }
     ]
    }
   ],
   "link": "rage",
   "caps": [
    "tower_atkspd"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關騎士每放一次絕招，騎士身邊（半徑 80）的塔攻速 +20%，持續 6 秒（遊戲時間）。怒氣只能靠答題與擋怪累積，所以這張卡綁著答題。",
   "evo": {
    "name": "王者戰旗",
    "desc": "絕招後附近塔變快更久",
    "fx": [
     {
      "op": "custom",
      "id": "onEvent",
      "on": "ult",
      "give": [
       {
        "op": "towerSpd",
        "mul": 1.2,
        "t": 9,
        "near": 80
       }
      ]
     }
    ],
    "text": "持續 9 秒。",
    "plain": "絕招後塔快更久"
   },
   "icon": "banner",
   "art": "插在草地上的騎士旗，旗面是金色 ABC 字母盾徽，旗子被風吹得鼓起來。",
   "phase": 1,
   "plain": "放絕招後塔變快"
  },
  {
   "id": "c_chant",
   "name": "詠唱大師",
   "desc": "詠唱倍率 1.5→1.7",
   "rarity": "rare",
   "faction": "guard",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "chantMul",
     "add": 0.2
    }
   ],
   "link": "answer",
   "caps": [
    "chant_mul"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關詠唱題答對時，絕招威力倍率由 ×1.5 變 ×1.7（答錯照常放基本版、不浪費怒氣）。和技能樹「詠唱」路線的加成相加，總倍率最多 ×2.0。",
   "evo": {
    "name": "詠唱宗師",
    "desc": "詠唱倍率 1.5→1.8",
    "fx": [
     {
      "op": "custom",
      "id": "chantMul",
      "add": 0.3
     }
    ],
    "text": "詠唱答對倍率 ×1.8（總倍率最多 ×2.0）。",
    "plain": "多答一題絕招超強"
   },
   "icon": "chant",
   "art": "騎士雙手握劍舉到胸前，劍身浮出一行發光的英文咒語。",
   "phase": 1,
   "plain": "多答一題絕招更強"
  },
  {
   "id": "c_rage40",
   "name": "怒氣預支",
   "desc": "騎士怒氣立刻 +40",
   "rarity": "rare",
   "faction": "guard",
   "dur": "now",
   "fx": [
    {
     "op": "rage",
     "v": 40
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "rage_instant"
   ],
   "text": "騎士怒氣立刻 +40（上限 100，超過的部分不保留）。",
   "evo": {
    "name": "怒氣爆發",
    "desc": "騎士怒氣立刻 +50",
    "fx": [
     {
      "op": "rage",
      "v": 50
     }
    ],
    "text": "怒氣立刻 +50。",
    "plain": "怒氣補更多"
   },
   "icon": "rage-hourglass",
   "art": "一個沙漏，上半部的紅色火焰一瞬間全部倒進下半部。",
   "phase": 1,
   "plain": "怒氣先補一大截"
  },
  {
   "id": "c_oath",
   "name": "守護誓言",
   "desc": "本波騎士多擋 1 隻",
   "rarity": "rare",
   "faction": "guard",
   "dur": "wave",
   "fx": [
    {
     "op": "heroBlock",
     "add": 1
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "knight_block"
   ],
   "text": "本波文法騎士同時可以多擋 1 隻地面怪。",
   "evo": {
    "name": "不動誓言",
    "desc": "本波騎士多擋 2 隻",
    "fx": [
     {
      "op": "heroBlock",
      "add": 2
     }
    ],
    "text": "本波多擋 2 隻。",
    "plain": "騎士多擋 2 隻怪"
   },
   "icon": "oath",
   "art": "騎士把大盾插在地上，盾牌後面躲著兩個探頭的小村民。",
   "phase": 1,
   "plain": "騎士多擋 1 隻怪"
  },
  {
   "id": "c_combo",
   "name": "連擊架式",
   "desc": "答對後 5 擊 +60%",
   "rarity": "rare",
   "faction": "guard",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "comboHits",
     "hits": 5,
     "mul": 1.6
    }
   ],
   "link": "answer",
   "caps": [
    "knight_dmg"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每答對 1 題，騎士接下來 5 次普攻傷害 +60%；再答對只會把次數補回 5 次，不會累加。答錯不會清掉剩下的次數。",
   "evo": {
    "name": "連擊大師",
    "desc": "答對後 7 擊 +60%",
    "fx": [
     {
      "op": "custom",
      "id": "comboHits",
      "hits": 7,
      "mul": 1.6
     }
    ],
    "text": "補滿 7 次。",
    "plain": "答對後連打更久"
   },
   "icon": "combo-slash",
   "art": "騎士的劍畫出 5 道彩色弧線，每道弧線尾端有一個小勾勾。",
   "phase": 1,
   "plain": "答對後連打更痛"
  },
  {
   "id": "c_turtle",
   "name": "岩龜鐵壁",
   "desc": "本波岩龜擋路 +50%",
   "rarity": "rare",
   "faction": "guard",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "turtleBoost",
     "durMul": 1.5,
     "blockedTaken": 1.15
    }
   ],
   "max": 2,
   "req": {
    "stage": 6,
    "summon": "turtle"
   },
   "link": "energy",
   "caps": [
    "damage_taken"
   ],
   "text": "本波召喚的岩龜擋路時間 ×1.5；被岩龜擋住的怪受到的傷害 +15%（還沒破盾的字盾騎士不算）。",
   "evo": {
    "name": "玄武鐵壁",
    "desc": "本波岩龜擋路 +75%",
    "fx": [
     {
      "op": "custom",
      "id": "turtleBoost",
      "durMul": 1.75,
      "blockedTaken": 1.15
     }
    ],
    "text": "擋路時間 ×1.75。",
    "plain": "岩龜擋路超久"
   },
   "icon": "turtle-wall",
   "art": "巨大的龜殼上刻著盾牌花紋，龜殼前方的地面裂開擋住去路。",
   "phase": 2,
   "plain": "岩龜擋路更久"
  },
  {
   "id": "c_unbroken",
   "name": "不滅鬥志",
   "desc": "放完絕招回 30 怒氣",
   "rarity": "legend",
   "faction": "guard",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "onEvent",
     "on": "ult",
     "give": [
      {
       "op": "rage",
       "v": 30
      }
     ]
    }
   ],
   "link": "rage",
   "caps": [
    "rage_loop"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關騎士每放完一次絕招，立刻回 30 怒氣（等於下一招只要再答對約 3～4 題）。全域規則：兩次絕招至少相隔 10 秒；和「騎士詠唱術」的回 20 怒氣不疊加，取 30。",
   "evo": null,
   "icon": "phoenix-armor",
   "art": "騎士盔甲的裂縫透出金光，背後展開一對鳳凰形狀的火焰翅膀。",
   "phase": 1,
   "plain": "放完絕招回怒氣"
  },
  {
   "id": "c_echo",
   "name": "聖劍二連",
   "desc": "下 2 次絕招放兩次",
   "rarity": "legend",
   "faction": "guard",
   "dur": "now",
   "fx": [
    {
     "op": "custom",
     "id": "ultEcho",
     "n": 2,
     "mul": 0.6,
     "noChant": true
    }
   ],
   "link": "rage",
   "caps": [
    "ult_echo"
   ],
   "text": "存 2 次到本關結束：接下來 2 次絕招放完後，自動再放一次同一招（第二次威力 60%、不吃詠唱倍率、不會再觸發其他「放絕招時」的卡）。",
   "evo": null,
   "icon": "twin-swords",
   "art": "兩把交叉的光之劍，兩個劍尖的光連成一條金線。",
   "phase": 2,
   "plain": "絕招放兩次"
  },
  {
   "id": "c_overtime",
   "name": "加班工匠",
   "desc": "下次升級不花能量",
   "rarity": "common",
   "faction": "flame",
   "dur": "now",
   "fx": [
    {
     "op": "freeUp",
     "n": 1
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "upgrade_discount"
   ],
   "text": "存 1 次「免能量升級」到本關結束：下一次升級塔不花能量（金幣照付）。同時最多存 2 次。和狂熱半價、升級特賣會一起時，先用這張（直接 0 能量）。",
   "evo": {
    "name": "超級加班",
    "desc": "下 2 次升級不花能量",
    "fx": [
     {
      "op": "freeUp",
      "n": 2
     }
    ],
    "text": "一次存 2 次（同時最多仍是 2 次）。",
    "plain": "兩次升級免能量"
   },
   "icon": "wrench",
   "art": "戴黃色安全帽的小工匠扛著大扳手，身後的塔頂冒出向上的金色箭頭。",
   "phase": 1,
   "plain": "下次升級免能量"
  },
  {
   "id": "c_grant",
   "name": "工程補助款",
   "desc": "立刻拿一袋金幣",
   "rarity": "common",
   "faction": "flame",
   "dur": "now",
   "fx": [
    {
     "op": "gold",
     "v": 50,
     "perRegion": 10
    }
   ],
   "max": 3,
   "link": "none",
   "caps": [
    "gold"
   ],
   "text": "立刻得到金幣：第 1～5 區依序 50／60／70／80／90（＝v＋perRegion×(區號−1)）。金幣只能蓋 1 級塔與付升級的金幣部分。",
   "evo": {
    "name": "工程大補助",
    "desc": "立刻拿一大袋金幣",
    "fx": [
     {
      "op": "gold",
      "v": 70,
      "perRegion": 14
     }
    ],
    "text": "70／84／98／112／126。",
    "plain": "拿一大袋金幣"
   },
   "icon": "gold-bag",
   "art": "鼓鼓的金幣袋，袋口綁著一卷藍色設計圖。",
   "phase": 1,
   "plain": "拿一袋金幣"
  },
  {
   "id": "c_forge",
   "name": "答對打鐵",
   "desc": "每答對 +1% 塔傷害",
   "rarity": "common",
   "faction": "flame",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "perCorrect",
     "stack": {
      "op": "towerDmg",
      "step": 0.01,
      "max": 0.1
     }
    }
   ],
   "link": "answer",
   "caps": [
    "tower_dmg"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關接下來每答對 1 題（第一次或第二次機會都算），所有塔傷害 +1%，最多 +10%。答錯不會掉。",
   "evo": {
    "name": "答對煉鋼",
    "desc": "每答對 +1.5% 塔傷害",
    "fx": [
     {
      "op": "custom",
      "id": "perCorrect",
      "stack": {
       "op": "towerDmg",
       "step": 0.015,
       "max": 0.15
      }
     }
    ],
    "text": "每題 +1.5%，最多 +15%。",
    "plain": "越答對塔越超痛"
   },
   "icon": "anvil",
   "art": "鐵砧上的錘子敲出寫著「A+」的火花，旁邊一座小塔閃閃發亮。",
   "phase": 1,
   "plain": "越答對塔越痛"
  },
  {
   "id": "c_roar",
   "name": "戰吼共鳴",
   "desc": "本波召喚獸傷害 +20%",
   "rarity": "common",
   "faction": "flame",
   "dur": "wave",
   "fx": [
    {
     "op": "allyDmg",
     "mul": 1.2
    }
   ],
   "max": 2,
   "req": {
    "stage": 1
   },
   "link": "energy",
   "caps": [
    "summon_power"
   ],
   "text": "本波召喚獸的傷害 +20%（火狐、雷狼與外掛新增會打人的召喚獸；岩龜、冰鳳、光獨角獸沒有傷害，不受影響）。",
   "evo": {
    "name": "萬獸怒吼",
    "desc": "本波召喚獸傷害 +30%",
    "fx": [
     {
      "op": "allyDmg",
      "mul": 1.3
     }
    ],
    "text": "+30%。",
    "plain": "神獸打得超痛"
   },
   "icon": "roar",
   "art": "火狐和雷狼一起仰頭吼叫，聲波畫成一圈圈彩色音符。",
   "phase": 1,
   "plain": "神獸打得更痛"
  },
  {
   "id": "c_compdrill",
   "name": "夥伴特訓",
   "desc": "本波同伴攻擊 +25%",
   "rarity": "common",
   "faction": "flame",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "compDmg",
     "mul": 1.25,
     "range": 10
    }
   ],
   "max": 2,
   "req": {
    "stage": 10,
    "companion": true
   },
   "link": "none",
   "caps": [
    "comp_dmg"
   ],
   "text": "本波同伴（精靈弓手、冰雪法師、龍騎士）普攻傷害 +25%、攻擊距離 +10。隊伍裡沒有同伴時不會出現。",
   "evo": {
    "name": "夥伴集訓",
    "desc": "本波同伴攻擊 +35%",
    "fx": [
     {
      "op": "custom",
      "id": "compDmg",
      "mul": 1.35,
      "range": 10
     }
    ],
    "text": "+35%、距離 +10。",
    "plain": "同伴打得超痛"
   },
   "icon": "training",
   "art": "三位同伴對著稻草人練習，頭上綁著寫「特訓」的白頭巾。",
   "phase": 1,
   "plain": "同伴打得更痛"
  },
  {
   "id": "c_upsale",
   "name": "升級特賣會",
   "desc": "本波升級少 1 能量",
   "rarity": "rare",
   "faction": "flame",
   "dur": "wave",
   "fx": [
    {
     "op": "upCost",
     "add": -1
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "upgrade_discount"
   ],
   "text": "本波每次升級少花 1 能量，最少還是要 1。和狂熱「升級半價」一起時：先減 1、再半價、無條件進位，最少 1。",
   "evo": {
    "name": "升級跳樓價",
    "desc": "本波升級減1、送1次免費",
    "fx": [
     {
      "op": "upCost",
      "add": -1
     },
     {
      "op": "freeUp",
      "n": 1
     }
    ],
    "text": "少 1 能量，另外存 1 次免能量升級。",
    "plain": "升級更便宜"
   },
   "icon": "sale-tag",
   "art": "塔身掛著一條紅色特價布條，上面寫著「−1⚡」。",
   "phase": 1,
   "plain": "升級少花能量"
  },
  {
   "id": "c_blast",
   "name": "爆破專家",
   "desc": "本波爆炸範圍 +25%",
   "rarity": "rare",
   "faction": "flame",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "towerSplash",
     "mul": 1.25
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "tower_splash"
   ],
   "text": "本波魔法塔、奧術塔、砲塔、地雷塔的爆炸範圍 ×1.25（雷電塔沒有爆炸，不受影響）。",
   "evo": {
    "name": "爆破大師",
    "desc": "本波爆炸更大還會減速",
    "fx": [
     {
      "op": "custom",
      "id": "towerSplash",
      "mul": 1.3,
      "slow": 0.15,
      "slowT": 1
     }
    ],
    "text": "範圍 ×1.3，炸到的地面怪變慢 15%、1 秒（和冰塔取較大值，不相加）。",
    "plain": "爆炸更大還減速"
   },
   "icon": "smile-bomb",
   "art": "一顆圓滾滾、咧嘴笑的砲彈炸開成彩色煙火。",
   "phase": 2,
   "plain": "爆炸範圍變大"
  },
  {
   "id": "c_branch",
   "name": "分支專家",
   "desc": "4 級以上塔傷害 +15%",
   "rarity": "rare",
   "faction": "flame",
   "dur": "stage",
   "fx": [
    {
     "op": "towerDmg",
     "mul": 1.15,
     "branch": "any"
    }
   ],
   "req": {
    "stage": 4
   },
   "link": "energy",
   "caps": [
    "tower_dmg"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關已經選了分支（4 級以上）的塔傷害 +15%。升到 4 級要花能量，所以綁著答題。和「答對打鐵」等塔傷害卡合計最多 +20%。",
   "evo": {
    "name": "分支宗師",
    "desc": "分支塔+15%、特色加強",
    "fx": [
     {
      "op": "towerDmg",
      "mul": 1.15,
      "branch": "any"
     },
     {
      "op": "custom",
      "id": "branchPerk",
      "arrowA": {
       "range": 10
      },
      "arrowB": {
       "multi": 1
      },
      "mageA": {
       "chain": 1
      },
      "mageB": {
       "poly": 0.03
      },
      "iceA": {
       "splash": 6
      },
      "iceB": {
       "freeze": 0.2
      },
      "cannonA": {
       "dmg": 0.1
      },
      "cannonB": {
       "splash": 4
      }
     }
    ],
    "text": "+15%，另外分支特色加強：狙擊射程 +10、連弩多射 1 隻、雷電多連 1 隻、奧術變青蛙 +3%、暴風雪範圍 +6、永凍多凍 0.2 秒（魔王照舊只算 30%）、火箭傷害 +10%（算進塔傷害上限）、地雷爆炸範圍 +4。",
    "plain": "專精塔更強"
   },
   "icon": "branch-medal",
   "art": "塔頂分出兩條發光的岔路，岔路中間掛著一枚金色「專精」勳章。",
   "phase": 1,
   "plain": "高級塔打得更痛"
  },
  {
   "id": "c_foxtrail",
   "name": "九尾火徑",
   "desc": "火狐衝過留下火焰",
   "rarity": "rare",
   "faction": "flame",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "foxTrail",
     "t": 3,
     "dpsPct": 0.12
    }
   ],
   "req": {
    "stage": 1,
    "summon": "fox"
   },
   "link": "energy",
   "caps": [
    "summon_power"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關火狐衝過的路面燒起火焰 3 秒；站在火上的地面怪每秒受到「火狐衝撞傷害」的 12%（飛行怪不受影響）。",
   "evo": {
    "name": "九尾烈焰",
    "desc": "火狐的火焰更久更燙",
    "fx": [
     {
      "op": "custom",
      "id": "foxTrail",
      "t": 4,
      "dpsPct": 0.15
     }
    ],
    "text": "火焰 4 秒、每秒 15%。",
    "plain": "火焰更久更燙"
   },
   "icon": "fire-trail",
   "art": "一條燃燒的小路，路上留著一串小狐狸腳印。",
   "phase": 2,
   "plain": "火狐留下火焰路"
  },
  {
   "id": "c_burst",
   "name": "爆裂彈藥庫",
   "desc": "每答對 2 題存爆裂彈",
   "rarity": "legend",
   "faction": "flame",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "burstAmmo",
     "every": 2,
     "store": 3,
     "r": 36,
     "pctOfVictim": 0.4,
     "bossPct": 0.02,
     "perWave": 6,
     "towerKillsOnly": true,
     "noChain": true
    }
   ],
   "link": "answer",
   "caps": [
    "pct_hp"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每答對 2 題存 1 顆爆裂彈（最多存 3 顆）。塔打倒怪時自動用掉 1 顆，在那裡爆開（半徑 36）：其他非魔王怪受到「被打倒那隻怪最大血量 40%」的傷害；魔王只受自己最大血量 2%。每波最多爆 6 次；被爆裂彈炸死的怪不會再引爆；英雄、召喚獸、詞彈打倒的怪不會引爆。",
   "evo": null,
   "icon": "bomb-crate",
   "art": "打開的木頭彈藥箱，裡面塞滿印著英文字母的圓炸彈，引信冒著火花。",
   "phase": 1,
   "plain": "答對存爆裂彈"
  },
  {
   "id": "c_awaken",
   "name": "靈獸覺醒",
   "desc": "本關召喚獸都進化",
   "rarity": "legend",
   "faction": "flame",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "tempEvolve",
     "mul": 1.5,
     "ifEvolved": 1.2
    }
   ],
   "req": {
    "stage": 1
   },
   "link": "energy",
   "caps": [
    "summon_power"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每次召喚，那隻召喚獸都用「進化」型態出場（等於進化：威力 ×1.5；冰鳳、光獨角獸照它們自己的進化規則）。已經進化的召喚獸改成威力 ×1.2。讓還沒練到 10 級的孩子先看看進化長什麼樣子。",
   "evo": null,
   "icon": "evolve-spark",
   "art": "小火狐身後冒出九條火焰尾巴的剪影，旁邊寫著閃亮的「進化！」。",
   "phase": 1,
   "plain": "神獸全部進化"
  },
  {
   "id": "c_reload",
   "name": "快手裝填",
   "desc": "本波全塔攻速 +15%",
   "rarity": "common",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "towerSpd",
     "mul": 1.15
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "tower_atkspd"
   ],
   "text": "本波所有塔的攻擊速度 +15%（冷卻 ÷1.15）。和狂熱 ×1.5 相乘，卡片＋狂熱合計最多 ×1.6。",
   "evo": {
    "name": "連珠快手",
    "desc": "本波全塔攻速 +20%",
    "fx": [
     {
      "op": "towerSpd",
      "mul": 1.2
     }
    ],
    "text": "+20%。",
    "plain": "塔打得超快"
   },
   "icon": "quick-reload",
   "art": "一隻戴手套的手把三支箭同時塞進弓箭塔的射口，旁邊有白色速度線。",
   "phase": 1,
   "plain": "塔打得更快"
  },
  {
   "id": "c_battery",
   "name": "能量補給包",
   "desc": "之後答對再領 4 能量",
   "rarity": "common",
   "faction": "thunder",
   "dur": "now",
   "fx": [
    {
     "op": "energy",
     "v": 4
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "energy_instant"
   ],
   "text": "4 格能量先存進能量存摺（能量條旁顯示「存 N」），之後每答對 1 題多領 2 格，領完為止（紅線 1：能量只能靠答對）。",
   "evo": {
    "name": "能量大禮包",
    "desc": "之後答對再領 5 能量",
    "fx": [
     {
      "op": "energy",
      "v": 5
     }
    ],
    "text": "存 5 格，一樣每答對 1 題多領 2 格。",
    "plain": "答對時領更多"
   },
   "icon": "battery",
   "art": "一顆閃電形狀的電池，電池標籤寫著「ABC」。",
   "phase": 1,
   "plain": "答對時多領能量"
  },
  {
   "id": "c_notes",
   "name": "學霸筆記",
   "desc": "每答對 5 題 +2 能量",
   "rarity": "common",
   "faction": "thunder",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "perCorrect",
     "every": 5,
     "give": [
      {
       "op": "energy",
       "v": 2
      }
     ],
     "maxTimes": 6
    }
   ],
   "link": "answer",
   "caps": [
    "energy_per_answer"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每累積答對 5 題（拿卡後開始算），額外 +2 能量，最多 6 次。算進「每題能量最多 5」的上限。",
   "evo": {
    "name": "學神筆記",
    "desc": "每答對 4 題 +2 能量",
    "fx": [
     {
      "op": "custom",
      "id": "perCorrect",
      "every": 4,
      "give": [
       {
        "op": "energy",
        "v": 2
       }
      ],
      "maxTimes": 7
     }
    ],
    "text": "每 4 題、最多 7 次。",
    "plain": "答對送更多能量"
   },
   "icon": "sticky-notes",
   "art": "貼滿彩色便利貼的筆記本，封面寫著大大的「A+」。",
   "phase": 1,
   "plain": "常答對就送能量"
  },
  {
   "id": "c_earphone",
   "name": "專心耳機",
   "desc": "本波連對 4 題就狂熱",
   "rarity": "common",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "feverNeed",
     "add": -1
    }
   ],
   "max": 2,
   "link": "answer",
   "caps": [
    "fever"
   ],
   "text": "本波狂熱時刻的門檻由連對 5 題降為 4 題。狂熱冷卻 20 秒不變。",
   "evo": {
    "name": "降噪耳機",
    "desc": "連對 4 題狂熱、多 1 題",
    "fx": [
     {
      "op": "feverNeed",
      "add": -1
     },
     {
      "op": "custom",
      "id": "feverLen",
      "maxQ": 4
     }
    ],
    "text": "門檻 4，狂熱最多答 4 題（原本 3 題）。",
    "plain": "狂熱更容易更久"
   },
   "icon": "earphone",
   "art": "一本小書戴著大大的耳機，書的四周是一圈火焰邊框。",
   "phase": 1,
   "plain": "更容易進狂熱"
  },
  {
   "id": "c_snack",
   "name": "靈獸零食",
   "desc": "本波召喚少 2 能量",
   "rarity": "common",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "summonCost",
     "add": -2
    }
   ],
   "max": 2,
   "req": {
    "stage": 1
   },
   "link": "energy",
   "caps": [
    "summon_cost"
   ],
   "text": "本波召喚少花 2 能量（6→4、光獨角獸 5→3）。所有卡片減價合計最多 −3，召喚最便宜 3 能量。",
   "evo": {
    "name": "靈獸大餐",
    "desc": "本波召喚少 3 能量",
    "fx": [
     {
      "op": "summonCost",
      "add": -3
     }
    ],
    "text": "少 3 能量（最便宜 3）。",
    "plain": "召喚神獸超便宜"
   },
   "icon": "bone-cookie",
   "art": "一包骨頭形狀的餅乾，袋口飄出閃亮的小星星。",
   "phase": 1,
   "plain": "召喚神獸更便宜"
  },
  {
   "id": "c_cheer",
   "name": "夥伴打氣",
   "desc": "本波同伴大招冷卻−40%",
   "rarity": "common",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "compUltCd",
     "mul": 0.6
    }
   ],
   "max": 2,
   "req": {
    "stage": 10,
    "companion": true
   },
   "link": "energy",
   "caps": [
    "comp_ult_cd"
   ],
   "text": "本波同伴大招的冷卻 ×0.6（大招仍要花 5 能量）。隊伍裡沒有同伴時不會出現。",
   "evo": {
    "name": "夥伴加油團",
    "desc": "本波同伴大招冷卻−50%",
    "fx": [
     {
      "op": "compUltCd",
      "mul": 0.5
     }
    ],
    "text": "冷卻 ×0.5。",
    "plain": "同伴大招超快好"
   },
   "icon": "high-five",
   "art": "精靈弓手、冰雪法師、龍騎士三個人跳起來擊掌，冒出愛心。",
   "phase": 1,
   "plain": "同伴大招更快好"
  },
  {
   "id": "c_feverplus",
   "name": "狂熱延長賽",
   "desc": "本波狂熱 16 秒、4 題",
   "rarity": "rare",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "feverLen",
     "dur": 16,
     "maxQ": 4
    }
   ],
   "max": 2,
   "link": "answer",
   "caps": [
    "fever"
   ],
   "text": "本波狂熱時刻最多持續 16 秒或 4 題（原本 12 秒或 3 題，先到者結束）。冷卻 20 秒不變；狂熱效果本身不加強。",
   "evo": {
    "name": "狂熱加時",
    "desc": "狂熱更久、怒氣更多",
    "fx": [
     {
      "op": "custom",
      "id": "feverLen",
      "dur": 16,
      "maxQ": 4
     },
     {
      "op": "custom",
      "id": "feverRage",
      "add": 5
     }
    ],
    "text": "16 秒／4 題，狂熱中每題怒氣再 +5（每題仍最多 35）。",
    "plain": "狂熱更長怒氣多"
   },
   "icon": "fire-hourglass",
   "art": "計時沙漏的外圈燒著火焰，沙子是一顆顆金色字母。",
   "phase": 1,
   "plain": "狂熱時間更長"
  },
  {
   "id": "c_wolf",
   "name": "雷霆追擊",
   "desc": "本波雷狼多打 3 隻",
   "rarity": "rare",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "wolfChain",
     "extra": 3,
     "flySlow": 0.3,
     "flySlowT": 2
    }
   ],
   "max": 2,
   "req": {
    "stage": 3,
    "summon": "wolf"
   },
   "link": "energy",
   "caps": [
    "summon_power"
   ],
   "text": "本波雷狼的連鎖閃電多打 3 隻（6→9）；被打到的飛行怪變慢 30%、2 秒。",
   "evo": {
    "name": "雷霆萬鈞",
    "desc": "本波雷狼多打 4 隻",
    "fx": [
     {
      "op": "custom",
      "id": "wolfChain",
      "extra": 4,
      "flySlow": 0.4,
      "flySlowT": 2
     }
    ],
    "text": "多打 4 隻，飛行怪變慢 40%。",
    "plain": "雷狼電更多隻"
   },
   "icon": "thunder-wolf",
   "art": "雷狼的尾巴拖出鋸齒狀的黃色閃電，正追著一群蝙蝠。",
   "phase": 2,
   "plain": "雷狼多電幾隻"
  },
  {
   "id": "c_mark",
   "name": "弱點標記",
   "desc": "答對就標記最肥的怪",
   "rarity": "rare",
   "faction": "thunder",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "mark",
     "n": 1,
     "t": 5,
     "mul": 1.2,
     "bossMul": 1.1,
     "skipShielded": true
    }
   ],
   "max": 2,
   "link": "answer",
   "caps": [
    "damage_taken"
   ],
   "text": "本波每答對 1 題，塔射程內血最多的 1 隻怪被標記 5 秒：受到的所有傷害 +20%（魔王 +10%）。還沒破盾的字盾騎士、魔龍不能被標記（盾要靠拼字破）。",
   "evo": {
    "name": "雙重標記",
    "desc": "答對就標記 2 隻怪",
    "fx": [
     {
      "op": "custom",
      "id": "mark",
      "n": 2,
      "t": 5,
      "mul": 1.2,
      "bossMul": 1.1,
      "skipShielded": true
     }
    ],
    "text": "一次標記 2 隻。",
    "plain": "答對標出 2 隻怪"
   },
   "icon": "target-mark",
   "art": "怪物頭上浮出紅色靶心，靶心正中間是一個驚嘆號。",
   "phase": 1,
   "plain": "答對就標出肥怪"
  },
  {
   "id": "c_volley",
   "name": "全塔齊射",
   "desc": "狂熱時全塔齊射",
   "rarity": "legend",
   "faction": "thunder",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "feverVolley",
     "reload": true,
     "mul": 1.15
    }
   ],
   "link": "fever",
   "caps": [
    "tower_atkspd"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每次狂熱時刻開始：所有塔立刻裝填（冷卻歸零）一起開火；狂熱期間塔攻速再 ×1.15（和狂熱 ×1.5、其他卡相乘後最多 ×1.6）。",
   "evo": null,
   "icon": "volley",
   "art": "一整排塔同時向天空射出彩色光柱，畫面四周是火焰邊框。",
   "phase": 1,
   "plain": "狂熱時全塔齊射"
  },
  {
   "id": "c_herd",
   "name": "萬獸齊鳴",
   "desc": "下次召喚多叫一隻",
   "rarity": "legend",
   "faction": "thunder",
   "dur": "now",
   "fx": [
    {
     "op": "custom",
     "id": "doubleSummon",
     "n": 1,
     "mul": 0.7,
     "exclude": [
      "unicorn"
     ]
    }
   ],
   "req": {
    "stage": 3,
    "summons": 2
   },
   "link": "energy",
   "caps": [
    "summon_power"
   ],
   "text": "存 1 次到本關結束：下一次花能量召喚時，同時免費召喚另一隻帶進關的召喚獸（威力 ×0.7；光獨角獸不會被帶出來；免費的那隻不觸發「能量回流」天賦）。",
   "evo": null,
   "icon": "herd",
   "art": "五隻靈獸從同一個召喚陣裡一起衝出來，背後放射金光。",
   "phase": 1,
   "plain": "下次召喚多 1 隻"
  },
  {
   "id": "c_scope",
   "name": "千里鏡",
   "desc": "本波全塔射程變遠",
   "rarity": "common",
   "faction": "frost",
   "dur": "wave",
   "fx": [
    {
     "op": "towerRange",
     "add": 8
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "tower_range"
   ],
   "text": "本波所有塔射程 +8（約 +10%）。和「鷹眼」天賦合計最多 +15%；迷霧、夜戰的射程縮減照樣乘上去。",
   "evo": {
    "name": "鷹眼千里鏡",
    "desc": "射程變遠、刺客現形",
    "fx": [
     {
      "op": "towerRange",
      "add": 8
     },
     {
      "op": "custom",
      "id": "revealInvis"
     }
    ],
    "text": "射程 +8，隱形刺客走進任何塔的射程就現形（本波）。",
    "plain": "塔更遠還抓刺客"
   },
   "icon": "spyglass",
   "art": "黃銅望遠鏡架在塔頂，鏡片閃過一道藍光，遠處有一個問號形狀的影子。",
   "phase": 1,
   "plain": "塔打得更遠"
  },
  {
   "id": "c_chill",
   "name": "寒氣",
   "desc": "本波怪物全部慢 10%",
   "rarity": "common",
   "faction": "frost",
   "dur": "wave",
   "fx": [
    {
     "op": "enemySpd",
     "mul": 0.9
    }
   ],
   "max": 2,
   "link": "none",
   "caps": [
    "enemy_slow"
   ],
   "text": "本波所有怪物（含飛行、魔王）移動速度 ×0.9。和冰塔、冰鳳的減速相乘，但怪最慢不低於原速 30%（凍住不算）。",
   "evo": {
    "name": "刺骨寒氣",
    "desc": "本波怪物全部慢 13%",
    "fx": [
     {
      "op": "enemySpd",
      "mul": 0.87
     }
    ],
    "text": "×0.87。",
    "plain": "怪走更慢"
   },
   "icon": "snowflake",
   "art": "一大片旋轉的雪花，中間的雪花是英文字母 A 的形狀。",
   "phase": 1,
   "plain": "怪走慢一點"
  },
  {
   "id": "c_review",
   "name": "複習便當",
   "desc": "復仇題答對獎勵加倍",
   "rarity": "common",
   "faction": "frost",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "energyGain",
     "src": "revenge",
     "add": 1,
     "rage": 10
    }
   ],
   "max": 2,
   "req": {
    "wrongBook": 3
   },
   "link": "answer",
   "caps": [
    "energy_per_answer"
   ],
   "text": "本波答對「復仇題」（錯題本裡的題）時，額外能量由 +1 變 +2，騎士怒氣再 +10。本關錯題本可出的題少於 3 題時不會出現。",
   "evo": {
    "name": "豪華複習便當",
    "desc": "復仇題答對獎勵三倍",
    "fx": [
     {
      "op": "custom",
      "id": "energyGain",
      "src": "revenge",
      "add": 2,
      "rage": 10
     }
    ],
    "text": "額外能量 +3、怒氣 +10（每題能量仍最多 5）。",
    "plain": "復仇題獎勵三倍"
   },
   "icon": "bento",
   "art": "便當盒裡整齊排著訂正過的單字卡，旁邊放著一顆愛心飯糰。",
   "phase": 1,
   "plain": "復仇題獎勵加倍"
  },
  {
   "id": "c_coinnotes",
   "name": "金幣講義",
   "desc": "答對一題 +4 金幣",
   "rarity": "common",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "panelGold",
     "v": 4
    }
   ],
   "link": "answer",
   "caps": [
    "gold"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關側邊面板每答對 1 題，多 4 金幣。題目受每關 45 點上限，所以最多約多一百多金幣。",
   "evo": {
    "name": "黃金講義",
    "desc": "答對一題 +6 金幣",
    "fx": [
     {
      "op": "panelGold",
      "v": 6
     }
    ],
    "text": "+6 金幣。",
    "plain": "答對拿更多金幣"
   },
   "icon": "coin-notes",
   "art": "一疊講義，右下角的頁角捲起來變成閃亮的金幣。",
   "phase": 1,
   "plain": "答對多拿金幣"
  },
  {
   "id": "c_warmup",
   "name": "靜心咒語",
   "desc": "先答對 2 題召喚更強",
   "rarity": "common",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "summonIfRecent",
     "window": 20,
     "need": 2,
     "mul": 1.25
    }
   ],
   "req": {
    "stage": 1
   },
   "link": "answer",
   "caps": [
    "summon_power"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關召喚時，如果前 20 秒（遊戲時間）內答對至少 2 題，這次召喚威力 ×1.25。",
   "evo": {
    "name": "熟練咒語",
    "desc": "先答對 1 題召喚更強",
    "fx": [
     {
      "op": "custom",
      "id": "summonIfRecent",
      "window": 20,
      "need": 1,
      "mul": 1.3
     }
    ],
    "text": "前 20 秒答對 1 題就成立，威力 ×1.3。",
    "plain": "召喚更快變強"
   },
   "icon": "spell-book",
   "art": "攤開的咒語書，書頁上浮出一個發著藍光的召喚陣。",
   "phase": 1,
   "plain": "先答對召喚更強"
  },
  {
   "id": "c_retry",
   "name": "再想一次",
   "desc": "第二次答對也拿 2 能量",
   "rarity": "rare",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "energyGain",
     "src": "retry",
     "set": 2
    }
   ],
   "req": {
    "secondChance": true
   },
   "link": "answer",
   "caps": [
    "energy_per_answer"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關「第二次機會」才答對的題，能量由 +1 變 +2（連對、三星率、徽章的規則不變：第二次機會照樣不算）。英雄挑戰、鐵人沒有第二次機會，不會出現。",
   "evo": {
    "name": "越挫越勇",
    "desc": "第二次答對 2 能量＋怒氣",
    "fx": [
     {
      "op": "custom",
      "id": "energyGain",
      "src": "retry",
      "set": 2,
      "rage": 10
     }
    ],
    "text": "+2 能量，騎士怒氣再 +10。",
    "plain": "再答對拿更多"
   },
   "icon": "eraser-bulb",
   "art": "橡皮擦擦掉一個錯的選項，擦過的地方冒出一顆亮晶晶的燈泡。",
   "phase": 1,
   "plain": "再答對也拿能量"
  },
  {
   "id": "c_bookworm",
   "name": "書蟲進駐",
   "desc": "書本塔便宜又耐用",
   "rarity": "rare",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "bookTower",
     "cap": 16,
     "cost": 1,
     "refund": 2
    }
   ],
   "link": "answer",
   "caps": [
    "energy_per_answer"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關書本塔「每答對 +1 能量」的次數上限由 10 次變 16 次；蓋書本塔只要 1 能量（已經蓋好的退回 2 能量）。書本塔仍然每關限 1 座。",
   "evo": {
    "name": "書蟲大軍",
    "desc": "書本塔更便宜更耐用",
    "fx": [
     {
      "op": "custom",
      "id": "bookTower",
      "cap": 20,
      "cost": 0,
      "refund": 3
     }
    ],
    "text": "上限 20 次、蓋塔 0 能量（已蓋退 3）。",
    "plain": "書本塔超便宜"
   },
   "icon": "bookworm",
   "art": "戴圓眼鏡的書蟲從書本塔的窗戶探出頭，手上捧著一本小書。",
   "phase": 1,
   "plain": "書本塔更便宜"
  },
  {
   "id": "c_challenge",
   "name": "挑戰升級",
   "desc": "本波題目變難、獎勵變多",
   "rarity": "rare",
   "faction": "frost",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "harderQ",
     "energy": 1,
     "rage": 10,
     "starExclude": true
    }
   ],
   "max": 2,
   "req": {
    "notHeroic": true
   },
   "link": "answer",
   "caps": [
    "energy_per_answer",
    "rage_per_answer"
   ],
   "text": "本波側邊面板改出「高一級」的題目（TG.harderOf；營地題、魔王限時題不變）。答對每題多 +1 能量、騎士怒氣 +10；答錯照常什麼都不扣。這些題不算進三星答對率，也不算鐵人錯題（選了挑戰不會害你掉星）。英雄挑戰本來就高一級，不會出現。",
   "evo": {
    "name": "學霸挑戰",
    "desc": "題目變難、獎勵再多",
    "fx": [
     {
      "op": "custom",
      "id": "harderQ",
      "energy": 1,
      "rage": 15,
      "starExclude": true
     }
    ],
    "text": "+1 能量、怒氣 +15。",
    "plain": "題目更難獎勵更多"
   },
   "icon": "stairs-star",
   "art": "一階一階往上的藍色樓梯，最頂端站著一顆戴皇冠的星星。",
   "phase": 2,
   "plain": "題目難獎勵多"
  },
  {
   "id": "c_phoenix",
   "name": "寒流延長",
   "desc": "本波冰鳳減速更久",
   "rarity": "rare",
   "faction": "frost",
   "dur": "wave",
   "fx": [
    {
     "op": "custom",
     "id": "phoenixBoost",
     "addT": 3,
     "addSlow": 0.1
    }
   ],
   "max": 2,
   "req": {
    "stage": 10,
    "summon": "phoenix"
   },
   "link": "energy",
   "caps": [
    "enemy_slow"
   ],
   "text": "本波冰鳳的全場減速多 3 秒，減速效果 +10%（冰鳳減速最高 60% 不變）。",
   "evo": {
    "name": "極地寒流",
    "desc": "本波冰鳳減速再更久",
    "fx": [
     {
      "op": "custom",
      "id": "phoenixBoost",
      "addT": 4,
      "addSlow": 0.1
     }
    ],
    "text": "多 4 秒。",
    "plain": "冰鳳讓怪慢超久"
   },
   "icon": "snow-phoenix",
   "art": "冰鳳展開翅膀，羽毛灑下一片雪花風暴。",
   "phase": 2,
   "plain": "冰鳳讓怪慢更久"
  },
  {
   "id": "c_owl",
   "name": "文法之神",
   "desc": "狂熱時全場減速",
   "rarity": "legend",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "feverBlessing",
     "slow": 0.75,
     "bossSlow": 0.9,
     "t": 4,
     "rage": 30
    }
   ],
   "link": "fever",
   "caps": [
    "enemy_slow",
    "rage_instant"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每次狂熱時刻開始：全場怪速 ×0.75、持續 4 秒（魔王 ×0.9），騎士怒氣 +30。狂熱有 20 秒冷卻，所以約半分鐘最多一次。",
   "evo": null,
   "icon": "owl-god",
   "art": "雲端上一隻戴學士帽的貓頭鷹，拿著發光的粉筆在空中寫字。",
   "phase": 1,
   "plain": "狂熱時怪全變慢"
  },
  {
   "id": "c_sentence",
   "name": "完美句型",
   "desc": "每答對 3 題放衝擊波",
   "rarity": "legend",
   "faction": "frost",
   "dur": "stage",
   "fx": [
    {
     "op": "custom",
     "id": "grammarShock",
     "every": 3,
     "pct": 0.1,
     "bossPct": 0.02,
     "perWave": 2
    }
   ],
   "link": "answer",
   "caps": [
    "pct_hp"
   ],
   "endless": {
    "dur": {
     "waves": 5
    }
   },
   "text": "本關每累積答對 3 題（不用連續），放出 1 次「文法衝擊波」：場上所有非魔王怪受到自己最大血量 10% 的傷害，魔王受 2%。每波最多 2 次，超過的不保留。衝擊波打倒的怪不會觸發爆裂彈。",
   "evo": null,
   "icon": "rainbow-sentence",
   "art": "一句完整的英文句子像彩虹一樣橫跨整個戰場，每個字母都在發光。",
   "phase": 1,
   "plain": "常答對放衝擊波"
  },
  {
   "id": "c_duo_support",
   "name": "火力支援協定",
   "desc": "召喚後 6 秒全塔加速",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "flame",
    "thunder"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_roar",
     "c_reload"
    ],
    "stage": 1
   },
   "fx": [
    {
     "op": "custom",
     "id": "onEvent",
     "on": "summon",
     "give": [
      {
       "op": "towerSpd",
       "mul": 1.25,
       "t": 6
      }
     ]
    }
   ],
   "link": "energy",
   "caps": [
    "tower_atkspd"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波每次召喚（含免費召喚）後 6 秒，全塔攻速 ×1.25（卡片＋狂熱合計最多 ×1.6）。",
   "evo": null,
   "icon": "fox-cannon",
   "art": "火狐背上背著一座迷你砲塔，一邊衝一邊開砲。",
   "phase": 1,
   "plain": "召喚後全塔變快"
  },
  {
   "id": "c_duo_fortress",
   "name": "堡壘騎士",
   "desc": "絕招讓附近塔更強",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "guard",
    "flame"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_whetstone",
     "c_forge"
    ]
   },
   "fx": [
    {
     "op": "custom",
     "id": "ultFortress",
     "r": 90,
     "reload": true,
     "t": 8,
     "towerDmg": 1.2,
     "heroTaken": 0.8
    }
   ],
   "link": "rage",
   "caps": [
    "tower_dmg",
    "knight_taken"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波騎士放絕招時：半徑 90 內的塔立刻裝填，8 秒內傷害 ×1.2（算進塔傷害上限 +25%）；這 8 秒騎士受到的傷害 ×0.8。",
   "evo": null,
   "icon": "fortress-knight",
   "art": "騎士背靠著一座塔舉起盾牌，塔頂插著騎士的旗子。",
   "phase": 1,
   "plain": "絕招讓附近塔變強"
  },
  {
   "id": "c_duo_bookgun",
   "name": "書塔砲台",
   "desc": "答對時書本塔開砲",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "frost",
    "flame"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_bookworm",
     "c_overtime"
    ]
   },
   "fx": [
    {
     "op": "custom",
     "id": "bookCannon",
     "mul": 3,
     "splash": 24,
     "splashMul": 0.5,
     "fly": true
    }
   ],
   "link": "answer",
   "caps": [
    "tower_dmg"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波每答對 1 題，書本塔朝走最遠的怪射出 1 發「字彈」：傷害＝場上最強那座塔單發傷害 ×3，周圍半徑 24 受一半傷害（打得到飛行怪）。場上沒有書本塔就沒效果。",
   "evo": null,
   "icon": "book-cannon",
   "art": "書本塔翻開的書頁捲成砲管，射出一串發光的英文字母。",
   "phase": 2,
   "plain": "答對時書本塔開砲"
  },
  {
   "id": "c_duo_charge",
   "name": "騎獸衝鋒",
   "desc": "放絕招順便召喚",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "guard",
    "thunder"
   ],
   "dur": "now",
   "req": {
    "all": [
     "c_headband",
     "c_snack"
    ],
    "stage": 1
   },
   "fx": [
    {
     "op": "custom",
     "id": "ultSummon",
     "n": 2,
     "mul": 0.6,
     "exclude": [
      "unicorn"
     ]
    }
   ],
   "link": "rage",
   "caps": [
    "summon_power"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "存 2 次到本關結束：騎士放絕招時，同時免費召喚本關上一次叫過的召喚獸（威力 ×0.6；光獨角獸除外；本關還沒召喚過就叫第一隻帶進關的）。免費召喚不觸發「能量回流」，「聖劍二連」的第二次不會再觸發。",
   "evo": null,
   "icon": "wolf-rider",
   "art": "騎士騎在雷狼背上舉劍衝鋒，身後捲起一道閃電。",
   "phase": 1,
   "plain": "放絕招順便召喚"
  },
  {
   "id": "c_duo_rune",
   "name": "咒語召喚陣",
   "desc": "狂熱中召喚半價",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "frost",
    "thunder"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_warmup",
     "c_earphone"
    ],
    "stage": 1
   },
   "fx": [
    {
     "op": "custom",
     "id": "feverSummonHalf",
     "floor": 3
    }
   ],
   "link": "fever",
   "caps": [
    "summon_cost"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波狂熱時刻中，召喚只要一半能量（無條件進位，最少 3；和其他召喚減價取較便宜的一種，不相加）。",
   "evo": null,
   "icon": "rune-circle",
   "art": "地上的召喚陣由英文字母排成一圈，正在發光旋轉。",
   "phase": 1,
   "plain": "狂熱時召喚半價"
  },
  {
   "id": "c_duo_chant",
   "name": "騎士詠唱術",
   "desc": "詠唱答對回能量",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "guard",
    "frost"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_chant",
     "c_review"
    ]
   },
   "fx": [
    {
     "op": "custom",
     "id": "chantReward",
     "energy": 2,
     "ultRefund": 20
    }
   ],
   "link": "answer",
   "caps": [
    "energy_per_answer",
    "rage_loop"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波詠唱題答對時額外 +2 能量；放完絕招回 20 怒氣（和「不滅鬥志」不疊加，取 30；兩次絕招至少相隔 10 秒）。",
   "evo": null,
   "icon": "sentence-sword",
   "art": "騎士的劍身纏著一條發光的英文句子緞帶。",
   "phase": 1,
   "plain": "多答一題回能量"
  },
  {
   "id": "c_duo_frostbolt",
   "name": "霜雷連鎖",
   "desc": "閃電打到的怪會結凍",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "thunder",
    "frost"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_reload",
     "c_chill"
    ],
    "stage": 3
   },
   "fx": [
    {
     "op": "onHit",
     "type": "mage",
     "branch": "A",
     "fx": "freeze",
     "t": 0.4,
     "p": 1,
     "icd": 3,
     "bossMul": 0.3
    },
    {
     "op": "custom",
     "id": "wolfFreeze",
     "t": 0.4,
     "icd": 3,
     "bossMul": 0.3
    }
   ],
   "link": "energy",
   "caps": [
    "freeze"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波雷電塔的連鎖閃電、雷狼的閃電打到的怪凍住 0.4 秒（魔王 0.12 秒）；同一隻怪 3 秒內只會被這張卡凍 1 次。",
   "evo": null,
   "icon": "frost-bolt",
   "art": "一道藍白交錯的閃電，把一隻蝙蝠凍成冰塊。",
   "phase": 1,
   "plain": "閃電打到的怪結凍"
  },
  {
   "id": "c_duo_teamwork",
   "name": "夥伴默契",
   "desc": "答對加快同伴大招",
   "rarity": "legend",
   "faction": null,
   "duo": [
    "flame",
    "thunder"
   ],
   "dur": "wave",
   "req": {
    "all": [
     "c_compdrill",
     "c_cheer"
    ],
    "stage": 10,
    "companion": true
   },
   "fx": [
    {
     "op": "custom",
     "id": "compCdEveryN",
     "every": 3,
     "sec": 6,
     "perWave": 12
    }
   ],
   "link": "answer",
   "caps": [
    "comp_ult_cd"
   ],
   "endless": {
    "dur": {
     "waves": 3
    }
   },
   "text": "本波每累積答對 3 題，所有同伴的大招冷卻 −6 秒（本波最多 −12 秒；大招仍要花能量）。",
   "evo": null,
   "icon": "teamwork",
   "art": "精靈和法師一起在黑板前寫答案，轉頭互相比讚。",
   "phase": 1,
   "plain": "答對加快同伴大招"
  }
 ]
};
})(typeof window !== "undefined" ? window : globalThis);
