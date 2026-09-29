'use strict';

const moment = require('moment-timezone');
const { validateDocument } = require('../source/js/moments-store');

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
