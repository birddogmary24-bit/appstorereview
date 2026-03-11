import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/docs
 * Swagger UI for API documentation
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3001';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const specUrl = `${protocol}://${host}/api/v1/openapi`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppScope API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .custom-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 24px 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .custom-header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 700;
    }
    .custom-header p {
      margin: 0;
      opacity: 0.8;
      font-size: 14px;
    }
    .rate-limit-banner {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 12px 20px;
      margin: 16px 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #856404;
    }
    .rate-limit-banner strong { color: #664d03; }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>AppScope API</h1>
    <p>OTT 앱 리뷰 분석 플랫폼 - REST API Documentation</p>
  </div>
  <div class="rate-limit-banner">
    <strong>⚠ 호출 제한:</strong> 각 API 키당 <strong>일 2회</strong>, <strong>월 4회</strong>로 제한됩니다.
    API 키는 관리자에게 요청하세요.
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 2,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
