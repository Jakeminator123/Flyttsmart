"use client";

import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import Lanyard from "@/components/ui/lanyard";

const IDLE_PLAY_START_DELAY_MS = 1800;
const IDLE_PLAY_INTERVAL_MS = 14000;
const IDLE_PLAY_DURATION_MS = 3600;
const IDLE_PLAYBACK_RATE = 0.72;

interface HeroLanyardSceneProps {
  frontTextureUrl: string;
  didStream: MediaStream | null;
}

export default function HeroLanyardScene({ frontTextureUrl, didStream }: HeroLanyardSceneProps) {
  const [videoTex, setVideoTex] = useState<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const playIntervalRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<number | null>(null);
  const didActiveRef = useRef(false);

  const clearIdlePlaybackTimers = () => {
    if (playTimeoutRef.current) {
      window.clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    if (playIntervalRef.current) {
      window.clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    if (pauseTimeoutRef.current) {
      window.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    videoRef.current = video;

    const playIdleSegment = () => {
      if (didActiveRef.current || video.srcObject || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      if (pauseTimeoutRef.current) {
        window.clearTimeout(pauseTimeoutRef.current);
      }

      try {
        video.currentTime = 0.05;
      } catch {}

      video.playbackRate = IDLE_PLAYBACK_RATE;
      video.play().catch(() => {});

      pauseTimeoutRef.current = window.setTimeout(() => {
        if (didActiveRef.current || video.srcObject) return;
        video.pause();
        try {
          video.currentTime = 0.05;
        } catch {}
      }, IDLE_PLAY_DURATION_MS);
    };

    const onReady = () => {
      video.pause();
      video.playbackRate = IDLE_PLAYBACK_RATE;

      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      textureRef.current = tex;
      setVideoTex(tex);

      playTimeoutRef.current = window.setTimeout(() => {
        playIdleSegment();
        playIntervalRef.current = window.setInterval(playIdleSegment, IDLE_PLAY_INTERVAL_MS);
      }, IDLE_PLAY_START_DELAY_MS);
    };

    video.addEventListener("loadeddata", onReady, { once: true });
    video.src = "/media/videos/aida-intro.mp4";
    video.load();

    return () => {
      clearIdlePlaybackTimers();
      video.removeEventListener("loadeddata", onReady);
      video.pause();
      video.srcObject = null;
      video.src = "";
      textureRef.current?.dispose();
      textureRef.current = null;
      setVideoTex(null);
    };
  }, []);

  useEffect(() => {
    if (!didStream || !videoRef.current) return;
    didActiveRef.current = true;
    clearIdlePlaybackTimers();
    videoRef.current.pause();
    videoRef.current.srcObject = didStream;
    videoRef.current.loop = false;
    videoRef.current.muted = true;
    videoRef.current.playbackRate = 1;
    videoRef.current.play().catch(() => {});
  }, [didStream]);

  if (!videoTex) {
    return null;
  }

  return (
    <Lanyard
      position={[0, 0, 27]}
      fov={22}
      gravity={[0, -40, 0]}
      transparent
      containerClassName="absolute inset-0 overflow-visible"
      cardTextureUrl={frontTextureUrl}
      backVideoTexture={videoTex}
      rigPosition={[3.2, 7.5, 0]}
    />
  );
}
