import { HttpStatus } from '@nestjs/common';
import { OpenAPIObject, PathItemObject } from '@nestjs/swagger';
import { buildErrorEnvelopeResponse } from './envelope-schema';

const OPERATION_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
] as const satisfies readonly (keyof PathItemObject)[];

const DEFAULT_ERRORS: Record<number, string> = {
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

export function applyDefaultErrorResponses(
  document: OpenAPIObject,
): OpenAPIObject {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of OPERATION_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      operation.responses ??= {};

      for (const [status, message] of Object.entries(DEFAULT_ERRORS)) {
        operation.responses[status] ??= buildErrorEnvelopeResponse(
          Number(status),
          message,
        );
      }
    }
  }

  return document;
}
