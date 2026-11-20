import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function Confirm({ onOpenChange, showCloseButton }: { onOpenChange: (open: boolean) => void; showCloseButton?: boolean }) {
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent showCloseButton={showCloseButton}>
        <AlertDialogHeader>
          <AlertDialogTitle>Ganti QR?</AlertDialogTitle>
          <AlertDialogDescription>QR lama langsung mati.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialogContent close button", () => {
  test("shows an x that closes through onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(<Confirm onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("keeps the opening focus on the footer Cancel", () => {
    render(<Confirm onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Batal" })).toHaveFocus();
  });

  test("can be turned off", () => {
    render(<Confirm onOpenChange={vi.fn()} showCloseButton={false} />);
    expect(screen.queryByRole("button", { name: "Tutup" })).not.toBeInTheDocument();
  });
});
