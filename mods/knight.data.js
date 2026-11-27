// 騎士技能樹、絕招、徽章組資料：由 node _data/gen_data.mjs 從 _data/knight_tree.json 產生，勿手改（格式見 mods/CONTRACT_v3.md）
(function (root) {
  const TG = root.TG || (typeof require !== "undefined" ? require("../engine.js") : null);
  if (!TG) return;
  TG.DATA_KNIGHT = {
 "_about": "文法片語守衛戰 v3：文法騎士的經驗曲線、怒氣、三絕招、技能樹、文法徽章組、戰力封頂（機器可讀）。說明見 _research/騎士技能樹與徽章_2026-11-22.md。數值是初稿，接 regression 模擬後再校正。節點欄位沿用技術盤點 3.2 的 TG.KNIGHT.TREE 格式（id/path/tier/cost/need/lv/badge/fx），另加 name/desc/fxGold/fxAlt/capstone。整合負責人若在 mods/CONTRACT_v3.md 另定格式，以合約為準改欄位名，數值不變。",
 "version": 1,
 "date": "2026-11-22",
 "level": {
  "max": 20,
  "xpNeed_note": "xpNeed[lv] = 從 lv 升到 lv+1 需要的經驗；index 0 不用。第 19→20 級（800）比 18→19 級（1000）便宜，避免最後一級卡死。",
  "xpNeed": [
   0,
   120,
   150,
   200,
   250,
   280,
   320,
   360,
   400,
   440,
   520,
   560,
   600,
   640,
   680,
   760,
   840,
   920,
   1000,
   800
  ],
  "xpCum_note": "xpCum[lv] = 從 1 級到 lv 級的累積經驗",
  "xpCum": [
   0,
   0,
   120,
   270,
   470,
   720,
   1000,
   1320,
   1680,
   2080,
   2520,
   3040,
   3600,
   4200,
   4840,
   5520,
   6280,
   7120,
   8040,
   9040,
   9840
  ],
  "pointsPerLevel": 2,
  "points_note": "可用技能點 = 2 ×（等級 − 1）− 已花；技能點不存檔，用算的。20 級共 38 點。",
  "evoLv": [
   5,
   10,
   15,
   20
  ],
  "botLvByCleared_note": "regression 的 realProg 改用這張表（一般玩家模擬，見說明文件 1.4）；舊公式 1+floor(cleared/2) 作廢。",
  "botLvByCleared": [
   3,
   4,
   5,
   6,
   7,
   7,
   8,
   9,
   9,
   10,
   11,
   12,
   12,
   12,
   13,
   13,
   14,
   14,
   15,
   15,
   16,
   16,
   16
  ],
  "migrate_note": "舊存檔 S.hero.lv 保留不降級；S.hero.xp 夾在 0 ～ xpNeed[lv]−1；新增 S.hero.day = { d: 本地日期字串, ax: 今天已拿的答題經驗 }。"
 },
 "xp": {
  "perCostPoint": 10,
  "costPoint": {
   "choice": 1,
   "spell": 1.5,
   "fix": 1.5,
   "order": 3
  },
  "firstTryMul": 1,
  "retryMul": 0.5,
  "wrong": 0,
  "revengeBonus": 5,
  "wordBulletFirstHit": 2,
  "chantQuestion_note": "詠唱題、營地題、魔王骷髏題都照一般題給經驗（它們都是真的答題）",
  "dailyQuota": {
   "fullAnswerXp": 600,
   "afterMul": 0.5,
   "appliesTo": "answerXpOnly",
   "reset": "localMidnight",
   "note": "每天前 600 點答題經驗（＝60 題選擇題答對）全額，之後半額；不會歸零。過關獎勵、每日獎勵不吃額度。"
  },
  "stage": {
   "winBase": 20,
   "perStar": 10,
   "firstClear": 30,
   "heroic": 40,
   "lose": 0,
   "practiceStageMul": 0.5,
   "practiceAnswerMul": 1
  },
  "endless": {
   "perWave": 5,
   "max": 120
  },
  "dailyReward_note": "modes 每日獎勵的英雄經驗建議改成 50 + 10×連續天數（最多 120），不吃每日額度；原本 100+20×day+10×week 在新曲線下太大。",
  "dailyReward": {
   "base": 50,
   "perDay": 10,
   "max": 120
  }
 },
 "rage": {
  "max": 100,
  "startOfStage": 0,
  "gain": {
   "choiceFirst": 20,
   "choiceRetry": 10,
   "spell": 20,
   "fix": 20,
   "be": 20,
   "order": 20,
   "orderNote": "排句錯 <2 次算答對；錯 ≥2 次算錯（0）",
   "wordBullet": 5,
   "camp": 20,
   "chant": 0,
   "wrong": 0,
   "timeoutOrSkip": 0
  },
  "feverGain": {
   "choiceFirst": 30,
   "choiceRetry": 15,
   "other": 30,
   "wordBullet": 5
  },
  "block": {
   "perSec": 1,
   "capPerWave": 15,
   "rule": "騎士擋住 ≥1 隻地面怪的每一秒 +1（不論擋幾隻）；盾牆期間也算"
  },
  "infuse": {
   "energy": 2,
   "rage": 20,
   "perWave": 1,
   "note": "選用：花 2 能量灌注 20 怒氣，每波最多 1 次"
  },
  "campCard": 40,
  "overflow": "discard",
  "minCastInterval": 30,
  "minCastInterval_note": "兩次絕招之間最少 30 秒遊戲時間（＝舊制冷卻），怒氣照樣累積但不超過 100",
  "keepAfterCastMax": 40
 },
 "chant": {
  "questions": 1,
  "time": 12,
  "okMul": 1.5,
  "wrongMul": 1,
  "secondChance": false,
  "kinds": [
   "fill",
   "fill2",
   "dlg"
  ],
  "pool_note": "從本關文法點抽，優先掌握度最低的點；計入題量預算（1 點）。預算用完時只能直接放（×1.0），不扣任何東西。",
  "tier": "1＝直接放；2＝詠唱答對；3＝詠唱答對且（狂熱中 或 魔王在場 或 對應路線徽章組有金牌）。等級只影響演出，不影響傷害。"
 },
 "ults": {
  "_common": "dmg＝騎士當下 stats.dmg；p＝施放倍率（直接放 1.0、詠唱答對 1.5，再乘節點倍率，總和上限 2.5）；Pc＝控場倍率＝1＋0.5×(p−1)；所有傷害再乘 TG.powMul(s)。魔王的暈眩時間 ×0.3。",
  "wall": {
   "name": "盾牆",
   "unlock": {
    "lv": 1
   },
   "radius": 60,
   "duration": 6,
   "durationScale": "Pc",
   "durationCap": 10,
   "blockAll": true,
   "fly": false,
   "selfDamageTaken": 0.5,
   "strike": {
    "mul": 6,
    "pierce": true,
    "fly": false
   },
   "desc": "擋住半徑 60 內所有地面怪 6 秒（不限擋怪數），騎士受傷減半；開場重擊 6 倍傷害。"
  },
  "tense3": {
   "name": "時態三連斬",
   "unlock": {
    "lv": 5,
    "any": [
     {
      "stageCleared": 6
     },
     {
      "badgeGroupAny": [
       "C",
       "D"
      ],
      "tier": "bronze",
      "n": 1
     }
    ]
   },
   "duration": 0.6,
   "hitAt_note": "每一刀在施放後第幾秒（遊戲時間）結算；依演出等級 1／2／3 分表，第 4 個值給 b6 完成斬。由 mods/knight.fx.ui.js 的刀光真實時間（0.05+0.13k／0.09+0.19k／0.15+0.25k 秒）扣掉開場停格、每刀停格並乘上慢動作倍率換算，讓扣血與刀光對齊；沒有演出（node 模擬）時照這張表跑，三刀都在 0.6 秒內。",
   "hitAt": {
    "1": [
     0,
     0.13,
     0.26,
     0.39
    ],
    "2": [
     0,
     0.15,
     0.31,
     0.47
    ],
    "3": [
     0,
     0.05,
     0.1,
     0.15
    ]
   },
   "hits": [
    {
     "id": "past",
     "label": "was",
     "radius": 70,
     "mul": 4,
     "fly": true,
     "pushBack": 20,
     "pushBackBoss": 5
    },
    {
     "id": "present",
     "label": "is",
     "radius": 60,
     "mul": 3,
     "fly": true,
     "stun": 1.2,
     "stunScale": "Pc",
     "stunCap": 2
    },
    {
     "id": "future",
     "label": "will be",
     "radius": 120,
     "mul": 9,
     "targets": 1,
     "pick": "bossFirstThenMaxHp",
     "fly": true,
     "vuln": 0.25,
     "vulnTime": 5
    }
   ],
   "desc": "0.6 秒三刀：過去斬 70 內 4 倍並往回推；現在斬 60 內 3 倍並暈 1.2 秒；未來斬打血最多的一隻（魔王優先）9 倍並標記多受 25% 傷害 5 秒。可打飛行。"
  },
  "beWrath": {
   "name": "Be 之怒",
   "unlock": {
    "any": [
     {
      "lv": 10
     },
     {
      "lv": 7,
      "badgeAll": [
       "G01",
       "G03"
      ],
      "tier": "silver"
     }
    ]
   },
   "rings": [
    {
     "label": "am",
     "radius": 50,
     "mul": 2
    },
    {
     "label": "is",
     "radius": 80,
     "mul": 2
    },
    {
     "label": "are",
     "radius": 110,
     "mul": 2
    }
   ],
   "ringsNote": "三圈各打一次，站在最內圈的怪共吃 3 次（6 倍）",
   "fly": true,
   "stun": 0.8,
   "stunScale": "Pc",
   "stunCap": 2,
   "armorZeroTime": 6,
   "beBossMaxHpCut": 0.05,
   "beBossCutPerStage": 2,
   "noSkipMechanics": "Be 小怪不會被秒殺（仍要點對主詞）、字盾不會被打破（仍要拼字）——守紅線 1",
   "desc": "am／is／are 三圈震波（半徑 50／80／110，各 2 倍傷害），全部暈 0.8 秒、護甲歸零 6 秒；Be 巨人魔王額外扣 5% 最大血（每關最多 2 次）。"
  },
  "equipSlots": 1,
  "equipWhen": "出征簡報選；關卡中不能換"
 },
 "tree": {
  "paths": [
   {
    "id": "guard",
    "name": "守護",
    "role": "擋路、坦、盾牆控場；怒氣也能靠擋怪來；適合還在練英文、想穩穩過關的孩子"
   },
   {
    "id": "blade",
    "name": "劍術",
    "role": "單體高輸出、打魔王、打飛行；配時態三連斬；適合會操作的孩子"
   },
   {
    "id": "chant",
    "name": "詠唱",
    "role": "怒氣與詠唱加成、範圍輸出、Be 之怒；英文答得越準越強"
   }
  ],
  "tierLv": [
   3,
   5,
   7,
   10,
   15,
   20
  ],
  "pathTotal": 20,
  "treeTotal": 60,
  "pointsAtMax": 38,
  "rules": {
   "capstoneLimit": 1,
   "capstoneLimit_note": "三條路線的 20 級終極節點只能學 1 個 → 38 點最多＝一條全滿（20）＋第二條除終極外全滿（16）＋2 點",
   "reset": "free",
   "resetWhen": "關卡外隨時",
   "badgeNodesOptional": "徽章節點都不是任何節點的前置；不拿徽章，三條主線（不含徽章節點）仍有 16+12+12＝40 點可花 ≥ 38",
   "autoFirstTime": [
    "g1",
    "b1",
    "c1"
   ],
   "autoFirstTime_note": "第一次開技能樹（3 級、4 點）自動點三條路線的第一格，剩 1 點讓孩子自己選；之後推薦路線：新手推薦守護",
   "validate": "TG.knightValid(tree, lv, badges)：依 tier 由低到高收，等級不夠／前置沒學／徽章不夠／點數不夠／終極超過 1 個就退，比照 TG.talentValid"
  },
  "fxKeys": {
   "stat.hpMul": "最大血量乘數（同類加法池：多個 +% 先相加）",
   "stat.dmgAdd": "普攻每下傷害 +%（加法池）",
   "stat.bossDmgAdd": "對魔王普攻 +%（加法池）",
   "stat.cdMul": "普攻間隔乘數（攻速）",
   "stat.block": "擋怪數加",
   "stat.regenAdd": "每秒回血加",
   "stat.regenMul": "每秒回血乘數（g5 不屈、gB 金牌守位）",
   "stat.pierce": "普攻穿甲值（引擎現在是 2）",
   "stat.fly": "普攻可打飛行",
   "rage.answerMul": "答題怒氣乘數",
   "rage.blockPerSec / rage.blockCap": "擋怪怒氣每秒與每波上限",
   "rage.keepAfterCast": "放完絕招後保留的怒氣",
   "chant.*": "詠唱規則",
   "ult.<id>.*": "只在裝備該絕招時生效",
   "ult.any.*": "任何絕招都生效",
   "rule.*": "改規則型效果，參數寫在物件裡",
   "fxAlt": "沒有裝備該路線的絕招時改用這個效果（避免點數浪費）",
   "fxGold": "徽章組金牌 ≥ 指定數量時，取代 fx 的強化版（不用多花點數）"
  },
  "nodes": [
   {
    "id": "g1",
    "path": "guard",
    "tier": 1,
    "lv": 3,
    "cost": 1,
    "need": null,
    "badge": null,
    "name": "鐵壁",
    "fx": {
     "stat": {
      "hpMul": 0.15,
      "regenAdd": 3
     }
    },
    "desc": "騎士血量 +15%、每秒回血 +3。"
   },
   {
    "id": "g2",
    "path": "guard",
    "tier": 2,
    "lv": 5,
    "cost": 2,
    "need": "g1",
    "badge": null,
    "name": "站穩",
    "fx": {
     "stat": {
      "block": 1
     }
    },
    "desc": "同時多擋 1 隻怪。"
   },
   {
    "id": "g3",
    "path": "guard",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "g2",
    "badge": null,
    "name": "越擋越怒",
    "fx": {
     "rage": {
      "blockPerSec": 2,
      "blockCap": 25
     }
    },
    "desc": "擋怪時每秒怒氣 +2（原本 +1），每波最多 25（原本 15）。"
   },
   {
    "id": "gA",
    "path": "guard",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "g2",
    "badge": {
     "group": "A",
     "tier": "silver",
     "n": 2
    },
    "name": "冠詞盾陣",
    "fx": {
     "rule": {
      "blockedVuln": 0.15
     }
    },
    "fxGold": {
     "rule": {
      "blockedVuln": 0.22
     }
    },
    "desc": "被騎士擋住的怪，受到所有傷害 +15%（金牌組 +22%）。屬於「易傷」，和其他易傷取最大值、不相加。"
   },
   {
    "id": "g4",
    "path": "guard",
    "tier": 4,
    "lv": 10,
    "cost": 3,
    "need": "g3",
    "badge": null,
    "name": "盾牆・擴張",
    "fx": {
     "ult": {
      "wall": {
       "radius": 80,
       "durationAdd": 1.5,
       "selfDamageTaken": 0.35
      }
     }
    },
    "fxAlt": {
     "ult": {
      "any": {
       "afterCastGuard": {
        "time": 4,
        "damageTaken": 0.65,
        "block": 2
       }
      }
     }
    },
    "desc": "盾牆半徑 60→80、持續 +1.5 秒、盾牆中受傷 50%→35%。沒裝盾牆時：放任何絕招後 4 秒受傷 −35%、多擋 2 隻。"
   },
   {
    "id": "gB",
    "path": "guard",
    "tier": 4,
    "lv": 10,
    "cost": 2,
    "need": "g3",
    "badge": {
     "group": "B",
     "tier": "silver",
     "n": 2
    },
    "name": "方位守衛",
    "fx": {
     "rule": {
      "standGuard": {
       "after": 2,
       "block": 1,
       "rangeAdd": 8
      }
     }
    },
    "fxGold": {
     "rule": {
      "standGuard": {
       "after": 2,
       "block": 1,
       "rangeAdd": 8,
       "damageTaken": 0.8,
       "regenMul": 1.5
      }
     }
    },
    "desc": "騎士站定 2 秒後進入「守位」：多擋 1 隻、攻擊距離 +8；一移動就解除。金牌組：守位時再受傷 −20%、回血 ×1.5。"
   },
   {
    "id": "g5",
    "path": "guard",
    "tier": 5,
    "lv": 15,
    "cost": 4,
    "need": "g4",
    "badge": null,
    "name": "不屈",
    "fx": {
     "rule": {
      "lastStand": {
       "perStage": 1,
       "keepHp": 1,
       "wall": 3
      },
      "reviveCut": 3
     },
     "stat": {
      "regenMul": 1.5
     }
    },
    "desc": "每關 1 次：受到致命傷時留 1 滴血並自動張開 3 秒盾牆（不耗怒氣、不算放絕招）；倒下復活快 3 秒；回血 ×1.5。"
   },
   {
    "id": "g6",
    "path": "guard",
    "tier": 6,
    "lv": 20,
    "cost": 4,
    "need": "g5",
    "badge": null,
    "capstone": true,
    "name": "城牆之誓",
    "fx": {
     "ult": {
      "wall": {
       "durationAdd": 2,
       "radiusAdd": 20
      },
      "any": {
       "castWall": 3,
       "wallTowerSpd": 0.1
      }
     }
    },
    "desc": "放任何絕招時同時張開 3 秒盾牆（裝盾牆時改成盾牆 +2 秒、半徑 +20）；盾牆期間全塔攻速 +10%（算進全塔攻速加法池）。"
   },
   {
    "id": "b1",
    "path": "blade",
    "tier": 1,
    "lv": 3,
    "cost": 1,
    "need": null,
    "badge": null,
    "name": "磨劍",
    "fx": {
     "stat": {
      "dmgAdd": 0.12
     }
    },
    "desc": "普攻傷害 +12%。"
   },
   {
    "id": "b2",
    "path": "blade",
    "tier": 2,
    "lv": 5,
    "cost": 2,
    "need": "b1",
    "badge": null,
    "name": "快劍",
    "fx": {
     "stat": {
      "cdMul": 0.875
     }
    },
    "desc": "普攻間隔 0.8→0.7 秒（攻速約 +14%）。"
   },
   {
    "id": "b3",
    "path": "blade",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "b2",
    "badge": null,
    "name": "破甲斬",
    "fx": {
     "stat": {
      "pierce": 6,
      "bossDmgAdd": 0.15
     }
    },
    "desc": "普攻穿甲 2→6；打魔王 +15%。"
   },
   {
    "id": "bC",
    "path": "blade",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "b2",
    "badge": {
     "group": "C",
     "tier": "silver",
     "n": 2
    },
    "name": "時態連擊",
    "fx": {
     "rule": {
      "tenseCrit": {
       "mul": 3,
       "every": 4
      }
     }
    },
    "fxGold": {
     "rule": {
      "tenseCrit": {
       "mul": 3.5,
       "every": 3
      }
     }
    },
    "desc": "答對時態題（以擴充後的 TG.GEAR_TENSE 為準）後，下一下普攻 ×3 並揮出時態字，每 4 秒最多 1 次（金牌組 ×3.5、每 3 秒）。屬於「爆擊」，不和其他爆擊相乘。"
   },
   {
    "id": "b4",
    "path": "blade",
    "tier": 4,
    "lv": 10,
    "cost": 3,
    "need": "b3",
    "badge": null,
    "name": "三連斬・精煉",
    "fx": {
     "ult": {
      "tense3": {
       "mul": 1.25,
       "vuln": 0.35,
       "vulnTime": 6
      }
     }
    },
    "fxAlt": {
     "ult": {
      "any": {
       "afterCastHaste": {
        "time": 5,
        "cdMul": 0.77
       }
      }
     }
    },
    "desc": "時態三連斬每刀 +25%；未來斬標記 25%→35%、5→6 秒。沒裝三連斬時：放任何絕招後 5 秒普攻攻速 +30%。"
   },
   {
    "id": "bD",
    "path": "blade",
    "tier": 4,
    "lv": 10,
    "cost": 2,
    "need": "b3",
    "badge": {
     "group": "D",
     "tier": "silver",
     "n": 2
    },
    "name": "完成式・追擊",
    "fx": {
     "rule": {
      "killChase": {
       "mul": 1.5,
       "radius": 40,
       "every": 1,
       "fly": false
      }
     }
    },
    "fxGold": {
     "rule": {
      "killChase": {
       "mul": 2,
       "radius": 40,
       "every": 1,
       "fly": true
      }
     }
    },
    "desc": "騎士打倒怪時，對 40 內最近一隻怪補一刀 1.5 倍（每 1 秒最多 1 次，不連鎖、不爆擊）。金牌組：2 倍、打得到飛行怪。"
   },
   {
    "id": "b5",
    "path": "blade",
    "tier": 5,
    "lv": 15,
    "cost": 4,
    "need": "b4",
    "badge": null,
    "name": "飛斬",
    "fx": {
     "stat": {
      "fly": true
     },
     "rule": {
      "spearRangeAdd": 6
     },
     "ult": {
      "tense3": {
       "futureTargets": 2
      }
     }
    },
    "desc": "普攻打得到飛行怪（已裝片語長槍則改成攻擊距離 +6）；三連斬的未來斬改打 2 隻。"
   },
   {
    "id": "b6",
    "path": "blade",
    "tier": 6,
    "lv": 20,
    "cost": 4,
    "need": "b5",
    "badge": null,
    "capstone": true,
    "name": "第四段・完成斬",
    "fx": {
     "ult": {
      "tense3": {
       "extraHit": {
        "id": "perfect",
        "label": "has been",
        "radius": 80,
        "mul": 4,
        "onlyMarked": true,
        "countsAsMul": 1.25
       }
      }
     }
    },
    "fxAlt": {
     "ult": {
      "any": {
       "afterCastCrit": {
        "time": 8,
        "everyNth": 3,
        "mul": 3
       }
      }
     }
    },
    "desc": "三連斬多第 4 刀「完成斬」：80 內所有被標記的怪 4 倍。沒裝三連斬時：放任何絕招後 8 秒內，每第 3 下普攻 ×3（爆擊）。"
   },
   {
    "id": "c1",
    "path": "chant",
    "tier": 1,
    "lv": 3,
    "cost": 1,
    "need": null,
    "badge": null,
    "name": "朗讀",
    "fx": {
     "rage": {
      "answerMul": 1.2
     }
    },
    "desc": "答題得到的怒氣 ×1.2（答對 20→24，狂熱中 30→36）。擋怪怒氣不變。"
   },
   {
    "id": "c2",
    "path": "chant",
    "tier": 2,
    "lv": 5,
    "cost": 2,
    "need": "c1",
    "badge": null,
    "name": "沉著詠唱",
    "fx": {
     "chant": {
      "time": 16,
      "wrongMul": 1.15
     }
    },
    "desc": "詠唱題時間 12→16 秒；詠唱答錯也放 ×1.15（原本 ×1.0）。"
   },
   {
    "id": "c3",
    "path": "chant",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "c2",
    "badge": null,
    "name": "餘韻",
    "fx": {
     "rage": {
      "keepAfterCast": 20
     }
    },
    "desc": "放完絕招後怒氣留 20，不從 0 開始。"
   },
   {
    "id": "cE",
    "path": "chant",
    "tier": 3,
    "lv": 7,
    "cost": 2,
    "need": "c2",
    "badge": {
     "group": "E",
     "tier": "silver",
     "n": 2
    },
    "name": "句型共鳴",
    "fx": {
     "rule": {
      "campRage": 30
     }
    },
    "fxGold": {
     "rule": {
      "campRage": 45,
      "nextCastTierMin": 2
     }
    },
    "desc": "營地答對時騎士怒氣再 +30（每次營地 1 次）。金牌組：+45，而且下一次絕招演出至少第 2 級。"
   },
   {
    "id": "c4",
    "path": "chant",
    "tier": 4,
    "lv": 10,
    "cost": 3,
    "need": "c3",
    "badge": null,
    "name": "Be 之怒・擴音",
    "fx": {
     "ult": {
      "beWrath": {
       "radiusMul": 1.15,
       "stun": 1.2,
       "armorZeroTime": 8,
       "countsAsMul": 1.25
      }
     }
    },
    "fxAlt": {
     "ult": {
      "any": {
       "armorBreak": {
        "time": 6,
        "armor": -4
       }
      }
     }
    },
    "desc": "Be 之怒三圈半徑 ×1.15（58／92／127）、暈 0.8→1.2 秒、護甲歸零 6→8 秒。沒裝 Be 之怒時：絕招打到的怪 6 秒護甲 −4。"
   },
   {
    "id": "cF",
    "path": "chant",
    "tier": 4,
    "lv": 10,
    "cost": 2,
    "need": "c3",
    "badge": {
     "group": "F",
     "tier": "silver",
     "n": 2
    },
    "name": "子句連鎖",
    "fx": {
     "rule": {
      "chantVuln": {
       "vuln": 0.15,
       "time": 4
      }
     }
    },
    "fxGold": {
     "rule": {
      "chantVuln": {
       "vuln": 0.2,
       "time": 6
      }
     }
    },
    "desc": "詠唱答對時，全場怪 4 秒多受 15% 傷害（金牌組 20%、6 秒）。屬於「易傷」，和其他易傷取最大值。"
   },
   {
    "id": "c5",
    "path": "chant",
    "tier": 5,
    "lv": 15,
    "cost": 4,
    "need": "c4",
    "badge": null,
    "name": "連珠詠唱",
    "fx": {
     "chant": {
      "extraQ": {
       "bothOkMul": 1.8
      }
     }
    },
    "desc": "第 1 題答對後可以再答第 2 題：兩題都對 ×1.8；第 2 題答錯仍是 ×1.5。第 2 題也算題量預算。"
   },
   {
    "id": "c6",
    "path": "chant",
    "tier": 6,
    "lv": 20,
    "cost": 4,
    "need": "c5",
    "badge": null,
    "capstone": true,
    "name": "完美詠唱",
    "fx": {
     "chant": {
      "extraQ": {
       "bothOkMul": 2
      },
      "perfectRefund": 40,
      "perfectTier": 3
     }
    },
    "desc": "連珠詠唱兩題全對 → ×2.0（原 1.8），退還 40 怒氣，演出直接第 3 級。"
   }
  ]
 },
 "badges": {
  "mastery_note": "掌握度 M 照題庫擴充規格 5.4：只記第一次作答；題型權重 × 等級權重 × 兩週減半；最近 30 筆；扣掉亂猜也會對的比例；信心＝min(1, 筆數/12)。",
  "tiers": {
   "bronze": {
    "M": 60,
    "minN": 10,
    "shards": 5
   },
   "silver": {
    "M": 75,
    "minKinds": 3,
    "topLvCorrect": 3,
    "shards": 8
   },
   "gold": {
    "M": 85,
    "minKinds": 4,
    "mustInclude": [
     "trans",
     "trf",
     "sit"
    ],
    "minDays": 2,
    "shards": 12
   }
  },
  "phase1": {
   "note": "第 1 期只有 fill／fix／order 三種題型，fix、order 又只在特定場合出現 → 銀牌暫用「≥2 種題型」；金牌第 2 期新題型上線才開。已拿到的銀牌之後不收回。11-24 第二輪（試玩小華 P1-6：全破 35 個文法點只有 5 銀，掌握度 100 仍卡銅）：第 1 期改成「掌握度 ≥75＋答對過該文法點最高等級題 silverTopOk 題」，題型數 1 種就夠；第 2 期新題型上線時把 silverMinKinds 調回 3、拿掉 silverTopOk。",
   "silverMinKinds": 1,
   "silverTopOk": 5,
   "goldEnabled": false
  },
  "neverRevoke": true,
  "decayHint": "M 掉到門檻以下時徽章不收回，只顯示「需要保養」，每日一關優先抽",
  "migrate": "舊徽章（最近 10 題對 8 題）→ 銅牌；舊 key「片語」→ G14 銅；舊 key「文法」（原創題）保留給裝備 req 相容，不屬於任何組",
  "groups": [
   {
    "id": "A",
    "name": "詞類組",
    "path": "guard",
    "node": "gA",
    "members": [
     "G15",
     "G16",
     "G17",
     "G18",
     "G24"
    ],
    "theme": "名詞、代名詞、冠詞、There is／are、數量詞：句子的磚塊",
    "earliestStage": 1
   },
   {
    "id": "B",
    "name": "修飾組",
    "path": "guard",
    "node": "gB",
    "members": [
     "G07",
     "G08",
     "G10",
     "G22",
     "G23",
     "G29"
    ],
    "theme": "比較級、最高級、時間與地方介系詞、頻率副詞、連綴動詞：說清楚在哪、多常、多…",
    "earliestStage": 5
   },
   {
    "id": "C",
    "name": "時態一組",
    "path": "blade",
    "node": "bC",
    "members": [
     "G01",
     "G02",
     "G03",
     "G04",
     "G05",
     "G21"
    ],
    "theme": "be 動詞、第三人稱、過去式、進行式、do／does／did：現在與過去",
    "earliestStage": 1
   },
   {
    "id": "D",
    "name": "時態二組",
    "path": "blade",
    "node": "bD",
    "members": [
     "G06",
     "G11",
     "G12",
     "G25",
     "G26",
     "G34"
    ],
    "theme": "助動詞、完成式、被動、未來式、過去進行式、授與動詞與 used to：未來、完成與動詞變化",
    "earliestStage": 7
   },
   {
    "id": "E",
    "name": "句型組",
    "path": "chant",
    "node": "cE",
    "members": [
     "G19",
     "G20",
     "G30",
     "G32",
     "G33",
     "G35"
    ],
    "theme": "祈使句、疑問詞、It 句型、間接問句、附加問句、感嘆句：開口說整句",
    "earliestStage": 3
   },
   {
    "id": "F",
    "name": "子句組",
    "path": "chant",
    "node": "cF",
    "members": [
     "G09",
     "G13",
     "G14",
     "G27",
     "G28",
     "G31"
    ],
    "theme": "不定詞與動名詞、關係代名詞、片語動詞、連接詞、副詞子句、感官使役：把句子接起來",
    "earliestStage": 12
   }
  ],
  "groupRules": {
   "unlockNode": {
    "tier": "silver",
    "n": 2
   },
   "goldNode": {
    "tier": "gold",
    "n": 2
   },
   "cosmetic": [
    {
     "need": "組內全部銅牌",
     "reward": "盔甲上出現該組徽紋"
    },
    {
     "need": "六組各 ≥1 金牌",
     "reward": "稱號「文法聖騎士」與披風顏色"
    }
   ]
  },
  "companionHint": "（給外掛適配組參考，非騎士範圍）同伴的徽章加成可沿用這 6 組：B 組→冰雪法師、D 組→龍騎士、F 組（G14）→精靈弓手。"
 },
 "caps": {
  "addPools": "同一類的 +% 先相加再乘：普攻傷害池（b1、b3 打魔王）、血量池、全塔攻速池（狂熱、營地卡、g6）",
  "atkHitMulMax": 3,
  "atkSpeedMulMax": 2.8,
  "atkSpeedMul_note": "普攻間隔最低 0.8/2.8 ≈ 0.29 秒",
  "atkSustainMax": 5,
  "atkSustain_note": "每下倍率 × 攻速倍率 ≤ 5.0（相對 stats(lv)）",
  "crit": "爆擊（bC、b6 替代效果）同一下只取最大的一個，不相乘；都有每 N 秒／每第 N 下的頻率限制",
  "chain": "連鎖（關係戒指、bD 追擊）打出的傷害不再連鎖、不爆擊",
  "vulnMax": 0.35,
  "vulnMaxBoss": 0.2,
  "vuln_note": "易傷（未來斬標記、gA、cF、手套與破盾之眼除外）取最大值、不相加；手套與破盾之眼是字盾專用，維持現狀",
  "ultScaleMax": 2.5,
  "ultScale_note": "絕招直接倍率＝詠唱倍率 × 節點倍率（b4 1.25、b6 1.25、c4 1.25 等），上限 2.5",
  "controlScale": "Pc＝1＋0.5×(p−1)；盾牆最長 10 秒、暈眩最長 2 秒、魔王暈眩 ×0.3",
  "minCastInterval": 30,
  "keepAfterCastMax": 40,
  "towerSpdPoolMax": 0.5
 },
 "teamPower": {
  "_note": "新隊伍戰力建議（取代 TG.teamPower 的等級比與 TG.towerPower）。分兩個數：顯示用戰力（含一切，給孩子看『變強了』）、加難用配裝倍率 R（只量怎麼配，不量練了多少）。",
  "standardAnswering": {
   "perMin": 4,
   "firstTry": 0.65,
   "retryOk": 0.5,
   "chantAlways": true
  },
  "display": "戰力 = round( (A + U) × F + 同伴輸出 + 召喚輸出 )，A＝普攻有效輸出、U＝絕招每秒等效輸出、F＝坦度係數；全部用標準作答估，不看這局實際答題",
  "A": "stats.dmg × min(3.0, 武器期望倍率 × (1+傷害池)) ÷ cd × min(2.8, 攻速期望倍率) × (1 + 連鎖期望) × 0.6",
  "U": "絕招基準值 × stats.dmg × min(2.5, 節點倍率 × 標準詠唱倍率) ÷ 標準施放間隔；基準值：盾牆 33、三連斬 34、Be 之怒 36（已含控場折算）",
  "interval": "max(30, 60 × (100 − 保留怒氣) ÷ 標準怒氣每分)；標準怒氣每分＝59 × 答題怒氣乘數 ＋ min(每波上限, 40 × 擋怪每秒) × 0.75",
  "F": "(1 + 0.15 × 多擋的隻數) × (有效血量 ÷ 基本血量)^0.3",
  "R": "戰力(你的配置) ÷ 戰力(同等級、同裝備件數的參考配置)；兩邊都不算徽章節點、金牌強化、裝備星數，等級一律用你的實際等級",
  "referenceBuild": {
   "tree": "依點數先點守護主線、再劍術主線、再詠唱主線（不含徽章節點）",
   "ult": "wall",
   "gear": "TG.gearBotLoadout(cleared)，一律 ★1"
  },
  "hpMul": "powerHpMul = 1 + U[區] × clamp((R − 1.15) ÷ 0.35, 0, 1)",
  "U_byRegion": [
   0,
   0.05,
   0.1,
   0.1,
   0.15
  ],
  "excluded": [
   "本局答對率",
   "本局答題數",
   "塔等級（towerPower 移除）",
   "英雄／同伴／召喚獸等級相對進度",
   "徽章與金牌",
   "裝備星數"
  ],
  "noPowerUp": [
   "英雄挑戰",
   "鐵人",
   "騎士試煉"
  ],
  "estimate_note": "粗估（Lv20、標準作答）：參考配置 R=1.00；劍術＋匕首★3＋三連斬 1.12；詠唱滿＋三連斬 1.06；守護滿＋盾牆 0.95；詠唱滿＋Be 之怒 0.93；完全不點樹 0.47。正常配法都落在 1.15 以下，只有刻意疊同類加成才會加血，而且最多 +15%。"
 }
};
})(typeof window !== "undefined" ? window : globalThis);
