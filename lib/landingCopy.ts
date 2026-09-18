import { z } from "zod";

export const LANDING_COPY_LIMITS = {
  eyebrow: 80,
  title: 120,
  emphasis: 80,
  body: 600,
  cta: 80,
  emoji: 16,
  quote: 280,
  label: 120,
  url: 500,
} as const;

export const LANDING_COPY_SECTIONS = [
  "hero",
  "meTime",
  "services",
  "testimonials",
  "trust",
  "footer",
] as const;

export type LandingCopySection = (typeof LANDING_COPY_SECTIONS)[number];

export const LANDING_COPY_SETTING_KEY = {
  hero: "landing_hero",
  meTime: "landing_me_time",
  services: "landing_services",
  testimonials: "landing_testimonials",
  trust: "landing_trust",
  footer: "landing_footer",
} as const satisfies Record<LandingCopySection, string>;

export const LANDING_COPY_SETTING_KEYS = [
  LANDING_COPY_SETTING_KEY.hero,
  LANDING_COPY_SETTING_KEY.meTime,
  LANDING_COPY_SETTING_KEY.services,
  LANDING_COPY_SETTING_KEY.testimonials,
  LANDING_COPY_SETTING_KEY.trust,
  LANDING_COPY_SETTING_KEY.footer,
] as const;

export type LandingCopySettingKey =
  (typeof LANDING_COPY_SETTING_KEYS)[number];

export const LANDING_COPY_SETTING_DESCRIPTIONS: Record<
  LandingCopySettingKey,
  string
> = {
  landing_hero: "JSON copy for the landing hero section",
  landing_me_time: "JSON copy for the landing me-time section",
  landing_services: "JSON copy for the landing services heading",
  landing_testimonials: "JSON copy for the landing testimonials heading",
  landing_trust: "JSON copy for the landing trust section",
  landing_footer: "JSON copy for the landing footer",
};

export const PUBLIC_LANDING_SETTING_KEYS = [
  "hero_image_url",
  ...LANDING_COPY_SETTING_KEYS,
] as const;

export interface HeroCopy {
  eyebrow: string;
  titleLine1: string;
  titleLine2Before: string;
  titleEmphasis: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface MeTimePersonaCopy {
  emoji: string;
  quote: string;
  label: string;
}

export interface MeTimeCopy {
  eyebrow: string;
  titleBefore: string;
  titleEmphasis: string;
  description: string;
  personas: [MeTimePersonaCopy, MeTimePersonaCopy, MeTimePersonaCopy, MeTimePersonaCopy];
  ctaEyebrow: string;
  ctaTitleBefore: string;
  ctaTitleEmphasis: string;
  ctaTitleAfter: string;
  ctaBody: string;
  ctaHighlight: string;
  ctaButton: string;
}

export interface ServicesCopy {
  title: string;
  description: string;
  emptyState: string;
}

export interface TestimonialsCopy {
  titleBefore: string;
  titleEmphasis: string;
  description: string;
}

export interface TrustFeatureCopy {
  title: string;
  description: string;
}

export interface TrustCopy {
  title: string;
  features: [TrustFeatureCopy, TrustFeatureCopy, TrustFeatureCopy];
}

export interface FooterLinkCopy {
  name: string;
  href: string;
}

export interface FooterColumnCopy {
  title: string;
  links: FooterLinkCopy[];
}

export interface FooterSocialCopy {
  label: string;
  href: string;
}

export interface FooterCopy {
  ctaTitleBefore: string;
  ctaEmphasis: string;
  ctaDescription: string;
  ctaButton: string;
  newsletterTitle: string;
  newsletterDescription: string;
  newsletterPlaceholder: string;
  newsletterButton: string;
  copyright: string;
  columns: [
    FooterColumnCopy,
    FooterColumnCopy,
    FooterColumnCopy,
    FooterColumnCopy,
  ];
  social: [
    FooterSocialCopy,
    FooterSocialCopy,
    FooterSocialCopy,
    FooterSocialCopy,
  ];
}

export interface LandingCopy {
  hero: HeroCopy;
  meTime: MeTimeCopy;
  services: ServicesCopy;
  testimonials: TestimonialsCopy;
  trust: TrustCopy;
  footer: FooterCopy;
}

export const DEFAULT_LANDING_COPY: LandingCopy = {
  hero: {
    eyebrow: "Selamat Datang di Kalanara",
    titleLine1: "Hadiah Spesial",
    titleLine2Before: "untuk",
    titleEmphasis: "Me Time",
    description:
      "Voucher spa premium untuk diri sendiri atau orang tersayang. Nikmati perawatan terbaik dari terapis profesional di Kalanara Spa Galaxy, Bekasi.",
    primaryCta: "Lihat Paket Voucher",
    secondaryCta: "Cek Voucher Kamu",
  },
  meTime: {
    eyebrow: "Kamu pasti relate",
    titleBefore: "Kapan terakhir kali dia benar-benar",
    titleEmphasis: "me-time?",
    description:
      "Kamu tahu ia sudah capek. Kamu ingin berterima kasih. Tapi bingung mau kasih apa yang terasa bermakna.",
    personas: [
      {
        emoji: "👩‍👧",
        quote:
          "“Mama kerja keras tiap hari, kapan aku kasih dia waktu buat dirinya sendiri?”",
        label: "Hadiah yang lebih bermakna dari bunga atau kue",
      },
      {
        emoji: "💑",
        quote:
          "“Dia selalu support aku. Pengen kasih sesuatu yang beda, bukan yang biasa-biasa.”",
        label: "Buat pasangan yang layak dipanjakan",
      },
      {
        emoji: "👯‍♀️",
        quote:
          "“Ultahnya sebentar lagi, dan aku mau kasih hadiah yang dia ingat terus.”",
        label: "Hadiah yang terasa personal dan thoughtful",
      },
      {
        emoji: "🌙",
        quote: "“Aku sendiri juga udah lama nggak punya me-time. Ini saatnya.”",
        label: "Karena merawat diri bukan kemewahan — itu kebutuhan",
      },
    ],
    ctaEyebrow: "Yang kamu rasakan, bukan cuma kamu",
    ctaTitleBefore: "Semua orang butuh waktu untuk",
    ctaTitleEmphasis: "benar-benar istirahat",
    ctaTitleAfter: "— bukan sekadar libur.",
    ctaBody:
      "Dan hadiah terbaik yang bisa kamu berikan adalah waktu — waktu yang diisi dengan ketenangan, bukan kesibukan.",
    ctaHighlight: "Biar kami yang urus sisanya.",
    ctaButton: "Lihat Pilihan Gift Voucher",
  },
  services: {
    title: "Pilihan Paket Voucher",
    description:
      "Pilih voucher spa untuk diri sendiri atau hadiah spesial untuk orang tersayang.",
    emptyState: "Belum ada paket tersedia saat ini.",
  },
  testimonials: {
    titleBefore: "500+ Perempuan sudah merasakannya.",
    titleEmphasis: "Kamu bisa juga.",
    description:
      "Hadiah yang paling diingat adalah yang terasa paling personal — bukan yang paling mahal.",
  },
  trust: {
    title: "Kenapa Pilih Kami",
    features: [
      {
        title: "Langsung Dikirim",
        description:
          "Voucher otomatis terkirim via WhatsApp dan Email setelah pembayaran berhasil.",
      },
      {
        title: "Berlaku 12 Bulan",
        description: "Fleksibel digunakan kapan saja sesuai jadwal kamu.",
      },
      {
        title: "Pembayaran Aman",
        description:
          "Transaksi terpercaya via QRIS, Transfer Bank, dan Kartu Kredit.",
      },
    ],
  },
  footer: {
    ctaTitleBefore: "Hadiah Terbaik untuk",
    ctaEmphasis: "Relaksasi",
    ctaDescription: "Voucher spa premium untuk orang tersayang.",
    ctaButton: "Buy Voucher Sekarang",
    newsletterTitle: "Tips Wellness dan Promo Eksklusif",
    newsletterDescription:
      "Dapatkan info perawatan terbaru, promo spesial, dan akses awal ke paket treatment baru.",
    newsletterPlaceholder: "Alamat email kamu",
    newsletterButton: "Langganan",
    copyright: "Kalanara Spa Galaxy, Bekasi. Khusus Wanita.",
    columns: [
      {
        title: "Voucher Spa",
        links: [
          { name: "Semua Voucher", href: "/#services" },
          { name: "Paket Massage", href: "/#services" },
          { name: "Paket Body Treatment", href: "/#services" },
          { name: "Paket Facial", href: "/#services" },
        ],
      },
      {
        title: "Kalanara Spa",
        links: [
          { name: "Tentang Kami", href: "/about" },
          { name: "Layanan Kami", href: "/#services" },
          { name: "Hubungi Kami", href: "/contact" },
        ],
      },
      {
        title: "Bantuan",
        links: [
          { name: "Cara Pembelian", href: "/how-it-works" },
          { name: "FAQ", href: "/faq" },
          { name: "Tukar Voucher", href: "/verify" },
        ],
      },
      {
        title: "Legal",
        links: [
          { name: "Syarat & Ketentuan", href: "/terms" },
          { name: "Kebijakan Privasi", href: "/privacy" },
        ],
      },
    ],
    social: [
      { label: "Facebook", href: "https://facebook.com" },
      { label: "Twitter", href: "https://twitter.com" },
      { label: "LinkedIn", href: "https://linkedin.com" },
      { label: "Instagram", href: "https://instagram.com" },
    ],
  },
};

const FOOTER_COLUMN_LINK_COUNTS = DEFAULT_LANDING_COPY.footer.columns.map(
  (column) => column.links.length
) as [number, number, number, number];

export function isInternalSitePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidFooterHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LANDING_COPY_LIMITS.url) {
    return false;
  }

  return isInternalSitePath(trimmed) || isHttpUrl(trimmed);
}

export function isValidSocialHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.length > LANDING_COPY_LIMITS.url) {
    return false;
  }

  return isHttpUrl(trimmed);
}

function requiredText(max: number) {
  return z
    .string()
    .trim()
    .min(1, { error: "Kolom ini wajib diisi." })
    .max(max, { error: `Maksimal ${max} karakter.` });
}

function optionalUrlText() {
  return z
    .string()
    .trim()
    .max(LANDING_COPY_LIMITS.url, {
      error: `Maksimal ${LANDING_COPY_LIMITS.url} karakter.`,
    })
    .refine(isValidSocialHref, {
      error:
        "Masukkan alamat website lengkap yang dimulai dengan https://, atau biarkan kosong untuk menyembunyikan tautan ini.",
    });
}

const footerHrefSchema = requiredText(LANDING_COPY_LIMITS.url).refine(
  isValidFooterHref,
  {
    error:
      "Masukkan path halaman seperti /verify, atau alamat website lengkap yang dimulai dengan https://.",
  }
);

const heroCopySchema = z.object({
  eyebrow: requiredText(LANDING_COPY_LIMITS.eyebrow),
  titleLine1: requiredText(LANDING_COPY_LIMITS.title),
  titleLine2Before: requiredText(LANDING_COPY_LIMITS.title),
  titleEmphasis: requiredText(LANDING_COPY_LIMITS.emphasis),
  description: requiredText(LANDING_COPY_LIMITS.body),
  primaryCta: requiredText(LANDING_COPY_LIMITS.cta),
  secondaryCta: requiredText(LANDING_COPY_LIMITS.cta),
});

const meTimePersonaSchema = z.object({
  emoji: requiredText(LANDING_COPY_LIMITS.emoji),
  quote: requiredText(LANDING_COPY_LIMITS.quote),
  label: requiredText(LANDING_COPY_LIMITS.label),
});

const meTimeCopySchema = z.object({
  eyebrow: requiredText(LANDING_COPY_LIMITS.eyebrow),
  titleBefore: requiredText(LANDING_COPY_LIMITS.title),
  titleEmphasis: requiredText(LANDING_COPY_LIMITS.emphasis),
  description: requiredText(LANDING_COPY_LIMITS.body),
  personas: z.tuple([
    meTimePersonaSchema,
    meTimePersonaSchema,
    meTimePersonaSchema,
    meTimePersonaSchema,
  ]),
  ctaEyebrow: requiredText(LANDING_COPY_LIMITS.eyebrow),
  ctaTitleBefore: requiredText(LANDING_COPY_LIMITS.title),
  ctaTitleEmphasis: requiredText(LANDING_COPY_LIMITS.emphasis),
  ctaTitleAfter: requiredText(LANDING_COPY_LIMITS.title),
  ctaBody: requiredText(LANDING_COPY_LIMITS.body),
  ctaHighlight: requiredText(LANDING_COPY_LIMITS.cta),
  ctaButton: requiredText(LANDING_COPY_LIMITS.cta),
});

const servicesCopySchema = z.object({
  title: requiredText(LANDING_COPY_LIMITS.title),
  description: requiredText(LANDING_COPY_LIMITS.body),
  emptyState: requiredText(LANDING_COPY_LIMITS.body),
});

const testimonialsCopySchema = z.object({
  titleBefore: requiredText(LANDING_COPY_LIMITS.title),
  titleEmphasis: requiredText(LANDING_COPY_LIMITS.emphasis),
  description: requiredText(LANDING_COPY_LIMITS.body),
});

const trustFeatureSchema = z.object({
  title: requiredText(LANDING_COPY_LIMITS.title),
  description: requiredText(LANDING_COPY_LIMITS.body),
});

const trustCopySchema = z.object({
  title: requiredText(LANDING_COPY_LIMITS.title),
  features: z.tuple([
    trustFeatureSchema,
    trustFeatureSchema,
    trustFeatureSchema,
  ]),
});

function footerColumnSchema(linkCount: number) {
  return z.object({
    title: requiredText(LANDING_COPY_LIMITS.label),
    links: z
      .array(
        z.object({
          name: requiredText(LANDING_COPY_LIMITS.label),
          href: footerHrefSchema,
        })
      )
      .length(linkCount),
  });
}

const footerCopySchema = z.object({
  ctaTitleBefore: requiredText(LANDING_COPY_LIMITS.title),
  ctaEmphasis: requiredText(LANDING_COPY_LIMITS.emphasis),
  ctaDescription: requiredText(LANDING_COPY_LIMITS.body),
  ctaButton: requiredText(LANDING_COPY_LIMITS.cta),
  newsletterTitle: requiredText(LANDING_COPY_LIMITS.title),
  newsletterDescription: requiredText(LANDING_COPY_LIMITS.body),
  newsletterPlaceholder: requiredText(LANDING_COPY_LIMITS.label),
  newsletterButton: requiredText(LANDING_COPY_LIMITS.cta),
  copyright: requiredText(LANDING_COPY_LIMITS.body),
  columns: z.tuple([
    footerColumnSchema(FOOTER_COLUMN_LINK_COUNTS[0]),
    footerColumnSchema(FOOTER_COLUMN_LINK_COUNTS[1]),
    footerColumnSchema(FOOTER_COLUMN_LINK_COUNTS[2]),
    footerColumnSchema(FOOTER_COLUMN_LINK_COUNTS[3]),
  ]),
  social: z.tuple([
    z.object({
      label: requiredText(LANDING_COPY_LIMITS.label),
      href: optionalUrlText(),
    }),
    z.object({
      label: requiredText(LANDING_COPY_LIMITS.label),
      href: optionalUrlText(),
    }),
    z.object({
      label: requiredText(LANDING_COPY_LIMITS.label),
      href: optionalUrlText(),
    }),
    z.object({
      label: requiredText(LANDING_COPY_LIMITS.label),
      href: optionalUrlText(),
    }),
  ]),
});

const landingCopySectionSchemas = {
  hero: heroCopySchema,
  meTime: meTimeCopySchema,
  services: servicesCopySchema,
  testimonials: testimonialsCopySchema,
  trust: trustCopySchema,
  footer: footerCopySchema,
} as const;

export function isLandingCopySection(
  value: string
): value is LandingCopySection {
  return (LANDING_COPY_SECTIONS as readonly string[]).includes(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function mergeString(value: unknown, fallback: string): string {
  return asTrimmedString(value) ?? fallback;
}

function parseJsonObject(raw: string | null | undefined): unknown {
  if (!raw || raw.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mergeHero(value: unknown, fallback: HeroCopy): HeroCopy {
  const source = asRecord(value);

  return {
    eyebrow: mergeString(source.eyebrow, fallback.eyebrow),
    titleLine1: mergeString(source.titleLine1, fallback.titleLine1),
    titleLine2Before: mergeString(
      source.titleLine2Before,
      fallback.titleLine2Before
    ),
    titleEmphasis: mergeString(source.titleEmphasis, fallback.titleEmphasis),
    description: mergeString(source.description, fallback.description),
    primaryCta: mergeString(source.primaryCta, fallback.primaryCta),
    secondaryCta: mergeString(source.secondaryCta, fallback.secondaryCta),
  };
}

function mergePersona(
  value: unknown,
  fallback: MeTimePersonaCopy
): MeTimePersonaCopy {
  const source = asRecord(value);

  return {
    emoji: mergeString(source.emoji, fallback.emoji),
    quote: mergeString(source.quote, fallback.quote),
    label: mergeString(source.label, fallback.label),
  };
}

function mergeMeTime(value: unknown, fallback: MeTimeCopy): MeTimeCopy {
  const source = asRecord(value);
  const personas = Array.isArray(source.personas) ? source.personas : [];

  return {
    eyebrow: mergeString(source.eyebrow, fallback.eyebrow),
    titleBefore: mergeString(source.titleBefore, fallback.titleBefore),
    titleEmphasis: mergeString(source.titleEmphasis, fallback.titleEmphasis),
    description: mergeString(source.description, fallback.description),
    personas: [
      mergePersona(personas[0], fallback.personas[0]),
      mergePersona(personas[1], fallback.personas[1]),
      mergePersona(personas[2], fallback.personas[2]),
      mergePersona(personas[3], fallback.personas[3]),
    ],
    ctaEyebrow: mergeString(source.ctaEyebrow, fallback.ctaEyebrow),
    ctaTitleBefore: mergeString(source.ctaTitleBefore, fallback.ctaTitleBefore),
    ctaTitleEmphasis: mergeString(
      source.ctaTitleEmphasis,
      fallback.ctaTitleEmphasis
    ),
    ctaTitleAfter: mergeString(source.ctaTitleAfter, fallback.ctaTitleAfter),
    ctaBody: mergeString(source.ctaBody, fallback.ctaBody),
    ctaHighlight: mergeString(source.ctaHighlight, fallback.ctaHighlight),
    ctaButton: mergeString(source.ctaButton, fallback.ctaButton),
  };
}

function mergeServices(value: unknown, fallback: ServicesCopy): ServicesCopy {
  const source = asRecord(value);

  return {
    title: mergeString(source.title, fallback.title),
    description: mergeString(source.description, fallback.description),
    emptyState: mergeString(source.emptyState, fallback.emptyState),
  };
}

function mergeTestimonials(
  value: unknown,
  fallback: TestimonialsCopy
): TestimonialsCopy {
  const source = asRecord(value);

  return {
    titleBefore: mergeString(source.titleBefore, fallback.titleBefore),
    titleEmphasis: mergeString(source.titleEmphasis, fallback.titleEmphasis),
    description: mergeString(source.description, fallback.description),
  };
}

function mergeTrustFeature(
  value: unknown,
  fallback: TrustFeatureCopy
): TrustFeatureCopy {
  const source = asRecord(value);

  return {
    title: mergeString(source.title, fallback.title),
    description: mergeString(source.description, fallback.description),
  };
}

function mergeTrust(value: unknown, fallback: TrustCopy): TrustCopy {
  const source = asRecord(value);
  const features = Array.isArray(source.features) ? source.features : [];

  return {
    title: mergeString(source.title, fallback.title),
    features: [
      mergeTrustFeature(features[0], fallback.features[0]),
      mergeTrustFeature(features[1], fallback.features[1]),
      mergeTrustFeature(features[2], fallback.features[2]),
    ],
  };
}

function mergeFooterLink(
  value: unknown,
  fallback: FooterLinkCopy
): FooterLinkCopy {
  const source = asRecord(value);
  const href = asTrimmedString(source.href);

  return {
    name: mergeString(source.name, fallback.name),
    href: href && isValidFooterHref(href) ? href : fallback.href,
  };
}

function mergeFooterColumn(
  value: unknown,
  fallback: FooterColumnCopy
): FooterColumnCopy {
  const source = asRecord(value);
  const links = Array.isArray(source.links) ? source.links : [];

  return {
    title: mergeString(source.title, fallback.title),
    links: fallback.links.map((link, index) =>
      mergeFooterLink(links[index], link)
    ),
  };
}

function mergeFooterSocial(
  value: unknown,
  fallback: FooterSocialCopy
): FooterSocialCopy {
  const source = asRecord(value);
  const href = typeof source.href === "string" ? source.href.trim() : undefined;

  return {
    label: mergeString(source.label, fallback.label),
    href:
      href === undefined
        ? fallback.href
        : href === "" || isValidSocialHref(href)
          ? href
          : fallback.href,
  };
}

function mergeFooter(value: unknown, fallback: FooterCopy): FooterCopy {
  const source = asRecord(value);
  const columns = Array.isArray(source.columns) ? source.columns : [];
  const social = Array.isArray(source.social) ? source.social : [];

  return {
    ctaTitleBefore: mergeString(source.ctaTitleBefore, fallback.ctaTitleBefore),
    ctaEmphasis: mergeString(source.ctaEmphasis, fallback.ctaEmphasis),
    ctaDescription: mergeString(source.ctaDescription, fallback.ctaDescription),
    ctaButton: mergeString(source.ctaButton, fallback.ctaButton),
    newsletterTitle: mergeString(
      source.newsletterTitle,
      fallback.newsletterTitle
    ),
    newsletterDescription: mergeString(
      source.newsletterDescription,
      fallback.newsletterDescription
    ),
    newsletterPlaceholder: mergeString(
      source.newsletterPlaceholder,
      fallback.newsletterPlaceholder
    ),
    newsletterButton: mergeString(
      source.newsletterButton,
      fallback.newsletterButton
    ),
    copyright: mergeString(source.copyright, fallback.copyright),
    columns: [
      mergeFooterColumn(columns[0], fallback.columns[0]),
      mergeFooterColumn(columns[1], fallback.columns[1]),
      mergeFooterColumn(columns[2], fallback.columns[2]),
      mergeFooterColumn(columns[3], fallback.columns[3]),
    ],
    social: [
      mergeFooterSocial(social[0], fallback.social[0]),
      mergeFooterSocial(social[1], fallback.social[1]),
      mergeFooterSocial(social[2], fallback.social[2]),
      mergeFooterSocial(social[3], fallback.social[3]),
    ],
  };
}

export function parseLandingCopySection<T extends LandingCopySection>(
  section: T,
  raw: string | null | undefined
): LandingCopy[T] {
  const parsed = parseJsonObject(raw);

  switch (section) {
    case "hero":
      return mergeHero(parsed, DEFAULT_LANDING_COPY.hero) as LandingCopy[T];
    case "meTime":
      return mergeMeTime(parsed, DEFAULT_LANDING_COPY.meTime) as LandingCopy[T];
    case "services":
      return mergeServices(
        parsed,
        DEFAULT_LANDING_COPY.services
      ) as LandingCopy[T];
    case "testimonials":
      return mergeTestimonials(
        parsed,
        DEFAULT_LANDING_COPY.testimonials
      ) as LandingCopy[T];
    case "trust":
      return mergeTrust(parsed, DEFAULT_LANDING_COPY.trust) as LandingCopy[T];
    case "footer":
      return mergeFooter(parsed, DEFAULT_LANDING_COPY.footer) as LandingCopy[T];
    default: {
      const exhaustive: never = section;
      throw new Error(`Unsupported landing copy section: ${exhaustive}`);
    }
  }
}

export function parseLandingCopyFromSettings(
  rows: Array<{ key: string; value: string }>
): LandingCopy {
  const values = new Map(rows.map(({ key, value }) => [key, value]));

  return {
    hero: parseLandingCopySection(
      "hero",
      values.get(LANDING_COPY_SETTING_KEY.hero)
    ),
    meTime: parseLandingCopySection(
      "meTime",
      values.get(LANDING_COPY_SETTING_KEY.meTime)
    ),
    services: parseLandingCopySection(
      "services",
      values.get(LANDING_COPY_SETTING_KEY.services)
    ),
    testimonials: parseLandingCopySection(
      "testimonials",
      values.get(LANDING_COPY_SETTING_KEY.testimonials)
    ),
    trust: parseLandingCopySection(
      "trust",
      values.get(LANDING_COPY_SETTING_KEY.trust)
    ),
    footer: parseLandingCopySection(
      "footer",
      values.get(LANDING_COPY_SETTING_KEY.footer)
    ),
  };
}

function firstZodIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Teks landing tidak valid.";
  }

  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function parseLandingCopySectionForSave<T extends LandingCopySection>(
  section: T,
  payload: unknown
): LandingCopy[T] {
  const result = landingCopySectionSchemas[section].safeParse(payload);
  if (!result.success) {
    throw new Error(firstZodIssueMessage(result.error));
  }

  return result.data as LandingCopy[T];
}

export function serializeLandingCopySection<T extends LandingCopySection>(
  section: T,
  payload: LandingCopy[T]
): string {
  return JSON.stringify(payload);
}

export function cloneLandingCopy<T>(value: T): T {
  return structuredClone(value);
}

export function mergeLandingCopyPreservingDirty(
  incoming: LandingCopy,
  current: LandingCopy,
  dirtySections: Iterable<LandingCopySection>
): LandingCopy {
  const next = cloneLandingCopy(incoming);

  for (const section of dirtySections) {
    switch (section) {
      case "hero":
        next.hero = current.hero;
        break;
      case "meTime":
        next.meTime = current.meTime;
        break;
      case "services":
        next.services = current.services;
        break;
      case "testimonials":
        next.testimonials = current.testimonials;
        break;
      case "trust":
        next.trust = current.trust;
        break;
      case "footer":
        next.footer = current.footer;
        break;
      default: {
        const exhaustive: never = section;
        throw new Error(`Unsupported landing copy section: ${exhaustive}`);
      }
    }
  }

  return next;
}
