import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileQueryPort } from './application/ports/profile-query.port';
import { UserQueryPort } from './application/ports/user-query.port';
import { userProviders } from './composition/container';
import { CreateUserWithProfileUseCase } from './application/use-cases/create-user-with-profile.use-case';
import { UserCreationPort } from './domain/ports/user-creation.port';
import { ProfileEntity } from './infrastructure/entities/profile.entity';
import { UserEntity } from './infrastructure/entities/user.entity';

/**
 * Superficie Nest del módulo `user`.
 *
 * Un módulo, dos entidades. `users` es identidad de acceso y `profiles` cara
 * pública, y son tablas distintas porque lo que se expone a terceros no debe
 * incluir el correo del login. Esa separación es de **datos**, no de módulos:
 * por eso los dos puertos de lectura se exportan por separado.
 *
 * `ProfileQueryPort` lo necesitará `review` (el nombre y el avatar de quien
 * escribe una reseña) y `UserQueryPort` lo necesitará `auth` (el login busca
 * por email o username). Siempre por el puerto, nunca importando el modelo.
 *
 * `UserCreationPort` lo necesita `auth` para el alta: `credentials` es tabla de
 * `auth`, así que la transacción la abre `auth` y este puerto deja escribir
 * usuario y perfil dentro de ella. Es el primer puerto de **escritura** que
 * sale del módulo, y por eso lleva `scope`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProfileEntity])],
  controllers: [],
  providers: userProviders,
  // El caso de uso se exporta, y no solo el puerto, porque
  // `UserCreationAdapter` lo necesita para delegar: sin esto, `AuthModule` no
  // puede resolver el binding de `UserCreationPort` y Nest falla al arrancar con
  // `UnknownDependenciesException`.
  exports: [
    UserQueryPort,
    ProfileQueryPort,
    UserCreationPort,
    CreateUserWithProfileUseCase,
  ],
})
export class UserModule {}
