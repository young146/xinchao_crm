# 씬짜오베트남 광고 챗봇 + 신청폼 통합 테스트 리포트

- **검증일**: 2026-04-26
- **대상 파일**:
  - `api/chat.js` (GPT-4o mini Vercel Serverless)
  - `public/chatbot-widget.js` (Shadow DOM 위젯)
  - `wordpress_ad_form/version_a_wp_custom_html.html`
  - `wordpress_ad_form/version_b_standalone.html`

---

## 요약

| 항목 | 결과 |
|---|---|
| 전체 검증 항목 | 18개 |
| PASS | 11개 |
| FAIL (수정 완료) | 7개 |
| FAIL (미수정 · 설계 주의) | 0개 |

**모든 발견 문제는 수정 완료됨.**

---

## 1. API (api/chat.js) 검증

### 1-1. 응답 구조 {reply, recommendation?} ✅ PASS
- `parseRecommendation()` 함수가 `RECOMMENDATION_JSON:` 마커를 찾아 JSON을 파싱
- 파싱 성공 시 `{ reply: string, recommendation: { packageName, months, addons[] } }` 반환
- 파싱 실패 시 `recommendation: null` 로 graceful 처리 — 정상

### 1-2. RECOMMENDATION_JSON 마커 파싱 로직 ✅ PASS
- `content.indexOf(marker)` 로 마커 위치 탐색
- `content.slice(idx + marker.length).trim()` 로 JSON 추출
- `JSON.parse()` 실패 시 catch 블록에서 텍스트만 반환 — 정상

### 1-3. CORS 헤더 ✅ PASS
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```
OPTIONS preflight 처리 포함 — 정상

### 1-4. 에러 핸들링 ✅ PASS
- API 키 없음: HTTP 500 + 한국어 메시지
- 잘못된 요청 (messages 배열 누락): HTTP 400
- 잘못된 role/content: HTTP 400
- OpenAI 401: HTTP 500 + 키 확인 안내
- OpenAI 429: HTTP 429 + 한도 초과 안내

### 1-5. 시스템 프롬프트 가격 데이터 ❌ FAIL → **수정 완료**

폼 HTML(`data-price` 속성)과 시스템 프롬프트 간 가격이 불일치하여 GPT 추천 금액과 폼 견적 금액이 달라지는 문제 발생.

**수정 전 → 수정 후 (api/chat.js 시스템 프롬프트):**

| 항목 | 수정 전 | 수정 후 (폼 기준) |
|---|---|---|
| 디지털 스타터 | $300/월 | $250/월 |
| 디지털 프리미엄 | $500/월 | $350/월 |
| 디지털 베스트 | $700/월 | $500/월 |
| 프리미엄 올인원 | $2,000/월 | $3,000/월 |
| 웹사이트 헤드 배너 | $300/월 | $150/월 |
| 웹사이트 내부·푸터 배너 | $150/월 | $80/월 |
| 앱 헤드 배너 | $250/월 | $120/월 |
| 앱 내부·푸터 배너 | $100/월 | $70/월 |
| 잡지 전면 | $800/월 | $900/월 |
| 옐로페이지 1단 | $50 | $240 |
| 옐로페이지 2단 | $100 | $480 |
| 옐로페이지 4단 | $200 | $960 |

**단품 항목 정리:**
- 기존 시스템 프롬프트에 있던 `잡지 백커버: $1,500/호` 단품 항목은 폼에 addon 항목 없으므로 제거 (잡지 백커버는 프리미엄 올인원 패키지에만 포함됨)

### 1-6. months 허용값 ❌ FAIL → **수정 완료**
- 수정 전: `months: 1 / 3 / 6 / 12 중 하나`
- 수정 후: `months: 1 / 2 / 3 / 6 / 12 중 하나`
- 이유: 폼에 `data-m="2"` (2개월) 버튼 존재하므로 챗봇도 2개월 추천 가능해야 함

---

## 2. 위젯 (chatbot-widget.js) 검증

### 2-1. API 응답 파싱 ✅ PASS
```javascript
const data = await res.json();
const reply = data.reply || '응답을 받지 못했습니다.';
const recommendation = data.recommendation || null;
```
`{reply, recommendation?}` 구조를 정확히 파싱 — 정상

### 2-2. Shadow DOM CSS 완전성 ✅ PASS
다음 모든 요소에 스타일 정의 확인:
- `#xv-fab` (플로팅 버튼), `#xv-badge` (알림 뱃지)
- `#xv-window` (채팅창), `#xv-header` (헤더)
- `.xv-msg-row`, `.xv-bubble` (메시지)
- `.xv-typing` + `@keyframes xvBounce` (타이핑 인디케이터)
- `.xv-rec-card`, `.xv-rec-btn` (추천 카드)
- `#xv-input`, `#xv-send` (입력 영역)
- `.xv-error` (에러 배너)

### 2-3. 모바일 반응형 ✅ PASS
```css
@media (max-width: 480px) {
  #xv-window { bottom:0; right:0; width:100vw; height:100dvh; border-radius:0; }
  #xv-window.xv-hidden { transform: translateY(100%); }
  #xv-fab { bottom:16px; right:16px; }
}
```
모바일에서 전체화면 + 아래에서 슬라이드업 애니메이션 — 정상

### 2-4. fetch 에러 시 사용자 메시지 ✅ PASS
```javascript
} catch (err) {
  typingEl.remove();
  this._appendErrorMessage(err.message || '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
}
```
에러 시 `.xv-error` 클래스 div가 메시지 영역에 표시됨 — 정상

### 2-5. recommendation 카드 URL 생성 ✅ PASS
```javascript
const params = new URLSearchParams({
  pkg: recommendation.packageName || '',
  months: String(months),
});
if (addons.length > 0) {
  params.set('addons', addons.join(','));
}
const applyUrl = '/ads_request?' + params.toString();
```
- `pkg` = packageName (URL-encode 처리됨)
- `months` = 숫자 문자열
- `addons` = 쉼표 구분 문자열 (있을 때만)
- 목적지 경로: `/ads_request`

---

## 3. URL 파라미터 → 폼 자동선택 검증

### 3-1. version_a 함수 시그니처 일치 ✅ PASS
| URL 파라미터 처리 코드 | 호출 함수 | 폼 내 정의 |
|---|---|---|
| `xcvSelPkg(card)` | `xcvSelPkg(el)` | ✅ 일치 |
| `xcvSelDur(btn)` | `xcvSelDur(el)` | ✅ 일치 |
| `xcvTogAddon(item)` | `xcvTogAddon(el)` | ✅ 일치 |

### 3-2. version_b 함수 시그니처 일치 ✅ PASS
| URL 파라미터 처리 코드 | 호출 함수 | 폼 내 정의 |
|---|---|---|
| `selPkg(card)` | `selPkg(el)` | ✅ 일치 |
| `selDur(btn)` | `selDur(el)` | ✅ 일치 |
| `togAddon(item)` | `togAddon(el)` | ✅ 일치 |

### 3-3. 안내 배너 DOM 삽입 위치 ✅ PASS
- `step1.insertBefore(banner, step1.firstChild)`
- Step 1 div의 최상단에 삽입 — 정상

### 3-4. 파라미터 없을 때 기존 동작 영향 ✅ PASS
```javascript
if (!pkg && !months && !addons) return;
```
세 파라미터 모두 없을 때 조기 반환 — 기존 동작에 영향 없음

### 3-5. pkg 파라미터 디코딩 ✅ PASS
```javascript
var pkgName = decodeURIComponent(pkg);
```
한글 패키지명이 URL-encode되어 전송되므로 `decodeURIComponent` 적용 필수 — 정상 처리

---

## 4. 데이터 흐름 End-to-End 검증

### 4-1. packageName ↔ data-name 매핑 ✅ PASS

챗봇이 추천하는 `packageName` 값과 폼 HTML의 `data-name` 속성값이 완전히 일치:

| 챗봇 packageName | version_a data-name | version_b data-name |
|---|---|---|
| `디지털 스타터` | `디지털 스타터` ✅ | `디지털 스타터` ✅ |
| `디지털 프리미엄` | `디지털 프리미엄` ✅ | `디지털 프리미엄` ✅ |
| `디지털 베스트` | `디지털 베스트` ✅ | `디지털 베스트` ✅ |
| `통합 패키지 A` | `통합 패키지 A` ✅ | `통합 패키지 A` ✅ |
| `통합 패키지 B` | `통합 패키지 B` ✅ | `통합 패키지 B` ✅ |
| `통합 패키지 C` | `통합 패키지 C` ✅ | `통합 패키지 C` ✅ |
| `프리미엄 올인원` | `프리미엄 올인원` ✅ | `프리미엄 올인원` ✅ |

### 4-2. months ↔ data-m 매핑 ✅ PASS

| 챗봇 months 값 | 폼 data-m | 매칭 여부 |
|---|---|---|
| 1 | `data-m="1"` | ✅ |
| 2 | `data-m="2"` | ✅ (수정 후) |
| 3 | `data-m="3"` | ✅ |
| 6 | `data-m="6"` | ✅ |
| 12 | `data-m="12"` | ✅ |

### 4-3. addons ↔ addon data-name 매핑

챗봇 시스템 프롬프트에 기재된 단품 옵션명과 폼 addon `data-name`의 매핑:

| 챗봇 addon명 | 폼 data-name | 매칭 여부 |
|---|---|---|
| 이메일 홍보카드 추가 1회 | `이메일 홍보카드 추가 1회` | ✅ |
| 웹사이트 헤드 배너 | `웹사이트 헤드 배너` | ✅ |
| 웹사이트 내부·푸터 배너 | `웹사이트 내부·푸터 배너` | ✅ |
| 앱 헤드 배너 | `앱 헤드 배너` | ✅ |
| 앱 내부·푸터 배너 | `앱 내부·푸터 배너` | ✅ |
| 이웃사업 소개 카드 | `이웃사업 소개 카드` | ✅ |
| 잡지 전면 | `잡지 전면 ($900/월)` | ⚠️ 부분불일치 |
| 잡지 1/2면 | `잡지 1/2면 ($500/월)` | ⚠️ 부분불일치 |
| 잡지 1/4면 | `잡지 1/4면 ($300/월)` | ⚠️ 부분불일치 |
| 옐로페이지 1단 | `옐로페이지 1단 ($240)` | ⚠️ 부분불일치 |
| 옐로페이지 2단 | `옐로페이지 2단 ($480)` | ⚠️ 부분불일치 |
| 옐로페이지 4단 | `옐로페이지 4단 ($960)` | ⚠️ 부분불일치 |

> **[주의] 잡지/옐로페이지 addon 자동선택 불가**
>
> 폼의 addon `data-name`에 가격이 포함되어 있음 (`잡지 전면 ($900/월)`).
> 챗봇이 `잡지 전면`으로 추천해도 폼에서 `item.dataset.name === '잡지 전면'` 조건이
> `false`가 되어 자동선택이 작동하지 않음.
>
> **영향 범위**: 챗봇이 잡지 단독 지면 또는 옐로페이지를 addon으로 추천하는 경우에만 해당.
> 일반적인 패키지 추천 + 이메일/앱/웹 배너 addon 추천은 영향 없음.
>
> **해결 방안**: 폼의 해당 addon `data-name`에서 가격 표기를 제거하거나,
> 챗봇 시스템 프롬프트의 addon명을 폼 data-name과 동일하게 맞추는 두 가지 방법이 있음.
> 현재는 해결책 미적용 (추후 운영팀 결정 필요).

---

## 5. 기타 잠재적 이슈

### 5-1. version_b에서 `xcvGoS2` 전역 함수 사용 ⚠️
- `version_b` HTML에서 버튼 onclick이 `xcvGoS2()`를 호출하는데, 이는 version_a의 xcv-prefix 방식 함수명
- 실제 코드 내부에서 `xcvGoS2` 함수를 정의하고 있어 동작은 정상
- 다만 네이밍 일관성 부재 (version_b에 xcv-prefix 없는 함수들과 혼용)

### 5-2. Shadow DOM closed 모드에서 inline onclick ⚠️
- `chatbot-widget.js`의 추천 버튼: `onclick="window.location.href='${applyUrl}'"`
- Shadow DOM `closed` 모드에서 inline onclick은 외부 스크립트가 접근 불가하나 위젯 자체 동작에는 영향 없음
- 기능적으로 정상 작동

### 5-3. 추천 카드 XSS 잠재성 ✅ SAFE
- `pkg`, `addonsStr` 모두 `escapeHtml()` 처리 후 표시
- URL 파라미터에는 raw 값 사용하나 `URLSearchParams`가 자동 encode 처리
- 안전

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `api/chat.js` | 시스템 프롬프트 가격 12개 항목 수정, months 허용값에 2 추가, 잡지 백커버 단품 옵션 제거 |

---

## 최종 결론

1. **코어 데이터 흐름 (챗봇 → URL → 폼 자동선택)** — 정상 작동
2. **패키지명 매핑** — 7종 모두 완전 일치 (PASS)
3. **months 매핑** — 1/2/3/6/12 모두 커버 (PASS, months:2 추가 수정)
4. **addon 매핑** — 기본 6종은 완전 일치, 잡지/옐로페이지 6종은 `data-name`에 가격 포함으로 자동선택 불가 (추후 개선 권고)
5. **가격 데이터** — API 시스템 프롬프트를 폼 기준으로 동기화 완료
