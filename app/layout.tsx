import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileSidebarTrigger } from '@/components/mobile-sidebar-trigger'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const metadata: Metadata = {
  title: 'HR Portal',
  description: 'Internportal for ansatte',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="no">
      <body className="min-h-screen bg-background antialiased">
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>
            <MobileSidebarTrigger />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}