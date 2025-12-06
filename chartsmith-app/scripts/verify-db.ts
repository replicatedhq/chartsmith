
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

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log('Tables in public schema:');
    res.rows.forEach(row => console.log(`- ${row.table_name}`));

    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'chartsmith_user'
    `);
    console.log('\nColumns in chartsmith_user:');
    columnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'chartsmith_user'::regclass
    `);
    console.log('\nConstraints on chartsmith_user:');
    constraintsRes.rows.forEach(row => console.log(`- ${row.conname}: ${row.def}`));

    const settingsColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'chartsmith_user_setting'
    `);
    console.log('\nColumns in chartsmith_user_setting:');
    settingsColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const settingsConstraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'chartsmith_user_setting'::regclass
    `);
    console.log('\nConstraints on chartsmith_user_setting:');
    settingsConstraintsRes.rows.forEach(row => console.log(`- ${row.conname}: ${row.def}`));

    const workspaceColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace'
    `);
    console.log('\nColumns in workspace:');
    workspaceColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspaceConstraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'workspace'::regclass
    `);
    console.log('\nConstraints on workspace:');
    workspaceConstraintsRes.rows.forEach(row => console.log(`- ${row.conname}: ${row.def}`));

    // Check columns of workspace_rendered_chart
    console.log("\nColumns in workspace_rendered_chart:");
    const workspaceRenderedChartColumnsCheckRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workspace_rendered_chart'
    `);
    console.table(workspaceRenderedChartColumnsCheckRes.rows);

    // Check workspace_scenario
    console.log("\nColumns in workspace_scenario:");
    const workspaceScenarioColumnsCheckRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workspace_scenario'
    `);
    console.table(workspaceScenarioColumnsCheckRes.rows);

    const workspaceScenarioRes = await client.query(`SELECT * FROM workspace_scenario LIMIT 5`);
    console.log("Rows in workspace_scenario:", JSON.stringify(workspaceScenarioRes.rows));

    const bootstrapRes = await client.query(`
      SELECT * FROM bootstrap_workspace
    `);
    console.log('\nRows in bootstrap_workspace:');
    bootstrapRes.rows.forEach(row => console.log(`- ${JSON.stringify(row)}`));

    const bootstrapChartColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bootstrap_chart'
    `);
    console.log('\nColumns in bootstrap_chart:');
    bootstrapChartColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const bootstrapChartRes = await client.query(`
      SELECT * FROM bootstrap_chart
    `);
    console.log('\nRows in bootstrap_chart:');
    bootstrapChartRes.rows.forEach(row => console.log(`- ${JSON.stringify(row)}`));

    const bootstrapFileColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bootstrap_file'
    `);
    console.log('\nColumns in bootstrap_file:');
    bootstrapFileColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const bootstrapFileRes = await client.query(`
      SELECT * FROM bootstrap_file
    `);
    console.log('\nRows in bootstrap_file:');
    bootstrapFileRes.rows.forEach(row => console.log(`- ${JSON.stringify(row)}`));

    const workspaceRevisionColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_revision'
    `);
    console.log('\nColumns in workspace_revision:');
    workspaceRevisionColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspaceChatColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_chat'
    `);
    console.log('\nColumns in workspace_chat:');
    workspaceChatColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const queueTableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'work_queue'
    `);
    if (queueTableRes.rows.length > 0) {
      console.log('\nwork_queue table exists.');
    } else {
      console.log('\nwork_queue table does NOT exist.');
    }

    const workspaceFileColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_file'
    `);
    console.log('\nColumns in workspace_file:');
    workspaceFileColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspacePlanColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_plan'
    `);
    console.log('\nColumns in workspace_plan:');
    workspacePlanColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspacePlanActionFileColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_plan_action_file'
    `);
    console.log('\nColumns in workspace_plan_action_file:');
    workspacePlanActionFileColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspaceRenderedColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_rendered'
    `);
    console.log('\nColumns in workspace_rendered:');
    workspaceRenderedColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspaceRenderedChartColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_rendered_chart'
    `);
    console.log('\nColumns in workspace_rendered_chart:');
    workspaceRenderedChartColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const workspaceRenderedFileColumnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'workspace_rendered_file'
    `);
    console.log('\nColumns in workspace_rendered_file:');
    workspaceRenderedFileColumnsRes.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    const userRes = await client.query(`SELECT id FROM chartsmith_user LIMIT 1`);
    if (userRes.rows.length > 0) {
      console.log(`\nValid User ID: ${userRes.rows[0].id}`);
    } else {
      console.log('\nNo users found in chartsmith_user.');
    }

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
