import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SampledObject, SceneSample } from "../domain/scene";

type RoomViewProps = {
  sample: SceneSample;
  selectedInput: number | null;
  onSelect: (inputId: number) => void;
};

const HOME_CAMERA = new THREE.Vector3(7.2, 5.2, 8.2);
const HOME_TARGET = new THREE.Vector3(0, 1.15, 0);

function RoomControls({ resetSignal }: { resetSignal: number }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<ThreeOrbitControls | null>(null);

  useEffect(() => {
    const orbit = new ThreeOrbitControls(camera, gl.domElement);
    orbit.enableDamping = false;
    orbit.enablePan = true;
    orbit.enableZoom = true;
    orbit.minDistance = 4.8;
    orbit.maxDistance = 18;
    orbit.minPolarAngle = 0.18;
    orbit.maxPolarAngle = Math.PI / 2.03;
    orbit.target.copy(HOME_TARGET);
    const invalidateView = () => invalidate();
    orbit.addEventListener("change", invalidateView);
    orbit.update();
    controls.current = orbit;
    return () => {
      orbit.removeEventListener("change", invalidateView);
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    camera.position.copy(HOME_CAMERA);
    controls.current?.target.copy(HOME_TARGET);
    controls.current?.update();
  }, [camera, resetSignal]);

  return null;
}

function Listener() {
  return (
    <group position={[0, 0.12, 0.35]}>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.19, 24, 24]} />
        <meshStandardMaterial color="#d7dde0" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.34, 0]} scale={[0.68, 0.85, 0.34]}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#9ba4a9" roughness={0.8} />
      </mesh>
    </group>
  );
}

function SoundObject({ object, selected, onSelect }: { object: SampledObject; selected: boolean; onSelect: () => void }) {
  const strength = Math.max(0.08, Math.min(1, (object.loudness + 82) / 65));
  const color = object.highlighted ? "#b9ff43" : selected ? "#f5ffb0" : "#18d96e";
  const position: [number, number, number] = [
    object.position.x * 3.7,
    0.22 + object.position.z * 3.05,
    -object.position.y * 3.1,
  ];
  return (
    <group position={position} visible={object.loudness > -84}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(); }} scale={0.1 + strength * 0.22}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8 + strength * 1.8} roughness={0.24} />
      </mesh>
      <mesh scale={0.18 + strength * 0.28}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.08 + strength * 0.09} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={0.42 + strength * 0.2}>
          <ringGeometry args={[0.84, 1, 40]} />
          <meshBasicMaterial color="#eaff99" transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function RoomScene({ sample, selectedInput, onSelect, resetSignal }: RoomViewProps & { resetSignal: number }) {
  const grid = useMemo(() => new THREE.GridHelper(8, 16, "#344048", "#20272d"), []);
  return (
    <>
      <color attach="background" args={["#090d10"]} />
      <fog attach="fog" args={["#090d10", 8, 17]} />
      <RoomControls resetSignal={resetSignal} />
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 4, 1]} intensity={18} color="#dff9ff" distance={12} />
      <mesh position={[0, -0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#161e23" roughness={1} transparent opacity={0.82} />
      </mesh>
      <primitive object={grid} position={[0, 0, 0]} />
      <mesh position={[0, 2.1, -4]}>
        <planeGeometry args={[8, 4.2]} />
        <meshStandardMaterial color="#758088" roughness={0.95} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[-4, 2.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 4.2]} />
        <meshStandardMaterial color="#5d6971" roughness={0.95} transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[4, 2.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 4.2]} />
        <meshStandardMaterial color="#39464e" roughness={0.95} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Listener />
      {sample.objects.map((object) => (
        <SoundObject
          key={object.id}
          object={object}
          selected={selectedInput === object.inputId}
          onSelect={() => onSelect(object.inputId)}
        />
      ))}
    </>
  );
}

export function RoomView(props: RoomViewProps) {
  const [resetSignal, setResetSignal] = useState(0);
  const active = props.sample.objects.filter((object) => object.loudness > -80).length;
  return (
    <section className="room-panel panel-frame">
      <div className="section-title-row room-title">
        <h2>Room View</h2>
        <span>{active} ACTIVE ELEMENTS</span>
      </div>
      <div className="view-controls"><button title="Reset camera" onClick={() => setResetSignal((value) => value + 1)}>⛶</button></div>
      <Canvas frameloop="demand" camera={{ position: [7.2, 5.2, 8.2], fov: 42 }} dpr={[1, 1.6]}>
        <RoomScene {...props} resetSignal={resetSignal} />
      </Canvas>
      <div className="room-navigation-hint">DRAG ORBIT · RIGHT-DRAG PAN · WHEEL ZOOM</div>
      <div className="room-axis"><span className="axis-y">Y</span><span className="axis-z">Z</span><span className="axis-x">X</span></div>
    </section>
  );
}
