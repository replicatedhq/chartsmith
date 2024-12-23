const { Pool } = require("pg");
const url = require("url");
const querystring = require("querystring");

let pool: any = null;

export function getDB(uri: string): any {
  if (pool) {
    return pool;
  }

  const params = url.parse(uri);
  const auth = params.auth.split(":");

  let ssl: any = {
    rejectUnauthorized: false
  };
  const parsedQuery = querystring.parse(params.query);
  if (parsedQuery.sslmode === "disable") {
    ssl = false;
  }

  const p = new Pool({
    user: auth[0],
    password: auth[1],
    host: params.hostname,
    port: params.port,
    database: params.pathname.split("/")[1],
    ssl: ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  pool = p;

  return pool;
}
