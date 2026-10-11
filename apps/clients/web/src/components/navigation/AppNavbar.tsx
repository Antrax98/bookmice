import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutButton from '@/components/LogoutButton';
import { ApiError } from '@/lib/api/apiError';
import { serverFetch } from '@/lib/api/server/serverFetch';
import { hasSession } from '@/lib/api/server/session';
import type { Me } from '@/lib/api/schemas';

/**
 * La barra de arriba. Vive en `(public)/layout.tsx` y nowhere más, así que
 * `/login` y `/register` se quedan sin navbar a propósito.
 *
 * Es un **Server Component**: decide si hay sesión leyendo la cookie, y eso
 * solo se puede hacer en el servidor. La cookie es `httpOnly`, así que el
 * navegador no la ve; si esto fuera un componente cliente, no habría forma de
 * saber si hay sesión sin exposinga.
 *
 * Lo que sí necesita JavaScript (el botón de salir) está en `LogoutButton`.
 */

/**
 * Las iniciales para cuando no hay avatar.
 *
 * No es un caso raro: el alta **no pide avatar**, así que toda cuenta nueva
 * nace con `avatarUrl: null` y esto es lo que se va a ver casi siempre.
 */
function inicialesDe(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? '')
    .join('')
    .toUpperCase();
}

export default async function AppNavbar() {
  const conSesion = await hasSession();

  /**
   * Sin cookie no se llama al backend. Es una peticion menos en cada carga de la
   * portada para el visitante que no ha entrado nunca.
   */
  let me: Me | null = null;

  if (conSesion) {
    try {
      me = await serverFetch<Me>({ endpoint: '/me', auth: true });
    } catch (error) {
      /**
       * Un 401 aquí **no es un error**: es una cookie caducada. La sesión muere
       * sola cuando caduca el token, y el navbar se usa en todas las páginas, así
       * que reventar aquí dejaría la portada entera sin pintar.
       *
       * Cualquier otro error sí se propaga: un 500 del backend o del BFF son
       * problemas que hay que ver, no cosas que disimular con un navbar vacío.
       */
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
  }

  return (
    <AppBar position="static" elevation={0} color="transparent">
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component="span"
          sx={{ fontWeight: 700, mr: 'auto' }}
        >
          Bookmice
        </Typography>

        {me ? (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                src={me.avatarUrl ?? undefined}
                alt={me.fullName}
                sx={{ width: 32, height: 32, fontSize: 14 }}
              >
                {inicialesDe(me.fullName)}
              </Avatar>
              <Typography variant="body2" color="text.primary">
                {me.fullName}
              </Typography>
            </Box>
            <LogoutButton />
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button href="/login" variant="outlined" color="inherit">
              Iniciar sesión
            </Button>
            <Button href="/register" variant="contained">
              Registrarse
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}
