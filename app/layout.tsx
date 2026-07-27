import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

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
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <SidebarTrigger />
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}