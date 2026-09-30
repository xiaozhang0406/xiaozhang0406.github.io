'use strict';

const moment = require('moment-timezone');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateDocument } = require('../source/js/moments-store');

function editorAsset() {
  const data = fs.readFileSync(path.join(hexo.base_dir, 'source/js/moments-editor-v2.js'), 'utf8').replace(/\r\n/g, '\n');
  const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  return { path: 'js/moments-editor.' + hash + '.js', data };
}

// The CDN ignores query strings and serves JS as immutable for a year.
hexo.extend.helper.register('moments_editor_script', () => '/' + editorAsset().path);
hexo.extend.generator.register('moments-editor-script', editorAsset);

hexo.extend.helper.register('moments_data', function (data) {
  const document = validateDocument(data);
  return document.entries.map(entry => {
    const date = moment.parseZone(entry.createdAt).tz('Asia/Shanghai');
    return {
      ...entry,
      displayDate: date.format('YYYY-MM-DD HH:mm'),
      month: date.format('YYYY 年 M 月')
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});
