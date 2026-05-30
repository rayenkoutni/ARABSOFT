import { useAuth } from '@/lib/contexts/auth.context'

export function useCurrentUser() {
  const auth = useAuth()

  return {
    user: auth.user,
    pendingUser: auth.pendingUser,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    isOtpVerified: auth.isOtpVerified,
    login: auth.login,
    logout: auth.logout,
    completeOtpVerification: auth.completeOtpVerification,
    socket: auth.socket,
    setOtpVerified: auth.setOtpVerified,
    switchRole: auth.switchRole,
  }
}
