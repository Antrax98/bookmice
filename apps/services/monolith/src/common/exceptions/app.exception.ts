import { ApiErrorDetail } from '../interfaces/api-response.interface';

export abstract class AppException extends Error {
  abstract readonly code: number;
  readonly errors: ApiErrorDetail[] | null;

  constructor(message: string, errors: ApiErrorDetail[] | null = null) {
    super(message);
    this.name = new.target.name;
    this.errors = errors;
  }
}
