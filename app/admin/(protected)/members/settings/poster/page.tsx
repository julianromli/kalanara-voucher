import { Leaf } from "lucide-react";
import { MemberQr } from "@/components/member/member-qr";
import { getSignupQr } from "@/lib/actions/members";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function MemberPosterPage() {
  await requireAdminRouteAccess("/admin/members/settings/poster");
  const qr = await getSignupQr();
  if (qr.status !== "ok") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Poster belum bisa dicetak</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          QR daftar sendiri gagal dimuat. Muat ulang halaman sebelum mencetak.
        </p>
        <a href="/admin/members/settings/poster" className="mt-4 inline-flex h-9 items-center rounded-md border px-3 text-sm">
          Coba lagi
        </a>
      </main>
    );
  }
  const url = qr.url;

  return (
    <main className="poster-page mx-auto min-h-svh max-w-[148mm] bg-background text-foreground">
      <style>{`
        @page { size: A5; margin: 0; }
        @media print {
          [data-slot="sidebar"],
          [data-slot="sidebar-gap"],
          [data-slot="sidebar-container"] { display: none !important; }
          body { background: white; }
          .poster-page { max-width: none; }
        }
      `}</style>
      <header className="bg-foreground px-8 pt-8 pb-16 text-background">
        <p className="inline-flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-4" />
          </span>
          Kalanara Spa
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Jadi member Kalanara. Gratis.
        </h1>
        <p className="mt-2 text-background/75">
          Kumpulin stamp tiap treatment. Tiap 5 stamp ada reward.
        </p>
      </header>
      <div className="-mt-10 px-8">
        {url ? <MemberQr value={url} size={200} className="shadow-sm" /> : null}
        <ol className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">1</span>
            Scan QR ini pakai kamera HP.
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">2</span>
            Isi nama, nomor WhatsApp, dan tanggal lahir.
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">3</span>
            <span>
              Tunjukin kartu member ke kasir pas bayar.
              <span className="mt-1 block text-muted-foreground">Tiap treatment walk-in dapat 1 stamp.</span>
            </span>
          </li>
        </ol>
      </div>
      <footer className="mt-10 grid grid-cols-2 border-t px-8 py-4 text-xs text-muted-foreground">
        <p>Tanpa aplikasi. Tanpa password.</p>
        <p className="text-right">Butuh bantuan? Tanya kasir.</p>
      </footer>
    </main>
  );
}
