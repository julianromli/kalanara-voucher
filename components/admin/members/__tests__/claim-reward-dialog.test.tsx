import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || "mouse";
  }
}

window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();

import { ClaimRewardDialog } from "@/components/admin/members/claim-reward-dialog";

vi.mock("@/lib/actions/members", () => ({
  claimReward: vi.fn(),
}));

const SERVICES = [
  { id: "svc-1", name: "Me Time (90 menit)" },
  { id: "svc-2", name: "Reflexology (90 menit)" },
];

describe("ClaimRewardDialog", () => {
  test("uses the custom select, not a native select", async () => {
    const user = userEvent.setup();
    render(
      <ClaimRewardDialog
        open
        memberId="11111111-1111-4111-8111-111111111111"
        memberName="Rina Maharani"
        milestone={5}
        rewardName="Totok gratis"
        stampCount={5}
        services={SERVICES}
        onOpenChange={vi.fn()}
        onClaimed={vi.fn()}
      />,
    );

    expect(document.querySelector("select")).toBeNull();
    const trigger = screen.getByRole("combobox", { name: "Treatment yang dipakai" });
    expect(trigger).toHaveTextContent("Me Time (90 menit)");
    await user.click(trigger);
    expect(await screen.findByRole("option", { name: "Reflexology (90 menit)" })).toBeInTheDocument();
  });
});
