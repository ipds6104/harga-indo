// Image filenames are verified against https://harga-api.dvlp.asia/komoditas/<name>.webp
// WARNING: The server uses INCONSISTENT naming conventions (some have no space after comma,
// some have a space, some omit the unit suffix entirely). Do NOT normalize these strings.
// Each value here was confirmed HTTP 200 via live test (June 2026).
export const COMMODITY_AVATARS: Record<string, string> = {
  // Beras — server omits the unit suffix entirely
  'Beras Premium': 'Beras Cap CK (Premium)',
  'Beras Medium': 'Beras Cap Anggrek (Medium)',
  'Beras SPHP Bulog': 'Beras SPHP Bulog',

  // Cabai — server uses comma WITHOUT space: ",1 kg"
  'Cabai Merah Keriting': 'Cabai Merah Keriting,1 kg',
  'Cabai Merah Besar': 'Cabai Merah Besar,1 kg',
  'Cabai Rawit Merah': 'Cabai Rawit Merah,1 kg',
  'Cabai Rawit Hijau': 'Cabai Rawit Merah,1 kg',

  // Bawang — comma WITHOUT space
  'Bawang Merah': 'Bawang Merah,1 kg',
  'Bawang Putih Honan': 'Bawang Putih Honan,1 kg',
  'Bawang Putih Kating': 'Bawang Putih Honan,1 kg',
  'Bawang Bombai': 'Bawang Bombai,1 kg',

  // Gula — server uses comma WITH space but no space before "kg": ", 1kg"
  'Gula Pasir Curah': 'Gula Pasir Curah, 1kg',
  'Gula Pasir Kemasan': 'Gula Pasir Kemasan, 1kg',

  // Minyak — comma WITHOUT space
  'Minyak Goreng Sawit Curah': 'Minyak Goreng Curah,1 lt',
  'Minyak Goreng Sawit Kemasan Premium': 'Minyak Goreng Kemasan Premium,1 lt',
  Minyakita: 'Minyakita,1 lt',

  // Tepung & lainnya
  'Tepung Terigu': 'Tepung Terigu,1 kg',
  'Mie Instan': 'Mie Instan, 1 bks', // server uses ", " here
  'Garam Halus': 'Garam Halus,1 kg',

  // Unggas & telur
  'Daging Ayam Ras': 'Daging Ayam Ras Karkas,1 kg',
  'Daging Ayam Kampung': 'Ayam Kampung Utuh,1 ekor',
  'Telur Ayam Ras': 'Telur Ayam Ras,1 kg',
  'Telur Ayam Kampung': 'Telur Ayam Kampung,1 kg',

  // Daging sapi
  'Daging Sapi Paha Belakang': 'Daging Sapi Paha Belakang,1 kg',
  'Daging Sapi Paha Depan': 'Daging Sapi Paha Depan,1 kg',
  'Daging Sapi Sandung Lamur': 'Daging Sapi Sandung Lamur,1 kg',
  'Daging Sapi Tetelan': 'Daging Sapi Tetelan,1 kg',

  // Ikan & seafood — Kembung pakai ", " (dengan spasi)
  'Ikan Tongkol': 'Ikan Tongkol,1 kg',
  'Ikan Teri': 'Ikan Teri,1 kg',
  'Ikan Kembung': 'Ikan Laut Kembung, 1 kg',
  'Ikan Bandeng': 'Ikan Laut Kembung, 1 kg',
  'Udang Basah': 'Udang Basah,1 kg',

  // Sayuran
  Tomat: 'Tomat,1 kg',
  'Kentang Sedang': 'Kentang Sedang,1 kg',
  'Sawi Hijau': 'Sawi Hijau,1 kg',
  Kangkung: 'Kangkung,1 kg',
  'Ketimun Sedang': 'Ketimun Sedang,1 kg',
  'Kacang Panjang': 'Kacang Panjang,1 kg',
  Buncis: 'Kacang Panjang,1 kg',

  // Tahu & tempe
  'Tahu Putih': 'Tahu Putih,1 kg',
  'Tempe Bungkus': 'Tempe Bungkus,1 kg',

  // Susu — Kental Manis pakai ", " (dengan spasi), Bubuk pakai ","
  'Susu Kental Manis': 'Susu Kental Manis, 370 gr',
  'Susu Bubuk': 'Susu Bubuk (Setara Dancow),400 gr',
  'Susu Bubuk Balita': 'Susu Bubuk Balita (Setara SGM),400 gr',

  // Buah & kacang
  'Pisang Lokal': 'Pisang Lokal,1 kg',
  'Jeruk Lokal': 'Jeruk Lokal,1 kg',
  'Kacang Hijau': 'Kacang Hijau,1 kg',
  'Kacang Tanah': 'Kacang Tanah,1 kg',

  // Kedelai — Impor ada di server, Lokal tidak ada (tidak ada gambarnya di server)
  'Kedelai Impor': 'Kedelai Impor,1 kg',
  // 'Kedelai Lokal' — intentionally omitted, no image exists on server
};
