/**
 * /api/chat.js — 씬짜오베트남 광고 안내 챗봇 API
 *
 * Vercel Serverless Function (Node.js)
 *
 * ────────────────────────────────────────
 * 환경변수 설정 (필수)
 * ────────────────────────────────────────
 * 로컬 개발:
 *   프로젝트 루트에 .env.local 파일 생성 후 아래 한 줄 추가
 *   OPENAI_API_KEY=sk-...your-key-here...
 *
 * Vercel 배포:
 *   Vercel Dashboard → Project Settings → Environment Variables
 *   Name: OPENAI_API_KEY  /  Value: sk-...your-key-here...
 *
 * ────────────────────────────────────────
 * 로컬 테스트 방법
 * ────────────────────────────────────────
 * 1) npm install -g vercel   (최초 1회)
 * 2) vercel dev              (프로젝트 루트에서 실행)
 * 3) curl 테스트:
 *    curl -X POST http://localhost:3000/api/chat \
 *      -H "Content-Type: application/json" \
 *      -d '{"messages":[{"role":"user","content":"베스트 패키지가 뭔가요?"}]}'
 *
 * ────────────────────────────────────────
 * 요청 형식
 * ────────────────────────────────────────
 * POST /api/chat
 * Body: {
 *   messages: [{ role: "user" | "assistant", content: string }],
 *   sessionId?: string   // 선택사항, 현재 미사용 (추후 로깅용)
 * }
 *
 * 응답 형식
 * ────────────────────────────────────────
 * {
 *   reply: string,
 *   recommendation?: {
 *     packageName: string,
 *     months: number,
 *     addons: string[]
 *   }
 * }
 */

const OpenAI = require("openai");

// ── 미디어킷 데이터 & 시스템 프롬프트 ──────────────────────────────────────
const SYSTEM_PROMPT = `
당신은 씬짜오베트남(Xinchao Vietnam)의 광고 안내 전문 AI 컨설턴트입니다.
한국어로만 대화하며, 친절하고 전문적인 톤을 유지합니다.

────────────────────────────────
■ 씬짜오베트남 소개
────────────────────────────────
2002년 창간, 22년 이상 발행. 베트남 한인사회에서 가장 신뢰받는 교민 미디어.
• 잡지: 격주 발행(월 2회), 매호 7,000부 / 월 14,000부 호찌민 전역 배포, 우편구독자 3,000여명
• 교민 소식·베트남 뉴스·기업·교육·여행·F&B·골프 등 교민생활 전반 커버
• 베트남 한인사회 유일의 온·오프라인 통합 미디어 체제

────────────────────────────────
■ 온라인 채널
────────────────────────────────
• 데일리뉴스: 매일 아침 8시 베트남 뉴스 한글 번역 → 이메일 5,000여 명 직송 + SNS 30만 명 배포
  뉴스와 함께 고객 홍보카드 첨부 — 씬짜오만의 독보적 타깃 홍보 수단
• 메인사이트 chaovietnam.co.kr: 20년+ 잡지 아카이브 + 데일리뉴스 + 중고·구인·부동산 등
• 앱(Android/iOS): 사이트 전 기능 통합, 2,000여 설치
• 카카오 오픈채팅: 당근/나눔·구인구직·부동산 별도 운영
• 페이스북 페이지: 구독자 7,000여명, 관련 채널 합산 약 30만 명

────────────────────────────────
■ 지역 제한 규칙 (반드시 준수)
────────────────────────────────
• 잡지(오프라인): 호찌민 전역 배포. 잡지 콘텐츠는 사이트에도 게시되어 온라인으로 전국/해외 노출 가능
• 옐로페이지: 호찌민(빈증 포함) 지역 한정
• 온라인 광고(웹배너·앱배너·이메일 홍보카드): 지역 제한 없음, 다국어 지원으로 현지인/외국인 유입 가능
★ 하노이·다낭 등 호찌민 외 지역 고객: 잡지·옐로페이지 제외, 디지털 패키지만 추천
★ 호찌민 고객: 온·오프라인 통합 패키지 적극 추천

────────────────────────────────
■ 주요 광고주 업종
────────────────────────────────
국제학교·음식점·유통·건설/자재·법무/세무·리크루트·병원·미용실 등 한국인 대상 사업체

────────────────────────────────
■ 광고 패키지 7종 (월 기준 USD)
────────────────────────────────
1. 디지털 스타터          $250/월
   - 이메일 홍보카드 월 4회 + 웹 인너배너

2. 디지털 프리미엄        $350/월
   - 이메일 홍보카드 월 4회 + 웹 인너배너 + 앱 인너배너 + 앱 하단배너

3. 디지털 베스트          $500/월
   - 이메일 홍보카드 월 4회 + 웹 헤드·하단배너 + 앱 헤더·하단배너

4. 통합 패키지 A          $1,050/월
   - 잡지 1페이지 + 디지털 스타터 (40% 할인)

5. ★ 통합 패키지 B       $1,150/월  【베스트셀러】
   - 잡지 1페이지 + 디지털 프리미엄 + 이웃사업 소개
   - 가장 많은 광고주가 선택하는 인기 패키지

6. 통합 패키지 C          $1,250/월
   - 잡지 1페이지 + 디지털 베스트 + 이웃사업 소개

7. 프리미엄 올인원        $3,000/월
   - 잡지 백커버 + 디지털 베스트 + 이웃사업 소개

────────────────────────────────
■ 단품 옵션 (USD)
────────────────────────────────
• 이메일 홍보카드 추가 1회: $50
• 웹사이트 헤드 배너: $150/월
• 웹사이트 내부·푸터 배너: $80/월
• 앱 헤드 배너: $120/월
• 앱 내부·푸터 배너: $70/월
• 이웃사업 소개 카드: $100/건
• 잡지 전면 ($900/월)
• 잡지 1/2면 ($500/월)
• 잡지 1/4면 ($300/월)
• 옐로페이지 1단 ($240)
• 옐로페이지 2단 ($480)
• 옐로페이지 4단 ($960)

────────────────────────────────
■ 장기 계약 할인 & 계약 조건
────────────────────────────────
• 최소 계약 기간 없음 (1개월 단발 가능)
• 3개월: 5% 할인
• 6개월: 10% 할인
• 12개월: 15% 할인
• 인터뷰 기사광고: 3개월 이상 + 합계 $3,000 이상 계약 시 제공 (협의 필요)
• 인터뷰 기사광고 별도 구매: 페이지당 $500 (보통 4~6페이지)

────────────────────────────────
■ 결제 & 광고 소재
────────────────────────────────
• 가격 USD 기준, 실제 결제는 베트남 동(VND) 환산 지불
• 세금계산서 발행 가능
• 광고 소재: 원칙적으로 고객 준비 / 간단한 경우 서비스 차원 제작 지원 / 대형 디자인·영상은 별도 협의
• 계약 절차: 문의 → 상담(소재 논의) → 계약서 → 수금 → 게재

────────────────────────────────
■ 광고 효과 설명 포인트 (고객 설득 시 강조)
────────────────────────────────
• 25년 역사가 증명하는 높은 신뢰와 신망
• 베트남 한인사회 유일의 온·오프라인 통합 미디어
• 데일리뉴스: 매일 5,000 이메일 직송 + SNS 30만 배포 — 씬짜오만의 독보적 채널
• 잡지 월 14,000부 호찌민 전역 배포
• 잡지+이메일+웹+앱+카카오+페이스북 다중 채널 노출

────────────────────────────────
■ 담당자 연결
────────────────────────────────
• 챗봇으로 답하기 어려운 질문이 오면: "자세한 상담을 위해 담당자에게 연결해 드릴까요?" 안내
• 이메일: info@chaovietnam.co.kr
• 전화: 079-283-2000

────────────────────────────────
■ 행동 지침
────────────────────────────────
1. 항상 한국어로 대화합니다.
2. 고객의 업종, 목적, 예산, 지역(호찌민/하노이/다낭 등)을 자연스럽게 파악하세요.
3. 파악된 정보를 바탕으로 최적 패키지를 추천하고, 추천 이유를 설명합니다.
4. 지역 제한 규칙을 반드시 준수합니다. 호찌민 외 지역 고객에게 잡지·옐로페이지를 추천하지 마세요.
5. 통합 패키지 B는 베스트셀러임을 자연스럽게 언급하세요.
6. 광고와 관련 없는 질문(일반 상식, 타 업무 등)은 정중히 거절하고 광고 안내로 유도합니다.
7. 답하기 어려운 전문 상담 질문에는 담당자 연결을 안내합니다 (이메일: info@chaovietnam.co.kr / 전화: 079-283-2000).
8. 패키지를 확정 추천할 때는 반드시 아래 형식의 JSON 블록을
   응답 마지막에 포함하세요 (마크다운 코드 블록 없이 순수 JSON):

RECOMMENDATION_JSON:{"packageName":"패키지명","months":계약개월수,"addons":["추가옵션1","추가옵션2"]}

   예시:
   RECOMMENDATION_JSON:{"packageName":"통합 패키지 B","months":6,"addons":["잡지 전면 ($900/월)","옐로페이지 1단 ($240)"]}
   
   - packageName: 위 패키지 목록 중 정확한 이름
   - months: 1 / 2 / 3 / 6 / 12 중 하나 (고객이 기간을 정하지 않았으면 1)
   - addons: 추가 단품 옵션 배열 (없으면 빈 배열 [])
     ★ 중요: addons 배열의 잡지/옐로페이지 항목은 반드시 아래 정확한 이름을 사용할 것
       (가격 포함, 괄호 형식 그대로)
       - 잡지 전면 ($900/월)
       - 잡지 1/2면 ($500/월)
       - 잡지 1/4면 ($300/월)
       - 옐로페이지 1단 ($240)
       - 옐로페이지 2단 ($480)
       - 옐로페이지 4단 ($960)
   - 이 JSON 줄은 고객에게 보이는 텍스트 바로 뒤에 새 줄로 추가합니다.
`.trim();

// ── RECOMMENDATION JSON 파싱 헬퍼 ─────────────────────────────────────────
function parseRecommendation(content) {
  const marker = "RECOMMENDATION_JSON:";
  const idx = content.indexOf(marker);
  if (idx === -1) return { reply: content, recommendation: null };

  const jsonStr = content.slice(idx + marker.length).trim();
  const replyText = content.slice(0, idx).trim();

  try {
    const recommendation = JSON.parse(jsonStr);
    // 기본값 보정
    if (!Array.isArray(recommendation.addons)) recommendation.addons = [];
    if (!recommendation.months || isNaN(recommendation.months))
      recommendation.months = 1;
    return { reply: replyText, recommendation };
  } catch {
    // JSON 파싱 실패 시 마커 줄 제거 후 텍스트만 반환
    return { reply: replyText || content, recommendation: null };
  }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS 헤더 (개발 및 Vercel Preview 환경 허용)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // 환경변수 체크
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "OPENAI_API_KEY 환경변수가 설정되지 않았습니다. " +
        "Vercel Dashboard → Settings → Environment Variables에서 추가하세요.",
    });
  }

  // 요청 바디 파싱
  const { messages, sessionId } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "messages 배열이 필요합니다. 예: [{role:'user', content:'안녕하세요'}]",
    });
  }

  // 메시지 유효성 검사
  const validRoles = ["user", "assistant"];
  for (const msg of messages) {
    if (!validRoles.includes(msg.role) || typeof msg.content !== "string") {
      return res.status(400).json({
        error: "각 message는 { role: 'user'|'assistant', content: string } 형식이어야 합니다.",
      });
    }
  }

  // OpenAI API 호출
  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const rawContent = completion.choices[0]?.message?.content || "";
    const { reply, recommendation } = parseRecommendation(rawContent);

    const response = { reply };
    if (recommendation) response.recommendation = recommendation;

    // 디버그 로그 (Vercel 함수 로그에서 확인 가능)
    if (sessionId) console.log(`[chat] sessionId=${sessionId}`);
    console.log(`[chat] reply length=${reply.length}, hasRec=${!!recommendation}`);

    return res.status(200).json(response);
  } catch (err) {
    console.error("[chat] OpenAI error:", err?.message || err);

    if (err?.status === 401) {
      return res.status(500).json({
        error: "OpenAI API 키가 유효하지 않습니다. 키를 확인해 주세요.",
      });
    }
    if (err?.status === 429) {
      return res.status(429).json({
        error: "OpenAI API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }

    return res.status(500).json({
      error: "AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
};
