# 달려라, 챠챠! 🐶🥬

복슬복슬 차우차우 차차가 무와 배추를 뛰어넘는 웹 달리기 게임입니다.

## 게임

- 네 발이 공중에 뜨는 달리기 애니메이션
- 이중 점프, 구간별 패턴 난이도, v3 전용 개인 최고 기록
- 키보드·마우스·모바일 터치 지원
- 앱 설치와 오프라인 실행을 위한 PWA 설정
- 기본 게임은 로그인 없이 실행, 온라인 랭킹은 Supabase 연결

Space / ↑ / 화면 클릭으로 점프하고 P / Escape로 일시정지합니다.

## GitHub Pages

저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다. 이후 `main`에 변경을 올리면 `.github/workflows/pages.yml`이 게임 검사와 배포를 수행합니다. 필요하면 Actions 탭에서 `Publish Chacha to GitHub Pages`를 수동 실행할 수 있습니다.

성공적으로 배포한 뒤 사용할 주소는 https://dreamingchick.github.io/run-chacha/ 입니다. 배포 완료 여부는 Actions의 deploy 작업에서 확인하세요.

## 로컬 개발

Python 3와 Node.js 20 이상이 필요합니다. 패키지 설치는 필요하지 않습니다.

```sh
python scripts/restore-assets.py
node check.cjs
node release-check.cjs
python -m http.server 8765 --directory dist
```

브라우저에서 http://localhost:8765 를 엽니다. 이미지 원본은 `asset-data/`에 Base64 텍스트로 보관하며 빌드할 때 `dist/assets/`로 손실 없이 복원합니다.

게임 소스는 `dist/chacha.js`, 화면은 `dist/index.html`, 스타일은 `dist/style.css`입니다. `dist/release.json`은 파일 무결성 해시입니다. 게임 파일이나 이미지를 수정하면 이 해시와 `sw.js`의 캐시 이름도 갱신해야 합니다.

## 기록과 업데이트

최고 기록은 해당 브라우저의 `localStorage`에 저장됩니다. 앱 설치는 HTTPS 환경에서 지원하는 브라우저로 이용합니다. 처음 온라인으로 접속해 전체 캐시가 준비된 뒤 오프라인으로 실행할 수 있습니다. 새 버전은 기존 탭을 모두 닫은 다음 적용됩니다.

게임 에셋과 초기 구현은 사용자가 제공한 Gemini 프로젝트에서 이어받았습니다. 원본: https://gemini.google.com/app/2afdbd58746af431

실제 기기의 설치·오프라인 재접속·브라우저별 터치 검증은 별도로 확인해야 합니다.

## 온라인 랭킹

게임이 끝난 뒤 닉네임(2~12자)과 함께 기록을 직접 등록할 수 있습니다. 전체 상위 20명을 보여주며 같은 브라우저의 최고 기록 하나만 표시합니다. 동점이면 먼저 달성한 기록이 앞섭니다. 닉네임과 기록은 공개됩니다. 브라우저 저장소를 지우거나 다른 기기를 사용하면 별도 플레이어로 취급됩니다.

랭킹 백엔드는 Supabase 프로젝트 `run-chacha`(서울)의 `ranking` Edge Function입니다. `backend/schema.sql`에 스키마, `backend/ranking/`에 함수 소스가 있습니다. 프런트엔드에는 publishable 키만 포함되며, 서버용 키는 Supabase 환경 변수에서만 읽습니다. 테이블 직접 접근은 차단되어 있습니다.

서버는 게임 시작 시 발급한 일회용 기록, 경과 시간, 최고 기록 갱신을 검사합니다. 점수는 제출된 시뮬레이션 tick 수로 재계산합니다. 장애물 회피 입력 전체를 재현하는 검증은 없으므로 경쟁 대회 수준의 부정행위 방지를 보장하지는 않습니다. 오프라인에서는 게임은 실행되지만 온라인 랭킹 등록은 새 온라인 게임부터 가능합니다.

`node ranking-check.cjs`로 점수 계산 일치, 닉네임 검사, 중복 제출과 안전한 화면 출력을 검사합니다. 랭킹 API 응답은 오프라인 캐시에 저장하지 않습니다.

## v3

0~499m 적응(소형 단독·2연속), 500~1,499m 리듬(대형·까마귀·연속 및 밀집 10%), 1,500m 이상 도전(밀집 20%) 구간으로 진행합니다. 점수 계산과 최고 속도는 v2와 같습니다. 낮·오후·노을 배경은 구간별로 한 번씩 캐시하고 재사용합니다.

v3는 chacha_v3_high_score 저장 키와 chacha_scores_v3 랭킹을 사용하며 v1·v2는 보존합니다. 기존 DB에는 backend/v3-ranking.sql을 한 번 적용한 뒤 backend/ranking 함수를 배포합니다. 신규 DB에는 backend/schema.sql을 사용합니다. 이후 웹 파일을 배포합니다. v3 게임 시작으로 발급된 run만 v3 등록을 허용합니다.
