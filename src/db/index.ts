import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const connectionUri = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/personal_os';

const globalForDb = globalThis as unknown as {
  conn: mysql.Pool | undefined;
};

export const poolConnection =
  globalForDb.conn ??
  mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.conn = poolConnection;

export const db = drizzle(poolConnection, { schema, mode: 'default' });
export { schema };
