import axios from 'axios';
import { API_BASE_URL } from '../config/endpoints';
import { getItemAsync } from '../utils/storage';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  try {
    const token = await getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // noop
  }
  config.headers['Content-Type'] = 'application/json';
  return config;
});

export default client;