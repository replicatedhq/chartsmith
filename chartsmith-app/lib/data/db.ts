import { Pool, PoolConfig } from "pg";

let pool: Pool | null = null;

export function getDB(uri: string): Pool {
  if (pool) {
    return pool;
  }

  // Use WHATWG URL API instead of deprecated url.parse()
  const parsedUrl = new URL(uri);
  
  let ssl: boolean | { rejectUnauthorized: boolean } = {
    rejectUnauthorized: false,
  };
  
  // Check for sslmode parameter in query string
  if (parsedUrl.searchParams.get("sslmode") === "disable") {
    ssl = false;
  }

  const config: PoolConfig = {
    user: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    host: parsedUrl.hostname || "localhost",
    port: parseInt(parsedUrl.port || "5432"),
    database: parsedUrl.pathname.split("/")[1] || "",
    ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  pool = new Pool(config);

  return pool;
}
