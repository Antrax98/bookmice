'use client';

import { useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { authApi } from '@/lib/api/client/auth';
import { fieldErrorsOf } from '@/lib/api/apiError';
import { errorMessage } from '@/lib/errors';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFields({});
    setLoading(true);

    try {
      await authApi.register({ email, username, fullName, password });
      // Registrarse no inicia sesion: el backend devuelve el usuario, no un
      // token. Por eso el salto al login y no a la portada.
      router.push('/login');
    } catch (err) {
      setFields(fieldErrorsOf(err));
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container
      maxWidth="xs"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
        {/*
          El mismo boton que en `login`, apuntando tambien a `/`. Aqui no hay
          navbar al que volver, porque `(auth)` no lo monta, asi que este es el
          unico camino de salida sin escribir la direccion a mano.
        */}
        <Button
          href="/"
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ mb: 2, ml: -1, color: 'text.secondary' }}
        >
          Volver
        </Button>

        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Crear cuenta
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              error={Boolean(fields.email)}
              helperText={fields.email}
              required
              fullWidth
            />

            <TextField
              label="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              error={Boolean(fields.username)}
              helperText={fields.username}
              required
              fullWidth
            />

            <TextField
              label="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              error={Boolean(fields.fullName)}
              helperText={fields.fullName}
              required
              fullWidth
            />

            {/*
              Sin `maxLength` a proposito: el servidor limita en bytes, y un
              `maxLength` del DOM contaria caracteres. Con una `ñ` el cliente
              dejaria pasar una contrasena que el servidor rechaza. Ver
              CONTRATO.md.
            */}
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              error={Boolean(fields.password)}
              helperText={fields.password ?? 'Mínimo 12 caracteres.'}
              required
              fullWidth
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>

            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
