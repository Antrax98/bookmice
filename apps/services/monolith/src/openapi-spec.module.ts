import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import configuration from './config/configuration';
import { OpenApiDataSourceModule } from './database/openapi-datasource.module';
import { authenticationOptionsFactory } from './common/auth/authentication-options';
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
 * Lo que NO se replica: `DatabaseModule`, y con ella la conexión real. En su
 * lugar entra `OpenApiDataSourceModule`, que da un `DataSource` construible pero
 * que nunca conecta. Sin eso, los adapters de `infrastructure` no se pueden
 * instanciar y el comando falla con
 * `Nest can't resolve dependencies of the UserEntityRepository (?)`.
 *
 * ## Los `forFeature` no están en los módulos de negocio
 *
 * Ni en este ni en `auth.module.ts` ni en `user.module.ts`. `forFeature` crea
 * repositorios que necesitan el `DataSource` **del módulo**, y aquí no hay. Los
 * repositorios usan `@InjectDataSource()`, que pide solo el token.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    // `AuthenticationModule` **sí** se replica aquí, a diferencia de
    // `DatabaseModule`, y por un motivo concreto: `AuthModule` provee `JwtAuth`,
    // que inyecta `AuthenticationRegistry`, que viene de este módulo. Como
    // `NestFactory.create` instancia los providers aunque no se llame a
    // `listen()`, sin esta línea generar el `openapi.json` falla al resolver el
    // grafo de auth.
    //
    // El guard global no molesta al generar el contrato: `createDocument` no
    // pasa por HTTP, así que no hay ruta a la que pedirle un token.
    //
    // La factory es la misma que en `AppModule`, compartida desde
    // `common/auth/authentication-options.ts`.
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: authenticationOptionsFactory,
    }),
    // Da el token `DataSource` para que los adapters se puedan construir. No
    // abre conexión: ver el docblock del módulo.
    OpenApiDataSourceModule,
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
