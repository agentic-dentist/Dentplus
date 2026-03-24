import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Strip port for local dev
  const host = hostname.replace(':3000', '').replace(':3001', '')

  // Production domains
  const rootDomains = [
    'dentplus.ca',
    'www.dentplus.ca',
    'dentplus.vercel.app',
    'localhost',
  ]

  const isRootDomain = rootDomains.some(d => host === d || host.endsWith(d))

  // If it's a subdomain (e.g. demo.dentplus.ca)
  if (!isRootDomain && host.includes('.')) {
    const slug = host.split('.')[0]

    // Skip non-clinic subdomains
    if (['www', 'app', 'api', 'superadmin'].includes(slug)) {
      return NextResponse.next()
    }

    // Rewrite subdomain requests to /clinic/[slug] internally
    // e.g. demo.dentplus.ca/portal → /clinic/demo/portal
    const path = url.pathname

    // Already has /clinic/ prefix — pass through
    if (path.startsWith('/clinic/')) {
      return NextResponse.next()
    }

    // Rewrite to clinic path
    url.pathname = `/clinic/${slug}${path === '/' ? '' : path}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes that don't need rewriting
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
