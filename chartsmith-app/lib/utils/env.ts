
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const isDev = process.env.NODE_ENV !== 'production';

// Load .env.local manually in dev (useful for standalone mode or custom servers)
if (isDev) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export function getPublicEnv(): Record<string, string> {
  const publicEnv: Record<string, string> = {};

  for (const key in process.env) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      publicEnv[key] = process.env[key]!;
    }
  }

  return publicEnv;
}