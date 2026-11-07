// 미니게임 3종: 짝 맞추기 / O·X 스피드 퀴즈 / 읽기 퍼즐. 모두 지금 고른 단어 레벨(N5/N4)에서 출제하고 보석을 준다.
(function () {
  var A = window.APP;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  var M = null;

  var ICON = {
    pairs: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="8" y="12" width="26" height="34" rx="6" transform="rotate(-10 21 29)" fill="#FFB6C8" stroke="#5B4249" stroke-width="2.4"/><rect x="26" y="12" width="26" height="34" rx="6" transform="rotate(8 39 29)" fill="#FFFFFF" stroke="#5B4249" stroke-width="2.4"/><text x="39" y="30" font-size="15" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">猫</text></svg>',
    ox: '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="20" cy="30" r="12" fill="none" stroke="#4FAF7C" stroke-width="5"/><path d="M36 20 L52 40 M52 20 L36 40" stroke="#F0844F" stroke-width="5" stroke-linecap="round"/></svg>',
    puzzle: '<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="6" y="18" width="22" height="24" rx="6" fill="#FFE590" stroke="#5B4249" stroke-width="2.4"/><rect x="32" y="18" width="22" height="24" rx="6" fill="#BFE6FF" stroke="#5B4249" stroke-width="2.4"/><text x="17" y="30" font-size="14" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">ね</text><text x="43" y="30" font-size="14" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, sans-serif" font-weight="700" fill="#5B4249">こ</text></svg>'
  };
  var GAMES = {
    pairs: { name: '짝 맞추기', desc: '일본어 카드와 뜻 카드를 짝지어요', reward: '최대 12개', start: startPairs },
    ox: { name: 'O·X 스피드 퀴즈', desc: '40초 동안 뜻이 맞는지 빠르게 골라요', reward: '맞힌 만큼', start: startOX },
    puzzle: { name: '읽기 퍼즐', desc: '히라가나 조각으로 한자 읽는 법을 맞춰요', reward: '최대 10개', start: startPuzzle }
  };

  // ---------- 공통 ----------
  $('miniList').innerHTML = Object.keys(GAMES).map(function (k) {
    var g = GAMES[k];
    return '<button type="button" class="mini-card press" data-mini="' + k + '"><span class="mini-ic">' + ICON[k] + '</span><span class="tx"><strong>' + g.name + '</strong><small>' + g.desc + '</small></span><span class="mini-rw">' + A.GEM + g.reward + '</span></button>';
  }).join('');
  $('miniList').addEventListener('click', function (e) { var b = e.target.closest('[data-mini]'); if (b) open(b.dataset.mini); });
  $('miniQuit').addEventListener('click', function () { stop(); A.go('home'); });
  $('miniHome').addEventListener('click', function () { stop(); A.go('home'); });
  $('miniAgain').addEventListener('click', function () { if (M) open(M.type); });

  function stop() { if (!M) return; M.timers.forEach(clearTimeout); clearInterval(M.iv); M.dead = true; }
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
})();
