const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const sessionStr = sessionStorage.getItem('airman_session');
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    return session.token || null;
  } catch {
    return null;
  }
}

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || { 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  options.headers = headers;
  options.credentials = 'include';

  let res = await fetch(apiUrl(path), options);

  if (res.status === 401) {
    // Attempt to refresh
    const refreshRes = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const newAccessToken = data.accessToken;

      // Update session storage silently
      if (typeof window !== 'undefined') {
        const sessionStr = sessionStorage.getItem('airman_session');
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            session.token = newAccessToken;
            sessionStorage.setItem('airman_session', JSON.stringify(session));
          } catch (e) {
            // Ignore parse error
          }
        }
      }

      // Retry original request
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      options.headers = headers;
      res = await fetch(apiUrl(path), options);
    } else {
      // Refresh failed, clear session and force login
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('airman_session');
        window.location.href = '/';
      }
    }
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return fetchWithAuth<T>(path, { method: 'GET' });
  },

  async post<T>(path: string, data?: unknown): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
};
