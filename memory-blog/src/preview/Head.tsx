import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar, Input, Modal } from 'antd';
import Switch from '../components/Switch';
import TopMao from '../components/TopMao';
import MoonToSun from '../frontHome/MoonToSun';
import { articlePath, articles, asset, categories, site } from './data';
import '../frontHome/Head/index.sass';

type Props = { isDark: boolean; setDark: React.Dispatch<React.SetStateAction<boolean>>; scrollHeight: number };
const links = [
  { to: '/', label: '首页', icon: 'icon-shouye4' },
  { to: '/archives/', label: '归档', icon: 'icon-guidang3' },
  { to: '/moments/', label: '碎碎念', icon: 'icon-liaotian1' },
  { to: '/link/', label: '友人链', icon: 'icon-lianjie' },
  { to: '/about/', label: '关于我', icon: 'icon-leaf-01' }
];

export default function Head({ isDark, setDark, scrollHeight }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [animation, setAnimation] = useState('');
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!animation) return;
    const timer = window.setTimeout(() => setAnimation(''), 1100);
    return () => window.clearTimeout(timer);
  }, [animation]);
  const switchMode = () => { setAnimation(isDark ? 'sun' : 'moon'); setDark(!isDark); };
  const results = query.trim() ? articles.filter(article => `${article.title} ${article.description} ${article.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : articles;
  const nav = <>
    {links.slice(0, 2).map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'}><i className={`iconfont ${link.icon}`} aria-hidden="true" />{link.label}</NavLink>)}
    <details className="preview-category-menu"><summary><i className="iconfont icon-fenlei" aria-hidden="true" />分类</summary><div>{categories.map(category => <Link key={category} to={`/category/${encodeURIComponent(category)}`}>{category}</Link>)}</div></details>
    {links.slice(2).map(link => <NavLink key={link.to} to={link.to}><i className={`iconfont ${link.icon}`} aria-hidden="true" />{link.label}</NavLink>)}
  </>;
  const hasArticleCover = /^\/(posts|article)\//.test(location.pathname);
  return <header className={`memory-header${hasArticleCover ? ' cover-header' : ''}${scrollHeight > 40 ? ' scrolled' : ''}`}>
    <TopMao currentScrollHeight={scrollHeight} />
    <div className="headContainer preview-head">
      <Link className="webTitle" to="/" aria-label="Yarinaoshi 博客首页"><h2><span className="firstTitle">{site.name}</span><span className="blog-suffix">Blog</span></h2></Link>
      <nav className="memory-navigation" aria-label="主导航">{nav}</nav>
      <div className="preview-head-actions">
        <button type="button" className="icon-button" aria-label="搜索文章" onClick={() => setSearchOpen(true)}><i className="iconfont icon-search" aria-hidden="true" /><span className="search-symbol">⌕</span></button>
        <Switch handleModeSwitch={switchMode} isDarkMode={isDark} />
        <Link to="/about" className="head-avatar" aria-label="关于 Yarinaoshi"><Avatar src={asset('/img/avatar.png')} /></Link>
        <button type="button" className="icon-button mobile-menu-button" aria-label={menuOpen ? '关闭菜单' : '打开菜单'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
      </div>
    </div>
    {menuOpen && <nav className="memory-mobile-nav" aria-label="手机导航">{nav}</nav>}
    <Modal title="找一篇文章" open={searchOpen} onCancel={() => setSearchOpen(false)} footer={null} width={650}>
      <Input.Search autoFocus placeholder="搜索标题或正文…" aria-label="搜索标题或正文" value={query} onChange={event => setQuery(event.target.value)} allowClear />
      <div className="memory-search-results" aria-live="polite">
        {results.length ? results.map(article => <Link to={articlePath(article.id)} key={article.id}><strong>{article.title}</strong><p>{article.description}</p><small>{article.date}</small></Link>) : <p>没有找到相关内容，换个词试试。</p>}
      </div>
    </Modal>
    {animation && <MoonToSun key={animation} status={animation} />}
  </header>;
}
