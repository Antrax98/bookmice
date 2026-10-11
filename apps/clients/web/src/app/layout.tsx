import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import ThemeRegistry from './ThemeRegistry';

/**
 * El tema de MUI ya pedía Roboto, pero nadie la cargaba: el navegador recorría
 * la cadena hasta el `sans-serif` del sistema y la página se veía distinta en
 * cada máquina.
 *
 * `next/font` la descarga al compilar y la sirve desde el propio dominio, así
 * que no hay petición a Google en tiempo de ejecución ni parpadeo de texto sin
 * estilo.
 */
const roboto = Roboto({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'Bookmice',
  description: 'Clon de Goodreads',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={roboto.variable} style={{ colorScheme: 'dark' }}>
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
