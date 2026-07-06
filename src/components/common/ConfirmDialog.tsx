import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'error' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}

/** Reusable confirmation gate for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = 'error',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="confirm-dialog-title" maxWidth="xs" fullWidth>
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
