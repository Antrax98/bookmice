import { AppException } from './app.exception';

export class ForbiddenException extends AppException {
  readonly code = 403;
}
