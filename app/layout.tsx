import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileSidebarTrigger } from '@/components/mobile-sidebar-trigger'
import { TestRoleSwitcher } from '@/components/test-role-switcher'
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem('hr_theme');
              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>
            <TestRoleSwitcher />
            <MobileSidebarTrigger />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}