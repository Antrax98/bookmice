import AppNavbar from '@/components/navigation/AppNavbar';

/**
 * El layout de todo lo público.
 *
 * El navbar vive **aquí** y no en el layout raíz, que es lo que hace que
 * `(auth)` se quede sin él: `login` y `register` cuelgan del layout raíz, no de
 * este. No hace falta ninguna condición para decidir quién ve la barra.
 *
 * ## Por qué no lleva el docblock de `next/font`
 *
 * Este fichero no carga ninguna fuente. El `Roboto` y el `--font-roboto` viven
 * en `src/app/layout.tsx`, y `AppBar` y `Typography` heredan de ahí a través del
 * `ThemeProvider`. Lo que había aquí antes era una copia del comentario del
 * layout raíz, que describía cosas que no ocurren en este archivo.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
