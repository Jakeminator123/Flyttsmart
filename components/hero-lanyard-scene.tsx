"use client";

import Lanyard from "@/components/ui/lanyard";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  backTextureUrl?: string;
}

export default function HeroLanyardScene({ frontTextureUrl, backTextureUrl }: HeroLanyardSceneProps) {
  return (
    <Lanyard
      position={[-2, 0, 28]}
      fov={24}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute -left-32 top-0 right-0 bottom-0 overflow-visible xl:-left-48"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={backTextureUrl}
      rigPosition={[-1, 6, 0]}
    />
  );
}
