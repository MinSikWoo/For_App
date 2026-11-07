"""일본어 단어 카드 게임을 '비밀번호로 잠긴 설치형 웹앱'으로 만든다.

하는 일
  1. japanese-word-game/ 의 파일(index.html, style.css, *.js)을 HTML 한 장으로 합친다.
  2. 그 HTML 을 비밀번호로 암호화한다 (PBKDF2-SHA256 60만 회 + AES-256-GCM).
     비밀번호 없이는 아무도 내용을 볼 수 없으므로 공개 저장소에 올려도 안전하다.
  3. 잠금 화면, 오프라인 실행 파일(sw.js), 앱 설치 정보(manifest), 아이콘을 함께 출력한다.

사용법
  비밀번호는 .env 의 APP_PASSWORD 에 둔다 (코드나 GitHub 에 절대 넣지 않는다).
  비밀번호가 없으면 새로 만들어 .env 에 저장하고 화면에 한 번 보여준다.

    python3 tools/build_pwa.py            # 결과: pwa/ 폴더
    python3 tools/build_pwa.py --out 다른폴더
"""
import argparse
import base64
import hashlib
import json
import os
import re
import secrets
import shutil
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "japanese-word-game"
TEMPLATE = Path(__file__).resolve().parent / "pwa_template"
ENV = ROOT / ".env"
ITERATIONS = 600_000

# 비밀번호 만들 때 쓰는 쉬운 단어들 (일본어 로마자)
WORDS = ("neko inu usagi kuma tori sakura hana sora umi yama kawa hoshi tsuki "
         "mizu ame yuki kaze momo ringo mikan ichigo dango sushi ocha pan kasa "
         "hon kuruma eki mori ike shima").split()


def read_env():
    env = {}
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def get_password():
    pw = os.environ.get("APP_PASSWORD") or read_env().get("APP_PASSWORD")
    if pw:
        return pw, False
    pw = "-".join(secrets.choice(WORDS) for _ in range(3)) + "-" + str(secrets.randbelow(90) + 10)
    with ENV.open("a", encoding="utf-8") as f:
        f.write(("\n" if ENV.exists() and ENV.read_text(encoding="utf-8") and not ENV.read_text(encoding="utf-8").endswith("\n") else "")
                + f"APP_PASSWORD={pw}\n")
    return pw, True


def bundle():
    """index.html 에 CSS/JS 를 끼워 넣어 완전한 HTML 한 장으로 만든다."""
    page = (GAME / "index.html").read_text(encoding="utf-8")

    def css(m):
        return "<style>\n" + (GAME / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        src = (GAME / m.group(1)).read_text(encoding="utf-8")
        if "</script" in src.lower():
            sys.exit(f"오류: {m.group(1)} 안에 </script> 글자가 있어 합칠 수 없습니다.")
        return "<script>\n" + src + "\n</script>"

    page = re.sub(r'<link rel="stylesheet" href="([\w.-]+\.css)">', css, page)
    page = re.sub(r'<script src="([\w.-]+\.js)"></script>', js, page)
    if re.search(r'(href|src)="(?!https?:)[\w.-]+\.(css|js)"', page):
        sys.exit("오류: 합치지 못한 파일 연결이 남아 있습니다. index.html 을 확인하세요.")

    head = (
        '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#FF8DA6">\n<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" href="icons/icon-192.png">\n'
        # 아티팩트 화면이 넣어주던 기본 설정을 여기서 직접 넣는다
        "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
        "body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
    )
    # <title> 과 <meta>/<link> 들은 head 로, 나머지는 body 로
    split = page.find("<style>")
    return head + page[:split] + page[split:].replace("<div class=\"app\"", "</head>\n<body>\n<div class=\"app\"", 1) + "\n</body>\n</html>\n"


def encrypt(html, password):
    salt, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(password.encode())
    ct = AESGCM(key).encrypt(iv, html.encode("utf-8"), None)
    b = lambda x: base64.b64encode(x).decode()
    return {"v": 1, "iter": ITERATIONS, "salt": b(salt), "iv": b(iv), "ct": b(ct)}


def build_artifact(out, data):
    """Claude 아티팩트(공유 링크)용 잠금 페이지.
    아티팩트는 문서 틀(<html>, <head>)을 스스로 씌우고, 오프라인 실행 파일(sw.js)·앱 설치 정보는 쓸 수 없다.
    그래서 잠금 화면에서 그 부분만 빼고, 암호화된 게임은 app.json 으로 함께 올린다."""
    page = (TEMPLATE / "index.html").read_text(encoding="utf-8")
    for pat in [r"<!doctype html>\s*", r"<html[^>]*>\s*", r"</?head>\s*", r"</?body>\s*", r"</html>\s*",
                r'<meta charset[^>]*>\s*', r'<meta name="viewport"[^>]*>\s*',
                r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*',
                r"\s*if \('serviceWorker' in navigator\)[^\n]*"]:
        page = re.sub(pat, "", page, flags=re.I)
    page = page.replace("fetch('app.enc'", "fetch('app.json'")
    page = page.replace("<title>일본어 단어 카드</title>", "<title>공유용 단어 카드</title>")
    # 아티팩트는 body 배경을 직접 칠해야 하므로 html 높이 설정만 유지
    if out.exists():
        shutil.rmtree(out)
    (out / "icons").mkdir(parents=True)
    (out / "index.html").write_text(page, encoding="utf-8")
    (out / "app.json").write_text(data, encoding="utf-8")
    shutil.copy(TEMPLATE / "icons" / "icon-192.png", out / "icons" / "icon-192.png")
    print(f"Claude 공유용: {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "pwa"))
    ap.add_argument("--plain", help="(검사용) 암호화 전 HTML 을 이 경로에 저장")
    ap.add_argument("--artifact", help="Claude 공유 링크용 잠긴 페이지를 이 폴더에 만든다 (GitHub 없이 링크로 공유)")
    args = ap.parse_args()
    out = Path(args.out)

    password, created = get_password()
    html = bundle()
    if args.plain:
        Path(args.plain).write_text(html, encoding="utf-8")
    data = json.dumps(encrypt(html, password))
    version = hashlib.sha256(html.encode()).hexdigest()[:12]

    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(TEMPLATE, out)
    (out / "app.enc").write_text(data, encoding="utf-8")
    sw = out / "sw.js"
    sw.write_text(sw.read_text(encoding="utf-8").replace("__VERSION__", "jw-" + version), encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")

    if args.artifact:
        build_artifact(Path(args.artifact), data)

    print(f"완료: {out}  (버전 jw-{version}, 게임 {len(html):,}자 → 암호화됨)")
    if created:
        print(f"새 비밀번호를 만들어 .env 에 저장했습니다: {password}")


if __name__ == "__main__":
    main()
