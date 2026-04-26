/**
 * CF Pages direct upload script — production site.
 *
 * 1. GET upload-token → JWT
 * 2. POST upsert-hashes → which hashes CF need
 * 3. POST pages/assets/upload → JSON array of {key, value(base64), metadata, base64}
 * 4. POST deployments → {manifest: {"/path": hash}}
 *
 * No _worker.bundle — this is the public docs site with no password gate.
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const ACCOUNT_ID   = 'c079896280a6ebb1d769f755ec4510f7';
const PROJECT_NAME = 'nexlayer-better-docs-elizaga';
const API_TOKEN    = process.env.CF_API_TOKEN;
const CF_API       = 'https://api.cloudflare.com/client/v4';

if (!API_TOKEN) {
  console.error('Missing CF_API_TOKEN env var');
  process.exit(1);
}

const PROJECT_DIR  = '/Users/jay/Home/projects/active/nexlayer-better-docs';

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
};

const FILE_PATHS = [
  'index.html',
  'style.css',
];

function sha256_32(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 32);
}

function getMime(path) {
  for (const [ext, mime] of Object.entries(MIME)) {
    if (path.endsWith(ext)) return mime;
  }
  return 'application/octet-stream';
}

async function cfFetch(path, opts = {}, useJwt = null) {
  const token = useJwt || API_TOKEN;
  const res = await fetch(`${CF_API}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`); }
  if (!data.success) throw new Error(`API error: ${JSON.stringify(data.errors || data)}`);
  return data;
}

async function main() {
  console.log(`Deploying ${PROJECT_NAME}...`);

  const files = FILE_PATHS.map(relPath => {
    const content = readFileSync(join(PROJECT_DIR, relPath));
    return {
      urlPath:     '/' + relPath,
      content,
      hash:        sha256_32(content),
      contentType: getMime(relPath),
    };
  });

  for (const f of files) {
    console.log(`  ${f.urlPath}  →  ${f.hash}  (${f.content.length} bytes)`);
  }

  // Step 1: Get JWT
  const tokenData = await cfFetch(
    `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`,
    { method: 'GET' }
  );
  const jwt = tokenData.result.jwt;
  console.log('\n[1/4] Got upload JWT');

  // Step 2: Upsert hashes
  const upsertData = await cfFetch('/pages/assets/upsert-hashes', {
    method: 'POST',
    body: JSON.stringify({ hashes: files.map(f => f.hash) }),
  }, jwt);
  const missing = new Set(
    upsertData.result && Array.isArray(upsertData.result)
      ? upsertData.result
      : files.map(f => f.hash)
  );
  console.log(`[2/4] ${missing.size} file(s) need uploading`);

  // Step 3: Upload missing files
  const toUpload = files.filter(f => missing.has(f.hash));
  const BATCH = 3;
  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH);
    const payload = batch.map(f => ({
      key:      f.hash,
      value:    f.content.toString('base64'),
      metadata: { contentType: f.contentType },
      base64:   true,
    }));
    await cfFetch('/pages/assets/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, jwt);
    console.log(`[3/4] Uploaded: ${batch.map(f => f.urlPath).join(', ')}`);
  }
  if (toUpload.length === 0) {
    console.log('[3/4] All files already cached');
  }

  // Step 4: Create deployment
  const manifest = {};
  for (const f of files) manifest[f.urlPath] = f.hash;
  console.log('\nManifest:', JSON.stringify(manifest, null, 2));

  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest));
  form.append('branch', 'main');

  const res = await fetch(
    `${CF_API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: form,
    }
  );
  const text = await res.text();
  let deployData;
  try { deployData = JSON.parse(text); } catch { throw new Error(`Deploy response not JSON (${res.status}): ${text.slice(0,300)}`); }
  if (!deployData.success) throw new Error(`Deploy failed: ${JSON.stringify(deployData.errors || deployData)}`);

  const d = deployData.result;
  console.log(`\n[4/4] Deployment created: ${d.id}`);
  console.log(`      URL: ${d.url}`);
  console.log('\nDone! Live in ~30s at https://nexlayer-better-docs.elizaga.dev/');
}

main().catch(err => { console.error('\nFAILED:', err.message); process.exit(1); });
