# Mochi & Onigiri — Supabase + Dashboard Admin

Website UMKM dengan katalog, keranjang, checkout, database PostgreSQL online, struk, dan dashboard admin.

## Isi folder
- `index.html`, `style.css`, `app.js`: website pelanggan
- `admin.html`, `admin.css`, `admin.js`: dashboard admin
- `supabase.sql`: skema database, kebijakan keamanan, fungsi checkout, dan seed produk

## 1. Buat project Supabase
1. Buka https://supabase.com/ lalu buat project baru.
2. Catat **Project URL** dan **anon/public key** dari Project Settings > API (nama menu dapat berubah).
3. Jangan gunakan `service_role` / `secret key` di browser atau dibagikan ke siapa pun.

## 2. Buat database
1. Di Supabase, buka SQL Editor > New query.
2. Salin seluruh isi `supabase.sql`, lalu jalankan.
3. Pastikan tabel `products`, `orders`, `order_items`, `admin_users` dan fungsi `create_order` sudah dibuat.
4. Buka Table Editor > `products` untuk memastikan 9 produk tersedia dengan harga yang benar.

## 3. Hubungkan website ke Supabase
Buka **app.js** dan **admin.js**. Pada keduanya, ganti:
```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```
dengan Project URL dan anon/public key milik project kamu. Pakai key yang sama di kedua file.
Ganti `WHATSAPP_NUMBER` di `app.js` dengan nomor WhatsApp admin format internasional tanpa tanda `+`, contoh `6281234567890`.

## 4. Buat akun admin dengan aman
1. Di Supabase buka Authentication > Providers / Sign In settings. **Matikan sign-up publik** jika website hanya perlu satu akun admin. Jika perlu pendaftaran pelanggan, jangan gunakan akun Auth pelanggan sebagai admin.
2. Buka Authentication > Users > Add user, buat email dan password admin.
3. Salin UUID user admin tersebut.
4. Di SQL Editor jalankan, dengan mengganti UUID contoh:
```sql
insert into public.admin_users(user_id)
values ('UUID-USER-ADMIN-DARI-AUTH')
on conflict (user_id) do nothing;
```
5. Login melalui `admin.html`. Jika admin tidak terdaftar di `admin_users`, akses dashboard akan ditolak oleh database.

**Jangan pernah menaruh service_role key di `app.js` atau `admin.js`.** Frontend hanya menggunakan anon/public key; keamanan pesanan diatur dengan RLS dan RPC.

## 5. Jalankan website
- Untuk percobaan lokal, buka folder ini di VS Code dan jalankan `index.html` serta `admin.html` menggunakan ekstensi Live Server.
- Untuk online, unggah semua file HTML/CSS/JS ke hosting statis seperti Netlify atau GitHub Pages. Upload semua file pada folder yang sama.
- Setelah deploy, uji halaman toko dan `/admin.html`.

## 6. Alur kerja
1. Pelanggan pilih produk, atur jumlah, isi nama dan WhatsApp, lalu checkout.
2. Fungsi database `create_order` memeriksa produk aktif dan menghitung total dari harga database (bukan harga yang dikirim browser).
3. Pesanan dan detail produk tersimpan pada tabel `orders` dan `order_items`.
4. Pelanggan mendapat struk berisi nomor pesanan dan dapat mencetak / menyimpan PDF.
5. Pelanggan dapat membuka WhatsApp untuk mengirim ringkasan pesanan kepada admin.
6. Admin login, melihat daftar pesanan, mencari/filter, melihat detail, dan mengubah status pesanan serta pembayaran.

## Status pembayaran
- `Menunggu`: belum diverifikasi.
- `Lunas`: admin sudah memeriksa bahwa pembayaran benar-benar diterima.
- `Gagal`: pembayaran gagal/tidak valid.
Status awal selalu `Menunggu`; struk bukan bukti pembayaran lunas. Website ini tidak memproses QRIS/e-wallet otomatis. Untuk otomatisasi pembayaran dibutuhkan payment gateway dan webhook yang diverifikasi di backend.

## Catatan keamanan & produksi
- RLS membuat pengunjung umum hanya dapat membaca produk aktif. Mereka tidak dapat membaca pesanan pelanggan lain.
- Checkout publik menggunakan fungsi PostgreSQL `create_order` yang menghitung ulang harga dan total dari database.
- Dashboard admin membutuhkan Supabase Auth dan keanggotaan di `admin_users`.
- Ini implementasi awal yang siap diuji, bukan sistem anti-spam penuh. Sebelum menerima trafik besar, tambahkan rate limiting/CAPTCHA, validasi nomor, backup, kebijakan privasi, dan monitoring.
- Data pelanggan pribadi (nama, nomor, alamat/catatan) hanya dapat dilihat admin terdaftar. Lindungi akun admin dan gunakan password kuat.
