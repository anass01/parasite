import { Pool } from 'pg';

// Global singleton to prevent multiple pools during Next.js hot reloading
const globalForPg = global as unknown as { pgPool: Pool | undefined };

let connectionString = process.env.POSTGRES_URL;

if (connectionString) {
    try {
        const url = new URL(connectionString);
        url.pathname = '/parasite'; // Force 'parasite' database
        url.searchParams.delete('sslmode');
        connectionString = url.toString();
    } catch (e) {
        // Fallback if URL parsing fails
        connectionString = connectionString
            .replace(/\/postgres(\?|$)/, '/parasite$1') // Force 'parasite' database
            .replace(/sslmode=[^&]+/g, '')
            .replace(/\?&/g, '?')
            .replace(/&&/g, '&')
            .replace(/[&?]$/g, '');
    }
}

export const pool =
    globalForPg.pgPool ??
    new Pool({
        connectionString,
        max: 20,                    // Up to 20 concurrent connections
        idleTimeoutMillis: 30_000,  // Close idle connections after 30s
        connectionTimeoutMillis: 5_000, // Error if no connection available in 5s
        ssl: {
            rejectUnauthorized: false,
        },
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPg.pgPool = pool;
}

export const query = <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
): Promise<T[]> =>
    pool.query(sql, params).then((r) => r.rows as T[]);
