'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Send, MessageSquare, Users, Plus, Search } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'
import { MessageNotificationPopup } from '@/components/message-notification-popup'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

interface Participant {
  id: string
  name: string
  email: string
  role: string
}

interface LastMessage {
  id: string
  content: string
  senderId: string
  senderName: string
  createdAt: string
}

interface Conversation {
  id: string
  type: 'PRIVATE' | 'GROUP'
  name: string | null
  participants: Participant[]
  lastMessage: LastMessage | null
  unreadCount: number
  createdAt: string
  updatedAt: string
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department?: string
  position?: string
}

interface Message {
  id: string
  content: string
  senderId: string
  conversationId: string
  sender: {
    id: string
    name: string
    email: string
    role: string
    avatar?: string | null
  }
  reads?: { employeeId: string }[]
  createdAt: string
}

export default function ChatPage() {
  const { user, socket: globalSocket } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [conversationType, setConversationType] = useState<'PRIVATE' | 'GROUP'>('PRIVATE')
  const [groupName, setGroupName] = useState('')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const pathname = usePathname()
  const [popupNotification, setPopupNotification] = useState<{
    id: string
    conversationId: string
    senderName: string
    senderInitials: string
    messagePreview: string
    timestamp: Date
  } | null>(null)

  // Use global socket from auth context
  const socket = globalSocket

  // Set isClient to true after hydration
  useEffect(() => {
    setIsClient(true)
    // Initialize audio context for sound notifications
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    // Listen for avatar updates from other users
    const handleAvatarUpdate = (e: CustomEvent) => {
      const { userId, avatar } = e.detail
      saveProfilePicture(userId, avatar)
      // Force re-render to show new avatar
      setConversations([...conversations])
      setMessages([...messages])
      setEmployees([...employees])
    }

    window.addEventListener('avatarUpdated', handleAvatarUpdate as EventListener)
    return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate as EventListener)
  }, [conversations, messages, employees])

  // Filter employees based on search query
  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fetch employees when dialog opens
  useEffect(() => {
    if (!isNewConversationOpen) return

    const fetchEmployees = async () => {
      setIsLoadingEmployees(true)
      try {
        const res = await fetch('/api/employees/chat')
        if (res.ok) {
          const data = await res.json()
          setEmployees(data)
        }
      } catch (error) {
        console.error('Error fetching employees:', error)
      } finally {
        setIsLoadingEmployees(false)
      }
    }

    fetchEmployees()
  }, [isNewConversationOpen])

  // Toggle employee selection for group conversations
  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  // Handle dialog close
  const handleDialogClose = (open: boolean) => {
    setIsNewConversationOpen(open)
    if (!open) {
      setConversationType('PRIVATE')
      setGroupName('')
      setSelectedEmployeeIds([])
      setSearchQuery('')
    }
  }

  // Create new conversation
  const handleCreateConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: conversationType,
          name: conversationType === 'GROUP' ? groupName : undefined,
          participantIds: selectedEmployeeIds
        })
      })

      if (res.ok) {
        const newConversation = await res.json()
        
        // Add to conversations list if not already there
        setConversations(prev => {
          const exists = prev.some(conv => conv.id === newConversation.id)
          if (exists) return prev
          return [newConversation, ...prev]
        })
        
        // Select the new conversation
        setSelectedConversation(newConversation)
        
        // Close the dialog
        handleDialogClose(false)
      } else {
        // Handle error response
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to create conversation'
        console.error('Error creating conversation:', errorMessage)
        alert(`Erreur: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Erreur lors de la création de la conversation')
    }
  }

  // Listen to socket events for messages
  useEffect(() => {
    if (!socket || !user) return

    socket.on('new_message', (message: Message) => {
      // Update avatar cache if sender avatar is included
      if (message.sender?.avatar) {
        saveProfilePicture(message.sender.id, message.sender.avatar)
      }
      
      // Update conversation list with new message
      setConversations(prev => prev.map(conv => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            lastMessage: {
              id: message.id,
              content: message.content,
              senderId: message.senderId,
              senderName: message.sender.name,
              createdAt: message.createdAt
            },
            unreadCount: message.senderId !== user.id 
              ? (selectedConversation?.id === message.conversationId ? 0 : conv.unreadCount + 1)
              : conv.unreadCount
          }
        }
        return conv
      }))

      // Refresh notifications after unread count changes
      if (message.senderId !== user.id && (!selectedConversation || message.conversationId !== selectedConversation.id)) {
        window.dispatchEvent(new Event('refreshNotifications'))
      }

      // If message is for the currently selected conversation, add it to messages
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message])
        scrollToBottom()
      }

      // Play notification sound for messages not from current user
      // Only play if the message is NOT in the currently open conversation
      if (message.senderId !== user.id && (!selectedConversation || message.conversationId !== selectedConversation.id)) {
        playNotificationSound()
        setPopupNotification({
          id: message.id,
          conversationId: message.conversationId,
          senderName: message.sender.name,
          senderInitials: getInitials(message.sender.name),
          messagePreview: message.content.substring(0, 60),
          timestamp: new Date(message.createdAt)
        })
      }
    })

    socket.on('message_sent', (message: Message) => {
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        // Update avatar cache if sender avatar is included
        if (message.sender?.avatar) {
          saveProfilePicture(message.sender.id, message.sender.avatar)
        }
        setMessages(prev => [...prev, message])
        scrollToBottom()
      }
    })

    return () => {
      socket.off('new_message')
      socket.off('message_sent')
    }
  }, [socket, user, selectedConversation])

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/conversations')
        if (res.ok) {
          const data = await res.json()
          setConversations(data)
          
          // Update avatar cache with fresh data from server
          data.forEach((conversation: any) => {
            conversation.participants.forEach((participant: any) => {
              if (participant.avatar) {
                saveProfilePicture(participant.id, participant.avatar)
              }
            })
          })
        }
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setIsLoadingConversations(false)
      }
    }

    fetchConversations()
  }, [])

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation) return

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const res = await fetch(`/api/conversations/${selectedConversation.id}/messages?limit=50`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages)
          
          // Update avatar cache with fresh data from server
          data.messages.forEach((message: any) => {
            if (message.sender?.avatar) {
              saveProfilePicture(message.sender.id, message.sender.avatar)
            }
          })
          
          scrollToBottom()
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [selectedConversation])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !socket || !user) return

    const recipient = selectedConversation.participants.find(p => p.id !== user.id)
    if (!recipient) return

    socket.emit('send_message', {
      conversationId: selectedConversation.id,
      content: newMessage.trim(),
      recipientId: recipient.id
    })

    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getConversationName = (conversation: Conversation) => {
    if (conversation.type === 'GROUP') {
      return conversation.name || 'Group Chat'
    }
    const otherParticipant = conversation.participants.find(p => p.id !== user?.id)
    return otherParticipant?.name || 'Unknown'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Get profile picture from localStorage, with auto-refresh
  const getProfilePicture = (userId: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const profilePictures = localStorage.getItem('user_profile_pictures')
      if (profilePictures) {
        const pictures = JSON.parse(profilePictures)
        return pictures[userId] || null
      }
    } catch (error) {
      console.error('Error loading profile picture:', error)
    }
    return null
  }

  // Save profile picture to cache
  const saveProfilePicture = (userId: string, avatar: string | null) => {
    if (typeof window === 'undefined') return
    try {
      const profilePictures = localStorage.getItem('user_profile_pictures')
      const pictures = profilePictures ? JSON.parse(profilePictures) : {}
      
      if (avatar) {
        pictures[userId] = avatar
      } else {
        delete pictures[userId]
      }
      
      localStorage.setItem('user_profile_pictures', JSON.stringify(pictures))
    } catch (error) {
      console.error('Error saving profile picture:', error)
    }
  }

  // Play notification sound for new messages
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier'
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) {
      return "à l'instant"
    } else if (diffMinutes < 60) {
      return `il y a ${diffMinutes} min`
    } else if (diffHours < 24) {
      return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
    } else if (diffDays < 7) {
      return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }
  }

  const handlePopupNavigate = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      setSelectedConversation(conversation)
    }
  }

  if (!user) return null

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-lg overflow-hidden border" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
      {/* Left Panel - Conversations List */}
      <div className="w-80 flex flex-col border-r" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <MessageSquare className="h-5 w-5" />
              Messages
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewConversationOpen(true)}
            className="w-full mt-3 gap-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-32">
              <BrandedLoading />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Aucune conversation</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={async () => {
                    setSelectedConversation(conversation)
                    if (conversation.unreadCount > 0) {
                      try {
                        await fetch(`/api/conversations/${conversation.id}/read`, {
                          method: 'PATCH'
                        })
                        setConversations(prev => prev.map(conv =>
                          conv.id === conversation.id
                            ? { ...conv, unreadCount: 0 }
                            : conv
                        ))
                        window.dispatchEvent(new Event('refreshNotifications'))
                      } catch (error) {
                        console.error('Error marking messages as read:', error)
                      }
                    }
                  }}
                  className={cn(
                    "w-full p-3 flex items-start gap-3 hover:bg-opacity-50 transition-all text-left",
                    selectedConversation?.id === conversation.id ? "bg-opacity-80" : ""
                  )}
                  style={{
                    backgroundColor: selectedConversation?.id === conversation.id
                      ? 'var(--color-bg-tertiary)'
                      : 'transparent'
                  }}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {conversation.type === 'GROUP' ? (
                      <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                        <Users className="h-4 w-4" />
                      </AvatarFallback>
                    ) : (() => {
                      const otherParticipant = conversation.participants.find(p => p.id !== user?.id)
                      const profilePicture = otherParticipant ? getProfilePicture(otherParticipant.id) : null
                      return profilePicture ? (
                        <img
                          src={profilePicture}
                          alt={getConversationName(conversation)}
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                          {getInitials(getConversationName(conversation))}
                        </AvatarFallback>
                      )
                    })()}
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {getConversationName(conversation)}
                      </h3>
                      {conversation.lastMessage && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                          {isClient ? formatRelativeTime(conversation.lastMessage.createdAt) : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs truncate pr-2" style={{ color: 'var(--color-text-muted)' }}>
                        {conversation.lastMessage ? (
                          <>
                            {conversation.lastMessage.senderId === user.id && 'Vous: '}
                            {conversation.lastMessage.content}
                          </>
                        ) : (
                          'Aucun message'
                        )}
                      </p>

                      {conversation.unreadCount > 0 && (
                        <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-xs flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Message Thread */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <Avatar className="h-10 w-10 flex-shrink-0">
                {selectedConversation.type === 'GROUP' ? (
                  <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                    <Users className="h-5 w-5" />
                  </AvatarFallback>
                ) : (() => {
                  const other = selectedConversation.participants.find(p => p.id !== user?.id)
                  const pic = other ? getProfilePicture(other.id) : null
                  return pic ? (
                    <img src={pic} alt={getConversationName(selectedConversation)} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                      {getInitials(getConversationName(selectedConversation))}
                    </AvatarFallback>
                  )
                })()}
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate" style={{ color: 'var(--color-text)' }}>
                  {getConversationName(selectedConversation)}
                </h3>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {selectedConversation.type === 'GROUP'
                    ? `${selectedConversation.participants.length} participants`
                    : selectedConversation.participants.find(p => p.id !== user.id)?.role
                  }
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <BrandedLoading />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
                  <p style={{ color: 'var(--color-text-muted)' }}>Aucun message dans cette conversation</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Envoyez le premier message !</p>
                </div>
              ) : (
                <div className="flex flex-col min-h-full justify-end">
                  <div className="space-y-0.5">
                    {messages.map((message, index) => {
                      const isMine = message.senderId === user.id
                      const prevMessage = messages[index - 1]
                      const showDate = !prevMessage || formatDate(message.createdAt) !== formatDate(prevMessage.createdAt)
                      const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId
                      const isConsecutive = prevMessage && prevMessage.senderId === message.senderId
                      
                      return (
                        <div key={message.id}>
                          {showDate && (
                            <div className="flex justify-center my-4">
                              <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--color-text-muted)' }}>
                                {formatDate(message.createdAt)}
                              </span>
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex gap-2",
                              isMine ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isMine && (
                              <div className="flex-shrink-0 w-9">
                                {!isConsecutive ? (
                                  <Avatar className="h-9 w-9">
                                    {(() => {
                                      const profilePicture = getProfilePicture(message.sender.id)
                                      return profilePicture ? (
                                        <img src={profilePicture} alt={message.sender.name} className="h-full w-full object-cover rounded-full" />
                                      ) : (
                                        <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '12px' }}>
                                          {getInitials(message.sender.name)}
                                        </AvatarFallback>
                                      )
                                    })()}
                                  </Avatar>
                                ) : <div />}
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[75%] py-2 px-3.5",
                                isMine
                                  ? isConsecutive 
                                    ? "rounded-2xl rounded-br-md" 
                                    : "rounded-2xl rounded-br-md rounded-bl-sm"
                                  : isConsecutive
                                    ? "rounded-2xl rounded-bl-md"
                                    : "rounded-2xl rounded-bl-md rounded-br-sm"
                              )}
                              style={{
                                backgroundColor: isMine ? 'var(--color-primary)' : 'var(--color-bg)',
                                color: isMine ? 'white' : 'var(--color-text)'
                              }}
                            >
                              {!isMine && !isConsecutive && (
                                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-primary)' }}>
                                  {message.sender.name}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap break-words leading-normal">
                                {message.content}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] mt-0.5",
                                  isMine ? "text-right" : "text-left"
                                )}
                                style={{ color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)' }}
                              >
                                {isClient ? formatTime(message.createdAt) : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <div className="flex gap-2 items-end">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Écrivez votre message..."
                  className="flex-1 min-h-[44px] max-h-32 resize-none"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                  rows={1}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="icon"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="h-16 w-16 mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              Sélectionnez une conversation
            </h3>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Choisissez une conversation dans la liste pour commencer à discuter
            </p>
          </div>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
            <DialogDescription>
              {conversationType === 'PRIVATE'
                ? 'Sélectionnez un employé pour démarrer une conversation'
                : 'Créez un groupe de conversation'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Conversation Type Toggle */}
            <div className="flex gap-2">
              <Button
                variant={conversationType === 'PRIVATE' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setConversationType('PRIVATE')
                  setSelectedEmployeeIds([])
                }}
                className="flex-1"
              >
                Privé
              </Button>
              <Button
                variant={conversationType === 'GROUP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setConversationType('GROUP')
                  setSelectedEmployeeIds([])
                }}
                className="flex-1"
              >
                Groupe
              </Button>
            </div>

            {/* Group Name Input (only for GROUP) */}
            {conversationType === 'GROUP' && (
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nom du groupe..."
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un employé..."
                className="pl-9"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {/* Employees List */}
            <ScrollArea className="h-64">
              {isLoadingEmployees ? (
                <div className="flex items-center justify-center h-32">
                  <BrandedLoading />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                  <Users className="h-8 w-8 mb-2 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    {searchQuery ? 'Aucun employé trouvé' : 'Aucun employé disponible'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      onClick={() => {
                        if (conversationType === 'PRIVATE') {
                          setSelectedEmployeeIds([employee.id])
                        } else {
                          toggleEmployeeSelection(employee.id)
                        }
                      }}
                      className={cn(
                        "w-full p-3 flex items-center gap-3 rounded-lg cursor-pointer transition-all",
                        conversationType === 'PRIVATE'
                          ? 'hover:opacity-80'
                          : 'hover:bg-opacity-80',
                        selectedEmployeeIds.includes(employee.id) && conversationType === 'PRIVATE'
                          ? 'ring-2 ring-offset-2'
                          : ''
                      )}
                      style={{
                        backgroundColor: selectedEmployeeIds.includes(employee.id)
                          ? 'var(--color-primary-light, rgba(59, 130, 246, 0.1))'
                          : 'var(--color-bg-secondary)'
                      }}
                    >
                      {conversationType === 'GROUP' && (
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            selectedEmployeeIds.includes(employee.id)
                              ? 'border-transparent'
                              : 'border-gray-300'
                          )}
                          style={{
                            backgroundColor: selectedEmployeeIds.includes(employee.id)
                              ? 'var(--color-primary)'
                              : 'transparent'
                          }}
                        >
                          {selectedEmployeeIds.includes(employee.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      <Avatar className="h-10 w-10">
                        {(() => {
                          const profilePicture = getProfilePicture(employee.id)
                          return profilePicture ? (
                            <img
                              src={profilePicture}
                              alt={employee.name}
                              className="h-full w-full object-cover rounded-full"
                            />
                          ) : (
                            <AvatarFallback style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                              {getInitials(employee.name)}
                            </AvatarFallback>
                          )
                        })()}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                          {employee.name}
                        </h4>
                        <p className="text-sm truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {employee.role} {employee.department && `• ${employee.department}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Create Button */}
            <Button
              onClick={handleCreateConversation}
              disabled={
                conversationType === 'PRIVATE'
                  ? selectedEmployeeIds.length !== 1
                  : !groupName.trim() || selectedEmployeeIds.length === 0
              }
              className="w-full"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              {conversationType === 'PRIVATE'
                ? 'Démarrer la conversation'
                : `Créer le groupe (${selectedEmployeeIds.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Notification Popup */}
      <MessageNotificationPopup
        notification={popupNotification}
        onDismiss={() => setPopupNotification(null)}
        onNavigate={handlePopupNavigate}
      />
    </div>
  )
}
