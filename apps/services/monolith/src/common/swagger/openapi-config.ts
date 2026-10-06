import { DocumentBuilder } from '@nestjs/swagger';

/**
 * La configuración del documento OpenAPI, en un solo sitio.
 *
 * Existe porque hay **dos** cosas que construyen el documento: la que sirve la
 * aplicación en `/api`, y la que escribe `openapi.json` en disco. Si cada una
 * tuviera su propio `DocumentBuilder`, acabarían desincronizadas, y el fallo
 * sería silencioso y malo: un cliente generado contra un contrato que el
 * backend ya no cumple.
 *
 * Cuando añadas aquí un servidor, una descripción o una tag, se refleja en las
 * dos.
 */
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .setOpenAPIVersion('3.1.0')
    .build();
}
