/**
 * Local batch collection script
 * Runs scraping + AI analysis + insight generation for all OTT apps
 * Uses local file storage (data/ directory)
 *
 * Usage: node scripts/collect.mjs [appId]
 *   appId (optional): run for a single app (e.g. tving, netflix)
 *   no arg: run for all 6 apps sequentially
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Storage } from '@google-cloud/storage';
import gplay from 'google-play-scraper';
import appStoreScraper from 'app-store-scraper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// Load env from .env file manually (no dotenv dependency)
async function loadEnvFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    });
  } catch { /* file not found, skip */ }
}
await loadEnvFile(path.join(ROOT, '.env'));
await loadEnvFile(path.join(ROOT, '.env.local'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IS_FAST_MODE = process.env.GEMINI_FAST_MODE === 'true';
const MODEL_NAME = 'gemini-2.0-flash';
const MAIN_BUCKET = process.env.GCS_BUCKET_NAME || 'appscope-review-data';
const BACKUP_BUCKET = 'appscope-review-backup';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' && !!process.env.GCS_BUCKET_NAME;

// ─── App definitions ─────────────────────────────────────────────────────────
const OTT_APPS = [
  { id: 'tving',       name: '티빙',      googlePlayId: 'net.cj.cjhv.gs.tving',        appStoreId: '400101401' },
  { id: 'netflix',     name: '넷플릭스',  googlePlayId: 'com.netflix.mediaclient',       appStoreId: '363590051' },
  { id: 'disneyplus',  name: '디즈니+',   googlePlayId: 'com.disney.disneyplus',         appStoreId: '1446075923' },
  { id: 'wavve',       name: '웨이브',    googlePlayId: 'kr.co.captv.pooqV2',            appStoreId: '1374309498' },
  { id: 'coupangplay', name: '쿠팡플레이',googlePlayId: 'com.coupang.play',              appStoreId: '1536885649' },
  { id: 'watcha',      name: '왓챠',      googlePlayId: 'com.frograms.watcha',           appStoreId: '1096606674' },
];

const SUB_CATEGORIES = {
  '불만': ['플레이어/재생 오류','광고 관련 불만','요금/결제/구독','콘텐츠 부족/불만','UI/UX 불편','앱 안정성(크래시/버그)','자막/더빙 품질','기타 불만'],
  '칭찬': ['오리지널 콘텐츠','화질/재생 품질','UI 편리성','콘텐츠 다양성','합리적 가격','자막/더빙 품질','기타 칭찬'],
  '기타': ['단순 문의','기능 제안','미분류'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function localPath(appId, filename) {
  return path.join(DATA_DIR, appId, filename);
}

async function readJSON(appId, filename, fallback) {
  try {
    if (IS_PRODUCTION) {
      const storage = new Storage();
      const [content] = await storage.bucket(MAIN_BUCKET).file(`${appId}/${filename}`).download();
      return JSON.parse(content.toString());
    }
    const data = await readFile(localPath(appId, filename), 'utf-8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJSON(appId, filename, data) {
  if (IS_PRODUCTION) {
    const storage = new Storage();
    await storage.bucket(MAIN_BUCKET).file(`${appId}/${filename}`).save(JSON.stringify(data));
    return;
  }
  const dir = path.join(DATA_DIR, appId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), JSON.stringify(data, null, 2));
}

// ─── Scrapers ────────────────────────────────────────────────────────────────
async function fetchGooglePlayReviews(appId, pages = 15) {
  try {
    const reviews = await gplay.reviews({
      appId,
      sort: gplay.sort.NEWEST,
      num: pages * 100,
      lang: 'ko',
      country: 'kr',
    });
    return reviews.data.map(r => ({
      id: r.id,
      userName: r.userName,
      userImage: r.userImage,
      date: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
      score: r.score,
      text: r.text || '',
      url: r.url,
      store: 'google-play',
    }));
  } catch (error) {
    console.error(`  [GP] Error: ${error.message}`);
    return [];
  }
}

async function fetchAppStoreReviews(id, pages = 10) {
  try {
    const reviews = [];
    for (let i = 1; i <= Math.min(pages, 10); i++) {
      const pageReviews = await appStoreScraper.reviews({
        id,
        country: 'kr',
        sort: appStoreScraper.sort.RECENT,
        page: i,
      });
      reviews.push(...pageReviews);
      if (pageReviews.length === 0) break;
    }
    return reviews.map(r => ({
      id: String(r.id),
      userName: r.userName,
      date: r.updated || r.date ? new Date(r.updated || r.date).toISOString() : new Date().toISOString(),
      score: r.score,
      title: r.title,
      text: r.text || '',
      store: 'app-store',
    }));
  } catch (error) {
    console.error(`  [AS] Error: ${error.message}`);
    return [];
  }
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────
async function categorizeReviewsBatch(reviews, app) {
  if (!GEMINI_API_KEY) {
    console.warn('  [AI] No GEMINI_API_KEY. Using score-based fallback.');
    return reviews.map(r => ({
      ...r, appId: app.id,
      category: r.score >= 3 ? '칭찬' : '불만',
      subCategory: '미분류',
      analysisDate: new Date().toISOString(),
    }));
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const BATCH_SIZE = 50;
  const analyzed = [];

  console.log(`  [AI] Analyzing ${reviews.length} reviews (${IS_FAST_MODE ? 'FAST' : 'FREE'} mode)...`);

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const chunk = reviews.slice(i, i + BATCH_SIZE);

    if (i > 0) {
      const waitMs = IS_FAST_MODE ? 2000 : 6000;
      process.stdout.write(`  [AI] Waiting ${waitMs/1000}s... `);
      await delay(waitMs);
      process.stdout.write('done\n');
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
          const res = results.find(r => r.id === idx) || { subCategory: '미분류' };
          const finalCategory = review.score >= 3 ? '칭찬' : '불만';
          const allowedSubs = SUB_CATEGORIES[finalCategory];
          const finalSub = allowedSubs.includes(res.subCategory) ? res.subCategory : allowedSubs[allowedSubs.length - 1];
          analyzed.push({
            ...review, appId: app.id, category: finalCategory,
            subCategory: finalSub, analysisDate: new Date().toISOString(),
          });
        });

        process.stdout.write(`  [AI] ${analyzed.length}/${reviews.length} processed\n`);
        success = true;
        break;
      } catch (error) {
        const is429 = error.message?.includes('429') || error.message?.includes('quota');
        console.warn(`  [AI] Error chunk ${i} attempt ${attempt}: ${error.message?.substring(0, 80)}`);
        if (is429 && attempt < MAX_RETRIES) {
          const backoff = attempt * 30000;
          console.log(`  [AI] Rate limited. Retry in ${backoff/1000}s...`);
          await delay(backoff);
        }
      }
    }

    if (!success) {
      chunk.forEach(review => {
        analyzed.push({
          ...review, appId: app.id,
          category: review.score >= 3 ? '칭찬' : '불만',
          subCategory: '분석오류', analysisDate: new Date().toISOString(),
        });
      });
    }
  }

  return analyzed;
}

// ─── Insight Generation ───────────────────────────────────────────────────────
async function generateMonthlyInsight(month, allReviews, app) {
  if (!GEMINI_API_KEY) {
    return { month, summary: 'API 키 없음', positiveInsights: [], negativeInsights: [], tasks: [], generatedAt: new Date().toISOString() };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const targetDate = new Date(month + '-01');
  const sixMonthsAgo = new Date(targetDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const formatMonth = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const sixMonthsRange = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + i);
    sixMonthsRange.push(formatMonth(d));
  }

  const currentPeriod = sixMonthsRange.slice(3);
  const previousPeriod = sixMonthsRange.slice(0, 3);

  const relevantReviews = allReviews.filter(r => sixMonthsRange.includes(r.date.substring(0, 7)));

  const subCats = {};
  relevantReviews.forEach(r => {
    const rMonth = r.date.substring(0, 7);
    const sub = r.subCategory || '미분류';
    if (!subCats[sub]) subCats[sub] = { total: 0, positive: 0, negative: 0, months: {} };
    subCats[sub].total++;
    if (r.score >= 3) subCats[sub].positive++; else subCats[sub].negative++;
    if (!subCats[sub].months[rMonth]) subCats[sub].months[rMonth] = 0;
    subCats[sub].months[rMonth]++;
  });

  const spikes = [];
  Object.keys(subCats).forEach(sub => {
    const data = subCats[sub];
    let prev = 0, curr = 0;
    previousPeriod.forEach(m => prev += (data.months[m] || 0));
    currentPeriod.forEach(m => curr += (data.months[m] || 0));
    if (curr > prev * 1.5 && curr > 5) spikes.push(sub);
  });

  const groupedSamples = {};
  relevantReviews.sort((a, b) => b.date.localeCompare(a.date)).forEach(r => {
    const sub = r.subCategory || '미분류';
    if (!groupedSamples[sub]) groupedSamples[sub] = [];
    if (groupedSamples[sub].length < 5) {
      let text = r.text.replace(/\n/g, ' ').trim();
      if (text.length > 150) text = text.substring(0, 150) + '...';
      groupedSamples[sub].push(`[${r.score}점] ${text}`);
    }
  });

  const sampleReviews = Object.entries(groupedSamples).map(([sub, texts]) => `## ${sub}\n${texts.join('\n')}`).join('\n\n');

  const prompt = `
당신은 ${app.name} OTT 서비스 기획자이자 데이터 분석가입니다.
최근 6개월간의 사용자 리뷰 데이터를 바탕으로 인사이트 리포트를 작성해주세요.

[대상 월]: ${month}
[전체 통계]: 총 ${relevantReviews.length}건 (긍정 ${relevantReviews.filter(r => r.score >= 3).length}건, 부정 ${relevantReviews.filter(r => r.score < 3).length}건)
[세부 카테고리별 통계]: ${JSON.stringify(subCats)}
[급증(Spike) 감지된 항목]: ${spikes.join(', ')}

[최근 리뷰 샘플]:
${sampleReviews}

[요구사항]
1. 전체적인 트렌드 요약 (summary)
2. 긍정 인사이트 (positiveInsights): 주요 칭찬 요소 10개 내외
3. 부정 인사이트 (negativeInsights): 주요 불만 요소 10개 내외
4. 제안 기능/개선 과제 (tasks): 5-7개

[응답 형식] 반드시 JSON으로만 응답하세요.
{"summary":"","positiveInsights":[{"title":"","description":"","count":0,"severity":"medium","sentiment":"positive","isSpiked":false,"jobLabels":[],"relatedSubCategories":[]}],"negativeInsights":[{"title":"","description":"","count":0,"severity":"high","sentiment":"negative","isSpiked":false,"jobLabels":[],"relatedSubCategories":[]}],"tasks":[{"title":"","description":"","priority":"high","jobLabels":[],"prd":{}}]}
  `;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      const matches = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (matches) text = matches[1].trim();
      const aiResult = JSON.parse(text);
      return {
        month, summary: aiResult.summary || '분석 완료',
        positiveInsights: aiResult.positiveInsights || [],
        negativeInsights: aiResult.negativeInsights || [],
        tasks: aiResult.tasks || [],
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const isRetryable = error.message?.includes('429') || error.message?.includes('Resource exhausted');
      console.warn(`  [Insight] Error attempt ${attempt}: ${error.message?.substring(0, 80)}`);
      if (isRetryable && attempt < 3) {
        await delay(attempt * 15000);
        continue;
      }
      return { month, summary: `인사이트 오류: ${error.message}`, positiveInsights: [], negativeInsights: [], tasks: [], generatedAt: new Date().toISOString() };
    }
  }
}

// ─── GCS Backup ──────────────────────────────────────────────────────────────
async function syncToBackup(appIds) {
  if (!IS_PRODUCTION) {
    console.log('\n[Backup] Skipping backup (not in production mode)');
    return;
  }
  console.log(`\n[Backup] Syncing ${appIds.length} apps to gs://${BACKUP_BUCKET}...`);
  const storage = new Storage();
  const srcBucket = storage.bucket(MAIN_BUCKET);
  const dstBucket = storage.bucket(BACKUP_BUCKET);

  for (const appId of appIds) {
    const files = ['reviews.json', 'insights.json', 'status.json'];
    for (const filename of files) {
      const srcPath = `${appId}/${filename}`;
      try {
        const [content] = await srcBucket.file(srcPath).download();
        await dstBucket.file(srcPath).save(content);
        process.stdout.write(`  [Backup] ${srcPath} ✓\n`);
      } catch (err) {
        console.warn(`  [Backup] ${srcPath} skipped: ${err.message?.substring(0, 60)}`);
      }
    }
  }
  console.log('[Backup] Done.');
}

// ─── Main batch per app ───────────────────────────────────────────────────────
async function runBatchForApp(app) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${app.name}] Starting batch...`);
  console.log('='.repeat(60));

  // 1. Fetch
  console.log('  Fetching Google Play reviews...');
  const gpReviews = await fetchGooglePlayReviews(app.googlePlayId);
  console.log(`  [GP] ${gpReviews.length} reviews fetched`);

  console.log('  Fetching App Store reviews...');
  const asReviews = await fetchAppStoreReviews(app.appStoreId);
  console.log(`  [AS] ${asReviews.length} reviews fetched`);

  const allFetched = [...gpReviews, ...asReviews];
  console.log(`  Total fetched: ${allFetched.length}`);

  if (allFetched.length === 0) {
    console.log(`  No reviews fetched. Skipping.`);
    return { app: app.name, fetched: 0, newCount: 0 };
  }

  // 2. Filter new
  const existing = await readJSON(app.id, 'reviews.json', []);
  const existingIds = new Set(existing.map(r => `${r.store}-${r.id}`));
  const newOnly = allFetched.filter(r => !existingIds.has(`${r.store}-${r.id}`));
  console.log(`  New reviews: ${newOnly.length} (${allFetched.length - newOnly.length} already exist)`);

  if (newOnly.length === 0) {
    console.log(`  No new reviews. Skipping AI analysis.`);
    return { app: app.name, fetched: allFetched.length, newCount: 0, totalReviews: existing.length };
  }

  // 3. AI analysis
  const analyzed = await categorizeReviewsBatch(newOnly, app);

  // 4. Save reviews
  const allReviews = [...existing, ...analyzed];
  await writeJSON(app.id, 'reviews.json', allReviews);
  await writeJSON(app.id, 'status.json', { lastUpdate: new Date().toISOString() });
  console.log(`  Saved ${analyzed.length} new reviews. Total: ${allReviews.length}`);

  // 5. Generate insight
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`  Generating insight for ${currentMonth}...`);

  await delay(IS_FAST_MODE ? 2000 : 6000);
  const insight = await generateMonthlyInsight(currentMonth, allReviews, app);
  const existingInsights = await readJSON(app.id, 'insights.json', []);
  const updatedInsights = existingInsights.filter(i => i.month !== currentMonth);
  updatedInsights.push(insight);
  await writeJSON(app.id, 'insights.json', updatedInsights);
  console.log(`  Insight saved for ${currentMonth}`);

  return { app: app.name, fetched: allFetched.length, newCount: analyzed.length, totalReviews: allReviews.length };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  const targetId = process.argv[2];
  const apps = targetId ? OTT_APPS.filter(a => a.id === targetId) : OTT_APPS;

  if (targetId && apps.length === 0) {
    console.error(`Unknown appId: ${targetId}`);
    console.error(`Available: ${OTT_APPS.map(a => a.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nAppScope Batch Collection`);
  console.log(`Apps: ${apps.map(a => a.name).join(', ')}`);
  console.log(`Mode: ${IS_FAST_MODE ? 'FAST (2s delay)' : 'FREE (6s delay)'}`);
  console.log(`Gemini API: ${GEMINI_API_KEY ? 'configured' : 'NOT SET (score-based fallback)'}`);

  const results = [];
  for (const app of apps) {
    try {
      const result = await runBatchForApp(app);
      results.push(result);
      // Brief pause between apps
      if (apps.indexOf(app) < apps.length - 1) {
        console.log(`\n  Waiting 5s before next app...`);
        await delay(5000);
      }
    } catch (error) {
      console.error(`[${app.name}] Fatal error:`, error);
      results.push({ app: app.name, error: error.message });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  results.forEach(r => {
    if (r.error) {
      console.log(`  ${r.app}: ERROR - ${r.error}`);
    } else {
      console.log(`  ${r.app}: fetched=${r.fetched}, new=${r.newCount}, total=${r.totalReviews ?? 'N/A'}`);
    }
  });

  // Backup: sync successful apps to backup bucket
  const successfulAppIds = results
    .filter(r => !r.error)
    .map(r => OTT_APPS.find(a => a.name === r.app)?.id)
    .filter(Boolean);
  await syncToBackup(successfulAppIds);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
