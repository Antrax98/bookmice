import { HttpStatus, Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  buildEnvelopeSchema,
  buildErrorEnvelopeSchema,
} from '../swagger/envelope-schema';

export interface ApiEnvelopeOptions {
  status?: number;
  isArray?: boolean;
  description?: string;
  message?: string;
}

export const ApiEnvelope = <TModel extends Type<unknown>>(
  model?: TModel,
  options: ApiEnvelopeOptions = {},
) => {
  const {
    status = HttpStatus.OK,
    isArray = false,
    description,
    message,
  } = options;

  const data = model
    ? isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) }
    : undefined;

  return applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
    ApiResponse({
      status,
      description,
      schema: buildEnvelopeSchema({ status, data, message }),
    }),
  );
};

export const ApiEnvelopeError = (status: number, message: string) =>
  ApiResponse({
    status,
    description: message,
    schema: buildErrorEnvelopeSchema(status, message),
  });
