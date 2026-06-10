// Helper to split a long date range into chunks of maxDays
export function chunkDateRange(
  startDateStr: string,
  endDateStr: string,
  maxDays = 30,
): { start: string; end: string }[] {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T00:00:00.000Z`);
  const chunks: { start: string; end: string }[] = [];

  let currentStart = new Date(start);
  while (currentStart <= end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setUTCDate(currentEnd.getUTCDate() + maxDays - 1);

    const finalEnd = currentEnd > end ? new Date(end) : currentEnd;

    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: finalEnd.toISOString().split('T')[0],
    });

    currentStart = new Date(finalEnd);
    currentStart.setUTCDate(currentStart.getUTCDate() + 1);
  }
  return chunks;
}

// Helper to group non-contiguous list of date strings into contiguous ranges
export function groupContiguousDates(dates: string[]): { start: string; end: string }[] {
  if (dates.length === 0) return [];

  // Sort dates ascending
  const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sortedDates[0];
  let prevDate = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDateStr = sortedDates[i];
    const currentDate = new Date(currentDateStr);

    const diffTime = currentDate.getTime() - prevDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (Math.round(diffDays) > 1) {
      // Gap/non-contiguous detected, push previous range
      ranges.push({ start: rangeStart, end: sortedDates[i - 1] });
      rangeStart = currentDateStr;
    }
    prevDate = currentDate;
  }

  // Push the final range
  ranges.push({ start: rangeStart, end: sortedDates[sortedDates.length - 1] });
  return ranges;
}
