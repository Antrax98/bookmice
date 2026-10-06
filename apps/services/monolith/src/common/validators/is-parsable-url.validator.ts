import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { SAFE_URL_MESSAGE, isSafeUrl } from '../domain/url';

/**
 * Aplica en la frontera HTTP la misma regla que el dominio: `http`, `https` o
 * `mailto`.
 *
 * `@IsUrl()` de class-validator exige host y rechaza `mailto:`, lo que dejaba
 * inservible el `kind: 'email'` de los enlaces de perfil. Este importa
 * `isSafeUrl` en vez de reimplementarla: una definición, dos puntos de
 * aplicación.
 */
@ValidatorConstraint({ name: 'isParsableUrl' })
class IsParsableUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isSafeUrl(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} ${SAFE_URL_MESSAGE}`;
  }
}

export const IsParsableUrl =
  (options?: ValidationOptions) => (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsParsableUrlConstraint,
    });
