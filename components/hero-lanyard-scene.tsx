"use client";

import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import Lanyard from "@/components/ui/lanyard";

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  didStream: MediaStream | null;
}

export default function HeroLanyardScene({ frontTextureUrl, didStream }: HeroLanyardSceneProps) {
  const [videoTex, setVideoTex] = useState<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/media/videos/aida-intro.mp4";
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.play().catch(() => {});
    videoRef.current = video;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    setVideoTex(tex);

    return () => {
      video.pause();
      video.src = "";
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    if (!didStream || !videoRef.current) return;
    videoRef.current.srcObject = didStream;
    videoRef.current.loop = false;
    videoRef.current.muted = false;
    videoRef.current.play().catch(() => {});
  }, [didStream]);

  return (
    <Lanyard
      position={[0, 0, 30]}
      fov={24}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute inset-0 overflow-visible"
      cardTextureUrl={frontTextureUrl}
      backVideoTexture={videoTex}
    />
  );
}
