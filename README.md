# Wireless Mirror

Wireless Mirror adalah launcher sederhana untuk menjalankan scrcpy wireless di Windows.

![Tampilan aplikasi](sampel.png)

## Cara Pakai dari Source

Clone repository:

```bash
git clone <url-repository-anda>
cd Mirror-Android-Wireless
```

Install dependency:

```bash
npm install
```

Jalankan saat development:

```bash
npm start
```

Build aplikasi Windows:

```bash
npm run build
```

Hasil build ada di folder:

```text
dist/Mirror Wireless-win32-x64
```

## Catatan

- Folder `tools/scrcpy` harus ikut ada di repository karena berisi `adb.exe`, `scrcpy.exe`, dan file pendukungnya.
- Jangan upload `node_modules` dan `dist`; keduanya bisa dibuat ulang dengan `npm install` dan `npm run build`.
- Untuk Xiaomi/MIUI, aktifkan `USB debugging (setelan keamanan)` agar kontrol mouse berfungsi.
