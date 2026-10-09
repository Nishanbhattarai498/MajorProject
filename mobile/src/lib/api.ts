import * as SecureStore from 'expo-secure-store';

export type ClassProbability = { className: string; confidence: number };

export type Prediction = {
  _id: string;
  model: string;
  predictedClass: string;
  confidence: number;
  probabilities: ClassProbability[];
  originalImage?: string;
  gradcamImage?: string;
  createdAt: string;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  if (!apiUrl) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env and restart Expo.');
  const token = authenticated ? await SecureStore.getItemAsync('neuroscope-token') : null;
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new Error('Cannot reach the NeuroScope API. Check the server URL and network connection.');
  }
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error(payload?.error || payload?.detail || 'Request failed. Please try again.');
  return payload as T;
}

export function getRecentPredictions(limit = 20) {
  return request<{ predictions: Prediction[] }>(`/api/v1/predictions?limit=${limit}`);
}

export function getPrediction(id: string) {
  return request<Prediction>(`/api/v1/predictions/${id}`);
}

export function deletePrediction(id: string) {
  return request<void>(`/api/v1/predictions/${id}`, { method: 'DELETE' });
}

export async function classifyImage(uri: string, mimeType?: string | null, fileName?: string | null) {
  const form = new FormData();
  form.append('image', {
    uri,
    name: fileName || 'brain-mri.jpg',
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
  return request<Prediction>('/api/v1/predictions', { method: 'POST', body: form });
}

export function formatClassName(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export async function signIn(email: string, password: string) {
  return request<{ token: string; user: { id: string; email: string } }>(
    '/api/v1/auth/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  );
}

export async function registerAccount(email: string, password: string) {
  return request<{ token: string; user: { id: string; email: string } }>(
    '/api/v1/auth/register',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    false,
  );
}