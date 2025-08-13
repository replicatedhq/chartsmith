// Simple state to track if params have been initialized
let isLoaded = false;

export async function loadParams() {
  // This could be enhanced in the future to load configuration from external sources
  // For now, it just marks that initialization has occurred
  isLoaded = true;
}

export async function getParam(key: string): Promise<string> {
  if (!isLoaded) {
    await loadParams();
  }

  switch (key) {
    case "DB_URI":
    case "DBUri":
      // Read environment variables dynamically when requested
      // This ensures runtime configuration works correctly
      const dbUri = process.env["CHARTSMITH_PG_URI"] || process.env["DB_URI"];
      if (!dbUri) {
        throw new Error("Database URI not configured. Set either CHARTSMITH_PG_URI or DB_URI environment variable.");
      }
      return dbUri;
    default:
      throw new Error(`unknown param ${key}`);
  }
}
