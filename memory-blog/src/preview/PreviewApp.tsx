import { useEffect, useState } from 'react';
import { HashRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import Head from './Head';
import Home from './Home';
import { About, Archive, Category, Friends, ReadArticle, Talks } from './Pages';
import BottomMenu from '../components/BottomMenu';
import { asset, site } from './data';
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
    document.title = `${site.name} · Memory`;
  }, [location.pathname]);
  return <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: '#7880d1', borderRadius: 12 } }}>
    <div className={`frontRoot${isDark ? ' frontDark' : ''}`} style={{ '--memory-background': `url("${asset('/img/yarinaoshi.jpg')}")` } as React.CSSProperties}>
      <Head isDark={isDark} setDark={setDark} scrollHeight={scrollHeight} />
      <main><Outlet /></main>
      <footer className="footerContainer">
        <p>© 2025 – {new Date().getFullYear()} {site.name}</p>
        <p className="footer-motto">{site.motto}</p>
        <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{site.icp}</a></p>
        <p>Theme <a href="https://github.com/LinMoQC/Memory-Blog" target="_blank" rel="noopener noreferrer">Memory · 林陌青川</a> · <a href={site.blog}>原版博客 ↗</a></p>
      </footer>
      <BottomMenu isDark={isDark} setDark={setDark} scrollHeight={scrollHeight} />
    </div>
  </ConfigProvider>;
}

export default function PreviewApp() {
  return <HashRouter><Routes><Route element={<Layout />}>
    <Route index element={<Home />} />
    <Route path="about" element={<About />} />
    <Route path="times" element={<Archive />} />
    <Route path="friends" element={<Friends />} />
    <Route path="talk" element={<Talks />} />
    <Route path="category/:id" element={<Category />} />
    <Route path="article/:id" element={<ReadArticle />} />
    <Route path="*" element={<div className="preview-page"><h1>没有找到这一页</h1><Link to="/">返回首页</Link></div>} />
  </Route></Routes></HashRouter>;
}
