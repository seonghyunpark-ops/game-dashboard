# 게임 데이터 대시보드 — AI 작업 안내

Firebase(Firestore)에 쌓인 게임 데이터를 실시간으로 보는 정적 웹앱. 빌드 도구 없음(순수 HTML + ES 모듈).
배포: https://seonghyunpark-ops.github.io/game-dashboard/ (GitHub Pages, `main` push 시 Actions 가 자동 배포)

## 파일
- `config.js` — 앱(데이터 소스) 목록. **새 앱 추가는 여기에 항목 하나 추가하는 것으로 끝난다.**
- `session.js` — 관리 계정의 Google 로그인 한 번으로 프로젝트별 Firebase 세션을 연결한다. 같은 프로젝트의 탭은 세션을 공유하고, 전체 로그아웃 시 모든 앱 세션과 화면 캐시를 비운다. 허용 목록은 `config.js`의 `ADMIN_EMAILS`와 운영 Firestore 규칙에 함께 반영한다.
- `session.test.mjs` — 통합 로그인·계정 차단·전체 로그아웃 회귀 검사(`node --test session.test.mjs`).
- `google.js` — Google OAuth 토큰(GIS, 메모리 보관)으로 AdMob 보고서·Firebase Authentication 사용자 목록을 읽는다. OAuth 클라이언트는 GCP 프로젝트 hazel-form-493202-a1(테스트 모드, 테스트 사용자만 로그인 가능).
- `app.js` — 로그인, Firestore 실시간 구독(onSnapshot), 필터·분류·정렬·CSV, 컬럼 자동 추정, 새 버전 감지.
- `index.html` — 레이아웃과 CSS(색은 `:root` 변수, 다크모드 포함). 900px 이하는 표 대신 카드 목록.
- `version.json` — 저장소에는 `dev`. 배포 때 Actions 가 커밋 SHA 로 덮어쓴다. 직접 올릴 필요 없음.
- `.github/workflows/pages.yml` — 배포 워크플로.
- `rules/` — Firestore 보안 규칙 제안본(운영 반영은 사람이 콘솔에서).

## 새 앱 추가 절차
1. 해당 Firebase 프로젝트에 웹 앱 등록 → apiKey·appId 확보.
2. Authentication > 로그인 방법 > Google 사용 설정.
3. Authentication > 설정 > 승인된 도메인에 `seonghyunpark-ops.github.io` 추가.
   (Google Cloud 프로젝트 IAM 에 theantplay55@gmail.com 을 소유자로 두면 로그인 정보 합치기도 그 계정으로 가능)
4. Firestore 규칙에 소유자 읽기 추가(아래 이메일만):
   `allow read: if request.auth != null && request.auth.token.email_verified == true && request.auth.token.email in ['seonghyun.park@theant.kr', 'psh920122@gmail.com', 'theantplay55@gmail.com', 'lee.ike1@gmail.com'];`
5. `config.js` 의 `SOURCES` 에 항목 추가:
   ```js
   newgame: {
     label: "새 게임",
     firebase: { apiKey: "...", authDomain: "<id>.firebaseapp.com", projectId: "<id>", appId: "..." },
     collection: "users",
   },
   ```
   `columns` 를 생략하면 데이터를 보고 자동 추정한다. 보기 좋게 다듬고 싶을 때만 `columns`·`titleKey`·`stats`·`dateField` 를 적는다.
6. `main` 에 push. 열려 있는 대시보드에 1~2분 안에 "업데이트" 버튼이 뜬다.

## 지켜야 할 것
- 데이터는 읽기 전용. 대시보드에서 Firestore 에 쓰지 않는다.
- 운영 보안 규칙의 기존 줄(게임 클라이언트용)은 고치지 말고 소유자 읽기 줄만 덧붙인다.
- 외부 스크립트는 고정 버전 CDN 만(firebase 10.12.2, Pretendard v1.3.9).
- 서비스 계정 키·비밀번호 같은 비밀값은 저장소에 넣지 않는다(공개 저장소). 웹 apiKey 는 공개용이라 괜찮다.
- 로컬 확인: 아무 정적 서버로 폴더를 열면 된다(예: `npx serve .`). Google 로그인은 승인된 도메인(localhost 기본 포함)에서만 된다.

## 현재 데이터 소스
- 성수역 `hazel-form-493202-a1` / `users/{uid}` — 세이브 요약(최고 스테이지·별·광고·버전·플랫폼·언어). Analytics 이벤트(ss_*)는 GA4 에만 있어 여기서 못 읽는다.
- 이집트 디펜스 `egyptdefense-b6882` / `coupons/{code}` — Firestore DB 가 아직 생성되지 않아 비어 있음.

- LumiClass `lumiclass-ff4a6` / `reporting_users`, `reporting_metrics`, `reporting_costs` — 비밀번호가 없는 보고용 컬렉션만 읽는다.
- AICENA `aicena` / `accounts/{uid}` — Google 제공자와 대시보드 도메인 설정 완료. 현재 데이터는 비어 있음.
- 2026-10-15: 검증된 관리 이메일 4개에 대시보드 읽기 허용(이집트는 DB 미생성으로 운영 규칙 게시 대상 없음). 성수역·LumiClass·AICENA 게시 사본은 `rules/`에 보존. 기존 게임 클라이언트 규칙은 변경하지 않았다.

## 통합 Google 로그인 운영 설정
- 2026-10-16: 성수역·이집트·LumiClass·AICENA의 Firebase Google 제공자는 공통 웹 클라이언트 `86068834992-1oeh3vg3mjtr8qs5tgb4tuaehc15qpn5.apps.googleusercontent.com`을 사용한다. 소유 프로젝트는 `hazel-form-493202-a1`이다. 서로 다른 클라이언트를 사용하면 대시보드의 공통 Google 토큰이 다른 프로젝트에서 `access_token audience is not for this project`로 거절될 수 있다.
- 공통 클라이언트의 기존 리디렉션 URI를 보존하고 각 앱의 `https://<project-id>.firebaseapp.com/__/auth/handler`를 함께 등록한다. 2026-10-16 사용자가 AICENA·LumiClass·이집트 콜백 추가 저장을 완료했다.
- Google 제공자의 클라이언트 비밀값은 Google 설정 사이에서만 전달한다. 파일·로그·저장소에 저장하지 않는다. `config.js`의 별도 Google API 클라이언트(광고 수익·Authentication 목록용)와 혼동하지 않는다.
- Google 프로젝트 조회 API의 `clientId` 검사 결과만으로 외부 클라이언트의 실제 Firebase 로그인을 판정하지 않는다. 대시보드에서 실제 Google 로그인 후 프로젝트별 세션 연결과 Firestore 조회를 검증한다.
