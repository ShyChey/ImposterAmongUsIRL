import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IRL Among Us',
  description: 'GPS-based social deduction party game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Tailwind CSS Play CDN for zero-config compilation */}
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Leaflet CSS CDN */}
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
          crossOrigin="" 
        />
      </head>
      <body className="bg-slate-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}