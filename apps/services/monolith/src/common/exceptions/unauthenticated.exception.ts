import { AppException } from './app.exception';

export class UnauthenticatedException extends AppException {
  readonly code = 401;
}
