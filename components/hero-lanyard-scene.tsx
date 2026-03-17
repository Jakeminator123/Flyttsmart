"use client";

import Lanyard from "@/components/ui/lanyard";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  backTextureUrl?: string;
}

export default function HeroLanyardScene({ frontTextureUrl, backTextureUrl }: HeroLanyardSceneProps) {
  return (
    <Lanyard
      position={[0, 0, 28]}
      fov={22}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute -left-20 top-0 right-0 bottom-0 overflow-visible"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={backTextureUrl}
      rigPosition={[0, 6.5, 0]}
    />
  );
}
