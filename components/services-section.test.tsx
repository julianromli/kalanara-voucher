import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ServicesSection } from "./services-section";
import type { Service } from "@/lib/types";

// Mock the IntersectionObserver for useInView
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

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
  }
];

describe("ServicesSection", () => {
  it("renders duration and category badge for valid service", () => {
    render(<ServicesSection services={[mockServices[0]]} />);
    
    // Duration
    expect(screen.getByText("60 menit")).toBeInTheDocument();
    
    // Category badge
    expect(screen.getByText("Massage")).toBeInTheDocument();
    
    // Service name
    expect(screen.getByText("Balinese Massage")).toBeInTheDocument();
  });

  it("handles missing category data gracefully without crashing", () => {
    render(<ServicesSection services={[mockServices[1]]} />);
    
    // Duration should still render
    expect(screen.getByText("90 menit")).toBeInTheDocument();
    
    // Service name should render
    expect(screen.getByText("Missing Category Service")).toBeInTheDocument();
    
    // "Massage" badge should NOT be present (since it's null)
    expect(screen.queryByText("Massage")).not.toBeInTheDocument();
  });
});
