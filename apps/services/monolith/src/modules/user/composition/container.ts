import type { Provider } from '@nestjs/common';

/**
 * El composition root de `user`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `userBindings` y consúmelos desde `user.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `userBindings` va separada de `userProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const userBindings: Provider[] = [];

export const userProviders: Provider[] = [...userBindings];
