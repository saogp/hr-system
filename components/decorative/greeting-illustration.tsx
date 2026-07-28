export function GreetingIllustration({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 220"
      className={className}
    >
      {/* soft backdrop blob */}
      <path
        fill="#f2a152"
        opacity="0.18"
        d="M182,120Q182,168,140,190Q98,212,58,188Q18,164,16,116Q14,68,54,42Q94,16,138,34Q182,52,182,120Z"
      />

      {/* waving arm, behind body */}
      <path
        d="M148,108 Q176,92 178,66 Q180,50 168,48 Q158,47 156,60 Q152,84 132,100 Z"
        fill="#001f3c"
      />
      <circle cx="172" cy="54" r="9" fill="#f6c99b" />

      {/* body */}
      <path
        d="M70,196 Q66,150 78,126 Q92,104 110,104 Q128,104 140,126 Q150,148 148,196 Z"
        fill="#001f3c"
      />

      {/* collar accent */}
      <path d="M98,112 L110,128 L122,112 Z" fill="#f2a152" />

      {/* neck */}
      <rect x="102" y="94" width="16" height="18" rx="6" fill="#f6c99b" />

      {/* head */}
      <circle cx="110" cy="76" r="26" fill="#f6c99b" />

      {/* hair */}
      <path
        d="M84,72 Q82,44 110,42 Q138,44 136,72 Q136,58 122,56 Q112,54 110,60 Q108,54 98,56 Q86,58 84,72 Z"
        fill="#001f3c"
      />

      {/* simple face */}
      <circle cx="101" cy="78" r="2.4" fill="#001f3c" />
      <circle cx="119" cy="78" r="2.4" fill="#001f3c" />
      <path d="M100,88 Q110,94 120,88" stroke="#001f3c" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* other arm resting */}
      <path
        d="M72,130 Q56,146 58,168 Q59,178 68,176 Q76,174 74,164 Q72,148 84,134 Z"
        fill="#001f3c"
      />
    </svg>
  )
}
