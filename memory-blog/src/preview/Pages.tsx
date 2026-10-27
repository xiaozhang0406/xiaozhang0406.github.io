import { Avatar, Empty, Image, Tag, Timeline } from 'antd';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { ArticleCard } from './Home';
import { articlePath, articles, asset, categories, friends, moments, site, tags } from './data';
import '../frontHome/Content/AboutMe/index.sass';
import '../frontHome/Content/FriendList/index.sass';
import '../frontHome/Content/ReadArticle/index.sass';
import '../frontHome/Content/Times/index.sass';
import '../frontHome/Content/Talk/index.sass';
import 'github-markdown-css/github-markdown-light.css';

export function About() {
  return <section className="AboutContainer memory-about">
    <article className="self-intro" aria-labelledby="self-intro-title">
      <header className="intro-heading">
        <div className="intro-heading-copy">
          <p className="intro-eyebrow">SELF INTRO <span aria-hidden="true">／</span> 关于我</p>
          <h1 id="self-intro-title">你好，<br />这里是 <span>{site.name}</span>。</h1>
          <p className="intro-subtitle">还在摸索，也还保留着好奇心。</p>
          <div className="intro-author"><Avatar size={36} src={asset('/img/avatar.png')} /><span>{site.name}<small>学习、折腾，还有生活。</small></span></div>
        </div>
        <figure className="intro-photo"><img src={asset('/img/mahiro/street.jpg')} alt="午后街道上微笑的真寻" width="1000" height="998" /><figcaption>给日常留一个小小的角落。</figcaption></figure>
      </header>
      <div className="intro-body">
        <p>我在福建理工大学读工业工程，现在大二。如果你问我以后想做什么，我大概还没办法给出一个很确定的答案。不过，感兴趣的东西倒是一直不少。</p>
        <p>比起用几个标签介绍自己，我更想在这里慢慢写一点：我在折腾什么，在想什么，还有一些暂时没想明白的事。</p>

        <section aria-labelledby="intro-learning">
          <h2 id="intro-learning">从一块电路板，到一个小网站</h2>
          <p>我喜欢那些能亲手做出点东西的事。画 PCB，折腾 STM32，写一点 Python，在 Linux 里敲敲命令，或者像现在这样，给自己的博客改一个页面。</p>
          <p>这些东西看起来有点散，但对我来说，吸引人的地方其实差不多：脑子里冒出一个想法，然后一点点把它变成真的能运行的东西。哪怕最后只是一个很小的功能，做出来的那一刻也会觉得，嗯，今天没白折腾。</p>
          <p>当然，更多时候还是在看资料、报错、返工。有些问题卡了很久才弄懂，有些东西学过又忘了，就再翻出来看一遍。这里会留下这些过程，算是给以后的自己留点线索。</p>
        </section>

        <section aria-labelledby="intro-curiosity">
          <h2 id="intro-curiosity">还没想清楚，也想继续试试</h2>
          <p>我也会迷茫。想学的东西很多，时间和精力却没那么多；有时候想一口气把什么都学会，有时候又连眼前的一件小事都不太想动。</p>
          <p>专业、兴趣、以后要走的路，暂时还没有被我整理成一个很清楚的计划。我一边摸索，一边调整，也会怀疑自己是不是绕了远路。</p>
          <p>不过，好奇心还在。看到一个有意思的电路、一段没看懂的代码，或者一个想自己做出来的小东西，还是会忍不住想再试试。现在的我，大概就是在这种状态里慢慢往前走。</p>
        </section>

        <section aria-labelledby="intro-lab">
          <h2 id="intro-lab">想有一个自己的电子实验室</h2>
          <p>如果说有什么一直很想实现的愿望，那就是有一个属于自己的电子实验室。</p>
          <p>不用特别大。有一张能安心折腾的工作台，放得下电源、示波器和焊台，旁边收着各种元器件，还有几块正在调试的板子。想到什么，就可以坐下来慢慢做；没做完的东西，也不用急着收走。</p>
          <p>光是想象那个角落，就会觉得挺期待的。离它可能还有一段距离，那就从手上的小项目开始，一点点攒经验，也一点点攒出那个空间。</p>
        </section>

        <section aria-labelledby="intro-blog">
          <h2 id="intro-blog">所以，留下了这个博客</h2>
          <p>我想给自己的学习和生活留一个角落。这里会有技术笔记、踩坑记录，也会有日常、碎碎念，和一些当时很想写下来的想法。</p>
          <p>有些文章可能不够完整，有些想法过一阵子还会变。没关系，先记下来。等以后回头看，至少能知道，那时候的我在关心什么，又是怎么一点点走过来的。</p>
          <p>至于页面上的二次元元素，原因也很简单：我喜欢。自己的小地方，就想放一点自己看着会开心的东西。</p>
          <p>如果这里恰好有一篇文章帮到了你，或者只是让你愿意多停留一会儿，我都会很开心。谢谢你看到这里，欢迎随便逛逛。</p>
        </section>
        <div className="intro-signoff"><span>{site.name}</span><p>写于 <time dateTime="2026">2026 年秋</time></p></div>
      </div>
      <footer className="intro-footer"><p>也欢迎来打个招呼。</p><div className="about-contact"><a href={site.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={`mailto:${site.email}`}>Email ↗</a><span>QQ {site.qq}</span></div></footer>
    </article>
  </section>;
}

export function Archive() {
  return <section className="TimesContainer memory-archive"><div className="timePass"><h1>归档</h1><p>共有 {articles.length} 篇公开文章。</p><p className="archive-motto">记录走过的路，也期待下一段旅程。</p></div>
    <Timeline className="timeLine" items={articles.map(article => ({ children: <Link to={articlePath(article.id)}><time>{article.date}</time><strong>{article.title}</strong><p>{article.description}</p></Link> }))} />
  </section>;
}

export function Taxonomy({ tagsMode = false }: { tagsMode?: boolean }) {
  const items = tagsMode ? tags : categories;
  return <section className="preview-page"><h1>{tagsMode ? '标签' : '分类'}</h1><div className="taxonomy-links">{items.map(item => <Link key={item} to={`/${tagsMode ? 'tags' : 'categories'}/${encodeURIComponent(item)}/`}><Tag color="#939ad8">{item}</Tag></Link>)}</div></section>;
}

export function Category({ tagsMode = false }: { tagsMode?: boolean }) {
  const { id } = useParams();
  const filtered = articles.filter(article => (tagsMode ? article.tags : article.categories).includes(id || ''));
  return <section className="preview-page"><h1>{tagsMode ? '标签' : '分类'} · {id}</h1><p>{filtered.length} 篇文章</p><div className="allArticles">{filtered.map((article, index) => <ArticleCard article={article} index={index} key={article.id} />)}</div>{!filtered.length && <Empty description="这里还没有文章" />}</section>;
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
  return <article className="readContainer memory-read"><div className="readCover"><img src={asset(article.readCover)} alt="" /><div className="readInfo"><div className="read-author"><Avatar src={asset('/img/avatar.png')} />{article.author}</div><h1>{article.title}</h1><time dateTime={article.date}>{article.date}</time></div></div>
    <div className="readDescription"><strong>文章简介</strong><p>{article.description}</p></div>
    <div className="readContent markdown-body"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]} components={{ img: ({ src, alt }) => <img src={asset(src || '')} alt={alt || ''} loading="lazy" />, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{article.content}</Markdown></div>
    <div className="read-return"><Link to="/archives/">← 查看其他文章</Link><Link to="/">返回首页 →</Link></div>
  </article>;
}

export function Talks() {
  const dateLabel = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  return <section className="TalkContainer memory-talks"><div className="talk-heading"><h1>碎碎念</h1><p>一些不成篇的日常。</p><Link to="/moments/edit/">写一条 ↗</Link></div>
    {moments.length ? [...moments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(moment => <article className="memory-moment" id={`moment-${moment.id}`} key={moment.id}><div className="moment-person"><Avatar src={asset('/img/avatar.png')} /><strong>{site.name}</strong><time dateTime={moment.createdAt}>{dateLabel(moment.createdAt)}</time></div>{moment.content && <p>{moment.content}</p>}<Image.PreviewGroup><div className="moment-images">{moment.images.map(image => <Image src={asset(image.src)} alt={image.alt} key={image.src} />)}</div></Image.PreviewGroup></article>) : <div className="moment-empty"><span>✧</span><h2>留住一闪而过的念头</h2><p>一句话、一张照片，都可以放在这里。</p><Link to="/moments/edit/">写下第一条 →</Link></div>}
  </section>;
}
