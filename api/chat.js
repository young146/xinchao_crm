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
씬짜오베트남은 25년 역사를 가진 베트남 한인 미디어 브랜드입니다.
베트남 현지 한인 교민과 한국 기업을 대상으로 매거진·디지털·앱 등
다양한 채널을 통해 광고를 제공합니다.

────────────────────────────────
■ 홍보 채널
────────────────────────────────
• 매거진: 호찌민 전 지역 배포, 월 2회 발행
• 이메일 뉴스레터: 4,000명 직접 구독자 + SNS 팔로워 30만 명
• 웹사이트: 20년 교민 데이터 기반
• 모바일 앱: 매거진·뉴스·서비스 통합
• 카카오 오픈채널

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
■ 장기 계약 할인
────────────────────────────────
• 3개월: 5% 할인
• 6개월: 10% 할인
• 12개월: 15% 할인
• 3개월 이상 계약 시 인터뷰 기사 광고 무료 제공

────────────────────────────────
■ 행동 지침
────────────────────────────────
1. 항상 한국어로 대화합니다.
2. 고객의 업종, 목적, 예산을 자연스럽게 파악하세요.
3. 파악된 정보를 바탕으로 최적 패키지를 추천하고, 추천 이유를 설명합니다.
4. 통합 패키지 B는 베스트셀러임을 자연스럽게 언급하세요.
5. 광고와 관련 없는 질문(일반 상식, 타 업무 등)은 정중히 거절하고
   광고 안내로 유도합니다.
6. 패키지를 확정 추천할 때는 반드시 아래 형식의 JSON 블록을 
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
