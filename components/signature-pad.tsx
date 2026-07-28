'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function SignaturePad({
  onSave,
  saving = false,
}: {
  onSave: (dataUrl: string) => void
  saving?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const save = () => {
    onSave(canvasRef.current!.toDataURL('image/png'))
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full rounded-md border border-input bg-white touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={saving}>
          Tøm
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!hasDrawn || saving}>
          {saving ? 'Signerer...' : 'Signer'}
        </Button>
      </div>
    </div>
  )
}
