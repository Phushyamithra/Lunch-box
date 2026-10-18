import { Alert, Button, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Toast {
  key: number;
  message: string;
  severity: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

type Show = (message: string, options?: { severity?: Toast['severity']; action?: Toast['action'] }) => void;

const SnackbarContext = createContext<Show | null>(null);

/** One toast at a time, optionally with an action such as Undo. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback<Show>((message, options) => {
    setToast({ key: Date.now(), message, severity: options?.severity ?? 'success', action: options?.action });
  }, []);
  const close = () => setToast(null);
  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.action ? 6000 : 3500}
        onClose={(_, reason) => reason !== 'clickaway' && close()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 24 } }}
      >
        <Alert
          severity={toast?.severity ?? 'success'}
          variant="filled"
          onClose={close}
          action={
            toast?.action ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  toast.action?.run();
                  close();
                }}
              >
                {toast.action.label}
              </Button>
            ) : undefined
          }
          sx={{ width: '100%', alignItems: 'center' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): Show {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}
