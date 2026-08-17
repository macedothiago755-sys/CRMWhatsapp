import { Redis } from "ioredis";

/**
 * Shared Redis connection for BullMQ — one connection, not one per queue/worker.
 * `maxRetriesPerRequest: null` is required by BullMQ's blocking connections
 * (Workers use BRPOPLPUSH-style blocking commands that must not time out on
 * their own retry policy).
 */
let connection: Redis | undefined;

export function getRedisConnection(redisUrl: string): Redis {
  if (!connection) {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
