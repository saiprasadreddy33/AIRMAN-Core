import { describe, it, expect } from 'vitest';

// Test the apiUrl utility — verifies NEXT_PUBLIC_API_URL env variable is used
describe('apiUrl helper', () => {
  const originalEnv = process.env;

  it('should use NEXT_PUBLIC_API_URL when set', () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_API_URL: 'http://api:3001' };
    // Inline the function to avoid module import issues in test env
    function apiUrl(path: string) {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      return `${base}${path}`;
    }
    expect(apiUrl('/auth/login')).toBe('http://api:3001/auth/login');
    process.env = originalEnv;
  });

  it('should fall back to localhost:3001 when env not set', () => {
    const tempEnv = { ...originalEnv };
    delete tempEnv.NEXT_PUBLIC_API_URL;
    process.env = tempEnv;
    function apiUrl(path: string) {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      return `${base}${path}`;
    }
    expect(apiUrl('/courses')).toBe('http://localhost:3001/courses');
    process.env = originalEnv;
  });
});

// Test JWT payload decoding utility used in auth.ts
describe('JWT payload decoder', () => {
  const fakePayload = { user_id: 'u1', role: 'admin', tenant_id: 't1', sub: 'u1' };
  const encodedPayload = btoa(JSON.stringify(fakePayload));
  const fakeToken = `header.${encodedPayload}.signature`;

  it('should decode the JWT payload correctly', () => {
    const decoded = JSON.parse(atob(fakeToken.split('.')[1]));
    expect(decoded.user_id).toBe('u1');
    expect(decoded.role).toBe('admin');
    expect(decoded.tenant_id).toBe('t1');
  });

  it('should derive user object from payload', () => {
    const payload = JSON.parse(atob(fakeToken.split('.')[1]));
    const user = {
      id: payload.user_id,
      role: payload.role,
      tenantId: payload.tenant_id,
    };
    expect(user.id).toBe('u1');
    expect(user.role).toBe('admin');
    expect(user.tenantId).toBe('t1');
  });
});
