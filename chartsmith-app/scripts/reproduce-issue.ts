
import * as dotenv from 'dotenv';
import path from 'path';
import { createWorkspace, ChatMessageFromPersona } from '../lib/workspace/workspace';
import { Session } from '../lib/types/session';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const userId = '123456789012'; // Replace with actual user ID if needed, but for now using a dummy or the one found
    // Actually, let's use the one found in the previous step if possible, or just a hardcoded one that likely exists or create a new one?
    // The verification script output should have the ID.
    // For now, I'll use a placeholder and expect the user to replace it or I'll parse it from the output.
    // Wait, I can just query it here.

    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DB_URI });
    await client.connect();
    const userRes = await client.query('SELECT id FROM chartsmith_user LIMIT 1');
    await client.end();

    if (userRes.rows.length === 0) {
        console.error('No user found to test with.');
        process.exit(1);
    }

    const realUserId = userRes.rows[0].id;
    console.log(`Using user ID: ${realUserId}`);

    try {
        console.log('Attempting to create workspace...');
        const workspace = await createWorkspace(
            'prompt',
            realUserId,
            {
                prompt: 'test prompt',
                messageFromPersona: ChatMessageFromPersona.AUTO
            }
        );
        console.log('Workspace created successfully:', workspace);
    } catch (err) {
        console.error('Failed to create workspace:', err);
        // Log full error object
        console.dir(err, { depth: null });
    }
}

main();
