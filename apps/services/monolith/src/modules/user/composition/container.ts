import type { Provider } from '@nestjs/common';
import { ProfileQueryPort } from '../application/ports/profile-query.port';
import { UserQueryPort } from '../application/ports/user-query.port';
import { CreateUserWithProfileUseCase } from '../application/use-cases/create-user-with-profile.use-case';
import { ProfileRepositoryPort } from '../domain/ports/profile-repository.port';
import { UserCreationPort } from '../domain/ports/user-creation.port';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { UserCreationAdapter } from '../infrastructure/adapters/user-creation.adapter';
import { ProfileQueryAdapter } from '../infrastructure/repositories/profile-query.repository';
import { ProfileRepositoryAdapter } from '../infrastructure/repositories/profile.repository';
import { UserQueryAdapter } from '../infrastructure/repositories/user-query.repository';
import { UserRepositoryAdapter } from '../infrastructure/repositories/user.repository';

/**
 * El composition root de `user`: aquí se atan los puertos a sus adapters.
 *
 * Van aquí y no en `user.module.ts` a propósito. El módulo declara superficie
 * pública (qué expone, qué importa); esto es wiring, que es otra cosa.
 *
 * `userBindings` va separada de `userProviders` para que un test pueda montar
 * el grafo con solo los bindings y sustituir el adapter que necesite, sin
 * arrastrar el `CreateUserWithProfileUseCase` que no le interesa.
 *
 * Los puertos de lectura son **dos** y no uno, aunque `user` y `profile` estén
 * en el mismo módulo. Es lo que impide que el endpoint de perfil devuelva el
 * email: quien pide perfil llama a `ProfileQueryPort` y no tiene forma de
 * alcanzar `users`.
 */

export const userBindings: Provider[] = [
  { provide: UserCreationPort, useClass: UserCreationAdapter },
  { provide: UserRepositoryPort, useClass: UserRepositoryAdapter },
  { provide: UserQueryPort, useClass: UserQueryAdapter },
  { provide: ProfileRepositoryPort, useClass: ProfileRepositoryAdapter },
  { provide: ProfileQueryPort, useClass: ProfileQueryAdapter },
];

export const userProviders: Provider[] = [
  CreateUserWithProfileUseCase,
  ...userBindings,
];
