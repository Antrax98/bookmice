import { Test } from '@nestjs/testing';
import { ResourceNotFoundException } from '../../../../common/exceptions/resource-not-found.exception';
import { GetMeUseCase } from './get-me.use-case';
import { ProfileQueryPort } from '../ports/profile-query.port';
import { UserQueryPort } from '../ports/user-query.port';
import { ProfileProps } from '../../domain/interfaces/profile.interface';
import { UserProps } from '../../domain/interfaces/user.interface';

/**
 * Tests de `GetMeUseCase`.
 *
 * Se prueba con dobles en los puertos de lectura, no contra Postgres: lo que
 * importa aquí es qué devuelve y qué hace cuando el perfil no existe, no que
 * TypeORM sepa mapear una fila.
 */

const USUARIO: UserProps = {
  id: '202cc305-a28d-43f8-ba81-b6d69734f975',
  email: 'lector@example.com',
  username: 'lector_prueba',
  isActive: true,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
};

const PERFIL: ProfileProps = {
  id: '7c9a6d11-0000-4000-8000-000000000001',
  userId: USUARIO.id,
  fullName: 'Lector de Prueba',
  headline: null,
  bio: null,
  location: null,
  publicEmail: null,
  avatarUrl: null,
  isPrivate: false,
  updatedAt: new Date('2026-10-01'),
};

async function montaCon(
  usuario: UserProps | null,
  perfil: ProfileProps | null,
): Promise<GetMeUseCase> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GetMeUseCase,
      {
        provide: UserQueryPort,
        // Sin `async`: estos dobles no esperan nada, y `require-await` lo dice.
        useValue: { findOneUser: () => Promise.resolve(usuario) },
      },
      {
        provide: ProfileQueryPort,
        useValue: { findOneProfile: () => Promise.resolve(perfil) },
      },
    ],
  }).compile();

  return moduleRef.get(GetMeUseCase);
}

describe('GetMeUseCase', () => {
  it('devuelve el nombre de usuario y el del perfil', async () => {
    const useCase = await montaCon(USUARIO, PERFIL);

    const result = await useCase.execute({ userId: USUARIO.id });

    expect(result).toEqual({
      userId: USUARIO.id,
      username: 'lector_prueba',
      fullName: 'Lector de Prueba',
      avatarUrl: null,
    });
  });

  /**
   * El caso por defecto, no el raro: el alta no pide avatar, así que toda cuenta
   * nueva nace sin él. Por eso el DTO lo declara nullable y el cliente tiene que
   * tener un respaldo.
   */
  it('devuelve avatarUrl null cuando no hay avatar', async () => {
    const useCase = await montaCon(USUARIO, PERFIL);

    const result = await useCase.execute({ userId: USUARIO.id });

    expect(result.avatarUrl).toBeNull();
  });

  it('devuelve el avatar cuando sí lo hay', async () => {
    const useCase = await montaCon(USUARIO, {
      ...PERFIL,
      avatarUrl: 'https://ejemplo.com/avatar.png',
    });

    const result = await useCase.execute({ userId: USUARIO.id });

    expect(result.avatarUrl).toBe('https://ejemplo.com/avatar.png');
  });

  /**
   * **No** devuelve email, ni biografía, ni ubicación. Es lo que impide que este
   * endpoint acabe siendo la puerta de atrás a `users.email` que los dos puertos
   * de lectura de `user` existen para cerrar.
   */
  it('no devuelve el email ni el resto del perfil', async () => {
    const useCase = await montaCon(USUARIO, PERFIL);

    const result = await useCase.execute({ userId: USUARIO.id });

    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('bio');
    expect(result).not.toHaveProperty('location');
    expect(result).not.toHaveProperty('publicEmail');
  });

  /**
   * Un usuario sin perfil no es un estado válido: la alta escribe los dos en una
   * transacción. Llegar aquí significa que alguien escribió por fuera, y un
   * resultado a medias sería peor que un error, porque el cliente lo dibujaría
   * sin avisar.
   */
  it('lanza si el usuario no tiene perfil', async () => {
    const useCase = await montaCon(USUARIO, null);

    await expect(useCase.execute({ userId: USUARIO.id })).rejects.toThrow(
      ResourceNotFoundException,
    );
  });

  it('lanza si tampoco existe el usuario', async () => {
    const useCase = await montaCon(null, null);

    await expect(useCase.execute({ userId: 'inexistente' })).rejects.toThrow(
      ResourceNotFoundException,
    );
  });
});
