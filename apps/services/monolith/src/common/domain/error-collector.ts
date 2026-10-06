import { DataValidationException } from '../exceptions/data-validation.exception';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

export class DomainErrorCollector {
  private readonly errors: ApiErrorDetail[] = [];

  add(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  throwIfAny(message: string): void {
    if (this.hasErrors) {
      throw new DataValidationException(message, this.errors);
    }
  }
}
