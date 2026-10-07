import { Injectable } from '@nestjs/common';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import { TransactionRunnerPort } from '../../../../common/domain/transaction-runner.interface';
import {
  UserNewProps,
  UserProps,
} from '../../domain/interfaces/user.interface';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { User } from '../../domain/models/user.model';
import { Profile } from '../../domain/models/profile.model';
import {
  ProfileNewProps,
  ProfileProps,
} from '../../domain/interfaces/profile.interface';
import { ProfileRepositoryPort } from '../../domain/ports/profile-repository.port';

/**
 * Alta de usuario con su perfil. Coordina, no valida.
 *
 * La validación está en los modelos (`User.create`, `Profile.create`), y eso
 * es deliberado. Si el caso de uso la duplicara, habría dos reglas de username y
 * la que se olvidara de actualizar seguiría pasando los tests. Aquí solo se
 * llama a los modelos y se persiste lo que devuelven, ya normalizado.
 *
 * No acepta id ni fechas a propósito: ni `UserNewProps` ni `ProfileNewProps` los
 * tienen. Un caso de uso que quisiera inventarse un id no compila. El id lo pone
 * `createNew` con `randomUUID()`.
 *
 * ## Por qué esto es una clase y no `UserService`
 *
 * Una clase por caso de uso, y no un servicio por módulo. La razón concreta es
 * `DataSource`: este caso de uso lo necesita porque abre una transacción, pero
 * un `updateProfile` o un `listShelves` no lo necesitarían, y con un servicio
 * único los tres arrastrarían la dependencia de TypeORM. Aquí cada caso de uso
 * declara lo que usa y nada más.
 *
 * La segunda razón son los tests: un controlador que solo actualiza el perfil no
 * debería tener que falsificar `dataSource.transaction` para montar su módulo.
 *
 * Por qué `user` y `profile` viven en el mismo módulo está en el `AGENTS.md` y en
 * el docblock de `user.module.ts`. No se repite aquí.
 */
@Injectable()
export class CreateUserWithProfileUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly profiles: ProfileRepositoryPort,
    private readonly transactions: TransactionRunnerPort,
  ) {}

  /**
   * Alta de usuario con su perfil, en una transacción.
   *
   * La transacción es lo que vuelve imposible el fallo parcial. Sin ella, un
   * `fullName` inválido en el segundo insert dejaba un usuario huérfano que la
   * base aceptaba sin quejarse, porque no hay nada en el esquema que exija que
   * todo usuario tenga perfil.
   *
   * Los modelos se validan **antes** de abrir la transacción: abrirla para
   * acabar lanzando por un dato inválido que ya se podía comprobar es trabajo
   * tirado, y la transacción no es barata.
   *
   * ## El `scope` de fuera
   *
   * `auth` tiene que crear usuario, perfil y credenciales en la misma
   * transacción, y `credentials` es tabla suya. Así que el que abre la
   * transacción es `auth`, y este caso de uso recibe su `scope` y escribe
   * dentro. Sin esto volvería el fallo parcial que esto arregla: un usuario sin
   * credencial, que la base acepta igual porque no hay nada en el esquema que lo
   * impida.
   *
   * Y al revés: si viene `scope`, **no** se abre transacción propia. Anidarlas
   * no daría una transacción más amplia, solo una que se ignora.
   */
  async execute(
    params: UserNewProps & Pick<ProfileNewProps, 'fullName'>,
    scope?: PersistenceScope,
  ): Promise<{ user: UserProps; profile: ProfileProps }> {
    // Los dos modelos se construyen **antes** de abrir la transacción, y por
    // eso los dos se validan enteros con sus datos reales: el perfil ya lleva el
    // `userId` definitivo, porque el usuario ya tiene id.
    //
    // Esto es lo que se ganó al mover la generación del id de la base a la
    // aplicación. Con `DEFAULT gen_random_uuid()`, el `userId` del perfil solo se
    // conocía tras el primer INSERT, así que había que validar el perfil con
    // un `userId: ''` y corregirlo después.
    const userDraft = User.createNew(params);
    const profileDraft = Profile.createNew({
      userId: userDraft.toProps().id,
      fullName: params.fullName,
      isPrivate: false,
    });

    const escribir = async (
      ambito: PersistenceScope,
    ): Promise<{ user: UserProps; profile: ProfileProps }> => {
      const user = await this.users.create(userDraft.toPersistence(), ambito);

      return {
        user,
        profile: await this.profiles.create(
          profileDraft.toPersistence(),
          ambito,
        ),
      };
    };

    if (scope) return escribir(scope);

    // El mismo puerto que `auth.RegisterUseCase`, y por el mismo motivo: inyectar
    // `DataSource` aquí haría que `pnpm gen:openapi` fallara, porque
    // `openapi-spec.module.ts` no tiene `DatabaseModule`.
    return this.transactions.run(escribir);
  }
}
