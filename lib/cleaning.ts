export type CleaningRoomGroup = {
  id: string
  name: string
  sort_order: number
  questions: string[]
  company_id: string | null
}

export type CleaningRoom = {
  id: string
  name: string
  sort_order: number
  group_id: string | null
}

export type CleaningCheck = {
  id: string
  room_id: string
  check_date: string
  checked_at: string
  checked_by_name: string | null
  checklist: { question: string; checked: boolean }[]
  deviation_note: string | null
  deviation_photos: string[]
}

export type CleaningRecipient = {
  id: string
  email: string
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
