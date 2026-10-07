import { Injectable } from '@nestjs/common';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import {
  ProfileNewProps,
  ProfileProps,
} from '../../domain/interfaces/profile.interface';
import {
  UserNewProps,
  UserProps,
} from '../../domain/interfaces/user.interface';
import { CreateUserWithProfileUseCase } from '../../application/use-cases/create-user-with-profile.use-case';
import { UserCreationPort } from '../../domain/ports/user-creation.port';

/**
 * Adapter de `UserCreationPort`: delega en el caso de uso.
 *
 * No tiene lógica, y esa es la gracia. Su trabajo es **cortar el acoplamiento**:
 * `auth` depende del contrato y no sabe que por debajo hay un caso de uso con
 * dos repositorios y un `DataSource`. Si `user` reorganiza el alta, aquí se
 * toca un fichero y `auth` no se entera.
 *
 * ## Por qué en `infrastructure` y no junto al caso de uso
 *
 * Por la regla de flechas: un adapter es lo único que puede conocer a la vez el
 * puerto de `domain` y la implementación de `application`. Si el adapter viviera
 * en `application`, `user` se estaría importando a sí mismo por el otro lado, y
 * el grafo de `boundaries` deja de decir la verdad.
 */
@Injectable()
export class UserCreationAdapter implements UserCreationPort {
  constructor(
    private readonly createUserWithProfile: CreateUserWithProfileUseCase,
  ) {}

  async createWithProfile(
    props: UserNewProps & Pick<ProfileNewProps, 'fullName'>,
    scope?: PersistenceScope,
  ): Promise<{ user: UserProps; profile: ProfileProps }> {
    // El `scope` se pasa tal cual, sin tocar. Si el adapter lo envolviera o
    // tradujera, el `scope` que llega a los repositorios dejaría de ser el
    // mismo objeto que el que abrió la transacción, que es justo la propiedad
    // que hace que dos escrituras caigan en la misma.
    return this.createUserWithProfile.execute(props, scope);
  }
}
