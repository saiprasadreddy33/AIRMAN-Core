import { User, UserRole } from '../types';
import { apiUrl } from './api';

const TENANT_NAMES: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'Flight School A',
  '22222222-2222-2222-2222-222222222222': 'Flight School B',
};

export type DemoSchool = 'school-a' | 'school-b';

export interface DemoCredential {
  school: DemoSchool;
  schoolLabel: string;
  role: UserRole;
  email: string;
  password: string;
  name: string;
}

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
      tenantName: TENANT_NAMES[payload.tenant_id] || 'Tenant ' + (payload.tenant_id || 'Unknown'),
      token: token,
    };
  } catch (err) {
    console.error('Network error building session:', err);
    return null;
  }
}

export function getDemoCredentials(school?: DemoSchool): DemoCredential[] {
  const credentials: DemoCredential[] = [
    { school: 'school-a', schoolLabel: 'School A', role: 'student', email: 'studenta@test.com', password: 'password', name: 'School A Student' },
    { school: 'school-a', schoolLabel: 'School A', role: 'instructor', email: 'instructora@test.com', password: 'password', name: 'School A Instructor' },
    { school: 'school-a', schoolLabel: 'School A', role: 'admin', email: 'admina@test.com', password: 'password', name: 'School A Admin' },
    { school: 'school-b', schoolLabel: 'School B', role: 'student', email: 'studentb@test.com', password: 'password', name: 'School B Student' },
    { school: 'school-b', schoolLabel: 'School B', role: 'instructor', email: 'instructorb@test.com', password: 'password', name: 'School B Instructor' },
    { school: 'school-b', schoolLabel: 'School B', role: 'admin', email: 'adminb@test.com', password: 'password', name: 'School B Admin' },
  ];

  if (!school) {
    return credentials;
  }

  return credentials.filter((credential) => credential.school === school);
}
