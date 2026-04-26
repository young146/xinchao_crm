# 씬짜오베트남 광고 신청 폼 — WordPress 적용 패키지

## 파일 구성

| 파일 | 용도 |
|------|------|
| `version_a_wp_custom_html.html` | WordPress Custom HTML 블록용 |
| `version_b_standalone.html` | 독립 HTML 파일 (iframe 삽입용) |

---

## 버전 A — WordPress Custom HTML 블록

### 특징
- **CSS 클래스 격리**: 모든 클래스에 `xcv-` prefix 적용 → WP 테마/플러그인과 CSS 충돌 없음
- **JS 격리**: 모든 함수를 IIFE(`(function(){ ... })()`) 로 래핑 → 전역 네임스페이스 오염 없음
- **변수 격리**: CSS 변수도 `.xcv-wrap` 스코프에 선언하여 테마와 분리
- **`<html>`, `<body>`, `<head>` 없음**: WP 페이지 내부에 바로 삽입 가능

### 적용 방법

1. WordPress 관리자 > 페이지/게시물 편집
2. 블록 추가 → **Custom HTML** 블록 선택
3. `version_a_wp_custom_html.html` 전체 내용 복사·붙여넣기
4. 미리보기 후 게시

### 주의사항
- WP 테마에 따라 `max-width` 제한이 있을 수 있습니다. 필요 시 부모 블록에 `full width` 설정 권장
- 일부 보안 플러그인(Wordfence 등)이 인라인 `<script>` 를 차단할 수 있습니다. 화이트리스트 등록 필요

---

## 버전 B — 독립 HTML 파일 (iframe용)

### 특징
- 완전한 독립 HTML 파일 (`<!DOCTYPE html>` 포함)
- 원본 구조·CSS 그대로 유지 (테마 충돌 없음)
- **ondragover 버그 수정** 포함

### 적용 방법 1 — 직접 호스팅 후 iframe 삽입

1. `version_b_standalone.html` 을 서버에 업로드
   - 예: `https://chaovietnam.co.kr/forms/ad-form.html`

2. WP 페이지에 Custom HTML 블록으로 아래 코드 삽입:

```html
<iframe
  src="https://chaovietnam.co.kr/forms/ad-form.html"
  style="width:100%;border:none;min-height:900px;"
  scrolling="no"
  id="xcv-ad-iframe"
  title="광고 신청 폼">
</iframe>
<script>
// iframe 높이 자동 조정 (선택 — 같은 도메인일 때만 동작)
(function(){
  var fr = document.getElementById('xcv-ad-iframe');
  if(!fr) return;
  fr.onload = function(){
    try {
      fr.style.height = fr.contentDocument.body.scrollHeight + 'px';
    } catch(e) {}
  };
})();
</script>
```

### 적용 방법 2 — WP 미디어 라이브러리 업로드

1. WordPress 관리자 > 미디어 > 새로 추가 → `version_b_standalone.html` 업로드
2. 업로드된 파일 URL 복사 (예: `https://chaovietnam.co.kr/wp-content/uploads/2026/ad-form.html`)
3. 위와 동일하게 iframe으로 삽입

---

## 버그 수정 내역

| 위치 | 원본 코드 | 수정 코드 | 비고 |
|------|-----------|-----------|------|
| `upload-zone` ondragover | `ev.preventDefault()` | `event.preventDefault()` | `ev` 미정의 변수 → `ReferenceError` 발생, 드래그앤드롭 비활성화 |

---

## 반응형 브레이크포인트

| 화면 너비 | 변화 |
|-----------|------|
| > 540px | 패키지 2열, 추가옵션 2열, 입력 2열 |
| ≤ 540px | 추가옵션 1열, 입력 1열, 기간버튼 wrap |

---

## GAS 연동

- GAS URL은 두 버전 모두 소스 내 **하드코딩** 상태로 유지됨
- 변경이 필요할 경우 파일 내 `GAS_URL` 변수값만 수정

```
버전 A: version_a_wp_custom_html.html 내 var GAS_URL = "..."
버전 B: version_b_standalone.html 내 var GAS_URL = "..."
```

---

## 테스트 체크리스트

- [ ] STEP 1 → 2 → 3 → 4 → 5 정상 이동
- [ ] 패키지 선택 후 견적 금액 계산 정확
- [ ] 장기할인(3/6/12개월) 할인율 반영
- [ ] 파일 드래그앤드롭 동작 (버그 수정 후)
- [ ] 세금계산서 토글 on/off
- [ ] 제출 후 GAS 스프레드시트에 데이터 기록 확인
- [ ] 모바일(375px) 반응형 레이아웃 확인
