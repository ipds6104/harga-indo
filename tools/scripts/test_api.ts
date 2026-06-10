/**
 * Hargia — Frontend API Test Suite
 * Tests all endpoints used by the Framework7 Vue frontend.
 *
 * Usage: bun run tools/scripts/test_api.ts
 */

const BASE_URL = "http://localhost:3005";

interface TestResult {
  name: string;
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  body?: unknown;
  error?: string;
  note?: string;
}

const results: TestResult[] = [];
let sampleProvinsiKode = "";
let sampleKotaKode = "";
let sampleVariantId = 0;
let sampleKodeKabKota = "";

async function test(
  name: string,
  method: "GET" | "POST",
  path: string,
  opts?: { body?: unknown; expectEmpty?: boolean; note?: string }
): Promise<TestResult> {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  let status: number | null = null;
  let body: unknown = null;
  let error: string | undefined;
  let ok = false;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    body = await res.json().catch(() => "(non-JSON)");
    ok = res.ok;
  } catch (err: any) {
    error = err.message;
    ok = false;
  }

  const durationMs = Date.now() - start;
  const result: TestResult = {
    name,
    method,
    url,
    status,
    ok,
    durationMs,
    body,
    error,
    note: opts?.note,
  };
  results.push(result);
  return result;
}

function printResult(r: TestResult) {
  const icon = r.ok ? "✅" : "❌";
  const statusStr = r.status ? `HTTP ${r.status}` : "NO RESPONSE";
  const extra = r.error ? ` | Error: ${r.error}` : "";
  const noteStr = r.note ? ` | ℹ️  ${r.note}` : "";
  console.log(`${icon} [${r.method}] ${r.name}`);
  console.log(`   URL: ${r.url}`);
  console.log(`   ${statusStr} | ${r.durationMs}ms${extra}${noteStr}`);

  if (r.ok && r.body !== null) {
    const bodyStr = JSON.stringify(r.body);
    const preview = bodyStr.length > 200 ? bodyStr.substring(0, 200) + "..." : bodyStr;
    console.log(`   Body: ${preview}`);
  }
  console.log();
}

async function main() {
  console.log("=".repeat(70));
  console.log("  HARGIA — Frontend API Test Suite");
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Time: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`);
  console.log("=".repeat(70));
  console.log();

  // ─── 1. Health Check ──────────────────────────────────────────────────────
  console.log("── [1/14] Health Check ─────────────────────────────────────────");
  printResult(await test("Health Check", "GET", "/api/v1/health"));

  // ─── 2. Provinsi ──────────────────────────────────────────────────────────
  console.log("── [2/14] Master Provinsi ───────────────────────────────────────");
  const provResult = await test("Get All Provinsi", "GET", "/api/v1/provinsi");
  printResult(provResult);
  if (provResult.ok && Array.isArray(provResult.body) && provResult.body.length > 0) {
    const prov = provResult.body[0] as any;
    sampleProvinsiKode = prov.kode;
    console.log(`   → Sample provinsi_kode for subsequent tests: "${sampleProvinsiKode}"`);
    console.log();
  }

  // ─── 3. Kota ──────────────────────────────────────────────────────────────
  console.log("── [3/14] Master Kota ───────────────────────────────────────────");
  if (sampleProvinsiKode) {
    const kotaResult = await test(
      `Get Kota by Provinsi (kode_provinsi=${sampleProvinsiKode})`,
      "GET",
      `/api/v1/kota?kode_provinsi=${sampleProvinsiKode}`
    );
    printResult(kotaResult);
    if (kotaResult.ok && Array.isArray(kotaResult.body) && kotaResult.body.length > 0) {
      const k = kotaResult.body[0] as any;
      sampleKotaKode = k.kode;
      console.log(`   → Sample kota_kode for subsequent tests: "${sampleKotaKode}"`);
      console.log();
    }
  } else {
    printResult(await test("Get Kota (all — no provinsi filter)", "GET", "/api/v1/kota"));
  }

  // ─── 4. Komoditas ─────────────────────────────────────────────────────────
  console.log("── [4/14] Master Komoditas & Variant ────────────────────────────");
  const komResult = await test("Get Komoditas (with variants)", "GET", "/api/v1/komoditas");
  printResult(komResult);
  if (komResult.ok && Array.isArray(komResult.body) && komResult.body.length > 0) {
    const firstKom = komResult.body[0] as any;
    const variants = firstKom.variants as any[];
    if (variants && variants.length > 0) {
      sampleVariantId = variants[0].id;
      console.log(`   → Sample variant_id for subsequent tests: ${sampleVariantId}`);
      console.log();
    }
  }

  // ─── 5. Pasar ─────────────────────────────────────────────────────────────
  console.log("── [5/14] Master Pasar ──────────────────────────────────────────");
  const pasarResult = await test(
    "Get All Pasar",
    "GET",
    "/api/v1/pasar"
  );
  printResult(pasarResult);

  if (sampleProvinsiKode) {
    const pasarProvResult = await test(
      `Get Pasar by Provinsi (provinsi_id=${sampleProvinsiKode})`,
      "GET",
      `/api/v1/pasar?provinsi_id=${sampleProvinsiKode}`
    );
    printResult(pasarProvResult);
    if (pasarProvResult.ok && Array.isArray(pasarProvResult.body) && pasarProvResult.body.length > 0) {
      const p = pasarProvResult.body[0] as any;
      sampleKodeKabKota = p.kodeKabKota || "";
    }
  }

  // ─── 6. Harga Hari Ini ────────────────────────────────────────────────────
  console.log("── [6/14] Harga Hari Ini ────────────────────────────────────────");
  printResult(await test(
    "Get Harga Hari Ini (no filter)",
    "GET",
    "/api/v1/harga/hari-ini",
    { note: "Returns [] if no harga_harian data ingested yet" }
  ));

  if (sampleProvinsiKode) {
    printResult(await test(
      `Get Harga Hari Ini (provinsi_id=${sampleProvinsiKode})`,
      "GET",
      `/api/v1/harga/hari-ini?provinsi_id=${sampleProvinsiKode}`
    ));
  }

  // ─── 7. Trend ─────────────────────────────────────────────────────────────
  console.log("── [7/14] Trend Harga ───────────────────────────────────────────");
  if (sampleVariantId) {
    printResult(await test(
      `Get Trend (variant_id=${sampleVariantId}, 7 days)`,
      "GET",
      `/api/v1/harga/trend?variant_id=${sampleVariantId}`,
      { note: "Returns [] if no harga_harian data ingested yet" }
    ));
    printResult(await test(
      `Get Trend (variant_id=${sampleVariantId}, 30 days)`,
      "GET",
      `/api/v1/harga/trend?variant_id=${sampleVariantId}&days=30`
    ));
  } else {
    console.log("   ⚠️  Skipping trend test — no variant_id available\n");
  }

  // ─── 8. Perbandingan Pasar ────────────────────────────────────────────────
  console.log("── [8/14] Perbandingan Pasar ────────────────────────────────────");
  if (sampleVariantId && sampleKodeKabKota) {
    printResult(await test(
      `Get Perbandingan Pasar (variant_id=${sampleVariantId}, kota=${sampleKodeKabKota})`,
      "GET",
      `/api/v1/harga/perbandingan-pasar?variant_id=${sampleVariantId}&kode_kab_kota=${sampleKodeKabKota}`,
      { note: "Returns [] if no harga_harian data ingested yet" }
    ));
  } else {
    // Fallback: use hardcoded Jakarta Pusat kode
    printResult(await test(
      "Get Perbandingan Pasar (variant_id=1, kota=3171 [hardcoded Jakarta Pusat])",
      "GET",
      `/api/v1/harga/perbandingan-pasar?variant_id=${sampleVariantId || 1}&kode_kab_kota=3171`,
      { note: "Returns [] if no harga_harian data ingested yet" }
    ));
  }

  // ─── 9. Anomali ───────────────────────────────────────────────────────────
  console.log("── [9/14] Anomali AI ────────────────────────────────────────────");
  printResult(await test(
    "Get Anomali (no filter)",
    "GET",
    "/api/v1/harga/anomali",
    { note: "Returns [] if no ai_insights data generated yet" }
  ));
  if (sampleProvinsiKode) {
    printResult(await test(
      `Get Anomali (kode_provinsi=${sampleProvinsiKode})`,
      "GET",
      `/api/v1/harga/anomali?kode_provinsi=${sampleProvinsiKode}`
    ));
  }

  // ─── 10. Insights Daily ───────────────────────────────────────────────────
  console.log("── [10/14] Insights Daily ───────────────────────────────────────");
  printResult(await test(
    "Get Insights Daily (no filter)",
    "GET",
    "/api/v1/insights/daily",
    { note: "Returns null if no ai_insights summary generated yet" }
  ));
  if (sampleProvinsiKode) {
    printResult(await test(
      `Get Insights Daily (kode_provinsi=${sampleProvinsiKode})`,
      "GET",
      `/api/v1/insights/daily?kode_provinsi=${sampleProvinsiKode}`
    ));
  }

  // ─── 11. Insights Management (KPI) ────────────────────────────────────────
  console.log("── [11/14] Insights Management (KPI) ────────────────────────────");
  printResult(await test(
    "Get Insights Management KPI",
    "GET",
    "/api/v1/insights/management",
    { note: "Returns null if no ai_insights kpi generated yet" }
  ));

  // ─── 12. Ingestion Status ─────────────────────────────────────────────────
  console.log("── [12/14] Ingestion Status ─────────────────────────────────────");
  printResult(await test("Get Ingestion Status (latest date)", "GET", "/api/v1/ingestion/status"));

  // ─── 13. Ingestion Historical ─────────────────────────────────────────────
  console.log("── [13/14] Ingestion Historical Status ──────────────────────────");
  printResult(await test("Get Ingestion Historical Status", "GET", "/api/v1/ingestion/historical-status"));

  // ─── 14. Coverage Summary ─────────────────────────────────────────────────
  console.log("── [14/14] Coverage Summary ─────────────────────────────────────");
  printResult(await test(
    "Get Coverage Summary (last 30 days)",
    "GET",
    "/api/v1/ingestion/coverage-summary"
  ));

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`\n✅ Passed: ${passed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log("\nFailed endpoints:");
    for (const r of failed) {
      console.log(`  - [${r.method}] ${r.name} → ${r.error || `HTTP ${r.status}`}`);
    }
  }

  console.log("\nAll results:");
  const maxNameLen = Math.max(...results.map(r => r.name.length));
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    const statusStr = (r.status ? `${r.status}` : "ERR").padEnd(4);
    const dur = `${r.durationMs}ms`.padEnd(8);
    const bodyType = Array.isArray(r.body)
      ? `Array(${(r.body as any[]).length})`
      : r.body === null
      ? "null"
      : typeof r.body === "object"
      ? "Object"
      : String(r.body);
    console.log(`  ${icon} ${r.name.padEnd(maxNameLen)} HTTP ${statusStr} ${dur} → ${bodyType}`);
  }
  console.log();

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
