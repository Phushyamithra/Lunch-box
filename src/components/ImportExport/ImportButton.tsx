import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { IMPORT_ACCEPT } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { ImportResult } from '../../models';

interface ImportButtonProps {
  variant?: 'outlined' | 'text' | 'contained';
  fullWidth?: boolean;
}

/**
 * Self-contained "Import meals" button: hidden file input, parsing,
 * validation, macro-workbook detection and a friendly summary dialog.
 * Reused by Manage Meals and Settings so the flow stays identical.
 */
export function ImportButton({ variant = 'outlined', fullWidth = false }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFromFile } = useAppData();
  const { showSnackbar } = useSnackbar();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      setResult(await importFromFile(file));
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : 'Import failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const summary = result?.summary;
  const rows: { count: number; label: string; emoji: string }[] = summary
    ? [
        { count: summary.imported, label: summary.imported === 1 ? 'meal imported' : 'meals imported', emoji: '✅' },
        { count: summary.duplicates, label: summary.duplicates === 1 ? 'duplicate skipped' : 'duplicates skipped', emoji: '↩️' },
        { count: summary.invalid, label: summary.invalid === 1 ? 'invalid row' : 'invalid rows', emoji: '⚠️' },
      ]
    : [];

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        startIcon={<UploadFileRoundedIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? 'Importing…' : 'Import meals'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        hidden
        aria-label="Choose a spreadsheet to import"
        onChange={(e) => void handleFile(e)}
      />

      <Dialog open={result !== null} onClose={() => setResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Import complete</DialogTitle>
        <DialogContent>
          {rows.map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <span aria-hidden>{row.emoji}</span>
                <Typography variant="body1">
                  <strong>{row.count}</strong> {row.label}
                </Typography>
              </Box>
            </motion.div>
          ))}
          {result?.hasMacros && (
            <Alert
              severity="info"
              icon={<InfoOutlinedIcon fontSize="inherit" />}
              sx={{ mt: 1.5, borderRadius: 3 }}
            >
              This workbook contains macros (VBA). Only the meal data was read — macros were
              never executed, and the original file was preserved unchanged.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setResult(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
