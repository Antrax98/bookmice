import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_LIMITS } from '../../domain/models/password.model';
import { LoginResult } from '../../application/use-cases/login.use-case';
import { RegisterResult } from '../../application/use-cases/register.use-case';

/**
 * El cuerpo de `POST /auth/register`.
 *
 * ## Por qué estas reglas están **también** en `Password`
 *
 * Por dos razones distintas, y ninguna es duplicación gratuita:
 *
 * - **El DTO** da el error en el **borde**: un 400 con el campo `password`, que
 *   el cliente pinta debajo del input. Es una cortesía, y también una defensa:
 *   una contraseña de 3 caracteres no debería llegar a hashten.
 * - **`Password`** garantiza la regla para **quien llama**, y no solo para quien
 *   entra por HTTP. Un import de datos o un script que usen el caso de uso
 *   incumplen el mismo contrato.
 *
 * Los números salen de `PASSWORD_LIMITS` y no se escriben a mano, para que las dos
 * declaraciones no puedan separarse por accidente.
 *
 * ## El mínimo del login es otro
 *
 * `LoginDto` **no** lleva `MinLength`. Si el login exigiera 12 caracteres, un
 * usuario que se registró con una regla más laxa se quedaría fuera de su cuenta
 * y no podría recuperarla. Las reglas del alta no son las del acceso.
 */
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_LIMITS.minLength)
  @MaxLength(PASSWORD_LIMITS.maxBytes)
  password: string;

  /**
   * El `username` viene del cliente y pasa por `User.createNew`, que lo valida de
   * verdad (10 a 50 caracteres, y que empiece por letra o número). El DTO solo
   * comprueba que sea texto: duplicar las reglas aquí las tendría dos veces.
   */
  @IsString()
  @MaxLength(50)
  username: string;

  @IsString()
  @MaxLength(120)
  fullName: string;
}

export class RegisterResultDto implements RegisterResult {
  userId: string;
  username: string;
}

/**
 * El cuerpo de `POST /auth/login`.
 *
 * El `MaxLength` **sí** está, y parece contradicción con lo de arriba: no lo
 * está para aceptar contraseñas cortas, sino para que un cuerpo de 10 MB no llegue
 * a hashten. scrypt rechaza con `RangeError` lo que pase de 4 KiB, y convertir eso
 * en un 400 limpio es mejor que un 500.
 */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(4096)
  password: string;
}

export class LoginResultDto implements LoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}
