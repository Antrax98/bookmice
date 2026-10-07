import { randomUUID } from 'node:crypto';
import { DomainErrorCollector } from '../../../../common/domain/error-collector';
import {
  UserNewProps,
  UserProps,
  UserWithId,
} from '../interfaces/user.interface';

const MIN_USERNAME_LENGTH = 10;
const MAX_USERNAME_LENGTH = 50;
// Letras, números, guion y guion bajo, empezando por letra o número. Sin
// espacios: el username es el identificador con el que se entra, no el nombre
// que se muestra, y ese vive en `profile.fullName`.
//
// El mínimo es 10 y no 1 porque es la primera barrera contra que se rellene con
// "a" o "test" y ocupe el espacio. El máximo es 50, no 100: en Goodreads el
// username se ve bajo el nombre y 100 caracteres no caben en ninguna parte de
// la interfaz, así que permitirlo solo produce basura.
const USERNAME_SHAPE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const MAX_EMAIL_LENGTH = 255;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private constructor(
    private readonly id: string,
    private username: string,
    private email: string,
    private isActive: boolean,
    private createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(params: UserProps): User {
    const errors = new DomainErrorCollector();

    const username = User.normalizeUsername(params.username);
    const email = User.normalizeEmail(params.email);

    User.collectUsernameErrors(errors, username);
    User.collectEmailErrors(errors, email);

    errors.throwIfAny('The user could not be built: some data is invalid');

    return new User(
      params.id,
      username,
      email,
      params.isActive,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * Alta. `createNew` no recibe `id` ni fechas: el id lo genera aquí y las
   * fechas las pone la base.
   *
   * El id se genera en la aplicación y **no** con `DEFAULT gen_random_uuid()`
   * en la columna, que es lo contrario de lo habitual. Es una decisión
   * deliberada: si el id existe antes de insertar, el perfil se puede construir
   * y validar entero, con su `userId` real, antes de que se abra la
   * transacción. Con el default, el `userId` del perfil no se conoce hasta que
   * el primer INSERT termina, y hay que verificar la mitad de las cosas con un
   * dato inventado.
   *
   * `randomUUID()` de `node:crypto` es un v4 criptográfico, lo mismo que
   * `gen_random_uuid()`. No es una decisión estética: Node usa el CSPRNG del
   * sistema para generarlo, no `Math.random()`.
   */
  static createNew(params: UserNewProps): User {
    const now = new Date();

    return User.create({
      ...params,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  private static collectUsernameErrors(
    errors: DomainErrorCollector,
    username: string,
  ): void {
    if (username.length === 0) {
      errors.add('username', 'Username is required');
      return;
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      errors.add(
        'username',
        `Username must be at least ${MIN_USERNAME_LENGTH} characters long`,
      );
      return;
    }

    if (username.length > MAX_USERNAME_LENGTH) {
      errors.add(
        'username',
        `Username cannot be longer than ${MAX_USERNAME_LENGTH} characters`,
      );
      return;
    }

    if (!USERNAME_SHAPE.test(username)) {
      errors.add(
        'username',
        'Username can only contain letters, numbers, hyphens and underscores, and must start with a letter or number',
      );
    }
  }

  private static collectEmailErrors(
    errors: DomainErrorCollector,
    email: string,
  ): void {
    if (email.length === 0) {
      errors.add('email', 'Email is required');
      return;
    }

    if (email.length > MAX_EMAIL_LENGTH) {
      errors.add(
        'email',
        `Email cannot be longer than ${MAX_EMAIL_LENGTH} characters`,
      );
      return;
    }

    if (!EMAIL_SHAPE.test(email)) {
      errors.add('email', 'Email is not a valid address');
    }
  }

  // A minúsculas, igual que el correo. Si el login compara sin distinguir la
  // caja, la unicidad tiene que ignorarla también, o 'Antrax' y 'antrax' serían
  // dos usuarios distintos y entrar con cualquiera de los dos sería ambiguo.
  // Normalizando al escribir, el índice único que ya existe basta.
  //
  // Aquí **no** hay un `typeof username === 'string'` que devuelva `''` si lo que
  // llega no es una cadena. Se puso cuando el dato venía de un JSON sin validar
  // y hacía falta; ahora el parámetro está declarado `string` y el
  // `DataValidationException` de más abajo es quien se encarga del dato malo.
  //
  // La razón para quitarlo no es solo que sobraba: un `''` silencioso acaba en
  // la tabla `users` como una fila con el identificador vacío, y eso se
  // descubre después, en la consulta. Con el `typeof` fuera, lo que no es
  // cadena revienta aquí, en el alta, con el stack de la llamada.
  private static normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * El `id` va incluido, a diferencia de las fechas. Las fechas las pone la
   * columna (`DEFAULT now()`), que es lo que corresponde a la base; el id lo
   * genera la aplicación, así que es un dato más de la fila.
   *
   * Por eso `UserNewProps` sigue sin tener `id`: quien **crea** el usuario no lo
   * elige. El id lo pone `createNew` una vez y ya.
   */
  toPersistence(): UserWithId {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      isActive: this.isActive,
    };
  }

  toProps(): UserProps {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
