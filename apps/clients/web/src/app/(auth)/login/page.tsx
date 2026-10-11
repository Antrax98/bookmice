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
import { ApiError, fieldErrorsOf } from '@/lib/api/apiError';
import { errorMessage } from '@/lib/errors';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<number | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setStatus(null);
    setFields({});
    setLoading(true);

    try {
      await authApi.login({ email, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      setFields(fieldErrorsOf(err));
      setError(errorMessage(err));
      setStatus(err instanceof ApiError ? err.status : null);
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
        <Button
          href="/"
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ mb: 2, ml: -1, color: 'text.secondary' }}
        >
          Volver
        </Button>

        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Iniciar sesión
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            {/*
              El backend responde siempre el mismo mensaje, exista la cuenta o
              no, para no filtrar que correos estan dados de alta. Por eso este
              aviso acompana al error: no hay forma de saber cual de los dos
              fallo, y decirlo evita que el usuario busque un correo mal escrito.
            */}
            {status === 401 && (
              <Alert severity="info">Revisa el correo y la contraseña.</Alert>
            )}

            <TextField
              label="Correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              error={Boolean(fields.email)}
              helperText={fields.email}
              required
              fullWidth
            />

            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={Boolean(fields.password)}
              helperText={fields.password}
              required
              fullWidth
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
