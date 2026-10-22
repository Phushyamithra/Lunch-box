import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { Alert, Collapse } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useCachedModules } from '../lib/offlineCache';

const NAMES: Record<string, string> = { fitness: 'Fitness', nutrition: 'Nutrition', goals: 'Goals', mealprep: 'Meal prep' };

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Says when you're offline and which data is a saved copy (and from when). */
export function OfflineBanner() {
  const online = useOnline();
  const cached = useCachedModules();
  const entries = Object.entries(cached);
  const show = !online || entries.length > 0;
  const oldest = entries.map(([, at]) => at).sort()[0];
  const when = oldest ? (dayjs(oldest).isSame(dayjs(), 'day') ? dayjs(oldest).format('HH:mm') : dayjs(oldest).format('D MMM, HH:mm')) : null;
  return (
    <Collapse in={show} unmountOnExit>
      <Alert severity="warning" icon={<CloudOffRoundedIcon />} sx={{ mb: 2 }} role="status">
        {!online ? 'You’re offline. ' : 'Can’t reach the server. '}
        {entries.length
          ? `Showing the copy saved on this device${when ? ` at ${when}` : ''} (${entries.map(([m]) => NAMES[m] ?? m).join(', ')}). Changes need a connection; Finance works offline as usual.`
          : 'Saving needs a connection; Finance works offline as usual.'}
      </Alert>
    </Collapse>
  );
}
