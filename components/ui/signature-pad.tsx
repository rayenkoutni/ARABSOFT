'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SignaturePadProps {
  open: boolean
  onClose: () => void
  onSave: (pngDataUrl: string) => void
}

type SignaturePoint = { x: number; y: number; width: number }
type SignatureStroke = SignaturePoint[]

function clampWidth(speed: number) {
  return Math.max(1.5, Math.min(4.5, 4.8 - speed * 0.035))
}

export function SignaturePad({ open, onClose, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const [strokes, setStrokes] = useState<SignatureStroke[]>([])

  const redraw = (nextStrokes: SignatureStroke[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#111111'

    nextStrokes.forEach((stroke) => {
      if (stroke.length === 1) {
        const point = stroke[0]
        context.beginPath()
        context.arc(point.x, point.y, point.width / 2, 0, Math.PI * 2)
        context.fillStyle = '#111111'
        context.fill()
        return
      }

      for (let index = 1; index < stroke.length; index += 1) {
        const previous = stroke[index - 1]
        const point = stroke[index]
        context.beginPath()
        context.lineWidth = point.width
        context.moveTo(previous.x, previous.y)
        context.lineTo(point.x, point.y)
        context.stroke()
      }
    })
  }

  useEffect(() => {
    if (!open) return
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      canvas.width = host.clientWidth * ratio
      canvas.height = 220 * ratio
      canvas.style.width = `${host.clientWidth}px`
      canvas.style.height = '220px'
      const context = canvas.getContext('2d')
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
      }
      redraw(strokes)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [open, strokes])

  useEffect(() => {
    if (!open) {
      setStrokes([])
      lastPointRef.current = null
      drawingRef.current = false
    }
  }, [open])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event)
    if (!point) return
    drawingRef.current = true
    lastPointRef.current = { ...point, time: performance.now() }
    const nextStrokes = [...strokes, [{ ...point, width: 3.2 }]]
    setStrokes(nextStrokes)
    redraw(nextStrokes)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return
    const point = getPoint(event)
    if (!point) return
    const now = performance.now()
    const lastPoint = lastPointRef.current
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
    const speed = distance / Math.max(now - lastPoint.time, 1)
    const nextPoint = { ...point, width: clampWidth(speed) }

    setStrokes((current) => {
      const nextStrokes = [...current]
      const currentStroke = nextStrokes[nextStrokes.length - 1]
      currentStroke.push(nextPoint)
      redraw(nextStrokes)
      return nextStrokes
    })

    lastPointRef.current = { ...point, time: now }
  }

  const finishStroke = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const handleUndo = () => {
    const nextStrokes = strokes.slice(0, -1)
    setStrokes(nextStrokes)
    redraw(nextStrokes)
  }

  const handleClear = () => {
    setStrokes([])
    redraw([])
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || strokes.length === 0) return
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dessiner une signature</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleUndo} disabled={strokes.length === 0}>
              Annuler le trait
            </Button>
            <Button type="button" variant="outline" onClick={handleClear} disabled={strokes.length === 0}>
              Effacer
            </Button>
          </div>
          <div ref={hostRef} className="rounded-xl border border-slate-200 bg-white p-2">
            <canvas
              ref={canvasRef}
              className="block touch-none rounded-lg bg-white"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={strokes.length === 0}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
