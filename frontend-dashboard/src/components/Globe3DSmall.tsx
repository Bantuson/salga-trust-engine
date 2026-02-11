/**
 * Small Decorative 3D Globe for Login Page
 * Displays a distorted sphere with teal/coral lighting (abstract SA representation)
 * Code-split via React.lazy for fast initial load
 * Note: Full interactive SA GeoJSON globe is in Plan 09 (public dashboard)
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

function RotatingGlobe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1.5, 32, 32]}>
      <MeshDistortMaterial
        color="#00D9A6"
        emissive="#0A0E1A"
        emissiveIntensity={0.3}
        roughness={0.4}
        metalness={0.8}
        distort={0.15}
        speed={2}
      />
    </Sphere>
  );
}

export default function Globe3DSmall() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 45 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#FF6B4A" />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#00D9A6" />
      <RotatingGlobe />
    </Canvas>
  );
}
