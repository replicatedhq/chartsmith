
import { getDB } from "../lib/data/db";
import { getParam } from "../lib/data/param";

async function main() {
    const dbUri = await getParam("DB_URI");
    const db = getDB(dbUri);

    console.log("Checking columns for workspace_chat...");
    const res = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'workspace_chat'
  `);

    console.table(res.rows);
    process.exit(0);
}

main().catch(console.error);
