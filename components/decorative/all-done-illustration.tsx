export function AllDoneIllustration({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 160" className={className}>
      {/* decorative square */}
      <rect x="30" y="90" width="22" height="22" rx="4" fill="#f2a152" />

      {/* walking figure */}
      <path d="M108,150 L112,112 L96,120 L88,150 Z" fill="#001f3c" />
      <path d="M112,112 L134,150 L144,146 L124,106 Z" fill="#001f3c" />
      <path
        d="M96,64 Q94,100 112,112 Q128,118 138,100 L132,96 Q124,108 114,104 Q102,96 104,66 Z"
        fill="#001f3c"
      />
      <path d="M138,100 Q150,92 152,76 L144,74 Q142,86 134,92 Z" fill="#001f3c" />
      <circle cx="102" cy="52" r="16" fill="#f6c99b" />
      <path
        d="M88,52 Q86,32 104,30 Q122,32 120,52 Q120,40 108,38 Q100,37 98,44 Q92,38 88,52 Z"
        fill="#7a2b2b"
      />

      {/* checkmark badge */}
      <circle cx="150" cy="50" r="26" fill="#dcf5e3" />
      <path
        d="M138,50 L147,59 L164,40"
        stroke="#16a34a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
