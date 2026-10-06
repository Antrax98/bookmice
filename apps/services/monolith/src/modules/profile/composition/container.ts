import type { Provider } from '@nestjs/common';

/**
 * El composition root de `profile`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `profileBindings` y consúmelos desde `profile.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `profileBindings` va separada de `profileProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const profileBindings: Provider[] = [];

export const profileProviders: Provider[] = [...profileBindings];
