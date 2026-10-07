import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import { UserProps, UserWithId } from '../interfaces/user.interface';

/**
 * Puerto de ESCRITURA. Va en `domain/ports/` porque es la entidad la que
 * necesita poder guardarse: sin esto no se puede crear un usuario, y la
 * escritura no es una necesidad de un caso de uso, es del agregado.
 *
 * `UserWithId` y no `UserNewProps` porque el id lo genera la aplicación y va en
 * el INSERT: si el puerto aceptara el alta sin id, el repositorio tendría que
 * inventarse uno, que es justo lo que se ha decidido que no ocurra.
 *
 * Solo `create`. Una tabla de identidades se cambia poco, y un `update` aquí
 * abriría la puerta a que alguien cambie el email desde dos sitios a la vez.
 *
 * `scope` es el handle de la transacción y es **opcional**: si no se pasa, el
 * repositorio usa el suyo. Existe porque `CreateUserWithProfileUseCase` tiene que
 * escribir el usuario y su perfil en la misma transacción, y en TypeORM eso se
 * hace pasando el mismo handle a las dos escrituras. La alternativa sería meter
 * la transacción dentro del repositorio, que es donde no pertenece: el
 * repositorio no sabe que hay dos tablas.
 *
 * Se declara `PersistenceScope` y no el `EntityManager` de TypeORM porque
 * `domain` no importa el framework. Ver la interfaz para el detalle.
 */
export abstract class UserRepositoryPort {
  abstract create(
    props: UserWithId,
    scope?: PersistenceScope,
  ): Promise<UserProps>;
}
