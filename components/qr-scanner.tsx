"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopScanning = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const scanQRCode = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !isScanning) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // Check if it looks like a voucher code (KSP-YYYY-XXXXXXXX)
        const voucherCodePattern = /^KSP-\d{4}-[A-Z0-9]{8}$/;
        if (voucherCodePattern.test(code.data)) {
          stopScanning();
          onScan(code.data);
          return;
        }
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCode);
  }, [isScanning, onScan, stopScanning]);

  const startScanning = useCallback(async () => {
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to access camera. Please check permissions.";
      setErrorMessage(message);
      onError?.(message);
    }
  }, [onError]);

  useEffect(() => {
    if (isScanning) {
      animationRef.current = requestAnimationFrame(scanQRCode);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, scanQRCode]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative aspect-square bg-sage-900 rounded-2xl overflow-hidden">
        {isScanning ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner markers */}
              <div className="absolute inset-8">
                <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-sand-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-sand-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-sand-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-sand-400 rounded-br-lg" />
              </div>

              {/* Scanning line animation */}
              <div className="absolute inset-8 overflow-hidden">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-sage-400 to-transparent animate-pulse" 
                     style={{ animation: "scan 2s ease-in-out infinite" }} />
              </div>
            </div>

            {/* Stop button */}
            <button
              onClick={stopScanning}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-red-600 transition-colors"
            >
              <CameraOff size={18} />
              Stop Scanning
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            {hasPermission === false ? (
              <>
                <CameraOff size={48} className="text-sage-400 mb-4" />
                <p className="text-sand-100 mb-2">Camera Access Denied</p>
                <p className="text-sage-400 text-sm mb-6">
                  {errorMessage || "Please enable camera access in your browser settings."}
                </p>
                <Button
                  onClick={startScanning}
                  className="bg-sage-700 hover:bg-sage-600 text-white"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Camera size={48} className="text-sage-400 mb-4" />
                <p className="text-sand-100 mb-2">Scan QR Code</p>
                <p className="text-sage-400 text-sm mb-6">
                  Point your camera at a voucher QR code to verify
                </p>
                <Button
                  onClick={startScanning}
                  className="bg-sage-700 hover:bg-sage-600 text-white"
                >
                  <Camera size={18} className="mr-2" />
                  Start Scanning
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(calc(100% - 4px)); }
        }
      `}</style>
    </div>
  );
}
