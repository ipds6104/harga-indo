import { db, ingestionLog, pasar } from '@harga/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { fetchQueue } from '../../lib/queues';
import { connection } from '../../lib/redis';

export const monitorRoutes = new Elysia()
  // 9. Get scraping/ingestion status monitor
  .get(
    '/api/v1/ingestion/status',
    async ({ query }) => {
      const { tanggal } = query;
      let targetDate = tanggal;

      if (!targetDate) {
        // Check if there are active/waiting jobs in the fetch queue to track
        try {
          const activeJobs = await fetchQueue.getJobs(['active', 'waiting'], 0, 0, true);
          if (activeJobs.length > 0 && activeJobs[0].data?.tanggal_start) {
            targetDate = activeJobs[0].data.tanggal_start;
          }
        } catch (err) {
          console.error('[API] Error checking active jobs in queue:', err);
        }
      }

      if (!targetDate) {
        // Check Redis for last active date (which we set on trigger)
        try {
          const lastActive = await connection.get('hargia:last-active-date');
          if (lastActive) {
            targetDate = lastActive;
          }
        } catch (err) {
          console.error('[API] Error reading last active date from Redis:', err);
        }
      }

      if (!targetDate) {
        const latest = await db
          .select({ tanggal: ingestionLog.tanggalFetch })
          .from(ingestionLog)
          .orderBy(desc(ingestionLog.tanggalFetch))
          .limit(1)
          .execute();
        if (latest.length === 0) return { succeeded: 0, failed: 0, pending: 0, logs: [] };
        targetDate = latest[0].tanggal;
      }

      const logs = await db
        .select()
        .from(ingestionLog)
        .where(eq(ingestionLog.tanggalFetch, targetDate))
        .orderBy(desc(ingestionLog.createdAt))
        .limit(100)
        .execute();

      // Count total unique markets succeeded/failed for this date
      const [{ succeededCount }] = await db
        .select({
          succeededCount: sql<number>`count(distinct case when ${ingestionLog.status} = 'success' then ${ingestionLog.pasarId} end)`,
        })
        .from(ingestionLog)
        .where(eq(ingestionLog.tanggalFetch, targetDate))
        .execute();

      const [{ failedCount }] = await db
        .select({
          failedCount: sql<number>`count(distinct case when ${ingestionLog.status} = 'failed' then ${ingestionLog.pasarId} end)`,
        })
        .from(ingestionLog)
        .where(eq(ingestionLog.tanggalFetch, targetDate))
        .execute();

      const succeeded = Number(succeededCount) || 0;
      const failed = Number(failedCount) || 0;

      // Active markets total
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pasar)
        .where(eq(pasar.isActive, true));

      const pending = Math.max(Number(count) - (succeeded + failed), 0);

      // Find the last active run ID
      let activeRunId = null;
      try {
        const activeJobs = await fetchQueue.getJobs(['active', 'waiting'], 0, 0, true);
        if (activeJobs.length > 0 && activeJobs[0].data?.run_id) {
          activeRunId = activeJobs[0].data.run_id;
        }
      } catch (err) {
        console.error('[API] Error getting active run ID from queue:', err);
      }

      if (!activeRunId) {
        // Fallback to latest runId in ingestionLog
        try {
          const latestLog = await db
            .select({ runId: ingestionLog.runId })
            .from(ingestionLog)
            .orderBy(desc(ingestionLog.createdAt))
            .limit(1)
            .execute();
          if (latestLog.length > 0) {
            activeRunId = latestLog[0].runId;
          }
        } catch (_) {}
      }

      let runCompletedCount = 0;
      let runFailedCount = 0;
      if (activeRunId) {
        try {
          const [{ completed }] = await db
            .select({ completed: sql<number>`count(*)` })
            .from(ingestionLog)
            .where(and(eq(ingestionLog.runId, activeRunId), eq(ingestionLog.status, 'success')));
          const [{ failed }] = await db
            .select({ failed: sql<number>`count(*)` })
            .from(ingestionLog)
            .where(and(eq(ingestionLog.runId, activeRunId), eq(ingestionLog.status, 'failed')));
          runCompletedCount = Number(completed) || 0;
          runFailedCount = Number(failed) || 0;
        } catch (_) {}
      }

      return {
        tanggal: targetDate,
        totalMarkets: Number(count),
        succeeded,
        failed,
        pending,
        logs,
        activeRunId,
        runCompletedCount,
        runFailedCount,
      };
    },
    {
      query: t.Object({
        tanggal: t.Optional(t.String()),
      }),
    },
  )

  // Consolidated monitor status
  .get(
    '/api/v1/ingestion/monitor',
    async ({ query }) => {
      const { tanggal, page, limit, audit_start, audit_end } = query;

      // 1. Get dailyStatus
      let targetDate = tanggal;

      if (!targetDate) {
        // Check if there are active/waiting jobs in the fetch queue to track
        try {
          const activeJobs = await fetchQueue.getJobs(['active', 'waiting'], 0, 0, true);
          if (activeJobs.length > 0 && activeJobs[0].data?.tanggal_start) {
            targetDate = activeJobs[0].data.tanggal_start;
          }
        } catch (err) {
          console.error('[API] Error checking active jobs in queue:', err);
        }
      }

      if (!targetDate) {
        // Check Redis for last active date (which we set on trigger)
        try {
          const lastActive = await connection.get('hargia:last-active-date');
          if (lastActive) {
            targetDate = lastActive;
          }
        } catch (err) {
          console.error('[API] Error reading last active date from Redis:', err);
        }
      }

      if (!targetDate) {
        try {
          const latest = await db
            .select({ tanggal: ingestionLog.tanggalFetch })
            .from(ingestionLog)
            .orderBy(desc(ingestionLog.tanggalFetch))
            .limit(1)
            .execute();
          if (latest.length > 0) {
            targetDate = latest[0].tanggal;
          }
        } catch (_) {}
      }

      let dailyStatus = null;
      if (targetDate) {
        try {
          const logs = await db
            .select()
            .from(ingestionLog)
            .where(eq(ingestionLog.tanggalFetch, targetDate))
            .orderBy(desc(ingestionLog.createdAt))
            .limit(100)
            .execute();

          // Count total unique markets succeeded/failed for this date
          const [{ succeededCount }] = await db
            .select({
              succeededCount: sql<number>`count(distinct case when ${ingestionLog.status} = 'success' then ${ingestionLog.pasarId} end)`,
            })
            .from(ingestionLog)
            .where(eq(ingestionLog.tanggalFetch, targetDate))
            .execute();

          const [{ failedCount }] = await db
            .select({
              failedCount: sql<number>`count(distinct case when ${ingestionLog.status} = 'failed' then ${ingestionLog.pasarId} end)`,
            })
            .from(ingestionLog)
            .where(eq(ingestionLog.tanggalFetch, targetDate))
            .execute();

          const succeeded = Number(succeededCount) || 0;
          const failed = Number(failedCount) || 0;

          // Active markets total
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(pasar)
            .where(eq(pasar.isActive, true));

          const pending = Math.max(Number(count) - (succeeded + failed), 0);

          // Find the last active run ID
          let activeRunId = null;
          try {
            const activeJobs = await fetchQueue.getJobs(['active', 'waiting'], 0, 0, true);
            if (activeJobs.length > 0 && activeJobs[0].data?.run_id) {
              activeRunId = activeJobs[0].data.run_id;
            }
          } catch (_) {}

          if (!activeRunId) {
            try {
              const latestLog = await db
                .select({ runId: ingestionLog.runId })
                .from(ingestionLog)
                .orderBy(desc(ingestionLog.createdAt))
                .limit(1)
                .execute();
              if (latestLog.length > 0) {
                activeRunId = latestLog[0].runId;
              }
            } catch (_) {}
          }

          let runCompletedCount = 0;
          let runFailedCount = 0;
          if (activeRunId) {
            try {
              const [{ completed }] = await db
                .select({ completed: sql<number>`count(*)` })
                .from(ingestionLog)
                .where(
                  and(eq(ingestionLog.runId, activeRunId), eq(ingestionLog.status, 'success')),
                );
              const [{ failed }] = await db
                .select({ failed: sql<number>`count(*)` })
                .from(ingestionLog)
                .where(and(eq(ingestionLog.runId, activeRunId), eq(ingestionLog.status, 'failed')));
              runCompletedCount = Number(completed) || 0;
              runFailedCount = Number(failed) || 0;
            } catch (_) {}
          }

          dailyStatus = {
            tanggal: targetDate,
            totalMarkets: Number(count),
            succeeded,
            failed,
            pending,
            logs,
            activeRunId,
            runCompletedCount,
            runFailedCount,
          };
        } catch (err) {
          console.error('[API] Error building dailyStatus for monitor:', err);
        }
      }

      // 2. Get historicalLogs
      let historicalLogs: any[] = [];
      try {
        const hPage = page ? Math.max(1, Number(page)) : 1;
        const hLimit = limit ? Math.max(1, Number(limit)) : 30;
        const hOffset = (hPage - 1) * hLimit;

        const queryResult = await db.execute(sql`
          WITH latest_logs AS (
            SELECT DISTINCT ON (tanggal_fetch, pasar_id, tipe_komoditas_id)
                   tanggal_fetch, pasar_id, tipe_komoditas_id, status
            FROM ingestion_log
            ORDER BY tanggal_fetch, pasar_id, tipe_komoditas_id, created_at DESC
          )
          SELECT tanggal_fetch as tanggal,
                 count(case when status = 'success' then 1 end)::int as succeeded,
                 count(case when status = 'failed' then 1 end)::int as failed
          FROM latest_logs
          GROUP BY tanggal_fetch
          ORDER BY tanggal_fetch DESC
          LIMIT ${hLimit} OFFSET ${hOffset}
        `);
        const results = queryResult.rows as any[];

        const [{ count: activeMarketsCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(pasar)
          .where(eq(pasar.isActive, true));
        const totalMarketsCount = Number(activeMarketsCount) || 1228;

        historicalLogs = results.map((r) => ({
          tanggal: r.tanggal,
          succeeded: Number(r.succeeded),
          failed: Number(r.failed),
          totalMarkets: totalMarketsCount * 3,
          pending: Math.max(totalMarketsCount * 3 - (Number(r.succeeded) + Number(r.failed)), 0),
          percentage: Math.min(
            Math.round(((Number(r.succeeded) + Number(r.failed)) / (totalMarketsCount * 3)) * 100),
            100,
          ),
        }));
      } catch (err) {
        console.error('[API] Error building historicalLogs for monitor:', err);
      }

      // 3. Get coverageSummary if audit dates are provided
      let coverageSummary = null;
      if (audit_start && audit_end) {
        try {
          const minAllowed = new Date('2024-01-01T00:00:00.000Z');

          let startDateObj = new Date(`${audit_start}T00:00:00.000Z`);
          if (startDateObj < minAllowed) {
            startDateObj = minAllowed;
          }
          const adjustedAuditStart = startDateObj.toISOString().split('T')[0];

          const endDateObj = new Date(`${audit_end}T00:00:00.000Z`);

          if (
            !Number.isNaN(startDateObj.getTime()) &&
            !Number.isNaN(endDateObj.getTime()) &&
            startDateObj <= endDateObj
          ) {
            const [{ count: activeMarketsCount }] = await db
              .select({ count: sql<number>`count(*)` })
              .from(pasar)
              .where(eq(pasar.isActive, true));
            const totalMarketsCount = Number(activeMarketsCount) || 1228;
            const totalExpectedPerDay = totalMarketsCount * 3;

            const logsResult = await db.execute(sql`
              WITH latest_logs AS (
                SELECT DISTINCT ON (tanggal_fetch, pasar_id, tipe_komoditas_id)
                       tanggal_fetch, pasar_id, tipe_komoditas_id, status
                FROM ingestion_log
                WHERE tanggal_fetch >= ${adjustedAuditStart} AND tanggal_fetch <= ${audit_end}
                ORDER BY tanggal_fetch, pasar_id, tipe_komoditas_id, created_at DESC
              )
              SELECT tanggal_fetch as tanggal,
                     count(case when status = 'success' then 1 end)::int as succeeded,
                     count(case when status = 'failed' then 1 end)::int as failed
              FROM latest_logs
              GROUP BY tanggal_fetch
            `);
            const logs = logsResult.rows as any[];

            const logMap = new Map(
              logs.map((l) => [
                l.tanggal,
                {
                  succeeded: Number(l.succeeded),
                  failed: Number(l.failed),
                  percentage: Math.min(
                    Math.round(
                      ((Number(l.succeeded) + Number(l.failed)) / totalExpectedPerDay) * 100,
                    ),
                    100,
                  ),
                },
              ]),
            );

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

            coverageSummary = {
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
          }
        } catch (err) {
          console.error('[API] Error building coverageSummary for monitor:', err);
        }
      }

      return {
        dailyStatus,
        historicalLogs,
        coverageSummary,
      };
    },
    {
      query: t.Object({
        tanggal: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        audit_start: t.Optional(t.String()),
        audit_end: t.Optional(t.String()),
      }),
    },
  );
