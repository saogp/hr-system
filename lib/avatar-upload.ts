import { supabase } from '@/lib/supabase'

const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function uploadAvatar(profileId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Filen må være et bilde.')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Bildet kan være maks 5 MB.')
  }

  const path = `${profileId}/avatar`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', profileId)

  if (updateError) throw updateError

  return avatarUrl
}
