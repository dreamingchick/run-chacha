#!/usr/bin/env python3
"""Build a second, isolated leaderboard edition without altering the original release."""
from pathlib import Path
import shutil
import re

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / 'dist'
dst = src / 'alternate'
if dst.exists():
    shutil.rmtree(dst)
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('alternate'))

def replace_file(name, pairs):
    path = dst / name
    data = path.read_text(encoding='utf-8')
    for before, after in pairs:
        if before not in data:
            raise RuntimeError(f'Missing expected marker in {name}: {before[:80]}')
        data = data.replace(before, after)
    path.write_text(data, encoding='utf-8')

replace_file('chacha.js', [
    ("const BEST_KEY='chacha_v4_high_score';", "const BEST_KEY='chacha_alternate_high_score';")
])
replace_file('ranking.js', [
    ("/functions/v1/ranking'", "/functions/v1/ranking-alternate'"),
    ('const currentVersion=4;', 'const currentVersion=5;'),
    ("'chacha_player_token'", "'chacha_alternate_player_token'"),
    ("'chacha_nickname'", "'chacha_alternate_nickname'"),
    ("[[4,'rankV4'],[3,'rankV3'],[2,'rankV2'],[1,'rankV1']]", "[[5,'rankV4']]"),
    ("el('rankV3').addEventListener('click',()=>selectVersion(3));", ""),
    ("el('rankV2').addEventListener('click',()=>selectVersion(2));", ""),
    ("el('rankV1').addEventListener('click',()=>selectVersion(1));", ""),
    ("'V'+version+' · TOP 20'", "'독립 · TOP 20'")
])
html = (dst / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<button id="rankV[123]"[^>]*>[^<]*</button>', '', html)
html = html.replace('v4 랭킹</button>', '독립 랭킹</button>')
html = html.replace('V4 · TOP 20', '독립 · TOP 20')
html = html.replace('이전 v4 최고', '이전 최고')
html = html.replace('v4 최고 기록을 넘으면', '신규판 최고 기록을 넘으면')
html = html.replace('v4 개인 최고 기록을 넘으면', '신규판 개인 최고 기록을 넘으면')
html = html.replace('v1~v3 랭킹은 각 탭에서 볼 수 있어요.', '기존판 랭킹과는 완전히 분리하여 운영합니다.')
html = html.replace('v4 랭킹을 새로 시작해요', '독립 랭킹을 새로 시작해요')
html = html.replace('<span class="edition">작은 발걸음, 커다란 모험.</span>', '<span class="edition">작은 발걸음, 커다란 모험. · 독립 랭킹</span>')
(dst / 'index.html').write_text(html, encoding='utf-8')
replace_file('manifest.webmanifest', [
    ('"name": "달려라, 챠챠!"', '"name": "달려라, 챠챠! 독립판"'),
    ('"short_name": "챠챠!"', '"short_name": "챠챠 독립판"')
])
replace_file('sw.js', [
    ("chacha-release-4.0.0-arcade-home-1", "chacha-alternate-release-4.0.0-1"),
    ("name.startsWith('chacha-release-')", "name.startsWith('chacha-alternate-release-')")
])
replace_file('notices.js', [
    ("'chacha_patchnote_v400_seen'", "'chacha_alternate_patchnote_v400_seen'"),
    ("'chacha_ranking_v4_notice_seen'", "'chacha_alternate_ranking_notice_seen'")
])
# Fail fast if the generated edition accidentally refers to the original ranking API.
assert "/functions/v1/ranking'" not in (dst / 'ranking.js').read_text(encoding='utf-8')
assert "chacha_v4_high_score" not in (dst / 'chacha.js').read_text(encoding='utf-8')
print('PASS: independent /alternate/ edition created with separate storage, API, PWA cache')
