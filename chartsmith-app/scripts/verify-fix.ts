
import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Client } = pg;

async function main() {
    const uri = process.env.DB_URI;
    if (!uri) {
        console.error("No DB_URI");
        process.exit(1);
    }
    const client = new Client({ connectionString: uri });
    try {
        await client.connect();
        const res = await client.query("SELECT to_regclass('public.content_cache')");
        if (res.rows[0].to_regclass) {
            console.log("Table content_cache EXISTS");

            // Try to look at columns
            const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'content_cache'");
            console.log("Columns:", cols.rows.map(r => `${r.column_name}(${r.data_type})`).join(", "));

            // Try inserting a dummy value if vector extension works
            // We need to match the vector dimension 1536
            // We'll just verify the column type is correct first.
        } else {
            console.log("Table content_cache DOES NOT EXIST");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}
main();
