import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============ HELPER FUNCTIONS ============

function resolveSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("SEED_DEFAULT_PASSWORD wajib di-set minimal 12 karakter untuk seeding.");
  }
  return password;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) / 500) * 500;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function padNum(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function parseIntArg(name: string): number | undefined {
  const eqArg = process.argv.find((arg) => arg.startsWith(`${name}=`));
  const raw =
    eqArg?.slice(name.length + 1) ??
    (() => {
      const idx = process.argv.indexOf(name);
      return idx >= 0 ? process.argv[idx + 1] : undefined;
    })();
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseStringArg(name: string): string | undefined {
  const eqArg = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return (
    eqArg?.slice(name.length + 1) ??
    (() => {
      const idx = process.argv.indexOf(name);
      return idx >= 0 ? process.argv[idx + 1] : undefined;
    })()
  );
}

// ============ DATA POOLS ============

const MATERIAL_PREFIXES = [
  "Semen", "Paku", "Cat", "Kayu", "Besi", "Pipa", "Kunci", "Obeng",
  "Engsel", "Sekrup", "Lem", "Sealant", "Kabel", "Stop Kontak", "Saklar",
  "Lampu", "Fitting", "MCB", "Gergaji", "Palu", "Tang", "Bor", "Amplas",
  "Thinner", "Plamir", "Epoxy", "Roller", "Kuas", "Gembok", "Rantai",
  "Kawat", "Seng", "Atap", "Genteng", "Keramik", "Granite", "Marmer",
  "Vinyl", "Parquet", "Plafon", "GRC", "Gypsum", "Aluminium", "Stainless",
  "Galvanis", "Baja", "Wiremesh", "Bondek", "Paving", "Batako",
  "Bata", "Hebel", "Mortar", "Pasir", "Kerikil", "Split", "Sirtu",
  "Waterproofing", "Membrane", "Geotextile", "Fiber", "Polycarb",
  "Asbes", "Spandek", "Hollow", "CNP", "WF", "UNP", "Siku",
  "Flat Bar", "Round Bar", "Plate", "Elbow", "Tee", "Reducer",
  "Valve", "Kran", "Shower", "Closet", "Wastafel", "Bak Mandi",
  "Floor Drain", "Rak", "Bracket", "Hanger", "Anchor", "Fischer",
  "Dynabolt", "Mur", "Baut", "Ring", "Rivet", "Clamp",
  "Selang", "Pompa", "Mesin Potong", "Gerinda", "Kompresor", "Las",
  "Travo", "Genset", "Mixer", "Vibrator", "Stamper", "Scaffolding",
  "Jack Base", "U-Head", "Pipa Scaff", "Plywood", "MDF", "Papan",
  "Multiplex", "Blockboard", "Particle Board", "HPL", "Taco Sheet",
];

const MATERIAL_TYPES = [
  "Premium", "Standard", "Ekonomis", "Super", "Pro", "SNI",
  "Grade A", "Grade B", "Import", "Lokal", "Heavy Duty", "Light",
  "Anti Karat", "Anti Air", "Tahan Panas", "Industrial", "Dekoratif",
  "Struktural", "Interior", "Exterior", "Glossy", "Matte", "Doff",
];

const MATERIAL_SIZES = [
  "2mm", "3mm", "4mm", "5mm", "6mm", "8mm", "10mm", "12mm", "16mm", "19mm", "22mm",
  "1/2\"", "3/4\"", "1\"", "1.5\"", "2\"", "3\"", "4\"", "6\"",
  "2.5kg", "5kg", "10kg", "20kg", "25kg", "40kg", "50kg",
  "30cm", "40cm", "60cm", "80cm", "100cm", "120cm", "150cm", "200cm", "240cm",
  "1x1m", "1x2m", "1.2x2.4m", "60x60", "40x40", "30x30", "20x20",
  "0.3mm", "0.4mm", "0.5mm", "0.8mm", "1.0mm", "1.2mm",
  "4x6", "5x7", "6x12", "8x12", "5x10", "4x8",
];

const MATERIAL_BRANDS = [
  "Tiga Roda", "Holcim", "Bosowa", "Merah Putih", "Panda", "Rajawali",
  "Dulux", "Nippon", "Jotun", "Avian", "Propan", "Mowilex",
  "Wavin", "Rucika", "Vinilon", "Pralon", "Trilliun",
  "Krakatau Steel", "Gunung Garuda", "Master Steel", "Ispat",
  "Yale", "Dekkson", "Huben", "OPAL", "Broco", "Panasonic",
  "Philips", "Schneider", "ABB", "Legrand", "Hager",
  "Makita", "Bosch", "Hikoki", "Stanley", "Tekiro", "Krisbow",
  "Roman", "Milan", "Platinum", "Mulia", "Asia Tile", "Venus",
  "Toto", "American Standard", "Wasser", "Onda", "San-Ei",
  "Jayaboard", "Elephant", "Knauf", "Kalsi", "GRC Board",
  "Galvalume", "BlueScope", "Lysaght", "Alderon", "Solartuff",
];

const CLIENT_NAMES = [
  "CV Bangun Sejahtera", "PT Maju Jaya Konstruksi", "Toko Indah Mebel",
  "CV Karya Utama", "PT Sinar Pembangunan", "UD Makmur Sentosa",
  "CV Berkah Mandiri", "PT Global Teknik", "Toko Bangunan Mitra",
  "CV Cipta Karya", "PT Sarana Konstruksi", "UD Sumber Rejeki",
  "CV Putra Mandiri", "PT Abadi Perkasa", "Toko Material Jaya",
  "CV Nusantara Build", "PT Mega Struktur", "UD Fajar Baru",
  "CV Delta Konstruksi", "PT Prima Bangun", "Toko Sejahtera Material",
  "CV Graha Mandiri", "PT Tekno Bangunan", "UD Central Material",
  "CV Buana Karya", "PT Indo Konstruksi", "Toko Purnama Material",
  "CV Cahaya Mandiri", "PT Mitra Konstruksi Indonesia", "UD Surya Abadi",
  "CV Aneka Bangunan", "PT Sentosa Konstruksi", "Toko Arjuna Material",
  "CV Gemilang Konstruksi", "PT Jaya Perkasa Mandiri", "UD Mentari Bangunan",
  "CV Bersama Membangun", "PT Kokoh Konstruksi", "Toko Lima Jaya",
  "CV Anugerah Mandiri", "PT Setia Konstruksi", "UD Prima Material",
];

const PERSON_NAMES = [
  "Bpk. Hendra Wijaya", "Ibu Sari Dewi", "Bpk. Agus Santoso",
  "Bpk. Rudi Hartono", "Ibu Rina Permata", "Bpk. Bambang Suryadi",
  "Bpk. Dedi Kurniawan", "Ibu Yuni Lestari", "Bpk. Eko Prasetyo",
  "Bpk. Wahyu Hidayat", "Ibu Anita Sari", "Bpk. Joko Widodo",
  "Bpk. Taufik Rahman", "Ibu Sri Mulyani", "Bpk. Budi Santoso",
  "Bpk. Ahmad Fauzi", "Ibu Maya Anggraini", "Bpk. Irwan Setiawan",
  "Bpk. Hasan Basri", "Ibu Dian Purnama", "Bpk. Firman Syah",
  "Bpk. Rizky Pratama", "Ibu Linda Susanti", "Bpk. Slamet Riyadi",
  "Bpk. Arief Budiman", "Ibu Ratna Dewi", "Bpk. Surya Dharma",
  "Bpk. Made Wira", "Ibu Putri Ayu", "Bpk. Komang Adi",
  "Bpk. Nyoman Suardana", "Ibu Ketut Devi", "Bpk. I Wayan Sudarta",
  "Bpk. Yusuf Maulana", "Ibu Fatimah Zahra", "Bpk. Ridwan Kamil",
  "Bpk. Andre Taulany", "Ibu Nia Ramadhani", "Bpk. Lukman Hakim",
  "Bpk. Saiful Anwar", "Ibu Kartini Putri", "Bpk. Doni Salmanan",
  "Bpk. Indra Gunawan", "Ibu Novita Sari", "Bpk. Feri Sulistyo",
  "Bpk. Andi Wijaya", "Ibu Mega Wati", "Bpk. Candra Kusuma",
  "Bpk. Putra Pratama", "Ibu Dewi Safitri", "Bpk. Galih Permana",
  "Bpk. Herman Susanto", "Ibu Laras Kinanti", "Bpk. Oscar Lawalata",
  "Bpk. Pandu Setiawan", "Ibu Qisthi Amalia", "Bpk. Rio Febrian",
];

const ADDRESSES = [
  "Jl. Sudirman No. 12, Jakarta", "Jl. Raya Bogor KM 24, Depok",
  "Perum Permata Hijau B/4, Jakarta", "Jl. Gatot Subroto Kav. 36, Jakarta",
  "Jl. Ahmad Yani No. 88, Bandung", "Jl. Diponegoro No. 15, Surabaya",
  "Jl. Pahlawan No. 9, Semarang", "Jl. Magelang KM 5, Yogyakarta",
  "Jl. Imam Bonjol No. 21, Medan", "Jl. Sam Ratulangi No. 33, Makassar",
  "Jl. Veteran No. 7, Malang", "Jl. Pemuda No. 45, Solo",
  "Komp. Industri Pulogadung Blk A3", "Kawasan BSD City, Tangerang",
  "Jl. Raya Serpong No. 100, Tangsel", "Jl. Margonda Raya No. 200, Depok",
  "Jl. Dago Pakar No. 18, Bandung", "Jl. Kaliurang KM 8, Yogyakarta",
  "Jl. Hayam Wuruk No. 52, Jakarta", "Jl. Asia Afrika No. 114, Bandung",
  "Jl. Thamrin No. 28, Jakarta", "Jl. Pajajaran No. 66, Bogor",
  "Jl. Braga No. 11, Bandung", "Jl. Malioboro No. 5, Yogyakarta",
];

const WORKSHOP_NAMES = [
  "Bengkel Las Karya Mandiri", "Woodworking Workshop Budi", "Bengkel Las Jaya",
  "Workshop Furniture Indah", "Bengkel Teknik Maju", "Workshop Kayu Sejati",
  "Bengkel Las Sinar", "Workshop Interior Prima", "Bengkel Mesin Sentosa",
  "Workshop Aluminium Karya", "Bengkel Las Barokah", "Workshop Besi Utama",
  "Bengkel Konstruksi Kokoh", "Workshop Plywood Center", "Bengkel Multi Jaya",
  "Workshop Panel Kreatif", "Bengkel Stainless Steel", "Workshop Kitchen Set",
  "Bengkel Pipa Abadi", "Workshop Partisi Modern",
];

const PROJECT_NAMES = [
  "Renovasi Ruko Dago", "Pembangunan Kost Grogol", "Proyek Gudang Cikarang",
  "Renovasi Kantor Sudirman", "Pembangunan Villa Puncak", "Proyek Rumah Mewah Kemang",
  "Renovasi Apartemen Kelapa Gading", "Pembangunan Pabrik Karawang",
  "Proyek Sekolah Depok", "Renovasi Masjid Al-Hikmah", "Pembangunan Ruko Serpong",
  "Proyek Hotel Bali", "Renovasi Restaurant PIK", "Pembangunan Klinik Bekasi",
  "Proyek Perumahan Cibubur", "Renovasi Mall Tangerang", "Pembangunan Cafe BSD",
  "Proyek Jembatan Karawaci", "Renovasi Rumah Sakit Bogor", "Pembangunan Gereja Manado",
  "Proyek Tower Surabaya", "Renovasi Gedung Semarang", "Pembangunan Dermaga Makassar",
  "Proyek Bandara Solo", "Renovasi Stadion Malang", "Pembangunan Taman Jogja",
  "Proyek Pasar Modern Batu", "Renovasi Pelabuhan Tanjung Priok",
  "Proyek Residence Alam Sutera", "Pembangunan Convention Center Sentul",
];

const RETURN_REASONS = [
  "Barang cacat/rusak dari pabrik", "Salah kirim barang", "Ukuran tidak sesuai pesanan",
  "Kualitas di bawah standar", "Warna tidak sesuai katalog", "Barang sudah kadaluarsa",
  "Kemasan rusak saat pengiriman", "Spesifikasi tidak cocok dengan kebutuhan proyek",
  "Customer berubah pikiran", "Kelebihan order", "Barang palsu / tidak original",
  "Retak / pecah saat pengiriman", "Berat tidak sesuai label", "Dimensi tidak presisi",
  "Material berkarat / korosi", "Fungsi tidak bekerja dengan baik",
];

// ============ MAIN SEED FUNCTION ============

async function main() {
  console.log("🔄 Memulai pembersihan database...");

  // Clean transactional data in correct order to prevent FK constraints issues
  await prisma.activityLog.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.return.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.item.deleteMany();
  await prisma.project.deleteMany();
  await prisma.projectGroup.deleteMany();
  await prisma.workshop.deleteMany();
  await prisma.client.deleteMany();

  // Clean up custom users except default admin accounts
  await prisma.user.deleteMany({
    where: {
      username: {
        notIn: ["kasir", "gudang"],
      },
    },
  });

  console.log("✅ Database dibersihkan. Memulai seeding 2000+ data...\n");

  // ============ USERS ============
  const seedPassword = resolveSeedPassword();
  const pass = await bcrypt.hash(seedPassword, 10);

  const userKasir = await prisma.user.upsert({
    where: { username: "kasir" },
    update: { password: pass, nama: "Admin Kasir", role: "ADMIN_KASIR", aktif: true },
    create: { username: "kasir", nama: "Admin Kasir", password: pass, role: "ADMIN_KASIR", aktif: true },
  });

  const userGudang = await prisma.user.upsert({
    where: { username: "gudang" },
    update: { password: pass, nama: "Admin Gudang", role: "ADMIN_GUDANG", aktif: true },
    create: { username: "gudang", nama: "Admin Gudang", password: pass, role: "ADMIN_GUDANG", aktif: true },
  });

  await prisma.user.upsert({
    where: { username: "nongudang" },
    update: { password: pass, nama: "Admin Non-Gudang", role: "ADMIN_NONGUDANG", aktif: true },
    create: { username: "nongudang", nama: "Admin Non-Gudang", password: pass, role: "ADMIN_NONGUDANG", aktif: true },
  });

  console.log("👤 Users seeded.");

  // ============ 2000 ITEMS ============
  console.log("📦 Generating 2000 items...");

  const TOTAL_ITEMS = 2000;
  const itemsToCreate: any[] = [];
  const usedNames = new Set<string>();

  for (let i = 1; i <= TOTAL_ITEMS; i++) {
    const prefix = pickRandom(MATERIAL_PREFIXES);
    const brand = pickRandom(MATERIAL_BRANDS);
    const type = pickRandom(MATERIAL_TYPES);
    const size = pickRandom(MATERIAL_SIZES);

    let nama = `${prefix} ${brand} ${type} ${size}`;
    // Ensure unique names
    let attempt = 0;
    while (usedNames.has(nama)) {
      attempt++;
      nama = `${prefix} ${brand} ${type} ${size} V${attempt}`;
    }
    usedNames.add(nama);

    const hargaBeli = randFloat(5000, 500000);
    const margin = rand(10, 35); // 10-35% margin
    const hargaJual = Math.round(hargaBeli * (1 + margin / 100) / 500) * 500;
    const stokAwal = rand(5, 500);
    const minStok = rand(3, Math.min(50, Math.floor(stokAwal * 0.3)));
    const aktif = Math.random() > 0.05; // 95% aktif

    itemsToCreate.push({
      kode: `PC-${padNum(i, 5)}`,
      nama,
      hargaBeli,
      hargaJual,
      stokAwal,
      minStok,
      aktif,
    });
  }

  // Batch insert items in chunks of 500
  for (let chunk = 0; chunk < itemsToCreate.length; chunk += 500) {
    const batch = itemsToCreate.slice(chunk, chunk + 500);
    await prisma.item.createMany({ data: batch });
    console.log(`  📦 Items batch ${Math.floor(chunk / 500) + 1}/4 inserted (${batch.length} items)`);
  }

  // Fetch all items for downstream relations.
  const allItems = await prisma.item.findMany({ orderBy: { id: "asc" } });
  console.log(`  Seeded ${allItems.length} items.\n`);

  // ============ 100 CLIENTS ============
  console.log("👥 Generating 100 clients...");
  const clientsData: any[] = [];
  const allClientNames = [...CLIENT_NAMES, ...PERSON_NAMES];
  for (let i = 0; i < 100; i++) {
    const nama = i < allClientNames.length
      ? allClientNames[i]
      : `${pickRandom(CLIENT_NAMES)} Cabang ${i - allClientNames.length + 1}`;
    clientsData.push({
      nama,
      alamat: pickRandom(ADDRESSES),
      telepon: `08${rand(10, 99)}${rand(1000000, 9999999)}`,
    });
  }
  await prisma.client.createMany({ data: clientsData });
  const allClients = await prisma.client.findMany();
  console.log(`  ✅ ${allClients.length} clients seeded.\n`);

  // ============ 20 WORKSHOPS ============
  console.log("🏭 Generating 20 workshops...");
  const workshopsData: any[] = [];
  for (let i = 0; i < 20; i++) {
    workshopsData.push({
      nama: i < WORKSHOP_NAMES.length ? WORKSHOP_NAMES[i] : `Workshop Extra ${i + 1}`,
      alamat: pickRandom(ADDRESSES),
    });
  }
  await prisma.workshop.createMany({ data: workshopsData });
  const allWorkshops = await prisma.workshop.findMany();
  console.log(`  ✅ ${allWorkshops.length} workshops seeded.\n`);

  // ============ PROJECT GROUPS & PROJECTS ============
  console.log("📁 Generating project groups & projects...");
  const pgData = [
    { nama: "Putnam Group" },
    { nama: "Sinar Utama Group" },
    { nama: "Mega Proyek Nusantara" },
    { nama: "Bangunan Prima Group" },
    { nama: "Karya Lestari Group" },
  ];
  await prisma.projectGroup.createMany({ data: pgData });
  const allPGs = await prisma.projectGroup.findMany();

  const projectsData: any[] = [];
  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    projectsData.push({
      nama: PROJECT_NAMES[i],
      projectGroupId: pickRandom(allPGs).id,
    });
  }
  await prisma.project.createMany({ data: projectsData });
  const allProjects = await prisma.project.findMany();
  console.log(`  ✅ ${allPGs.length} project groups + ${allProjects.length} projects seeded.\n`);

  // ============ 500 TRANSACTIONS ============
  console.log("💰 Generating 500 transactions with items & stock ledgers...");

  const startDate = new Date("2026-01-15T08:00:00Z");
  const endDate = new Date("2026-06-23T23:59:00Z");
  let txCounter = 0;
  let invCounter = 0;

  // We'll create transactions one by one since each needs items + ledgers
  for (let batch = 0; batch < 10; batch++) {
    const batchSize = 50;
    const batchStart = batch * batchSize;

    for (let i = 0; i < batchSize; i++) {
      txCounter++;
      const tanggal = randomDate(startDate, endDate);
      const isProject = Math.random() > 0.4; // 60% project
      const client = pickRandom(allClients);
      const workshop = Math.random() > 0.5 ? pickRandom(allWorkshops) : null;
      const project = isProject ? pickRandom(allProjects) : null;

      // Pick 1-6 random items for this transaction
      const numItems = rand(1, 6);
      const txItems: any[] = [];
      const selectedItemIds = new Set<number>();
      let grandTotal = 0;

      for (let j = 0; j < numItems; j++) {
        const item = pickRandom(allItems);
        if (selectedItemIds.has(item.id)) continue;
        selectedItemIds.add(item.id);

        const qty = rand(1, 30);
        const hargaJual = Number(item.hargaJual);
        const hargaBeli = Number(item.hargaBeli);
        const subtotal = hargaJual * qty;
        grandTotal += subtotal;

        txItems.push({
          itemId: item.id,
          namaSnapshot: item.nama,
          hargaSnapshot: hargaJual,
          hargaBeliSnapshot: hargaBeli,
          qty,
          subtotal,
        });
      }

      if (txItems.length === 0) continue;

      const tx = await prisma.transaction.create({
        data: {
          noTransaksi: `PC${padNum(txCounter, 5)}`,
          tanggal,
          tipe: isProject ? "PROJECT" : "RETAIL",
          clientId: isProject ? client.id : null,
          workshopId: workshop?.id ?? null,
          projectId: project?.id ?? null,
          namaClient: isProject ? client.nama : null,
          alamat: isProject ? client.alamat : null,
          namaWs: workshop?.nama ?? null,
          grandTotal,
          userId: pickRandom([userKasir.id, userGudang.id]),
          items: {
            createMany: { data: txItems },
          },
        },
      });

      // Create stock ledger entries for each item
      const ledgerEntries = txItems.map((ti: any) => ({
        itemId: ti.itemId,
        tanggal,
        tipe: "KELUAR" as const,
        qty: -ti.qty,
        refType: "TRANSACTION",
        refId: tx.id,
        userId: tx.userId,
      }));
      await prisma.stockLedger.createMany({ data: ledgerEntries });

      // Create invoice for this transaction
      invCounter++;
      const isPaid = Math.random() > 0.3; // 70% paid
      const totalDibayar = isPaid
        ? grandTotal
        : Math.round(grandTotal * (Math.random() * 0.7) / 1000) * 1000;

      await prisma.invoice.create({
        data: {
          noInvoice: `INV-${padNum(invCounter, 5)}`,
          tanggal,
          status: isPaid ? "LUNAS" : "PENDING",
          clientId: isProject ? client.id : null,
          projectId: project?.id ?? null,
          namaClient: isProject ? client.nama : null,
          alamat: isProject ? client.alamat : null,
          namaWs: workshop?.nama ?? null,
          transactionId: tx.id,
          total: grandTotal,
          totalDibayar,
        },
      });
    }

    console.log(`  💰 Transaction batch ${batch + 1}/10 done (${batchStart + batchSize} transactions)`);
  }

  console.log(`  ✅ ${txCounter} transactions + invoices seeded.\n`);

  // ============ 50 RETURNS ============
  console.log("🔄 Generating 50 returns...");

  const allTransactions = await prisma.transaction.findMany({
    take: 100,
    orderBy: { tanggal: "desc" },
    include: { items: true },
  });

  let retCounter = 0;
  for (let i = 0; i < 50 && i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    if (tx.items.length === 0) continue;

    retCounter++;
    const txItem = pickRandom(tx.items);
    const qtyRetur = rand(1, Math.min(3, txItem.qty));
    const isSwap = Math.random() > 0.7; // 30% tukar
    const swapItem = isSwap ? pickRandom(allItems) : null;
    const qtyGanti = isSwap ? qtyRetur : undefined;

    const hargaRetur = Number(txItem.hargaSnapshot);
    const subtotalRetur = hargaRetur * qtyRetur;
    const hargaGanti = swapItem ? Number(swapItem.hargaJual) : undefined;
    const subtotalGanti = isSwap && hargaGanti && qtyGanti ? hargaGanti * qtyGanti : undefined;

    const selisih = isSwap && subtotalGanti
      ? subtotalGanti - subtotalRetur
      : -subtotalRetur;

    const retDate = new Date(tx.tanggal.getTime() + rand(1, 7) * 86400000);

    const ret = await prisma.return.create({
      data: {
        noReturn: `RET-${padNum(retCounter, 5)}`,
        tanggal: retDate,
        tipe: isSwap ? "TUKAR" : "RETUR",
        transactionId: tx.id,
        alasan: pickRandom(RETURN_REASONS),
        selisih,
        namaClient: tx.namaClient,
        alamat: tx.alamat,
        namaWs: tx.namaWs,
        userId: pickRandom([userKasir.id, userGudang.id]),
        items: {
          create: {
            transactionItemId: txItem.id,
            itemId: txItem.itemId,
            namaSnapshot: txItem.namaSnapshot,
            hargaSnapshot: txItem.hargaSnapshot,
            qtyReturned: qtyRetur,
            subtotal: subtotalRetur,
            ...(isSwap && swapItem && qtyGanti && hargaGanti ? {
              itemGantiId: swapItem.id,
              namaGantiSnapshot: swapItem.nama,
              hargaGantiSnapshot: hargaGanti,
              qtyGanti,
              subtotalGanti: subtotalGanti,
            } : {}),
          },
        },
      },
    });

    // Stock ledger for return
    await prisma.stockLedger.create({
      data: {
        itemId: txItem.itemId,
        tanggal: retDate,
        tipe: "RETUR",
        qty: qtyRetur,
        refType: "RETURN",
        refId: ret.id,
        userId: ret.userId,
      },
    });

    // If swap, create outgoing ledger for new item
    if (isSwap && swapItem && qtyGanti) {
      await prisma.stockLedger.create({
        data: {
          itemId: swapItem.id,
          tanggal: retDate,
          tipe: "KELUAR",
          qty: -qtyGanti,
          refType: "RETURN",
          refId: ret.id,
          userId: ret.userId,
        },
      });
    }

    // Return invoice
    invCounter++;
    await prisma.invoice.create({
      data: {
        noInvoice: `INV-R${padNum(retCounter, 5)}`,
        tanggal: retDate,
        status: "LUNAS",
        returnId: ret.id,
        total: selisih,
        totalDibayar: selisih,
      },
    });
  }

  console.log(`  ✅ ${retCounter} returns seeded.\n`);

  // ============ EXTRA STOCK MOVEMENTS (MASUK + KOREKSI) ============
  console.log("📊 Generating extra stock movements (restock + adjustments)...");

  const extraLedgers: any[] = [];
  // 200 restock entries
  for (let i = 0; i < 200; i++) {
    const item = pickRandom(allItems);
    extraLedgers.push({
      itemId: item.id,
      tanggal: randomDate(startDate, endDate),
      tipe: "MASUK" as const,
      qty: rand(10, 200),
      keterangan: `Restock dari supplier - PO#${rand(1000, 9999)}`,
      refType: "MANUAL",
      userId: userGudang.id,
    });
  }

  // 100 stock corrections
  for (let i = 0; i < 100; i++) {
    const item = pickRandom(allItems);
    const isPositive = Math.random() > 0.4;
    extraLedgers.push({
      itemId: item.id,
      tanggal: randomDate(startDate, endDate),
      tipe: "KOREKSI" as const,
      qty: isPositive ? rand(1, 15) : -rand(1, 10),
      keterangan: isPositive ? "Koreksi stock opname (selisih +)" : "Koreksi stock opname (selisih -)",
      refType: "MANUAL",
      userId: userGudang.id,
    });
  }

  for (let chunk = 0; chunk < extraLedgers.length; chunk += 200) {
    const batch = extraLedgers.slice(chunk, chunk + 200);
    await prisma.stockLedger.createMany({ data: batch });
  }
  console.log(`  ✅ ${extraLedgers.length} extra stock movements seeded.\n`);

  // ============ COUNTERS ============
  await prisma.counter.createMany({
    data: [
      { id: "transaksi", prefix: "PC", value: txCounter },
      { id: "return", prefix: "RET", value: retCounter },
      { id: "invoice", prefix: "INV", value: invCounter },
    ],
  });
  console.log("🔢 Counters seeded.");

  // ============ ACTIVITY LOGS ============
  console.log("📝 Generating activity logs...");

  const logActions = [
    "USER_LOGIN", "CREATE_TRANSAKSI", "UPDATE_HARGA", "IMPORT_BARANG",
    "CREATE_RETUR", "UPDATE_STOK", "CREATE_INVOICE", "BAYAR_INVOICE",
    "TOGGLE_AKTIF", "CETAK_NOTA", "EXPORT_LAPORAN", "UPDATE_PROFIL",
  ];

  const logEntities = ["User", "Transaction", "Item", "Return", "Invoice", "StockLedger"];

  const activityLogs: any[] = [];
  for (let i = 0; i < 300; i++) {
    activityLogs.push({
      userId: pickRandom([userKasir.id, userGudang.id]),
      aksi: pickRandom(logActions),
      entitas: pickRandom(logEntities),
      entitasId: String(rand(1, 2000)),
      detail: `Auto-generated activity log #${i + 1}`,
      createdAt: randomDate(startDate, endDate),
    });
  }

  for (let chunk = 0; chunk < activityLogs.length; chunk += 200) {
    const batch = activityLogs.slice(chunk, chunk + 200);
    await prisma.activityLog.createMany({ data: batch });
  }
  console.log(`  ✅ ${activityLogs.length} activity logs seeded.\n`);

  // ============ SUMMARY ============
  const totalItemsCount = await prisma.item.count();
  const totalClientsCount = await prisma.client.count();
  const totalTxCount = await prisma.transaction.count();
  const totalInvCount = await prisma.invoice.count();
  const totalRetCount = await prisma.return.count();
  const totalLedgerCount = await prisma.stockLedger.count();
  const totalLogCount = await prisma.activityLog.count();

  console.log("=========================================");
  console.log("🎉 PROSES SEED SELESAI DENGAN SUKSES!");
  console.log("=========================================");
  console.log(`📦 Items:          ${totalItemsCount}`);
  console.log(`👥 Clients:        ${totalClientsCount}`);
  console.log(`🏭 Workshops:      ${allWorkshops.length}`);
  console.log(`📁 Projects:       ${allProjects.length}`);
  console.log(`💰 Transactions:   ${totalTxCount}`);
  console.log(`🧾 Invoices:       ${totalInvCount}`);
  console.log(`🔄 Returns:        ${totalRetCount}`);
  console.log(`📋 Stock Ledgers:  ${totalLedgerCount}`);
  console.log(`📝 Activity Logs:  ${totalLogCount}`);
  console.log("=========================================");
  console.log("Login User:");
  const passwordLabel = "[from SEED_DEFAULT_PASSWORD]";
  console.log(`- Kasir:     username 'kasir'     / password '${passwordLabel}'`);
  console.log(`- Gudang:    username 'gudang'    / password '${passwordLabel}'`);
  console.log(`- NonGudang: username 'nongudang' / password '${passwordLabel}'`);
  console.log("=========================================");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi error saat seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
