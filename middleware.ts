import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Strip port for local dev
  const host = hostname.split(':')[0]

  // Root domains — pass through normally
  const rootDomains = [
    'dentplus.ca',
    'www.dentplus.ca',
    'dentplus.vercel.app',
    'localhost',
  ]

  const isRootDomain = rootDomains.includes(host)

  // Check if it's a subdomain of dentplus.ca
  const isDentplusSubdomain = host.endsWith('.dentplus.ca') && !isRootDomain

  if (isDentplusSubdomain) {
    const slug = host.replace('.dentplus.ca', '')

    // Skip reserved subdomains
    if (['www', 'app', 'api', 'superadmin'].includes(slug)) {
      return NextResponse.next()
    }

    const path = url.pathname

    // Already internally rewritten — pass through
    if (path.startsWith('/clinic/')) {
      return NextResponse.next()
    }

    // Rewrite: demo.dentplus.ca/portal → /clinic/demo/portal
    url.pathname = `/clinic/${slug}${path === '/' ? '' : path}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
