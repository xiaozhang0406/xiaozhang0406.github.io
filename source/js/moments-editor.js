(() => {
  'use strict';
  const root = document.querySelector('.moments-editor');
  if (!root || !window.MomentsStore) return;
  const { GitHubPublisher, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_BYTES, IMAGE_TYPES, encodeBytes, checkImageBytes } = window.MomentsStore;
  const client = new GitHubPublisher({ owner: root.dataset.owner, repo: root.dataset.repo, branch: root.dataset.branch });
  const find = id => document.getElementById(`moments-${id}`);
  const content = find('content');
  const fileInput = find('images');
  const publishButton = find('publish');
  const tokenInput = find('token');
  let attachments = [];
  let pendingDraft = null;
  let busy = false;
  let choosingImages = false;
  const formatTime = date => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);

  function status(message, state = 'info') {
    const element = find('status');
    element.hidden = !message;
    element.dataset.state = state;
    element.textContent = message;
  }

  function update() {
    const text = content.value;
    find('counter').textContent = `${text.length} / 4000`;
    find('preview-content').textContent = text.trim() || (attachments.length ? '' : '你写下的文字和选择的图片会显示在这里。');
    find('preview-content').classList.toggle('moments-muted', !text.trim());
    find('preview-content').hidden = !text.trim() && attachments.length > 0;
    find('preview-time').textContent = formatTime(new Date());
    find('image-count').textContent = attachments.length ? `${attachments.length} / ${MAX_IMAGES} 张图片` : '纯文字也可以';
    publishButton.disabled = !client.connected || busy || choosingImages || (!text.trim() && !attachments.length);
    fileInput.disabled = busy || choosingImages;
    content.disabled = busy;
    find('logout').disabled = busy;
    const preview = find('preview-images');
    const thumbnails = find('attachments');
    preview.replaceChildren();
    thumbnails.replaceChildren();
    preview.dataset.count = attachments.length;
    attachments.forEach((attachment, index) => {
      const image = document.createElement('img');
      image.src = attachment.url;
      image.alt = `所选图片 ${index + 1}`;
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
      remove.setAttribute('aria-label', `移除图片 ${index + 1}`);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(attachments[index].url);
        attachments.splice(index, 1);
        pendingDraft = null;
        status('图片已移除，预览已更新。');
        update();
      });
      thumbnail.append(remove);
      thumbnails.append(thumbnail);
    });
  }

  function updateAccount(login) {
    find('account').textContent = login ? `已连接 GitHub：${login}` : '尚未连接 GitHub';
    find('auth-description').textContent = login ? '文字和图片将一起保存到你的博客仓库。' : '先写好内容，连接后就能发布到博客。';
    find('logout').hidden = !login;
    find('login-panel').hidden = Boolean(login);
    update();
  }

  find('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    find('login-button').disabled = true;
    status('正在连接 GitHub…');
    try {
      const account = await client.connect(tokenInput.value);
      tokenInput.value = '';
      find('login-panel').open = false;
      updateAccount(account.login);
      status('连接成功，可以发布了。', 'success');
    } catch (error) {
      tokenInput.value = '';
      updateAccount(null);
      status(error.message, 'error');
    } finally { find('login-button').disabled = false; }
  });

  find('logout').addEventListener('click', () => {
    client.disconnect();
    tokenInput.value = '';
    updateAccount(null);
    status('已退出连接，编辑中的内容仍保留在这里。');
  });

  content.addEventListener('input', () => { pendingDraft = null; update(); });
  fileInput.addEventListener('change', async () => {
    choosingImages = true;
    update();
    const candidates = Array.from(fileInput.files || []);
    const prepared = [];
    try {
      if (attachments.length + candidates.length > MAX_IMAGES) throw new Error('每条碎碎念最多选择 9 张图片。');
      const total = [...attachments.map(item => item.file), ...candidates].reduce((sum, file) => sum + file.size, 0);
      if (total > MAX_TOTAL_BYTES) throw new Error('图片总大小不能超过 32 MB。');
      for (const file of candidates) {
        if (!IMAGE_TYPES[file.type]) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
        if (file.size > MAX_IMAGE_BYTES) throw new Error('每张图片需要小于或等于 8 MB。');
        checkImageBytes(new Uint8Array(await file.arrayBuffer()), file.type);
        prepared.push({ file, url: URL.createObjectURL(file) });
      }
      attachments.push(...prepared);
      pendingDraft = null;
      status('图片已加入预览，发布时会一起保存。');
    } catch (error) {
      prepared.forEach(item => URL.revokeObjectURL(item.url));
      status(error.message, 'error');
    } finally {
      fileInput.value = '';
      choosingImages = false;
      update();
    }
  });

  find('compose-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || choosingImages) return;
    if (!client.connected) { status('请先连接 GitHub，再发布。', 'error'); return; }
    busy = true;
    update();
    pendingDraft ||= { id: crypto.randomUUID(), content: content.value.trim(), createdAt: new Date().toISOString() };
    try {
      const uploads = [];
      for (const [index, attachment] of attachments.entries()) {
        uploads.push({ mime: attachment.file.type, base64: encodeBytes(new Uint8Array(await attachment.file.arrayBuffer())), alt: `图片 ${index + 1}` });
      }
      const result = await client.publish(pendingDraft, uploads, message => status(message));
      if (!/^[0-9a-f]{40}$/i.test(result.sha)) throw new Error('保存结果的标识不正确，请到 GitHub 核对记录。');
      content.value = '';
      attachments.forEach(item => URL.revokeObjectURL(item.url));
      attachments = [];
      pendingDraft = null;
      const localPreview = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
      status('已保存到 GitHub，线上页面将在自动构建完成后更新。' + (localPreview ? ' 本地预览需要同步仓库后才会显示新记录。' : ''), 'success');
      const progress = document.createElement('a');
      progress.href = `https://github.com/${client.owner}/${client.repo}/actions`;
      progress.target = '_blank';
      progress.rel = 'noopener noreferrer';
      progress.textContent = ' 查看发布进度';
      find('status').append(progress);
    } catch (error) {
      status(error.message, 'error');
    } finally { busy = false; update(); }
  });

  window.addEventListener('beforeunload', event => {
    if (content.value.trim() || attachments.length || busy) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => {
    client.disconnect();
    tokenInput.value = '';
    attachments.forEach(item => URL.revokeObjectURL(item.url));
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    attachments.forEach(item => { item.url = URL.createObjectURL(item.file); });
    updateAccount(null);
  });
  updateAccount(null);
})();
