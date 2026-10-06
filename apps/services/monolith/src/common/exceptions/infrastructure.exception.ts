import { AppException } from './app.exception';

export class InfrastructureException extends AppException {
  readonly code = 500;
}
