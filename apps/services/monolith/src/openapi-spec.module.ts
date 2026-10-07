import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AuthorModule } from './modules/author/author.module';
import { ShelfModule } from './modules/shelf/shelf.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/**
 * `AppModule` sin `DatabaseModule`, y solo existe por eso.
 *
 * Why: `NestFactory.create` **conecta con Postgres aunque no se llame a
 * `listen()`**. Sin `listen()` no se abre ningún puerto, pero `TypeOrmModule`
 * intenta abrir la conexión igualmente al inicializar. Eso significa que
 * generar el contrato OpenAPI exigiría una base de datos levantada, y el
 * contrato es justamente lo que debería poder generarse sin nada más.
 *
 * Importa los mismos módulos de negocio que `AppModule`, así que el documento
 * que sale de aquí lleva todos los controladores y esquemas. Si añades un
 * módulo a `AppModule`, **añádelo también aquí**: si no, el `openapi.json`
 * commiteado se queda viejo sin que nada avise.
 *
 * Lo que NO se replica: `DatabaseModule`, y con ella el wiring de TypeORM. Aquí
 * solo importa el.reflect metadata de los controladores.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    CatalogModule,
    AuthorModule,
    ShelfModule,
    ReviewModule,
    NotificationsModule,
  ],
})
export class OpenApiSpecModule {}
