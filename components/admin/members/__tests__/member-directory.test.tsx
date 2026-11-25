import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemberDirectory } from "@/components/admin/members/member-directory";
import { buildAdminPage } from "@/lib/actions/admin-pagination";

describe("MemberDirectory", () => {
  test("treats a whitespace-only query as no filter in the empty state", () => {
    render(
      <MemberDirectory
        page={buildAdminPage([], 1, 0)}
        followUp={{ nearReward: [], frequent: [] }}
        query="   "
        onQueryChange={vi.fn()}
        tier="all"
        onTierChange={vi.fn()}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Belum ada member")).toBeInTheDocument();
    expect(screen.queryByText("Tidak ada member")).not.toBeInTheDocument();
  });
});
