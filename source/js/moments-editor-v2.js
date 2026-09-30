(() => {
  'use strict';
  const root = document.querySelector('.moments-editor');
  if (!root) return;
  const api = root.dataset.api;
  const find = id => document.getElementById('moments-' + id);
  const content = find('content'), fileInput = find('images'), publishButton = find('publish');
  let attachments = [], draft = null, login = null, busy = false, selecting = false;
  const maxImages = 9, maxImageBytes = 8 * 1024 * 1024, maxTotalBytes = 32 * 1024 * 1024;
  const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const formatTime = date => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);

  function status(message, state = 'info') {
    const element = find('status');
    element.hidden = !message;
    element.dataset.state = state;
    element.textContent = message;
  }
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(api + path, {
        credentials: 'include', cache: 'no-store', ...options,
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined
      });
    } catch { throw new Error('暂时无法连接发布服务，请稍后重试。'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '发布服务暂时不可用，请稍后重试。');
    return data;
  }
  function validImage(bytes, mime) {
    const head = Array.from(bytes.subarray(0, 12));
    const text = String.fromCharCode(...head);
    return mime === 'image/jpeg' ? head[0] === 255 && head[1] === 216 && head[2] === 255 :
      mime === 'image/png' ? head.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' :
      mime === 'image/gif' ? /^(GIF87a|GIF89a)/.test(text) : /^RIFF....WEBP/.test(text);
  }
  function update() {
    const text = content.value, preview = find('preview-images'), thumbs = find('attachments');
    find('counter').textContent = text.length + ' / 4000';
    find('preview-content').textContent = text.trim() || (attachments.length ? '' : '你写下的文字和选择的图片会显示在这里。');
    find('preview-content').classList.toggle('moments-muted', !text.trim());
    find('preview-content').hidden = !text.trim() && attachments.length > 0;
    find('preview-time').textContent = formatTime(new Date());
    find('image-count').textContent = attachments.length ? attachments.length + ' / 9 张图片' : '纯文字也可以';
    publishButton.disabled = !login || busy || selecting || (!text.trim() && !attachments.length);
    fileInput.disabled = busy || selecting;
    content.disabled = busy;
    find('logout').disabled = busy;
    find('login-button').disabled = busy;
    preview.replaceChildren();
    thumbs.replaceChildren();
    preview.dataset.count = attachments.length;
    attachments.forEach((attachment, index) => {
      const image = document.createElement('img');
      image.src = attachment.url;
      image.alt = '所选图片 ' + (index + 1);
      const frame = document.createElement('div');
      frame.className = 'moment-image';
      frame.append(image);
      preview.append(frame);
      const thumbnail = document.createElement('div');
      thumbnail.className = 'moments-attachment';
      thumbnail.append(image.cloneNode());
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.disabled = busy;
      remove.setAttribute('aria-label', '移除图片 ' + (index + 1));
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(attachments[index].url);
        attachments.splice(index, 1);
        draft = null;
        status('图片已移除，预览已更新。');
        update();
      });
      thumbnail.append(remove);
      thumbs.append(thumbnail);
    });
  }
  function updateAccount(name) {
    login = name;
    find('account').textContent = name ? '已登录 GitHub：' + name : '尚未登录 GitHub';
    find('auth-description').textContent = name ? '文字和图片会保存到你的博客仓库。' : '登录后就能从手机或电脑发布。';
    find('logout').hidden = !name;
    find('login-panel').hidden = Boolean(name);
    update();
  }
  async function refreshSession() {
    try {
      const session = await request('/session');
      updateAccount(session.authenticated ? session.login : null);
    } catch (error) {
      updateAccount(null);
      const localPreview = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
      status(localPreview ? '这是本地预览；网页登录和发布请在正式网站使用。' : error.message,
        localPreview ? 'info' : 'error');
    }
  }
  find('login-button').addEventListener('click', () => {
    const popup = window.open(api + '/login?return_origin=' + encodeURIComponent(location.origin),
      'moments-github-login', 'popup,width=520,height=700');
    status(popup ? '请在打开的 GitHub 窗口中完成登录，当前编辑内容会保留。' :
      '浏览器拦截了登录窗口，请允许弹出窗口后重试。', popup ? 'info' : 'error');
  });
  window.addEventListener('message', event => {
    if (event.origin !== new URL(api).origin || event.data?.source !== 'moments-auth') return;
    if (event.data.ok) refreshSession().then(() => status('登录成功，可以发布了。', 'success'));
    else status(typeof event.data.error === 'string' ? event.data.error : '登录未完成，请重试。', 'error');
  });
  window.addEventListener('focus', refreshSession);
  find('logout').addEventListener('click', async () => {
    try {
      await request('/logout', { method: 'POST', body: '{}' });
      updateAccount(null);
      status('已退出当前设备，编辑中的内容仍保留在这里。');
    } catch (error) { status(error.message, 'error'); }
  });
  content.addEventListener('input', () => { draft = null; update(); });
  fileInput.addEventListener('change', async () => {
    selecting = true; update();
    const files = Array.from(fileInput.files || []), prepared = [];
    try {
      if (attachments.length + files.length > maxImages) throw new Error('每条碎碎念最多选择 9 张图片。');
      const total = [...attachments.map(item => item.file), ...files].reduce((sum, file) => sum + file.size, 0);
      if (total > maxTotalBytes) throw new Error('图片总大小不能超过 32 MB。');
      for (const file of files) {
        if (!types.includes(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
        if (file.size > maxImageBytes) throw new Error('每张图片需要小于或等于 8 MB。');
        if (!validImage(new Uint8Array(await file.arrayBuffer()), file.type))
          throw new Error('所选文件与图片格式不符，请重新选择图片。');
        prepared.push({ file, url: URL.createObjectURL(file) });
      }
      attachments.push(...prepared);
      draft = null;
      status('图片已加入预览，发布时会一起保存。');
    } catch (error) {
      prepared.forEach(item => URL.revokeObjectURL(item.url));
      status(error.message, 'error');
    } finally { fileInput.value = ''; selecting = false; update(); }
  });
  find('compose-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || selecting) return;
    if (!login) { status('请先登录 GitHub，再发布。', 'error'); return; }
    busy = true; update();
    draft ||= { id: crypto.randomUUID(), content: content.value.trim(), createdAt: new Date().toISOString() };
    try {
      const uploads = [];
      for (const [index, attachment] of attachments.entries()) {
        const bytes = new Uint8Array(await attachment.file.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 32768)
          binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        uploads.push({ mime: attachment.file.type, base64: btoa(binary), alt: '图片 ' + (index + 1) });
      }
      status('正在保存到博客仓库…');
      const result = await request('/publish', { method: 'POST', body: JSON.stringify({ draft, uploads }) });
      if (!/^[0-9a-f]{40}$/i.test(result.sha)) throw new Error('保存结果的标识不正确，请到 GitHub 核对记录。');
      content.value = '';
      attachments.forEach(item => URL.revokeObjectURL(item.url));
      attachments = [];
      draft = null;
      status('已保存到 GitHub，线上页面将在自动构建完成后更新。', 'success');
      const link = document.createElement('a');
      link.href = 'https://github.com/' + root.dataset.owner + '/' + root.dataset.repo + '/actions';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ' 查看发布进度';
      find('status').append(link);
    } catch (error) { status(error.message, 'error'); }
    finally { busy = false; update(); }
  });
  window.addEventListener('beforeunload', event => {
    if (content.value.trim() || attachments.length || busy) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => attachments.forEach(item => URL.revokeObjectURL(item.url)));
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    attachments.forEach(item => { item.url = URL.createObjectURL(item.file); });
    refreshSession();
  });
  updateAccount(null);
  refreshSession();
})();
