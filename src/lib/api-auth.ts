import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit, incrementUsage } from './api-keys';

export interface AuthResult {
  success: true;
  accountName: string;
  remaining: { daily: number; monthly: number };
}

export interface AuthError {
  success: false;
  response: NextResponse;
}

/**
 * Authenticate and rate-limit an API v1 request.
 * Extracts API key from `Authorization: Bearer <key>` header or `apiKey` query param.
 * Increments usage counters on success.
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  // Extract API key
  const authHeader = request.headers.get('authorization');
  const apiKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : new URL(request.url).searchParams.get('apiKey');

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'API 키가 필요합니다.',
          message: 'Authorization 헤더에 Bearer <API_KEY>를 포함하거나 apiKey 쿼리 파라미터를 사용하세요.',
        },
        { status: 401 }
      ),
    };
  }

  // Validate key
  const record = await validateApiKey(apiKey);
  if (!record) {
    return {
      success: false,
      response: NextResponse.json(
        { error: '유효하지 않은 API 키입니다.' },
        { status: 401 }
      ),
    };
  }

  // Check rate limits
  const rateCheck = await checkRateLimit(apiKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: '호출 한도 초과',
          message: rateCheck.reason,
          remaining: rateCheck.remaining,
        },
        { status: 429 }
      ),
    };
  }

  // Increment usage
  await incrementUsage(apiKey);

  return {
    success: true,
    accountName: record.name,
    remaining: {
      daily: (rateCheck.remaining?.daily ?? 0) - 1,
      monthly: (rateCheck.remaining?.monthly ?? 0) - 1,
    },
  };
}

/** Add rate-limit headers to a response */
export function addRateLimitHeaders(
  response: NextResponse,
  remaining: { daily: number; monthly: number }
): NextResponse {
  response.headers.set('X-RateLimit-Daily-Remaining', String(remaining.daily));
  response.headers.set('X-RateLimit-Monthly-Remaining', String(remaining.monthly));
  response.headers.set('X-RateLimit-Daily-Limit', '2');
  response.headers.set('X-RateLimit-Monthly-Limit', '4');
  return response;
}
