import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { asset, editorScript, site } from './data';
import './moments-editor.css';

type EditorRoot = HTMLElement & { momentsDispose?: () => void };

export default function MomentsEditor() {
  const editor = useRef<EditorRoot>(null);
  useEffect(() => {
    const root = editor.current;
    const script = document.createElement('script');
    script.src = asset(editorScript);
    script.async = true;
    script.onerror = () => {
      const status = root?.querySelector<HTMLElement>('#moments-status');
      if (status) { status.hidden = false; status.textContent = '发布页暂时没有加载完整，请刷新后重试。'; }
    };
    document.body.append(script);
    return () => { root?.momentsDispose?.(); script.remove(); };
  }, []);
  return <section ref={editor} className="memory-editor moments-page moments-editor" data-owner="xiaozhang0406" data-repo="xiaozhang0406.github.io" data-api="https://planner.yarinaoshi.top/moments-api">
    <div className="editor-width">
      <div className="moments-editor-heading"><div><Link className="moments-back" to="/moments/">← 返回碎碎念</Link><h1>写碎碎念</h1><p className="moments-muted">不用想好标题，记录此刻就好。</p></div><span className="moments-private">博主发布</span></div>
      <section className="moment-card moments-auth" aria-label="发布授权">
        <div className="moments-auth-top"><div><strong id="moments-account">尚未登录 GitHub</strong><p id="moments-auth-description" className="moments-muted">登录后就能从手机或电脑发布。</p></div><button id="moments-logout" className="moments-secondary" type="button" hidden>退出登录</button></div>
        <div className="moments-login-actions" id="moments-login-panel"><button id="moments-login-button" className="moments-button" type="button">使用 GitHub 登录</button><p className="moments-small">在 GitHub 确认后即可发布。</p></div>
      </section>
      <div className="moments-editor-grid">
        <section className="moment-card moments-compose" aria-label="编辑碎碎念"><form id="moments-compose-form">
          <label className="moments-compose-label" htmlFor="moments-content">此刻在想什么？</label>
          <textarea id="moments-content" rows={7} maxLength={4000} placeholder="一个想法、一件小事，或者今天拍到的画面……" />
          <div className="moments-compose-meta"><span>自动记录发布时间 · 北京时间</span><span id="moments-counter">0 / 4000</span></div>
          <div id="moments-attachments" className="moments-attachments" aria-label="已选择的图片" />
          <div className="moments-compose-actions"><label className="moments-secondary moments-upload" htmlFor="moments-images">＋ 添加图片</label><input id="moments-images" className="moments-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /><span id="moments-image-count" className="moments-small">纯文字也可以</span></div>
          <p className="moments-small">最多 9 张 JPG、PNG、WebP 或 GIF 图片，每张不超过 8 MB，总计不超过 32 MB。</p>
          <div className="moments-publish-row"><span className="moments-small">发布后所有访客可见</span><button id="moments-publish" className="moments-button" type="submit" disabled>发布 →</button></div>
        </form></section>
        <aside className="moments-preview-column" aria-label="发布效果预览"><p className="moments-preview-label">效果预览</p><article className="moment-card moments-preview"><header className="moment-header"><img className="moments-avatar" src={asset('/img/avatar.png')} alt="" width={40} height={40} /><div className="moment-author"><strong>{site.name}</strong><time id="moments-preview-time" /></div></header><p id="moments-preview-content" className="moment-text moments-muted">你写下的文字和选择的图片会显示在这里。</p><div id="moments-preview-images" className="moment-images" /></article><p className="moments-small moments-preview-note">点击「发布」后才会保存到博客。</p></aside>
      </div>
      <p id="moments-status" className="moments-status" role="status" aria-live="polite" hidden />
    </div>
  </section>;
}
