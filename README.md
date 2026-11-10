# For_App

앱 개발용 신규 프로젝트. 작업 방식은 `claude.md`를 따른다.

```
workflows/      # 업무별 단계 지시서 (쉬운 말)
tools/          # 실제 일을 하는 스크립트
.tmp/           # 임시 작업 공간 (GitHub에 안 올라감)
.env            # 비밀 키 (GitHub에 안 올라감) — .env.example 참고
```

## 앱 목록

- `japanese-word-game/` — 일본어 단어 카드 게임 (JLPT N5 153 + N4 183 + N3 197단어, 문장 90개, 한자 위 후리가나, 미니게임 6종, 보석으로 동글 펫 10종·소품 132개 수집).
  - `words.js` 단어 목록 · `sentences.js` 문장 목록 · `shop.js` 펫/소품 그림·가격 · `app.js` 게임 동작 · `minigames.js` 미니게임 · `style.css` 디자인

## 일본어 단어 카드: 휴대폰 앱으로 설치 (비밀번호 잠금)

```
python3 tools/build_pwa.py --out docs/cards     # docs/cards/ 에 잠긴 설치형 앱 생성 → 커밋·푸시
```

- 주소: `https://minsikwoo.github.io/For_App/cards/` (SJPT 앱은 `https://minsikwoo.github.io/For_App/`)
- 사이트 설정: https://github.com/MinSikWoo/For_App/settings/pages → Branch `ccr-242c6142-kf1tkp`, 폴더 `/docs`
- 배포 상황 확인: https://github.com/MinSikWoo/For_App/actions (초록 체크 = 완료). 배포가 오래 멈추면 새 커밋을 올리면 다시 배포된다.
- 비밀번호는 `.env` 의 `APP_PASSWORD`.

- `pwa/` 안의 게임은 비밀번호로 암호화되어 있어서 공개된 곳에 올려도 비밀번호 없이는 열 수 없다.
- `pwa/` 폴더 내용을 공개 저장소(GitHub Pages)에 올리면 휴대폰에서 링크로 열고 홈 화면에 설치할 수 있다.
- 게임을 고친 뒤에는 다시 빌드해서 올리면, 설치된 앱은 인터넷에 연결될 때 새 버전을 받는다.
- GitHub 없이 링크로만 공유하려면 `--artifact 폴더` 옵션으로 Claude 공유용 잠긴 페이지를 만들어 아티팩트로 올린다 (오프라인 실행은 안 됨).

## 🎙️ SJPT 말하기 연습 (`sjpt/`)

SJPT(일본어 말하기 시험) Lv.3~4 목표용 휴대폰 웹앱. 설치 없이 브라우저에서 열립니다.

| 메뉴 | 하는 일 |
|---|---|
| 🎯 파트 연습 | 실제 시험과 같은 준비/답변 시간 + 녹음 → 내 녹음 vs 모범답안 비교 → ⭕🔺❌ 자가평가 |
| 🧩 답변 틀 | 파트별 말하기 공식 (통암기 대신 틀에 단어 끼우기) |
| 🃏 문형 카드 | 답변용 핵심 문형 54개, 간격 반복 복습 |
| 📝 모의고사 | 26문항 실전 순서·시간 |
| 🔁 약점 복습 | 🔺❌ 문제만 다시 |
| 📊 내 기록·설정 | 파트별 점수, 연속 공부일, 읽어주기 속도, 후리가나 등 |

- 문제 추가/수정: `sjpt/data/questions.js` (후리가나는 `{漢字|かんじ}`로 표기)
- 문형 카드 추가/수정: `sjpt/data/patterns.js`
- 기록과 녹음은 각 휴대폰 브라우저 안에만 저장됩니다 (문제마다 최근 녹음 5개, 🎧 녹음 보관함에서 일괄 삭제). 인터넷으로 올라가지 않습니다.
- 마이크 녹음은 https 주소(예: GitHub Pages)에서만 동작합니다.

### 비밀번호 잠금 링크로 쓰기

```
python3 tools/build_locked_app.py     # .tmp/sjpt-locked/ 에 잠금 화면(index.html) + 암호화된 앱(app.json)
```

- 비밀번호는 `.env` 의 `SJPT_PASSWORD` (GitHub에 안 올라감). 없으면 새로 만들어 저장하고 화면에 보여줌.
- 만든 두 파일을 Claude 아티팩트로 올리면 링크로 열 수 있음. 앱을 고친 뒤엔 다시 빌드해서 같은 링크로 다시 올리기.
- Claude 링크 안에서는 마이크가 막혀 녹음은 안 되고, 타이머·읽어주기·모범답안·카드·기록은 모두 동작.

### GitHub Pages (녹음 가능, 추천)

```
python3 tools/build_locked_app.py --pages docs    # docs/ 에 잠긴 사이트 생성 → 커밋·푸시
```

- 저장소 Settings → Pages → Branch 에서 `docs/` 폴더가 있는 브랜치와 `/docs` 를 고르면 `https://minsikwoo.github.io/For_App/` 로 열림.
- 앱을 고친 뒤엔 위 명령으로 다시 만들고 커밋·푸시하면 몇 분 뒤 반영됨.
