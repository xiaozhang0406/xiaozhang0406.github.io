import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const generated = JSON.parse(await readFile(path.join(appRoot, 'src/preview/content.generated.json'), 'utf8'));
const postRoot = path.join(appRoot, '../source/_posts');
const hiddenIds = [];
const expected = [];
for (const file of await readdir(postRoot)) {
  if (!file.endsWith('.md')) continue;
  const parsed = matter(await readFile(path.join(postRoot, file), 'utf8'));
  const id = file.slice(0, -3);
  if (parsed.data.published === false || parsed.data.draft === true) hiddenIds.push(id);
  else expected.push(id);
}
assert.deepEqual(generated.articles.map(article => article.id).sort(), expected.sort());
for (const id of hiddenIds) assert.ok(!generated.articles.some(article => article.id === id));
assert.equal(generated.site.name, 'Yarinaoshi');
assert.equal(generated.site.github, 'https://github.com/xiaozhang0406');
assert.equal(generated.site.email, 'xiaozhang0406@proton.me');
assert.equal(generated.friends.length, 3);
assert.equal(generated.moments.length, JSON.parse(await readFile(path.join(appRoot, '../source/_data/moments.json'), 'utf8')).entries.length);
const originalReview = matter(await readFile(path.join(postRoot, '2026-7-31-A-surver-command.md'), 'utf8')).content;
assert.equal(generated.articles.find(article => article.id === '2026-7-31-A-surver-command').content, originalReview);
assert.ok(originalReview.includes('<details>'));
const index = await readFile(path.join(appRoot, 'dist/index.html'), 'utf8');
assert.ok(index.includes('lang="zh-CN"'));
assert.ok(!index.includes('/src/preview-main.tsx'));
assert.ok(index.includes('index, follow'));
assert.ok(!index.includes('noindex'));
assert.match(generated.editorScript, /^\/js\/moments-editor\.[a-f0-9]{16}\.js$/);
assert.ok(!index.includes('http://127.0.0.1:8080'));
const library = JSON.parse(await readFile(path.join(appRoot, 'image-library.json'), 'utf8'));
const imageHashes = new Set();
for (const image of library.images) {
  const bytes = await readFile(path.join(appRoot, 'dist', image.src));
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.ok(!imageHashes.has(hash), `Duplicate picture in library: ${image.id}`);
  imageHashes.add(hash);
}
const homepagePictures = [generated.imagery.backgrounds.home, generated.imagery.featured, ...generated.articles.map(article => article.cover)];
if (generated.articles.length <= library.coverPool.length) {
  assert.equal(new Set(homepagePictures).size, homepagePictures.length, 'Homepage background, featured image and article covers must differ while the pool has enough pictures');
}
console.log(`Content checks passed: ${expected.length} public articles, ${hiddenIds.length} hidden posts excluded, original review preserved, profile and production entry verified.`);
console.log(`Image checks passed: ${library.images.length} distinct local pictures; homepage slots use different pictures.`);
