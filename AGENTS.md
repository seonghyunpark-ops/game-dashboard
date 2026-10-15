# 게임 데이터 대시보드 — AI 작업 안내

Firebase(Firestore)에 쌓인 게임 데이터를 실시간으로 보는 정적 웹앱. 빌드 도구 없음(순수 HTML + ES 모듈).
배포: https://seonghyunpark-ops.github.io/game-dashboard/ (GitHub Pages, `main` push 시 Actions 가 자동 배포)

## 파일
- `config.js` — 앱(데이터 소스) 목록. **새 앱 추가는 여기에 항목 하나 추가하는 것으로 끝난다.**
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
4. Firestore 규칙에 소유자 읽기 추가(아래 이메일만):
   `allow read: if request.auth != null && request.auth.token.email_verified == true && request.auth.token.email in ['seonghyun.park@theant.kr', 'psh920122@gmail.com'];`
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
