export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (email === 'demo@howell.com' && password === 'demo1234') {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('howell-session', 'authenticated', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    return res
  }
  return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
}
