import { describe, expect, it } from 'vitest';
import { restartVersions } from './engine';

describe('moving a goal’s start date', () => {
  const versions = [
    { from: '2026-10-01', target: 4 },
    { from: '2026-11-01', target: 5 },
    { from: '2026-11-20', target: 6 },
  ];
  it('later start: earlier targets fold into one version on the new date', () => {
    expect(restartVersions(versions, '2026-11-10')).toEqual([
      { from: '2026-11-10', target: 5 },
      { from: '2026-11-20', target: 6 },
    ]);
  });
  it('earlier start: the first target simply starts earlier', () => {
    expect(restartVersions(versions, '2026-09-15')).toEqual([
      { from: '2026-09-15', target: 4 },
      { from: '2026-11-01', target: 5 },
      { from: '2026-11-20', target: 6 },
    ]);
  });
  it('start on a change day keeps that day’s target', () => {
    expect(restartVersions(versions, '2026-11-20')).toEqual([{ from: '2026-11-20', target: 6 }]);
  });
});
