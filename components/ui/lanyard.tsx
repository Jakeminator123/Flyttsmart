'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useTexture, Environment, Lightformer } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RigidBodyProps,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

const AUTO_FLIP_AFTER_MS = 8000;

function angleDelta(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function generateBandTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#0f1320';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#7ee8a2';
  ctx.font = 'bold 60px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('flytt.io', 512, 128);
  return canvas.toDataURL('image/png');
}

extend({ MeshLineGeometry, MeshLineMaterial });

export interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
  containerClassName?: string;
  cardTextureUrl?: string;
  cardBackTextureUrl?: string;
  backVideoTexture?: THREE.Texture | null;
}

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  containerClassName,
  cardTextureUrl,
  cardBackTextureUrl,
  backVideoTexture,
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={cn("relative z-0 w-full h-full flex justify-center items-center", containerClassName)}>
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band
            isMobile={isMobile}
            cardTextureUrl={cardTextureUrl}
            cardBackTextureUrl={cardBackTextureUrl}
            backVideoTexture={backVideoTexture}
          />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

interface BandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
  cardTextureUrl?: string;
  cardBackTextureUrl?: string;
  backVideoTexture?: THREE.Texture | null;
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false, cardTextureUrl, cardBackTextureUrl, backVideoTexture }: BandProps) {
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);
  const cardVisual = useRef<THREE.Group>(null);
  const mountedAtRef = useRef(0);
  const hasAutoFlippedRef = useRef(false);
  const targetVisualRotationRef = useRef(0);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps: any = {
    type: 'dynamic' as RigidBodyProps['type'],
    canSleep: false,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  };

  const [bandTextureUrl] = useState(() => generateBandTexture());
  const texture = useTexture(bandTextureUrl) as THREE.Texture;

  const [customCardTexture, setCustomCardTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!cardTextureUrl) { setCustomCardTexture(null); return; }
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(cardTextureUrl, (t) => {
      if (disposed) { t.dispose(); return; }
      t.flipY = true;
      t.colorSpace = THREE.SRGBColorSpace;
      setCustomCardTexture((prev) => { prev?.dispose(); return t; });
    });
    return () => { disposed = true; };
  }, [cardTextureUrl]);

  const [customBackTexture, setCustomBackTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!cardBackTextureUrl) { setCustomBackTexture(null); return; }
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(cardBackTextureUrl, (t) => {
      if (disposed) { t.dispose(); return; }
      t.flipY = true;
      t.colorSpace = THREE.SRGBColorSpace;
      setCustomBackTexture((prev) => { prev?.dispose(); return t; });
    });
    return () => { disposed = true; };
  }, [cardBackTextureUrl]);

  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]));
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);
  const flipImpulse = useRef(0);
  const lastPointerDown = useRef(0);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 2.55, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => { document.body.style.cursor = 'auto'; };
    }
  }, [hovered, dragged]);

  useEffect(() => {
    mountedAtRef.current = performance.now();
  }, []);

  useFrame((state, delta) => {
    if (!hasAutoFlippedRef.current && mountedAtRef.current !== 0 && performance.now() - mountedAtRef.current >= AUTO_FLIP_AFTER_MS) {
      flipImpulse.current = -18;
      hasAutoFlippedRef.current = true;
      targetVisualRotationRef.current = Math.PI;
      card.current?.setAngularDamping?.(12);
      card.current?.setLinearDamping?.(10);
      j1.current?.setAngularDamping?.(8);
      j1.current?.setLinearDamping?.(8);
      j2.current?.setAngularDamping?.(8);
      j2.current?.setLinearDamping?.(8);
      j3.current?.setAngularDamping?.(8);
      j3.current?.setLinearDamping?.(8);
    }

    if (dragged && typeof dragged !== 'boolean') {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (cardVisual.current) {
      cardVisual.current.rotation.y = THREE.MathUtils.damp(
        cardVisual.current.rotation.y,
        targetVisualRotationRef.current,
        hasAutoFlippedRef.current ? 4.8 : 8,
        delta,
      );
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current?.geometry?.setPoints(curve.getPoints(isMobile ? 18 : 36));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());

      if (flipImpulse.current !== 0) {
        card.current.setAngvel({ x: ang.x, y: flipImpulse.current, z: ang.z });
        flipImpulse.current = 0;
      } else if (!dragged) {
        const spinSpeed = Math.abs(ang.y);
        const targetRotationY = 0;
        const strength = hasAutoFlippedRef.current ? 0.2 : spinSpeed > 1.5 ? 0.0 : 0.15;
        const returnTorque = angleDelta(targetRotationY, rot.y) * strength;
        card.current.setAngvel({ x: ang.x, y: ang.y + returnTorque, z: ang.z });
        if (!hasAutoFlippedRef.current) {
          const t = state.clock.getElapsedTime();
          card.current.applyImpulse({ x: Math.sin(t * 0.7) * 0.08 * delta, y: 0, z: Math.cos(t * 0.5) * 0.05 * delta }, true);
        }
      } else {
        card.current.setAngvel({ x: ang.x, y: ang.y, z: ang.z });
      }
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const resolvedBackTex = backVideoTexture ?? customBackTexture;

  return (
    <>
      <group position={[0, 7.5, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type={'fixed' as RigidBodyProps['type']} />
        <RigidBody position={[0, -1, 0]} ref={j1} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody position={[0, -2, 0]} ref={j2} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody position={[0, -3, 0]} ref={j3} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody
          position={[0, -5.2, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? ('kinematicPosition' as RigidBodyProps['type']) : ('dynamic' as RigidBodyProps['type'])}
        >
          <CuboidCollider args={[1.8, 2.55, 0.06]} />
          <group
            ref={cardVisual}
            scale={5}
            position={[0, 0, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: any) => { e.target.releasePointerCapture(e.pointerId); drag(false); }}
            onPointerDown={(e: any) => {
              const now = performance.now();
              const dt = now - lastPointerDown.current;
              lastPointerDown.current = now;
              if (dt < 350) {
                e.stopPropagation();
                const hitLocal = e.point.clone().sub(vec.copy(card.current.translation()));
                flipImpulse.current = (hitLocal.x > 0 ? -1 : 1) * 20;
                drag(false);
                return;
              }
              e.target.setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <FallbackCard isMobile={isMobile} frontTex={customCardTexture} backTex={resolvedBackTex} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={isMobile ? [1000, 2000] : [1000, 1000]} useMap map={texture} repeat={[-4, 1]} lineWidth={1} />
      </mesh>
    </>
  );
}

function FallbackCard({ isMobile, frontTex, backTex }: { isMobile: boolean; frontTex?: THREE.Texture | null; backTex?: THREE.Texture | null }) {
  const [fallbackTex] = useState(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 720;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#151c2a');
    grad.addColorStop(1, '#0f1320');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 720);
    ctx.fillStyle = '#7ee8a2';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('flytt.io', 256, 340);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  const front = frontTex ?? fallbackTex;
  const back = backTex ?? fallbackTex;

  return (
    <>
      <mesh>
        <boxGeometry args={[0.71, 1, 0.02]} />
        <meshPhysicalMaterial map={front} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.15} roughness={0.9} metalness={0.8} side={THREE.FrontSide} />
      </mesh>
      <mesh raycast={() => {}}>
        <boxGeometry args={[0.71, 1, 0.02]} />
        <meshPhysicalMaterial map={back} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.15} roughness={0.9} metalness={0.8} side={THREE.BackSide} />
      </mesh>
    </>
  );
}
