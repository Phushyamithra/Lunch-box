import { Box, Typography } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Calendar } from '../components/Calendar/Calendar';
import { FAB } from '../components/FAB/FAB';
import { CelebrationDialog } from '../components/Goals/CelebrationDialog';
import { GoalsCard } from '../components/Goals/GoalsCard';
import { Header } from '../components/Header/Header';
import { MealDialog } from '../components/MealDialog/MealDialog';
import { MealSummaryList } from '../components/MealList/MealSummaryList';
import { useAppData } from '../context/AppDataContext';
import { fromDateKey, toDateKey, toMonthKey } from '../utils/date';

const HIGHLIGHT_DURATION_MS = 1200;

/** Main screen: header, calendar, recent-meals summary and quick-log FAB. */
export default function Dashboard() {
  const { logs, mealById } = useAppData();
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);

  const monthLogs = useMemo(() => {
    const key = toMonthKey(month);
    return Object.fromEntries(Object.entries(logs).filter(([date]) => date.startsWith(key)));
  }, [logs, month]);

  const openDialog = useCallback((dateKey: string) => setDialogDate(dateKey), []);
  const closeDialog = useCallback(() => setDialogDate(null), []);

  /** From the summary list: switch month if needed, then pulse the day. */
  const jumpToDate = useCallback((dateKey: string) => {
    setMonth(fromDateKey(dateKey).startOf('month'));
    setHighlightDate(dateKey);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(
      () => setHighlightDate(null),
      HIGHLIGHT_DURATION_MS,
    );
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        month={month}
        onPrevMonth={() => setMonth((m) => m.subtract(1, 'month'))}
        onNextMonth={() => setMonth((m) => m.add(1, 'month'))}
        onGoToday={() => setMonth(dayjs().startOf('month'))}
      />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, pb: 11 }}>
        <GoalsCard />
        <Calendar
          month={month}
          logs={monthLogs}
          mealById={mealById}
          highlightDate={highlightDate}
          onDayClick={openDialog}
        />

        <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1, color: 'text.secondary' }}>
          Recent meals
        </Typography>
        <MealSummaryList logs={monthLogs} mealById={mealById} onSelect={jumpToDate} />
      </Box>

      <FAB onClick={() => openDialog(toDateKey(dayjs()))} />

      <MealDialog open={dialogDate !== null} dateKey={dialogDate} onClose={closeDialog} />

      {/* Fires once per achievement, queued by AppDataContext. */}
      <CelebrationDialog />
    </Box>
  );
}
