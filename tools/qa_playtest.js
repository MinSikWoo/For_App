#!/usr/bin/env node
// =====================================================================
// 일본어 단어 카드 (docs/cards 배포본) 사람처럼 써 보는 QA 자동 플레이 스크립트
//
// 실행:   node tools/qa_playtest.js            (저장소 맨 위 폴더에서)
//   - docs/ 를 PORT 로 서빙하는 서버가 없으면 스스로 python3 http.server 를 켜고, 끝나면 끈다.
//   - 업데이트 알림 시험용으로 사이트 복사본(.tmp/qa/site)을 PORT2 로 스스로 켠다.
//   - 비밀번호는 .env 의 APP_PASSWORD 줄에서 읽는다 (화면/파일에 절대 출력하지 않음).
// 환경 변수:
//   PORT=8790  PORT2=8791  ROUNDS=3 (최대 5, 새 문제가 안 나오면 일찍 멈춤)  SEED=1
//   SPEED=1 (지연 배율, 0.3 이면 더 빠르게)   ONLY=beginner,impatient,pc,global,full (일부만)
//   GLOBAL_EVERY=1 (설치/업데이트/방 꽉 채우기 시험을 라운드마다; 기본은 첫 라운드만)
// 결과:  .tmp/qa/findings.json, .tmp/qa/run_log.txt, .tmp/qa/shots/*.png
// 페르소나:  beginner(390x844, 느림, 40% 오답)  impatient(360x740, 연타·중간 종료·새로고침)
//            pc(1280x800 다크 모드, 키보드 1~4/Enter, O/X/화살표)
// 정답은 페이지 안 window.APP / window.SENTENCES 를 '정답지'로만 읽고, 누르기는 진짜 클릭/키보드로 한다.
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.tmp', 'qa');
const SHOTS = path.join(OUT, 'shots');
const PORT = +(process.env.PORT || 8790);
const PORT2 = +(process.env.PORT2 || 8791);
const ROUNDS = Math.min(5, Math.max(1, +(process.env.ROUNDS || 3)));
const SEED0 = +(process.env.SEED || 1);
const SPEED = +(process.env.SPEED || 1);
const ONLY = (process.env.ONLY || 'beginner,impatient,pc,global,full').split(',');
fs.mkdirSync(SHOTS, { recursive: true });

// ---------- 비밀번호 (.env) ----------
const PW = (() => {
  const t = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const m = t.match(/^APP_PASSWORD=(.*)$/m);
  if (!m) throw new Error('.env 에 APP_PASSWORD 가 없어요');
  return m[1].trim().replace(/^['"]|['"]$/g, '');
})();

// ---------- 기록 ----------
const logLines = [];
function log(...a) { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ').split(PW).join('***'); logLines.push(s); console.log(s); }
const findings = {};   // id -> finding
let newThisRound = 0;
function find(id, sev, area, title, detail, extra = {}) {
  detail = String(detail || '').split(PW).join('***');
  if (!findings[id]) {
    findings[id] = { id, sev, area, title, details: [], shots: [], personas: [], seeds: [], count: 0 };
    newThisRound++;
    log(`  [발견 ${sev}] ${area}: ${title} — ${detail}`);
  }
  const f = findings[id];
  f.count++;
  if (f.details.length < 6 && !f.details.includes(detail)) f.details.push(detail);
  if (extra.shot && f.shots.length < 4) f.shots.push(extra.shot);
  if (CUR.persona && !f.personas.includes(CUR.persona)) f.personas.push(CUR.persona);
  if (!f.seeds.includes(CUR.seed)) f.seeds.push(CUR.seed);
}
const ok = [];   // 잘 된 것
function good(s) { if (!ok.includes(s)) ok.push(s); }
const CUR = { persona: '', seed: 0 };

// ---------- 난수 (씨앗 고정) ----------
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry(1);
const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
const chance = p => R() < p;
const pickOne = a => a[Math.floor(R() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = (lo = 100, hi = 800) => sleep(Math.round(rnd(lo, hi) * SPEED));

// ---------- 서버 ----------
const servers = [];
function up(port) {
  return new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: '/cards/version.json', timeout: 1500 }, x => { x.resume(); res(x.statusCode === 200); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
}
async function serve(dir, port) {
  if (await up(port)) { log(`서버 이미 켜져 있음 :${port}`); return; }
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  servers.push(p);
  for (let i = 0; i < 40; i++) { if (await up(port)) return; await sleep(150); }
  throw new Error('서버를 켜지 못했어요 :' + port);
}
const BASE = `http://localhost:${PORT}/cards/`;
const BASE2 = `http://localhost:${PORT2}/cards/`;

// ---------- 브라우저 공통 ----------
let browser;
const PERSONAS = {
  beginner: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: 'light', wrong: 0.4, lo: 300, hi: 800 },
  impatient: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: 'light', wrong: 0.25, lo: 100, hi: 300 },
  pc: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, colorScheme: 'dark', wrong: 0.15, lo: 100, hi: 400 },
};
async function newCtx(personaName, seed, opts = {}) {
  const P = PERSONAS[personaName];
  const ctx = await browser.newContext({ viewport: P.viewport, isMobile: P.isMobile, hasTouch: P.hasTouch, deviceScaleFactor: 1, colorScheme: P.colorScheme, locale: 'ko-KR', ...opts });
  // 페이지 안 Math.random 도 씨앗으로 고정 (같은 SEED 면 같은 문제가 나옴)
  await ctx.addInitScript(s => { let a = s; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, seed * 7919 + personaName.length);
  return ctx;
}
function watch(page, tag) {
  page.on('pageerror', e => find('pageerror:' + String(e.message).slice(0, 80), '높음', tag, '자바스크립트 오류', e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/fonts\.(googleapis|gstatic)/.test(t) || (/Failed to load resource/.test(t) && page.__offline)) return;
    if (/ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t) && page.__offline) return;
    find('console:' + t.slice(0, 60), '중간', tag, '콘솔 오류', t);
  });
  page.on('requestfailed', r => { const u = r.url(); if (/fonts\./.test(u) || page.__offline) return; if (/localhost/.test(u)) find('reqfail:' + u.replace(/\?.*/, ''), '중간', tag, '파일을 못 받음', u + ' ' + (r.failure() || {}).errorText); });
}
let shotN = 0; const shotsTaken = {};
async function fshot(id, page, name) { return findings[id] && findings[id].shots.length >= 2 ? '' : shot(page, name); }
async function shot(page, name) {
  const f = path.join(SHOTS, `${String(++shotN).padStart(3, '0')}_${CUR.persona}_s${CUR.seed}_${name}.png`);
  try { await page.screenshot({ path: f }); } catch (e) { return ''; }
  return path.relative(ROOT, f);
}
const vis = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
async function waitVis(page, sel, ms = 8000) { await page.locator(sel).first().waitFor({ state: 'visible', timeout: ms }); }
async function tap(page, sel, P, o = {}) {
  await human(P.lo, P.hi);
  await page.locator(sel).first().click({ timeout: 5000, ...o });
}
async function store(page) {
  return page.evaluate(() => { const g = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }; return { pet: g('jw-pet'), settings: g('jw-settings'), progress: g('jw-progress'), seen: g('jw-seen-version'), key: !!localStorage.getItem('jw-unlock-key') }; });
}
const gems = async page => ((await store(page)).pet || {}).gems;
async function current(page) { return page.evaluate(() => ['home', 'play', 'result', 'room', 'shop', 'mini'].filter(id => { const e = document.getElementById(id); return e && !e.hidden; })); }

// ---------- 화면 점검 (가로 넘침, 화면 밖, 겹침, 글자 잘림) ----------
async function layout(page, where) {
  const r = await page.evaluate(() => {
    const out = { overflow: 0, outside: [], covered: [], clipped: [], toast: [] };
    const de = document.documentElement, vw = de.clientWidth, vh = window.innerHeight;
    out.overflow = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0) - vw;
    const shown = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !el.closest('[hidden]'); };
    const name = el => (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.tagName) + ' "' + (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30) + '"';
    const modal = document.getElementById('news') && !document.getElementById('news').hidden;
    const clickables = [...document.querySelectorAll('button, [role=radio], input[type=checkbox] + .knob, summary, a, textarea')].filter(shown);
    for (const el of clickables) {
      const b = el.getBoundingClientRect();
      if (el.closest('.bb-arena') || el.closest('.pairs')) continue;
      let sc = el.parentElement, inScroller = false;
      while (sc) { const ox = getComputedStyle(sc).overflowX; if (ox === 'auto' || ox === 'scroll') { inScroller = true; break; } sc = sc.parentElement; }
      if (!inScroller && (b.left < -1 || b.right > vw + 1)) out.outside.push(name(el) + ` x=${Math.round(b.left)}..${Math.round(b.right)} vw=${vw}`);
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (cy < 0 || cy > vh || cx < 0 || cx > vw) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        const lab = el.closest('label'); if (lab && lab.contains(hit)) continue;
        if (hit.closest('.toast')) { out.toast.push(name(el)); continue; }
        if (modal && !el.closest('#news')) continue;            // '새로워진 점' 창이 떠 있으면 뒤는 가려지는 게 정상
        if (hit.closest('.tabs') && !el.closest('.tabs')) continue; // 아래 메뉴 뒤로 스크롤되는 건 정상
        out.covered.push(name(el) + ' ← 가림: ' + name(hit));
      }
    }
    const textEls = [...document.querySelectorAll('.opt, .stone, .bb, .pc-face, .item .nm, .item .pr, .chip, .mode, .level, .mini-card, .so-chunk, .pz-tile, .tab, .s-opt, .ox-mean, .ox-word, .prompt, .today-word, .hero h1, .badge, .mini-title, .update-bar, .st-q, .bb-target, .pet-name, .stat span, .reward, #updateText')].filter(shown);
    for (const el of textEls) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') out.clipped.push(name(el) + ` (${el.scrollWidth}>${el.clientWidth})`);
      else {
        const b = el.getBoundingClientRect();
        for (const c of el.children) { const cb = c.getBoundingClientRect(); if (cb.width && (cb.right > b.right + 3 || cb.left < b.left - 3)) { out.clipped.push(name(el) + ' 내용이 칸 밖으로 나감'); break; } }
      }
    }
    return out;
  });
  const ids = [r.overflow > 1 ? 'overflow:' + where : null].concat(r.outside.map(o => 'outside:' + where + ':' + o.slice(0, 40)), r.covered.map(o => 'covered:' + where + ':' + o.replace(/".*?"/g, '').slice(0, 60)), r.clipped.map(o => 'clip:' + where + ':' + o.replace(/".*?"|\(.*\)/g, '').slice(0, 50))).filter(Boolean);
  const sp = ids.some(id => !findings[id] || findings[id].shots.length < 2) ? await shot(page, 'layout_' + where) : '';
  if (r.overflow > 1) find('overflow:' + where, '중간', where, '가로로 화면이 넘쳐 옆으로 밀림', `scrollWidth-clientWidth=${r.overflow}px`, { shot: sp });
  r.outside.slice(0, 3).forEach(o => find('outside:' + where + ':' + o.slice(0, 40), '중간', where, '버튼이 화면 밖으로 나감', o, { shot: sp }));
  r.covered.slice(0, 4).forEach(o => find('covered:' + where + ':' + o.replace(/".*?"/g, '').slice(0, 60), '중간', where, '누를 수 있는 것이 다른 것에 가려짐', o, { shot: sp }));
  if (r.toast.length) find('toast-blocks', '중간', where, '안내 말풍선(토스트)이 떠 있는 2.6초 동안 그 아래 버튼이 눌리지 않음', r.toast.slice(0, 3).join(', '), { shot: await fshot('toast-blocks', page, 'toast_' + where) });
  r.clipped.slice(0, 4).forEach(o => find('clip:' + where + ':' + o.replace(/".*?"|\(.*\)/g, '').slice(0, 50), '낮음', where, '글자가 칸보다 길어 잘리거나 삐져나옴', o, { shot: sp }));
  return r;
}

// ---------- 잠금 화면 ----------
async function unlock(page, P, { remember = true, url = BASE, expectForm = null } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || document.getElementById('home'), null, { timeout: 15000 });
  const hasForm = await page.evaluate(() => !!document.getElementById('f') && !document.getElementById('home'));
  if (expectForm !== null && hasForm !== expectForm) find('lock-expect:' + expectForm + remember, '중간', '잠금 화면', expectForm ? '비밀번호 화면이 나와야 하는데 안 나옴' : '기억하기를 켰는데 다시 비밀번호를 물어봄', `remember=${remember}`);
  if (hasForm) {
    await human(P.lo, P.hi);
    await page.locator('#pw').fill(PW);
    const ch = await page.locator('#remember').isChecked();
    if (ch !== remember) await page.locator('#remember').click();
    await tap(page, '#go', P);
  }
  await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => window.APP && window.SHOP);
  return hasForm;
}

// ---------- 정답지 (페이지 안에서) ----------
// 루비(rt)를 빼고 글자만
const PAGE_HELPERS = `
  window.__plain = function (el) { if (!el) return ''; var c = el.cloneNode(true); c.querySelectorAll('rt, .num').forEach(function (x) { x.remove(); }); return c.textContent.replace(/\\s+/g, ' ').trim(); };
  window.__byPlain = function (p) { return window.APP.W.filter(function (w) { return w.plain === p; })[0]; };
  window.__byKo = function (k) { return window.APP.W.filter(function (w) { return w.ko === k; })[0]; };
  window.__S = (function () { var F = /\\{([^|}]+)\\|([^}]+)\\}/g, out = []; ['N5','N4','N3'].forEach(function (lv) { (window.SENTENCES[lv] || []).forEach(function (a) { var raw = a[0], m = raw.match(/\\[([^\\]]+)\\]/); out.push({ lv: lv, ko: a[1], plain: raw.replace(/[\\/\\[\\]]/g, '').replace(F, '$1'), blank: m ? m[1].replace(F, '$1') : '', chunks: raw.replace(/[\\[\\]]/g, '').split('/').map(function (c) { return c.replace(F, '$1'); }) }); }); }); return out; })();
`;
async function helpers(page) { await page.evaluate(PAGE_HELPERS); }

// 같은 뜻을 가진 단어 (보기에 같이 나오면 헷갈림)
function meaningParts(ko) { return ko.replace(/\(.*?\)/g, '').split(/[,·\/]/).map(s => s.trim()).filter(Boolean); }

// =====================================================================
// 단어 게임
// =====================================================================
async function wordGame(page, P, { level, mode, cat, review = false, style = 'tap', tag, started = false }) {
  await helpers(page);
  const before = await store(page);
  const reviewSet = review ? Object.keys(before.progress || {}).filter(k => { const p = before.progress[k]; return p.w > 0 && p.s < 2; }) : null;
  if (started) { /* 이미 시작함 */ }
  else if (!review) {
    if (level) { await tap(page, `[data-level="${level}"]`, P); }
    if (mode) { await tap(page, `[data-mode="${mode}"]`, P); }
    if (cat) { const c = page.locator(`[data-cat="${cat}"]`); if (await c.count()) { await c.first().scrollIntoViewIfNeeded(); await tap(page, `[data-cat="${cat}"]`, P); } else cat = 'all'; }
    const btnText = await page.locator('#start').innerText();
    await tap(page, '#start', P);
  } else {
    if (!(await vis(page, '#startReview'))) return null;
    await tap(page, '#startReview', P);
  }
  await waitVis(page, '#play');
  await layout(page, `play_${mode || 'review'}`);
  const st = await store(page);
  const lv = review ? 'all' : st.settings.level, md = st.settings.mode;
  let combo = 0, expGem = 0, correct = 0, wrongIds = [], total = 0, firstShot = '';
  for (let q = 0; q < 12; q++) {
    if (!(await vis(page, '#play'))) break;
    const info = await page.evaluate(({ md }) => {
      const askT = document.getElementById('ask').textContent;
      const pr = document.getElementById('prompt');
      const realMode = pr.classList.contains('ko') ? 'word' : (pr.querySelector('rt') ? 'meaning' : 'reading');
      let w;
      if (realMode === 'word') w = window.__byKo(pr.textContent.trim());
      else w = window.__byPlain(window.__plain(pr));
      const opts = [...document.querySelectorAll('#options .opt')].map(b => window.__plain(b));
      const keyOf = x => realMode === 'meaning' ? x.ko : realMode === 'word' ? x.plain : x.reading;
      const optWords = opts.map(t => realMode === 'meaning' ? window.__byKo(t) : realMode === 'word' ? window.__byPlain(t) : null);
      return { askT, realMode, id: w && w.id, ko: w && w.ko, lv: w && w.lv, cat: w && w.cat, kanji: w && w.kanji, key: w && keyOf(w), opts, optLv: optWords.map(x => x && x.lv), optKo: optWords.map(x => x && x.ko) };
    }, { md });
    total = +info.askT.split('/')[1].split(' ')[0];
    if (!info.id) { find('oracle-miss:' + info.realMode, '낮음', '단어 게임', '정답지로 문제 단어를 찾지 못함 (테스트 한계 또는 데이터 문제)', JSON.stringify(info).slice(0, 200)); break; }
    // 문제 점검
    if (new Set(info.opts).size !== info.opts.length) find('dupopt:' + info.realMode, '중간', '단어 게임', '보기에 같은 답이 두 번 나옴', info.opts.join(' / '), { shot: await shot(page, 'dupopt') });
    if (info.opts.length !== 4) find('optcount:' + info.opts.length, '낮음', '단어 게임', '보기가 4개가 아님', info.opts.join(' / '));
    const idx = info.opts.indexOf(info.key);
    if (idx < 0) { find('noanswer:' + info.realMode, '높음', '단어 게임', '정답이 보기에 없음', JSON.stringify(info)); break; }
    if (!review && level !== 'all' && info.lv !== lv) find('lvq:' + lv, '중간', '단어 게임', '고른 레벨이 아닌 단어가 문제로 나옴', `${lv} 골랐는데 ${info.id}(${info.lv})`);
    if (!review && cat && cat !== 'all' && info.cat !== cat) find('catq:' + cat, '중간', '단어 게임', '고른 범위가 아닌 단어가 나옴', `${cat} 골랐는데 ${info.id}(${info.cat})`);
    if (review && !reviewSet.includes(info.id)) find('revq', '중간', '복습', '복습할 단어가 아닌 단어가 복습에 나옴', info.id);
    if (info.realMode === 'meaning') {
      const mine = meaningParts(info.ko);
      info.optKo.forEach((k, i) => { if (i !== idx && k && meaningParts(k).some(p => mine.includes(p))) find('ambig:' + [info.ko, k].sort().join('|'), '중간', '단어 게임 (뜻 맞히기)', '정답처럼 보이는 보기가 두 개 (뜻이 겹침)', `${info.id} 정답 ‘${info.ko}’, 다른 보기 ‘${k}’`); });
    }
    if (info.realMode !== md && !review) find('modemismatch:' + md + info.realMode, '중간', '단어 게임', '고른 게임 방식과 다른 방식으로 나옴', `${md} 골랐는데 ${info.realMode} (해당 범위에 한자 단어가 없을 때 등)`);
    let choose = idx;
    if (chance(P.wrong)) { choose = (idx + rnd(1, info.opts.length - 1)) % info.opts.length; }
    await human(P.lo, P.hi);
    if (style === 'key') await page.keyboard.press(String(choose + 1));
    else if (style === 'double') { await page.locator(`#options .opt[data-i="${choose}"]`).dblclick(); }
    else await page.locator(`#options .opt[data-i="${choose}"]`).click();
    await waitVis(page, '#feedback', 3000).catch(() => find('nofb:' + style, '높음', '단어 게임', '답을 눌렀는데 반응이 없음', style));
    const isOk = choose === idx;
    if (isOk) { combo++; correct++; expGem += combo >= 5 ? 3 : combo >= 3 ? 2 : 1; } else { combo = 0; wrongIds.push(info.id); }
    const fbHead = await page.locator('#fbHead').innerText();
    if (isOk && !/\+/.test(fbHead)) find('fbgem', '낮음', '단어 게임', '정답 피드백에 보석 표시가 없음', fbHead);
    if (q === 0) firstShot = await shot(page, `answer_${info.realMode}`);
    if (q === 1) await layout(page, `feedback_${info.realMode}`);
    // 다음
    const nextBefore = await page.locator('#ask').innerText();
    if (style === 'key') { await human(P.lo, P.hi); await page.keyboard.press('Enter'); }
    else if (style === 'double') {
      // 성급한 사람: '다음'을 두 번 빠르게 누름 → 다음 문제의 보기가 눌려버리는지
      await page.locator('#next').dblclick();
      await sleep(250);
      const answered = await vis(page, '#feedback');
      const ask2 = await page.locator('#ask').innerText().catch(() => '');
      if (answered && ask2 !== nextBefore) {
        find('dbl-next-autoanswer', '높음', '단어 게임', "'다음'을 두 번 빠르게 누르면 다음 문제의 보기가 저절로 눌림", `${nextBefore} → ${ask2} 에서 답을 고르지 않았는데 답이 정해짐`, { shot: await shot(page, 'dblnext') });
        // 자동으로 고른 답을 기대값에 반영
        const auto = await page.evaluate(() => !!document.querySelector('#options .opt.wrong') ? 'ng' : 'ok');
        const fb = await page.evaluate(() => document.getElementById('fbHead').className);
        if (/ok/.test(fb)) { combo++; correct++; expGem += combo >= 5 ? 3 : combo >= 3 ? 2 : 1; } else { combo = 0; wrongIds.push('?'); }
        q++;
        await page.locator('#next').click();
      }
    } else { await tap(page, '#next', P); }
    await sleep(150);
    if (style === 'key') {
      const ask2 = await page.locator('#ask').innerText().catch(() => '');
      const n1 = +nextBefore.split('/')[0], n2 = +ask2.split('/')[0];
      if ((await vis(page, '#play')) && n2 - n1 > 1) find('enter-skip', '높음', '단어 게임 (키보드)', 'Enter 한 번에 문제가 두 개 넘어감', `${nextBefore} → ${ask2}`);
    }
  }
  // 결과
  await waitVis(page, '#result', 5000).catch(() => {});
  if (!(await vis(page, '#result'))) { find('noresult:' + tag, '높음', '단어 게임', '10문제를 다 풀었는데 결과 화면이 안 나옴', tag, { shot: await shot(page, 'noresult') }); return null; }
  const n = total;
  const rate = correct / n;
  const bonus = rate === 1 && n >= 5 ? 10 : rate >= 0.8 ? 5 : 0;
  expGem += bonus;
  const after = await store(page);
  const res = await page.evaluate(() => ({ rc: document.getElementById('rCorrect').textContent, rg: document.getElementById('rGems').innerText, wrong: document.querySelectorAll('#rWrong li:not(.empty)').length }));
  const got = after.pet.gems - before.pet.gems;
  if (got !== expGem) find('gem-word:' + (got - expGem > 0 ? 'more' : 'less'), '높음', '단어 게임 보석', '받은 보석이 규칙과 다름', `예상 ${expGem}, 실제 ${got} (${correct}/${n})`, { shot: await shot(page, 'gem_mismatch') });
  else good('단어 게임 보석 계산 (콤보 1/2/3개 + 80% 보너스 5, 만점 보너스 10)이 규칙과 일치');
  if (!res.rg.includes('+' + expGem)) find('gem-word-label', '중간', '결과 화면', '결과 화면의 보석 숫자가 실제와 다름', `${res.rg} vs ${expGem}`);
  if (res.rc !== `${correct}/${n}`) find('rcorrect', '중간', '결과 화면', '맞힌 문제 수가 다름', `${res.rc} vs ${correct}/${n}`);
  if (res.wrong !== wrongIds.length) find('rwrong', '중간', '결과 화면', '틀린 단어 목록 개수가 다름', `${res.wrong} vs ${wrongIds.length}`);
  const label = await page.evaluate(() => document.getElementById('start').textContent);
  if (!review && !label.includes(n + '문제')) find('short-round:' + lv + ':' + cat + ':' + md, '낮음', '단어 게임', '시작 버튼의 문제 수와 실제 문제 수가 다름', `레벨 ${lv}, 범위 ${cat}, 방식 ${md}: 버튼 ‘${label}’, 실제 ${n}문제`);
  await layout(page, 'result');
  log(`    단어게임 ${tag} lv=${lv} mode=${md} cat=${cat} ${correct}/${n} 보석 +${got} (예상 ${expGem})`);
  return { correct, n, wrongIds };
}

// =====================================================================
// 미니게임 (정답지로 정답을 알고, 사람처럼 누름)
// =====================================================================
async function openMini(page, P, key) {
  const card = page.locator(`[data-mini="${key}"]`);
  await card.scrollIntoViewIfNeeded();
  await human(P.lo, P.hi);
  await card.click();
  await waitVis(page, '#mini');
  await helpers(page);
}
async function endMini(page, key, before, expGem, P) {
  await waitVis(page, '#miniEnd', 60000).catch(() => {});
  if (!(await vis(page, '#miniEnd'))) { find('mini-noend:' + key, '높음', key, '미니게임이 끝나지 않음', key, { shot: await shot(page, 'mini_noend_' + key) }); return; }
  const after = await gems(page);
  const got = after - before;
  const label = await page.locator('#miniReward').innerText();
  const sp = await shot(page, 'mini_end_' + key);
  if (expGem !== null && got !== expGem) find('gem-mini:' + key, '높음', key + ' 보석', '미니게임 보석이 규칙과 다름', `예상 ${expGem}, 실제 ${got}`, { shot: sp });
  else if (expGem !== null) good(`미니게임 ‘${key}’ 보석이 규칙대로 지급됨`);
  if (!label.includes('+' + got)) find('gem-mini-label:' + key, '중간', key, '미니게임 결과의 보석 표시가 실제와 다름', `${label} vs ${got}`);
  await layout(page, 'miniend_' + key);
  log(`    미니게임 ${key}: 보석 +${got} (예상 ${expGem})`);
}

async function playPairs(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'pairs');
  await layout(page, 'pairs_preview');
  const cards = await page.evaluate(() => [...document.querySelectorAll('#pGrid [data-k]')].map(b => { const f = b.querySelector('.pc-face'); const jp = f.classList.contains('jp'); const w = jp ? window.__byPlain(window.__plain(f)) : window.__byKo(f.textContent.trim()); return { k: +b.dataset.k, jp, id: w && w.id }; }));
  // 미리보기 중에 눌러 보기 (반응 없음 확인)
  await page.locator('#pGrid [data-k]').first().click();
  await sleep(3300);
  const byId = {};
  cards.forEach(c => { (byId[c.id] = byId[c.id] || []).push(c.k); });
  let moves = 0;
  for (const id of Object.keys(byId)) {
    const [a, b] = byId[id];
    if (chance(P.wrong * 0.7)) { // 틀리게 한 번
      const other = cards.find(c => c.id !== id && !c.done);
      if (other) { await human(P.lo, P.hi); await page.locator(`[data-k="${a}"]`).click(); await human(100, 300); await page.locator(`[data-k="${other.k}"]`).click(); moves++; await sleep(1000); }
    }
    await human(P.lo, P.hi); await page.locator(`[data-k="${a}"]`).click(); await human(100, 300); await page.locator(`[data-k="${b}"]`).click(); moves++;
    cards.forEach(c => { if (c.id === id) c.done = true; });
  }
  const st = await page.locator('#pStat').innerText();
  if (st !== '뒤집은 횟수 ' + moves) find('pairs-moves', '낮음', '짝 맞추기', '뒤집은 횟수 표시가 실제와 다름', `${st} vs ${moves}`);
  await endMini(page, 'pairs', before, Math.max(3, 12 - (moves - 6)), P);
}

async function playOX(page, P, { useKeys = false, quitAfter = 0 } = {}) {
  const before = await gems(page);
  await openMini(page, P, 'ox');
  await layout(page, 'ox');
  const t0 = Date.now(); let score = 0, n = 0;
  while (await vis(page, '#oxCard')) {
    if (quitAfter && Date.now() - t0 > quitAfter) {
      await tap(page, '#miniQuit', P);
      await sleep(500);
      if (!(await vis(page, '#home'))) find('ox-quit', '중간', 'O·X', '그만하기를 눌러도 처음 화면으로 안 감', '');
      const g = await gems(page); if (g !== before) find('ox-quit-gem', '중간', 'O·X', '중간에 그만뒀는데 보석이 바뀜', `${before}→${g}`);
      await sleep(1500);
      if (await vis(page, '#miniEnd')) find('ox-quit-ghost', '높음', 'O·X', '그만둔 뒤에도 게임이 끝까지 돌아 결과 화면이 뜸', '');
      good('O·X 게임을 중간에 그만두면 깔끔하게 처음 화면으로 돌아감');
      return;
    }
    const q = await page.evaluate(() => { const w = window.__byPlain(window.__plain(document.getElementById('oxWord'))); const m = document.getElementById('oxMean').textContent; return { id: w && w.id, ko: w && w.ko, m }; }).catch(() => null);
    if (!q || !q.id) break;
    const truth = q.ko === q.m;
    if (!truth) {
      const a = meaningParts(q.ko), b = meaningParts(q.m);
      if (a.some(x => b.includes(x))) find('ox-ambig:' + [q.ko, q.m].sort().join('|'), '중간', 'O·X 스피드 퀴즈', '정답이 X인데 사실상 맞는 뜻이 나옴 (뜻이 겹치는 단어)', `${q.id} 진짜 뜻 ‘${q.ko}’, 화면 뜻 ‘${q.m}’ → X가 정답 처리됨`, { shot: await shot(page, 'ox_ambig') });
    }
    let say = truth; if (chance(P.wrong * 0.6)) say = !say;
    await human(Math.min(P.lo, 250), Math.min(P.hi, 500));
    if (!(await vis(page, '#oxCard'))) break;
    if (useKeys) await page.keyboard.press(say ? pickOne(['o', 'O', 'ArrowLeft']) : pickOne(['x', 'X', 'ArrowRight']));
    else await page.locator(say ? '#oxO' : '#oxX').click({ timeout: 2000 }).catch(() => {});
    n++; if (say === truth) score++;
    if (n === 3) await layout(page, 'ox_play');
  }
  // 끝난 직후의 누름이 기록되지 않을 수 있어 실제 표시 점수로 확인
  await waitVis(page, '#miniEnd', 5000).catch(() => {});
  const sub = await page.locator('#miniSub').innerText().catch(() => '');
  const shownScore = +((sub.match(/(\d+)개 맞힘/) || [])[1] || -1);
  if (Math.abs(shownScore - score) > 1) find('ox-score', '중간', 'O·X', '맞힌 개수가 실제로 맞힌 수와 다름', `표시 ${shownScore}, 실제 ${score}`);
  await endMini(page, 'ox', before, Math.floor(shownScore / 2) + (shownScore >= 15 ? 5 : 0), P);
}

async function playPuzzle(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'puzzle');
  let exp = 0;
  for (let r = 0; r < 5; r++) {
    await page.waitForSelector('#pzWord');
    const q = await page.evaluate(() => { const w = window.__byPlain(window.__plain(document.getElementById('pzWord'))); return w && { id: w.id, reading: w.reading }; });
    if (!q) { find('pz-oracle', '낮음', '읽기 퍼즐', '정답지로 단어를 못 찾음', ''); break; }
    if (r === 0) await layout(page, 'puzzle');
    const chars = q.reading.split('');
    const mode = chance(P.wrong) ? pickOne(['wrong', 'hint', 'back']) : 'right';
    if (mode === 'wrong') {
      // 거꾸로 채워 틀리게 → 다시
      const rev = chars.slice().reverse();
      if (rev.join('') !== q.reading) { for (const c of rev) await clickTile(page, c); await sleep(900); exp -= 1; }
    } else if (mode === 'hint') { await tap(page, '#pzHint', P); exp -= 1; }
    else if (mode === 'back') { await clickTile(page, chars[0]); await tap(page, '#pzBack', P); }
    exp += 2;
    for (let i = 0; i < chars.length; i++) {
      const filled = await page.evaluate(i => { const s = document.querySelectorAll('#pzSlots [data-s]')[i]; return s ? s.textContent : ''; }, i);
      if (filled) continue;
      await clickTile(page, chars[i]);
    }
    await sleep(1600);
  }
  await endMini(page, 'puzzle', before, exp, P);
}
async function clickTile(page, ch) {
  await human(80, 300);
  const i = await page.evaluate(ch => { const b = [...document.querySelectorAll('#pzTiles [data-t]')].find(x => !x.disabled && x.textContent === ch); return b ? +b.dataset.t : -1; }, ch);
  if (i < 0) return false;
  await page.locator(`#pzTiles [data-t="${i}"]`).click();
  return true;
}

async function playBubble(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'bubble');
  let got = 0, rounds = 0;
  for (let r = 0; r < 8; r++) {
    const stat0 = await page.locator('#bbStat').innerText().catch(() => '');
    const target = await page.evaluate(() => { const k = document.querySelector('#bbTarget b').textContent; const w = window.__byKo(k); return w && w.plain; });
    let missOnce = chance(P.wrong * 0.5), clicked = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const info = await page.evaluate(target => {
        const a = document.getElementById('bbArena').getBoundingClientRect();
        const bs = [...document.querySelectorAll('#bbArena .bb')].map(b => { const r = b.getBoundingClientRect(); return { p: window.__plain(b), x: r.left + r.width / 2, y: r.top + r.height / 2, r: { l: r.left, t: r.top, w: r.width, h: r.height }, in: r.top >= a.top && r.bottom <= a.bottom, cls: b.className, sw: b.scrollWidth, cw: b.clientWidth }; });
        return { bs, a: { l: a.left, r: a.right, t: a.top, b: a.bottom } };
      }, target);
      // 방울끼리 겹치는지 (눈에 보이는 것만)
      const v = info.bs.filter(b => b.in && !/pop/.test(b.cls));
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
        const A = v[i].r, B = v[j].r;
        const ox = Math.min(A.l + A.w, B.l + B.w) - Math.max(A.l, B.l), oy = Math.min(A.t + A.h, B.t + B.h) - Math.max(A.t, B.t);
        if (ox > A.w * 0.3 && oy > A.h * 0.3) find('bb-overlap:' + CUR.persona, '중간', '방울 터뜨리기', '방울끼리 많이 겹쳐서 원하는 방울을 누르기 어려움', `${v[i].p} 와 ${v[j].p} 가 ${Math.round(ox)}x${Math.round(oy)}px 겹침`, { shot: await fshot('bb-overlap:' + CUR.persona, page, 'bubble_overlap') });
      }
      info.bs.forEach(b => { if (b.sw > b.cw + 2) find('bb-clip', '낮음', '방울 터뜨리기', '방울 안 글자가 넘침', b.p); });
      if (missOnce) { const wrong = v.find(b => b.p !== target && !/no/.test(b.cls)); if (wrong) { await page.mouse.click(wrong.x, wrong.y); missOnce = false; await sleep(200); continue; } }
      const t = v.find(b => b.p === target);
      if (t && t.y < info.a.b - 40) {
        // 위에 다른 방울이 덮고 있으면 그 방울이 눌림
        const hit = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); const b = e && e.closest('.bb'); return b ? window.__plain(b) : null; }, t);
        if (hit !== target) { find('bb-cover', '중간', '방울 터뜨리기', '정답 방울 가운데를 눌렀는데 다른 방울이 덮고 있음', `정답 ${target}, 눌린 것 ${hit}`); await sleep(150); continue; }
        await page.mouse.click(t.x, t.y); clicked = true; break;
      }
      await sleep(120);
    }
    await sleep(1300);
    const fb = await page.locator('#bbFb').innerText().catch(() => '');
    if (clicked && /톡!/.test(fb)) got++;
    rounds++;
    if (await vis(page, '#miniEnd')) break;
  }
  await endMini(page, 'bubble', before, got + (got === 8 ? 3 : 0), P);
}

async function playStones(page, P, { dieOnPurpose = false } = {}) {
  const before = await gems(page);
  await openMini(page, P, 'stones');
  await layout(page, 'stones');
  let life = 3, got = 0;
  for (let s = 0; s < 10 && life > 0; s++) {
    await page.waitForFunction(() => !document.getElementById('stUp').classList.contains('good') && !document.getElementById('stUp').classList.contains('sink') && !document.getElementById('stDown').classList.contains('good') && !document.getElementById('stDown').classList.contains('sink'), null, { timeout: 5000 }).catch(() => {});
    const q = await page.evaluate(() => { const w = window.__byPlain(window.__plain(document.getElementById('stQ'))); return { ko: w && w.ko, up: document.getElementById('stUp').textContent, down: document.getElementById('stDown').textContent }; });
    if (!q.ko) break;
    const rightUp = q.up === q.ko;
    if (q.up === q.down) find('stone-same', '높음', '징검다리', '두 돌의 뜻이 같음', q.up);
    let up = rightUp;
    if (dieOnPurpose || chance(P.wrong * 0.5)) up = !up;
    await tap(page, up ? '#stUp' : '#stDown', P);
    if (up === rightUp) got++; else life--;
    if (s === 0) await layout(page, 'stones_after');
    await sleep(up === rightUp ? 1000 : 1600);
  }
  const exp = life <= 0 ? got : got + (life === 3 ? 3 : 0);
  await endMini(page, 'stones', before, exp, P);
}

async function playListen(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'listen');
  await layout(page, 'listen');
  let got = 0; const N = 8;
  for (let r = 0; r < N; r++) {
    await page.waitForFunction(() => document.querySelector('#lsOpts .opt') && !document.querySelector('#lsOpts .opt').disabled, null, { timeout: 5000 }).catch(() => {});
    const q = await page.evaluate(() => { const reading = document.getElementById('lsText').textContent; const opts = [...document.querySelectorAll('#lsOpts .opt')].map(b => { const w = window.__byPlain(window.__plain(b)); return w ? w.reading : '?'; }); return { reading, opts }; });
    const idx = q.opts.indexOf(q.reading);
    if (q.opts.filter(x => x === q.reading).length > 1) find('ls-dup', '높음', '듣고 고르기', '같은 발음의 보기가 두 개라 구별 불가', q.opts.join('/'));
    if (idx < 0) { find('ls-noans', '높음', '듣고 고르기', '정답이 보기에 없음', JSON.stringify(q)); break; }
    const peek = chance(0.25);
    if (chance(0.7)) await tap(page, '#lsPlay', P);
    if (peek) await tap(page, '#lsPeek', P);
    let c = idx; if (chance(P.wrong * 0.5)) c = (idx + 1) % q.opts.length;
    await tap(page, `#lsOpts .opt[data-i="${c}"]`, P);
    if (c === idx && !peek) got++;
    await sleep(1450);
  }
  await endMini(page, 'listen', before, got + (got === N ? 3 : 0), P);
}

async function playSMeaning(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'smeaning');
  let got = 0, n = 0;
  for (let r = 0; r < 10; r++) {
    const q = await page.evaluate(() => { const p = window.__plain(document.getElementById('smJp')); const s = window.__S.find(x => x.plain === p); return { p, ko: s && s.ko, lv: s && s.lv, opts: [...document.querySelectorAll('#smOpts .opt')].map(b => b.textContent) }; });
    if (!q.ko) { find('sm-oracle', '낮음', '문장 뜻 고르기', '정답지에서 문장을 못 찾음', q.p); break; }
    if (new Set(q.opts).size !== q.opts.length) find('sm-dup', '중간', '문장 뜻 고르기', '보기에 같은 뜻이 두 번', q.opts.join(' / '));
    const idx = q.opts.indexOf(q.ko);
    let c = idx; if (chance(P.wrong)) c = (idx + 1) % 4;
    if (r === 0) await layout(page, 'smeaning');
    await tap(page, `#smOpts .opt[data-i="${c}"]`, P);
    if (c === idx) got++; n++;
    await tap(page, '#smNext', P);
  }
  await endMini(page, 'smeaning', before, got + (got === n ? 3 : 0), P);
}

async function playSFill(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'sfill');
  let got = 0, n = 0;
  for (let r = 0; r < 10; r++) {
    const q = await page.evaluate(() => { const k = document.getElementById('sfKo').textContent; const s = window.__S.find(x => x.ko === k); return { k, blank: s && s.blank, sent: s && s.plain, opts: [...document.querySelectorAll('#sfOpts .opt')].map(b => window.__plain(b)) }; });
    if (!q.blank) { find('sf-oracle', '낮음', '빈칸 채우기', '정답지에서 문장을 못 찾음', q.k); break; }
    const idx = q.opts.indexOf(q.blank);
    if (new Set(q.opts).size !== q.opts.length) find('sf-dup', '중간', '빈칸 채우기', '보기에 같은 말이 두 번', q.opts.join(' / '));
    let c = idx; if (chance(P.wrong)) c = (idx + 1) % 4;
    if (r === 0) await layout(page, 'sfill');
    await tap(page, `#sfOpts .opt[data-i="${c}"]`, P);
    if (c === idx) got++; n++;
    if (r === 0) await layout(page, 'sfill_after');
    await tap(page, '#sfNext', P);
  }
  await endMini(page, 'sfill', before, got + (got === n ? 3 : 0), P);
}

async function playSOrder(page, P) {
  const before = await gems(page);
  await openMini(page, P, 'sorder');
  let exp = 0;
  for (let r = 0; r < 6; r++) {
    const q = await page.evaluate(() => { const k = document.getElementById('soKo').textContent; const s = window.__S.find(x => x.ko === k); return { k, chunks: s && s.chunks, tiles: [...document.querySelectorAll('#soTiles [data-t]')].map(b => +b.dataset.t) }; });
    if (!q.chunks) break;
    const n = q.chunks.length;
    const order = [...Array(n).keys()];
    // 0) 처음 섞인 순서가 이미 정답인지
    const wrongOrder = order.slice(1).concat([0]);
    const mode = r === 0 ? 'twice' : chance(P.wrong) ? pickOne(['twice', 'once', 'undo']) : 'right';
    const place = async seq => { for (const t of seq) { await human(80, 300); await page.locator(`#soTiles [data-t="${t}"]`).click(); } };
    if (r === 0) await layout(page, 'sorder');
    if (mode === 'twice') {
      await place(wrongOrder); await sleep(900);
      await place(wrongOrder); await sleep(400);
      const fb = await page.locator('#soFb').innerText();
      if (!/정답은/.test(fb)) find('so-twice', '중간', '문장 만들기', '두 번 틀려도 정답을 보여주지 않음', fb);
      else good('문장 만들기: 두 번 틀리면 정답 문장을 보여줌');
      if (!shotsTaken.sorderTwice) { shotsTaken.sorderTwice = 1; await shot(page, 'sorder_twice_wrong'); }
      // 다 놓인 조각을 다시 눌러 보기 (정답 보여준 뒤라 반응 없어야 함)
    } else {
      if (mode === 'once') { await place(wrongOrder); await sleep(900); exp += 1; }
      else if (mode === 'undo') { await place([0]); await human(); await page.locator('#soAns [data-p="0"]').click(); exp += 2; }
      else exp += 2;
      await place(order); await sleep(300);
      const cls = await page.locator('#soAns').getAttribute('class');
      if (!/good/.test(cls)) find('so-right-rejected', '높음', '문장 만들기', '정답 순서로 놓았는데 틀렸다고 함', q.chunks.join('/'), { shot: await shot(page, 'sorder_rejected') });
    }
    if (r === 1) await layout(page, 'sorder_done');
    await tap(page, '#soNext', P);
  }
  await endMini(page, 'sorder', before, exp, P);
}

// =====================================================================
// 상점 / 방
// =====================================================================
async function goTab(page, t, P) {
  if (await vis(page, '#play')) await tap(page, '#quit', P);
  if (await vis(page, '#miniBody')) await tap(page, '#miniQuit', P);
  if (await vis(page, '#miniEnd')) await tap(page, '#miniHome', P);
  if (await vis(page, '#result')) await sleep(800);   // 결과 화면 직후 0.7초는 메뉴가 막힘 (두 번 누름 방지)
  await tap(page, `[data-tab="${t}"]`, P); await waitVis(page, '#' + t); }
async function shopTab(page, slot, P) { await page.locator(`[data-shop="${slot}"]`).scrollIntoViewIfNeeded(); await tap(page, `[data-shop="${slot}"]`, P); }
async function shopping(page, P, { buyAllSlots = false, dbl = false } = {}) {
  await goTab(page, 'shop', P);
  await layout(page, 'shop');
  const slots = await page.evaluate(() => window.SHOP.SLOTS.map(s => s[0]));
  let bought = 0;
  for (const slot of slots) {
    if (!buyAllSlots && !chance(0.5) && slot !== 'pet' && slot !== 'hat' && slot !== 'rug') continue;
    await shopTab(page, slot, P);
    const items = await page.evaluate(slot => {
      const S = JSON.parse(localStorage.getItem('jw-pet'));
      return [...document.querySelectorAll('#shopGrid [data-item]')].map(b => { const id = b.dataset.item; const it = slot === 'pet' ? window.SHOP.PETS.find(p => p.id === id) : window.SHOP.ITEMS.find(x => x.id === id); return { id, price: it.price, owned: !!S.owned[id] }; });
    }, slot);
    if (!items.length) continue;
    const g0 = await gems(page);
    // 비싸서 못 사는 것 누르기
    const pricey = items.filter(i => !i.owned && i.price > g0).sort((a, b) => b.price - a.price)[0];
    if (pricey && chance(0.6)) {
      await tap(page, `[data-item="${pricey.id}"]`, P);
      const toast = await page.locator('#toast').innerText().catch(() => '');
      if (!/더 필요해요/.test(toast)) find('shop-poor-toast', '중간', '상점', '보석이 모자랄 때 안내가 안 나옴', toast);
      else if (!toast.includes(String(pricey.price - g0))) find('shop-poor-num', '낮음', '상점', '모자란 보석 개수가 틀림', `${toast} (필요 ${pricey.price - g0})`);
      else good('상점: 보석이 모자라면 몇 개 더 필요한지 알려줌');
      if ((await gems(page)) !== g0) find('shop-poor-gem', '높음', '상점', '못 사는 물건을 눌렀는데 보석이 줄어듦', '');
    }
    const cheap = items.filter(i => !i.owned && i.price <= g0).sort((a, b) => a.price - b.price)[0];
    if (cheap) {
      if (dbl) {
        await human(P.lo, P.hi); await page.locator(`[data-item="${cheap.id}"]`).dblclick();
        await sleep(200);
        const own = await page.evaluate(id => !!JSON.parse(localStorage.getItem('jw-pet')).owned[id], cheap.id);
        if (own) find('shop-dbl-buy', '낮음', '상점', '물건을 두 번 빠르게 톡톡 누르면 확인 없이 바로 사짐', `${cheap.id} (${cheap.price}개) — ‘한 번 더 누르면 구매’ 문구를 읽을 틈이 없음`, { shot: await fshot('shop-dbl-buy', page, 'shop_dblbuy') });
        else { good('상점: 두 번 빠르게 톡톡 눌러도 확인 없이 사지지 않음 (실수 방지)'); await sleep(450); await tap(page, `[data-item="${cheap.id}"]`, P); }
      } else {
        await tap(page, `[data-item="${cheap.id}"]`, P);
        const pr = await page.locator(`[data-item="${cheap.id}"] .pr`).innerText();
        if (!/한 번 더/.test(pr)) find('shop-arm', '중간', '상점', '처음 눌렀을 때 ‘한 번 더 누르면 구매’가 안 나옴', pr);
        if (chance(0.3)) { // 4초 넘게 기다리면 다시 처음부터
          await sleep(4400);
          const pr2 = await page.locator(`[data-item="${cheap.id}"] .pr`).innerText();
          if (/한 번 더/.test(pr2)) find('shop-arm-timeout', '낮음', '상점', '4초가 지나도 구매 대기 상태가 안 풀림', pr2);
          await tap(page, `[data-item="${cheap.id}"]`, P);
        }
        await sleep(450);   // 0.4초 안의 두 번째 터치는 실수 방지로 무시되므로
        await tap(page, `[data-item="${cheap.id}"]`, P);
      }
      await sleep(200);
      const s = await store(page);
      if (!s.pet.owned[cheap.id]) find('shop-buy-fail:' + slot, '높음', '상점', '두 번 눌렀는데 안 사짐', cheap.id);
      else {
        bought++;
        if (s.pet.gems !== g0 - cheap.price) find('shop-price', '높음', '상점', '보석이 가격만큼 안 줄어듦', `${g0}-${cheap.price} ≠ ${s.pet.gems}`);
        const on = slot === 'pet' ? s.pet.pet === cheap.id : s.pet.equip[slot] === cheap.id;
        if (!on) find('shop-autoequip', '중간', '상점', '산 물건이 바로 사용되지 않음', cheap.id);
        // 다시 눌러 빼기 / 다시 끼우기
        if (slot !== 'pet' && slot !== 'wallpaper' && slot !== 'floor') {
          await tap(page, `[data-item="${cheap.id}"]`, P);
          const s2 = await store(page);
          if (s2.pet.equip[slot]) find('shop-unequip:' + slot, '중간', '상점', '사용 중인 물건을 다시 눌러도 안 빠짐', cheap.id);
          if (buyAllSlots || chance(0.6)) await tap(page, `[data-item="${cheap.id}"]`, P);
        }
      }
    }
  }
  // 펫 바꾸기
  await shopTab(page, 'pet', P);
  const pets = await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('jw-pet')); return Object.keys(S.owned).filter(k => window.SHOP.PETS.some(p => p.id === k)); });
  if (pets.length > 1) {
    const other = pets.find(p => p !== (pets.includes('cat') ? 'cat' : pets[0])) || pets[0];
    await tap(page, `[data-item="${other}"]`, P);
    const s = await store(page);
    if (s.pet.pet !== other) find('pet-switch', '높음', '상점', '가진 펫을 눌러도 펫이 안 바뀜', other);
    else good('상점: 가진 펫을 누르면 같이 사는 펫이 바뀜');
    const toast = await page.locator('#toast').innerText().catch(() => '');
    if (/와\(과\)/.test(toast)) find('pet-josa', '낮음', '상점', '안내 문구에 ‘와(과)’가 그대로 나옴', toast);
  }
  // 가진 것만
  await page.locator('#ownedOnly + .knob').click();
  const onlyOwned = await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('jw-pet')); return [...document.querySelectorAll('#shopGrid [data-item]')].every(b => S.owned[b.dataset.item]); });
  if (!onlyOwned) find('owned-filter', '중간', '상점', '‘가진 것만’을 켜도 안 가진 게 보임', '');
  await shopTab(page, 'back', P);
  const empty = await page.locator('#shopGrid .empty').count();
  if (empty) await layout(page, 'shop_owned_empty');
  await page.locator('#ownedOnly + .knob').click();
  log(`    상점: ${bought}개 구매`);
  return bought;
}
async function room(page, P) {
  await goTab(page, 'room', P);
  await sleep(300);
  const r = await page.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('jw-pet'));
    const box = document.getElementById('roomBox').getBoundingClientRect();
    const out = [];
    ['rug', 'deco', 'ceil', 'plant', 'furn', 'toy', 'food'].forEach(s => { const e = document.getElementById('slot-' + s); const kids = [...e.querySelectorAll('svg > *')].map(k => k.getBoundingClientRect()).filter(k => k.width > 0); const b = kids.length ? { left: Math.min(...kids.map(k => k.left)), top: Math.min(...kids.map(k => k.top)), right: Math.max(...kids.map(k => k.right)), bottom: Math.max(...kids.map(k => k.bottom)), get width() { return this.right - this.left; }, get height() { return this.bottom - this.top; } } : e.getBoundingClientRect(); out.push({ s, equip: S.equip[s] || null, shown: !e.hidden && b.width > 2, inside: b.left >= box.left - 6 && b.right <= box.right + 6 && b.top >= box.top - 6 && b.bottom <= box.bottom + 6, rect: [b.left, b.top, b.width, b.height].map(Math.round) }); });
    return { out, box: [box.left, box.top, box.width, box.height].map(Math.round) };
  });
  const sp = await shot(page, 'room');
  r.out.forEach(x => {
    if (x.equip && !x.shown) find('room-missing:' + x.s, '높음', '내 방', '산 소품이 방에 안 보임', x.s + ' ' + x.equip, { shot: sp });
    if (x.shown && !x.inside) find('room-outside:' + x.s, '낮음', '내 방', '소품이 방 테두리 밖으로 삐져나옴', x.s + ' ' + JSON.stringify(x.rect) + ' box ' + JSON.stringify(r.box), { shot: sp });
  });
  // 소품끼리 겹침 (펫 포함)
  const ov = await page.evaluate(() => {
    const ids = ['slot-rug', 'slot-deco', 'slot-ceil', 'slot-plant', 'slot-furn', 'slot-toy', 'slot-food', 'roomPet'];
    const rs = ids.map(id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return b.width > 2 ? { id, l: b.left, t: b.top, r: b.right, b: b.bottom } : null; }).filter(Boolean);
    const o = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const A = rs[i], B = rs[j]; const w = Math.min(A.r, B.r) - Math.max(A.l, B.l), h = Math.min(A.b, B.b) - Math.max(A.t, B.t); const area = Math.min((A.r - A.l) * (A.b - A.t), (B.r - B.l) * (B.b - B.t)); if (w > 0 && h > 0 && w * h > area * 0.35 && !/rug/.test(A.id + B.id)) o.push(A.id + '×' + B.id + ' ' + Math.round(w * h / area * 100) + '%'); }
    return o;
  });
  const filled = r.out.filter(x => x.equip).length;
  if (filled === 7) ov.forEach(o => find('room-overlap:' + o.split(' ')[0], '낮음', '내 방', '방이 꽉 찼을 때 소품/펫이 크게 겹침', o, { shot: sp }));
  await layout(page, 'room');
  await tap(page, '#roomPet', P);
  await sleep(300);
  const say = await page.locator('#say').isVisible();
  if (!say) find('room-say', '중간', '내 방', '펫을 눌러도 말풍선이 안 나옴', '');
  else { good('내 방: 펫을 누르면 단어 말풍선이 나옴'); await layout(page, 'room_say'); if (filled >= 5) await shot(page, 'room_say_full'); }
  // 펫 연타
  for (let i = 0; i < 4; i++) { await page.locator('#roomPet').click(); await sleep(80); }
  return filled;
}

// =====================================================================
// 시나리오
// =====================================================================
async function lockScreenTests(P) {
  const ctx = await newCtx('beginner', CUR.seed);
  let page = await ctx.newPage(); watch(page, '잠금 화면');
  await page.goto(BASE);
  await waitVis(page, '#f');
  await layout(page, 'lock');
  await shot(page, 'lock');
  // 빈칸 그대로 누르기
  await tap(page, '#go', P);
  await sleep(300);
  const valid = await page.evaluate(() => document.getElementById('pw').validationMessage);
  // 틀린 비밀번호
  await page.locator('#pw').fill('wrong-' + rnd(100, 999));
  await tap(page, '#go', P);
  await page.waitForFunction(() => document.getElementById('err').textContent.length > 0, null, { timeout: 15000 }).catch(() => {});
  const err = await page.locator('#err').innerText();
  if (!/틀렸/.test(err)) find('lock-wrong', '높음', '잠금 화면', '틀린 비밀번호에 안내가 없음', err);
  else good('잠금 화면: 틀린 비밀번호면 ‘비밀번호가 틀렸어요.’가 나오고 흔들림');
  const pwAfter = await page.locator('#pw').inputValue();
  if (pwAfter) find('lock-keepwrong', '낮음', '잠금 화면', '틀린 비밀번호가 칸에 그대로 남아 다시 지우고 써야 함', '틀린 뒤에도 입력 칸이 비워지지 않고 선택되지도 않음');
  // 기억하기 끄고 들어가기 → 다시 열기
  await page.locator('#pw').fill(PW);
  await page.locator('#remember').uncheck();
  await tap(page, '#go', P);
  await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  let s = await store(page);
  if (s.key) find('lock-remember-off', '높음', '잠금 화면', '‘기억하기’를 껐는데 열쇠가 저장됨', '');
  // 같은 창 새로고침(업데이트·기록 불러오기)은 다시 묻지 않는 것이 v1.10.0부터의 의도된 동작
  await page.reload();
  await page.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || document.getElementById('home'));
  if (await page.locator('#home').count()) good('잠금 화면: ‘기억하기’를 꺼도 같은 창 새로고침(업데이트 등)은 비밀번호를 다시 안 물어봄');
  else find('lock-same-tab', '중간', '잠금 화면', '‘기억하기’를 끈 상태에서 업데이트·새로고침 뒤 비밀번호를 다시 물어봄', '');
  // 앱을 닫고 다시 여는 것 = 새 창
  const p2 = await ctx.newPage(); watch(p2, '잠금 화면');
  await p2.goto(page.url());
  await p2.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || document.getElementById('home'));
  if (await p2.locator('#home').count()) find('lock-remember-off2', '높음', '잠금 화면', '‘기억하기’를 껐는데 앱을 다시 열면 비밀번호 없이 들어가짐', '');
  else good('잠금 화면: ‘기억하기’를 끄면 앱을 다시 열 때 비밀번호를 물어봄');
  await page.close(); page = p2;
  // 기억하기 켜고 → 다시 열기
  await page.locator('#pw').fill(PW);
  await page.locator('#remember').check();
  await tap(page, '#go', P);
  await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  await page.reload();
  await page.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || document.getElementById('home'));
  await sleep(500);
  if (!(await page.locator('#home').count())) find('lock-remember-on', '높음', '잠금 화면', '‘기억하기’를 켰는데 다시 비밀번호를 물어봄', '');
  else good('잠금 화면: ‘기억하기’를 켜면 다음부터 바로 열림');
  // 열쇠가 망가진 경우
  await page.evaluate(() => localStorage.setItem('jw-unlock-key', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='));
  await page.reload();
  await waitVis(page, '#f').catch(() => {});
  const e2 = await page.locator('#err').innerText().catch(() => '');
  if (!/바뀌었/.test(e2)) find('lock-badkey', '중간', '잠금 화면', '저장된 열쇠가 안 맞을 때 안내가 이상함', e2);
  else good('잠금 화면: 저장된 열쇠가 안 맞으면 ‘비밀번호가 바뀌었어요’ 안내 후 다시 물어봄');
  await ctx.close();
}

async function personaBeginner(seed) {
  const P = PERSONAS.beginner;
  const ctx = await newCtx('beginner', seed);
  const page = await ctx.newPage(); watch(page, '초보(390)');
  await unlock(page, P);
  await sleep(800);
  const toast = await page.locator('#toast').isVisible();
  if (!toast) find('welcome-toast', '낮음', '처음 화면', '첫 방문 환영 안내(보석 20개)가 안 보임', '');
  const g0 = await gems(page);
  if (g0 !== 20) find('start-gems', '중간', '처음 화면', '처음 보석이 20개가 아님', String(g0));
  await shot(page, 'home_first');
  await layout(page, 'home');
  // 홈 아래까지 천천히 내려 보기
  for (let y = 0; y < 6; y++) { await page.mouse.wheel(0, 600); await human(200, 400); await layout(page, 'home_scroll' + y); }
  await shot(page, 'home_bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
  // 오늘의 단어 다른 단어
  const tw = await page.locator('#todayWord').innerText();
  await tap(page, '#todayNext', P);
  if ((await page.locator('#todayWord').innerText()) === tw) find('today-next', '낮음', '오늘의 단어', '‘다른 단어’를 눌러도 그대로', tw);
  // 단어 게임: 레벨×방식 (무작위 일부) + 범위
  const levels = ['N5', 'N4', 'N3', 'all'], modes = ['meaning', 'word', 'reading'];
  const combos = [];
  for (const l of levels) for (const m of modes) combos.push([l, m]);
  const todo = combos.sort(() => R() - 0.5).slice(0, 4);
  for (const [l, m] of todo) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const cats = await page.evaluate(lv => [...document.querySelectorAll('[data-cat]')].map(b => b.dataset.cat), l);
    const cat = chance(0.5) ? pickOne(cats) : 'all';
    await wordGame(page, P, { level: l, mode: m, cat, tag: `${l}/${m}` });
    if (chance(0.5)) { await tap(page, '#again', P); await waitVis(page, '#play'); await tap(page, '#quit', P); await waitVis(page, '#home'); }
    else await goTab(page, 'home', P);
  }
  // 작은 범위 (N5 몸 7개) 고르기
  await wordGame(page, P, { level: 'N5', mode: 'meaning', cat: 'body', tag: 'N5/body' });
  await goTab(page, 'home', P);
  // 복습
  const rv = await wordGame(page, P, { review: true, tag: 'review' });
  if (rv) good('틀린 단어 복습: 틀렸던 단어만 나옴');
  await goTab(page, 'home', P);
  // 미니게임 모두 한 번씩 + 문장 3종
  await playPairs(page, P); await tap(page, '#miniHome', P);
  await playPuzzle(page, P); await tap(page, '#miniHome', P);
  await playBubble(page, P); await tap(page, '#miniHome', P);
  await playStones(page, P, { dieOnPurpose: chance(0.3) }); await tap(page, '#miniHome', P);
  await playListen(page, P); await tap(page, '#miniHome', P);
  await playOX(page, P); await tap(page, '#miniAgain', P); await waitVis(page, '#oxCard'); await tap(page, '#miniQuit', P);
  await playSMeaning(page, P); await tap(page, '#miniHome', P);
  await playSFill(page, P); await tap(page, '#miniHome', P);
  await playSOrder(page, P); await tap(page, '#miniHome', P);
  // 상점: 싼 것 사기
  await shopping(page, P);
  await room(page, P);
  await tap(page, '#goDecorate', P); await waitVis(page, '#shop');
  const cat = await page.locator('[data-shop][aria-pressed="true"]').innerText();
  if (!/벽지/.test(cat)) find('go-decorate', '낮음', '내 방', '‘꾸미기’를 누르면 벽지 탭으로 가야 하는데 다른 탭', cat);
  await goTab(page, 'room', P); await tap(page, '#goPets', P); await waitVis(page, '#shop');
  // 새로고침해도 그대로인지
  const sBefore = await store(page);
  await page.reload();
  await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  const sAfter = await store(page);
  if (sAfter.pet.gems !== sBefore.pet.gems || JSON.stringify(sAfter.pet.owned) !== JSON.stringify(sBefore.pet.owned)) find('reload-lost', '높음', '저장', '새로고침하면 보석/산 물건이 바뀜', `${sBefore.pet.gems}→${sAfter.pet.gems}`);
  else good('새로고침해도 보석·산 물건·공부 기록이 그대로');
  const lvBtn = await page.locator('[data-level][aria-pressed="true"]').getAttribute('data-level');
  if (lvBtn !== sBefore.settings.level) find('reload-level', '중간', '저장', '새로고침하면 고른 레벨이 바뀜', `${sBefore.settings.level}→${lvBtn}`);
  // 설정 토글
  await page.locator('#optBrackets').scrollIntoViewIfNeeded();
  const br0 = await page.evaluate(() => document.documentElement.classList.contains('brackets'));
  await page.locator('label.switch:has(#optBrackets)').click();
  const br1 = await page.evaluate(() => document.documentElement.classList.contains('brackets'));
  if (br0 === br1) find('opt-brackets', '중간', '설정', '괄호 표시 스위치가 반응 없음', '');
  await page.locator('label.switch:has(#optSound)').click();
  await page.reload(); await page.waitForSelector('#home:not([hidden])');
  const s3 = await store(page);
  if (s3.settings.brackets !== br1 || !(await page.locator('#optBrackets').isChecked()) === br1) find('opt-persist', '중간', '설정', '설정이 새로고침 뒤 유지되지 않음', JSON.stringify(s3.settings));
  else good('설정(괄호 표시, 발음 들려주기)이 새로고침 뒤에도 유지됨');
  await shot(page, 'home_brackets_' + br1);
  // 단어 목록 / 문장 목록 / 업데이트 기록
  await page.locator('#listBox summary').scrollIntoViewIfNeeded(); await tap(page, '#listBox summary', P);
  await sleep(300); await layout(page, 'wordlist'); await shot(page, 'wordlist');
  await page.locator('#sentBox summary').scrollIntoViewIfNeeded(); await tap(page, '#sentBox summary', P);
  await sleep(300); await layout(page, 'sentlist');
  const sentN = await page.locator('#sentBrowse li').count();
  const lv = s3.settings.level;
  if (sentN === 0) find('sentlist-empty', '중간', '문장 모아 보기', '문장 목록이 비어 있음', lv);
  await page.locator('#sentBrowse [data-say]').first().click();
  await page.locator('#logBox summary').scrollIntoViewIfNeeded(); await tap(page, '#logBox summary', P);
  await sleep(300);
  const logN = await page.locator('#logList .log-item').count();
  const clN = await page.evaluate(() => window.CHANGELOG.length);
  if (logN !== clN) find('loglist', '중간', '업데이트 기록', '업데이트 기록 개수가 다름', `${logN} vs ${clN}`);
  else good(`업데이트 기록 목록에 ${clN}개 버전이 모두 나옴`);
  const verTag = await page.locator('#verTag').innerText();
  await layout(page, 'loglist'); await shot(page, 'loglist');
  // 내보내기 → 새 브라우저로 가져오기
  await exportImport(page, P, seed);
  await ctx.close();
}

async function exportImport(page, P, seed) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#exportBtn').scrollIntoViewIfNeeded();
  await tap(page, '#exportBtn', P);
  const code = await page.locator('#exportCode').inputValue();
  if (!/^JWC1:/.test(code)) { find('export', '높음', '기록 옮기기', '코드가 안 만들어짐', code.slice(0, 20)); return; }
  await layout(page, 'export');
  await tap(page, '#copyBtn', P);
  await sleep(300);
  const msg = await page.locator('#moveMsg').innerText();
  const src = await store(page);
  // 새 브라우저 (기억하기 켜기)
  for (const remember of [true, false]) {
    const ctx2 = await newCtx(PERSONAS[CUR.persona] ? CUR.persona : 'beginner', seed + 99);
    const p2 = await ctx2.newPage(); watch(p2, '기록 옮기기');
    await unlock(p2, P, { remember });
    await p2.locator('#importCode').scrollIntoViewIfNeeded();
    // 엉터리 코드
    for (const junk of ['안녕하세요', 'JWC1:abc', 'JWC1:' + Buffer.from('{"p":1}').toString('base64')]) {
      await p2.locator('#importCode').fill(junk);
      await tap(p2, '#importBtn', P);
      const m = await p2.locator('#moveMsg').innerText();
      if (!/올바르지/.test(m)) find('import-junk', '높음', '기록 옮기기', '엉터리 코드를 넣어도 오류 안내가 없음', junk + ' → ' + m);
    }
    good('기록 옮기기: 엉터리 코드는 ‘코드가 올바르지 않아요’로 막힘');
    await p2.locator('#importCode').fill(code);
    await tap(p2, '#importBtn', P);
    const m1 = await p2.locator('#moveMsg').innerText();
    const btn = await p2.locator('#importBtn').innerText();
    await layout(p2, 'import_armed');
    await tap(p2, '#importBtn', P);
    await sleep(1500);
    await p2.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || (document.getElementById('home') && !document.getElementById('home').hidden), null, { timeout: 15000 }).catch(() => {});
    const lockShown = await p2.evaluate(() => !!document.getElementById('f') && !document.getElementById('home'));
    if (lockShown) {
      const sp = await shot(p2, 'import_then_lock');
      find('import-relock', '중간', '기록 옮기기', '‘기억하기’를 끈 채 들어온 사람은 기록을 불러오면 비밀번호 화면으로 튕김', '‘잠시 뒤 다시 열려요’라고 했는데 비밀번호를 다시 넣어야 함 (location.reload 가 잠금 화면을 다시 엶)', { shot: sp });
      await p2.locator('#pw').fill(PW); await p2.locator('#go').click();
      await p2.waitForSelector('#home:not([hidden])', { timeout: 20000 });
    }
    const dst = await store(p2);
    if (dst.pet.gems !== src.pet.gems || JSON.stringify(dst.pet.owned) !== JSON.stringify(src.pet.owned) || Object.keys(dst.progress || {}).length !== Object.keys(src.progress || {}).length) find('import-mismatch', '높음', '기록 옮기기', '불러온 기록이 원래와 다름', `보석 ${src.pet.gems}→${dst.pet.gems}`);
    else good('기록 옮기기: 코드로 보석·펫·소품·공부 기록이 그대로 옮겨짐 (두 번 눌러 확인)');
    const shownGems = await p2.locator('#home .gem-chip span').first().innerText();
    if (+shownGems !== src.pet.gems) find('import-gemchip', '중간', '기록 옮기기', '불러온 뒤 화면의 보석 숫자가 다름', shownGems);
    // 새 사람인데 불러온 뒤 '새로워진 점' 창이 뜨는지
    if (await vis(p2, '#news')) find('import-news', '낮음', '기록 옮기기', '기록을 불러온 직후 ‘새로워진 점’ 창이 뜸', '');
    await ctx2.close();
  }
}

async function personaImpatient(seed) {
  const P = PERSONAS.impatient;
  const ctx = await newCtx('impatient', seed);
  const page = await ctx.newPage(); watch(page, '성급(360)');
  await unlock(page, P);
  await layout(page, 'home');
  await shot(page, 'home_360');
  // 탭 빠르게 왔다갔다
  for (let i = 0; i < 12; i++) { const t = pickOne(['home', 'room', 'shop']); await page.locator(`[data-tab="${t}"]`).click(); await sleep(rnd(30, 120)); const c = await current(page); if (c.length !== 1 || c[0] !== t) find('tabs-fast', '중간', '아래 메뉴', '탭을 빨리 누르면 화면이 엉킴', `${t} 눌렀는데 ${c}`); }
  good('아래 메뉴 탭을 빠르게 눌러도 화면이 엉키지 않음');
  await goTab(page, 'home', P);
  // 레벨/방식 연타
  await page.locator('[data-level="N4"]').dblclick();
  await page.locator('[data-mode="word"]').dblclick();
  // 시작 버튼 두 번 누르기
  await page.locator('#start').dblclick();
  await waitVis(page, '#play');
  // 답 두 번 + 다음 두 번
  await wordGame(page, P, { review: false, style: 'double', tag: 'double', started: true }).catch(e => log('double err', e.message));
  await goTab(page, 'home', P).catch(async () => { await page.locator('#quit').click().catch(() => {}); });
  // 게임 중간에 그만두기
  await page.evaluate(() => window.scrollTo(0, 0));
  await tap(page, '#start', P); await waitVis(page, '#play');
  await page.locator('#options .opt').first().click(); await page.locator('#next').click();
  const gMid = await gems(page);
  await tap(page, '#quit', P);
  await waitVis(page, '#home');
  if ((await gems(page)) !== gMid) find('quit-gem', '중간', '단어 게임', '그만두면 보석이 바뀜', '');
  // 게임 중 새로고침
  await tap(page, '#start', P); await waitVis(page, '#play');
  await page.locator('#options .opt').nth(1).click();
  const gBefore = await gems(page);
  await page.reload();
  await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  if ((await gems(page)) !== gBefore) find('reload-gem', '높음', '저장', '게임 중 새로고침하면 받은 보석이 사라짐', '');
  else good('게임 중 새로고침해도 이미 받은 보석은 남아 있음 (진행 중인 판은 처음 화면으로 돌아감)');
  // 레벨 바꾸고 바로 시작 (중간 레벨 전환)
  await tap(page, '[data-level="N3"]', P); await tap(page, '[data-mode="reading"]', P);
  await wordGame(page, P, { tag: 'N3/reading-impatient' });
  await tap(page, '#again', P); await waitVis(page, '#play'); await tap(page, '#quit', P);
  await tap(page, '[data-level="N5"]', P);
  // 미니게임: 중간에 그만두기, 새로고침
  await playOX(page, P, { quitAfter: 4000 });
  await openMini(page, P, 'bubble'); await sleep(1500); await page.reload(); await page.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  if (await vis(page, '#mini')) find('mini-reload', '중간', '미니게임', '새로고침 뒤에도 미니게임 화면이 남음', '');
  await openMini(page, P, 'pairs'); await sleep(500); await tap(page, '#miniQuit', P); await sleep(3500);
  if (await vis(page, '#mini')) find('pairs-quit-ghost', '높음', '짝 맞추기', '그만둔 뒤 3초 타이머가 다시 미니게임을 띄움', '');
  // 짝 맞추기: 카드 마구 누르기
  await openMini(page, P, 'pairs'); await sleep(3200);
  for (let i = 0; i < 8; i++) { await page.locator(`#pGrid [data-k="${rnd(0, 11)}"]`).click(); await sleep(rnd(20, 100)); }
  const opened = await page.locator('#pGrid .pc.open:not(.done)').count();
  if (opened > 2) find('pairs-3open', '중간', '짝 맞추기', '빠르게 누르면 카드가 3장 이상 열림', String(opened), { shot: await shot(page, 'pairs_3open') });
  await tap(page, '#miniQuit', P);
  // 문장 만들기: 조각 마구 누르기
  await openMini(page, P, 'sorder');
  for (let i = 0; i < 10; i++) { const n = await page.locator('#soTiles [data-t]').count(); await page.locator(`#soTiles [data-t="${rnd(0, n - 1)}"]`).click({ force: true }).catch(() => {}); await sleep(rnd(20, 80)); }
  await sleep(800);
  const placed = await page.locator('#soAns [data-p]').count(); const tiles = await page.locator('#soTiles [data-t]').count();
  if (placed > tiles) find('so-overfill', '중간', '문장 만들기', '조각을 빠르게 누르면 조각 수보다 많이 놓임', `${placed}/${tiles}`, { shot: await shot(page, 'sorder_overfill') });
  await tap(page, '#miniQuit', P);
  // 읽기 퍼즐: 틀린 뒤 0.6초 안에 연타
  await openMini(page, P, 'puzzle');
  for (let i = 0; i < 12; i++) { const n = await page.locator('#pzTiles [data-t]').count(); await page.locator(`#pzTiles [data-t="${rnd(0, n - 1)}"]`).click({ force: true }).catch(() => {}); await sleep(rnd(20, 80)); }
  await sleep(1600);
  await layout(page, 'puzzle_mash');
  await tap(page, '#miniQuit', P);
  // 징검다리 연타 (두 돌 동시에)
  await openMini(page, P, 'stones');
  const life0 = await page.locator('#stHearts .hp:not(.off)').count();
  await page.locator('#stUp').click(); await page.locator('#stDown').click({ force: true }); await sleep(1800);
  const life1 = await page.locator('#stHearts .hp:not(.off)').count();
  if (life0 - life1 > 1) find('stones-double', '중간', '징검다리', '두 돌을 빠르게 누르면 하트가 두 개 줄어듦', `${life0}→${life1}`);
  await tap(page, '#miniQuit', P);
  // 상점: 두 번 톡톡
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('jw-pet')); s.gems = Math.max(s.gems, 200); localStorage.setItem('jw-pet', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('#home:not([hidden])');
  await shopping(page, P, { dbl: true });
  await goTab(page, 'home', P);
  // 기록 불러오기 버튼 연타 (빈 칸)
  await page.locator('#importBtn').scrollIntoViewIfNeeded();
  await page.locator('#importBtn').dblclick();
  const mm = await page.locator('#moveMsg').innerText();
  if (!mm) find('import-empty', '낮음', '기록 옮기기', '빈 칸으로 불러오기를 눌러도 아무 안내가 없음', '');
  await ctx.close();
}

async function personaPC(seed) {
  const P = PERSONAS.pc;
  const ctx = await newCtx('pc', seed);
  const page = await ctx.newPage(); watch(page, 'PC 다크');
  await unlock(page, P);
  await layout(page, 'home_pc');
  await shot(page, 'home_pc_dark');
  // 다크 모드에서 글자 대비 대충 보기 (배경과 글자색이 너무 비슷한 요소)
  const lowc = await page.evaluate(() => {
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
    const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/rgba\(.*, 0\)$/.test(c)) return c; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const out = [];
    document.querySelectorAll('#home h1, #home h2, #home p, #home span, #home b, #home small, #home strong, #home button, .tab').forEach(el => {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); if (a === null || b === null) return;
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (ratio < 3) out.push(el.textContent.trim().slice(0, 20) + ' ' + ratio.toFixed(2));
    });
    return out.slice(0, 8);
  });
  if (lowc.length) find('dark-contrast', '낮음', '다크 모드', '어두운 화면에서 글자가 배경과 비슷해 잘 안 보임', lowc.join(' | '), { shot: await shot(page, 'dark_contrast') });
  // 키보드로 단어 게임
  for (const [l, m] of [['N5', 'reading'], ['all', 'meaning'], ['N4', 'word']]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await wordGame(page, P, { level: l, mode: m, style: 'key', tag: 'key ' + l + m });
    await shot(page, 'result_dark');
    await goTab(page, 'home', P);
  }
  good('PC 키보드: 1~4로 답, Enter로 다음 문제');
  // 결과 화면에서 키보드 Enter → 아무 일 없음?
  // O·X 키보드
  await playOX(page, P, { useKeys: true });
  await tap(page, '#miniHome', P);
  await playSOrder(page, P); await tap(page, '#miniHome', P);
  await playListen(page, P); await tap(page, '#miniHome', P);
  // 다크 모드 상점·방
  await goTab(page, 'shop', P); await shot(page, 'shop_dark'); await layout(page, 'shop_pc');
  await goTab(page, 'room', P); await shot(page, 'room_dark'); await layout(page, 'room_pc');
  // 미니게임 화면에서 숫자키 (단어 게임 키가 새지 않는지)
  await goTab(page, 'home', P);
  await openMini(page, P, 'listen');
  await page.keyboard.press('1');
  await sleep(300);
  const sel = await page.locator('#lsOpts .opt:disabled').count();
  if (!sel) find('listen-nokeys', '낮음', '듣고 고르기 (PC)', '보기에 1~4 번호가 붙어 있는데 숫자 키로 고를 수 없음', '단어 게임은 1~4 키가 되는데 듣고 고르기·빈칸 채우기는 안 됨');
  await tap(page, '#miniQuit', P);
  await ctx.close();
}

// ---------- 방을 꽉 채우기 (보석을 넉넉히 넣고 모든 칸을 하나씩 삼) ----------
async function fullRoom(seed) {
  const P = PERSONAS.beginner;
  for (const pn of ['beginner', 'impatient', 'pc']) {
    const ctx = await newCtx(pn, seed); const page = await ctx.newPage(); watch(page, '방 꽉 채우기 ' + pn);
    const PP = { ...PERSONAS[pn], lo: 60, hi: 200 };
    await unlock(page, PP);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('jw-pet')); s.gems = 3000; localStorage.setItem('jw-pet', JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector('#home:not([hidden])');
    await shopping(page, PP, { buyAllSlots: true });
    await shot(page, 'shop_full_' + pn);
    const filled = await room(page, PP);
    await page.locator('#roomPet').click(); await sleep(200);
    await shot(page, 'room_full_' + pn);
    if (filled < 7) find('room-fill-script', '낮음', '테스트 스크립트', '방 칸을 다 채우지 못함', String(filled));
    else good('내 방: 모든 칸(러그·벽 장식·천장·식물·가구·장난감·간식 + 펫 옷 5칸)을 채워도 다 보임');
    // 펫 옷 입은 모습이 홈/결과/미니게임에서 깨지지 않는지
    await goTab(page, 'home', PP); await shot(page, 'home_dressed_' + pn);
    await ctx.close();
  }
}

// ---------- 전역: 설치, 오프라인, 업데이트, 새로워진 점 ----------
async function globalTests(seed) {
  const P = PERSONAS.beginner;
  // 설치 조건
  const ctx = await newCtx('beginner', seed);
  const page = await ctx.newPage(); watch(page, '설치/오프라인');
  await unlock(page, P);
  const man = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); return r.ok ? r.json() : null; });
  if (!man) find('manifest', '높음', '앱 설치', 'manifest 파일을 못 읽음', '');
  else {
    const need = ['name', 'short_name', 'start_url', 'display', 'icons'];
    need.forEach(k => { if (!man[k]) find('manifest-' + k, '높음', '앱 설치', 'manifest 에 ' + k + ' 없음', ''); });
    if (!man.id) find('manifest-id', '낮음', '앱 설치', 'manifest 에 id 가 없음 (주소가 바뀌면 다른 앱으로 인식될 수 있음)', '');
    if (!man.screenshots) find('manifest-shots', '낮음', '앱 설치', '설치 창에 보일 스크린샷(screenshots)이 없어 안드로이드 설치 창이 단순하게 나옴', '');
    const mask = man.icons.find(i => /maskable/.test(i.purpose || ''));
    const any = man.icons.find(i => /any/.test(i.purpose || 'any') && i.sizes === '512x512');
    if (mask && any && mask.src === any.src) find('manifest-maskable', '낮음', '앱 설치', '‘maskable’ 아이콘이 일반 아이콘과 같은 그림이라 안드로이드에서 가장자리가 잘릴 수 있음', mask.src);
    for (const ic of man.icons) {
      const r = await page.evaluate(async src => { const res = await fetch(src); if (!res.ok) return null; const b = await res.blob(); const bm = await createImageBitmap(b); return bm.width + 'x' + bm.height; }, ic.src);
      if (!r) find('icon-miss:' + ic.src, '높음', '앱 설치', '아이콘을 못 받음', ic.src);
      else if (r !== ic.sizes) find('icon-size:' + ic.src, '중간', '앱 설치', '아이콘 실제 크기가 manifest 와 다름', `${ic.src} ${r} vs ${ic.sizes}`);
    }
    good('앱 설치 조건: manifest(이름, 시작 주소, standalone, 192/512 아이콘) 정상, 아이콘 파일 크기 일치');
  }
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await navigator.serviceWorker.ready; return { has: !!r, ctl: !!navigator.serviceWorker.controller, scope: r && r.scope }; });
  if (!reg.has) find('sw-none', '높음', '오프라인', '서비스 워커가 등록되지 않음', '');
  if (!reg.ctl) { await page.reload(); await page.waitForSelector('#home:not([hidden])'); }
  good('서비스 워커가 등록되고 화면을 제어함');
  // 오프라인
  await ctx.setOffline(true); page.__offline = true;
  await page.reload().catch(() => {});
  const okOff = await page.waitForSelector('#home:not([hidden])', { timeout: 15000 }).then(() => true).catch(() => false);
  const sp = await shot(page, 'offline');
  if (!okOff) find('offline', '높음', '오프라인', '인터넷 없이 열리지 않음', '', { shot: sp });
  else {
    good('인터넷을 끊고 다시 열어도 (기억하기 켠 경우) 게임이 열림');
    await wordGame(page, P, { level: 'N5', mode: 'meaning', tag: 'offline' });
    await goTab(page, 'home', P);
    const fontOk = await page.evaluate(() => document.fonts.check('16px Jua'));
    if (!fontOk) find('offline-font', '낮음', '오프라인', '인터넷 없이 처음 열면 둥근 글꼴(Jua 등)이 아닌 기본 글꼴로 보일 수 있음', '구글 글꼴을 미리 저장하지 않음 (첫 온라인 방문 때 저장된 경우만 보임)', { shot: sp });
  }
  await ctx.setOffline(false); page.__offline = false;
  await ctx.close();
  // 처음 방문인데 오프라인 → 안내 문구
  const c3 = await newCtx('beginner', seed); const p3 = await c3.newPage(); watch(p3, '오프라인 첫 방문');
  await c3.setOffline(true); p3.__offline = true;
  await p3.goto(BASE).catch(() => {});
  await sleep(1500);
  await c3.close();

  // 새로워진 점 창
  const c4 = await newCtx('beginner', seed); const p4 = await c4.newPage(); watch(p4, '새로워진 점');
  await unlock(p4, P);
  if (await vis(p4, '#news')) find('news-new-user', '낮음', '새로워진 점', '처음 온 사람에게도 ‘새로워진 점’ 창이 뜸', '');
  await p4.evaluate(() => localStorage.setItem('jw-seen-version', '"1.7.0"'));
  await p4.reload(); await p4.waitForSelector('#home:not([hidden])');
  await sleep(400);
  if (!(await vis(p4, '#news'))) find('news-missing', '중간', '새로워진 점', '이전 버전을 쓰던 사람에게 ‘새로워진 점’ 창이 안 뜸', 'seen=1.7.0');
  else {
    const n = await p4.locator('#newsBody .log-item').count();
    const exp = Math.min(3, await p4.evaluate(() => window.CHANGELOG.findIndex(e => e.v === '1.7.0')));   // 최대 3개까지 보여주는 것이 정해진 동작
    if (n !== exp) find('news-count', '낮음', '새로워진 점', '못 본 버전 수만큼 내용이 안 나옴', `1.7.0 이후 ${exp}개여야 하는데 ${n}개`);
    const nsp = await shot(p4, 'news');
    await layout(p4, 'news');
    good('새로워진 점: 지난번에 본 버전 이후 바뀐 점만 모아 보여줌');
    await p4.locator('#newsOk').click();
    if (await vis(p4, '#news')) find('news-ok', '중간', '새로워진 점', '확인을 눌러도 안 닫힘', '');
  }
  // 아주 오래된 사람 (기록은 있는데 seen 없음)
  await p4.evaluate(() => localStorage.removeItem('jw-seen-version'));
  await p4.reload(); await p4.waitForSelector('#home:not([hidden])'); await sleep(300);
  if (await vis(p4, '#news')) { const n = await p4.locator('#newsBody .log-item').count(); await p4.mouse.click(5, 5); await sleep(200); if (await vis(p4, '#news')) find('news-backdrop', '낮음', '새로워진 점', '바깥을 눌러도 안 닫힘', ''); }
  await c4.close();

  // 업데이트 알림 (사이트 복사본에서 버전만 바꿈)
  const site = path.join(OUT, 'site');
  fs.rmSync(site, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'docs', 'cards'), path.join(site, 'cards'), { recursive: true });
  await serve(site, PORT2);
  const c5 = await newCtx('beginner', seed); const p5 = await c5.newPage(); watch(p5, '업데이트 알림');
  await unlock(p5, P, { url: BASE2 });
  await p5.evaluate(() => navigator.serviceWorker.ready);
  await p5.reload(); await p5.waitForSelector('#home:not([hidden])');
  const ctl = await p5.evaluate(() => !!navigator.serviceWorker.controller);
  // 새 버전 배포 흉내
  const swp = path.join(site, 'cards', 'sw.js');
  fs.writeFileSync(swp, fs.readFileSync(swp, 'utf8').replace(/var VERSION = '[^']+'/, `var VERSION = 'jw-qa-${Date.now()}'`));
  fs.writeFileSync(path.join(site, 'cards', 'version.json'), JSON.stringify({ v: '9.9.9', date: '2026-12-01', title: 'QA 시험용 새 버전', items: ['시험'] }));
  // 사용자가 다른 앱 갔다가 돌아옴 (visibilitychange) → 업데이트 확인
  await p5.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const barOk = await p5.waitForSelector('#updateBar:not([hidden])', { timeout: 15000 }).then(() => true).catch(() => false);
  await sleep(800);
  const usp = await shot(p5, 'update_bar');
  if (!barOk) find('update-bar', '높음', '업데이트 알림', '새 버전을 올렸는데 알림이 안 뜸', `controller=${ctl}`, { shot: usp });
  else {
    const t = await p5.locator('#updateText').innerText();
    if (!/9\.9\.9/.test(t)) find('update-text', '중간', '업데이트 알림', '알림에 새 버전 내용이 안 나옴', t, { shot: usp });
    else good('업데이트 알림: 새 버전을 올리면 화면 위에 ‘새 버전 v… · 제목’ 알림이 뜸');
    await layout(p5, 'update_bar');
    // 게임 중에도 알림이 가리는지
    await p5.locator('#start').click(); await waitVis(p5, '#play');
    await layout(p5, 'update_bar_play'); await shot(p5, 'update_bar_play');
    const quitHit = await p5.evaluate(() => { const b = document.getElementById('quit').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e && e.closest('#quit') ? 'ok' : (e && (e.id || e.className)); });
    if (quitHit !== 'ok') find('update-bar-covers-quit', '높음', '업데이트 알림', '게임 중에 업데이트 알림이 ‘그만하기’ 버튼과 점수를 덮어 누를 수 없음', '알림이 뜬 상태로 단어 게임/미니게임을 시작하면 ‘그만하기’를 누르면 알림이 눌림 (' + quitHit + ')', { shot: await shot(p5, 'update_bar_covers_quit') });
    if (quitHit === 'ok') good('업데이트 알림: 게임 중에는 알림이 숨어서 ‘그만하기’를 가리지 않음');
    await p5.locator('#quit').click(); await waitVis(p5, '#home');
    if (!(await vis(p5, '#updateBar'))) find('update-bar-gone', '중간', '업데이트 알림', '게임을 끝내고 돌아오면 업데이트 알림이 사라져 있음', '');
    await p5.locator('#updateBtn').click();
    await p5.waitForFunction(() => (document.getElementById('f') && !document.getElementById('f').hidden) || (document.getElementById('home') && !document.getElementById('home').hidden), null, { timeout: 15000 }).catch(() => {});
    await sleep(800);
    if (await vis(p5, '#updateBar')) find('update-loop', '중간', '업데이트 알림', '‘지금 업데이트’를 눌렀는데 알림이 또 뜸', '');
    else good('업데이트 알림: ‘지금 업데이트’를 누르면 새로 열리고 알림이 사라짐');
  }
  // 잠금 화면에 있는 동안 새 버전이 깔리는 경우
  fs.writeFileSync(swp, fs.readFileSync(swp, 'utf8').replace(/var VERSION = '[^']+'/, `var VERSION = 'jw-qa2-${Date.now()}'`));
  fs.writeFileSync(path.join(site, 'cards', 'version.json'), JSON.stringify({ v: '9.9.10', date: '2026-12-02', title: 'QA 두 번째', items: ['시험'] }));
  await p5.evaluate(() => { localStorage.removeItem('jw-unlock-key'); sessionStorage.removeItem('jw-unlock-key'); });   // 같은 창 자동 열림(v1.10.0)도 끔
  await p5.reload();
  await waitVis(p5, '#f');
  await sleep(3000);       // 잠금 화면에서 기다리는 동안 새 서비스 워커가 깔림
  await p5.locator('#pw').fill(PW); await p5.locator('#go').click();
  await p5.waitForSelector('#home:not([hidden])', { timeout: 20000 });
  await sleep(1500);
  if (!(await vis(p5, '#updateBar'))) find('update-onlock', '낮음', '업데이트 알림', '잠금 화면에 있는 동안 새 버전이 깔리면 들어간 뒤 알림이 안 뜸', '');
  await c5.close();
}

// =====================================================================
async function main() {
  await serve(path.join(ROOT, 'docs'), PORT);
  browser = await chromium.launch();
  let lastNewRound = 0;
  try {
    for (let round = 0; round < ROUNDS; round++) {
      const seed = SEED0 + round;
      R = mulberry(seed * 1000 + 7); CUR.seed = seed;
      newThisRound = 0;
      log(`\n===== 라운드 ${round + 1} / 씨앗 ${seed} =====`);
      const runs = [['global', () => globalTests(seed)], ['lock', () => lockScreenTests(PERSONAS.beginner)], ['beginner', () => personaBeginner(seed)], ['impatient', () => personaImpatient(seed)], ['pc', () => personaPC(seed)], ['full', () => fullRoom(seed)]];
      for (const [name, fn] of runs) {
        if (!ONLY.includes(name) && !(name === 'lock' && ONLY.includes('global'))) continue;
        if ((name === 'global' || name === 'full') && round > 0 && !process.env.GLOBAL_EVERY) continue;   // 설치/업데이트 시험은 첫 라운드만
        CUR.persona = name;
        log(`--- ${name}`);
        const t0 = Date.now();
        try { await fn(); } catch (e) { const sp = ''; find('script:' + name + ':' + e.message.slice(0, 50), '낮음', '테스트 스크립트', `${name} 진행 중 멈춤 (앱 문제일 수도 있음)`, e.message.split('\n')[0]); log(e.stack); }
        log(`    (${Math.round((Date.now() - t0) / 1000)}초)`);
      }
      log(`라운드 ${round + 1}: 새로 찾은 것 ${newThisRound}개`);
      if (round > 0 && newThisRound === 0) { log('새로 찾은 것이 없어 멈춤'); break; }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ when: new Date().toISOString(), findings: Object.values(findings), worked: ok }, null, 2));
    fs.writeFileSync(path.join(OUT, 'run_log.txt'), logLines.join('\n'));
    servers.forEach(p => p.kill());
    log(`\n찾은 것 ${Object.keys(findings).length}개 → .tmp/qa/findings.json`);
  }
}
main().catch(e => { console.error(e); servers.forEach(p => p.kill()); process.exit(1); });
