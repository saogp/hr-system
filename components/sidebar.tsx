'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, FileText, Users, Settings, MessageSquare, ShieldAlert, ClipboardList, Package, SprayCan, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { ZestLogo } from '@/components/zest-logo'
import { TestRoleSwitcher } from '@/components/test-role-switcher'
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navigation = [
  { name: 'Dashbord', href: '/', icon: LayoutDashboard },
  { name: 'Ansatte', href: '/people', icon: Users },
  { name: 'Kontrakter', href: '/contracts', icon: FileText },
  { name: 'Medarbeidersamtaler', href: '/reviews', icon: MessageSquare },
  { name: 'Undersøkelser', href: '/surveys', icon: ClipboardList },
]

const driftNavigation = [
  { name: 'Personalutstyr', href: '/uniformer', icon: Package, adminOnly: true },
  { name: 'Renhold', href: '/renhold', icon: SprayCan, adminOnly: true },
]

const secondaryNavigation = [
  { name: 'Innstillinger', href: '/settings', icon: Settings },
  { name: 'Si fra', href: '/si-fra', icon: ShieldAlert },
]

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? ''
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function getShortName(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length <= 1) return name
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; avatarUrl: string | null } | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  useEffect(() => {
    async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, birth_date, role, avatar_url')
        .eq('id', user.id)
        .single()

      setCurrentUser({
        name: profile?.full_name || user.email || 'Bruker',
        email: profile?.email || user.email || '',
        role: profile?.role ?? 'employee',
        avatarUrl: profile?.avatar_url ?? null,
      })

      if (!profile?.birth_date && pathname !== '/onboarding') {
        router.push('/onboarding')
      }
    }

    loadCurrentUser()
  }, [pathname, router])

  // Skjul sidebaren på innloggings- og onboardingsiden
  if (pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/renhold/gruppe')) return null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleThemeToggle = (checked: boolean) => {
    const next: Theme = checked ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <ZestLogo className="size-6 rounded-md shrink-0" />
              <span className="font-semibold tracking-wide">ZEST</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeMobileSidebar} />}
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {driftNavigation
                .filter((item) => !item.adminOnly || isAdminLike(applyRoleOverride(currentUser?.role ?? 'employee')))
                .map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeMobileSidebar} />}
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeMobileSidebar} />}
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-start gap-3 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <span className="text-sm text-muted-foreground">
            {theme === 'dark' ? 'Darkmode' : 'Lightmode'}
          </span>
          <Switch checked={theme === 'dark'} onCheckedChange={handleThemeToggle} />
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="rounded-none data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg">
                      {currentUser?.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />}
                      <AvatarFallback className="rounded-lg">
                        {getInitials(currentUser?.name ?? '?')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {currentUser ? getShortName(currentUser.name) : 'Laster...'}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="end" className="w-(--anchor-width)">
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut />
                  Logg ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="md:hidden">
          <TestRoleSwitcher />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarPrimitive>
  )
}
