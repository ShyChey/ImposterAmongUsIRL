import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IRL Among Us',
  description: 'Birthday Party Social Deduction Game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  )
}