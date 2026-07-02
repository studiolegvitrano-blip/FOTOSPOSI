import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const cfg = {
  accountId: 'b9a899b504f215ad51c78896ca8be732',
  accessKeyId: '7b95799d78e59fe8b4e95aab30e53985',
  secretAccessKey: 'da39528dbb60a7f58a19bceb8f91e03ba0108faefc92790e68d4951060450520',
  bucket: 'fotosposi-uploads',
};

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
});

const testKey = `_test/hello_${Date.now()}.txt`;

try {
  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: testKey,
    Body: 'Ciao R2!',
    ContentType: 'text/plain',
  }));
  console.log('Upload OK:', testKey);

  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: testKey }));
  console.log('Delete OK');

  console.log('\n R2 funzionante!');
} catch (e) {
  console.error(' ERR:', e.name, '-', e.message);
  if (e.$metadata) console.error('StatusCode:', e.$metadata.httpStatusCode);
}
