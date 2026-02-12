import { GoogleGenerativeAI } from "@google/generative-ai";
import { Review, AnalyzedReview, Category } from "./types";
import { SUB_CATEGORIES, getAppByIdOrThrow } from "./apps";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL_NAME = "gemini-2.0-flash";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function categorizeReviewsBatch(
  reviews: Review[],
  appId: string
): Promise<AnalyzedReview[]> {
  const app = getAppByIdOrThrow(appId);

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI] No GEMINI_API_KEY set. Using score-based fallback.");
    return reviews.map(r => {
      const category: Category = r.score >= 3 ? '칭찬' : '불만';
      return {
        ...r,
        appId,
        category,
        subCategory: '미분류',
        analysisDate: new Date().toISOString(),
      };
    });
  }

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const BATCH_SIZE = 50;
  const analyzed: AnalyzedReview[] = [];
  const IS_FAST_MODE = process.env.GEMINI_FAST_MODE === 'true';

  console.log(`[AI] Analyzing ${reviews.length} reviews for ${app.name} (${IS_FAST_MODE ? 'FAST' : 'FREE'} mode)...`);

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const chunk = reviews.slice(i, i + BATCH_SIZE);

    if (i > 0) {
      const waitMs = IS_FAST_MODE ? 2000 : 6000;
      console.log(`[AI] Waiting ${waitMs / 1000}s for rate limit...`);
      await delay(waitMs);
    }

    const prompt = `
    당신은 OTT 서비스 앱 리뷰 분석 전문가입니다. 아래 ${chunk.length}개의 "${app.name}" 리뷰를 분석하여 세부 사유를 분류해주세요.

    [대원칙]
    - 별점 3, 4, 5점: 무조건 '칭찬'으로 분류
    - 별점 1, 2점: 무조건 '불만'으로 분류

    [세부 사유 리스트]
    - 칭찬(3점 이상): ${SUB_CATEGORIES['칭찬'].join(', ')}
    - 불만(2점 이하): ${SUB_CATEGORIES['불만'].join(', ')}
    - 기타: ${SUB_CATEGORIES['기타'].join(', ')}

    [리뷰 목록]
    ${chunk.map((r, idx) => `ID: ${idx}, 별점: ${r.score}, 내용: ${r.text}`).join('\n')}

    [응답 형식]
    반드시 아래와 같은 JSON 배열 형식으로만 응답하세요.
    [
      {"id": 0, "category": "불만", "subCategory": "플레이어/재생 오류"},
      {"id": 1, "category": "칭찬", "subCategory": "오리지널 콘텐츠"}
    ]
    `;

    const MAX_RETRIES = 3;
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
        else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

        const results = JSON.parse(text);

        chunk.forEach((review, idx) => {
          const res = results.find((r: any) => r.id === idx) || { category: '', subCategory: '미분류' };
          const finalCategory: Category = review.score >= 3 ? '칭찬' : '불만';
          const allowedSubs = SUB_CATEGORIES[finalCategory];
          const finalSub = allowedSubs.includes(res.subCategory)
            ? res.subCategory
            : allowedSubs[allowedSubs.length - 1];

          analyzed.push({
            ...review,
            appId,
            category: finalCategory,
            subCategory: finalSub,
            analysisDate: new Date().toISOString(),
          });
        });

        console.log(`[AI] ${app.name}: ${analyzed.length}/${reviews.length} processed`);
        success = true;
        break;
      } catch (error) {
        const is429 = error instanceof Error && (error.message.includes('429') || error.message.includes('quota'));
        console.warn(`[AI] Error at chunk ${i} (attempt ${attempt}/${MAX_RETRIES}):`, error instanceof Error ? error.message.substring(0, 80) : error);

        if (is429 && attempt < MAX_RETRIES) {
          const backoff = attempt * 30000; // 30s, 60s
          console.log(`[AI] Rate limited. Retrying in ${backoff / 1000}s...`);
          await delay(backoff);
          continue;
        }
      }
    }

    if (!success) {
      chunk.forEach(review => {
        analyzed.push({
          ...review,
          appId,
          category: review.score >= 3 ? '칭찬' : '불만',
          subCategory: '분석오류',
          analysisDate: new Date().toISOString(),
        });
      });
    }
  }

  return analyzed;
}
