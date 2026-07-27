'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

export function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="m-2 md:hidden"
      onClick={toggleSidebar}
    >
      <Menu />
      <span className="sr-only">Åpne meny</span>
    </Button>
  )
}
