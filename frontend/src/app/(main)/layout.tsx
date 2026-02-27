import { ProtectedProviders } from '@/components/ProtectedProviders'
import { NavBar } from '@/components/NavBar'
import { DemoBanner } from '@/components/DemoBanner'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedProviders>
      <DemoBanner />
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </ProtectedProviders>
  )
}
