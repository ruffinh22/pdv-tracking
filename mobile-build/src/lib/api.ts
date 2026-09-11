import axios from 'axios';
import { CONFIG } from '@/config';

export const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
