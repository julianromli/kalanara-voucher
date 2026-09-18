-- ============================================================================
-- Seed landing-page copy JSON in site_settings
-- Date: 2026-09-18
-- Purpose:
--   Store editable landing copy as one JSON document per section so
--   /admin/crm can manage hero, me-time, services, testimonials,
--   trust, and footer text without a new table.
-- ============================================================================

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'landing_hero',
    $landing${"eyebrow":"Selamat Datang di Kalanara","titleLine1":"Hadiah Spesial","titleLine2Before":"untuk","titleEmphasis":"Me Time","description":"Voucher spa premium untuk diri sendiri atau orang tersayang. Nikmati perawatan terbaik dari terapis profesional di Kalanara Spa Galaxy, Bekasi.","primaryCta":"Lihat Paket Voucher","secondaryCta":"Cek Voucher Kamu"}$landing$,
    'JSON copy for the landing hero section'
  ),
  (
    'landing_me_time',
    $landing${"eyebrow":"Kamu pasti relate","titleBefore":"Kapan terakhir kali dia benar-benar","titleEmphasis":"me-time?","description":"Kamu tahu ia sudah capek. Kamu ingin berterima kasih. Tapi bingung mau kasih apa yang terasa bermakna.","personas":[{"emoji":"👩‍👧","quote":"“Mama kerja keras tiap hari, kapan aku kasih dia waktu buat dirinya sendiri?”","label":"Hadiah yang lebih bermakna dari bunga atau kue"},{"emoji":"💑","quote":"“Dia selalu support aku. Pengen kasih sesuatu yang beda, bukan yang biasa-biasa.”","label":"Buat pasangan yang layak dipanjakan"},{"emoji":"👯‍♀️","quote":"“Ultahnya sebentar lagi, dan aku mau kasih hadiah yang dia ingat terus.”","label":"Hadiah yang terasa personal dan thoughtful"},{"emoji":"🌙","quote":"“Aku sendiri juga udah lama nggak punya me-time. Ini saatnya.”","label":"Karena merawat diri bukan kemewahan — itu kebutuhan"}],"ctaEyebrow":"Yang kamu rasakan, bukan cuma kamu","ctaTitleBefore":"Semua orang butuh waktu untuk","ctaTitleEmphasis":"benar-benar istirahat","ctaTitleAfter":"— bukan sekadar libur.","ctaBody":"Dan hadiah terbaik yang bisa kamu berikan adalah waktu — waktu yang diisi dengan ketenangan, bukan kesibukan.","ctaHighlight":"Biar kami yang urus sisanya.","ctaButton":"Lihat Pilihan Gift Voucher"}$landing$,
    'JSON copy for the landing me-time section'
  ),
  (
    'landing_services',
    $landing${"title":"Pilihan Paket Voucher","description":"Pilih voucher spa untuk diri sendiri atau hadiah spesial untuk orang tersayang.","emptyState":"Belum ada paket tersedia saat ini."}$landing$,
    'JSON copy for the landing services heading'
  ),
  (
    'landing_testimonials',
    $landing${"titleBefore":"500+ Perempuan sudah merasakannya.","titleEmphasis":"Kamu bisa juga.","description":"Hadiah yang paling diingat adalah yang terasa paling personal — bukan yang paling mahal."}$landing$,
    'JSON copy for the landing testimonials heading'
  ),
  (
    'landing_trust',
    $landing${"title":"Kenapa Pilih Kami","features":[{"title":"Langsung Dikirim","description":"Voucher otomatis terkirim via WhatsApp dan Email setelah pembayaran berhasil."},{"title":"Berlaku 12 Bulan","description":"Fleksibel digunakan kapan saja sesuai jadwal kamu."},{"title":"Pembayaran Aman","description":"Transaksi terpercaya via QRIS, Transfer Bank, dan Kartu Kredit."}]}$landing$,
    'JSON copy for the landing trust section'
  ),
  (
    'landing_footer',
    $landing${"ctaTitleBefore":"Hadiah Terbaik untuk","ctaEmphasis":"Relaksasi","ctaDescription":"Voucher spa premium untuk orang tersayang.","ctaButton":"Buy Voucher Sekarang","newsletterTitle":"Tips Wellness dan Promo Eksklusif","newsletterDescription":"Dapatkan info perawatan terbaru, promo spesial, dan akses awal ke paket treatment baru.","newsletterPlaceholder":"Alamat email kamu","newsletterButton":"Langganan","copyright":"Kalanara Spa Galaxy, Bekasi. Khusus Wanita.","columns":[{"title":"Voucher Spa","links":[{"name":"Semua Voucher","href":"/#services"},{"name":"Paket Massage","href":"/#services"},{"name":"Paket Body Treatment","href":"/#services"},{"name":"Paket Facial","href":"/#services"}]},{"title":"Kalanara Spa","links":[{"name":"Tentang Kami","href":"/about"},{"name":"Layanan Kami","href":"/#services"},{"name":"Hubungi Kami","href":"/contact"}]},{"title":"Bantuan","links":[{"name":"Cara Pembelian","href":"/how-it-works"},{"name":"FAQ","href":"/faq"},{"name":"Tukar Voucher","href":"/verify"}]},{"title":"Legal","links":[{"name":"Syarat & Ketentuan","href":"/terms"},{"name":"Kebijakan Privasi","href":"/privacy"}]}],"social":[{"label":"Facebook","href":"https://facebook.com"},{"label":"Twitter","href":"https://twitter.com"},{"label":"LinkedIn","href":"https://linkedin.com"},{"label":"Instagram","href":"https://instagram.com"}]}$landing$,
    'JSON copy for the landing footer'
  )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;
