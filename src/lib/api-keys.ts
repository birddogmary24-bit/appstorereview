import { randomBytes, createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const DATA_DIR = path.join(process.cwd(), 'data');
const API_KEYS_FILE = 'api-keys.json';
const bucketName = process.env.GCS_BUCKET_NAME;
const storage = new Storage();

function isProduction() {
  return process.env.NODE_ENV === 'production' && !!bucketName;
}

export interface ApiKeyRecord {
  id: string;
  keyHash: string;         // SHA-256 hash of the API key (never store plaintext)
  name: string;            // account/user display name
  createdAt: string;
  active: boolean;
  dailyUsage: { date: string; count: number };
  monthlyUsage: { month: string; count: number };
}

async function loadApiKeys(): Promise<ApiKeyRecord[]> {
  try {
    if (isProduction()) {
      const bucket = storage.bucket(bucketName!);
      const [content] = await bucket.file(API_KEYS_FILE).download();
      return JSON.parse(content.toString());
    } else {
      const data = await fs.readFile(path.join(DATA_DIR, API_KEYS_FILE), 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    return [];
  }
}

async function saveApiKeys(keys: ApiKeyRecord[]): Promise<void> {
  if (isProduction()) {
    const bucket = storage.bucket(bucketName!);
    await bucket.file(API_KEYS_FILE).save(JSON.stringify(keys, null, 2));
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, API_KEYS_FILE), JSON.stringify(keys, null, 2));
  }
}

function hashKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function monthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Create a new API key. Returns the plaintext key (shown once) and the record. */
export async function createApiKey(name: string): Promise<{ apiKey: string; record: ApiKeyRecord }> {
  const apiKey = `appscope_${randomBytes(24).toString('hex')}`;
  const record: ApiKeyRecord = {
    id: randomBytes(8).toString('hex'),
    keyHash: hashKey(apiKey),
    name,
    createdAt: new Date().toISOString(),
    active: true,
    dailyUsage: { date: todayStr(), count: 0 },
    monthlyUsage: { month: monthStr(), count: 0 },
  };

  const keys = await loadApiKeys();
  keys.push(record);
  await saveApiKeys(keys);

  return { apiKey, record };
}

/** Validate an API key and return the record if valid. */
export async function validateApiKey(apiKey: string): Promise<ApiKeyRecord | null> {
  if (!apiKey) return null;
  const keys = await loadApiKeys();
  const hash = hashKey(apiKey);
  return keys.find(k => k.keyHash === hash && k.active) || null;
}

/** Check rate limits. Returns { allowed, reason } */
export async function checkRateLimit(apiKey: string): Promise<{ allowed: boolean; reason?: string; remaining?: { daily: number; monthly: number } }> {
  const DAILY_LIMIT = 2;
  const MONTHLY_LIMIT = 4;

  const keys = await loadApiKeys();
  const hash = hashKey(apiKey);
  const record = keys.find(k => k.keyHash === hash && k.active);
  if (!record) return { allowed: false, reason: 'Invalid API key' };

  const today = todayStr();
  const month = monthStr();

  // Reset counters if date/month changed
  if (record.dailyUsage.date !== today) {
    record.dailyUsage = { date: today, count: 0 };
  }
  if (record.monthlyUsage.month !== month) {
    record.monthlyUsage = { month, count: 0 };
  }

  const dailyRemaining = DAILY_LIMIT - record.dailyUsage.count;
  const monthlyRemaining = MONTHLY_LIMIT - record.monthlyUsage.count;

  if (record.dailyUsage.count >= DAILY_LIMIT) {
    return { allowed: false, reason: `일일 호출 한도 초과 (${DAILY_LIMIT}회/일). 내일 다시 시도하세요.`, remaining: { daily: 0, monthly: monthlyRemaining } };
  }
  if (record.monthlyUsage.count >= MONTHLY_LIMIT) {
    return { allowed: false, reason: `월간 호출 한도 초과 (${MONTHLY_LIMIT}회/월). 다음 달에 다시 시도하세요.`, remaining: { daily: dailyRemaining, monthly: 0 } };
  }

  return { allowed: true, remaining: { daily: dailyRemaining, monthly: monthlyRemaining } };
}

/** Increment usage counters for an API key. */
export async function incrementUsage(apiKey: string): Promise<void> {
  const keys = await loadApiKeys();
  const hash = hashKey(apiKey);
  const record = keys.find(k => k.keyHash === hash && k.active);
  if (!record) return;

  const today = todayStr();
  const month = monthStr();

  if (record.dailyUsage.date !== today) {
    record.dailyUsage = { date: today, count: 0 };
  }
  if (record.monthlyUsage.month !== month) {
    record.monthlyUsage = { month, count: 0 };
  }

  record.dailyUsage.count++;
  record.monthlyUsage.count++;

  await saveApiKeys(keys);
}

/** List all API keys (admin view, no plaintext keys). */
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  return loadApiKeys();
}

/** Revoke (deactivate) an API key by ID. */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const keys = await loadApiKeys();
  const record = keys.find(k => k.id === keyId);
  if (!record) return false;
  record.active = false;
  await saveApiKeys(keys);
  return true;
}
