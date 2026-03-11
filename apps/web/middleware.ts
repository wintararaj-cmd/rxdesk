import { NextRequest, NextResponse } from 'next/server';

// Auth protection is handled client-side in each portal's layout.tsx.
// This middleware provides a lightweight server-side guard: if there is no
// stored auth token in a cookie we redirect to the appropriate login page.
// Token refresh and role enforcement remain client-side.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Determine which portal is being accessed
  const isAdminRoute   = pathname.startsWith('/admin/dashboard');
  const isDoctorRoute  = pathname.startsWith('/doctor/dashboard');
  const isShopRoute    = pathname.startsWith('/dashboard');
  const isPatientRoute = pathname.startsWith('/patient/dashboard');

  // We cannot read the Zustand localStorage store on the server, so we look
  // for a cookie that the client sets on login (see apiClient token handling).
  // If absent, fall through — the client-side layout guard will redirect.
  // This prevents a flicker for unauthenticated server-rendered requests.
  const token = req.cookies.get('rxdesk-access-token')?.value;

  if (!token) {
    if (isAdminRoute)   return NextResponse.redirect(new URL('/admin/login',    req.url));
    if (isDoctorRoute)  return NextResponse.redirect(new URL('/doctor/login',   req.url));
    if (isShopRoute)    return NextResponse.redirect(new URL('/login',          req.url));
    if (isPatientRoute) return NextResponse.redirect(new URL('/patient/login',  req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/dashboard/:path*',
    '/doctor/dashboard/:path*',
    '/patient/dashboard/:path*',
  ],
};
