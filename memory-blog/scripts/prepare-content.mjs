import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const blogRoot = path.resolve(appRoot, '..');
const readJson = async name => JSON.parse(await readFile(path.join(blogRoot, name), 'utf8'));
const site = JSON.parse(await readFile(path.join(appRoot, 'site.json'), 'utf8'));
const library = JSON.parse(await readFile(path.join(appRoot, 'image-library.json'), 'utf8'));
const imageById = new Map(library.images.map(image => [image.id, image.src]));
const libraryImage = id => {
  if (!imageById.has(id)) throw new Error(`Unknown image in image-library.json: ${id}`);
  return imageById.get(id);
};
const imagery = {
  backgrounds: Object.fromEntries(Object.entries(library.backgrounds).map(([page, id]) => [page, libraryImage(id)])),
  featured: libraryImage(library.featured)
};
const categories = new Set();
const tags = new Set();
const articles = [];
const list = value => value == null ? [] : Array.isArray(value) ? value.flat().map(String) : [String(value)];
const sourceUrl = value => typeof value === 'string' && (value.startsWith('/') || /^https:\/\//.test(value)) ? value : null;
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
// Keep existing covers stable; distribute new default covers without repeats until the pool is used.
const usedCovers = new Set([imagery.featured, imagery.backgrounds.home]);
for (const article of articles) {
  const selection = library.articles[article.id];
  article.cover ||= selection ? libraryImage(selection.cover) : null;
  if (article.cover) usedCovers.add(article.cover);
}
const pool = library.coverPool.map(libraryImage);
let nextCover = 0;
for (const article of articles) {
  if (!article.cover) {
    article.cover = pool.find(src => !usedCovers.has(src)) || pool[nextCover++ % pool.length];
    usedCovers.add(article.cover);
  }
  const selection = library.articles[article.id];
  article.readCover = selection ? libraryImage(selection.readCover) : article.cover;
}
const friendGroups = yaml.load(await readFile(path.join(blogRoot, 'source/_data/link.yml'), 'utf8'));
const friends = (friendGroups || []).filter(group => group.class_name === '友情链接').flatMap(group => group.link_list || []).filter(friend => friend.link !== site.blog).map(friend => ({
  name: friend.name, url: friend.link, avatar: friend.avatar, description: String(friend.descr).replace(/<br\s*\/?>/g, ' ')
}));
const moments = await readJson('source/_data/moments.json');
const editorSource = (await readFile(path.join(blogRoot, 'source/js/moments-editor-v2.js'), 'utf8')).replace(/\r\n/g, '\n');
const editorScript = '/js/moments-editor.' + createHash('sha256').update(editorSource).digest('hex').slice(0, 16) + '.js';
const output = { site, imagery, articles, categories: [...categories], tags: [...tags], friends, moments: moments.entries, editorScript };
await mkdir(path.join(appRoot, 'src/preview'), { recursive: true });
await writeFile(path.join(appRoot, 'src/preview/content.generated.json'), JSON.stringify(output, null, 2) + '\n');
const imagePaths = new Set(['/img/avatar.png', '/img/favicon.ico', ...library.images.map(image => image.src), ...articles.flatMap(article => [article.cover, article.readCover]), ...friends.map(friend => friend.avatar), ...moments.entries.flatMap(entry => entry.images.map(image => image.src))]);
for (const imagePath of imagePaths) {
  if (!imagePath.startsWith('/img/') || imagePath.includes('..')) continue;
  const destination = path.join(appRoot, 'public', imagePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(blogRoot, 'source', imagePath), destination);
}
console.log(`Prepared ${articles.length} published articles, ${friends.length} friends, ${moments.entries.length} moments. Hidden notes excluded.`);
await mkdir(path.join(appRoot, 'public/js'), { recursive: true });
await writeFile(path.join(appRoot, 'public', editorScript), editorSource);
