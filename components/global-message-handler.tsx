'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MessageNotificationPopup } from '@/components/message-notification-popup'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface MessageData {
  id: string
  content: string
  conversationId: string
  sender: {
    id: string
    name: string
    email: string
    role: string
  }
  createdAt: string
}

export function GlobalMessageHandler() {
  const { user, socket } = useCurrentUser()
  const pathname = usePathname()
  const router = useRouter()
  const [popupNotification, setPopupNotification] = useState<{
    id: string
    conversationId: string
    senderName: string
    senderInitials: string
    messagePreview: string
    timestamp: Date
  } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const prevMessagesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }, [])

  const playNotificationSound = () => {
    if (!audioContextRef.current) return

    try {
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.2)
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((segment) => segment[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const handlePopupNavigate = (conversationId: string) => {
    router.push(`/dashboard/chat?conversation=${conversationId}`)
    setPopupNotification(null)
  }

  useEffect(() => {
    if (!socket || !user) return

    const handleNewMessage = (message: MessageData) => {
      if (message.sender.id === user.id) return
      if (prevMessagesRef.current.has(message.id)) return
      prevMessagesRef.current.add(message.id)

      const isOnChatPage = pathname === '/dashboard/chat'

      if (!isOnChatPage) {
        playNotificationSound()
        setPopupNotification({
          id: message.id,
          conversationId: message.conversationId,
          senderName: message.sender.name,
          senderInitials: getInitials(message.sender.name),
          messagePreview: message.content.substring(0, 60),
          timestamp: new Date(message.createdAt),
        })
        window.dispatchEvent(new Event('refreshNotifications'))
      } else {
        playNotificationSound()
      }
    }

    socket.on('new_message', handleNewMessage)

    return () => {
      socket.off('new_message', handleNewMessage)
    }
  }, [pathname, router, socket, user])

  if (!user || !socket) return null

  return (
    <MessageNotificationPopup
      notification={popupNotification}
      onDismiss={() => setPopupNotification(null)}
      onNavigate={handlePopupNavigate}
    />
  )
}
