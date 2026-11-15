// 새 스타일 펫 (시안): 찹쌀떡처럼 동글동글한 몸, 큰 반짝이 눈, 아래쪽에 모인 얼굴, 부드러운 코코아색 외곽선.
(function () {
  var OL = '#5B4249';
  var BODY = 'M60 34 C89 34 107 54 107 78 C107 99 88 109 60 109 C32 109 13 99 13 78 C13 54 31 34 60 34Z';
  function S(w) { return ' stroke="' + OL + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function mir(d) { return d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, function (m, x, y) { return (120 - +x) + ' ' + y; }); }
  function path(d, fill, w) { return '<path d="' + d + '" fill="' + fill + '"' + (w === 0 ? '' : S(w)) + '/>'; }

  var PETS = {
    cat:     { name: '{猫|ねこ}', ko: '고양이', body: '#FFD2A1', light: '#FFF1DF', dark: '#F2A766' },
    rabbit:  { name: 'うさぎ',     ko: '토끼',   body: '#FFFFFF', light: '#FFFFFF', dark: '#F6DCE4' },
    bear:    { name: '{熊|くま}', ko: '곰',     body: '#D9A57A', light: '#F6DCC2', dark: '#B07B52' },
    penguin: { name: 'ペンギン',   ko: '펭귄',   body: '#6E83B8', light: '#FFFFFF', dark: '#4F639A' },
    chick:   { name: 'ひよこ',     ko: '병아리', body: '#FFE590', light: '#FFF6CF', dark: '#F7C64F' }
  };
  var HAT_Y = { cat: 34, rabbit: 32, bear: 34, penguin: 35, chick: 34 };

  function face(id, f, c) {
    var E = [[45, 77], [75, 77]], s = '', my = id === 'bear' ? 90 : 85;
    if (f === 'happy') {
      E.forEach(function (e) { s += '<path d="M' + (e[0] - 6) + ' ' + (e[1] + 2) + ' Q' + e[0] + ' ' + (e[1] - 7) + ' ' + (e[0] + 6) + ' ' + (e[1] + 2) + '" fill="none"' + S(3.4) + '/>'; });
    } else if (f === 'sad') {
      E.forEach(function (e) { s += '<path d="M' + (e[0] - 5.5) + ' ' + (e[1] - 1) + ' Q' + e[0] + ' ' + (e[1] + 5) + ' ' + (e[0] + 5.5) + ' ' + (e[1] - 1) + '" fill="none"' + S(3.2) + '/>'; });
      s += '<path d="M39 67 L50 69.5 M81 67 L70 69.5" fill="none"' + S(2.6) + '/>';
      s += '<path d="M83 82 q4 6 0 9.5 q-4 -3.5 0 -9.5z" fill="#9CC3FF"/>';
    } else {
      E.forEach(function (e) {
        s += '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="5.4" ry="6.6" fill="' + OL + '"/>' +
             '<circle cx="' + (e[0] + 1.8) + '" cy="' + (e[1] - 2.6) + '" r="2.2" fill="#FFFFFF"/>' +
             '<circle cx="' + (e[0] - 1.6) + '" cy="' + (e[1] + 2.4) + '" r="1.1" fill="#FFFFFF"/>';
      });
    }
    if (id === 'penguin' || id === 'chick') {
      s += f === 'happy'
        ? '<path d="M54 81 Q60 77 66 81 Z" fill="#FFA94D"' + S(2.2) + '/><path d="M55 83 Q60 90 65 83 Z" fill="#FF8E8E"' + S(2.2) + '/>'
        : '<path d="M54 81.5 Q60 77.5 66 81.5 Q60 89 54 81.5Z" fill="#FFA94D"' + S(2.2) + '/>';
    } else {
      s += f === 'happy'
        ? '<path d="M54 ' + (my - 1) + ' Q60 ' + (my - 1) + ' 66 ' + (my - 1) + ' Q65 ' + (my + 8) + ' 60 ' + (my + 8) + ' Q55 ' + (my + 8) + ' 54 ' + (my - 1) + 'Z" fill="#F06E8C"' + S(2.4) + '/>'
        : f === 'sad'
          ? '<path d="M55 ' + (my + 3) + ' Q60 ' + (my - 1.5) + ' 65 ' + (my + 3) + '" fill="none"' + S(2.6) + '/>'
          : '<path d="M55 ' + my + ' Q57.5 ' + (my + 3.2) + ' 60 ' + my + ' Q62.5 ' + (my + 3.2) + ' 65 ' + my + '" fill="none"' + S(2.6) + '/>';
    }
    return s;
  }

  // 새 소품 (그림으로 직접 그린 것: 어느 휴대폰에서나 똑같이 보임)
  var ACC = {
    ribbon: function (id) { // 머리 리본
      var y = HAT_Y[id];
      return '<g transform="translate(' + (id === 'cat' ? 40 : 60) + ' ' + y + ') rotate(' + (id === 'cat' ? -18 : 0) + ')">' +
        '<path d="M0 0 C-6 -11 -21 -11 -19 0 C-21 11 -6 11 0 0Z" fill="#FF94B4"' + S(2.6) + '/>' +
        '<path d="M0 0 C6 -11 21 -11 19 0 C21 11 6 11 0 0Z" fill="#FF94B4"' + S(2.6) + '/>' +
        '<circle r="4.8" fill="#FF6F9A"' + S(2.4) + '/></g>';
    },
    crown: function (id) { // 꽃 화관
      var y = HAT_Y[id] + 4, cols = ['#FFB3C7', '#FFE38A', '#B8E3FF', '#FFB3C7', '#C9F0B8'], s = '';
      [[34, y + 6], [46, y], [60, y - 2], [74, y], [86, y + 6]].forEach(function (p, i) {
        for (var k = 0; k < 5; k++) { var a = k * 72 * Math.PI / 180; s += '<circle cx="' + (p[0] + Math.cos(a) * 4).toFixed(1) + '" cy="' + (p[1] + Math.sin(a) * 4).toFixed(1) + '" r="3.4" fill="' + cols[i] + '"' + S(1.6) + '/>'; }
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.4" fill="#FFD45C"/>';
      });
      return '<path d="M30 ' + (y + 10) + ' Q60 ' + (y - 10) + ' 90 ' + (y + 10) + '" fill="none" stroke="#7CC48A" stroke-width="2.6" stroke-linecap="round"/>' + s;
    },
    bell: function () { // 방울 목걸이
      return '<path d="M27 95 Q60 109 93 95" fill="none" stroke="' + OL + '" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M27 95 Q60 109 93 95" fill="none" stroke="#FF7C9C" stroke-width="5" stroke-linecap="round"/>' +
        '<circle cx="60" cy="106" r="6.5" fill="#FFD45C"' + S(2.4) + '/><path d="M57 107.5 H63" fill="none"' + S(1.8) + '/>';
    },
    glasses: function () { // 동그란 안경
      return '<circle cx="45" cy="77" r="11" fill="#FFFFFF" fill-opacity=".25"' + S(2.8) + '/><circle cx="75" cy="77" r="11" fill="#FFFFFF" fill-opacity=".25"' + S(2.8) + '/><path d="M56 76 Q60 73 64 76" fill="none"' + S(2.6) + '/>';
    },
    berry: function (id) { // 딸기 모자
      var y = HAT_Y[id];
      return '<g transform="translate(60 ' + y + ')"><path d="M-21 5 Q-22 -21 0 -21 Q22 -21 21 5 Q0 10 -21 5Z" fill="#FF6B81"' + S(2.8) + '/>' +
        '<ellipse cx="-10" cy="-8" rx="1.6" ry="2.4" fill="#FFF0B3"/><ellipse cx="0" cy="-13" rx="1.6" ry="2.4" fill="#FFF0B3"/><ellipse cx="10" cy="-8" rx="1.6" ry="2.4" fill="#FFF0B3"/><ellipse cx="-4" cy="-2" rx="1.6" ry="2.4" fill="#FFF0B3"/><ellipse cx="7" cy="-1" rx="1.6" ry="2.4" fill="#FFF0B3"/>' +
        '<path d="M-10 -20 L-3 -24 L0 -30 L3 -24 L10 -20 L3 -18 L0 -16 L-3 -18Z" fill="#7ED08B"' + S(2.2) + '/></g>';
    }
  };

  function pet2(id, f, acc) {
    var c = PETS[id], back = '', front = '', feet = '';
    var paws = '<ellipse cx="45" cy="105" rx="9.5" ry="6.5" fill="' + c.body + '"' + S(2.8) + '/><ellipse cx="75" cy="105" rx="9.5" ry="6.5" fill="' + c.body + '"' + S(2.8) + '/>';
    switch (id) {
      case 'cat':
        var tail = 'M97 98 Q119 94 113 70';
        back = '<path d="' + tail + '" fill="none" stroke="' + OL + '" stroke-width="15" stroke-linecap="round"/><path d="' + tail + '" fill="none" stroke="' + c.body + '" stroke-width="9" stroke-linecap="round"/>';
        var ear = 'M20 64 Q15 30 31 22 Q45 28 57 41 Z', inner = 'M27 53 Q25 35 32 31 Q40 35 47 42 Z';
        back += path(ear, c.body) + path(mir(ear), c.body) + path(inner, '#FFB8C8', 0) + path(mir(inner), '#FFB8C8', 0);
        front = '<path d="M53 43 q2 5 1 9 M60 40 v10 M67 43 q-2 5 -1 9" fill="none" stroke="' + c.dark + '" stroke-width="3.4" stroke-linecap="round"/><path d="M57.5 81 h5 l-2.5 2.8z" fill="#F38FA6"/>';
        break;
      case 'rabbit':
        back = '<ellipse cx="43" cy="24" rx="11" ry="25" transform="rotate(-12 43 24)" fill="' + c.body + '"' + S() + '/><ellipse cx="79" cy="26" rx="11" ry="25" transform="rotate(16 79 26)" fill="' + c.body + '"' + S() + '/>' +
          '<ellipse cx="43" cy="26" rx="5" ry="16" transform="rotate(-12 43 26)" fill="#FFC6D4"/><ellipse cx="79" cy="28" rx="5" ry="16" transform="rotate(16 79 28)" fill="#FFC6D4"/>';
        front = '<ellipse cx="60" cy="81.5" rx="3.2" ry="2.4" fill="#F38FA6"/>';
        break;
      case 'bear':
        back = '<circle cx="29" cy="45" r="14" fill="' + c.body + '"' + S() + '/><circle cx="91" cy="45" r="14" fill="' + c.body + '"' + S() + '/><circle cx="29" cy="45" r="7" fill="' + c.light + '"/><circle cx="91" cy="45" r="7" fill="' + c.light + '"/>';
        front = '<ellipse cx="60" cy="88" rx="16" ry="11" fill="' + c.light + '"/><path d="M55 82 Q60 79 65 82 Q63 86.5 60 86.5 Q57 86.5 55 82Z" fill="' + OL + '"/>';
        break;
      case 'penguin':
        back = '<ellipse cx="16" cy="84" rx="8" ry="16" transform="rotate(25 16 84)" fill="' + c.dark + '"' + S() + '/><ellipse cx="104" cy="84" rx="8" ry="16" transform="rotate(-25 104 84)" fill="' + c.dark + '"' + S() + '/>';
        front = '<path d="M60 54 C70 45 93 50 95 73 C97 94 81 106 60 106 C39 106 23 94 25 73 C27 50 50 45 60 54Z" fill="#FFFFFF"/>';
        paws = '<ellipse cx="45" cy="107" rx="10" ry="5" fill="#FFA94D"' + S(2.6) + '/><ellipse cx="75" cy="107" rx="10" ry="5" fill="#FFA94D"' + S(2.6) + '/>';
        break;
      case 'chick':
        back = '<ellipse cx="16" cy="82" rx="8" ry="13" transform="rotate(30 16 82)" fill="' + c.dark + '"' + S() + '/><ellipse cx="104" cy="82" rx="8" ry="13" transform="rotate(-30 104 82)" fill="' + c.dark + '"' + S() + '/>';
        front = '<path d="M54 37 Q50 24 59 28 Q61 17 68 31" fill="none"' + S(3) + '/>';
        paws = '<path d="M40 107 h10 M45 107 v-4 M70 107 h10 M75 107 v-4" fill="none" stroke="#FFA94D" stroke-width="4" stroke-linecap="round"/>';
        break;
    }
    var gloss = '<ellipse cx="37" cy="51" rx="9" ry="4.5" transform="rotate(-32 37 51)" fill="#FFFFFF" opacity=".6"/>';
    var belly = id === 'cat' || id === 'chick' ? '<ellipse cx="60" cy="97" rx="22" ry="9" fill="' + c.light + '"/>' : '';
    var cheeks = '<ellipse cx="31" cy="87" rx="8.5" ry="5" fill="#FF9EB5" opacity=".7"/><ellipse cx="89" cy="87" rx="8.5" ry="5" fill="#FF9EB5" opacity=".7"/>';
    var a = '', top = '';
    (acc || []).forEach(function (k) { if (k === 'ribbon' || k === 'berry' || k === 'crown') top += ACC[k](id); else a += ACC[k](id); });
    return '<svg viewBox="-4 -6 128 124" aria-hidden="true">' + back + '<path d="' + BODY + '" fill="' + c.body + '"' + S() + '/>' + belly + front + gloss + paws + cheeks + face(id, f || 'smile', c) + a + top + '</svg>';
  }

  // 새 방 소품 시안 8개
  var o = function (w) { return S(w || 2.8); };
  function star(cx, cy, r, fill) {
    var p = ''; for (var i = 0; i < 10; i++) { var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .5 : r; p += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
    return '<path d="' + p + 'Z" fill="' + fill + '"' + o(2.2) + '/>';
  }
  var ITEMS = [
    ['폭신 쿠션 소파', '<path d="M24 84 v7 M76 84 v7" fill="none"' + o(4) + '/><rect x="16" y="38" width="68" height="34" rx="16" fill="#FFB8C9"' + o() + '/><rect x="10" y="56" width="80" height="28" rx="14" fill="#FFCAD7"' + o() + '/><rect x="5" y="50" width="19" height="34" rx="9.5" fill="#FFB8C9"' + o() + '/><rect x="76" y="50" width="19" height="34" rx="9.5" fill="#FFB8C9"' + o() + '/><path d="M50 66 C44 58 36 64 42 70 L50 76 L58 70 C64 64 56 58 50 66Z" fill="#FF7FA0"' + o(2) + '/>'],
    ['방긋 새싹 화분', '<path d="M50 46 Q33 28 27 40 Q34 52 50 46Z M50 46 Q67 28 73 40 Q66 52 50 46Z" fill="#8FD49A"' + o() + '/><path d="M24 50 H76 L70 86 Q69 91 64 91 H36 Q31 91 30 86Z" fill="#9ED9C6"' + o() + '/><rect x="19" y="44" width="62" height="13" rx="6.5" fill="#BDEADB"' + o() + '/><circle cx="42" cy="69" r="2.8" fill="#5B4249"/><circle cx="58" cy="69" r="2.8" fill="#5B4249"/><path d="M46 75 Q50 78.5 54 75" fill="none"' + o(2.4) + '/><ellipse cx="36" cy="76" rx="4" ry="2.4" fill="#FF9EB5" opacity=".7"/><ellipse cx="64" cy="76" rx="4" ry="2.4" fill="#FF9EB5" opacity=".7"/>'],
    ['삼색 당고', '<path d="M50 95 V10" fill="none" stroke="#5B4249" stroke-width="7" stroke-linecap="round"/><path d="M50 95 V10" fill="none" stroke="#E2BE8A" stroke-width="3.4" stroke-linecap="round"/><circle cx="50" cy="28" r="13" fill="#FFB6C8"' + o() + '/><circle cx="50" cy="51" r="13" fill="#FFFFFF"' + o() + '/><circle cx="50" cy="74" r="13" fill="#A8DDA0"' + o() + '/><circle cx="45.5" cy="27" r="1.8" fill="#5B4249"/><circle cx="54.5" cy="27" r="1.8" fill="#5B4249"/><path d="M48 31 Q50 33 52 31" fill="none"' + o(1.8) + '/>'],
    ['꿈나라 구름 램프', '<circle cx="50" cy="58" r="40" fill="#FFF3B0" opacity=".55"/><path d="M50 36 V4" fill="none"' + o(2.2) + '/><path d="M28 70 Q14 70 16 57 Q18 46 31 48 Q35 34 51 36 Q66 34 70 48 Q85 46 85 60 Q85 70 72 70 Z" fill="#FFFFFF"' + o() + '/><path d="M38 57 Q42 61 46 57 M54 57 Q58 61 62 57" fill="none"' + o(2.4) + '/><ellipse cx="35" cy="63" rx="4" ry="2.4" fill="#FF9EB5" opacity=".7"/><ellipse cx="65" cy="63" rx="4" ry="2.4" fill="#FF9EB5" opacity=".7"/>'],
    ['동글 러그', '<path d="M8 62 h-5 M8 56 h-5 M8 68 h-5 M92 62 h5 M92 56 h5 M92 68 h5" fill="none"' + o(2.2) + '/><ellipse cx="50" cy="62" rx="43" ry="21" fill="#CDB8F5"' + o() + '/><ellipse cx="50" cy="62" rx="32" ry="14.5" fill="#E3D7FA"/><ellipse cx="50" cy="62" rx="18" ry="7.5" fill="#F7C9D9"/>'],
    ['딸기 우유', '<path d="M30 36 L39 22 H61 L70 36Z" fill="#FFB6C8"' + o() + '/><rect x="30" y="36" width="40" height="54" rx="5" fill="#FFFFFF"' + o() + '/><path d="M50 58 C43 50 36 58 42 66 L50 74 L58 66 C64 58 57 50 50 58Z" fill="#FF6B81"' + o(2) + '/><path d="M46 52 L50 47 L54 52Z" fill="#7ED08B"' + o(1.8) + '/><rect x="30" y="80" width="40" height="10" rx="0" fill="#FFE1E9"/><rect x="30" y="36" width="40" height="54" rx="5" fill="none"' + o() + '/>'],
    ['반짝 별 모빌', '<path d="M14 10 H86 M26 10 V40 M50 10 V58 M74 10 V34" fill="none"' + o(2.2) + '/>' + star(26, 48, 11, '#FFE07A') + star(50, 68, 14, '#FFB6C8') + star(74, 42, 10, '#B8E3FF')],
    ['구름 창문', '<rect x="14" y="12" width="72" height="72" rx="14" fill="#BFE6FF"' + o() + '/><path d="M30 46 Q22 46 23 39 Q24 33 31 34 Q34 26 43 28 Q51 27 52 35 Q59 34 59 41 Q59 46 52 46Z" fill="#FFFFFF"/><path d="M50 12 V84 M14 48 H86" fill="none"' + o(3.4) + '/><path d="M10 10 Q22 50 14 92 L6 92 L6 10Z M90 10 Q78 50 86 92 L94 92 L94 10Z" fill="#FFB8C9"' + o() + '/>']
  ];

  window.PETS2 = { draw: pet2, PETS: PETS, ITEMS: ITEMS, jpName: function (id) { return PETS[id].name; } };
})();
