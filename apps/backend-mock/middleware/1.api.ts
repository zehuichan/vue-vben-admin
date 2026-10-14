import { defineEventHandler } from 'h3';
import { forbiddenResponse, sleep } from '~/utils/response';

/**
 * Writable despite the demo lock: tenant records drive login, switching and
 * isolation, so the multi-tenant demo needs them to actually change.
 */
const WRITABLE_SYSTEM_PATHS = ['/api/system/tenant'];

export default defineEventHandler(async (event) => {
  event.node.res.setHeader(
    'Access-Control-Allow-Origin',
    event.headers.get('Origin') ?? '*',
  );
  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.statusMessage = 'No Content.';
    return 'OK';
  } else if (
    ['DELETE', 'PATCH', 'POST', 'PUT'].includes(event.method) &&
    event.path.startsWith('/api/system/') &&
    !WRITABLE_SYSTEM_PATHS.some((path) => event.path.startsWith(path))
  ) {
    await sleep(Math.floor(Math.random() * 2000));
    return forbiddenResponse(event, '演示环境，禁止修改');
  }
});
