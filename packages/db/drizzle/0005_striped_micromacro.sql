CREATE TABLE IF NOT EXISTS "neraca_pangan_provinsi" (
	"id" integer PRIMARY KEY NOT NULL,
	"kode_provinsi" varchar(10) NOT NULL,
	"komoditas_id" integer NOT NULL,
	"status_neraca" varchar(20) DEFAULT 'seimbang' NOT NULL,
	"implikasi_intervensi" text,
	"tahun_data" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "jenis_threshold" varchar(20) DEFAULT 'tidak_diatur';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "neraca_pangan_provinsi" ADD CONSTRAINT "neraca_pangan_provinsi_kode_provinsi_provinsi_kode_fk" FOREIGN KEY ("kode_provinsi") REFERENCES "public"."provinsi"("kode") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "neraca_pangan_provinsi" ADD CONSTRAINT "neraca_pangan_provinsi_komoditas_id_komoditas_id_fk" FOREIGN KEY ("komoditas_id") REFERENCES "public"."komoditas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "neraca_pangan_prov_kom_idx" ON "neraca_pangan_provinsi" ("kode_provinsi","komoditas_id");