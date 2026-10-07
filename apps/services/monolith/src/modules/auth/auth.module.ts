import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { authProviders } from './composition/container';
import { CredentialEntity } from './infrastructure/entities/credential.entity';
import { LoginController } from './infrastructure/controllers/login.controller';
import { RegisterController } from './infrastructure/controllers/register.controller';

/**
 * Superficie Nest del módulo `auth`.
 *
 * `AuthenticationModule.forRootAsync()` **no** está aquí, y es lo más importante
 * de este fichero: lo importa `AppModule` y `OpenApiSpecModule`, no `AuthModule`.
 *
 * La razón es que `AuthenticationModule` es un módulo **global** (su
 * `isGlobal` es `true` por defecto) que además instala el guard global. Si lo
 * importara `AuthModule`, funcionaría, pero el contrato de `AuthModule` dejaría
 * de ser "`AuthModule` funciona si lo importas", y con `OpenApiSpecModule` el
 * fallo aparecería justo al generar el `openapi.json`.
 *
 * ## Importa `UserModule`, y por qué no al revés
 *
 * Por `UserCreationPort`: el alta escribe usuario y perfil dentro de la
 * transacción que abre `auth`. Es la **única** dependencia de `auth` sobre otro
 * módulo, y va por el puerto, nunca importando un modelo.
 *
 * `UserModule` no importa a `AuthModule`. La dependencia va en un solo sentido,
 * que es lo que hace que `user` se pueda extraer a un servicio sin arrastrar
 * `auth` con él.
 *
 * ## Por qué `UserModule` exporta su caso de uso, y no solo el puerto
 *
 * Porque el binding de `UserCreationPort` es `UserCreationAdapter`, y ese adapter
 * **necesita** `CreateUserWithProfileUseCase` para delegar. Sin exportarlo, Nest
 * no puede resolverlo y el arranque falla con `UnknownDependenciesException`.
 *
 * Es un export más de los que idealmente habría: `UserModule` acaba exponiendo
 * su caso de uso a quien quiera importarlo, no solo a quien vaya por el puerto. Se
 * acepta porque `UserCreationAdapter` vive en el módulo de `user` y es el único
 * que puede atar puerto y caso de uso a la vez sin romper las reglas de capa.
 *
 * La alternativa sería que `AuthModule` importara `CreateUserWithProfileUseCase`
 * directamente de `user/application`, pero eso ataría a `auth` a una clase
 * concreta en vez de a un contrato, que es justo lo que el puerto evita.
 *
 * ## `exports`
 *
 * Vacío a propósito. Nadie consume nada de `auth` todavía, y el token lo lleva el
 * cliente en la cabecera, no un provider de este módulo. Cuando exista algo que
 * otro módulo necesite de aquí, se añade con su porqué.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CredentialEntity]), UserModule],
  controllers: [RegisterController, LoginController],
  providers: authProviders,
  exports: [],
})
export class AuthModule {}
