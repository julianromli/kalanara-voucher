import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function Harness({ dirty, onLinkClick }: { dirty: boolean; onLinkClick: () => void }) {
  const dialog = useUnsavedChangesGuard(dirty, "Belum disimpan");
  return (
    <>
      <a
        href="/admin/members"
        onClick={(event) => {
          event.preventDefault();
          onLinkClick();
        }}
      >
        Member
      </a>
      {dialog}
    </>
  );
}

afterEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  test("asks before an in-app link and cancels it when declined", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    const onLinkClick = vi.fn();
    render(<Harness dirty onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(confirm).not.toHaveBeenCalled();
    expect(onLinkClick).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Belum disimpan");
    await user.click(screen.getByRole("button", { name: "Tetap di sini" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("navigates when the user confirms leaving", async () => {
    const user = userEvent.setup();
    const onLinkClick = vi.fn();
    render(<Harness dirty onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(onLinkClick).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tinggalkan halaman" }));
    expect(push).toHaveBeenCalledWith("/admin/members");
  });

  test("does nothing when clean", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onLinkClick = vi.fn();
    render(<Harness dirty={false} onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(confirm).not.toHaveBeenCalled();
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("blocks unload while dirty", () => {
    render(<Harness dirty onLinkClick={vi.fn()} />);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
