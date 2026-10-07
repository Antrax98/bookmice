/**
 * El alcance de una transacción, visto desde el dominio.
 *
 * Es un contrato **genérico**, no de un módulo: "escribe esto dentro de este
 * ámbito". Por eso vive en `common/domain` y no en el dominio de `user`.
 *
 * ## Por qué no importa TypeORM
 *
 * `domain` no puede importar TypeORM: si lo hiciera, dejaría de ser
 * framework-free, que es justo lo que lo hace testeable y legible por separado.
 *
 * La solución es que el puerto declare solo **lo que usa**, y que sea el
 * adapter de infraestructura el que lo interprete como el `EntityManager` que
 * es. El dominio pide "guarda esto dentro de esta transacción"; quién lo
 * resuelve no es asunto suyo.
 *
 * ## Por qué `common` y no el dominio de quien lo usa
 *
 * Porque hay más de un módulo que necesita escribir varias filas en la misma
 * transacción, y un tipo que "pertenece" a un módulo pero se importa desde otro
 * es un tipo mal colocado. `user` lo usó primero al crear usuario y perfil;
 * `auth` lo usa al crear usuario, perfil y credenciales a la vez.
 *
 * La alternativa era que `auth` importara `user/domain/interfaces` solo para
 * pedirle un handle de transacción. Compila, y hasta pasa el lint, porque las
 * políticas de `boundaries` son por **tipo** de capa y no por módulo: `application`
 * puede importar cualquier `domain`. Pero es exactamente el acoplamiento que el
 * `AGENTS.md` dice evitar, solo que nadie lo vigila.
 *
 * Deliberadamente mínimo. En cuanto un puerto necesite dos operaciones, lo
 * honesto es reconocer que `domain` necesita un gestor de transacciones y
 * revisar la decisión, no crecer esta interfaz.
 */
export interface PersistenceScope {
  save<T>(target: unknown, props: unknown): Promise<T>;
}
