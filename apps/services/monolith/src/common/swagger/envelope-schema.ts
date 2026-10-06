import {
  ReferenceObject,
  ResponseObject,
  SchemaObject,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  DEFAULT_MESSAGES,
  FALLBACK_MESSAGE,
} from '../interfaces/api-response.interface';
import { ApiErrorDetailDto } from './api-error-detail.dto';

const NULL_SCHEMA: SchemaObject = { type: 'null', example: null };

export interface EnvelopeSchemaParams {
  status: number;
  data?: SchemaObject | ReferenceObject;
  errors?: SchemaObject | ReferenceObject;
  message?: string;
}

export function buildEnvelopeSchema({
  status,
  data,
  errors,
  message,
}: EnvelopeSchemaParams): SchemaObject {
  return {
    type: 'object',
    required: ['code', 'data', 'message', 'errors'],
    properties: {
      code: { type: 'integer', example: status },
      data: data ?? NULL_SCHEMA,
      message: {
        type: 'string',
        example: message ?? DEFAULT_MESSAGES[status] ?? FALLBACK_MESSAGE,
      },
      errors: errors ?? NULL_SCHEMA,
    },
  };
}

export function buildErrorEnvelopeSchema(
  status: number,
  message: string,
): SchemaObject {
  return buildEnvelopeSchema({
    status,
    message,
    errors: {
      type: ['array', 'null'],
      items: { $ref: getSchemaPath(ApiErrorDetailDto) },
      example: null,
    },
  });
}

export function buildErrorEnvelopeResponse(
  status: number,
  message: string,
): ResponseObject {
  return {
    description: message,
    content: {
      'application/json': { schema: buildErrorEnvelopeSchema(status, message) },
    },
  };
}
