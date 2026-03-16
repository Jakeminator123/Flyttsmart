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
      containerClassName="absolute -left-20 -right-6 -top-2 bottom-0 w-auto overflow-visible lg:-left-40 xl:-left-52"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={backTextureUrl}
      rigPosition={[0.95, 6.2, 0]}
    />
  );
}
