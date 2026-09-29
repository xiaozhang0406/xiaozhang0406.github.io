(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MomentsStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DATA_PATH = 'source/_data/moments.json';
  const MAX_IMAGES = 9;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
  const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

  function validateDocument(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
      throw new Error('碎碎念数据格式不正确，请先检查已有内容。');
    }
    const ids = new Set();
    const entries = data.entries.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(entry.id) || ids.has(entry.id)) {
        throw new Error('碎碎念记录的标识不正确或重复。');
      }
      ids.add(entry.id);
      if (typeof entry.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.createdAt) ||
          !Number.isFinite(Date.parse(entry.createdAt)) || new Date(entry.createdAt).toISOString() !== entry.createdAt) {
        throw new Error('碎碎念的时间格式不正确。');
      }
      if (typeof entry.content !== 'string' || entry.content.length > 4000 || !Array.isArray(entry.images) || entry.images.length > MAX_IMAGES) {
        throw new Error('每条碎碎念最多 4000 字、9 张图片。');
      }
      const images = entry.images.map(image => {
        if (!image || typeof image.src !== 'string' || !/^\/img\/moments\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(image.src) ||
            typeof image.alt !== 'string' || image.alt.length > 300) {
          throw new Error('碎碎念图片的地址或说明不正确。');
        }
        return { src: image.src, alt: image.alt };
      });
      const content = entry.content.trim();
      if (!content && !images.length) throw new Error('写一点文字，或选择至少一张图片。');
      return { id: entry.id, content, createdAt: entry.createdAt, images };
    });
    return { version: 1, entries };
  }

  function encodeBytes(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  }

  function decodeBytes(base64) {
    const binary = atob(base64.replace(/\s/g, ''));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  function checkImageBytes(bytes, mime) {
    if (!IMAGE_TYPES[mime]) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('每张图片需要小于或等于 8 MB。');
    const header = Array.from(bytes.subarray(0, 12));
    const text = String.fromCharCode(...header);
    const matches = mime === 'image/jpeg' ? header[0] === 255 && header[1] === 216 && header[2] === 255 :
      mime === 'image/png' ? header.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' :
      mime === 'image/gif' ? /^(GIF87a|GIF89a)/.test(text) : /^RIFF....WEBP/.test(text);
    if (!matches) throw new Error('所选文件与图片格式不符，请重新选择图片。');
    return IMAGE_TYPES[mime];
  }

  class GitHubError extends Error {
    constructor(status) {
      const message = status === 401 ? '授权凭据无效或已过期，请重新连接。' :
        status === 403 ? 'GitHub 拒绝了请求，请检查仓库写入权限或稍后重试。' :
        status === 404 ? '找不到博客仓库或碎碎念数据，请先将本次新增功能同步到 GitHub。' :
        status === 409 || status === 422 ? '仓库正在更新或分支限制了发布，请稍后重试。' :
        status === 0 ? '连接 GitHub 失败，内容仍保留在编辑框里，请检查网络后重试。' : 'GitHub 暂时无法完成请求，请稍后重试。';
      super(message);
      this.status = status;
    }
  }

  class GitHubPublisher {
    #token = '';
    #fetch;
    #publishing = false;
    constructor({ owner, repo, branch = 'main', fetchImpl = globalThis.fetch }) {
      if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo) || !/^[A-Za-z0-9._/-]+$/.test(branch)) {
        throw new Error('博客仓库配置不正确。');
      }
      this.owner = owner;
      this.repo = repo;
      this.branch = branch;
      this.#fetch = fetchImpl;
      this.connected = false;
      this.prefix = `/repos/${owner}/${repo}`;
    }

    async #request(path, method = 'GET', body) {
      if (!this.#token) throw new Error('请先连接 GitHub，再发布。');
      let response;
      try {
        response = await this.#fetch(`https://api.github.com${path}`, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.#token}`,
            'X-GitHub-Api-Version': '2026-03-10',
            ...(body ? { 'Content-Type': 'application/json' } : {})
          },
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(60000)
        });
      } catch { throw new GitHubError(0); }
      if (!response.ok) throw new GitHubError(response.status);
      return response.json();
    }

    async connect(token) {
      this.disconnect();
      if (typeof token !== 'string' || !/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(token.trim())) {
        throw new Error('请使用 GitHub 生成的发布授权凭据。');
      }
      this.#token = token.trim();
      try {
        const user = await this.#request('/user');
        if (String(user.login).toLowerCase() !== this.owner.toLowerCase()) throw new Error(`请连接博客所属的 ${this.owner} 账号。`);
        const repository = await this.#request(this.prefix);
        if (repository.archived || repository.permissions?.push === false) throw new Error('当前授权无法向这个博客仓库发布，请检查 Contents 写入权限。');
        this.connected = true;
        return { login: user.login };
      } catch (error) {
        this.disconnect();
        throw error;
      }
    }

    disconnect() {
      this.#token = '';
      this.connected = false;
    }

    async #readState() {
      const ref = await this.#request(`${this.prefix}/git/ref/heads/${this.branch}`);
      const head = ref.object.sha;
      const commit = await this.#request(`${this.prefix}/git/commits/${head}`);
      let file = await this.#request(`${this.prefix}/contents/${DATA_PATH}?ref=${head}`);
      if (file.encoding !== 'base64') file = await this.#request(`${this.prefix}/git/blobs/${file.sha}`);
      let document;
      try { document = JSON.parse(new TextDecoder().decode(decodeBytes(file.content))); }
      catch { throw new Error('已有碎碎念数据无法读取，为避免覆盖内容，发布已停止。'); }
      return { head, tree: commit.tree.sha, document: validateDocument(document) };
    }

    async publish(draft, uploads = [], onProgress = () => {}) {
      if (!this.connected) throw new Error('请先连接 GitHub，再发布。');
      if (this.#publishing) throw new Error('正在发布，请等待当前操作完成。');
      if (!Array.isArray(uploads) || uploads.length > MAX_IMAGES) throw new Error('最多选择 9 张图片。');
      let total = 0;
      const prepared = uploads.map((upload, index) => {
        if (typeof upload.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(upload.base64) || upload.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
          throw new Error('图片数据不正确或超过大小限制。');
        }
        const bytes = decodeBytes(upload.base64);
        const extension = checkImageBytes(bytes, upload.mime);
        total += bytes.length;
        return { ...upload, path: `source/img/moments/${draft.id}-${index + 1}.${extension}`, src: `/img/moments/${draft.id}-${index + 1}.${extension}` };
      });
      if (total > MAX_TOTAL_BYTES) throw new Error('图片总大小不能超过 32 MB。');
      const entry = validateDocument({ version: 1, entries: [{
        id: draft.id,
        content: draft.content,
        createdAt: draft.createdAt,
        images: prepared.map((upload, index) => ({ src: upload.src, alt: upload.alt || `图片 ${index + 1}` }))
      }] }).entries[0];

      this.#publishing = true;
      try {
        onProgress('正在读取已有碎碎念…');
        let state = await this.#readState();
        const alreadySaved = () => {
          const saved = state.document.entries.find(item => item.id === entry.id);
          if (!saved) return false;
          if (JSON.stringify(saved) !== JSON.stringify(entry)) throw new Error('这条记录的标识已被使用，请刷新编辑页后重试。');
          return true;
        };
        if (alreadySaved()) return { sha: state.head, recovered: true };

        const imageTree = [];
        for (const [index, upload] of prepared.entries()) {
          onProgress(`正在保存图片 ${index + 1} / ${prepared.length}…`);
          const blob = await this.#request(`${this.prefix}/git/blobs`, 'POST', { encoding: 'base64', content: upload.base64 });
          imageTree.push({ path: upload.path, mode: '100644', type: 'blob', sha: blob.sha });
        }

        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) {
            state = await this.#readState();
            if (alreadySaved()) return { sha: state.head, recovered: true };
          }
          onProgress(attempt ? '仓库有更新，正在保留最新内容后重新保存…' : '正在保存文字和发布时间…');
          const document = { version: 1, entries: [entry, ...state.document.entries] };
          const tree = await this.#request(`${this.prefix}/git/trees`, 'POST', {
            base_tree: state.tree,
            tree: [...imageTree, { path: DATA_PATH, mode: '100644', type: 'blob', content: JSON.stringify(document, null, 2) + '\n' }]
          });
          const commit = await this.#request(`${this.prefix}/git/commits`, 'POST', {
            message: `发布碎碎念 ${entry.createdAt}`,
            tree: tree.sha,
            parents: [state.head]
          });
          try {
            await this.#request(`${this.prefix}/git/refs/heads/${this.branch}`, 'PATCH', { sha: commit.sha, force: false });
            return { sha: commit.sha, recovered: false };
          } catch (error) {
            if (!(error instanceof GitHubError) || ![0, 409, 422].includes(error.status)) throw error;
            if (attempt === 2) {
              // A lost response can still mean the commit was accepted; confirm the record before reporting failure.
              state = await this.#readState();
              if (alreadySaved()) return { sha: state.head, recovered: true };
              throw error;
            }
          }
        }
      } finally { this.#publishing = false; }
    }
  }

  return { DATA_PATH, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_BYTES, IMAGE_TYPES, validateDocument, encodeBytes, checkImageBytes, GitHubPublisher };
});
