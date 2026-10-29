KaiPittyBlox — paket perbaikan

Isi ZIP ini mencakup backend Node.js dan frontend website yang sudah dirapikan.

Perubahan utama:
- Halaman Cek Pesanan kini bisa mencari status berdasarkan ID pesanan.
- Tampilan metode pembayaran ditambah label/logo visual QRIS, BCA, BRI, BNI, dan Mandiri.
- Keterangan transfer bank menjelaskan bahwa transfer masih manual dan harus menunggu instruksi admin.
- Halaman checkout dan alur kembali dari Midtrans diberi petunjuk yang lebih jelas.
- Syntax backend diperiksa dengan node --check.

PENTING:
- File .env sengaja tidak disertakan. Simpan file .env lokal milikmu di folder project setelah mengekstrak ZIP ini. Jangan bagikan MIDTRANS_SERVER_KEY atau ADMIN_TOKEN.
- Jangan hapus atau timpa database asli tanpa backup. ZIP ini membawa salinan database yang ada saat diunggah.
- QRIS tetap menggunakan konfigurasi Midtrans Sandbox dan memerlukan webhook/notifikasi Midtrans menuju https://DOMAIN-KAMU/api/midtrans/notification agar status diperbarui otomatis. localhost tidak dapat menerima notifikasi dari Midtrans di internet tanpa tunnel atau URL publik.
- Transfer bank hanya tampilan/logo; belum terhubung ke Virtual Account Midtrans atau rekening tertentu. Jangan menerima order seolah-olah otomatis sebelum metode tersebut dikonfigurasi.
- Setelah ekstrak, pastikan .env ada, lalu jalankan JALANKAN-DI-WINDOWS.bat. Jika node_modules tidak ada, script akan menjalankan npm install.
