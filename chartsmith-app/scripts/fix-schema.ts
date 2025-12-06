
import pg from 'pg';
const { Client } = pg;
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const uri = process.env.CHARTSMITH_PG_URI || process.env.DB_URI;
    if (!uri) {
        console.error('No database URI found in environment variables.');
        process.exit(1);
    }

    console.log('Connecting to database...');
    const client = new Client({ connectionString: uri });

    try {
        await client.connect();
        console.log('Connected successfully.');

        // 1. Add is_admin to chartsmith_user
        console.log('Checking for is_admin column in chartsmith_user...');
        const checkColumnRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'chartsmith_user' 
      AND column_name = 'is_admin'
    `);

        if (checkColumnRes.rows.length === 0) {
            console.log('Adding is_admin column to chartsmith_user...');
            await client.query(`ALTER TABLE chartsmith_user ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`);
            console.log('Column added.');
        } else {
            console.log('is_admin column already exists.');
        }

        // 2. Create waitlist table
        console.log('Checking for waitlist table...');
        const checkTableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'waitlist'
    `);

        if (checkTableRes.rows.length === 0) {
            console.log('Creating waitlist table...');
            await client.query(`
        CREATE TABLE waitlist (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE,
          last_active_at TIMESTAMP WITH TIME ZONE
        )
      `);
            console.log('Table created.');
        } else {
            console.log('waitlist table already exists.');
        }

        // 3. Add unique constraint to chartsmith_user.email
        console.log('Checking for unique constraint on chartsmith_user.email...');
        const checkConstraintRes = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'chartsmith_user'::regclass 
      AND contype = 'u' 
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'chartsmith_user'::regclass AND attname = 'email')]
    `);

        if (checkConstraintRes.rows.length === 0) {
            console.log('Adding unique constraint to chartsmith_user.email...');
            await client.query(`ALTER TABLE chartsmith_user ADD CONSTRAINT chartsmith_user_email_key UNIQUE (email)`);
            console.log('Constraint added.');
        } else {
            console.log('Unique constraint on email already exists.');
        }

        // 4. Create chartsmith_user_setting table
        console.log('Checking for chartsmith_user_setting table...');
        const checkSettingsTableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'chartsmith_user_setting'
    `);

        if (checkSettingsTableRes.rows.length === 0) {
            console.log('Creating chartsmith_user_setting table...');
            await client.query(`
        CREATE TABLE chartsmith_user_setting (
          user_id TEXT NOT NULL REFERENCES chartsmith_user(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value TEXT,
          PRIMARY KEY (user_id, key)
        )
      `);
            console.log('Table created.');
        } else {
            console.log('chartsmith_user_setting table already exists.');
        }

        // 5. Populate bootstrap_workspace
        console.log('Checking bootstrap_workspace...');
        const checkBootstrapWorkspaceRes = await client.query(`SELECT id FROM bootstrap_workspace WHERE name = 'default-workspace'`);
        if (checkBootstrapWorkspaceRes.rows.length === 0) {
            console.log('Inserting default-workspace into bootstrap_workspace...');
            await client.query(`
        INSERT INTO bootstrap_workspace (id, name, current_revision) 
        VALUES ('default-id', 'default-workspace', 0)
      `);
            console.log('Inserted default-workspace.');
        } else {
            console.log('default-workspace already exists.');
        }

        // 6. Populate bootstrap_chart
        console.log('Checking bootstrap_chart...');
        const checkBootstrapChartRes = await client.query(`SELECT id FROM bootstrap_chart WHERE name = 'nginx'`);
        let chartId = 'chart-id';
        if (checkBootstrapChartRes.rows.length === 0) {
            console.log('Inserting nginx chart into bootstrap_chart...');
            await client.query(`
        INSERT INTO bootstrap_chart (id, name, workspace_id) 
        VALUES ($1, 'nginx', 'default-id')
      `, [chartId]);
            console.log('Inserted nginx chart.');
        } else {
            console.log('nginx chart already exists.');
            chartId = checkBootstrapChartRes.rows[0].id;
        }

        // 7. Populate bootstrap_file
        console.log('Checking bootstrap_file...');
        const checkBootstrapFileRes = await client.query(`SELECT id FROM bootstrap_file WHERE chart_id = $1`, [chartId]);
        if (checkBootstrapFileRes.rows.length === 0) {
            console.log('Inserting dummy file into bootstrap_file...');
            await client.query(`
        INSERT INTO bootstrap_file (id, chart_id, workspace_id, file_path, content, embeddings) 
        VALUES ('file-id', $1, 'default-id', 'values.yaml', 'image:\n  repository: nginx\n  tag: latest', null)
      `, [chartId]);
            console.log('Inserted dummy file.');
        } else {
            console.log('Bootstrap files already exist.');
        }

        // 8. Add is_rendered to workspace_revision
        console.log('Checking for is_rendered column in workspace_revision...');
        const checkRevisionColumnRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_revision' 
          AND column_name = 'is_rendered'
        `);

        if (checkRevisionColumnRes.rows.length === 0) {
            console.log('Adding is_rendered column to workspace_revision...');
            await client.query(`ALTER TABLE workspace_revision ADD COLUMN is_rendered BOOLEAN DEFAULT FALSE`);
            console.log('Column added.');
        } else {
            console.log('is_rendered column already exists.');
        }

        // 9. Add missing columns to workspace_chat
        const chatColumnsToAdd = [
            { name: 'is_canceled', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'is_intent_render', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'followup_actions', type: 'JSONB' },
            { name: 'response_render_id', type: 'TEXT' },
            { name: 'response_plan_id', type: 'TEXT' },
            { name: 'response_conversion_id', type: 'TEXT' },
            { name: 'response_rollback_to_revision_number', type: 'INTEGER' },
            { name: 'message_from_persona', type: 'TEXT' }
        ];

        console.log('Checking for missing columns in workspace_chat...');
        for (const col of chatColumnsToAdd) {
            const checkChatColRes = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'workspace_chat' 
                AND column_name = $1
            `, [col.name]);

            if (checkChatColRes.rows.length === 0) {
                console.log(`Adding ${col.name} column to workspace_chat...`);
                await client.query(`ALTER TABLE workspace_chat ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Column ${col.name} added.`);
            } else {
                console.log(`Column ${col.name} already exists.`);
            }
        }

        // 10. Create work_queue table
        console.log('Checking for work_queue table...');
        const checkQueueTableRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'work_queue'
        `);

        if (checkQueueTableRes.rows.length === 0) {
            console.log('Creating work_queue table...');
            await client.query(`
            CREATE TABLE work_queue (
              id TEXT PRIMARY KEY,
              channel TEXT NOT NULL,
              payload JSONB,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
          `);
            console.log('Table created.');
        } else {
            console.log('work_queue table already exists.');
        }

        // 11. Add content_pending to workspace_file
        console.log('Checking for content_pending column in workspace_file...');
        const checkFileColRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_file' 
          AND column_name = 'content_pending'
        `);

        if (checkFileColRes.rows.length === 0) {
            console.log('Adding content_pending column to workspace_file...');
            await client.query(`ALTER TABLE workspace_file ADD COLUMN content_pending TEXT`);
            console.log('Column added.');
        } else {
            console.log('content_pending column already exists.');
        }

        // 12. Add proceed_at to workspace_plan
        console.log('Checking for proceed_at column in workspace_plan...');
        const checkPlanColRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_plan' 
          AND column_name = 'proceed_at'
        `);

        if (checkPlanColRes.rows.length === 0) {
            console.log('Adding proceed_at column to workspace_plan...');
            await client.query(`ALTER TABLE workspace_plan ADD COLUMN proceed_at TIMESTAMP WITH TIME ZONE`);
            console.log('Column added.');
        } else {
            console.log('proceed_at column already exists.');
        }

        // 13. Create workspace_rendered table
        console.log('Checking for workspace_rendered table...');
        const checkRenderedTableRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_rendered'
        `);

        if (checkRenderedTableRes.rows.length === 0) {
            console.log('Creating workspace_rendered table...');
            await client.query(`
            CREATE TABLE workspace_rendered (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              revision_number INTEGER NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              completed_at TIMESTAMP WITH TIME ZONE,
              is_autorender BOOLEAN DEFAULT FALSE
            )
          `);
            console.log('Table created.');
        } else {
            console.log('workspace_rendered table already exists.');
        }

        // 14. Create/Update workspace_rendered_chart table
        console.log('Checking for workspace_rendered_chart table...');
        const checkRenderedChartTableRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_rendered_chart'
        `);

        if (checkRenderedChartTableRes.rows.length === 0) {
            console.log('Creating workspace_rendered_chart table...');
            await client.query(`
                CREATE TABLE workspace_rendered_chart (
                  id TEXT PRIMARY KEY,
                  chart_id TEXT NOT NULL,
                  workspace_render_id TEXT NOT NULL,
                  is_success BOOLEAN,
                  dep_update_command TEXT,
                  dep_update_stdout TEXT,
                  dep_update_stderr TEXT,
                  helm_template_command TEXT,
                  helm_template_stdout TEXT,
                  helm_template_stderr TEXT,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                  completed_at TIMESTAMP WITH TIME ZONE
                )
             `);
            console.log('Table created.');
        } else {
            console.log('workspace_rendered_chart table exists, checking for missing columns...');
            const renderedChartColumns = [
                { name: 'id', type: 'TEXT' },
                { name: 'workspace_render_id', type: 'TEXT' },
                { name: 'dep_update_command', type: 'TEXT' },
                { name: 'dep_update_stdout', type: 'TEXT' },
                { name: 'dep_update_stderr', type: 'TEXT' },
                { name: 'helm_template_command', type: 'TEXT' },
                { name: 'helm_template_stdout', type: 'TEXT' },
                { name: 'helm_template_stderr', type: 'TEXT' },
                { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
                { name: 'completed_at', type: 'TIMESTAMP WITH TIME ZONE' }
            ];

            for (const col of renderedChartColumns) {
                const checkColRes = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'workspace_rendered_chart' 
                    AND column_name = $1
                `, [col.name]);

                if (checkColRes.rows.length === 0) {
                    console.log(`Adding ${col.name} column to workspace_rendered_chart...`);
                    await client.query(`ALTER TABLE workspace_rendered_chart ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Column ${col.name} added.`);
                }
            }
        }

        // 15. Create workspace_rendered_file table
        console.log('Checking for workspace_rendered_file table...');
        const checkRenderedFileTableRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'workspace_rendered_file'
        `);

        if (checkRenderedFileTableRes.rows.length === 0) {
            console.log('Creating workspace_rendered_file table...');
            await client.query(`
            CREATE TABLE workspace_rendered_file (
              file_id TEXT NOT NULL,
              workspace_id TEXT NOT NULL,
              revision_number INTEGER NOT NULL,
              content TEXT,
              PRIMARY KEY (file_id, workspace_id, revision_number)
            )
          `);
            console.log('Table created.');
        } else {
            console.log('workspace_rendered_file table already exists.');
        }

        // 16. Create content_cache table
        console.log('Checking for content_cache table...');
        const checkCacheTableRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'content_cache'
        `);

        if (checkCacheTableRes.rows.length === 0) {
            console.log('Creating content_cache table...');
            // Ensure vector extension exists
            try {
                await client.query('CREATE EXTENSION IF NOT EXISTS vector');
            } catch (e) {
                console.log('Could not create vector extension, assume it exists or not needed if using text');
            }

            await client.query(`
            CREATE TABLE content_cache (
              content_sha256 TEXT PRIMARY KEY,
              embeddings vector(1536)
            )
          `);
            console.log('Table created.');
        } else {
            console.log('content_cache table already exists.');
        }
    } catch (err) {
        console.error('Error applying schema fixes:', err);
    } finally {
        await client.end();
    }
}

main();
