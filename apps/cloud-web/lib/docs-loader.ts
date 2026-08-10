import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const DOCS_DIR = path.join(process.cwd(), 'content/docs');

export interface DocMeta {
  id: string;
  title: string;
  section: 'Getting Started' | 'Working with agents' | 'Reference';
  lede: string;
}

export interface Doc extends DocMeta {
  content: string;
}

export const DOC_SECTIONS: DocMeta['section'][] = [
  'Getting Started',
  'Working with agents',
  'Reference',
];

export function getAllDocs(): DocMeta[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.mdx'));
  return files.map((file) => {
    const id = file.replace(/\.mdx$/, '');
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    const { data } = matter(raw);
    return {
      id,
      title: data.title ?? id,
      section: data.section ?? 'Reference',
      lede: data.lede ?? '',
    };
  });
}

export function getDoc(id: string): Doc | null {
  const filePath = path.join(DOCS_DIR, `${id}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    id,
    title: data.title ?? id,
    section: data.section ?? 'Reference',
    lede: data.lede ?? '',
    content,
  };
}
