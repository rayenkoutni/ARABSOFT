'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, PencilLine, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignaturePad } from '@/components/ui/signature-pad'
import { useToast } from '@/hooks/use-toast'
import {
  dataUrlToSignatureFile,
  deleteSignature as deleteRhSignature,
  uploadSignature,
} from '@/lib/services/client/settings.service'

interface SignatureUploaderProps {
  currentSignatureUrl: string | null
  onSignatureSaved: (url: string) => void
}

export function SignatureUploader({ currentSignatureUrl, onSignatureSaved }: SignatureUploaderProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(currentSignatureUrl)
  const [pendingAction, setPendingAction] = useState<'upload' | 'draw' | 'remove' | null>(null)
  const [padOpen, setPadOpen] = useState(false)

  useEffect(() => {
    setSignatureUrl(currentSignatureUrl)
  }, [currentSignatureUrl])

  const submitSignature = async (file: File, action: 'upload' | 'draw') => {
    try {
      setPendingAction(action)
      const formData = new FormData()
      formData.append('signature', file)

      const body = await uploadSignature(formData)
      setSignatureUrl(body.signatureUrl)
      onSignatureSaved(body.signatureUrl)
      setPadOpen(false)
      toast({ description: 'Signature enregistree avec succes' })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Echec de la sauvegarde de la signature',
        className: 'bg-red-500 text-white border-none',
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast({
        description: 'Utilisez un fichier PNG ou JPEG',
        className: 'bg-red-500 text-white border-none',
      })
      return
    }

    await submitSignature(file, 'upload')
  }

  const handleRemove = async () => {
    try {
      setPendingAction('remove')
      await deleteRhSignature()

      setSignatureUrl(null)
      toast({ description: 'Signature supprimee' })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Echec de la suppression de la signature',
        className: 'bg-red-500 text-white border-none',
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />

      {signatureUrl ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <img src={signatureUrl} alt="Signature RH" className="h-24 w-full max-w-xs rounded-lg border bg-white object-contain p-2" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPadOpen(true)} disabled={pendingAction !== null}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Remplacer
              </Button>
              <Button type="button" variant="outline" onClick={handleRemove} disabled={pendingAction !== null}>
                <Trash2 className="mr-2 h-4 w-4" />
                {pendingAction === 'remove' ? 'Suppression...' : 'Retirer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => setPadOpen(true)} disabled={pendingAction !== null}>
          <PencilLine className="mr-2 h-4 w-4" />
          {pendingAction === 'draw' ? 'Enregistrement...' : 'Draw Signature'}
        </Button>
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={pendingAction !== null}>
          <Upload className="mr-2 h-4 w-4" />
          {pendingAction === 'upload' ? 'Envoi...' : 'Upload PNG'}
        </Button>
      </div>

      <SignaturePad
        open={padOpen}
        onClose={() => setPadOpen(false)}
        onSave={async (pngDataUrl) => {
          const file = await dataUrlToSignatureFile(pngDataUrl, 'signature.png')
          await submitSignature(file, 'draw')
        }}
      />
    </div>
  )
}
