import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import configuration from './config/configuration';
import { authenticationOptionsFactory } from './common/auth/authentication-options';
import { DatabaseModule } from './database/database.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AuthorModule } from './modules/author/author.module';
import { ShelfModule } from './modules/shelf/shelf.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/**
 * Los módulos se declaran en orden de dependencia, no de importancia: `auth` y
 * `user` no dependen de nada, y `notifications` consume eventos de todos los
 * demás. El orden documenta la secuencia de construcción.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    // El guard global de `@nestjs/authentication` se registra aqui y pide un
    // usuario en TODA ruta que no lleve `@Public()`. Es fail closed a proposito:
    // una ruta nueva nace protegida y hay que abrirla a proposito.
    //
    // El factory esta en `common/auth/authentication-options.ts` y lo comparte
    // con `openapi-spec.module.ts`. Ver el porque alli: sin esto, generar el
    // `openapi.json` falla al resolver `AuthenticationRegistry`.
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: authenticationOptionsFactory,
    }),
    // `DatabaseModule` va DESPUES de `AuthenticationModule` a propósito, y
    // `OpenApiDataSourceModule` no se importa aquí nunca: es global, así que si
    // se importara, su `DataSource` sin conexión competiría con el real y
    // ganaría la resolución de tokens. Este es el `DataSource` que debe ganar.
    DatabaseModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    CatalogModule,
    AuthorModule,
    ShelfModule,
    ReviewModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
