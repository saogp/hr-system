function toIcsDate(dateStr: string) {
  return dateStr.replace(/-/g, '')
}

function toIcsTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(text: string) {
  return text.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, '\\n')
}

export function generateReviewIcs({
  id,
  scheduledDate,
  employeeName,
  leaderName,
}: {
  id: string
  scheduledDate: string
  employeeName: string
  leaderName: string | null
}) {
  const summary = escapeIcsText(`Medarbeidersamtale - ${employeeName}`)
  const description = escapeIcsText(
    leaderName
      ? `Medarbeidersamtale mellom ${employeeName} og ${leaderName}.`
      : `Medarbeidersamtale med ${employeeName}.`
  )

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zest//Medarbeidersamtale//NO',
    'BEGIN:VEVENT',
    `UID:review-${id}@zest-app`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART;VALUE=DATE:${toIcsDate(scheduledDate)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
