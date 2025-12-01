/**
 * Axios client with interceptors and error handling
 * Centralized API client for all API calls
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT, HTTP_STATUS } from '@/lib/constants';
import { logger } from '@/lib/logger';

// Create axios instance with default config
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Add any auth tokens or headers here if needed
      // Example: config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error: AxiosError) => {
      logger.error('Request interceptor error', error, 'API_CLIENT');
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError) => {
      // Handle common errors
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;

        // Log error for debugging
        logger.error(
          `API Error [${status}]`,
          { status, data, url: error.config?.url },
          'API_CLIENT'
        );

        // Return structured error
        return Promise.reject({
          status,
          data,
          message: (data as { message?: string })?.message || error.message,
        });
      } else if (error.request) {
        // Request was made but no response received
        logger.error('Network error: No response from server', error, 'API_CLIENT');
        return Promise.reject({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: 'Network error: No response from server',
        });
      } else {
        // Something else happened
        logger.error('Unknown error occurred', error, 'API_CLIENT');
        return Promise.reject({
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: error.message || 'Unknown error occurred',
        });
      }
    }
  );

  return client;
};

// Export singleton instance
export const apiClient = createApiClient();

// Export types
export type ApiError = {
  status: number;
  data?: unknown;
  message: string;
};

export default apiClient;

