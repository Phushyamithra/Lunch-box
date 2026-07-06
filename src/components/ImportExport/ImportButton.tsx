import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
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
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { ImportSummary } from '../../models';

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv';

interface ImportButtonProps {
  variant?: 'outlined' | 'text' | 'contained';
  fullWidth?: boolean;
}

/**
 * Self-contained "Import meals" button: hidden file input, parsing,
 * validation, and a friendly summary dialog. Reused by Manage Meals
 * and Settings so the flow stays identical everywhere.
 */
export function ImportButton({ variant = 'outlined', fullWidth = false }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFromFile } = useAppData();
  const { showSnackbar } = useSnackbar();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      setSummary(await importFromFile(file));
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : 'Import failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

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
        accept={ACCEPTED_EXTENSIONS}
        hidden
        aria-label="Choose a spreadsheet to import"
        onChange={(e) => void handleFile(e)}
      />

      <Dialog open={summary !== null} onClose={() => setSummary(null)} maxWidth="xs" fullWidth>
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setSummary(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
