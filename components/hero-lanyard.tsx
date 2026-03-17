"use client";

import { useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import HeroCardTexture from "@/components/hero-card-texture";
import HeroCardBackTexture from "@/components/hero-card-back-texture";

const LanyardScene = dynamic(() => import("@/components/hero-lanyard-scene"), { ssr: false });

export function HeroLanyard() {
  const [frontTextureUrl, setFrontTextureUrl] = useState<string | undefined>(undefined);
  const [backTextureUrl, setBackTextureUrl] = useState<string | undefined>(undefined);

  const handleFrontReady = useCallback((dataUrl: string) => {
    setFrontTextureUrl(dataUrl);
  }, []);

  const handleBackReady = useCallback((dataUrl: string) => {
    setBackTextureUrl(dataUrl);
  }, []);

  return (
    <>
      <HeroCardTexture onTextureReady={handleFrontReady} />
      <HeroCardBackTexture onTextureReady={handleBackReady} />
      <div className="relative mx-auto h-96 w-full overflow-visible sm:h-120 lg:h-128 xl:h-152">
        {frontTextureUrl ? (
          <Suspense fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }>
            <LanyardScene
              frontTextureUrl={frontTextureUrl}
              backTextureUrl={backTextureUrl}
            />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </>
  );
}
