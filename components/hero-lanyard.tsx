"use client";

import { useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import HeroCardTexture from "@/components/hero-card-texture";
import { useDIDStream } from "@/lib/did-stream-context";

const LanyardScene = dynamic(() => import("@/components/hero-lanyard-scene"), { ssr: false });

export function HeroLanyard() {
  const [frontTextureUrl, setFrontTextureUrl] = useState<string | undefined>(undefined);
  const { stream } = useDIDStream();

  const handleFrontReady = useCallback((dataUrl: string) => {
    setFrontTextureUrl(dataUrl);
  }, []);

  return (
    <>
      <HeroCardTexture onTextureReady={handleFrontReady} />
      <div className="relative mx-auto h-[55vh] min-h-136 w-full overflow-visible sm:h-[65vh] sm:min-h-168 lg:h-[78vh] lg:min-h-224">
        {frontTextureUrl ? (
          <Suspense fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }>
            <LanyardScene
              frontTextureUrl={frontTextureUrl}
              didStream={stream}
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
