'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@mui/material';
import { authApi } from '@/lib/api/client/auth';

/**
 * Salir.
 *
 * Recarga entera en vez de `router.push('/login')`: la cookie se borra en el
 * servidor, y sin recargar el Server Component que lee `hasSession()` sigue
 * teniendo el valor viejo en memoria. Es el mismo motivo por el que
 * `proxyClient` recarga cuando la sesion muere.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await authApi.logout();
      router.push('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outlined"
      onClick={handleClick}
      disabled={loading}
      color="secondary"
    >
      {loading ? 'Saliendo...' : 'Cerrar sesión'}
    </Button>
  );
}