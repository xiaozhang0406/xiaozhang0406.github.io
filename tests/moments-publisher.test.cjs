'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GitHubPublisher, validateDocument, encodeBytes, checkImageBytes } = require('../source/js/moments-store');

const OWNER = 'xiaozhang0406';
const REPO = 'xiaozhang0406.github.io';
const PREFIX = `/repos/${OWNER}/${REPO}`;
const HEAD = '1'.repeat(40);
const NEW_HEAD = '2'.repeat(40);
const draft = { id: 'new-record', content: '一条中文随手记\n第二行 <script>文字</script>', createdAt: '2026-09-29T02:00:00.000Z' };
const oldEntry = { id: 'old-record', content: '已有内容', createdAt: '2026-09-28T02:00:00.000Z', images: [] };
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const upload = { mime: 'image/png', base64: encodeBytes(png), alt: '配图' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeGitHub({ conflict = false, lostResponse = false, login = OWNER, missingData = false } = {}) {
  let head = HEAD;
  let latest = { version: 1, entries: [oldEntry] };
  let treeCount = 0;
  let commitCount = 0;
  let blobCount = 0;
  let referenceCount = 0;
  const trees = new Map();
  const commits = new Map();
  const calls = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    const path = parsed.pathname;
    const body = options.body && JSON.parse(options.body);
    calls.push({ method: options.method, path, body });
    if (path === '/user') return response({ login });
    if (path === PREFIX) return response({ permissions: { push: true } });
    if (path === `${PREFIX}/git/ref/heads/main`) return response({ object: { sha: head } });
    if (path.startsWith(`${PREFIX}/git/commits/`)) return response({ tree: { sha: `tree-${head}` } });
    if (path === `${PREFIX}/contents/source/_data/moments.json`) {
      if (missingData) return response({}, 404);
      assert.equal(parsed.searchParams.get('ref'), head);
      return response({ encoding: 'base64', content: Buffer.from(JSON.stringify(latest)).toString('base64') });
    }
    if (path === `${PREFIX}/git/blobs`) { blobCount++; return response({ sha: `image-${blobCount}` }, 201); }
    if (path === `${PREFIX}/git/trees`) {
      treeCount++;
      assert.equal(body.base_tree, `tree-${head}`);
      assert.ok(body.tree.every(item => item.path === 'source/_data/moments.json' || item.path.startsWith('source/img/moments/')));
      const data = JSON.parse(body.tree.find(item => item.path === 'source/_data/moments.json').content);
      trees.set(`tree-created-${treeCount}`, data);
      return response({ sha: `tree-created-${treeCount}` }, 201);
    }
    if (path === `${PREFIX}/git/commits`) {
      commitCount++;
      assert.deepEqual(body.parents, [head]);
      const sha = String(commitCount + 3).repeat(40);
      commits.set(sha, trees.get(body.tree));
      return response({ sha }, 201);
    }
    if (path === `${PREFIX}/git/refs/heads/main`) {
      referenceCount++;
      assert.equal(body.force, false);
      if (conflict && referenceCount === 1) {
        head = NEW_HEAD;
        latest.entries.unshift({ id: 'concurrent-record', content: '另一个设备写下的内容', createdAt: '2026-09-29T01:00:00.000Z', images: [] });
        return response({}, 422);
      }
      head = body.sha;
      latest = commits.get(head);
      if (lostResponse && referenceCount === 1) throw new TypeError('simulated lost response');
      return response({ object: { sha: head } });
    }
    throw new Error(`Unexpected test route: ${options.method} ${path}`);
  };
  return { fetchImpl, calls, get latest() { return latest; }, get blobCount() { return blobCount; }, get referenceCount() { return referenceCount; } };
}

async function connectedClient(mock) {
  const client = new GitHubPublisher({ owner: OWNER, repo: REPO, fetchImpl: mock.fetchImpl });
  await client.connect('github_pat_FAKE_FOR_OFFLINE_TESTS');
  return client;
}

test('pure text is saved without image uploads and preserves existing Chinese content', async () => {
  const mock = fakeGitHub();
  const client = await connectedClient(mock);
  const result = await client.publish(draft);
  assert.match(result.sha, /^[0-9a-f]{40}$/);
  assert.equal(mock.blobCount, 0);
  assert.deepEqual(mock.latest.entries.map(item => item.id), ['new-record', 'old-record']);
  assert.equal(mock.latest.entries[0].content, draft.content);
  assert.equal(mock.latest.entries[0].createdAt, draft.createdAt);
  assert.equal(mock.referenceCount, 1);
});

test('text and images become visible in the same commit', async () => {
  const mock = fakeGitHub();
  const client = await connectedClient(mock);
  await client.publish(draft, [upload]);
  assert.equal(mock.blobCount, 1);
  assert.deepEqual(mock.latest.entries[0].images, [{ src: '/img/moments/new-record-1.png', alt: '配图' }]);
  const tree = mock.calls.find(call => call.path.endsWith('/git/trees')).body.tree;
  assert.deepEqual(tree.map(item => item.path), ['source/img/moments/new-record-1.png', 'source/_data/moments.json']);
  assert.equal(mock.referenceCount, 1);
});

test('an image-only record is allowed', async () => {
  const mock = fakeGitHub();
  await (await connectedClient(mock)).publish({ ...draft, content: '' }, [upload]);
  assert.equal(mock.latest.entries[0].content, '');
  assert.equal(mock.latest.entries[0].images.length, 1);
});

test('a concurrent branch update is merged without losing either record or re-uploading images', async () => {
  const mock = fakeGitHub({ conflict: true });
  await (await connectedClient(mock)).publish(draft, [upload]);
  assert.deepEqual(mock.latest.entries.map(item => item.id), ['new-record', 'concurrent-record', 'old-record']);
  assert.equal(mock.blobCount, 1);
  assert.equal(mock.referenceCount, 2);
});

test('a lost success response is recovered without duplicate publishing', async () => {
  const mock = fakeGitHub({ lostResponse: true });
  const client = await connectedClient(mock);
  const result = await client.publish(draft);
  assert.equal(result.recovered, true);
  assert.equal(mock.referenceCount, 1);
  const retry = await client.publish(draft);
  assert.equal(retry.recovered, true);
  assert.equal(mock.latest.entries.filter(item => item.id === draft.id).length, 1);
});

test('another GitHub account cannot connect and disconnect removes publishing access', async () => {
  const wrong = fakeGitHub({ login: 'another-owner' });
  const denied = new GitHubPublisher({ owner: OWNER, repo: REPO, fetchImpl: wrong.fetchImpl });
  await assert.rejects(denied.connect('github_pat_FAKE_FOR_OFFLINE_TESTS'), /账号/);
  assert.equal(denied.connected, false);
  const client = await connectedClient(fakeGitHub());
  assert.ok(!JSON.stringify(client).includes('FAKE_FOR_OFFLINE_TESTS'));
  client.disconnect();
  await assert.rejects(client.publish(draft), /先连接/);
});

test('an undeployed feature stops publishing before any remote files are changed', async () => {
  const mock = fakeGitHub({ missingData: true });
  await assert.rejects((await connectedClient(mock)).publish(draft, [upload]), /同步到 GitHub/);
  assert.equal(mock.calls.filter(call => call.method !== 'GET').length, 0);
});

test('invalid data, duplicate identifiers and non-image files are rejected', () => {
  assert.throws(() => validateDocument({ version: 1, entries: [{ ...oldEntry, createdAt: '2026-02-31T00:00:00.000Z' }] }), /时间/);
  assert.throws(() => validateDocument({ version: 1, entries: [oldEntry, oldEntry] }), /重复/);
  assert.throws(() => validateDocument({ version: 1, entries: [{ ...oldEntry, images: [{ src: 'javascript:alert(1)', alt: '' }] }] }), /图片/);
  assert.throws(() => validateDocument({ version: 1, entries: [{ ...oldEntry, content: '', images: [] }] }), /至少/);
  assert.throws(() => checkImageBytes(new TextEncoder().encode('<svg></svg>'), 'image/png'), /不符/);
  assert.throws(() => checkImageBytes(png, 'image/svg+xml'), /请选择/);
});
