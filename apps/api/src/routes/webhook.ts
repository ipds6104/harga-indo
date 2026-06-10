import { db, hargaHarian, komoditas, pasar, satuan, variant } from '@harga/db';
import { eq, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { evaluatePrice } from '../../../worker/src/services/alert-evaluator';

export const webhookRoutes = new Elysia({ prefix: '/api/webhook' })
  // Handle WhatsApp & Telegram bot webhook payloads
  .post(
    '/messaging',
    async ({ body, error }) => {
      const { sender, message } = body;
      console.log(`[Webhook] Received message from ${sender}: "${message}"`);

      // Parse commands in format: /input <pasar_nama> <komoditas_nama> <harga>
      // Example: /input Mempawah Beras 14500
      if (!message.startsWith('/input')) {
        return {
          success: false,
          reason: 'Command not recognized. Use /input [pasar] [komoditas] [harga]',
        };
      }

      const parts = message.split(' ');
      if (parts.length < 4) {
        return {
          success: false,
          reason: 'Incorrect parameters. Use: /input [pasar] [komoditas] [harga]',
        };
      }

      const pasarQuery = parts[1].replace(/_/g, ' ');
      const komoditasQuery = parts[2].replace(/_/g, ' ');
      const hargaVal = Number(parts[3]);

      if (Number.isNaN(hargaVal) || hargaVal <= 0) {
        return { success: false, reason: 'Invalid price value. Price must be a positive number.' };
      }

      try {
        // 1. Search for matching market (case insensitive)
        const markets = await db
          .select()
          .from(pasar)
          .where(sql`LOWER(${pasar.nama}) LIKE ${`%${pasarQuery.toLowerCase()}%`}`)
          .limit(1);

        if (markets.length === 0) {
          return { success: false, reason: `Market matching "${pasarQuery}" was not found.` };
        }
        const matchedPasar = markets[0];

        // 2. Search for matching variant or commodity
        const variants = await db
          .select()
          .from(variant)
          .where(sql`LOWER(${variant.nama}) LIKE ${`%${komoditasQuery.toLowerCase()}%`}`)
          .limit(1);

        if (variants.length === 0) {
          return {
            success: false,
            reason: `Commodity variant matching "${komoditasQuery}" was not found.`,
          };
        }
        const matchedVariant = variants[0];

        // Fetch primary commodity id
        const koms = await db
          .select()
          .from(komoditas)
          .where(eq(komoditas.id, matchedVariant.komoditasId))
          .limit(1);
        const matchedKomoditas = koms[0];
        if (!matchedKomoditas) {
          return { success: false, reason: 'Parent commodity specifications not found.' };
        }

        const tanggal = new Date().toISOString().split('T')[0];

        // Generate a deterministic ID for mock transaction entries
        const deterministicId = Math.floor(Math.random() * 2147483647);

        // 3. Save supplementary price record
        await db
          .insert(hargaHarian)
          .values({
            id: deterministicId,
            pasarId: matchedPasar.id,
            komoditasId: matchedKomoditas.id,
            variantId: matchedVariant.id,
            produkId: matchedVariant.id, // fallback duplicate
            satuanId: matchedVariant.satuanId,
            tanggal,
            harga: hargaVal,
            hargaSebelumnya: hargaVal,
            prosentasePerubahan: 0,
            jumlahPedagang: 5, // mock sample size
            kodeProvinsi: matchedPasar.kodeProvinsi,
            kodeKabKota: matchedPasar.kodeKabKota,
          })
          .onConflictDoUpdate({
            target: hargaHarian.id,
            set: { harga: hargaVal },
          });

        console.log(
          `[Webhook] Inserted supplementary price report via chatbot: ${matchedVariant.nama} at ${matchedPasar.nama} = Rp${hargaVal}`,
        );

        // 4. Trigger alert evaluation state machine directly
        const alertEval = await evaluatePrice({
          tanggal,
          kodeProvinsi: matchedPasar.kodeProvinsi || '31',
          kodeKabKota: matchedPasar.kodeKabKota || '',
          komoditasId: matchedKomoditas.id,
          variantId: matchedVariant.id,
          hargaRataRata: hargaVal,
          jumlahPedagang: 5,
        });

        let responseText = `Berhasil mengupdate harga ${matchedVariant.nama} di ${matchedPasar.nama} menjadi Rp${hargaVal.toLocaleString('id-ID')}.`;
        if (alertEval.alertCreated && alertEval.status === 'cooldown') {
          responseText +=
            ' [ALERT DETECTED] Gejolak harga terdeteksi, alert masuk masa Cooldown (masa tunggu 3 hari).';
        }

        return {
          success: true,
          responseText,
          market: matchedPasar.nama,
          commodity: matchedVariant.nama,
          price: hargaVal,
          alertEvaluated: true,
          alertStatus: alertEval.status || 'normal',
        };
      } catch (err: any) {
        console.error('[Webhook] Error saving supplementary price report:', err.message);
        return error(500, `Internal error processing report: ${err.message}`);
      }
    },
    {
      body: t.Object({
        sender: t.String(),
        message: t.String(),
      }),
    },
  );
