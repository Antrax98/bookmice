import type { Provider } from '@nestjs/common';
import { TransactionRunnerPort } from '../../../common/domain/transaction-runner.interface';
import { TypeormTransactionRunnerAdapter } from '../../../common/database/typeorm-transaction-runner.adapter';
import { CredentialQueryPort } from '../application/ports/credential-query.port';
import { PasswordHasherPort } from '../application/ports/password-hasher.port';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { CredentialRepositoryPort } from '../domain/ports/credential-repository.port';
import { CredentialQueryAdapter } from '../infrastructure/repositories/credential-query.repository';
import { CredentialRepositoryAdapter } from '../infrastructure/repositories/credential.repository';
import { JwtAuth } from '../infrastructure/security/jwt-auth.provider';
import { PasswordHasherAdapter } from '../infrastructure/security/password-hasher.adapter';
import { UserCreationPort } from '../../user/domain/ports/user-creation.port';
import { UserCreationAdapter } from '../../user/infrastructure/adapters/user-creation.adapter';

/**
 * El composition root de `auth`: aquí se atan los puertos a sus adapters.
 *
 * Van aquí y no en `auth.module.ts` a propósito. El módulo declara superficie
 * pública (qué expone, qué importa); esto es wiring, que es otra cosa.
 *
 * `authBindings` va separada de `authProviders` para que un test pueda montar
 * el grafo con solo los bindings y sustituir el adapter que necesite, sin
 * arrastrar guards ni casos de uso que no le interesan.
 *
 * ## El binding de `UserCreationPort` es la excepción
 *
 * Los otros son puerto de `auth` a adapter de `auth`. Este es un puerto de
 * **`user`**, y su adapter también. Es lo que hace que el alta escriba usuario,
 * perfil y credencial en **una** transacción, con `credentials` en este módulo y
 * las otras dos en el de al lado.
 *
 * Vive aquí y no en `user` por un motivo práctico: si lo atara `user`, `auth`
 * tendría que importar el composition root de otro módulo, que es justo lo que
 * un composition root existe para evitar.
 *
 * ## El guard NO está aquí
 *
 * Lo registra `AuthenticationModule` por su cuenta, como `APP_GUARD`. No es
 * binding nuestro porque no es una implementación alternativa: es el guard que
 * el paquete instala por defecto, y `globalGuard: false` en las opciones lo
 * apagaría. Dejarlo en `authBindings` sería registrar dos veces el mismo guard.
 */

export const authBindings: Provider[] = [
  { provide: PasswordHasherPort, useClass: PasswordHasherAdapter },
  { provide: CredentialRepositoryPort, useClass: CredentialRepositoryAdapter },
  { provide: CredentialQueryPort, useClass: CredentialQueryAdapter },
  { provide: UserCreationPort, useClass: UserCreationAdapter },
  // El mismo binding que en `user`. Es global a propósito: `TransactionRunnerPort`
  // lo necesitan los dos módulos, y atarlo dos veces significaría dos adapters
  // con dos conexiones, que es justo lo que rompe la atomicidad.
  { provide: TransactionRunnerPort, useClass: TypeormTransactionRunnerAdapter },
];

export const authProviders: Provider[] = [
  RegisterUseCase,
  LoginUseCase,
  JwtAuth,
  ...authBindings,
];
