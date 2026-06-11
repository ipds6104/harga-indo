/**
 * Test script: verifikasi dynamic context service
 * Jalankan: bun run tools/test-dynamic-context.ts
 */
import { getDynamicContext } from '../apps/worker/src/services/dynamic-context';

const tanggalHariIni = new Date().toISOString().split('T')[0];

console.log(`\n=== Test getDynamicContext untuk tanggal: ${tanggalHariIni} ===\n`);

const ctx = await getDynamicContext(tanggalHariIni);

console.log('📅 Hari Raya Terdekat:');
if (ctx.hariRayaTerdekat) {
  console.log(`  → ${ctx.hariRayaTerdekat.nama}`);
  console.log(`  → Tanggal: ${ctx.hariRayaTerdekat.tanggal}`);
  if (ctx.hariRayaTerdekat.hariLagi <= 0) {
    console.log(`  → Status: SEDANG BERLANGSUNG (${Math.abs(ctx.hariRayaTerdekat.hariLagi)} hari pasca hari H)`);
  } else {
    console.log(`  → H-${ctx.hariRayaTerdekat.hariLagi} hari lagi`);
  }
  console.log(`  → isMusimRaya: ${ctx.hariRayaTerdekat.isMusimRaya}`);
} else {
  console.log('  → Tidak ada hari raya besar dalam 90 hari ke depan');
}

console.log('\n🗓️  Semua Hari Raya dalam 90 Hari ke Depan:');
ctx.hariRayaBesar.forEach((h) => {
  console.log(`  → [H-${h.hariLagi.toString().padStart(3)}] ${h.tanggal} — ${h.nama}`);
});

console.log('\n🌿 Kondisi Musim:');
console.log(`  → Musim Kemarau: ${ctx.musim.musimKemarau}`);
console.log(`  → Panen Beras: ${ctx.musim.musimPanen.beras}`);
console.log(`  → Panen Cabai: ${ctx.musim.musimPanen.cabai}`);
console.log(`  → Panen Bawang Merah: ${ctx.musim.musimPanen.bawangMerah}`);
console.log(`  → Keterangan: ${ctx.musim.keterangan}`);

console.log('\n💱 Kurs USD/IDR:');
if (ctx.kurs.usdIdr > 0) {
  console.log(`  → USD/IDR: Rp${ctx.kurs.usdIdr.toLocaleString('id-ID')}`);
  console.log(`  → Tanggal Data: ${ctx.kurs.tanggal}`);
  console.log(`  → Level: ${ctx.kurs.level}`);
  console.log(`  → Dampak: ${ctx.kurs.dampakImport}`);
} else {
  console.log('  → Data kurs tidak tersedia (fallback mode)');
}

console.log('\n📝 Ringkasan Konteks untuk AI Prompt:');
console.log('─'.repeat(80));
console.log(ctx.ringkasan);
console.log('─'.repeat(80));

console.log('\n✅ Dynamic context service berjalan normal.\n');
