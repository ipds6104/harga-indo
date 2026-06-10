ALTER TABLE "harga_harian" ALTER COLUMN "kode_provinsi" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "harga_harian" ALTER COLUMN "kode_kab_kota" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pasar" ALTER COLUMN "kode_provinsi" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pasar" ALTER COLUMN "kode_kab_kota" DROP NOT NULL;