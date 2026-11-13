import http from 'node:http';

/** Starts a local server; routes: /file (N bytes), /chunked, /404, /slow. */
export async function startServer({ size = 256 * 1024 } = {}) {
  const payload = Buffer.alloc(size, 7);
  let hits = 0;

  const server = http.createServer((req, res) => {
    hits++;
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/file') {
      res.writeHead(200, { 'content-length': payload.length, 'content-type': 'application/octet-stream' });
      res.end(payload);
    } else if (path === '/chunked') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.write(payload.subarray(0, size / 2));
      setTimeout(() => res.end(payload.subarray(size / 2)), 5);
    } else if (path === '/redirect') {
      res.writeHead(302, { location: '/file' });
      res.end();
    } else if (path === '/slow') {
      res.writeHead(200);
      setTimeout(() => res.end('late'), 2000).unref();
    } else {
      res.writeHead(404);
      res.end('nope');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: (p) => `http://127.0.0.1:${port}${p}`,
    hits: () => hits,
    close: () => new Promise((resolve) => server.close(resolve).closeAllConnections()),
    size,
  };
}
