const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const matter = require('../memory-blog/node_modules/gray-matter');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const generated = JSON.parse(read('memory-blog/src/preview/content.generated.json'));

test('public article URLs and navigation paths load the production Memory build directly', () => {
  const routes = ['/', '/about/', '/archives/', '/link/', '/categories/', '/tags/', ...generated.articles.map(article => '/posts/' + article.id + '/')];
  for (const route of routes) {
    const html = read('public' + route + 'index.html');
    assert.ok(html.includes('id="root"'), route);
    assert.match(html, /src="\/assets\/[^" ]+\.js"/, route);
    assert.ok(!html.includes('yarinaoshi-memory-preview'), route);
    assert.ok(!html.includes('noindex'), route);
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) assert.ok(fs.existsSync(path.join(root, 'public', asset)), asset);
  }
  assert.equal(read('public/CNAME').trim(), 'yarinaoshi.top');
});

test('all published bodies survive migration while hidden notes have no public routes', () => {
  for (const file of fs.readdirSync(path.join(root, 'source/_posts'))) {
    if (!file.endsWith('.md')) continue;
    const post = matter(read('source/_posts/' + file));
    const id = file.slice(0, -3);
    const article = generated.articles.find(item => item.id === id);
    if (post.data.published === false || post.data.draft === true) {
      assert.equal(article, undefined);
      assert.ok(!fs.existsSync(path.join(root, 'public/posts', id)), id);
    } else assert.equal(article.content, post.content);
  }
});

test('retired moments pages, data, and publishing scripts are not deployed', () => {
  assert.ok(!fs.existsSync(path.join(root, 'public/moments')));
  assert.ok(!fs.existsSync(path.join(root, 'public/talk')));
  assert.ok(!read('public/sitemap.xml').includes('/moments/'));
  assert.ok(!Object.hasOwn(generated, 'moments'));
  assert.ok(!fs.readdirSync(path.join(root, 'public/js')).some(file => file.startsWith('moments')));
  assert.ok(fs.existsSync(path.join(root, 'public/img/avatar.png')));
});
