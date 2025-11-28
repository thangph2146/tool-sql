import axios from 'axios';
import { DEFAULT_REQUEST_TIMEOUT } from '@/lib/constants/db-constants';

// Create axios instance with default config
const axiosClient = axios.create({
  baseURL: typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '',
  timeout: DEFAULT_REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // Add any auth tokens or headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      return Promise.reject(error.response.data || error.message);
    } else if (error.request) {
      // Request was made but no response received
      return Promise.reject(new Error('Network error: No response from server'));
    } else {
      // Something else happened
      return Promise.reject(error.message || 'Unknown error occurred');
    }
  }
);

export default axiosClient;

