const HEADING_PATTERN = /^(#{1,2})\s(.*)$/

export function RenderedContractText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const match = line.match(HEADING_PATTERN)
        if (match) {
          const level = match[1].length
          return (
            <p
              key={i}
              className={level === 1 ? 'text-xl font-bold mt-3 first:mt-0' : 'text-lg font-semibold mt-2 first:mt-0'}
            >
              {match[2]}
            </p>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {line || ' '}
          </p>
        )
      })}
    </>
  )
}
