// Visits to the live site from Caddy's access log on the VPS: page loads of the game and of the
// game page (/about/) per day, unique visitors, devices, where they came from.
//
// The log exists since 2026-10-17 (the `log` block in the site's Caddyfile entry, docs/PLATFORMS.md
// «PWA»); before that Caddy kept none. The BingePlay demo makes no network requests and only shows
// the address as text, so a visit from it is a typed URL: no Referer, a phone User-Agent.
//
// Usage: npm run stats:web               last 30 days
//        npm run stats:web -- --days 7
// Needs `ssh vps` to work, see ~/.ssh/config.

import { execFileSync } from 'node:child_process';

const HOST = process.env.DEPLOY_HOST ?? 'vps';
const SITE = 'spaceflight.p1gog.duckdns.org';
// Current log plus Caddy's rolled files (spaceflight-<time>.log, gzip from the second roll on).
const READ_LOGS = "docker exec caddy sh -c 'cd /data/logs && for f in spaceflight*.log*; do case $f in *.gz) zcat $f;; *) cat $f;; esac; done'";
const BOT = /bot|crawl|spider|slurp|preview|curl|wget|python|go-http|node|headless|lighthouse|scan|monitor|facebookexternalhit|claude-check/i;

const daysArg = process.argv.indexOf('--days');
const DAYS = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 30;
const since = Date.now() / 1000 - DAYS * 86400;

function device(ua) {
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'desktop';
}

function page(uri) {
  const path = uri.split('?')[0];
  if (path === '/' || path === '/index.html') return 'game';
  if (path === '/about/' || path === '/about/index.html') return 'about';
  return null;
}

let raw;
try {
  raw = execFileSync('ssh', [HOST, READ_LOGS], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
} catch (err) {
  console.error(`web-stats: can't read the log over ssh ${HOST}: ${err.message}`);
  process.exit(1);
}

const days = new Map(); // 'YYYY-MM-DD' → { game, about, ips: Set }
const devices = new Map();
const referrers = new Map();
const allIps = new Set();
let bots = 0;
for (const line of raw.split('\n')) {
  if (!line.startsWith('{')) continue;
  const entry = JSON.parse(line);
  const req = entry.request;
  if (!req || req.host !== SITE || entry.ts < since || req.method !== 'GET' || entry.status >= 400) continue;
  const kind = page(req.uri);
  if (!kind) continue;
  const ua = req.headers['User-Agent']?.[0] ?? '';
  if (BOT.test(ua)) {
    bots++;
    continue;
  }
  const day = new Date(entry.ts * 1000).toISOString().slice(0, 10);
  if (!days.has(day)) days.set(day, { game: 0, about: 0, ips: new Set() });
  const row = days.get(day);
  row[kind]++;
  row.ips.add(req.client_ip);
  allIps.add(req.client_ip);
  const dev = device(ua);
  devices.set(dev, (devices.get(dev) ?? 0) + 1);
  const ref = req.headers.Referer?.[0];
  const from = ref ? new URL(ref).host : '(typed / app / bookmark)';
  if (from !== SITE) referrers.set(from, (referrers.get(from) ?? 0) + 1);
}

const sorted = (map) => [...map].sort((a, b) => b[1] - a[1]);
console.log(`${SITE}, last ${DAYS} days (UTC; bots skipped: ${bots})\n`);
console.log('day          game  /about/  visitors');
for (const [day, row] of [...days].sort()) {
  console.log(`${day}  ${String(row.game).padStart(5)}  ${String(row.about).padStart(7)}  ${String(row.ips.size).padStart(8)}`);
}
console.log(`\nunique visitors: ${allIps.size}`);
console.log(`devices:  ${sorted(devices).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
console.log(`from:     ${sorted(referrers).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
