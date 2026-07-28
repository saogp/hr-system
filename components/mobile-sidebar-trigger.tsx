'use client'

import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

export function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/onboarding') return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="m-2 md:hidden [&_svg]:size-6"
      onClick={toggleSidebar}
    >
      <Menu />
      <span className="sr-only">Åpne meny</span>
    </Button>
  )
}
