#!/usr/bin/env bash

# dev.sh - Hargia Local Dev Runner
# Menjalankan dev server secara aman dan membersihkan proses jika keluar.

set -euo pipefail

# Konfigurasi Port
PORTS=(3005 3010 3020 5173)
COMPOSE_FILE="infra/compose/compose.dev.yaml"

echo "=================================================="
echo "   Hargia - Pembersihan Port & Dev Runner"
echo "=================================================="

# 1. Bersihkan port yang tersangkut (Idempotensi)
for PORT in "${PORTS[@]}"; do
  PID=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "Found process $PID holding port $PORT. Terminating..."
    kill -9 "$PID" 2>/dev/null || true
  fi
done

# 2. Pastikan Docker Dev Services Berjalan
echo "Memeriksa Docker Dev Services (Postgres, Redis)..."
if ! docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
  echo "Docker dev services belum berjalan. Menjalankan..."
  docker compose -f "$COMPOSE_FILE" up -d
else
  echo "Docker dev services terpantau aktif."
fi

# 3. Proses Dev utama
echo "Menjalankan Dev Server dengan Turborepo..."
echo "Gunakan Ctrl+C untuk menghentikan seluruh proses secara bersih."
echo "--------------------------------------------------"

# Variabel untuk menampung PID Turbo
TURBO_PID=""

# Fungsi Pembersihan saat keluar
cleanup() {
  echo ""
  echo "=================================================="
  echo "   Menghentikan seluruh dev server..."
  echo "=================================================="
  
  if [ -n "$TURBO_PID" ]; then
    # Mengirim sinyal TERM ke Turbo parent process
    kill -TERM "$TURBO_PID" 2>/dev/null || true
    # Memaksa kill direct children dari script ini
    pkill -P $$ 2>/dev/null || true
  fi
  
  # Pastikan tidak ada proses port tersisa
  for PORT in "${PORTS[@]}"; do
    PID=$(lsof -t -i:"$PORT" 2>/dev/null || true)
    if [ -n "$PID" ]; then
      kill -9 "$PID" 2>/dev/null || true
    fi
  done
  
  echo "Dev server dihentikan dengan sukses."
  exit 0
}

# Trap INT (Ctrl+C), TERM (kill), dan EXIT
trap cleanup INT TERM EXIT

# Jalankan Turborepo Dev di background
bun run dev &
TURBO_PID=$!

# Tunggu hingga proses background selesai
wait "$TURBO_PID"
