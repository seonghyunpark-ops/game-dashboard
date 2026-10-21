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
  "hc.lee@theant.kr",
  "hyunjin.kim@theant.kr",
  "juyi.kim@theant.kr",
  "hyerin.kim@theant.kr",
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
  "label": "캠퍼스마루 회원",
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
    { key: "nickname", label: "닉네임" },
    { key: "email", label: "이메일" },
    { key: "role", label: "역할(admin 관리자·instructor 강사·student 학생)", category: true },
    { key: "signupCompletedAt", label: "가입정보 입력일", type: "date" },
    { key: "marketingAgreed", label: "마케팅 동의", type: "bool", category: true },
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
  "label": "캠퍼스마루 매출",
  "firebase": {
    "apiKey": "AIzaSyABl_R8tK0aLgtHSTJ6yBJQ0pDwXWd_S7A",
    "authDomain": "lumiclass-ff4a6.firebaseapp.com",
    "projectId": "lumiclass-ff4a6",
    "appId": "1:239754447635:web:b8b6d9c41dbabf321d68e6"
  },
  "collection": "reporting_metrics"
},
  lumiclass_costs: {
  "label": "캠퍼스마루 비용",
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

// 같은 앱은 상단에서 한 탭으로 묶고 데이터 종류를 아래에 표시합니다.
SOURCES.seongsu.group = "성수역"; SOURCES.egypt.group = "이집트 디펜스"; SOURCES.aicena.group = "AICENA";
SOURCES.lumiclass.group = "캠퍼스마루"; SOURCES.lumiclass.tabLabel = "회원";
SOURCES.lumiclass_metrics.group = "캠퍼스마루"; SOURCES.lumiclass_metrics.tabLabel = "매출";
SOURCES.lumiclass_costs.group = "캠퍼스마루"; SOURCES.lumiclass_costs.tabLabel = "비용";
SOURCES.blaiva = {
  "firebase": {
    "apiKey": "AIzaSyAjLPY8q679CJBjMM1OH1iCqI6aXGbKIxw",
    "authDomain": "blaiva-prod.firebaseapp.com",
    "projectId": "blaiva-prod",
    "appId": "1:42379104060:web:4bdc3a13e64c764aa85839"
  },
  "group": "blaiva",
  "label": "blaiva 회원",
  "tabLabel": "회원",
  "collection": "accounts",
  "authJoin": true,
  "titleKey": "nickname",
  "profileJoin": {
    "collection": "creatorProfiles",
    "fields": [
      "nickname",
      "creatorEnabled",
      "activeCount"
    ]
  },
  "dateField": "createdAt",
  "columns": [
    {
      "key": "_id",
      "label": "회원 UID"
    },
    {
      "key": "nickname",
      "label": "닉네임"
    },
    {
      "key": "creatorEnabled",
      "label": "크리에이터",
      "type": "bool",
      "category": true
    },
    {
      "key": "activeCount",
      "label": "보관 작품",
      "type": "number"
    },
    {
      "key": "createdAt",
      "label": "가입일",
      "type": "date"
    },
    {
      "key": "visitCount",
      "label": "접속 횟수",
      "type": "number"
    },
    {
      "key": "lastVisitAt",
      "label": "최근 접속",
      "type": "date"
    },
    {
      "key": "lastPlatform",
      "label": "플랫폼",
      "category": true
    }
  ]
};
SOURCES.blaiva_works = {
  "firebase": {
    "apiKey": "AIzaSyAjLPY8q679CJBjMM1OH1iCqI6aXGbKIxw",
    "authDomain": "blaiva-prod.firebaseapp.com",
    "projectId": "blaiva-prod",
    "appId": "1:42379104060:web:4bdc3a13e64c764aa85839"
  },
  "group": "blaiva",
  "label": "blaiva 작품",
  "tabLabel": "작품",
  "collection": "creatorVideos",
  "titleKey": "title",
  "dateField": "createdAt",
  "columns": [
    {
      "key": "_id",
      "label": "영상 ID"
    },
    {
      "key": "title",
      "label": "제목"
    },
    {
      "key": "creator",
      "label": "크리에이터"
    },
    {
      "key": "ownerUid",
      "label": "회원 UID"
    },
    {
      "key": "state",
      "label": "상태",
      "category": true
    },
    {
      "key": "declaredSize",
      "label": "원본 바이트",
      "type": "number"
    },
    {
      "key": "createdAt",
      "label": "업로드",
      "type": "date"
    }
  ]
};
SOURCES.blaiva_costs = {
  "firebase": {
    "apiKey": "AIzaSyAjLPY8q679CJBjMM1OH1iCqI6aXGbKIxw",
    "authDomain": "blaiva-prod.firebaseapp.com",
    "projectId": "blaiva-prod",
    "appId": "1:42379104060:web:4bdc3a13e64c764aa85839"
  },
  "group": "blaiva",
  "label": "blaiva 비용",
  "tabLabel": "비용",
  "collection": "operationalBudgets",
  "titleKey": "month",
  "dateField": "checkedAt",
  "columns": [
    {
      "key": "month",
      "label": "월"
    },
    {
      "key": "monthlyUsd",
      "label": "예산 USD",
      "type": "number"
    },
    {
      "key": "estimatedUsd",
      "label": "예상 비용 USD",
      "decimals": 6,
      "type": "number"
    },
    {
      "key": "deliveryUsd",
      "label": "전송 USD",
      "decimals": 6,
      "type": "number"
    },
    {
      "key": "storageUsd",
      "label": "저장 추정 USD",
      "decimals": 6,
      "type": "number"
    },
    {
      "key": "email",
      "label": "알림 이메일"
    },
    {
      "key": "checkedAt",
      "label": "점검 시각",
      "type": "date"
    }
  ]
};

// 비용 데이터는 전용 수집 프로젝트에서 앱별로 구분한다.
SOURCES.blaiva_costs.rowFilter = { app: 'blaiva' };
SOURCES.lumiclass_costs = { ...SOURCES.blaiva_costs, label: '캠퍼스마루 비용', group: '캠퍼스마루', rowFilter: { app: 'campusmaru' }, columns: SOURCES.blaiva_costs.columns.filter(c => !['monthlyUsd', 'email'].includes(c.key)) };
for (const source of [SOURCES.blaiva_costs, SOURCES.lumiclass_costs]) source.columns = [...source.columns,
  { key: 'storageBytes', label: '저장 GB', type: 'number', divisor: 1e9, decimals: 3 },
  { key: 'bandwidthBytes', label: '전송 GB', type: 'number', divisor: 1e9, decimals: 3 },
  { key: 'storageUsdPerGbMonth', label: 'GB당 월 저장 USD', type: 'number', decimals: 3 },
];

// 가입 정보는 회사 조회 계정에만 허용된 별도 컬렉션에서 읽습니다.
SOURCES.blaiva_members={firebase:SOURCES.blaiva.firebase,group:'blaiva',label:'blaiva 가입 정보',tabLabel:'가입 정보',collection:'memberProfiles',titleKey:'nickname',dateField:'createdAt',profileJoin:{collection:'creatorProfiles',fields:['nickname']},columns:[
 {key:'_id',label:'회원 UID'},{key:'email',label:'인증 이메일'},{key:'nickname',label:'닉네임'},{key:'name',label:'이름'},{key:'phone',label:'휴대폰번호'},{key:'registrationComplete',label:'가입 완료',type:'bool',category:true},{key:'marketingConsent',label:'마케팅 수신',type:'bool',category:true},{key:'termsVersion',label:'약관 버전'},{key:'termsAcceptedAt',label:'약관 동의',type:'date'},{key:'marketingUpdatedAt',label:'수신 동의 변경',type:'date'},{key:'createdAt',label:'가입일',type:'date'}]};
SOURCES.blaiva_comments={firebase:SOURCES.blaiva.firebase,group:'blaiva',label:'blaiva 댓글',tabLabel:'댓글',collection:'videoComments',titleKey:'text',dateField:'createdAt',columns:[
 {key:'_id',label:'댓글 ID'},{key:'videoTitle',label:'영상 제목'},{key:'videoKey',label:'영상 ID',category:true},{key:'nickname',label:'작성 닉네임'},{key:'ownerUid',label:'작성 회원 UID'},{key:'text',label:'댓글 내용'},{key:'parentId',label:'부모 댓글 ID'},{key:'likeCount',label:'하트 수'},{key:'replyCount',label:'답글 수'},{key:'deleted',label:'삭제됨'},{key:'editedAt',label:'수정일',type:'date'},{key:'createdAt',label:'작성일',type:'date'}]};
