"use client";

import { CrmCopyField } from "@/components/admin/crm-copy-field";
import { LANDING_COPY_LIMITS } from "@/lib/landingCopy";
import type {
  FooterCopy,
  HeroCopy,
  MeTimeCopy,
  ServicesCopy,
  TestimonialsCopy,
  TrustCopy,
} from "@/lib/landingCopy";

interface CopyFieldsProps<T> {
  copy: T;
  onChange: (copy: T) => void;
  disabled?: boolean;
}

export function HeroCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<HeroCopy>) {
  return (
    <div className="grid gap-4">
      <CrmCopyField
        id="hero-eyebrow"
        label="Teks kecil di atas judul"
        hint="Teks pendek di atas judul besar."
        value={copy.eyebrow}
        onChange={(value) => onChange({ ...copy, eyebrow: value })}
        maxLength={LANDING_COPY_LIMITS.eyebrow}
        disabled={disabled}
      />
      <CrmCopyField
        id="hero-title-1"
        label="Judul baris pertama"
        hint="Baris pertama judul besar."
        value={copy.titleLine1}
        onChange={(value) => onChange({ ...copy, titleLine1: value })}
        maxLength={LANDING_COPY_LIMITS.title}
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CrmCopyField
          id="hero-title-2"
          label="Judul baris kedua"
          hint="Teks biasa sebelum kata miring."
          value={copy.titleLine2Before}
          onChange={(value) => onChange({ ...copy, titleLine2Before: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="hero-emphasis"
          label="Kata yang dicetak miring"
          hint="Bagian judul yang tampil miring."
          value={copy.titleEmphasis}
          onChange={(value) => onChange({ ...copy, titleEmphasis: value })}
          maxLength={LANDING_COPY_LIMITS.emphasis}
          disabled={disabled}
        />
      </div>
      <CrmCopyField
        id="hero-description"
        label="Deskripsi"
        hint="Paragraf di bawah judul."
        value={copy.description}
        onChange={(value) => onChange({ ...copy, description: value })}
        maxLength={LANDING_COPY_LIMITS.body}
        multiline
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CrmCopyField
          id="hero-primary-cta"
          label="Teks tombol utama"
          hint="Tombol ke daftar paket voucher."
          value={copy.primaryCta}
          onChange={(value) => onChange({ ...copy, primaryCta: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
        <CrmCopyField
          id="hero-secondary-cta"
          label="Teks tautan kedua"
          hint="Tautan ke halaman cek voucher."
          value={copy.secondaryCta}
          onChange={(value) => onChange({ ...copy, secondaryCta: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function MeTimeCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<MeTimeCopy>) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <CrmCopyField
          id="metime-eyebrow"
          label="Teks kecil di atas judul"
          value={copy.eyebrow}
          onChange={(value) => onChange({ ...copy, eyebrow: value })}
          maxLength={LANDING_COPY_LIMITS.eyebrow}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-title-before"
          label="Judul"
          hint="Teks sebelum kata yang dicetak miring."
          value={copy.titleBefore}
          onChange={(value) => onChange({ ...copy, titleBefore: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-title-emphasis"
          label="Kata yang dicetak miring"
          value={copy.titleEmphasis}
          onChange={(value) => onChange({ ...copy, titleEmphasis: value })}
          maxLength={LANDING_COPY_LIMITS.emphasis}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-description"
          label="Deskripsi"
          value={copy.description}
          onChange={(value) => onChange({ ...copy, description: value })}
          maxLength={LANDING_COPY_LIMITS.body}
          multiline
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Kartu cerita</h3>
        {copy.personas.map((persona, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border p-4"
          >
            <p className="text-sm font-medium">Kartu {index + 1}</p>
            <CrmCopyField
              id={`metime-persona-${index}-emoji`}
              label="Emoji"
              hint="Tempel emoji, misalnya 💑"
              value={persona.emoji}
              onChange={(value) =>
                onChange({
                  ...copy,
                  personas: copy.personas.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, emoji: value } : item
                  ) as MeTimeCopy["personas"],
                })
              }
              maxLength={LANDING_COPY_LIMITS.emoji}
              disabled={disabled}
            />
            <CrmCopyField
              id={`metime-persona-${index}-quote`}
              label="Kutipan"
              value={persona.quote}
              onChange={(value) =>
                onChange({
                  ...copy,
                  personas: copy.personas.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, quote: value } : item
                  ) as MeTimeCopy["personas"],
                })
              }
              maxLength={LANDING_COPY_LIMITS.quote}
              multiline
              disabled={disabled}
            />
            <CrmCopyField
              id={`metime-persona-${index}-label`}
              label="Keterangan"
              value={persona.label}
              onChange={(value) =>
                onChange({
                  ...copy,
                  personas: copy.personas.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: value } : item
                  ) as MeTimeCopy["personas"],
                })
              }
              maxLength={LANDING_COPY_LIMITS.label}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Kotak ajakan</h3>
        <CrmCopyField
          id="metime-cta-eyebrow"
          label="Teks kecil di atas judul kotak"
          value={copy.ctaEyebrow}
          onChange={(value) => onChange({ ...copy, ctaEyebrow: value })}
          maxLength={LANDING_COPY_LIMITS.eyebrow}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-title-before"
          label="Judul kotak"
          value={copy.ctaTitleBefore}
          onChange={(value) => onChange({ ...copy, ctaTitleBefore: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-title-emphasis"
          label="Kata yang dicetak miring"
          value={copy.ctaTitleEmphasis}
          onChange={(value) => onChange({ ...copy, ctaTitleEmphasis: value })}
          maxLength={LANDING_COPY_LIMITS.emphasis}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-title-after"
          label="Teks setelah kata miring"
          value={copy.ctaTitleAfter}
          onChange={(value) => onChange({ ...copy, ctaTitleAfter: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-body"
          label="Deskripsi kotak"
          value={copy.ctaBody}
          onChange={(value) => onChange({ ...copy, ctaBody: value })}
          maxLength={LANDING_COPY_LIMITS.body}
          multiline
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-highlight"
          label="Kalimat penutup yang ditebalkan"
          value={copy.ctaHighlight}
          onChange={(value) => onChange({ ...copy, ctaHighlight: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
        <CrmCopyField
          id="metime-cta-button"
          label="Teks tombol"
          value={copy.ctaButton}
          onChange={(value) => onChange({ ...copy, ctaButton: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ServicesCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<ServicesCopy>) {
  return (
    <div className="grid gap-4">
      <CrmCopyField
        id="services-title"
        label="Judul bagian"
        value={copy.title}
        onChange={(value) => onChange({ ...copy, title: value })}
        maxLength={LANDING_COPY_LIMITS.title}
        disabled={disabled}
      />
      <CrmCopyField
        id="services-description"
        label="Deskripsi"
        hint="Nama, harga, dan isi paket tetap diatur di menu Paket / Services."
        value={copy.description}
        onChange={(value) => onChange({ ...copy, description: value })}
        maxLength={LANDING_COPY_LIMITS.body}
        multiline
        disabled={disabled}
      />
      <CrmCopyField
        id="services-empty"
        label="Pesan jika paket kosong"
        hint="Tampil jika belum ada paket yang aktif."
        value={copy.emptyState}
        onChange={(value) => onChange({ ...copy, emptyState: value })}
        maxLength={LANDING_COPY_LIMITS.body}
        disabled={disabled}
      />
    </div>
  );
}

export function TestimonialsCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<TestimonialsCopy>) {
  return (
    <div className="grid gap-4">
      <CrmCopyField
        id="testimonials-title-before"
        label="Judul"
        hint="Teks sebelum kalimat yang dicetak miring."
        value={copy.titleBefore}
        onChange={(value) => onChange({ ...copy, titleBefore: value })}
        maxLength={LANDING_COPY_LIMITS.title}
        disabled={disabled}
      />
      <CrmCopyField
        id="testimonials-title-emphasis"
        label="Kata yang dicetak miring"
        value={copy.titleEmphasis}
        onChange={(value) => onChange({ ...copy, titleEmphasis: value })}
        maxLength={LANDING_COPY_LIMITS.emphasis}
        disabled={disabled}
      />
      <CrmCopyField
        id="testimonials-description"
        label="Deskripsi"
        value={copy.description}
        onChange={(value) => onChange({ ...copy, description: value })}
        maxLength={LANDING_COPY_LIMITS.body}
        multiline
        disabled={disabled}
      />
    </div>
  );
}

export function TrustCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<TrustCopy>) {
  return (
    <div className="grid gap-4">
      <CrmCopyField
        id="trust-title"
        label="Judul bagian"
        value={copy.title}
        onChange={(value) => onChange({ ...copy, title: value })}
        maxLength={LANDING_COPY_LIMITS.title}
        disabled={disabled}
      />
      {copy.features.map((feature, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Kartu {index + 1}</p>
          <CrmCopyField
            id={`trust-feature-${index}-title`}
            label="Judul kartu"
            value={feature.title}
            onChange={(value) =>
              onChange({
                ...copy,
                features: copy.features.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, title: value } : item
                ) as TrustCopy["features"],
              })
            }
            maxLength={LANDING_COPY_LIMITS.title}
            disabled={disabled}
          />
          <CrmCopyField
            id={`trust-feature-${index}-description`}
            label="Deskripsi kartu"
            value={feature.description}
            onChange={(value) =>
              onChange({
                ...copy,
                features: copy.features.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, description: value } : item
                ) as TrustCopy["features"],
              })
            }
            maxLength={LANDING_COPY_LIMITS.body}
            multiline
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export function FooterCopyFields({
  copy,
  onChange,
  disabled,
}: CopyFieldsProps<FooterCopy>) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Kotak ajakan</h3>
        <CrmCopyField
          id="footer-cta-title"
          label="Judul"
          value={copy.ctaTitleBefore}
          onChange={(value) => onChange({ ...copy, ctaTitleBefore: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-cta-emphasis"
          label="Kata yang diberi garis"
          value={copy.ctaEmphasis}
          onChange={(value) => onChange({ ...copy, ctaEmphasis: value })}
          maxLength={LANDING_COPY_LIMITS.emphasis}
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-cta-description"
          label="Deskripsi"
          value={copy.ctaDescription}
          onChange={(value) => onChange({ ...copy, ctaDescription: value })}
          maxLength={LANDING_COPY_LIMITS.body}
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-cta-button"
          label="Teks tombol"
          value={copy.ctaButton}
          onChange={(value) => onChange({ ...copy, ctaButton: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Langganan email</h3>
        <CrmCopyField
          id="footer-newsletter-title"
          label="Judul"
          value={copy.newsletterTitle}
          onChange={(value) => onChange({ ...copy, newsletterTitle: value })}
          maxLength={LANDING_COPY_LIMITS.title}
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-newsletter-description"
          label="Deskripsi"
          value={copy.newsletterDescription}
          onChange={(value) =>
            onChange({ ...copy, newsletterDescription: value })
          }
          maxLength={LANDING_COPY_LIMITS.body}
          multiline
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-newsletter-placeholder"
          label="Teks di dalam kotak email"
          value={copy.newsletterPlaceholder}
          onChange={(value) =>
            onChange({ ...copy, newsletterPlaceholder: value })
          }
          maxLength={LANDING_COPY_LIMITS.label}
          disabled={disabled}
        />
        <CrmCopyField
          id="footer-newsletter-button"
          label="Teks tombol langganan"
          value={copy.newsletterButton}
          onChange={(value) => onChange({ ...copy, newsletterButton: value })}
          maxLength={LANDING_COPY_LIMITS.cta}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Kolom tautan</h3>
        <p className="text-xs text-pretty text-muted-foreground">
          Tautan yang salah bisa membuka halaman yang tidak ada. Gunakan path
          seperti /verify atau alamat lengkap yang dimulai dengan https://
        </p>
        {copy.columns.map((column, columnIndex) => (
          <div key={columnIndex} className="grid gap-3 rounded-lg border p-4">
            <CrmCopyField
              id={`footer-column-${columnIndex}-title`}
              label={`Judul kolom ${columnIndex + 1}`}
              value={column.title}
              onChange={(value) =>
                onChange({
                  ...copy,
                  columns: copy.columns.map((item, itemIndex) =>
                    itemIndex === columnIndex ? { ...item, title: value } : item
                  ) as FooterCopy["columns"],
                })
              }
              maxLength={LANDING_COPY_LIMITS.label}
              disabled={disabled}
            />
            {column.links.map((link, linkIndex) => (
              <div
                key={linkIndex}
                className="grid gap-3 sm:grid-cols-2"
              >
                <CrmCopyField
                  id={`footer-column-${columnIndex}-link-${linkIndex}-name`}
                  label={`Teks tautan ${linkIndex + 1}`}
                  value={link.name}
                  onChange={(value) =>
                    onChange({
                      ...copy,
                      columns: copy.columns.map((item, itemIndex) =>
                        itemIndex === columnIndex
                          ? {
                              ...item,
                              links: item.links.map((currentLink, currentIndex) =>
                                currentIndex === linkIndex
                                  ? { ...currentLink, name: value }
                                  : currentLink
                              ),
                            }
                          : item
                      ) as FooterCopy["columns"],
                    })
                  }
                  maxLength={LANDING_COPY_LIMITS.label}
                  disabled={disabled}
                />
                <CrmCopyField
                  id={`footer-column-${columnIndex}-link-${linkIndex}-href`}
                  label="Alamat tautan"
                  hint="Contoh: /verify atau https://kalanara.com"
                  value={link.href}
                  onChange={(value) =>
                    onChange({
                      ...copy,
                      columns: copy.columns.map((item, itemIndex) =>
                        itemIndex === columnIndex
                          ? {
                              ...item,
                              links: item.links.map((currentLink, currentIndex) =>
                                currentIndex === linkIndex
                                  ? { ...currentLink, href: value }
                                  : currentLink
                              ),
                            }
                          : item
                      ) as FooterCopy["columns"],
                    })
                  }
                  maxLength={LANDING_COPY_LIMITS.url}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <h3 className="text-sm font-semibold">Media sosial</h3>
        <p className="text-xs text-pretty text-muted-foreground">
          Kosongkan alamat jika ikon ini tidak ingin tampil.
        </p>
        {copy.social.map((item, index) => (
          <CrmCopyField
            key={item.label}
            id={`footer-social-${index}`}
            label={item.label}
            hint="Alamat lengkap, misalnya https://instagram.com/kalanara"
            value={item.href}
            onChange={(value) =>
              onChange({
                ...copy,
                social: copy.social.map((current, currentIndex) =>
                  currentIndex === index ? { ...current, href: value } : current
                ) as FooterCopy["social"],
              })
            }
            maxLength={LANDING_COPY_LIMITS.url}
            disabled={disabled}
          />
        ))}
      </div>

      <CrmCopyField
        id="footer-copyright"
        label="Teks hak cipta"
        hint="Tahun tampil otomatis di depan teks ini."
        value={copy.copyright}
        onChange={(value) => onChange({ ...copy, copyright: value })}
        maxLength={LANDING_COPY_LIMITS.body}
        disabled={disabled}
      />
    </div>
  );
}
