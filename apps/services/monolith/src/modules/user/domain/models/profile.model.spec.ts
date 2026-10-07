import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';
import { ProfileNewProps, ProfileProps } from '../interfaces/profile.interface';
import { Profile } from './profile.model';

const FECHA = new Date('2026-01-01T00:00:00Z');

const props = (cambios: Partial<ProfileProps> = {}): ProfileProps => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  userId: 'f1c8a2de-0000-4000-8000-000000000000',
  fullName: 'Antrax',
  headline: null,
  bio: null,
  location: null,
  publicEmail: null,
  avatarUrl: null,
  isPrivate: false,
  updatedAt: FECHA,
  ...cambios,
});

const nuevos = (cambios: Partial<ProfileNewProps> = {}): ProfileNewProps => ({
  userId: 'f1c8a2de-0000-4000-8000-000000000000',
  fullName: 'Antrax',
  isPrivate: false,
  ...cambios,
});

describe('Profile.create', () => {
  describe('normaliza', () => {
    it('el nombre sin espacios alrededor', () => {
      const profile = Profile.create(props({ fullName: '  Antrax  ' }));

      expect(profile.toProps().fullName).toBe('Antrax');
    });

    it('el correo público a minúsculas', () => {
      const profile = Profile.create(
        props({ publicEmail: '  Publico@Correo.COM  ' }),
      );

      expect(profile.toProps().publicEmail).toBe('publico@correo.com');
    });

    // Un correo con espacios alrededor es perfectamente válido. Si la
    // validación se hiciera sobre el valor en crudo, aquí fallaría.
    it('acepta un correo público con espacios alrededor', () => {
      expect(() =>
        Profile.create(props({ publicEmail: '  publico@correo.com  ' })),
      ).not.toThrow();
    });
  });

  /**
   * El comportamiento que más fácil se rompe en silencio: si una cadena vacía
   * se guardara como `''`, el mismo estado ("el usuario no lo rellenó")
   * acabaría representado de dos maneras y cada consulta que filtre por
   * ausencia de bio tendría que comprobar las dos.
   */
  describe('los campos vacíos se guardan como null', () => {
    it('una bio que son solo espacios', () => {
      const profile = Profile.create(props({ bio: '   ' }));

      expect(profile.toProps().bio).toBeNull();
    });

    it('una location vacía', () => {
      const profile = Profile.create(props({ location: '' }));

      expect(profile.toProps().location).toBeNull();
    });

    it('un correo público vacío', () => {
      const profile = Profile.create(props({ publicEmail: '   ' }));

      expect(profile.toProps().publicEmail).toBeNull();
    });

    it('un avatar vacío', () => {
      const profile = Profile.create(props({ avatarUrl: '' }));

      expect(profile.toProps().avatarUrl).toBeNull();
    });
  });

  describe('rechaza el nombre', () => {
    it('uno vacío', () => {
      expect(() => Profile.create(props({ fullName: '   ' }))).toThrow(
        DataValidationException,
      );
    });

    it('uno de más de 120 caracteres', () => {
      expect(() =>
        Profile.create(props({ fullName: 'a'.repeat(121) })),
      ).toThrow(DataValidationException);
    });
  });

  /**
   * Los campos opcionales se validan solo si vienen. Validar un `null` daría
   * un error por un campo que nadie tocó, que es ruido puro.
   */
  describe('no se quejan de los campos que no vienen', () => {
    it('con todo a null no hay excepción', () => {
      expect(() =>
        Profile.create(
          props({
            headline: null,
            bio: null,
            location: null,
            publicEmail: null,
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('rechaza lo que viene', () => {
    it('un headline de más de 160 caracteres', () => {
      expect(() =>
        Profile.create(props({ headline: 'a'.repeat(161) })),
      ).toThrow(DataValidationException);
    });

    it('un correo público sin arroba', () => {
      expect(() =>
        Profile.create(props({ publicEmail: 'no-es-un-correo' })),
      ).toThrow(DataValidationException);
    });

    // La columna es varchar(255). Sin esta comprobación, un correo más largo se
    // trunca al guardar y devuelve algo que no es lo que se escribió.
    it('un correo público de más de 255 caracteres', () => {
      const largo = `${'a'.repeat(250)}@correo.com`;

      expect(() => Profile.create(props({ publicEmail: largo }))).toThrow(
        DataValidationException,
      );
    });
  });

  it('acumula los errores de varios campos en una sola excepción', () => {
    try {
      Profile.create(props({ fullName: '  ', location: 'a'.repeat(200) }));
      fail('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(DataValidationException);
      expect((error as DataValidationException).errors).toHaveLength(2);
    }
  });

  it('conserva el userId, el isPrivate y la fecha que recibe', () => {
    const profile = Profile.create(props({ isPrivate: true }));

    expect(profile.toProps()).toMatchObject({
      userId: 'f1c8a2de-0000-4000-8000-000000000000',
      isPrivate: true,
      updatedAt: FECHA,
    });
  });
});

describe('Profile.createNew', () => {
  it('asigna un id uuid v4, no uno vacío', () => {
    const { id } = Profile.createNew(nuevos()).toProps();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  // El perfil es la razón de mover la generación del id a la aplicación: con
  // el id disponible antes de insertar, `createUserWithProfile` puede
  // construir el perfil entero con su `userId` real y validarlo antes de abrir
  // la transacción.
  it('aceita un userId real y lo conserva', () => {
    const userId = 'f1c8a2de-0000-4000-8000-000000000000';

    const profile = Profile.createNew(nuevos({ userId }));

    expect(profile.toProps().userId).toBe(userId);
  });

  it('pone los campos opcionales a null en vez de inventarlos', () => {
    expect(Profile.createNew(nuevos()).toProps()).toMatchObject({
      headline: null,
      bio: null,
      location: null,
      publicEmail: null,
      avatarUrl: null,
    });
  });

  it('acepta un perfil sin bio ni avatar', () => {
    expect(() => Profile.createNew(nuevos())).not.toThrow();
  });
});

describe('Profile.toPersistence', () => {
  it('devuelve id, userId, fullName e isPrivate, y nada más', () => {
    const persistido = Profile.create(props()).toPersistence();

    expect(Object.keys(persistido).sort()).toEqual([
      'fullName',
      'id',
      'isPrivate',
      'userId',
    ]);
  });

  // Igual que en `User`: el id lo pone la aplicación y va en el INSERT,
  // `updatedAt` lo pone la columna.
  it('lleva el id pero no la fecha, que pone la columna', () => {
    const persistido = Profile.create(props()).toPersistence();

    expect(persistido.id).toBe('a1b2c3d4-0000-4000-8000-000000000000');
    expect(persistido).not.toHaveProperty('updatedAt');
  });

  it('el id de createNew es el que acaba persistido', () => {
    const profile = Profile.createNew(nuevos());

    expect(profile.toPersistence().id).toBe(profile.toProps().id);
  });
});

describe('Profile.toProps', () => {
  it('devuelve los diez campos', () => {
    expect(Profile.create(props()).toProps()).toStrictEqual(props());
  });

  it('devuelve un objeto nuevo, no el que recibió', () => {
    expect(Profile.create(props()).toProps()).not.toBe(props());
  });
});
