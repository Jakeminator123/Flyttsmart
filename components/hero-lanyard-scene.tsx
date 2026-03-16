"use client";

import Lanyard from "@/components/ui/lanyard";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  backTextureUrl?: string;
}

export default function HeroLanyardScene({ frontTextureUrl, backTextureUrl }: HeroLanyardSceneProps) {
  return (
    <Lanyard
      position={[0, 0, 27]}
      fov={22}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute -inset-x-32 top-6 bottom-0 w-auto overflow-visible"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={backTextureUrl}
      rigPosition={[1.55, 6.1, 0]}
    />
  );
}
