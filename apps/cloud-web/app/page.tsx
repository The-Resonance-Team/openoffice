import type { Metadata } from 'next'
import { Dashboard } from '@/components/Dashboard'

export const metadata: Metadata = {
  title: 'OpenOffice Cloud',
  description: 'Org management and analytics for OpenOffice (ADR 0005)',
}

export default function Page() {
  return <Dashboard />
}
