import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SessionRecord } from './types.js';

export class SessionStore {
  private readonly path: string;
  private loaded = false;
  private records = new Map<string, SessionRecord>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  async upsert(record: Omit<SessionRecord, 'updatedAt'>): Promise<void> {
    const operation = this.writeQueue.catch(() => undefined).then(async () => {
      await this.load();
      this.records.set(record.sessionID, {
        ...record,
        updatedAt: new Date().toISOString()
      });
      await this.persist();
    });
    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  async get(sessionID: string): Promise<SessionRecord | undefined> {
    await this.writeQueue.catch(() => undefined);
    await this.load();
    return this.records.get(sessionID.trim());
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as SessionRecord[];
      for (const record of parsed) {
        if (record.sessionID) {
          this.records.set(record.sessionID, record);
        }
      }
      this.loaded = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const raw = JSON.stringify([...this.records.values()], null, 2);
    await writeFile(this.path, raw + '\n', 'utf8');
  }
}
