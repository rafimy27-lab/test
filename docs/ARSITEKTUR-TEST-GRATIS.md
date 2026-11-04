# Arsitektur pengujian gratis

```text
Browser pengguna
    |
    | HTML + CSS + JavaScript (GitHub Pages)
    v
Supabase publishable key + user access token
    |
    +---- Supabase Auth (registrasi, login, session)
    +---- Supabase Postgres (surat, disposisi, tugas, riwayat, laporan)
    +---- Row Level Security (unit/role access)
    +---- Supabase Storage private bucket (lampiran)
    +---- Database triggers (notifikasi in-app dan audit log)
```

GitHub Pages bukan server PHP. Laravel/MySQL tidak berjalan di GitHub Pages. Paket test ini memakai frontend statis + Supabase supaya beberapa akun dapat mengakses database bersama tanpa menyewa VPS.

Ini adalah jalur pengujian gratis dan bukan keputusan stack produksi. Untuk produksi, evaluasi ulang apakah instansi mensyaratkan infrastruktur internal, lokasi penyimpanan tertentu, backup/SLA, kontrol akses organisasi, audit, retensi arsip, dan persetujuan keamanan.
