/**
 * 발표용 AI 문지기 서버.
 *   npm run ai-gateway        (기본 포트 8787)
 *
 * 인터넷(터널) → 이 서버(8787) → 내 컴퓨터 Ollama(127.0.0.1:11434)
 *  - 소개팅 설명 요청만 통과 (guard.ts)
 *  - 한 사람당 1분에 6번까지, 동시에 기다릴 수 있는 요청은 최대 4개
 *  - 앱 주소(github.io)와 localhost 개발 서버에서 온 요청만 허용
 * 앱(src/services/llm.ts)이 쓰는 Ollama API 모양(/api/version, /api/tags, /api/chat)을 그대로 흉내 낸다.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ALLOWED_MODEL, ALLOWED_ORIGINS, checkExplainRequest, RateLimiter } from './guard';

const PORT = Number(process.env.GATEWAY_PORT ?? 8787);
const OLLAMA = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MAX_BODY = 16 * 1024;
const MAX_WAITING = 4;

const limiter = new RateLimiter(6, 60_000);
let busy = 0;

function clientIp(req: IncomingMessage): string {
  return String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '?');
}

function log(req: IncomingMessage, status: number, started: number, note = '') {
  const ip = clientIp(req).replace(/(\d+)\.(\d+)$/, 'x.x'); // 로그에 IP 전체를 남기지 않음
  console.log(`${new Date().toLocaleTimeString('ko-KR')}  ${status}  ${req.method} ${req.url}  ${Date.now() - started}ms  ${ip}  ${note}`);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const origin = req.headers.origin;

  // CORS: 허용된 주소에서 온 브라우저 요청만
  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      send(res, 403, { error: '허용되지 않은 사이트예요.' });
      return log(req, 403, started, `origin=${origin}`);
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && req.url === '/api/version') {
      const v = await fetch(`${OLLAMA}/api/version`).then((r) => r.json() as Promise<{ version: string }>);
      send(res, 200, { version: `${v.version} (발표용 문지기)` });
      return log(req, 200, started);
    }
    if (req.method === 'GET' && req.url === '/api/tags') {
      const t = await fetch(`${OLLAMA}/api/tags`).then((r) => r.json() as Promise<{ models: { name: string }[] }>);
      const models = t.models.filter((m) => m.name === ALLOWED_MODEL); // 허용된 모델만 보여줌
      send(res, 200, { models });
      return log(req, 200, started);
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      if (!limiter.allow(clientIp(req))) {
        send(res, 429, { error: '잠시 후 다시 시도해 주세요. (1분에 6번까지)' });
        return log(req, 429, started, 'rate limit');
      }
      if (busy >= MAX_WAITING) {
        send(res, 429, { error: '지금 사용하는 사람이 많아요. 잠시 후 다시 시도해 주세요.' });
        return log(req, 429, started, 'queue full');
      }
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        send(res, 400, { error: '요청 형식이 올바르지 않아요.' });
        return log(req, 400, started);
      }
      const guard = checkExplainRequest(body);
      if (!guard.ok) {
        send(res, guard.status, { error: guard.reason });
        return log(req, guard.status, started, 'blocked');
      }

      busy++;
      const ctrl = new AbortController();
      res.on('close', () => ctrl.abort()); // 사용자가 취소하거나 창을 닫으면 Ollama도 멈춤
      try {
        const upstream = await fetch(`${OLLAMA}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guard.payload),
          signal: ctrl.signal,
        });
        res.writeHead(upstream.status, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' });
        if (upstream.body) {
          const reader = upstream.body.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
        log(req, upstream.status, started, `waiting=${busy - 1}`);
      } finally {
        busy--;
      }
      return;
    }
    send(res, 404, { error: '없는 주소예요.' });
    log(req, 404, started);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return log(req, 499, started, 'client closed');
    if (!res.headersSent) send(res, 502, { error: 'Ollama에 연결할 수 없어요. Ollama가 켜져 있는지 확인해 주세요.' });
    else res.end();
    log(req, 502, started, (err as Error).message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🛡️  AI 문지기 실행 중: http://localhost:${PORT}  →  Ollama ${OLLAMA}`);
  console.log(`   허용 모델: ${ALLOWED_MODEL} / 허용 사이트: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('   끄려면 Ctrl + C\n');
});
