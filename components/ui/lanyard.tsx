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
const MIN_SETTLE_BEFORE_LOCK_MS = 1400;
const MAX_SETTLE_BEFORE_LOCK_MS = 2800;

function angleDelta(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  rigPosition?: [number, number, number];
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
  rigPosition = [0, 7.5, 0],
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < 768);
    handleResize();
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
            rigPosition={rigPosition}
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
  rigPosition?: [number, number, number];
}

function Band({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
  cardTextureUrl,
  cardBackTextureUrl,
  backVideoTexture,
  rigPosition = [0, 7.5, 0],
}: BandProps) {
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);
  const cardVisual = useRef<THREE.Group>(null);
  const hasAutoFlippedRef = useRef(false);
  const pendingStabilizeRef = useRef(false);
  const autoFlipStartedAtRef = useRef<number | null>(null);
  const targetVisualRotationRef = useRef(0);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();

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
  const [stabilized, setStabilized] = useState(false);
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
    const timer = window.setTimeout(() => {
      drag(false);
      flipImpulse.current = -10;
      hasAutoFlippedRef.current = true;
      pendingStabilizeRef.current = true;
      autoFlipStartedAtRef.current = performance.now();
      targetVisualRotationRef.current = Math.PI;
      card.current?.wakeUp?.();
      card.current?.setAngularDamping?.(12);
      card.current?.setLinearDamping?.(10);
      j1.current?.setAngularDamping?.(8);
      j1.current?.setLinearDamping?.(8);
      j2.current?.setAngularDamping?.(8);
      j2.current?.setLinearDamping?.(8);
      j3.current?.setAngularDamping?.(8);
      j3.current?.setLinearDamping?.(8);
    }, AUTO_FLIP_AFTER_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useFrame((state, delta) => {
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
        hasAutoFlippedRef.current ? 9.5 : 8,
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
      const rotation = card.current.rotation();
      quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
      euler.setFromQuaternion(quat);

      if (flipImpulse.current !== 0) {
        card.current.setAngvel({ x: ang.x, y: flipImpulse.current, z: ang.z });
        flipImpulse.current = 0;
      } else if (!dragged) {
        const spinSpeed = Math.abs(ang.y);
        const targetRotationY = 0;
        const yawStrength = hasAutoFlippedRef.current ? 0.22 : spinSpeed > 1.5 ? 0.0 : 0.15;
        const uprightStrength = hasAutoFlippedRef.current ? 0.42 : 0.1;
        const returnTorqueY = angleDelta(targetRotationY, euler.y) * yawStrength;
        const returnTorqueX = angleDelta(0, euler.x) * uprightStrength;
        const returnTorqueZ = angleDelta(0, euler.z) * uprightStrength;
        card.current.setAngvel({
          x: ang.x + returnTorqueX,
          y: ang.y + returnTorqueY,
          z: ang.z + returnTorqueZ,
        });
        if (!hasAutoFlippedRef.current) {
          const t = state.clock.getElapsedTime();
          card.current.applyImpulse({ x: Math.sin(t * 0.7) * 0.08 * delta, y: 0, z: Math.cos(t * 0.5) * 0.05 * delta }, true);
        }
      } else {
        card.current.setAngvel({ x: ang.x, y: ang.y, z: ang.z });
      }

      if (pendingStabilizeRef.current && autoFlipStartedAtRef.current && !stabilized) {
        const elapsed = performance.now() - autoFlipStartedAtRef.current;
        const visualSettled =
          cardVisual.current ? Math.abs(angleDelta(Math.PI, cardVisual.current.rotation.y)) < 0.045 : false;
        const uprightSettled = Math.abs(euler.x) < 0.08 && Math.abs(euler.z) < 0.08;
        const angularSettled = Math.abs(ang.x) < 0.12 && Math.abs(ang.y) < 0.22 && Math.abs(ang.z) < 0.12;
        const shouldLock =
          (elapsed > MIN_SETTLE_BEFORE_LOCK_MS && visualSettled && uprightSettled && angularSettled) ||
          elapsed > MAX_SETTLE_BEFORE_LOCK_MS;

        if (shouldLock) {
          pendingStabilizeRef.current = false;
          card.current?.setRotation?.({ x: 0, y: 0, z: 0, w: 1 }, true);
          card.current?.setAngvel?.({ x: 0, y: 0, z: 0 }, true);
          cardVisual.current?.rotation.set(0, Math.PI, 0);
          setStabilized(true);
        }
      }
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const resolvedBackTex = backVideoTexture ?? customBackTexture;

  return (
    <>
      <group position={rigPosition}>
        <RigidBody ref={fixed} {...segmentProps} type={'fixed' as RigidBodyProps['type']} />
        <RigidBody position={[0, -1, 0]} ref={j1} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody position={[0, -2, 0]} ref={j2} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody position={[0, -3, 0]} ref={j3} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}><BallCollider args={[0.12]} /></RigidBody>
        <RigidBody
          position={[0, -5.2, 0]}
          ref={card}
          {...segmentProps}
          type={
            stabilized
              ? ('fixed' as RigidBodyProps['type'])
              : dragged
                ? ('kinematicPosition' as RigidBodyProps['type'])
                : ('dynamic' as RigidBodyProps['type'])
          }
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
              if (stabilized) return;
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
  const [backPanelTex] = useState(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d')!;
    const bg = ctx.createLinearGradient(0, 0, 0, 720);
    bg.addColorStop(0, '#17223d');
    bg.addColorStop(0.5, '#0d1730');
    bg.addColorStop(1, '#070b16');
    ctx.fillStyle = bg;
    roundRectPath(ctx, 0, 0, 512, 720, 34);
    ctx.fill();

    const glow = ctx.createRadialGradient(400, 120, 0, 400, 120, 260);
    glow.addColorStop(0, 'rgba(130,165,255,0.22)');
    glow.addColorStop(1, 'rgba(130,165,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 720);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRectPath(ctx, 20, 20, 472, 680, 28);
    ctx.fill();

    ctx.fillStyle = '#dce7ff';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Aida live', 46, 52);

    ctx.fillStyle = 'rgba(140,184,255,0.14)';
    roundRectPath(ctx, 360, 30, 106, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#98c9ff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Avatarfönster', 413, 46);

    const windowX = 42;
    const windowY = 94;
    const windowW = 428;
    const windowH = 484;

    ctx.fillStyle = 'rgba(35,52,92,0.92)';
    roundRectPath(ctx, windowX, windowY, windowW, windowH, 28);
    ctx.fill();

    ctx.strokeStyle = 'rgba(152,201,255,0.7)';
    ctx.lineWidth = 3;
    roundRectPath(ctx, windowX + 2, windowY + 2, windowW - 4, windowH - 4, 26);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(94,138,255,0.28)';
    ctx.lineWidth = 10;
    roundRectPath(ctx, windowX + 10, windowY + 10, windowW - 20, windowH - 20, 22);
    ctx.stroke();

    const windowShade = ctx.createLinearGradient(0, windowY, 0, windowY + windowH);
    windowShade.addColorStop(0, 'rgba(255,255,255,0.06)');
    windowShade.addColorStop(1, 'rgba(8,13,24,0.3)');
    ctx.fillStyle = windowShade;
    roundRectPath(ctx, windowX + 8, windowY + 8, windowW - 16, windowH - 16, 20);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRectPath(ctx, 42, 606, 428, 72, 22);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#edf3ff';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Aida vaknar mjukt', 64, 635);
    ctx.fillStyle = 'rgba(237,243,255,0.72)';
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText('Först stilla, sedan små lugna rörelser innan live-avataren tar över.', 64, 664);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const [windowMaskTex] = useState(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 720;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 720);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 512, 720);
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, 0, 0, 512, 720, 30);
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
  });

  const front = frontTex ?? fallbackTex;
  const back = backTex ?? fallbackTex;

  return (
    <>
      <mesh position={[0, 0, 0.013]}>
        <planeGeometry args={[0.71, 1]} />
        <meshPhysicalMaterial map={front} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.15} roughness={0.9} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.013]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.71, 1]} />
        <meshPhysicalMaterial map={backPanelTex} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.15} roughness={0.82} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.015, -0.0155]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.53, 0.66]} />
        <meshBasicMaterial map={back} alphaMap={windowMaskTex} transparent toneMapped={false} />
      </mesh>
      <mesh raycast={() => {}}>
        <boxGeometry args={[0.72, 1.01, 0.018]} />
        <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.6} />
      </mesh>
    </>
  );
}
