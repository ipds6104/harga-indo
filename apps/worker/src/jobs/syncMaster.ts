import { db, komoditas, kota, pasar, produk, provinsi, satuan, variant } from '@harga/db';
import { SP2KP_BASE_URL } from '@harga/shared';
import { sql } from 'drizzle-orm';

export async function syncMaster(payload: { runId: string }) {
  console.log(`[SyncMaster] Starting master sync for run: ${payload.runId}`);
  const startTime = Date.now();

  try {
    // 1. Fetch and Sync Provinsi
    console.log('[SyncMaster] Fetching provinsi master...');
    const provRes = await fetch(`${SP2KP_BASE_URL}/master/api/wilayah/provinsi`);
    if (!provRes.ok) throw new Error(`Failed to fetch provinsi: ${provRes.statusText}`);
    const provJson = (await provRes.json()) as any;
    const provList = provJson.data || provJson; // SP2KP sometimes nests in data, sometimes raw array

    console.log(`[SyncMaster] Found ${provList.length} provinsi. Syncing to DB...`);
    for (const prov of provList) {
      await db
        .insert(provinsi)
        .values({
          kode: prov.kode_provinsi,
          nama: prov.nama_provinsi,
        })
        .onConflictDoUpdate({
          target: provinsi.kode,
          set: { nama: prov.nama_provinsi },
        });
    }

    // 1.5 Fetch and Sync Kota/Kabupaten via Emsifa
    console.log('[SyncMaster] Fetching kota/kabupaten master from Emsifa...');
    for (const prov of provList) {
      try {
        const kotaRes = await fetch(
          `https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${prov.kode_provinsi}.json`,
        );
        if (kotaRes.ok) {
          const kotaList = (await kotaRes.json()) as any[];
          for (const k of kotaList) {
            await db
              .insert(kota)
              .values({
                kode: k.id,
                nama: k.name,
                kodeProvinsi: k.province_id,
              })
              .onConflictDoUpdate({
                target: kota.kode,
                set: {
                  nama: k.name,
                  kodeProvinsi: k.province_id,
                },
              });
          }
        }
      } catch (err) {
        console.warn(`[SyncMaster] Failed to fetch kota for prov ${prov.kode_provinsi}`, err);
      }
    }

    // 2. Fetch and Sync Komoditas
    console.log('[SyncMaster] Fetching komoditas master...');
    const komRes = await fetch(
      `${SP2KP_BASE_URL}/master/api/komoditas?take=1000000&is_active=true`,
    );
    if (!komRes.ok) throw new Error(`Failed to fetch komoditas: ${komRes.statusText}`);
    const komJson = (await komRes.json()) as any;
    const komList = komJson.data || komJson;

    console.log(`[SyncMaster] Found ${komList.length} komoditas. Syncing to DB...`);
    for (const kom of komList) {
      await db
        .insert(komoditas)
        .values({
          id: kom.id,
          kode: kom.kode,
          nama: kom.nama,
          tipeKomoditasId: kom.tipe_komoditas_id ?? 1,
          isActive: kom.is_active ?? true,
        })
        .onConflictDoUpdate({
          target: komoditas.id,
          set: {
            kode: kom.kode,
            nama: kom.nama,
            tipeKomoditasId: kom.tipe_komoditas_id ?? 1,
            isActive: kom.is_active ?? true,
          },
        });
    }

    // 3. Fetch and Sync Variants & Satuan
    console.log('[SyncMaster] Fetching variants and satuan master...');
    const varRes = await fetch(`${SP2KP_BASE_URL}/master/api/variant?take=1000000&is_active=true`);
    if (!varRes.ok) throw new Error(`Failed to fetch variants: ${varRes.statusText}`);
    const varJson = (await varRes.json()) as any;
    const varList = varJson.data || varJson;

    console.log(`[SyncMaster] Found ${varList.length} variants. Syncing to DB...`);
    for (const v of varList) {
      // Sync Satuan first if present
      if (v.satuan_id || v.satuan) {
        const satId = v.satuan_id ?? v.satuan?.id;
        const satDisplay = v.satuan?.display ?? v.satuan?.nama ?? 'pcs';
        await db
          .insert(satuan)
          .values({
            id: satId,
            display: satDisplay,
            deskripsi: v.satuan?.deskripsi || null,
          })
          .onConflictDoUpdate({
            target: satuan.id,
            set: {
              display: satDisplay,
              deskripsi: v.satuan?.deskripsi || null,
            },
          });
      }

      // Sync Variant
      await db
        .insert(variant)
        .values({
          id: v.id,
          kode: v.kode,
          komoditasId: v.komoditas_id,
          nama: v.nama,
          satuanId: v.satuan_id ?? v.satuan?.id,
          hargaMin: v.harga_min ? Number(v.harga_min) : null,
          hargaMax: v.harga_max ? Number(v.harga_max) : null,
          kenaikanMax: v.kenaikan_max ? Number(v.kenaikan_max) : null,
          penurunanMax: v.penurunan_max ? Number(v.penurunan_max) : null,
          coicop7: v.coicop_7 || null,
          coicop10: v.coicop_10 || null,
        })
        .onConflictDoUpdate({
          target: variant.id,
          set: {
            kode: v.kode,
            komoditasId: v.komoditas_id,
            nama: v.nama,
            satuanId: v.satuan_id ?? v.satuan?.id,
            hargaMin: v.harga_min ? Number(v.harga_min) : null,
            hargaMax: v.harga_max ? Number(v.harga_max) : null,
            kenaikanMax: v.kenaikan_max ? Number(v.kenaikan_max) : null,
            penurunanMax: v.penurunan_max ? Number(v.penurunan_max) : null,
            coicop7: v.coicop_7 || null,
            coicop10: v.coicop_10 || null,
          },
        });

      // Sync Produk if nested in variant
      if (v.produk && Array.isArray(v.produk)) {
        for (const prod of v.produk) {
          await db
            .insert(produk)
            .values({
              id: prod.id,
              kode: prod.kode || null,
              variantId: v.id,
              nama: prod.nama,
              satuanId: prod.satuan_id ?? v.satuan_id,
            })
            .onConflictDoUpdate({
              target: produk.id,
              set: {
                kode: prod.kode || null,
                variantId: v.id,
                nama: prod.nama,
                satuanId: prod.satuan_id ?? v.satuan_id,
              },
            });
        }
      }
    }

    // 4. Fetch and Sync Pasar (along with dynamic Kota creation)
    console.log('[SyncMaster] Fetching pasar master...');
    const pasarRes = await fetch(`${SP2KP_BASE_URL}/master/api/pasar?take=1000000&is_active=true`);
    if (!pasarRes.ok) throw new Error(`Failed to fetch pasar: ${pasarRes.statusText}`);
    const pasarJson = (await pasarRes.json()) as any;
    const pasarList = pasarJson.data || pasarJson;

    console.log(`[SyncMaster] Found ${pasarList.length} pasar. Syncing cities & markets to DB...`);
    for (const p of pasarList) {
      const cleanProv =
        p.kode_provinsi && p.kode_provinsi.trim() !== '' ? p.kode_provinsi.trim() : null;
      const cleanKota =
        p.kode_kab_kota && p.kode_kab_kota.trim() !== '' ? p.kode_kab_kota.trim() : null;

      // Dynamic Kota validation and insertion
      if (cleanKota && cleanProv) {
        await db
          .insert(kota)
          .values({
            kode: cleanKota,
            nama: p.nama_kab_kota || p.kab_kota?.nama || 'Kab/Kota',
            kodeProvinsi: cleanProv,
          })
          .onConflictDoNothing();
      }

      // Sync Pasar
      await db
        .insert(pasar)
        .values({
          id: p.id,
          kode: p.kode || null,
          nama: p.nama,
          kodeProvinsi: cleanProv,
          kodeKabKota: cleanKota,
          lat: p.lat || null,
          lon: p.lon || null,
          tipePasarId: p.tipe_pasar_id || null,
          kelompok: p.kelompok || null,
          isActive: p.is_active ?? true,
          isNasional: p.is_nasional ?? false,
        })
        .onConflictDoUpdate({
          target: pasar.id,
          set: {
            kode: p.kode || null,
            nama: p.nama,
            kodeProvinsi: cleanProv,
            kodeKabKota: cleanKota,
            lat: p.lat || null,
            lon: p.lon || null,
            tipePasarId: p.tipe_pasar_id || null,
            kelompok: p.kelompok || null,
            isActive: p.is_active ?? true,
            isNasional: p.is_nasional ?? false,
          },
        });
    }

    const duration = Date.now() - startTime;
    console.log(`[SyncMaster] Master sync completed successfully in ${duration}ms.`);
    return { success: true, durationMs: duration };
  } catch (error: any) {
    console.error('[SyncMaster] Master sync failed:', error);
    throw error;
  }
}
