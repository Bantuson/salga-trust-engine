import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { getGPUTier } from 'detect-gpu';
import * as THREE from 'three';
import { geoMercator } from 'd3-geo';
import saGeoJSON from '../assets/sa-municipalities.json';

// GPU tier detection for LOD
function useGPUTier() {
  const [tier, setTier] = useState(2);
  useEffect(() => {
    getGPUTier().then(result => setTier(result.tier));
  }, []);
  return tier;
}

// Convert GeoJSON polygon to Three.js ExtrudeGeometry
function createExtrudedMesh(
  feature: any,
  projection: any,
  height: number,
  color: string,
  onHover?: (name: string | null) => void,
  onClick?: (code: string) => void
) {
  const coordinates = feature.geometry.coordinates[0];

  // Project coordinates to 2D plane
  const points = coordinates.map((coord: number[]) => {
    const projected = projection(coord);
    return new THREE.Vector2(projected[0] / 100, -projected[1] / 100);
  });

  // Create shape from projected coordinates
  const shape = new THREE.Shape(points);

  // Extrude geometry
  const extrudeSettings = {
    depth: height,
    bevelEnabled: false,
  };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // Material with color based on performance
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.6,
    metalness: 0.3,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { name: feature.properties.name, code: feature.properties.code };

  return mesh;
}

interface SAMapProps {
  gpuTier: number;
  onHover: (name: string | null) => void;
  onClick?: (code: string) => void;
}

// Main SA Map component
function SAMap({ gpuTier, onHover, onClick }: SAMapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const projection = useMemo(() =>
    geoMercator().center([25, -29]).scale(600).translate([0, 0]),
    []
  );

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05; // Slow auto-rotate
    }
  });

  const meshes = useMemo(() => {
    return saGeoJSON.features.map((feature: any) => {
      const extrudeHeight = 0.1 + (feature.properties.performance * 0.3);
      const perf = feature.properties.performance;
      const color = perf > 0.7 ? '#00D9A6' : perf > 0.5 ? '#FBBF24' : '#FF6B4A';
      return createExtrudedMesh(feature, projection, extrudeHeight, color, onHover, onClick);
    });
  }, [projection, gpuTier, onHover, onClick]);

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (e.object.userData.name) {
      onHover(e.object.userData.name);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    onHover(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (e.object.userData.code && onClick) {
      onClick(e.object.userData.code);
    }
  };

  return (
    <group ref={groupRef}>
      {meshes.map((mesh, i) => (
        <primitive
          key={i}
          object={mesh}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      ))}
    </group>
  );
}

interface Globe3DProps {
  className?: string;
  onMunicipalityClick?: (code: string) => void;
}

export default function Globe3D({ className, onMunicipalityClick }: Globe3DProps) {
  const gpuTier = useGPUTier();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}  // DPR cap at 2 for mobile
        frameloop="demand"                                 // On-demand rendering
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{
          precision: 'mediump',                           // mediump shaders for mobile
          antialias: gpuTier >= 2,                        // Disable AA on low-end
          powerPreference: 'high-performance',
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#FF6B4A" />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#00D9A6" />

        <SAMap
          gpuTier={gpuTier}
          onHover={setHovered}
          onClick={onMunicipalityClick}
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          fontSize: '14px',
          pointerEvents: 'none',
        }}>
          {hovered}
        </div>
      )}
    </div>
  );
}
