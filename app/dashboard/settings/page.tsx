'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { REQUEST_TYPE, ROLE } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  deleteSignature as deleteRhSignature,
  fetchProfile,
  fetchSignature,
  fetchSlaConfig,
  transferRhAccess,
  updatePassword,
  updateProfile,
  updateSlaConfig,
} from '@/lib/services/client/settings.service'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SignatureUploader } from '@/components/ui/signature-uploader'
import { User, Bell, Lock, Palette, Eye, EyeOff, Save, X, Edit2, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type SlaConfig = {
  id: string
  requestType: string
  maxHours: number
  description?: string | null
}

export default function SettingsPage() {
  const { user, updateCurrentUser } = useCurrentUser()
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '' })
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })
  const [pwdErrors, setPwdErrors] = useState<string[]>([])
  const [notifications, setNotifications] = useState({
    email: true,
    newRequests: true,
    approvals: true,
    sla: true,
  })
  const [theme, setTheme] = useState('light')
  const [transferForm, setTransferForm] = useState({
    newEmail: '',
    newName: '',
    newPhone: '',
    currentPassword: '',
  })
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  useEffect(() => {
    if (!user) return

    const loadSettings = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const profile = await fetchProfile()
        setAvatarSrc(typeof profile.avatar === 'string' ? profile.avatar : null)
        setProfileData({
          name: typeof profile.name === 'string' ? profile.name : user.name,
          email: typeof profile.email === 'string' ? profile.email : user.email,
          phone: typeof profile.phone === 'string' ? profile.phone : '',
        })

        if (user.role === ROLE.HR) {
          const signature = await fetchSignature()
          setSignatureUrl(typeof signature.signatureUrl === 'string' ? signature.signatureUrl : null)
        }
      } catch {
        setLoadError('Impossible de charger les donnees')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [user])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  if (!user) return null

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((segment) => segment[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 200 * 1024) {
      toast({
        description: "L'image est trop grande. Taille maximum autorisee: 200KB",
        className: 'bg-red-500 text-white border-none',
        duration: 5000,
      })
      e.target.value = ''
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        description: 'Format non supporte. Utilisez JPG, PNG ou WebP',
        className: 'bg-red-500 text-white border-none',
        duration: 5000,
      })
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setPendingAvatar(base64)
      setAvatarSrc(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAvatar = async () => {
    if (!pendingAvatar) return

    try {
      setIsSavingAvatar(true)
      const updatedUser = await updateProfile({ avatar: pendingAvatar })
      updateCurrentUser(updatedUser)
      setPendingAvatar(null)
      setAvatarSrc(updatedUser.avatar ?? pendingAvatar)
      window.dispatchEvent(new Event('avatarChange'))
      window.dispatchEvent(
        new CustomEvent('avatarUpdated', {
          detail: { userId: updatedUser.id, avatar: updatedUser.avatar ?? null },
        })
      )
      toast({
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
            <span>Photo de profil mise a jour</span>
          </div>
        ),
        className: 'bg-[#10B981] text-white border-none',
        duration: 3000,
      })
    } catch {
      toast({
        description: 'Erreur lors de la sauvegarde',
        className: 'bg-red-500 text-white border-none',
        duration: 3000,
      })
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleDeletePhoto = async () => {
    const previousAvatar = avatarSrc
    setAvatarSrc(null)

    try {
      const updatedUser = await updateProfile({ avatar: null })
      updateCurrentUser(updatedUser)
      window.dispatchEvent(new Event('avatarChange'))
      window.dispatchEvent(
        new CustomEvent('avatarUpdated', {
          detail: { userId: updatedUser.id, avatar: null },
        })
      )
    } catch {
      setAvatarSrc(previousAvatar)
      toast({
        description: 'Erreur lors de la suppression de la photo',
        className: 'bg-red-500 text-white border-none',
        duration: 3000,
      })
    }
  }

  const handleProfileSave = async () => {
    try {
      const updatedUser = await updateProfile(profileData)
      updateCurrentUser(updatedUser)
      setProfileData({
        name: updatedUser.name || profileData.name,
        email: updatedUser.email || profileData.email,
        phone: typeof updatedUser.phone === 'string' ? updatedUser.phone : profileData.phone,
      })
      setIsEditingProfile(false)
      toast({
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
            <span>Informations mises a jour</span>
          </div>
        ),
        className: 'bg-[#10B981] text-white border-none',
        duration: 3000,
      })
    } catch {
      toast({
        description: 'Erreur lors de la sauvegarde du profil',
        className: 'bg-red-500 text-white border-none',
        duration: 3000,
      })
    }
  }

  const handleProfileCancel = () => {
    setProfileData({
      name: user.name,
      email: user.email,
      phone: profileData.phone,
    })
    setIsEditingProfile(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []

    if (passwords.new.length < 8) errors.push('Doit contenir au moins 8 caracteres')
    if (!/\d/.test(passwords.new)) errors.push('Doit contenir au moins un chiffre')
    if (passwords.new !== passwords.confirm) errors.push('Les mots de passe ne correspondent pas')

    if (errors.length > 0) {
      setPwdErrors(errors)
      return
    }

    try {
      setPwdErrors([])
      await updatePassword(passwords)
      toast({
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
            <span>Mot de passe modifie avec succes</span>
          </div>
        ),
        className: 'bg-[#10B981] text-white border-none',
        duration: 3000,
      })
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (error) {
      setPwdErrors([error instanceof Error ? error.message : 'Erreur reseau.'])
    }
  }

  const handleToggleNotification = (key: keyof typeof notifications) => {
    setNotifications((current) => ({ ...current, [key]: !current[key] }))
    toast({
      description: 'Preferences sauvegardees',
      className: 'bg-[#10B981] text-white border-none',
      duration: 2000,
    })
  }

  const handleTransferAccess = async () => {
    try {
      setIsTransferring(true)
      setTransferError('')
      await transferRhAccess(transferForm)
      router.push('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Echec du transfert RH'
      setTransferError(message)
      toast({
        description: message,
        className: 'bg-red-500 text-white border-none',
        duration: 4000,
      })
    } finally {
      setShowTransferConfirm(false)
      setIsTransferring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {loadError && (
        <div className="text-destructive text-sm p-4 rounded border border-destructive/20">
          {loadError}
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Parametres</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Gerez votre compte et vos preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
        <TabsList className="flex md:flex-col h-auto bg-transparent items-start justify-start space-x-2 md:space-x-0 md:space-y-2 w-full md:w-64 overflow-x-auto pb-2 md:pb-0">
          <TabsTrigger value="profile" className="w-full justify-start rounded-none py-3">
            <User className="h-4 w-4 mr-2" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="w-full justify-start rounded-none py-3">
            <Lock className="h-4 w-4 mr-2" />
            Securite
          </TabsTrigger>
          <TabsTrigger value="notifications" className="w-full justify-start rounded-none py-3">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="w-full justify-start rounded-none py-3">
            <Palette className="h-4 w-4 mr-2" />
            Apparence
          </TabsTrigger>
          {user.role === ROLE.HR && (
            <TabsTrigger value="sla" className="w-full justify-start rounded-none py-3">
              <Clock className="h-4 w-4 mr-2" />
              SLA
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex-1 space-y-6">
          <TabsContent value="profile" className="space-y-6 m-0">
            <Card className="p-3 md:p-4 lg:p-5">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>Photo de profil</h2>
              <div className="flex items-center gap-6">
                <div
                  className="h-[100px] w-[100px] rounded-full overflow-hidden flex items-center justify-center border text-3xl font-bold"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(profileData.name || user.name)
                  )}
                </div>
                <div className="space-y-3">
                  <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Changer la photo
                  </Button>
                  {pendingAvatar && (
                    <Button onClick={handleSaveAvatar} disabled={isSavingAvatar}>
                      {isSavingAvatar ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                  )}
                  {avatarSrc && (
                    <button type="button" className="text-sm text-red-600 hover:underline" onClick={handleDeletePhoto}>
                      Supprimer la photo
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-3 md:p-4 lg:p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Informations personnelles</h2>
                {!isEditingProfile ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleProfileCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleProfileSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Nom complet" editing={isEditingProfile}>
                  <InputOrText
                    editing={isEditingProfile}
                    value={profileData.name}
                    onChange={(value) => setProfileData((current) => ({ ...current, name: value }))}
                  />
                </Field>
                <Field label="Adresse email" editing={isEditingProfile}>
                  <InputOrText
                    editing={isEditingProfile}
                    type="email"
                    value={profileData.email}
                    onChange={(value) => setProfileData((current) => ({ ...current, email: value }))}
                  />
                </Field>
                <Field label="Numero de telephone" editing={isEditingProfile}>
                  <InputOrText
                    editing={isEditingProfile}
                    type="tel"
                    value={profileData.phone}
                    placeholder="+216 12 345 678"
                    emptyValue="-"
                    onChange={(value) => setProfileData((current) => ({ ...current, phone: value }))}
                  />
                </Field>
                <Field label="Departement" editing={false}>
                  <p className="py-2" style={{ color: 'var(--color-text)' }}>{user.department || '-'}</p>
                </Field>
                <Field label="Poste" editing={false}>
                  <p className="py-2" style={{ color: 'var(--color-text)' }}>{user.role}</p>
                </Field>
              </div>
            </Card>

            {user.role === ROLE.HR && (
              <>
                <Card className="p-3 md:p-4 lg:p-5">
                  <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Signature</h2>
                  <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Cette signature sera utilisee dans les documents RH generes par la plateforme.
                  </p>
                  <SignatureUploader currentSignatureUrl={signatureUrl} onSignatureSaved={setSignatureUrl} />
                  {signatureUrl && (
                    <Button type="button" variant="outline" className="mt-4" onClick={async () => {
                      try {
                        await deleteRhSignature()
                        setSignatureUrl(null)
                      } catch {
                        toast({
                          description: 'Impossible de supprimer la signature',
                          className: 'bg-red-500 text-white border-none',
                          duration: 3000,
                        })
                      }
                    }}>
                      Supprimer la signature
                    </Button>
                  )}
                </Card>

                <Card className="p-3 md:p-4 lg:p-5 border-amber-300 dark:border-amber-900/60">
                  <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Transfer RH Account</h2>
                  <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    This will transfer RH access to a new account. Your personal data will be cleared. This cannot be undone.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldInput id="new-owner-email" label="New owner email" type="email" value={transferForm.newEmail} onChange={(value) => setTransferForm((current) => ({ ...current, newEmail: value }))} placeholder="nouveau.rh@company.com" />
                    <FieldInput id="new-owner-name" label="New owner name" value={transferForm.newName} onChange={(value) => setTransferForm((current) => ({ ...current, newName: value }))} placeholder="Nom complet RH" />
                    <FieldInput id="new-owner-phone" label="New owner phone" type="tel" value={transferForm.newPhone} onChange={(value) => setTransferForm((current) => ({ ...current, newPhone: value }))} placeholder="+216 XX XXX XXX" />
                    <FieldInput id="current-password-confirm" label="Your current password" type="password" value={transferForm.currentPassword} onChange={(value) => setTransferForm((current) => ({ ...current, currentPassword: value }))} />
                  </div>
                  {transferError && (
                    <div className="mt-4 rounded-lg p-3 text-sm text-red-600 border border-red-200">
                      {transferError}
                    </div>
                  )}
                  <div className="mt-5">
                    <Button
                      type="button"
                      disabled={!transferForm.newEmail || !transferForm.newName || !transferForm.newPhone || !transferForm.currentPassword || isTransferring}
                      onClick={() => setShowTransferConfirm(true)}
                    >
                      Transfer Access
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="security" className="m-0">
            <Card className="p-3 md:p-4 lg:p-5">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>Changer le mot de passe</h2>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                <PasswordField id="current" label="Mot de passe actuel" visible={showPwd.current} value={passwords.current} onToggle={() => setShowPwd((current) => ({ ...current, current: !current.current }))} onChange={(value) => setPasswords((current) => ({ ...current, current: value }))} />
                <div className="space-y-2 border-t pt-4 mt-6" style={{ borderColor: 'var(--color-border)' }}>
                  <PasswordField id="new" label="Nouveau mot de passe" visible={showPwd.new} value={passwords.new} onToggle={() => setShowPwd((current) => ({ ...current, new: !current.new }))} onChange={(value) => setPasswords((current) => ({ ...current, new: value }))} />
                  {pwdErrors.map((error) => (
                    <p key={error} className="text-xs" style={{ color: 'var(--color-danger)' }}>- {error}</p>
                  ))}
                </div>
                <PasswordField id="confirm" label="Confirmer le nouveau mot de passe" visible={showPwd.confirm} value={passwords.confirm} onToggle={() => setShowPwd((current) => ({ ...current, confirm: !current.confirm }))} onChange={(value) => setPasswords((current) => ({ ...current, confirm: value }))} />
                <Button type="submit" className="mt-6">Mettre a jour</Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="m-0">
            <Card className="p-3 md:p-4 lg:p-5">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>Preferences de notification</h2>
              <div className="space-y-6">
                <NotificationRow title="Recevoir les notifications par email" description="Alertes systeme et emails importants" checked={notifications.email} onCheckedChange={() => handleToggleNotification('email')} />
                <NotificationRow title="Nouvelles demandes" description="Etre averti lorsqu'une demande est creee" checked={notifications.newRequests} onCheckedChange={() => handleToggleNotification('newRequests')} />
                <NotificationRow title="Approbations et refus" description="Recevoir une alerte quand le statut change" checked={notifications.approvals} onCheckedChange={() => handleToggleNotification('approvals')} />
                <NotificationRow title="Rappels SLA" description="Avertissements avant expiration des delais" checked={notifications.sla} onCheckedChange={() => handleToggleNotification('sla')} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="m-0">
            <Card className="p-3 md:p-4 lg:p-5">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>Apparence</h2>
              <div className="grid grid-cols-2 max-w-sm gap-4">
                <button type="button" className={`rounded-lg border-2 p-4 ${theme === 'light' ? 'border-[#1B3A6B]' : 'border-[#E2E8F0]'}`} onClick={() => setTheme('light')}>
                  <div className="h-16 w-full rounded-md bg-[#F4F6FA] border border-[#E2E8F0]" />
                  <span className="mt-3 block font-medium">Clair</span>
                </button>
                <button type="button" className={`rounded-lg border-2 p-4 ${theme === 'dark' ? 'border-[#1B3A6B]' : 'border-[#E2E8F0]'}`} onClick={() => setTheme('dark')}>
                  <div className="h-16 w-full rounded-md bg-[#0F172A] border border-[#334155]" />
                  <span className="mt-3 block font-medium">Sombre</span>
                </button>
              </div>
            </Card>
          </TabsContent>

          {user.role === ROLE.HR && (
            <TabsContent value="sla" className="m-0">
              <SlaSettingsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>

      <ConfirmDialog
        open={showTransferConfirm}
        title="Transfer RH account"
        message="You will be logged out immediately. The new owner will receive login credentials by email."
        confirmLabel="Transfer Access"
        isLoading={isTransferring}
        onCancel={() => setShowTransferConfirm(false)}
        onConfirm={handleTransferAccess}
      />
    </div>
  )
}

function SlaSettingsTab() {
  const [configs, setConfigs] = useState<SlaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchSlaConfig()
        setConfigs(Array.isArray(data) ? data : [])
      } catch {
        setError('Impossible de charger les donnees')
      } finally {
        setLoading(false)
      }
    }

    void loadConfigs()
  }, [])

  const handleUpdate = async (id: string, maxHours: number) => {
    try {
      await updateSlaConfig(id, { maxHours })
      setConfigs((current) => current.map((config) => (config.id === id ? { ...config, maxHours } : config)))
    } catch {
      setError('Impossible de charger les donnees')
    }
  }

  const labels: Record<string, string> = {
    [REQUEST_TYPE.LEAVE]: 'Conge',
    [REQUEST_TYPE.AUTHORIZATION]: 'Autorisation',
    [REQUEST_TYPE.LOAN]: 'Pret',
    [REQUEST_TYPE.DOCUMENT]: 'Document',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <Card className="p-3 md:p-4 lg:p-5">
      {error && (
        <div className="text-destructive text-sm p-4 rounded border border-destructive/20 mb-4">
          {error}
        </div>
      )}
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>Configuration SLA</h2>
      {configs.length === 0 ? (
        <p className="text-center py-4 text-muted-foreground">Aucune configuration SLA</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium">Type</th>
                <th className="text-left py-3 font-medium">Delai (heures)</th>
                <th className="text-left py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id} className="border-b">
                  <td className="py-3">{labels[config.requestType] || config.requestType}</td>
                  <td className="py-3">
                    <Input
                      type="number"
                      value={config.maxHours}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10)
                        if (value > 0) {
                          void handleUpdate(config.id, value)
                        }
                      }}
                      className="w-24"
                    />
                  </td>
                  <td className="py-3 text-muted-foreground">{config.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Field({ label, children }: { label: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function InputOrText({
  editing,
  value,
  onChange,
  type = 'text',
  placeholder,
  emptyValue,
}: {
  editing: boolean
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  emptyValue?: string
}) {
  if (editing) {
    return <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  }

  return <p className="py-2">{value || emptyValue || ''}</p>
}

function FieldInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  id: string
  label: string
  value: string
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required style={{ paddingRight: '40px' }} />
        <button type="button" aria-label="Afficher le mot de passe" className="absolute right-3 top-2.5 text-[#64748B]" onClick={onToggle}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function NotificationRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      <div className="h-px bg-border last:hidden" />
    </>
  )
}
