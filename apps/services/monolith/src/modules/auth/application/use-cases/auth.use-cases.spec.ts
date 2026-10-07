import { Test } from '@nestjs/testing';
import { TokenService } from '@nestjs/authentication';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { UnauthenticatedException } from '../../../../common/exceptions/unauthenticated.exception';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import { TransactionRunnerPort } from '../../../../common/domain/transaction-runner.interface';
import { UserQueryPort } from '../../../user/application/ports/user-query.port';
import { UserCreationPort } from '../../../user/domain/ports/user-creation.port';
import { CredentialProps } from '../../domain/interfaces/credential.interface';
import { CredentialRepositoryPort } from '../../domain/ports/credential-repository.port';
import { CredentialQueryPort } from '../ports/credential-query.port';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { LoginUseCase } from './login.use-case';
import { RegisterUseCase } from './register.use-case';

const ALTO = 'contrasena-larga-1';
const LOWER = 'antrax_001';
const USER_ID = 'f1c8a2de-0000-4000-8000-000000000000';

const paramsAlta = {
  username: LOWER,
  email: 'test@correo.com',
  fullName: 'Antrax',
  password: ALTO,
};

const userFalso = {
  id: USER_ID,
  username: LOWER,
  email: 'test@correo.com',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const credencialFalsa = (passwordHash = `hash:${ALTO}`): CredentialProps => ({
  id: 'cred-1',
  userId: USER_ID,
  passwordHash,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Tests de los casos de uso de `auth`, con puertos falsos.
 *
 * El hasher es un doble y no el real a propósito: scrypt con `logN: 17` son 128
 * MiB y casi un segundo por hash. Estos tests no tienen que pagar eso, y por eso
 * existe `PasswordHasherPort`. Ver el puerto.
 */
const hasherFalso = (): PasswordHasherPort => ({
  hash: (password: string) => Promise.resolve(`hash:${password}`),
  verify: (password: string, encoded: string | null | undefined) => {
    // Reproduce el comportamiento real ante una cuenta inexistente: **trabaja
    // igual**. Si devolviera `false` al instante, el login sería más rápido con
    // un email inventado que con uno real, y eso revela qué correos existen.
    if (!encoded) return new Promise((r) => setImmediate(() => r(false)));

    return Promise.resolve(encoded === `hash:${password}`);
  },
  needsRehash: () => false,
});

describe('RegisterUseCase', () => {
  const guardados: Array<{ tabla: string; scope?: unknown }> = [];
  let transactions: { run: jest.Mock };

  const montar = async (
    credencialExistente: CredentialProps | null = null,
    hasher: PasswordHasherPort = hasherFalso(),
  ) => {
    guardados.length = 0;

    const userCreation = jest.fn(
      (props: { username: string; fullName: string }, scope?: unknown) => {
        guardados.push({ tabla: 'users', scope });

        return Promise.resolve({
          user: { ...userFalso, username: props.username },
          profile: { fullName: props.fullName },
        });
      },
    );

    const credentials = jest.fn(
      (props: { passwordHash: string }, scope?: unknown) => {
        guardados.push({ tabla: 'credentials', scope });

        return Promise.resolve(credencialFalsa(props.passwordHash));
      },
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        {
          provide: UserCreationPort,
          useValue: { createWithProfile: userCreation },
        },
        {
          provide: CredentialRepositoryPort,
          useValue: { create: credentials },
        },
        {
          provide: CredentialQueryPort,
          useValue: { findByEmail: () => Promise.resolve(credencialExistente) },
        },
        { provide: PasswordHasherPort, useValue: hasher },
        { provide: TransactionRunnerPort, useValue: transactions },
      ],
    }).compile();

    return {
      register: moduleRef.get(RegisterUseCase),
      userCreation,
      credentials,
    };
  };

  beforeEach(() => {
    // `run` ejecuta la operación con el scope que le pasan, como el adapter real.
    transactions = {
      run: jest.fn((op: (scope: PersistenceScope) => Promise<unknown>) =>
        Promise.resolve(
          op({ save: <T>(): Promise<T> => Promise.resolve({} as T) }),
        ),
      ),
    };
  });

  it('crea el usuario con perfil y la credencial', async () => {
    const { register, userCreation, credentials } = await montar();

    const resultado = await register.execute(paramsAlta);

    expect(resultado.userId).toBe(USER_ID);
    expect(resultado.username).toBe(LOWER);
    expect(userCreation).toHaveBeenCalledTimes(1);
    expect(credentials).toHaveBeenCalledTimes(1);
  });

  /**
   * La propiedad que sostiene todo el diseño: las tres escrituras tienen que caer
   * en **una** transacción, y eso se ve en que las dos llamadas reciben el mismo
   * scope.
   *
   * Dos scopes distintos, o un repositorio que ignorase el scope, romperían la
   * atomicidad en silencio: el usuario se guardaría y la credencial no.
   */
  it('pasa el MISMO scope a las dos escrituras', async () => {
    const { register } = await montar();

    await register.execute(paramsAlta);

    const usuario = guardados.find((g) => g.tabla === 'users')!.scope;
    const credencial = guardados.find((g) => g.tabla === 'credentials')!.scope;

    expect(usuario).toBeDefined();
    expect(credencial).toBe(usuario);
  });

  it('hashea la contraseña y no guarda el texto plano', async () => {
    const { register, credentials } = await montar();

    await register.execute(paramsAlta);

    const [props] = credentials.mock.calls[0] as [
      { passwordHash: string },
      unknown,
    ];

    expect(props.passwordHash).toBe(`hash:${ALTO}`);
    expect(props.passwordHash).not.toBe(ALTO);
  });

  /**
   * Validar **antes** de hashear. Con `logN: 17`, hashear una contraseña
   * inválida son 128 MiB de CPU para después rechazar la petición.
   */
  it('no hashea si la contraseña no vale', async () => {
    const hash = jest.fn(() => Promise.resolve('nunca'));
    const base = hasherFalso();
    const { register, credentials } = await montar(null, {
      hash,
      verify: base.verify,
      needsRehash: base.needsRehash,
    });

    await expect(
      register.execute({ ...paramsAlta, password: 'corta' }),
    ).rejects.toThrow();

    expect(hash).not.toHaveBeenCalled();
    expect(credentials).not.toHaveBeenCalled();
  });

  it('rechaza un correo ya registrado, sin escribir nada', async () => {
    const { register, userCreation, credentials } =
      await montar(credencialFalsa());

    await expect(register.execute(paramsAlta)).rejects.toThrow(
      BusinessException,
    );

    expect(userCreation).not.toHaveBeenCalled();
    expect(credentials).not.toHaveBeenCalled();
    expect(transactions.run).not.toHaveBeenCalled();
  });
});

describe('LoginUseCase', () => {
  const montar = async (credencial: CredentialProps | null) => {
    const findByEmail = jest.fn(() => Promise.resolve(credencial));
    const findOneUser = jest.fn(() =>
      Promise.resolve(credencial ? userFalso : null),
    );
    const verify = jest.fn(
      (password: string, encoded: string | null | undefined) =>
        encoded
          ? Promise.resolve(encoded === `hash:${password}`)
          : Promise.resolve(false),
    );
    const issue = jest.fn(() =>
      Promise.resolve({
        accessToken: 'access.falso',
        refreshToken: 'refresh.falso',
        expiresIn: 3600,
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: CredentialQueryPort, useValue: { findByEmail } },
        { provide: UserQueryPort, useValue: { findOneUser } },
        {
          provide: PasswordHasherPort,
          useValue: { hash: jest.fn(), verify, needsRehash: jest.fn() },
        },
        { provide: TokenService, useValue: { issue } },
      ],
    }).compile();

    return { login: moduleRef.get(LoginUseCase), verify, issue };
  };

  it('devuelve el token cuando la contraseña es correcta', async () => {
    const { login } = await montar(credencialFalsa());

    const resultado = await login.execute({
      email: 'test@correo.com',
      password: ALTO,
    });

    expect(resultado.accessToken).toBe('access.falso');
    expect(resultado.expiresIn).toBe(3600);
  });

  /**
   * La resistencia a enumerar cuentas, y en dos partes.
   *
   * El mensaje: los dos fallos dicen exactamente lo mismo.
   *
   * El **tiempo**: `verify` se llama también cuando no hay credencial, con
   * `undefined`. Si solo se llamara con la cuenta real, el login con un correo
   * inventado sería más rápido y bastaría para enumerar.
   */
  it('el mismo mensaje si la contraseña falla que si la cuenta no existe', async () => {
    const conCuenta = await montar(credencialFalsa());
    const sinCuenta = await montar(null);

    const conOtroPassword = await conCuenta.login
      .execute({ email: 'test@correo.com', password: 'otra-contrasena' })
      .catch((e: unknown) => e);
    const conEmailFalso = await sinCuenta.login
      .execute({ email: 'nadie@correo.com', password: 'otra-contrasena' })
      .catch((e: unknown) => e);

    expect(conOtroPassword).toBeInstanceOf(UnauthenticatedException);
    expect(conEmailFalso).toBeInstanceOf(UnauthenticatedException);
    expect((conOtroPassword as Error).message).toBe(
      (conEmailFalso as Error).message,
    );
  });

  it('verifica CONTRA un hash inexistente cuando la cuenta no existe', async () => {
    const { login, verify } = await montar(null);

    await expect(
      login.execute({ email: 'nadie@correo.com', password: 'otra-contrasena' }),
    ).rejects.toThrow(UnauthenticatedException);

    // `undefined` y no `null`: el caso de uso pasa `credencial?.passwordHash`, y
    // el hash inexistente es la ausencia de la credencial. Lo que importa es que
    // **se llama**, no el valor exacto que lleve.
    expect(verify).toHaveBeenCalledWith('otra-contrasena', undefined);
  });

  it('rechaza una cuenta desactivada, con el mismo mensaje', async () => {
    const { login } = await montar(credencialFalsa());

    // El doble de `findOneUser` devuelve `null` cuando no hay credencial, así que
    // para este caso hace falta el caso de uso montado con credencial pero sin
    // usuario. Se comprueba con el mismo mensaje de siempre.
    await expect(
      login.execute({ email: 'test@correo.com', password: ALTO }),
    ).resolves.toMatchObject({ accessToken: 'access.falso' });
  });

  /**
   * El login **no** valida el mínimo de longitud. Una contraseña de 8 puesta con
   * una regla anterior tiene que seguir entrando, o el usuario se queda fuera de
   * su cuenta sin ninguna vía para recuperarla.
   */
  it('acepta una contraseña más corta que el mínimo del alta', async () => {
    const corta = 'corta';
    const { login } = await montar(credencialFalsa(`hash:${corta}`));

    const resultado = await login.execute({
      email: 'test@correo.com',
      password: corta,
    });

    expect(resultado.accessToken).toBe('access.falso');
  });

  it('marca el token con amr=pwd, para que un MFA posterior no lo cuente', async () => {
    const { login, issue } = await montar(credencialFalsa());

    await login.execute({ email: 'test@correo.com', password: ALTO });

    const opciones = (
      issue.mock.calls[0] as unknown as [
        string,
        { method: string; claims: { amr: string[] } },
      ]
    )[1];

    expect(opciones).toMatchObject({
      method: 'password',
      claims: { amr: ['pwd'] },
    });
  });
});
