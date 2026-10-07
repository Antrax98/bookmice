import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { RegisterDto } from './auth.dto';
import {
  RegisterUseCase,
  type RegisterResult,
} from '../../application/use-cases/register.use-case';

/**
 * El alta de cuenta.
 *
 * ## Por qué un controller y no dos en uno
 *
 * Una regla de ESLint exige que un controller sea la puerta a **un** caso de uso,
 * y acierto: un endpoint con dos coordinationes dentro es un caso de uso disfrazado
 * de capa de transporte. Con un controller por caso de uso, el controller solo
 * traduce HTTP a una llamada, y esa es toda su responsabilidad.
 *
 * Es el mismo criterio con el que `user` fusionó usuario y perfil en un módulo en
 * lugar de dos módulos: la coordinación se queda en `application`, no en el
 * borde.
 *
 * ## Por qué `@Public()`
 *
 * El guard global de `@nestjs/authentication` pide usuario en toda ruta que no
 * lleve `@Public()`. Es fail closed a propósito: una ruta nueva nace protegida, y
 * abrirla es una decisión explícita. Estas dos son las únicas excepciones, porque
 * son precisamente las rutas **anteriores** a tener un token.
 */
@Public()
@Controller('auth/register')
export class RegisterController {
  constructor(private readonly register: RegisterUseCase) {}

  /**
   * `201 Created`, el default de Nest para `POST`: se ha creado un recurso, la
   * cuenta.
   *
   * No devuelve token a propósito. Emitirlo aquí haría que un registro fuera
   * también un login, y en la fase 2 eso significaría saltarse la verificación
   * de correo sin querer. Quien se registra, después entra por `login`.
   */
  @Post()
  async registrar(@Body() body: RegisterDto): Promise<RegisterResult> {
    return this.register.execute({
      username: body.username,
      email: body.email,
      fullName: body.fullName,
      password: body.password,
    });
  }
}
