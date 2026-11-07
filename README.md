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
