import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/api-keys
 * API 키 목록 조회 (관리자 전용)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const password = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: '관리자 인증 실패' }, { status: 401 });
  }

  const keys = await listApiKeys();
  return NextResponse.json({
    data: keys.map(k => ({
      id: k.id,
      name: k.name,
      active: k.active,
      createdAt: k.createdAt,
      dailyUsage: k.dailyUsage,
      monthlyUsage: k.monthlyUsage,
    })),
  });
}

/**
 * POST /api/v1/admin/api-keys
 * 새 API 키 발급 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (!verifyPassword(body.password || '')) {
    return NextResponse.json({ error: '관리자 인증 실패' }, { status: 401 });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name 필드가 필요합니다 (계정 이름)' }, { status: 400 });
  }

  const { apiKey, record } = await createApiKey(body.name.trim());

  return NextResponse.json({
    message: 'API 키가 생성되었습니다. 이 키는 한 번만 표시됩니다.',
    apiKey,
    account: {
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
    },
    limits: {
      daily: 2,
      monthly: 4,
    },
  }, { status: 201 });
}

/**
 * DELETE /api/v1/admin/api-keys
 * API 키 비활성화 (관리자 전용)
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (!verifyPassword(body.password || '')) {
    return NextResponse.json({ error: '관리자 인증 실패' }, { status: 401 });
  }

  if (!body.keyId) {
    return NextResponse.json({ error: 'keyId 필드가 필요합니다' }, { status: 400 });
  }

  const success = await revokeApiKey(body.keyId);
  if (!success) {
    return NextResponse.json({ error: '해당 API 키를 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json({ message: 'API 키가 비활성화되었습니다.' });
}
