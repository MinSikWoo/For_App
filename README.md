# For_App

앱 개발용 신규 프로젝트. 작업 방식은 `claude.md`를 따른다.

```
workflows/      # 업무별 단계 지시서 (쉬운 말)
tools/          # 실제 일을 하는 스크립트
.tmp/           # 임시 작업 공간 (GitHub에 안 올라감)
.env            # 비밀 키 (GitHub에 안 올라감) — .env.example 참고
```

## 앱 목록

- `japanese-word-game/` — 일본어 단어 카드 게임 (JLPT N5 153 + N4 183단어, 한자 위 후리가나, 보석으로 펫 10종·소품 100개 수집).
  - `words.js` 단어 목록 · `shop.js` 펫/소품 목록과 가격 · `app.js` 게임 동작 · `style.css` 디자인

## 다른 휴대폰에 설치 (비밀번호 잠금 웹앱)

```
python3 tools/build_pwa.py     # pwa/ 폴더에 잠긴 앱이 만들어짐 (비밀번호는 .env 의 APP_PASSWORD)
```

- `pwa/` 안의 게임은 비밀번호로 암호화되어 있어서 공개된 곳에 올려도 비밀번호 없이는 열 수 없다.
- `pwa/` 폴더 내용을 공개 저장소(GitHub Pages)에 올리면 휴대폰에서 링크로 열고 홈 화면에 설치할 수 있다.
- 게임을 고친 뒤에는 다시 빌드해서 올리면, 설치된 앱은 인터넷에 연결될 때 새 버전을 받는다.
