"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const AIDA_INTRO_SRC = "/media/videos/aida-intro.mp4";

interface UseBackVideoTextureOptions {
  didStream: MediaStream | null;
}

export function useBackVideoTexture({ didStream }: UseBackVideoTextureOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = AIDA_INTRO_SRC;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.play().catch(() => {});
    videoRef.current = video;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    textureRef.current = tex;
    setTexture(tex);

    return () => {
      video.pause();
      video.src = "";
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    if (!didStream || !videoRef.current || !textureRef.current) return;
    const video = videoRef.current;
    video.srcObject = didStream;
    video.loop = false;
    video.muted = false;
    video.play().catch(() => {});
    textureRef.current.needsUpdate = true;
  }, [didStream]);

  useFrame(() => {
    if (textureRef.current && videoRef.current && !videoRef.current.paused) {
      textureRef.current.needsUpdate = true;
    }
  });

  return texture;
}
