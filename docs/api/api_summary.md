# SP2KP Kemendag API Map (Fetched via Playwright)

Berikut adalah daftar API endpoint yang berhasil ditangkap dari domain **api-sp2kp.kemendag.go.id**:

| Method | Path | Parameter / Query (Contoh) | Deskripsi Respon (Preview) |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/intranet` | `-` | 204 No Content |
| **GET** | `/master/api/variant` | `{"take":"10000000000000000000","is_active":"true","sort":"[{\"selector\":\"nama\",\"desc\":false}]"}` | 200 OK (length: 2683567)<br>Object with data list, e.g., keys: `id, created_at, updated_at, tipe_komoditas_id, tipe_komoditas, kode, kode_old, komoditas_id, komoditas, nama, kode_kbki, nama_kbki_bps, deskripsi, is_nasional, is_active, qty, harga_min, harga_max, kenaikan_max, penurunan_max, satuan_id, satuan, order, produk, order_public, is_public, coicop_7, coicop_10` |
| **GET** | `/report/api/latest-price-dates` | `{"tipe_komoditas_id":"1"}` | 200 OK (length: 127)<br>Object with keys: `status, message, data` |
| **GET** | `/api/satudata` | `-` | 204 No Content |
| **GET** | `/master/api/komoditas` | `{"take":"1000000000","sort":"[{\"selector\":\"order\",\"desc\":false}]","tipe_komoditas_id":"1","is_active":"true"}` | 200 OK (length: 2557394)<br>Object with data list, e.g., keys: `created_at, deskripsi, id, is_active, is_public, kode, kode_old, nama, order, order_komoditas, produk, sequence, tipe_komoditas, tipe_komoditas_id, updated_at, variants` |
| **POST** | `/report/api/average-price/generate-perbandingan-harga` | `Query: -<br>Payload: "------geckoformboundaryfcd0e5838249a444cd6b069f70d93476\r\nContent-Disposition: form-data; name=\"tanggal\"\r\n\r\n2026-06-09\r\n------geckoformboundaryfcd0e5838249a444cd6b069f70d93476\r\nContent-Disposition: form-data; name=\"tanggal_pembanding\"\r\n\r\n2026-06-08\r\n------geckoformboundaryfcd0e5838249a444cd6b069f70d93476--\r\n"` | - |
| **GET** | `/master/api/wilayah/provinsi` | `-` | 200 OK (length: 4084)<br>Object with data list, e.g., keys: `kode_provinsi, nama_provinsi, nama_singkat_provinsi, wilayah` |
| **GET** | `/master/api/komoditas/41` | `-` | 200 OK (length: 3882)<br>Object with keys: `status, message, data` |
| **GET** | `/report/api/average-price/province-comparison` | `{"variant_id":"52","tanggal":"2026-06-09"}` | 200 OK (length: 5248)<br>Object with keys: `status, message, data` |
| **GET** | `/report/api/het-ha/latest` | `{"variant_id":"52","tanggal":"2026-06-09"}` | 200 OK (length: 5847)<br>Object with keys: `status, message, data` |
| **GET** | `/report/api/average-price/hnt-disparity` | `{"variant_id":"52","tanggal":"2026-06-09"}` | 200 OK (length: 3972)<br>Object with keys: `status, message, data` |
| **GET** | `/report/api/average-price/generate-perbandingan-harga` | `-` | 200 OK (length: 6221)<br>Object with data list, e.g., keys: `variant_id, variant_nama, satuan_display, tanggal, harga, tanggal_pembanding, harga_pembanding, delta_harga, persen_perubahan, status_perubahan, is_regional, region` |
| **GET** | `/report/api/hnt/history-series` | `{"tanggal_start":"2026-05-10","tanggal_end":"2026-06-09","variant_id":"52"}` | 200 OK (length: 820)<br>Object with data list, e.g., keys: `tanggal_data, harga` |
