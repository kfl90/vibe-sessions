// Tiny static file server for the fixtures. Fixtures must be served over
// http:// (not file://) so <all_urls> content-script matching and iframes
// behave like the real world.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png'
};

export function startServer(port = 8788) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const rel = normalize(url.pathname).replace(/^([/\\])+/, '');
      if (rel.includes('..')) throw new Error('bad path');
      const file = join(ROOT, rel || 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 8788);
  startServer(port).then(() => console.log(`serving fixtures on http://127.0.0.1:${port}`));
}
