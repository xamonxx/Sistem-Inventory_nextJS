# Tanda Tangan Dokumen

Letakkan gambar tanda tangan di folder ini.

## Tanda tangan "Disetujui" pada Invoice

- **Nama file wajib:** `disetujui.png`
- **Path akhir:** `public/ttd/disetujui.png`
- **Format:** PNG dengan **latar transparan** (agar menyatu di atas garis tanda tangan).
- **Saran ukuran:** tinggi ± 120–200px, lebar mengikuti proporsi (rasio bebas).
  Sistem menampilkannya dengan tinggi terkunci ~34px dan lebar auto, jadi
  makin tinggi resolusi asli makin tajam saat dicetak.

Setelah file ditaruh, tanda tangan otomatis muncul di kolom **Disetujui**
pada pratinjau invoice (Cetak Faktur A4, Save to Image/PNG, dan cetak).

Jika file belum ada, kolom tetap rapi (gambar disembunyikan otomatis) dan
hanya menampilkan garis + `( ........... )` seperti semula.

> Ingin memakai path/URL lain? Set env `NEXT_PUBLIC_SIGNATURE_DISETUJUI`
> (mis. `NEXT_PUBLIC_SIGNATURE_DISETUJUI=/ttd/ttd-owner.png`).
