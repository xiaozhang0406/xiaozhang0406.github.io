import { Avatar, Tag } from 'antd';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import SocialButton from '../components/Buttons/SocialButton';
import { articlePath, articles, asset, imagery, site, type Article } from './data';
import '../frontHome/Content/ContentHome/index.sass';

export function ArticleCard({ article, index = 0 }: { article: Article; index?: number }) {
  return <motion.article className="article" initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.08 }}>
    <Link className="ArticleCard" to={articlePath(article.id)}>
      <div className="ArticleCover"><img src={asset(article.cover)} alt="" loading="lazy" /></div>
      <div className="ArticleContent">
        <h4># {article.categories.join(' / ')}</h4>
        <h3 className="ArticleTitle">{article.title}</h3>
        <p>{article.description}</p>
        <div className="tags">{article.tags.map(tag => <Tag color="#939ad8" key={tag}>{tag}</Tag>)}</div>
        <div className="ArticleFooter"><Avatar src={asset('/img/avatar.png')} size={36} /><span>{article.author}</span><time dateTime={article.date}>发布于 {article.date}</time></div>
      </div>
    </Link>
  </motion.article>;
}

export default function Home() {
  const latest = articles[0];
  return <>
    <section className="SelfDescription" aria-label="Yarinaoshi 个人介绍">
      <div className="SayWords"><div><h2>Hi! 👋</h2><h2>I'm <span style={{ color: '#7880d1' }}>{site.name}</span></h2></div>
        <h3>{site.greeting}</h3><p className="hero-subtitle">{site.subtitle}</p>
        <div className="Social">
          <SocialButton SocialName="QQ" url={`https://wpa.qq.com/msgrd?v=3&uin=${site.qq}&site=qq&menu=yes`} />
          <SocialButton SocialName="Github" url={site.github} />
          <SocialButton SocialName="Email" url={`mailto:${site.email}`} />
        </div>
        <div className="hero-chips"><span>PCB 设计</span><span>嵌入式</span><span>Linux</span><span>Minecraft</span></div>
      </div>
      <Avatar src={asset('/img/avatar.png')} size={320} className="frontAvatar" />
      <div className="hero-bottom"><p>{site.motto}</p><a href="#/" className="hero-scroll" aria-label="查看文章" onClick={event => { event.preventDefault(); document.getElementById('articles')?.scrollIntoView({ behavior: 'smooth' }); }}>⌄</a></div>
    </section>
    <section className="ContentContainer dark-pic" id="articles" aria-label="博客文章">
      {latest && <Link className="TopArticle" to={articlePath(latest.id)}>
        <div className="Top">✦ 最新文章</div><div className="TopCover"><img src={asset(imagery.featured)} alt="" className="fade-in-out show" /><span className="thumbnail-screen" /></div>
        <div className="topContent"><h4># {latest.categories.join(' / ')}</h4><h3 className="contentTitle">{latest.title}</h3><p>{latest.description}</p><div className="tags">{latest.tags.map(tag => <Tag color="#939ad8" key={tag}>{tag}</Tag>)}</div>
          <div className="topFooter"><Avatar src={asset('/img/avatar.png')} size={36} /><span>{latest.author}</span><time>{latest.date}</time></div>
        </div>
      </Link>}
      <div className="article-section-label"><h2>文章</h2><span>{articles.length} 篇记录，慢慢积累。</span><Link to="/times">查看归档 →</Link></div>
      <div className="allArticles">{articles.map((article, index) => <ArticleCard key={article.id} article={article} index={index} />)}</div>
    </section>
  </>;
}
