import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.loader;
    delete imageProps.quality;
    delete imageProps.priority;
    delete imageProps.placeholder;
    delete imageProps.blurDataURL;
    delete imageProps.unoptimized;

    return React.createElement("img", {
      ...imageProps,
      alt: String(props.alt ?? ""),
    });
  },
}));
