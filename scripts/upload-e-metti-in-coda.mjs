import { readFileSync } from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import https from 'https';

const EVENT_ID = '2673eaa3-3203-4bd2-999d-24676c1151b8';
const USER_ID = '084aafe1-76a2-47b9-8868-f7b0f6f03b4a';
const R2_ACCOUNT_ID = 'b9a899b504f215ad51c78896ca8be732';
const R2_ACCESS_KEY = '7b95799d78e59fe8b4e95aab30e53985';
const R2_SECRET = 'da39528dbb60a7f58a19bceb8f91e03ba0108faefc92790e68d4951060450520';
const R2_BUCKET = 'fotosposi-uploads';
const SUPABASE_URL = 'https://krgqyluuiltckmhbeuue.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyZ3F5bHV1aWx0Y2ttaGJldXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxOTk2NiwiZXhwIjoyMDk4Mzk1OTY2fQ.RVjy5rZh6LyY3w_s3BAePxyGVEoLI8y5iH4wzsNmxAk';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
});

function supFetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + path);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const fileBuffer = readFileSync('FOTO AGO/Gemini_Generated_Image_x96x8ax96x8ax96x.png');
  const ts = Date.now();
  const r2Key = `events/${EVENT_ID}/${ts}_Gemini_generated.png`;

  console.log('☁️  Upload a R2...');
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: r2Key, Body: fileBuffer, ContentType: 'image/png',
  }));
  console.log(`   key: ${r2Key}`);

  console.log('\n📝 Inserisco in upload_queue...');
  const result = await supFetch('POST', '/rest/v1/upload_queue', JSON.stringify({
    event_id: EVENT_ID,
    uploaded_by: USER_ID,
    file_name: 'Gemini_generated.png',
    file_type: 'image/png',
    file_size: fileBuffer.length,
    status: 'pending',
    compressed: false,
    r2_key: r2Key,
  }));
  console.log(`   id: ${Array.isArray(result) ? result[0]?.id : result?.id || 'OK'}`);

  console.log('\n✅ Fatto! Ora avvia il server e chiama:');
  console.log('   curl -X POST http://localhost:3000/api/r2/process-queue \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"eventId":"${EVENT_ID}"}'`);
}

main().catch(console.error);
