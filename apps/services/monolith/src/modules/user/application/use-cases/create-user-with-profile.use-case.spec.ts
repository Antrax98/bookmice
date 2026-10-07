import { Test } from '@nestjs/testing';
import { TransactionRunnerPort } from '../../../../common/domain/transaction-runner.interface';
import { CreateUserWithProfileUseCase } from './create-user-with-profile.use-case';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { ProfileRepositoryPort } from '../../domain/ports/profile-repository.port';
import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';

/**
 * Tests de `CreateUserWithProfileUseCase`, el único caso donde el módulo escribe
 * en dos tablas a la vez.
 *
 * Se monta el grafo con los puertos sustituidos por dobles, no con la base de
 * datos: lo que se prueba aquí es la **coordinación** (que se pase el mismo
 * scope a las dos escrituras, y que el `userId` del perfil sea el id real del
 * usuario), no que TypeORM sepa insertar. Eso último lo prueba la migración.
 */

/**
 * Adapta un doble escrito como `{ transaction(cb) }` al puerto
 * `TransactionRunnerPort`, cuya API es `run(op)`.
 *
 * Antes el caso de uso tomaba `DataSource` y los dobles se escribían con
 * `transaction`. Ahora toman el puerto, y los dobles se reescribirían enteros
 * para cambiar una palabra. Este helper deja el cuerpo de cada test intacto y
 * hace visible la equivalencia.
 */
/**
 * Adapta un doble escrito como `{ transaction(cb) }` al puerto
 * `TransactionRunnerPort`, cuya API es `run(op)`.
 *
 * Antes el caso de uso tomaba `DataSource` y los dobles se escribían con
 * `transaction`. Ahora toman el puerto, y reescribir cinco bloques de test para
 * cambiar una palabra no merece la pena. Este helper deja el cuerpo de cada test
 * intacto y hace visible la equivalencia.
 */
const runner = (
  transaction: (cb: (scope: unknown) => unknown) => unknown,
): TransactionRunnerPort => ({
  // El doble hace `cb({ save })`, es decir, le pasa a la operación un objeto con
  // `save`. Eso es un `PersistenceScope` de facto, aunque se llame `manager`
  // por herencia de cuando el caso de uso tomaba `DataSource`. El cast está
  // porque los tipos no coinciden, no porque haya un `any` escondido: el doble
  // es local a este fichero.
  run: <T>(op: (scope: PersistenceScope) => Promise<T>): Promise<T> =>
    Promise.resolve(
      transaction(op as unknown as (scope: unknown) => unknown),
    ) as Promise<T>,
});

const idFalso = 'f1c8a2de-0000-4000-8000-000000000000';

const userFalso = {
  id: idFalso,
  username: 'antrax_001',
  email: 'test@correo.com',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * El `scope` que `auth` pasará: el de su propia transacción, la que crea usuario,
 * perfil y credenciales a la vez.
 *
 * Es un objeto **suyo**, con su `save` propio, para que los tests puedan
 * comprobar la identidad con `toBe`. Un scope equivalentemente falso no serviría:
 * dos objetos con el mismo comportamiento no demuestran que las escrituras caigan
 * en la misma transacción, solo que se les pasó algo parecido.
 */
const scopeAjeno = {
  save: jest.fn(() => Promise.resolve(userFalso)),
} as unknown as PersistenceScope;

/** Un runner que no debería tocar nada cuando le pasan un `scope`. */
const dataSourceFalso = {
  transaction: () => {
    throw new Error('no debería abrir transacción: ya viene un scope de fuera');
  },
} as unknown as TransactionRunnerPort;

describe('CreateUserWithProfileUseCase.execute', () => {
  let guardados: Array<{ tabla: string; props: unknown; scope?: unknown }>;
  let userRepo: UserRepositoryPort;
  let profileRepo: ProfileRepositoryPort;
  let createUser: CreateUserWithProfileUseCase;

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

    // Se falsea la transacción: se ejecuta la operación con un scope cuyo `save`
    // devuelve el usuario falso, y que lleva una `marca` para poder comprobar
    // que es **el mismo objeto** el que llega a las dos escrituras.
    const dataSource = runner((cb) => {
      const scope = {
        save: () => Promise.resolve(userFalso),
        marca: 'scope-de-la-transaccion',
      };
      return Promise.resolve(cb(scope));
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserWithProfileUseCase,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: TransactionRunnerPort, useValue: dataSource },
      ],
    }).compile();

    createUser = moduleRef.get(CreateUserWithProfileUseCase);
  });

  it('escribe el usuario y su perfil', async () => {
    await createUser.execute({
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
    await createUser.execute({
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
    const { user } = await createUser.execute({
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

    const dataSource = runner((cb) => {
      transaction();
      return Promise.resolve(cb({ save: () => Promise.resolve(userFalso) }));
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserWithProfileUseCase,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: TransactionRunnerPort, useValue: dataSource },
      ],
    }).compile();

    await moduleRef.get(CreateUserWithProfileUseCase).execute({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
      fullName: '  Antrax  ',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  /**
   * El `scope` de fuera es lo que va a usar `auth`: `credentials` es tabla suya,
   * así que `auth` abre la transacción y este caso de uso escribe dentro.
   */
  describe('con un scope de fuera', () => {
    /** El mismo runner del `beforeEach`, pero que delata si se le llama. */
    const dataSourceQueSeVigila = () => {
      const transaction = jest.fn();

      return {
        transaction,
        dataSource: {
          transaction: (cb: (m: unknown) => unknown) => {
            transaction();
            return Promise.resolve(
              cb({ save: () => Promise.resolve(userFalso) }),
            );
          },
        } as unknown as TransactionRunnerPort,
      };
    };

    const montar = async (dataSource: TransactionRunnerPort) => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          CreateUserWithProfileUseCase,
          { provide: UserRepositoryPort, useValue: userRepo },
          { provide: ProfileRepositoryPort, useValue: profileRepo },
          { provide: TransactionRunnerPort, useValue: dataSource },
        ],
      }).compile();

      return moduleRef.get(CreateUserWithProfileUseCase);
    };

    // El más importante de los tres. Anidar transacciones no daría una más
    // amplia: `auth` ya está dentro de la suya, y abrir otra aquí solo
    //kgeneraría trabajo y dejaría el scope dentro de una transacción que se
    // ignora. Es el fallo que haría que un alta quedara a medias sin que se viera.
    it('NO abre su propia transacción', async () => {
      const { transaction, dataSource } = dataSourceQueSeVigila();

      const useCase = await montar(dataSource);
      await useCase.execute(
        {
          username: 'antrax_001',
          email: 'test@correo.com',
          isActive: true,
          fullName: 'Antrax',
        },
        scopeAjeno,
      );

      expect(transaction).not.toHaveBeenCalled();
    });

    // La otra mitad del contrato: si el scope no se propaga, las dos escrituras
    // caen en transacciones distintas y la atomicidad del alta no existe, aunque
    // `auth` sí creyera que sí.
    it('escribe las dos filas en el scope que le llega', async () => {
      const useCase = await montar(dataSourceFalso);

      await useCase.execute(
        {
          username: 'antrax_001',
          email: 'test@correo.com',
          isActive: true,
          fullName: 'Antrax',
        },
        scopeAjeno,
      );

      expect(guardados.map((g) => g.tabla)).toEqual(['users', 'profiles']);
      for (const guardado of guardados) {
        expect(guardado.scope).toBe(scopeAjeno);
      }
    });

    it('sigue validando los modelos antes de escribir', async () => {
      const useCase = await montar(dataSourceFalso);

      await expect(
        useCase.execute(
          {
            username: 'corto',
            email: 'test@correo.com',
            isActive: true,
            fullName: 'Antrax',
          },
          scopeAjeno,
        ),
      ).rejects.toThrow(DataValidationException);

      expect(guardados).toHaveLength(0);
    });
  });

  it('normaliza antes de guardar, no después', async () => {
    await createUser.execute({
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
    await createUser.execute({
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

    const dataSource = runner((cb) => {
      transaction();
      return Promise.resolve(cb({ save: () => Promise.resolve(userFalso) }));
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserWithProfileUseCase,
        { provide: UserRepositoryPort, useValue: userRepo },
        { provide: ProfileRepositoryPort, useValue: profileRepo },
        { provide: TransactionRunnerPort, useValue: dataSource },
      ],
    }).compile();

    await expect(
      moduleRef.get(CreateUserWithProfileUseCase).execute({
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
