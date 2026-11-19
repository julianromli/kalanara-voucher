import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

function Harness({ dirty, onLinkClick }: { dirty: boolean; onLinkClick: () => void }) {
  useUnsavedChangesGuard(dirty, "Belum disimpan");
  return (
    <a
      href="/admin/members"
      onClick={(event) => {
        event.preventDefault();
        onLinkClick();
      }}
    >
      Member
    </a>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedChangesGuard", () => {
  test("asks before an in-app link and cancels it when declined", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onLinkClick = vi.fn();
    render(<Harness dirty onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(confirm).toHaveBeenCalledWith("Belum disimpan");
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  test("lets the link through when confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onLinkClick = vi.fn();
    render(<Harness dirty onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });

  test("does nothing when clean", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onLinkClick = vi.fn();
    render(<Harness dirty={false} onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByText("Member"));
    expect(confirm).not.toHaveBeenCalled();
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });

  test("blocks unload while dirty", () => {
    render(<Harness dirty onLinkClick={vi.fn()} />);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
