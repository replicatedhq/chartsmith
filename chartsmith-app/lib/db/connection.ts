/**
 * PostgreSQL Database Connection Pool
 *
 * Provides a connection pool for database operations.
 * Uses pg library for PostgreSQL connectivity.
 */

import { Pool, PoolConfig } from 'pg';

// Global connection pool instance
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 *
 * Uses DATABASE_URL or CHARTSMITH_PG_URI from environment variables.
 *
 * @returns PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  // Get connection string from environment
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.CHARTSMITH_PG_URI ||
    process.env.NEXT_PUBLIC_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Database connection string not found. Set DATABASE_URL or CHARTSMITH_PG_URI environment variable.'
    );
  }

  // Pool configuration
  const config: PoolConfig = {
    connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection not available
  };

  console.log('[db] Creating PostgreSQL connection pool', {
    max: config.max,
    idleTimeout: config.idleTimeoutMillis,
    connectionTimeout: config.connectionTimeoutMillis,
  });

  pool = new Pool(config);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client', err);
  });

  return pool;
}

/**
 * Close the database connection pool
 *
 * Should be called when shutting down the application.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log('[db] Closing PostgreSQL connection pool');
    await pool.end();
    pool = null;
  }
}

/**
 * Execute a query with the connection pool
 *
 * Helper function to get a client and execute a query.
 *
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    console.log('[db] Query executed', {
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result.rows as T;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[db] Query error', {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
