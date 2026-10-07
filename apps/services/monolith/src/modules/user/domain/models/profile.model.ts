import { randomUUID } from 'node:crypto';
import { DomainErrorCollector } from '../../../../common/domain/error-collector';
import {
  ProfileNewProps,
  ProfileProps,
  ProfileWithId,
} from '../interfaces/profile.interface';

const MAX_FULL_NAME_LENGTH = 120;
const MAX_HEADLINE_LENGTH = 160;
const MAX_LOCATION_LENGTH = 120;
const MAX_PUBLIC_EMAIL_LENGTH = 255;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `fullName` es obligatorio y el resto no. Un perfil recién creado no tiene
 * por qué tener bio ni avatar, y exigirlo relleno solo genera formularios con
 * campos inventados para poder guardar.
 */
export class Profile {
  private constructor(
    private readonly id: string,
    private readonly userId: string,
    private fullName: string,
    private headline: string | null,
    private bio: string | null,
    private location: string | null,
    private publicEmail: string | null,
    private avatarUrl: string | null,
    private isPrivate: boolean,
    private updatedAt: Date,
  ) {}

  static create(params: ProfileProps): Profile {
    const errors = new DomainErrorCollector();

    const fullName = Profile.normalizeText(params.fullName);
    const publicEmail = Profile.normalizeEmail(params.publicEmail);

    Profile.collectFullNameErrors(errors, fullName);
    Profile.collectOptionalErrors(errors, params, publicEmail);

    errors.throwIfAny('The profile could not be built: some data is invalid');

    return new Profile(
      params.id,
      params.userId,
      fullName,
      Profile.nullable(params.headline),
      Profile.nullable(params.bio),
      Profile.nullable(params.location),
      publicEmail,
      Profile.nullable(params.avatarUrl),
      params.isPrivate,
      params.updatedAt,
    );
  }

  /**
   * Alta. El id lo genera la aplicación, igual que en `User`, y por el mismo
   * motivo: saber el id antes de insertar es lo que permite construir el perfil
   * entero, con su `userId` real, sin esperar al primer INSERT.
   */
  static createNew(params: ProfileNewProps): Profile {
    return Profile.create({
      ...params,
      id: randomUUID(),
      headline: null,
      bio: null,
      location: null,
      publicEmail: null,
      avatarUrl: null,
      updatedAt: new Date(),
    });
  }

  private static collectFullNameErrors(
    errors: DomainErrorCollector,
    fullName: string,
  ): void {
    if (fullName.length === 0) {
      errors.add('fullName', 'Full name is required');
      return;
    }

    if (fullName.length > MAX_FULL_NAME_LENGTH) {
      errors.add(
        'fullName',
        `Full name cannot be longer than ${MAX_FULL_NAME_LENGTH} characters`,
      );
    }
  }

  /**
   * Los campos opcionales se validan **solo si vienen**. Validar un `null`
   * daría un error por un campo que el usuario nunca tocó, y eso es ruido: el
   * mismo error aparecería en la bio de alguien que no ha escrito una bio.
   *
   * `publicEmail` llega **ya normalizado**, no en crudo. Es lo que hace que
   * `'  Publico@Correo.COM  '` sea válido: si se validara el original, el
   * `trim` de la normalización llegaría tarde y un correo con espacios
   * alrededor se rechazaría siendo perfectamente válido.
   *
   * Ya normalizado, un correo vacío es `null`, así que el `null` de la
   * comprobación significa "no ha puesto nada", que es distinto de "mal
   * escrito".
   */
  private static collectOptionalErrors(
    errors: DomainErrorCollector,
    params: ProfileProps,
    publicEmail: string | null,
  ): void {
    Profile.collectLength(
      errors,
      'headline',
      params.headline,
      MAX_HEADLINE_LENGTH,
    );
    Profile.collectLength(
      errors,
      'location',
      params.location,
      MAX_LOCATION_LENGTH,
    );

    if (publicEmail !== null && !EMAIL_SHAPE.test(publicEmail)) {
      errors.add('publicEmail', 'Public email is not a valid address');
    }

    // El límite se comprueba contra lo normalizado, que es más corto o igual
    // que lo que venga. Sin esto la columna de 255 caracteres podría
    // truncarse en la base y devolver un correo que no es el que se escribió.
    Profile.collectLength(
      errors,
      'publicEmail',
      publicEmail,
      MAX_PUBLIC_EMAIL_LENGTH,
    );
  }

  private static collectLength(
    errors: DomainErrorCollector,
    field: string,
    value: string | null,
    max: number,
  ): void {
    if (value !== null && value.trim().length > max) {
      errors.add(field, `${field} cannot be longer than ${max} characters`);
    }
  }

  private static normalizeText(value: string): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private static normalizeEmail(value: string | null): string | null {
    if (value === null) return null;

    const limpio = Profile.normalizeText(value).toLowerCase();
    return limpio.length === 0 ? null : limpio;
  }

  /**
   * Una cadena vacía se guarda como `NULL`, no como `''`. Si no, el mismo
   * estado ("el usuario no lo ha rellenado") acaba representada de dos formas,
   * y cada consulta que filtre tiene que comprobar las dos.
   */
  private static nullable(value: string | null): string | null {
    if (value === null) return null;

    const limpio = Profile.normalizeText(value);
    return limpio.length === 0 ? null : limpio;
  }

  /**
   * El `id` va incluido y `updatedAt` no: el id lo genera la aplicación, la fecha
   * la pone la columna con `DEFAULT now()`. Misma asimetría que en `User`.
   */
  toPersistence(): ProfileWithId {
    return {
      id: this.id,
      userId: this.userId,
      fullName: this.fullName,
      isPrivate: this.isPrivate,
    };
  }

  toProps(): ProfileProps {
    return {
      id: this.id,
      userId: this.userId,
      fullName: this.fullName,
      headline: this.headline,
      bio: this.bio,
      location: this.location,
      publicEmail: this.publicEmail,
      avatarUrl: this.avatarUrl,
      isPrivate: this.isPrivate,
      updatedAt: this.updatedAt,
    };
  }
}
