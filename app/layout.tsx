import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileSidebarTrigger } from '@/components/mobile-sidebar-trigger'
import { TestRoleSwitcher } from '@/components/test-role-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ToastProvider, Toaster } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Zest',
  description: 'Zest – internportal for ansatte',
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
        <ToastProvider>
          <SidebarProvider>
            <Sidebar />
            <SidebarInset>
              <div className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-6 py-3 text-sidebar-foreground">
                <div className="flex items-center">
                  <MobileSidebarTrigger />
                  <div className="hidden md:block">
                    <TestRoleSwitcher />
                  </div>
                </div>
                <NotificationBell />
              </div>
              <main className="thin-scrollbar flex-1 overflow-y-auto">{children}</main>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  )
}