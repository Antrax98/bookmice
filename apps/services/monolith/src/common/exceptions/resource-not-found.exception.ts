import { AppException } from './app.exception';

export class ResourceNotFoundException extends AppException {
  readonly code = 404;

  static of(
    resource: string,
    field: string,
    value: unknown,
  ): ResourceNotFoundException {
    return new ResourceNotFoundException(
      `${resource} with ${field} "${String(value)}" was not found`,
    );
  }
}
