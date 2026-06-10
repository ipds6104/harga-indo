import { fetch } from 'bun';

async function fetchFromSP2KP(tanggal: string, pasarId: number, tipeKomoditasId: number = 1) {
  const url = `https://api-sp2kp.kemendag.go.id/trx/harga-harian?tanggal_start=${tanggal}&tanggal_end=${tanggal}&tipe_komoditas_id=${tipeKomoditasId}&pasar_id=${pasarId}&take=10&skip=0`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      return { status: res.status, ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json() as any;
    return { status: res.status, ok: true, data };
  } catch (error: any) {
    return { status: 0, ok: false, error: error.message };
  }
}

async function main() {
  console.log("=== Probing Daily Scans for 2023, 2022, and 2021 ===");
  
  // 1. Get a few market IDs to query.
  const marketsUrl = 'https://api-sp2kp.kemendag.go.id/master/api/pasar?take=10';
  const marketsRes = await fetch(marketsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!marketsRes.ok) {
    console.error("Failed to fetch markets list for probing:", marketsRes.statusText);
    process.exit(1);
  }
  const marketsData = await marketsRes.json() as any;
  const marketIds = (marketsData.data || []).map((m: any) => m.id).slice(0, 5);
  console.log("Selected markets for testing:", marketIds);
  if (marketIds.length === 0) {
    console.error("No markets found.");
    process.exit(1);
  }

  // Define months to scan daily
  const targetPeriods = [
    { year: 2023, month: 12, days: 31 },
    { year: 2023, month: 6, days: 30 },
    { year: 2022, month: 12, days: 31 },
    { year: 2021, month: 12, days: 31 }
  ];

  for (const period of targetPeriods) {
    console.log(`\n--- Daily Probe for ${period.year}-${String(period.month).padStart(2, '0')} ---`);
    let dataFoundInPeriod = false;

    for (let day = 1; day <= period.days; day++) {
      const padDay = String(day).padStart(2, '0');
      const testDate = `${period.year}-${String(period.month).padStart(2, '0')}-${padDay}`;
      
      let foundData = false;
      let totalCount = 0;
      let sampleMarketId = 0;
      
      for (const pasarId of marketIds) {
        const result = await fetchFromSP2KP(testDate, pasarId, 1);
        if (result.ok && result.data) {
          const count = result.data.data?.length || 0;
          if (count > 0 || result.data.totalCount > 0) {
            foundData = true;
            totalCount = result.data.totalCount || count;
            sampleMarketId = pasarId;
            break;
          }
        }
        await new Promise(r => setTimeout(r, 50));
      }
      
      if (foundData) {
        console.log(`  [DATA EXISTS] ${testDate}: Found ${totalCount} records (e.g. for market ${sampleMarketId})`);
        dataFoundInPeriod = true;
      }
    }

    if (!dataFoundInPeriod) {
      console.log(`  [ALL EMPTY] No data exists for any day in ${period.year}-${String(period.month).padStart(2, '0')}`);
    }
  }
}

main().catch(console.error);
