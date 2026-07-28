const FACES = ['😟', '😐', '🙂', '😄']

function faceFor(percent: number) {
  if (percent >= 90) return FACES[3]
  if (percent >= 70) return FACES[2]
  if (percent >= 40) return FACES[1]
  return FACES[0]
}

export function ProfileCompletionBar({ percent }: { percent: number }) {
  return (
    <div className="relative pt-5">
      <span
        className="absolute -top-0.5 -translate-x-1/2 text-lg transition-all"
        style={{ left: `${percent}%` }}
        aria-hidden
      >
        {faceFor(percent)}
      </span>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-orange transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
