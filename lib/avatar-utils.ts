'use client'

import { useEffect, useState } from 'react'

// Avatar cache management utilities
const AVATAR_CACHE_KEY = 'user_profile_pictures'
const AVATAR_EXPIRY_KEY = 'user_profile_pictures_expiry'
const CACHE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

export const getAvatarCache = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}
  try {
    const cache = localStorage.getItem(AVATAR_CACHE_KEY)
    const expiry = localStorage.getItem(AVATAR_EXPIRY_KEY)
    
    // Clear expired cache
    if (expiry && Date.now() > parseInt(expiry)) {
      localStorage.removeItem(AVATAR_CACHE_KEY)
      localStorage.removeItem(AVATAR_EXPIRY_KEY)
      return {}
    }
    
    return cache ? JSON.parse(cache) : {}
  } catch {
    return {}
  }
}

export const saveAvatarToCache = (userId: string, avatar: string | null) => {
  if (typeof window === 'undefined') return
  try {
    const cache = getAvatarCache()
    if (avatar) {
      cache[userId] = avatar
    } else {
      delete cache[userId]
    }
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache))
    localStorage.setItem(AVATAR_EXPIRY_KEY, (Date.now() + CACHE_EXPIRY_MS).toString())
  } catch {
    // Ignore storage errors
  }
}

export const clearAvatarCache = (userId?: string) => {
  if (typeof window === 'undefined') return
  try {
    if (userId) {
      const cache = getAvatarCache()
      delete cache[userId]
      localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache))
    } else {
      localStorage.removeItem(AVATAR_CACHE_KEY)
      localStorage.removeItem(AVATAR_EXPIRY_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export const getCachedAvatar = (userId: string): string | null => {
  return getAvatarCache()[userId] || null
}

// Hook for automatic avatar refreshing
export const useAvatar = (userId: string, serverAvatar?: string | null) => {
  const [avatar, setAvatar] = useState<string | null>(() => {
    // Use server avatar if available, otherwise cache
    if (serverAvatar) return serverAvatar
    return getCachedAvatar(userId)
  })

  useEffect(() => {
    // Always prefer server avatar when available
    if (serverAvatar) {
      setAvatar(serverAvatar)
      saveAvatarToCache(userId, serverAvatar)
    }
  }, [userId, serverAvatar])

  return avatar
}

// Get initials from name
export const getInitials = (name: string): string => {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
