# 데일리뉴스 SEO 키워드 자동화 — 구현 계획서 (Sonnet 작업 지시서)

> 목적: 매일 아침 발행되는 베트남 뉴스(daily-news-final 파이프라인)에
> **검색량 높은 키워드를 뉴스 성격에 맞게 자동 매칭하여 SEO 제목·태그·메타를 생성**하고,
> 워드프레스(chaovietnam.co.kr)에 자동 발행하여 애드센스 노출·클릭을 늘린다.
>
> 이 문서는 Claude Sonnet 급 모델이 **이 문서만 보고 구현을 완료**할 수 있도록 작성된 작업 지시서다.
> 구현 위치는 `daily-news-final` 저장소이며, 기존 파이프라인 코드를 먼저 읽고
> 아래 "통합 지점" 표시(🔌)에 맞춰 연결할 것.

---

## 1. 전체 아키텍처

```
[기존] 뉴스 추출 → 번역 → (이메일/SNS 발송)
                      │
                      ▼ 🔌 통합 지점 A: 번역 완료된 기사 목록(제목+본문)
             ┌─────────────────────┐
             │ ② SEO 인리처         │  ← ① 키워드 풀 (주 1회 갱신, JSON 파일)
             │  - 카테고리 분류      │
             │  - 키워드 1~2개 매칭  │
             │  - SEO 제목/태그/메타 │
             └─────────────────────┘
                      │
                      ▼
             ③ 워드프레스 REST API 발행
                      │
                      ▼
             ④ 스케줄러 (GitHub Actions cron)
```

새로 만드는 모듈은 3개 + 워크플로 1개. 언어는 **기존 파이프라인과 동일한 언어**를 사용할 것
(파이썬이면 파이썬, Node면 Node — 저장소를 열어 확인).

---

## 2. 모듈 ①: 키워드 풀 빌더 (`keyword_pool.py` / `keywordPool.js`)

### 역할
한국인·베트남 거주 교민이 실제로 검색하는 "베트남 관련 검색어"를 수집해
카테고리별 키워드 풀 JSON을 만든다. **주 1회 실행**이면 충분.

### 데이터 소스 (우선순위 순)
1. **네이버 검색광고 API** (`api.searchad.naver.com`, RelKwdStat)
   - 무료. 월간 검색량(PC+모바일)을 정확히 제공.
   - 시드 키워드: `베트남`, `다낭`, `하노이`, `호치민`, `나트랑`, `푸꾸옥`, `베트남 환율`,
     `베트남 비자`, `베트남 여행`, `베트남 부동산`, `베트남 주식`, `베트남 골프`
   - 시드당 연관 키워드 최대 100개 반환 → 전부 수집 후 중복 제거.
   - 인증: API_KEY, SECRET_KEY, CUSTOMER_ID 3개 (HMAC-SHA256 서명 헤더). 환경변수로 주입.
2. **Google Trends (pytrends 또는 google-trends-api)** — 보조용
   - `geo=KR`, `geo=VN` 두 가지로 관련 쿼리 수집. 실패해도 파이프라인이 죽지 않게 try/except.

### 출력 스키마 — `data/keyword_pool.json`
```json
{
  "updated_at": "2026-07-02",
  "categories": {
    "경제": [
      {"keyword": "베트남 환율", "monthly_volume": 41000},
      {"keyword": "베트남 주식", "monthly_volume": 18000}
    ],
    "여행": [{"keyword": "다낭 여행", "monthly_volume": 92000}],
    "사회/생활": [{"keyword": "베트남 비자", "monthly_volume": 35000}],
    "부동산": [{"keyword": "베트남 부동산", "monthly_volume": 9000}],
    "스포츠/연예": [],
    "한-베 관계": []
  }
}
```
- 카테고리 분류는 수집 시점에 규칙 기반(키워드에 포함된 단어로 1차 분류) +
  애매한 것은 Haiku 한 번 호출로 일괄 분류.
- 검색량 500 미만 키워드는 버린다.

### 수용 기준 (acceptance)
- [ ] 실행하면 `data/keyword_pool.json`이 생성/갱신된다.
- [ ] 네이버 API 키가 없으면 명확한 에러 메시지를 내고 종료(silent fail 금지).
- [ ] Google Trends 실패 시에도 네이버 결과만으로 파일이 생성된다.

---

## 3. 모듈 ②: SEO 인리처 (`seo_enricher.py` / `seoEnricher.js`) — 핵심

### 역할
기사 1건(한국어 번역 제목+본문)을 받아 SEO 메타데이터를 생성한다.

### 사용 모델
**`claude-haiku-4-5-20251001`** (Anthropic API). 이 작업은 분류+제목 다듬기 수준이라
Haiku로 충분하며 하루 50건 기준 월 1~2천 원 수준. Sonnet 이상 쓰지 말 것(비용 낭비).

### 처리 로직
1. `keyword_pool.json` 로드.
2. 기사당 1회 API 호출. 프롬프트에 (a) 기사 제목+본문 앞 1,500자, (b) 카테고리 목록,
   (c) 각 카테고리의 상위 키워드 15개를 넣는다.
3. 응답은 반드시 JSON 강제 (tool use 또는 "JSON만 출력" + 파싱 재시도 1회).

### 프롬프트 템플릿 (그대로 사용)
```
당신은 베트남 뉴스 한국어 사이트의 SEO 에디터입니다.
아래 기사를 읽고 다음 JSON만 출력하세요.

규칙:
- category: 반드시 제공된 카테고리 중 하나.
- keywords: 제공된 키워드 풀에서 기사 내용과 실제로 관련 있는 것만 1~2개.
  관련 키워드가 없으면 빈 배열. 억지로 넣지 말 것(애드센스 정책상 낚시성 금지).
- seo_title: 선택한 키워드를 제목 앞부분에 자연스럽게 포함. 55자 이내.
  기사 내용과 다른 과장·낚시 표현 금지. 키워드가 없으면 원제목을 다듬기만.
- slug: 영문 소문자와 하이픈만, 5단어 이내.
- meta_description: 150자 이내, 키워드 1회 포함.
- tags: 키워드 + 기사 핵심 고유명사, 최대 6개.

카테고리 목록: {categories}
키워드 풀: {keyword_candidates}

기사 제목: {title}
기사 본문: {body_1500}

출력 형식:
{"category": "...", "keywords": ["..."], "seo_title": "...",
 "slug": "...", "meta_description": "...", "tags": ["..."]}
```

### 수용 기준
- [ ] 입력: 기사 리스트 → 출력: 기사별 SEO 메타 JSON 리스트.
- [ ] API 오류 시 3회 재시도(지수 백오프), 최종 실패 기사는 **원제목 그대로** 통과시켜
      발행이 멈추지 않게 한다 (fallback 필수).
- [ ] 생성된 seo_title이 60자를 넘으면 원제목으로 fallback.

---

## 4. 모듈 ③: 워드프레스 발행기 (`wp_publisher.py` / `wpPublisher.js`)

### 역할
SEO 메타가 붙은 기사를 chaovietnam.co.kr 워드프레스에 발행.

### 구현
- WordPress REST API: `POST /wp-json/wp/v2/posts`
- 인증: **Application Password** (관리자 → 사용자 → 응용 프로그램 비밀번호 발급).
  `WP_URL`, `WP_USER`, `WP_APP_PASSWORD` 환경변수.
- 매핑:
  - `title` ← seo_title
  - `slug` ← slug
  - `content` ← 기사 본문 HTML (기존 파이프라인 출력 형식 사용)
  - `tags` / `categories` ← 이름으로 조회 후 없으면 생성 (`/wp/v2/tags`, `/wp/v2/categories`)
  - `status` ← 환경변수 `WP_POST_STATUS` (기본 `draft`, 검증 후 `publish`로 전환)
  - Yoast/RankMath 설치돼 있으면 meta_description을 해당 플러그인 메타필드로 전송
    (`yoast_wpseo_metadesc` 또는 `rank_math_description`). 없으면 excerpt에 넣는다.
- 🔌 통합 지점 B: 기존 파이프라인에 이미 WP 발행 코드가 있는지 먼저 확인.
  있으면 새로 만들지 말고 제목/태그 주입부만 수정할 것.

### 수용 기준
- [ ] 같은 기사를 두 번 실행해도 중복 포스팅되지 않는다
      (slug 또는 원문 URL 해시로 기발행 여부 체크 — `data/published.json`에 기록).
- [ ] 첫 배포는 `draft` 모드로 3일 운영하며 사람이 검수 → 문제없으면 `publish` 전환.

---

## 5. 모듈 ④: 스케줄러 (`.github/workflows/daily-seo-publish.yml`)

```yaml
name: Daily SEO Publish
on:
  schedule:
    - cron: '30 22 * * *'   # UTC 22:30 = 베트남 05:30, 한국 07:30
    - cron: '0 22 * * 0'    # 일요일: 키워드 풀 갱신 먼저
  workflow_dispatch:         # 수동 실행 버튼
```
- 잡 순서: (일요일만) 키워드 풀 갱신 → 뉴스 추출·번역(기존) → SEO 인리처 → WP 발행.
- `keyword_pool.json`, `published.json`은 잡 마지막에 커밋-푸시로 저장소에 영속화.
- Secrets 등록 목록: `ANTHROPIC_API_KEY`, `NAVER_AD_API_KEY`, `NAVER_AD_SECRET`,
  `NAVER_AD_CUSTOMER_ID`, `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`.

---

## 6. 애드센스 정책 가드레일 (반드시 지킬 것)

1. **낚시 금지**: 키워드는 기사 내용과 실제 관련 있을 때만. 프롬프트에 이미 반영됨 — 지우지 말 것.
2. **키워드 스터핑 금지**: 제목당 키워드 최대 2개, 본문은 건드리지 않는다.
3. 자동 발행 글도 출처(원 베트남 매체) 표기를 유지한다.
4. 초기 3일 draft 검수 기간을 생략하지 말 것.

---

## 7. 작업 순서 (Sonnet 실행 체크리스트)

1. [ ] `daily-news-final` 저장소 전체 구조 파악: 추출→번역→발송 흐름, 언어, 기사 데이터 구조 문서화
2. [ ] 🔌 통합 지점 A(번역 완료 기사 리스트)와 B(기존 WP 발행 여부) 확정
3. [ ] 모듈 ① 키워드 풀 빌더 구현 + 수동 실행으로 `keyword_pool.json` 생성 확인
4. [ ] 모듈 ② SEO 인리처 구현 + 최근 기사 5건으로 테스트, 출력 JSON 검증
5. [ ] 모듈 ③ WP 발행기 구현 (draft 모드) + 중복 방지 확인
6. [ ] 모듈 ④ GitHub Actions 워크플로 작성, Secrets 등록 안내 출력
7. [ ] 3일 draft 운영 후 `WP_POST_STATUS=publish` 전환
8. [ ] (선택) 발행 후 결과 요약을 이메일/카톡으로 관리자에게 통지

## 8. 비용·운영 추정

| 항목 | 비용 |
|---|---|
| Haiku API (하루 ~50건 × 2K 토큰) | 월 $1~2 |
| 네이버 검색광고 API | 무료 |
| GitHub Actions (public repo) | 무료 |
| 워드프레스 REST API | 무료 |

---
*작성: Claude (Fable) — xinchao_crm 세션. 구현 담당: Claude Sonnet (daily-news-final 저장소 세션에서 이 문서를 첨부하고 "이 계획서대로 구현해줘"라고 지시).*
