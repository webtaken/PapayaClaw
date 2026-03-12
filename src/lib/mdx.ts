import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const blogDir = path.join(process.cwd(), 'src/content/blog');

export type BlogPostFrontmatter = {
  title: string;
  date: string;
  summary: string;
  slug: string;
};

export type BlogPost = {
  frontmatter: BlogPostFrontmatter;
  content: string;
};

export async function getBlogPosts(): Promise<BlogPostFrontmatter[]> {
  if (!fs.existsSync(blogDir)) {
    return [];
  }
  
  const files = fs.readdirSync(blogDir);
  const posts = files
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
    .map((file) => {
      const filePath = path.join(blogDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      
      const slug = file.replace(/\.mdx?$/, '');
      
      return {
        ...(data as Omit<BlogPostFrontmatter, 'slug'>),
        title: data.title || "Untitled",
        date: data.date || "1970-01-01",
        summary: data.summary || "",
        slug,
      } as BlogPostFrontmatter;
    })
    .sort((a, b) => (new Date(a.date) > new Date(b.date) ? -1 : 1));

  return posts;
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const filePathMdx = path.join(blogDir, `${slug}.mdx`);
  const filePathMd = path.join(blogDir, `${slug}.md`);
  
  let fileContent = '';
  
  if (fs.existsSync(filePathMdx)) {
    fileContent = fs.readFileSync(filePathMdx, 'utf8');
  } else if (fs.existsSync(filePathMd)) {
    fileContent = fs.readFileSync(filePathMd, 'utf8');
  } else {
    return null;
  }

  const { data, content } = matter(fileContent);

  return {
    frontmatter: {
      ...(data as Omit<BlogPostFrontmatter, 'slug'>),
      title: data.title || "Untitled",
      date: data.date || "1970-01-01",
      summary: data.summary || "",
      slug,
    } as BlogPostFrontmatter,
    content,
  };
}
