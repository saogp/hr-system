'use client'

type RadarAxis = {
  label: string
  value: number
  target: number
}

const MAX_VALUE = 5
const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 56

function pointOn(index: number, total: number, radius: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  }
}

function polygonPoints(values: number[], radius: number) {
  return values
    .map((v, i) => {
      const r = (Math.max(0, Math.min(MAX_VALUE, v)) / MAX_VALUE) * radius
      const p = pointOn(i, values.length, r)
      return `${p.x},${p.y}`
    })
    .join(' ')
}

export function RadarChart({ axes }: { axes: RadarAxis[] }) {
  if (axes.length < 3) {
    return <p className="text-sm text-muted-foreground">Trenger minst 3 kompetanser for å vise diagram.</p>
  }

  const rings = [1, 2, 3, 4, 5]
  const actualPoints = polygonPoints(axes.map(a => a.value), RADIUS)
  const targetPoints = polygonPoints(axes.map(a => a.target), RADIUS)

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        style={{ maxWidth: SIZE }}
        role="img"
        aria-label="Radardiagram som viser kompetansenivå mot mål"
      >
        {rings.map((r) => (
          <polygon
            key={r}
            points={polygonPoints(axes.map(() => r), RADIUS)}
            fill="none"
            stroke="#e1e0d9"
            strokeWidth={1}
          />
        ))}

        {axes.map((_, i) => {
          const p = pointOn(i, axes.length, RADIUS)
          return (
            <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="#e1e0d9" strokeWidth={1} />
          )
        })}

        <polygon points={targetPoints} fill="none" stroke="#898781" strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={actualPoints} fill="#2a78d6" fillOpacity={0.18} stroke="#2a78d6" strokeWidth={2} />

        {axes.map((a, i) => {
          const p = pointOn(i, axes.length, RADIUS + 28)
          return (
            <text
              key={a.label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="#52514e"
            >
              {a.label}
            </text>
          )
        })}
      </svg>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: '#2a78d6' }} />
          Faktisk nivå
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full border-2 border-dashed" style={{ borderColor: '#898781' }} />
          Mål
        </span>
      </div>
    </div>
  )
}
