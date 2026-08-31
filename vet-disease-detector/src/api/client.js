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
    body: JSON.stringify(payload) 
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

export async function getVets(district = '') {
  try {
    const params = new URLSearchParams();
    if (district) params.append('district', district);
    const res = await request(`/api/vets?${params.toString()}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

// Animals & Patients
export async function createAnimal(animal) {
  return request('/api/animals', { method: 'POST', body: JSON.stringify(animal) });
}

export async function updateAnimal(animal) {
  return request(`/api/animals/${animal.id}`, { method: 'PUT', body: JSON.stringify(animal) });
}

export async function deleteAnimal(id) {
  return request(`/api/animals/${id}`, { method: 'DELETE' });
}

export async function getAnimals(params = {}) {
  let url = '/api/animals';
  const qParams = new URLSearchParams();
  if (params.q) qParams.append('q', params.q);
  if (params.tag_number) qParams.append('tag_number', params.tag_number);
  const qStr = qParams.toString();
  if (qStr) url += `?${qStr}`;
  const res = await request(url);
  return Array.isArray(res) ? res : [];
}

export async function getAnimalByTag(tagNumber) {
  return request(`/api/animals/tag/${encodeURIComponent(tagNumber)}`);
}

export async function getAnimal(id) {
  return request(`/api/animals/${id}`);
}

// Clinic Diagnostic & Laboratory Test Results (Private & Vet Issued)
export async function getClinicTestResults(animalId = 0) {
  try {
    const url = animalId ? `/api/clinic-test-results?animal_id=${animalId}` : '/api/clinic-test-results';
    const res = await request(url);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function publishClinicTestResult(testData) {
  return request('/api/clinic-test-results', {
    method: 'POST',
    body: JSON.stringify(testData)
  });
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

// Outbreak Surveillance & SOS Notifications
export async function getOutbreaks(district = '', species = '') {
  try {
    const params = new URLSearchParams();
    if (district) params.append('district', district);
    if (species) params.append('species', species);
    const res = await request(`/api/outbreaks?${params.toString()}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function getOutbreak(id) {
  return request(`/api/outbreaks/${id}`);
}

export async function reportOutbreak(outbreak) {
  return request('/api/outbreaks', { method: 'POST', body: JSON.stringify(outbreak) });
}

export async function reportOutbreakRecovery(payload) {
  return request('/api/outbreaks/report-recovery', { method: 'POST', body: JSON.stringify(payload) });
}

export async function resolveOutbreak(payload) {
  return request('/api/outbreaks/resolve', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getNotifications() {
  try {
    const res = await request('/api/notifications');
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function markNotificationRead(id) {
  return request('/api/notifications/read', { method: 'POST', body: JSON.stringify({ id }) });
}

export async function markAllNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'POST', body: JSON.stringify({}) });
}

// Vet Case Consultations & Second Opinions
export async function getVetConsultations(status = '') {
  try {
    const res = await request(`/api/vet-consultations?status=${encodeURIComponent(status)}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function requestVetConsultation(payload) {
  return request('/api/vet-consultations', { method: 'POST', body: JSON.stringify(payload) });
}

export async function reviewVetConsultation(payload) {
  return request('/api/vet-consultations/review', { method: 'POST', body: JSON.stringify(payload) });
}

// Medical & Vaccine Inventory Tracking
export async function getInventory(district = '', orgType = '', myInventory = false) {
  try {
    const params = new URLSearchParams();
    if (district) params.append('district', district);
    if (orgType) params.append('org_type', orgType);
    if (myInventory) params.append('my_inventory', 'true');
    const res = await request(`/api/inventory?${params.toString()}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function upsertInventory(item) {
  return request('/api/inventory', { method: 'POST', body: JSON.stringify(item) });
}

export async function updateInventory(item) {
  return request('/api/inventory', { method: 'PUT', body: JSON.stringify(item) });
}

export async function deleteInventory(id) {
  return request(`/api/inventory?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Government & NGO Advisories
export async function getGovAdvisories(district = '') {
  try {
    const res = await request(`/api/gov-advisories?district=${encodeURIComponent(district)}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function publishGovAdvisory(advisory) {
  return request('/api/gov-advisories', { method: 'POST', body: JSON.stringify(advisory) });
}

export function mediaURL(path) {
  if (!path) return '';
  return path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:') ? path : `${API_BASE}${path}`;
}
