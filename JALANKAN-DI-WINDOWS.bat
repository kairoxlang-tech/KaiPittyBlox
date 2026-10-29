@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo  KaiPittyBlox - Menjalankan website lokal
echo ========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang.
  echo Install Node.js versi 20 atau lebih baru dari https://nodejs.org/
  echo Setelah instalasi, tutup dan buka lagi file BAT ini.
  pause
  exit /b 1
)
if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo File .env dibuat dari .env.example.
  ) else (
    echo File .env dan .env.example tidak ditemukan.
    pause
    exit /b 1
  )
)
findstr /R /C:"^MIDTRANS_SERVER_KEY=..*" .env >nul
if errorlevel 1 (
  echo.
  echo Konfigurasi pembayaran Midtrans Sandbox diperlukan untuk QRIS.
  echo Ambil Server Key dari dashboard Midtrans Sandbox. Jangan gunakan Client Key.
  set /p "MIDTRANS_KEY=Tempel Server Key Sandbox di sini: "
  if "%MIDTRANS_KEY%"=="" (
    echo Server Key kosong. Website tetap dapat berjalan, tetapi QRIS tidak aktif.
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='.env'; $k=$env:MIDTRANS_KEY; $c=Get-Content -Raw $p; if ($c -match '(?m)^MIDTRANS_SERVER_KEY=.*$') { $c=[regex]::Replace($c,'(?m)^MIDTRANS_SERVER_KEY=.*$',('MIDTRANS_SERVER_KEY='+$k)) } else { $c += [Environment]::NewLine+'MIDTRANS_SERVER_KEY='+$k }; [IO.File]::WriteAllText((Resolve-Path $p),$c,[Text.UTF8Encoding]::new($false))"
    if errorlevel 1 (
      echo Gagal menyimpan konfigurasi Midtrans.
      pause
      exit /b 1
    )
    echo Server Key tersimpan di .env lokal.
  )
)
if not exist node_modules (
  echo Mengunduh dependensi backend. Ini hanya dilakukan pertama kali...
  call npm install
  if errorlevel 1 (
    echo Instalasi gagal. Periksa koneksi internet dan coba lagi.
    pause
    exit /b 1
  )
)
echo Website akan dibuka di http://localhost:3000
echo Jangan tutup jendela ini selama website digunakan.
start "" http://localhost:3000
call npm start
pause
