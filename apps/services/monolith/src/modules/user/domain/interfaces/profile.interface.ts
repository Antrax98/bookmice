/**
 * La cara pública del usuario.
 *
 * Separado de `user` a propósito, no por tamaño sino por ritmo de cambio:
 * `user` guarda lo que lee el login y casi no cambia, `profile` guarda lo que
 * cambia cada semana y se muestra a terceros. Juntos, cada edición de la bio
 * tocaría la fila que el login lee, y tarde o temprano aparecería un endpoint
 * de perfil devolviendo datos de acceso.
 */
export interface ProfileProps {
  id: string;
  userId: string;
  fullName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  publicEmail: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  updatedAt: Date;
}

/**
 * El alta. `fullName` es obligatorio porque es lo que se ve; el resto puede no
 * existir todavía, y un perfil recién creado no tiene por qué tener bio.
 */
export type ProfileNewProps = Pick<
  ProfileProps,
  'userId' | 'fullName' | 'isPrivate'
>;

/**
 * Lo que se escribe en la tabla: `ProfileNewProps` más el `id`, que lo genera
 * la aplicación. `updatedAt` no va porque lo pone la columna.
 */
export type ProfileWithId = ProfileNewProps & Pick<ProfileProps, 'id'>;

export interface ProfileFilterProps {
  id?: string;
  userId?: string;
}
