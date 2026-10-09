import { createTheme } from '@mui/material/styles';

// Azul muy oscuro de fondo, verde musgo como acento.
const BACKGROUND = '#111823';
const SURFACE = '#18202e';
const MOSS = '#7c9a6d';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: MOSS },
    secondary: { main: '#5f7d8c' },
    background: {
      default: BACKGROUND,
      paper: SURFACE,
    },
    text: {
      primary: '#dde3ea',
      secondary: '#95a3b5',
      disabled: '#5b6878',
    },
    divider: 'rgba(148, 163, 184, 0.18)',
  },
  shape: { borderRadius: 10 },
  typography: {
    // La variable la define next/font en <html>; el resto de la cadena queda
    // como respaldo por si la fuente no llegara a cargar.
    fontFamily: 'var(--font-roboto), "Helvetica", "Arial", sans-serif',
    h4: { letterSpacing: '-0.02em' },
    h5: { letterSpacing: '-0.01em' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: 'rgba(148, 163, 184, 0.18)',
          transition: 'border-color 160ms ease',
          '&:hover': { borderColor: MOSS },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});

export default theme;
