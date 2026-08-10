import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DOCS, findDoc } from '@/lib';
import { DocsShell } from '@/components';

export function generateStaticParams() {
  return DOCS.filter((d) => d.id !== 'docs' && d.id !== 'changelog').map((d) => ({ slug: [d.id] }));
}

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = findDoc(slug?.[0] ?? 'docs');
  if (!doc) return {};
  return { title: `${doc.title} — openoffice docs`, description: doc.lede };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const id = slug?.[0] ?? 'docs';
  if (id === 'changelog') notFound();
  const doc = findDoc(id);
  if (!doc) notFound();
  return <DocsShell key={doc.id} doc={doc} />;
}
