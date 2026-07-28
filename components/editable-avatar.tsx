'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { uploadAvatar } from '@/lib/avatar-upload'
import { cn } from '@/lib/utils'

export function EditableAvatar({
  profileId,
  avatarUrl,
  initials,
  editable,
  size = 'lg',
  className,
  onUploaded,
}: {
  profileId: string
  avatarUrl: string | null
  initials: string
  editable: boolean
  size?: 'default' | 'sm' | 'lg'
  className?: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const url = await uploadAvatar(profileId, file)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste opp bilde.')
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={cn('relative', className)}>
        <Avatar size={size} className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={initials} />}
          <AvatarFallback className="text-lg bg-brand-navy text-brand-orange">{initials}</AvatarFallback>
        </Avatar>
        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-brand-orange text-brand-navy shadow ring-2 ring-background hover:bg-brand-orange/90 disabled:opacity-60"
            aria-label="Last opp profilbilde"
          >
            <Camera className="size-3.5" />
          </button>
        )}
        {editable && (
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
