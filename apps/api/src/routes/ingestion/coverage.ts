import { db, ingestionLog, pasar } from '@harga/db';
import { eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const coverageRoutes = new Elysia()
  // 13. Get detailed data ingestion coverage summary across a date range
  .get(
    '/api/v1/ingestion/coverage-summary',
    async ({ query }) => {
      const { start_date, end_date } = query;

      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      const defaultStart = new Date();
      defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);
      const defaultStartDate = defaultStart.toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Jakarta',
      });

      const targetStart = start_date || defaultStartDate;
      const targetEnd = end_date || today;

      const minAllowed = new Date('2024-01-01T00:00:00.000Z');

      let startDateObj = new Date(`${targetStart}T00:00:00.000Z`);
      if (startDateObj < minAllowed) {
        startDateObj = minAllowed;
      }
      const adjustedTargetStart = startDateObj.toISOString().split('T')[0];

      const endDateObj = new Date(`${targetEnd}T00:00:00.000Z`);

      if (
        Number.isNaN(startDateObj.getTime()) ||
        Number.isNaN(endDateObj.getTime()) ||
        startDateObj > endDateObj
      ) {
        throw new Error('Invalid date range');
      }

      // Fetch active markets total
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pasar)
        .where(eq(pasar.isActive, true));
      const totalMarketsCount = Number(count) || 1228;

      // Fetch unique log counts per date within the range using CTE to select the latest status
      const logsResult = await db.execute(sql`
        WITH latest_logs AS (
          SELECT DISTINCT ON (tanggal_fetch, pasar_id, tipe_komoditas_id)
                 tanggal_fetch, pasar_id, tipe_komoditas_id, status
          FROM ingestion_log
          WHERE tanggal_fetch >= ${adjustedTargetStart} AND tanggal_fetch <= ${targetEnd}
          ORDER BY tanggal_fetch, pasar_id, tipe_komoditas_id, created_at DESC
        )
        SELECT tanggal_fetch as tanggal,
               count(case when status = 'success' then 1 end)::int as succeeded,
               count(case when status = 'failed' then 1 end)::int as failed
        FROM latest_logs
        GROUP BY tanggal_fetch
      `);
      const logs = logsResult.rows as any[];

      const totalExpectedPerDay = totalMarketsCount * 3;

      // Create a map of existing dates
      const logMap = new Map(
        logs.map((l) => [
          l.tanggal,
          {
            succeeded: Number(l.succeeded),
            failed: Number(l.failed),
            percentage: Math.min(
              Math.round(((Number(l.succeeded) + Number(l.failed)) / totalExpectedPerDay) * 100),
              100,
            ),
          },
        ]),
      );

      // Generate all days in range
      const missingDates: string[] = [];
      const incompleteDates: any[] = [];
      let fullyIngestedDays = 0;
      let partiallyIngestedDays = 0;
      let missingDays = 0;
      let totalDays = 0;
      let totalSucceededJobs = 0;
      let totalFailedJobs = 0;

      const current = new Date(startDateObj);
      while (current <= endDateObj) {
        totalDays++;
        const dateStr = current.toISOString().split('T')[0];
        const log = logMap.get(dateStr);

        if (!log) {
          missingDays++;
          missingDates.push(dateStr);
        } else {
          totalSucceededJobs += log.succeeded;
          totalFailedJobs += log.failed;

          if (log.percentage >= 95) {
            fullyIngestedDays++;
          } else {
            partiallyIngestedDays++;
            incompleteDates.push({
              tanggal: dateStr,
              succeeded: log.succeeded,
              failed: log.failed,
              totalMarkets: totalExpectedPerDay,
              percentage: log.percentage,
            });
          }
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      const completenessPercentage =
        totalDays > 0 ? Math.round((fullyIngestedDays / totalDays) * 100) : 0;

      const totalExpectedJobs = totalDays * totalMarketsCount * 3;

      return {
        totalDays,
        fullyIngestedDays,
        partiallyIngestedDays,
        missingDays,
        completenessPercentage,
        missingDates,
        incompleteDates,
        totalMarkets: totalMarketsCount,
        totalSucceededJobs,
        totalFailedJobs,
        totalExpectedJobs,
      };
    },
    {
      query: t.Object({
        start_date: t.Optional(t.String()),
        end_date: t.Optional(t.String()),
      }),
    },
  )

  // 15. Get overall progress percentage across all dates and all commodities
  .get('/api/v1/ingestion/overall-progress', async () => {
    // 1. Get total active markets
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pasar)
      .where(eq(pasar.isActive, true));
    const totalMarketsCount = Number(count) || 1228;
    const totalExpectedPerDay = totalMarketsCount * 3;

    // 2. Get the earliest and latest date in ingestionLog
    const datesInfo = await db
      .select({
        minDate: sql<string>`min(${ingestionLog.tanggalFetch})`,
        maxDate: sql<string>`max(${ingestionLog.tanggalFetch})`,
      })
      .from(ingestionLog)
      .execute();

    if (!datesInfo[0] || !datesInfo[0].minDate || !datesInfo[0].maxDate) {
      return {
        overallPercentage: 0,
        totalDays: 0,
        startDate: null,
        endDate: null,
        message: 'No data',
      };
    }

    const minD = new Date(datesInfo[0].minDate);
    const maxD = new Date(datesInfo[0].maxDate);

    // Calculate difference in days + 1
    const diffTime = Math.abs(maxD.getTime() - minD.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const totalExpectedJobs = totalDays * totalExpectedPerDay;

    // 3. Count all successful logs
    const [{ successCount }] = await db
      .select({
        successCount: sql<number>`count(distinct concat(${ingestionLog.tanggalFetch}, '-', ${ingestionLog.pasarId}, '-', ${ingestionLog.tipeKomoditasId}))`,
      })
      .from(ingestionLog)
      .where(eq(ingestionLog.status, 'success'))
      .execute();

    const overallPercentage =
      totalExpectedJobs > 0
        ? Math.min(Math.round((Number(successCount) / totalExpectedJobs) * 100), 100)
        : 0;

    return {
      startDate: datesInfo[0].minDate,
      endDate: datesInfo[0].maxDate,
      totalDays,
      totalExpectedJobs,
      totalSuccessfulJobs: Number(successCount),
      overallPercentage,
    };
  });
