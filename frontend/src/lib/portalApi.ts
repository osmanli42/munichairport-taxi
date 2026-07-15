const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('company_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('company_token', token);
}

export function clearToken() {
  localStorage.removeItem('company_token');
}

async function request(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API}/company${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  return res;
}

export const portalApi = {
  apply: (data: any) => request('/apply', { method: 'POST', body: JSON.stringify(data) }),
  login: (email: string, password: string) => request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/me'),
  changePassword: (current_password: string, new_password: string) =>
    request('/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  updateProfile: (data: { company_name: string; contact_name: string; phone: string; address: string; ust_idnr: string }) =>
    request('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  createCardSetupIntent: () => request('/payment-method/setup-intent', { method: 'POST' }),
  confirmCardSetup: (payment_method_id: string) =>
    request('/payment-method/confirm', { method: 'POST', body: JSON.stringify({ payment_method_id }) }),
  removeCard: () => request('/payment-method', { method: 'DELETE' }),

  bookings: (scope?: string) => request(`/bookings${scope ? `?scope=${scope}` : ''}`),
  csvUrl: (from?: string, to?: string) => {
    const token = getToken();
    let url = `${API}/company/bookings.csv?token=${token}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return url;
  },
  stats: () => request('/stats'),
  cancelBooking: (id: number) => request(`/bookings/${id}/cancel`, { method: 'POST' }),

  rechnungPdfUrl: (bookingId: number) => `${API}/company/bookings/${bookingId}/rechnung.pdf?token=${getToken()}`,

  invoices: () => request('/invoices'),
  invoicePdfUrl: (invoiceId: number) => `${API}/company/invoices/${invoiceId}/rechnung.pdf?token=${getToken()}`,

  favorites: () => request('/favorites'),
  addFavorite: (data: any) => request('/favorites', { method: 'POST', body: JSON.stringify(data) }),
  deleteFavorite: (id: number) => request(`/favorites/${id}`, { method: 'DELETE' }),

  users: () => request('/users'),
  addUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),

  createBooking: (data: any) => {
    const token = getToken();
    return fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  },

  getDistance: (data: any) => {
    return fetch(`${API}/maps/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  getPriceConfig: (vehicleType: string) => fetch(`${API}/prices/${vehicleType}`),
};
