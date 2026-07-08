import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { searchIcons } from '../../utils/iconLibrary';

interface IconPickerDialogProps {
  open: boolean;
  value: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

/** Searchable picker over the built-in emoji icon library. */
export function IconPickerDialog({ open, value, onSelect, onClose }: IconPickerDialogProps) {
  const [query, setQuery] = useState('');
  const icons = useMemo(() => searchIcons(query), [query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="icon-picker-title">
      <DialogTitle id="icon-picker-title">Pick an icon</DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="Search icons… (e.g. pizza, coffee)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 1.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {icons.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No icons match "{query}".
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 0.5,
              maxHeight: 280,
              overflowY: 'auto',
            }}
            role="listbox"
            aria-label="Icon choices"
          >
            {icons.map((entry) => (
              <ButtonBase
                key={entry.emoji}
                role="option"
                aria-selected={value === entry.emoji}
                aria-label={entry.keywords[0]}
                onClick={() => {
                  onSelect(entry.emoji);
                  onClose();
                }}
                sx={{
                  fontSize: 22,
                  borderRadius: 2,
                  aspectRatio: '1 / 1',
                  border: '2px solid',
                  borderColor: value === entry.emoji ? 'primary.main' : 'transparent',
                  bgcolor: (t) =>
                    value === entry.emoji ? alpha(t.palette.primary.main, 0.12) : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {entry.emoji}
              </ButtonBase>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
