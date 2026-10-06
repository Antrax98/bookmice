import { AppException } from './app.exception';

export class DataValidationException extends AppException {
  readonly code = 400;
}
