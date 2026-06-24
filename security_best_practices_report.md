# Laporan Audit Keamanan, Validasi Input, Bug Logika, dan Layout

Tanggal audit: 24 Juni 2026  
Ruang lingkup: seluruh source `src/`, Prisma schema/seed, importer XLSX, autentikasi, server actions, API export, dan pemeriksaan browser lokal.

## Ringkasan Eksekutif

Sistem berhasil di-build untuk production, tetapi **belum aman untuk dipublikasikan atau dipakai dengan data keuangan nyata** sebelum temuan Critical dan High diperbaiki.

Temuan paling berbahaya:

1. Next.js 15.1.4 terkena kerentanan RCE kritis React Server Components.
2. Kredensial demo `kasir/password` dan `gudang/password` aktif serta ditampilkan pada halaman login.
3. Validasi transaksi memungkinkan diskon lebih besar dari subtotal sehingga total dan invoice dapat negatif.
4. Retur tidak diverifikasi terhadap transaksi asal; harga yang dipakai adalah harga saat ini, bukan harga nota.
5. UI retur mendukung banyak item tetapi server hanya menyimpan item pertama.
6. Split payment hanya tampil pada nota; komponen pembayaran parsial tidak disimpan ke database.
7. Data harga beli/margin dikirim ke browser akun kasir walau UI menampilkan “Dibatasi”.
8. JWT tetap berlaku 7 hari walaupun user dinonaktifkan atau role diubah.

## Metode dan Hasil Verifikasi

- `npm run build`: **lulus** (compile, lint/type check, dan static generation).
- `npm audit --json`: **3 dependency vulnerabilities** (1 critical, 1 high, 1 moderate).
- Browser production lokal: login valid berhasil.
- Browser production lokal: `/?from=not-a-date&to=also-bad` menghasilkan server-side application error.
- Browser production lokal: `/stok/not-a-number` dan `/invoice/not-a-number` menghasilkan server-side application error.
- Pemeriksaan response `/login`: tidak ditemukan CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, atau `Permissions-Policy`.
- `.env` tidak dilacak Git dan `AUTH_SECRET` tersedia dengan panjang memadai; nilai rahasia tidak dicantumkan dalam laporan.

---

## Critical

### SEC-001 — Next.js 15.1.4 terkena RCE React Server Components

- Rule ID: NEXT-SUPPLY-001
- Severity: **Critical**
- Location: `package.json:19`, `package-lock.json`
- Evidence: dependency `next` dipatok pada `15.1.4`.
- Impact: request berbahaya dapat memicu remote code execution pada versi App Router yang belum ditambal.
- Fix: upgrade minimal ke versi Next.js yang telah ditambal. Berdasarkan audit npm saat ini, target aman dalam jalur 15 adalah `15.5.19`; uji regresi setelah upgrade.
- Mitigation: jangan expose aplikasi ke internet sebelum upgrade; setelah patch dan redeploy, rotasi seluruh secret bila aplikasi pernah online dengan versi rentan.
- Source: https://nextjs.org/blog/CVE-2025-66478

### SEC-002 — Kredensial default lemah aktif dan dipublikasikan

- Rule ID: AUTH-DEFAULT-CREDENTIALS
- Severity: **Critical** bila deployment dapat diakses jaringan
- Location:
  - `src/app/login/page.tsx:41-43`
  - `prisma/seed.ts:200-211`
  - `README.md:27-28`
- Evidence: halaman login menampilkan `kasir/password` dan `gudang/password`; pengujian lokal mengonfirmasi kredensial kasir aktif.
- Impact: siapa pun yang melihat aplikasi dapat login sebagai operator dan membuat transaksi/retur.
- Fix: hapus informasi demo dari UI production, jangan reset password user existing saat seed, paksa password unik dari environment atau setup awal, dan wajibkan ganti password saat login pertama.
- Mitigation: batasi aplikasi ke localhost/VPN sampai seluruh password default diganti.

---

## High

### SEC-003 — User nonaktif atau role lama tetap memiliki akses selama 7 hari

- Rule ID: NEXT-AUTH-001 / NEXT-SESS-002
- Severity: **High**
- Location: `src/lib/auth.ts:19-24`, `src/lib/auth.ts:43-55`, `src/lib/auth.ts:70-76`
- Evidence: seluruh identitas dan role dipercaya langsung dari JWT; `getSession()` tidak membaca ulang record user/`aktif` dari database.
- Impact: user yang dinonaktifkan tetap dapat memakai token lama; perubahan role tidak segera berlaku.
- Fix: gunakan session ID server-side atau validasi `user.id`, `aktif`, dan role terbaru pada setiap request sensitif. Tambahkan `sessionVersion` untuk mencabut semua sesi saat reset password/role/nonaktif.
- Mitigation: pendekkan TTL dan rotasi secret saat perlu mencabut seluruh sesi.

### SEC-004 — Login dapat di-brute-force dan melakukan enumerasi akun

- Rule ID: AUTH-BRUTE-FORCE
- Severity: **High**
- Location: `src/app/login/actions.ts:8-24`
- Evidence: tidak ada rate limit/lockout; pesan membedakan user tidak ada/nonaktif dan password salah.
- Impact: attacker dapat menemukan username valid dan mencoba password tanpa batas.
- Fix: rate limit berdasarkan IP + username, backoff/temporary lockout, pesan generik “Kredensial tidak valid”, dan audit event login gagal.
- Mitigation: batasi akses jaringan dan monitor percobaan login.

### SEC-005 — Kebijakan password minimum 4 karakter

- Rule ID: AUTH-PASSWORD-POLICY
- Severity: **High**
- Location:
  - `src/app/(app)/pengguna/actions.ts:52-53`
  - `src/app/(app)/pengguna/actions.ts:99-103`
- Evidence: akun baru dan reset password menerima password sepanjang 4 karakter; edit user menerima password non-kosong tanpa minimum.
- Impact: akun mudah diambil alih melalui tebakan atau credential stuffing.
- Fix: minimal 10–12 karakter, batas maksimum wajar, tolak password umum, dan terapkan aturan sama untuk create/edit/reset.

### SEC-006 — Diskon dapat membuat subtotal dan invoice negatif

- Rule ID: NEXT-INPUT-001 / BUSINESS-INTEGRITY
- Severity: **High**
- Location:
  - `src/app/(app)/kasir/actions.ts:10-14`
  - `src/app/(app)/kasir/actions.ts:135-138`
  - `src/app/(app)/kasir/actions.ts:174-188`
- Evidence: schema hanya memeriksa `discount >= 0`; server tidak membatasi diskon terhadap `hargaJual × qty`.
- Impact: pemanggil server action dapat membuat penjualan/invoice bernilai negatif sambil tetap mengurangi stok.
- Fix: hitung diskon sepenuhnya di server, wajib `discount <= baseSubtotal`, tolak grand total negatif, batasi qty/diskon, dan gunakan `Decimal` dari input string atau integer rupiah.
- Mitigation: constraint/check tambahan di database bila didukung.

### SEC-007 — Retur tidak terikat dan tidak diverifikasi terhadap transaksi asli

- Rule ID: BUSINESS-AUTHORIZATION / NEXT-INPUT-001
- Severity: **High**
- Location: `src/app/(app)/retur/actions.ts:10-24`, `src/app/(app)/retur/actions.ts:28-51`, `src/app/(app)/retur/actions.ts:56-86`
- Evidence:
  - payload tidak memiliki `transactionId`;
  - server hanya mengecek item master ada;
  - qty retur tidak dibandingkan qty pembelian dikurangi retur sebelumnya;
  - harga retur memakai `item.hargaJual` saat ini, bukan `TransactionItem.hargaSnapshot`.
- Impact: operator dapat menaikkan stok melalui retur arbitrer dan menghasilkan nilai refund/tagihan yang salah.
- Fix: wajibkan transaksi asal; cari line transaksi di server; gunakan harga snapshot nota; hitung sisa qty yang boleh diretur; simpan `transactionId`; cegah retur ganda berlebih dalam transaction database.

### BUG-001 — UI multi-item retur hanya menyimpan item pertama

- Rule ID: FUNCTIONAL-DATA-INTEGRITY
- Severity: **High**
- Location:
  - `src/app/(app)/retur/ReturClient.tsx:173-185`
  - `src/app/(app)/retur/ReturClient.tsx:187-198`
  - `src/app/(app)/retur/ReturClient.tsx:440-493`
  - `src/app/(app)/retur/ReturClient.tsx:573-635`
- Evidence: UI menghitung seluruh `retItems`/`repItems`, tetapi submit mengambil `retItems[0]` dan `repItems[0]`.
- Impact: total yang dilihat operator berbeda dari data stok/retur yang tersimpan; item kedua dan seterusnya hilang.
- Fix: ubah payload dan model detail retur menjadi array line items, atau batasi UI secara eksplisit menjadi satu item.

### BUG-002 — Split payment tidak dipersist ke database

- Rule ID: FINANCIAL-INTEGRITY
- Severity: **High**
- Location:
  - `src/app/(app)/kasir/KasirClient.tsx:266-308`
  - `src/app/(app)/kasir/actions.ts:172-188`
- Evidence: client menghitung cash/transfer/credit, tetapi server hanya menerima satu `paymentMethod`. Jika ada komponen kredit, invoice dibuat dengan `totalDibayar = 0`, mengabaikan cash/transfer yang sudah diterima.
- Impact: saldo piutang dan laporan pembayaran salah walaupun nota menampilkan split payment.
- Fix: buat model `Payment`/payment lines; kirim dan validasi seluruh komponen di server; set `totalDibayar = cash + transfer`; status `LUNAS/PENDING` dihitung dari jumlah aktual.

### SEC-008 — Harga beli dan margin dikirim ke browser role kasir

- Rule ID: NEXT-AUTH-001 / DATA-MINIMIZATION
- Severity: **High**
- Location:
  - `src/app/(app)/barang/page.tsx:18-29`
  - `src/app/(app)/barang/BarangClient.tsx:69`, `96`, `267-288`
  - `src/app/(app)/laporan/page.tsx:9-26`
  - `src/app/(app)/laporan/LaporanClient.tsx:149-226`
  - `src/app/(app)/stok/[id]/page.tsx:79`
  - `src/app/api/export/route.ts:36-38`, `43-47`
- Evidence: `hargaBeli`, margin, dan `nilaiAset` tetap masuk props Client Component; penyembunyian hanya dilakukan saat render. Detail stok menampilkan harga beli ke semua user. Export `stok` untuk kasir memakai `laporanStok()` yang menyertakan harga beli/nilai aset.
- Impact: kasir dapat memperoleh modal, margin, dan valuasi inventori dari RSC payload, halaman detail, atau export.
- Fix: lakukan projection berdasarkan role di server. Jangan pernah serialisasi field sensitif untuk role yang tidak berhak. Terapkan role check pada detail stok dan setiap tipe export.

### SEC-009 — Mutasi bisnis dan activity log tidak atomic

- Rule ID: AUDIT-INTEGRITY
- Severity: **High**
- Location:
  - `src/app/(app)/kasir/actions.ts:48-203`
  - `src/app/(app)/retur/actions.ts:53-129`
  - `src/app/(app)/invoice/actions.ts:22-33`
  - `src/app/(app)/stok/masuk/actions.ts:34-95`
- Evidence: transaksi utama commit terlebih dahulu; `logActivity()` dijalankan sesudahnya menggunakan Prisma client terpisah.
- Impact: bila penulisan log gagal, data utama sudah berubah tetapi client menerima error dan dapat mencoba ulang, menyebabkan transaksi/pembayaran/stock-in ganda.
- Fix: tulis activity log menggunakan transaction client yang sama sebelum commit; kembalikan success hanya setelah seluruh operasi atomic selesai.

### SEC-010 — Dependency `xlsx@0.18.5` rentan

- Rule ID: SUPPLY-CHAIN
- Severity: **High** untuk importer file tak terpercaya
- Location: `package.json:29`, `scripts/import-xlsx.ts:61`
- Evidence: npm audit melaporkan prototype pollution dan ReDoS; importer membaca workbook dari path eksternal.
- Impact: file spreadsheet buatan attacker dapat menghabiskan resource atau mengeksploitasi parser ketika importer dijalankan.
- Fix: migrasikan ke versi SheetJS CE yang telah ditambal dari distribusi resmi atau library spreadsheet lain; batasi ukuran file/sheet/baris dan jalankan importer pada proses terisolasi.
- False-positive note: risiko prototype pollution tidak berlaku pada jalur yang hanya menulis/export XLSX, tetapi berlaku pada `readFile`.
- Source: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9

---

## Medium

### SEC-011 — Server actions baca data tanpa autentikasi

- Rule ID: NEXT-AUTH-001
- Severity: **Medium**
- Location:
  - `src/components/NotificationActions.ts:16-108`
  - `src/app/(app)/barang/actions.ts:111-125`
- Evidence: `fetchSystemNotifications()` dan `getItemHistory()` tidak memanggil `requireUser()`/`requireRole()`.
- Impact: bila action identifier diketahui/terekspos, pihak tanpa sesi dapat membaca ringkasan stok, piutang, aktivitas operator, atau riwayat item.
- Fix: autentikasi di awal setiap exported server action dan batasi detail berdasarkan role.

### SEC-012 — Pembayaran invoice rentan race condition dan input non-finite

- Rule ID: NEXT-INPUT-001 / FINANCIAL-INTEGRITY
- Severity: **Medium**
- Location: `src/app/(app)/invoice/actions.ts:9-25`
- Evidence: argument tidak melalui schema; read-modify-write dilakukan di luar transaction/locking.
- Impact: dua pembayaran bersamaan dapat saling menimpa; `NaN`/nilai ekstrem dapat menghasilkan error internal.
- Fix: Zod `int/positive/finite/safe`, gunakan Prisma transaction dengan conditional update atau optimistic versioning, dan tolak pembayaran pada invoice lunas/sisa <= 0.

### SEC-013 — Tidak ada batas panjang dan batas jumlah pada banyak input

- Rule ID: NEXT-INPUT-001
- Severity: **Medium**
- Location:
  - `src/app/(app)/kasir/actions.ts:16-25`
  - `src/app/(app)/retur/actions.ts:10-24`
  - `src/app/(app)/stok/masuk/actions.ts:9-20`
  - `src/app/(app)/barang/actions.ts:10-19`
  - `src/app/(app)/pengguna/actions.ts:11-17`
  - `src/components/CommandPaletteActions.ts:14-31`
- Evidence: banyak string hanya `.trim()`/`.min()`, array dan angka tidak memiliki maksimum wajar.
- Impact: payload besar, nama sangat panjang, qty ekstrem, atau query pencarian panjang dapat menyebabkan DB error, data buruk, atau resource exhaustion.
- Fix: definisikan batas domain: username/nama/kode/alamat/keterangan, jumlah line per transaksi, qty, harga, diskon, dan query search.

### BUG-003 — Filter tanggal dan dynamic ID tidak divalidasi

- Rule ID: NEXT-INPUT-001 / ERROR-HANDLING
- Severity: **Medium**
- Location:
  - `src/app/(app)/page.tsx:47-50`
  - `src/app/(app)/stok/[id]/page.tsx:13-17`
  - `src/app/(app)/invoice/[id]/page.tsx:7-17`
- Evidence: `new Date()` dan `Number(id)` dipakai tanpa pemeriksaan validitas.
- Impact: URL malformed menghasilkan HTTP 500 dan error page.
- Verified:
  - `/?from=not-a-date&to=also-bad`
  - `/stok/not-a-number`
  - `/invoice/not-a-number`
- Fix: schema untuk search params/params; jika invalid gunakan default, 400, atau `notFound()`.

### SEC-014 — Security headers tidak dikonfigurasi

- Rule ID: NEXT-HEADERS-001 / NEXT-CSP-001
- Severity: **Medium**
- Location: `next.config.ts:1-7`; response runtime `/login`
- Evidence: tidak ada CSP, clickjacking protection, `nosniff`, referrer policy, atau permissions policy.
- Impact: perlindungan defense-in-depth terhadap XSS, framing, MIME sniffing, dan browser capability abuse tidak tersedia.
- Fix: tambahkan headers global. Mulai dari CSP yang kompatibel, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, dan `Referrer-Policy`.

### SEC-015 — Kasir dapat melihat daftar seluruh akun

- Rule ID: LEAST-PRIVILEGE
- Severity: **Medium**
- Location:
  - `src/app/(app)/pengguna/page.tsx:7-22`
  - `src/components/Sidebar.tsx:47-50`
- Evidence: halaman hanya membutuhkan `requireUser()` dan menu Pengguna terlihat untuk semua role.
- Impact: kasir dapat menginventarisasi username, nama, role, status, dan tanggal akun.
- Fix: batasi halaman dan menu ke `ADMIN_GUDANG`, atau tampilkan hanya profil sendiri untuk role kasir.

### SEC-016 — Penghapusan seluruh audit log melemahkan audit trail

- Rule ID: AUDIT-RETENTION
- Severity: **Medium**
- Location: `src/app/(app)/log-aktivitas/actions.ts:7-21`
- Evidence: satu aksi admin menghapus seluruh log, lalu membuat satu record baru.
- Impact: bukti historis perubahan harga, stok, transaksi, dan pembayaran dapat dihilangkan permanen.
- Fix: gunakan retention policy/archival, soft delete, export bertanda tangan, dan approval tambahan; minimal lakukan delete + marker dalam transaction.

### PERF-001 — Pola query laporan N+1 dan dashboard sangat mahal

- Rule ID: PERFORMANCE / AVAILABILITY
- Severity: **Medium**
- Location:
  - `src/lib/reports.ts:5-29`
  - `src/app/(app)/page.tsx:97-122`
  - `src/app/(app)/invoice/page.tsx:33-41`
- Evidence: satu query per grup item untuk margin; loop 30 hari melakukan query berulang; QR dibuat untuk seluruh invoice pada setiap render.
- Impact: latency dan load database meningkat tajam pada ribuan item/transaksi, membuka risiko DoS operasional.
- Fix: agregasi margin dalam satu query/SQL, group data trend per tanggal dalam satu query, pagination invoice, dan generate QR hanya untuk invoice yang dibuka.

---

## Low

### SEC-017 — Debug session logging aktif di server

- Rule ID: LOGGING-HYGIENE
- Severity: **Low**
- Location: `src/lib/auth.ts:46-57`
- Evidence: setiap pembacaan sesi mencetak status token dan error JWT.
- Impact: log menjadi bising dan dapat mengungkap pola autentikasi/internal error.
- Fix: hapus debug log atau gunakan structured logger dengan level dan redaction.

### SEC-018 — Logout dilakukan melalui GET

- Rule ID: NEXT-CSRF-001
- Severity: **Low**
- Location: `src/app/(app)/logout/route.ts:4-7`
- Evidence: request GET mengubah state dengan menghapus session.
- Impact: situs lain dapat memaksa user logout.
- Fix: gunakan POST server action/route dengan Origin check; pertahankan SameSite cookie.

---

## Bug Layout dan Accessibility

### UI-001 — Filter dashboard berisiko terpotong pada mobile

- Severity: **Medium**
- Location:
  - `src/app/(app)/layout.tsx:23-25`
  - `src/app/(app)/page.tsx:232-281`
- Evidence: main memakai `overflow-x-hidden`; form filter adalah satu baris `flex` berisi dua date input, separator, tombol, dan reset tanpa `flex-wrap`/layout mobile.
- Impact: pada layar sempit, kontrol dapat keluar viewport lalu terpotong dan tidak dapat discroll horizontal.
- Fix: `grid grid-cols-1 sm:flex`, bungkus input per baris, atau `flex-wrap`; jangan gunakan `overflow-x-hidden` untuk menutupi overflow tak sengaja.

### UI-002 — Enam KPI dipaksa satu baris mulai breakpoint `lg`

- Severity: **Medium**
- Location: `src/app/(app)/page.tsx:285-313`
- Evidence: `lg:grid-cols-6` sementara sidebar desktop dapat memakai lebar 280px.
- Impact: pada viewport sekitar 1024px, lebar card menjadi terlalu sempit untuk angka Rupiah dan label.
- Fix: gunakan `lg:grid-cols-3 xl:grid-cols-6`, atau auto-fit `minmax(180px, 1fr)`.

### UI-003 — Dialog dan drawer belum memenuhi aksesibilitas modal

- Severity: **Medium**
- Location:
  - `src/components/ModernDialog.tsx:55-100`
  - `src/components/Drawer.tsx:53-94`
  - `src/components/CommandPalette.tsx:108-229`
- Evidence: tidak ada `role="dialog"`, `aria-modal`, hubungan title/description, focus trap, initial focus konsisten, dan pemulihan focus.
- Impact: pengguna keyboard/screen reader dapat berpindah ke konten di belakang modal atau kehilangan posisi focus.
- Fix: gunakan primitive dialog teruji atau implementasi ARIA + focus management lengkap.

### UI-004 — Custom Select menghilangkan akses keyboard native

- Severity: **Medium**
- Location: `src/components/ui.tsx:128-280`
- Evidence: native select dibuat `aria-hidden` dan `tabIndex=-1`; tombol pengganti tidak memiliki combobox/listbox semantics dan tidak menangani Arrow/Home/End/typeahead.
- Impact: kontrol sulit/tidak dapat digunakan dengan keyboard dan screen reader.
- Fix: pertahankan native select yang visible/styled bila memungkinkan, atau implementasi WAI-ARIA combobox/listbox lengkap.

### UI-005 — Banyak tombol ikon hanya mengandalkan `title` atau tanpa nama aksesibel

- Severity: **Low**
- Location: contoh `src/app/(app)/kasir/KasirClient.tsx:586-592`, `src/app/(app)/retur/ReturClient.tsx:587-593`, `src/components/Drawer.tsx:81-86`
- Impact: screen reader mengumumkan tombol tanpa tujuan.
- Fix: tambahkan `aria-label` yang spesifik.

---

## Prioritas Perbaikan

### P0 — Sebelum aplikasi dapat diakses jaringan

1. Upgrade Next.js dan evaluasi rotasi secret.
2. Hapus/ganti semua kredensial demo.
3. Tambahkan rate limiting login dan perkuat password policy.
4. Perbaiki session revocation/status/role freshness.

### P1 — Sebelum transaksi nyata

1. Validasi diskon dan grand total di server.
2. Rancang ulang retur berbasis transaksi asli dan line items.
3. Persist split payment secara benar.
4. Satukan mutasi bisnis + activity log dalam transaction.
5. Hilangkan kebocoran harga beli/margin dari server payload dan export.

### P2 — Stabilitas dan hardening

1. Validasi seluruh params/search params/action arguments.
2. Tambahkan security headers.
3. Perbaiki race pembayaran dan koreksi stok.
4. Batasi panjang/jumlah seluruh input.
5. Optimalkan query laporan/dashboard dan pagination.
6. Perbaiki layout mobile serta aksesibilitas dialog/select.

## Catatan Batas Audit

- Audit ini adalah source review dan pengujian lokal, bukan penetration test jaringan penuh.
- Tidak dilakukan mutasi data berbahaya untuk membuktikan transaksi negatif/retur palsu; temuan tersebut dibuktikan dari jalur kode server.
- Viewport desktop diperiksa pada browser lokal. Pengujian breakpoint mobile otomatis tidak dapat diterapkan oleh browser runtime saat audit, sehingga temuan mobile ditetapkan dari struktur CSS/layout dan harus dikonfirmasi kembali setelah perbaikan.
