import type { Metadata } from 'next';
import { findDoc } from '@/lib';
import { DocsShell } from '@/components';

export const metadata: Metadata = {
  title: 'Changelog — openoffice',
  description: 'Product updates, shipped weekly.',
};

export default function ChangelogPage() {
  const doc = findDoc('changelog')!;
  return <DocsShell doc={doc} />;
}
