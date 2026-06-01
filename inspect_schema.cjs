const { Client } = require('pg');

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to database.");

    // Query columns of the customers table
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND table_schema = 'public';
    `);
    
    console.log("Customers Table Columns:");
    console.log(columnsRes.rows);

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await client.end();
  }
}

run();
