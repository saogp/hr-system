type Props = {
  className?: string
}

export function OrganicBlob({ className }: Props) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 440 420"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fill="#001f3c"
        d="M421.5,314.5Q391,379,321.5,395Q252,411,190,381Q128,351,84,299.5Q40,248,45.5,180Q51,112,110,73Q169,34,238.5,32Q308,30,368,66Q428,102,438,166Q448,230,421.5,314.5Z"
      />
    </svg>
  )
}

export function OrganicAccentDot({ className }: Props) {
  return (
    <span
      className={className}
      style={{ backgroundColor: '#f2a152' }}
    />
  )
}
