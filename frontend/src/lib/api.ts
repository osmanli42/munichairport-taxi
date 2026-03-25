import axios from 'axios';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_BASE_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add token to admin requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token && (config.url?.startsWith('/admin') || config.method === 'put' || config.method === 'delete')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface BookingFormData {
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: 'kombi' | 'van' | 'grossraumtaxi';
  passengers: number;
  name: string;
  phone: string;
  email: string;
  flight_number?: string;
  pickup_sign?: string;
  child_seat?: boolean;
  child_seat_details?: string;
  luggage_count?: number;
  notes?: string;
  distance_km?: number;
  duration_minutes?: number;
  payment_method: 'cash' | 'card';
  language: string;
  trip_type?: string;
  return_datetime?: string;
  fahrrad_count?: number;
  card_holder?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
  anfahrt_cost?: number;
}

export interface Booking {
  id: number;
  booking_number: string;
  status: 'new' | 'confirmed' | 'completed' | 'cancelled';
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: string;
  passengers: number;
  name: string;
  phone: string;
  email: string;
  flight_number?: string;
  child_seat: number;
  child_seat_details?: string;
  luggage_count: number;
  fahrrad_count?: number;
  notes?: string;
  distance_km?: number;
  duration_minutes?: number;
  price: number;
  payment_method: string;
  language: string;
  trip_type?: string;
  return_datetime?: string;
  created_at: string;
  card_holder?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
}

export interface Price {
  id: number;
  vehicle_type: string;
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
  fahrrad_price: number;
  fahrrad_enabled: number;
  max_passengers: number;
  max_luggage: number;
  min_price: number;
  min_price_km: number;
  updated_at: string;
}

// Public API
export const bookingsApi = {
  create: async (data: BookingFormData) => {
    const response = await api.post('/bookings', data);
    return response.data;
  },

  calculatePrice: async (vehicle_type: string, distance_km: number) => {
    const response = await api.post('/bookings/calculate-price', { vehicle_type, distance_km });
    return response.data;
  },

  getByNumber: async (booking_number: string) => {
    const response = await api.get(`/bookings/${booking_number}`);
    return response.data;
  },
};

export const pricesApi = {
  getAll: async (): Promise<Price[]> => {
    const response = await api.get('/prices');
    return response.data;
  },
};

export const settingsApi = {
  getAll: async (): Promise<Record<string, string>> => {
    const response = await api.get('/settings');
    return response.data;
  },
};

// Admin API
export const adminApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/admin/login', { username, password });
    return response.data;
  },

  getBookings: async (params?: {
    status?: string;
    vehicle_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/admin/bookings', { params });
    return response.data;
  },

  getBooking: async (id: number) => {
    const response = await api.get(`/admin/bookings/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/admin/bookings/${id}/status`, { status });
    return response.data;
  },

  deleteBooking: async (id: number) => {
    const response = await api.delete(`/admin/bookings/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  updatePrice: async (vehicle_type: string, base_price: number, price_per_km: number, roundtrip_discount?: number, fahrrad_price?: number, fahrrad_enabled?: boolean, max_passengers?: number, max_luggage?: number, min_price?: number, min_price_km?: number) => {
    const response = await api.put(`/prices/${vehicle_type}`, { base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, max_passengers, max_luggage, min_price, min_price_km });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/admin/change-password', { currentPassword, newPassword });
    return response.data;
  },

  updateSettings: async (settings: Record<string, string>) => {
    const response = await api.put('/settings', settings);
    return response.data;
  },
};

export default api;
