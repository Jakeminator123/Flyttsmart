'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Canvas, extend, useFrame} from '@react-three/fiber';
import {useGLTF, useTexture, Environment, Lightformer} from '@react-three/drei';
import {
    BallCollider,
    CuboidCollider,
    Physics,
    RigidBody,
    useRopeJoint,
    useSphericalJoint,
    RigidBodyProps
} from '@react-three/rapier';
import {MeshLineGeometry, MeshLineMaterial} from 'meshline';
import * as THREE from 'three';
import clsx from 'clsx';

const cardGLB = '/models/card.glb';
const logoGLB = '/models/logo.glb';

function generateBandTexture(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, 1024, 256);

    ctx.fillStyle = '#5C7FF3';
    ctx.font = 'bold 60px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('flytta.nu', 512, 128);

    const dotX = 512 + ctx.measureText('flytta').width / 2 + 2;
    ctx.beginPath();
    ctx.arc(dotX, 108, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#FD3C73';
    ctx.fill();

    return canvas.toDataURL('image/png');
}

extend({MeshLineGeometry, MeshLineMaterial});

interface LanyardProps {
    position?: [number, number, number];
    gravity?: [number, number, number];
    fov?: number;
    transparent?: boolean;
    containerClassName?: string;
    cardTextureUrl?: string;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export default function Lanyard({
                                    position = [0, 0, 30],
                                    gravity = [0, -40, 0],
                                    fov = 20,
                                    transparent = true,
                                    containerClassName,
                                    cardTextureUrl,
                                    canvasRef
                                }: LanyardProps) {
    const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

    useEffect(() => {
        const handleResize = (): void => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className={clsx(containerClassName || "relative z-0 w-full h-screen flex justify-center items-center transform scale-100 origin-center")}>
            <Canvas
                ref={canvasRef}
                camera={{position, fov}}
                dpr={[1, isMobile ? 1.5 : 2]}
                gl={{alpha: transparent, preserveDrawingBuffer: true}}
                onCreated={({gl}) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
            >
                <ambientLight intensity={Math.PI}/>
                <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
                    <Band isMobile={isMobile} cardTextureUrl={cardTextureUrl}/>
                    {process.env.NEXT_PUBLIC_NYCKEL === 'y' && <KeyChain isMobile={isMobile}/>}
                </Physics>
                {process.env.NEXT_PUBLIC_HUS === 'y' && <FloatingHouse/>}
                {process.env.NEXT_PUBLIC_LOGO === 'y' && <FloatingLogo/>}
                <Environment blur={0.75}>
                    <Lightformer
                        intensity={2}
                        color="white"
                        position={[0, -1, 5]}
                        rotation={[0, 0, Math.PI / 3]}
                        scale={[100, 0.1, 1]}
                    />
                    <Lightformer
                        intensity={3}
                        color="white"
                        position={[-1, -1, 1]}
                        rotation={[0, 0, Math.PI / 3]}
                        scale={[100, 0.1, 1]}
                    />
                    <Lightformer
                        intensity={3}
                        color="white"
                        position={[1, 1, 1]}
                        rotation={[0, 0, Math.PI / 3]}
                        scale={[100, 0.1, 1]}
                    />
                    <Lightformer
                        intensity={10}
                        color="white"
                        position={[-10, 0, 14]}
                        rotation={[0, Math.PI / 2, Math.PI / 3]}
                        scale={[100, 10, 1]}
                    />
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
}

function Band({maxSpeed = 50, minSpeed = 0, isMobile = false, cardTextureUrl}: BandProps) {
    // Using "any" for refs since the exact types depend on Rapier's internals
    const band = useRef<any>(null);
    const fixed = useRef<any>(null);
    const j1 = useRef<any>(null);
    const j2 = useRef<any>(null);
    const j3 = useRef<any>(null);
    const card = useRef<any>(null);

    const vec = new THREE.Vector3();
    const ang = new THREE.Vector3();
    const rot = new THREE.Vector3();
    const dir = new THREE.Vector3();

    const angDamp = Number(process.env.NEXT_PUBLIC_CARD_ANGULAR_DAMPING ?? 4);
    const linDamp = Number(process.env.NEXT_PUBLIC_CARD_LINEAR_DAMPING ?? 4);
    const springStr = Number(process.env.NEXT_PUBLIC_CARD_SPRING_STRENGTH ?? 0.15);
    const spinThresh = Number(process.env.NEXT_PUBLIC_CARD_SPIN_THRESHOLD ?? 1.5);
    const swayXAmt = Number(process.env.NEXT_PUBLIC_CARD_SWAY_X ?? 0.08);
    const swayZAmt = Number(process.env.NEXT_PUBLIC_CARD_SWAY_Z ?? 0.05);

    const segmentProps: any = {
        type: 'dynamic' as RigidBodyProps['type'],
        canSleep: false,
        colliders: false,
        angularDamping: angDamp,
        linearDamping: linDamp
    };

    const {nodes, materials} = useGLTF(cardGLB) as any;

    const [bandTextureUrl] = useState(() => generateBandTexture());
    const texture = useTexture(bandTextureUrl) as THREE.Texture;
    
    // Load custom card texture if provided - use state to handle async loading
    const [customCardTexture, setCustomCardTexture] = useState<THREE.Texture | null>(null);
    
    useEffect(() => {
        if (!cardTextureUrl) {
            setCustomCardTexture(null);
            return;
        }
        
        let disposed = false;
        const loader = new THREE.TextureLoader();
        loader.load(cardTextureUrl, (loadedTexture) => {
            if (disposed) { loadedTexture.dispose(); return; }
            loadedTexture.flipY = false;
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            setCustomCardTexture((prev) => { prev?.dispose(); return loadedTexture; });
        });
        
        return () => { disposed = true; };
    }, [cardTextureUrl]);
    const [curve] = useState(
        () =>
            new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
    );
    const [dragged, drag] = useState<false | THREE.Vector3>(false);
    const [hovered, hover] = useState(false);
    const flipImpulse = useRef(0);
    const lastPointerDown = useRef(0);

    useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
    useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
    useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
    useSphericalJoint(j3, card, [
        [0, 0, 0],
        [0, 1.45, 0]
    ]);

    useEffect(() => {
        if (hovered) {
            document.body.style.cursor = dragged ? 'grabbing' : 'grab';
            return () => {
                document.body.style.cursor = 'auto';
            };
        }
    }, [hovered, dragged]);

    useFrame((state, delta) => {
        if (dragged && typeof dragged !== 'boolean') {
            vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
            dir.copy(vec).sub(state.camera.position).normalize();
            vec.add(dir.multiplyScalar(state.camera.position.length()));
            [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
            card.current?.setNextKinematicTranslation({
                x: vec.x - dragged.x,
                y: vec.y - dragged.y,
                z: vec.z - dragged.z
            });
        }
        if (fixed.current) {
            [j1, j2].forEach(ref => {
                if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
                const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
                ref.current.lerped.lerp(
                    ref.current.translation(),
                    delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
                );
            });
            curve.points[0].copy(j3.current.translation());
            curve.points[1].copy(j2.current.lerped);
            curve.points[2].copy(j1.current.lerped);
            curve.points[3].copy(fixed.current.translation());
            band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
            ang.copy(card.current.angvel());
            rot.copy(card.current.rotation());

            if (flipImpulse.current !== 0) {
                card.current.setAngvel({x: ang.x, y: flipImpulse.current, z: ang.z});
                flipImpulse.current = 0;
            } else if (!dragged) {
                const spinSpeed = Math.abs(ang.y);
                const strength = spinSpeed > spinThresh ? 0.0 : springStr;
                const returnTorque = -rot.y * strength;
                card.current.setAngvel({
                    x: ang.x,
                    y: ang.y + returnTorque,
                    z: ang.z
                });

                const t = state.clock.getElapsedTime();
                const swayX = Math.sin(t * 0.7) * swayXAmt;
                const swayZ = Math.cos(t * 0.5) * swayZAmt;
                card.current.applyImpulse({x: swayX * delta, y: 0, z: swayZ * delta}, true);
            } else {
                card.current.setAngvel({x: ang.x, y: ang.y, z: ang.z});
            }
        }
    });

    curve.curveType = 'chordal';
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

    return (
        <>
            <group position={[0, 4, 0]}>
                <RigidBody ref={fixed} {...segmentProps} type={'fixed' as RigidBodyProps['type']}/>
                <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
                    <BallCollider args={[0.1]}/>
                </RigidBody>
                <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
                    <BallCollider args={[0.1]}/>
                </RigidBody>
                <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
                    <BallCollider args={[0.1]}/>
                </RigidBody>
                <RigidBody
                    position={[2, 0, 0]}
                    ref={card}
                    {...segmentProps}
                    type={dragged ? ('kinematicPosition' as RigidBodyProps['type']) : ('dynamic' as RigidBodyProps['type'])}
                >
                    <CuboidCollider args={[0.8, 1.125, 0.01]}/>
                    <group
                        scale={2.25}
                        position={[0, -1.2, -0.05]}
                        onPointerOver={() => hover(true)}
                        onPointerOut={() => hover(false)}
                        onPointerUp={(e: any) => {
                            e.target.releasePointerCapture(e.pointerId);
                            drag(false);
                        }}
                        onPointerDown={(e: any) => {
                            const now = performance.now();
                            const dt = now - lastPointerDown.current;
                            lastPointerDown.current = now;

                            if (dt < 350) {
                                e.stopPropagation();
                                const hitLocal = e.point.clone().sub(vec.copy(card.current.translation()));
                                const direction = hitLocal.x > 0 ? -1 : 1;
                                flipImpulse.current = direction * 20;
                                drag(false);
                                return;
                            }

                            e.target.setPointerCapture(e.pointerId);
                            drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
                        }}
                    >
                        <mesh geometry={nodes.card.geometry}>
                            <meshPhysicalMaterial
                                map={cardTextureUrl && customCardTexture ? customCardTexture : materials.base.map}
                                map-anisotropy={16}
                                clearcoat={isMobile ? 0 : 1}
                                clearcoatRoughness={0.15}
                                roughness={0.9}
                                metalness={0.8}
                            />
                        </mesh>
                        <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3}/>
                        <mesh geometry={nodes.clamp.geometry} material={materials.metal}/>
                    </group>
                </RigidBody>
            </group>
            <mesh ref={band}>
                <meshLineGeometry/>
                <meshLineMaterial
                    color="white"
                    depthTest={false}
                    resolution={isMobile ? [1000, 2000] : [1000, 1000]}
                    useMap
                    map={texture}
                    repeat={[-4, 1]}
                    lineWidth={1}
                />
            </mesh>
        </>
    );
}

const goldMat = {color: '#e8c040', metalness: 0.98, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 3.2} as const;
const silverMat = {color: '#d8d8e0', metalness: 0.98, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 3.2} as const;

function SingleKey({color, yOffset, scale: s}: {color: typeof goldMat; yOffset: number; scale: number}) {
    return (
        <group position={[0, yOffset, 0]} scale={s}>
            <mesh position={[0, 0.4, 0]}>
                <torusGeometry args={[0.2, 0.06, 32, 48]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0, 0.4, 0]}>
                <torusGeometry args={[0.12, 0.018, 16, 32]}/>
                <meshPhysicalMaterial {...color} roughness={0.2}/>
            </mesh>
            <mesh position={[-0.2, 0.4, 0]}>
                <sphereGeometry args={[0.04, 16, 16]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0.2, 0.4, 0]}>
                <sphereGeometry args={[0.04, 16, 16]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.055, 0.04, 0.12, 16]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0, 0.09, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.02, 20]}/>
                <meshPhysicalMaterial {...color} roughness={0.2}/>
            </mesh>
            <mesh position={[0, -0.16, 0]}>
                <boxGeometry args={[0.05, 0.48, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0, -0.16, 0.011]}>
                <boxGeometry args={[0.018, 0.42, 0.006]}/>
                <meshPhysicalMaterial {...color} roughness={0.3}/>
            </mesh>
            <mesh position={[0.045, -0.12, 0]}>
                <boxGeometry args={[0.04, 0.06, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0.04, -0.22, 0]}>
                <boxGeometry args={[0.03, 0.07, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0.05, -0.31, 0]}>
                <boxGeometry args={[0.05, 0.05, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0.035, -0.38, 0]}>
                <boxGeometry args={[0.025, 0.04, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
            <mesh position={[0.01, -0.42, 0]} rotation={[0, 0, -0.2]}>
                <boxGeometry args={[0.05, 0.022, 0.018]}/>
                <meshPhysicalMaterial {...color}/>
            </mesh>
        </group>
    );
}

function KeyGeometry() {
    return (
        <group>
            <group position={[0, 0.33, 0]}>
                <mesh>
                    <torusGeometry args={[0.24, 0.035, 32, 64]}/>
                    <meshPhysicalMaterial {...goldMat}/>
                </mesh>
                <mesh position={[0, 0, 0.02]} rotation={[0, 0, 0.3]}>
                    <torusGeometry args={[0.2, 0.028, 24, 48, Math.PI * 1.75]}/>
                    <meshPhysicalMaterial {...goldMat} roughness={0.1}/>
                </mesh>
                <mesh position={[0.195, 0.055, 0.02]}>
                    <sphereGeometry args={[0.028, 12, 12]}/>
                    <meshPhysicalMaterial {...goldMat}/>
                </mesh>
            </group>
            <SingleKey color={goldMat} yOffset={-0.12} scale={1}/>
            <group rotation={[0, 0.35, 0.08]}>
                <SingleKey color={silverMat} yOffset={-0.07} scale={0.88}/>
            </group>
        </group>
    );
}

function FloatingHouse() {
    const ref = useRef<any>(null);
    const {scene} = useGLTF('/models/hus.glb') as any;

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        ref.current.position.y = -2.8 + Math.sin(t * 0.6) * 0.1;
        ref.current.rotation.y = Math.sin(t * 0.3) * 0.3;
        ref.current.rotation.x = Math.sin(t * 0.4 + 1) * 0.05;
    });

    return (
        <group ref={ref} position={[0, -2.8, 0]} scale={0.3}>
            <primitive object={scene} />
        </group>
    );
}

function FloatingLogo() {
    const ref = useRef<any>(null);
    const {scene} = useGLTF(logoGLB) as any;

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        ref.current.position.y = -2.5 + Math.sin(t * 0.5 + 0.5) * 0.12;
        ref.current.rotation.y = t * 0.3;
    });

    return (
        <group ref={ref} position={[-3, -2.5, 1]} scale={1.2}>
            <primitive object={scene} />
        </group>
    );
}

function KeyChain({isMobile = false}: {isMobile?: boolean}) {
    const keyBand = useRef<any>(null);
    const keyFixed = useRef<any>(null);
    const kj1 = useRef<any>(null);
    const kj2 = useRef<any>(null);
    const kj3 = useRef<any>(null);
    const keyBody = useRef<any>(null);
    const shimmerLight = useRef<any>(null);
    const chainBeads = useRef<THREE.InstancedMesh>(null);

    const vec = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const ang = new THREE.Vector3();
    const rot = new THREE.Vector3();
    const attachQuat = new THREE.Quaternion();
    const attachVec = new THREE.Vector3();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const BEAD_COUNT = isMobile ? 14 : 22;

    const segProps: any = {
        type: 'dynamic' as RigidBodyProps['type'],
        canSleep: false,
        colliders: false,
        angularDamping: 4,
        linearDamping: 4
    };

    const [curve] = useState(
        () => new THREE.CatmullRomCurve3([
            new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
            new THREE.Vector3(), new THREE.Vector3()
        ])
    );
    const [dragged, drag] = useState<false | THREE.Vector3>(false);
    const [hovered, hover] = useState(false);
    const keyFlipImpulse = useRef(0);
    const keyLastDown = useRef(0);

    useRopeJoint(keyFixed, kj1, [[0, 0, 0], [0, 0, 0], 0.7]);
    useRopeJoint(kj1, kj2, [[0, 0, 0], [0, 0, 0], 0.7]);
    useRopeJoint(kj2, kj3, [[0, 0, 0], [0, 0, 0], 0.7]);
    useSphericalJoint(kj3, keyBody, [[0, 0, 0], [0, 0.5, 0]]);

    useEffect(() => {
        if (hovered) {
            document.body.style.cursor = dragged ? 'grabbing' : 'grab';
            return () => { document.body.style.cursor = 'auto'; };
        }
    }, [hovered, dragged]);

    useFrame((state, delta) => {
        if (dragged && typeof dragged !== 'boolean') {
            vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
            dir.copy(vec).sub(state.camera.position).normalize();
            vec.add(dir.multiplyScalar(state.camera.position.length()));
            [keyBody, kj1, kj2, kj3, keyFixed].forEach(r => r.current?.wakeUp());
            keyBody.current?.setNextKinematicTranslation({
                x: vec.x - dragged.x,
                y: vec.y - dragged.y,
                z: vec.z - dragged.z
            });
        }
        if (keyFixed.current && kj1.current && keyBody.current) {
            [kj1, kj2].forEach(ref => {
                if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
                const clampedDist = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
                ref.current.lerped.lerp(
                    ref.current.translation(),
                    delta * (10 + clampedDist * 40)
                );
            });

            const keyPos = keyBody.current.translation();
            const keyRot = keyBody.current.rotation();
            attachQuat.set(keyRot.x, keyRot.y, keyRot.z, keyRot.w);
            attachVec.set(0, 0.5, 0).applyQuaternion(attachQuat);

            curve.points[0].set(keyPos.x + attachVec.x, keyPos.y + attachVec.y, keyPos.z + attachVec.z);
            curve.points[1].copy(kj3.current.translation());
            curve.points[2].copy(kj2.current.lerped);
            curve.points[3].copy(kj1.current.lerped);
            curve.points[4].copy(keyFixed.current.translation());

            keyBand.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));

            if (chainBeads.current) {
                const pts = curve.getPoints(BEAD_COUNT - 1);
                for (let i = 0; i < BEAD_COUNT; i++) {
                    if (i < pts.length) {
                        dummy.position.copy(pts[i]);
                        dummy.scale.setScalar(1);
                    } else {
                        dummy.scale.setScalar(0);
                    }
                    dummy.updateMatrix();
                    chainBeads.current.setMatrixAt(i, dummy.matrix);
                }
                chainBeads.current.instanceMatrix.needsUpdate = true;
            }

            if (shimmerLight.current) {
                const t = state.clock.getElapsedTime();
                shimmerLight.current.position.set(
                    keyPos.x + Math.sin(t * 2.0) * 0.8,
                    keyPos.y + Math.cos(t * 1.5) * 0.5,
                    keyPos.z + 1.5
                );
                shimmerLight.current.intensity = 3 + Math.sin(t * 3) * 1.5;
            }

            ang.copy(keyBody.current.angvel());
            rot.copy(keyBody.current.rotation());

            if (keyFlipImpulse.current !== 0) {
                keyBody.current.setAngvel({x: ang.x, y: keyFlipImpulse.current, z: ang.z});
                keyFlipImpulse.current = 0;
            } else if (!dragged) {
                const spinSpeed = Math.abs(ang.y);
                const strength = spinSpeed > 1.5 ? 0.0 : 0.12;
                const returnTorque = -rot.y * strength;
                keyBody.current.setAngvel({x: ang.x, y: ang.y + returnTorque, z: ang.z});

                const t = state.clock.getElapsedTime();
                keyBody.current.applyImpulse({
                    x: Math.sin(t * 1.1 + 2) * 0.03 * delta,
                    y: 0,
                    z: Math.cos(t * 0.9 + 1) * 0.02 * delta
                }, true);
            }
        }
    });

    curve.curveType = 'chordal';

    const noRaycast = useMemo(() => () => {}, []);

    return (
        <>
            <pointLight ref={shimmerLight} color="#fff0c0" intensity={3} distance={5} decay={2}/>
            <group position={[1.5, 4, 0]}>
                <RigidBody ref={keyFixed} {...segProps} type={'fixed' as RigidBodyProps['type']}/>
                <RigidBody position={[-0.15, -0.2, 0]} ref={kj1} {...segProps}>
                    <BallCollider args={[0.05]}/>
                </RigidBody>
                <RigidBody position={[-0.25, -0.45, 0]} ref={kj2} {...segProps}>
                    <BallCollider args={[0.05]}/>
                </RigidBody>
                <RigidBody position={[-0.35, -0.75, 0]} ref={kj3} {...segProps}>
                    <BallCollider args={[0.05]}/>
                </RigidBody>
                <RigidBody
                    position={[-0.4, -1.4, 0]}
                    ref={keyBody}
                    {...segProps}
                    type={dragged ? ('kinematicPosition' as RigidBodyProps['type']) : ('dynamic' as RigidBodyProps['type'])}
                >
                    <BallCollider args={[0.35]}/>
                    <group
                        scale={1.5}
                        onPointerOver={() => hover(true)}
                        onPointerOut={() => hover(false)}
                        onPointerUp={(e: any) => {
                            e.target.releasePointerCapture(e.pointerId);
                            drag(false);
                        }}
                        onPointerDown={(e: any) => {
                            const now = performance.now();
                            const dt = now - keyLastDown.current;
                            keyLastDown.current = now;

                            if (dt < 350) {
                                e.stopPropagation();
                                const hitLocal = e.point.clone().sub(vec.copy(keyBody.current.translation()));
                                const direction = hitLocal.x > 0 ? -1 : 1;
                                keyFlipImpulse.current = direction * 20;
                                drag(false);
                                return;
                            }

                            e.target.setPointerCapture(e.pointerId);
                            drag(new THREE.Vector3().copy(e.point).sub(vec.copy(keyBody.current.translation())));
                        }}
                    >
                        <KeyGeometry/>
                    </group>
                </RigidBody>
            </group>
            <instancedMesh
                ref={(mesh: THREE.InstancedMesh | null) => {
                    chainBeads.current = mesh;
                    if (mesh) mesh.raycast = noRaycast as any;
                }}
                args={[undefined as any, undefined as any, BEAD_COUNT]}
            >
                <sphereGeometry args={[0.05, 12, 12]}/>
                <meshPhysicalMaterial {...goldMat}/>
            </instancedMesh>
            <mesh ref={(m: any) => { keyBand.current = m; if (m) m.raycast = noRaycast; }}>
                <meshLineGeometry/>
                <meshLineMaterial
                    color="#8b6914"
                    depthTest={false}
                    resolution={isMobile ? [1000, 2000] : [1000, 1000]}
                    lineWidth={0.15}
                />
            </mesh>
        </>
    );
}
