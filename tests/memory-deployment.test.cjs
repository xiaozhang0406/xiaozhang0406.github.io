const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const crypto = require('node:crypto');
const matter = require('../memory-blog/node_modules/gray-matter');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const generated = JSON.parse(read('memory-blog/src/preview/content.generated.json'));

test('public article URLs and navigation paths load the production Memory build directly', () => {
  const routes = ['/', '/about/', '/archives/', '/link/', '/moments/', '/moments/edit/', '/categories/', '/tags/', ...generated.articles.map(article => '/posts/' + article.id + '/')];
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

test('all published bodies and moments survive migration while hidden notes have no public routes', () => {
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
  assert.deepEqual(generated.moments, JSON.parse(read('source/_data/moments.json')).entries);
});

test('the editor uses the current publishing script with a new URL when its content changes', () => {
  const expected = read('source/js/moments-editor-v2.js').replace(/\r\n/g, '\n');
  const hash = crypto.createHash('sha256').update(expected).digest('hex').slice(0, 16);
  assert.equal(generated.editorScript, '/js/moments-editor.' + hash + '.js');
  assert.equal(read('public' + generated.editorScript), expected);
  assert.ok(fs.existsSync(path.join(root, 'public/img/avatar.png')));
});
