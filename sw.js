/* RL_FRESH_START — 2026-10-19 全家族「離線要有，但不能擋更新」（母版：04_管理工具\PWA新鮮度\rl_fresh_sw.js，用 apply.py 重新套用，不要在這裡手改）
   問題：原本 fetch 對網頁本身也是 cache-first → 重整先畫舊畫面、發新版要開兩次才看得到。
   做法：這段排在 sw.js 最前面、最先註冊 fetch：網頁／程式／樣式／資料（.html .js .mjs .css .json 與導覽）一律先拿線上最新的，
   4 秒沒回應或離線才用快取；成功時存一份到 rl-fresh 快取，離線也有最新版可用。
   圖片、字型、地圖圖磚等其他檔案不攔，交給原本的 handler（照舊 cache-first）。
   攔下的請求呼叫 stopImmediatePropagation()，原本的 fetch handler 不會再處理同一個請求。 */
(function(){
  var FRESH = 'grammar-guard-fresh';
  var CODE = /\.(?:html?|m?js|css|json|webmanifest)$/i;
  function fromCache(req){
    return caches.match(req).then(function(r){
      if (r) return r;
      return caches.match(req, { ignoreSearch: true }).then(function(r2){
        if (r2 || req.mode !== 'navigate') return r2;
        return caches.match('./').then(function(r3){ return r3 || caches.match('./index.html') || caches.match('index.html'); });
      });
    });
  }
  function fresh(e, req){
    var net = fetch(req).then(function(res){
      if (res && res.ok && res.type === 'basic'){
        var copy = res.clone();
        e.waitUntil(caches.open(FRESH).then(function(c){ return c.put(req, copy); }).catch(function(){}));
      }
      return res;
    });
    var timer = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 4000); });
    return Promise.race([net.catch(function(){ return null; }), timer]).then(function(res){
      if (res && (res.ok || res.status === 304 || res.type === 'opaqueredirect')) return res;
      return fromCache(req).then(function(c){
        if (c) return c;
        return net.catch(function(){ return Response.error(); });   /* 快取也沒有：再等網路（可能只是慢） */
      });
    });
  }
  self.addEventListener('fetch', function(e){
    var req = e.request;
    if (req.method !== 'GET') return;
    var url; try { url = new URL(req.url); } catch (x) { return; }
    if (url.origin !== self.location.origin) return;
    if (url.pathname.indexOf('/api/') === 0) return;          /* 有自己 API 的 App（Worker）交給原本邏輯 */
    var isDoc = req.mode === 'navigate' || url.pathname.slice(-1) === '/' || CODE.test(url.pathname);
    if (!isDoc) return;
    if (url.pathname.slice(-6) === '/sw.js' || url.pathname === '/sw.js') return;
    e.stopImmediatePropagation();
    e.respondWith(fresh(e, req));
  });
})();
/* RL_FRESH_END */
/* 929 文法片語守衛戰：預快取（離線可玩）。CACHE 版號由 CI stamp-version.mjs 蓋掉。 */
const CACHE = 'grammar-guard-v14';
const PRECACHE = ["./","index.html","engine.js","words.js","questions_db.js","art/art-sprites.js","art/art-map.js","art/region-meadow.js","art/region-swamp.js","art/region-ice.js","art/region-volcano.js","mods/juice.ui.js","mods/creatures.js","mods/creatures.ui.js","mods/bosses.js","mods/bosses.ui.js","mods/stageboss.js","mods/stageboss.ui.js","mods/terrain.js","mods/terrain.ui.js","mods/companions.js","mods/companions.ui.js","mods/knight.js","mods/knight.ui.js","mods/gear.js","mods/gear.ui.js","mods/modes.js","mods/modes.ui.js","mods/trial.js","mods/trial.ui.js","mods/coach.js","mods/coach.ui.js","mods/wordbullet.js","mods/wordbullet.ui.js","mods/qkinds.js","mods/qcard.ui.js","mods/qpanel.ui.js","mods/camp.ui.js","mods/cards.data.js","mods/knight.data.js","art/knight-art.js","mods/knight.fx.ui.js","mods/team.ui.js","mods/flow.ui.js","mods/prepfirst.ui.js","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png","favicon-32.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(err => console.warn('precache miss', u)))))); });   // 逐檔加：單一檔失敗不會讓整個 SW 裝不起來
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('grammar-guard-') && k !== CACHE && k !== 'grammar-guard-fresh').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  const d = e.data; if (d === 'SKIP_WAITING' || d === 'skipWaiting' || (d && (d.type === 'SKIP_WAITING' || d.action === 'skipWaiting'))) self.skipWaiting();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
