import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementBar } from "@/components/announcement-bar";

describe("AnnouncementBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows announcement text without countdown numbers when the timer is off", () => {
    render(
      <AnnouncementBar
        text="Promo me time"
        countdownEndAt="2026-09-15T10:00:00.000Z"
        countdownEnabled={false}
      />
    );

    expect(screen.getByText("Promo me time")).toBeInTheDocument();
    expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
    expect(screen.queryByText("00:00:00:00")).not.toBeInTheDocument();
  });

  it("shows text only when the timer is on but no valid end date exists", () => {
    render(
      <AnnouncementBar text="Promo me time" countdownEnabled />
    );

    expect(screen.getByText("Promo me time")).toBeInTheDocument();
    expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
    expect(screen.queryByText("00:00:00:00")).not.toBeInTheDocument();
  });

  it("shows a same-day placeholder, then the mounted countdown value", () => {
    render(
      <AnnouncementBar
        text="Promo me time"
        countdownEndAt="2026-09-14T12:00:00.000Z"
        countdownEnabled
      />
    );

    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(screen.queryByText("02:00:00")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByText(/Promo me time/)).toBeInTheDocument();
    expect(screen.getByText("02:00:00")).toBeInTheDocument();
    expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
  });

  it("uses a four-part placeholder when the end date is more than a day away", () => {
    render(
      <AnnouncementBar
        text="Promo me time"
        countdownEndAt="2026-09-16T12:00:00.000Z"
        countdownEnabled
      />
    );

    expect(screen.getByText("00:00:00:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByText("02:02:00:00")).toBeInTheDocument();
    expect(screen.queryByText("00:00:00:00")).not.toBeInTheDocument();
  });
});
