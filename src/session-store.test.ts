import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from './session-store.js';

test('SessionStore keeps concurrent upserts in one persisted file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zhida-crisp-sessions-'));
  try {
    const file = join(dir, 'sessions.json');
    const store = new SessionStore(file);
    await Promise.all([
      store.upsert({ sessionID: 'session-1', websiteID: 'site-1' }),
      store.upsert({ sessionID: 'session-2', websiteID: 'site-2' }),
      store.upsert({ sessionID: 'session-3', websiteID: 'site-3' })
    ]);

    assert.equal((await store.get('session-1'))?.websiteID, 'site-1');
    assert.equal((await store.get('session-2'))?.websiteID, 'site-2');
    assert.equal((await store.get('session-3'))?.websiteID, 'site-3');

    const persisted = JSON.parse(await readFile(file, 'utf8')) as Array<{ sessionID: string }>;
    assert.deepEqual(persisted.map((item) => item.sessionID).sort(), ['session-1', 'session-2', 'session-3']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
