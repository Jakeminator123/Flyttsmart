"use client";

import Lanyard from "@/components/ui/lanyard";
import flyttgumman from "@/flyttgumman.jpg";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
}

export default function HeroLanyardScene({ frontTextureUrl }: HeroLanyardSceneProps) {

  return (
    <Lanyard
      position={[0, 0, 27]}
      fov={22}
      gravity={[0, -40, 0]}
      transparent
      autoFlip={false}
      containerClassName="absolute inset-0 overflow-visible"
      cardTextureUrl={frontTextureUrl}
      cardBackTextureUrl={flyttgumman.src}
      rigPosition={[1.55, 7.5, 0]}
    />
  );
}
