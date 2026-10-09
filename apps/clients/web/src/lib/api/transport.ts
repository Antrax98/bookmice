export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
  errors: ApiErrorDetail[] | null;
}
