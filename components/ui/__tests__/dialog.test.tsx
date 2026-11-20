import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Register({
  onOpenChange,
  showCloseButton,
}: {
  onOpenChange: (open: boolean) => void;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Daftar member baru</DialogTitle>
          <DialogDescription>Isi data member.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent close button", () => {
  test("uses the Tutup accessible name and closes through onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(<Register onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("can be turned off", () => {
    render(<Register onOpenChange={vi.fn()} showCloseButton={false} />);
    expect(screen.queryByRole("button", { name: "Tutup" })).not.toBeInTheDocument();
  });
});
