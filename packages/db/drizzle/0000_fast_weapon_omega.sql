CREATE TABLE IF NOT EXISTS "ai_insights" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tanggal" varchar(10) NOT NULL,
	"kode_provinsi" varchar(10),
	"komoditas_id" integer,
	"tipe" varchar(50) NOT NULL,
	"konten_json" text NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "harga_harian" (
	"id" integer PRIMARY KEY NOT NULL,
	"pasar_id" integer NOT NULL,
	"komoditas_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"produk_id" integer NOT NULL,
	"satuan_id" integer NOT NULL,
	"tanggal" varchar(10) NOT NULL,
	"harga" double precision NOT NULL,
	"harga_sebelumnya" double precision NOT NULL,
	"prosentase_perubahan" double precision NOT NULL,
	"kuantitas" double precision,
	"pasokan" double precision,
	"jumlah_pedagang" integer NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL,
	"kode_kab_kota" varchar(10) NOT NULL,
	"status_verifikasi_1" varchar(10),
	"verifikasi_1_at" timestamp,
	"status_verifikasi_2" varchar(10),
	"verifikasi_2_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_harga_still_zero" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "harga_harian_detail" (
	"id" integer PRIMARY KEY NOT NULL,
	"harga_harian_id" integer NOT NULL,
	"pedagang_id" integer NOT NULL,
	"harga" double precision NOT NULL,
	"harga_sebelumnya" double precision NOT NULL,
	"tanggal_sebelumnya" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_log" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"run_id" varchar(36) NOT NULL,
	"tanggal_fetch" varchar(10) NOT NULL,
	"pasar_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "komoditas" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode" varchar(50),
	"nama" varchar(255) NOT NULL,
	"tipe_komoditas_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kota" (
	"kode" varchar(10) PRIMARY KEY NOT NULL,
	"nama" varchar(100) NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pasar" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode" varchar(50),
	"nama" varchar(255) NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL,
	"kode_kab_kota" varchar(10) NOT NULL,
	"lat" varchar(50),
	"lon" varchar(50),
	"tipe_pasar_id" integer,
	"kelompok" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_nasional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedagang" (
	"id" integer PRIMARY KEY NOT NULL,
	"nama" varchar(255) NOT NULL,
	"telepon" varchar(50),
	"pasar_id" integer NOT NULL,
	"lantai" varchar(50),
	"nomor_los" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "produk" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode" varchar(50),
	"variant_id" integer NOT NULL,
	"nama" varchar(255) NOT NULL,
	"satuan_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provinsi" (
	"kode" varchar(10) PRIMARY KEY NOT NULL,
	"nama" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "satuan" (
	"id" integer PRIMARY KEY NOT NULL,
	"display" varchar(50) NOT NULL,
	"deskripsi" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "variant" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode" varchar(50),
	"komoditas_id" integer NOT NULL,
	"nama" varchar(255) NOT NULL,
	"satuan_id" integer NOT NULL,
	"harga_min" double precision,
	"harga_max" double precision,
	"kenaikan_max" double precision,
	"penurunan_max" double precision,
	"coicop_7" varchar(50),
	"coicop_10" varchar(50)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_pasar_id_pasar_id_fk" FOREIGN KEY ("pasar_id") REFERENCES "public"."pasar"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_produk_id_produk_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."produk"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_satuan_id_satuan_id_fk" FOREIGN KEY ("satuan_id") REFERENCES "public"."satuan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian" ADD CONSTRAINT "harga_harian_kode_kab_kota_kota_kode_fk" FOREIGN KEY ("kode_kab_kota") REFERENCES "public"."kota"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian_detail" ADD CONSTRAINT "harga_harian_detail_harga_harian_id_harga_harian_id_fk" FOREIGN KEY ("harga_harian_id") REFERENCES "public"."harga_harian"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harga_harian_detail" ADD CONSTRAINT "harga_harian_detail_pedagang_id_pedagang_id_fk" FOREIGN KEY ("pedagang_id") REFERENCES "public"."pedagang"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingestion_log" ADD CONSTRAINT "ingestion_log_pasar_id_pasar_id_fk" FOREIGN KEY ("pasar_id") REFERENCES "public"."pasar"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kota" ADD CONSTRAINT "kota_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pasar" ADD CONSTRAINT "pasar_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pasar" ADD CONSTRAINT "pasar_kode_kab_kota_kota_kode_fk" FOREIGN KEY ("kode_kab_kota") REFERENCES "public"."kota"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedagang" ADD CONSTRAINT "pedagang_pasar_id_pasar_id_fk" FOREIGN KEY ("pasar_id") REFERENCES "public"."pasar"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "produk" ADD CONSTRAINT "produk_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "produk" ADD CONSTRAINT "produk_satuan_id_satuan_id_fk" FOREIGN KEY ("satuan_id") REFERENCES "public"."satuan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variant" ADD CONSTRAINT "variant_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variant" ADD CONSTRAINT "variant_satuan_id_satuan_id_fk" FOREIGN KEY ("satuan_id") REFERENCES "public"."satuan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harga_harian_pasar_tanggal_idx" ON "harga_harian" ("pasar_id","tanggal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harga_harian_provinsi_tanggal_idx" ON "harga_harian" ("kode_provinsi","tanggal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harga_harian_variant_tanggal_idx" ON "harga_harian" ("variant_id","tanggal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harga_detail_harga_harian_idx" ON "harga_harian_detail" ("harga_harian_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harga_detail_pedagang_idx" ON "harga_harian_detail" ("pedagang_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_log_run_id_idx" ON "ingestion_log" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_log_tanggal_status_idx" ON "ingestion_log" ("tanggal_fetch","status");