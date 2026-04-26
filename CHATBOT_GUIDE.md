# 씬짜오베트남 광고 챗봇 시스템 관리 지침서

> **대상 독자:** 비개발자도 이해할 수 있도록 작성되었습니다.  
> **마지막 업데이트:** 2026-04-26

---

## 목차

1. [시스템 구성 개요](#1-시스템-구성-개요)
2. [파일별 상세 가이드](#2-파일별-상세-가이드)
   - [api/chat.js — 챗봇 두뇌](#21-apichatjs--챗봇-두뇌)
   - [public/chatbot-widget.js — 챗봇 UI](#22-publicchatbot-widgetjs--챗봇-ui)
   - [wordpress_ad_form/ — 광고 신청 폼](#23-wordpress_ad_form--광고-신청-폼)
3. [운영 가이드](#3-운영-가이드)
4. [자주 하는 수정 시나리오](#4-자주-하는-수정-시나리오)

---

## 1. 시스템 구성 개요

### 전체 아키텍처

```
[사용자]
   ↓ 웹사이트 방문
[챗봇 위젯 버튼 클릭]  ← public/chatbot-widget.js (프론트엔드 UI)
   ↓ 사용자 메시지 전송
[API 서버]             ← api/chat.js (백엔드 로직)
   ↓ OpenAI API 호출
[GPT-4o mini]          ← AI 모델 (OpenAI 제공)
   ↓ 패키지 추천 응답
[챗봇 위젯 — 추천 카드 표시]
   ↓ "광고 신청하기" 버튼 클릭
[광고 신청 폼]         ← wordpress_ad_form/ (신청서 UI)
   ↓ 폼 제출
[Google 스프레드시트]  ← GAS(Google Apps Script) 자동 등록
```

### 배포 방식

- **플랫폼:** Vercel (무료 플랜 사용 가능)
- **자동 배포:** GitHub `main` 브랜치에 push하면 Vercel이 자동으로 빌드 & 배포
- **소요 시간:** push 후 약 30초~1분이면 반영

### 핵심 파일 3개

| 파일 | 역할 |
|------|------|
| `api/chat.js` | 챗봇의 두뇌. 광고 정보(가격, 패키지 등)를 담고 GPT와 통신 |
| `public/chatbot-widget.js` | 웹사이트에 표시되는 채팅창 UI. 말풍선, 버튼, 디자인 담당 |
| `wordpress_ad_form/` | 챗봇이 추천한 패키지를 받아 최종 신청서를 작성하는 폼 |

---

## 2. 파일별 상세 가이드

---

### 2.1 `api/chat.js` — 챗봇 두뇌

#### 파일 구조 한눈에 보기

```
api/chat.js
├── 1~46번 줄   : 주석 (환경변수 설정법, 로컬 테스트 방법, 요청/응답 형식 설명)
├── 48번 줄     : OpenAI 라이브러리 불러오기
├── 51~192번 줄 : SYSTEM_PROMPT (챗봇에게 주는 지시문 — 핵심!)
├── 195~214번 줄: parseRecommendation() 함수 (추천 JSON 파싱 헬퍼)
└── 217~303번 줄: handler() 함수 (API 요청 처리 메인 로직)
```

#### 시스템 프롬프트 구조 (51~192번 줄)

`SYSTEM_PROMPT`는 GPT에게 "이렇게 행동해라"라고 알려주는 지시문입니다. 각 섹션 위치와 역할은 다음과 같습니다.

| 섹션 | 위치 | 역할 |
|------|------|------|
| 씬짜오베트남 소개 | 56~69번 줄 | 회사 기본 정보, 발행 부수, 온라인 채널 설명 |
| 지역 제한 규칙 | 74~80번 줄 | 호찌민 외 지역 고객에게 잡지·옐로페이지 추천 금지 규칙 |
| 주요 광고주 업종 | 83~85번 줄 | 주요 고객층 설명 |
| 광고 패키지 7종 | 88~111번 줄 | 각 패키지 이름, 가격, 구성 내역 |
| 단품 옵션 | 113~127번 줄 | 패키지 외 단독 구매 가능한 옵션 목록 |
| 장기 계약 할인 | 129~137번 줄 | 3/6/12개월 할인율, 인터뷰 기사 조건 |
| 결제 & 광고 소재 | 139~144번 줄 | 결제 통화, 세금계산서, 광고 소재 관련 안내 |
| 광고 효과 포인트 | 147~153번 줄 | 고객 설득 시 강조할 메시지 |
| 담당자 연락처 | 156~160번 줄 | 이메일, 전화번호 |
| 행동 지침 | 163~192번 줄 | 대화 규칙, 패키지 추천 시 JSON 출력 형식 |

---

#### 가격 변경 방법

패키지 가격은 `SYSTEM_PROMPT` 안에 텍스트로 적혀 있습니다.

**예시: 디지털 스타터를 $250 → $300으로 변경**

```
# Before (90번 줄)
1. 디지털 스타터          $250/월

# After
1. 디지털 스타터          $300/월
```

> ⚠️ 주의: `api/chat.js`의 가격을 바꾸면, 반드시 `wordpress_ad_form/` 폼의 `data-price` 속성도 함께 바꿔야 합니다. (아래 [2.3 섹션](#23-wordpress_ad_form--광고-신청-폼) 참고)

---

#### 새 패키지 추가 방법

`SYSTEM_PROMPT` 내 패키지 목록(88~111번 줄)에 줄을 추가합니다.

**예시: "스타트업 패키지 $200/월" 추가**

```
# Before (기존 마지막 패키지)
7. 프리미엄 올인원        $3,000/월
   - 잡지 백커버 + 디지털 베스트 + 이웃사업 소개

# After
7. 프리미엄 올인원        $3,000/월
   - 잡지 백커버 + 디지털 베스트 + 이웃사업 소개

8. 스타트업 패키지        $200/월
   - 이메일 홍보카드 월 2회 + SNS 홍보
```

그리고 폼 파일에도 패키지 카드를 추가해야 합니다. (아래 [2.3 섹션](#23-wordpress_ad_form--광고-신청-폼) 참고)

---

#### 응대 규칙 추가/수정 방법

행동 지침은 163~192번 줄 `■ 행동 지침` 섹션에 있습니다.

**예시: "항상 통합 패키지 A도 함께 소개하라" 규칙 추가**

```
# Before (170번 줄 이후)
5. 통합 패키지 B는 베스트셀러임을 자연스럽게 언급하세요.
6. 광고와 관련 없는 질문(일반 상식, 타 업무 등)은 정중히 거절...

# After
5. 통합 패키지 B는 베스트셀러임을 자연스럽게 언급하세요.
5-1. 통합 패키지 A도 가성비 옵션으로 함께 소개하세요.
6. 광고와 관련 없는 질문(일반 상식, 타 업무 등)은 정중히 거절...
```

---

#### RECOMMENDATION_JSON 형식 설명

챗봇이 패키지를 최종 추천할 때, 응답 마지막에 아래 형식의 JSON을 자동으로 붙입니다. (172~192번 줄 지시문에 정의됨)

```
RECOMMENDATION_JSON:{"packageName":"패키지명","months":계약개월수,"addons":["추가옵션1"]}
```

| 필드 | 설명 | 예시 |
|------|------|------|
| `packageName` | 추천 패키지 정확한 이름 | `"통합 패키지 B"` |
| `months` | 계약 기간 (1/2/3/6/12 중 하나) | `6` |
| `addons` | 추가 단품 옵션 배열 (없으면 빈 배열) | `["잡지 전면 ($900/월)"]` |

이 JSON을 챗봇 위젯(`chatbot-widget.js`)이 파싱해서 "광고 신청하기" 버튼과 URL 파라미터를 생성합니다.

---

#### 중요 주의사항: addon명은 반드시 폼의 data-name과 일치해야 함

챗봇이 생성하는 `addons` 배열의 항목명은 반드시 폼 HTML의 `data-name` 속성값과 **완전히 동일**해야 합니다.

**올바른 예 (잡지/옐로페이지 단품):**

| 챗봇 `addons` 배열 값 | 폼 `data-name` 값 |
|----------------------|------------------|
| `잡지 전면 ($900/월)` | `잡지 전면 ($900/월)` |
| `잡지 1/2면 ($500/월)` | `잡지 1/2면 ($500/월)` |
| `잡지 1/4면 ($300/월)` | `잡지 1/4면 ($300/월)` |
| `옐로페이지 1단 ($240)` | `옐로페이지 1단 ($240)` |
| `옐로페이지 2단 ($480)` | `옐로페이지 2단 ($480)` |
| `옐로페이지 4단 ($960)` | `옐로페이지 4단 ($960)` |

이름이 다르면 챗봇 추천 후 폼으로 이동할 때 해당 옵션이 자동 선택되지 않습니다.

---

### 2.2 `public/chatbot-widget.js` — 챗봇 UI

#### 파일 구조 한눈에 보기

```
chatbot-widget.js
├── 1~8번 줄    : 주석 (삽입 방법)
├── 9~10번 줄   : IIFE 시작 (자기 실행 함수 — 다른 코드와 충돌 방지)
├── 12~21번 줄  : 설정 상수 (API_URL, GREETING 인사말)
├── 23~352번 줄 : CSS (채팅창 전체 스타일)
├── 354~359번 줄: 아이콘 SVG 상수
├── 361~386번 줄: 유틸리티 함수 (HTML 이스케이프, 마크다운 렌더, 시간 표시)
├── 388~653번 줄: XinchaoWidget 클래스 (챗봇 핵심 로직)
└── 655~666번 줄: 초기화 코드
```

---

#### 브랜드 컬러 변경 방법

CSS 섹션(23~352번 줄)에서 `#d32f2f`(빨간색)를 찾아 원하는 색상으로 교체합니다.

**예시: 빨간색 → 파란색으로 변경**

```css
/* Before (여러 곳에 동일하게 적용) */
background: #d32f2f;

/* After */
background: #1565c0;
```

> 팁: `#d32f2f`는 파일에 약 18곳 등장합니다. 텍스트 편집기의 "전체 바꾸기" 기능을 사용하면 한번에 바꿀 수 있습니다.

---

#### 폰트 변경 방법

27~28번 줄의 `font-family` 값을 수정합니다.

```css
/* Before (27번 줄) */
font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;

/* After (예: Nanum Gothic 우선 적용) */
font-family: 'Nanum Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
```

---

#### 인사말 변경 방법

21번 줄의 `GREETING` 상수를 수정합니다.

```javascript
// Before (21번 줄)
const GREETING = '안녕하세요! 씬짜오베트남 광고에 대해 궁금한 점을 물어보세요. 예산, 목적, 타깃에 맞는 최적의 광고 패키지를 추천해 드릴게요.';

// After
const GREETING = '안녕하세요! 광고 문의 주셔서 감사합니다. 업종과 예산을 알려주시면 최적의 패키지를 추천해 드리겠습니다.';
```

---

#### 추천 카드 → 폼 연결 URL 구조 설명

챗봇이 패키지를 추천하면 "광고 신청하기" 버튼이 나타납니다. 이 버튼의 URL은 `chatbot-widget.js` 584~591번 줄에서 생성됩니다.

**생성 로직 (584~591번 줄):**

```javascript
const params = new URLSearchParams({
  pkg: recommendation.packageName || '',   // 패키지명
  months: String(months),                  // 계약 기간
});
if (addons.length > 0) {
  params.set('addons', addons.join(','));   // 추가 옵션 (쉼표 구분)
}
const applyUrl = '/ads_request?' + params.toString();
```

**실제 생성되는 URL 예시:**

```
/ads_request?pkg=통합 패키지 B&months=6&addons=잡지 전면 ($900/월),옐로페이지 1단 ($240)
```

URL을 전달받은 광고 신청 폼이 이 파라미터를 읽어 해당 패키지와 옵션을 자동으로 선택합니다.

> **참고:** `/ads_request`는 WordPress의 광고 신청 폼 페이지 슬러그(URL)입니다. 폼 페이지 주소가 다르다면 이 경로를 수정해야 합니다.

---

### 2.3 `wordpress_ad_form/` — 광고 신청 폼

#### version_a vs version_b 차이점

| 항목 | version_a_wp_custom_html.html | version_b_standalone.html |
|------|-------------------------------|---------------------------|
| 사용처 | WordPress Custom HTML 블록에 붙여넣기 | 단독 HTML 파일로 직접 사용 |
| CSS 방식 | `.xcv-` prefix 네임스페이스 사용 (WP 테마와 충돌 방지) | `:root` 전역 CSS 변수 사용 |
| JS 함수명 | `xcvGoStep()`, `xcvSelPkg()` 등 `xcv` prefix | `goStep()`, `selPkg()` 등 prefix 없음 |
| 기능 | 동일 | 동일 |

**어떤 걸 써야 하나?**
- WordPress 사이트에 삽입할 때 → `version_a` 사용
- 독립 HTML 페이지로 호스팅할 때 → `version_b` 사용

---

#### 패키지 추가/수정 시 변경할 부분

폼에서 패키지는 `data-price`와 `data-name` 속성이 있는 `<div class="xcv-pkg-card">` 요소로 구성됩니다.

**version_a 기준 위치:** 541~625번 줄 (패키지 카드 영역)  
**version_b 기준 위치:** 514~598번 줄 (패키지 카드 영역)

**기존 패키지 가격 수정 예시: 통합 패키지 B를 $1,150 → $1,200으로 변경**

```html
<!-- Before (version_a 589번 줄) -->
<div class="xcv-pkg-card" data-price="1150" data-name="통합 패키지 B" ...>
  ...
  <div class="xcv-pkg-price">$1,150 <small>/ 월</small></div>

<!-- After -->
<div class="xcv-pkg-card" data-price="1200" data-name="통합 패키지 B" ...>
  ...
  <div class="xcv-pkg-price">$1,200 <small>/ 월</small></div>
```

**새 패키지 추가 예시: "스타트업 패키지 $200/월" 추가**

```html
<!-- 기존 패키지 카드들 뒤에 추가 -->
<div class="xcv-pkg-card" data-price="200" data-name="스타트업 패키지" data-adtype="스타트업 패키지" onclick="xcvSelPkg(this)">
  <div class="xcv-pkg-tag">디지털 전용</div>
  <div class="xcv-pkg-name">스타트업 패키지</div>
  <div class="xcv-pkg-price">$200 <small>/ 월</small></div>
  <div class="xcv-pkg-divider"></div>
  <ul class="xcv-pkg-desc">
    <li>이메일 홍보카드 월 2회 발송</li>
    <li>SNS 홍보 포함</li>
  </ul>
</div>
```

> version_b에서는 `xcvSelPkg` 대신 `selPkg`를 사용합니다.

> **중요:** 폼에 새 패키지를 추가하면 `api/chat.js`의 `SYSTEM_PROMPT`(88~111번 줄)에도 동일한 패키지 정보를 추가해야 챗봇이 추천할 수 있습니다.

---

#### URL 파라미터 자동선택 기능 설명

챗봇의 "광고 신청하기" 버튼을 클릭하면 URL에 파라미터가 붙어 폼 페이지로 이동합니다. 폼은 이 파라미터를 읽어 자동으로 항목을 선택해 줍니다.

**처리 위치:**
- version_a: 1154~1204번 줄
- version_b: 1100~1141번 줄

**지원하는 파라미터:**

| 파라미터 | 기능 | 예시 |
|----------|------|------|
| `pkg` | 해당 이름의 패키지 카드 자동 선택 | `pkg=통합 패키지 B` |
| `months` | 해당 기간 버튼 자동 선택 | `months=6` |
| `addons` | 해당 단품 옵션 자동 체크 (쉼표 구분) | `addons=잡지 전면 ($900/월)` |

파라미터가 하나라도 있으면 폼 상단에 안내 배너도 자동으로 표시됩니다:  
`"챗봇 추천 패키지가 선택되었습니다. 기본 정보를 입력 후 다음으로 진행하세요."`

---

#### GAS URL 연동 구조

폼 제출 시 Google Apps Script(GAS) URL로 데이터를 전송해 스프레드시트에 자동 등록합니다.

**GAS URL 위치:**
- version_a: 904번 줄
- version_b: 873번 줄

```javascript
var GAS_URL = "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";
```

**전송되는 데이터 항목:** 날짜, 회사명, 담당자명, 직책, 전화, 이메일, 광고 유형(패키지명), 추가 옵션, 시작일, 계약 기간, 요청사항, 견적 금액, 회사 소개, 세금계산서 정보, 첨부 파일명 등

> **주의:** GAS URL을 바꾸려면 `GoogleAppsScript_광고문의자동등록.gs` 파일을 새로 배포하고 URL을 업데이트해야 합니다.

---

## 3. 운영 가이드

### 수정 → 배포 절차

파일을 수정한 후 아래 순서로 배포합니다. Vercel이 GitHub과 연결되어 있어 push만 하면 자동 배포됩니다.

```bash
# 1. 수정한 파일 스테이징
git add .

# 2. 커밋 (변경 내용 메모)
git commit -m "가격 업데이트: 디지털 스타터 $250 → $300"

# 3. GitHub에 push → Vercel 자동 배포 시작
git push
```

**배포 확인:** Vercel 대시보드 (https://vercel.com/dashboard) 에서 배포 상태 확인 가능. 초록색 체크표시가 나오면 완료.

---

### 환경변수 관리

챗봇이 작동하려면 OpenAI API 키가 반드시 설정되어 있어야 합니다.

**설정 위치:** Vercel 대시보드 → 프로젝트 선택 → Settings → Environment Variables

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `OPENAI_API_KEY` | `sk-...` 로 시작하는 키 | OpenAI API 키 |

**로컬 개발 시:** 프로젝트 루트에 `.env.local` 파일을 만들고 아래 내용 추가:
```
OPENAI_API_KEY=sk-...your-key-here...
```

> `.env.local` 파일은 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않습니다.

---

### 비용 관리 (OpenAI API 사용량 모니터링)

**모니터링 방법:**
1. https://platform.openai.com 접속 → 로그인
2. 우측 상단 메뉴 → "Usage" 클릭
3. 날짜별, 모델별 사용량 및 비용 확인

**비용 절감 팁:**
- `api/chat.js` 265번 줄의 `model: "gpt-4o-mini"` — 현재 가장 저렴한 모델 사용 중
- 265번 줄의 `max_tokens: 1024` — 응답 최대 길이 제한 (값을 낮추면 비용 감소)
- 한 번의 챗봇 대화 = 약 $0.001~0.003 수준 (GPT-4o mini 기준)

**예산 한도 설정:** OpenAI 대시보드 → Settings → Billing → Usage limits 에서 월 최대 한도 설정 권장

---

### 트러블슈팅

#### 챗봇 응답이 안 될 때

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| 빨간 오류 배너 표시 | API 키 없거나 만료 | Vercel 환경변수에서 `OPENAI_API_KEY` 확인 |
| "사용량 한도 초과" 오류 | OpenAI 크레딧 부족 | OpenAI 대시보드에서 충전 또는 한도 상향 |
| 응답은 오지만 추천 카드가 안 뜸 | JSON 파싱 실패 | 정상 동작 (GPT가 아직 패키지를 결정 못 한 경우) |
| 아무 반응 없음 | 네트워크 오류 | 브라우저 콘솔(F12) 오류 메시지 확인 |

**Vercel 서버 로그 확인 방법:**
1. Vercel 대시보드 → 프로젝트 선택
2. "Functions" 탭 → `/api/chat` 선택
3. 최근 호출 내역 및 오류 메시지 확인 가능

#### 폼 제출 후 스프레드시트에 데이터가 안 들어올 때

| 원인 | 해결 방법 |
|------|-----------|
| GAS URL 만료 또는 변경 | `GoogleAppsScript_광고문의자동등록.gs`를 다시 배포하고 URL 업데이트 |
| GAS 권한 문제 | GAS 스크립트 편집기에서 "배포" → "액세스 권한" 확인 |

> **참고:** 폼은 `mode: 'no-cors'`로 전송하기 때문에 브라우저에서 성공/실패를 직접 확인할 수 없습니다. GAS 스크립트의 실행 로그에서 확인하세요.

---

## 4. 자주 하는 수정 시나리오

---

### 시나리오 1: 가격 인상 시

**예시: 디지털 프리미엄을 $350 → $400으로 인상**

**Step 1 — `api/chat.js` 수정 (93번 줄)**

```
# Before
2. 디지털 프리미엄        $350/월
   - 이메일 홍보카드 월 4회 + 웹 인너배너 + 앱 인너배너 + 앱 하단배너

# After
2. 디지털 프리미엄        $400/월
   - 이메일 홍보카드 월 4회 + 웹 인너배너 + 앱 인너배너 + 앱 하단배너
```

**Step 2 — `wordpress_ad_form/version_a_wp_custom_html.html` 수정 (553번 줄)**

```html
<!-- Before -->
<div class="xcv-pkg-card" data-price="350" data-name="디지털 프리미엄" ...>
  <div class="xcv-pkg-price">$350 <small>/ 월</small></div>

<!-- After -->
<div class="xcv-pkg-card" data-price="400" data-name="디지털 프리미엄" ...>
  <div class="xcv-pkg-price">$400 <small>/ 월</small></div>
```

**Step 3 — `wordpress_ad_form/version_b_standalone.html`도 동일하게 수정 (526번 줄)**

**Step 4 — 배포**
```bash
git add .
git commit -m "가격 인상: 디지털 프리미엄 $350 → $400"
git push
```

---

### 시나리오 2: 새 패키지 추가 시

**예시: "미니 패키지 $150/월" 추가**

**Step 1 — `api/chat.js` SYSTEM_PROMPT에 추가 (패키지 목록 섹션 88~111번 줄)**

```
# 기존 목록 맨 아래에 추가
8. 미니 패키지             $150/월
   - 이메일 홍보카드 월 2회
```

**Step 2 — 폼 HTML에 패키지 카드 추가 (version_a 패키지 그리드 내)**

```html
<div class="xcv-pkg-card" data-price="150" data-name="미니 패키지" data-adtype="미니 패키지" onclick="xcvSelPkg(this)">
  <div class="xcv-pkg-tag">디지털 전용</div>
  <div class="xcv-pkg-name">미니 패키지</div>
  <div class="xcv-pkg-price">$150 <small>/ 월</small></div>
  <div class="xcv-pkg-divider"></div>
  <ul class="xcv-pkg-desc">
    <li>이메일 홍보카드 월 2회 발송</li>
  </ul>
</div>
```

**Step 3 — version_b에도 동일하게 추가 (onclick은 `selPkg(this)`)**

**Step 4 — 배포**
```bash
git add .
git commit -m "새 패키지 추가: 미니 패키지 $150/월"
git push
```

---

### 시나리오 3: 지역 제한 규칙 변경 시

**예시: 하노이 고객에게도 잡지 추천 허용하도록 변경**

`api/chat.js` 74~80번 줄의 지역 제한 섹션을 수정합니다.

```
# Before (74~80번 줄)
■ 지역 제한 규칙 (반드시 준수)
• 잡지(오프라인): 호찌민 전역 배포. 잡지 콘텐츠는 사이트에도 게시되어 온라인으로 전국/해외 노출 가능
• 옐로페이지: 호찌민(빈증 포함) 지역 한정
• 온라인 광고(웹배너·앱배너·이메일 홍보카드): 지역 제한 없음, 다국어 지원으로 현지인/외국인 유입 가능
★ 하노이·다낭 등 호찌민 외 지역 고객: 잡지·옐로페이지 제외, 디지털 패키지만 추천
★ 호찌민 고객: 온·오프라인 통합 패키지 적극 추천

# After (규칙 변경)
■ 지역 제한 규칙
• 잡지(오프라인): 호찌민 전역 배포. 전국 구독자에게도 콘텐츠 노출
• 옐로페이지: 호찌민(빈증 포함) 지역 한정
• 온라인 광고(웹배너·앱배너·이메일 홍보카드): 지역 제한 없음
★ 하노이·다낭 등 호찌민 외 지역 고객: 잡지는 온라인 노출로 소개 가능, 옐로페이지는 제외
★ 호찌민 고객: 온·오프라인 통합 패키지 적극 추천
```

**배포:**
```bash
git add api/chat.js
git commit -m "지역 제한 규칙 완화: 하노이 고객에게 잡지 소개 허용"
git push
```

---

### 시나리오 4: 담당자 연락처 변경 시

`api/chat.js`에서 두 곳을 수정해야 합니다.

**수정 위치 1: 담당자 연락처 섹션 (156~160번 줄)**

```
# Before
■ 담당자 연결
• 이메일: info@chaovietnam.co.kr
• 전화: 079-283-2000

# After
■ 담당자 연결
• 이메일: ads@chaovietnam.co.kr
• 전화: 079-283-9999
```

**수정 위치 2: 행동 지침 7번 (171번 줄)**

```
# Before
7. 답하기 어려운 전문 상담 질문에는 담당자 연결을 안내합니다 (이메일: info@chaovietnam.co.kr / 전화: 079-283-2000).

# After
7. 답하기 어려운 전문 상담 질문에는 담당자 연결을 안내합니다 (이메일: ads@chaovietnam.co.kr / 전화: 079-283-9999).
```

**배포:**
```bash
git add api/chat.js
git commit -m "담당자 연락처 업데이트"
git push
```

---

### 시나리오 5: 챗봇 응대 톤 변경 시

**예시: 더 친근한 반말 톤으로 변경**

`api/chat.js` 51~53번 줄의 첫 지시문과 163~165번 줄 행동 지침을 수정합니다.

```
# Before (51~53번 줄)
당신은 씬짜오베트남(Xinchao Vietnam)의 광고 안내 전문 AI 컨설턴트입니다.
한국어로만 대화하며, 친절하고 전문적인 톤을 유지합니다.

# After
당신은 씬짜오베트남(Xinchao Vietnam)의 광고 안내 AI 컨설턴트입니다.
한국어로만 대화하며, 친절하고 편안한 반말 톤으로 대화합니다. (예: "~해요" 대신 "~해")
```

> **팁:** 톤 변경 후에는 실제로 챗봇과 몇 번 대화해보며 원하는 방향인지 확인하세요. GPT는 지시문에 따라 톤을 유연하게 조정합니다.

**배포:**
```bash
git add api/chat.js
git commit -m "챗봇 응대 톤 변경: 친근한 반말 톤으로"
git push
```

---

## 부록: 파일 구조 요약

```
C:\xinchao_crm\
├── api/
│   └── chat.js                           ← 챗봇 API (GPT 연동)
├── public/
│   ├── chatbot-widget.js                 ← 챗봇 UI 위젯
│   └── chatbot-test.html                 ← 로컬 테스트용 페이지
├── wordpress_ad_form/
│   ├── version_a_wp_custom_html.html     ← WP Custom HTML 블록용 폼
│   ├── version_b_standalone.html         ← 단독 HTML 파일용 폼
│   └── README.md                         ← 폼 간단 사용법
├── vercel.json                           ← Vercel 배포 설정
├── .env.local (로컬 전용, Git 제외)       ← 로컬 API 키
└── CHATBOT_GUIDE.md                      ← 이 문서
```

---

*문의: info@chaovietnam.co.kr | 전화: 079-283-2000*
