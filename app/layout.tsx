import type { Metadata } from 'next'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib'
import { NotificationProvider } from '@/lib/notification-context'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const runtime = "nodejs"

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-plus-jakarta' });

export const metadata: Metadata = {
  title: 'HR Portal - Request Management',
  description: 'Collaborative HR portal for managing employee requests and approvals',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${_plusJakarta.variable}`}>
        <script 
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('user_theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
