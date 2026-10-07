/**
 * El alcance de una transacción, visto desde el dominio.
 *
 * Existe porque `createUserWithProfile` necesita escribir dos tablas en la
 * misma transacción, y para eso hay que pasar el mismo handle a las dos
 * escrituras. Pero `domain` no puede importar TypeORM: si lo hiciera, dejaría
 * de ser framework-free, que es justo lo que lo hace testeable y legible por
 * separado.
 *
 * La solución es que el puerto declare solo **lo que usa**, y que sea el
 * adapter de infraestructura el que lo interprete como el `EntityManager` que
 * es. El dominio pide "guarda esto dentro de esta transacción"; quién lo
 * resuelve no es asunto suyo.
 *
 * Deliberadamente mínimo. En cuanto un puerto necesite dos operaciones, lo
 * honesto es reconocer que `domain` necesitagitaxis de transacciones y
 * revisar la decisión, no crecer esta interfaz.
 */
export interface PersistenceScope {
  save<T>(target: unknown, props: unknown): Promise<T>;
}
