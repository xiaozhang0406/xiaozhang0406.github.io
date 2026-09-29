import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const blogRoot = path.resolve(appRoot, '..');
const readJson = async name => JSON.parse(await readFile(path.join(blogRoot, name), 'utf8'));
const site = JSON.parse(await readFile(path.join(appRoot, 'site.json'), 'utf8'));
const categories = new Set();
const tags = new Set();
const articles = [];
const list = value => value == null ? [] : Array.isArray(value) ? value.flat().map(String) : [String(value)];
const sourceUrl = value => typeof value === 'string' && value.startsWith('/') ? value : '/img/yarinaoshi.jpg';
for (const file of await readdir(path.join(blogRoot, 'source/_posts'))) {
  if (!file.endsWith('.md')) continue;
  const raw = await readFile(path.join(blogRoot, 'source/_posts', file), 'utf8');
  const parsed = matter(raw);
  if (parsed.data.published === false || parsed.data.draft === true) continue;
  const articleCategories = list(parsed.data.categories);
  const articleTags = list(parsed.data.tags);
  articleCategories.forEach(item => categories.add(item));
  articleTags.forEach(item => tags.add(item));
  const date = parsed.data.date instanceof Date ? parsed.data.date.toISOString().slice(0, 10) : String(parsed.data.date || '').slice(0, 10);
  const id = file.slice(0, -3);
  articles.push({
    id, title: String(parsed.data.title || id), date,
    description: String(parsed.data.description || parsed.content.replace(/[#>*`]/g, '').trim().slice(0, 110)),
    content: parsed.content, categories: articleCategories, tags: articleTags,
    author: String(parsed.data.author || site.name), cover: sourceUrl(parsed.data.cover),
    originalUrl: `${site.blog}/posts/${encodeURIComponent(id)}/`
  });
}
articles.sort((a, b) => b.date.localeCompare(a.date));
const friendGroups = yaml.load(await readFile(path.join(blogRoot, 'source/_data/link.yml'), 'utf8'));
const friends = (friendGroups || []).filter(group => group.class_name === '友情链接').flatMap(group => group.link_list || []).filter(friend => friend.link !== site.blog).map(friend => ({
  name: friend.name, url: friend.link, avatar: friend.avatar, description: String(friend.descr).replace(/<br\s*\/?>/g, ' ')
}));
const moments = await readJson('source/_data/moments.json');
const output = { site, articles, categories: [...categories], tags: [...tags], friends, moments: moments.entries };
await mkdir(path.join(appRoot, 'src/preview'), { recursive: true });
await writeFile(path.join(appRoot, 'src/preview/content.generated.json'), JSON.stringify(output, null, 2) + '\n');
const imagePaths = new Set(['/img/avatar.png', '/img/yarinaoshi.jpg', '/img/favicon.ico', ...articles.map(article => article.cover), ...friends.map(friend => friend.avatar), ...moments.entries.flatMap(entry => entry.images.map(image => image.src))]);
for (const imagePath of imagePaths) {
  if (!imagePath.startsWith('/img/') || imagePath.includes('..')) continue;
  const destination = path.join(appRoot, 'public', imagePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(blogRoot, 'source', imagePath), destination);
}
console.log(`Prepared ${articles.length} published articles, ${friends.length} friends, ${moments.entries.length} moments. Hidden notes excluded.`);
