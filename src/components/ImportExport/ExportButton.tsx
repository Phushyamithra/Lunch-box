import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import { Button, ListItemText, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { ExportFormat } from '../../models';

interface ExportButtonProps {
  variant?: 'outlined' | 'text' | 'contained';
  fullWidth?: boolean;
}

/** Exports the catalog as Excel or CSV via a small format menu. */
export function ExportButton({ variant = 'outlined', fullWidth = false }: ExportButtonProps) {
  const { meals, exportCatalog } = useAppData();
  const { showSnackbar } = useSnackbar();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setAnchor(null);
    if (meals.length === 0) {
      showSnackbar('Your catalog is empty — nothing to export.', 'info');
      return;
    }
    try {
      await exportCatalog(format);
      showSnackbar(`Exported ${meals.length} meals as .${format}`);
    } catch {
      showSnackbar('Export failed. Please try again.', 'error');
    }
  };

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        startIcon={<FileDownloadRoundedIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
      >
        Export meals
      </Button>
      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => void handleExport('xlsx')}>
          <ListItemText primary="Excel (.xlsx)" />
        </MenuItem>
        <MenuItem onClick={() => void handleExport('csv')}>
          <ListItemText primary="CSV (.csv)" />
        </MenuItem>
      </Menu>
    </>
  );
}
