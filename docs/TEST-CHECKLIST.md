# Checklist uji fungsional & hak akses E-Surat

Gunakan data dan dokumen fiktif. Jalankan setiap skenario dengan akun dan browser session yang berbeda.

## Akun
- [ ] Daftar akun baru dengan unit yang benar.
- [ ] Pastikan akun baru berstatus pending dan tidak dapat membuka dashboard.
- [ ] Admin menyetujui akun dan menentukan role operasional.
- [ ] Admin menolak satu pendaftaran.
- [ ] Pegawai tidak dapat mengubah role sendiri menjadi admin.

## Isolasi unit
- [ ] Asdep SDA dapat melihat surat yang dibuat unit SDA atau ditujukan ke SDA.
- [ ] Asdep Konektivitas tidak dapat melihat surat SDA yang tidak terkait unitnya.
- [ ] Admin dapat melihat surat semua unit.
- [ ] Pimpinan dapat melihat surat non-rahasia lintas unit.
- [ ] User yang tidak berhak tidak dapat membaca row melalui API langsung (uji RLS, bukan hanya tampilan).

## Persuratan dan tracking
- [ ] Input surat masuk.
- [ ] Input surat keluar.
- [ ] Setiap surat mendapat tracking code unik.
- [ ] Cari berdasarkan kode tracking.
- [ ] Cari berdasarkan nomor surat.
- [ ] Perbarui status dan pastikan letter_history bertambah.
- [ ] Pastikan notifikasi status diterima oleh pembuat/anggota unit tujuan yang memenuhi policy.

## Disposisi dan tugas
- [ ] Kirim disposisi ke unit lain.
- [ ] Pastikan anggota aktif unit tujuan mendapat notifikasi.
- [ ] Penerima unit memperbarui status disposisi (diterima/diproses/selesai).
- [ ] Buat tugas untuk pegawai aktif satu unit.
- [ ] Pastikan penerima tugas mendapat notifikasi.
- [ ] Perbarui status tugas sebagai penerima.
- [ ] Pastikan user dari unit lain tidak dapat membaca tugas yang tidak terkait.

## Arsip
- [ ] Upload PDF dummy di bawah 10 MB.
- [ ] Unduh dokumen dari akun yang memiliki akses.
- [ ] Pastikan user tanpa akses surat tidak dapat membuat signed URL/unduh dokumen.
- [ ] Uji surat Rahasia: hanya pembuat/Admin/penerima akses eksplisit yang dapat melihat.

## Laporan
- [ ] Hitungan status sesuai data yang terlihat oleh role tersebut.
- [ ] Akun unit hanya mendapat rekap dari row yang boleh dilihat.
- [ ] Admin mendapat rekap lintas unit.
- [ ] Export CSV dapat dibuka di Excel.

## Catatan temuan
Tuliskan akun/role, langkah, hasil yang diharapkan, hasil aktual, dan pesan error. Jangan mematikan RLS untuk membuat tes lolos.
