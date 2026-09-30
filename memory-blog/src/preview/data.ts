import content from './content.generated.json';

export const site = content.site;
export const articles = content.articles;
export const categories = content.categories;
export const tags = content.tags;
export const friends = content.friends;
export type Article = typeof articles[number];
export type Moment = { id: string; content: string; createdAt: string; images: { src: string; alt: string }[] };
export const moments = content.moments as Moment[];
export const editorScript = content.editorScript;
export const articlePath = (id: string) => '/posts/' + encodeURIComponent(id) + '/';
export const asset = (src: string) => src.startsWith('/') ? import.meta.env.BASE_URL + src.slice(1) : src;
