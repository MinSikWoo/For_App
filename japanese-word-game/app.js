(function () {
  var CATS = [['all','전체'],['people','사람·가족'],['food','음식'],['place','장소·자연'],['time','시간·계절'],['number','숫자'],['thing','물건·생활'],['body','몸'],['verb','동사'],['adj','형용사']];
  var LEVELS = [['N5', 'N5', '기초'], ['N4', 'N4', '초급'], ['N3', 'N3', '중급'], ['all', '전부', 'N5~N3']];
  var MODES = [
    { id: 'meaning', icon: '<span class="ic jp" lang="ja">あ</span>', label: '뜻 맞히기', desc: '일본어 단어를 보고 한국어 뜻을 골라요', ask: '이 단어의 뜻은?' },
    { id: 'word', icon: '<span class="ic ko">가</span>', label: '단어 맞히기', desc: '한국어 뜻을 보고 일본어 단어를 골라요', ask: '이 뜻의 일본어는?' },
    { id: 'reading', icon: '<span class="ic kanji jp" lang="ja">漢</span>', label: '한자 읽기 도전', desc: '후리가나를 가린 한자를 보고 읽는 법을 골라요', ask: '이 한자는 어떻게 읽을까?' }
  ];
  var ROUND = 10;
  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg><span>발음</span>';
  var GEM = '<svg class="gem" viewBox="0 0 24 24" aria-hidden="true"><path class="g1" d="M6 3.5h12l4 5.5-10 12-10-12z"/><path class="g2" d="M6 3.5 9 9h6l3-5.5z"/><path class="g3" d="M6 3.5h12l4 5.5-10 12-10-12zM2 9h20M9 9l3 11.5L15 9M6 3.5 9 9l3-5.5L15 9l3-5.5"/></svg>';
  var SHOP = window.SHOP;

  // ---------- words ----------
  var RX = /\{([^|}]+)\|([^}]+)\}/g;
  function parse(n) {
    var s = [], last = 0, m; RX.lastIndex = 0;
    while ((m = RX.exec(n))) {
      if (m.index > last) s.push({ t: n.slice(last, m.index) });
      s.push({ t: m[1], r: m[2] }); last = RX.lastIndex;
    }
    if (last < n.length) s.push({ t: n.slice(last) });
    return s;
  }
  function mk(lv) {
    return function (a) {
      var segs = parse(a[0]);
      return { id: a[0], ko: a[1], cat: a[2], lv: lv, segs: segs,
        plain: segs.map(function (x) { return x.t; }).join(''),
        reading: segs.map(function (x) { return x.r || x.t; }).join(''),
        kanji: segs.some(function (x) { return x.r; }) };
    };
  }
  var W = (window.WORDS || []).map(mk('N5')).concat((window.WORDS_N4 || []).map(mk('N4'))).concat((window.WORDS_N3 || []).map(mk('N3')));
  function jp(w, furi) {
    var segs = w.segs || parse(w);
    return segs.map(function (x) { return x.r && furi !== false ? '<ruby>' + x.t + '<rt>' + x.r + '</rt></ruby>' : x.t; }).join('');
  }
  function jpSpan(w, furi) { return '<span class="jp" lang="ja">' + jp(w, furi) + '</span>'; }

  // ---------- storage (this browser only) ----------
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var progress = load('jw-progress', {});
  var settings = Object.assign({ brackets: true, sound: false, mode: 'meaning', cat: 'all', level: 'N5', best: 0 }, load('jw-settings', {}));
  var isNew = !load('jw-pet', null);
  var S = Object.assign({ gems: 20, owned: {}, equip: {}, pet: 'cat' }, load('jw-pet', {}));
  S.owned.cat = S.owned.w1 = S.owned.f1 = 1;
  if (!S.equip.wallpaper) S.equip.wallpaper = 'w1';
  if (!S.equip.floor) S.equip.floor = 'f1';
  function saveS() { save('jw-pet', S); }
  saveS();

  function P(w) { return progress[w.id] || { c: 0, w: 0, s: 0 }; }
  function mastered(w) { return P(w).s >= 3; }
  function needsReview(w) { var p = P(w); return p.w > 0 && p.s < 2; }

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function weight(w) { var p = P(w); if (p.s >= 3) return 1; return Math.max(1, 3 + p.w * 2 - p.s); }
  function pick(pool, n) {
    return pool.map(function (w) { return { w: w, k: Math.pow(Math.random(), 1 / weight(w)) }; })
      .sort(function (a, b) { return b.k - a.k; }).slice(0, n).map(function (x) { return x.w; });
  }
  function inLevel(w, lv) { return lv === 'all' || w.lv === lv; }
  function keyOf(mode, w) { return mode === 'meaning' ? w.ko : mode === 'word' ? w.plain : w.reading; }
  // 뜻이 겹치는지: 괄호 설명을 빼고 ', ' 로 나눈 조각이 하나라도 같으면 겹침 (예: 書く '쓰다 (글씨)' / 苦い '(맛이) 쓰다')
  function senses(ko) { return ko.replace(/\([^)]*\)/g, '').split(/,\s+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function overlaps(a, b) { var x = senses(a.ko), y = senses(b.ko); return x.some(function (s) { return y.indexOf(s) >= 0; }); }
  function josa(word, a, b) { var c = word.charCodeAt(word.length - 1); if (c < 0xAC00 || c > 0xD7A3) return word + a + '(' + b + ')'; return word + ((c - 0xAC00) % 28 ? b : a); }
  function optionsFor(w, mode, lv) {
    var used = {}; used[keyOf(mode, w)] = 1;
    var ok = function (x) { return x !== w && (mode !== 'reading' || x.kanji); };
    var pool = W.filter(function (x) { return ok(x) && inLevel(x, lv); });
    if (pool.length < 3) pool = W.filter(ok);
    var same = shuffle(pool.filter(function (x) { return x.cat === w.cat; }));
    var other = shuffle(pool.filter(function (x) { return x.cat !== w.cat; }));
    var out = [w], cands = same.concat(other);
    for (var i = 0; i < cands.length && out.length < 4; i++) {
      var k = keyOf(mode, cands[i]); if (used[k]) continue;
      if (mode !== 'reading' && out.some(function (o) { return overlaps(o, cands[i]); })) continue;
      used[k] = 1; out.push(cands[i]);
    }
    return shuffle(out);
  }
  function applySettings() {
    document.documentElement.classList.toggle('brackets', !!settings.brackets);
    $('optBrackets').checked = !!settings.brackets;
    $('optSound').checked = !!settings.sound;
  }
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.innerHTML = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function petSVG(face, cls) { return SHOP.petSVG(S.pet, face, S.equip, cls); }
  function petInfo(id) { return SHOP.PETS.filter(function (p) { return p.id === (id || S.pet); })[0]; }
  function itemById(id) { return SHOP.ITEMS.filter(function (x) { return x.id === id; })[0]; }
  function updateGems(bump) {
    Array.prototype.forEach.call(document.querySelectorAll('.gem-chip'), function (el) {
      el.innerHTML = GEM + '<span>' + S.gems + '</span>';
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    if (G) $('hudGems').innerHTML = GEM + '<span>+' + G.gems + '</span>';
  }

  // ---------- speech ----------
  var canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  function speak(text) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 0.85;
      var v = speechSynthesis.getVoices().filter(function (v) { return /^ja/i.test(v.lang); })[0];
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll('.speak-btn'), function (b) { b.innerHTML = SPEAKER; b.hidden = !canSpeak; });

  // ---------- navigation ----------
  var current = 'home';
  var tabLockUntil = 0;
  function show(id) {
    if (id === 'result') tabLockUntil = Date.now() + 700;   // '결과 보기' 두 번 누름이 아래 메뉴로 새지 않게
    current = id;
    ['home', 'play', 'result', 'room', 'shop', 'mini'].forEach(function (s) { $(s).hidden = s !== id; });
    document.documentElement.classList.toggle('playing', id === 'play' || id === 'mini');
    var tab = id === 'result' || id === 'mini' ? 'home' : id;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  function go(id) {
    G = null;
    if (id === 'home') renderHome();
    if (id === 'room') renderRoom();
    if (id === 'shop') renderShop();
    show(id); updateGems();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { if (Date.now() < tabLockUntil) return; go(t.dataset.tab); }); });

  // ---------- home ----------
  function levelPool() { return W.filter(function (w) { return inLevel(w, settings.level); }); }
  var today = null;
  function pickToday() { var lp = levelPool(); var t; do { t = lp[Math.floor(Math.random() * lp.length)]; } while (t === today && lp.length > 1); today = t; }
  function showToday() { if (!today || !inLevel(today, settings.level)) pickToday(); $('todayWord').innerHTML = jp(today); $('todayKo').textContent = today.ko; }
  function poolFor(cat, mode) {
    return levelPool().filter(function (w) { return (cat === 'all' || w.cat === cat) && (mode !== 'reading' || w.kanji); });
  }
  function renderHome() {
    $('total').textContent = W.length;
    var lp = levelPool();
    var m = lp.filter(mastered).length, r = W.filter(needsReview);
    var pct = lp.length ? Math.round(m / lp.length * 100) : 0;
    $('sMastered').textContent = m;
    $('sReview').textContent = r.length;
    $('sBest').textContent = settings.best || 0;
    $('masterBar').style.width = pct + '%';
    $('masterPct').textContent = pct + '%';
    $('homePet').innerHTML = petSVG('smile');
    $('homePet').style.width = '100px';
    $('levels').innerHTML = LEVELS.map(function (l) {
      var n = W.filter(function (w) { return inLevel(w, l[0]); }).length;
      return '<button type="button" class="level press" data-level="' + l[0] + '" aria-pressed="' + (settings.level === l[0]) + '"><b>' + l[1] + '</b><span>' + l[2] + '</span><span>' + n + '단어</span></button>';
    }).join('');
    $('modes').innerHTML = MODES.map(function (md) {
      return '<button type="button" class="mode press" role="radio" data-mode="' + md.id + '" aria-checked="' + (settings.mode === md.id) + '">' + md.icon + '<span class="tx"><strong>' + md.label + '</strong><small>' + md.desc + '</small></span><span class="check"></span></button>';
    }).join('');
    $('chips').innerHTML = CATS.map(function (c) {
      var n = c[0] === 'all' ? lp.length : lp.filter(function (w) { return w.cat === c[0]; }).length;
      if (!n) return '';
      return '<button type="button" class="chip press" data-cat="' + c[0] + '" aria-pressed="' + (settings.cat === c[0]) + '">' + c[1] + ' <span class="n">' + n + '</span></button>';
    }).join('');
    var rv = $('startReview');
    rv.hidden = r.length === 0;
    rv.textContent = '틀린 단어 복습하기 · ' + r.length + '개';
    $('start').textContent = '시작하기 · ' + Math.min(ROUND, Math.max(1, poolFor(settings.cat, settings.mode).length)) + '문제';
    if ($('listBox').open) renderList();
    showToday();
  }
  function pips(w) { var s = Math.min(3, P(w).s), h = ''; for (var i = 0; i < 3; i++) h += '<i class="' + (i < s ? 'on' : '') + '"></i>'; return '<span class="pips" title="연속 정답 ' + s + '/3">' + h + '</span>'; }
  function renderList() {
    var lp = levelPool();
    $('wordList').innerHTML = CATS.slice(1).map(function (c) {
      var items = lp.filter(function (w) { return w.cat === c[0]; });
      if (!items.length) return '';
      return '<div class="wl-group"><h3>' + c[1] + '</h3><ul class="wordlist">' + items.map(function (w) {
        return '<li><span class="w">' + jpSpan(w) + '</span><span class="k">' + w.ko + (settings.level === 'all' ? '<span class="lv-tag">' + w.lv + '</span>' : '') + pips(w) + '</span></li>';
      }).join('') + '</ul></div>';
    }).join('');
  }

  $('levels').addEventListener('click', function (e) {
    var b = e.target.closest('[data-level]'); if (!b) return;
    settings.level = b.dataset.level;
    if (!poolFor(settings.cat, 'meaning').length) settings.cat = 'all';
    save('jw-settings', settings); renderHome();
    if (window.APP && window.APP.onLevel) window.APP.onLevel();
  });
  $('modes').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (!b) return; settings.mode = b.dataset.mode; save('jw-settings', settings); renderHome(); });
  $('chips').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; settings.cat = b.dataset.cat; save('jw-settings', settings); renderHome(); });
  $('optBrackets').addEventListener('change', function (e) { settings.brackets = e.target.checked; save('jw-settings', settings); applySettings(); });
  $('optSound').addEventListener('change', function (e) { settings.sound = e.target.checked; save('jw-settings', settings); });
  $('listBox').addEventListener('toggle', function () { if ($('listBox').open) renderList(); });
  $('todaySpeak').addEventListener('click', function () { speak(today && today.reading); });
  $('todayNext').addEventListener('click', function () { pickToday(); showToday(); });
  $('homePet').addEventListener('click', function () { go('room'); });
  $('start').addEventListener('click', function () { startGame(false); });
  $('startReview').addEventListener('click', function () { startGame(true); });

  // ---------- game ----------
  var G = null;
  function startGame(review) {
    var mode = settings.mode;
    var pool = review ? W.filter(needsReview) : poolFor(settings.cat, mode);
    if (review && mode === 'reading') { pool = pool.filter(function (w) { return w.kanji; }); if (!pool.length) { mode = 'meaning'; pool = W.filter(needsReview); } }
    if (!pool.length) { pool = poolFor('all', mode); }
    if (!pool.length) return;
    G = { mode: mode, review: review, lv: review ? 'all' : settings.level, qs: pick(pool, Math.min(ROUND, pool.length)), i: 0, score: 0, combo: 0, best: 0, correct: 0, wrong: [], marks: [], gems: 0 };
    show('play'); updateGems(); renderQ();
  }
  function renderTrack() {
    var h = '';
    for (var i = 0; i < G.qs.length; i++) h += '<i class="' + (G.marks[i] || (i === G.i ? 'now' : '')) + '"></i>';
    $('track').innerHTML = h;
  }
  function renderQ() {
    var w = G.qs[G.i], md = MODES.filter(function (m) { return m.id === G.mode; })[0];
    G.opts = optionsFor(w, G.mode, G.lv); G.answered = false;
    renderTrack();
    $('score').textContent = G.score + '점';
    $('combo').textContent = G.combo >= 2 ? G.combo + '연속!' : '';
    $('ask').textContent = (G.i + 1) + '/' + G.qs.length + ' · ' + md.ask;
    var pr = $('prompt');
    pr.className = 'prompt' + (G.mode === 'word' ? ' ko' : '');
    pr.innerHTML = G.mode === 'meaning' ? jpSpan(w) : G.mode === 'word' ? w.ko : jpSpan(w, false);
    $('mark').setAttribute('class', 'mark');
    $('options').innerHTML = G.opts.map(function (o, i) {
      var inner = G.mode === 'meaning' ? o.ko : G.mode === 'word' ? jpSpan(o) : '<span class="jp" lang="ja">' + o.reading + '</span>';
      return '<button type="button" class="opt" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + inner + '</button>';
    }).join('');
    $('feedback').hidden = true;
  }
  function hearts() {
    var box = document.querySelector('.qcard');
    for (var i = 0; i < 7; i++) {
      var h = document.createElement('span'); h.className = 'heart'; h.textContent = i % 2 ? '♥' : '✿';
      var a = (Math.PI * 2 * i) / 7 + Math.random() * .5, d = 80 + Math.random() * 40;
      h.style.setProperty('--dx', Math.cos(a) * d + 'px'); h.style.setProperty('--dy', Math.sin(a) * d * .7 + 'px');
      h.style.color = i % 3 === 0 ? 'var(--kinako)' : i % 3 === 1 ? 'var(--momo)' : 'var(--sora)';
      box.appendChild(h); setTimeout(h.remove.bind(h), 950);
    }
  }
  function animPet(el, anim) {
    var svg = el.querySelector('svg'); if (!svg) return;
    svg.classList.remove('jump', 'shake'); void svg.getBoundingClientRect(); svg.classList.add(anim);
  }
  var CHEER = ['はなまる! 정답이에요', '대단해요! 정답!', 'すごい! 맞았어요', '좋아요, 정답!'];
  function answer(i) {
    if (!G || G.answered || !G.opts[i]) return;
    G.answered = true;
    var w = G.qs[G.i], ok = G.opts[i] === w, p = P(w), gain = 0, gem = 0;
    if (ok) {
      p.c++; p.s++; G.combo++; G.correct++; G.best = Math.max(G.best, G.combo);
      gain = 10 * Math.min(G.combo, 5); G.score += gain;
      gem = G.combo >= 5 ? 3 : G.combo >= 3 ? 2 : 1;
      G.gems += gem; S.gems += gem; saveS();
    } else { p.w++; p.s = 0; G.combo = 0; G.wrong.push(w); }
    progress[w.id] = p; save('jw-progress', progress);
    G.marks[G.i] = ok ? 'ok' : 'ng';
    renderTrack();
    updateGems(ok);

    var btns = $('options').children;
    for (var k = 0; k < btns.length; k++) {
      btns[k].disabled = true;
      if (G.opts[k] === w) btns[k].classList.add('right');
      else if (k === i) btns[k].classList.add('wrong');
      else btns[k].classList.add('dim');
    }
    var mark = $('mark'); mark.setAttribute('class', 'mark'); void mark.getBoundingClientRect(); mark.setAttribute('class', 'mark ' + (ok ? 'ok' : 'ng'));
    if (ok) hearts();
    if (G.mode === 'reading') $('prompt').innerHTML = jpSpan(w);
    $('score').textContent = G.score + '점';
    var c = $('combo'); c.textContent = G.combo >= 2 ? G.combo + '연속!' : ''; c.classList.remove('pop'); void c.offsetWidth; if (G.combo >= 2) c.classList.add('pop');

    var head = $('fbHead');
    head.className = 'fb-head ' + (ok ? 'ok' : 'ng');
    head.innerHTML = ok ? (G.combo >= 3 ? G.combo + '연속 정답!' : CHEER[Math.floor(Math.random() * CHEER.length)]) + '<span class="fb-gem">' + GEM + '+' + gem + '</span>' : '괜찮아요, 이렇게 외워 봐요';
    $('fbWord').innerHTML = jp(w);
    $('fbReading').textContent = w.reading;
    $('fbKo').textContent = w.ko;
    $('feedback').hidden = false;
    $('coachPet').innerHTML = petSVG(ok ? 'happy' : 'sad');
    animPet($('coachPet'), ok ? 'jump' : 'shake');
    $('next').textContent = G.i + 1 >= G.qs.length ? '결과 보기' : '다음';
    $('next').focus({ preventScroll: true });
    try { $('feedback').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    if (settings.sound) speak(w.reading);
  }
  function next() { if (!G || !G.answered) return; G.i++; if (G.i >= G.qs.length) finish(); else { renderQ(); window.scrollTo(0, 0); } }
  function finish() {
    var newBest = G.score > (settings.best || 0);
    if (newBest) { settings.best = G.score; save('jw-settings', settings); }
    var rate = G.correct / G.qs.length;
    var bonus = rate === 1 && G.qs.length >= 5 ? 10 : rate >= 0.8 ? 5 : 0;
    G.gems += bonus; S.gems += bonus; saveS();
    $('rEyebrow').textContent = newBest && G.score > 0 ? '최고 점수 갱신!' : (G.review ? '복습 결과' : '결과');
    $('rTitle').textContent = rate === 1 ? '전부 맞혔어요! はなまる!' : rate >= 0.8 ? '아주 잘했어요' : rate >= 0.5 ? '좋아요, 조금만 더!' : '틀린 단어부터 다시 봐요';
    $('rGems').innerHTML = GEM + '보석 +' + G.gems + (bonus ? ' <small style="font-family:var(--ui);font-size:13px">(보너스 ' + bonus + ' 포함)</small>' : '');
    $('rScore').textContent = G.score;
    $('rCorrect').textContent = G.correct + '/' + G.qs.length;
    $('rCombo').textContent = G.best;
    $('rWrong').innerHTML = G.wrong.length ? G.wrong.map(function (w) {
      return '<li><span class="w">' + jpSpan(w) + '</span><span class="k">' + w.ko + '</span></li>';
    }).join('') : '<li class="empty">하나도 없어요. 완벽해요!</li>';
    show('result');
    updateGems(true);
    $('resultPet').innerHTML = petSVG(rate >= 0.5 ? 'happy' : 'sad');
    animPet($('resultPet'), rate >= 0.5 ? 'jump' : 'shake');
  }

  $('options').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) answer(+b.dataset.i); });
  $('next').addEventListener('click', next);
  $('fbSpeak').addEventListener('click', function () { if (G) speak(G.qs[G.i].reading); });
  $('quit').addEventListener('click', function () { go('home'); });
  $('again').addEventListener('click', function () { var rv = G ? G.review && W.some(needsReview) : false; startGame(rv); });
  $('toShop').addEventListener('click', function () { shopCat = 'pet'; ownedOnly = false; go('shop'); });
  document.addEventListener('keydown', function (e) {
    if (current !== 'play' || !G) return;
    if (!G.answered && e.key >= '1' && e.key <= '4') { answer(+e.key - 1); e.preventDefault(); }
    else if (G.answered && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== $('fbSpeak')) { next(); e.preventDefault(); }
  });

  // ---------- room ----------
  function renderRoom() {
    var wp = itemById(S.equip.wallpaper), fl = itemById(S.equip.floor);
    $('roomWall').style.background = wp ? wp.bg : '';
    $('roomFloor').style.background = fl ? fl.bg : '';
    ['rug', 'deco', 'ceil', 'plant', 'furn', 'toy', 'food'].forEach(function (slot) {
      var it = itemById(S.equip[slot]); var el = $('slot-' + slot);
      el.innerHTML = it ? SHOP.itemSVG(it) : ''; el.hidden = !it;
    });
    $('roomPet').innerHTML = petSVG('smile');
    $('say').hidden = true;
    var p = petInfo();
    $('petName').innerHTML = '<span class="jp" lang="ja">' + jp(p.name) + '</span><b>' + p.ko + '</b><small lang="ja">「' + p.cry + '」</small>';
    var ownedPets = SHOP.PETS.filter(function (x) { return S.owned[x.id]; }).length;
    var ownedItems = SHOP.ITEMS.filter(function (x) { return S.owned[x.id]; }).length;
    $('collection').innerHTML = '<div><span>모은 펫</span><b>' + ownedPets + ' / ' + SHOP.PETS.length + '</b></div><div><span>모은 소품</span><b>' + ownedItems + ' / ' + SHOP.ITEMS.length + '</b></div>';
  }
  var sayT;
  $('roomPet').addEventListener('click', function () {
    var p = petInfo();
    var pool = W.filter(mastered); if (pool.length < 5) pool = levelPool();
    var w = pool[Math.floor(Math.random() * pool.length)];
    var say = $('say');
    say.innerHTML = '<span lang="ja">' + p.cry + '!</span> 이 단어 알아?<br>' + jpSpan(w) + '<br>‘' + w.ko + '’라는 뜻이야';
    say.hidden = false; say.style.animation = 'none'; void say.offsetWidth; say.style.animation = '';
    $('roomPet').innerHTML = petSVG('happy');
    animPet($('roomPet'), 'jump');
    speak(w.reading);
    clearTimeout(sayT);
    sayT = setTimeout(function () { say.hidden = true; $('roomPet').innerHTML = petSVG('smile'); }, 4000);
  });
  $('goDecorate').addEventListener('click', function () { shopCat = 'wallpaper'; ownedOnly = false; go('shop'); });
  $('goPets').addEventListener('click', function () { shopCat = 'pet'; ownedOnly = true; go('shop'); });

  // ---------- shop ----------
  var shopCat = 'pet', ownedOnly = false, armed = null, armT, armedAt = 0;
  var HINTS = { pet: '펫은 한 마리와 같이 살아요', wallpaper: '방 벽지를 바꿔요', floor: '방 바닥을 바꿔요', hat: '펫 머리에 씌워요. 다시 누르면 벗어요', face: '펫 얼굴에 붙여요. 다시 누르면 떼요', neck: '펫 목에 걸어요. 다시 누르면 빼요', clothes: '펫에게 입혀요. 다시 누르면 벗어요', back: '펫 등에 달아요. 다시 누르면 빼요', rug: '펫 발밑에 깔아요. 다시 누르면 치워요' };
  function shopList() {
    if (shopCat === 'pet') return SHOP.PETS.map(function (p) { return { id: p.id, slot: 'pet', price: p.price, pet: p }; });
    return SHOP.ITEMS.filter(function (x) { return x.slot === shopCat; });
  }
  function isOn(it) { return it.slot === 'pet' ? S.pet === it.id : S.equip[it.slot] === it.id; }
  function renderShop() {
    $('shopTabs').innerHTML = SHOP.SLOTS.map(function (s) {
      var list = s[0] === 'pet' ? SHOP.PETS : SHOP.ITEMS.filter(function (x) { return x.slot === s[0]; });
      var have = list.filter(function (x) { return S.owned[x.id]; }).length;
      return '<button type="button" class="chip press" data-shop="' + s[0] + '" aria-pressed="' + (shopCat === s[0]) + '">' + s[1] + ' <span class="n">' + have + '/' + list.length + '</span></button>';
    }).join('');
    $('shopHint').textContent = HINTS[shopCat] || '방에 하나 놓을 수 있어요. 다시 누르면 치워요';
    $('ownedOnly').checked = ownedOnly;
    var list = shopList().filter(function (it) { return !ownedOnly || S.owned[it.id]; });
    $('shopGrid').innerHTML = list.length ? list.map(function (it) {
      var owned = !!S.owned[it.id], on = owned && isOn(it), pv, nm;
      if (it.pet) { pv = SHOP.petSVG(it.id, 'smile', {}); nm = '<span><span class="jp" lang="ja">' + jp(it.pet.name) + '</span><br>' + it.pet.ko + '</span>'; }
      else if (it.slot === 'wallpaper' || it.slot === 'floor') { pv = '<span style="display:block;width:100%;height:100%;background:' + it.bg + '"></span>'; nm = it.name; }
      else if (SHOP.PET_SLOTS.indexOf(it.slot) >= 0) { var one = {}; one[it.slot] = it.id; pv = SHOP.petSVG(S.pet, 'smile', one); nm = it.name; }
      else { pv = SHOP.itemSVG(it); nm = it.name; }
      var pr = on ? (it.slot === 'pet' ? '같이 사는 중' : '사용 중') : owned ? '가지고 있음' : armed === it.id ? '한 번 더 누르면 구매' : GEM + it.price;
      var cls = 'item press' + (owned ? ' owned' : '') + (on ? ' on' : '') + (armed === it.id ? ' armed' : '') + (!owned && S.gems < it.price ? ' poor' : '');
      return '<button type="button" class="' + cls + '" data-item="' + it.id + '"><span class="pv">' + pv + '</span><span class="nm">' + nm + '</span><span class="pr">' + pr + '</span></button>';
    }).join('') : '<p class="empty" style="grid-column:1/-1;text-align:center">아직 가진 게 없어요. ‘가진 것만’을 끄고 구경해 보세요.</p>';
  }
  $('shopTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-shop]'); if (!b) return; shopCat = b.dataset.shop; armed = null; renderShop(); });
  $('ownedOnly').addEventListener('change', function (e) { ownedOnly = e.target.checked; armed = null; renderShop(); });
  $('shopGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-item]'); if (!b) return;
    var it = shopList().filter(function (x) { return x.id === b.dataset.item; })[0]; if (!it) return;
    var label = it.pet ? it.pet.ko : it.name;
    if (S.owned[it.id]) {
      if (it.slot === 'pet') { S.pet = it.id; toast(josa(label, '와', '과') + ' 함께 살아요!'); }
      else if (isOn(it) && it.slot !== 'wallpaper' && it.slot !== 'floor') { delete S.equip[it.slot]; toast(label + ' 뺐어요'); }
      else { S.equip[it.slot] = it.id; toast(label + ' 사용했어요'); }
      saveS(); renderShop(); return;
    }
    if (S.gems < it.price) {
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      toast('보석이 ' + (it.price - S.gems) + '개 더 필요해요. 단어 게임으로 모아 봐요!');
      return;
    }
    if (armed === it.id && Date.now() - armedAt < 400) return;   // 너무 빠른 두 번째 터치는 무시
    if (armed !== it.id) {
      armed = it.id; armedAt = Date.now(); renderShop();
      clearTimeout(armT); armT = setTimeout(function () { armed = null; if (current === 'shop') renderShop(); }, 4000);
      return;
    }
    armed = null; clearTimeout(armT);
    S.gems -= it.price; S.owned[it.id] = 1;
    if (it.slot === 'pet') S.pet = it.id; else S.equip[it.slot] = it.id;
    saveS(); updateGems(true); renderShop();
    toast(GEM + ' ' + label + ' 구매 완료! ' + (it.slot === 'pet' ? '이제 같이 살아요' : '바로 사용했어요'));
  });

  // ---------- 앱 설치 (안드로이드 크롬) ----------
  var bip = window.__bip || null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  function showInstall() { $('installBtn').hidden = !bip || standalone; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); bip = e; window.__bip = e; showInstall(); });
  window.addEventListener('appinstalled', function () { bip = null; showInstall(); toast('앱으로 설치했어요! 홈 화면에서 열어 보세요'); });
  $('installBtn').addEventListener('click', function () {
    if (!bip) return;
    bip.prompt();
    (bip.userChoice || Promise.resolve()).then(function () { bip = null; window.__bip = null; showInstall(); });
  });
  showInstall();

  // ---------- 업데이트 기록 / 새로워진 점 ----------
  var LOG = window.CHANGELOG || [], CUR = LOG[0] || { v: '?', items: [] };
  function logHTML(list) {
    return list.map(function (e) {
      return '<div class="log-item"><div class="log-head"><b>v' + e.v + '</b><span>' + e.title + '</span><small>' + e.date + '</small></div><ul>' +
        e.items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }
  $('verTag').textContent = '지금 v' + CUR.v;
  $('logBox').addEventListener('toggle', function () { if ($('logBox').open) $('logList').innerHTML = logHTML(LOG); });
  (function () {
    var seen = load('jw-seen-version', null);
    var returning = !!seen || !isNew;                              // 예전부터 쓰던 사람인지
    if (returning && seen !== CUR.v && LOG.length) {
      var idx = -1; LOG.forEach(function (e, i) { if (e.v === seen && idx < 0) idx = i; });
      var fresh = LOG.slice(0, idx > 0 ? Math.min(idx, 3) : 1);  // 못 본 버전들 (최대 3개)
      $('newsBadge').textContent = '업데이트 완료 · v' + CUR.v;
      $('newsBody').innerHTML = logHTML(fresh);
      $('newsPet').innerHTML = petSVG('happy');
      $('news').hidden = false;
    }
    save('jw-seen-version', CUR.v);
    $('newsOk').addEventListener('click', function () { $('news').hidden = true; });
    $('news').addEventListener('click', function (e) { if (e.target === $('news')) $('news').hidden = true; });
  })();

  // ---------- 새 버전 알림 (설치한 앱 / GitHub Pages) ----------
  (function () {
    if (!('serviceWorker' in navigator)) return;
    var sw = navigator.serviceWorker;
    function showUpdate() {
      $('updateBar').hidden = false;
      fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.v && j.v !== CUR.v) $('updateText').textContent = '새 버전 v' + j.v + ' · ' + j.title;
      }).catch(function () {});
    }
    if (window.__swUpdated) showUpdate();                       // 잠금 화면에 있을 때 이미 새 버전을 받은 경우
    if (sw.controller) sw.addEventListener('controllerchange', showUpdate);
    function check() { try { sw.getRegistration().then(function (r) { if (r) r.update(); }).catch(function () {}); } catch (e) {} }
    check();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
    $('updateBtn').addEventListener('click', function () { $('updateBtn').textContent = '업데이트 중…'; location.reload(); });
  })();

  // ---------- 기록 옮기기 ----------
  var CODE_HEAD = 'JWC1:';
  $('exportBtn').addEventListener('click', function () {
    var json = JSON.stringify({ p: progress, s: settings, pet: S });
    var code = CODE_HEAD + btoa(unescape(encodeURIComponent(json)));
    var box = $('exportCode'); box.value = code; box.hidden = false; $('copyBtn').hidden = false;
    box.focus(); box.select();
    $('moveMsg').textContent = '코드를 복사해서 옮겨 갈 곳의 ‘붙여넣기’ 칸에 넣어 주세요.';
  });
  $('copyBtn').addEventListener('click', function () {
    var box = $('exportCode');
    var done = function () { $('moveMsg').textContent = '복사했어요! 옮겨 갈 곳에서 붙여넣기 하세요.'; };
    try {
      navigator.clipboard.writeText(box.value).then(done, function () { box.focus(); box.select(); $('moveMsg').textContent = '코드를 길게 눌러 직접 복사해 주세요.'; });
    } catch (e) { box.focus(); box.select(); $('moveMsg').textContent = '코드를 길게 눌러 직접 복사해 주세요.'; }
  });
  var importArmed = false, importT;
  $('importBtn').addEventListener('click', function () {
    var raw = ($('importCode').value || '').trim(), data;
    try {
      if (raw.indexOf(CODE_HEAD) !== 0) throw 0;
      data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(CODE_HEAD.length)))));
      if (!data || typeof data.p !== 'object' || typeof data.pet !== 'object' || typeof data.pet.gems !== 'number') throw 0;
    } catch (e) { $('moveMsg').textContent = '코드가 올바르지 않아요. ‘JWC1:’로 시작하는 코드 전체를 붙여넣어 주세요.'; return; }
    if (!importArmed) {
      importArmed = true; $('importBtn').textContent = '지금 기록을 덮어써요. 한 번 더 누르기';
      $('moveMsg').textContent = '불러오면 이 화면의 기록은 코드 속 기록(보석 ' + data.pet.gems + '개)으로 바뀌어요.';
      clearTimeout(importT); importT = setTimeout(function () { importArmed = false; $('importBtn').textContent = '코드로 기록 불러오기'; }, 6000);
      return;
    }
    importArmed = false; clearTimeout(importT);
    save('jw-progress', data.p); save('jw-settings', data.s || {}); save('jw-pet', data.pet);
    $('moveMsg').textContent = '불러왔어요! 잠시 뒤 다시 열려요.';
    setTimeout(function () { location.reload(); }, 800);
  });

  // ---------- 미니게임에서 쓰는 기능 ----------
  window.APP = {
    W: W, GEM: GEM, levelPool: levelPool, jp: jp, jpSpan: jpSpan, shuffle: shuffle, speak: speak, toast: toast, show: show, go: go,
    petSVG: function (face) { return petSVG(face); },
    level: function () { return settings.level; },
    overlaps: overlaps,
    award: function (n) { if (n > 0) { S.gems += n; saveS(); updateGems(true); } }
  };

  // ---------- start ----------
  applySettings();
  renderHome();
  show('home');
  updateGems();
  if (isNew) setTimeout(function () { toast('환영 선물로 보석 20개를 드렸어요!'); }, 600);
})();
