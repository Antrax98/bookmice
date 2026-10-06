import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'match' })
class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, validationArguments: ValidationArguments): boolean {
    const [property] = validationArguments.constraints as [string];
    return (
      value ===
      (validationArguments.object as Record<string, unknown>)[property]
    );
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    const [property] = validationArguments.constraints as [string];
    return `${validationArguments.property} must match ${property}`;
  }
}

export const Match =
  (property: string, options?: ValidationOptions) =>
  (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: options,
      validator: MatchConstraint,
    });
