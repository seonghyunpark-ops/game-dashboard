// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > 웹 앱(</>) 등록 후 apiKey·appId 를 채운다.
// 웹 apiKey 는 비밀값이 아니다. 접근 제한은 보안 규칙이 한다.
// 새 앱은 label·firebase·collection 만 있어도 된다. columns·dateField·stats 를 빼면 데이터를 보고 자동 추정한다.
// 옵션: titleKey(카드 제목 필드), stats(카드 숫자 칸), analyticsUrl(상단 안내 링크),
//       columns[{ key, label, type: "number"|"date"|"bool", category: true(필터·분류 대상) }],
//       authJoin: true(Firebase Authentication 사용자 정보를 문서 ID=UID 로 합쳐 보기)

// Google Cloud 콘솔 > API 및 서비스 > 사용자 인증 정보 > OAuth 클라이언트 ID(웹). 승인된 JS 원본에 Pages 주소 등록.
// 이 키로 받은 토큰은 브라우저 메모리에만 있고 읽기 전용 범위만 요청한다.
export const GOOGLE = {
  clientId: "86068834992-picpdv7kt7npubtsg1imd6sc75m1b89j.apps.googleusercontent.com",
};

// AdMob 수익 탭. publisherId 를 비우면 로그인한 계정의 첫 AdMob 계정을 쓴다.
export const ADMOB = {
  publisherId: "pub-8231952947410935",
  currency: "KRW",
};

// UI gate only. Firestore rules enforce the same verified-email list server-side.
export const ADMIN_EMAILS = [
  "seonghyun.park@theant.kr",
  "psh920122@gmail.com",
  "theantplay55@gmail.com",
  "lee.ike1@gmail.com",
];

export const SOURCES = {
  seongsu: {
    label: "성수역",
    firebase: {
      apiKey: "AIzaSyDgrLtBoKcah93Zl0iXOkw55dlR4T_71kc",
      authDomain: "hazel-form-493202-a1.firebaseapp.com",
      projectId: "hazel-form-493202-a1",
      storageBucket: "hazel-form-493202-a1.firebasestorage.app",
      messagingSenderId: "86068834992",
      appId: "1:86068834992:web:198ac589d4bff29bb78175",
    },
    collection: "users",
    dateField: "updatedAt",
    titleKey: "displayName",
    authJoin: true,
    stats: ["maxStage", "totalStars", "clientAdsWatched", "clientInterstitialAdsWatched"],
    columns: [
      { key: "_id", label: "UID" },
      { key: "displayName", label: "이름" },
      { key: "playGamesPlayerId", label: "Play Games ID" },
      { key: "maxStage", label: "최고 스테이지", type: "number", category: true },
      { key: "totalStars", label: "별", type: "number" },
      { key: "clientAdsWatched", label: "보상광고", type: "number" },
      { key: "clientInterstitialAdsWatched", label: "전면광고", type: "number" },
      { key: "noAdsPurchased", label: "광고제거", type: "bool", category: true },
      { key: "appVersion", label: "버전", category: true },
      { key: "platform", label: "플랫폼", category: true },
      { key: "locale", label: "언어", category: true },
      { key: "lastSignInRouteCategory", label: "로그인 경로", category: true },
      { key: "createdAt", label: "가입", type: "date" },
      { key: "updatedAt", label: "최근 저장", type: "date" },
    ],
    analyticsUrl: "https://console.firebase.google.com/project/hazel-form-493202-a1/analytics",
  },
  egypt: {
    label: "이집트 디펜스",
    firebase: {
      apiKey: "AIzaSyAnFXanb40Q7EiFNxWx0FCMKidIt1xvHuM",
      authDomain: "egyptdefense-b6882.firebaseapp.com",
      projectId: "egyptdefense-b6882",
      appId: "1:926622019971:web:e7a86f0d96fb4eba2046b6",
    },
    collection: "coupons",
    dateField: "created_at",
    titleKey: "_id",
    stats: ["coin", "dia"],
    columns: [
      { key: "_id", label: "쿠폰 코드" },
      { key: "coin", label: "코인", type: "number" },
      { key: "dia", label: "다이아", type: "number" },
      { key: "memo", label: "메모", category: true },
      { key: "used", label: "사용됨", type: "bool", category: true },
      { key: "used_by", label: "사용자" },
      { key: "created_at", label: "발급", type: "date" },
      { key: "used_at", label: "사용 시각", type: "date" },
    ],
  },
  lumiclass: {
  "label": "LumiClass 회원",
  "firebase": {
    "apiKey": "AIzaSyABl_R8tK0aLgtHSTJ6yBJQ0pDwXWd_S7A",
    "authDomain": "lumiclass-ff4a6.firebaseapp.com",
    "projectId": "lumiclass-ff4a6",
    "appId": "1:239754447635:web:b8b6d9c41dbabf321d68e6"
  },
  "collection": "reporting_users",
  columns: [
    { key: "_id", label: "회원 ID" },
    { key: "name", label: "이름" },
    { key: "email", label: "이메일" },
    { key: "role", label: "역할", category: true },
    { key: "loginProviders", label: "로그인 방식", category: true },
    { key: "createdAt", label: "가입일", type: "date" },
    { key: "lastLoginAt", label: "최근 로그인", type: "date" },
    { key: "creditBalance", label: "크레딧 잔액", type: "number" },
    { key: "activeCourses", label: "수강 중", type: "number" },
    { key: "totalOrders", label: "주문 수", type: "number" },
    { key: "progressRecords", label: "학습 기록 수", type: "number" },
    { key: "questionCount", label: "문의 수", type: "number" },
    { key: "syncedAt", label: "동기화 시각", type: "date" },
  ]
},
  lumiclass_metrics: {
  "label": "LumiClass 매출",
  "firebase": {
    "apiKey": "AIzaSyABl_R8tK0aLgtHSTJ6yBJQ0pDwXWd_S7A",
    "authDomain": "lumiclass-ff4a6.firebaseapp.com",
    "projectId": "lumiclass-ff4a6",
    "appId": "1:239754447635:web:b8b6d9c41dbabf321d68e6"
  },
  "collection": "reporting_metrics"
},
  lumiclass_costs: {
  "label": "LumiClass 비용",
  "firebase": {
    "apiKey": "AIzaSyABl_R8tK0aLgtHSTJ6yBJQ0pDwXWd_S7A",
    "authDomain": "lumiclass-ff4a6.firebaseapp.com",
    "projectId": "lumiclass-ff4a6",
    "appId": "1:239754447635:web:b8b6d9c41dbabf321d68e6"
  },
  "collection": "reporting_costs"
},
  aicena: {
  "label": "AICENA",
  "firebase": {
    "apiKey": "AIzaSyDIJ7OpKGBvjt1GUhUVjYPEDEqN1UeU87c",
    "authDomain": "aicena.firebaseapp.com",
    "projectId": "aicena",
    "appId": "1:213477347368:web:6a2f9299dbaa2b5052651d"
  },
  "collection": "accounts"
},
};
