import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import { ProfileNewProps, ProfileProps } from '../interfaces/profile.interface';
import { UserNewProps, UserProps } from '../interfaces/user.interface';

/**
 * Puerto de **alta** de usuario con su perfil, para que otros módulos lo usen
 * sin conocer el caso de uso que lo implementa.
 *
 * ## Por qué existe
 *
 * `auth` necesita crear usuario, perfil y credenciales en la misma transacción,
 * y `credentials` es tabla de `auth` mientras que las otras dos son de `user`.
 * Alguien tiene que abrir la transacción, y ese alguien es `auth`.
 *
 * La tentación es que `auth.RegisterUseCase` llame directamente a
 * `CreateUserWithProfileUseCase`. Funciona, y el lint lo permite. Pero rompe el
 * patrón que este módulo ya usa: `UserQueryPort` y `ProfileQueryPort` existen
 * justamente para que `review` y `auth` hablen con `user` a través de un
 * contrato y no de una clase. Un cuarto puerto del mismo estilo, no una
 * excepción.
 *
 * ## Lo que compra
 *
 * Los tests, sobre todo. El test de `RegisterUseCase` con el puerto es un doble
 * y poco más; sin él, tendría que montar el caso de uso de `user` entero, con
 * sus dos repositorios y un `DataSource`.
 *
 * Y que el nombre signifique algo: si `user` cambia algún día cómo monta el
 * perfil, `auth` no se entera. Hoy una llamada directa ata a `auth` a los
 * internos de `user`, y eso no se ve hasta que se rompe.
 *
 * ## Por qué lleva `scope`
 *
 * Porque el contrato tiene que poder decir "escribe dentro de esta
 * transacción", o el alta no sería atómica y volvería el problema que
 * arreglamos: un usuario sin credencial que la base acepta sin quejarse.
 *
 * `PersistenceScope` vive en `common/domain` y no aquí a propósito. Si viviera
 * en `user/domain`, `auth` tendría que importar el dominio de `user` solo para
 * pedirle un handle de transacción.
 *
 * ## Va en `domain/ports` y no en `application/ports`
 *
 * Por la segunda mitad de la regla del `AGENTS.md`: las escrituras viven en
 * `domain/ports` y las consultas en `application/ports`. Este puerto escribe.
 *
 * La primera mitad dice "los que la entidad necesita para persistirse", y esta
 * no la necesita ninguna entidad de `user`. Es la excepción, y está aquí porque
 * crear un usuario con su perfil es una capacidad del dominio, no una consulta
 * de lectura.
 */
export abstract class UserCreationPort {
  /**
   * Crea usuario y perfil, atómicamente.
   *
   * Con `scope` las dos escrituras caen dentro de la transacción que lo pasa,
   * normalmente la de `auth.RegisterUseCase`. Sin él, abre su propia. Es el
   * mismo insert en los dos casos: lo único que cambia es en qué transacción
   * cae.
   */
  abstract createWithProfile(
    props: UserNewProps & Pick<ProfileNewProps, 'fullName'>,
    scope?: PersistenceScope,
  ): Promise<{ user: UserProps; profile: ProfileProps }>;
}
