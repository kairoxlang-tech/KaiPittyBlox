# KaiPittyBlox — Website + Backend terhubung

Paket ini berisi website KaiPittyBlox dan backend API yang menyimpan pesanan ke database SQLite.

## Cara paling gampang (Windows)
1. Ekstrak ZIP ini ke folder biasa.
2. Install **Node.js 20 atau lebih baru** dari https://nodejs.org/ jika belum ada.
3. Klik dua kali `JALANKAN-DI-WINDOWS.bat`.
4. Tunggu instalasi selesai. Website dibuka di `http://localhost:3000`.
5. Biarkan jendela hitam/terminal tetap terbuka selama website dipakai.

Jangan buka `public/index.html` dengan klik dua kali. Buka website lewat `http://localhost:3000` supaya formulir bisa menghubungi backend.

## Yang sudah tersambung
- Form **Robux via Username** dan **Top Up Roblox via Login** masuk ke halaman checkout.
- Saat metode pembayaran dipilih dan tombol konfirmasi diklik, backend membuat ID pesanan asli dan menyimpan order ke `data/kaipittyblox.sqlite`.
- Harga ditentukan backend; nilai harga yang dikirim browser tidak dipercaya.
- Pesanan tersimpan dengan status `pending_payment` dan metode pilihan QRIS/transfer/metode lain.
- API status order: `GET /api/orders/ID-PESANAN`.
- Katalog server: `GET /api/catalog`.
- Pemeriksaan server: `GET /api/health`.

## Yang belum otomatis
- QRIS/payment gateway belum diintegrasikan. Pilihan QRIS saat ini hanya preferensi metode, bukan kode QR pembayaran.
- Pembayaran belum diverifikasi otomatis. Jangan tandai pesanan lunas hanya berdasarkan klaim pembeli.
- Nomor WhatsApp toko masih kosong di `public/index.html` pada `STORE_WHATSAPP`. Isi dengan nomor format internasional tanpa `+` atau spasi, contoh `6281234567890`, supaya chat konfirmasi bisa dibuka.
- Form gamepass/layanan lain yang tidak memakai dua formulir di atas belum terhubung ke pembuatan order API.
- Endpoint admin API tersedia tetapi belum ada dashboard admin visual.

## Menyiapkan akses admin API
1. Salin `.env.example` menjadi `.env`.
2. Isi `ADMIN_TOKEN` dengan string rahasia acak minimal 32 karakter. Jangan pernah menaruh token ini di HTML atau membagikannya ke pembeli.
3. Restart server setelah mengubah `.env`.
4. Endpoint admin: `GET /api/admin/orders` dengan header `Authorization: Bearer TOKEN`.
5. Untuk penggunaan publik, deploy di hosting yang mendukung Node.js, gunakan HTTPS, simpan rahasia sebagai environment variables hosting, dan buat autentikasi admin yang layak.

## Catatan harga
Harga yang disetel di backend berasal dari harga yang tampil di website saat paket ini dibuat. Periksa kembali seluruh harga sebelum menerima pesanan sungguhan.

## Keamanan
Website tidak meminta password Roblox, OTP, kode backup, atau cookie. Jangan meminta pelanggan mengirim data tersebut.


## Alur pembayaran QRIS Sandbox (update)
- Tombol yang sebelumnya membuka WhatsApp sekarang menggunakan label **Lanjutkan** dan tidak membuka WhatsApp.
- Pilih QRIS lalu tekan Lanjutkan. Jika Midtrans Sandbox berhasil membuat transaksi, browser akan membuka halaman pembayaran Midtrans; QRIS tampil di sana, bukan di halaman Pesanan Saya.
- Jika QRIS tidak dibuat, periksa `MIDTRANS_SERVER_KEY` di `.env`, pastikan memakai Server Key Sandbox yang baru, lalu tutup dan jalankan ulang `JALANKAN-DI-WINDOWS.bat`. Jangan membagikan key tersebut.
- Setelah kembali dari halaman Midtrans, situs mengarahkan ke `Pesanan Saya`. Ini belum membuktikan pembayaran berhasil; status harus dikonfirmasi oleh notifikasi Midtrans.


## Konfigurasi Midtrans Sandbox (Windows)
Saat menjalankan `JALANKAN-DI-WINDOWS.bat`, jika Server Key belum diisi, skrip akan meminta Server Key Sandbox dan menyimpannya ke `.env` lokal. Jangan bagikan file `.env` atau Server Key. QRIS hanya bisa dibuat jika akun/fitur Midtrans Sandbox dan konfigurasi backend valid.
