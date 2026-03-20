import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agentic Dentist',
  description: 'The dental practice that runs itself'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
