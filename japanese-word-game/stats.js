// 학습 기록 · 하루 목표 · 펫 성장 · 성적표 (기록 탭)
// 모든 게임이 문제를 하나 풀 때마다 STATS.log(종류, 맞았는지) 를 부른다.
//   종류: w5 / w4 / w3 (레벨별 단어), rd (한자 읽기), st (문장), ls (듣기)
// 게임 한 판이 끝나면 STATS.game(게임 이름) 을 부른다.
// 날짜별 기록은 이 브라우저의 jw-daily 에 저장 (기록 옮기기 코드에도 포함).
(function () {
  var A = window.APP;
  if (!A) return;
  var $ = function (id) { return document.getElementById(id); };
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var TIERS = [
    { id: 'light', name: '가볍게', n: 30, gem: 5, min: '약 10분' },
    { id: 'steady', name: '꾸준히', n: 60, gem: 10, min: '약 20분' },
    { id: 'hard', name: '열심히', n: 100, gem: 15, min: '약 30분' },
    { id: 'exam', name: '시험 대비', n: 150, gem: 20, min: '약 45분' }
  ];
  var STREAK_BONUS = { 3: 5, 7: 15, 30: 50 };
  var KINDS = [['w5', 'N5 단어'], ['w4', 'N4 단어'], ['w3', 'N3 단어'], ['rd', '한자 읽기'], ['st', '문장'], ['ls', '듣기']];
  var GAMES = { word: '단어 게임', pairs: '짝 맞추기', ox: 'O·X 퀴즈', puzzle: '읽기 퍼즐', bubble: '방울 터뜨리기', stones: '징검다리', listen: '듣고 고르기', smeaning: '문장 뜻 고르기', sfill: '빈칸 채우기', sorder: '문장 만들기' };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  var D = load('jw-daily', {});           // { 'YYYY-MM-DD': { q, ok, g: {게임: 판수}, k: {종류: [문제, 정답]}, done } }
  var cfg = Object.assign({ tier: 'steady' }, load('jw-goal', {}));

  function key(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function day(k) { return D[k] || (D[k] = { q: 0, ok: 0, g: {}, k: {}, done: false }); }
  function tier() { return TIERS.filter(function (t) { return t.id === cfg.tier; })[0] || TIERS[1]; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function streak() {   // 오늘 달성 전이면 어제부터 셈
    var n = 0, d = new Date();
    if (!(D[key(d)] && D[key(d)].done)) d = addDays(d, -1);
    while (D[key(d)] && D[key(d)].done) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak() {
    var ks = Object.keys(D).filter(function (k) { return D[k].done; }).sort(), best = 0, cur = 0, prev = null;
    ks.forEach(function (k) { var d = new Date(k + 'T00:00:00'); cur = prev && key(addDays(prev, 1)) === k ? cur + 1 : 1; best = Math.max(best, cur); prev = d; });
    return best;
  }
  function totals() { var q = 0, ok = 0; Object.keys(D).forEach(function (k) { q += D[k].q; ok += D[k].ok; }); return { q: q, ok: ok }; }
  // 펫 레벨: 누적 문제 수로 성장 (Lv.L 이 되려면 25·L·(L-1) 문제)
  function petLevel(q) { var L = 1; while (q >= 25 * (L + 1) * L) L++; return { lv: L, from: 25 * L * (L - 1), to: 25 * (L + 1) * L }; }

  // ---------- 기록 ----------
  function log(kind, ok) {
    var k = key(), d = day(k), before = petLevel(totals().q).lv;
    d.q++; if (ok) d.ok++;
    var kk = d.k[kind] || (d.k[kind] = [0, 0]); kk[0]++; if (ok) kk[1]++;
    save('jw-daily', D);
    checkGoal();
    var after = petLevel(totals().q).lv;
    if (after > before) { A.award(10); setTimeout(function () { A.toast('펫이 Lv.' + after + '이 됐어요! 보석 +10'); }, 1400); }
    paintTabBadge();
  }
  function checkGoal() {
    var d = day(key()), t = tier();
    if (d.done || d.q < t.n) return;
    d.done = true; save('jw-daily', D);
    A.award(t.gem);
    var s = streak(), extra = STREAK_BONUS[s] || 0;
    if (extra) A.award(extra);
    A.toast('오늘 목표 달성! 보석 +' + t.gem + (extra ? ' · ' + s + '일 연속 보너스 +' + extra : ''));
    paintTabBadge();
  }
  function game(type) { var d = day(key()); d.g[type] = (d.g[type] || 0) + 1; save('jw-daily', D); }

  // ---------- 그리기 ----------
  function ring(q, goal) {
    var r = 40, c = 2 * Math.PI * r, p = Math.min(1, q / goal);
    return '<svg width="104" height="104" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="12"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + (p >= 1 ? 'var(--matcha)' : 'var(--momo)') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
      '<text x="50" y="49" text-anchor="middle" font-family="Jua, sans-serif" font-size="24" fill="var(--ink)">' + q + '</text><text x="50" y="66" text-anchor="middle" font-size="11" fill="var(--muted)">/ ' + goal + '문제</text></svg>';
  }
  function bars(goal) {
    var days = [], max = goal;
    for (var i = 6; i >= 0; i--) { var d = addDays(new Date(), -i), v = D[key(d)] ? D[key(d)].q : 0; days.push({ d: d, v: v, today: i === 0 }); max = Math.max(max, v); }
    var H = 80, W = 280, bw = 26, gap = (W - bw * 7) / 6, T = 18, gy = T + H - H * goal / max, s = '';
    days.forEach(function (o, i) {
      var h = o.v ? Math.max(4, H * o.v / max) : 2, x = i * (bw + gap), y = T + H - h;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="5" fill="' + (o.v >= goal ? 'var(--matcha)' : o.today ? 'var(--momo)' : 'var(--g3)') + '"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + (o.v || '') + '</text>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (T + H + 16) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + (o.today ? '오늘' : WD[o.d.getDay()]) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + (T + H + 22) + '" width="100%" aria-label="최근 7일 푼 문제 수"><line x1="0" x2="' + W + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--momo)" stroke-dasharray="4 4"/>' +
      '<text x="' + W + '" y="' + (gy - 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--momo-deep)">목표 ' + goal + '</text>' + s + '</svg>';
  }
  var calMonth = null, selDay = null;
  function calendar(goal) {
    var m = calMonth || (calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    var first = new Date(m.getFullYear(), m.getMonth(), 1), last = new Date(m.getFullYear(), m.getMonth() + 1, 0), today = key();
    var h = WD.map(function (w) { return '<span class="cal-dw">' + w + '</span>'; }).join('');
    for (var i = 0; i < first.getDay(); i++) h += '<span class="cal-d empty"></span>';
    var studied = 0, sumQ = 0;
    for (var d = 1; d <= last.getDate(); d++) {
      var k = key(new Date(m.getFullYear(), m.getMonth(), d)), r = D[k], q = r ? r.q : 0, lvl = !q ? 0 : r.done ? 4 : q >= goal * .66 ? 3 : q >= goal * .33 ? 2 : 1;
      if (q) { studied++; sumQ += q; }
      h += '<button type="button" class="cal-d c' + lvl + (k === today ? ' is-today' : '') + (k === selDay ? ' sel' : '') + '" data-day="' + k + '" aria-label="' + (m.getMonth() + 1) + '월 ' + d + '일 ' + q + '문제">' + d + '</button>';
    }
    return { grid: h, title: m.getFullYear() + '년 ' + (m.getMonth() + 1) + '월', studied: studied, sumQ: sumQ };
  }
  function dayDetail(k, goal) {
    var r = D[k], d = new Date(k + 'T00:00:00');
    var title = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')';
    if (!r || !r.q) return '<div class="st-row"><b class="st-sub">' + title + '</b><span class="chip c-none">공부 안 한 날</span></div>';
    var gs = Object.keys(r.g).map(function (g) { return (GAMES[g] || g) + ' ' + r.g[g] + '판'; }).join(' · ');
    return '<div class="st-row"><b class="st-sub">' + title + '</b><span class="chip ' + (r.done ? 'c-ok">목표 달성' : 'c-none">목표 ' + goal + '문제 중 ' + r.q) + '</span></div>' +
      '<div class="st-2"><div><div class="st-lbl">푼 문제</div><div class="st-big">' + r.q + '</div></div><div><div class="st-lbl">정답률</div><div class="st-big">' + Math.round(r.ok / r.q * 100) + '%</div></div></div>' +
      (gs ? '<div class="st-lbl">' + gs + '</div>' : '');
  }
  function weekReport() {
    var agg = {}; KINDS.forEach(function (k) { agg[k[0]] = [0, 0]; });
    for (var i = 0; i < 7; i++) { var r = D[key(addDays(new Date(), -i))]; if (!r) continue; Object.keys(r.k).forEach(function (k) { if (agg[k]) { agg[k][0] += r.k[k][0]; agg[k][1] += r.k[k][1]; } }); }
    var rows = KINDS.map(function (k) { var a = agg[k[0]], rate = a[0] ? a[1] / a[0] : null, g = a[0] < 5 ? '-' : rate >= .85 ? 'A' : rate >= .7 ? 'B' : 'C'; return { name: k[1], q: a[0], rate: rate, g: g }; });
    var graded = rows.filter(function (r) { return r.g !== '-'; });
    var weak = graded.filter(function (r) { return r.g === 'C'; }).map(function (r) { return r.name; });
    var good = graded.filter(function (r) { return r.g === 'A'; }).map(function (r) { return r.name; });
    var stamp = !graded.length ? '–' : weak.length ? '可' : good.length >= graded.length / 2 ? '優' : '良';
    var comment = !graded.length ? '이번 주 기록이 쌓이면 성적을 매겨 줄게요. 분야마다 5문제 이상 풀어 보세요!'
      : (good.length ? good.join('·') + '는 아주 잘하고 있어요! ' : '꾸준히 잘하고 있어요. ') + (weak.length ? weak.join('·') + '를 조금 더 해 봐요.' : '이대로 계속해요!');
    return { rows: rows, stamp: stamp, comment: comment };
  }
  function weakWords() {
    var prog = load('jw-progress', {});
    return A.W.filter(function (w) { var p = prog[w.id]; return p && p.w > 0 && (p.s || 0) < 3; })
      .sort(function (a, b) { return (prog[b.id].w - (prog[b.id].s || 0)) - (prog[a.id].w - (prog[a.id].s || 0)); }).slice(0, 8);
  }
  function levelProgress() {
    var prog = load('jw-progress', {});
    return ['N5', 'N4', 'N3'].map(function (lv) {
      var ws = A.W.filter(function (w) { return w.lv === lv; }), m = ws.filter(function (w) { return prog[w.id] && prog[w.id].s >= 3; }).length;
      return { lv: lv, m: m, n: ws.length, pct: ws.length ? Math.round(m / ws.length * 100) : 0 };
    });
  }

  function render() {
    var t = tier(), today = day(key()), tot = totals(), s = streak(), best = bestStreak(), pl = petLevel(tot.q), pet = A.pet ? A.pet() : null;
    var cal = calendar(t.n), rep = weekReport(), weak = weakWords(), lvp = levelProgress();
    var left = Math.max(0, t.n - today.q);
    var mastered = lvp.reduce(function (a, b) { return a + b.m; }, 0);
    $('stats').innerHTML =
      '<div class="page-head"><h1>내 기록</h1><span class="chip c-fire">연속 ' + s + '일' + (best > s ? ' · 최고 ' + best + '일' : '') + '</span></div>' +
      // A: 오늘 목표
      '<div class="st-box st-goal"><div class="st-goalrow">' + ring(today.q, t.n) +
        '<div><div class="st-lbl">오늘 목표 · ' + t.name + '</div><div class="st-big">' + Math.min(100, Math.round(today.q / t.n * 100)) + '%</div>' +
        '<div class="st-lbl">' + (today.q >= t.n ? '달성했어요! 오늘 보너스를 받았어요' : today.done ? '오늘 보너스는 받았어요 · 새 목표까지 ' + left + '문제' : left + '문제 남았어요 · 달성하면 보석 +' + t.gem) + '</div></div></div>' +
        '<div class="st-tiers" role="radiogroup" aria-label="하루 목표">' + TIERS.map(function (x) {
          return '<button type="button" class="st-tier press" role="radio" aria-checked="' + (x.id === t.id) + '" data-tier="' + x.id + '"><b>' + x.name + '</b><span>' + x.n + '문제</span><span>' + x.min + '</span></button>';
        }).join('') + '</div></div>' +
      // C: 펫 성장
      '<div class="st-box stp-card"><div class="stp-img">' + (pet || '') + '</div><div class="stp-info">' +
        '<span class="chip c-blue">Lv.' + pl.lv + '</span><div class="st-sub">' + (A.petName ? A.petName() : '') + '</div>' +
        '<div class="st-lbl">다음 레벨까지 ' + (pl.to - tot.q) + '문제 · 레벨업하면 보석 +10</div>' +
        '<div class="st-bar"><i style="width:' + Math.round((tot.q - pl.from) / (pl.to - pl.from) * 100) + '%;background:var(--sora)"></i></div></div></div>' +
      // A: 최근 7일
      '<div class="st-box"><div class="st-lbl">최근 7일 푼 문제</div>' + bars(t.n) + '</div>' +
      // A: 누적
      '<div class="st-4">' +
        '<div class="st-box"><div class="st-big">' + tot.q.toLocaleString() + '</div><div class="st-lbl">총 문제</div></div>' +
        '<div class="st-box"><div class="st-big">' + (tot.q ? Math.round(tot.ok / tot.q * 100) + '%' : '-') + '</div><div class="st-lbl">정답률</div></div>' +
        '<div class="st-box"><div class="st-big">' + mastered + '</div><div class="st-lbl">외운 단어</div></div>' +
        '<div class="st-box"><div class="st-big">' + (A.gems ? A.gems() : 0) + '</div><div class="st-lbl">보석</div></div></div>' +
      // B: 달력
      '<div class="st-box"><div class="st-row"><button type="button" class="st-nav press" data-month="-1" aria-label="지난달">‹</button><b class="st-sub">' + cal.title + '</b><button type="button" class="st-nav press" data-month="1" aria-label="다음 달">›</button></div>' +
        '<div class="cal">' + cal.grid + '</div>' +
        '<div class="st-row st-legend"><span>공부한 날 ' + cal.studied + '일 · ' + cal.sumQ + '문제</span><span>적게 <i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i> 목표 달성</span></div></div>' +
      '<div class="st-box st-day" id="stDay">' + dayDetail(selDay || key(), t.n) + '</div>' +
      // A: 레벨별 진도
      '<div class="st-box st-lvls"><div class="st-lbl">레벨별 진도 (3번 연속 맞힌 외운 단어)</div>' + lvp.map(function (l, i) {
        return '<div class="st-lv"><b>' + l.lv + '</b><div class="st-bar"><i style="width:' + l.pct + '%;background:' + ['var(--matcha)', 'var(--sora)', 'var(--kinako)'][i] + '"></i></div><span>' + l.m + '/' + l.n + '</span></div>';
      }).join('') + '</div>' +
      // E: 성적표
      '<div class="st-report"><h3 class="jp" lang="ja">成績表</h3><p class="st-lbl" style="text-align:center">최근 7일 · 분야마다 5문제 이상 풀면 등급이 나와요</p>' +
        '<div class="st-tbl"><table><thead><tr><th>분야</th><th>푼 문제</th><th>정답률</th><th>등급</th></tr></thead><tbody>' + rep.rows.map(function (r) {
          return '<tr><td>' + r.name + '</td><td>' + r.q + '</td><td>' + (r.rate === null ? '-' : Math.min(100, Math.round(r.rate * 100)) + '%') + '</td><td class="grade g' + r.g + '">' + r.g + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="st-comment"><span class="hanko jp" lang="ja">' + rep.stamp + '</span><span>' + rep.comment + '</span></div></div>' +
      // A: 자주 틀리는 단어
      '<div class="st-box"><div class="st-lbl" style="margin-bottom:6px">자주 틀리는 단어</div>' +
        (weak.length ? '<div class="st-weak">' + weak.map(function (w) { return '<span title="' + w.ko + '">' + A.jpSpan(w) + '<small>' + w.ko + '</small></span>'; }).join('') + '</div>' +
          '<button type="button" class="primary" id="stReview" style="margin-top:10px">약한 단어 복습하기</button>'
          : '<p class="st-lbl">아직 없어요. 틀린 단어가 생기면 여기에 모여요.</p>') + '</div>' +
      '<p class="foot">기록은 이 기기에만 저장돼요. 다른 기기로 옮기려면 공부 탭 아래 ‘기록 옮기기’를 써요.</p>';
  }

  // ---------- 이벤트 ----------
  $('stats').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tier]'))) { cfg.tier = b.dataset.tier; save('jw-goal', cfg); A.toast('하루 목표를 ‘' + tier().name + ' ' + tier().n + '문제’로 정했어요'); checkGoal(); render(); return; }
    if ((b = e.target.closest('[data-month]'))) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + +b.dataset.month, 1); render(); return; }
    if ((b = e.target.closest('[data-day]'))) { selDay = b.dataset.day; render(); var el = $('stDay'); if (el) try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (x) {} return; }
    if (e.target.closest('#stReview')) { if (A.startReview) A.startReview(); }
  });

  // 아래 메뉴 '기록' 탭: 오늘 목표를 다 채우면 점 표시
  function paintTabBadge() {
    var tab = document.querySelector('.tab[data-tab="stats"]'); if (!tab) return;
    var d = D[key()]; tab.classList.toggle('goal-done', !!(d && d.done));
  }
  paintTabBadge();

  window.STATS = { log: log, game: game, render: render, data: function () { return D; }, goal: function () { return cfg; },
    restore: function (d, g) { if (d && typeof d === 'object') { D = d; save('jw-daily', D); } if (g && typeof g === 'object') { cfg = Object.assign({ tier: 'steady' }, g); save('jw-goal', cfg); } } };
})();
