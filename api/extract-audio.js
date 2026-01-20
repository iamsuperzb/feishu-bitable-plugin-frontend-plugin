const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return '';
  return baseUrl.trim().replace(/\/$/, '');
};

const resolveBackendBase = () => {
  const fromEnv = process.env.BACKEND_API_BASE_URL;
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return 'https://feishu-bitable-plugin-backend-service.virlysocial.com';
};

const readRequestBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const backendBase = resolveBackendBase();
  const targetUrl = `${backendBase}/api/extract-audio`;

  try {
    const body = await readRequestBody(req);
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'X-Base-User-Id': req.headers['x-base-user-id'] || '',
        'X-Tenant-Key': req.headers['x-tenant-key'] || ''
      },
      body
    });

    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const remaining = upstream.headers.get('x-ratelimit-remaining');
    const limit = upstream.headers.get('x-ratelimit-limit');
    if (remaining) res.setHeader('X-RateLimit-Remaining', remaining);
    if (limit) res.setHeader('X-RateLimit-Limit', limit);
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', error: '服务暂时不可用' }));
  }
}
