import { ValidationError } from 'class-validator';
import { DataValidationException } from '../exceptions/data-validation.exception';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

const INVALID_REQUEST =
  'The request could not be processed: some data is invalid';

function isIndex(property: string): boolean {
  return /^\d+$/.test(property);
}

function join(parent: string, property: string): string {
  if (!parent) return property;
  return isIndex(property) ? `${parent}[${property}]` : `${parent}.${property}`;
}

function flatten(errors: ValidationError[], parent = ''): ApiErrorDetail[] {
  return errors.flatMap((error) => {
    const path = join(parent, error.property);

    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field: path,
      message,
    }));

    const nested = error.children?.length ? flatten(error.children, path) : [];

    return [...own, ...nested];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): DataValidationException {
  return new DataValidationException(INVALID_REQUEST, flatten(errors));
}
