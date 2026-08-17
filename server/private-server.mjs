import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { CollaborationCore, CollaborationError } from './collaboration-core.mjs';

const host = process.env.GEOMAP_PRIVATE_HOST ?? '127.0.0.1';
const port = Number(process.env.GEOMAP_PRIVATE_PORT ?? 8787);
const dataFile = resolve(process.env.GEOMAP_PRIVATE_DATA ?? 'private-data/geomap-private.json');
const allowedOrigin = process.env.GEOMAP_ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173';
const core = new CollaborationCore({ filePath: dataFile });
await core.initialize();

function json(response, status, value, origin) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    ...(origin === allowedOrigin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {})
  });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) {
      throw new CollaborationError(413, 'payload-too-large', '请求内容超过 10 MB。');
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new CollaborationError(400, 'invalid-json', '请求 JSON 无效。');
  }
}

function bearer(request) {
  const authorization = request.headers.authorization ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function match(pathname, expression) {
  return pathname.match(expression);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (request.method === 'OPTIONS') {
    if (origin !== allowedOrigin) return json(response, 403, { error: 'origin-not-allowed' });
    response.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type,if-match',
      'access-control-max-age': '600',
      vary: 'origin'
    });
    return response.end();
  }
  if (origin && origin !== allowedOrigin) {
    return json(response, 403, { error: 'origin-not-allowed' });
  }
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
    const pathname = url.pathname;
    if (request.method === 'GET' && pathname === '/api/health') {
      return json(response, 200, { ok: true, ...core.status() }, origin);
    }
    if (request.method === 'POST' && pathname === '/api/setup') {
      return json(response, 201, await core.setup(await body(request)), origin);
    }
    if (request.method === 'POST' && pathname === '/api/sessions') {
      return json(response, 200, await core.login(await body(request)), origin);
    }
    const shareMatch = match(pathname, /^\/api\/shares\/([^/]+)$/);
    if (request.method === 'GET' && shareMatch) {
      return json(response, 200, core.readShare(shareMatch[1]), origin);
    }
    const token = bearer(request);
    const user = core.authenticate(token);
    if (request.method === 'DELETE' && pathname === '/api/sessions/current') {
      core.logout(token);
      return json(response, 200, { ok: true }, origin);
    }
    if (request.method === 'GET' && pathname === '/api/me') {
      return json(response, 200, core.me(user), origin);
    }
    if (request.method === 'GET' && pathname === '/api/workspaces') {
      return json(response, 200, { workspaces: core.listWorkspaces(user) }, origin);
    }
    const workspaceMatch = match(pathname, /^\/api\/workspaces\/([^/]+)$/);
    if (request.method === 'GET' && workspaceMatch) {
      return json(response, 200, core.getWorkspace(user, workspaceMatch[1]), origin);
    }
    if (request.method === 'PUT' && workspaceMatch) {
      const ifMatch = request.headers['if-match'];
      const version =
        typeof ifMatch === 'string' && /^"\d+"$/.test(ifMatch)
          ? Number(ifMatch.slice(1, -1))
          : Number.NaN;
      return json(
        response,
        200,
        await core.updateWorkspace(user, workspaceMatch[1], version, (await body(request)).state),
        origin
      );
    }
    if (request.method === 'GET' && pathname === '/api/members') {
      return json(response, 200, { members: core.listMembers(user) }, origin);
    }
    if (request.method === 'POST' && pathname === '/api/members') {
      return json(response, 201, await core.addMember(user, await body(request)), origin);
    }
    const commentsMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/comments$/);
    if (request.method === 'GET' && commentsMatch) {
      return json(
        response,
        200,
        { comments: core.listComments(user, commentsMatch[1], url.searchParams.get('entityRef')) },
        origin
      );
    }
    if (request.method === 'POST' && commentsMatch) {
      return json(
        response,
        201,
        await core.addComment(user, commentsMatch[1], await body(request)),
        origin
      );
    }
    const resolveMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/comments\/([^/]+)$/);
    if (request.method === 'PATCH' && resolveMatch) {
      return json(
        response,
        200,
        await core.resolveComment(
          user,
          resolveMatch[1],
          resolveMatch[2],
          Boolean((await body(request)).resolved)
        ),
        origin
      );
    }
    const sharesMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/shares$/);
    if (request.method === 'POST' && sharesMatch) {
      return json(
        response,
        201,
        await core.createShare(user, sharesMatch[1], await body(request)),
        origin
      );
    }
    const briefsMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/briefs$/);
    if (request.method === 'POST' && briefsMatch) {
      return json(
        response,
        201,
        await core.createBrief(user, briefsMatch[1], await body(request)),
        origin
      );
    }
    if (request.method === 'PUT' && pathname === '/api/organization/brand') {
      return json(response, 200, await core.saveBrand(user, await body(request)), origin);
    }
    const syncMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/sync-jobs$/);
    if (request.method === 'GET' && syncMatch) {
      return json(response, 200, { syncJobs: core.listSyncJobs(user, syncMatch[1]) }, origin);
    }
    if (request.method === 'POST' && syncMatch) {
      return json(
        response,
        201,
        await core.createSyncJob(user, syncMatch[1], await body(request)),
        origin
      );
    }
    const auditMatch = match(pathname, /^\/api\/workspaces\/([^/]+)\/audit$/);
    if (request.method === 'GET' && auditMatch) {
      return json(response, 200, { audit: core.listAudit(user, auditMatch[1]) }, origin);
    }
    throw new CollaborationError(404, 'route-not-found', '接口不存在。');
  } catch (error) {
    const status = error instanceof CollaborationError ? error.status : 500;
    if (status === 500) console.error(error);
    json(
      response,
      status,
      {
        error: error instanceof CollaborationError ? error.code : 'internal-error',
        message: status === 500 ? '服务器内部错误。' : error.message,
        ...(error instanceof CollaborationError && error.details ? { details: error.details } : {})
      },
      origin
    );
  }
});

server.listen(port, host, () => {
  console.log(`Geomap private collaboration server: http://${host}:${port}`);
  console.log(`Private data: ${dataFile}`);
  console.log(core.status().configured ? 'Status: configured' : 'Status: waiting for /api/setup');
});
