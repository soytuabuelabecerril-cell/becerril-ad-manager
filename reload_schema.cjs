// reload_schema.cjs
const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: 'aws-0-eu-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to eu-west-2 database.");

    console.log("Notifying PostgREST to reload schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✅ Schema reload notification sent successfully!");
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
