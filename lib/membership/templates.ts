export const FOLLOWUP_TEMPLATE_KEYS = {
  day30: "membership.followup.day30",
  day60: "membership.followup.day60",
  day90: "membership.followup.day90",
  day120: "membership.followup.day120",
  birthday: "membership.followup.birthday",
} as const;

export type FollowupTemplateStage = keyof typeof FOLLOWUP_TEMPLATE_KEYS;

export const DEFAULT_FOLLOWUP_TEMPLATES: Record<FollowupTemplateStage, string> = {
  day30:
    "Halo {nama}, apa kabar? Udah sebulan sejak {treatment} terakhir kamu di Kalanara. Yuk recharge badan kamu lagi, mau aku bantu reservasi ulang?",
  day60:
    "Hai {nama}, badan udah mulai pegal lagi belum? Stamp kamu sekarang {stamp}, tinggal {sisa} lagi buat {reward_berikutnya}. Kabarin aja kalau mau aku cariin jadwal ya.",
  day90:
    "Halo {nama}, kangen nih! Udah 3 bulan kamu belum mampir ke Kalanara. Mau aku siapin slot akhir pekan ini? Tinggal balas jam yang kamu mau.",
  day120:
    "Hai {nama}, ini pesan terakhir dari aku biar nggak ganggu ya. Kalau kapan-kapan butuh me-time, Kalanara selalu siap. Kartu member kamu: {link_kartu}",
  birthday:
    "Selamat ulang tahun, {nama}! Semoga sehat dan bahagia selalu. Ada hadiah kecil dari Kalanara: diskon 25% buat 1 treatment, berlaku sampai {tanggal_akhir}. Mau aku bantu reservasi?",
};

export interface FollowupTemplateValues {
  nama: string;
  treatment: string;
  stamp: string;
  sisa: string;
  reward_berikutnya: string;
  link_kartu: string;
  tanggal_akhir: string;
}

export function fillFollowupTemplate(
  template: string,
  values: FollowupTemplateValues,
): string {
  const replacements: Record<string, string> = {
    ...values,
    treatment_terakhir: values.treatment,
  };

  return template.replace(/\{([a-z0-9_]+)\}/gi, (match, key: string) => {
    return replacements[key] ?? match;
  });
}

export function whatsAppLink(phone: string, text: string): string | null {
  if (!/^62[0-9]{8,13}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
