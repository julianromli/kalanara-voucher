import { describe, expect, it } from "vitest";
import { wrapTextToLines } from "@/lib/pdf";

interface FakeMeasurer {
  getTextWidth(text: string): number;
  splitTextToSize(text: string, maxWidth: number): string[];
}

function createFakeMeasurer(): FakeMeasurer {
  return {
    getTextWidth(text: string) {
      return text.length;
    },
    splitTextToSize(text: string, maxWidth: number) {
      const words = text.trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (candidate.length <= maxWidth) {
          currentLine = candidate;
          continue;
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        currentLine = word;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    },
  };
}

describe("wrapTextToLines", () => {
  const measurer = createFakeMeasurer();

  it("wraps text into multiple lines within the configured width", () => {
    expect(
      wrapTextToLines(measurer, "Selamat menikmati perawatan spa premium", 18, 3),
    ).toEqual(["Selamat menikmati", "perawatan spa", "premium"]);
  });

  it("truncates the last line with an ellipsis when text exceeds max lines", () => {
    expect(
      wrapTextToLines(
        measurer,
        "Semoga hadiah ini membuat harimu lebih tenang, hangat, dan menyenangkan",
        14,
        2,
      ),
    ).toEqual(["Semoga hadiah", "ini membuat..."]);
  });

  it("returns an empty array for blank input", () => {
    expect(wrapTextToLines(measurer, "   ", 10, 2)).toEqual([]);
  });
});
