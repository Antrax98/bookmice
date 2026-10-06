import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import {
  ApiResponse,
  DEFAULT_MESSAGES,
  FALLBACK_MESSAGE,
  isApiResponse,
} from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    const httpResponse = context
      .switchToHttp()
      .getResponse<{ statusCode?: number }>();

    const customMessage = this.reflector.getAllAndOverride<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((payload) => {
        if (isApiResponse(payload)) return payload as ApiResponse<T>;

        const code = httpResponse?.statusCode ?? HttpStatus.OK;

        if (typeof payload === 'string') {
          return {
            code,
            data: null,
            message: customMessage ?? payload,
            errors: null,
          };
        }

        return {
          code,
          data: payload ?? null,
          message: customMessage ?? DEFAULT_MESSAGES[code] ?? FALLBACK_MESSAGE,
          errors: null,
        };
      }),
    );
  }
}
