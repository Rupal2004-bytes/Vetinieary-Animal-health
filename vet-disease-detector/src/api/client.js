const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const AUTH_KEY = 'vetscan_auth';

export function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getStoredUser() {
  return getStoredAuth()?.user || null;
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function setStoredAuth(auth) {
  if (auth) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  }
  return auth;
}

async function request(path, options = {}) {
  const auth = getStoredAuth();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(auth?.token ? { 
      'X-Auth-Token': String(auth.token),
      'X-User-ID': String(auth.token)
    } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Backend request failed.');
  }
  return data;
}

// User Authentication & Account Management
export async function loginAccount(payload) {
  const res = await request('/api/auth/login', { 
    method: 'POST', 
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      role: payload.role || 'owner'
    }) 
  });
  return setStoredAuth(res);
}

export async function signupAccount(payload) {
  const res = await request('/api/auth/signup', { 
    method: 'POST', 
    body: JSON.stringify({
      name: payload.name || payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role || 'owner'
    }) 
  });
  return setStoredAuth(res);
}

export async function logoutAccount() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout notification error:', err);
  } finally {
    clearStoredAuth();
  }
}

export async function getAuthMe() {
  return request('/api/auth/me');
}

export async function updateUserProfile(profile) {
  const res = await request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profile)
  });
  const current = getStoredAuth();
  if (current) {
    setStoredAuth({ ...current, user: res });
  }
  return res;
}

export async function changeUserPassword({ oldPassword, newPassword }) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
  });
}

export async function getAuthLogs() {
  try {
    const res = await request('/api/auth/logs');
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

// Animals & Patients
export async function createAnimal(animal) {
  return request('/api/animals', { method: 'POST', body: JSON.stringify(animal) });
}

export async function getAnimals() {
  const res = await request('/api/animals');
  return Array.isArray(res) ? res : [];
}

export async function getAnimal(id) {
  return request(`/api/animals/${id}`);
}

// Health Screening & Media
export async function uploadHealthMedia(file) {
  const body = new FormData();
  body.append('file', file);
  return await request('/api/health-check/upload', { method: 'POST', body });
}

export async function analyzeHealth(payload) {
  return request('/api/health-check/analyze', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getHealthScreening(id) {
  return request(`/api/health-screenings/${id}`);
}

export async function getHealthHistory(animalId = 0) {
  try {
    const res = animalId ? await request(`/api/animals/${animalId}/history`) : await request('/api/animals/0/history');
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function createReminder(reminder) {
  return request('/api/reminders', { method: 'POST', body: JSON.stringify(reminder) });
}

export async function getReminders() {
  try {
    const res = await request('/api/reminders');
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function getNearbyClinics(urgency = 'moderate') {
  try {
    const res = await request(`/api/clinics/nearby?urgency=${encodeURIComponent(urgency)}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export function mediaURL(path) {
  if (!path) return '';
  return path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:') ? path : `${API_BASE}${path}`;
}
