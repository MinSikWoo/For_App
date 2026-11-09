"""SJPT 말하기 연습 앱을 '비밀번호로 잠긴 공유 링크(Claude 아티팩트)'용으로 만든다.

하는 일
  1. sjpt/ 의 파일(index.html, style.css, app.js, data/*.js)을 HTML 한 장으로 합친다.
  2. 그 HTML 을 비밀번호로 암호화한다 (PBKDF2-SHA256 60만 회 + AES-256-GCM).
     비밀번호 없이는 아무도 내용을 볼 수 없다.
  3. 잠금 화면(index.html)과 암호화된 앱(app.json)을 출력 폴더에 만든다.
     → 이 두 파일을 아티팩트로 올리면 링크로 열 수 있다.

사용법
  비밀번호는 .env 의 SJPT_PASSWORD 에 둔다 (코드나 GitHub 에 절대 넣지 않는다).
  비밀번호가 없으면 새로 만들어 .env 에 저장하고 화면에 한 번 보여준다.

    python3 tools/build_locked_app.py                 # 결과: .tmp/sjpt-locked/
    python3 tools/build_locked_app.py --out 다른폴더
"""
import argparse
import base64
import hashlib
import json
import os
import re
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "sjpt"
LOCK = Path(__file__).resolve().parent / "locked_template" / "lock.html"
ENV = ROOT / ".env"
ENV_KEY = "SJPT_PASSWORD"
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
    pw = os.environ.get(ENV_KEY) or read_env().get(ENV_KEY)
    if pw:
        return pw, False
    pw = "-".join(secrets.choice(WORDS) for _ in range(3)) + "-" + str(secrets.randbelow(90) + 10)
    prev = ENV.read_text(encoding="utf-8") if ENV.exists() else ""
    with ENV.open("a", encoding="utf-8") as f:
        f.write(("\n" if prev and not prev.endswith("\n") else "") + f"{ENV_KEY}={pw}\n")
    return pw, True


def bundle():
    """index.html 에 CSS/JS 를 끼워 넣어 완전한 HTML 한 장으로 만든다."""
    page = (APP / "index.html").read_text(encoding="utf-8")

    def css(m):
        return "<style>\n" + (APP / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        src = (APP / m.group(1)).read_text(encoding="utf-8")
        if "</script" in src.lower():
            sys.exit(f"오류: {m.group(1)} 안에 </script> 글자가 있어 합칠 수 없습니다.")
        return "<script>\n" + src + "\n</script>"

    page = re.sub(r'<link rel="stylesheet" href="([\w./-]+\.css)">', css, page)
    page = re.sub(r'<script src="([\w./-]+\.js)"></script>', js, page)
    if re.search(r'(href|src)="(?!https?:|data:)[\w./-]+\.(css|js)"', page):
        sys.exit("오류: 합치지 못한 파일 연결이 남아 있습니다. sjpt/index.html 을 확인하세요.")
    return page


def encrypt(html, password):
    salt, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(password.encode())
    ct = AESGCM(key).encrypt(iv, html.encode("utf-8"), None)
    b = lambda x: base64.b64encode(x).decode()
    return {"v": 1, "iter": ITERATIONS, "salt": b(salt), "iv": b(iv), "ct": b(ct)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / ".tmp" / "sjpt-locked"))
    ap.add_argument("--plain", help="(검사용) 암호화 전 HTML 을 이 경로에 저장")
    args = ap.parse_args()
    out = Path(args.out)

    password, created = get_password()
    html = bundle()
    if args.plain:
        Path(args.plain).write_text(html, encoding="utf-8")
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(LOCK.read_text(encoding="utf-8"), encoding="utf-8")
    (out / "app.json").write_text(json.dumps(encrypt(html, password)), encoding="utf-8")

    version = hashlib.sha256(html.encode()).hexdigest()[:12]
    print(f"완료: {out}  (버전 {version}, 앱 {len(html):,}자 → 암호화됨)")
    if created:
        print(f"새 비밀번호를 만들어 .env 에 저장했습니다: {password}")


if __name__ == "__main__":
    main()
