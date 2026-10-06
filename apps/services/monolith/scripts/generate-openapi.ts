import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { OpenApiSpecModule } from '../src/openapi-spec.module';
import { ApiErrorDetailDto } from '../src/common/swagger/api-error-detail.dto';
import { applyDefaultErrorResponses } from '../src/common/swagger/default-error-responses';
import { buildOpenApiConfig } from '../src/common/swagger/openapi-config';

/**
 * Escribe `openapi.json` en la raíz del proyecto.
 *
 * El motivo de que esto exista: `web` genera su cliente a partir de este
 * fichero, y si el fichero viviera solo en runtime habría que levantar el
 * backend entero para regenerar los tipos. Commiteado, no hace falta.
 *
 * No hace `listen()`, así que no abre puerto. Y usa `OpenApiSpecModule` en vez
 * de `AppModule`, porque `AppModule` conecta con Postgres al inicializar.
 *
 * Cuando cambies una API, regenera esto y commitea el fichero. Un contrato
 * desactualizado en el repo genera clientes que ya no compilan contra el
 * backend, y el error aparece lejos de su causa.
 */

const OUTPUT = 'openapi.json';

async function main(): Promise<void> {
  const app = await NestFactory.create(OpenApiSpecModule, { logger: false });

  const document = applyDefaultErrorResponses(
    SwaggerModule.createDocument(app, buildOpenApiConfig(), {
      extraModels: [ApiErrorDetailDto],
    }),
  );

  await app.close();

  const target = resolve(process.cwd(), OUTPUT);
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const paths = Object.keys(document.paths ?? {}).length;
  const schemas = Object.keys(document.components?.schemas ?? {}).length;

  console.log(`${OUTPUT}: ${paths} rutas, ${schemas} esquemas`);

  if (paths === 0) {
    // No es un error: al no haber controladores todavía, un contrato vacío es
    // lo correcto. Avisar evita que alguien lo tome por un fallo de generación.
    console.warn(
      'Aviso: el contrato está vacío porque aún no hay controladores.',
    );
  }
}

void main();
