"use client";

import Lanyard from "@/components/ui/lanyard";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  backTextureUrl?: string;
}

export default function HeroLanyardScene({ frontTextureUrl, backTextureUrl }: HeroLanyardSceneProps) {
  return (
    <Lanyard
      position={[0, 0, 31]}
      fov={18}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute inset-0 w-auto overflow-visible"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={backTextureUrl}
      rigPosition={[2.2, 8.1, 0]}
    />
  );
}
