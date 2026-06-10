import { db, komoditas, pihpsHargaHarian, tpidAlert, variant } from '@harga/db';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface AlertEvaluationResult {
  alertCreated: boolean;
  alertId?: string;
  status?: string;
  reason?: string;
}

/**
 * Evaluates price data for anomalies and updates the TPID Alert state machine.
 */
export async function evaluatePrice(params: {
  tanggal: string;
  kodeProvinsi: string;
  kodeKabKota: string;
  komoditasId: number;
  variantId: number;
  hargaRataRata: number;
  jumlahPedagang: number;
}): Promise<AlertEvaluationResult> {
  const {
    tanggal,
    kodeProvinsi,
    kodeKabKota,
    komoditasId,
    variantId,
    hargaRataRata,
    jumlahPedagang,
  } = params;

  // 1. Data Quality check: If merchant reporting sample count is too low (< 3), ignore
  if (jumlahPedagang < 3) {
    console.log(
      `[AlertEvaluator] Low reporting sample count (${jumlahPedagang} merchants) for variant ${variantId} on ${tanggal}. Skipping to prevent noise.`,
    );
    return { alertCreated: false, reason: 'Low merchant sample count' };
  }

  // 2. Fetch variant specifications (e.g. HET/HAP max price)
  const varSpecs = await db.select().from(variant).where(eq(variant.id, variantId)).limit(1);
  if (varSpecs.length === 0) {
    return { alertCreated: false, reason: 'Variant specification not found' };
  }
  const variantSpec = varSpecs[0];
  const thresholdHap = variantSpec.hargaMax || variantSpec.hargaMin || 10000;

  // 3. Fetch historical PIHPS prices for seasonal de-trending (last 30 days)
  const baselineHistory = await db
    .select()
    .from(pihpsHargaHarian)
    .where(
      and(
        eq(pihpsHargaHarian.kodeProvinsi, kodeProvinsi),
        eq(pihpsHargaHarian.komoditasId, komoditasId),
        sql`${pihpsHargaHarian.tanggal} <= ${tanggal}`,
      ),
    )
    .orderBy(desc(pihpsHargaHarian.tanggal))
    .limit(30);

  let mean = thresholdHap;
  let stddev = thresholdHap * 0.05; // default 5% volatility if history is missing

  if (baselineHistory.length > 5) {
    const prices = baselineHistory.map((h) => h.harga);
    const sum = prices.reduce((sumVal, val) => sumVal + val, 0);
    mean = sum / prices.length;

    const variance = prices.reduce((sumVal, val) => sumVal + (val - mean) ** 2, 0) / prices.length;
    stddev = Math.sqrt(variance) || mean * 0.02; // floor stddev at 2% to avoid division by zero
  }

  // Calculate Z-Score relative to seasonal baseline
  const zScore = (hargaRataRata - mean) / stddev;

  // Fetch commodity type to adjust Z-Score threshold
  const komSpecs = await db.select().from(komoditas).where(eq(komoditas.id, komoditasId)).limit(1);
  const tipeKomoditasId = komSpecs[0]?.tipeKomoditasId || 1;

  // Thresholds: 2.5 for highly volatile commodities (chilis, onions), 1.5 for stable ones (rice, sugar)
  const zThreshold = tipeKomoditasId === 2 ? 2.5 : 1.5;

  // Check if price exceeds both the absolute HAP and the volatility Z-Score threshold
  const isAnomalous = hargaRataRata > thresholdHap && zScore > zThreshold;

  console.log(
    `[AlertEvaluator] eval: variant=${variantId}, price=${hargaRataRata}, HAP=${thresholdHap}, Z=${zScore.toFixed(2)} (limit: ${zThreshold}). Anomaly: ${isAnomalous}`,
  );

  // Look for existing active/cooldown alerts for this specific region + variant
  const existingAlerts = await db
    .select()
    .from(tpidAlert)
    .where(
      and(
        eq(tpidAlert.kodeProvinsi, kodeProvinsi),
        eq(tpidAlert.kodeKabKota, kodeKabKota),
        eq(tpidAlert.variantId, variantId),
        sql`${tpidAlert.status} IN ('cooldown', 'active_level_1', 'active_level_2', 'escalated')`,
      ),
    )
    .limit(1);

  const existing = existingAlerts[0];

  if (isAnomalous) {
    if (!existing) {
      // Create new alert in Cooldown period (3 days)
      const id = crypto.randomUUID();
      const cooldownEndDate = new Date(tanggal);
      cooldownEndDate.setDate(cooldownEndDate.getDate() + 3);
      const cooldownEndStr = cooldownEndDate.toISOString().split('T')[0];

      await db.insert(tpidAlert).values({
        id,
        tanggal,
        kodeProvinsi,
        kodeKabKota,
        komoditasId,
        variantId,
        status: 'cooldown',
        hargaRataRata,
        thresholdHap,
        zScore,
        jumlahPedagang,
        cooldownEndTanggal: cooldownEndStr,
      });

      console.log(
        `[AlertEvaluator] Created new alert in cooldown state until ${cooldownEndStr}. ID: ${id}`,
      );
      return { alertCreated: true, alertId: id, status: 'cooldown' };
    }

    // Manage state transitions for existing alerts
    if (existing.status === 'cooldown') {
      const todayDate = new Date(tanggal);
      const endCooldownDate = new Date(existing.cooldownEndTanggal || tanggal);

      // If 3-day cooldown has passed, escalate to active review for Kadisdag
      if (todayDate >= endCooldownDate) {
        await db
          .update(tpidAlert)
          .set({
            status: 'active_level_1',
            hargaRataRata,
            zScore,
            updatedAt: new Date(),
          })
          .where(eq(tpidAlert.id, existing.id));

        console.log(
          `[AlertEvaluator] Alert ${existing.id} promoted from cooldown to active_level_1.`,
        );
        return { alertCreated: false, alertId: existing.id, status: 'active_level_1' };
      }
    } else if (existing.status === 'active_level_1' || existing.status === 'active_level_2') {
      // Automatic escalation check: If active for more than 7 days, escalate to level 3 (escalated)
      const alertAgeDays = Math.floor(
        (new Date(tanggal).getTime() - new Date(existing.createdAt).getTime()) / (1000 * 3600 * 24),
      );

      if (alertAgeDays >= 7) {
        await db
          .update(tpidAlert)
          .set({
            status: 'escalated',
            hargaRataRata,
            zScore,
            updatedAt: new Date(),
          })
          .where(eq(tpidAlert.id, existing.id));

        console.log(
          `[AlertEvaluator] Alert ${existing.id} automatically escalated to Level 3 (escalated) after ${alertAgeDays} days.`,
        );
        return { alertCreated: false, alertId: existing.id, status: 'escalated' };
      }
    }
  } else {
    // Price is in normal range
    if (existing) {
      if (existing.status === 'cooldown') {
        // Self-corrected within cooldown period. Delete/resolve alert immediately
        await db
          .update(tpidAlert)
          .set({
            status: 'resolved',
            updatedAt: new Date(),
          })
          .where(eq(tpidAlert.id, existing.id));

        console.log(
          `[AlertEvaluator] Alert ${existing.id} resolved (self-corrected during cooldown).`,
        );
        return { alertCreated: false, alertId: existing.id, status: 'resolved' };
      }

      // Active alert: Evaluate Exit Criteria.
      // Exit path: If the price has dropped back within normal limits (< 5% above HAP)
      if (hargaRataRata <= thresholdHap * 1.05) {
        await db
          .update(tpidAlert)
          .set({
            status: 'resolved',
            updatedAt: new Date(),
          })
          .where(eq(tpidAlert.id, existing.id));

        console.log(
          `[AlertEvaluator] Alert ${existing.id} met exit criteria (< 5% above HAP). Resolved.`,
        );
        return { alertCreated: false, alertId: existing.id, status: 'resolved' };
      }
    }
  }

  return { alertCreated: false };
}
