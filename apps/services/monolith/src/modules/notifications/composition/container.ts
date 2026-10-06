import type { Provider } from '@nestjs/common';

/**
 * El composition root de `notifications`: aquí se decide qué adapter implementa cada
 * puerto.
 *
 * Empieza vacío a propósito. Añade los bindings puerto→adapter del módulo a
 * `notificationsBindings` y consúmelos desde `notifications.module.ts`. Ver la guía de diseño
 * para el patrón completo.
 *
 * `notificationsBindings` va separada de `notificationsProviders` a propósito: un test puede
 * montar el grafo con solo los bindings y sustituir el adaptador que necesite,
 * sin arrastrar guards ni services que no le interesan.
 */

export const notificationsBindings: Provider[] = [];

export const notificationsProviders: Provider[] = [...notificationsBindings];
