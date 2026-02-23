import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Cookie name where NestJS backend will set the JWT */
const JWT_COOKIE_NAME = 'token';

/** Role names in JWT may be uppercase (NestJS); normalize to lowercase */
type Role = 'admin' | 'instructor' | 'student';

const ROLE_HOMES: Record<Role, string> = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
};

/**
 * Determine required role from pathname. Only verified when path is matched by config.matcher.
 */
function getRequiredRoleForPath(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/instructor')) return 'instructor';
  if (pathname.startsWith('/student')) return 'student';
  return null;
}

interface VerifiedPayload {
  user_id?: string;
  role?: string;
  tenant_id?: string;
}

function normalizeRole(role: unknown): Role | null {
  if (typeof role !== 'string') return null;
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'instructor' || r === 'student') return r;
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const secret = process.env.JWT_PUBLIC_KEY;
  if (!secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let payload: VerifiedPayload;
  try {
    const { payload: verified } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    payload = verified as VerifiedPayload;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = normalizeRole(payload.role);
  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const requiredRole = getRequiredRoleForPath(pathname);
  if (requiredRole && role !== requiredRole) {
    const roleHome = ROLE_HOMES[role];
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/instructor/:path*', '/student/:path*'],
};
