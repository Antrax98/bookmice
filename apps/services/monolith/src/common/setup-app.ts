import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe.js';
import { validationExceptionFactory } from './pipes/validation-exception.factory';

//Todo lo que cambia el comportamiento de una peticion vive aqui y no dentro de
//bootstrap, porque Test.createTestingModule no llama a bootstrap: un test que
//no pudiera reutilizar esta funcion arrancaria sin ValidationPipe y daria por
//buenos cuerpos que en produccion se rechazan con un 400.
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: validationExceptionFactory,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
