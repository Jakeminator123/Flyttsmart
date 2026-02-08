"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, QrCode, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QrScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QrScanner({ onScan, onError, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    setScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);

        // Use BarcodeDetector API if available (Chrome, Edge)
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code"],
          });

          const scan = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const result = barcodes[0].rawValue;
                if (result) {
                  stopScanning();
                  onScan(result);
                  return;
                }
              }
            } catch {
              // Scanning frame failed, continue
            }
            animationRef.current = requestAnimationFrame(scan);
          };
          animationRef.current = requestAnimationFrame(scan);
        } else {
          // Fallback: show camera feed, user must manually enter code
          setError(
            "Din webbläsare stöder inte automatisk QR-skanning. Använd Chrome eller Edge, eller ange koden manuellt."
          );
        }
      }
    } catch {
      setHasCamera(false);
      const msg = "Kunde inte öppna kameran. Kontrollera kamerabehörigheter.";
      setError(msg);
      onError?.(msg);
    }
  }, [onScan, onError, stopScanning]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Skanna QR-kod</CardTitle>
        </div>
        <CardDescription>
          Rikta kameran mot en QR-kod för att automatiskt fylla i dina
          uppgifter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {scanning ? (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-lg bg-black"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            {/* Scan overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-2xl border-2 border-primary/60 shadow-[inset_0_0_0_4000px_rgba(0,0,0,0.3)]" />
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={stopScanning}
              className="absolute right-2 top-2 gap-1.5"
            >
              <X className="h-4 w-4" />
              Stäng
            </Button>
          </div>
        ) : (
          <Button
            onClick={startScanning}
            disabled={!hasCamera}
            className="w-full gap-2"
            variant="outline"
            size="lg"
          >
            <Camera className="h-5 w-5" />
            {hasCamera ? "Öppna kamera" : "Ingen kamera tillgänglig"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
