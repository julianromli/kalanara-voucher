"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseMemberScan } from "@/lib/membership/scan";
import { tryAppBaseUrl } from "@/lib/membership/urls";

interface MemberScanPanelProps {
  onScan: (value: string) => void;
  status: "idle" | "found" | "rejected" | "not_found" | "loading";
  statusName?: string;
  manualValue: string;
  onManualChange: (value: string) => void;
  onManualSubmit: () => void;
}

export function MemberScanPanel({
  onScan,
  status,
  statusName,
  manualValue,
  onManualChange,
  onManualSubmit,
}: MemberScanPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastCodeRef = useRef("");
  const lastSeenAtRef = useRef(0);
  const lastDecodeAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  const statusRef = useRef(status);
  const cameraGeneration = useRef(0);
  const [cameraState, setCameraState] = useState<"starting" | "live" | "blocked">("starting");

  useEffect(() => {
    onScanRef.current = onScan;
    statusRef.current = status;
  }, [onScan, status]);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = useCallback(() => {
    cameraGeneration.current += 1;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
  }, [stopStream]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const generation = cameraGeneration.current + 1;
    cameraGeneration.current = generation;
    setCameraState("starting");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (generation !== cameraGeneration.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (generation !== cameraGeneration.current) {
        stopStream(stream);
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      setCameraState("live");
    } catch {
      if (stream && generation === cameraGeneration.current) stopStream(stream);
      if (generation === cameraGeneration.current) setCameraState("blocked");
    }
  }, [stopCamera, stopStream]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Turn the camera off while the tab is hidden (light stays off, no decoding
  // in the background) and back on when the cashier returns. A blocked camera
  // stays blocked until they press Coba lagi.
  const cameraStateRef = useRef(cameraState);
  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);
  useEffect(() => {
    let paused = false;
    const onVisibility = () => {
      if (document.hidden) {
        if (cameraStateRef.current === "blocked") return;
        paused = true;
        stopCamera();
        return;
      }
      if (paused) {
        paused = false;
        void startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (cameraState !== "live") return;
    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const now = Date.now();
      if (
        video &&
        canvas &&
        video.readyState >= video.HAVE_ENOUGH_DATA &&
        now - lastDecodeAtRef.current >= 120
      ) {
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, 1));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: "dontInvert",
          });
          lastDecodeAtRef.current = now;
          if (code?.data) {
            lastSeenAtRef.current = now;
            if (code.data !== lastCodeRef.current && statusRef.current !== "loading") {
              lastCodeRef.current = code.data;
              onScanRef.current(code.data);
            }
          } else if (now - lastSeenAtRef.current > 800) {
            lastCodeRef.current = "";
          }
        }
      }
      frameRef.current = requestAnimationFrame(scan);
    };
    frameRef.current = requestAnimationFrame(scan);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraState]);

  useEffect(() => {
    let buffer = "";
    let lastAt = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      const now = Date.now();
      if (now - lastAt > 80) buffer = "";
      lastAt = now;
      if (event.key === "Enter") {
        const parsed = parseMemberScan(buffer, {
          appUrl: tryAppBaseUrl() || undefined,
          origin: window.location.origin,
        });
        if (parsed.kind === "token" || parsed.kind === "phone" || parsed.kind === "code") {
          event.preventDefault();
          if (statusRef.current !== "loading") onScanRef.current(buffer);
        }
        buffer = "";
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-neutral-950 text-white">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-6">
          <span className="absolute top-0 left-0 size-8 rounded-tl-md border-t-2 border-l-2" />
          <span className="absolute top-0 right-0 size-8 rounded-tr-md border-t-2 border-r-2" />
          <span className="absolute bottom-0 left-0 size-8 rounded-bl-md border-b-2 border-l-2" />
          <span className="absolute right-0 bottom-0 size-8 rounded-br-md border-r-2 border-b-2" />
          <span className="motion-safe:animate-pulse absolute top-1/2 right-2 left-2 h-px -translate-y-1/2 bg-white/70" />
        </div>
        {cameraState !== "live" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Camera className="size-6 text-white/80" aria-hidden="true" />
            <p className="text-sm font-medium">
              {cameraState === "blocked" ? "Kamera belum diizinkan" : "Menyalakan kamera"}
            </p>
            {cameraState === "blocked" ? (
              <>
                <p className="text-xs text-white/70">
                  Klik ikon kamera di address bar, pilih Izinkan, terus muat ulang.
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={() => void startCamera()}>
                  <RotateCcw className="size-4" />
                  Coba lagi
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
            Arahkan QR member ke kamera
          </p>
        )}
        {status === "found" && statusName ? (
          <div className="absolute inset-x-0 top-4 flex justify-center">
            <p className="rounded-full bg-success px-3 py-1 text-xs font-medium text-success-foreground" role="status">
              {statusName} ketemu
            </p>
          </div>
        ) : null}
        {status === "rejected" ? (
          <div className="absolute inset-x-0 top-4 flex justify-center px-4">
            <p className="rounded-full bg-destructive px-3 py-1 text-center text-xs font-medium text-white" role="alert">
              QR ini bukan kartu member Kalanara
            </p>
          </div>
        ) : null}
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onManualSubmit();
        }}
      >
        <label htmlFor="member-phone-search" className="text-sm font-medium">
          Atau cari pakai nomor HP
        </label>
        <div className="flex gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="pl-3 text-sm text-muted-foreground" aria-hidden="true">+62</span>
            <Input
              id="member-phone-search"
              value={manualValue}
              onChange={(event) => onManualChange(event.target.value)}
              inputMode="numeric"
              autoComplete="tel-national"
              className="h-9 border-0 shadow-none focus-visible:ring-0"
              aria-label="Nomor HP member"
            />
          </div>
          <Button type="submit" variant="outline" disabled={status === "loading"}>
            {status === "loading" ? "Mencari…" : "Cari"}
          </Button>
        </div>
        {status === "not_found" ? (
          <p className="text-sm text-destructive" role="alert">
            Nomor ini belum terdaftar.
          </p>
        ) : null}
      </form>
    </div>
  );
}
