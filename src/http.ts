import { IncomingMessage, ServerResponse } from 'node:http';

export async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(raw)
  });
  res.end(raw);
}

export function sendNoContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

export function notFound(res: ServerResponse): void {
  sendJSON(res, 404, { error: 'not_found' });
}

export function methodNotAllowed(res: ServerResponse): void {
  sendJSON(res, 405, { error: 'method_not_allowed' });
}
