import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import {
  ApiErrorDetail,
  ApiResponse,
} from '../interfaces/api-response.interface';
import { AppException } from '../exceptions/app.exception';

interface DescribedException {
  code: number;
  message: string;
  errors: ApiErrorDetail[] | null;
}

const POSTGRES_ERRORS: Record<string, { code: number; message: string }> = {
  '23505': { code: HttpStatus.CONFLICT, message: 'Resource already exists' },
  '23503': {
    code: HttpStatus.CONFLICT,
    message: 'Related resource does not exist or is still in use',
  },
  '23502': {
    code: HttpStatus.BAD_REQUEST,
    message: 'A required field is missing',
  },
  '22P02': { code: HttpStatus.BAD_REQUEST, message: 'Invalid value format' },
};

const UNEXPECTED_ERROR = 'Internal server error';
// Tipado como number a propósito: `code` viene de AppException, donde es un
// number cualquiera. Comparar un number con un miembro de enum es lo que
// `no-unsafe-enum-comparison` marca, y con razón: nada garantiza que ese
// number pertenezca al enum.
const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const { code, message, errors } = this.describe(exception);

    if (code >= SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiResponse<null> = { code, data: null, message, errors };

    host.switchToHttp().getResponse<Response>().status(code).json(body);
  }

  private describe(exception: unknown): DescribedException {
    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: exception.message,
        errors: exception.errors,
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof QueryFailedError) {
      return this.fromQueryFailedError(exception);
    }

    return {
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        this.isProduction() || !(exception instanceof Error)
          ? UNEXPECTED_ERROR
          : exception.message,
      errors: null,
    };
  }

  private fromHttpException(exception: HttpException): DescribedException {
    const code = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { code, message: payload, errors: null };
    }

    const { message, error } = payload as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(message)) {
      return {
        code,
        message: error ?? exception.message,
        errors: message.map((detail) => ({ message: detail })),
      };
    }

    return { code, message: message ?? exception.message, errors: null };
  }

  private fromQueryFailedError(
    exception: QueryFailedError,
  ): DescribedException {
    const driverError = exception.driverError as { code?: string } | undefined;
    const known = driverError?.code
      ? POSTGRES_ERRORS[driverError.code]
      : undefined;

    if (!known) {
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: UNEXPECTED_ERROR,
        errors: null,
      };
    }

    return { code: known.code, message: known.message, errors: null };
  }

  private isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }
}
