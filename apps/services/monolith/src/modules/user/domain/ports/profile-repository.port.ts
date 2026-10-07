import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import { ProfileProps, ProfileWithId } from '../interfaces/profile.interface';

/**
 * Puerto de ESCRITURA del perfil, en `domain/ports/`.
 *
 * `update` no existe todavía. Un perfil se edita mucho (es su ritmo de cambio),
 * así que llegará, pero se añade cuando haya un caso de uso que lo pida y no
 * antes: un puerto que nadie llama es deuda.
 *
 * `ProfileWithId` y no `ProfileNewProps` por lo mismo que en
 * `UserRepositoryPort`: el id lo genera la aplicación y va en el INSERT.
 *
 * `scope` funciona igual que en `UserRepositoryPort` y por el mismo motivo:
 * el alta escribe usuario y perfil en la misma transacción.
 */
export abstract class ProfileRepositoryPort {
  abstract create(
    props: ProfileWithId,
    scope?: PersistenceScope,
  ): Promise<ProfileProps>;
}
