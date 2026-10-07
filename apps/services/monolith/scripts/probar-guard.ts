import { Controller, Get, Module } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import configuration from '../src/config/configuration';
import { authenticationOptionsFactory } from '../src/common/auth/authentication-options';
import { JwtAuth } from '../src/modules/auth/infrastructure/security/jwt-auth.provider';
import { UserQueryPort } from '../src/modules/user/application/ports/user-query.port';

/**
 * Prueba del guard por HTTP de verdad.
 *
 * Un `ExecutionContext` a mano no sirve: `Reflector.get` no encuentra metadata y
 * el guard cree que la ruta es pública, así que **acepta cualquier cosa,
 * incluso una petición sin cabecera**. Solo HTTP real lo demuestra.
 */

const userId = randomUUID();

@Controller('privado')
class PrivadoController {
  // Sin `@Public()`: con el guard global, esta ruta pide token.
  @Get('yo')
  yo(@CurrentUser() usuario: { email: string }) {
    return { email: usuario.email };
  }
}

const userRepo = {
  findOneUser(filtros: { id?: string }) {
    return Promise.resolve(
      filtros.id === userId
        ? {
            id: userId,
            username: 'antrax_e2e',
            email: 'antrax@correo.com',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : null,
    );
  },
};

@Module({
  controllers: [PrivadoController],
  // `JwtAuth` va aquí y no en el módulo raíz porque es donde está su
  // dependencia: `AuthenticationRegistry` lo da `AuthenticationModule`, que es
  // global, pero `UserQueryPort` lo da este módulo.
  providers: [JwtAuth, { provide: UserQueryPort, useValue: userRepo }],
})
class PruebaModule {}

async function main() {
  const modRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
      AuthenticationModule.forRootAsync({
        inject: [ConfigService],
        useFactory: authenticationOptionsFactory,
      }),
      PruebaModule,
    ],
  }).compile();

  const app = modRef.createNestApplication();
  await app.init();
  await app.listen(0);

  const url = await app.getUrl();
  const { TokenService } = await import('@nestjs/authentication');
  const tokens = app.get(TokenService);

  const pareja = await tokens.issue(userId, {
    method: 'password',
    claims: { amr: ['pwd'] },
  });

  const probar = async (etiqueta: string, cabecera?: string) => {
    const res = await fetch(`${url}/privado/yo`, {
      headers: cabecera ? { Authorization: cabecera } : {},
    });
    const cuerpo = await res.text();
    console.log(
      `  ${etiqueta.padEnd(24)}-> ${res.status} ${res.status === 200 ? cuerpo : ''}`,
    );
  };

  console.log('\n=== el guard, por HTTP real ===');
  await probar('token valido', `Bearer ${pareja.accessToken}`);
  await probar('sin cabecera');
  await probar('basura', 'Bearer no-es-un-token');
  await probar(
    'firma manipulada',
    `Bearer ${pareja.accessToken.slice(0, -1)}X`,
  );

  const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  );
  const p = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
  await probar('alg=none', `Bearer ${h}.${p}.`);

  const otro = await tokens.issue(randomUUID(), {
    method: 'password',
    claims: { amr: ['pwd'] },
  });
  await probar('usuario inexistente', `Bearer ${otro.accessToken}`);

  await app.close();
}

main().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.log('FATAL:', mensaje.slice(0, 200));
  process.exit(1);
});
