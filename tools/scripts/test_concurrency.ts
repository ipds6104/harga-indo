/**
 * SP2KP Concurrency Stress Test
 * Tests concurrent API calls from 1 to 20 to find the stable upper limit.
 * Uses Bun's native fetch — no Node.js required.
 *
 * Usage: bun run test_concurrency.ts
 */

const BASE_URL = "https://api-sp2kp.kemendag.go.id";

// Sample of 25 real pasar IDs to rotate through for testing
const SAMPLE_PASAR_IDS = [
  517, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24,
];

const TEST_DATE = "2026-06-09";

interface FetchResult {
  pasar_id: number;
  status: number;
  records: number;
  totalCount: number;
  durationMs: number;
  error?: string;
}

async function fetchOneParas(pasarId: number): Promise<FetchResult> {
  const url = `${BASE_URL}/trx/harga-harian?tanggal_start=${TEST_DATE}&tanggal_end=${TEST_DATE}&tipe_komoditas_id=1&pasar_id=${pasarId}&take=1000&skip=0`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HargaIndo/1.0)",
        Accept: "application/json",
      },
      // 15 second timeout using AbortSignal
      signal: AbortSignal.timeout(15_000),
    });
    const durationMs = Date.now() - start;
    if (!res.ok) {
      return { pasar_id: pasarId, status: res.status, records: 0, totalCount: 0, durationMs, error: `HTTP ${res.status}` };
    }
    const json = await res.json() as any;
    return {
      pasar_id: pasarId,
      status: res.status,
      records: json.data?.length ?? 0,
      totalCount: json.totalCount ?? 0,
      durationMs,
    };
  } catch (err: any) {
    return {
      pasar_id: pasarId,
      status: 0,
      records: 0,
      totalCount: 0,
      durationMs: Date.now() - start,
      error: err.message,
    };
  }
}

interface BatchResult {
  concurrency: number;
  successCount: number;
  failCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errors: string[];
  stable: boolean;
}

async function testConcurrency(concurrency: number): Promise<BatchResult> {
  // Pick pasar IDs for this test (cycle through sample list)
  const pasarIds = Array.from({ length: concurrency }, (_, i) => SAMPLE_PASAR_IDS[i % SAMPLE_PASAR_IDS.length]);

  const wallStart = Date.now();
  const results = await Promise.all(pasarIds.map(fetchOneParas));
  const wallDuration = Date.now() - wallStart;

  const successes = results.filter(r => r.status === 200);
  const failures = results.filter(r => r.status !== 200 || r.error);
  const durations = successes.map(r => r.durationMs);

  return {
    concurrency,
    successCount: successes.length,
    failCount: failures.length,
    totalDurationMs: wallDuration,
    avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    minDurationMs: durations.length ? Math.min(...durations) : 0,
    maxDurationMs: durations.length ? Math.max(...durations) : 0,
    errors: failures.map(r => `pasar_id=${r.pasar_id}: ${r.error ?? `HTTP ${r.status}`}`),
    stable: failures.length === 0,
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("SP2KP CONCURRENCY STRESS TEST");
  console.log(`Date: ${TEST_DATE} | Runtime: Bun ${Bun.version}`);
  console.log("=".repeat(70));
  console.log("");

  // Test levels: 1, 2, 3, 5, 8, 10, 12, 15, 18, 20
  const levels = [1, 2, 3, 5, 8, 10, 12, 15, 18, 20];
  const summaryRows: BatchResult[] = [];
  let firstFailLevel: number | null = null;

  for (const level of levels) {
    process.stdout.write(`Testing concurrency=${level.toString().padStart(2, " ")}... `);
    // Cool-down between test levels to avoid residual rate-limit effects
    if (level > 1) await Bun.sleep(1500);

    const result = await testConcurrency(level);
    summaryRows.push(result);

    const statusIcon = result.stable ? "✅" : "❌";
    console.log(
      `${statusIcon} success=${result.successCount}/${result.concurrency} | ` +
      `wall=${result.totalDurationMs}ms | avg=${result.avgDurationMs}ms | ` +
      `min=${result.minDurationMs}ms | max=${result.maxDurationMs}ms`
    );
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.slice(0, 3).join(", ")}`);
    }

    if (!result.stable && firstFailLevel === null) {
      firstFailLevel = level;
    }
  }

  // Summary table
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY TABLE");
  console.log("=".repeat(70));
  console.log(
    "Concurrency".padEnd(14) +
    "Success".padEnd(10) +
    "Wall (ms)".padEnd(12) +
    "Avg (ms)".padEnd(12) +
    "Max (ms)".padEnd(12) +
    "Stable"
  );
  console.log("-".repeat(70));
  for (const row of summaryRows) {
    console.log(
      row.concurrency.toString().padEnd(14) +
      `${row.successCount}/${row.concurrency}`.padEnd(10) +
      row.totalDurationMs.toString().padEnd(12) +
      row.avgDurationMs.toString().padEnd(12) +
      row.maxDurationMs.toString().padEnd(12) +
      (row.stable ? "✅ YES" : "❌ NO")
    );
  }

  console.log("\n" + "=".repeat(70));
  const stableMax = summaryRows.filter(r => r.stable).at(-1);
  if (stableMax) {
    console.log(`✅ RECOMMENDED MAX CONCURRENCY: ${stableMax.concurrency}`);
    // Estimate daily fetch time
    const totalPasar = 1228;
    const tipes = 1; // tipe_komoditas_id=1 only (others return 0)
    const totalRequests = totalPasar * tipes;
    const estimatedWallMs = (totalRequests / stableMax.concurrency) * stableMax.avgDurationMs;
    const estimatedMinutes = Math.ceil(estimatedWallMs / 1000 / 60);
    console.log(`📊 Estimated daily fetch time (1228 pasar): ~${estimatedMinutes} menit`);
  }
  if (firstFailLevel !== null) {
    console.log(`⚠️  First failure at concurrency: ${firstFailLevel}`);
  }
  console.log("=".repeat(70));

  // === SAMPLE FIELD INSPECTION ===
  console.log("\n" + "=".repeat(70));
  console.log("FIELD INSPECTION — Data fields returned per pasar");
  console.log("=".repeat(70));
  const sample = await fetch(
    `${BASE_URL}/trx/harga-harian?tanggal_start=${TEST_DATE}&tanggal_end=${TEST_DATE}&tipe_komoditas_id=1&pasar_id=517&take=3&skip=0`,
    { headers: { "User-Agent": "HargaIndo/1.0", Accept: "application/json" } }
  );
  const sampleJson = await sample.json() as any;
  if (sampleJson.data && sampleJson.data.length > 0) {
    const item = sampleJson.data[0];
    console.log("\nTop-level response keys:", Object.keys(sampleJson));
    console.log(`\nRecord fields (${Object.keys(item).length} fields):`);
    for (const [key, val] of Object.entries(item)) {
      const type = Array.isArray(val) ? "array" : typeof val;
      const preview = val === null ? "null" : type === "string" ? `"${String(val).substring(0, 40)}"` : String(val).substring(0, 40);
      console.log(`  ${key.padEnd(30)} [${type.padEnd(7)}] ${preview}`);
    }
    console.log("\nSample record (first item):");
    console.log(JSON.stringify(item, null, 2));
  }
}

main().catch(console.error);
