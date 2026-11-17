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
    ("const BEST_KEY='chacha_v4_high_score';", "const BEST_KEY='chacha_alternate_high_score';"),
    ("$('start').onclick=start;$('retry').onclick=start;", "$('start').onclick=()=>window.chachaQuizGate.request(start);$('retry').onclick=()=>window.chachaQuizGate.request(start);")
])
# Copy the self-contained 100-question bank and the answer gate into the independent edition.
shutil.copy2(ROOT / 'quiz' / 'quiz-bank.js', dst / 'quiz-bank.js')
shutil.copy2(ROOT / 'quiz' / 'quiz-gate.js', dst / 'quiz-gate.js')

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
# The alternate edition is independent of the arcade hub and installable on its own.
html = html.replace('가루 오락실 앱 설치', '달려라 챠챠 독립판 설치')
html = html.replace('title="가루 오락실 앱 설치"', 'title="독립판 설치"')
html = html.replace('<script defer src="visit.js" data-garu-game="chacha"></script>', '')
html = html.replace('<link rel="icon" type="image/png"', '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png"')
html = html.replace('<script src="ranking.js?v=4.0.0"></script>',
                    '<script src="quiz-bank.js?v=1.0.0"></script><script src="quiz-gate.js?v=1.1.0"></script><script src="ranking.js?v=4.0.0"></script>')
html = html.replace('<div id="appMessage"', '''<dialog id="quizDialog" class="quiz-dialog" aria-labelledby="quizQuestion" aria-describedby="quizFeedback">
  <div class="quiz-shell">
    <p id="quizCategory" class="quiz-category">오늘의 학습 퀴즈</p>
    <h2 id="quizQuestion">문제를 불러오는 중...</h2>
    <p class="quiz-instruction">알맞은 답을 고르면 게임이 시작됩니다.</p>
    <div id="quizChoices" class="quiz-choices"></div>
    <p id="quizFeedback" role="status" aria-live="polite"></p>
  </div>
</dialog><div id="appMessage"''')
(dst / 'index.html').write_text(html, encoding='utf-8')
# /alternate/play.html must enforce the same quiz gate; never expose an ungated entry point.
(dst / 'play.html').write_text(html, encoding='utf-8')
# Add visually distinct, mobile-friendly quiz buttons only to the independent edition.
with (dst / 'style.css').open('a', encoding='utf-8') as css:
    css.write("""
.quiz-dialog{border:1px solid #73885e;border-radius:20px;max-width:min(94vw,540px);width:100%;padding:0;color:#f0f1e7;background:#1a231b;box-shadow:0 20px 80px #000b}
.quiz-dialog::backdrop{background:#080c08d9}
.quiz-shell{padding:clamp(18px,4vw,32px)}
.quiz-category{margin:0;color:#d4ed8a;font-size:14px;font-weight:800}
.quiz-shell h2{margin:14px 0 8px;font-size:clamp(19px,4.8vw,28px);line-height:1.45;word-break:keep-all}
.quiz-instruction{color:#c7d0bf;margin:0 0 20px}
.quiz-choices{display:grid;grid-template-columns:1fr;gap:10px}
.quiz-choice{width:100%;min-height:54px;padding:13px 16px;text-align:left;font-size:clamp(15px,4vw,19px);font-weight:700;background:#303c2e;border:1px solid #53674d;border-radius:12px;white-space:normal;word-break:keep-all}
.quiz-choice:hover,.quiz-choice:focus-visible{background:#465e3c}
.quiz-choice.quiz-wrong{border-color:#d7776b;background:#583530}
#quizFeedback{margin:16px 0 0;color:#d4ed8a;min-height:1.4em;font-weight:700}
@media(max-height:540px){.quiz-dialog{max-height:96vh;overflow-y:auto}.quiz-shell{padding:12px}.quiz-choice{min-height:38px;padding:7px 12px}.quiz-shell h2{margin:7px 0}.quiz-instruction{margin-bottom:8px}}
""")

replace_file('manifest.webmanifest', [
    ('"name": "달려라, 챠챠!"', '"name": "달려라, 챠챠! 독립판"'),
    ('"short_name": "챠챠!"', '"short_name": "챠챠 독립판"')
])
# The alternate uses its own install prompt and does not redirect to the arcade homepage.
standalone_pwa = """'use strict';
(() => {
  const button = document.getElementById('install');
  const status = document.getElementById('appMessage');
  let deferredPrompt = null;
  let timeoutId;
  const show = message => {
    if (!status) return;
    clearTimeout(timeoutId);
    status.textContent = message;
    status.hidden = false;
    timeoutId = setTimeout(() => status.hidden = true, 9000);
  };
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  button.setAttribute('aria-label', '달려라 챠챠 독립판 설치');
  button.title = '독립판 설치';
  button.innerHTML = '<span>앱</span><span>설치</span>';
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    show('독립판 설치가 완료되었습니다.');
  });
  button.addEventListener('click', async () => {
    if (installed()) {
      show('현재 독립판 앱으로 실행 중입니다.');
      return;
    }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      return;
    }
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) {
      show('Safari 공유 버튼을 누르고 홈 화면에 추가를 선택해 주세요.');
    } else {
      show('브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해 주세요.');
    }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    window.addEventListener('load', () => {
      let updating = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updating) location.reload();
      });
      navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'}).then(reg => {
        const offerUpdate = () => {
          if (!reg.waiting) return;
          show('독립판 업데이트가 준비되었습니다. 페이지를 새로고침해 주세요.');
        };
        reg.update().catch(() => {});
        offerUpdate();
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
          });
        });
      }).catch(() => show('오프라인 저장에 실패했습니다. 온라인 플레이는 계속 가능합니다.'));
    });
  }
})();
"""
(dst / 'pwa.js').write_text(standalone_pwa, encoding='utf-8')

replace_file('sw.js', [
    ("chacha-release-4.0.0-arcade-home-1", "chacha-alternate-release-4.1.1-quiz-2"),
    ("name.startsWith('chacha-release-')", "name.startsWith('chacha-alternate-release-')"),
    ("'./manifest.webmanifest','./assets/chowRun.jpg'", "'./manifest.webmanifest','./quiz-bank.js?v=1.0.0','./quiz-gate.js?v=1.1.0','./assets/chowRun.jpg'")
])
replace_file('notices.js', [
    ("'chacha_patchnote_v400_seen'", "'chacha_alternate_patchnote_v400_seen'"),
    ("'chacha_ranking_v4_notice_seen'", "'chacha_alternate_ranking_notice_seen'")
])
# Fail fast if the generated edition accidentally refers to the original ranking API.
assert "/functions/v1/ranking'" not in (dst / 'ranking.js').read_text(encoding='utf-8')
assert "chacha_v4_high_score" not in (dst / 'chacha.js').read_text(encoding='utf-8')
assert "garu-arcade-hub" not in (dst / 'pwa.js').read_text(encoding='utf-8')
assert "가루 오락실 앱 설치" not in (dst / 'index.html').read_text(encoding='utf-8')
assert 'rel="manifest"' in (dst / 'index.html').read_text(encoding='utf-8')
assert 'chachaQuizGate.request(start)' in (dst / 'chacha.js').read_text(encoding='utf-8')
assert 'quiz-gate.js?v=1.1.0' in (dst / 'index.html').read_text(encoding='utf-8')
assert 'quiz-bank.js?v=1.0.0' in (dst / 'sw.js').read_text(encoding='utf-8')
print('PASS: independent /alternate/ edition with 100-question start/retry gate, PWA and separate ranking')
