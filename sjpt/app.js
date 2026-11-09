/* SJPT 말하기 연습 — 앱 동작 */
(() => {
  'use strict';

  const PARTS = window.SJPT_PARTS;
  const QS = window.SJPT_QUESTIONS;
  const PATS = window.SJPT_PATTERNS;
  const COMMON_CHECKS = window.SJPT_COMMON_CHECKS;
  const partById = (id) => PARTS.find((p) => p.id === Number(id));
  const qById = (id) => QS.find((q) => q.id === id);

  /* ───────────── 저장 (휴대폰 브라우저 안) ───────────── */
  const KEY = 'sjpt.v1';
  const defaults = () => ({
    ratings: {},   // 문제별 마지막 자가평가 { r: 0|1|2, t, n }
    log: [],       // 연습 기록 { t, q, p, r }
    notes: {},     // 문제별 내 답변 메모
    cards: {},     // 문형 카드 { box, due }
    days: [],      // 공부한 날짜
    settings: { rate: 0.9, showText: true, furigana: true, showKo: false, stt: false }
  });
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        const base = defaults();
        return Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) });
      }
    } catch (e) { /* 저장소 사용 불가 → 기본값 */ }
    return defaults();
  }
  let db = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 무시 */ }
  }

  /* ───────────── 도구 ───────────── */
  const app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RUBY = /\{([^|{}]+)\|([^{}]+)\}/g;
  const plain = (t) => t.replace(RUBY, '$1');
  // 읽어주기용: 읽는 법이 가타카나(외국 지명 등)면 그 읽기를, 아니면 한자를 사용
  const forSpeech = (t) => t.replace(RUBY, (m, a, b) => (/^[゠-ヿ・ー]+$/.test(b) ? b : a));
  const jp = (t) => (db.settings.furigana
    ? esc(t).replace(RUBY, (m, a, b) => `<ruby>${a}<rt>${b}</rt></ruby>`)
    : esc(plain(t)));
  const sentences = (t) => t.split(/(?<=[。！？?])/).map((s) => s.trim()).filter(Boolean);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const DAY = 86400000;

  function markStudied() {
    const k = dayKey();
    if (!db.days.includes(k)) { db.days.push(k); if (db.days.length > 400) db.days.shift(); }
  }
  function streak() {
    const set = new Set(db.days);
    let n = 0;
    const d = new Date();
    if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1); // 오늘 아직 안 했으면 어제부터
    while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function rateQuestion(q, r) {
    const prev = db.ratings[q.id] || { n: 0 };
    db.ratings[q.id] = { r, t: Date.now(), n: prev.n + 1 };
    db.log.push({ t: Date.now(), q: q.id, p: q.part, r });
    if (db.log.length > 3000) db.log = db.log.slice(-3000);
    markStudied();
    save();
  }
  const todayCount = () => { const s = startOfToday(); return db.log.filter((l) => l.t >= s).length; };
  const weakList = () => QS.filter((q) => db.ratings[q.id] && db.ratings[q.id].r < 2)
    .sort((a, b) => db.ratings[a.id].r - db.ratings[b.id].r || db.ratings[a.id].t - db.ratings[b.id].t);

  /* ───────────── 소리: 일본어 읽어주기 ───────────── */
  const TTS = {
    voice: null, _fin: null,
    ok: () => 'speechSynthesis' in window,
    init() {
      if (!this.ok()) return;
      const pick = () => {
        const vs = speechSynthesis.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
        this.voice = vs.find((v) => /Kyoko|O-ren|Google|Nanami|Haruka/i.test(v.name)) || vs[0] || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    },
    unlock() { // iPhone: 버튼을 누른 순간 한 번 깨워 둬야 이후 자동 재생이 됨
      if (!this.ok()) return;
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* 무시 */ }
    },
    speak(text, rate) {
      return new Promise((res) => {
        if (!this.ok()) return res();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(forSpeech(text));
        u.lang = 'ja-JP';
        if (this.voice) u.voice = this.voice;
        u.rate = rate || db.settings.rate;
        let done = false, to = null;
        const fin = () => { if (done) return; done = true; clearTimeout(to); this._fin = null; res(); };
        this._fin = fin;
        u.onend = fin; u.onerror = fin;
        to = setTimeout(fin, 2500 + plain(text).length * 330 / u.rate);
        speechSynthesis.speak(u);
      });
    },
    stop() { if (this.ok()) speechSynthesis.cancel(); if (this._fin) this._fin(); }
  };
  TTS.init();

  /* ───────────── 삐 소리 ───────────── */
  let actx = null;
  function audioUnlock() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function beep(freq = 880, dur = 0.18) {
    if (!actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.15, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* 무시 */ }
  }

  /* ───────────── 녹음 ───────────── */
  const Rec = {
    stream: null, mr: null, chunks: [], mime: '',
    async ensure() {
      if (this.stream) return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return false;
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); return true; } catch (e) { return false; }
    },
    start() {
      if (!this.stream) return false;
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
      this.mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      this.chunks = [];
      try {
        this.mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
        this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
        this.mr.start();
        return true;
      } catch (e) { this.mr = null; return false; }
    },
    stop() {
      return new Promise((res) => {
        const mr = this.mr;
        if (!mr || mr.state === 'inactive') return res(null);
        mr.onstop = () => {
          const b = new Blob(this.chunks, { type: mr.mimeType || this.mime || 'audio/webm' });
          this.mr = null;
          res(b.size ? b : null);
        };
        try { mr.stop(); } catch (e) { res(null); }
      });
    },
    release() {
      if (this.mr && this.mr.state !== 'inactive') { try { this.mr.stop(); } catch (e) { /* 무시 */ } }
      this.mr = null;
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    }
  };

  /* ───────────── 말한 내용 글자로 (실험 기능) ───────────── */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const STT = {
    rec: null, text: '',
    supported: () => !!SR,
    start() {
      this.text = '';
      if (!db.settings.stt || !SR) return;
      try {
        const r = new SR();
        r.lang = 'ja-JP'; r.continuous = true; r.interimResults = false;
        r.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; this.text = s; };
        r.onerror = () => {};
        r.start(); this.rec = r;
      } catch (e) { this.rec = null; }
    },
    stop() {
      return new Promise((res) => {
        const r = this.rec;
        if (!r) return res(null);
        this.rec = null;
        let done = false;
        const fin = () => { if (!done) { done = true; res(this.text || ''); } };
        r.onend = fin;
        try { r.stop(); } catch (e) { fin(); }
        setTimeout(fin, 1500);
      });
    }
  };

  /* ───────────── 진행 제어 ───────────── */
  let token = 0;          // 화면을 떠나면 증가 → 진행 중인 타이머/녹음 중단
  let skipCurrent = null; // '건너뛰기' 버튼이 부를 함수
  let objectUrls = [];
  const alive = (tk) => tk === token;

  function stopEverything() {
    token++;
    skipCurrent = null;
    TTS.stop();
    STT.stop();
    Rec.release();
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls = [];
  }

  function countdown(sec, tk, ui) {
    return new Promise((res) => {
      if (sec <= 0) return res();
      const end = Date.now() + sec * 1000;
      let iv = null;
      const finish = () => { clearInterval(iv); skipCurrent = null; res(); };
      skipCurrent = finish;
      const tick = () => {
        if (!alive(tk)) return finish();
        const left = Math.max(0, (end - Date.now()) / 1000);
        ui(left, sec);
        if (left <= 0) finish();
      };
      iv = setInterval(tick, 100);
      tick();
    });
  }

  /* ───────────── 화면 공통 ───────────── */
  const titleEl = document.getElementById('title');
  const backBtn = document.getElementById('backBtn');
  backBtn.addEventListener('click', () => { location.hash = '#/'; });
  function setHeader(title, back = true) {
    titleEl.textContent = title;
    backBtn.hidden = !back;
    document.title = title === 'SJPT 말하기 연습' ? title : `${title} · SJPT`;
  }
  function render(html) { app.innerHTML = html; }
  const timesChip = (p) => `<span class="chip">${p.count}문항</span><span class="chip">준비 ${p.prep}초</span><span class="chip">답변 ${p.ans}초</span>`;

  function picHtml(q) {
    let h = '';
    if (q.pic) {
      h += `<div class="pic">${q.pic.rows.map((r) => `<div class="pic-row">${r.map((e) => `<span>${e}</span>`).join('')}</div>`).join('')}`
        + (q.pic.label ? `<div class="pic-label">${esc(q.pic.label)}</div>` : '') + '</div>';
    }
    if (q.frames) {
      h += `<div class="frames">${q.frames.map((f, i) => `<div class="frame"><b>${i + 1}</b><span>${f}</span></div>`).join('')}</div>`;
      if (q.hints) h += `<details class="small"><summary class="muted">힌트 단어 보기</summary><div class="hints">${q.hints.map((x) => `<span class="chip">${jp(x)}</span>`).join('')}</div></details>`;
    }
    return h;
  }

  function questionHtml(q, opts = {}) {
    const part = partById(q.part);
    const alwaysShow = q.part >= 6; // 상황·그림 설명은 항상 보이기
    const show = opts.forceShow || alwaysShow || db.settings.showText;
    const who = q.who ? `<div><span class="chip who">상대: ${esc(q.who)}</span></div>` : '';
    const text = show
      ? `<div class="qtext">${jp(q.q)}</div>${db.settings.showKo || opts.showKo ? `<div class="qko">${esc(q.qKo)}</div>` : ''}`
      : `<button class="hidden-q" data-reveal>🔈 실전처럼 듣기만 하기 · 눌러서 문제 보기</button>`;
    return `<div class="qbox">${picHtml(q)}${who}${text}</div>`;
  }
  function bindReveal(q) {
    const b = app.querySelector('[data-reveal]');
    if (b) b.addEventListener('click', () => { b.outerHTML = `<div class="qtext">${jp(q.q)}</div><div class="qko">${esc(q.qKo)}</div>`; });
  }

  /* ───────────── 홈 ───────────── */
  function viewHome() {
    setHeader('SJPT 말하기 연습', false);
    const dueCards = cardQueue().length;
    const weak = weakList().length;
    render(`
      <section class="hero">
        <div class="hero-title">SJPT 말하기 연습 🎙️</div>
        <div class="hero-sub">목표 Lv.3~4 · 시간 안에 멈추지 않고 말하기</div>
      </section>
      <div class="stats">
        <div class="stat"><b>${todayCount()}</b><span>오늘 연습</span></div>
        <div class="stat"><b>🔥 ${streak()}</b><span>연속 공부일</span></div>
        <div class="stat"><b>${Object.keys(db.ratings).length}/${QS.length}</b><span>풀어본 문제</span></div>
      </div>
      <div class="menu-grid">
        <a class="tile hot" href="#/parts"><div class="ic">🎯</div><b>파트 연습</b><span>실전 타이머 + 녹음 + 모범답안</span></a>
        <a class="tile" href="#/templates"><div class="ic">🧩</div><b>답변 틀</b><span>파트별 말하기 공식</span></a>
        <a class="tile" href="#/cards"><div class="ic">🃏</div><b>문형 카드</b><span>오늘 복습 ${dueCards}장</span></a>
        <a class="tile" href="#/mock"><div class="ic">📝</div><b>모의고사</b><span>26문항 실전 순서</span></a>
        <a class="tile" href="#/weak"><div class="ic">🔁</div><b>약점 복습</b><span>🔺❌ ${weak}문항</span></a>
        <a class="tile" href="#/records"><div class="ic">📊</div><b>내 기록 · 설정</b><span>파트별 점수, 음성 속도</span></a>
      </div>
      <div class="card">
        <h2>📌 추천 공부 순서 (Lv.3~4)</h2>
        <ol class="steps-list">
          <li><b>답변 틀</b>을 먼저 읽기 — 통암기 대신 공식에 단어 끼우기</li>
          <li><b>파트 연습</b> — 실제 시간으로 녹음하며 말하기</li>
          <li>복습 화면에서 <b>내 녹음 ↔ 모범답안</b> 비교, 문장별 🔊 따라 말하기(섀도잉)</li>
          <li><b>문형 카드</b> 하루 10분</li>
          <li>일주일에 한 번 <b>모의고사</b>, 🔺❌는 <b>약점 복습</b>으로</li>
        </ol>
      </div>
      <details class="card">
        <summary>SJPT 시험 구성 보기</summary>
        <table class="exam" style="margin-top:10px">
          <tr><th>파트</th><th>유형</th><th>문항</th><th>준비</th><th>답변</th></tr>
          ${PARTS.map((p) => `<tr><td>${p.id}</td><td>${p.ko}<br><span class="muted small">${p.jp}</span></td><td>${p.count}</td><td>${p.prep}초</td><td>${p.ans}초</td></tr>`).join('')}
        </table>
        <p class="small muted">총 26문항, 시험 약 30분. 헤드셋으로 듣고 마이크에 녹음하는 방식입니다. 최신 세부 기준은 YBM SJPT 공식 안내를 확인하세요.</p>
      </details>
    `);
  }

  /* ───────────── 파트 목록 ───────────── */
  function partProgress(p) {
    const qs = QS.filter((q) => q.part === p.id);
    const rated = qs.filter((q) => db.ratings[q.id]);
    const score = rated.length ? Math.round(rated.reduce((s, q) => s + db.ratings[q.id].r, 0) / (rated.length * 2) * 100) : null;
    return { total: qs.length, done: rated.length, score };
  }
  function viewParts() {
    setHeader('파트 연습');
    render(`
      <p class="muted small">파트를 고르면 실제 시험과 같은 문항 수·시간으로 한 세트를 연습합니다. 못 했던(❌) 문제가 먼저 나와요.</p>
      ${PARTS.map((p) => {
        const pr = partProgress(p);
        return `<a class="part-item" href="#/practice/${p.id}">
          <div class="part-no">${p.id}</div>
          <div class="meta"><b>${p.ko} <span class="muted small">${p.jp}</span></b>
            <span>준비 ${p.prep}초 · 답변 ${p.ans}초 · ${pr.done}/${pr.total}문제${pr.score !== null ? ` · 점수 ${pr.score}%` : ''}</span>
            <div class="bar"><i style="width:${pr.score || 0}%"></i></div>
          </div><span class="muted">›</span></a>`;
      }).join('')}
    `);
  }

  /* ───────────── 답변 틀 ───────────── */
  function stepsHtml(p) {
    return `<div class="steps">${p.steps.map((s) => `<div class="step"><div class="step-label">${esc(s.label)}</div>
      <div class="step-body"><div class="jp">${esc(s.jp)}</div><div class="ko">${esc(s.ko)}</div></div></div>`).join('')}</div>`;
  }
  function viewTemplates() {
    setHeader('답변 틀');
    render(`
      <p class="muted small">SJPT는 외운 대본보다 <b>정해진 순서(틀)</b>로 말하는 게 핵심이에요. 틀에 내 단어만 바꿔 끼우세요.</p>
      ${PARTS.map((p) => {
        const ex = QS.find((q) => q.part === p.id);
        return `<div class="card" id="tpl${p.id}">
          <h2>파트 ${p.id} · ${p.ko} <span class="muted small">${p.jp}</span></h2>
          <div class="times">${timesChip(p)}</div>
          <div class="small muted">${esc(p.desc)}</div>
          <h3>🎯 목표: ${esc(p.goal)}</h3>
          ${stepsHtml(p)}
          <h3>💡 요령</h3>
          <ul class="tips">${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <details style="margin-top:10px"><summary class="small">예시 보기</summary>
            <div style="margin-top:8px">${picHtml(ex)}<div><b>${jp(ex.q)}</b></div>
            <div class="small muted">${esc(ex.qKo)}</div>
            ${sentences(ex.model).map((s) => `<div class="model-line"><div class="jp">${jp(s)}</div><button class="say" data-say="${esc(s)}" aria-label="듣기">🔊</button></div>`).join('')}
            <div class="ko-block">${esc(ex.modelKo)}</div></div>
          </details>
          <div style="margin-top:12px"><a class="btn" href="#/practice/${p.id}">이 파트 연습하기 ›</a></div>
        </div>`;
      }).join('')}
    `);
    bindSay();
  }
  function bindSay(rate) {
    app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => TTS.speak(b.dataset.say, rate)));
  }

  /* ───────────── 연습 세션 ───────────── */
  function buildQueue(partId) {
    const qs = QS.filter((q) => q.part === partId);
    const group = (q) => { const r = db.ratings[q.id]; return !r ? 1 : r.r === 0 ? 0 : r.r === 1 ? 2 : 3; };
    const groups = [0, 1, 2, 3].map((g) => shuffle(qs.filter((q) => group(q) === g)));
    return groups.flat().slice(0, partById(partId).count);
  }

  function viewPracticeIntro(partId) {
    const p = partById(partId);
    if (!p) return viewParts();
    setHeader(`파트 ${p.id} · ${p.ko}`);
    render(`
      <div class="card">
        <h2>${p.ko} <span class="muted small">${p.jp}</span></h2>
        <div class="times">${timesChip(p)}</div>
        <div class="small muted">${esc(p.desc)}</div>
        <h3>🎯 목표: ${esc(p.goal)}</h3>
        ${stepsHtml(p)}
      </div>
      <div class="notice info">진행: 🔊 문제 듣기 → <b>준비 ${p.prep}초</b> → 삐 소리 후 <b>답변 ${p.ans}초 녹음</b> → 내 녹음·모범답안 비교 → 자가평가</div>
      <div class="stack">
        <button class="btn primary" id="go">🎙️ 연습 시작 (${p.count}문항)</button>
        <a class="btn ghost" href="#/templates">답변 틀 자세히 보기</a>
      </div>
      <p class="small muted">처음 시작할 때 마이크 사용 허용을 물어봐요. 허용하지 않아도 타이머 연습은 할 수 있어요.</p>
    `);
    document.getElementById('go').addEventListener('click', () => startSession(buildQueue(p.id), `파트 ${p.id} · ${p.ko}`, () => viewPracticeIntro(p.id)));
  }

  function viewWeak() {
    setHeader('약점 복습');
    const list = weakList();
    if (!list.length) {
      render(`<div class="card"><h2>🎉 복습할 문제가 없어요</h2><p class="muted">파트 연습에서 🔺/❌로 평가한 문제가 여기에 모입니다.</p><a class="btn primary" href="#/parts">파트 연습하러 가기</a></div>`);
      return;
    }
    const queue = list.slice(0, 8);
    render(`
      <div class="card">
        <h2>🔁 약점 문제 ${list.length}개</h2>
        <p class="muted small">❌ → 🔺 순서로 최대 8문제를 실제 시간으로 다시 연습합니다. ⭕를 받으면 목록에서 빠져요.</p>
        ${queue.map((q) => `<div class="small">${db.ratings[q.id].r === 0 ? '❌' : '🔺'} 파트${q.part} · ${jp(q.q)}</div>`).join('')}
      </div>
      <button class="btn primary" id="go">🎙️ 복습 시작 (${queue.length}문항)</button>
    `);
    document.getElementById('go').addEventListener('click', () => startSession(queue, '약점 복습', viewWeak));
  }

  async function prepareAudio() {
    audioUnlock();
    TTS.unlock();
    const ok = await Rec.ensure();
    return ok;
  }

  async function startSession(queue, title, onAgain) {
    const tk = token;
    const micOk = await prepareAudio();
    if (!alive(tk)) return;
    const results = [];
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      let res;
      for (;;) { // '다시 도전'이면 같은 문제 반복
        const run = await runQuestion(q, i, queue.length, tk, micOk, title);
        if (!run) return;
        res = await reviewQuestion(q, run, tk, i, queue.length);
        if (!res) return;
        if (res !== 'retry') break;
      }
      results.push({ q, r: res.r });
    }
    if (!alive(tk)) return;
    Rec.release();
    showSummary(results, title, onAgain);
  }

  function stageHtml(q, i, total, title, micOk) {
    return `
      <div class="progress"><span class="chip">${esc(title)}</span><span class="muted small">${i + 1} / ${total}</span></div>
      ${micOk ? '' : '<div class="notice">마이크를 사용할 수 없어 녹음 없이 진행합니다. (설정에서 마이크 허용 후 새로고침)</div>'}
      <div class="card">${questionHtml(q)}</div>
      <div class="timer-wrap">
        <div class="timer" id="timer"><svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="45"/><circle class="fgc" id="ring" cx="50" cy="50" r="45"/></svg><div class="tnum" id="tnum">·</div></div>
        <div class="phase" id="phase">문제 듣는 중…</div>
      </div>
      <div class="sticky-bottom"><button class="btn" id="skip">건너뛰기 ›</button></div>`;
  }

  async function runQuestion(q, i, total, tk, micOk, title) {
    const p = partById(q.part);
    render(stageHtml(q, i, total, title, micOk));
    bindReveal(q);
    window.scrollTo(0, 0);
    const timer = document.getElementById('timer'), ring = document.getElementById('ring');
    const tnum = document.getElementById('tnum'), phase = document.getElementById('phase'), skip = document.getElementById('skip');
    const C = 282.74;
    const ui = (left, total2) => { tnum.textContent = Math.ceil(left); ring.style.strokeDashoffset = String(C * (1 - left / total2)); };
    skip.addEventListener('click', () => { if (skipCurrent) skipCurrent(); });

    // 1) 문제 듣기
    timer.className = 'timer'; ring.style.strokeDashoffset = '0';
    skipCurrent = () => TTS.stop();
    await TTS.speak(q.q);
    if (!alive(tk)) return null;

    // 2) 준비
    if (p.prep > 0) {
      timer.className = 'timer prep'; phase.className = 'phase prep'; phase.textContent = '준비 시간';
      skip.textContent = '바로 답변 시작 ›';
      await countdown(p.prep, tk, ui);
      if (!alive(tk)) return null;
    }

    // 3) 답변 (녹음)
    beep(880);
    const recording = Rec.start();
    STT.start();
    timer.className = 'timer answer'; phase.className = 'phase answer';
    phase.innerHTML = recording ? '<span class="rec-dot"></span>답변하세요 (녹음 중)' : '답변하세요 (녹음 없음)';
    skip.textContent = '답변 끝내기 ■';
    await countdown(p.ans, tk, ui);
    const blob = await Rec.stop();
    const transcript = await STT.stop();
    if (!alive(tk)) return null;
    beep(520, 0.25);
    return { blob, transcript };
  }

  function reviewHtml(q, run, i, total) {
    const p = partById(q.part);
    let audio = '<div class="muted small">녹음 없음</div>';
    if (run.blob) {
      const url = URL.createObjectURL(run.blob);
      objectUrls.push(url);
      audio = `<audio controls src="${url}"></audio>`;
    }
    const tr = run.transcript != null
      ? `<div class="transcript"><span class="muted small">인식된 내 말:</span><br>${esc(run.transcript || '(인식된 말이 없어요)')}</div>` : '';
    const prev = db.ratings[q.id];
    return `
      <div class="progress"><span class="chip">파트 ${p.id} · ${p.ko}</span><span class="muted small">${i + 1} / ${total}</span></div>
      <div class="card">${questionHtml(q, { forceShow: true, showKo: true })}</div>
      <div class="card">
        <h2>🎧 내 답변</h2>
        ${audio}${tr}
      </div>
      <div class="card">
        <h2>✅ 모범답안 <span class="muted small">문장별 🔊로 따라 말하기</span></h2>
        ${sentences(q.model).map((s) => `<div class="model-line"><div class="jp">${jp(s)}</div><button class="say" data-say="${esc(s)}" aria-label="듣기">🔊</button></div>`).join('')}
        <div class="row" style="margin-top:10px">
          <button class="mini-btn" id="playAll">🔊 전체 듣기</button>
          <button class="mini-btn" id="playSlow">🐢 천천히</button>
        </div>
        <details style="margin-top:10px"><summary class="small">해석 보기</summary><div class="ko-block">${esc(q.modelKo)}</div></details>
        <details style="margin-top:6px"><summary class="small">답변 틀 보기</summary>${stepsHtml(p)}</details>
      </div>
      <div class="card checks">
        <h2>🔍 셀프 체크</h2>
        ${COMMON_CHECKS.concat(p.checks).map((c) => `<label><input type="checkbox"> ${esc(c)}</label>`).join('')}
      </div>
      <div class="card">
        <h2>📝 내 답변 메모 <span class="muted small">(내 상황에 맞게 고친 답)</span></h2>
        <textarea id="note" placeholder="예) 私は〇〇に住んでいます。…">${esc(db.notes[q.id] || '')}</textarea>
      </div>
      <div class="sticky-bottom">
        <div class="small muted" style="text-align:center;margin-bottom:6px">어땠나요? 눌러서 다음 문제로${prev ? ` · 지난번: ${['❌', '🔺', '⭕'][prev.r]}` : ''}</div>
        <div class="rate-row">
          <button class="rate r2" data-r="2"><span class="em">⭕</span>잘했다</button>
          <button class="rate r1" data-r="1"><span class="em">🔺</span>아쉽다</button>
          <button class="rate r0" data-r="0"><span class="em">❌</span>못했다</button>
        </div>
        <button class="btn ghost" id="retry" style="margin-top:8px;min-height:44px">↻ 같은 문제 다시 도전</button>
      </div>`;
  }

  function reviewQuestion(q, run, tk, i, total) {
    return new Promise((res) => {
      if (!alive(tk)) return res(null);
      render(reviewHtml(q, run, i, total));
      window.scrollTo(0, 0);
      bindSay();
      document.getElementById('playAll').addEventListener('click', () => TTS.speak(q.model));
      document.getElementById('playSlow').addEventListener('click', () => TTS.speak(q.model, 0.65));
      const note = document.getElementById('note');
      note.addEventListener('input', () => {
        if (note.value.trim()) db.notes[q.id] = note.value; else delete db.notes[q.id];
        save();
      });
      app.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        TTS.stop();
        rateQuestion(q, Number(b.dataset.r));
        res({ r: Number(b.dataset.r) });
      }));
      document.getElementById('retry').addEventListener('click', () => { TTS.stop(); res('retry'); });
    });
  }

  function showSummary(results, title, onAgain) {
    const c = [0, 0, 0];
    results.forEach((x) => c[x.r]++);
    render(`
      <div class="card big-result">
        <h2>🎉 ${esc(title)} 완료!</h2>
        <div class="nums"><span>⭕ ${c[2]}</span><span>🔺 ${c[1]}</span><span>❌ ${c[0]}</span></div>
        <p class="muted small">🔺❌ 문제는 '약점 복습'에 모여요. 오늘 ${todayCount()}문항 연습했어요.</p>
      </div>
      <div class="stack">
        <button class="btn primary" id="again">한 세트 더</button>
        <a class="btn" href="#/parts">다른 파트 고르기</a>
        <a class="btn ghost" href="#/">홈으로</a>
      </div>
    `);
    document.getElementById('again').addEventListener('click', () => { stopEverything(); onAgain(); });
  }

  /* ───────────── 모의고사 ───────────── */
  function buildMock() {
    return PARTS.map((p) => ({ part: p, qs: shuffle(QS.filter((q) => q.part === p.id)).slice(0, p.count) }));
  }
  function viewMock() {
    setHeader('모의고사');
    const totalSec = PARTS.reduce((s, p) => s + p.count * (p.prep + p.ans + 6), 0);
    render(`
      <div class="card">
        <h2>📝 실전 모의고사</h2>
        <p>파트 1~7, <b>26문항</b>을 실제 순서와 시간으로 진행합니다. (약 ${Math.round(totalSec / 60)}분)</p>
        <ul class="tips">
          <li>문제마다 복습 화면 없이 계속 진행돼요 — 실전처럼!</li>
          <li>끝나면 문항별로 내 녹음을 듣고 모범답안과 비교·평가합니다.</li>
          <li>조용한 곳에서 이어폰을 끼고 하세요. 중간에 나가면 결과는 저장되지 않아요.</li>
        </ul>
      </div>
      <button class="btn primary" id="go">🎙️ 모의고사 시작</button>
    `);
    document.getElementById('go').addEventListener('click', runMock);
  }
  function partIntro(p, tk) {
    return new Promise((res) => {
      render(`
        <div class="card" style="text-align:center">
          <div class="part-no" style="margin:0 auto 10px;width:56px;height:56px;font-size:22px">${p.id}</div>
          <h2>${p.ko} <span class="muted small">${p.jp}</span></h2>
          <div class="times" style="justify-content:center">${timesChip(p)}</div>
          <p class="small muted">${esc(p.goal)}</p>
          <div class="tnum" id="auto" style="position:static;font-size:30px">5</div>
        </div>
        <button class="btn primary" id="next">시작 ›</button>`);
      let n = 5;
      const iv = setInterval(() => {
        if (!alive(tk)) { clearInterval(iv); return res(); }
        n--; const a = document.getElementById('auto'); if (a) a.textContent = n;
        if (n <= 0) { clearInterval(iv); res(); }
      }, 1000);
      document.getElementById('next').addEventListener('click', () => { clearInterval(iv); TTS.unlock(); res(); });
    });
  }
  async function runMock() {
    const tk = token;
    const micOk = await prepareAudio();
    if (!alive(tk)) return;
    const plan = buildMock();
    const total = plan.reduce((s, x) => s + x.qs.length, 0);
    const results = [];
    let idx = 0;
    for (const sec of plan) {
      await partIntro(sec.part, tk);
      if (!alive(tk)) return;
      for (const q of sec.qs) {
        const run = await runQuestion(q, idx++, total, tk, micOk, `모의고사 · 파트 ${sec.part.id}`);
        if (!run) return;
        results.push({ q, run });
      }
    }
    Rec.release();
    showMockResults(results);
  }
  function showMockResults(results) {
    setHeader('모의고사 결과');
    const rated = {};
    render(`
      <div class="card">
        <h2>🏁 모의고사 끝! 수고했어요</h2>
        <p class="small muted">문항별로 내 녹음을 듣고 모범답안과 비교해 ⭕🔺❌를 눌러 주세요. 누르는 즉시 기록에 저장됩니다.</p>
        <div id="mockScore" class="small"></div>
      </div>
      ${results.map((x, i) => {
        let audio = '<div class="muted small">녹음 없음</div>';
        if (x.run.blob) { const u = URL.createObjectURL(x.run.blob); objectUrls.push(u); audio = `<audio controls preload="none" src="${u}"></audio>`; }
        return `<div class="card" data-i="${i}">
          <div class="small muted">${i + 1}. 파트 ${x.q.part} · ${partById(x.q.part).ko}</div>
          ${x.q.pic || x.q.frames ? picHtml(x.q) : ''}
          <div><b>${jp(x.q.q)}</b></div>
          ${audio}
          ${x.run.transcript != null ? `<div class="transcript small">${esc(x.run.transcript || '(인식된 말 없음)')}</div>` : ''}
          <details style="margin-top:8px"><summary class="small">모범답안</summary>
            ${sentences(x.q.model).map((s) => `<div class="model-line"><div class="jp">${jp(s)}</div><button class="say" data-say="${esc(s)}">🔊</button></div>`).join('')}
            <div class="ko-block">${esc(x.q.modelKo)}</div>
          </details>
          <div class="rate-row" style="margin-top:10px">
            <button class="rate r2" data-r="2"><span class="em">⭕</span>잘했다</button>
            <button class="rate r1" data-r="1"><span class="em">🔺</span>아쉽다</button>
            <button class="rate r0" data-r="0"><span class="em">❌</span>못했다</button>
          </div>
        </div>`;
      }).join('')}
      <a class="btn" href="#/">홈으로</a>
    `);
    bindSay();
    const scoreEl = document.getElementById('mockScore');
    const updateScore = () => {
      const vals = Object.values(rated);
      if (!vals.length) { scoreEl.textContent = ''; return; }
      const c = [0, 0, 0]; vals.forEach((r) => c[r]++);
      scoreEl.innerHTML = `평가 ${vals.length}/${results.length} · ⭕ ${c[2]} 🔺 ${c[1]} ❌ ${c[0]} · 점수 ${Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length * 2) * 100)}%`;
    };
    app.querySelectorAll('[data-i]').forEach((card) => {
      const x = results[Number(card.dataset.i)];
      card.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        const r = Number(b.dataset.r);
        if (rated[card.dataset.i] === undefined) rateQuestion(x.q, r);
        else { db.ratings[x.q.id].r = r; const last = db.log.filter((l) => l.q === x.q.id).pop(); if (last) last.r = r; save(); }
        rated[card.dataset.i] = r;
        card.querySelectorAll('[data-r]').forEach((o) => o.classList.toggle('sel', o === b));
        updateScore();
      }));
    });
  }

  /* ───────────── 문형 카드 ───────────── */
  const BOX_DAYS = [0, 0, 1, 3, 7, 14, 30]; // 상자 번호별 다음 복습까지 일수
  const NEW_PER_DAY = 10;
  function cardQueue() {
    const now = Date.now();
    const seen = PATS.filter((c) => db.cards[c.id]);
    const due = seen.filter((c) => db.cards[c.id].due <= now).sort((a, b) => db.cards[a.id].box - db.cards[b.id].box);
    const s = startOfToday();
    const newToday = PATS.filter((c) => db.cards[c.id] && db.cards[c.id].first >= s).length;
    const fresh = PATS.filter((c) => !db.cards[c.id]).slice(0, Math.max(0, NEW_PER_DAY - newToday));
    return due.concat(fresh);
  }
  function viewCards() {
    setHeader('문형 카드');
    let queue = cardQueue();
    let extra = false;
    let cur = 0, flipped = false;
    const learned = PATS.filter((c) => db.cards[c.id] && db.cards[c.id].box >= 4).length;

    const draw = () => {
      if (cur >= queue.length) {
        render(`
          <div class="card big-result">
            <h2>✅ 오늘 카드 끝!</h2>
            <p class="muted small">외운 문형 ${PATS.filter((c) => db.cards[c.id] && db.cards[c.id].box >= 4).length}/${PATS.length}개 · 모르는 카드는 내일 다시 나와요.</p>
          </div>
          <div class="stack">
            <button class="btn" id="more">랜덤으로 10장 더 보기</button>
            <a class="btn ghost" href="#/">홈으로</a>
          </div>`);
        document.getElementById('more').addEventListener('click', () => { queue = shuffle(PATS).slice(0, 10); extra = true; cur = 0; flipped = false; draw(); });
        return;
      }
      const c = queue[cur];
      const st = db.cards[c.id];
      render(`
        <div class="progress"><span class="chip">${extra ? '추가 연습' : st ? `복습 · 상자 ${st.box}` : '새 카드'}</span><span class="muted small">${cur + 1} / ${queue.length} · 외운 문형 ${learned}/${PATS.length}</span></div>
        <div class="card flash" id="flash">
          ${!flipped ? `
            <div class="ko-big">${esc(c.ko)}</div>
            <div class="ex muted">${esc(c.exKo)}</div>
            <div class="tap">일본어로 소리 내어 말해 본 뒤 눌러서 정답 보기</div>` : `
            <div class="jp-big">${jp(c.jp)}</div>
            <div class="ex">${jp(c.ex)}</div>
            <div class="small muted">${esc(c.ko)} · ${esc(c.exKo)}</div>
            <div style="margin-top:12px"><button class="mini-btn" id="say">🔊 예문 듣기</button></div>
            <div class="small muted" style="margin-top:8px">주로 쓰는 파트: ${c.parts.map((n) => `파트${n}`).join(', ')}</div>`}
        </div>
        ${flipped ? `<div class="row"><button class="btn" id="no">😵 몰랐어요</button><button class="btn primary" id="yes">😊 알았어요</button></div>` : `<button class="btn primary" id="flip">정답 보기</button>`}
      `);
      if (!flipped) {
        const flip = () => { flipped = true; draw(); TTS.speak(c.ex); };
        document.getElementById('flash').addEventListener('click', flip);
        document.getElementById('flip').addEventListener('click', flip);
      } else {
        document.getElementById('say').addEventListener('click', (e) => { e.stopPropagation(); TTS.speak(c.ex); });
        const answer = (knew) => {
          TTS.stop();
          if (!extra) {
            const prev = db.cards[c.id] || { box: 1, first: Date.now() };
            const box = knew ? Math.min(6, prev.box + 1) : 1;
            db.cards[c.id] = { box, first: prev.first, due: knew ? startOfToday() + BOX_DAYS[box] * DAY : Date.now() };
            if (!knew) queue.push(c); // 오늘 한 번 더
            markStudied(); save();
          }
          cur++; flipped = false; draw();
        };
        document.getElementById('no').addEventListener('click', () => answer(false));
        document.getElementById('yes').addEventListener('click', () => answer(true));
      }
    };
    draw();
  }

  /* ───────────── 기록 · 설정 ───────────── */
  function viewRecords() {
    setHeader('내 기록 · 설정');
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const n = db.log.filter((l) => l.t >= s.getTime() && l.t < s.getTime() + DAY).length;
      days.push({ n, on: db.days.includes(dayKey(d)) });
    }
    const max = Math.max(1, ...days.map((d) => d.n));
    const boxes = [0, 0, 0];
    PATS.forEach((c) => { const b = db.cards[c.id]; if (!b) boxes[0]++; else if (b.box >= 4) boxes[2]++; else boxes[1]++; });
    const st = db.settings;
    const voiceInfo = !TTS.ok() ? '이 브라우저는 읽어주기를 지원하지 않아요'
      : TTS.voice ? `일본어 음성: ${esc(TTS.voice.name)}` : '일본어 음성을 못 찾았어요 (휴대폰 설정 > 음성에서 일본어 추가)';
    render(`
      <div class="card">
        <h2>📊 파트별 실력</h2>
        <p class="small muted">⭕=100 · 🔺=50 · ❌=0, 문제별 마지막 평가 기준</p>
        ${PARTS.map((p) => { const pr = partProgress(p); return `
          <div style="margin:10px 0">
            <div class="row" style="justify-content:space-between"><b style="flex:none">${p.id}. ${p.ko}</b>
              <span class="small muted" style="flex:none">${pr.done}/${pr.total}문제 · ${pr.score === null ? '아직 없음' : pr.score + '%'}</span></div>
            <div class="bar"><i style="width:${pr.score || 0}%;${pr.score !== null && pr.score < 50 ? 'background:var(--bad)' : ''}"></i></div>
          </div>`; }).join('')}
      </div>
      <div class="card">
        <h2>📅 최근 2주 <span class="muted small">🔥 ${streak()}일 연속</span></h2>
        <div class="days">${days.map((d) => `<div class="${d.on ? 'on' : ''}" style="height:${d.n ? 12 + d.n / max * 88 : 4}%" title="${d.n}문항"></div>`).join('')}</div>
        <div class="days-label"><span>2주 전</span><span>오늘</span></div>
        <h3>🃏 문형 카드</h3>
        <div class="small">외움 ${boxes[2]} · 공부 중 ${boxes[1]} · 아직 안 봄 ${boxes[0]} (총 ${PATS.length})</div>
      </div>
      <div class="card">
        <h2>⚙️ 설정</h2>
        <div class="setting"><div class="lbl"><b>문제 글자 보기</b><span>끄면 실전처럼 소리로만 들어요 (파트 1~5)</span></div>
          <label class="switch"><input type="checkbox" data-set="showText" ${st.showText ? 'checked' : ''}><span></span></label></div>
        <div class="setting"><div class="lbl"><b>문제 해석 같이 보기</b><span>답변 전에 한국어 해석 표시</span></div>
          <label class="switch"><input type="checkbox" data-set="showKo" ${st.showKo ? 'checked' : ''}><span></span></label></div>
        <div class="setting"><div class="lbl"><b>후리가나</b><span>한자 위에 읽는 법 표시</span></div>
          <label class="switch"><input type="checkbox" data-set="furigana" ${st.furigana ? 'checked' : ''}><span></span></label></div>
        <div class="setting"><div class="lbl"><b>읽어주기 속도</b><span>${voiceInfo}</span></div>
          <select id="rate">${[0.7, 0.8, 0.9, 1.0, 1.1].map((r) => `<option value="${r}" ${st.rate === r ? 'selected' : ''}>${r}x</option>`).join('')}</select></div>
        <div class="setting"><div class="lbl"><b>말한 내용 글자로 보기 (실험)</b><span>${STT.supported() ? '음성인식으로 내 답을 글자로 보여줘요. 일부 폰에선 녹음과 동시에 안 될 수 있어요' : '이 브라우저는 지원하지 않아요'}</span></div>
          <label class="switch"><input type="checkbox" data-set="stt" ${st.stt ? 'checked' : ''} ${STT.supported() ? '' : 'disabled'}><span></span></label></div>
        <div style="margin-top:10px"><button class="mini-btn" id="testVoice">🔊 음성 테스트</button></div>
      </div>
      <div class="card">
        <h2>🗂️ 데이터</h2>
        <p class="small muted">기록은 이 휴대폰 브라우저 안에만 저장돼요. 녹음 파일은 저장되지 않습니다.</p>
        <button class="btn ghost" id="reset">기록 전체 지우기</button>
      </div>
    `);
    app.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('change', () => { db.settings[el.dataset.set] = el.checked; save(); }));
    document.getElementById('rate').addEventListener('change', (e) => { db.settings.rate = Number(e.target.value); save(); });
    document.getElementById('testVoice').addEventListener('click', () => TTS.speak('こんにちは。{一緒|いっしょ}に{日本語|にほんご}を{頑張|がんば}りましょう。'));
    document.getElementById('reset').addEventListener('click', () => {
      if (confirm('연습 기록, 카드 진도, 메모가 모두 지워집니다. 계속할까요?')) {
        const s = db.settings; db = defaults(); db.settings = s; save(); viewRecords();
      }
    });
  }

  /* ───────────── 화면 이동 ───────────── */
  const routes = {
    '': viewHome, parts: viewParts, practice: viewPracticeIntro, templates: viewTemplates,
    cards: viewCards, mock: viewMock, records: viewRecords, weak: viewWeak
  };
  function route() {
    stopEverything();
    const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
    (routes[name] || viewHome)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();

  // 테스트·디버그용
  window.__sjpt = { db: () => db, stopEverything };
})();
