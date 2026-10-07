import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';
import { UserNewProps, UserProps } from '../interfaces/user.interface';
import { User } from './user.model';

const FECHA = new Date('2026-01-01T00:00:00Z');

const props = (cambios: Partial<UserProps> = {}): UserProps => ({
  id: 'f1c8a2de-0000-4000-8000-000000000000',
  username: 'antrax_001',
  email: 'test@correo.com',
  isActive: true,
  createdAt: FECHA,
  updatedAt: FECHA,
  ...cambios,
});

// `createNew` no recibe id ni fechas: los pone el modelo.
const nuevos = (cambios: Partial<UserNewProps> = {}): UserNewProps => ({
  username: 'antrax_001',
  email: 'test@correo.com',
  isActive: true,
  ...cambios,
});

describe('User.create', () => {
  describe('normaliza', () => {
    it('el correo a minusculas y sin espacios alrededor', () => {
      const user = User.create(props({ email: '  Test@Correo.COM  ' }));

      expect(user.toProps().email).toBe('test@correo.com');
    });

    it('el nombre de usuario igual que el correo', () => {
      const user = User.create(props({ username: '  Antrax_001  ' }));

      expect(user.toProps().username).toBe('antrax_001');
    });
  });

  describe('rechaza el username', () => {
    it('uno con espacios', () => {
      expect(() => User.create(props({ username: 'Jym Raynor' }))).toThrow(
        DataValidationException,
      );
    });

    it('uno que empieza por guion', () => {
      expect(() => User.create(props({ username: '-raynor' }))).toThrow(
        DataValidationException,
      );
    });

    it('uno vacio', () => {
      expect(() => User.create(props({ username: '   ' }))).toThrow(
        DataValidationException,
      );
    });

    // El mínimo de 10 caracteres: la primera barrera contra que se rellene con
    // "a" o "test" y ocupe el espacio. Este tiene 9, uno por debajo del límite.
    it('uno de menos de diez caracteres', () => {
      expect(() => User.create(props({ username: 'antrax_01' }))).toThrow(
        DataValidationException,
      );
    });

    it('uno de mas de cincuenta caracteres', () => {
      const largo = 'a'.repeat(51);

      expect(() => User.create(props({ username: largo }))).toThrow(
        DataValidationException,
      );
    });
  });

  describe('acepta los limites de longitud', () => {
    it('uno de exactamente diez caracteres', () => {
      const user = User.create(props({ username: 'a'.repeat(10) }));

      expect(user.toProps().username).toHaveLength(10);
    });

    it('uno de exactamente cincuenta caracteres', () => {
      const user = User.create(props({ username: 'a'.repeat(50) }));

      expect(user.toProps().username).toHaveLength(50);
    });

    // El correo tiene su propio límite (255) y su propia forma, así que el
    // límite se comprueba con un correo **válido** de ese tamaño. Con una
    // cadena de 255 caracteres cualquiera el test pasaría por el `EMAIL_SHAPE` y
    // no por el `length`, que es justo lo que se quiere comprobar.
    it('un correo de exactamente 255 caracteres', () => {
      // 244 + los 11 de `@correo.com`. El número va escrito a mano a propósito:
      // si se calculara con un `255 - '@correo.com'.length` el test seguiría
      // pasando, y justo de eso se trata, de comprobar el 255 de verdad.
      const user = User.create(
        props({ email: `${'a'.repeat(244)}@correo.com` }),
      );

      expect(user.toProps().email).toHaveLength(255);
    });
  });

  describe('rechaza el correo', () => {
    it('uno sin arroba', () => {
      expect(() => User.create(props({ email: 'no-es-un-correo' }))).toThrow(
        DataValidationException,
      );
    });

    it('uno vacio', () => {
      expect(() => User.create(props({ email: '   ' }))).toThrow(
        DataValidationException,
      );
    });

    // Este caso no estaba, y sin él la rama del `length` máximo no se ejecutaba
    // nunca: todos los correos que probábamos o pasaban o fallaban por
    // `EMAIL_SHAPE`, así que el límite de 255 no tenía ni un test que lo
    // tocara. El orden de los `if` importa aquí: como el de longitud va antes
    // del de forma, un correo larguísimo da este error y no "no es una
    // dirección válida".
    it('uno de más de 255 caracteres', () => {
      expect(() =>
        User.create(props({ email: `${'a'.repeat(250)}@correo.com` })),
      ).toThrow(DataValidationException);
    });

    // El detalle que hace que el anterior no baste: este correo tiene 261
    // caracteres y una forma **válida**, así que si el límite no estuviera no
    // fallaría. Y por qué importa el mensaje: los `if` van en orden, así que un
    // correo larguísimo tiene que quejarse de la longitud y no de la forma. Si
    // alguien invirtiera el orden de los dos, este test lo canta y el anterior
    // no.
    it('se queja de la longitud, no de que no sea una dirección válida', () => {
      try {
        User.create(props({ email: `${'a'.repeat(250)}@correo.com` }));
        fail('deberia haber lanzado');
      } catch (error) {
        const { errors } = error as DataValidationException;

        // El mensaje va en su propia aserción y no dentro de un
        // `objectContaining`: `expect.stringContaining()` devuelve `any`, y
        // meterlo en un objeto salta el `no-unsafe-assignment` del lint.
        //
        // El `!` no es opcional: `AppException.errors` es `ApiErrorDetail[] |
        // null`, porque una excepción sin errores de campo también es válida. En
        // este camino concreto nunca es `null` —el colector siempre manda la
        // lista-, pero hay que decirlo porque si no el `errors[0]` no compila.
        expect(errors).toHaveLength(1);
        expect(errors![0]).toMatchObject({ field: 'email' });
        expect(errors![0].message).toContain('255');
      }
    });
  });

  it('acumula los errores de los dos campos en una sola excepcion', () => {
    try {
      User.create(props({ username: 'corto', email: 'sin-arroba' }));
      fail('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(DataValidationException);
      expect((error as DataValidationException).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'username' }),
          expect.objectContaining({ field: 'email' }),
        ]),
      );
      expect((error as DataValidationException).errors).toHaveLength(2);
    }
  });

  it('conserva el id, el isActive y las fechas que recibe', () => {
    const user = User.create(props({ isActive: false }));

    expect(user.toProps()).toMatchObject({
      id: 'f1c8a2de-0000-4000-8000-000000000000',
      isActive: false,
      createdAt: FECHA,
      updatedAt: FECHA,
    });
  });
});

describe('User.createNew', () => {
  // `createNew` llama a `new Date()`: sin congelar el reloj, la fecha que
  // produce nunca sería comparable con una constante.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FECHA);
  });

  // Los timers falsos son globales y se quedarían puestos para los tests que
  // vengan después, en este fichero y en los siguientes.
  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * El id lo genera la aplicación, no la base. Este test es la razón por la que
   * el `toPersistence` puede llevar el `userId` real del perfil antes de
   * insertar nada.
   */
  it('asigna un id uuid v4, no uno vacío', () => {
    const { id } = User.createNew(nuevos()).toProps();

    expect(id).not.toBe('');
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('cada alta tiene un id distinto', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => User.createNew(nuevos()).toProps().id),
    );

    expect(ids.size).toBe(50);
  });

  it('pone la hora actual en createdAt y en updatedAt', () => {
    expect(User.createNew(nuevos()).toProps()).toMatchObject({
      createdAt: FECHA,
      updatedAt: FECHA,
    });
  });

  it('normaliza igual que create', () => {
    const user = User.createNew(
      nuevos({ username: '  Antrax_001  ', email: '  Test@Correo.COM  ' }),
    );

    expect(user.toProps()).toMatchObject({
      username: 'antrax_001',
      email: 'test@correo.com',
    });
  });

  it('conserva isActive', () => {
    expect(User.createNew(nuevos({ isActive: false })).toProps().isActive).toBe(
      false,
    );
  });

  it('rechaza los mismos datos que create', () => {
    expect(() => User.createNew(nuevos({ username: 'corto' }))).toThrow(
      DataValidationException,
    );
  });
});

describe('User.toPersistence', () => {
  it('devuelve id, username, email e isActive, y nada mas', () => {
    const persistido = User.create(props()).toPersistence();

    expect(Object.keys(persistido).sort()).toEqual([
      'email',
      'id',
      'isActive',
      'username',
    ]);
  });

  // El test que más fácil se rompe en silencio: si alguien añade un campo a
  // `UserProps` y olvida propagarlo, aquí falla en vez de perder el dato.
  it('devuelve los valores normalizados, no los que recibio', () => {
    const user = User.create(
      props({ username: '  Antrax_001  ', email: '  Test@Correo.COM  ' }),
    );

    expect(user.toPersistence()).toMatchObject({
      username: 'antrax_001',
      email: 'test@correo.com',
      isActive: true,
    });
  });

  // La asimetría del id y las fechas: el id lo pone la aplicación y va en el
  // INSERT, las fechas las pone la columna con `DEFAULT now()`.
  it('lleva el id pero no las fechas, que pone la columna', () => {
    const persistido = User.create(props()).toPersistence();

    expect(persistido.id).toBe('f1c8a2de-0000-4000-8000-000000000000');
    expect(persistido).not.toHaveProperty('createdAt');
    expect(persistido).not.toHaveProperty('updatedAt');
  });

  it('el id de createNew es el que acaba persistido', () => {
    const user = User.createNew(nuevos());

    expect(user.toPersistence().id).toBe(user.toProps().id);
  });
});

describe('User.toProps', () => {
  it('devuelve los seis campos', () => {
    expect(User.create(props()).toProps()).toStrictEqual(props());
  });

  it('devuelve un objeto nuevo, no el que recibio', () => {
    const originales = props();

    expect(User.create(originales).toProps()).not.toBe(originales);
  });
});
