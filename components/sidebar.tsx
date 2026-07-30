'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, FileText, Users, Settings, MessageSquare, ShieldAlert, ClipboardList, Package, SprayCan, Moon, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { ZestLogo } from '@/components/zest-logo'
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
  { name: 'Personalutstyr', href: '/uniformer', icon: Package, adminOnly: true },
  { name: 'Kontrakter', href: '/contracts', icon: FileText },
  { name: 'Undersøkelser', href: '/surveys', icon: ClipboardList },
  { name: 'Medarbeidersamtaler', href: '/reviews', icon: MessageSquare },
]

const facilitiesNavigation = [
  { name: 'Renhold', href: '/renhold', icon: SprayCan, adminOnly: true },
]

const secondaryNavigation = [
  { name: 'Innstillinger', href: '/settings', icon: Settings },
  { name: 'Si fra', href: '/si-fra', icon: ShieldAlert },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
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
  if (pathname === '/login' || pathname === '/onboarding') return null

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
              {navigation
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
              {facilitiesNavigation
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
        <div className="rounded-xl border border-sidebar-border overflow-hidden group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:border-none">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2 text-sm">
              <Moon className="size-4 text-muted-foreground" />
              <span>Dark Mode</span>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={handleThemeToggle} />
          </div>

          <SidebarMenu className="border-t border-sidebar-border group-data-[collapsible=icon]:border-t-0">
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
                          {currentUser?.name ?? 'Laster...'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {currentUser?.email ?? ''}
                        </span>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  }
                />
                <DropdownMenuContent side="top" align="end" className="w-(--anchor-width) min-w-56">
                  <DropdownMenuItem onClick={handleLogout} variant="destructive">
                    <LogOut />
                    Logg ut
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarPrimitive>
  )
}
