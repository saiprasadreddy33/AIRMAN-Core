import { User, UserRole } from '../types';
import { apiUrl } from './api';

export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  try {
    const hashedPassword = await hashPassword(password);
    const res = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password: hashedPassword }),
    });

    if (!res.ok) {
      console.error('Login failed:', await res.text());
      return null;
    }

    const data = await res.json();

    // The backend returns { accessToken, expiresIn }
    // We decode the JWT payload to extract user details
    const token = data.accessToken;
    const payload = JSON.parse(atob(token.split('.')[1]));

    return {
      id: payload.user_id || payload.sub,
      name: email.split('@')[0], // derived since Name isn't in JWT
      email: email,
      role: (payload.role || 'student') as UserRole,
      tenantId: payload.tenant_id || 'unknown',
      tenantName: 'Tenant ' + (payload.tenant_id || 'Unknown'),
      token: token,
    };
  } catch (err) {
    console.error('Network error building session:', err);
    return null;
  }
}

export function getDemoCredentials(): Array<{ role: UserRole; email: string; password: string; name: string }> {
  return [
    { role: 'student', email: 'studenta@test.com', password: 'password', name: 'School A Student' },
    { role: 'instructor', email: 'instructora@test.com', password: 'password', name: 'School A Instructor' },
    { role: 'admin', email: 'admina@test.com', password: 'password', name: 'School A Admin' },
  ];
}
