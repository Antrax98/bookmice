import { Module } from '@nestjs/common';
import { catalogProviders } from './composition/container';

/**
 * Superficie Nest del módulo `catalog`.
 *
 * Solo lo que Nest necesita saber: qué controladores expone, qué módulos
 * necesita importados y qué providers tiene. El wiring puerto→adapter vive en
 * `composition/container.ts`; los casos de uso, en `application/`.
 *
 * Añade aquí lo que corresponda cuando exista: `TypeOrmModule.forFeature([...])`
 * en `imports`, `controllers: [...]`, y `exports` solo si otro módulo
 * necesita algo de este.
 */
@Module({
  imports: [],
  controllers: [],
  providers: catalogProviders,
  exports: [],
})
export class CatalogModule {}
