import type { Provider } from '@nestjs/common';

/**
 * El composition root de `review`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `reviewBindings` y consúmelos desde `review.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `reviewBindings` va separada de `reviewProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const reviewBindings: Provider[] = [];

export const reviewProviders: Provider[] = [...reviewBindings];
