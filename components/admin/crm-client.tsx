"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientUploadedFileData } from "uploadthing/types";
import {
  createTestimonial,
  deleteSiteSetting,
  deleteTestimonial,
  updateLandingCopySection,
  updateSiteSetting,
  updateTestimonial,
} from "@/lib/actions/crm";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { AdminPageBody, AdminPageIntro } from "@/components/admin/admin-page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/ToastContext";
import { UploadDropzone } from "@/lib/uploadthing-client";
import { type Testimonial, type TestimonialInsert } from "@/lib/database.types";
import {
  cloneLandingCopy,
  DEFAULT_LANDING_COPY,
  mergeLandingCopyPreservingDirty,
  type LandingCopy,
  type LandingCopySection,
} from "@/lib/landingCopy";
import {
  FooterCopyFields,
  HeroCopyFields,
  MeTimeCopyFields,
  ServicesCopyFields,
  TestimonialsCopyFields,
  TrustCopyFields,
} from "@/components/admin/crm-landing-panels";
import { ExternalLink, Edit2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CRMClientProps {
  initialAnnouncement: string;
  initialCountdownEndAt: string;
  initialCountdownEnabled: boolean;
  initialHeroImage: string;
  initialLandingCopy: LandingCopy;
  testimonials: Testimonial[];
}

type HeroImageUploadData = {
  uploadedBy: string;
  imageUrl: string;
  fileKey: string;
};

type CrmNavSection = "announcement" | LandingCopySection;

const CRM_NAV: Array<{
  id: CrmNavSection;
  label: string;
  previewHref: string;
}> = [
  { id: "announcement", label: "Pengumuman", previewHref: "/" },
  { id: "hero", label: "Hero", previewHref: "/" },
  { id: "meTime", label: "Cerita Me-Time", previewHref: "/#me-time-gift" },
  { id: "services", label: "Paket Voucher", previewHref: "/#services" },
  { id: "testimonials", label: "Testimoni", previewHref: "/#testimonials" },
  { id: "trust", label: "Kenapa Pilih Kami", previewHref: "/#trust" },
  { id: "footer", label: "Footer", previewHref: "/#footer" },
];

function sortTestimonials(items: Testimonial[]) {
  return [...items].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}

function buildTestimonialPayload(
  form: Partial<TestimonialInsert>
): TestimonialInsert {
  const forText = form.for_text?.trim() ?? "";
  const quote = form.quote?.trim() ?? "";
  const initials = (form.initials?.trim().toUpperCase() ?? "").slice(0, 2);
  const name = form.name?.trim() ?? "";
  const location = form.location?.trim() ?? "";

  if (!forText || !quote || !initials || !name || !location) {
    throw new Error("Lengkapi semua kolom testimoni.");
  }

  return {
    for_text: forText,
    quote,
    initials,
    name,
    location,
    sort_order: Number.isFinite(Number(form.sort_order))
      ? Number(form.sort_order)
      : 0,
    is_active: form.is_active ?? true,
  };
}

export function CRMClient({
  initialAnnouncement,
  initialCountdownEndAt,
  initialCountdownEnabled,
  initialHeroImage,
  initialLandingCopy,
  testimonials,
}: CRMClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState<CrmNavSection>("announcement");
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [countdownEndAt, setCountdownEndAt] = useState(initialCountdownEndAt);
  const [countdownEnabled, setCountdownEnabled] = useState(initialCountdownEnabled);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [heroImage, setHeroImage] = useState(initialHeroImage);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [landingCopy, setLandingCopy] = useState<LandingCopy>(() =>
    cloneLandingCopy(initialLandingCopy)
  );
  const [savingSection, setSavingSection] = useState<LandingCopySection | null>(
    null
  );
  const dirtyLandingSectionsRef = useRef(new Set<LandingCopySection>());
  const [testimonialItems, setTestimonialItems] = useState<Testimonial[]>(() =>
    sortTestimonials(testimonials)
  );
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<Partial<TestimonialInsert>>({
    for_text: "",
    quote: "",
    initials: "",
    name: "",
    location: "",
    sort_order: 0,
    is_active: true,
  });
  const [isSavingTestimonial, setIsSavingTestimonial] = useState(false);

  useEffect(() => {
    setAnnouncement(initialAnnouncement);
  }, [initialAnnouncement]);

  useEffect(() => {
    setCountdownEndAt(initialCountdownEndAt);
  }, [initialCountdownEndAt]);

  useEffect(() => {
    setCountdownEnabled(initialCountdownEnabled);
  }, [initialCountdownEnabled]);

  useEffect(() => {
    setHeroImage(initialHeroImage);
  }, [initialHeroImage]);

  useEffect(() => {
    setLandingCopy((current) =>
      mergeLandingCopyPreservingDirty(
        initialLandingCopy,
        current,
        dirtyLandingSectionsRef.current
      )
    );
  }, [initialLandingCopy]);

  useEffect(() => {
    setTestimonialItems(sortTestimonials(testimonials));
  }, [testimonials]);

  function applyLandingCopyEdit<T extends LandingCopySection>(
    section: T,
    copy: LandingCopy[T]
  ) {
    dirtyLandingSectionsRef.current.add(section);
    setLandingCopy((current) => ({
      ...current,
      [section]: copy,
    }));
  }

  function markLandingSectionClean(section: LandingCopySection) {
    dirtyLandingSectionsRef.current.delete(section);
  }

  const handleSaveAnnouncement = async () => {
    try {
      setIsSavingAnnouncement(true);
      const trimmedAnnouncement = announcement.trim();
      const normalizedCountdownEndAt = countdownEndAt
        ? new Date(countdownEndAt).toISOString()
        : "";

      const announcementWrites: Array<Promise<unknown>> = [
        updateSiteSetting("announcement_text", trimmedAnnouncement),
        updateSiteSetting(
          "announcement_countdown_enabled",
          countdownEnabled ? "true" : "false"
        ),
      ];

      if (normalizedCountdownEndAt) {
        announcementWrites.push(
          updateSiteSetting(
            "announcement_countdown_end_at",
            normalizedCountdownEndAt
          )
        );
      } else {
        announcementWrites.push(
          deleteSiteSetting("announcement_countdown_end_at")
        );
      }

      await Promise.all(announcementWrites);
      setAnnouncement(trimmedAnnouncement);
      setCountdownEndAt(normalizedCountdownEndAt);
      router.refresh();
      showToast("Pengumuman berhasil disimpan.", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal menyimpan pengumuman.", "error");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const handleSaveHeroImage = async (url: string) => {
    try {
      await updateSiteSetting("hero_image_url", url);
      setHeroImage(url);
      router.refresh();
      showToast("Gambar hero berhasil diperbarui.", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal memperbarui gambar hero.", "error");
    }
  };

  const handleSaveLandingSection = async (section: LandingCopySection) => {
    try {
      setSavingSection(section);
      const saved = await updateLandingCopySection(section, landingCopy[section]);
      markLandingSectionClean(section);
      setLandingCopy((current) => ({
        ...current,
        [section]: saved,
      }));
      router.refresh();
      showToast("Teks berhasil disimpan.", "success");
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Gagal menyimpan teks.",
        "error"
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleResetLandingSection = async (section: LandingCopySection) => {
    if (
      !confirm(
        "Kembalikan teks bagian ini ke teks awal? Perubahan yang belum disimpan akan hilang."
      )
    ) {
      return;
    }

    const defaults = cloneLandingCopy(DEFAULT_LANDING_COPY[section]);

    try {
      setSavingSection(section);
      const saved = await updateLandingCopySection(section, defaults);
      markLandingSectionClean(section);
      setLandingCopy((current) => ({
        ...current,
        [section]: saved,
      }));
      router.refresh();
      showToast("Teks awal berhasil dikembalikan.", "success");
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Gagal mengembalikan teks awal.",
        "error"
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleOpenTestimonialModal = (testimonial?: Testimonial) => {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setTestimonialForm({
        for_text: testimonial.for_text,
        quote: testimonial.quote,
        initials: testimonial.initials,
        name: testimonial.name,
        location: testimonial.location,
        sort_order: testimonial.sort_order,
        is_active: testimonial.is_active,
      });
    } else {
      setEditingTestimonial(null);
      setTestimonialForm({
        for_text: "",
        quote: "",
        initials: "",
        name: "",
        location: "",
        sort_order: (testimonialItems[testimonialItems.length - 1]?.sort_order || 0) + 10,
        is_active: true,
      });
    }

    setIsTestimonialModalOpen(true);
  };

  const handleSaveTestimonial = async () => {
    try {
      setIsSavingTestimonial(true);
      const payload = buildTestimonialPayload(testimonialForm);

      if (editingTestimonial) {
        const updated = await updateTestimonial(editingTestimonial.id, payload);
        setTestimonialItems((current) =>
          sortTestimonials(
            current.map((item) => (item.id === updated.id ? updated : item))
          )
        );
        showToast("Testimoni berhasil diperbarui.", "success");
      } else {
        const created = await createTestimonial(payload);
        setTestimonialItems((current) => sortTestimonials([...current, created]));
        showToast("Testimoni berhasil ditambahkan.", "success");
      }

      setIsTestimonialModalOpen(false);
      setEditingTestimonial(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Gagal menyimpan testimoni.",
        "error"
      );
    } finally {
      setIsSavingTestimonial(false);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Hapus testimoni ini dari halaman utama?")) {
      return;
    }

    try {
      await deleteTestimonial(id);
      setTestimonialItems((current) => current.filter((item) => item.id !== id));
      router.refresh();
      showToast("Testimoni berhasil dihapus.", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal menghapus testimoni.", "error");
    }
  };

  const activeNav = CRM_NAV.find((item) => item.id === activeSection) ?? CRM_NAV[0];
  const isSavingCopy =
    activeSection !== "announcement" && savingSection === activeSection;

  const renderSectionActions = (section: LandingCopySection, previewHref: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => void handleSaveLandingSection(section)}
        disabled={savingSection === section}
      >
        {savingSection === section ? "Menyimpan..." : "Simpan"}
      </Button>
      <Button
        variant="outline"
        onClick={() => void handleResetLandingSection(section)}
        disabled={savingSection === section}
      >
        Kembalikan teks awal
      </Button>
      <Button variant="ghost" asChild>
        <a href={previewHref} target="_blank" rel="noreferrer">
          Lihat di website
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );

  return (
    <>
      <DashboardHeader title="CRM" showActions={false} />
      <AdminPageBody>
        <AdminPageIntro description="Ubah teks halaman utama. Setiap bagian disimpan terpisah, jadi kamu bisa kerja satu bagian dulu." />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div
            role="tablist"
            aria-label="Bagian halaman utama"
            className="flex gap-2 overflow-x-auto pb-1 lg:w-56 lg:shrink-0 lg:flex-col"
          >
            {CRM_NAV.map((item) => (
              <Button
                key={item.id}
                type="button"
                id={`crm-tab-${item.id}`}
                role="tab"
                aria-selected={activeSection === item.id}
                aria-controls="crm-panel"
                variant={activeSection === item.id ? "default" : "outline"}
                className={cn(
                  "justify-start whitespace-nowrap",
                  activeSection === item.id && "shadow-sm"
                )}
                onClick={() => setActiveSection(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div
            id="crm-panel"
            role="tabpanel"
            aria-labelledby={`crm-tab-${activeSection}`}
            className="min-w-0 flex-1 space-y-6"
          >
            {activeSection === "announcement" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pengumuman</CardTitle>
                  <CardDescription>
                    Teks di pita paling atas situs, termasuk timer jika aktif.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="announcement-text">Teks pengumuman</Label>
                    <Input
                      id="announcement-text"
                      value={announcement}
                      onChange={(event) => setAnnouncement(event.target.value)}
                      placeholder="Contoh: FLASH SALE 5.5 ...... BERAKHIR DALAM"
                      disabled={isSavingAnnouncement}
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      id="announcement-countdown-enabled"
                      checked={countdownEnabled}
                      disabled={isSavingAnnouncement}
                      onCheckedChange={(checked) =>
                        setCountdownEnabled(checked === true)
                      }
                    />
                    <div className="grid gap-1">
                      <label
                        htmlFor="announcement-countdown-enabled"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Tampilkan hitungan mundur
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Jika aktif, sisa waktu tampil di samping teks pengumuman.
                        Tanggal akhir tetap bisa diisi meski timer mati.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="announcement-countdown">Tanggal dan jam berakhir</Label>
                    <Input
                      id="announcement-countdown"
                      type="datetime-local"
                      value={countdownEndAt ? countdownEndAt.slice(0, 16) : ""}
                      onChange={(event) => setCountdownEndAt(event.target.value)}
                      disabled={isSavingAnnouncement}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => void handleSaveAnnouncement()}
                      disabled={isSavingAnnouncement}
                    >
                      {isSavingAnnouncement ? "Menyimpan..." : "Simpan"}
                    </Button>
                    <Button variant="ghost" asChild>
                      <a href="/" target="_blank" rel="noreferrer">
                        Lihat di website
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {activeSection === "hero" ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Gambar Hero</CardTitle>
                    <CardDescription>
                      Gambar latar bagian paling atas halaman utama.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {heroImage ? (
                      <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={heroImage}
                          alt="Pratinjau gambar hero"
                          className="h-full w-full object-cover opacity-50"
                        />
                      </div>
                    ) : null}
                    <UploadDropzone
                      endpoint="heroImageUploader"
                      onUploadBegin={() => setIsUploadingHero(true)}
                      onClientUploadComplete={(
                        uploads: ClientUploadedFileData<HeroImageUploadData>[]
                      ) => {
                        setIsUploadingHero(false);
                        const uploadedUrl =
                          uploads[0]?.serverData?.imageUrl ?? uploads[0]?.url;

                        if (uploadedUrl) {
                          void handleSaveHeroImage(uploadedUrl);
                        }
                      }}
                      onUploadError={(error: Error) => {
                        setIsUploadingHero(false);
                        showToast(`Unggah gagal: ${error.message}`, "error");
                      }}
                    />
                    {isUploadingHero ? (
                      <p className="text-sm text-muted-foreground">
                        Mengunggah gambar hero...
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Teks Hero</CardTitle>
                    <CardDescription>
                      Judul, deskripsi, dan tombol di bagian paling atas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <HeroCopyFields
                      copy={landingCopy.hero}
                      onChange={(copy) => applyLandingCopyEdit("hero", copy)}
                      disabled={isSavingCopy}
                    />
                    {renderSectionActions("hero", activeNav.previewHref)}
                  </CardContent>
                </Card>
              </>
            ) : null}

            {activeSection === "meTime" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Cerita Me-Time</CardTitle>
                  <CardDescription>
                    Bagian cerita dan empat kartu di bawah hero.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MeTimeCopyFields
                    copy={landingCopy.meTime}
                      onChange={(copy) => applyLandingCopyEdit("meTime", copy)}
                    disabled={isSavingCopy}
                  />
                  {renderSectionActions("meTime", activeNav.previewHref)}
                </CardContent>
              </Card>
            ) : null}

            {activeSection === "services" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Paket Voucher</CardTitle>
                  <CardDescription>
                    Judul bagian katalog. Isi paket tetap diatur di menu Services.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ServicesCopyFields
                    copy={landingCopy.services}
                      onChange={(copy) => applyLandingCopyEdit("services", copy)}
                    disabled={isSavingCopy}
                  />
                  {renderSectionActions("services", activeNav.previewHref)}
                </CardContent>
              </Card>
            ) : null}

            {activeSection === "testimonials" ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Judul Testimoni</CardTitle>
                    <CardDescription>
                      Teks di atas daftar ulasan pelanggan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <TestimonialsCopyFields
                      copy={landingCopy.testimonials}
                      onChange={(copy) =>
                        applyLandingCopyEdit("testimonials", copy)
                      }
                      disabled={isSavingCopy}
                    />
                    {renderSectionActions("testimonials", activeNav.previewHref)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Daftar testimoni</CardTitle>
                      <CardDescription>
                        Ulasan yang tampil di halaman utama.
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleOpenTestimonialModal()} size="sm">
                      <Plus className="size-4 mr-2" /> Tambah testimoni
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {testimonialItems.map((testimonial) => (
                        <div
                          key={testimonial.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold">{testimonial.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({testimonial.location})
                              </span>
                              {!testimonial.is_active ? (
                                <span className="text-xs bg-muted px-2 py-1 rounded-md">
                                  Disembunyikan
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm italic">&quot;{testimonial.quote}&quot;</p>
                            <p className="text-xs text-primary font-medium uppercase tracking-wider">
                              {testimonial.for_text}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Ubah ${testimonial.name}`}
                              onClick={() => handleOpenTestimonialModal(testimonial)}
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              aria-label={`Hapus ${testimonial.name}`}
                              onClick={() => void handleDeleteTestimonial(testimonial.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {testimonialItems.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">
                          Belum ada testimoni.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}

            {activeSection === "trust" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Kenapa Pilih Kami</CardTitle>
                  <CardDescription>
                    Tiga kartu alasan di dekat bagian bawah halaman.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <TrustCopyFields
                    copy={landingCopy.trust}
                      onChange={(copy) => applyLandingCopyEdit("trust", copy)}
                    disabled={isSavingCopy}
                  />
                  {renderSectionActions("trust", activeNav.previewHref)}
                </CardContent>
              </Card>
            ) : null}

            {activeSection === "footer" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Footer</CardTitle>
                  <CardDescription>
                    Ajakan, langganan email, tautan, dan media sosial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FooterCopyFields
                    copy={landingCopy.footer}
                      onChange={(copy) => applyLandingCopyEdit("footer", copy)}
                    disabled={isSavingCopy}
                  />
                  {renderSectionActions("footer", activeNav.previewHref)}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        <Dialog open={isTestimonialModalOpen} onOpenChange={setIsTestimonialModalOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTestimonial ? "Ubah testimoni" : "Tambah testimoni"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="testimonial-for-text">Tag</Label>
                <Input
                  id="testimonial-for-text"
                  value={testimonialForm.for_text}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      for_text: event.target.value,
                    }))
                  }
                  placeholder="Contoh: untuk mama"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="testimonial-quote">Kutipan</Label>
                <Input
                  id="testimonial-quote"
                  value={testimonialForm.quote}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      quote: event.target.value,
                    }))
                  }
                  placeholder="Teks ulasan pelanggan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="testimonial-initials">Inisial</Label>
                  <Input
                    id="testimonial-initials"
                    value={testimonialForm.initials}
                    onChange={(event) =>
                      setTestimonialForm((current) => ({
                        ...current,
                        initials: event.target.value,
                      }))
                    }
                    placeholder="Contoh: AR"
                    maxLength={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="testimonial-name">Nama</Label>
                  <Input
                    id="testimonial-name"
                    value={testimonialForm.name}
                    onChange={(event) =>
                      setTestimonialForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Contoh: Arika R."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="testimonial-location">Lokasi</Label>
                  <Input
                    id="testimonial-location"
                    value={testimonialForm.location}
                    onChange={(event) =>
                      setTestimonialForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Contoh: Jakarta Selatan"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="testimonial-sort">Urutan</Label>
                  <Input
                    id="testimonial-sort"
                    type="number"
                    value={testimonialForm.sort_order ?? 0}
                    onChange={(event) =>
                      setTestimonialForm((current) => ({
                        ...current,
                        sort_order: Number.parseInt(event.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id="testimonial-active"
                  checked={testimonialForm.is_active ?? true}
                  onCheckedChange={(checked) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      is_active: checked === true,
                    }))
                  }
                />
                <label
                  htmlFor="testimonial-active"
                  className="text-sm font-medium cursor-pointer"
                >
                  Tampilkan testimoni ini di halaman utama
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsTestimonialModalOpen(false)}
              >
                Batal
              </Button>
              <Button onClick={() => void handleSaveTestimonial()} disabled={isSavingTestimonial}>
                {isSavingTestimonial ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminPageBody>
    </>
  );
}
