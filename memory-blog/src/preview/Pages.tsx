import { useState } from 'react';
import { Avatar, Button, Empty, Image, Tag, Timeline } from 'antd';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArticleCard } from './Home';
import { articles, asset, friends, moments, site } from './data';
import '../frontHome/Content/AboutMe/index.sass';
import '../frontHome/Content/FriendList/index.sass';
import '../frontHome/Content/ReadArticle/index.sass';
import '../frontHome/Content/Times/index.sass';
import '../frontHome/Content/Talk/index.sass';
import 'github-markdown-css/github-markdown-light.css';

const prompts = [
  { question: '你在学习什么？', answer: '我目前主要学习 PCB 设计、电力电子和嵌入式开发，也在向软件与 Linux 运维方向扩展技能树。' },
  { question: '最近在做什么？', answer: '在做 MP2980 电源模块、STM32 主控板与 VESC 电机驱动相关项目，也会折腾 Minecraft 服务器。项目过程里的踩坑和学习会记在博客里。' },
  { question: '在哪里读书？', answer: `我在${site.school}，${site.education}。` },
  { question: '怎么联系你？', answer: `GitHub：xiaozhang0406，Email：${site.email}，QQ：${site.qq}。欢迎交流。` }
];

export function About() {
  const [messages, setMessages] = useState<{ text: string; from: 'me' | 'visitor' }[]>([
    { text: `你好，这里是 ${site.name} の Blog 👋`, from: 'me' },
    { text: `我是 ${site.name}，${site.school}，${site.education}。这里用来记录学习、折腾和一点日常。`, from: 'me' }
  ]);
  const [asked, setAsked] = useState<string[]>([]);
  return <section className="AboutContainer memory-about">
    <div className="about-heading"><Avatar size={88} src={asset('/img/avatar.png')} /><h1>认识一下，{site.name}</h1><p>{site.description}</p></div>
    <div className="chatbot memory-chat" aria-label="关于我的互动介绍"><div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`chat-row ${message.from}`} key={index}>{message.from === 'me' && <Avatar src={asset('/img/avatar.png')} />}<p>{message.text}</p></div>)}</div>
      <div className="chat-prompts">{prompts.filter(prompt => !asked.includes(prompt.question)).map(prompt => <Button key={prompt.question} onClick={() => { setMessages(previous => [...previous, { text: prompt.question, from: 'visitor' }, { text: prompt.answer, from: 'me' }]); setAsked(previous => [...previous, prompt.question]); }}>{prompt.question}</Button>)}{asked.length > 0 && <Button type="text" onClick={() => { setMessages(messages.slice(0, 2)); setAsked([]); }}>重新聊聊 ↺</Button>}</div>
    </div>
    <div className="about-projects">{site.projects.map(project => <article key={project.title}><span>正在探索</span><h2>{project.title}</h2><p>{project.description}</p></article>)}</div>
    <div className="about-contact"><a href={site.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={`mailto:${site.email}`}>Email ↗</a><span>QQ {site.qq}</span></div>
  </section>;
}

export function Archive() {
  return <section className="TimesContainer memory-archive"><div className="timePass"><h1>归档</h1><p>共有 {articles.length} 篇公开文章。</p><p className="archive-motto">记录走过的路，也期待下一段旅程。</p></div>
    <Timeline className="timeLine" items={articles.map(article => ({ children: <Link to={`/article/${article.id}`}><time>{article.date}</time><strong>{article.title}</strong><p>{article.description}</p></Link> }))} />
  </section>;
}

export function Category() {
  const { id } = useParams();
  const filtered = articles.filter(article => article.categories.includes(id || ''));
  return <section className="preview-page"><h1>分类 · {id}</h1><p>{filtered.length} 篇文章</p><div className="allArticles">{filtered.map((article, index) => <ArticleCard article={article} index={index} key={article.id} />)}</div>{!filtered.length && <Empty description="这个分类还没有文章" />}</section>;
}

export function Friends() {
  return <section className="FriendsContainer memory-friends"><div className="FriendList"><h1>友人链</h1><p className="page-intro">偶尔串门，看看朋友们在记录什么。</p><ul className="link-items">{friends.map(friend => <li className="link-item" key={friend.url}><a href={friend.url} target="_blank" rel="noopener noreferrer"><img src={asset(friend.avatar)} alt={friend.name} loading="lazy" /><span className="sitename">{friend.name}</span><div className="linkdes">{friend.description}</div></a></li>)}</ul></div>
    <div className="friend-invite"><h2>交换一份日常</h2><p>欢迎互换友链，可以通过邮件联系我。</p><a href={`mailto:${site.email}?subject=${encodeURIComponent('交换友链')}`}>联系 Yarinaoshi →</a></div>
  </section>;
}

export function ReadArticle() {
  const { id } = useParams();
  const article = articles.find(item => item.id === id);
  if (!article) return <section className="preview-page"><Empty description="没有找到这篇文章" /><Link to="/">回到首页</Link></section>;
  return <article className="readContainer memory-read"><div className="readCover"><img src={asset(article.cover)} alt="" /><div className="readInfo"><div className="read-author"><Avatar src={asset('/img/avatar.png')} />{article.author}</div><h1>{article.title}</h1><time dateTime={article.date}>{article.date}</time></div></div>
    <div className="readDescription"><strong>文章简介</strong><p>{article.description}</p></div>
    <div className="readContent markdown-body"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={{ img: ({ src, alt }) => <img src={asset(src || '')} alt={alt || ''} loading="lazy" />, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{article.content}</Markdown></div>
    <div className="read-return"><Link to="/times">← 查看其他文章</Link><a href={article.originalUrl} target="_blank" rel="noopener noreferrer">在原版博客阅读 ↗</a></div>
  </article>;
}

export function Talks() {
  const dateLabel = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  return <section className="TalkContainer memory-talks"><div className="talk-heading"><h1>碎碎念</h1><p>一些不成篇的日常。</p><a href={`${site.blog}/moments/edit/`} target="_blank" rel="noopener noreferrer">写一条 ↗</a></div>
    {moments.length ? [...moments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(moment => <article className="memory-moment" key={moment.id}><div className="moment-person"><Avatar src={asset('/img/avatar.png')} /><strong>{site.name}</strong><time dateTime={moment.createdAt}>{dateLabel(moment.createdAt)}</time></div>{moment.content && <p>{moment.content}</p>}<Image.PreviewGroup><div className="moment-images">{moment.images.map(image => <Image src={asset(image.src)} alt={image.alt} key={image.src} />)}</div></Image.PreviewGroup></article>) : <div className="moment-empty"><span>✧</span><h2>留住一闪而过的念头</h2><p>一句话、一张照片，都可以放在这里。</p><a href={`${site.blog}/moments/`} target="_blank" rel="noopener noreferrer">去原版博客写下第一条 →</a></div>}
  </section>;
}
