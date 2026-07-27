'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'

type OrgNode = {
  id: string
  full_name: string | null
  role: string
  manager_id: string | null
}

function buildChildMap(nodes: OrgNode[]) {
  const byManager: Record<string, OrgNode[]> = {}
  const roots: OrgNode[] = []

  for (const node of nodes) {
    if (node.manager_id) {
      byManager[node.manager_id] = [...(byManager[node.manager_id] ?? []), node]
    } else {
      roots.push(node)
    }
  }

  return { roots, byManager }
}

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin':
      return <Badge className="bg-red-500 hover:bg-red-600">Admin</Badge>
    case 'manager':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Leder</Badge>
    default:
      return <Badge variant="secondary">Ansatt</Badge>
  }
}

function OrgTreeNode({
  node,
  byManager,
  visited,
}: {
  node: OrgNode
  byManager: Record<string, OrgNode[]>
  visited: Set<string>
}) {
  if (visited.has(node.id)) return null
  const nextVisited = new Set(visited).add(node.id)
  const children = byManager[node.id] ?? []

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-4 py-2 min-w-40 shadow-sm">
        <span className="font-medium text-sm">{node.full_name || '—'}</span>
        {getRoleBadge(node.role)}
      </div>
      {children.length > 0 && (
        <>
          <div className="h-6 w-px bg-border" />
          <div className="flex gap-8">
            {children.map((child) => (
              <OrgTreeNode key={child.id} node={child} byManager={byManager} visited={nextVisited} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const router = useRouter()
  const [nodes, setNodes] = useState<OrgNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase.rpc('get_org_chart')
      if (data) setNodes(data)
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return <div className="p-8">Laster organisasjonskart...</div>
  }

  const { roots, byManager } = buildChildMap(nodes)

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Organisasjonskart</h1>
        <p className="text-muted-foreground text-sm">
          Oversikt over hvem som rapporterer til hvem. Endres under Innstillinger.
        </p>
      </div>

      {roots.length === 0 ? (
        <p className="text-muted-foreground">Ingen ansatte registrert enda.</p>
      ) : (
        <div className="flex flex-wrap gap-12 justify-center overflow-x-auto pb-8">
          {roots.map((root) => (
            <OrgTreeNode key={root.id} node={root} byManager={byManager} visited={new Set()} />
          ))}
        </div>
      )}
    </div>
  )
}
