const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const AUTH_KEY = 'vetscan_auth';
const HF_KEY = 'vetscan_hf_token';

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

export function getStoredHuggingFaceToken() {
  return localStorage.getItem(HF_KEY) || '';
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(HF_KEY);
}

function setStoredAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

async function request(path, options = {}) {
  const auth = getStoredAuth();
  const hfToken = getStoredHuggingFaceToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(auth?.token ? { 'X-User-ID': auth.token } : {}),
    ...(options.useHuggingFaceToken && hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
    ...(options.headers || {})
  };
  delete options.useHuggingFaceToken;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Backend request failed.');
  }
  return data;
}

export async function loginAccount(payload) {
  return setStoredAuth(await request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function signupAccount(payload) {
  return setStoredAuth(await request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function connectHuggingFace(token) {
  localStorage.setItem(HF_KEY, token);
  const result = await request('/api/account/huggingface', { method: 'POST', body: JSON.stringify({ token }) });
  const auth = getStoredAuth();
  if (auth && result.user) {
    setStoredAuth({ ...auth, user: result.user });
  }
  return result;
}

export function createAnimal(animal) {
  return request('/api/animals', { method: 'POST', body: JSON.stringify(animal) });
}

export function getAnimals() {
  return request('/api/animals');
}

export function getAnimal(id) {
  return request(`/api/animals/${id}`);
}

export function uploadHealthMedia(file) {
  const body = new FormData();
  body.append('file', file);
  return request('/api/health-check/upload', { method: 'POST', body });
}

export function analyzeHealth(payload) {
  return request('/api/health-check/analyze', { method: 'POST', body: JSON.stringify(payload), useHuggingFaceToken: true });
}

export function getHealthScreening(id) {
  return request(`/api/health-screenings/${id}`);
}

export function getHealthHistory(animalId = 0) {
  return animalId ? request(`/api/animals/${animalId}/history`) : request('/api/animals/0/history');
}

export function createReminder(reminder) {
  return request('/api/reminders', { method: 'POST', body: JSON.stringify(reminder) });
}

export function getReminders() {
  return request('/api/reminders');
}

export function getNearbyClinics(urgency = 'moderate') {
  return request(`/api/clinics/nearby?urgency=${encodeURIComponent(urgency)}`);
}

export function mediaURL(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}
