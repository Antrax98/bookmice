import type { FontName } from 'figlet';

/**
 * Un recuadro con el nombre del proyecto en ASCII y las líneas que le pases.
 *
 * Solo sirve para que la terminal diga de un vistazo qué acaba de arrancar y en
 * qué URL. No lo llames en producción: el dibujo en un log de contenedor es
 * ruido, y ahí el destinatario es una herramienta, no una persona.
 */

// Una al azar en cada arranque. Son las que trae figlet de serie, así que no
// hay que instalar fuentes ni leer archivos.
const FUENTES: FontName[] = [
  '3-D',
  '3D Diagonal',
  '3D-ASCII',
  '4Max',
  'Big',
  'Block',
  'Bubble',
  'Digital',
  'Ghost',
  'Ivrit',
  'Script',
  'Shadow',
  'Slant',
  'Small',
  'Speed',
  'Standard',
  'Tinker-Toy',
];

export interface SplashParams {
  titulo: string;
  lineas?: string[];
}

/**
 * boxen y figlet son devDependencies, así que en una imagen de producción no
 * están. Se cargan con import() dinámico y, si no aparecen, no pasa nada: esto
 * es decorativo y no puede ser motivo de que la aplicación no arranque.
 */
async function cargarDibujantes() {
  try {
    const [boxen, figlet] = await Promise.all([
      import('boxen'),
      import('figlet'),
    ]);

    return { boxen: boxen.default, figlet: figlet.default };
  } catch {
    return null;
  }
}

export async function splash({
  titulo,
  lineas = [],
}: SplashParams): Promise<void> {
  const dibujantes = await cargarDibujantes();
  if (!dibujantes) return;

  const { boxen, figlet } = dibujantes;
  const fuente = FUENTES[Math.floor(Math.random() * FUENTES.length)];

  const arte = figlet.textSync(titulo, { font: fuente });
  const contenido = lineas.length ? `${arte}\n\n${lineas.join('\n')}` : arte;

  // console.log y no Logger: el logger antepone hora, nivel y contexto a cada
  // línea, y eso parte el dibujo en pedazos. Es el único console del proyecto y
  // tiene esta razón.
  console.log(
    boxen(contenido, {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
      title: fuente,
      titleAlignment: 'center',
    }),
  );
}
