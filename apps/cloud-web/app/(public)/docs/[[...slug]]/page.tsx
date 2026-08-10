import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllDocs, getDoc } from '@/lib/docs-loader';
import { DocsLayout } from '@/components/DocsLayout';
import { MdxDoc } from '@/components/MdxDoc';

export function generateStaticParams() {
  const docs = getAllDocs();
  return docs.map((d) => ({ slug: [d.id] }));
}

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = slug?.[0] ?? 'introduction';
  const doc = getDoc(id);
  if (!doc) return {};
  return { title: `${doc.title} — openoffice docs`, description: doc.lede };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const id = slug?.[0] ?? 'introduction';
  const doc = getDoc(id);
  if (!doc) notFound();

  const allDocs = getAllDocs();

  return (
    <DocsLayout docs={allDocs} currentDoc={doc}>
      <MdxDoc source={doc.content} />
    </DocsLayout>
  );
}
