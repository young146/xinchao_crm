# 챗봇 대화 이력 저장 설계 문서

> 작성 기준: 2026-04-26  
> 프로젝트: xinchao-crm (Vercel) + Firebase `chaovietnam-login`  
> 대상 파일: `api/chat.js`, `public/chatbot-widget.js`, `firestore.rules`

---

## 1. 아키텍처 개요

```
WP 사이트 (chaovietnam.co.kr)
  └── chatbot-widget.js (Shadow DOM)
        ├── Firebase Auth SDK (CDN, 위젯 내부 로드)
        │     └── onAuthStateChanged → uid/idToken 감지
        ├── POST /api/chat  ← Authorization: Bearer <idToken>
        │     └── Vercel: chat.js
        │           ├── Firebase Admin SDK로 토큰 검증 → uid 확인
        │           ├── OpenAI GPT 호출
        │           └── Firestore에 메시지 저장
        └── Firestore SDK (CDN)
              └── 세션 목록 조회 / 이전 대화 불러오기
```

**핵심 원칙**
- 비로그인 사용자 → 기존 동작과 동일 (localStorage 없이 세션 메모리만 사용)  
- 로그인 사용자 → 매 응답마다 Firestore에 저장 + 이전 대화 목록 UI 제공  
- WP 사이트에 Firebase SDK를 직접 삽입하지 않고, **위젯 JS가 CDN에서 동적 로드**

---

## 2. Firestore 컬렉션 구조

### 2-1. 컬렉션 계층

```
chatSessions/{sessionId}
  ├── uid: string               // Firebase Auth UID
  ├── title: string             // 첫 user 메시지 앞 30자 (자동 생성)
  ├── createdAt: Timestamp
  ├── updatedAt: Timestamp
  ├── messageCount: number      // 클라이언트가 increment
  ├── lastMessage: string       // 마지막 assistant 응답 요약 (50자)
  └── recommendation: {         // 최종 추천 패키지 (있는 경우)
        packageName: string,
        months: number,
        addons: string[]
      } | null

chatSessions/{sessionId}/messages/{messageId}
  ├── role: "user" | "assistant"
  ├── content: string
  ├── createdAt: Timestamp
  └── recommendation: {...} | null   // assistant 응답에만, 추천 있을 때만
```

### 2-2. 컬렉션 선택 근거

| 대안 | 장점 | 단점 | 결정 |
|------|------|------|------|
| `users/{uid}/chatSessions/{id}/messages/{id}` (3단 중첩) | uid 기반 직접 접근 | Firestore 규칙 중첩 복잡, 컬렉션 그룹 쿼리 불가 | **제외** |
| `chatSessions/{id}` + `chatSessions/{id}/messages/{id}` | 규칙 단순, 컬렉션 그룹 쿼리 가능 | uid로 필터링 필요 | **채택** |
| 단일 문서에 messages 배열 내장 | 쿼리 1회 | 문서 1MB 제한, 원자적 append 불가 | **제외** |

### 2-3. 인덱스 요구 사항

```
컬렉션: chatSessions
  복합 인덱스: uid ASC, updatedAt DESC
  → 사용처: 사용자별 세션 목록 최신순 조회
```

---

## 3. API 변경 사항 (`api/chat.js`)

### 3-1. 추가 환경변수

```
FIREBASE_PROJECT_ID=chaovietnam-login
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@chaovietnam-login.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Vercel Dashboard → Project Settings → Environment Variables에 추가  
> `FIREBASE_PRIVATE_KEY`의 `\n`은 실제 줄바꿈으로 저장 (Vercel이 자동 처리)

### 3-2. 요청 형식 변경

```jsonc
// 기존
POST /api/chat
{
  "messages": [...],
  "sessionId": "선택사항"
}

// 변경 후
POST /api/chat
Headers: { "Authorization": "Bearer <Firebase ID Token>" }  // 선택사항 (로그인 시만)
{
  "messages": [...],
  "sessionId": "string | null"  // null이면 신규 세션 생성, 값이 있으면 기존 세션에 append
}
```

### 3-3. 응답 형식 변경

```jsonc
// 기존
{ "reply": "...", "recommendation": {...} | null }

// 변경 후
{
  "reply": "...",
  "recommendation": {...} | null,
  "sessionId": "string"  // 신규 생성이면 새 ID, 기존이면 그대로 반환 (로그인 시만)
}
```

### 3-4. chat.js 처리 흐름 (의사코드)

```
handler(req, res):
  1. Authorization 헤더 파싱 (없으면 uid = null)
  2. uid가 있으면:
       Firebase Admin SDK로 idToken 검증 → uid 확인
       실패 시 → uid = null (저장 안 함, 정상 응답)
  3. OpenAI 호출 (기존 동일)
  4. uid가 있으면:
       a. sessionId 없으면 → Firestore에 신규 chatSessions 문서 생성
       b. subcollection messages에 user 메시지 저장
       c. subcollection messages에 assistant 응답 저장
       d. chatSessions 부모 문서 업데이트 (updatedAt, lastMessage, messageCount, recommendation)
       e. sessionId를 응답에 포함
  5. 응답 반환
```

### 3-5. 신규 추가 코드 위치 (기존 코드 최소 변경)

```javascript
// 추가 import (파일 상단)
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Admin SDK 초기화 (핸들러 외부, 콜드스타트 최적화)
// 기존 handler() 함수 앞에 삽입

// handler 내부: OpenAI 호출 후 저장 로직 추가
```

---

## 4. 위젯 변경 사항 (`public/chatbot-widget.js`)

### 4-1. Firebase SDK 동적 로드 전략

WP 사이트에는 Firebase SDK가 없으므로 위젯이 **CDN에서 직접 로드**한다.  
`firebase/auth`와 `firebase/firestore` 모듈 두 개를 동적 import 한다.

```javascript
// Firebase 설정값을 script 태그 data 속성으로 전달받음
// <script src="...chatbot-widget.js"
//   data-api-url="https://xinchao-crm.vercel.app/api/chat"
//   data-fb-api-key="AIza..."
//   data-fb-auth-domain="chaovietnam-login.firebaseapp.com"
//   data-fb-project-id="chaovietnam-login"
// ></script>
```

### 4-2. Firebase Auth 상태 감지 흐름

```
XinchaoWidget 생성자
  └── _initFirebase()
        ├── CDN에서 Firebase SDK 로드 (compat 버전, script 태그 동적 삽입)
        ├── initializeApp(config)  — 이미 초기화된 경우 getApp() 재사용
        └── onAuthStateChanged(auth, user => {
              this.currentUser = user;  // null이면 비로그인
              if (user) this._loadSessionList();
            })
```

**왜 compat 버전인가?**  
- Modular SDK는 번들러 필요. 위젯은 Vanilla JS 단일 파일이므로 `firebase/compat` CDN이 적합  
- URL: `https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js` 등

### 4-3. 위젯 상태 추가

```javascript
class XinchaoWidget {
  constructor() {
    this.messages = [];       // 기존
    this.currentUser = null;  // 신규: Firebase User 객체 또는 null
    this.sessionId = null;    // 신규: 현재 세션 ID
    this.sessions = [];       // 신규: 세션 목록 캐시
    // ...
  }
}
```

### 4-4. 메시지 전송 흐름 변경

```javascript
async _handleSend() {
  // 기존 로직 동일
  
  // fetch body 변경: sessionId 추가
  body: JSON.stringify({
    messages: this.messages,
    sessionId: this.sessionId,  // 신규
  })
  
  // Authorization 헤더 추가 (로그인 시)
  const headers = { 'Content-Type': 'application/json' };
  if (this.currentUser) {
    const token = await this.currentUser.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 응답에서 sessionId 저장
  if (data.sessionId) {
    this.sessionId = data.sessionId;
  }
}
```

### 4-5. 이전 대화 목록 UI (헤더 내 버튼 추가)

```
[헤더]  봇 아이콘 | "씬짜오베트남 광고 안내" | [이력 아이콘] | [새 대화 아이콘] | [닫기]
                                                   ↓ 클릭 시
                                        ┌─────────────────────┐
                                        │ 이전 대화 목록       │
                                        ├─────────────────────┤
                                        │ ● 통합 패키지 B 문의 │
                                        │   2일 전              │
                                        ├─────────────────────┤
                                        │ ● 호찌민 온라인 광고 │
                                        │   1주일 전           │
                                        └─────────────────────┘
```

**UI 상태 관리**:
- `view: 'chat' | 'sessions'` 토글  
- `sessions` 뷰: Firestore `chatSessions` 조회 (uid 필터, updatedAt DESC, limit 10)  
- 세션 클릭 → 해당 세션의 `messages` 서브컬렉션 로드 → `this.messages` 복원 → `view: 'chat'`

### 4-6. "새 대화" 버튼

```javascript
_newSession() {
  this.messages = [];
  this.sessionId = null;
  this.messagesEl.innerHTML = '';
  this._showGreeting();
}
```

### 4-7. 비로그인 사용자 처리

```
- currentUser === null 이면 기존 동작과 100% 동일
- Authorization 헤더 없음, sessionId 없음
- 이력 아이콘 비활성화 또는 "로그인 후 이용 가능" 툴팁
```

---

## 5. WP 사이트 삽입 코드 변경

### 기존

```html
<script src="https://xinchao-crm.vercel.app/chatbot-widget.js"
        data-api-url="https://xinchao-crm.vercel.app/api/chat"></script>
```

### 변경 후

```html
<script src="https://xinchao-crm.vercel.app/chatbot-widget.js"
        data-api-url="https://xinchao-crm.vercel.app/api/chat"
        data-fb-api-key="AIzaSy..."
        data-fb-auth-domain="chaovietnam-login.firebaseapp.com"
        data-fb-project-id="chaovietnam-login"
        data-fb-app-id="1:...:web:..."></script>
```

> Firebase 설정값은 공개 클라이언트 키이므로 HTML에 노출해도 안전  
> 보안은 Firestore Rules와 Auth 토큰 검증으로 담당

---

## 6. Firestore Security Rules 추가

기존 `firestore.rules`에 아래 섹션 추가:

```javascript
// ========================================
// 💬 챗봇 대화 이력
// ========================================
match /chatSessions/{sessionId} {
  // 본인 세션만 읽기 허용
  allow read: if request.auth != null
    && request.auth.uid == resource.data.uid;

  // 신규 생성: 본인 uid로만
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.uid;

  // 업데이트: 본인만 (updatedAt, lastMessage, messageCount 등)
  allow update: if request.auth != null
    && request.auth.uid == resource.data.uid;

  // 삭제: 본인 또는 관리자
  allow delete: if request.auth != null
    && (request.auth.uid == resource.data.uid || isAdmin());

  // 메시지 서브컬렉션
  match /messages/{messageId} {
    // 부모 세션 소유자만 접근
    allow read: if request.auth != null
      && request.auth.uid == get(/databases/$(database)/documents/chatSessions/$(sessionId)).data.uid;

    allow create: if request.auth != null
      && request.auth.uid == get(/databases/$(database)/documents/chatSessions/$(sessionId)).data.uid;

    // 메시지는 수정/삭제 불가 (이력 무결성)
    allow update, delete: if false;
  }
}
```

> **참고**: `get()` 호출 비용 최소화를 위해 API 서버(Admin SDK)가 메시지를 저장하므로  
> 클라이언트는 세션 읽기 + 세션 목록 조회만 수행한다.  
> 메시지 write는 Admin SDK가 담당 → Rules에서 client write 불필요.

### 단순화된 Rules (Admin SDK가 모든 write 담당)

```javascript
match /chatSessions/{sessionId} {
  // 클라이언트: 본인 세션 읽기만
  allow read: if request.auth != null
    && request.auth.uid == resource.data.uid;

  // write: Admin SDK가 담당 (서버사이드) → 클라이언트 거부
  allow write: if false;

  match /messages/{messageId} {
    allow read: if request.auth != null
      && request.auth.uid == get(/databases/$(database)/documents/chatSessions/$(sessionId)).data.uid;
    allow write: if false;
  }
}
```

---

## 7. 구현 단계별 계획 (Phase)

### Phase 1 — 백엔드 저장 기반 구축 (서버 + Firestore)

**목표**: API에서 인증된 사용자의 대화를 Firestore에 저장  
**파일**: `api/chat.js`, `firestore.rules`

**작업 항목**:
1. Vercel에 Firebase Admin 환경변수 3개 추가  
   (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
2. `package.json`에 `firebase-admin` 추가 (`npm install firebase-admin`)
3. `api/chat.js` 수정:
   - Firebase Admin SDK 초기화 코드 추가 (핸들러 외부)
   - `Authorization` 헤더 파싱 → `verifyIdToken()` 호출
   - OpenAI 응답 후 Firestore 저장 로직 추가 (비동기, 응답 블로킹 없이)
   - 응답에 `sessionId` 포함
4. `firestore.rules`에 `chatSessions` 규칙 추가
5. Firebase Console에서 복합 인덱스 생성 (`uid ASC`, `updatedAt DESC`)

**검증**: `curl`로 Authorization 헤더 포함 요청 → Firestore Console에서 문서 확인

---

### Phase 2 — 위젯 Firebase Auth 연동

**목표**: WP 위젯에서 Firebase 로그인 상태 감지 + ID 토큰 전송  
**파일**: `public/chatbot-widget.js`

**작업 항목**:
1. `_initFirebase()` 메서드 추가:
   - `data-fb-*` 속성 읽기
   - Firebase compat SDK CDN 동적 로드 (script 태그 삽입)
   - `onAuthStateChanged` 리스너 등록
2. `_handleSend()` 수정:
   - 로그인 시 `getIdToken()` → `Authorization` 헤더 포함
   - 응답의 `sessionId` 저장
3. WP 사이트 삽입 코드에 `data-fb-*` 속성 추가
4. `script` 태그 `data-api-url` 외 속성 누락 시 graceful degradation (저장 없이 정상 동작)

**검증**: WP 사이트에서 로그인 후 챗봇 사용 → Firestore에 메시지 저장 확인

---

### Phase 3 — 이전 대화 목록 UI

**목표**: 헤더에 이력 버튼 추가, 세션 목록 표시, 이전 대화 복원  
**파일**: `public/chatbot-widget.js`

**작업 항목**:
1. CSS 추가: `.xv-sessions-panel`, `.xv-session-item`, `.xv-session-title` 등
2. 헤더에 이력 버튼 (`ICON_HISTORY`) + 새 대화 버튼 (`ICON_NEW_CHAT`) 추가 (로그인 시만 표시)
3. `_loadSessionList()` 메서드:
   - Firestore `chatSessions` 쿼리: `uid == currentUser.uid`, `orderBy updatedAt desc`, `limit 10`
   - 세션 패널 렌더링
4. `_loadSession(sessionId)` 메서드:
   - `chatSessions/{id}/messages` subcollection 읽기 (`orderBy createdAt`)
   - `this.messages` 복원 후 UI 렌더링
   - `this.sessionId = sessionId` 세팅 (이후 메시지 이 세션에 추가됨)
5. `_newSession()` 메서드: 현재 세션 초기화

**검증**: WP 사이트에서 여러 대화 후 이력 버튼 클릭 → 목록 표시 → 이전 대화 복원 확인

---

### Phase 4 — 이력 삭제 및 UX 개선 (선택적)

**목표**: 세션 삭제 기능, 세션 제목 편집, 페이지네이션  
**파일**: `public/chatbot-widget.js`, `api/` (삭제 전용 엔드포인트)

**작업 항목**:
1. 세션 삭제 버튼 → `DELETE /api/chat-session?id={sessionId}` 호출
   - Admin SDK로 세션 + 메시지 서브컬렉션 일괄 삭제
2. 세션 제목 자동 생성 로직 개선 (GPT 요약 vs 첫 메시지 30자)
3. 세션 목록 "더 보기" (limit 10 이상)
4. 세션 목록 날짜 그룹핑 (오늘, 이번 주, 이전)

---

## 8. 기술 결정 근거

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| Auth 토큰 전달 방식 | Authorization Bearer 헤더 | 쿠키 불가 (cross-origin), body 오염 피하기 |
| Firebase SDK 로드 | compat CDN 동적 삽입 | 번들러 없는 Vanilla JS 위젯에 최적 |
| 메시지 저장 주체 | API 서버 (Admin SDK) | 클라이언트 Firestore write 불필요 → Rules 단순화 + 보안 강화 |
| 세션 구조 | 최상위 컬렉션 + subcollection | 규칙 명확, 컬렉션 그룹 쿼리 가능, uid 인덱스 활용 |
| 비로그인 처리 | 기존 동작 유지 | 저장 없이 graceful degradation, 위젯 단순성 유지 |
| 저장 타이밍 | API 응답 후 비동기 저장 | 응답 지연 없음 (Firestore 저장 실패가 사용자 경험에 영향 안 줌) |
| 토큰 재사용 | 매 요청마다 `getIdToken(false)` | 1시간 만료 자동 처리, forceRefresh 불필요 |

---

## 9. 보안 체크리스트

- [x] Firestore Rules: 본인 uid 데이터만 읽기 가능
- [x] Firestore Rules: 클라이언트 직접 write 차단 (Admin SDK만 write)
- [x] API: `verifyIdToken()` 실패 시 → uid = null → 저장 안 함 (서비스 중단 없음)
- [x] ID 토큰은 HTTPS 헤더로만 전송 (Vercel은 기본 HTTPS)
- [x] Firebase config (apiKey 등)는 공개 안전 — Firestore Rules가 실제 보안 담당
- [x] Admin SDK 서비스 계정 키는 Vercel 환경변수에만 저장 (`.gitignore` 대상 아님, 환경변수로만)
- [ ] (권고) Firestore Rules 배포 전 `firebase emulator`로 단위 테스트

---

## 10. 필요 패키지 / 의존성

### `api/chat.js` (서버사이드)

```json
// package.json에 추가
"firebase-admin": "^12.x"
```

### `public/chatbot-widget.js` (클라이언트)

추가 npm 패키지 없음. CDN URL 사용:
```
https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js
https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js
https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js
```

---

## 11. Firestore 비용 추정

| 작업 | 호출 수/대화 | 예상 비용 |
|------|------------|----------|
| 세션 생성 (1회) | 1 write | 무시 |
| 메시지 저장 (user+bot) | 2~3 writes/왕복 | ~$0.00054/대화 |
| 세션 메타 업데이트 | 1 write/왕복 | 포함 |
| 세션 목록 조회 | 1 read/오픈 | ~$0.00003 |
| 메시지 복원 | N reads | ~$0.00003×N |

월 1,000회 대화 기준 ≈ **$0.50~$1.00** 수준 (Firebase Free Tier 내 수용 가능)

---

*이 문서는 설계 목적으로만 작성되었습니다. 실제 코드 수정은 각 Phase 승인 후 별도로 진행합니다.*
