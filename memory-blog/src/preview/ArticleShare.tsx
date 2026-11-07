import { Button, Modal } from 'antd';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { site, type Article } from './data';
import './article-share.css';

export function ArticleShare({ article, content }: { article: Article; content: RefObject<HTMLDivElement> }) {
  const poster = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const filename = article.id + '.png';

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function generate() {
    const frame = poster.current;
    const slot = body.current;
    const source = content.current;
    if (busy || !frame || !slot || !source) return;
    setBusy(true);
    setError('');

    try {
      const { default: render } = await import('html2canvas');
      if (!frame.isConnected) return;
      const copy = source.cloneNode(true) as HTMLDivElement;
      copy.className = 'share-paper-body markdown-body';
      copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      copy.querySelectorAll('details').forEach(detail => { detail.open = true; });
      const images = Array.from(copy.querySelectorAll('img'));
      images.forEach(image => {
        image.loading = 'eager';
        if (/^https?:/.test(image.src) && new URL(image.src).origin !== location.origin) {
          image.crossOrigin = 'anonymous';
        }
      });
      slot.append(copy);
      await Promise.all(images.map(async image => {
        try {
          await image.decode();
        } catch {
          const placeholder = document.createElement('p');
          placeholder.className = 'share-paper-image-note';
          placeholder.textContent = image.alt ? '配图暂不可用 · ' + image.alt : '配图暂不可用';
          image.replaceWith(placeholder);
        }
      }));
      await document.fonts.ready;
      if (!frame.isConnected) return;
      const { offsetWidth: width, offsetHeight: height } = frame;
      // Fit long articles into a single image within mobile canvas limits.
      const scale = Math.min(2, 16000 / height, Math.sqrt(5000000 / (width * height)));
      const canvas = await render(frame, { scale, useCORS: true, logging: false, windowWidth: width });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed');
      setFile(new File([blob], filename, { type: 'image/png' }));
    } catch {
      setError('长图生成失败，请重试。');
    } finally {
      slot.replaceChildren();
      setBusy(false);
    }
  }

  const canShare = file && navigator.canShare?.({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ title: article.title, files: [file] });
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError('系统分享失败，可以先保存 PNG。');
      }
    }
  }

  return <>
    <div className="article-share-action">
      <Button onClick={generate} loading={busy}>分享长图</Button>
      {!file && error && <span role="alert">{error}</span>}
    </div>
    <div className="share-paper-stage" aria-hidden="true" ref={stage => stage?.setAttribute('inert', '')}>
      <div className="share-paper" ref={poster}>
        <header className="share-paper-header">
          <div className="share-paper-brand">{site.name} <span>／ 文章分享</span></div>
          <h1>{article.title}</h1>
          <p>{article.author} · {article.date}</p>
        </header>
        <div ref={body} />
        <footer className="share-paper-footer"><strong>{site.name}</strong><span>{new URL(site.blog).host}</span></footer>
      </div>
    </div>
    <Modal title="文章分享长图" open={!!file} onCancel={() => { setFile(null); setError(''); }} footer={[
      <Button key="download" type="primary" href={preview || undefined} download={filename} disabled={!preview}>保存 PNG</Button>,
      canShare && <Button key="share" onClick={share}>系统分享</Button>,
    ]}>
      {error && <p role="alert">{error}</p>}
      {preview && <div className="article-share-preview"><img src={preview} alt={article.title + '的完整文章长图'} /></div>}
    </Modal>
  </>;
}
