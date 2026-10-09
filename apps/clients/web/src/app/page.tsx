import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import LogoutButton from './LogoutButton';
import { hasSession } from '@/lib/api/server/session';

/**
 * La portada.
 *
 * Es un Server Component a proposito: la cookie solo se lee en el servidor, y
 * meterla en un componente cliente obligaria a exposesela al navegador. Lo que
 * necesita JavaScript (el boton de salir) vive en `LogoutButton`.
 */
export default async function Home() {
  const conSesion = await hasSession();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
              Bienvenido a Bookmice
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Clon de Goodreads. Aquí irá el catálogo de obras, las listas de
              lectura y las reseñas.
            </Typography>
          </Box>

          {conSesion ? (
            <LogoutButton />
          ) : (
            <Typography variant="body2" color="text.secondary">
              <Button href="/login" variant="contained">
                Iniciar sesión
              </Button>
            </Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}