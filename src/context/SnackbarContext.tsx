import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Alert, Snackbar } from '@mui/material';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Severity = 'success' | 'error' | 'info' | 'warning';

interface SnackbarValue {
  showSnackbar: (message: string, severity?: Severity) => void;
}

const SnackbarContext = createContext<SnackbarValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = useCallback((message: string, severity: Severity = 'success') => {
    setState({ open: true, message, severity });
  }, []);

  const handleClose = useCallback(
    () => setState((s) => ({ ...s, open: false })),
    [],
  );

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 16 } }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          iconMapping={{ success: <CheckCircleRoundedIcon fontSize="inherit" /> }}
          sx={{ borderRadius: 3, width: '100%' }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}
