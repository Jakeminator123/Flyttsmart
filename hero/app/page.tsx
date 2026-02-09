"use client";

import FloatingLines from "@/components/floating-lines";
import HeroSection from "@/components/hero-section";
import { HeroHeader } from "@/components/hero-header";
import { useState } from "react";

export default function Home() {
  const [colorPreset, setColorPreset] = useState<string[]>(["#7C444F", "#9F5255", "#E16A54", "#F39E60"]);

  return (
    <div className="relative min-h-dvh w-full bg-background">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <FloatingLines
          linesGradient={colorPreset}
          enabledWaves={["bottom", "middle", "top"]}
          lineCount={[4, 6, 3]}
          lineDistance={[8, 5, 10]}
          animationSpeed={0.8}
          interactive={true}
          bendRadius={5.0}
          bendStrength={-0.5}
          mouseDamping={0.05}
          parallax={true}
          parallaxStrength={0.15}
          mixBlendMode="screen"
        />
      </div>

      <HeroHeader onColorPresetChange={setColorPreset} />

      {/* Hero Content */}
      <div className="relative z-10">
        <HeroSection />
      </div>
    </div>
  );
}
