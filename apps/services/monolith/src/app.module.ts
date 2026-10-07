import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
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
