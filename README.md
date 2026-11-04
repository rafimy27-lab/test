# E-Surat Deputi Infrastruktur Dasar — GitHub Test Pack

Paket ini menyiapkan **uji coba online gratis** dengan kombinasi:

- **GitHub Pages**: hosting frontend HTML/CSS/JavaScript.
- **Supabase Free**: autentikasi, PostgreSQL, private file storage, dan notifikasi in-app melalui trigger database.
- **RLS (Row Level Security)**: pembatasan baris data berdasarkan akun dan unit kerja.

File `prototype-asli.html` adalah salinan prototype awal. `index.html` + `app.js` adalah test harness yang terhubung ke Supabase setelah konfigurasi diisi.

> **PENTING — khusus pengujian:** gunakan data fiktif. Jangan mengunggah surat kedinasan, NIP/NIK, data pribadi pegawai, surat Rahasia/Sangat Rahasia asli, atau dokumen internal. GitHub Pages pada paket Free memerlukan repository publik; siapa pun dapat melihat source code dan halaman demo. Supabase Free juga bukan rekomendasi otomatis untuk sistem produksi pemerintahan.

## 1. Yang sudah bisa diuji

Setelah Supabase diatur, aplikasi ini menyediakan alur uji untuk:

1. Registrasi mandiri dan login.
2. Status akun `pending` sampai disetujui Admin.
3. Pembagian akses Admin, Pimpinan, Asdep, dan Pegawai.
4. Input surat masuk/keluar dan kode tracking unik.
5. Daftar/register surat sesuai RLS unit.
6. Update status serta riwayat tracking.
7. Disposisi ke unit lain dan notifikasi in-app otomatis.
8. Pembuatan tugas untuk pegawai aktif di unit yang sama.
9. Upload/unduh lampiran melalui private Storage.
10. Ringkasan laporan dan export register CSV.
11. Hak akses khusus untuk surat Rahasia/Sangat Rahasia; Admin dapat memberi akses, dan penerusan disposisi ke satu unit memberi akses kepada anggota aktif unit penerima.

Fitur yang belum termasuk dalam paket test ini: tanda tangan elektronik resmi, integrasi sistem persuratan nasional/instansi, pengiriman email/WhatsApp, reminder terjadwal, dan workflow paraf berjenjang yang telah disahkan.

## 2. Membuat Supabase Free project

1. Buka https://supabase.com dan buat akun.
2. Buat project baru pada plan Free. Pilih region yang paling sesuai dan tersedia untuk pengujian.
3. Buka **SQL Editor** → **New query**.
4. Salin seluruh isi `supabase/schema.sql`, lalu jalankan.
5. Buka **Project Settings → API**. Salin **Project URL** dan **publishable key** (atau `anon` key pada project lama).
6. Edit `supabase-config.js`:

   ```js
   export const SUPABASE_URL = 'https://PROJECT-REF.supabase.co';
   export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
   ```

   Publishable/anon key memang dapat terlihat di browser. Keamanan harus bergantung pada RLS. **Jangan gunakan `service_role` key atau secret key** pada file ini.

7. Buka **Authentication → URL Configuration**. Setelah URL GitHub Pages diketahui, masukkan URL tersebut sebagai Site URL dan tambahkan sebagai Redirect URL.
8. Untuk mempermudah pengujian akun, buka **Authentication → Sign In / Providers → Email**. Pada project test, kamu dapat menonaktifkan konfirmasi email agar akun langsung mendapat sesi login. Untuk penggunaan yang lebih realistis, aktifkan kembali konfirmasi email dan atur layanan SMTP yang sesuai.

## 3. Membuat akun Super Admin pertama

1. Buka website setelah konfigurasi Supabase selesai.
2. Pilih **Daftar akun**, daftarkan email milikmu, dan pilih Sekretariat Deputi sebagai unit.
3. Akun akan masuk dengan status `pending`.
4. Buka Supabase **SQL Editor** dan jalankan query berikut dengan email yang kamu daftarkan:

   ```sql
   update public.profiles
   set role = 'super_admin',
       status = 'active',
       unit_id = (select id from public.units where code = 'SEKRETARIAT')
   where email = 'EMAIL-ADMIN-KAMU';
   ```

5. Login kembali. Menu **Manajemen Akun** akan muncul. Admin kemudian dapat menyetujui pendaftaran berikutnya. Pendaftaran mandiri selalu membuat role `pegawai`; pengguna tidak dapat mengatur role admin dari form.

## 4. Upload ke GitHub dan aktifkan GitHub Pages

GitHub Pages pada GitHub Free membutuhkan repository **public**. Karena itu, publikasikan paket ini hanya sebagai demo dengan source code yang sudah diperiksa. Jangan letakkan file rahasia, `.env`, dokumen surat, atau kredensial server dalam repository.

1. Buat repository baru bernama misalnya `esurat-deputi-test` dan pilih **Public**.
2. Extract ZIP ini di komputer.
3. Upload isi folder `esurat_github_test` ke root repository (pastikan `index.html` berada langsung di root, bukan di dalam folder kedua).
4. Commit ke branch `main`.
5. Buka **Settings → Pages**.
6. Pada **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu **Save**.
7. Tunggu deployment GitHub Pages selesai. URL demo akan terlihat di halaman Settings → Pages.

Alternatif: gunakan GitHub Desktop atau `git`:

```bash
git init
git add .
git commit -m "Initial E-Surat test site"
git branch -M main
git remote add origin https://github.com/USERNAME/esurat-deputi-test.git
git push -u origin main
```

## 5. Uji multi-akun

Buat akun berbeda untuk Sekretariat, Asdep SDA, Asdep Konektivitas, dan Pimpinan. Gunakan jendela browser biasa dan Incognito/Private agar sesi akun tidak tercampur.

Skenario minimum:

- Akun Asdep SDA membuat surat yang ditujukan ke SDA; akun unit SDA bisa melihat.
- Akun Asdep Konektivitas tidak boleh melihat surat SDA kecuali diberi akses eksplisit.
- Admin dapat melihat seluruh surat lintas unit.
- Pimpinan dapat memantau surat non-rahasia lintas unit.
- Akun baru tidak dapat masuk ke dashboard sebelum disetujui.
- Disposisi ke SDA menghasilkan notifikasi untuk anggota aktif SDA.
- Tugas muncul pada akun penerima tugas.
- Lampiran tidak boleh dapat diunduh oleh akun yang tidak memiliki akses ke surat.
- Surat Rahasia/Sangat Rahasia hanya terlihat oleh pembuat, Admin, atau pengguna/unit penerima disposisi yang mendapat `letter_access` eksplisit.

Lihat `docs/TEST-CHECKLIST.md` untuk checklist lebih lengkap.

## 6. Batas paket gratis dan catatan

Supabase Free menyediakan kuota yang memadai untuk prototype/pilot kecil, tetapi project dapat dijeda setelah periode aktivitas rendah. Periksa dashboard kuota dan ketentuan harga terkini. Free plan tidak disertai backup otomatis seperti plan berbayar.

GitHub Pages hanya meng-host file statis; proses login, database, dan file dilakukan oleh Supabase. Jika Supabase project pause, aplikasi mungkin tidak bisa login/memuat data sampai project diaktifkan kembali.

## 7. Troubleshooting singkat

- **Halaman hanya menampilkan instruksi konfigurasi**: periksa `supabase-config.js` dan pastikan URL/key sudah diisi.
- **Gagal memuat unit**: pastikan `schema.sql` berhasil dijalankan dan tabel `units` bisa dibaca sebagai `anon`.
- **Login berhasil tetapi akun pending**: promosi akun pertama melalui query Super Admin di atas, atau minta Admin menyetujui akun.
- **Error permission/RLS**: jangan mematikan RLS. Periksa policy dan role akun. Catat pesan error yang tampil.
- **Upload gagal**: pastikan bucket `surat-arsip` ada, file maksimal 10 MB, dan MIME type termasuk PDF, gambar, Word, atau Excel.
- **Email konfirmasi tidak tiba**: untuk uji awal, nonaktifkan confirm email; untuk pengujian email, atur SMTP.

## Referensi resmi

- GitHub Pages: https://docs.github.com/en/pages
- Supabase Pricing: https://supabase.com/pricing
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API key safety: https://supabase.com/docs/guides/database/secure-data
