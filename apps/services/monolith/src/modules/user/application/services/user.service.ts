import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PersistenceScope } from '../../domain/interfaces/persistence-scope.interface';
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
 * El servicio de aplicación: coordina, no valida.
 *
 * La validación está en los modelos (`User.create`, `Profile.create`), y eso
 * es deliberado. Si el servicio la duplicara, habría dos reglas de username y
 * la que se olvidara de actualizar seguiría pasando los tests. Aquí solo se
 * llama a los modelos y se persiste lo que devuelven, ya normalizado.
 *
 * No acepta id ni fechas a propósito: ni `UserNewProps` ni `ProfileNewProps` los
 * tienen. Un caso de uso que quisiera inventarse un id no compila. El id lo pone
 * `createNew` con `randomUUID()`.
 *
 * ## Por qué `user` y `profile` viven en el mismo módulo
 *
 * Porque un usuario sin perfil no es un estado válido, y el módulo es el sitio
 * donde se hace cumplir esa invariante en vez de dejarla en una convención.
 *
 * Estaban separados con el argumento del "ritmo de cambio", que era falso: ya
 * están en tablas distintas, así que editar la bio nunca tocó la fila que lee
 * el login. Lo que sí protege la separación entre identidad de acceso y cara
 * pública son las **tablas**, y por eso los puertos de lectura siguen siendo
 * dos, no uno: un `UserQueryPort` único invitaría a devolver el email en el
 * mismo objeto que el nombre.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly profiles: ProfileRepositoryPort,
    private readonly dataSource: DataSource,
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
   */
  async createUserWithProfile(
    params: UserNewProps & Pick<ProfileNewProps, 'fullName'>,
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

    return this.dataSource.transaction(async (manager) => {
      // Un único scope para las dos escrituras, y no uno por llamada. Además de
      // ser lo correcto, hace que la identidad del objeto sea la prueba: dos
      // objetos distintos con el mismo manager NO garantizan la misma
      // transacción, porque un repositorio podría ignorarlo y usar su propia
      // conexión.
      const scope: PersistenceScope = { save: manager.save.bind(manager) };

      const user = await this.users.create(userDraft.toPersistence(), scope);

      return {
        user,
        profile: await this.profiles.create(
          profileDraft.toPersistence(),
          scope,
        ),
      };
    });
  }
}
