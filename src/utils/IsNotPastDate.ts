import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsNotPastDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotPastDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return false;
          const today = new Date();
          const inputDate = new Date(value);
          return inputDate >= today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not be a past date.`;
        },
      },
    });
  };
}
