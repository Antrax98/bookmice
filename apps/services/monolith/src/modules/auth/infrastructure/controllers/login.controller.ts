import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { LoginDto } from './auth.dto';
import {
  LoginUseCase,
  type LoginResult,
} from '../../application/use-cases/login.use-case';

/**
 * El login con correo y contraseña.
 *
 * Controller propio y no uno compartido con el alta, por la misma regla de ESLint
 * que obliga a un caso de uso por controller. Ver `RegisterController`.
 *
 * ## Por qué `@Public()`
 *
 * Es la ruta **anterior** a tener un token: aquí es donde se obtiene. Es la
 * excepción al default del guard global, y lleva `@Public()` explícito por eso,
 * no por descuido.
 */
@Public()
@Controller('auth/login')
export class LoginController {
  constructor(private readonly login: LoginUseCase) {}

  /**
   * `POST` y no `GET`, y no es un detalle de estilo.
   *
   * El cuerpo lleva la contraseña, y un `GET` la pondría en la query string. Eso
   * significa que acabaría en los logs de acceso del servidor, en el historial del
   * navegador y en el `Referer` si la respuesta carga algo externo. Con un
   * `POST`, la contraseña va en el cuerpo y no sale de ahí.
   *
   * `200` y no `201`: no se crea nada, se obtiene una sesión.
   */
  @Post()
  @HttpCode(200)
  async iniciarSesion(@Body() body: LoginDto): Promise<LoginResult> {
    return this.login.execute({
      email: body.email,
      password: body.password,
    });
  }
}
