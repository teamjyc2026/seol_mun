import axios, { AxiosError } from 'axios';

export type ApiError = { message: string; status?: number; details?: unknown };

export const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; details?: unknown }>) => {
    const normalized: ApiError = {
      message:
        error.response?.data?.message ??
        error.message ??
        '요청 처리 중 오류가 발생했습니다.',
      status: error.response?.status,
      details: error.response?.data?.details,
    };
    return Promise.reject(normalized);
  },
);
