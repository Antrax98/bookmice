import { AppException } from './app.exception';

export class BusinessException extends AppException {
  readonly code = 409;
}
