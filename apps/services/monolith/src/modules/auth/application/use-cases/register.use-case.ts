import { Injectable } from '@nestjs/common';
import { TransactionRunnerPort } from '../../../../common/domain/transaction-runner.interface';
import { UserCreationPort } from '../../../user/domain/ports/user-creation.port';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CredentialQueryPort } from '../ports/credential-query.port';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { CredentialRepositoryPort } from '../../domain/ports/credential-repository.port';
import { Password } from '../../domain/models/password.model';

/** Lo que devuelve el alta. */
export interface RegisterResult {
  userId: string;
  username: string;
}

/**
 * Alta de cuenta: usuario, perfil y credencial, en **una** transacción.
 *
 * ## Las tres tablas son de dos módulos, y por eso la transacción la abre `auth`
 *
 * `credentials` es tabla de `auth`. `users` y `profiles` son de `user`. Si cada
 * móduloabriera su propia transacción, habría una ventana entre las dos en la
 * que existe un usuario sin credencial: se podría registrar, y no entrar nunca.
 * La base no avisa, porque no hay foreign key entre `credentials` y `users` (ver
 * la entidad).
 *
 * Así que `auth` abre la transacción y pide a `user` que escriba dentro, mediante
 * `UserCreationPort` y su `scope`. Es el mismo reparto que el que ya hace
 * `CreateUserWithProfileUseCase` con usuario y perfil, un nivel más arriba.
 *
 * ## Por qué el usuario se busca **antes** de la transacción
 *
 * Para poder responder "ese correo ya existe" sin haber escrito nada. La
 * comprobación fuera de la transacción es una carrera: dos registros a la vez
 * con el mismo correo pueden pasar los dos. Lo que cierra la carrera de verdad es
 * el `UNIQUE` de `users.email`, y por eso el error de la base se traduce a un
 * error de negocio al final, no antes.
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly users: UserCreationPort,
    private readonly credentials: CredentialRepositoryPort,
    private readonly credentialReads: CredentialQueryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly transactions: TransactionRunnerPort,
  ) {}

  async execute(params: {
    username: string;
    email: string;
    fullName: string;
    password: string;
  }): Promise<RegisterResult> {
    // El orden importa: la contraseña se valida **antes** de tocar la base, y
    // también antes de hashear. Un `logN: 10` cuesta 1 MiB y un `logN: 17`
    // cuesta 128, así que hashear una contraseña inválida es tirar 128 MiB de
    // CPU para después rechazar la petición.
    const password = Password.create(params.password);

    const existente = await this.credentialReads.findByEmail(params.email);
    if (existente) {
      // `BusinessException` y no `UnauthenticatedException` porque esto es un 409,
      // no un 401: el que se equivoca al registrarse no es anónimo, es alguien que
      // ya existe. El código lo trae la excepción, y el filtro lo pone en el
      // cuerpo de la respuesta.
      //
      // El mensaje **sí** dice que el correo está en uso, y es deliberado: en un
      // alta no hay usuario previo al que proteger. La enumeración de cuentas es
      // un problema del **login**, donde un atacante puede probarlos sin crear
      // nada. Aquí saber que un correo está ocupado es la respuesta honesta, y
      // evita el email enumeration.
      throw new BusinessException('That email is already registered');
    }

    // El hash se calcula **fuera** de la transacción. Son ~128 MiB de CPU y hasta
    // un segundo, y dentro de una transacción eso sería tiempo con la conexión
    // tomada sin necesidad: la transacción no protege nada mientras se hashea, y
    // si el hash falla no hay nada que deshacer.
    const passwordHash = await this.hasher.hash(password.value);

    // `TransactionRunnerPort` y no `DataSource`: un caso de uso que inyecte
    // `DataSource` no se puede instanciar sin `DatabaseModule`, y
    // `openapi-spec.module.ts` existe precisamente para no tenerlo. El fallo era
    // `Nest can't resolve dependencies of the RegisterUseCase (?)`.
    return this.transactions.run(async (scope) => {
      const { user } = await this.users.createWithProfile(
        {
          username: params.username,
          email: params.email,
          isActive: true,
          fullName: params.fullName,
        },
        scope,
      );

      const credential = await this.credentials.create(
        { userId: user.id, passwordHash },
        scope,
      );

      return { userId: credential.userId, username: user.username };
    });
  }
}
