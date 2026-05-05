"use client";

import { generateReactHelpers, generateUploadButton, generateUploadDropzone } from "@uploadthing/react";
import type { UploadRouter } from "@/lib/uploadthing";

export const { useUploadThing } = generateReactHelpers<UploadRouter>({
  url: "/api/uploadthing",
});

export const UploadButton = generateUploadButton<UploadRouter>({
  url: "/api/uploadthing",
});

export const UploadDropzone = generateUploadDropzone<UploadRouter>({
  url: "/api/uploadthing",
});
