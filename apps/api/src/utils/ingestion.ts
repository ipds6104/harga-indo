interface Market {
  id: number;
  [key: string]: any;
}

interface Chunk {
  start: string;
  end: string;
}

/**
 * Builds BullMQ job objects for SP2KP ingestion in bulk.
 */
export function buildFetchJobs(
  activePasars: Market[],
  chunks: Chunk[],
  commodities: number[],
  runId: string,
  priority: number,
  prefix = 'fetch',
) {
  const jobs: any[] = [];
  for (const chunk of chunks) {
    const dateRangeStr = chunk.start === chunk.end ? chunk.start : `${chunk.start}-to-${chunk.end}`;
    for (const p of activePasars) {
      for (const tipe of commodities) {
        jobs.push({
          name: `${prefix}-${p.id}-${dateRangeStr}-${tipe}`,
          data: {
            pasar_id: p.id,
            tanggal_start: chunk.start,
            tanggal_end: chunk.end,
            tipe_komoditas_id: tipe,
            run_id: runId,
          },
          opts: {
            priority,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        });
      }
    }
  }
  return jobs;
}
