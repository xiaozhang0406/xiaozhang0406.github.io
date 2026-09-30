const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function editor() {
  const elements = new Map(), windowEvents = new Map(), requests = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', dataset: {}, hidden: false, disabled: false,
      classList: { toggle() {} }, replaceChildren() {},
      events: new Map(),
      addEventListener(name, callback) { this.events.set(name, callback); }
    });
    return elements.get(id);
  }
  const root = { dataset: { api: 'https://planner.yarinaoshi.top/moments-api' } };
  const context = {
    document: {
      querySelector: () => root,
      getElementById: id => element(id.replace('moments-', ''))
    },
    window: { addEventListener: (name, callback) => windowEvents.set(name, callback) },
    location: { origin: 'https://yarinaoshi.top', hostname: 'yarinaoshi.top' },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ authenticated: true, login: 'xiaozhang0406' }) };
    },
    Intl, Date, URL
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../source/js/moments-editor-v2.js'), 'utf8'), context);
  return { element, windowEvents, requests };
}

test('login is detected when the script loads after the page lifecycle event', async () => {
  const app = editor();
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 1);
  assert.match(app.requests[0].url, /^https:\/\/planner\.yarinaoshi\.top\/moments-api\/session\?check=\d+$/);
  assert.equal(app.requests[0].options.credentials, 'include');
  assert.equal(app.element('account').textContent, '已登录 GitHub：xiaozhang0406');
  assert.equal(app.element('login-panel').hidden, true);
  assert.equal(app.element('publish').disabled, true);
  app.element('content').value = '登录后的草稿';
  app.element('content').events.get('input')();
  assert.equal(app.element('publish').disabled, false);
});

test('only a message from the login service refreshes the session', async () => {
  const app = editor();
  await new Promise(setImmediate);
  const message = app.windowEvents.get('message');
  message({ origin: 'https://evil.example', data: { source: 'moments-auth', ok: true } });
  assert.equal(app.requests.length, 1);
  app.element('content').value = '保留这段草稿';
  message({ origin: 'https://planner.yarinaoshi.top', data: { source: 'moments-auth', ok: true } });
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 2);
  assert.equal(app.element('content').value, '保留这段草稿');
  assert.equal(app.element('publish').disabled, false);
});

test('login failure displays the service message and preserves the draft', async () => {
  const app = editor();
  await new Promise(setImmediate);
  app.element('content').value = '尚未发布的草稿';
  app.windowEvents.get('message')({
    origin: 'https://planner.yarinaoshi.top',
    data: { source: 'moments-auth', ok: false, error: '连接 GitHub 暂时失败，请重新登录。' }
  });
  assert.equal(app.element('status').textContent, '连接 GitHub 暂时失败，请重新登录。');
  assert.equal(app.element('content').value, '尚未发布的草稿');
  assert.equal(app.requests.length, 1);
});
