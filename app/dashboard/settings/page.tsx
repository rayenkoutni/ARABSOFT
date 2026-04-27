'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { User, Bell, Lock, Palette, Eye, EyeOff, Save, X, Edit2, CheckCircle2, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  if (!user) return null

  // ---- SECTION 1: PROFILE PICTURE ----
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkAvatar = async () => {
      try {
        const res = await fetch('/api/employees/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.avatar) {
            setAvatarSrc(data.avatar)
          }
        }
      } catch (e) {
        console.error('Failed to fetch profile:', e)
      }
    }
    checkAvatar()
  }, [])

  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 200KB)
    if (file.size > 200 * 1024) {
      toast({
        description: "L'image est trop grande. Taille maximum autorisée: 200KB",
        className: "bg-red-500 text-white border-none",
        duration: 5000,
      })
      e.target.value = ''
      return
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({
        description: "Format non supporté. Utilisez JPG, PNG ou WebP",
        className: "bg-red-500 text-white border-none",
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
    
    setIsSavingAvatar(true)
    try {
      console.log("📤 Sending avatar to server, length:", pendingAvatar.length)
      const res = await fetch('/api/employees/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: pendingAvatar })
      })
      
      console.log("📥 Response status:", res.status)
      
      if (res.ok) {
        const updatedUser = await res.json()
        console.log("📥 Response data:", updatedUser)
        
        // Update local storage and trigger refresh
        const currentUserData = JSON.parse(localStorage.getItem('hr_user') || '{}')
        const newUserData = { ...currentUserData, ...updatedUser }
        localStorage.setItem('hr_user', JSON.stringify(newUserData))
        localStorage.setItem('user_avatar', updatedUser.avatar || '')
        
        // Broadcast avatar change to all tabs and clear cache for this user
        window.dispatchEvent(new Event('avatarChange'))
        window.dispatchEvent(new CustomEvent('avatarUpdated', { 
          detail: { userId: newUserData.id, avatar: updatedUser.avatar } 
        }))
        
        // Clear this user's avatar from cache so other components reload fresh data
        if (typeof window !== 'undefined') {
          try {
            const cache = localStorage.getItem('user_profile_pictures')
            if (cache) {
              const pictures = JSON.parse(cache)
              delete pictures[newUserData.id]
              localStorage.setItem('user_profile_pictures', JSON.stringify(pictures))
            }
          } catch (e) {
            console.error('Error clearing avatar cache:', e)
          }
        }
        setPendingAvatar(null)
        
        toast({
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <span>Photo de profil mise à jour</span>
            </div>
          ),
          className: "bg-[#10B981] text-white border-none",
          duration: 3000,
        })
      } else {
        const error = await res.json()
        console.error("❌ Server error:", error)
        toast({
          description: "Erreur lors de la sauvegarde",
          className: "bg-red-500 text-white border-none",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('❌ Error saving avatar:', error)
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleDeletePhoto = async () => {
    const previousAvatar = avatarSrc
    setAvatarSrc(null)
    
      try {
        await fetch('/api/employees/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: null })
        })
        const currentUserData = JSON.parse(localStorage.getItem('hr_user') || '{}')
        localStorage.setItem('user_avatar', '')
        window.dispatchEvent(new Event('avatarChange'))
        window.dispatchEvent(new CustomEvent('avatarUpdated', { 
          detail: { userId: currentUserData.id, avatar: null } 
        }))
    } catch (error) {
      setAvatarSrc(previousAvatar)
      console.error('Error deleting avatar:', error)
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
  }

  // ---- SECTION 2: PERSONAL INFORMATION ----
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: '', // Not in default user, added for the form
  })

  // Load from local storage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('user_profile')
    if (savedProfile) {
      setProfileData({ ...profileData, ...JSON.parse(savedProfile) })
    }
  }, [])

  const handleProfileSave = () => {
    localStorage.setItem('user_profile', JSON.stringify(profileData))
    setIsEditingProfile(false)
    toast({
      description: (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
          <span>Informations mises à jour</span>
        </div>
      ),
      className: "bg-[#10B981] text-white border-none",
      duration: 3000,
    })
  }

  const handleProfileCancel = () => {
    const savedProfile = localStorage.getItem('user_profile')
    if (savedProfile) {
      setProfileData({ ...profileData, ...JSON.parse(savedProfile) })
    } else {
      setProfileData({ name: user.name, email: user.email, phone: '' })
    }
    setIsEditingProfile(false)
  }

  // ---- SECTION 3: CHANGE PASSWORD ----
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })
  const [pwdErrors, setPwdErrors] = useState<string[]>([])
  
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdErrors([])
    
    const errors = []
    if (passwords.new.length < 8) errors.push("Doit contenir au moins 8 caractères")
    if (!/\d/.test(passwords.new)) errors.push("Doit contenir au moins un chiffre")
    if (passwords.new !== passwords.confirm) errors.push("Les mots de passe ne correspondent pas")

    if (errors.length > 0) {
      setPwdErrors(errors)
      return
    }

    // Mock API call
    try {
      await fetch('/api/auth/password', { method: 'PATCH', body: JSON.stringify(passwords) })
      // Show success
      toast({
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
            <span>Mot de passe modifié avec succès</span>
          </div>
        ),
        className: "bg-[#10B981] text-white border-none",
        duration: 3000,
      })
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      // Ignore mock failure
    }
  }

  // ---- SECTION 4: NOTIFICATIONS ----
  const [notifications, setNotifications] = useState({
    email: true,
    newRequests: true,
    approvals: true,
    sla: true
  })

  useEffect(() => {
    const saved = localStorage.getItem('user_notifications')
    if (saved) setNotifications(JSON.parse(saved))
  }, [])

  const handleToggleNotification = (key: keyof typeof notifications) => {
    const next = { ...notifications, [key]: !notifications[key] }
    setNotifications(next)
    localStorage.setItem('user_notifications', JSON.stringify(next))
    toast({
      description: "Préférences sauvegardées",
      className: "bg-[#10B981] text-white border-none",
      duration: 2000,
    })
  }

  // ---- SECTION 5: APPEARANCE ----
  const [theme, setTheme] = useState('light')
  useEffect(() => {
    const saved = localStorage.getItem('user_theme')
    if (saved) setTheme(saved)
  }, [])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('user_theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Paramètres</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Gérez votre compte et vos préférences
        </p>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
        <TabsList className="flex md:flex-col h-auto bg-transparent items-start justify-start space-x-2 md:space-x-0 md:space-y-2 w-full md:w-64 overflow-x-auto pb-2 md:pb-0">
          <TabsTrigger 
            value="profile" 
            className="w-full justify-start data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:border-l-4 data-[state=active]:border-[#1B3A6B] data-[state=active]:shadow-sm rounded-none py-3"
          >
            <User className="h-4 w-4 mr-2" />
            Profil
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="w-full justify-start data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:border-l-4 data-[state=active]:border-[#1B3A6B] data-[state=active]:shadow-sm rounded-none py-3"
          >
            <Lock className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="w-full justify-start data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:border-l-4 data-[state=active]:border-[#1B3A6B] data-[state=active]:shadow-sm rounded-none py-3"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger 
            value="appearance" 
            className="w-full justify-start data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:border-l-4 data-[state=active]:border-[#1B3A6B] data-[state=active]:shadow-sm rounded-none py-3"
          >
            <Palette className="h-4 w-4 mr-2" />
            Apparence
          </TabsTrigger>
          {user.role === 'RH' && (
            <TabsTrigger 
              value="sla" 
              className="w-full justify-start data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:border-l-4 data-[state=active]:border-[#1B3A6B] data-[state=active]:shadow-sm rounded-none py-3"
            >
              <Clock className="h-4 w-4 mr-2" />
              SLA
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex-1 space-y-6">
          <TabsContent value="profile" className="space-y-6 m-0 opacity-100 animate-in fade-in duration-300">
            {/* Avatar Section */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-brand-navy)' }}>Photo de profil</h2>
              <div className="flex items-center gap-6">
                <div 
                  className="h-[100px] w-[100px] rounded-full overflow-hidden flex items-center justify-center bg-[#F4F6FA] text-[#1B3A6B] text-3xl font-bold border border-[#E2E8F0]"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(profileData.name || user.name)
                  )}
                </div>
                <div className="space-y-3">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    Changer la photo
                  </Button>
                  {pendingAvatar && (
                    <Button 
                      onClick={handleSaveAvatar}
                      disabled={isSavingAvatar}
                      style={{ backgroundColor: 'var(--color-brand-navy)', color: 'white' }}
                    >
                      {isSavingAvatar ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                  )}
                  {avatarSrc && (
                    <div 
                      className="text-sm cursor-pointer hover:underline" 
                      style={{ color: 'var(--color-danger)' }}
                      onClick={handleDeletePhoto}
                    >
                      Supprimer la photo
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Personal Info Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-brand-navy)' }}>Informations personnelles</h2>
                {!isEditingProfile ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsEditingProfile(true)}
                    style={{ color: '#F5A623' }}
                    className="hover:bg-amber-50"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleProfileCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleProfileSave}
                      style={{ backgroundColor: 'var(--color-brand-navy)', color: 'white' }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-muted)' }}>Nom complet</Label>
                  {isEditingProfile ? (
                    <Input 
                      value={profileData.name} 
                      onChange={(e) => setProfileData({...profileData, name: e.target.value})} 
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  ) : (
                    <p className="py-2" style={{ color: 'var(--color-text)' }}>{profileData.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-muted)' }}>Adresse email</Label>
                  {isEditingProfile ? (
                    <Input 
                      type="email"
                      value={profileData.email} 
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})} 
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  ) : (
                    <p className="py-2" style={{ color: 'var(--color-text)' }}>{profileData.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-muted)' }}>Numéro de téléphone</Label>
                  {isEditingProfile ? (
                    <Input 
                      type="tel"
                      value={profileData.phone} 
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})} 
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="+216 12 345 678"
                    />
                  ) : (
                    <p className="py-2" style={{ color: 'var(--color-text)' }}>{profileData.phone || "—"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-muted)' }}>Département</Label>
                  <Input 
                    value={user.department || "—"} 
                    disabled 
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', borderColor: 'transparent' }} 
                  />
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--color-text-muted)' }}>Poste</Label>
                  <Input 
                    value={user.role} 
                    disabled 
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', borderColor: 'transparent' }} 
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="m-0 opacity-100 animate-in fade-in duration-300">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-brand-navy)' }}>Changer le mot de passe</h2>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                
                <div className="space-y-2">
                  <Label htmlFor="current">Mot de passe actuel</Label>
                  <div className="relative">
                    <Input 
                      id="current"
                      type={showPwd.current ? "text" : "password"} 
                      value={passwords.current}
                      onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                      required
                      style={{ borderColor: 'var(--color-border)', paddingRight: '40px' }}
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-[#64748B]" onClick={() => setShowPwd({...showPwd, current: !showPwd.current})}>
                      {showPwd.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 mt-6" style={{ borderColor: 'var(--color-border)' }}>
                  <Label htmlFor="new">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input 
                      id="new"
                      type={showPwd.new ? "text" : "password"} 
                      value={passwords.new}
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                      required
                      style={{ borderColor: pwdErrors.length ? 'var(--color-danger)' : 'var(--color-border)', paddingRight: '40px' }}
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-[#64748B]" onClick={() => setShowPwd({...showPwd, new: !showPwd.new})}>
                      {showPwd.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwdErrors.map((err, i) => (
                    <p key={i} className="text-xs" style={{ color: 'var(--color-danger)' }}>• {err}</p>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
                  <div className="relative">
                    <Input 
                      id="confirm"
                      type={showPwd.confirm ? "text" : "password"} 
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                      required
                      style={{ borderColor: 'var(--color-border)', paddingRight: '40px' }}
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-[#64748B]" onClick={() => setShowPwd({...showPwd, confirm: !showPwd.confirm})}>
                      {showPwd.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="mt-6" style={{ backgroundColor: 'var(--color-brand-navy)', color: 'white' }}>
                  Mettre à jour
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="m-0 opacity-100 animate-in fade-in duration-300">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-brand-navy)' }}>Préférences de notification</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Recevoir les notifications par email</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Alertes système et emails importants</p>
                  </div>
                  <Switch checked={notifications.email} onCheckedChange={() => handleToggleNotification('email')} />
                </div>
                
                <div className="h-px bg-[#E2E8F0]" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Nouvelles demandes</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Être averti lorsqu'une demande est créée</p>
                  </div>
                  <Switch checked={notifications.newRequests} onCheckedChange={() => handleToggleNotification('newRequests')} />
                </div>

                <div className="h-px bg-[#E2E8F0]" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Approbations & Refus</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Recevoir une alerte quand le statut change</p>
                  </div>
                  <Switch checked={notifications.approvals} onCheckedChange={() => handleToggleNotification('approvals')} />
                </div>

                <div className="h-px bg-[#E2E8F0]" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Rappels SLA</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Avertissements avant expiration des délais</p>
                  </div>
                  <Switch checked={notifications.sla} onCheckedChange={() => handleToggleNotification('sla')} />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="m-0 opacity-100 animate-in fade-in duration-300">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-brand-navy)' }}>Apparence</h2>
              
              <div className="grid grid-cols-2 max-w-sm gap-4">
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-3 transition-all ${theme === 'light' ? 'border-[#1B3A6B] bg-slate-50' : 'border-[#E2E8F0] hover:border-slate-300'}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <div className="h-16 w-full rounded-md bg-[#F4F6FA] border border-[#E2E8F0]"></div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Clair</span>
                </div>
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer flex flex-col items-center gap-3 transition-all ${theme === 'dark' ? 'border-[#1B3A6B] bg-slate-50' : 'border-[#E2E8F0] hover:border-slate-300'}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <div className="h-16 w-full rounded-md bg-[#0F172A] border border-[#334155]"></div>
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>Sombre</span>
                </div>
              </div>
            </Card>
          </TabsContent>

          {user.role === 'RH' && (
            <TabsContent value="sla" className="m-0 opacity-100 animate-in fade-in duration-300">
              <SlaSettingsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}

function SlaSettingsTab() {
  const [configs, setConfigs] = useState<{ id: string; requestType: string; maxHours: number; description?: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sla-config').then((res) => res.json()).then((data) => { setConfigs(data); setLoading(false) })
  }, [])

  const handleUpdate = async (id: string, maxHours: number) => {
    await fetch(`/api/sla-config/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxHours }),
    })
    setConfigs(configs.map((c) => (c.id === id ? { ...c, maxHours } : c)))
  }

  const labels: Record<string, string> = { CONGE: 'Congé', AUTORISATION: 'Autorisation', PRET: 'Prêt', DOCUMENT: 'Document' }

  if (loading) return <div className="p-6 text-center">Chargement...</div>

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-brand-navy)' }}>Configuration SLA</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 font-medium" style={{ color: 'var(--color-text)' }}>Type</th>
              <th className="text-left py-3 font-medium" style={{ color: 'var(--color-text)' }}>Délai (heures)</th>
              <th className="text-left py-3 font-medium" style={{ color: 'var(--color-text)' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id} className="border-b">
                <td className="py-3" style={{ color: 'var(--color-text)' }}>{labels[config.requestType] || config.requestType}</td>
                <td className="py-3">
                  <Input
                    type="number"
                    value={config.maxHours}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (val > 0) handleUpdate(config.id, val)
                    }}
                    className="w-24"
                  />
                </td>
                <td className="py-3 text-muted-foreground">{config.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
