import { PublicHeader } from '@/components/PublicHeader'
import { PublicFooter } from '@/components/PublicFooter'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell" style={{ display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  )
}
