import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  const host = hostname.split(':')[0]

  const rootDomains = [
    'dentplus.ca',
    'www.dentplus.ca',
    'dentplus.vercel.app',
    'localhost',
  ]

  const isRootDomain = rootDomains.includes(host)
  const isDentplusSubdomain = host.endsWith('.dentplus.ca') && !isRootDomain

  if (isDentplusSubdomain) {
    const slug = host.replace('.dentplus.ca', '')

    if (['www', 'app', 'api', 'superadmin'].includes(slug)) {
      return NextResponse.next()
    }

    const path = url.pathname

    // Never rewrite API routes, static files, or already-rewritten paths
    if (
      path.startsWith('/api/') ||
      path.startsWith('/clinic/') ||
      path.startsWith('/_next/') ||
      path.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }

    // Rewrite: demo.dentplus.ca/portal → /clinic/demo/portal
    url.pathname = `/clinic/${slug}${path === '/' ? '' : path}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
