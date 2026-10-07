/**
 * La fila de `credentials`, y sus dos formas de pasar por la puerta.
 *
 * `CredentialProps` es la credencial ya guardada. `CredentialNewProps` es el
 * alta, y **no lleva `id`**: quien crea la credencial no lo elige, lo pone el
 * adapter de infraestructura. Es el mismo reparto que en `UserNewProps`, y por
 * el mismo motivo: un `id` en el tipo de alta es una invitación a inventarlo.
 *
 * ## Por qué `passwordHash` es un `string` y no un tipo aparte
 *
 * Podría ser un value object `PasswordHash` que se.Validara al construir. No lo
 * hace, y es deliberado: el hash es **opaco**. No sabemos si mañana es scrypt o
 * argon2, ni qué formato exacto tiene, y el paquete ya lleva el suyo
 * (`$scrypt$ln=17,r=8,p=1$salt$hash`). Un value object que valida el formato
 * tendría que reescribirse en cada cambio de algoritmo, y no añadiría nada.
 *
 * Y no se compara a mano en ningún sitio: la comparación va al hasher, que es
 * donde vive el algoritmo. Ver `LoginUseCase`.
 */
export interface CredentialProps {
  id: string;
  userId: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CredentialNewProps = Pick<
  CredentialProps,
  'userId' | 'passwordHash'
>;
