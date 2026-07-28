export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-brand-navy/10 bg-brand-cream dark:border-white/10 dark:bg-white/5 p-4">
      <p className="text-2xl font-bold text-brand-orange">{value}</p>
      <p className="text-xs font-medium text-brand-navy dark:text-white/80">{label}</p>
    </div>
  )
}
