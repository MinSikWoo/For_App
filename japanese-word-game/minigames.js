// 미니게임 3종: 짝 맞추기 / O·X 스피드 퀴즈 / 읽기 퍼즐. 모두 지금 고른 단어 레벨(N5/N4)에서 출제하고 보석을 준다.
(function () {
  var A = window.APP;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var M = null;

  var ICON = {
    pairs: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="8" y="12" width="26" height="34" rx="6" transform="rotate(-10 21 29)" fill="#FFB6C8" stroke="#5B4249" stroke-width="2.4"/><rect x="26" y="12" width="26" height="34" rx="6" transform="rotate(8 39 29)" fill="#FFFFFF" stroke="#5B4249" stroke-width="2.4"/><text x="39" y="30" font-size="15" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">猫</text></svg>',
    ox: '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="20" cy="30" r="12" fill="none" stroke="#4FAF7C" stroke-width="5"/><path d="M36 20 L52 40 M52 20 L36 40" stroke="#F0844F" stroke-width="5" stroke-linecap="round"/></svg>',
    bubble: '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="22" cy="34" r="15" fill="#E6F4FF" stroke="#5B4249" stroke-width="2.4"/><circle cx="42" cy="20" r="10" fill="#FFE7EC" stroke="#5B4249" stroke-width="2.4"/><circle cx="46" cy="44" r="6" fill="#FFF3D1" stroke="#5B4249" stroke-width="2"/><path d="M14 28 q3 -5 8 -6" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>',
    stones: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="2" y="36" width="56" height="20" rx="10" fill="#BFE6FF"/><ellipse cx="14" cy="44" rx="10" ry="5" fill="#D6D0E0" stroke="#5B4249" stroke-width="2.2"/><ellipse cx="44" cy="44" rx="10" ry="5" fill="#D6D0E0" stroke="#5B4249" stroke-width="2.2"/><path d="M14 30 Q29 8 44 30" fill="none" stroke="#FF8DA6" stroke-width="2.6" stroke-dasharray="4 4" stroke-linecap="round"/><circle cx="14" cy="32" r="7" fill="#FFD2A1" stroke="#5B4249" stroke-width="2.2"/></svg>',
    listen: '<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M14 24 h8 l10 -9 v30 l-10 -9 h-8z" fill="#FFE590" stroke="#5B4249" stroke-width="2.4" stroke-linejoin="round"/><path d="M38 22 a10 10 0 0 1 0 16 M43 16 a17 17 0 0 1 0 28" fill="none" stroke="#5B4249" stroke-width="2.6" stroke-linecap="round"/></svg>',
    puzzle: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="6" y="18" width="22" height="24" rx="6" fill="#FFE590" stroke="#5B4249" stroke-width="2.4"/><rect x="32" y="18" width="22" height="24" rx="6" fill="#BFE6FF" stroke="#5B4249" stroke-width="2.4"/><text x="17" y="30" font-size="14" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">ね</text><text x="43" y="30" font-size="14" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">こ</text></svg>'
  };
  var GAMES = {
    pairs: { name: '짝 맞추기', desc: '일본어 카드와 뜻 카드를 짝지어요', reward: '최대 12개', start: startPairs },
    ox: { name: 'O·X 스피드 퀴즈', desc: '40초 동안 뜻이 맞는지 빠르게 골라요', reward: '맞힌 만큼', start: startOX },
    puzzle: { name: '읽기 퍼즐', desc: '히라가나 조각으로 한자 읽는 법을 맞춰요', reward: '최대 10개', start: startPuzzle },
    bubble: { name: '방울 터뜨리기', desc: '떠오르는 방울 중에서 뜻에 맞는 단어를 톡!', reward: '최대 11개', start: startBubble, isNew: true },
    stones: { name: '징검다리 건너기', desc: '맞는 뜻의 돌을 골라 펫과 함께 강을 건너요', reward: '최대 13개', start: startStones, isNew: true },
    listen: { name: '듣고 고르기', desc: '일본어 발음을 듣고 맞는 단어를 골라요', reward: '최대 11개', start: startListen, isNew: true }
  };

  // ---------- 공통 ----------
  $('miniList').innerHTML = Object.keys(GAMES).map(function (k) {
    var g = GAMES[k];
    return '<button type="button" class="mini-card press" data-mini="' + k + '"><span class="mini-ic">' + ICON[k] + '</span><span class="tx"><strong>' + g.name + (g.isNew ? ' <em class="new-tag">NEW</em>' : '') + '</strong><small>' + g.desc + '</small></span><span class="mini-rw">' + A.GEM + g.reward + '</span></button>';
  }).join('');
  $('miniList').addEventListener('click', function (e) { var b = e.target.closest('[data-mini]'); if (b) open(b.dataset.mini); });
  $('miniQuit').addEventListener('click', function () { stop(); A.go('home'); });
  $('miniHome').addEventListener('click', function () { stop(); A.go('home'); });
  $('miniAgain').addEventListener('click', function () { if (M) open(M.type); });

  function stop() { if (!M) return; M.timers.forEach(clearTimeout); clearInterval(M.iv); if (M.raf) cancelAnimationFrame(M.raf); if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} M.dead = true; }
  function later(fn, ms) { var t = setTimeout(function () { if (!M.dead) fn(); }, ms); M.timers.push(t); }
  function setGems() { $('miniGems').innerHTML = A.GEM + '<span>+' + M.earned + '</span>'; }
  function open(type) {
    stop();
    M = { type: type, timers: [], earned: 0 };
    $('miniTitle').textContent = GAMES[type].name;
    $('miniEnd').hidden = true; $('miniBody').hidden = false;
    A.show('mini'); setGems();
    GAMES[type].start();
  }
  function finish(head, sub, gems) {
    stop();
    M.earned += gems; A.award(gems); setGems();
    $('miniBody').hidden = true; $('miniEnd').hidden = false;
    $('miniHead').textContent = head; $('miniSub').textContent = sub;
    $('miniReward').innerHTML = A.GEM + '보석 +' + gems;
    $('miniPet').innerHTML = A.petSVG(gems >= 4 ? 'happy' : 'smile');
    var svg = $('miniPet').querySelector('svg'); if (svg && gems >= 4) { svg.classList.remove('jump'); void svg.getBoundingClientRect(); svg.classList.add('jump'); }
    window.scrollTo(0, 0);
  }
  function pool(filter) {
    var p = A.levelPool().filter(filter || function () { return true; });
    return p.length >= 8 ? p : A.W.filter(filter || function () { return true; });
  }
  function distinct(list, n, key) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length && out.length < n; i++) { var k = key(list[i]); if (seen[k]) continue; seen[k] = 1; out.push(list[i]); }
    return out;
  }
  function ruby(w) { return A.jpSpan(w); }

  // ---------- 1) 짝 맞추기 ----------
  function startPairs() {
    var words = distinct(A.shuffle(pool(function (w) { return w.kanji; })), 6, function (w) { return w.ko + '|' + w.plain; });
    var cards = A.shuffle(words.reduce(function (a, w, i) { return a.concat([{ i: i, side: 'jp', w: w }, { i: i, side: 'ko', w: w }]); }, []));
    var st = { open: [], done: 0, moves: 0, lock: true };
    $('miniBody').innerHTML = '<p class="mini-hint" id="pHint">3초 동안 카드를 외워 보세요!</p><div class="pairs" id="pGrid">' + cards.map(function (c, k) {
      return '<button type="button" class="pc open" data-k="' + k + '"><span class="pc-back" aria-hidden="true">?</span><span class="pc-face ' + c.side + '">' + (c.side === 'jp' ? ruby(c.w) : c.w.ko) + '</span></button>';
    }).join('') + '</div><p class="mini-stat" id="pStat">뒤집은 횟수 0</p>';
    var btns = $('pGrid').children;
    later(function () {
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('open');
      st.lock = false; $('pHint').textContent = '같은 단어의 일본어와 뜻을 찾아요';
    }, 3000);
    $('pGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b || st.lock || b.classList.contains('open')) return;
      var c = cards[+b.dataset.k];
      b.classList.add('open'); st.open.push({ b: b, c: c });
      if (c.side === 'jp') A.speak(c.w.reading);
      if (st.open.length < 2) return;
      st.moves++; $('pStat').textContent = '뒤집은 횟수 ' + st.moves;
      var a1 = st.open[0], a2 = st.open[1]; st.open = [];
      if (a1.c.i === a2.c.i) {
        a1.b.classList.add('done'); a2.b.classList.add('done'); st.done++;
        if (st.done === words.length) {
          var gems = Math.max(3, 12 - (st.moves - words.length));
          later(function () { finish(st.moves === words.length ? '한 번도 안 틀렸어요!' : '전부 찾았어요!', words.length + '쌍 · ' + st.moves + '번 뒤집음', gems); }, 700);
        }
      } else {
        st.lock = true; a1.b.classList.add('miss'); a2.b.classList.add('miss');
        later(function () { a1.b.classList.remove('open', 'miss'); a2.b.classList.remove('open', 'miss'); st.lock = false; }, 900);
      }
    });
  }

  // ---------- 2) O·X 스피드 퀴즈 ----------
  function startOX() {
    var list = pool(), TOTAL = 40000;
    var st = { score: 0, combo: 0, best: 0, end: Date.now() + TOTAL, q: null };
    $('miniBody').innerHTML = '<div class="timebar"><i id="oxBar"></i></div>' +
      '<div class="ox-card card" id="oxCard"><p class="ox-q">이 뜻이 맞을까?</p><div class="ox-word jp" lang="ja" id="oxWord"></div><div class="ox-mean" id="oxMean"></div></div>' +
      '<p class="mini-stat" id="oxStat">맞힌 개수 0</p>' +
      '<div class="ox-btns"><button type="button" class="ox-btn o" id="oxO" aria-label="맞아요">O</button><button type="button" class="ox-btn x" id="oxX" aria-label="틀려요">X</button></div>' +
      '<p class="mini-hint" id="oxFb">맞으면 O, 틀리면 X! 틀리면 3초가 줄어요</p>';
    function next() {
      var w = list[Math.floor(Math.random() * list.length)], truth = Math.random() < .5, shown = w.ko;
      if (!truth) { var o; do { o = list[Math.floor(Math.random() * list.length)]; } while (o.ko === w.ko); shown = o.ko; }
      st.q = { w: w, truth: truth };
      $('oxWord').innerHTML = A.jp(w); $('oxMean').textContent = shown;
      var c = $('oxCard'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    }
    function answer(sayO) {
      if (!st.q || M.dead) return;
      var ok = sayO === st.q.truth, card = $('oxCard');
      card.classList.remove('good', 'bad'); void card.offsetWidth; card.classList.add(ok ? 'good' : 'bad');
      if (ok) { st.score++; st.combo++; st.best = Math.max(st.best, st.combo); $('oxFb').textContent = st.combo >= 3 ? st.combo + '연속!' : '정답!'; }
      else { st.combo = 0; st.end -= 3000; $('oxFb').innerHTML = '땡! ' + A.jpSpan(st.q.w) + ' = ' + st.q.w.ko; }
      $('oxStat').textContent = '맞힌 개수 ' + st.score;
      next();
    }
    $('oxO').addEventListener('click', function () { answer(true); });
    $('oxX').addEventListener('click', function () { answer(false); });
    M.key = function (e) { if (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft') answer(true); if (e.key === 'x' || e.key === 'X' || e.key === 'ArrowRight') answer(false); };
    M.iv = setInterval(function () {
      var left = st.end - Date.now();
      $('oxBar').style.width = Math.max(0, left / TOTAL * 100) + '%';
      if (left <= 0) {
        var gems = Math.floor(st.score / 2) + (st.score >= 15 ? 5 : 0);
        finish(st.score >= 15 ? '번개처럼 빨라요!' : st.score >= 8 ? '잘했어요!' : '다음엔 더 많이!', st.score + '개 맞힘 · 최고 ' + st.best + '연속', gems);
      }
    }, 100);
    next();
  }
  document.addEventListener('keydown', function (e) { if (M && !M.dead && M.key && !$('mini').hidden) M.key(e); });

  // ---------- 3) 읽기 퍼즐 ----------
  function startPuzzle() {
    var ROUNDS = 5;
    var list = distinct(A.shuffle(pool(function (w) { return w.kanji && w.reading.length >= 2 && w.reading.length <= 6; })), ROUNDS, function (w) { return w.reading; });
    var allKana = A.W.map(function (w) { return w.reading; }).join('').split('').filter(function (ch) { return /[ぁ-ゖ]/.test(ch); });
    var st = { r: 0, gems: 0, perfect: 0 };
    function round() {
      var w = list[st.r], chars = w.reading.split(''), have = {};
      chars.forEach(function (c) { have[c] = 1; });
      var decoys = [];
      while (decoys.length < 2) { var d = allKana[Math.floor(Math.random() * allKana.length)]; if (!have[d] && decoys.indexOf(d) < 0) decoys.push(d); }
      var tiles = A.shuffle(chars.concat(decoys)).map(function (c) { return { c: c, used: -1 }; });
      var slots = chars.map(function () { return -1; });
      var tries = 0, done = false;
      $('miniBody').innerHTML = '<p class="mini-stat">' + (st.r + 1) + ' / ' + ROUNDS + '</p>' +
        '<div class="pz-card card"><div class="pz-word jp" lang="ja" id="pzWord">' + A.jp(w, false) + '</div><div class="pz-mean">' + w.ko + '</div></div>' +
        '<div class="pz-slots" id="pzSlots"></div><div class="pz-tiles" id="pzTiles"></div>' +
        '<div class="row" style="justify-content:center"><button type="button" class="pill press" id="pzBack">한 글자 지우기</button><button type="button" class="pill alt press" id="pzHint">힌트</button></div>' +
        '<p class="mini-hint" id="pzFb">한자를 어떻게 읽는지 히라가나를 순서대로 눌러요</p>';
      function draw() {
        $('pzSlots').innerHTML = slots.map(function (t, i) { return '<button type="button" class="pz-slot' + (t >= 0 ? ' full' : '') + '" data-s="' + i + '" lang="ja">' + (t >= 0 ? tiles[t].c : '') + '</button>'; }).join('');
        $('pzTiles').innerHTML = tiles.map(function (t, i) { return '<button type="button" class="pz-tile press" data-t="' + i + '" lang="ja"' + (t.used >= 0 ? ' disabled' : '') + '>' + t.c + '</button>'; }).join('');
      }
      function check() {
        if (slots.indexOf(-1) >= 0) return;
        var got = slots.map(function (t) { return tiles[t].c; }).join('');
        if (got === w.reading) {
          done = true;
          var g = tries === 0 ? 2 : 1; st.gems += g; if (!tries) st.perfect++;
          $('pzSlots').classList.add('good'); $('pzWord').innerHTML = A.jp(w);
          $('pzFb').innerHTML = (tries === 0 ? '한 번에 정답! ' : '정답! ') + '보석 +' + g;
          A.speak(w.reading);
          later(function () { st.r++; if (st.r >= list.length) finish(st.perfect === list.length ? '퍼즐 마스터!' : '퍼즐 완성!', list.length + '문제 중 ' + st.perfect + '개를 한 번에 맞힘', st.gems); else round(); }, 1400);
        } else {
          tries++;
          var el = $('pzSlots'); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
          $('pzFb').textContent = '아쉬워요, 다시 해 봐요';
          later(function () { slots = slots.map(function () { return -1; }); tiles.forEach(function (t) { t.used = -1; }); el.classList.remove('bad'); draw(); }, 600);
        }
      }
      $('pzTiles').addEventListener('click', function (e) {
        var b = e.target.closest('[data-t]'); if (!b || done) return;
        var ti = +b.dataset.t, si = slots.indexOf(-1); if (si < 0 || tiles[ti].used >= 0) return;
        slots[si] = ti; tiles[ti].used = si; draw(); check();
      });
      $('pzSlots').addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]'); if (!b || done) return;
        var si = +b.dataset.s; if (slots[si] < 0) return;
        tiles[slots[si]].used = -1; slots[si] = -1; draw();
      });
      $('pzBack').addEventListener('click', function () {
        if (done) return;
        for (var i = slots.length - 1; i >= 0; i--) if (slots[i] >= 0) { tiles[slots[i]].used = -1; slots[i] = -1; break; }
        draw();
      });
      $('pzHint').addEventListener('click', function () {
        if (done) return;
        for (var i = 0; i < chars.length; i++) {
          var t = slots[i];
          if (t >= 0 && tiles[t].c === chars[i]) continue;
          if (t >= 0) { tiles[t].used = -1; slots[i] = -1; }
          var k = tiles.findIndex(function (x) { return x.used < 0 && x.c === chars[i]; });
          if (k < 0) { k = tiles.findIndex(function (x) { return x.c === chars[i]; }); var j = tiles[k].used; if (j >= 0) slots[j] = -1; }
          slots[i] = k; tiles[k].used = i; tries = Math.max(tries, 1);
          $('pzFb').textContent = '힌트를 썼어요. 이 문제는 보석 1개'; break;
        }
        draw(); check();
      });
      draw();
    }
    round();
  }

  // 보기 4개 만들기 (같은 분류에서 우선)
  function choices(w, list, key) {
    var used = {}; used[key(w)] = 1;
    var same = A.shuffle(list.filter(function (x) { return x !== w && x.cat === w.cat; }));
    var other = A.shuffle(list.filter(function (x) { return x !== w && x.cat !== w.cat; }));
    var out = [w], c = same.concat(other);
    for (var i = 0; i < c.length && out.length < 4; i++) { var k = key(c[i]); if (used[k]) continue; used[k] = 1; out.push(c[i]); }
    return A.shuffle(out);
  }
  function hearts(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<span class="hp' + (i < n ? '' : ' off') + '">♥</span>'; return s; }

  // ---------- 4) 방울 터뜨리기 ----------
  function startBubble() {
    var ROUNDS = 8, list = pool(), qs = distinct(A.shuffle(list), ROUNDS, function (w) { return w.ko; });
    var st = { r: 0, got: 0 };
    $('miniBody').innerHTML = '<p class="mini-stat" id="bbStat"></p><div class="bb-target card" id="bbTarget"></div>' +
      '<div class="bb-arena" id="bbArena"></div><p class="mini-hint" id="bbFb">뜻에 맞는 일본어 방울을 눌러요</p>';
    var arena = $('bbArena'), bubbles = [], last = 0, roundOver = false;
    function round() {
      var w = qs[st.r], opts = choices(w, list, function (x) { return x.plain; });
      roundOver = false;
      $('bbStat').textContent = (st.r + 1) + ' / ' + qs.length + ' · 터뜨린 방울 ' + st.got;
      $('bbTarget').innerHTML = '<small>이 뜻의 단어를 찾아요</small><b>' + w.ko + '</b>';
      arena.innerHTML = '';
      var H = arena.clientHeight, Wd = arena.clientWidth, cols = A.shuffle([0, 1, 2, 3]);
      bubbles = opts.map(function (o, i) {
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'bb'; el.innerHTML = A.jpSpan(o);
        arena.appendChild(el);
        var size = el.offsetWidth || 96;
        return { el: el, w: o, x0: 6 + cols[i] * Math.max(0, (Wd - size - 12) / 3), y: H + 10 + i * 85, sp: 62 + Math.random() * 22, ph: Math.random() * 6, hit: false };
      });
      bubbles.forEach(function (b) {
        b.el.addEventListener('click', function () {
          if (roundOver || b.hit) return;
          if (b.w === w) {
            b.hit = true; roundOver = true; st.got++;
            b.el.classList.add('pop'); A.speak(w.reading);
            $('bbFb').innerHTML = '톡! ' + A.jpSpan(w) + ' = ' + w.ko;
            later(nextRound, 900);
          } else {
            b.hit = true; b.el.classList.add('no');
            $('bbFb').innerHTML = '그건 ' + A.jpSpan(b.w) + ' (' + b.w.ko + ')';
          }
        });
      });
      last = performance.now();
    }
    function nextRound() {
      st.r++;
      if (st.r >= qs.length) finish(st.got === qs.length ? '방울을 전부 터뜨렸어요!' : st.got >= 5 ? '톡톡 잘했어요!' : '다음엔 더 빨리!', qs.length + '개 중 ' + st.got + '개', st.got + (st.got === qs.length ? 3 : 0));
      else round();
    }
    function tick(now) {
      if (M.dead) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      bubbles.forEach(function (b) {
        if (b.el.classList.contains('pop')) return;
        b.y -= b.sp * dt; b.ph += dt * 2;
        b.el.style.transform = 'translate(' + (b.x0 + Math.sin(b.ph) * 8).toFixed(1) + 'px,' + b.y.toFixed(1) + 'px)';
      });
      var target = bubbles.filter(function (b) { return b.w === qs[st.r]; })[0];
      if (!roundOver && target && target.y < -110) {
        roundOver = true;
        $('bbFb').innerHTML = '놓쳤어요! 정답은 ' + A.jpSpan(target.w);
        later(nextRound, 1200);
      }
      M.raf = requestAnimationFrame(tick);
    }
    round(); M.raf = requestAnimationFrame(tick);
  }

  // ---------- 5) 징검다리 건너기 ----------
  function startStones() {
    var STEPS = 10, list = pool(), qs = distinct(A.shuffle(list), STEPS, function (w) { return w.ko; });
    var st = { i: 0, life: 3, got: 0, busy: false };
    $('miniBody').innerHTML = '<div class="row" style="justify-content:space-between"><span class="hearts" id="stHearts"></span><span class="mini-stat" id="stStat"></span></div>' +
      '<div class="st-track" id="stTrack"></div><div class="st-q card" id="stQ"></div>' +
      '<div class="river"><div class="stone home"></div><button type="button" class="stone pick up" id="stUp"></button><button type="button" class="stone pick down" id="stDown"></button><div class="st-pet" id="stPet"></div><span class="splash" id="splash" hidden>첨벙!</span></div>' +
      '<p class="mini-hint" id="stFb">단어의 뜻이 적힌 돌로 뛰어요</p>';
    function step() {
      var w = qs[st.i], other = choices(w, list, function (x) { return x.ko; }).filter(function (x) { return x !== w; })[0];
      var up = Math.random() < .5;
      st.cur = { w: w, up: up }; st.busy = false;
      $('stHearts').innerHTML = hearts(st.life, 3);
      $('stStat').textContent = (st.i + 1) + ' / ' + qs.length;
      $('stTrack').innerHTML = qs.map(function (q, k) { return '<i class="' + (k < st.i ? 'done' : k === st.i ? 'now' : '') + '"></i>'; }).join('') + '<span class="flag" aria-hidden="true">🏁</span>';
      $('stQ').innerHTML = A.jpSpan(w);
      $('stUp').textContent = up ? w.ko : other.ko; $('stDown').textContent = up ? other.ko : w.ko;
      $('stUp').className = 'stone pick up'; $('stDown').className = 'stone pick down';
      var pet = $('stPet'); pet.className = 'st-pet'; pet.innerHTML = A.petSVG('smile'); $('splash').hidden = true;
    }
    function pick(isUp) {
      if (st.busy || M.dead) return; st.busy = true;
      var ok = isUp === st.cur.up, pet = $('stPet'), el = isUp ? $('stUp') : $('stDown'), right = st.cur.up ? $('stUp') : $('stDown');
      pet.classList.add(isUp ? 'hop-up' : 'hop-down');
      A.speak(st.cur.w.reading);
      if (ok) {
        st.got++; el.classList.add('good'); pet.innerHTML = A.petSVG('happy');
        $('stFb').innerHTML = '폴짝! ' + A.jpSpan(st.cur.w) + ' = ' + st.cur.w.ko;
      } else {
        st.life--; el.classList.add('sink'); right.classList.add('good');
        later(function () { pet.innerHTML = A.petSVG('sad'); pet.classList.add('wet'); $('splash').hidden = false; }, 450);
        $('stFb').innerHTML = '첨벙! 정답은 ‘' + st.cur.w.ko + '’';
        $('stHearts').innerHTML = hearts(st.life, 3);
      }
      later(function () {
        st.i++;
        if (st.life <= 0) return finish('다음엔 꼭 건너요!', st.got + '칸 건넘', st.got);
        if (st.i >= qs.length) return finish(st.life === 3 ? '한 번도 안 빠졌어요!' : '강을 건넜어요!', '남은 하트 ' + st.life + '개', st.got + (st.life === 3 ? 3 : 0));
        step();
      }, ok ? 900 : 1500);
    }
    $('stUp').addEventListener('click', function () { pick(true); });
    $('stDown').addEventListener('click', function () { pick(false); });
    step();
  }

  // ---------- 6) 듣고 고르기 ----------
  function startListen() {
    var ROUNDS = 8, list = pool(), qs = distinct(A.shuffle(list), ROUNDS, function (w) { return w.reading; });
    var st = { r: 0, got: 0, peek: false, done: false };
    var canSpeak = 'speechSynthesis' in window;
    $('miniBody').innerHTML = '<p class="mini-stat" id="lsStat"></p>' +
      '<div class="ls-card card"><button type="button" class="ls-play press" id="lsPlay" aria-label="듣기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>' +
      '<span id="lsLabel">눌러서 들어 보세요</span><button type="button" class="pill alt press" id="lsPeek">글자로 보기</button><div class="ls-peek jp" lang="ja" id="lsText" hidden></div></div>' +
      '<div class="options" id="lsOpts"></div><p class="mini-hint" id="lsFb">' + (canSpeak ? '소리가 안 나오면 ‘글자로 보기’를 눌러요' : '이 기기는 소리를 낼 수 없어요. ‘글자로 보기’로 풀어요') + '</p>';
    function say() { A.speak(qs[st.r].reading); }
    function round() {
      var w = qs[st.r]; st.peek = false; st.done = false;
      st.opts = choices(w, list, function (x) { return x.reading; });
      $('lsStat').textContent = (st.r + 1) + ' / ' + qs.length + ' · 맞힌 개수 ' + st.got;
      $('lsText').hidden = true; $('lsText').textContent = w.reading;
      $('lsOpts').innerHTML = st.opts.map(function (o, i) { return '<button type="button" class="opt" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + A.jpSpan(o) + '</button>'; }).join('');
      if (st.r > 0) say();
    }
    $('lsPlay').addEventListener('click', function () { say(); $('lsLabel').textContent = '다시 듣기'; });
    $('lsPeek').addEventListener('click', function () { st.peek = true; $('lsText').hidden = false; });
    $('lsOpts').addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b || st.done) return; st.done = true;
      var w = qs[st.r], ok = st.opts[+b.dataset.i] === w, btns = $('lsOpts').children;
      for (var k = 0; k < btns.length; k++) { btns[k].disabled = true; if (st.opts[k] === w) btns[k].classList.add('right'); else if (btns[k] === b) btns[k].classList.add('wrong'); else btns[k].classList.add('dim'); }
      if (ok && !st.peek) st.got++;
      $('lsFb').innerHTML = (ok ? (st.peek ? '정답! (글자를 봐서 보석은 없어요) ' : '정답! ') : '아쉬워요. ') + A.jpSpan(w) + ' = ' + w.ko;
      later(function () {
        st.r++;
        if (st.r >= qs.length) finish(st.got === qs.length ? '귀가 아주 밝아요!' : st.got >= 5 ? '잘 들었어요!' : '여러 번 들으면 늘어요!', qs.length + '문제 중 ' + st.got + '개', st.got + (st.got === qs.length ? 3 : 0));
        else round();
      }, 1300);
    });
    round();
  }
})();
