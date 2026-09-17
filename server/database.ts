import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseSync } from "node:sqlite";

export interface AsyncDatabase {
  prepare(sql: string): {
    get(...parameters: any[]): Promise<any>;
    all(...parameters: any[]): Promise<any[]>;
    run(...parameters: any[]): Promise<{ changes: number | bigint }>;
  };
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Queue complete transactions as well as individual statements on a local connection. */
export class SQLiteDatabase implements AsyncDatabase {
  private tail: Promise<unknown> = Promise.resolve();
  private context = new AsyncLocalStorage<{ active: boolean; depth: number }>();
  constructor(private connection: DatabaseSync) {}
  private async exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const current = this.context.getStore();
    if (current?.active) return fn();
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => {});
    return run;
  }
  prepare(sql: string) {
    return {
      get: (...parameters: any[]) =>
        this.exclusive(() => this.connection.prepare(sql).get(...parameters)),
      all: (...parameters: any[]) =>
        this.exclusive(() => this.connection.prepare(sql).all(...parameters)),
      run: (...parameters: any[]) =>
        this.exclusive(() => this.connection.prepare(sql).run(...parameters)),
    };
  }
  exec(sql: string) {
    return this.exclusive(() => this.connection.exec(sql));
  }
  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    const current = this.context.getStore();
    if (current?.active) {
      const savepoint = `nested_${++current.depth}`;
      this.connection.exec(`SAVEPOINT ${savepoint}`);
      try {
        const value = await fn();
        this.connection.exec(`RELEASE ${savepoint}`);
        return value;
      } catch (error) {
        this.connection.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      } finally {
        current.depth--;
      }
    }
    return this.exclusive(() =>
      this.context.run({ active: true, depth: 0 }, async () => {
        this.connection.exec("BEGIN IMMEDIATE");
        try {
          const value = await fn();
          this.connection.exec("COMMIT");
          return value;
        } catch (error) {
          this.connection.exec("ROLLBACK");
          throw error;
        } finally {
          this.context.getStore()!.active = false;
        }
      }),
    );
  }
  async close() {
    await this.exclusive(() => this.connection.close());
  }
}
