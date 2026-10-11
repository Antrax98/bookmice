import { Container, Paper, Stack, Typography } from '@mui/material';

/**
 * La portada.
 *
 * Sin barra de sesión ni botón de entrar: eso vive en el navbar, y `page.tsx` es
 * un Server Component que no puede devolver botones de MUI con `onClick`.
 *
 * Cuando haya catálogo, esto deja de ser un `Paper` con un texto y pasa a ser la
 * rejilla de obras.
 */
export default function Home() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
            Bienvenido a Bookmice
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Clon de Goodreads. Aquí irá el catálogo de obras, las listas de
            lectura y las reseñas.
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
