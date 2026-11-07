# 달려라, 챠챠! 🐶🥬

복슬복슬 차우차우 차차가 무와 배추를 뛰어넘는 웹 달리기 게임입니다.

## 게임

- 네 발이 공중에 뜨는 달리기 애니메이션
- 단일 점프, 점점 빨라지는 속도, 브라우저별 최고 기록
- 키보드·마우스·모바일 터치 지원
- 앱 설치와 오프라인 실행을 위한 PWA 설정
- 외부 CDN, 로그인, 데이터베이스 없이 실행

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
