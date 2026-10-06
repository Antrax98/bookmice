import { HttpStatus } from '@nestjs/common';

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

export const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.OK]: 'Operation successful',
  [HttpStatus.CREATED]: 'Resource created',
  [HttpStatus.ACCEPTED]: 'Request accepted',
  [HttpStatus.NO_CONTENT]: 'Operation successful',
};

export const FALLBACK_MESSAGE = 'Operation successful';

export function isApiResponse(payload: unknown): payload is ApiResponse {
  if (typeof payload !== 'object' || payload === null) return false;

  const candidate = payload as Partial<ApiResponse>;

  return (
    typeof candidate.code === 'number' &&
    typeof candidate.message === 'string' &&
    'data' in candidate &&
    'errors' in candidate
  );
}
