import SaveAltRoundedIcon from '@mui/icons-material/SaveAltRounded';
import { Button } from '@mui/material';
import { useState } from 'react';
import { useSnackbar } from '../../context/SnackbarContext';
import { backupService, downloadBackup } from '../../services/BackupService';

/** Downloads a full JSON snapshot of everything LunchBox has stored. */
export function BackupButton() {
  const { showSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);

  const handleBackup = async () => {
    setBusy(true);
    try {
      const backup = await backupService.createBackup();
      downloadBackup(backup);
      showSnackbar('Backup downloaded');
    } catch {
      showSnackbar('Backup failed. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outlined"
      fullWidth
      startIcon={<SaveAltRoundedIcon />}
      onClick={() => void handleBackup()}
      disabled={busy}
    >
      {busy ? 'Preparing backup…' : 'Download full backup (.json)'}
    </Button>
  );
}
