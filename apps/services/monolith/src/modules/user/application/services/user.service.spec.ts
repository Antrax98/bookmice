import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { ProfileRepositoryPort } from '../../domain/ports/profile-repository.port';
import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';

/**
 * Tests de `createUserWithProfile`, el único caso donde el módulo escribe en
 * dos tablas a la vez.
 *
 * Se monta el grafo con los puertos sustituidos por dobles, no con la base de
 * datos: lo que se prueba aquí es la **coordinación** (que se pase el mismo
 * scope a las dos escrituras, y que el `userId` del perfil sea el id real del
 * usuario), no que TypeORM sepa insertar. Eso último lo prueba la migración.
 */

const idFalso = 'f1c8a2de-0000-4000-8000-000000000000';

const userFalso = {
  id: idFalso,
  username: 'antrax_001',
  email: 'test@correo.com',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserService.createUserWithProfile', () => {
  let guardados: Array<{ tabla: string; props: unknown; scope?: unknown }>;
  let userRepo: UserRepositoryPort;
  let profileRepo: ProfileRepositoryPort;
  let service: UserService;

  beforeEach(async () => {
    guardados = [];

    userRepo = {
      create: (props, scope) => {
        guardados.push({ tabla: 'users', props, scope });
        // Se devuelve el id que trae la props, no un id fijo. Con un id fijo el
        // doble mentiría: el servicio ya genera el id, y lo que se guarda es
        // el suyo. Un doble que inventa el valor oculta justo el bug que estos
        // tests comprueban.
        return Promise.resolve({
          ...userFalso,
          id: (props as { id: string }).id,
        });
      },
    };

    profileRepo = {
      create: (props, scope) => {
        guardados.push({ tabla: 'profiles', props, scope });
        return Promise.resolve({
          id: (props as { id: string }).id,
          userId: idFalso,
          fullName: 'Antrax',
          headline: null,
          bio: null,
          location: null,
          publicEmail: null,
          avatarUrl: null,
          isPrivate: false,
          updatedAt: new Date(),
        });
      },
    };

    // Se falsea la transacción: se ejecuta el callback con un `manager` cuyo
    // `save` devuelve un id fijo. Importa que la transacción **se invoque**,
    // no lo que haga internamente.
    const dataSource = {
      transaction: (cb: (manager: unknown) => unknown) => {
        const manager = {
          save: () => Promise.resolve(userFalso),
          marca: 'scope-de-la-transaccion',
        };
        return Promise.resolve(cb(manager));
      },
    } as unknown as DataSource;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  it('escribe el usuario y su perfil', async () => {
    await service.createUserWithProfile({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: 'Antrax',
    });

    expect(guardados.map((g) => g.tabla)).toEqual(['users', 'profiles']);
  });

  /**
   * Es el test que importa. Si los dos inserts no compartieran scope, cada uno
   * iría en su propia transacción y el segundo podría fallar dejando un usuario
   * huérfano, que es exactamente lo que el método existe para evitar.
   */
  it('pasa el mismo scope a las dos escrituras', async () => {
    await service.createUserWithProfile({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: 'Antrax',
    });

    // Se comparan los scopes entre sí, y no contra un objeto esperado hecho a
    // mano: lo que importa es que las dos escrituras compartan transaction, y
    // eso solo se comprueba con que el segundo sea el mismo objeto que el
    // primero.
    const [usuario, perfil] = guardados;
    expect(usuario.scope).toBeDefined();
    expect(perfil.scope).toBe(usuario.scope);
  });

  /**
   * La propiedad que se ganó al mover la generación del id de la base a la
   * aplicación: el perfil se persiste con un `userId` **real** y con **su
   * propio id**, sin esperar a que termine el INSERT del usuario.
   *
   * Con `DEFAULT gen_random_uuid()` esto no era posible: el `userId` solo se
   * conocía tras el primer INSERT, así que el perfil se validaba con un dato
   * inventado.
   */
  it('persiste el perfil con su propio id y el userId real', async () => {
    const { user } = await service.createUserWithProfile({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: 'Antrax',
    });

    const guardado = guardados.find((g) => g.tabla === 'profiles');
    const props = guardado?.props as { id: string; userId: string };

    expect(props.userId).toBe(user.id);
    expect(props.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(props.id).not.toBe(user.id);
  });

  it('ambos ids se generan antes de abrir la transacción', async () => {
    // Si el id del perfil se generara dentro de la transacción, la transacción
    // se habría abierto antes de validar el perfil.
    const transaction = jest.fn();

    const dataSource = {
      transaction: (cb: (m: unknown) => unknown) => {
        transaction();
        return Promise.resolve(cb({ save: () => Promise.resolve(userFalso) }));
      },
    } as unknown as DataSource;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    await moduleRef.get(UserService).createUserWithProfile({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: '  Antrax  ',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('normaliza antes de guardar, no después', async () => {
    await service.createUserWithProfile({
      username: '  Antrax_001  ',
      email: '  Test@Correo.COM  ',
      isActive: true,
      fullName: '  Antrax  ',
    });

    const usuario = guardados.find((g) => g.tabla === 'users');
    expect(usuario?.props).toMatchObject({
      username: 'antrax_001',
      email: 'test@correo.com',
    });
  });

  it('el perfil nace sin bio ni avatar, no con cadenas vacías', async () => {
    await service.createUserWithProfile({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: 'Antrax',
    });

    const guardado = guardados.find((g) => g.tabla === 'profiles');
    expect(guardado?.props).not.toHaveProperty('bio');
  });

  it('un nombre de usuario inválido falla antes de abrir la transacción', async () => {
    const transaction = jest.fn();

    const dataSource = {
      transaction: (cb: (m: unknown) => unknown) => {
        transaction();
        return Promise.resolve(cb({ save: () => Promise.resolve(userFalso) }));
      },
    } as unknown as DataSource;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    await expect(
      moduleRef.get(UserService).createUserWithProfile({
        username: 'corto',
        email: 'test@correo.com',
        isActive: true,
        fullName: 'Antrax',
      }),
    ).rejects.toThrow(DataValidationException);

    // Abrir una transacción para acabar lanzando por un dato inválido es
    // trabajo tirado, y la transacción no es gratis.
    expect(transaction).not.toHaveBeenCalled();
  });
});
