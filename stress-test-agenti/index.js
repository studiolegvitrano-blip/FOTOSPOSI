// stress-test-agenti/index.js
// Orchestratore: parse CLI, fan-out N agenti concorrenti, raccoglie metriche

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const argv = require('minimist')(process.argv.slice(2));

const BASE_URL = argv.url || process.env.STRESS_BASE_URL || 'http://localhost:3000';
const AGENTS = parseInt(argv.agents || '5', 10);
const PHOTOS = parseInt(argv.photos || '3', 10);
const VIDEOS = parseInt(argv.videos || '1', 10);
const HEADLESS = !(argv.headed || false);

function ensureDirs() {
  ['reports', 'logs'].forEach((d) => {
    const p = path.join(__dirname, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

function makeEmail() {
  return `stress+${crypto.randomUUID()}@example.test`;
}

async function main() {
  ensureDirs();
  const eventStartTime = Date.now();
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logPath = path.join(__dirname, 'logs', `run-${runStamp}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log('=== Sposi.live Stress Test ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Agents: ${AGENTS} (headless=${HEADLESS})`);
  console.log(`Per-agent: ${PHOTOS} foto + ${VIDEOS} video`);
  console.log('');

  const agentModule = require('./agent');
  const browser = await chromium.launch({ headless: HEADLESS });
  const results = await Promise.allSettled(
    Array.from({ length: AGENTS }, (_, i) =>
      agentModule.runAgent({ browser, index: i, baseUrl: BASE_URL, photos: PHOTOS, videos: VIDEOS, logStream, email: makeEmail() })
    )
  );

  const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const errCount = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
  const latencies = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value.durationMs)
    .sort((a, b) => a - b);

  const p = (q) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] : 0);

  const summary = {
    runStamp,
    baseUrl: BASE_URL,
    agents: AGENTS,
    photosPerAgent: PHOTOS,
    videosPerAgent: VIDEOS,
    success: okCount,
    failure: errCount,
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    totalDurationMs: Date.now() - eventStartTime,
  };
  fs.writeFileSync(
    path.join(__dirname, 'reports', `run-${runStamp}.json`),
    JSON.stringify(summary, null, 2)
  );

  console.log('');
  console.log('=== Risultati ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Log completo: ${logPath}`);

  await browser.close();
}

main().catch((e) => {
  console.error('Errore fatale:', e);
  process.exit(1);
});
