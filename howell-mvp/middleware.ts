// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/apply']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic    = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isApiAuth         = pathname.startsWith('/api/auth')
  const isApiPortal       = pathname.startsWith('/api/portals')
  const isApiJobs         = pathname === '/api/jobs' && request.method === 'GET'
  const isApiTalentPool   = pathname === '/api/talent-pool-data' && request.method === 'GET'
  const session           = request.cookies.get('howell-session')?.value

  if (!isPublic && !isApiAuth && !isApiPortal && !isApiJobs && !isApiTalentPool && session !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname === '/' && session === 'authenticated') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
