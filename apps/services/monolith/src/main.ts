import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ApiErrorDetailDto } from './common/swagger/api-error-detail.dto';
import { applyDefaultErrorResponses } from './common/swagger/default-error-responses';
import { buildOpenApiConfig } from './common/swagger/openapi-config';
import { setupApp } from './common/setup-app';
import { splash } from './common/console/splash';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.getOrThrow<number>('port');

  const config = buildOpenApiConfig();
  const documentFactory = () =>
    applyDefaultErrorResponses(
      SwaggerModule.createDocument(app, config, {
        extraModels: [ApiErrorDetailDto],
      }),
    );
  SwaggerModule.setup('api', app, documentFactory);

  setupApp(app);

  await app.listen(port);

  if (configService.get<string>('nodeEnv') !== 'production') {
    await splash({
      titulo: 'Monolith',
      lineas: [
        `API:     http://localhost:${port}`,
        `OpenAPI: http://localhost:${port}/api`,
      ],
    });
  }
}
void bootstrap();
