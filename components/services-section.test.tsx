import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ServicesSection } from "./services-section";
import type { Service } from "@/lib/types";
import { getDefaultServiceImageUrl } from "@/lib/utils/serviceImages";
import { ToastProvider } from "@/context/ToastContext";

import type { ImgHTMLAttributes } from "react";

function NextImageMock(props: ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
}) {
  const imageProps = { ...props };
  delete imageProps.fill;
  delete imageProps.priority;

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={imageProps.alt ?? ""} {...imageProps} />;
}

vi.mock("next/image", () => ({
  default: NextImageMock,
}));

// Mock the IntersectionObserver for useInView
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

function renderServices(services: Service[]) {
  return render(
    <ToastProvider>
      <ServicesSection services={services} />
    </ToastProvider>
  );
}

const mockServices: Service[] = [
  {
    id: "test-id-1",
    name: "Balinese Massage",
    description: "Traditional balinese massage",
    duration: 60,
    price: 150000,
    category: {
      id: "massage",
      slug: "massage",
      name: "Massage",
      isActive: true,
    },
    image: "/images/services/balinese.jpg",
  },
  {
    id: "test-id-2",
    name: "Missing Category Service",
    description: "Testing fallback",
    duration: 90,
    price: 200000,
    // @ts-expect-error - simulating runtime missing data
    category: null,
    image: "/images/services/facial.jpg",
  },
  {
    id: "test-id-3",
    name: "Fallback Image Service",
    description: "Testing image fallback",
    duration: 45,
    price: 100000,
    category: {
      id: "package",
      slug: "package",
      name: "Package",
      isActive: true,
    },
    image: "",
  },
];

describe("ServicesSection", () => {
  it("renders duration and category badge for valid service", () => {
    renderServices([mockServices[0]]);
    
    // Duration
    expect(screen.getByText("60 menit")).toBeInTheDocument();
    
    // Category badge
    expect(screen.getByText("Massage")).toBeInTheDocument();
    
    // Service name
    expect(screen.getByText("Balinese Massage")).toBeInTheDocument();
  });

  it("handles missing category data gracefully without crashing", () => {
    renderServices([mockServices[1]]);
    
    // Duration should still render
    expect(screen.getByText("90 menit")).toBeInTheDocument();
    
    // Service name should render
    expect(screen.getByText("Missing Category Service")).toBeInTheDocument();
    
    // "Massage" badge should NOT be present (since it's null)
    expect(screen.queryByText("Massage")).not.toBeInTheDocument();
  });

  it("uses the shared fallback image when a service image is missing", () => {
    renderServices([mockServices[2]]);

    const image = screen.getByRole("img", { name: "Fallback Image Service" });

    expect(image).toHaveAttribute("src", getDefaultServiceImageUrl());
  });

  it("keeps a single-column catalog on small phones", () => {
    const { container } = renderServices(mockServices);
    const grid = container.querySelector("#services .grid");

    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
    expect(grid?.className).toContain("lg:grid-cols-3");
    expect(grid?.className).not.toContain("min-[380px]");
  });

  it("keeps price and the detail link visually separate", () => {
    renderServices([mockServices[0]]);

    const detailLink = screen.getByRole("link", { name: /detail/i });
    const priceRow = detailLink.parentElement;

    expect(detailLink).toHaveAttribute("href", "/voucher/test-id-1");
    expect(priceRow?.textContent).toMatch(/Rp/);
    expect(priceRow?.className).toContain("gap-x-3");
    expect(detailLink.className).toContain("shrink-0");
  });

  it("truncates category badges so they do not fight the duration pill", () => {
    renderServices([
      {
        ...mockServices[0],
        category: {
          id: "outlet",
          slug: "lantai-outlet",
          name: "Lantai 2 - Kalanara Outlet",
          isActive: true,
        },
      },
    ]);

    const category = screen.getByText("Lantai 2 - Kalanara Outlet");
    const overlay = category.parentElement;

    expect(category.className).toContain("truncate");
    expect(category.className).toContain("max-w-[calc(100%-7.5rem)]");
    expect(overlay?.className).toContain("justify-between");
    expect(screen.getByText("60 menit").className).toContain("whitespace-nowrap");
  });
});
