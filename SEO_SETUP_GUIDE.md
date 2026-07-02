# 씬짜오베트남 (chaovietnam.co.kr) SEO 종합 설정 가이드

> **작성 기준:** WordPress + Rank Math SEO + Hostinger 환경  
> **대상:** WP 관리자 패널에서 직접 실행 가능한 단계별 가이드  
> **마지막 업데이트:** 2026-04-26

---

## 목차

1. [Google Search Console 등록](#1-google-search-console-등록)
2. [Naver Webmaster Tools 등록](#2-naver-webmaster-tools-등록)
3. [Rank Math SEO 전체 설정](#3-rank-math-seo-전체-설정)
4. [광고 랜딩페이지 SEO (/ads_request)](#4-광고-랜딩페이지-seo)
5. [기술적 SEO 체크리스트](#5-기술적-seo-체크리스트)

---

## 1. Google Search Console 등록

### 1-1. Google Search Console 계정 접속

1. 브라우저에서 **https://search.google.com/search-console** 접속
2. 사이트 운영에 사용하는 Google 계정으로 로그인
3. 상단 드롭다운에서 **"속성 추가"** 클릭

### 1-2. 도메인 속성 추가

1. 속성 유형 선택 화면에서 **왼쪽의 "도메인"** 선택 (권장)
2. 입력란에 `chaovietnam.co.kr` 입력 (https:// 제외)
3. **"계속"** 클릭
4. DNS 인증 방법 안내 → **TXT 레코드 복사**

> **Hostinger DNS 설정 방법:**
> - Hostinger 관리 패널 → **도메인** → `chaovietnam.co.kr` → **DNS / Nameservers**
> - **"새 레코드 추가"** → 타입: `TXT`, 이름: `@`, 값: Google이 제공한 TXT 값 붙여넣기
> - TTL: 3600 (기본값) → **저장**
> - Google Search Console로 돌아와 **"확인"** 클릭
> - DNS 반영에 최대 24~48시간 소요될 수 있음

### 1-3. Rank Math를 통한 Google Search Console 연동

> Rank Math에 내장된 GSC 연동 기능을 사용하면 워드프레스 대시보드에서 GSC 데이터를 바로 확인할 수 있습니다.

1. WP 관리자 → 좌측 메뉴 **Rank Math** → **General Settings**
2. 상단 탭에서 **"Analytics"** 탭 클릭
3. **"Connect Google Services"** 버튼 클릭
4. Google 계정 로그인 팝업 → Search Console 연결된 계정 선택
5. 권한 허용 → Rank Math Analytics로 돌아오면 연동 완료
6. **"Site Console"** 드롭다운에서 `sc-domain:chaovietnam.co.kr` 선택 후 저장

### 1-4. Sitemap 제출

1. Google Search Console → 좌측 메뉴 **"Sitemaps"** 클릭
2. **"새 사이트맵 추가"** 입력란에 아래 URL 입력:

```
sitemap_index.xml
```

3. **"제출"** 클릭
4. 상태가 **"성공"** 으로 표시되면 완료
5. 추가로 Rank Math 사이트맵도 제출 (아래 참고):

```
sitemap_index.xml
```

> **현재 sitemap_index.xml에 126개 포스트 포함 확인됨** — 별도 추가 불필요

---

## 2. Naver Webmaster Tools 등록

### 2-1. 네이버 서치어드바이저 접속

1. **https://searchadvisor.naver.com** 접속
2. 네이버 계정으로 로그인 (없으면 신규 가입)
3. 우측 상단 **"웹마스터 도구"** 클릭
4. **"사이트 추가"** 버튼 클릭

### 2-2. 사이트 등록

1. 사이트 URL 입력: `https://chaovietnam.co.kr`
2. **"확인"** 클릭
3. 소유 확인 방법 선택 화면으로 이동

### 2-3. 사이트 소유 확인 (HTML 메타태그 방법 권장)

**방법 A: HTML 메타태그 (Rank Math 통해 삽입 — 권장)**

1. 네이버 서치어드바이저에서 **"HTML 태그"** 탭 선택
2. 다음과 같은 형식의 태그 표시됨:
   ```html
   <meta name="naver-site-verification" content="여기에_코드_표시됨" />
   ```
3. `content=""` 안의 코드 값 복사
4. WP 관리자 → **Rank Math** → **General Settings** → **"Webmaster Tools"** 탭
5. **"Naver Web Master"** 입력란에 복사한 코드 값만 붙여넣기 (메타태그 전체 아님)
6. **"Save Changes"** 클릭
7. 네이버 서치어드바이저로 돌아와 **"소유 확인"** 클릭

**방법 B: HTML 파일 업로드 (대안)**

1. 네이버에서 제공하는 `naver*.html` 파일 다운로드
2. Hostinger 파일 관리자 → `public_html` 루트 폴더에 파일 업로드
3. 브라우저에서 `https://chaovietnam.co.kr/naver*.html` 접근 확인
4. 네이버 서치어드바이저에서 **"소유 확인"** 클릭

### 2-4. 사이트맵 제출

1. 네이버 서치어드바이저 → 등록된 사이트 클릭 → **"요청"** → **"사이트맵 제출"**
2. 사이트맵 URL 입력:
   ```
   https://chaovietnam.co.kr/sitemap_index.xml
   ```
3. **"확인"** 클릭
4. 제출 완료 후 색인 현황 탭에서 수집 상태 확인

### 2-5. RSS 피드 등록

1. 네이버 서치어드바이저 → **"요청"** → **"RSS 제출"**
2. RSS URL 입력:
   ```
   https://chaovietnam.co.kr/feed/
   ```
3. **"확인"** 클릭

> WordPress 기본 RSS 피드는 `/feed/` 경로에 자동 생성됨. 별도 플러그인 불필요.

---

## 3. Rank Math SEO 전체 설정

### 3-1. Rank Math 초기 설정 마법사

1. WP 관리자 → **Rank Math** → **Dashboard**
2. **"Setup Wizard"** 버튼 클릭 (처음 설치 후 미완료 상태)
3. 단계별 설정:

**Step 1: Your Site**
- Site Type: **News / Media** 선택
- Company or Person: **Company** 선택
- Company Name: `씬짜오베트남 (Xin Chao Vietnam)`
- Company Logo: 사이트 로고 이미지 업로드 (권장 크기: 600x60px)
- Default Image (소셜 공유용): 대표 이미지 업로드 (권장 크기: 1200x630px)

**Step 2: Analytics**
- Google Search Console 연동 (1-3 참고)

**Step 3: Sitemaps**
- Sitemap 활성화: **ON**
- Include Images: **ON**

**Step 4: Optimizations**
- Noindex Empty Category/Tag Archives: **ON**
- Open Graph Meta Tags: **ON**
- Twitter Meta Tags: **ON**
- Breadcrumbs: **ON**

**Step 5: Ready**
- **"Return to Dashboard"** 클릭

---

### 3-2. General Settings 상세 설정

**경로:** WP 관리자 → Rank Math → General Settings

#### Breadcrumbs 탭
- Enable Breadcrumbs: **ON**
- Separator: `/`
- Show Homepage: **ON**
- Homepage Label: `홈`
- Show Home Page Crumb: **ON**

#### Webmaster Tools 탭
- Google Search Console: (1-3에서 연동 시 자동 입력)
- Naver Web Master: 네이버 verification 코드 입력 (2-3 참고)

#### 404 Monitor 탭
- Enable 404 Monitor: **ON**
- Log Empty UserAgent: **OFF**

---

### 3-3. Titles & Meta 설정

**경로:** WP 관리자 → Rank Math → Titles & Meta

#### Global Meta 탭

| 항목 | 설정값 |
|------|--------|
| Separator Character | `\|` (파이프) |
| Site Name | `씬짜오베트남` |
| Homepage Title | `씬짜오베트남 - 베트남 한인 뉴스·교민 매거진 \| Xin Chao Vietnam` |
| Homepage Description | `25년 역사의 베트남 한인 교민 매거진. 베트남 뉴스, 교민 소식, 비즈니스 정보, 생활·여행·맛집 가이드. 호치민·하노이 한인 커뮤니티의 신뢰받는 미디어.` |

> 복사용 텍스트:
> ```
> 씬짜오베트남 - 베트남 한인 뉴스·교민 매거진 | Xin Chao Vietnam
> ```
> ```
> 25년 역사의 베트남 한인 교민 매거진. 베트남 뉴스, 교민 소식, 비즈니스 정보, 생활·여행·맛집 가이드. 호치민·하노이 한인 커뮤니티의 신뢰받는 미디어.
> ```

#### Posts 탭

| 항목 | 설정값 |
|------|--------|
| Title | `%title% \| %sitename%` |
| Description | 각 포스트 편집 화면에서 개별 입력 |
| Article Type | `NewsArticle` |
| Robots | index, follow |

#### Pages 탭

| 항목 | 설정값 |
|------|--------|
| Title | `%title% \| %sitename%` |
| Description | 각 페이지 편집 화면에서 개별 입력 |
| Robots | index, follow |

#### Categories 탭

| 항목 | 설정값 |
|------|--------|
| Title | `%term% 뉴스 · 정보 \| %sitename%` |
| Description | 아래 카테고리별 작성 내용 참고 |
| Robots | index, follow |

#### Tags 탭

| 항목 | 설정값 |
|------|--------|
| Title | `%term% 관련 글 \| %sitename%` |
| Robots | noindex (태그 페이지는 색인 제외 권장) |

---

### 3-4. 카테고리별 Meta Title / Description 전체 목록

> **설정 경로:** WP 관리자 → 게시물 → 카테고리 → 각 카테고리 클릭 → 하단 Rank Math 섹션

---

#### 뉴스 (상위 카테고리)

**Meta Title:**
```
베트남 뉴스 한국어 | 씬짜오베트남
```
**Meta Description:**
```
베트남 최신 뉴스를 한국어로. 베트남 정치·경제·사회 이슈, 교민 소식, 한인 커뮤니티 뉴스를 씬짜오베트남이 전달합니다.
```

---

#### 베트남뉴스

**Meta Title:**
```
베트남 현지 뉴스 | 씬짜오베트남
```
**Meta Description:**
```
베트남 현지 정치·경제·사회·문화 최신 뉴스. 한국어로 읽는 베트남 뉴스, 씬짜오베트남에서 확인하세요.
```

---

#### 한국뉴스

**Meta Title:**
```
한국 뉴스 · 베트남 교민 관련 소식 | 씬짜오베트남
```
**Meta Description:**
```
베트남 거주 한인에게 필요한 한국 뉴스와 한·베 관계 소식. 씬짜오베트남이 선별한 중요 한국 뉴스.
```

---

#### 특별보도

**Meta Title:**
```
특별보도 · 심층기사 | 씬짜오베트남
```
**Meta Description:**
```
씬짜오베트남의 심층 특별보도. 베트남 사회·경제·교민 이슈를 다각도로 분석한 기획 기사.
```

---

#### VN-INFO (상위 카테고리)

**Meta Title:**
```
베트남 생활 정보 | 씬짜오베트남 VN-INFO
```
**Meta Description:**
```
베트남 생활에 꼭 필요한 정보 모음. 문화, 역사, 음식, 부동산, 비즈니스 정보를 한눈에 확인하세요.
```

---

#### 문화·역사

**Meta Title:**
```
베트남 문화 · 역사 정보 | 씬짜오베트남
```
**Meta Description:**
```
베트남의 풍부한 문화와 역사를 한국어로. 전통 문화, 역사적 배경, 베트남 사회 이해를 위한 깊이 있는 콘텐츠.
```

---

#### 음식·요리

**Meta Title:**
```
베트남 음식 · 요리 정보 | 씬짜오베트남
```
**Meta Description:**
```
베트남 전통 음식부터 현지 인기 요리까지. 포, 반미, 분짜 등 베트남 음식 문화를 한국어로 소개합니다.
```

---

#### 부동산

**Meta Title:**
```
베트남 부동산 투자 정보 | 씬짜오베트남
```
**Meta Description:**
```
호치민·하노이 한인 부동산 투자 정보. 아파트, 상업용 부동산, 토지 시장 동향과 투자 가이드.
```

---

#### 비즈니스

**Meta Title:**
```
베트남 비즈니스 정보 · 창업 가이드 | 씬짜오베트남
```
**Meta Description:**
```
베트남에서 사업하는 한인을 위한 비즈니스 정보. 법인 설립, 세무, 노무, 시장 트렌드, 업계 뉴스.
```

---

#### LIFENJOY (상위 카테고리)

**Meta Title:**
```
베트남 생활 · 맛집 · 여행 | 씬짜오베트남 LIFENJOY
```
**Meta Description:**
```
베트남에서 더 즐겁게! 한인 추천 맛집, 여행 코스, 뷰티 정보까지. 씬짜오베트남 라이프스타일 섹션.
```

---

#### 맛집

**Meta Title:**
```
호치민 · 하노이 한인 맛집 추천 | 씬짜오베트남
```
**Meta Description:**
```
베트남 한국인이 추천하는 맛집 모음. 호치민, 하노이, 다낭 등 도시별 한식·현지식·브런치 맛집 정보.
```

---

#### 여행

**Meta Title:**
```
베트남 여행 정보 · 관광지 추천 | 씬짜오베트남
```
**Meta Description:**
```
베트남 여행 계획에 필요한 모든 정보. 관광지, 숙소, 교통, 여행 팁을 씬짜오베트남이 안내합니다.
```

---

#### 뷰티·패션

**Meta Title:**
```
베트남 뷰티 · 패션 트렌드 | 씬짜오베트남
```
**Meta Description:**
```
베트남 현지 뷰티 트렌드와 한인 뷰티숍 정보. 스킨케어, 헤어, 패션까지 씬짜오베트남 뷰티 섹션.
```

---

#### 문화교양

**Meta Title:**
```
문화 · 교양 · 교육 정보 | 씬짜오베트남
```
**Meta Description:**
```
베트남 한인을 위한 문화·교양 콘텐츠. 도서 추천, 언어 학습, 자녀 교육 정보, 문화 이벤트 소식.
```

---

#### 칼럼 (상위 카테고리)

**Meta Title:**
```
전문가 칼럼 · 기고 | 씬짜오베트남
```
**Meta Description:**
```
베트남 법률·금융·부동산·비즈니스 전문가의 칼럼. 실용적인 전문 지식을 씬짜오베트남에서 확인하세요.
```

---

#### 법률 칼럼

**Meta Title:**
```
베트남 법률 상담 · 법률 칼럼 | 씬짜오베트남
```
**Meta Description:**
```
베트남 현지 법률 전문가의 칼럼. 비자, 노동법, 계약, 기업법 등 한인이 알아야 할 베트남 법률 정보.
```

---

#### 금융 칼럼

**Meta Title:**
```
베트남 금융 · 세무 · 투자 칼럼 | 씬짜오베트남
```
**Meta Description:**
```
베트남 금융·세무·투자 전문가 칼럼. 외환, 세금 신고, 금융 상품, 재무 계획 등 실용 금융 정보.
```

---

#### 부동산 칼럼

**Meta Title:**
```
베트남 부동산 전문가 칼럼 | 씬짜오베트남
```
**Meta Description:**
```
베트남 부동산 전문가의 심층 분석 칼럼. 아파트 시세, 투자 전략, 임대차 계약 유의사항.
```

---

#### 비즈니스 칼럼

**Meta Title:**
```
베트남 비즈니스 전략 칼럼 | 씬짜오베트남
```
**Meta Description:**
```
베트남 비즈니스 환경과 전략을 다루는 전문가 칼럼. 창업, 마케팅, HR, 무역 관련 실무 인사이트.
```

---

#### 매거진

**Meta Title:**
```
씬짜오베트남 매거진 | 베트남 한인 교민 잡지
```
**Meta Description:**
```
씬짜오베트남 월간 매거진. 25년 역사의 베트남 한인 교민 잡지 최신호 및 아카이브 콘텐츠.
```

---

#### 광고

**Meta Title:**
```
베트남 한인 광고 · 비즈니스 디렉토리 | 씬짜오베트남
```
**Meta Description:**
```
베트남 한인 커뮤니티의 비즈니스 광고 및 업체 정보. 호치민·하노이 한인 업체 디렉토리.
```

---

### 3-5. Schema (JSON-LD) 설정

**경로:** WP 관리자 → Rank Math → Titles & Meta → Global Meta

#### Organization Schema 설정

1. Rank Math → **Titles & Meta** → **Local SEO** 탭 (또는 General Settings)
2. **"Knowledge Graph & Schema"** 섹션:

| 항목 | 입력값 |
|------|--------|
| Person or Organization | **Organization** 선택 |
| Name | `씬짜오베트남 (Xin Chao Vietnam)` |
| URL | `https://chaovietnam.co.kr` |
| Logo | 사이트 로고 이미지 URL |
| Phone | `+84-28-3511-1075` |
| Address | `9Fl, EBM Building, 683-685 Dien Bien Phu, W.25, Binh Thanh, HCMC, Vietnam` |

#### NewsArticle Schema (포스트 타입 설정)

1. Rank Math → **Titles & Meta** → **Posts** 탭
2. **"Schema Type"** → `NewsArticle` 선택
3. 저장

> 이렇게 설정하면 각 뉴스 포스트에 자동으로 NewsArticle JSON-LD가 삽입됩니다.

#### BreadcrumbList Schema

1. Rank Math → **General Settings** → **Breadcrumbs** 탭
2. **"Enable Breadcrumbs"** → ON
3. Rank Math 브레드크럼을 활성화하면 BreadcrumbList 스키마 자동 생성

> **테마 연동:** 테마에서 `rank_math_the_breadcrumbs()` 함수를 호출하거나, Rank Math의 Gutenberg 블록 "Breadcrumbs"를 사용할 수 있습니다.

---

### 3-6. Social Meta (Open Graph / Twitter Card) 설정

**경로:** WP 관리자 → Rank Math → Titles & Meta → Social Meta

#### Open Graph 설정

| 항목 | 입력값 |
|------|--------|
| Open Graph Thumbnail | 사이트 대표 이미지 업로드 (1200x630px) |
| Facebook App ID | (Facebook Business 앱 ID, 선택사항) |
| Facebook Author URL | (선택사항) |

권장 Open Graph 기본 이미지 규격:
- 크기: **1200 x 630 픽셀**
- 파일 형식: JPG 또는 PNG
- 파일 크기: 1MB 미만
- 내용: 씬짜오베트남 로고 + 베트남 배경 이미지

#### Twitter Card 설정

| 항목 | 입력값 |
|------|--------|
| Twitter Card Type | `Summary with Large Image` 선택 |
| Twitter Site | `@xinchao_vietnam` (트위터/X 계정이 있는 경우) |

---

### 3-7. Sitemap 설정 (중복 방지)

**현재 상태:** `sitemap_index.xml` 이미 존재 (126개 포스트)

**경로:** WP 관리자 → Rank Math → Sitemap Settings

#### Rank Math Sitemap 활성화 여부 확인

**중요:** Rank Math 사이트맵과 기존 사이트맵 플러그인(예: Yoast, All in One SEO, Google XML Sitemaps) 중복 활성화 방지

1. WP 관리자 → **플러그인** → 설치된 플러그인 목록 확인
2. **Yoast SEO** 또는 **Google XML Sitemaps** 등이 활성화되어 있으면 해당 플러그인의 사이트맵 기능만 **비활성화** (플러그인 전체 비활성화 아님)
3. **Rank Math만 사이트맵 생성하도록** 설정

Rank Math Sitemap 설정:

| 항목 | 설정값 |
|------|--------|
| Sitemaps | **ON** |
| Include Images | **ON** |
| Posts Sitemap | **ON** |
| Pages Sitemap | **ON** |
| Categories Sitemap | **ON** |
| Authors Sitemap | **OFF** (개인 정보 보호) |

4. 설정 저장 후 `https://chaovietnam.co.kr/sitemap_index.xml` 접속하여 정상 출력 확인

---

## 4. 광고 랜딩페이지 SEO

> **대상 URL:** `https://chaovietnam.co.kr/ads_request`

### 4-1. Rank Math에서 페이지 SEO 설정

1. WP 관리자 → **페이지** → `/ads_request` 페이지 클릭
2. 편집 화면 하단 **Rank Math SEO** 박스에서 설정

#### Meta Title (복사용)
```
베트남 한인 광고 신청 | 씬짜오베트남 매거진·옐로페이지
```

#### Meta Description (복사용)
```
씬짜오베트남에 광고하세요. 25년 역사의 베트남 한인 매거진·옐로페이지로 호치민·하노이 교민 타겟 광고. 잡지 광고, 디지털 광고, 업체 등록 문의: info@chaovietnam.co.kr
```

#### Focus Keyword
```
베트남 한인 광고
```

#### Canonical URL
비워두기 (현재 URL 자동 적용)

#### Schema Type
```
WebPage
```

---

### 4-2. 광고 페이지 H1 / H2 구조 (권장)

페이지 콘텐츠 편집 시 아래 구조를 참고하세요:

```
H1: 베트남 한인 광고의 중심, 씬짜오베트남
  H2: 씬짜오베트남 광고 상품 안내
    H3: 잡지 광고 (풀페이지 / 하프페이지 / 1/4페이지)
    H3: 디지털 광고 (웹 배너 / 뉴스레터)
    H3: 옐로페이지 업체 등록
  H2: 광고 효과 및 독자층
    H3: 호치민·하노이 한인 독자 [숫자]명+
    H3: 25년 신뢰의 교민 미디어
  H2: 광고 신청 방법
    H3: 온라인 신청서 작성
    H3: 담당자 연락처
  H2: 광고 문의
```

**핵심 규칙:**
- **H1은 페이지 전체에서 반드시 1개만** 사용
- H2로 주요 섹션 구분
- H3으로 세부 항목 구분

---

## 5. 기술적 SEO 체크리스트

### 5-1. H1 태그 중복 문제 수정

> **현재 문제:** 홈페이지에 H1이 8개 이상 존재

**원인 파악 방법:**
1. 브라우저에서 홈페이지 접속 → F12 → Elements 탭
2. Ctrl+F → `<h1` 검색 → 개수 및 위치 확인

**수정 방법 (WordPress 테마):**

**방법 A: Elementor / 페이지 빌더 사용 중인 경우**
1. 홈페이지 편집 → 각 섹션의 제목 요소 클릭
2. HTML 태그 설정을 `H1` → `H2` 또는 `H3`으로 변경
3. **사이트 전체에서 H1은 페이지/포스트 제목(메인 제목) 1개만** 유지

**방법 B: Gutenberg 블록 에디터 사용 중인 경우**
1. 홈페이지 편집 → 각 제목 블록 클릭
2. 우측 패널 → "텍스트 설정" → H 레벨 확인 및 변경

**방법 C: 테마 커스터마이저 수정이 필요한 경우**
1. 외모 → 테마 편집기 → 홈페이지 관련 템플릿 파일 (예: `front-page.php`, `home.php`)
2. `<h1>` 태그를 `<h2>` 또는 `<h3>`으로 변경
3. **단, 포스트/페이지 제목을 표시하는 H1 하나는 반드시 유지**

**올바른 H1 구조:**
```
홈페이지: H1 - 사이트 이름 또는 핵심 슬로건 (1개만)
카테고리 페이지: H1 - 카테고리 이름 (1개만)
포스트/페이지: H1 - 글/페이지 제목 (1개만)
```

---

### 5-2. 이미지 Alt 텍스트 설정

**신규 이미지 업로드 시:**
1. WP 관리자 → 미디어 → 이미지 클릭
2. 우측 **"대체 텍스트"** 입력란에 이미지 내용을 설명하는 텍스트 입력
3. 예: `호치민 씬짜오베트남 매거진 2025년 1월호 표지`

**기존 이미지 일괄 수정 방법:**

**방법 A: WP 관리자 미디어 라이브러리 직접 수정**
1. WP 관리자 → 미디어 → 목록 보기 전환
2. Alt 텍스트가 없는 이미지 필터링 후 하나씩 입력

**방법 B: 플러그인 활용 (권장)**
- **"Bulk Image Alt Text"** 또는 **"Auto Image Attributes"** 플러그인 설치
- 설정에서 파일명 기반 자동 alt 텍스트 생성 규칙 설정
- 또는 포스트 제목 기반 자동 설정

**Alt 텍스트 작성 원칙:**
- 이미지 내용을 간결하게 설명 (20자 내외)
- 키워드 자연스럽게 포함 (키워드 스터핑 금지)
- 장식용 이미지는 alt="" 빈 값 사용
- 예: `베트남 호치민 야경`, `씬짜오베트남 광고 신청`, `하노이 한인 뉴스`

---

### 5-3. 페이지 속도 최적화 (Hostinger 환경)

#### Hostinger LiteSpeed Cache 활성화 (무료 기능)

1. Hostinger 관리 패널 → **"WordPress"** → 해당 사이트
2. **"LiteSpeed Cache"** 또는 **"WordPress Accelerator"** 활성화
3. WP 관리자 → LiteSpeed Cache 플러그인 → **"Cache"** → 모두 ON

#### Hostinger CDN 설정 (무료 포함)

1. Hostinger 관리 패널 → **"CDN"** 섹션
2. Cloudflare CDN 활성화 (Hostinger 프리미엄 이상 플랜 포함)
3. 활성화 후 이미지, CSS, JS 자동 캐싱

#### WordPress 내 추가 최적화

| 항목 | 권장 설정 |
|------|----------|
| 이미지 압축 | **Smush** 또는 **ShortPixel** 플러그인 설치 |
| 이미지 포맷 | WebP 변환 활성화 |
| Lazy Load | LiteSpeed Cache 또는 기본 WordPress lazy load 활성화 |
| CSS/JS 최소화 | LiteSpeed Cache → Optimize 탭 → 활성화 |
| 데이터베이스 최적화 | WP-Optimize 플러그인 월 1회 실행 |

#### 속도 측정 도구
- **Google PageSpeed Insights:** https://pagespeed.web.dev
- **GTmetrix:** https://gtmetrix.com
- 목표: Mobile 70점 이상, Desktop 85점 이상

---

### 5-4. HTTPS 확인

1. 브라우저에서 `https://chaovietnam.co.kr` 접속
2. 주소창 왼쪽 자물쇠 아이콘 확인 → **"연결이 안전합니다"** 표시 확인
3. `http://chaovietnam.co.kr` 접속 시 자동으로 https로 리다이렉트 되는지 확인

**문제 발생 시:**
- Hostinger 관리 패널 → **"SSL"** → SSL 인증서 상태 확인
- Let's Encrypt 인증서 자동 갱신 활성화 확인
- WP 관리자 → 설정 → 일반 → WordPress 주소/사이트 주소가 모두 `https://`로 시작하는지 확인

---

### 5-5. 모바일 최적화 확인

1. **Google Mobile-Friendly Test:** https://search.google.com/test/mobile-friendly
2. URL `https://chaovietnam.co.kr` 입력 → 테스트 실행
3. "모바일 친화적" 판정 확인

**체크 항목:**
- 뷰포트 메타태그 존재 여부 (테마에 보통 포함됨)
- 터치 요소 간격 (최소 48x48px)
- 텍스트 크기 (최소 16px)
- 수평 스크롤 없음 확인

---

### 5-6. robots.txt 확인

현재 정상 상태 확인됨. `https://chaovietnam.co.kr/robots.txt` 접속하여 아래 내용 포함 여부 확인:

```
User-agent: *
Allow: /

Sitemap: https://chaovietnam.co.kr/sitemap_index.xml
```

> **중요:** Rank Math 사이트맵 활성화 후 sitemap URL이 변경되면 robots.txt의 Sitemap 경로도 업데이트 필요
> - Rank Math → General Settings → Edit robots.txt 버튼으로 직접 편집 가능

---

### 5-7. canonical 태그 설정

Rank Math 활성화 시 canonical 태그는 자동으로 각 페이지 URL로 설정됩니다.

특별히 확인이 필요한 경우:
1. 각 포스트/페이지 편집 → Rank Math SEO 박스 → **"Advanced"** 탭
2. **"Canonical URL"** 필드 → 비워두면 현재 URL 자동 적용
3. 중복 콘텐츠가 있는 경우에만 원본 URL 직접 입력

---

## 부록: SEO 설정 완료 체크리스트

### Google Search Console
- [ ] 속성 추가 (chaovietnam.co.kr)
- [ ] DNS TXT 레코드로 소유 확인
- [ ] sitemap_index.xml 제출
- [ ] Rank Math Analytics 연동

### Naver Webmaster
- [ ] https://searchadvisor.naver.com 사이트 추가
- [ ] HTML 메타태그 소유 확인 (Rank Math Webmaster Tools 탭에 입력)
- [ ] sitemap_index.xml 제출
- [ ] RSS 피드 제출 (/feed/)

### Rank Math 기본 설정
- [ ] Setup Wizard 완료 (Site Type: News/Media)
- [ ] 회사명, 로고, 대표 이미지 입력
- [ ] Homepage meta title 설정
- [ ] Homepage meta description 설정
- [ ] Posts schema → NewsArticle
- [ ] Breadcrumbs 활성화
- [ ] Open Graph 기본 이미지 설정 (1200x630px)
- [ ] Twitter Card → Summary with Large Image

### 카테고리 Meta 설정
- [ ] 뉴스
- [ ] 베트남뉴스
- [ ] 한국뉴스
- [ ] 특별보도
- [ ] VN-INFO
- [ ] 문화·역사
- [ ] 음식·요리
- [ ] 부동산
- [ ] 비즈니스
- [ ] LIFENJOY
- [ ] 맛집
- [ ] 여행
- [ ] 뷰티·패션
- [ ] 문화교양
- [ ] 칼럼
- [ ] 법률 칼럼
- [ ] 금융 칼럼
- [ ] 부동산 칼럼
- [ ] 비즈니스 칼럼
- [ ] 매거진
- [ ] 광고

### 광고 랜딩페이지
- [ ] /ads_request 페이지 meta title 설정
- [ ] /ads_request 페이지 meta description 설정
- [ ] H1 구조 수정 (1개만)

### 기술적 SEO
- [ ] 홈페이지 H1 태그 1개로 줄이기
- [ ] 이미지 alt 텍스트 추가 시작
- [ ] Hostinger LiteSpeed Cache 활성화
- [ ] HTTPS 정상 작동 확인
- [ ] 모바일 친화적 테스트 통과
- [ ] PageSpeed Insights Mobile 70점 이상 확인
- [ ] robots.txt Sitemap URL 최신화

---

*문의: info@chaovietnam.co.kr | 028 3511 1075*  
*씬짜오베트남 — 9Fl, EBM Building, 683-685 Dien Bien Phu, W.25, Binh Thanh, HCMC*
