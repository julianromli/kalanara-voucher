import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDING_COPY,
  isValidFooterHref,
  isValidSocialHref,
  mergeLandingCopyPreservingDirty,
  parseLandingCopyFromSettings,
  parseLandingCopySection,
  parseLandingCopySectionForSave,
  serializeLandingCopySection,
} from "@/lib/landing-copy";

describe("landing copy parsers", () => {
  it("returns defaults when JSON is missing or invalid", () => {
    expect(parseLandingCopySection("hero", undefined)).toEqual(
      DEFAULT_LANDING_COPY.hero
    );
    expect(parseLandingCopySection("hero", "{not-json")).toEqual(
      DEFAULT_LANDING_COPY.hero
    );
  });

  it("merges partial JSON with defaults so public pages stay complete", () => {
    const parsed = parseLandingCopySection(
      "hero",
      JSON.stringify({
        titleLine1: "Hadiah Baru",
        description: "   ",
      })
    );

    expect(parsed.titleLine1).toBe("Hadiah Baru");
    expect(parsed.description).toBe(DEFAULT_LANDING_COPY.hero.description);
    expect(parsed.primaryCta).toBe(DEFAULT_LANDING_COPY.hero.primaryCta);
  });

  it("parses settings rows into a full landing copy object", () => {
    const copy = parseLandingCopyFromSettings([
      {
        key: "landing_services",
        value: JSON.stringify({
          title: "Paket Spesial",
          description: "Pilih hadiah yang tepat.",
          emptyState: "Kosong",
        }),
      },
    ]);

    expect(copy.services.title).toBe("Paket Spesial");
    expect(copy.hero).toEqual(DEFAULT_LANDING_COPY.hero);
    expect(copy.footer.columns).toHaveLength(4);
  });

  it("keeps empty social URLs so the public footer can hide those icons", () => {
    const parsed = parseLandingCopySection(
      "footer",
      JSON.stringify({
        ...DEFAULT_LANDING_COPY.footer,
        social: DEFAULT_LANDING_COPY.footer.social.map((item, index) =>
          index === 0 ? { ...item, href: "" } : item
        ),
      })
    );

    expect(parsed.social[0].href).toBe("");
    expect(parsed.social[1].href).toBe(
      DEFAULT_LANDING_COPY.footer.social[1].href
    );
  });
});

describe("landing copy save validation", () => {
  it("accepts internal paths and https URLs for footer links", () => {
    expect(isValidFooterHref("/verify")).toBe(true);
    expect(isValidFooterHref("/#services")).toBe(true);
    expect(isValidFooterHref("https://kalanara.com/promo")).toBe(true);
    expect(isValidFooterHref("")).toBe(false);
    expect(isValidFooterHref("javascript:alert(1)")).toBe(false);
    expect(isValidSocialHref("")).toBe(true);
    expect(isValidSocialHref("https://instagram.com/kalanara")).toBe(true);
    expect(isValidSocialHref("/instagram")).toBe(false);
  });

  it("rejects blank required fields and invalid footer URLs on save", () => {
    expect(() =>
      parseLandingCopySectionForSave("hero", {
        ...DEFAULT_LANDING_COPY.hero,
        titleLine1: "   ",
      })
    ).toThrow(/required/i);

    expect(() =>
      parseLandingCopySectionForSave("footer", {
        ...DEFAULT_LANDING_COPY.footer,
        columns: DEFAULT_LANDING_COPY.footer.columns.map((column, index) =>
          index === 0
            ? {
                ...column,
                links: column.links.map((link, linkIndex) =>
                  linkIndex === 0 ? { ...link, href: "not-a-url" } : link
                ),
              }
            : column
        ),
      })
    ).toThrow(/path|https/i);
  });

  it("serializes a validated section as JSON", () => {
    const saved = parseLandingCopySectionForSave(
      "services",
      DEFAULT_LANDING_COPY.services
    );

    expect(JSON.parse(serializeLandingCopySection("services", saved))).toEqual(
      DEFAULT_LANDING_COPY.services
    );
  });
});

describe("mergeLandingCopyPreservingDirty", () => {
  it("keeps dirty section edits when incoming props refresh", () => {
    const current = {
      ...DEFAULT_LANDING_COPY,
      hero: {
        ...DEFAULT_LANDING_COPY.hero,
        titleLine1: "Draft lokal",
      },
    };
    const incoming = {
      ...DEFAULT_LANDING_COPY,
      services: {
        ...DEFAULT_LANDING_COPY.services,
        title: "Paket dari server",
      },
    };

    const merged = mergeLandingCopyPreservingDirty(incoming, current, ["hero"]);

    expect(merged.hero.titleLine1).toBe("Draft lokal");
    expect(merged.services.title).toBe("Paket dari server");
  });
});
