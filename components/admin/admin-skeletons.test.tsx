import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  AdminDashboardSkeleton,
  AdminReviewsSkeleton,
  AdminServicesSkeleton,
} from "@/components/admin/admin-skeletons";

describe("admin page skeletons", () => {
  test("reviews skeleton is a star card grid, not a stacked stub", () => {
    const { container } = render(<AdminReviewsSkeleton />);
    const region = screen.getByRole("status");

    expect(region).toHaveAttribute("data-admin-skeleton", "reviews");
    expect(screen.getByText("Memuat ulasan")).toBeInTheDocument();
    expect(container.querySelectorAll(".size-4.rounded")).toHaveLength(30);
    expect(container.querySelector(".lg\\:grid-cols-3")).not.toBeNull();
    expect(container.querySelectorAll(".h-11.w-full.rounded-lg")).toHaveLength(0);
  });

  test("services skeleton uses a service card grid", () => {
    const { container } = render(<AdminServicesSkeleton />);

    expect(screen.getByRole("status")).toHaveAttribute(
      "data-admin-skeleton",
      "services",
    );
    expect(container.querySelector(".xl\\:grid-cols-3")).not.toBeNull();
    expect(container.querySelectorAll(".h-44")).toHaveLength(6);
  });

  test("dashboard skeleton uses KPI cards and chart panes", () => {
    const { container } = render(<AdminDashboardSkeleton />);

    expect(screen.getByRole("status")).toHaveAttribute(
      "data-admin-skeleton",
      "dashboard",
    );
    expect(container.querySelector(".lg\\:grid-cols-4")).not.toBeNull();
    expect(container.querySelectorAll(".h-\\[400px\\]")).toHaveLength(2);
  });
});
