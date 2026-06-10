CREATE TABLE IF NOT EXISTS "pihps_harga_harian" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL,
	"komoditas_id" integer NOT NULL,
	"tanggal" varchar(10) NOT NULL,
	"harga" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentra_produksi" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL,
	"kode_kab_kota" varchar(10),
	"komoditas_id" integer NOT NULL,
	"surplus_tep" double precision NOT NULL,
	"lat" varchar(50),
	"lon" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tpid_action_log" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"alert_id" varchar(36) NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(30) NOT NULL,
	"catatan" text,
	"rekomendasi_aksi" text,
	"digital_signature" text,
	"hash_record" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tpid_alert" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tanggal" varchar(10) NOT NULL,
	"kode_provinsi" varchar(10),
	"kode_kab_kota" varchar(10),
	"komoditas_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"harga_rata_rata" double precision NOT NULL,
	"threshold_hap" double precision NOT NULL,
	"z_score" double precision NOT NULL,
	"jumlah_pedagang" integer NOT NULL,
	"cooldown_end_tanggal" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tpid_user" (
	"id" integer PRIMARY KEY NOT NULL,
	"nama" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pihps_harga_harian" ADD CONSTRAINT "pihps_harga_harian_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pihps_harga_harian" ADD CONSTRAINT "pihps_harga_harian_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentra_produksi" ADD CONSTRAINT "sentra_produksi_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentra_produksi" ADD CONSTRAINT "sentra_produksi_kode_kab_kota_kota_kode_fk" FOREIGN KEY ("kode_kab_kota") REFERENCES "public"."kota"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentra_produksi" ADD CONSTRAINT "sentra_produksi_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_action_log" ADD CONSTRAINT "tpid_action_log_alert_id_tpid_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."tpid_alert"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_action_log" ADD CONSTRAINT "tpid_action_log_user_id_tpid_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tpid_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_alert" ADD CONSTRAINT "tpid_alert_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_alert" ADD CONSTRAINT "tpid_alert_kode_kab_kota_kota_kode_fk" FOREIGN KEY ("kode_kab_kota") REFERENCES "public"."kota"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_alert" ADD CONSTRAINT "tpid_alert_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tpid_alert" ADD CONSTRAINT "tpid_alert_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pihps_prov_kom_tgl_idx" ON "pihps_harga_harian" ("kode_provinsi","komoditas_id","tanggal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tpid_action_log_alert_idx" ON "tpid_action_log" ("alert_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tpid_alert_status_idx" ON "tpid_alert" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tpid_alert_tanggal_idx" ON "tpid_alert" ("tanggal");