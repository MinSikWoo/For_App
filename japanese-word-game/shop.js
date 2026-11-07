// 상점 데이터: 펫 10종 + 소품 132개. 모든 그림은 직접 그린 SVG (어느 휴대폰에서나 똑같이 보임).
// 가격 = 보석 개수. price 0 = 처음부터 가지고 있음. 아이템 id 는 바꾸지 말 것 (이미 산 물건 기록이 id 로 저장됨).
(function () {
  var OL = '#5B4249';
  var uid = 0;

  // ---------- 그리기 도구 ----------
  function S(w) { return ' stroke="' + OL + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function st(w) { return w === 0 ? '' : S(w); }
  function P(d, f, w) { return '<path d="' + d + '" fill="' + (f || 'none') + '"' + st(w) + '/>'; }
  function C(cx, cy, r, f, w) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + st(w) + '/>'; }
  function E(cx, cy, rx, ry, f, w, rot) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"' + (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + ' fill="' + f + '"' + st(w) + '/>'; }
  function R(x, y, w, h, r, f, sw) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + f + '"' + st(sw) + '/>'; }
  function L(d, col, w) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (w || 3) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function T(x, y, size, txt, col) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="middle" dominant-baseline="central" font-family="Zen Maru Gothic, Jua, sans-serif" font-weight="700" fill="' + (col || OL) + '">' + txt + '</text>'; }
  function f1(n) { return Math.round(n * 10) / 10; }
  function mir(d) { return d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, function (m, x, y) { return f1(120 - +x) + ' ' + y; }); }
  function heart(cx, cy, s, f, w) {
    return P('M' + cx + ' ' + f1(cy + s * .9) + ' C' + f1(cx - s * 1.6) + ' ' + f1(cy - s * .2) + ' ' + f1(cx - s * .8) + ' ' + f1(cy - s * 1.3) + ' ' + cx + ' ' + f1(cy - s * .45) +
      ' C' + f1(cx + s * .8) + ' ' + f1(cy - s * 1.3) + ' ' + f1(cx + s * 1.6) + ' ' + f1(cy - s * .2) + ' ' + cx + ' ' + f1(cy + s * .9) + 'Z', f, w);
  }
  function star(cx, cy, r, f, w) {
    var p = '';
    for (var i = 0; i < 10; i++) { var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .5 : r; p += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr); }
    return P(p + 'Z', f, w === undefined ? 2.2 : w);
  }
  function flower(cx, cy, r, col, mid, n, w) {
    var s = ''; n = n || 5;
    for (var k = 0; k < n; k++) { var a = k * 2 * Math.PI / n; s += C(f1(cx + Math.cos(a) * r), f1(cy + Math.sin(a) * r), f1(r * .85), col, w === undefined ? 1.6 : w); }
    return s + C(cx, cy, f1(r * .6), mid || '#FFD45C', 0);
  }
  function kao(cx, cy, k) { // 작은 웃는 얼굴
    k = k || 1;
    return C(f1(cx - 5 * k), cy, f1(1.9 * k), OL, 0) + C(f1(cx + 5 * k), cy, f1(1.9 * k), OL, 0) +
      L('M' + f1(cx - 2.2 * k) + ' ' + f1(cy + 3 * k) + ' Q' + cx + ' ' + f1(cy + 5.2 * k) + ' ' + f1(cx + 2.2 * k) + ' ' + f1(cy + 3 * k), OL, f1(1.8 * k)) +
      E(f1(cx - 9 * k), f1(cy + 3 * k), f1(3.2 * k), f1(2 * k), '#FF9EB5', 0) + E(f1(cx + 9 * k), f1(cy + 3 * k), f1(3.2 * k), f1(2 * k), '#FF9EB5', 0);
  }
  function cloud(cx, cy, s, f, w) {
    var q = function (x, y) { return f1(cx + x * s) + ' ' + f1(cy + y * s); };
    return P('M' + q(-12, 6) + ' Q' + q(-19, 6) + ' ' + q(-17, -1) + ' Q' + q(-15, -7) + ' ' + q(-8, -5) + ' Q' + q(-5, -13) + ' ' + q(3, -11) + ' Q' + q(11, -11) + ' ' + q(12, -3) + ' Q' + q(19, -3) + ' ' + q(18, 3) + ' Q' + q(17, 7) + ' ' + q(11, 6) + 'Z', f || '#FFFFFF', w === undefined ? 2.4 : w);
  }
  function pot(col, rim) { return P('M28 64 H72 L67 90 Q66 93 62 93 H38 Q34 93 33 90Z', col) + R(23, 57, 54, 11, 5.5, rim || col); }
  function qpt(t, a, b, c) { return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c; }
  function along(n, fn) { var s = ''; for (var i = 0; i < n; i++) { var t = i / (n - 1); s += fn(f1(qpt(t, 28, 60, 92)), f1(qpt(t, 95, 109, 95)), i); } return s; }

  // ---------- 펫 10종 ----------
  var PETS = [
    { id: 'cat',     name: '{猫|ねこ}',   ko: '고양이', cry: 'にゃー',   price: 0,   body: '#FFD2A1', light: '#FFF1DF', dark: '#F2A766' },
    { id: 'dog',     name: '{犬|いぬ}',   ko: '강아지', cry: 'わんわん', price: 40,  body: '#F6E3C6', light: '#FFF6EA', dark: '#C08A5E' },
    { id: 'rabbit',  name: 'うさぎ',       ko: '토끼',   cry: 'ぴょん',   price: 50,  body: '#FFFFFF', light: '#FFFFFF', dark: '#F6DCE4' },
    { id: 'hamster', name: 'ハムスター',   ko: '햄스터', cry: 'ちゅー',   price: 50,  body: '#F7D9A8', light: '#FFF8EC', dark: '#E2B57A' },
    { id: 'chick',   name: 'ひよこ',       ko: '병아리', cry: 'ぴよぴよ', price: 60,  body: '#FFE590', light: '#FFF6CF', dark: '#F7C64F' },
    { id: 'frog',    name: '{蛙|かえる}', ko: '개구리', cry: 'けろけろ', price: 70,  body: '#A6DE8A', light: '#E3F6D6', dark: '#7DC264' },
    { id: 'bear',    name: '{熊|くま}',   ko: '곰',     cry: 'がおー',   price: 80,  body: '#D9A57A', light: '#F6DCC2', dark: '#B07B52' },
    { id: 'penguin', name: 'ペンギン',     ko: '펭귄',   cry: 'ぺんぺん', price: 90,  body: '#6E83B8', light: '#FFFFFF', dark: '#4F639A' },
    { id: 'fox',     name: '{狐|きつね}', ko: '여우',   cry: 'こんこん', price: 100, body: '#FFAE6B', light: '#FFF6EC', dark: '#5B4249' },
    { id: 'panda',   name: 'パンダ',       ko: '판다',   cry: 'もぐもぐ', price: 150, body: '#FFFFFF', light: '#FFFFFF', dark: '#3E3A44' }
  ];
  var BODY = 'M60 34 C89 34 107 54 107 78 C107 99 88 109 60 109 C32 109 13 99 13 78 C13 54 31 34 60 34Z';
  var TOP = { frog: 33, rabbit: 33, penguin: 35 };
  function headTop(id) { return TOP[id] || 34; }
  function eyesOf(id) { return id === 'frog' ? [[41, 44], [79, 44]] : [[45, 77], [75, 77]]; }
  function mouthY(id) { return { bear: 90, dog: 90, fox: 89, panda: 88 }[id] || 85; }

  function faceSVG(id, f) {
    var Ey = eyesOf(id), s = '', my = mouthY(id), ec = id === 'panda' ? '#FFFFFF' : OL;
    var line = function (d, w) { return L(d, ec, w); };
    if (f === 'happy') {
      Ey.forEach(function (e) { s += line('M' + (e[0] - 6) + ' ' + (e[1] + 2) + ' Q' + e[0] + ' ' + (e[1] - 7) + ' ' + (e[0] + 6) + ' ' + (e[1] + 2), 3.4); });
    } else if (f === 'sad') {
      Ey.forEach(function (e) { s += line('M' + (e[0] - 5.5) + ' ' + (e[1] - 1) + ' Q' + e[0] + ' ' + (e[1] + 5) + ' ' + (e[0] + 5.5) + ' ' + (e[1] - 1), 3.2); });
      var by = Ey[0][1] - 10;
      s += L('M' + (Ey[0][0] - 6) + ' ' + by + ' L' + (Ey[0][0] + 5) + ' ' + (by + 2.5) + ' M' + (Ey[1][0] + 6) + ' ' + by + ' L' + (Ey[1][0] - 5) + ' ' + (by + 2.5), OL, 2.6);
      s += P('M83 82 q4 6 0 9.5 q-4 -3.5 0 -9.5z', '#9CC3FF', 0);
    } else if (id === 'panda') {
      Ey.forEach(function (e) { s += C(e[0], e[1], 5.2, '#FFFFFF', 0) + C(e[0] + .6, e[1] + .6, 3.2, '#2A262E', 0) + C(e[0] + 1.6, e[1] - 1.2, 1.2, '#FFFFFF', 0); });
    } else {
      Ey.forEach(function (e) { s += E(e[0], e[1], 5.4, 6.6, OL, 0) + C(f1(e[0] + 1.8), f1(e[1] - 2.6), 2.2, '#FFFFFF', 0) + C(f1(e[0] - 1.6), f1(e[1] + 2.4), 1.1, '#FFFFFF', 0); });
    }
    if (id === 'penguin' || id === 'chick') {
      s += f === 'happy' ? P('M54 81 Q60 77 66 81 Z', '#FFA94D', 2.2) + P('M55 83 Q60 90 65 83 Z', '#FF8E8E', 2.2)
        : P('M54 81.5 Q60 77.5 66 81.5 Q60 89 54 81.5Z', '#FFA94D', 2.2);
    } else if (id === 'frog') {
      s += f === 'happy' ? P('M44 80 Q60 82 76 80 Q72 95 60 95 Q48 95 44 80Z', '#F06E8C', 2.4)
        : f === 'sad' ? L('M48 88 Q60 80 72 88', OL, 2.8) : L('M44 82 Q60 94 76 82', OL, 2.8);
    } else {
      s += f === 'happy' ? P('M54 ' + (my - 1) + ' Q60 ' + (my - 1) + ' 66 ' + (my - 1) + ' Q65 ' + (my + 8) + ' 60 ' + (my + 8) + ' Q55 ' + (my + 8) + ' 54 ' + (my - 1) + 'Z', '#F06E8C', 2.4)
        : f === 'sad' ? L('M55 ' + (my + 3) + ' Q60 ' + (my - 1.5) + ' 65 ' + (my + 3), OL, 2.6)
          : L('M55 ' + my + ' Q57.5 ' + (my + 3.2) + ' 60 ' + my + ' Q62.5 ' + (my + 3.2) + ' 65 ' + my, OL, 2.6);
    }
    return s;
  }

  function petParts(p) {
    var c = p, back = '', front = '', belly = '', paws = '';
    var pw = function (col) { return E(45, 105, 9.5, 6.5, col || c.body, 2.8) + E(75, 105, 9.5, 6.5, col || c.body, 2.8); };
    var nose = P('M55 82 Q60 79 65 82 Q63 86.5 60 86.5 Q57 86.5 55 82Z', OL, 0);
    var tail = function (d, w1, w2, col) { return L(d, OL, w1) + L(d, col, w2); };
    switch (p.id) {
      case 'cat':
        back = tail('M97 98 Q119 94 113 70', 15, 9, c.body);
        var ear = 'M20 64 Q15 30 31 22 Q45 28 57 41 Z', inner = 'M27 53 Q25 35 32 31 Q40 35 47 42 Z';
        back += P(ear, c.body) + P(mir(ear), c.body) + P(inner, '#FFB8C8', 0) + P(mir(inner), '#FFB8C8', 0);
        front = L('M53 43 q2 5 1 9 M60 40 v10 M67 43 q-2 5 -1 9', c.dark, 3.4) + P('M57.5 81 h5 l-2.5 2.8z', '#F38FA6', 0);
        belly = E(60, 97, 22, 9, c.light, 0); paws = pw();
        break;
      case 'dog':
        back = tail('M98 96 Q114 92 112 78', 13, 7.5, c.body);
        front = E(77, 75, 11, 10, '#EBCDA6', 0) + E(21, 64, 12, 22, c.dark, 3, 18) + E(99, 64, 12, 22, c.dark, 3, -18) + nose;
        paws = pw();
        break;
      case 'rabbit':
        back = E(43, 24, 11, 25, c.body, 3, -12) + E(79, 26, 11, 25, c.body, 3, 16) + E(43, 26, 5, 16, '#FFC6D4', 0, -12) + E(79, 28, 5, 16, '#FFC6D4', 0, 16);
        front = E(60, 81.5, 3.2, 2.4, '#F38FA6', 0); paws = pw();
        break;
      case 'hamster':
        back = C(33, 42, 10, c.body, 3) + C(87, 42, 10, c.body, 3) + C(33, 42, 5, '#FFB8C8', 0) + C(87, 42, 5, '#FFB8C8', 0);
        belly = E(60, 97, 27, 12, c.light, 0);
        front = E(60, 81.5, 3, 2.2, '#F38FA6', 0) + L('M44 40 q3 -4 6 0 M54 37 q3 -4 6 0', c.dark, 2.6);
        paws = pw();
        break;
      case 'chick':
        back = E(16, 82, 8, 13, c.dark, 3, 30) + E(104, 82, 8, 13, c.dark, 3, -30);
        front = L('M54 37 Q50 24 59 28 Q61 17 68 31', OL, 3);
        belly = E(60, 97, 22, 9, c.light, 0);
        paws = L('M40 107 h10 M45 107 v-4 M70 107 h10 M75 107 v-4', '#FFA94D', 4);
        break;
      case 'frog':
        belly = E(60, 97, 26, 11, c.light, 0);
        front = C(41, 44, 15, c.body, 3) + C(79, 44, 15, c.body, 3);
        paws = pw();
        break;
      case 'bear':
        back = C(29, 45, 14, c.body, 3) + C(91, 45, 14, c.body, 3) + C(29, 45, 7, c.light, 0) + C(91, 45, 7, c.light, 0);
        front = E(60, 88, 16, 11, c.light, 0) + nose; paws = pw();
        break;
      case 'penguin':
        back = E(16, 84, 8, 16, c.dark, 3, 25) + E(104, 84, 8, 16, c.dark, 3, -25);
        front = P('M60 54 C70 45 93 50 95 73 C97 94 81 106 60 106 C39 106 23 94 25 73 C27 50 50 45 60 54Z', '#FFFFFF', 0);
        paws = E(45, 107, 10, 5, '#FFA94D', 2.6) + E(75, 107, 10, 5, '#FFA94D', 2.6);
        break;
      case 'fox':
        back = tail('M96 100 Q122 96 114 66', 17, 11, c.body) + C(114, 64, 6.5, '#FFF6EC', 2.6);
        var fe = 'M19 66 Q13 26 29 17 Q46 26 58 42 Z', fi = 'M26 54 Q24 33 30 28 Q39 33 47 43 Z';
        back += P(fe, c.body) + P(mir(fe), c.body) + P(fi, '#FFF1E2', 0) + P(mir(fi), '#FFF1E2', 0);
        front = P('M16 84 Q38 80 60 92 Q82 80 104 84 Q100 108 60 109 Q20 108 16 84Z', c.light, 0) + E(60, 84, 4.5, 3.4, OL, 0);
        paws = pw();
        break;
      case 'panda':
        back = C(30, 45, 14, c.dark, 3) + C(90, 45, 14, c.dark, 3);
        front = E(45, 78, 11, 13, c.dark, 0, 28) + E(75, 78, 11, 13, c.dark, 0, -28) + E(60, 84.5, 4.5, 3.2, c.dark, 0);
        paws = pw(c.dark);
        break;
    }
    return { back: back, front: front, belly: belly, paws: paws };
  }

  // ---------- 펫에게 입히는 소품 (펫마다 위치를 맞춰 그림) ----------
  var PET_SLOTS = ['hat', 'face', 'neck', 'clothes', 'back'];
  var W = {};
  // 머리
  W.h1 = function (id) { var t = headTop(id); return '<g transform="translate(41 ' + (t + 3) + ') rotate(-18)">' + P('M0 0 C-6 -11 -21 -11 -19 0 C-21 11 -6 11 0 0Z', '#FF94B4', 2.6) + P('M0 0 C6 -11 21 -11 19 0 C21 11 6 11 0 0Z', '#FF94B4', 2.6) + C(0, 0, 4.8, '#FF6F9A', 2.4) + '</g>'; };
  W.h2 = function (id) { var t = headTop(id); return P('M43 ' + (t + 3) + ' L41 ' + (t - 15) + ' L51 ' + (t - 7) + ' L60 ' + (t - 20) + ' L69 ' + (t - 7) + ' L79 ' + (t - 15) + ' L77 ' + (t + 3) + 'Z', '#FFD45C', 2.6) + C(60, t - 6, 2.8, '#FF8DA6', 1.6) + C(50, t - 3, 2.2, '#9CC3FF', 1.6) + C(70, t - 3, 2.2, '#9CC3FF', 1.6); };
  W.h3 = function (id) { var t = headTop(id); return E(60, t + 1, 23, 5.5, '#5B4F7A', 2.6) + R(47, t - 24, 26, 25, 4, '#5B4F7A', 2.6) + R(47, t - 7, 26, 6, 0, '#FF8DA6', 2.2) + E(60, t + 1, 23, 5.5, 'none', 2.6); };
  W.h4 = function (id) { var t = headTop(id); return P('M60 ' + (t + 1) + ' Q84 ' + (t - 3) + ' 95 ' + (t + 5) + ' Q80 ' + (t + 8) + ' 60 ' + (t + 6) + 'Z', '#7FA7F5', 2.6) + P('M40 ' + (t + 4) + ' Q40 ' + (t - 18) + ' 60 ' + (t - 18) + ' Q80 ' + (t - 18) + ' 80 ' + (t + 4) + 'Z', '#9CC3FF', 2.6) + C(60, t - 18, 2.4, '#FFFFFF', 1.6) + heart(60, t - 6, 4, '#FFFFFF', 1.4); };
  W.h5 = function (id) { var t = headTop(id); return E(60, t + 2, 33, 8, '#F3D58A', 2.6) + P('M44 ' + (t + 2) + ' Q44 ' + (t - 16) + ' 60 ' + (t - 16) + ' Q76 ' + (t - 16) + ' 76 ' + (t + 2) + 'Z', '#F3D58A', 2.6) + R(44, t - 4, 32, 5, 0, '#FF7F7F', 2) + flower(73, t - 2, 2.6, '#FFFFFF', '#FFD45C', 5, 1.2); };
  W.h6 = function (id) { var t = headTop(id); return P('M46 ' + (t - 6) + ' V' + (t + 3) + ' Q60 ' + (t + 8) + ' 74 ' + (t + 3) + ' V' + (t - 6) + 'Z', '#5B4F7A', 2.6) + P('M33 ' + (t - 10) + ' L60 ' + (t - 20) + ' L87 ' + (t - 10) + ' L60 ' + t + 'Z', '#6A5E8C', 2.6) + L('M60 ' + (t - 10) + ' L83 ' + (t - 6) + ' V' + (t + 6), '#FFD45C', 2.6) + C(83, t + 8, 2.8, '#FFD45C', 1.6); };
  W.h7 = function (id) { var t = headTop(id); return flower(40, t + 5, 5, '#FFC2D1', '#FF8DA6', 5); };
  W.h8 = function (id) { var t = headTop(id); return flower(40, t + 5, 6, '#FFE07A', '#B07B52', 8); };
  W.h9 = function (id) { var t = headTop(id); return star(40, t + 5, 9, '#FFE07A', 2.4); };
  W.h10 = function (id) { var t = headTop(id); return P('M40 ' + (t + 14) + ' Q30 ' + (t + 8) + ' 31 ' + (t + 2) + ' Q33 ' + (t - 3) + ' 40 ' + (t - 1) + ' Q47 ' + (t - 3) + ' 49 ' + (t + 2) + ' Q50 ' + (t + 8) + ' 40 ' + (t + 14) + 'Z', '#FF6B81', 2.2) + P('M34 ' + t + ' L40 ' + (t - 6) + ' L46 ' + t + ' L40 ' + (t + 2) + 'Z', '#7ED08B', 1.8); };
  W.h11 = function (id) { var t = headTop(id); return '<g transform="translate(60 ' + t + ')">' + P('M-21 5 Q-22 -21 0 -21 Q22 -21 21 5 Q0 10 -21 5Z', '#FF6B81', 2.8) + E(-10, -8, 1.6, 2.4, '#FFF0B3', 0) + E(0, -13, 1.6, 2.4, '#FFF0B3', 0) + E(10, -8, 1.6, 2.4, '#FFF0B3', 0) + E(-4, -2, 1.6, 2.4, '#FFF0B3', 0) + E(7, -1, 1.6, 2.4, '#FFF0B3', 0) + P('M-10 -20 L-3 -24 L0 -30 L3 -24 L10 -20 L3 -18 L0 -16 L-3 -18Z', '#7ED08B', 2.2) + '</g>'; };
  W.h12 = function (id) {
    var y = headTop(id) + 4, cols = ['#FFB3C7', '#FFE38A', '#B8E3FF', '#FFB3C7', '#C9F0B8'], s = L('M30 ' + (y + 10) + ' Q60 ' + (y - 10) + ' 90 ' + (y + 10), '#7CC48A', 2.6);
    [[34, y + 6], [46, y], [60, y - 2], [74, y], [86, y + 6]].forEach(function (p, i) { s += flower(p[0], p[1], 4, cols[i], '#FFD45C', 5); });
    return s;
  };
  // 얼굴
  W.e1 = function (id) { var e = eyesOf(id); return '<circle cx="' + e[0][0] + '" cy="' + e[0][1] + '" r="11" fill="#FFFFFF" fill-opacity=".25"' + S(2.8) + '/><circle cx="' + e[1][0] + '" cy="' + e[1][1] + '" r="11" fill="#FFFFFF" fill-opacity=".25"' + S(2.8) + '/>' + L('M' + (e[0][0] + 11) + ' ' + e[0][1] + ' Q60 ' + (e[0][1] - 4) + ' ' + (e[1][0] - 11) + ' ' + e[1][1], OL, 2.6); };
  W.e2 = function (id) { var e = eyesOf(id), s = ''; e.forEach(function (p) { s += R(p[0] - 11, p[1] - 8, 22, 16, 7, '#3F3550', 2.6) + L('M' + (p[0] - 6) + ' ' + (p[1] - 3) + ' l4 -2', '#FFFFFF', 2); }); return s + L('M' + (e[0][0] + 11) + ' ' + (e[0][1] - 2) + ' H' + (e[1][0] - 11), OL, 2.6); };
  W.e3 = function (id) { var e = eyesOf(id), y = e[0][1]; return L('M14 ' + y + ' H106', OL, 8) + L('M14 ' + y + ' H106', '#7FA7F5', 4) + '<circle cx="' + e[0][0] + '" cy="' + y + '" r="10" fill="#BFE6FF" fill-opacity=".6"' + S(2.8) + '/><circle cx="' + e[1][0] + '" cy="' + y + '" r="10" fill="#BFE6FF" fill-opacity=".6"' + S(2.8) + '/>'; };
  W.e4 = function () { return '<g transform="rotate(-20 89 85)">' + R(78, 81, 22, 8, 4, '#F7D2A8', 2.2) + R(86, 81, 6, 8, 0, '#EBB98A', 0) + C(81.5, 85, .8, '#C99A62', 0) + C(96.5, 85, .8, '#C99A62', 0) + '</g>'; };
  W.e5 = function () { return heart(31, 88, 5.5, '#FF6F9A', 0) + heart(89, 88, 5.5, '#FF6F9A', 0); };
  W.e6 = function (id) { var e = eyesOf(id); return star(e[1][0] + 15, e[1][1] - 12, 5, '#FFE07A', 1.6) + star(e[0][0] - 15, e[0][1] - 9, 3.5, '#FFFFFF', 1.4) + star(e[1][0] + 19, e[1][1] + 1, 3, '#FFB6C8', 1.2); };
  W.e7 = function () { return flower(90, 84, 3.6, '#FFFFFF', '#FFD45C', 5); };
  W.e8 = function (id) { var e = eyesOf(id); return '<g fill-opacity=".55">' + heart(e[0][0], e[0][1] + 1, 10, '#FF8DA6', 2.6) + heart(e[1][0], e[1][1] + 1, 10, '#FF8DA6', 2.6) + '</g>' + L('M' + (e[0][0] + 10) + ' ' + (e[0][1] - 3) + ' Q60 ' + (e[0][1] - 7) + ' ' + (e[1][0] - 10) + ' ' + (e[1][1] - 3), OL, 2.4); };
  // 목
  var ARC = 'M27 95 Q60 109 93 95';
  W.n1 = function () { return L(ARC, OL, 11) + L(ARC, '#FF7F7F', 7) + P('M76 98 L84 113 L73 115 L69 101Z', '#FF7F7F', 2.4) + L('M73 107 L80 105', '#FFFFFF', 2); };
  W.n2 = function () { return P('M60 101 C52 93 42 95 44 101 C42 107 52 109 60 101Z M60 101 C68 93 78 95 76 101 C78 107 68 109 60 101Z', '#9CC3FF', 2.4) + C(60, 101, 3.6, '#7FA7F5', 2); };
  W.n3 = function () { return L(ARC, OL, 9) + L(ARC, '#FF7C9C', 5) + C(60, 106, 6.5, '#FFD45C', 2.4) + L('M57 107.5 H63', OL, 1.8); };
  W.n4 = function () { return along(11, function (x, y) { return C(x, y, 3.6, '#FFFFFF', 1.6); }); };
  W.n5 = function () { return L('M48 94 L60 106 L72 94', OL, 8) + L('M48 94 L60 106 L72 94', '#7FA7F5', 4.5) + C(60, 108, 7.5, '#FFD45C', 2.4) + star(60, 108, 3.8, '#FFF3B0', 0); };
  W.n6 = function () { return L(ARC, '#E3B33C', 2.2) + P('M53 102 L60 97 L67 102 L60 111Z', '#9CC3FF', 2.2) + L('M57 101 l2 -1.5', '#FFFFFF', 1.6); };
  W.n7 = function () { var cols = ['#FFB6C8', '#FFE07A', '#FFFFFF', '#C9B8F5']; return along(8, function (x, y, i) { return flower(x, y, 3.3, cols[i % 4], '#FF8DA6', 5, 1.2); }); };
  W.n8 = function () { return P('M41 94 Q60 104 79 94 Q82 113 60 113 Q38 113 41 94Z', '#FFFFFF', 2.6) + heart(60, 104, 4.5, '#FF9EB5', 0); };
  // 옷 (몸 모양에 맞춰 잘라서 그림)
  function outfit(top, inner) { var id = 'cl' + (++uid); return '<clipPath id="' + id + '"><path d="' + BODY + '"/></clipPath><g clip-path="url(#' + id + ')">' + inner + L('M0 ' + top + ' H120', OL, 2.6) + '</g>'; }
  W.o1 = function () { return outfit(97, R(0, 97, 120, 20, 0, '#FFFFFF', 0) + L('M0 99 H120', '#FF9EB5', 3) + heart(60, 104.5, 4, '#FF9EB5', 0)); };
  W.o2 = function () { return outfit(99, R(0, 99, 120, 20, 0, '#8FB4F2', 0) + R(38, 88, 6, 12, 2, '#8FB4F2', 2) + R(76, 88, 6, 12, 2, '#8FB4F2', 2) + C(41, 98, 2.2, '#FFD45C', 1.4) + C(79, 98, 2.2, '#FFD45C', 1.4)); };
  W.o3 = function () { return outfit(96, R(0, 96, 120, 20, 0, '#FFFFFF', 0) + R(0, 100, 120, 3.5, 0, '#FF9EB5', 0) + R(0, 107, 120, 3.5, 0, '#FF9EB5', 0)); };
  W.o4 = function () { return outfit(95, R(0, 95, 120, 22, 0, '#FF8E9E', 0) + L('M46 94 L60 104 L74 94', '#FFFFFF', 4) + R(0, 103, 120, 6, 0, '#FFE07A', 0) + C(30, 99, 1.6, '#FFFFFF', 0) + C(88, 99, 1.6, '#FFFFFF', 0)); };
  W.o5 = function () { return outfit(96, R(0, 96, 120, 20, 0, '#9CC3FF', 0) + L('M52 96 L60 102 L68 96', '#FFFFFF', 3) + T(60, 105.5, 8, '10', '#FFFFFF')); };
  W.o6 = function () { return outfit(95, R(0, 95, 120, 22, 0, '#FFE07A', 0) + C(60, 100, 1.8, OL, 0) + C(60, 106, 1.8, OL, 0) + L('M60 95 V112', '#F2C14E', 2)); };
  W.o7 = function () { return outfit(96, R(0, 96, 120, 20, 0, '#3F3550', 0) + P('M50 96 L60 110 L70 96Z', '#FFFFFF', 0) + P('M60 98 l-6 -3 v6z M60 98 l6 -3 v6z', '#FF6F8E', 1.4)); };
  W.o8 = function () { return outfit(96, R(0, 96, 120, 20, 0, '#FFD1DC', 0) + '<g fill="#FF9EB5" opacity=".55"><rect x="0" y="100" width="120" height="3"/><rect x="0" y="106" width="120" height="3"/><rect x="34" y="96" width="3" height="20"/><rect x="48" y="96" width="3" height="20"/><rect x="62" y="96" width="3" height="20"/><rect x="76" y="96" width="3" height="20"/></g>'); };
  // 등 (몸 뒤에 그림)
  W.b1 = function () { var w = 'M20 72 Q-2 60 2 40 Q12 46 16 38 Q24 50 30 62Z'; return P(w, '#FFFFFF') + P(mir(w), '#FFFFFF') + L('M8 52 Q14 54 18 52', '#E6E0EA', 2) + L(mir('M8 52 Q14 54 18 52'), '#E6E0EA', 2); };
  W.b2 = function () { var a = 'M24 66 Q2 44 6 34 Q22 32 30 56Z', b = 'M24 74 Q4 86 10 95 Q24 93 30 80Z'; return P(a, '#FFB6C8') + P(mir(a), '#FFB6C8') + P(b, '#C9B8F5') + P(mir(b), '#C9B8F5'); };
  W.b3 = function () { return R(88, 58, 26, 32, 9, '#FF9EB5', 2.8) + R(88, 58, 26, 13, 6.5, '#FF8DA6', 2.6) + C(101, 71, 2.6, '#FFE07A', 1.6); };
  W.b4 = function () { return L('M96 82 Q104 62 100 36', OL, 2) + L('M94 84 Q90 60 86 40', OL, 2) + E(100, 24, 10, 12, '#9CC3FF', 2.6) + E(86, 30, 9, 11, '#FFB6C8', 2.6) + E(96, 20, 2, 3.5, '#FFFFFF', 0, -25); };
  W.b5 = function () { return P('M30 62 Q6 96 4 113 H116 Q114 96 90 62Z', '#FF7F7F', 2.8); };
  W.b6 = function () { var w = 'M20 66 Q6 48 -3 50 Q4 58 -1 64 Q8 63 7 72 Q14 66 22 75Z'; return P(w, '#9B8BD9') + P(mir(w), '#9B8BD9'); };

  function petSVG(petId, face, eq, cls) {
    var p = PETS.filter(function (x) { return x.id === petId; })[0] || PETS[0];
    var parts = petParts(p);
    eq = eq || {};
    var acc = function (slot) { var id = eq[slot]; return id && W[id] ? W[id](p.id) : ''; };
    var gloss = E(37, 51, 9, 4.5, '#FFFFFF', 0, -32).replace('/>', ' opacity=".6"/>');
    var cheeks = E(31, 87, p.id === 'hamster' ? 10 : 8.5, 5, '#FF9EB5', 0).replace('/>', ' opacity=".7"/>') + E(89, 87, p.id === 'hamster' ? 10 : 8.5, 5, '#FF9EB5', 0).replace('/>', ' opacity=".7"/>');
    return '<svg class="mascot ' + (cls || '') + '" viewBox="-4 -8 128 126" aria-hidden="true">' +
      acc('back') + parts.back + P(BODY, p.body, 3) + parts.belly + parts.front + gloss + acc('clothes') + parts.paws + cheeks +
      faceSVG(p.id, face || 'smile') + acc('face') + acc('neck') + acc('hat') + '</svg>';
  }

  // ---------- 방 소품 그림 (100 x 100) ----------
  var A = {};
  // 벽 장식
  A.d1 = L('M36 20 L50 8 L64 20', OL, 2.4) + R(16, 20, 68, 56, 8, '#F7C98B') + R(24, 28, 52, 40, 4, '#CDEBFF') + P('M24 60 Q38 44 50 56 Q62 46 76 58 V68 H24Z', '#A8DDA0', 0) + C(62, 38, 6, '#FFE07A', 0) + R(24, 28, 52, 40, 4, 'none');
  A.d2 = R(30, 8, 40, 84, 18, '#D9A57A') + C(50, 32, 15, '#FFF8EC') + L('M50 32 V22 M50 32 L57 36', OL, 2.6) + R(40, 54, 20, 30, 10, '#F6DCC2') + L('M50 56 V72', OL, 2) + C(50, 75, 5, '#FFD45C', 2);
  A.d3 = E(50, 50, 28, 34, '#F6D28B') + E(50, 50, 20, 26, '#DDF2FF') + L('M38 40 L46 32 M38 50 L54 34', '#FFFFFF', 3) + heart(50, 15, 6, '#FF8DA6', 2.2);
  A.d4 = (function () { var s = R(22, 18, 56, 66, 8, '#FFFFFF') + P('M22 34 V26 Q22 18 30 18 H70 Q78 18 78 26 V34Z', '#FF8DA6') + L('M36 12 V24 M64 12 V24', OL, 3); for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) s += C(32 + 9 * c, 44 + 9 * r, 2, '#E2D2D8', 0); return s + '<circle cx="59" cy="62" r="6" fill="none" stroke="#FF6F9A" stroke-width="2.4"/>'; })();
  A.d5 = R(12, 20, 76, 56, 6, '#C9A27A') + R(19, 27, 62, 42, 3, '#CDEBFF') + P('M22 69 L44 40 Q50 34 56 40 L78 69Z', '#8FB4F2', 2.4) + P('M38 48 L44 40 Q50 34 56 40 L62 48 Q57 45 53 49 Q50 45 47 49 Q43 45 38 48Z', '#FFFFFF', 2) + C(68, 36, 5, '#FF7F7F', 0) + R(19, 27, 62, 42, 3, 'none');
  A.d6 = (function () { var s = '', cols = [['#FF9EB5', 34], ['#FFE07A', 27], ['#A8DDA0', 20], ['#9CC3FF', 13]]; s += '<path d="M12.5 70 A37.5 37.5 0 0 1 87.5 70" fill="none" stroke="' + OL + '" stroke-width="2"/>'; cols.forEach(function (c) { s += '<path d="M' + (50 - c[1]) + ' 70 A' + c[1] + ' ' + c[1] + ' 0 0 1 ' + (50 + c[1]) + ' 70" fill="none" stroke="' + c[0] + '" stroke-width="7"/>'; }); return s + cloud(18, 68, 1) + cloud(82, 68, 1); })();
  A.d7 = C(50, 50, 36, '#FFB6C8') + C(50, 50, 26, '#FFFFFF') + C(50, 50, 16, '#9CC3FF') + C(50, 50, 6, '#FF6F8E') + L('M50 50 L80 22', OL, 3) + P('M80 22 L90 14 L88 24 L80 22 L86 30 L76 28Z', '#FFE07A', 2);
  A.d8 = R(14, 12, 72, 72, 14, '#BFE6FF') + cloud(42, 42, .9, '#FFFFFF', 0) + L('M50 12 V84 M14 48 H86', OL, 3.4) + P('M10 10 Q22 50 14 92 L6 92 L6 10Z M90 10 Q78 50 86 92 L94 92 L94 10Z', '#FFB8C9');
  A.d9 = R(28, 12, 44, 74, 2, '#FFF8EC') + R(22, 8, 56, 8, 4, '#8B6A55') + R(22, 84, 56, 8, 4, '#8B6A55') + L('M40 8 L50 0 L60 8', OL, 2) + T(50, 46, 26, '夢') + R(56, 66, 7, 7, 1, '#E85A5A', 0);
  A.d10 = (function () { var carp = function (y, col) { return P('M18 ' + (y - 8) + ' H66 Q86 ' + y + ' 66 ' + (y + 8) + ' H18 L26 ' + y + 'Z', col) + C(64, y - 1, 3.2, '#FFFFFF', 1.6) + C(64.5, y - 1, 1.3, OL, 0) + L('M40 ' + (y - 5) + ' q4 5 0 10 M50 ' + (y - 5) + ' q4 5 0 10', OL, 1.8); }; return L('M16 8 V96', OL, 3.4) + carp(24, '#FF9EB5') + carp(50, '#9CC3FF') + carp(76, '#FFE07A') + C(16, 7, 4, '#FFD45C', 2); })();
  // 천장 (위에서 매달림)
  A.c1 = L('M50 0 V30', OL, 2.4) + L('M24 46 l-7 -3 M76 46 l7 -3 M28 70 l-6 4 M72 70 l6 4', '#FFD45C', 3) + R(42, 28, 16, 12, 3, '#C9C3D6') + C(50, 54, 18, '#FFF3A6') + kao(50, 56, 1);
  A.c2 = L('M50 0 V18', OL, 2.4) + R(38, 16, 24, 8, 3, '#5B4249') + E(50, 50, 26, 28, '#FF7F7F') + L('M26 40 Q50 34 74 40 M24 52 Q50 46 76 52 M26 64 Q50 58 74 64', '#E25F5F', 2) + T(50, 51, 18, '祭', '#FFFFFF') + R(38, 76, 24, 8, 3, '#5B4249') + L('M50 84 V96', '#FFD45C', 3);
  A.c3 = L('M50 0 V20', OL, 2.4) + P('M30 46 Q30 20 50 20 Q70 20 70 46Z', '#CDEBFF') + P('M44 34 q6 -5 12 0 q-6 5 -12 0Z M44 34 l-4 -3 v6z', '#FF8E8E', 0) + L('M50 46 V62', OL, 2) + R(43, 62, 14, 30, 3, '#FFE07A') + C(50, 47, 3, '#FFFFFF', 2);
  A.c4 = L('M50 100 Q44 84 52 72 Q58 62 50 60', OL, 2.2) + P('M46 61 L50 57 L54 61Z', '#FF9EB5', 2) + E(50, 34, 22, 26, '#FF9EB5') + E(42, 24, 4, 7, '#FFFFFF', 0, -25);
  A.c5 = L('M14 10 H86 M26 10 V40 M50 10 V58 M74 10 V34', OL, 2.2) + star(26, 48, 11, '#FFE07A') + star(50, 68, 14, '#FFB6C8') + star(74, 42, 10, '#B8E3FF');
  A.c6 = L('M50 0 V20', OL, 2.2) + P('M58 22 A30 30 0 1 0 82 66 A24 24 0 0 1 58 22Z', '#FFE07A') + L('M46 56 Q50 60 54 56', OL, 2.2) + E(46, 64, 4, 2.4, '#FF9EB5', 0) + star(80, 30, 6, '#FFFFFF', 2) + star(22, 78, 4, '#FFFFFF', 1.6);
  A.c7 = L('M50 0 V18', OL, 2.2) + C(50, 46, 28, '#D9E3F2') + '<path d="M24 38 H76 M22 50 H78 M26 62 H74 M38 20 Q30 46 38 72 M50 18 V74 M62 20 Q70 46 62 72" stroke="#A9B7CC" stroke-width="1.6" fill="none"/>' + C(50, 46, 28, 'none') + E(38, 34, 6, 3.5, '#FFFFFF', 0, -30) + star(84, 22, 6, '#FFE07A', 1.6) + star(16, 72, 5, '#FFB6C8', 1.6);
  A.c8 = L('M30 0 V30 M70 0 V30', OL, 2.2) + cloud(50, 42, 2.2) + kao(50, 42, .9) + P('M34 64 q3 5 0 8 q-3 -3 0 -8z M50 70 q3 5 0 8 q-3 -3 0 -8z M66 64 q3 5 0 8 q-3 -3 0 -8z', '#9CC3FF', 1.8);
  // 가구
  A.u1 = L('M24 84 v7 M76 84 v7', OL, 4) + R(16, 38, 68, 34, 16, '#FFB8C9') + R(10, 56, 80, 28, 14, '#FFCAD7') + R(5, 50, 19, 34, 9.5, '#FFB8C9') + R(76, 50, 19, 34, 9.5, '#FFB8C9') + heart(50, 67, 7, '#FF7FA0', 2);
  A.u2 = L('M28 62 V92 M72 62 V92', OL, 5) + L('M28 62 V92 M72 62 V92', '#D9A57A', 2) + R(26, 10, 48, 42, 14, '#E2B48A') + heart(50, 32, 9, '#FF9EB5', 2.2) + R(18, 52, 64, 12, 6, '#D9A57A');
  A.u3 = L('M14 84 V92 M86 84 V92', OL, 4) + R(6, 22, 22, 64, 10, '#D9A57A') + R(8, 50, 84, 34, 10, '#E2B48A') + R(26, 38, 26, 16, 8, '#FFFFFF') + P('M30 52 H86 Q92 52 92 58 V76 H30Z', '#FFB8C9') + C(48, 62, 2.2, '#FFFFFF', 0) + C(62, 68, 2.2, '#FFFFFF', 0) + C(76, 60, 2.2, '#FFFFFF', 0);
  A.u4 = L('M50 22 L36 6 M50 22 L64 6', OL, 2.4) + C(36, 6, 3, '#FF9EB5', 2) + L('M28 76 L24 90 M72 76 L76 90', OL, 3.4) + R(14, 22, 72, 54, 14, '#9ED9C6') + R(22, 30, 44, 38, 8, '#FFFFFF') + kao(44, 48, 1.2) + C(76, 38, 4, '#FFE07A', 2) + C(76, 52, 4, '#FF9EB5', 2);
  A.u5 = L('M20 76 V92 M80 76 V92', OL, 4) + R(12, 18, 76, 58, 8, '#FFCAD7') + R(36, 24, 28, 18, 2, '#FFFFFF') + T(50, 33, 12, '♪') + R(16, 50, 68, 14, 2, '#FFFFFF') + (function () { var s = ''; [26, 34, 50, 58, 66].forEach(function (x) { s += R(x - 2, 50, 4, 8, 1, OL, 0); }); return s; })();
  A.u6 = P('M14 50 H86 L78 88 Q77 92 72 92 H28 Q23 92 22 88Z', '#E9C08E') + '<path d="M20 62 H80 M22 74 H78 M34 50 L36 92 M50 50 V92 M66 50 L64 92" stroke="#C99A62" stroke-width="2"/>' + E(50, 44, 30, 9, '#FFB8C9') + R(10, 46, 80, 9, 4.5, '#D9A57A');
  A.u7 = R(16, 70, 68, 18, 4, '#9CC3FF') + R(22, 52, 58, 18, 4, '#FFB6C8') + R(18, 34, 62, 18, 4, '#FFE07A') + L('M72 74 H80 M72 82 H80', '#FFFFFF', 2) + C(50, 24, 9, '#FF7F7F') + L('M50 15 q2 -6 6 -6', OL, 2) + P('M50 15 q6 -6 10 -2 q-4 4 -10 2z', '#7ED08B', 1.6);
  A.u8 = R(14, 14, 72, 50, 8, '#E8E3F0') + R(20, 20, 60, 38, 4, '#BFE6FF') + heart(50, 40, 8, '#FF8DA6', 2) + P('M44 64 L40 76 H60 L56 64', '#D6D0E0') + R(18, 80, 64, 10, 4, '#FFFFFF') + L('M26 85 H74', '#D6D0E0', 2);
  A.u9 = R(24, 30, 9, 62, 2, '#F2665E') + R(67, 30, 9, 62, 2, '#F2665E') + R(18, 42, 64, 7, 2, '#F2665E') + R(14, 28, 72, 6, 2, '#F2665E') + R(46, 30, 8, 12, 1, '#F2665E') + P('M6 22 Q50 30 94 22 L92 30 Q50 36 8 30Z', '#5B4249');
  A.u10 = P('M10 90 L50 26 L90 90Z', '#FFFFFF') + P('M50 26 L30 90 H43Z M50 26 L57 90 H70Z', '#FF9EB5', 0) + P('M10 90 L50 26 L90 90Z', 'none') + P('M42 90 Q50 66 58 90Z', '#5B4249', 0) + P('M50 26 V8 L64 13 L50 18', '#FFE07A', 2.2);
  A.u11 = C(30, 38, 7, '#E6F4FF', 2) + C(43, 30, 9, '#E6F4FF', 2) + C(58, 34, 8, '#E6F4FF', 2) + C(70, 40, 6, '#E6F4FF', 2) + C(26, 88, 4, '#FFD45C', 2) + C(74, 88, 4, '#FFD45C', 2) + P('M10 46 H90 Q90 84 66 84 H34 Q10 84 10 46Z', '#FFFFFF') + R(6, 42, 88, 8, 4, '#BFE6FF');
  A.u12 = R(18, 44, 64, 46, 6, '#9ED9C6') + R(14, 32, 72, 16, 5, '#B9E8D8') + R(44, 32, 12, 58, 2, '#FF8DA6') + P('M50 32 C40 14 24 22 34 32Z M50 32 C60 14 76 22 66 32Z', '#FF8DA6');
  // 식물
  A.p1 = P('M50 50 Q33 32 27 44 Q34 56 50 50Z M50 50 Q67 32 73 44 Q66 56 50 50Z', '#8FD49A') + pot('#9ED9C6', '#BDEADB') + kao(50, 76, 1);
  A.p2 = R(20, 30, 12, 20, 6, '#8FD49A') + R(68, 24, 12, 22, 6, '#8FD49A') + P('M38 60 V30 Q38 16 50 16 Q62 16 62 30 V60Z', '#8FD49A') + kao(50, 36, .8) + flower(50, 15, 3, '#FF9EB5', '#FFD45C', 5) + pot('#FFCAA8', '#FFD9C0');
  A.p3 = L('M50 60 V32', '#7CC48A', 4) + E(42, 48, 8, 4, '#8FD49A', 2.2, -30) + E(58, 50, 8, 4, '#8FD49A', 2.2, 30) + flower(50, 24, 10, '#FFE07A', '#B07B52', 10, 2) + kao(50, 24, .6) + pot('#9CC3FF', '#B8D5FF');
  A.p4 = (function () { var tl = function (cx, cy, col) { return L('M' + cx + ' ' + (cy + 2) + ' V60', '#7CC48A', 3) + P('M' + (cx - 7) + ' ' + cy + ' Q' + (cx - 8) + ' ' + (cy - 14) + ' ' + (cx - 3) + ' ' + (cy - 12) + ' L' + cx + ' ' + (cy - 16) + ' L' + (cx + 3) + ' ' + (cy - 12) + ' Q' + (cx + 8) + ' ' + (cy - 14) + ' ' + (cx + 7) + ' ' + cy + ' Q' + cx + ' ' + (cy + 6) + ' ' + (cx - 7) + ' ' + cy + 'Z', col, 2.2); }; return tl(36, 38, '#FF9EB5') + tl(50, 30, '#FFE07A') + tl(64, 38, '#C9B8F5') + pot('#FFFFFF', '#F2EEF6'); })();
  A.p5 = (function () { var tube = function (x, top) { return P('M' + x + ' ' + (top + 8) + ' L' + (x + 12) + ' ' + top + ' V80 H' + x + 'Z', '#8FD49A', 2.4) + P('M' + x + ' ' + (top + 8) + ' L' + (x + 12) + ' ' + top + ' L' + (x + 12) + ' ' + (top + 4) + ' L' + x + ' ' + (top + 12) + 'Z', '#E8F7D4', 1.6); }; return tube(32, 22) + tube(44, 12) + tube(56, 26) + L('M26 60 l-9 -6 M26 66 l-10 0 M74 60 l9 -6 M74 66 l10 0', '#3F8F5B', 3.4) + R(22, 62, 56, 30, 6, '#E2B48A') + R(22, 70, 56, 6, 0, '#C99A62', 0) + R(22, 62, 56, 30, 6, 'none'); })();
  A.p6 = R(46, 46, 8, 18, 2, '#B07B52') + P('M30 50 Q18 48 22 36 Q22 22 36 22 Q40 10 54 12 Q68 12 70 24 Q82 28 78 42 Q78 52 66 52Z', '#8FD49A') + C(40, 32, 3.5, '#FF7F7F', 1.6) + C(60, 26, 3.5, '#FF7F7F', 1.6) + C(58, 42, 3.5, '#FF7F7F', 1.6) + pot('#FFCAD7', '#FFDCE5');
  A.p7 = (function () { var s = L('M50 62 Q48 48 50 34', '#7CC48A', 3.5); [0, 90, 180, 270].forEach(function (a) { s += '<g transform="rotate(' + a + ' 50 30)">' + heart(50, 21, 7.5, '#8FD49A', 2.2) + '</g>'; }); return s + pot('#FFE07A', '#FFEDA8'); })();
  A.p8 = P('M28 40 L50 94 L72 40Z', '#FFE7EC') + flower(38, 34, 6, '#FF9EB5', '#FFD45C', 5) + flower(50, 24, 6, '#FFE07A', '#FF9EB5', 5) + flower(62, 34, 6, '#C9B8F5', '#FFD45C', 5) + flower(50, 42, 6, '#9CC3FF', '#FFFFFF', 5) + P('M50 72 C42 64 36 72 44 76Z M50 72 C58 64 64 72 56 76Z', '#FF6F9A', 2);
  // 장난감
  A.t1 = C(34, 30, 8, '#D9A57A') + C(66, 30, 8, '#D9A57A') + E(50, 72, 18, 17, '#D9A57A') + C(50, 42, 18, '#D9A57A') + E(50, 48, 7, 5, '#F6DCC2', 0) + C(44, 39, 2.2, OL, 0) + C(56, 39, 2.2, OL, 0) + E(50, 46, 2.6, 2, OL, 0) + P('M50 60 l-7 -4 v8z M50 60 l7 -4 v8z', '#FF8DA6', 1.6) + E(36, 80, 5, 4, '#F6DCC2', 0) + E(64, 80, 5, 4, '#F6DCC2', 0);
  A.t2 = L('M50 60 Q72 30 84 40 Q92 48 82 54', OL, 2) + C(50, 60, 24, '#FF9EB5') + C(50, 60, 14, '#FFD1DC', 2) + C(50, 60, 4, '#FFFFFF', 2);
  A.t3 = C(50, 58, 28, '#FFFFFF') + P('M50 49 L58.6 55.2 L55.3 65.3 H44.7 L41.4 55.2Z', '#9CC3FF', 2) + L('M50 49 V31 M58.6 55.2 L76 50 M55.3 65.3 L65 79 M44.7 65.3 L35 79 M41.4 55.2 L24 50', OL, 2);
  A.t4 = C(50, 58, 24, '#DDF27A') + L('M30 44 Q44 58 30 72 M70 44 Q56 58 70 72', '#FFFFFF', 3.2) + C(50, 58, 24, 'none');
  A.t5 = C(50, 58, 24, '#C9B8F5') + L('M30 50 Q50 40 70 52 M28 60 Q50 50 72 62 M32 70 Q50 62 68 72 M40 36 Q36 58 44 80', '#A88FE6', 2.4) + C(50, 58, 24, 'none') + L('M72 70 Q86 80 80 90 Q74 96 88 94', OL, 2.4);
  A.t6 = L('M50 74 Q46 82 52 88 Q58 94 52 100', OL, 2.2) + P('M50 14 L74 44 L50 74 L26 44Z', '#FFB6C8') + L('M50 14 V74 M26 44 H74', '#FF8DA6', 2) + kao(50, 46, .9) + P('M48 84 l-6 -3 v6z M54 90 l6 -3 v6z', '#9CC3FF', 1.6);
  A.t7 = P('M50 22 L78 36 L50 50 L22 36Z', '#FFFFFF') + P('M22 36 L50 50 V82 L22 68Z', '#FFE7EC') + P('M78 36 L50 50 V82 L78 68Z', '#FFD1DC') + C(50, 36, 3.4, '#FF6F8E', 0) + C(31, 52, 2.8, OL, 0) + C(41, 66, 2.8, OL, 0) + C(70, 48, 2.6, OL, 0) + C(64, 59, 2.6, OL, 0) + C(58, 70, 2.6, OL, 0);
  A.t8 = C(30, 20, 6, '#FFFFFF', 2) + C(40, 12, 4, '#FFFFFF', 2) + R(24, 30, 10, 16, 3, '#FFE07A') + R(16, 46, 50, 28, 6, '#9CC3FF') + R(48, 30, 30, 44, 6, '#FF9EB5') + R(54, 36, 18, 14, 4, '#FFFFFF') + kao(34, 58, .9) + C(30, 78, 8, OL, 0) + C(64, 78, 8, OL, 0) + C(30, 78, 3, '#FFFFFF', 0) + C(64, 78, 3, '#FFFFFF', 0);
  A.t9 = E(50, 56, 28, 32, '#FF6F6F') + E(50, 46, 17, 15, '#FFF8EC', 2.2) + C(44, 46, 3.2, OL, 0) + C(56, 46, 3.2, OL, 0) + L('M38 38 q3 -3 6 -1 M62 38 q-3 -3 -6 -1', OL, 2.2) + L('M47 53 Q50 55 53 53', OL, 2) + L('M40 72 Q50 64 60 72', '#FFD45C', 3) + L('M36 80 Q50 86 64 80', '#FFD45C', 3);
  A.t10 = R(16, 28, 68, 50, 16, '#C9B8F5') + R(32, 36, 36, 26, 4, '#E1F5E9') + kao(50, 47, .9) + L('M22 52 h8 M26 48 v8', OL, 3) + C(76, 48, 3.4, '#FF8DA6', 1.8) + C(76, 58, 3.4, '#FFE07A', 1.8);
  // 간식
  A.k1 = P('M50 22 Q56 22 60 30 L80 66 Q86 80 72 82 H28 Q14 80 20 66 L40 30 Q44 22 50 22Z', '#FFFFFF') + R(38, 64, 24, 18, 2, '#3E4A44', 0) + kao(50, 50, 1.1);
  A.k2 = L('M50 95 V10', OL, 7) + L('M50 95 V10', '#E2BE8A', 3.4) + C(50, 28, 13, '#FFB6C8') + C(50, 51, 13, '#FFFFFF') + C(50, 74, 13, '#A8DDA0') + kao(50, 27, .8);
  A.k3 = R(22, 50, 56, 28, 12, '#FFFFFF') + P('M18 50 Q30 34 50 38 Q70 34 84 46 Q80 56 50 54 Q24 56 18 50Z', '#FFA77F') + L('M34 42 Q36 48 32 54 M50 40 Q52 47 48 54 M66 41 Q68 47 64 53', '#FFFFFF', 2.4) + kao(50, 66, .9);
  A.k4 = R(20, 46, 60, 40, 6, '#FFF3D6') + R(20, 62, 60, 4, 0, '#FF8DA6', 0) + P('M20 52 Q20 40 30 40 H70 Q80 40 80 52Z', '#FFFFFF') + R(20, 46, 60, 40, 6, 'none') + P('M50 36 Q40 32 42 24 Q46 18 50 22 Q54 18 58 24 Q60 32 50 36Z', '#FF6B81', 2.2) + P('M46 20 L50 15 L54 20Z', '#7ED08B', 1.6);
  A.k5 = '<path d="M22 56 A28 28 0 1 0 78 56 A28 28 0 1 0 22 56Z M41 56 A9 9 0 1 1 59 56 A9 9 0 1 1 41 56Z" fill-rule="evenodd" fill="#E8B47A"' + S() + '/>' + '<path d="M26 52 A24 24 0 0 1 74 52 Q72 60 66 56 Q60 62 54 56 A9 9 0 0 0 46 56 Q40 62 34 56 Q28 60 26 52Z" fill="#FFB6C8"/>' + L('M34 42 l3 2 M48 36 l-2 3 M62 40 l3 -1 M70 50 l-1 3 M30 50 l2 -2', '#FFFFFF', 2.2) + L('M40 46 l2 2 M56 44 l3 0', '#9CC3FF', 2.2);
  A.k6 = E(50, 84, 32, 7, '#FFFFFF') + P('M28 82 L34 46 Q50 40 66 46 L72 82 Q50 88 28 82Z', '#FFE08A') + P('M34 46 Q50 40 66 46 L67 54 Q58 58 50 54 Q42 58 33 54Z', '#C9874E', 2.2) + C(50, 36, 6, '#FF6B81') + L('M50 30 q2 -6 6 -8', OL, 2) + kao(50, 68, .9);
  A.k7 = P('M50 88 Q22 74 24 46 Q26 32 50 34 Q74 32 76 46 Q78 74 50 88Z', '#FF6B81') + P('M36 36 L44 26 L50 34 L56 26 L64 36 L50 40Z', '#7ED08B', 2.2) + E(36, 50, 1.6, 2.4, '#FFF0B3', 0) + E(64, 50, 1.6, 2.4, '#FFF0B3', 0) + E(40, 72, 1.6, 2.4, '#FFF0B3', 0) + E(60, 72, 1.6, 2.4, '#FFF0B3', 0) + kao(50, 58, 1);
  A.k8 = L('M42 30 Q38 22 44 16 M56 30 Q52 22 58 16', '#C9C3D6', 3) + P('M24 40 H76 L70 80 Q68 88 60 88 H40 Q32 88 30 80Z', '#FFFFFF') + E(50, 40, 26, 6, '#A8D67F') + L('M32 62 Q37 56 42 62 Q47 68 52 62 Q57 56 62 62 Q65 66 68 62', '#7CC48A', 2.4);
  A.k9 = P('M30 36 L39 22 H61 L70 36Z', '#FFB6C8') + R(30, 36, 40, 54, 5, '#FFFFFF') + R(31, 80, 38, 9, 0, '#FFE1E9', 0) + heart(50, 62, 9, '#FF6B81', 2) + P('M46 52 L50 47 L54 52Z', '#7ED08B', 1.8) + R(30, 36, 40, 54, 5, 'none');
  A.k10 = P('M14 56 Q24 34 54 36 Q72 36 80 46 L92 36 Q90 56 92 74 L80 64 Q72 76 52 76 Q24 76 14 56Z', '#E9B26F') + C(32, 50, 3, OL, 0) + E(30, 58, 4, 2.4, '#FF9EB5', 0) + L('M46 50 q4 4 0 8 M56 48 q4 4 0 8 M66 50 q4 4 0 8 M51 60 q4 4 0 8 M61 60 q4 4 0 8', '#C98A4A', 2) + L('M18 60 q3 2 6 0', OL, 2);
  // 러그 (펫 발밑)
  A.r1 = L('M8 62 h-5 M8 56 h-5 M8 68 h-5 M92 62 h5 M92 56 h5 M92 68 h5', OL, 2.2) + E(50, 62, 43, 21, '#CDB8F5') + E(50, 62, 32, 14.5, '#E3D7FA', 0) + E(50, 62, 18, 7.5, '#F7C9D9', 0);
  A.r2 = E(50, 62, 44, 20, '#FF8E9E') + P('M38 44 L44 38 L50 44 L56 38 L62 44 L50 48Z', '#7ED08B', 2) + (function () { var s = ''; [[24, 60], [36, 70], [50, 58], [64, 70], [76, 60], [42, 54], [58, 54], [50, 74]].forEach(function (p) { s += E(p[0], p[1], 1.6, 2.6, '#FFF0B3', 0); }); return s; })();
  A.r3 = '<g transform="translate(0 26) scale(1 .62)">' + heart(50, 60, 28, '#FFB6C8', 3) + heart(50, 60, 16, '#FFD1DC', 0) + '</g>';
  A.r4 = P('M14 72 Q2 72 6 60 Q8 48 22 52 Q26 40 42 44 Q50 36 62 42 Q76 38 80 50 Q96 50 94 62 Q94 74 82 74Z', '#DDEFFF') + C(32, 62, 2.5, '#FFFFFF', 0) + C(56, 56, 3, '#FFFFFF', 0) + C(72, 64, 2.5, '#FFFFFF', 0);
  A.r5 = E(50, 62, 44, 20, '#FF9EB5') + E(50, 62, 35, 15.5, '#FFE07A', 0) + E(50, 62, 26, 11, '#A8DDA0', 0) + E(50, 62, 16, 6.5, '#9CC3FF', 0);
  A.r6 = (function () { var s = ''; for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; s += E(f1(50 + Math.cos(a) * 26), f1(62 + Math.sin(a) * 11), 17, 9, '#FFE07A', 2.4); } return s + E(50, 62, 16, 8, '#FFB6C8', 2.4); })();
  A.r7 = P('M18 72 Q14 58 26 46 Q50 40 82 46 Q90 58 84 72 Q50 80 18 72Z', '#C9B8F5') + L('M18 72 l-5 4 M84 72 l5 4 M26 46 l-4 -4 M82 46 l4 -4', '#FFD45C', 3) + C(50, 59, 2.6, '#FFFFFF', 1.6);
  A.r8 = P('M8 48 Q50 92 92 48Z', '#7ED08B') + P('M14 48 Q50 84 86 48Z', '#FFFFFF', 0) + P('M18 48 Q50 80 82 48Z', '#FF7F8E', 0) + P('M8 48 Q50 92 92 48Z', 'none') + E(36, 56, 1.6, 2.6, OL, 0) + E(50, 62, 1.6, 2.6, OL, 0) + E(64, 56, 1.6, 2.6, OL, 0) + E(44, 52, 1.6, 2.6, OL, 0) + E(58, 52, 1.6, 2.6, OL, 0);

  // ---------- 아이템 목록 ----------
  var I = [];
  function add(slot, list) { list.forEach(function (x) { I.push({ id: x[0], slot: slot, name: x[1], price: x[2], bg: x[3] }); }); }
  add('wallpaper', [
    ['w1', '기본 벽지', 0, '#FDF0F3'],
    ['w2', '딸기우유 줄무늬', 15, 'repeating-linear-gradient(90deg,#FFE1E9 0 18px,#FFF4F7 18px 36px)'],
    ['w3', '맑은 하늘', 20, 'radial-gradient(ellipse 60px 22px at 30% 30%,#FFFFFF 60%,transparent 62%),radial-gradient(ellipse 50px 18px at 75% 55%,#FFFFFF 60%,transparent 62%),linear-gradient(#BFE3FF,#EAF6FF)'],
    ['w4', '민트 도트', 20, 'radial-gradient(#BDE8D3 4px,transparent 4.5px) 0 0/24px 24px,#EFFAF4'],
    ['w5', '레몬 체크', 25, 'linear-gradient(90deg,rgba(255,206,80,.3) 50%,transparent 0) 0 0/28px 28px,linear-gradient(rgba(255,206,80,.3) 50%,transparent 0) 0 0/28px 28px,#FFFBEA'],
    ['w6', '라벤더 바둑판', 25, 'conic-gradient(#E7DCFF 25%,#F6F1FF 0 50%,#E7DCFF 0 75%,#F6F1FF 0) 0 0/30px 30px'],
    ['w7', '장지문 (和室)', 30, 'linear-gradient(90deg,#C9B48E 3px,transparent 3px) 0 0/44px 44px,linear-gradient(#C9B48E 3px,transparent 3px) 0 0/44px 44px,#FBF6EA'],
    ['w8', '벚꽃 흩날림', 35, 'radial-gradient(circle at 20% 30%,#FFC2D1 0 6px,transparent 7px) 0 0/54px 54px,radial-gradient(circle at 70% 75%,#FFD9E3 0 4px,transparent 5px) 0 0/54px 54px,#FFF0F4'],
    ['w9', '노을', 35, 'linear-gradient(#FFAE8A,#FFD3A6 60%,#FFF0D6)'],
    ['w10', '별이 빛나는 밤', 45, 'radial-gradient(#FFFFFF 1.3px,transparent 1.8px) 0 0/28px 28px,radial-gradient(#FFE58A 1.2px,transparent 1.7px) 14px 14px/28px 28px,linear-gradient(#2B2F5C,#4D5196)'],
    ['w11', '민트 줄무늬', 15, 'repeating-linear-gradient(90deg,#DDF5EA 0 16px,#F2FBF6 16px 32px)'],
    ['w12', '구름 무늬', 25, 'radial-gradient(ellipse 22px 12px at 30% 40%,#FFFFFF 70%,transparent 72%) 0 0/70px 50px,radial-gradient(ellipse 16px 9px at 75% 75%,#FFFFFF 70%,transparent 72%) 0 0/70px 50px,#DCEEFF']
  ]);
  add('floor', [
    ['f1', '기본 바닥', 0, '#F1D9C0'],
    ['f2', '나무 마루', 15, 'repeating-linear-gradient(90deg,#DCAB79 0 30px,#C9965F 30px 32px)'],
    ['f3', '다다미', 25, 'repeating-linear-gradient(0deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px),repeating-linear-gradient(90deg,#D3DFA5 0 70px,#8AA35B 70px 73px)'],
    ['f4', '딸기 체크 타일', 20, 'conic-gradient(#FFFFFF 25%,#F7C7D3 0 50%,#FFFFFF 0 75%,#F7C7D3 0) 0 0/34px 34px'],
    ['f5', '민트 카펫', 20, 'radial-gradient(#A8DCC2 3px,transparent 3.5px) 0 0/18px 18px,#C9EEDB'],
    ['f6', '구름 카펫', 25, 'radial-gradient(circle,#FFFFFF 10px,transparent 11px) 0 0/40px 40px,#D6EAFF'],
    ['f7', '대리석', 30, 'linear-gradient(135deg,#F8F8FA 0%,#E6E8EF 45%,#F5F5F8 55%,#E2E4EC 100%)'],
    ['f8', '잔디밭', 30, 'repeating-linear-gradient(100deg,#A3D581 0 6px,#8FC86E 6px 11px)'],
    ['f9', '모래사장', 30, 'radial-gradient(#E9CF97 1.5px,transparent 2px) 0 0/12px 12px,#F7E4B8'],
    ['f10', '보라 줄무늬', 40, 'repeating-linear-gradient(90deg,#D9C7F5 0 20px,#E9DEFA 20px 40px)'],
    ['f11', '초코 마루', 20, 'repeating-linear-gradient(90deg,#B98A66 0 26px,#A57653 26px 28px)'],
    ['f12', '하늘 체크', 20, 'conic-gradient(#FFFFFF 25%,#CFE6FF 0 50%,#FFFFFF 0 75%,#CFE6FF 0) 0 0/30px 30px']
  ]);
  add('rug', [['r1', '동글 러그', 15], ['r2', '딸기 러그', 20], ['r3', '하트 러그', 25], ['r4', '구름 러그', 25], ['r5', '무지개 러그', 30], ['r6', '꽃 러그', 30], ['r7', '방석 (座布団)', 20], ['r8', '수박 러그', 25]]);
  add('deco', [['d1', '풍경화 액자', 15], ['d2', '괘종시계', 25], ['d3', '하트 거울', 20], ['d4', '달력', 10], ['d5', '후지산 그림', 30], ['d6', '무지개 스티커', 20], ['d7', '다트판', 20], ['d8', '구름 창문', 30], ['d9', '족자 (夢)', 25], ['d10', '잉어 깃발 (鯉のぼり)', 35]]);
  add('ceil', [['c1', '방긋 전구', 10], ['c2', '초롱 (提灯)', 25], ['c3', '풍경 (風鈴)', 25], ['c4', '풍선', 15], ['c5', '별 모빌', 20], ['c6', '잠자는 달 모빌', 20], ['c7', '미러볼', 40], ['c8', '비구름 모빌', 20]]);
  add('furn', [['u1', '폭신 쿠션 소파', 40], ['u2', '하트 의자', 20], ['u3', '침대', 50], ['u4', '레트로 TV', 45], ['u5', '피아노', 60], ['u6', '쿠션 바구니', 15], ['u7', '책 더미', 20], ['u8', '컴퓨터', 50], ['u9', '작은 도리이 (鳥居)', 70], ['u10', '서커스 텐트', 60], ['u11', '거품 욕조', 55], ['u12', '선물 상자', 30]]);
  add('plant', [['p1', '방긋 새싹 화분', 10], ['p2', '선인장', 12], ['p3', '해바라기', 15], ['p4', '튤립', 15], ['p5', '가도마츠 (門松)', 30], ['p6', '사과나무', 25], ['p7', '네잎클로버', 20], ['p8', '꽃다발', 20]]);
  add('toy', [['t1', '곰 인형', 20], ['t2', '요요', 10], ['t3', '축구공', 10], ['t4', '테니스공', 10], ['t5', '털실 뭉치', 12], ['t6', '연', 15], ['t7', '주사위', 10], ['t8', '장난감 기차', 25], ['t9', '다루마 (だるま)', 25], ['t10', '게임기', 40]]);
  add('food', [['k1', '주먹밥 (おにぎり)', 5], ['k2', '삼색 당고 (だんご)', 8], ['k3', '연어 초밥 (すし)', 15], ['k4', '딸기 케이크', 12], ['k5', '딸기 도넛', 8], ['k6', '푸딩 (プリン)', 10], ['k7', '방긋 딸기', 5], ['k8', '녹차 (お茶)', 8], ['k9', '딸기 우유', 10], ['k10', '붕어빵 (たい焼き)', 12]]);
  add('hat', [['h1', '분홍 리본', 15], ['h2', '왕관', 60], ['h3', '실크햇', 40], ['h4', '야구모자', 25], ['h5', '밀짚모자', 35], ['h6', '학사모', 45], ['h7', '벚꽃 핀', 15], ['h8', '해바라기 핀', 15], ['h9', '별 핀', 20], ['h10', '딸기 핀', 15], ['h11', '딸기 모자', 40], ['h12', '꽃 화관', 45]]);
  add('face', [['e1', '동그란 안경', 25], ['e2', '선글라스', 35], ['e3', '수영 고글', 30], ['e4', '반창고', 10], ['e5', '하트 볼터치', 15], ['e6', '반짝이', 15], ['e7', '꽃 스티커', 15], ['e8', '하트 안경', 35]]);
  add('neck', [['n1', '목도리', 25], ['n2', '나비 리본', 15], ['n3', '방울 목걸이', 15], ['n4', '진주 목걸이', 30], ['n5', '금메달', 45], ['n6', '보석 목걸이', 70], ['n7', '꽃 목걸이', 25], ['n8', '턱받이', 15]]);
  add('clothes', [['o1', '앞치마', 25], ['o2', '멜빵바지', 35], ['o3', '줄무늬 티', 20], ['o4', '기모노 (着物)', 60], ['o5', '축구 유니폼', 35], ['o6', '노란 우비', 30], ['o7', '턱시도', 50], ['o8', '체크 셔츠', 25]]);
  add('back', [['b1', '천사 날개', 60], ['b2', '나비 날개', 50], ['b3', '작은 가방', 30], ['b4', '풍선 두 개', 25], ['b5', '빨간 망토', 40], ['b6', '박쥐 날개', 45]]);

  function itemSVG(it) { return A[it.id] ? '<svg viewBox="0 0 100 100" aria-hidden="true">' + A[it.id] + '</svg>' : ''; }

  var SLOTS = [
    ['pet', '펫'], ['wallpaper', '벽지'], ['floor', '바닥'], ['rug', '러그'], ['deco', '벽 장식'], ['ceil', '천장'], ['furn', '가구'],
    ['plant', '식물'], ['toy', '장난감'], ['food', '간식'], ['hat', '펫 머리'], ['face', '펫 얼굴'], ['neck', '펫 목'], ['clothes', '펫 옷'], ['back', '펫 등']
  ];

  window.SHOP = { PETS: PETS, ITEMS: I, SLOTS: SLOTS, PET_SLOTS: PET_SLOTS, petSVG: petSVG, itemSVG: itemSVG };
})();
