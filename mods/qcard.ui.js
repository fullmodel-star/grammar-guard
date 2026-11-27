// 外掛：qcard（畫面端）— v3 題卡元件：側邊答題面板、備戰營地、騎士詠唱共用的「一張題目卡」
// 負責：第 3 組（題卡元件）。合約：mods/CONTRACT_v3.md §6.3；題型欄位見 _research/題庫擴充規格_2026-11-22.md §2。
// 只輸出 HTML 字串＋綁定事件，不開面板、不碰遊戲狀態、不記作答（面板由 qpanel／camp 負責，作答紀錄由呼叫端走 §3）。
//
// 2026-11-22 第 3 組實作：
//   render(q, o) → card
//     o.compact  true＝側邊面板精簡版（字小一階、短選項排兩欄）；false（預設）＝營地／升級完整版
//     o.dense    精簡版再壓高度（直版手機地圖下方用）：字再小一點、間距更緊；卡片寬 ≥480px 時 4 個短選項排一列
//     o.gone     已拿掉的選項序號（第二次機會；暫停後重畫用）。正解永遠不會被拿掉
//     o.showZh   顯示中文（預設 true）
//     o.keys     鍵盤 1～4 作答（預設 true；同時有好幾張卡時，最後綁定、看得見的那張才收鍵盤）
//     o.opts     指定選項順序（暫停後重畫用；省略＝TG.shuffleOptions 洗牌）
//     o.rng      洗牌亂數（省略＝TGUI.rng／Math.random）
//     o.label    右上小標（例如文法點名稱，可省略）
//     o.draft    true＝允許畫第 2 期樣式稿題型（只給 art/qcard-sheet.html 用；遊戲裡不要傳）
//     o.step     改錯題樣式稿：1＝點錯字、2＝選正確寫法
//   card = { html, opts:[{t, ok}], kind, ok, right, bind(rootEl, onPick(i, opt)), mark(i, state), lock(), reveal(picked),
//            say(html, scroll), alive(), unbind() }
//     ok＝這題畫得出來（false 時 html 是「這題暫時不能作答」，opts 是空的，呼叫端應該換題或略過）
//     right＝正解在 opts 的序號；mark state："right"｜"wrong"｜"gone"｜"used"
//   explain(q, pickedText, o) → 解析 html（你選的 X 為什麼錯＋正確答案＋完整句＋為什麼）；o.answer:false 不印正確答案
//   retry(q, pickedText) → 第二次機會提示 html（「不是這個，再想一次」＋錯選項說明）
//   canRetry(card) → 剩下的選項 ≥3 才給第二次機會（只剩 2 個時拿掉一個等於送答案）；英雄挑戰／鐵人由呼叫端判斷
//   kinds：開放的題型（第 1 期只有 fill）；draft：只有樣式稿的題型（第 2 期，不開放）
// class 一律 qc- 開頭（qc-stem／qc-zh／qc-opts／qc-opt…），不再沿用舊 askQuestion 的 stem／zh／opts／opt，
// 免得被 index 的 .sheet.prep .opt、.sheet.qmode .opt 等舊規則蓋掉；樣式自帶（<style id="qcCss">），用容器寬度切版。
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.TGUI || !window.TG) return;
  const U = window.TGUI, TG = window.TG;

  // 跳脫：比 index 的 esc 多跳單引號（題目裡常有 Tom's、it's）
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kindOf = q => (TG.kindOf ? TG.kindOf(q) : (q && q.k) || "fill");
  const shuffle = (q, rng) => TG.shuffleOptions ? TG.shuffleOptions(q, rng) : q.o.map((t, i) => ({ t, ok: i === 0 }));
  const BLANK = "___";
  const SEP = "｜";   // 雙空格選項「A｜B」

  const KIND_NAME = { fill: "挖空選擇", fill2: "雙空格", fix: "改錯", order: "排句子", trans: "中翻英", dlg: "對話回應", trf: "句型轉換", sit: "情境選句" };
  const HOWTO = {
    fill: "選一個放進空格", fill2: "兩個空格一起選", trans: "選出意思一樣、文法正確的英文", dlg: "幫 B 選一句回答",
    trf: "照指示改寫句子", sit: "這時候你會怎麼說？", fix1: "點出寫錯的那個字", fix2: "要改成哪一個？", order: "點字卡，把句子排好"
  };
  const SENT_KINDS = ["trans", "dlg", "trf", "sit"];   // 選項是整句：一律一欄直排

  // 自繪小圖示（不用 emoji）
  const AV = (bg, hair) => '<svg class="qc-av" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="' + bg + '" stroke="#0b1424" stroke-width="1.5"/>' +
    '<circle cx="17" cy="15" r="7.5" fill="#f6dcc0"/><path d="M9.5 14c0-5 3.4-8 7.5-8s7.5 3 7.5 8c-2-2.6-4.6-3.4-7.5-3.4S11.5 11.4 9.5 14z" fill="' + hair + '"/>' +
    '<circle cx="14.3" cy="15.6" r="1.1" fill="#1d2433"/><circle cx="19.7" cy="15.6" r="1.1" fill="#1d2433"/><path d="M14.6 18.6q2.4 1.8 4.8 0" stroke="#1d2433" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M6.5 30c1.6-4.6 5.6-7 10.5-7s8.9 2.4 10.5 7" fill="#f6dcc0" opacity=".9"/></svg>';
  const IC_RETRY = '<svg class="qc-ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 6.5A6.5 6.5 0 1 0 16.5 11" fill="none" stroke="#F3D494" stroke-width="2.2" stroke-linecap="round"/><path d="M16.8 2.8v4.6h-4.6" fill="none" stroke="#F3D494" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const IC_ARROW = '<svg class="qc-ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v12M5 10.5l5 5 5-5" fill="none" stroke="#F3D494" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ── 題幹工具
  // 把已跳脫的句子裡的 ___ 換成空格框；fill2 依序加 ①②
  function blanks(escText, two) {
    let n = 0;
    return escText.split(BLANK).reduce((acc, part, i) => i === 0 ? part : acc + '<span class="qc-blank" data-qc-blank="' + (n++) + '">' + (two ? "<i>" + (n === 1 ? "①" : "②") + "</i>" : "") + '<span class="qc-fillin"></span></span>' + part, "");
  }
  const parts = t => String(t).split(SEP);
  const optHtml = (kind, t) => kind === "fill2"
    ? parts(t).map((p, i) => '<span class="qc-p"><i>' + (i === 0 ? "①" : "②") + "</i>" + esc(p) + "</span>").join('<span class="qc-sep">／</span>')
    : esc(t);
  const TOK = /[A-Za-z0-9']+|[^\sA-Za-z0-9']/g;
  // 排句：照引擎 TG.makeOrder 的切法（空白切字、句尾標點另外放）
  function orderSplit(q) { const m = String(q.q).trim().match(/^(.*?)([.?!]*)$/); return { words: m[1].split(/\s+/).filter(Boolean), tail: m[2] }; }
  function tokens(text) { const out = []; let m; TOK.lastIndex = 0; while ((m = TOK.exec(text))) out.push({ t: m[0], at: m.index, word: /[A-Za-z0-9]/.test(m[0]) }); return out; }

  // ── 驗證：畫得出來才回 ok
  function valid(q, kind) {
    if (!q || typeof q.q !== "string" || !q.q.trim()) return false;
    const nb = q.q.split(BLANK).length - 1, no = Array.isArray(q.o) ? q.o.filter(x => typeof x === "string" && x.trim()).length : 0;
    if (kind === "fill") return nb === 1 && no >= 2;
    if (kind === "fill2") return nb === 2 && no >= 2 && q.o.every(x => parts(x).length === 2);
    if (kind === "dlg") return /\n/.test(q.q) && nb >= 1 && no >= 2;
    if (kind === "trans" || kind === "sit") return no >= 2;
    if (kind === "trf") return no >= 2 && !!q.ins;
    if (kind === "fix") return typeof q.bad === "string" && !!q.bad && q.q.indexOf(q.bad) >= 0 && no >= 1;
    if (kind === "order") return orderSplit(q).words.length >= 2;
    return false;
  }

  // ── 各題型的題幹（回傳已跳脫的 HTML）
  function stemHtml(q, kind, o) {
    const zhOn = o.showZh !== false && q.zh;
    if (kind === "fill" || kind === "fill2")
      return '<div class="qc-stem">' + blanks(esc(q.q), kind === "fill2") + "</div>" + (zhOn ? '<div class="qc-zh">中文：' + esc(q.zh) + "</div>" : "");
    if (kind === "trans")
      return '<div class="qc-box qc-zhq"><span class="qc-tag">中文句子</span><div class="qc-zhbig">' + esc(q.q) + "</div></div>";
    if (kind === "sit")
      return '<div class="qc-box qc-sit"><span class="qc-tag qc-tag-b">情境</span><div class="qc-sitq">' + esc(q.q) + "</div>" +
        (zhOn ? '<div class="qc-zhs">想表達的意思：' + esc(q.zh) + "</div>" : "") + "</div>";
    if (kind === "trf")
      return '<div class="qc-box qc-src"><span class="qc-tag">原句</span><div class="qc-en">' + esc(q.q) + "</div>" + (zhOn ? '<div class="qc-zhs">' + esc(q.zh) + "</div>" : "") + "</div>" +
        '<div class="qc-do">' + IC_ARROW + "<b>" + esc(q.ins) + "</b></div>";
    if (kind === "dlg") {
      const lines = q.q.split("\n"), zl = zhOn ? String(q.zh).split("\n") : [];
      return '<div class="qc-dlg">' + lines.map((ln, i) => {
        const m = ln.match(/^\s*([AB])\s*[:：]\s*(.*)$/), who = m ? m[1] : (i % 2 ? "B" : "A"), body = m ? m[2] : ln;
        const zh = zl[i] ? String(zl[i]).replace(/^\s*[AB]\s*[:：]\s*/, "") : "";
        const isB = who === "B";
        return '<div class="qc-line ' + (isB ? "qc-b" : "qc-a") + '">' + (isB ? AV("#8a6a2a", "#3a2412") : AV("#2f5d9a", "#1b1b22")) +
          '<div class="qc-bub"><span class="qc-who">' + (isB ? "B（你）" : "A") + "</span>" +
          (body.trim() === BLANK ? '<span class="qc-blank qc-blank-wide" data-qc-blank="0"><span class="qc-fillin"></span></span>' : blanks(esc(body), false)) +
          (zh ? "<small>" + esc(zh) + "</small>" : "") + "</div></div>";
      }).join("") + "</div>";
    }
    if (kind === "fix") {
      const bi = q.q.indexOf(q.bad), be = bi + q.bad.length;
      if (o.step === 2)
        return '<div class="qc-stem qc-stem-s">' + esc(q.q.slice(0, bi)) + '<s class="qc-bad">' + esc(q.bad) + "</s>" + esc(q.q.slice(be)) + "</div>" + (zhOn ? '<div class="qc-zh">中文：' + esc(q.zh) + "</div>" : "");
      return (zhOn ? '<div class="qc-zh">中文：' + esc(q.zh) + "</div>" : "");
    }
    if (kind === "order")
      return (zhOn ? '<div class="qc-zh qc-zh-big">中文：' + esc(q.zh) + "</div>" : "") + '<div class="qc-ansline"><span class="qc-ws" data-qc-line><span class="qc-ph">點下面的字卡</span></span>' + (orderSplit(q).tail ? '<span class="qc-endp">' + esc(orderSplit(q).tail) + "</span>" : "") + "</div>";
    return "";
  }

  // ── 選項
  function buildOpts(q, kind, o) {
    if (kind === "fix" && o.step !== 2) {
      const bi = q.q.indexOf(q.bad), be = bi + q.bad.length;
      return tokens(q.q).filter(x => x.word).map(x => ({ t: x.t, ok: x.at < be && x.at + x.t.length > bi, at: x.at }));
    }
    if (kind === "order") {
      const sp = orderSplit(q), w = sp.words.slice(), r = o.rng || U.rng || Math.random;
      for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[w[i], w[j]] = [w[j], w[i]]; }
      // 句首大寫會洩漏第一個字：照引擎 TG.tileCase 改成小寫（專有名詞、I 不改）
      const tile = TG.tileCase ? TG.tileCase(sp.words[0], sp.words) : sp.words[0];
      return w.map(t => ({ t: t === sp.words[0] ? tile : t, ok: false, pos: sp.words.indexOf(t) }));
    }
    return shuffle(q, o.rng || U.rng || Math.random);
  }

  function optsHtml(q, kind, opts, gone, o) {
    const keys = o.keys !== false;
    if (kind === "fix" && o.step !== 2) {
      // 句子本身就是選項：每個英文字是一顆按鈕，標點不能點
      // 標點黏在前一個字後面（同一組不換行），不會單獨掉到下一行
      let k = 0, h = "", open = false;
      for (const x of tokens(q.q)) {
        if (x.word) {
          if (open) h += "</span>";
          const g = gone.includes(k);
          h += '<span class="qc-tg"><button type="button" class="qc-tok' + (g ? " gone" : "") + '" data-qc="' + (k++) + '"' + (g ? " disabled" : "") + ">" + esc(x.t) + "</button>"; open = true;
        } else h += (open ? "" : '<span class="qc-tg">') + '<span class="qc-punct">' + esc(x.t) + "</span>", open = true;
      }
      return '<div class="qc-toks" role="group" aria-label="句子裡的字">' + h + (open ? "</span>" : "") + "</div>";
    }
    if (kind === "order")
      return '<div class="qc-toks qc-chips">' + opts.map((x, i) => '<button type="button" class="qc-tok qc-chip-w' + (gone.includes(i) ? " used" : "") + '" data-qc="' + i + '">' + esc(x.t) + "</button>").join("") + "</div>";
    const sent = SENT_KINDS.includes(kind) || opts.some(x => String(x.t).length > 18);
    const short = !sent && opts.every(x => String(x.t).length <= 10);
    // 精簡版兩欄只給 ≤8 個字母的選項（320 手機一欄約 75px 寬，再長就會被切成兩行）
    // 11-24 UIUX P0：側邊面板（dense）放寬到 ≤16 個字母也排兩欄（字太長就在按鈕裡換行），4 個選項不用捲就看得到、按得到
    const g2 = !sent && o.compact && opts.every(x => String(x.t).length <= (o.dense ? 16 : 8)) && (short || o.dense);
    const cls = "qc-opts" + (sent ? " qc-sent" : "") + (short ? " qc-short" : "") + (g2 ? " qc-g2" : "") + (g2 && opts.length === 4 && opts.every(x => String(x.t).length <= 8) ? " qc-n4" : "") + (keys ? "" : " qc-nokey");
    return '<div class="' + cls + '" role="group" aria-label="選項">' + opts.map((x, i) => {
      const g = gone.includes(i);
      return '<button type="button" class="qc-opt' + (g ? " gone" : "") + '" data-qc="' + i + '"' + (g ? ' disabled aria-disabled="true"' : "") + ">" +
        (keys && i < 9 ? '<span class="qc-key" aria-hidden="true">' + (i + 1) + "</span>" : "") + '<span class="qc-t">' + optHtml(kind, x.t) + "</span></button>";
    }).join("") + "</div>";
  }

  // ── 鍵盤：全頁只掛一個監聽，最後綁定、看得見、還沒作答完的那張卡收鍵
  const ACTIVE = [];
  let keyOn = false;
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !/^[1-9]$/.test(e.key)) return;
    const tg = e.target, tn = tg && tg.tagName;
    if (tn === "INPUT" || tn === "TEXTAREA" || tn === "SELECT" || (tg && tg.isContentEditable)) return;
    if (U.held) return;   // 遊戲暫停中的全畫面選單
    for (let i = ACTIVE.length - 1; i >= 0; i--) {
      const c = ACTIVE[i];
      if (!c.root || !c.root.isConnected) { ACTIVE.splice(i, 1); continue; }
      if (c.locked || !c.visible()) continue;
      // 有別的面板（升級題、暫停選單…）開著時，不在那個面板裡的卡不收鍵，避免一個按鍵答兩題
      if (U.sheetMode && !(c.root.closest && c.root.closest(".sheet"))) continue;
      const n = +e.key - 1;
      if (n >= c.n) return;
      e.preventDefault(); c.pick(n); return;
    }
  }
  function keyAttach(c) { if (typeof document === "undefined") return; if (!keyOn) { document.addEventListener("keydown", onKey); keyOn = true; } if (!ACTIVE.includes(c)) ACTIVE.push(c); }
  function keyDetach(c) { const i = ACTIVE.indexOf(c); if (i >= 0) ACTIVE.splice(i, 1); }

  function render(q, o) {
    o = o || {};
    const kind = kindOf(q);
    const allowed = qcard.kinds.includes(kind) || (o.draft && qcard.draft.includes(kind));
    if (!allowed || !valid(q, kind)) {
      const html = '<div class="qc qc-bad-q ' + (o.compact ? "qc-compact" : "qc-full") + '" data-qk="' + esc(kind) + '"><div class="qc-oops">這題暫時不能作答，請略過換下一題。</div><div class="qc-res" aria-live="polite"></div></div>';
      return { html, opts: [], kind, ok: false, right: -1, bind() { return this; }, mark() {}, lock() {}, reveal() {}, say() {}, alive: () => 0, unbind() {} };
    }
    const opts = Array.isArray(o.opts) && o.opts.length ? o.opts : buildOpts(q, kind, o);
    const right = opts.findIndex(x => x.ok);
    const gone = (o.gone || []).filter(i => Number.isInteger(i) && i >= 0 && i < opts.length && (kind === "order" || i !== right));
    const howKey = kind === "fix" ? (o.step === 2 ? "fix2" : "fix1") : kind;
    const head = (!o.compact || o.label || kind !== "fill")
      ? '<div class="qc-head"><span class="qc-how">' + esc(HOWTO[howKey] || "") + "</span>" + (o.label ? '<span class="qc-chip">' + esc(o.label) + "</span>" : "") + "</div>" : "";
    const html = '<div class="qc qc-k-' + kind + " " + (o.compact ? "qc-compact" : "qc-full") + (o.compact && o.dense ? " qc-dense" : "") + '" data-qk="' + kind + '">' + head + stemHtml(q, kind, o) + optsHtml(q, kind, opts, gone, o) + '<div class="qc-res" aria-live="polite"></div></div>';

    const card = {
      html, opts, kind, ok: true, right, root: null, locked: false, n: opts.length, _el: null, _h: null, _pick: null,
      visible() { const r = this.root; return !!r && r.isConnected && (r.offsetParent !== null || (r.getClientRects && r.getClientRects().length > 0)); },
      pick(i) {
        if (this.locked || !this._pick || !Number.isInteger(i) || i < 0 || i >= opts.length || gone.includes(i)) return;
        this._pick(i, opts[i]);
      },
      bind(el, onPick) {
        this.unbind();
        this._el = el; this.root = (el.classList && el.classList.contains("qc")) ? el : (el.querySelector(".qc") || el); this._pick = onPick;
        this._h = ev => { const b = ev.target && ev.target.closest ? ev.target.closest("[data-qc]") : null; if (b && el.contains(b) && !b.disabled) this.pick(+b.dataset.qc); };
        el.addEventListener("click", this._h);
        if (o.keys !== false && kind !== "order" && !(kind === "fix" && o.step !== 2)) keyAttach(this);
        return this;
      },
      unbind() { if (this._el && this._h) this._el.removeEventListener("click", this._h); this._h = null; keyDetach(this); },
      btn(i) { return this.root ? this.root.querySelector('[data-qc="' + i + '"]') : null; },
      mark(i, state) {
        if (state === "gone" || state === "used") { if (state === "gone" && i === right && kind !== "order") return; if (!gone.includes(i)) gone.push(i); }
        const b = this.btn(i); if (!b) return;
        b.classList.add(state);
        if (state === "gone") { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
        if (state === "right" && (kind === "fill" || kind === "fill2" || kind === "dlg") && this.root) {
          const ps = kind === "fill2" ? parts(opts[i].t) : [opts[i].t];
          this.root.querySelectorAll("[data-qc-blank]").forEach((s, k) => { const f = s.querySelector(".qc-fillin"); if (f && ps[k] != null) { f.textContent = ps[k]; s.classList.add("filled"); } });
        }
      },
      lock() { this.locked = true; if (this.root) this.root.querySelectorAll("[data-qc]").forEach(b => { b.disabled = true; }); keyDetach(this); },
      reveal(picked) { this.lock(); if (right >= 0) this.mark(right, "right"); if (Number.isInteger(picked) && picked >= 0 && picked !== right) this.mark(picked, "wrong"); },
      // scroll：true＝捲到解析（只在可捲動的面板裡用；側邊面板不要捲，免得動到地圖版面）
      say(h, scroll) { const r = this.root && this.root.querySelector(".qc-res"); if (!r) return; r.innerHTML = h || ""; if (scroll && h && r.lastElementChild && r.lastElementChild.scrollIntoView) try { r.lastElementChild.scrollIntoView({ block: "nearest" }); } catch (e) {} },
      alive() { return opts.length - gone.length; },
      gone
    };
    return card;
  }

  // 正確答案的完整句（已跳脫；答案部分用 <b>）
  function answerSentence(q, kind) {
    const a = q.o && q.o[0];
    if (kind === "fill") return esc(q.q).replace(BLANK, "<b>" + esc(a) + "</b>");
    if (kind === "fill2") { const p = parts(a); let k = 0; return esc(q.q).split(BLANK).reduce((acc, s, i) => i === 0 ? s : acc + "<b>" + esc(p[k++] || "") + "</b>" + s, ""); }
    if (kind === "dlg") return "B：<b>" + esc(a) + "</b>";
    if (kind === "fix") { const bi = q.q.indexOf(q.bad); return bi < 0 ? esc(q.q) : esc(q.q.slice(0, bi)) + "<b>" + esc(a) + "</b>" + esc(q.q.slice(bi + q.bad.length)); }
    if (kind === "order") return "<b>" + esc(q.q) + "</b>";
    return "<b>" + esc(a) + "</b>";
  }
  function whyHtml(q, picked, mask) {
    let w = picked != null && q && q.w && typeof q.w === "object" ? q.w[picked] : null;
    if (w && mask) w = maskAns(q, w);
    return w ? '<div class="qc-why">你選的「<b>' + esc(String(picked).split(SEP).join("／")) + "</b>」：" + esc(w) + "</div>" : "";
  }
  // 第二輪試玩 P1-17（2026-11-24）：第一次答錯只給「規則提示」，不講出正解（錯選項說明 61% 會順便寫出正解）
  //   ・RULE_HINT：每個文法點一句「想一想」的提示（只講怎麼判斷，不講這題答案）
  //   ・maskAns：錯選項說明裡出現正解字樣（不分大小寫、整個字）先換成「＿＿」；答完（finish）才顯示完整解析
  const RULE_HINT = {
    G01: "先看主詞是誰：I、一個人／一樣東西，還是 you 和好幾個？",
    G02: "這是過去的事：主詞是一個還是好幾個（you 算好幾個）？",
    G03: "主詞是不是 he、she、it 這種「一個」？說現在的事動詞要不要加 s？",
    G04: "句子裡有沒有 yesterday、last…、…ago？過去的事動詞要變成什麼樣子？",
    G05: "「正在做」要兩個東西一起出現：be 動詞，還有動詞的哪一種樣子？",
    G06: "前面有 can、will、must、don't 這類字嗎？它們後面的動詞要用什麼樣子？",
    G07: "句子裡有沒有 than（比…）？短的字和長的字變法不一樣。",
    G08: "是不是在說「最…」？前面有沒有 the？短的字和長的字變法不一樣。",
    G09: "看空格前面的動詞：它習慣接 to＋原形，還是接 V-ing？",
    G10: "空格後面是幾點鐘、星期幾某一天，還是月份季節年份？",
    G11: "前面有 have／has 嗎？它後面的動詞要用哪一種樣子？",
    G12: "主詞是自己做，還是「被」做？被做要 be 動詞加上動詞的哪一種樣子？",
    G13: "看空格前面的名詞：是人，還是東西？",
    G14: "這是一組固定搭配：把動詞和後面的小字連起來，想想整組的意思。",
    G15: "是一個還是好幾個？這個東西數得出來嗎？",
    G16: "這個字在句子裡是當主角、被做的人，還是「誰的」？",
    G17: "是第一次提到的一個，還是大家都知道是哪一個？後面的字開頭是不是母音的音？",
    G18: "後面要說的東西是一個（或數不完），還是好幾個？",
    G19: "是叫別人做事、叫別人不要做，還是邀大家一起做？",
    G20: "想想要問的是什麼：人、東西、地方、時間，還是原因？",
    G21: "一般動詞的問句和否定句要借 do／does／did：主詞是誰、是現在還是過去？",
    G22: "想像一下位置：在裡面、在表面上、在下面，還是在兩個中間？",
    G23: "這句是肯定還是否定？頻率副詞要放在一般動詞前面、be 動詞後面。",
    G24: "這個東西數得出來嗎？這句是肯定、否定，還是問句？",
    G25: "這是還沒發生的事：will 或 be going to 後面的動詞要用什麼樣子？",
    G26: "過去某個時候「正在做」：主詞是一個還是好幾個？動詞要用哪一種樣子？",
    G27: "前後兩部分是加上、轉折、二選一，還是因果？",
    G28: "看連接詞：when、if 說未來的事，動詞時態要怎麼用？because 和 so 能不能一起用？",
    G29: "前面是 look、feel、sound 這類動詞嗎？後面要接形容詞；是「令人…」還是「感到…」？",
    G30: "看句型：too…to、so…that、It takes… 後面各接什麼？",
    G31: "前面是 make、let、see、hear 這類動詞嗎？後面的「人」接著做的動作要用什麼樣子？",
    G32: "問句放進另一句裡面，語序要不要改回一般句子的順序？",
    G33: "前面是肯定還是否定？後面要反過來，助動詞和時態要跟前面一樣。",
    G34: "人和東西誰在前面？順序倒過來時要加 to 還是 for？",
    G35: "後面跟的是名詞，還是形容詞／副詞？"
  };
  // 11-24 第二輪整合（主對話截圖複核）：一個文法點常包好幾個子題（例：G17「冠詞與指示詞」同時考 a／an／the 和 this／these），
  //   只用文法點對提示會對錯題——考 This／These 的題卻講 a／an 母音規則。改成：先看題目的子規則 sk（SK_HINT），
  //   沒有 sk 再看選項推子規則（subOf），都推不出才用文法點的通用提示。提示一律只講怎麼判斷、不講這題答案。
  const SK_HINT = {
    "G08.most-long": "這個形容詞是長的字還是短的字？長的字不能直接加 -est。",
    "G08.sup": "是不是在說三個以上裡面「最…」？前面有沒有 the？短的字和長的字變法不一樣。",
    "G08.than-any": "句子裡有 than：雖然是跟「其他每一個」比，其實還是在比兩邊。",
    "G08.two-vs-many": "比的是兩個，還是三個以上？只有兩個的時候不說「最…」。",
    "G15.agree": "看主詞和數量：是一個還是好幾個？動詞和名詞都要跟著配。",
    "G15.irregular": "前面說了好幾個：這個字的複數是不是不規則、要背的那種？",
    "G15.plural-reg": "前面說了好幾個：字尾要怎麼變（加 -s、加 -es，還是 y 變 ies）？",
    "G15.uncount": "這個東西數得出來嗎？數不完的東西不加 s、前面也不放 a。",
    "G16.agree": "主詞是一個還是好幾個（兩個人用 and 連起來算好幾個）？動詞要跟著配。",
    "G16.case": "空格的人在句子裡是做動作的主角，還是被做（接在動詞或介系詞後面）的那個？",
    "G16.possessive": "要說「誰的」：後面有沒有直接接東西？小心發音一樣、意思不同的字。",
    "G16.reflexive-one": "是「自己對自己做」，還是用一個字代替前面說過的同一種東西？代替的話是一個還是好幾個？",
    "G17.a-an": "後面那個字開頭念起來是不是母音的音？（看發音，不是看字母）",
    "G17.demonstrative": "後面的東西是一個還是好幾個？離說話的人近還是遠？",
    "G17.the": "是第一次提到的一個，還是大家都知道是哪一個（前面提過，或世界上只有一個）？",
    "G17.mix": "看後面的東西是一個還是好幾個；這句的動詞是 be 動詞還是一般動詞？",
    "G18.is-are": "There is／are 看後面的東西：是一個（或數不完），還是好幾個？",
    "G18.negative": "這句是否定：後面的東西是一個（或數不完），還是好幾個？",
    "G18.question": "There is／are 的問句和回答：後面的東西是一個（或數不完），還是好幾個？",
    "G18.there-was": "這是過去的事：後面的東西是一個（或數不完），還是好幾個？",
    "G19.base": "叫別人做事的句子：動詞要用什麼樣子（加不加 s、ing）？",
    "G19.be": "叫別人「要…／不要…」，後面接的是形容詞：be 動詞要用什麼樣子？",
    "G19.dont": "叫別人不要做：開頭用什麼？後面的動詞用什麼樣子？",
    "G19.lets": "邀大家一起做：開頭那個字要怎麼寫（注意撇號）？後面的動詞用什麼樣子？",
    "G20.how": "How 後面接不同的字，問的東西不一樣：問年紀、多少、多長，還是幾個？",
    "G20.wh-aux": "疑問詞後面：句子是 be 動詞（正在做、形容詞），還是一般動詞要借 do／does？主詞是一個還是好幾個？",
    "G20.wh-word": "想想要問的是什麼：人、東西、地方、時間、方法，還是原因？看看後面的回答。",
    "G21.base-after-aux": "前面已經借了 do／does／did，後面的動詞要用什麼樣子？",
    "G21.be-vs-do": "句子裡有沒有一般動詞？後面只有形容詞或名詞（沒有一般動詞）就不用借 do／does／did。",
    "G21.did-didnt": "這是現在還是過去的事？看看句子裡的時間詞。",
    "G21.do-does": "主詞是 he、she、it 這種「一個」，還是 I、you、好幾個？",
    "G21.short-answer": "簡答要用問句裡同一個助動詞來回答：問句開頭用的是哪一個？",
    "G22.at-place": "是在一個「點」碰面（門口、車站），還是在某個東西的前面？位置片語要整組寫完整。",
    "G22.between": "是在兩個人或東西的中間，還是三個以上的中間？說到中間那幾個人時要用主格還是受格？",
    "G22.in-on-under": "想像一下位置：在裡面、在表面上，還是在下面？",
    "G22.next-front": "想像一下位置：在旁邊、前面，還是後面？位置片語要整組記，少一個小字就錯。",
    "G23.meaning": "看後面那句的意思：是「總是」、「常常」、「有時」，還是「從來不」？",
    "G23.pos-be-aux": "頻率副詞放在 be 動詞（或助動詞）的前面還是後面？主詞是一個還是好幾個？",
    "G23.pos-verb": "頻率副詞放在一般動詞的前面還是後面？主詞是 he、she、it 時動詞要不要加 s？",
    "G23.too-either": "前面那句是肯定還是否定？「也」在肯定句和否定句用的字不一樣。",
    "G24.a-lot-of": "「很多」的片語要整組寫完整；它後面數得出來、數不完的都能接。",
    "G24.both-all-most": "說的是兩個（兩個都），還是三個以上（全部、大部分）？",
    "G24.many-much": "後面的東西數得出來嗎？數得出來和數不完的「很多」用的字不一樣。",
    "G24.some-any": "這句是肯定、否定、問句，還是請別人吃東西（Would you like…）？",
    "G25.be-agree": "be going to 的 be 動詞要跟主詞配：主詞是誰？一個還是好幾個？",
    "G25.be-going-to": "be going to 三個部分都要在：be 動詞跟主詞配，to 後面接原形。",
    "G25.future-time": "句子裡有 next…、tomorrow 這種未來的時間嗎？未來的事動詞要怎麼寫？",
    "G25.neg-question": "這是還沒發生的事：問句或否定句要用哪個助動詞？",
    "G25.will-base": "這是還沒發生的事：will 後面的動詞要用什麼樣子？",
    "G26.at-past-time": "有「昨天幾點」這種過去的某個時刻：那時候正在做，be 動詞和動詞各要什麼樣子？",
    "G26.neg-question": "過去正在做的否定句或問句：主詞配 was 還是 were？後面的動詞用哪一種樣子？",
    "G26.ving-form": "過去「正在做」：be 動詞加上動詞的哪一種樣子？拼字要不要重複字尾？",
    "G26.was-were": "主詞是一個還是好幾個（you 算好幾個）？過去正在做要配哪個 be 動詞？",
    "G26.when-while": "一件事做到一半，另一件事突然發生：正在做的那件和突然發生的那件，各用什麼時態、哪個連接詞？",
    "G27.and-but": "前後兩部分是加上，還是轉折（意思相反）？",
    "G27.not-only": "「不只 A，而且 B」：A 和 B 要是同一種詞（都是形容詞、都是動詞…），中間要用哪一組字接起來？",
    "G27.or": "是在兩個裡面選一個，還是「快一點，不然就會…」（否則）的意思？",
    "G27.so": "前後是什麼關係：前面是原因、後面是結果，還是反過來？",
    "G28.because-no-so": "前後是什麼關係：前面是原因、後面是結果，還是反過來？because 和 so 不能放在同一句。",
    "G28.choose-conj": "前後兩件事是什麼關係：先後（之前、之後）、條件（如果），還是因果？",
    "G28.if-present": "if 那半句說未來的事要用什麼時態？另外半句呢？",
    "G28.time-clause-present": "before、after、when 那半句說未來的事，動詞要用什麼時態？",
    "G29.adv-contrast": "空格是在說「怎麼做」一個動作（副詞），還是跟在 look、feel 後面說「看起來怎樣」（形容詞）？",
    "G29.ed-feel": "是人「感到」怎麼樣，還是東西「令人」怎麼樣？",
    "G29.get-become": "get、become 後面要說「變得怎樣」：該接形容詞、副詞，還是名詞？",
    "G29.ing-cause": "是東西「令人」怎麼樣，還是人「感到」怎麼樣？",
    "G29.linking-adj": "look、smell、sound 這類字後面要接形容詞還是副詞？",
    "G30.it-adj-to": "It is＋形容詞後面接什麼？開頭用來代替後面那件事的字是哪一個？",
    "G30.it-takes": "「花多少時間做某事」：哪個動詞能用 It 當主詞？後面的動作用什麼樣子？",
    "G30.so-that": "so＋形容詞後面用哪個字帶出結果？結果那半句的動詞怎麼寫？",
    "G30.too-to": "too＋形容詞後面「太…而不能做」的動作，要用什麼樣子？",
    "G31.let-have": "let、have 叫人做事：後面「人」接著的動作要用什麼樣子？",
    "G31.make": "make 叫人做事：後面「人」接著的動作要用什麼樣子？這件事是現在還是過去？",
    "G31.perception": "看到、聽到別人做動作：see、hear 後面「人」接著的動作要用什麼樣子？",
    "G31.vs-to": "tell、ask、want 跟 make、let 不一樣：它們後面「人」接著的動作要用什麼樣子？",
    "G32.if-whether": "不確定「是不是」要用哪個字帶出問題？帶出的那句要用一般句子的順序（主詞在前）。",
    "G32.that-clause": "空格後面接的是 that＋一整句：哪一個動詞的意思和用法能接一整句話？",
    "G32.wh-order": "問句放進另一句裡面，語序要不要改回一般句子的順序（主詞在動詞前面）？",
    "G32.wh-to-v": "what、how、where 後面接「該做什麼」：動詞要用什麼樣子？",
    "G33.be": "前面用的是 be 動詞：附加問句用同一個 be 動詞、肯定否定反過來，主詞換成代名詞。",
    "G33.do": "前面是一般動詞：附加問句要借 do／does／did，時態跟前面一樣、肯定否定反過來。",
    "G33.modal": "前面有 can、should、will 這類助動詞或 Let's：附加問句用對應的助動詞，肯定否定反過來。",
    "G33.negative": "前面是否定（never、not 都算）：附加問句要反過來用肯定；助動詞跟前面一樣。",
    "G34.sb-sth": "give、buy、make 後面接「人＋東西」：人放前面時，人要用什麼格、中間要不要加字？",
    "G34.to-for": "東西放前面、人放後面時要加 to 還是 for？想想這個動詞是「交給」還是「為某人做」。",
    "G34.used-to": "「以前常常…（現在沒有了）」：used to 怎麼寫、後面接什麼樣子？",
    "G35.how": "後面跟的是形容詞／副詞，還是名詞？",
    "G35.what-a": "後面跟的是「一個＋形容詞＋名詞」：用哪個感嘆詞？下一個字開頭是不是母音的音？",
    "G35.what-plural": "後面跟的名詞是好幾個或數不完（不能加 a）：用哪個感嘆詞？",
    "G35.word-order": "感嘆句後半的順序跟一般句子一樣嗎？主詞放前面還是動詞放前面？主詞是一個還是好幾個？",
    // 選項一看就知道在考別的東西（題目標的文法點／子規則對不上）時用的提示（strongOf）
    "AGREE.be": "看主詞：是一個還是好幾個（all of、both 加上好幾個人算好幾個）？be 動詞要跟著配。",
    "G18.have": "句子開頭是誰？是某人、某地「擁有」東西，還是用 There 開頭說某處「有」東西？主詞是一個還是好幾個？",
    "G30.of-for": "形容的是「人」的個性（kind、nice），還是「這件事」本身（easy、important）？說人的時候介系詞不一樣。",
    "G32.wh-pick": "想想要說的是「做什麼」、「怎麼做」、「在哪裡」，還是「是不是」？",
    "G27.not-only-agree": "not only A but also B 當主詞時，動詞要跟靠近它的 B 配：B 是一個還是好幾個？",
    "G30.enough": "形容詞＋enough（夠…）後面接「可以做的事」：動作要用什麼樣子？",
    "CMP.er": "句子裡有沒有 than（比…）？短的字和長的字變法不一樣。",
    "G35.how-adv": "How 後面要接形容詞還是副詞？看後半句：是在形容人或東西（be 動詞），還是形容一個動作（一般動詞）？"
  };
  // 選項本身已經說明在考什麼的題（例：選項是 This／These／That 就是在考單複數與遠近），先於 sk：
  //   C 組的 sk 標的是「出題的子規則」，有些題的選項其實在考相鄰的規則（例：G18 標 negative 的題選項是 any／many／some）
  const BE_GPS = { G01: 1, G02: 1, G18: 1, G25: 1, G26: 1, G33: 1, G35: 1, G21: 1, G20: 1 };
  function strongOf(q) {
    if (!q || !Array.isArray(q.o)) return null;
    const o = q.o.map(x => String(x).toLowerCase().trim()), has = re => o.some(x => re.test(x)), all = re => o.every(x => re.test(x));
    const stem = String(q.q || ""), gp = q.gp;
    if (has(/^a$/) && has(/^an$/)) return "G17.a-an";
    if (o.filter(x => /^(this|that|these|those)$/.test(x)).length >= 2) return "G17.demonstrative";
    if (has(/^some$/) && has(/^any$/) && !has(/^(is|are|am|was|were)$/)) return "G24.some-any";
    if (/\bthere ___/i.test(stem) && has(/^(is|are|was|were)$/)) return has(/^(was|were)$/) && !has(/^(is|are)$/) ? "G18.there-was" : "G18.is-are";
    if (gp === "G18" && has(/^was$/) && has(/^were$/)) return "G18.there-was";
    if (gp === "G18" && has(/^any$/) && !has(/^(is|are|am|was|were)$/)) return "G24.some-any";
    if (has(/^doesn't$/) && has(/^don't$/) && !has(/^didn'?t$/) && !/^___/.test(stem) && !has(/^(is|are|am|was|were)$/)) return "G21.do-does";
    if (/\bthan\b/i.test(stem) && has(/^more /) && has(/er$/)) return "CMP.er";
    if (gp === "G27" && /not only/i.test(stem) && all(/^(is|are|am|was|were|be|has|have)$/)) return "G27.not-only-agree";
    if (gp && !BE_GPS[gp] && all(/^(is|are|am|was|were)$/)) return "AGREE.be";
    if (gp === "G18" && has(/^(has|have)$/) && has(/^(is|are)$/) && !/\bthere\b/i.test(stem)) return "G18.have";
    if (gp === "G34" && (/used to ___/i.test(stem) || has(/^used to\b/))) return "G34.used-to";
    if (gp === "G35" && /^how ___/i.test(stem) && has(/^well$|ly$/)) return "G35.how-adv";
    if (gp === "G32" && all(/^(what|how|where|when|which|who|whether|if|that)$/) && (q.sk === "G32.wh-to-v" || !q.sk)) return "G32.wh-pick";
    if (gp === "G30" && has(/^of$/) && /\b(kind|nice|smart|clever|careless|silly|polite|rude|brave|stupid|foolish|generous|wise|thoughtful|sweet) ___ (me|you|him|her|us|them|[A-Z][a-z]+)\b/i.test(stem)) return "G30.of-for";
    return null;
  }
  // 沒有 sk 的題（多半是自動題）：看選項推子規則；推不出＝null（用文法點的通用提示）
  function subOf(q) {
    const gp = q && q.gp; if (!gp || !Array.isArray(q.o)) return null;
    const o = q.o.map(x => String(x).toLowerCase().trim()), has = re => o.some(x => re.test(x)), all = re => o.every(x => re.test(x));
    const stem = String(q.q || "");
    if (gp === "G17") return has(/^(this|that|these|those)( [a-z]+)?$/) ? "G17.demonstrative" : has(/^(is|are|do|does)$/) ? "G17.mix" : (has(/^an$/) && has(/^a$/)) ? "G17.a-an" : has(/^the$/) ? "G17.the" : null;
    if (gp === "G16") return has(/sel(f|ves)$/) ? "G16.reflexive-one" : has(/^ones?$/) ? "G16.reflexive-one" : has(/^(mine|yours|hers|ours|theirs|its|their|there|they're|your|my|his|our)$/) && !has(/^(me|him|them|us|i|he|she|we|they)$/) ? "G16.possessive" : has(/^(has|have|is|are|was|were|does|do)$/) ? "G16.agree" : has(/^(me|him|her|them|us|i|he|she|we|they)$/) ? "G16.case" : null;
    if (gp === "G15") return has(/^(has|have|is|are|was|were|does|do)$/) ? "G15.agree" : /\b(two|three|four|five|six|seven|eight|nine|ten|many|several|these|those)\b/i.test(stem) ? "G15.plural-reg" : has(/^a /) || has(/^(homework|water|milk|rice|bread|money|juice|information|advice|furniture|music)s?$/) ? "G15.uncount" : null;
    if (gp === "G18") return /^___ there/i.test(stem) || /\?.*there ___/i.test(stem) ? "G18.question" : has(/^(was|were)$/) ? "G18.there-was" : has(/n't$/) ? "G18.negative" : "G18.is-are";
    if (gp === "G20") return /^how ___/i.test(stem) ? "G20.how" : has(/^(do|does|did|is|are|am)$/) ? "G20.wh-aux" : has(/^(who|what|where|when|why|how|which|whose)$/) ? "G20.wh-word" : null;
    if (gp === "G21") return has(/^(is|are|am|was|were)$/) && has(/^(do|does|did)$/) ? "G21.be-vs-do" : all(/^(do|does|did|don't|doesn't|didn't)$/) && has(/^did|^didn't/) && /yesterday|last |ago\b/i.test(stem) ? "G21.did-didnt" : /\b(do|does|did|don't|doesn't|didn't)\b[^_]* ___/i.test(stem) ? "G21.base-after-aux" : null;
    if (gp === "G08") return /of the two\b|of the two [a-z]+/i.test(stem) ? "G08.two-vs-many" : /than (any|all)/i.test(stem) ? "G08.than-any" : null;
    if (gp === "G24") return has(/^(both|all|most|every)$/) ? "G24.both-all-most" : has(/^(some|any)$/) && !has(/^(many|much)$/) ? "G24.some-any" : has(/(^| )(many|much)$/) ? "G24.many-much" : null;
    if (gp === "G23") return has(/^(too|either|neither|so)$/) ? "G23.too-either" : has(/^(is|are|am|was|were|does|do) (always|usually|often|sometimes|never)|^(always|usually|often|sometimes|never) (is|are|am|was|were)$/) ? "G23.pos-be-aux" : has(/^(always|usually|often|sometimes|never) [a-z]+$|^[a-z]+ (always|usually|often|sometimes|never)$/) ? "G23.pos-verb" : all(/^(always|usually|often|sometimes|seldom|never|ever|rarely)$/) ? "G23.meaning" : null;
    if (gp === "G25" && has(/going/)) return "G25.be-going-to";
    if (gp === "G28") return has(/^will /) ? (/\bif\b/i.test(stem) ? "G28.if-present" : "G28.time-clause-present") : has(/^because$/) && has(/^so$/) ? "G28.because-no-so" : has(/^(if|before|after|when|because|so|but|until)$/) ? "G28.choose-conj" : null;
    if (gp === "G30") return /enough ___/i.test(stem) ? "G30.enough" : /\btoo [a-z]+ (for [a-z]+ )?___/i.test(stem) ? "G30.too-to" : /\bso [a-z]+ ___/i.test(stem) ? "G30.so-that" : /\bit ___ (me|him|her|us|them|you)?/i.test(stem) && has(/^takes?$|^took$/) ? "G30.it-takes" : /^it is [a-z]+ ___/i.test(stem) ? "G30.it-adj-to" : null;
    if (gp === "G32") return o.some(x => x.split(" ").length >= 2) ? "G32.wh-order" : null;
    if (gp === "G34") return has(/^(to|for)$/) ? "G34.to-for" : "G34.sb-sth";
    if (gp === "G31") return /\b(tell|told|ask|asked|want|wants|wanted)\b [a-z]+ ___/i.test(stem) ? "G31.vs-to" : /\b(see|saw|hear|heard|watch|watched|watches|feel|felt|notice|noticed)\b/i.test(stem) ? "G31.perception" : /\b(make|makes|made)\b/i.test(stem) ? "G31.make" : /\b(let|lets|have|has|had)\b/i.test(stem) ? "G31.let-have" : null;
    return null;
  }
  // 提示用哪一條：選項明確 → strongOf；題目有 sk → SK_HINT；沒有 sk → 看選項推（subOf）；都沒有 → 文法點通用提示
  function hintKey(q) {
    const s = strongOf(q); if (s && SK_HINT[s]) return s;
    if (q && q.sk && SK_HINT[q.sk]) return q.sk;
    const g = subOf(q); return g && SK_HINT[g] ? g : null;
  }
  function ruleHint(q) {
    const gp = q && q.gp;
    const sk = hintKey(q);
    if (sk && SK_HINT[sk]) return SK_HINT[sk];
    const own = gp && RULE_HINT[gp];
    if (own) return own;
    try { const G = typeof QDB_GP !== "undefined" ? QDB_GP : (typeof window !== "undefined" && window.QDB_GP); if (gp && G && G[gp] && G[gp].rule) return maskAns(q, G[gp].rule); } catch (e) {}
    return "再讀一次整句和中文，想想空格要放什麼樣子的字。";
  }
  function maskAns(q, text) {
    const a = q && q.o && q.o[0]; let s = String(text == null ? "" : text);
    if (a == null) return s;
    for (const p of String(a).split(SEP)) {
      const w = p.trim(); if (!w) continue;
      const re = new RegExp("(^|[^A-Za-z'])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z'])", "gi");
      s = s.replace(re, (m, pre) => pre + "＿＿");
    }
    return s;
  }

  const qcard = {
    ver: 1,
    kinds: ["fill"],                                                // 開放（會被抽到）的題型：第 1 期只有挖空選擇
    draft: ["fill2", "trans", "dlg", "trf", "sit", "fix", "order"], // 只有樣式稿（第 2 期）；render 要帶 o.draft 才畫
    KIND_NAME, esc,
    render,
    explain(q, picked, o) {
      o = o || {};
      if (!q) return "";
      const kind = kindOf(q), a = q.o && q.o[0];
      const wrongPick = picked != null && picked !== a;
      let h = '<div class="qc-exp">';
      if (wrongPick) h += whyHtml(q, picked);
      if (o.answer !== false && (a != null || kind === "order")) {
        const full = answerSentence(q, kind);
        const showAns = kind === "fill" || kind === "fill2" || kind === "fix";
        h += '<div class="qc-ans">' + (showAns ? "正確答案：<b>" + esc(String(a).split(SEP).join("／")) + "</b>" : "正確的句子：") + "</div>" +
          '<div class="qc-full-s">' + full + "</div>";
      }
      if (q.e) h += '<div class="qc-e"><span class="qc-tag">為什麼</span>' + esc(q.e) + "</div>";
      return h + "</div>";
    },
    // 第二次機會：規則提示＋（遮掉正解的）錯選項說明；完整解析等答完才給（P1-17）
    retry(q, picked) {
      return '<div class="qc-exp qc-retry">' + IC_RETRY + '<span>不是這個，<b>再想一次！</b>（已經拿掉一個錯的選項）</span>' +
        '<div class="qc-hint"><span class="qc-tag">提示</span>' + esc(ruleHint(q)) + '</div>' + whyHtml(q, picked, true) + "</div>";
    },
    ruleHint, maskAns, RULE_HINT, SK_HINT, subOf, strongOf, hintKey,
    canRetry(card) { return !!card && card.ok && card.alive() >= 3; }
  };

  // ── 樣式（星夜：深藍＋金；選項 ≥44px；用容器寬度切版，側邊面板、營地、320 手機都照實際寬度排）
  const CSS = `
.qc{container-type:inline-size;color:#eef2fa;text-align:left;line-height:1.5}
.qc *,.qc-exp *{box-sizing:border-box}
.qc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 6px}
.qc-how{font-size:14px;font-weight:700;color:#cfdcf0}
.qc-chip{font-size:12px;color:#F3D494;border:1px solid rgba(225,184,106,.55);border-radius:999px;padding:1px 9px;white-space:nowrap}
.qc-stem{font-size:21px;font-weight:700;line-height:1.6;margin:0 0 6px;color:#fff;overflow-wrap:anywhere}
.qc-compact .qc-stem{font-size:18px;line-height:1.55;margin-bottom:4px}
.qc-full .qc-stem{font-size:22px}
.qc-blank{display:inline-block;min-width:3.4em;border-bottom:3px solid #E1B86A;margin:0 .18em;text-align:center;line-height:1.25;vertical-align:baseline;color:#7ee2b0}
.qc-blank i{font-style:normal;font-size:.62em;color:#F3D494;margin-right:2px;vertical-align:super}
.qc-blank.filled{border-color:#5fd39a}
.qc-blank-wide{min-width:6em}
.qc-zh{font-size:15px;color:#b9c7dc;line-height:1.55;margin:0 0 10px}
.qc-compact .qc-zh{font-size:14px;margin-bottom:8px}
.qc-zh-big{font-size:17px;color:#e3ebf7}
.qc-box{border-radius:12px;padding:9px 12px 10px;margin:0 0 10px;background:#13203a;border:1px solid #2f4566}
.qc-tag{display:inline-block;font-size:12px;font-weight:800;color:#1a1306;background:#F3D494;border-radius:6px;padding:0 7px;margin:0 6px 4px 0;line-height:1.6;vertical-align:middle}
.qc-tag-b{background:#9cc3ff;color:#0b1a33}
.qc-zhbig{font-size:22px;font-weight:800;line-height:1.55;color:#fff}
.qc-compact .qc-zhbig{font-size:19px}
.qc-sit{background:linear-gradient(135deg,#16284a,#121d33);border-color:#3a5a8c;border-left:4px solid #9cc3ff}
.qc-sitq{font-size:18px;font-weight:700;line-height:1.6;color:#fff}
.qc-zhs{font-size:14px;color:#b9c7dc;margin-top:3px}
.qc-en{font-size:20px;font-weight:700;line-height:1.55;color:#fff;overflow-wrap:anywhere}
.qc-compact .qc-en{font-size:18px}
.qc-do{display:flex;align-items:center;gap:6px;margin:0 0 10px;font-size:16px;font-weight:800;color:#F3D494}
.qc-do b{background:rgba(225,184,106,.14);border:1.5px solid #E1B86A;border-radius:10px;padding:4px 11px;line-height:1.45}
.qc-ic{width:20px;height:20px;flex:none;vertical-align:-4px}
.qc-dlg{display:flex;flex-direction:column;gap:8px;margin:0 0 10px}
.qc-line{display:flex;gap:8px;align-items:flex-start}
.qc-line.qc-b{flex-direction:row-reverse}
.qc-av{flex:none;width:36px;height:36px}
.qc-bub{max-width:calc(100% - 46px);background:#1f3150;border:1px solid #3d5677;border-radius:4px 14px 14px 14px;padding:6px 12px 8px;font-size:18px;font-weight:700;line-height:1.5;color:#fff;overflow-wrap:anywhere}
.qc-b .qc-bub{background:#2e2a1b;border-color:#8a7442;border-radius:14px 4px 14px 14px}
.qc-who{display:block;font-size:12px;font-weight:800;color:#9cc3ff;letter-spacing:1px}
.qc-b .qc-who{color:#F3D494;text-align:right}
.qc-bub small{display:block;font-size:13px;color:#b9c7dc;font-weight:400;margin-top:2px}
.qc-opts{display:grid;gap:8px;grid-template-columns:1fr}
.qc-opts.qc-g2{grid-template-columns:1fr 1fr}
.qc-opts.qc-g2>.qc-opt:last-child:nth-child(odd){grid-column:1/-1}
@container (min-width:520px){.qc-full .qc-opts.qc-short{grid-template-columns:1fr 1fr}.qc-full .qc-opts.qc-short>.qc-opt:last-child:nth-child(odd){grid-column:1/-1}}
@container (max-width:250px){.qc-opts.qc-g2{grid-template-columns:1fr}}
@container (min-width:480px){.qc-compact .qc-opts.qc-n4{grid-template-columns:repeat(4,1fr)}}
.qc-dense .qc-head{margin-bottom:3px}
.qc-dense .qc-stem{font-size:17px;line-height:1.45;margin-bottom:2px}
.qc-dense .qc-zh{font-size:13px;margin-bottom:6px;line-height:1.4}
.qc-dense .qc-opts{gap:6px}
.qc-dense .qc-opt{min-height:44px;padding:6px 8px;font-size:16px;gap:7px}
.qc-dense .qc-g2 .qc-opt{padding:5px 7px;gap:6px;line-height:1.2}
.qc-dense .qc-key{width:22px;height:22px;font-size:12px}
.qc-dense .qc-exp{margin-top:6px;padding:6px 9px;font-size:13.5px;line-height:1.55}
.qc-opt{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:52px;margin:0;padding:10px 12px;border-radius:12px;border:1.5px solid #4b6478;background:linear-gradient(#22344a,#182638);color:#eef2fa;font:inherit;font-size:19px;font-weight:700;line-height:1.35;text-align:left;cursor:pointer;touch-action:manipulation;transition:border-color .12s,background-color .12s,transform .08s}
.qc-compact .qc-opt{min-height:46px;font-size:17px;padding:8px 10px;gap:8px}
.qc-sent .qc-opt{font-size:17px;font-weight:600;align-items:flex-start;line-height:1.45}
.qc-compact .qc-sent .qc-opt{font-size:16px}
.qc-key{flex:none;width:24px;height:24px;border-radius:7px;background:#0d1626;border:1px solid #5a7390;color:#cfdcf0;font-size:13px;font-weight:800;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.qc-sent .qc-key{margin-top:1px}
.qc-t{flex:1;min-width:0;overflow-wrap:break-word}
.qc-p{white-space:nowrap}
.qc-p i{font-style:normal}
.qc-p i{font-size:.72em;color:#F3D494;margin-right:3px;vertical-align:1px}
.qc-sep{color:#7f93ad;margin:0 6px}
.qc-opt:hover:not(:disabled){border-color:#8fa9c4}
.qc-opt:active:not(:disabled){transform:scale(.98);border-color:#E1B86A}
.qc-opt:focus-visible,.qc-tok:focus-visible{outline:3px solid #F3D494;outline-offset:2px}
.qc-opt:disabled{cursor:default}
.qc-opt.right{border-color:#5fd39a;background:#173a33;color:#effff6}
.qc-opt.wrong{border-color:#ff7070;background:#3e1e2a}
.qc-opt.right .qc-key,.qc-opt.wrong .qc-key{font-size:0}
.qc-opt.right .qc-key{background:#5fd39a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.2 8.4l3 3L12.8 4.8' fill='none' stroke='%230b2a1c' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat;border-color:#5fd39a}
.qc-opt.wrong .qc-key{background:#ff7070 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 4.5l7 7M11.5 4.5l-7 7' stroke='%232a0b10' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") center/16px no-repeat;border-color:#ff7070}
.qc-nokey .qc-opt.right,.qc-nokey .qc-opt.wrong{padding-right:40px}
.qc-nokey .qc-opt.right::after,.qc-nokey .qc-opt.wrong::after{content:"";position:absolute;right:10px;top:50%;width:22px;height:22px;margin-top:-11px;background:center/contain no-repeat}
.qc-nokey .qc-opt.right::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Ccircle cx='11' cy='11' r='10' fill='%235fd39a'/%3E%3Cpath d='M6 11.5l3.4 3.4L16 8' fill='none' stroke='%230b2a1c' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
.qc-nokey .qc-opt.wrong::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Ccircle cx='11' cy='11' r='10' fill='%23ff7070'/%3E%3Cpath d='M7.5 7.5l7 7M14.5 7.5l-7 7' stroke='%232a0b10' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E")}
.qc-opt.gone{opacity:.45;background:rgba(255,255,255,.03);border-style:dashed}
.qc-opt.gone .qc-t{text-decoration:line-through}
.qc-toks{display:flex;flex-wrap:wrap;gap:6px 6px;align-items:center;margin:0 0 10px}
.qc-tok{min-height:44px;min-width:44px;padding:6px 11px;border-radius:10px;border:1.5px solid #4b6478;background:#1a2a40;color:#fff;font:inherit;font-size:19px;font-weight:700;cursor:pointer;touch-action:manipulation}
.qc-compact .qc-tok{font-size:17px;padding:5px 9px}
.qc-tok.right{border-color:#5fd39a;background:#173a33}
.qc-tok.wrong{border-color:#ff7070;background:#3e1e2a}
.qc-tok.gone,.qc-tok.used{opacity:.3;border-style:dashed;cursor:default}
.qc-tg{display:inline-flex;align-items:center;gap:1px;white-space:nowrap}
.qc-punct{font-size:20px;font-weight:700;color:#cfdcf0;padding:0 1px}
.qc-chips{justify-content:center}
.qc-ansline{min-height:52px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;border:2px dashed rgba(225,184,106,.45);border-radius:12px;padding:6px 8px;margin:0 0 10px;font-size:19px;font-weight:700;color:#7ee2b0}
.qc-ws{display:contents}
.qc-endp{font-size:22px;color:#cfdcf0}
.qc-ansline .qc-w{background:#173a33;border:1.5px solid #5fd39a;border-radius:9px;padding:4px 9px}
.qc-ph{font-size:14px;font-weight:400;color:#8ea2bd}
.qc-stem-s{font-size:19px}
.qc-bad{color:#ffb0b0;text-decoration-color:#ff7070;text-decoration-thickness:2px}
.qc-oops{font-size:15px;color:#ffd2b0;background:#2a1a22;border:1px solid #6a3a48;border-radius:10px;padding:10px 12px}
.qc-res:empty{display:none}
.qc-exp{margin-top:10px;font-size:15px;line-height:1.7;color:#e3ebf7;background:#0a1222;border:1px solid #2a3d58;border-radius:12px;padding:10px 12px;overflow-wrap:anywhere}
.qc-compact .qc-exp{font-size:14px;padding:8px 10px;line-height:1.6}
.qc-exp>div+div{margin-top:4px}
.qc-retry{border-color:rgba(225,184,106,.6);background:#1b1a14}
.qc-retry>span{font-weight:700}
.qc-retry .qc-ic{margin-right:4px}
.qc-retry b,.qc-why b{color:#F3D494}
.qc-why{color:#ffd2b0}
.qc-ans{color:#cfdcf0}
.qc-ans b{color:#7ee2b0;font-size:1.06em}
.qc-full-s{font-size:1.08em;font-weight:700;color:#fff}
.qc-full-s b{color:#7ee2b0;text-decoration:underline;text-decoration-color:#5fd39a;text-underline-offset:3px}
.qc-e{color:#e3ebf7}
.qc-e .qc-tag{background:#2f4566;color:#e3ebf7}
@container (max-width:300px){.qc-stem,.qc-full .qc-stem{font-size:18px}.qc-opt,.qc-compact .qc-opt{font-size:16px;padding:8px 9px;gap:7px}.qc-sent .qc-opt{font-size:15.5px}.qc-key{width:22px;height:22px;font-size:12px}.qc-zhbig{font-size:19px}.qc-en{font-size:18px}.qc-bub{font-size:16.5px}.qc-tok{font-size:17px;padding:5px 8px}}
/* 11-25 老闆（手機直拿）：營地題卡題幹、選項再大一級（只在 .sheet.camp、寬 ≤700 直向）；矮螢幕（≤700 高）收緊間距，320×568 四個選項不用捲 */
@media (max-width:700px) and (orientation:portrait){
.sheet.camp .qc-full .qc-stem{font-size:24px;line-height:1.5}
.sheet.camp .qc-full .qc-zh{font-size:16px}
.sheet.camp .qc-full .qc-how{font-size:15px}
.sheet.camp .qc-full .qc-opt{font-size:21px}
.sheet.camp .qc-full .qc-sent .qc-opt{font-size:18.5px}
.sheet.camp .qc-full .qc-key{width:26px;height:26px;font-size:14px}
}
@media (max-width:700px) and (orientation:portrait) and (max-height:700px){
.sheet.camp .qc-full .qc-head{margin-bottom:3px}
.sheet.camp .qc-full .qc-stem{line-height:1.42;margin-bottom:3px}
.sheet.camp .qc-full .qc-zh{line-height:1.45;margin-bottom:7px}
.sheet.camp .qc-full .qc-opts{gap:6px}
.sheet.camp .qc-full .qc-opt{min-height:46px;padding-top:6px;padding-bottom:6px}
}
@media (max-width:700px) and (orientation:portrait){@container (max-width:300px){
.sheet.camp .qc-full .qc-stem{font-size:20px}
.sheet.camp .qc-full .qc-zh{font-size:15px}
.sheet.camp .qc-full .qc-opt{font-size:18px;padding-left:9px;padding-right:9px;gap:7px}
.sheet.camp .qc-full .qc-sent .qc-opt{font-size:16.5px}
.sheet.camp .qc-full .qc-key{width:23px;height:23px;font-size:13px}
}}
@media (prefers-reduced-motion:reduce){.qc-opt{transition:none}.qc-opt:active:not(:disabled){transform:none}}
`;
  qcard.CSS = CSS;
  if (typeof document !== "undefined" && document.head && !document.getElementById("qcCss")) {
    const s = document.createElement("style"); s.id = "qcCss"; s.textContent = CSS; document.head.appendChild(s);
  }
  U.qcard = qcard;
})();
