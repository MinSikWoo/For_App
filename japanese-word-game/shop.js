// 상점 데이터: 펫 10종 + 아이템 100개, 그리고 펫 그림을 그리는 함수.
// 가격은 보석(gem) 개수. price 0 = 처음부터 가지고 있음.
(function () {
  var FACE = '#3A2C36';

  // ---------- 펫 10종 ----------
  // name: 일본어 이름 ({한자|읽기} 표기), ko: 한국어, cry: 울음소리(일본어 의성어)
  var PETS = [
    { id: 'cat',     name: '{猫|ねこ}',   ko: '고양이', cry: 'にゃー',   price: 0,   body: '#F7C58F', dark: '#E09B5A' },
    { id: 'dog',     name: '{犬|いぬ}',   ko: '강아지', cry: 'わんわん', price: 40,  body: '#F3E1C3', dark: '#B07A50' },
    { id: 'rabbit',  name: 'うさぎ',       ko: '토끼',   cry: 'ぴょん',   price: 50,  body: '#FFFFFF', dark: '#E9D8DE' },
    { id: 'hamster', name: 'ハムスター',   ko: '햄스터', cry: 'ちゅー',   price: 50,  body: '#F4D19B', dark: '#D9A866' },
    { id: 'chick',   name: 'ひよこ',       ko: '병아리', cry: 'ぴよぴよ', price: 60,  body: '#FFE27A', dark: '#F2C14E' },
    { id: 'frog',    name: '{蛙|かえる}', ko: '개구리', cry: 'けろけろ', price: 70,  body: '#9AD67F', dark: '#6DB257' },
    { id: 'bear',    name: '{熊|くま}',   ko: '곰',     cry: 'がおー',   price: 80,  body: '#BF8D5F', dark: '#8F6340' },
    { id: 'penguin', name: 'ペンギン',     ko: '펭귄',   cry: 'ぺんぺん', price: 90,  body: '#46557A', dark: '#2F3B58' },
    { id: 'fox',     name: '{狐|きつね}', ko: '여우',   cry: 'こんこん', price: 100, body: '#F5A25A', dark: '#5A3A2A' },
    { id: 'panda',   name: 'パンダ',       ko: '판다',   cry: 'もぐもぐ', price: 150, body: '#FFFFFF', dark: '#2E2A30' }
  ];

  // ---------- 아이템 100개 ----------
  // slot: 방에서 놓이는 자리 / 펫에게 입히는 자리. 슬롯마다 하나씩 사용 가능.
  var I = [];
  function add(slot, list) { list.forEach(function (x) { I.push({ id: x[0], slot: slot, name: x[1], icon: x[2], price: x[3] }); }); }

  // 벽지 10 (icon 대신 CSS 무늬)
  add('wallpaper', [
    ['w1', '기본 벽지', '#FDF0F3', 0],
    ['w2', '딸기우유 줄무늬', 'repeating-linear-gradient(90deg,#FFE1E9 0 18px,#FFF4F7 18px 36px)', 15],
    ['w3', '맑은 하늘', 'radial-gradient(ellipse 60px 22px at 30% 30%,#FFFFFF 60%,transparent 62%),radial-gradient(ellipse 50px 18px at 75% 55%,#FFFFFF 60%,transparent 62%),linear-gradient(#BFE3FF,#EAF6FF)', 20],
    ['w4', '민트 도트', 'radial-gradient(#BDE8D3 4px,transparent 4.5px) 0 0/24px 24px,#EFFAF4', 20],
    ['w5', '레몬 체크', 'linear-gradient(90deg,rgba(255,206,80,.3) 50%,transparent 0) 0 0/28px 28px,linear-gradient(rgba(255,206,80,.3) 50%,transparent 0) 0 0/28px 28px,#FFFBEA', 25],
    ['w6', '라벤더 바둑판', 'conic-gradient(#E7DCFF 25%,#F6F1FF 0 50%,#E7DCFF 0 75%,#F6F1FF 0) 0 0/30px 30px', 25],
    ['w7', '장지문 (和室)', 'linear-gradient(90deg,#C9B48E 3px,transparent 3px) 0 0/44px 44px,linear-gradient(#C9B48E 3px,transparent 3px) 0 0/44px 44px,#FBF6EA', 30],
    ['w8', '벚꽃 흩날림', 'radial-gradient(circle at 20% 30%,#FFC2D1 0 6px,transparent 7px) 0 0/54px 54px,radial-gradient(circle at 70% 75%,#FFD9E3 0 4px,transparent 5px) 0 0/54px 54px,#FFF0F4', 35],
    ['w9', '노을', 'linear-gradient(#FFAE8A,#FFD3A6 60%,#FFF0D6)', 35],
    ['w10', '별이 빛나는 밤', 'radial-gradient(#FFFFFF 1.3px,transparent 1.8px) 0 0/28px 28px,radial-gradient(#FFE58A 1.2px,transparent 1.7px) 14px 14px/28px 28px,linear-gradient(#2B2F5C,#4D5196)', 45]
  ]);
  // 바닥 10
  add('floor', [
    ['f1', '기본 바닥', '#F1D9C0', 0],
    ['f2', '나무 마루', 'repeating-linear-gradient(90deg,#DCAB79 0 30px,#C9965F 30px 32px)', 15],
    ['f3', '다다미', 'repeating-linear-gradient(0deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px),repeating-linear-gradient(90deg,#D3DFA5 0 70px,#8AA35B 70px 73px)', 25],
    ['f4', '딸기 체크 타일', 'conic-gradient(#FFFFFF 25%,#F7C7D3 0 50%,#FFFFFF 0 75%,#F7C7D3 0) 0 0/34px 34px', 20],
    ['f5', '민트 카펫', 'radial-gradient(#A8DCC2 3px,transparent 3.5px) 0 0/18px 18px,#C9EEDB', 20],
    ['f6', '구름 카펫', 'radial-gradient(circle,#FFFFFF 10px,transparent 11px) 0 0/40px 40px,#D6EAFF', 25],
    ['f7', '대리석', 'linear-gradient(135deg,#F8F8FA 0%,#E6E8EF 45%,#F5F5F8 55%,#E2E4EC 100%)', 30],
    ['f8', '잔디밭', 'repeating-linear-gradient(100deg,#A3D581 0 6px,#8FC86E 6px 11px)', 30],
    ['f9', '모래사장', 'radial-gradient(#E9CF97 1.5px,transparent 2px) 0 0/12px 12px,#F7E4B8', 30],
    ['f10', '보라 줄무늬 러그', 'repeating-linear-gradient(90deg,#D9C7F5 0 20px,#E9DEFA 20px 40px)', 40]
  ]);
  // 벽 장식 10
  add('deco', [
    ['d1', '액자', '🖼️', 15], ['d2', '괘종시계', '🕰️', 25], ['d3', '거울', '🪞', 20], ['d4', '달력', '📅', 10],
    ['d5', '후지산 그림', '🗻', 30], ['d6', '무지개 스티커', '🌈', 20], ['d7', '다트판', '🎯', 20], ['d8', '창문', '🪟', 30],
    ['d9', '족자', '📜', 25], ['d10', '잉어 깃발 (鯉のぼり)', '🎏', 35]
  ]);
  // 천장 8
  add('ceil', [
    ['c1', '전구', '💡', 10], ['c2', '초롱 (提灯)', '🏮', 25], ['c3', '풍경 (風鈴)', '🎐', 25], ['c4', '풍선', '🎈', 15],
    ['c5', '별 모빌', '⭐', 20], ['c6', '달 모빌', '🌙', 20], ['c7', '미러볼', '🪩', 40], ['c8', '구름 모빌', '☁️', 20]
  ]);
  // 가구 12
  add('furn', [
    ['u1', '소파', '🛋️', 40], ['u2', '의자', '🪑', 20], ['u3', '침대', '🛏️', 50], ['u4', '텔레비전', '📺', 45],
    ['u5', '피아노', '🎹', 60], ['u6', '바구니', '🧺', 15], ['u7', '책 더미', '📚', 20], ['u8', '컴퓨터', '🖥️', 50],
    ['u9', '작은 도리이 (鳥居)', '⛩️', 70], ['u10', '서커스 텐트', '🎪', 60], ['u11', '욕조', '🛁', 55], ['u12', '선물 상자', '🎁', 30]
  ]);
  // 식물 8
  add('plant', [
    ['p1', '화분', '🪴', 10], ['p2', '선인장', '🌵', 12], ['p3', '해바라기', '🌻', 15], ['p4', '튤립', '🌷', 15],
    ['p5', '가도마츠 (門松)', '🎍', 30], ['p6', '작은 나무', '🌳', 25], ['p7', '네잎클로버', '🍀', 20], ['p8', '꽃다발', '💐', 20]
  ]);
  // 장난감 10
  add('toy', [
    ['t1', '곰 인형', '🧸', 20], ['t2', '요요', '🪀', 10], ['t3', '축구공', '⚽', 10], ['t4', '테니스공', '🎾', 10],
    ['t5', '털실 뭉치', '🧶', 12], ['t6', '연', '🪁', 15], ['t7', '주사위', '🎲', 10], ['t8', '장난감 기차', '🚂', 25],
    ['t9', '마트료시카', '🪆', 25], ['t10', '게임기', '🎮', 40]
  ]);
  // 간식 8
  add('food', [
    ['k1', '주먹밥 (おにぎり)', '🍙', 5], ['k2', '경단 (だんご)', '🍡', 8], ['k3', '초밥 (すし)', '🍣', 15], ['k4', '케이크', '🍰', 12],
    ['k5', '도넛', '🍩', 8], ['k6', '푸딩 (プリン)', '🍮', 10], ['k7', '딸기', '🍓', 5], ['k8', '녹차 (お茶)', '🍵', 8]
  ]);
  // 펫 머리 10
  add('hat', [
    ['h1', '리본', '🎀', 15], ['h2', '왕관', '👑', 60], ['h3', '실크햇', '🎩', 40], ['h4', '야구모자', '🧢', 25],
    ['h5', '밀짚모자', '👒', 35], ['h6', '학사모', '🎓', 45], ['h7', '벚꽃 핀', '🌸', 15], ['h8', '해바라기 핀', '🌻', 15],
    ['h9', '별 핀', '⭐', 20], ['h10', '딸기 핀', '🍓', 15]
  ]);
  // 펫 얼굴 7
  add('face', [
    ['e1', '동그란 안경', '👓', 25], ['e2', '선글라스', '🕶️', 35], ['e3', '수영 고글', '🥽', 30], ['e4', '반창고', '🩹', 10],
    ['e5', '하트 볼터치', '💕', 15], ['e6', '반짝이 스티커', '✨', 15], ['e7', '꽃 스티커', '🌼', 15]
  ]);
  // 펫 목 7
  add('neck', [
    ['n1', '목도리', '🧣', 25], ['n2', '나비 리본', '🎀', 15], ['n3', '방울', '🔔', 15], ['n4', '구슬 목걸이', '📿', 30],
    ['n5', '금메달', '🏅', 45], ['n6', '보석 목걸이', '💎', 70], ['n7', '꽃 목걸이', '🌺', 25]
  ]);

  var SLOTS = [
    ['pet', '펫'], ['wallpaper', '벽지'], ['floor', '바닥'], ['deco', '벽 장식'], ['ceil', '천장'], ['furn', '가구'],
    ['plant', '식물'], ['toy', '장난감'], ['food', '간식'], ['hat', '펫 머리'], ['face', '펫 얼굴'], ['neck', '펫 목']
  ];

  // ---------- 펫 그림 ----------
  function eyesFor(id) { return id === 'frog' ? [[40, 38], [80, 38]] : [[46, 66], [74, 66]]; }
  function faceSVG(p, face) {
    var E = eyesFor(p.id), ec = p.id === 'panda' ? '#FFFFFF' : FACE, s = '';
    var beak = p.id === 'penguin' || p.id === 'chick';
    var stroke = ' fill="none" stroke="' + ec + '" stroke-width="2.8" stroke-linecap="round"';
    if (face === 'happy') {
      E.forEach(function (e) { s += '<path d="M' + (e[0] - 5) + ' ' + (e[1] + 1) + ' Q' + e[0] + ' ' + (e[1] - 6) + ' ' + (e[0] + 5) + ' ' + (e[1] + 1) + '"' + stroke + '/>'; });
    } else if (face === 'sad') {
      s += '<path d="M' + (E[0][0] - 5) + ' ' + (E[0][1] - 2) + ' L' + (E[0][0] + 5) + ' ' + (E[0][1] + 1) + '"' + stroke + '/>';
      s += '<path d="M' + (E[1][0] + 5) + ' ' + (E[1][1] - 2) + ' L' + (E[1][0] - 5) + ' ' + (E[1][1] + 1) + '"' + stroke + '/>';
      s += '<path d="M' + (E[1][0] + 7) + ' ' + (E[1][1] + 3) + ' q3 5 0 8 q-3 -3 0 -8z" fill="#8FB5FF"/>';
    } else {
      E.forEach(function (e) { s += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="4.4" fill="' + ec + '"/><circle cx="' + (e[0] + 1.5) + '" cy="' + (e[1] - 1.6) + '" r="1.5" fill="' + (ec === FACE ? '#FFFFFF' : FACE) + '"/>'; });
    }
    if (p.id === 'frog') {
      s += face === 'sad' ? '<path d="M46 86 Q60 78 74 86"' + stroke.replace(ec, FACE) + '/>'
        : face === 'happy' ? '<path d="M42 78 Q60 80 78 78 Q72 94 60 94 Q48 94 42 78Z" fill="#F07A93" stroke="' + FACE + '" stroke-width="2.4" stroke-linejoin="round"/>'
        : '<path d="M42 80 Q60 92 78 80"' + stroke.replace(ec, FACE) + '/>';
    } else if (beak) {
      s += face === 'happy' ? '<path d="M54 74 L66 74 L60 80Z M55 81 L65 81 L60 86Z" fill="#F59E3B" stroke="' + FACE + '" stroke-width="1.8" stroke-linejoin="round"/>'
        : '<path d="M54 75 L66 75 L60 83Z" fill="#F59E3B" stroke="' + FACE + '" stroke-width="1.8" stroke-linejoin="round"/>';
    } else {
      var my = 82, st = ' fill="none" stroke="' + FACE + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
      s += face === 'happy' ? '<path d="M53 ' + (my - 2) + ' Q60 ' + (my - 2) + ' 67 ' + (my - 2) + ' Q65 ' + (my + 8) + ' 60 ' + (my + 8) + ' Q55 ' + (my + 8) + ' 53 ' + (my - 2) + 'Z" fill="#F07A93" stroke="' + FACE + '" stroke-width="2.2" stroke-linejoin="round"/>'
        : face === 'sad' ? '<path d="M54 ' + (my + 4) + ' Q60 ' + (my - 2) + ' 66 ' + (my + 4) + '"' + st + '/>'
        : '<path d="M54 ' + (my - 1) + ' Q57 ' + (my + 3) + ' 60 ' + (my - 1) + ' Q63 ' + (my + 3) + ' 66 ' + (my - 1) + '"' + st + '/>';
    }
    return s;
  }
  function petSVG(petId, face, eq, cls) {
    var p = PETS.filter(function (x) { return x.id === petId; })[0] || PETS[0];
    var b = p.body, d = p.dark, o = ' stroke="' + FACE + '" stroke-width="2.6" stroke-linejoin="round"';
    var back = '', front = '', body = '<ellipse cx="60" cy="70" rx="42" ry="38" fill="' + b + '"' + o + '/>';
    var feet = '<ellipse cx="44" cy="106" rx="10" ry="5.5" fill="' + d + '"' + o + '/><ellipse cx="76" cy="106" rx="10" ry="5.5" fill="' + d + '"' + o + '/>';
    switch (p.id) {
      case 'cat':
        back = '<path d="M24 54 L30 16 L56 38Z" fill="' + b + '"' + o + '/><path d="M96 54 L90 16 L64 38Z" fill="' + b + '"' + o + '/><path d="M32 42 L33 26 L46 37Z M88 42 L87 26 L74 37Z" fill="#FFB3C3"/>';
        front = '<path d="M54 38 l2 7 M60 35 v9 M66 38 l-2 7" stroke="' + d + '" stroke-width="3" stroke-linecap="round"/><path d="M57 74 L63 74 L60 77Z" fill="#F08AA0"/>';
        break;
      case 'dog':
        front = '<ellipse cx="76" cy="64" rx="11" ry="10" fill="' + d + '" opacity=".35"/><ellipse cx="24" cy="60" rx="11" ry="22" transform="rotate(22 24 60)" fill="' + d + '"' + o + '/><ellipse cx="96" cy="60" rx="11" ry="22" transform="rotate(-22 96 60)" fill="' + d + '"' + o + '/><ellipse cx="60" cy="75" rx="5.5" ry="4" fill="' + FACE + '"/>';
        break;
      case 'rabbit':
        back = '<ellipse cx="44" cy="22" rx="10" ry="25" transform="rotate(-10 44 22)" fill="' + b + '"' + o + '/><ellipse cx="76" cy="22" rx="10" ry="25" transform="rotate(10 76 22)" fill="' + b + '"' + o + '/><ellipse cx="44" cy="24" rx="4.5" ry="16" transform="rotate(-10 44 24)" fill="#FFC2D0"/><ellipse cx="76" cy="24" rx="4.5" ry="16" transform="rotate(10 76 24)" fill="#FFC2D0"/>';
        front = '<path d="M57 74 L63 74 L60 77Z" fill="#F08AA0"/>';
        break;
      case 'hamster':
        back = '<circle cx="34" cy="38" r="10" fill="' + b + '"' + o + '/><circle cx="86" cy="38" r="10" fill="' + b + '"' + o + '/><circle cx="34" cy="38" r="5" fill="#FFB3C3"/><circle cx="86" cy="38" r="5" fill="#FFB3C3"/>';
        front = '<ellipse cx="60" cy="92" rx="27" ry="15" fill="#FFF6E6"/><path d="M57 74 L63 74 L60 77Z" fill="#F08AA0"/>';
        break;
      case 'chick':
        back = '<ellipse cx="19" cy="78" rx="8" ry="14" transform="rotate(25 19 78)" fill="' + d + '"' + o + '/><ellipse cx="101" cy="78" rx="8" ry="14" transform="rotate(-25 101 78)" fill="' + d + '"' + o + '/>';
        front = '<path d="M54 34 Q56 20 61 30 Q64 18 68 32" fill="none" stroke="' + FACE + '" stroke-width="2.6" stroke-linecap="round"/>';
        feet = '<path d="M40 104 h10 M70 104 h10" stroke="#F59E3B" stroke-width="5" stroke-linecap="round"/>';
        break;
      case 'frog':
        front = '<ellipse cx="60" cy="94" rx="24" ry="12" fill="#D4F0C4"/><circle cx="40" cy="38" r="14" fill="' + b + '"' + o + '/><circle cx="80" cy="38" r="14" fill="' + b + '"' + o + '/><circle cx="40" cy="38" r="9" fill="#FFFFFF"/><circle cx="80" cy="38" r="9" fill="#FFFFFF"/>';
        break;
      case 'bear':
        back = '<circle cx="28" cy="42" r="13" fill="' + b + '"' + o + '/><circle cx="92" cy="42" r="13" fill="' + b + '"' + o + '/><circle cx="28" cy="42" r="6" fill="' + d + '"/><circle cx="92" cy="42" r="6" fill="' + d + '"/>';
        front = '<ellipse cx="60" cy="82" rx="16" ry="12" fill="#E9CBA5"/><ellipse cx="60" cy="75" rx="5.5" ry="4" fill="' + FACE + '"/>';
        break;
      case 'penguin':
        back = '<ellipse cx="19" cy="80" rx="8" ry="17" transform="rotate(22 19 80)" fill="' + d + '"' + o + '/><ellipse cx="101" cy="80" rx="8" ry="17" transform="rotate(-22 101 80)" fill="' + d + '"' + o + '/>';
        front = '<path d="M60 44 C78 44 90 56 90 76 C90 96 76 104 60 104 C44 104 30 96 30 76 C30 56 42 44 60 44Z" fill="#FFFFFF"/>';
        feet = '<ellipse cx="46" cy="107" rx="9" ry="4.5" fill="#F59E3B"' + o + '/><ellipse cx="74" cy="107" rx="9" ry="4.5" fill="#F59E3B"' + o + '/>';
        break;
      case 'fox':
        back = '<path d="M22 56 L24 12 L56 36Z" fill="' + b + '"' + o + '/><path d="M98 56 L96 12 L64 36Z" fill="' + b + '"' + o + '/><path d="M24 22 L24 12 L33 19Z M96 22 L96 12 L87 19Z" fill="' + d + '"/>';
        front = '<path d="M20 76 Q40 72 60 86 Q80 72 100 76 Q96 106 60 108 Q24 106 20 76Z" fill="#FFFFFF"/><ellipse cx="60" cy="76" rx="4.5" ry="3.5" fill="' + FACE + '"/>';
        break;
      case 'panda':
        back = '<circle cx="30" cy="40" r="13" fill="' + d + '"' + o + '/><circle cx="90" cy="40" r="13" fill="' + d + '"' + o + '/>';
        front = '<ellipse cx="45" cy="66" rx="10" ry="12" transform="rotate(-28 45 66)" fill="' + d + '"/><ellipse cx="75" cy="66" rx="10" ry="12" transform="rotate(28 75 66)" fill="' + d + '"/><ellipse cx="60" cy="75" rx="4.5" ry="3.5" fill="' + d + '"/>';
        break;
    }
    var cheeks = '<ellipse cx="34" cy="78" rx="6.5" ry="4" fill="#FF8DA6" opacity=".5"/><ellipse cx="86" cy="78" rx="6.5" ry="4" fill="#FF8DA6" opacity=".5"/>';
    var acc = '';
    eq = eq || {};
    var it = function (slot) { var id = eq[slot]; return id ? I.filter(function (x) { return x.id === id; })[0] : null; };
    var t = function (x, y, size, ch) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="middle" dominant-baseline="central">' + ch + '</text>'; };
    var n = it('neck'), h = it('hat'), f = it('face');
    if (n) acc += t(60, 101, 24, n.icon);
    if (f) {
      var sticker = ['e4', 'e5', 'e6', 'e7'].indexOf(f.id) >= 0;
      acc += sticker ? t(86, 80, 17, f.icon) : (p.id === 'frog' ? t(60, 40, 52, f.icon) : t(60, 66, 42, f.icon));
    }
    if (h) acc += t(60, p.id === 'frog' ? 22 : 30, 32, h.icon);
    return '<svg class="mascot ' + (cls || '') + '" viewBox="0 0 120 120" aria-hidden="true">' + back + body + feet + front + cheeks + faceSVG(p, face || 'smile') + acc + '</svg>';
  }

  window.SHOP = { PETS: PETS, ITEMS: I, SLOTS: SLOTS, petSVG: petSVG };
})();
