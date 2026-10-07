import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import {
  CredentialNewProps,
  CredentialProps,
} from '../interfaces/credential.interface';

/**
 * Puerto de ESCRITURA de credenciales, en `domain/ports/`.
 *
 * Va aquí y no en `application/ports` porque es una escritura, que es el criterio
 * que separa las dos carpetas.
 *
 * `scope` funciona igual que en los puertos de `user` y por el mismo motivo:
 * el alta de usuario, perfil y credenciales tiene que caer en **una** transacción
 * aunque las tres tablas sean de dos módulos distintos. Quien la abre es
 * `auth.RegisterUseCase`.
 *
 * `update` no existe todavía. Cambiar una contraseña es un caso de uso real y
 * llegará, pero un puerto que nadie llama es deuda.
 */
export abstract class CredentialRepositoryPort {
  abstract create(
    props: CredentialNewProps,
    scope?: PersistenceScope,
  ): Promise<CredentialProps>;
}
