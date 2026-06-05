// Enable pg_cron extension via Supabase Management API
// then set up the daily cron schedule
const https = require('https');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef  = 'dfjxmnsozvmfhojnuikx';
const anonKey     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';
const functionUrl = `https://${projectRef}.supabase.co/functions/v1/daily-report`;

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.supabase.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Step 1: Enabling pg_cron extension...');
  const r1 = await apiRequest('POST', `/v1/projects/${projectRef}/database/extensions`, {
    name: 'pg_cron',
    schema: 'cron',
    version: null,
    cascade: true
  });
  console.log(`  Status: ${r1.status} → ${r1.body}`);

  console.log('\nStep 2: Enabling pg_net extension...');
  const r2 = await apiRequest('POST', `/v1/projects/${projectRef}/database/extensions`, {
    name: 'pg_net',
    schema: 'extensions',
    version: null,
    cascade: true
  });
  console.log(`  Status: ${r2.status} → ${r2.body}`);

  // Wait a moment for extensions to activate
  await new Promise(r => setTimeout(r, 3000));

  console.log('\nStep 3: Creating cron schedule...');
  const cronSql = `SELECT net.http_post(url:='${functionUrl}',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ${anonKey}'),body:='{}'::jsonb) AS request_id;`;
  const escapedCron = cronSql.replace(/'/g, "''");
  
  const sql = `SELECT cron.schedule('daily-financial-report', '0 21 * * *', '${escapedCron}');`;
  
  const r3 = await apiRequest('POST', `/v1/projects/${projectRef}/database/query`, { query: sql });
  console.log(`  Status: ${r3.status} → ${r3.body}`);

  if (r3.status === 200) {
    console.log('\n✅ pg_cron schedule created! Daily report will fire at 21:00 UTC (23:00 Madrid CEST)');
  } else {
    console.log('\n⚠️  Schedule creation may have failed. Check the Supabase Dashboard > Database > Extensions.');
  }

  console.log('\nStep 4: Verifying schedule exists...');
  const verifySql = `SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-financial-report';`;
  const r4 = await apiRequest('POST', `/v1/projects/${projectRef}/database/query`, { query: verifySql });
  console.log(`  Status: ${r4.status} → ${r4.body}`);
}

main().catch(console.error);
