'use client'

import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

export function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/renhold/gruppe')) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="m-2 size-11 md:hidden"
      onClick={toggleSidebar}
    >
      <Menu className="size-8" />
      <span className="sr-only">Åpne meny</span>
    </Button>
  )
}
