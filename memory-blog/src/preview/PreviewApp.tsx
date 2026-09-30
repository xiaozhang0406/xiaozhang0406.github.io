import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import Head from './Head';
import Home from './Home';
import { About, Archive, Category, Friends, ReadArticle, Talks, Taxonomy } from './Pages';
import MomentsEditor from './MomentsEditor';
import BottomMenu from '../components/BottomMenu';
import { articles, asset, site } from './data';
import '../frontHome/main.css';
import '../App.sass';
import './preview.css';

function Layout() {
  const [isDark, setDark] = useState(() => localStorage.getItem('memory-dark') === 'true');
  const [scrollHeight, setScrollHeight] = useState(0);
  const location = useLocation();
  useEffect(() => {
    const update = () => setScrollHeight(window.scrollY);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => { localStorage.setItem('memory-dark', String(isDark)); }, [isDark]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const pathname = decodeURIComponent(location.pathname);
    const article = articles.find(item => pathname === `/posts/${item.id}/` || pathname === `/article/${item.id}`);
    const page = pathname.startsWith('/moments/edit') ? '写碎碎念' : pathname.startsWith('/moments') || pathname.startsWith('/talk') ? '碎碎念' : pathname.startsWith('/archives') || pathname.startsWith('/times') ? '归档' : pathname.startsWith('/link') || pathname.startsWith('/friends') ? '友人链' : pathname.startsWith('/about') ? '关于我' : '';
    document.title = `${article?.title || page || site.name} · ${article || page ? site.name : 'Memory'}`;
  }, [location.pathname]);
  return <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: '#7880d1', borderRadius: 12 } }}>
    <div className={`frontRoot${isDark ? ' frontDark' : ''}`} style={{ '--memory-background': `url("${asset('/img/yarinaoshi.jpg')}")` } as React.CSSProperties}>
      <Head isDark={isDark} setDark={setDark} scrollHeight={scrollHeight} />
      <main><Outlet /></main>
      <footer className="footerContainer">
        <p>© 2025 – {new Date().getFullYear()} {site.name}</p>
        <p className="footer-motto">{site.motto}</p>
        <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{site.icp}</a></p>
        <p>Theme <a href="https://github.com/LinMoQC/Memory-Blog" target="_blank" rel="noopener noreferrer">Memory · 林陌青川</a> · <a href={`${site.github}/xiaozhang0406.github.io`} target="_blank" rel="noopener noreferrer">博客源码 ↗</a></p>
      </footer>
      <BottomMenu isDark={isDark} setDark={setDark} scrollHeight={scrollHeight} />
    </div>
  </ConfigProvider>;
}

export default function PreviewApp() {
  return <BrowserRouter><Routes><Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="about" element={<About />} />
    <Route path="times" element={<Archive />} />
    <Route path="archives/*" element={<Archive />} />
    <Route path="friends" element={<Friends />} />
    <Route path="link" element={<Friends />} />
    <Route path="talk" element={<Talks />} />
    <Route path="moments" element={<Talks />} />
    <Route path="moments/edit" element={<MomentsEditor />} />
    <Route path="category/:id" element={<Category />} />
    <Route path="categories" element={<Taxonomy />} />
    <Route path="categories/:id" element={<Category />} />
    <Route path="tags" element={<Taxonomy tagsMode />} />
    <Route path="tags/:id" element={<Category tagsMode />} />
    <Route path="article/:id" element={<ReadArticle />} />
    <Route path="posts/:id" element={<ReadArticle />} />
    <Route path="*" element={<div className="preview-page"><h1>没有找到这一页</h1><Link to="/">返回首页</Link></div>} />
  </Route></Routes></BrowserRouter>;
}
