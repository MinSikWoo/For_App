"""일본어 단어 카드 게임의 단어·문장 데이터를 기계적으로 검사한다.

검사 대상
  japanese-word-game/words.js      (WORDS=N5, WORDS_N4, WORDS_N3)
  japanese-word-game/sentences.js  (SENTENCES = {N5, N4, N3})

하는 일
  - 후리가나 문법 ({한자|읽기} 짝, 괄호 균형, 읽기는 가나만, 괄호 밖에 남은 한자)
  - 단어 중복 (같은 표기 = 같은 id → 학습 기록이 섞임), 같은 읽기, 같은/비슷한 한국어 뜻
  - 문장: 빈칸 [ ] 정확히 하나, 조각 2개 이상, 조각을 이으면 원문, 빈칸 텍스트 중복,
          조사 조각 바꿔치기 규칙으로 '어떤 순서든 정답'이 되어 버리는 문장(게임 무한 반복) 등

사용법
  python3 tools/qa_check_data.py          # 요약 출력 + .tmp/qa/data_check.json 저장
  python3 tools/qa_check_data.py --quiet  # 요약만 (자세한 목록 생략)
종료 코드: 오류(error)가 하나라도 있으면 1, 아니면 0.
표준 라이브러리만 사용한다. JS 데이터는 node 로 읽는다.
"""
import itertools
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "japanese-word-game"
OUT = ROOT / ".tmp" / "qa" / "data_check.json"

CATS = {"people", "food", "place", "time", "number", "thing", "body", "verb", "adj"}
LEVELS = ["N5", "N4", "N3"]
# 게임(minigames.js)과 같은 규칙: 이 조사로 끝나는 조각은 서로 자리를 바꿔도 정답
FREE = re.compile(r"(を|に|で|へ|と|が|も|から|まで)$")
FURI = re.compile(r"\{([^|{}]+)\|([^{}]+)\}")

KANJI = re.compile(r"[㐀-䶿一-鿿豈-﫿々〆]")
KANA_ONLY = re.compile(r"^[ぁ-ゟ゠-ヿー]+$")


def load_js(fname, expr):
    """node 로 JS 파일을 읽어 JSON 으로 받는다."""
    code = (
        "global.window={};require(%s);console.log(JSON.stringify(%s))"
        % (json.dumps(str(GAME / fname)), expr)
    )
    res = subprocess.run(["node", "-e", code], capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def parse(notation):
    """게임 app.js 의 parse 와 같은 결과: [(글자, 읽기 또는 None), ...]"""
    segs, last = [], 0
    for m in FURI.finditer(notation):
        if m.start() > last:
            segs.append((notation[last:m.start()], None))
        segs.append((m.group(1), m.group(2)))
        last = m.end()
    if last < len(notation):
        segs.append((notation[last:], None))
    return segs


def plain(n):
    return FURI.sub(r"\1", n)


def reading(n):
    return FURI.sub(r"\2", n)


def furigana_problems(text, allow_marks=""):
    """후리가나 표기 문제 목록. allow_marks: 검사에서 무시할 기호 (문장의 / [ ])."""
    probs = []
    t = text
    for ch in allow_marks:
        t = t.replace(ch, "")
    if t.count("{") != t.count("}"):
        probs.append("{ } 개수가 맞지 않음")
    depth = 0
    for ch in t:
        if ch == "{":
            depth += 1
            if depth > 1:
                probs.append("{ 안에 { 가 또 있음")
        elif ch == "}":
            depth -= 1
            if depth < 0:
                probs.append("} 가 { 보다 먼저 나옴")
                depth = 0
    # 짝이 맞는 {a|b} 를 뺀 나머지에 { } | 가 남아 있으면 문법 오류
    rest = FURI.sub("", t)
    for ch in "{}|":
        if ch in rest:
            probs.append("짝이 안 맞는 '%s' 가 남아 있음" % ch)
    for m in FURI.finditer(t):
        base, yomi = m.group(1), m.group(2)
        if not KANJI.search(base):
            probs.append("후리가나를 단 부분 '%s' 에 한자가 없음" % base)
        if not KANA_ONLY.match(yomi):
            probs.append("읽기 '%s' 에 가나가 아닌 글자가 있음" % yomi)
        if base and yomi and base[-1] == yomi[-1] and not KANJI.match(base[-1]):
            probs.append("'%s|%s': 오쿠리가나가 괄호 안에 들어간 듯함" % (base, yomi))
        # 한자 끝에 붙은 가나가 괄호 안에 있는지(예: {食べ|たべ})
        if re.search(r"[ぁ-ゟ]", base):
            probs.append("후리가나 부분 '%s' 안에 히라가나가 섞여 있음 (오쿠리가나는 괄호 밖으로)" % base)
    left = KANJI.findall(rest)
    if left:
        probs.append("후리가나 없이 괄호 밖에 남은 한자: %s" % "".join(left))
    return probs


# ---------- 한국어 뜻 비교용 ----------
def glosses(ko):
    """'(나의) 형, 오빠' → ['형', '오빠'] 처럼 뜻 하나하나로 나눈다."""
    s = re.sub(r"\([^)]*\)", " ", ko)
    # '1,000' 의 쉼표는 나누지 않도록 '쉼표+공백' 기준으로 나눈다
    parts = [p.strip() for p in re.split(r",\s+|[/·;]", s)]
    return [p for p in parts if p]


def stem(g):
    """'충분하다' / '충분함' / '충분임' 을 같은 줄기로 본다."""
    g = re.sub(r"\s+", "", g)
    for suf in ("하다", "함", "임", "이다", "다"):
        if g.endswith(suf) and len(g) > len(suf):
            return g[: -len(suf)]
    return g


def ko_relation(a, b):
    """두 뜻이 같거나 너무 비슷하면 이유를 돌려준다."""
    if a == b:
        return "뜻이 똑같음"
    ga, gb = glosses(a), glosses(b)
    shared = set(ga) & set(gb)
    if shared:
        return "같은 뜻풀이 공유: " + ", ".join(sorted(shared))
    sa = {stem(x) for x in ga if len(stem(x)) >= 2}
    sb = {stem(x) for x in gb if len(stem(x)) >= 2}
    shared = sa & sb
    if shared:
        return "어간이 같은 뜻풀이: " + ", ".join(sorted(shared))
    for x in ga:
        for y in gb:
            if re.fullmatch(r"[\d,\s]+", x) or re.fullmatch(r"[\d,\s]+", y):
                continue  # 숫자끼리는 비교하지 않음
            short, long_ = sorted((x, y), key=lambda t: len(t.replace(" ", "")))
            # 두 글자 이상 뜻이 통째로 들어 있거나(돌아가다 ⊂ 되돌아가다),
            # 한 글자 뜻이 띄어쓰기 단위 낱말로 들어 있을 때만(낮 ⊂ 낮 동안). 성 ⊂ 성공 같은 우연은 무시.
            if (len(short) >= 2 and short.replace(" ", "") in long_.replace(" ", "")) or short in long_.split():
                return "한 뜻이 다른 뜻을 포함: %s ⊂ %s" % (short, long_)
    return None


def check_words(data):
    issues, words = [], []
    for lv in LEVELS:
        for i, e in enumerate(data[lv]):
            loc = "%s #%d" % (lv, i + 1)
            if not (isinstance(e, list) and len(e) == 3 and all(isinstance(x, str) and x.strip() for x in e)):
                issues.append({"level": "error", "where": loc, "entry": e, "msg": "형식 오류 (문자열 3개가 아님)"})
                continue
            n, ko, cat = e
            words.append({"lv": lv, "no": i + 1, "loc": loc, "n": n, "ko": ko, "cat": cat,
                          "plain": plain(n), "reading": reading(n), "kanji": bool(FURI.search(n))})
            if cat not in CATS:
                issues.append({"level": "error", "where": loc, "entry": e, "msg": "알 수 없는 분류: " + cat})
            for p in furigana_problems(n):
                issues.append({"level": "error", "where": loc, "entry": e, "msg": p})
            if not FURI.search(n):
                issues.append({"level": "warn", "where": loc, "entry": e, "msg": "한자가 없는 단어 (한자 읽기 퀴즈에서 빠짐)"})
            if n != n.strip() or ko != ko.strip():
                issues.append({"level": "warn", "where": loc, "entry": e, "msg": "앞뒤 공백"})

    # 같은 id (표기) → 학습 기록 충돌
    by_id = defaultdict(list)
    by_plain = defaultdict(list)
    by_read = defaultdict(list)
    by_ko = defaultdict(list)
    for w in words:
        by_id[w["n"]].append(w)
        by_plain[w["plain"]].append(w)
        if w["kanji"]:
            by_read[w["reading"]].append(w)
        by_ko[w["ko"]].append(w)
    dup = {"same_notation": [], "same_plain": [], "same_reading": [], "same_meaning": [], "similar_meaning": []}
    for k, ws in by_id.items():
        if len(ws) > 1:
            dup["same_notation"].append({"key": k, "where": [w["loc"] for w in ws]})
            issues.append({"level": "error", "where": ", ".join(w["loc"] for w in ws), "entry": k,
                           "msg": "같은 표기가 두 번 이상 (학습 기록 id 가 겹침)"})
    for k, ws in by_plain.items():
        if len(ws) > 1 and len({w["n"] for w in ws}) > 1:
            dup["same_plain"].append({"key": k, "where": [w["loc"] for w in ws]})
            issues.append({"level": "warn", "where": ", ".join(w["loc"] for w in ws), "entry": k,
                           "msg": "후리가나를 뺀 표기가 같음 (단어 맞히기 보기에서 구별 불가)"})
    for k, ws in by_read.items():
        if len(ws) > 1:
            dup["same_reading"].append({"key": k, "words": ["%s %s (%s)" % (w["loc"], w["plain"], w["ko"]) for w in ws]})
            issues.append({"level": "info", "where": ", ".join(w["loc"] for w in ws), "entry": k,
                           "msg": "같은 읽기(동음이의어): " + " / ".join(w["plain"] for w in ws)})
    for k, ws in by_ko.items():
        if len(ws) > 1:
            dup["same_meaning"].append({"key": k, "where": [w["loc"] for w in ws]})
            issues.append({"level": "error", "where": ", ".join(w["loc"] for w in ws), "entry": k,
                           "msg": "한국어 뜻이 똑같음 (뜻 맞히기에서 정답이 두 개)"})
    # 비슷한 뜻: 같은 레벨이면 warn, 다른 레벨이면 '전부' 모드에서만 → info
    for a, b in itertools.combinations(words, 2):
        if a["ko"] == b["ko"]:
            continue
        why = ko_relation(a["ko"], b["ko"])
        if not why:
            continue
        same_lv = a["lv"] == b["lv"]
        same_cat = a["cat"] == b["cat"]
        rec = {"a": "%s %s「%s」[%s]" % (a["loc"], a["plain"], a["ko"], a["cat"]),
               "b": "%s %s「%s」[%s]" % (b["loc"], b["plain"], b["ko"], b["cat"]),
               "why": why, "same_level": same_lv, "same_category": same_cat}
        dup["similar_meaning"].append(rec)
        issues.append({"level": "warn" if (same_lv or same_cat) else "info",
                       "where": "%s ↔ %s" % (a["loc"], b["loc"]),
                       "entry": "%s「%s」 / %s「%s」" % (a["plain"], a["ko"], b["plain"], b["ko"]),
                       "msg": "비슷한 한국어 뜻 (" + why + ")"})
    counts = {lv: sum(1 for w in words if w["lv"] == lv) for lv in LEVELS}
    cat_counts = {lv: {c: sum(1 for w in words if w["lv"] == lv and w["cat"] == c) for c in sorted(CATS)} for lv in LEVELS}
    return issues, dup, counts, cat_counts


def accepted(chunks, order):
    """게임의 correct(): 원래 자리가 조사 조각이면 아무 조사 조각이나, 아니면 똑같은 조각."""
    for i, c in enumerate(order):
        o = chunks[i]
        if FREE.search(plain(o)):
            if not FREE.search(plain(c)):
                return False
        elif c != o:
            return False
    return True


def check_sentences(data):
    issues, sents = [], []
    for lv in LEVELS:
        for i, e in enumerate(data.get(lv, [])):
            loc = "%s #%d" % (lv, i + 1)
            if not (isinstance(e, list) and len(e) == 2 and all(isinstance(x, str) and x.strip() for x in e)):
                issues.append({"level": "error", "where": loc, "entry": e, "msg": "형식 오류 (문자열 2개가 아님)"})
                continue
            raw, ko = e
            for p in furigana_problems(raw, allow_marks="/[]"):
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": p})
            nb_open, nb_close = raw.count("["), raw.count("]")
            blanks = re.findall(r"\[([^\]]*)\]", raw)
            if nb_open != 1 or nb_close != 1 or len(blanks) != 1:
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "빈칸 [ ] 이 정확히 하나가 아님"})
            blank = blanks[0] if blanks else ""
            if blanks and not blank.strip():
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "빈칸이 비어 있음"})
            if "/" in blank:
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "빈칸 안에 조각 나누기 / 가 있음"})
            # [ ] 안에서 후리가나가 잘리는지
            for seg in re.split(r"[\[\]]", raw):
                if seg.count("{") != seg.count("}"):
                    issues.append({"level": "error", "where": loc, "entry": raw, "msg": "빈칸 경계가 {한자|읽기} 를 자름"})
                    break
            for seg in raw.split("/"):
                if seg.count("{") != seg.count("}"):
                    issues.append({"level": "error", "where": loc, "entry": raw, "msg": "조각 경계 / 가 {한자|읽기} 를 자름"})
                    break
            chunks = re.sub(r"[\[\]]", "", raw).split("/")
            clean = re.sub(r"[/\[\]]", "", raw)
            if len(chunks) < 2:
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "조각이 2개 미만"})
            if "".join(chunks) != clean:
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "조각을 이어도 원문이 안 됨"})
            if any(not c.strip() for c in chunks):
                issues.append({"level": "error", "where": loc, "entry": raw, "msg": "빈 조각이 있음 (// 또는 끝의 /)"})
            if len(set(chunks)) != len(chunks):
                issues.append({"level": "warn", "where": loc, "entry": raw, "msg": "똑같은 조각이 두 번 나옴"})
            if not re.search(r"[。？！?!]$", plain(clean)):
                issues.append({"level": "warn", "where": loc, "entry": raw, "msg": "문장 끝에 。/？ 가 없음"})
            if not re.search(r"[.?!]$", ko.strip()):
                issues.append({"level": "info", "where": loc, "entry": ko, "msg": "한국어 번역 끝에 마침표/물음표가 없음"})
            free = [c for c in chunks if FREE.search(plain(c))]
            # 문장 만들기: 정답으로 인정되는 순서 모두 (조각 8개 이하에서만 계산)
            alt = []
            all_ok = False
            if 2 <= len(chunks) <= 8:
                perms = list(itertools.permutations(range(len(chunks))))
                ok = [p for p in perms if accepted(chunks, [chunks[j] for j in p])]
                alt = ["/".join(plain(chunks[j]) for j in p) for p in ok if list(p) != list(range(len(chunks)))]
                all_ok = len(ok) == len(perms)
                if all_ok:
                    issues.append({"level": "error", "where": loc, "entry": raw,
                                   "msg": "어떤 순서로 놓아도 정답 → 문장 만들기에서 섞기가 끝나지 않음(멈춤)"})
            if alt:
                issues.append({"level": "info", "where": loc, "entry": raw,
                               "msg": "조사 조각 바꿔치기로 정답 인정되는 다른 순서 %d개: %s" % (len(alt), " | ".join(alt[:6]))})
            sents.append({"lv": lv, "no": i + 1, "loc": loc, "raw": raw, "ko": ko, "blank": blank,
                          "blank_plain": plain(blank), "chunks": chunks, "free_chunks": free,
                          "accepted_other_orders": alt})
    # 빈칸 텍스트 중복 (게임은 후리가나를 뺀 글자로 중복 제거)
    by_blank = defaultdict(list)
    for s in sents:
        by_blank[s["blank_plain"]].append(s)
    same_blanks = []
    for k, ss in by_blank.items():
        if len(ss) > 1:
            same_blanks.append({"blank": k, "where": [s["loc"] for s in ss]})
            issues.append({"level": "info", "where": ", ".join(s["loc"] for s in ss), "entry": k,
                           "msg": "같은 빈칸 답이 여러 문장에 있음 (보기에는 한 번만 나오므로 문제는 아님)"})
    # 후리가나 표기만 다른 같은 글자 빈칸
    by_blank_raw = defaultdict(set)
    for s in sents:
        by_blank_raw[s["blank_plain"]].add(s["blank"])
    for k, v in by_blank_raw.items():
        if len(v) > 1:
            issues.append({"level": "warn", "where": k, "entry": sorted(v), "msg": "같은 빈칸 글자인데 후리가나가 다름"})
    # 한 단어의 활용형/파생형끼리 (예: 上手 / 上手に / 上手な) – 보기에 함께 나오면 문법으로만 구별
    family = []
    bl = sorted({s["blank_plain"] for s in sents}, key=len)
    for a, b in itertools.combinations(bl, 2):
        if a and b.startswith(a) and a != b:
            family.append([a, b])
    if family:
        issues.append({"level": "info", "where": "빈칸 보기", "entry": family,
                       "msg": "한쪽이 다른 쪽으로 시작하는 빈칸 답 (같은 단어 활용형) – 보기에 함께 나오면 문법으로 골라야 함"})
    # 한국어 번역 중복
    by_ko = defaultdict(list)
    for s in sents:
        by_ko[s["ko"]].append(s)
    for k, ss in by_ko.items():
        if len(ss) > 1:
            issues.append({"level": "error", "where": ", ".join(s["loc"] for s in ss), "entry": k,
                           "msg": "한국어 번역이 똑같은 문장 (문장 뜻 고르기에서 혼동)"})
    by_raw = defaultdict(list)
    for s in sents:
        by_raw[plain(re.sub(r"[/\[\]]", "", s["raw"]))].append(s)
    for k, ss in by_raw.items():
        if len(ss) > 1:
            issues.append({"level": "error", "where": ", ".join(s["loc"] for s in ss), "entry": k, "msg": "같은 문장이 두 번"})
    counts = {lv: sum(1 for s in sents if s["lv"] == lv) for lv in LEVELS}
    build_ready = {lv: sum(1 for s in sents if s["lv"] == lv and len(s["chunks"]) >= 3) for lv in LEVELS}
    return issues, sents, same_blanks, counts, build_ready


def main():
    quiet = "--quiet" in sys.argv
    wdata = load_js("words.js", "{N5:window.WORDS,N4:window.WORDS_N4,N3:window.WORDS_N3}")
    sdata = load_js("sentences.js", "window.SENTENCES")
    w_issues, dup, w_counts, cat_counts = check_words(wdata)
    s_issues, sents, same_blanks, s_counts, build_ready = check_sentences(sdata)

    def tally(xs):
        t = {"error": 0, "warn": 0, "info": 0}
        for x in xs:
            t[x["level"]] += 1
        return t

    report = {
        "word_counts": w_counts, "word_category_counts": cat_counts,
        "sentence_counts": s_counts, "sentences_with_3plus_chunks": build_ready,
        "word_issue_counts": tally(w_issues), "sentence_issue_counts": tally(s_issues),
        "word_issues": w_issues, "sentence_issues": s_issues,
        "word_duplicates": dup, "same_blank_answers": same_blanks,
        "sentences": sents,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    print("== 데이터 자동 검사 ==")
    print("단어: " + ", ".join("%s %d개" % (k, v) for k, v in w_counts.items()))
    print("문장: " + ", ".join("%s %d개 (조각 3개 이상 %d)" % (k, v, build_ready[k]) for k, v in s_counts.items()))
    tw, ts = tally(w_issues), tally(s_issues)
    print("단어 검사: 오류 %(error)d, 주의 %(warn)d, 참고 %(info)d" % tw)
    print("문장 검사: 오류 %(error)d, 주의 %(warn)d, 참고 %(info)d" % ts)
    if not quiet:
        for title, xs in (("단어", w_issues), ("문장", s_issues)):
            for lvl, mark in (("error", "[오류]"), ("warn", "[주의]"), ("info", "[참고]")):
                for x in xs:
                    if x["level"] == lvl:
                        ent = x["entry"] if isinstance(x["entry"], str) else json.dumps(x["entry"], ensure_ascii=False)
                        print("%s %s %s: %s — %s" % (mark, title, x["where"], ent, x["msg"]))
    print("결과 파일: %s" % OUT.relative_to(ROOT))
    return 1 if (tw["error"] or ts["error"]) else 0


if __name__ == "__main__":
    sys.exit(main())
