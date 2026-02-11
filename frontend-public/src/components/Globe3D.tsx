import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { getGPUTier } from 'detect-gpu';
import * as THREE from 'three';
import { geoMercator } from 'd3-geo';
import saGeoJSON from '../assets/sa-municipalities.json';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

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
  gpuTier: number
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

  // Material: MeshPhysicalMaterial for tier 2+, MeshStandardMaterial for tier 0-1
  let material: THREE.Material;
  if (gpuTier >= 2) {
    material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness: 0.7,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.5,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.15,
    });
  } else {
    // Low-end fallback
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.6,
      metalness: 0.3,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.1,
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    name: feature.properties.name,
    code: feature.properties.code,
    performance: feature.properties.performance,
    baseColor: color,
  };

  return mesh;
}

// Glowing municipality data point
interface MunicipalityDataPointProps {
  position: [number, number, number];
  reducedMotion: boolean;
  gpuTier: number;
}

function MunicipalityDataPoint({ position, reducedMotion, gpuTier }: MunicipalityDataPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []); // Random phase for variety

  useFrame((state) => {
    if (meshRef.current && !reducedMotion && gpuTier >= 2) {
      // Gentle pulsing animation
      const scale = 0.8 + Math.sin(state.clock.elapsedTime * 1.5 + timeOffset) * 0.2;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial
        color="#FF6B4A"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface SAMapProps {
  gpuTier: number;
  onHover: (name: string | null) => void;
  onClick?: (code: string) => void;
  reducedMotion: boolean;
}

// Main SA Map component
function SAMap({ gpuTier, onHover, onClick, reducedMotion }: SAMapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const projection = useMemo(() =>
    geoMercator().center([25, -29]).scale(600).translate([0, 0]),
    []
  );

  // Auto-rotate and animations (disabled for reduced motion)
  useFrame((state, delta) => {
    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y += delta * 0.05; // Slow auto-rotate
    }

    // Smooth emissive transitions on hover
    if (groupRef.current && !reducedMotion) {
      groupRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
        const isHovered = mesh.userData.code === hoveredCode;
        const targetIntensity = isHovered ? 0.3 : 0.15;

        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = THREE.MathUtils.lerp(
            material.emissiveIntensity,
            targetIntensity,
            delta * 5
          );
        }
      });
    }
  });

  const meshes = useMemo(() => {
    return saGeoJSON.features.map((feature: any) => {
      const extrudeHeight = 0.1 + (feature.properties.performance * 0.3);
      const perf = feature.properties.performance;
      const color = perf > 0.7 ? '#00D9A6' : perf > 0.5 ? '#FBBF24' : '#FF6B4A';
      return createExtrudedMesh(feature, projection, extrudeHeight, color, gpuTier);
    });
  }, [projection, gpuTier]);

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (e.object.userData.name) {
      setHoveredCode(e.object.userData.code);
      onHover(e.object.userData.name);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    setHoveredCode(null);
    onHover(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (e.object.userData.code && onClick) {
      onClick(e.object.userData.code);
    }
  };

  // Calculate centroids for municipality data points
  const centroids = useMemo(() => {
    return saGeoJSON.features.map((feature: any) => {
      const coords = feature.geometry.coordinates[0];
      const avgLng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      const avgLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
      const projected = projection([avgLng, avgLat]);
      return {
        x: projected[0] / 100,
        y: -projected[1] / 100,
        name: feature.properties.name,
        performance: feature.properties.performance,
      };
    });
  }, [projection]);

  return (
    <group ref={groupRef}>
      {/* Province meshes */}
      {meshes.map((mesh, i) => (
        <primitive
          key={i}
          object={mesh}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      ))}

      {/* Glowing municipality data points */}
      {centroids.map((centroid, i) => (
        <MunicipalityDataPoint
          key={`point-${i}`}
          position={[centroid.x, centroid.y, 0.3]}
          reducedMotion={reducedMotion}
          gpuTier={gpuTier}
        />
      ))}

      {/* Atmospheric edge glow (GPU tier 2+) */}
      {gpuTier >= 2 && (
        <mesh>
          <sphereGeometry args={[3, 32, 32]} />
          <meshBasicMaterial color="#00D9A6" transparent opacity={0.03} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

interface Globe3DProps {
  className?: string;
  onMunicipalityClick?: (code: string) => void;
}

export default function Globe3D({ className, onMunicipalityClick }: Globe3DProps) {
  const gpuTier = useGPUTier();
  const reducedMotion = useReducedMotion();
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
        {/* Enhanced lighting setup */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#FF6B4A" />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#00D9A6" />
        <pointLight position={[3, 0, 2]} color="#FF6B4A" intensity={0.5} distance={10} />

        {/* Environment map for reflections (GPU tier 2+) */}
        {gpuTier >= 2 && <Environment preset="sunset" environmentIntensity={0.3} />}

        <SAMap
          gpuTier={gpuTier}
          onHover={setHovered}
          onClick={onMunicipalityClick}
          reducedMotion={reducedMotion}
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!reducedMotion}
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
