import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

// Firebase SDK
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDPmgyq3SjSEyPjWU5zVExSNvEEu4G7N54",
  authDomain: "my-study-room-b9d92.firebaseapp.com",
  databaseURL: "https://my-study-room-b9d92-default-rtdb.firebaseio.com",
  projectId: "my-study-room-b9d92",
  storageBucket: "my-study-room-b9d92.firebasestorage.app",
  messagingSenderId: "724467055397",
  appId: "1:724467055397:web:56df3a0f12a456c581f8cc",
  measurementId: "G-GJTCSZPZ82"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 座席マスターデータ (52席分) の自動生成 ---
const COLORS = ["#EC4899", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#D97706", "#6366F1", "#14B8A6"];
const HAIR_COLORS = ["#7C2D12", "#1E293B", "#451A03", "#78350F", "#0F172A", "#B45309", "#312E81", "#1C1917", "#581C87", "#064E3B"];

const ISLANDS = [
  { id: "A", name: "デスク A (左奥)", pos: [-7.5, 0, -4.5], type: "rect" },
  { id: "B", name: "デスク B (中央奥)", pos: [ 0.0, 0, -4.5], type: "rect" },
  { id: "C", name: "デスク C (右奥)", pos: [ 7.5, 0, -4.5], type: "rect" },
  { id: "D", name: "デスク D (手前左)", pos: [-3.75, 0, 3.8], type: "rect" },
  { id: "E", name: "デスク E (手前右)", pos: [ 3.75, 0, 3.8], type: "rect" },
  { id: "R1", name: "丸テーブル 1 (左手前)", pos: [-8.5, 0, 3.8], type: "round" },
  { id: "R2", name: "丸テーブル 2 (中央)", pos: [ 0.0, 0, 0.5], type: "round" },
  { id: "R3", name: "丸テーブル 3 (右手前)", pos: [ 8.5, 0, 3.8], type: "round" }
];

const RECT_OFFSETS = [
  [-1.4, -0.78, 0], [-0.46, -0.78, 0], [0.46, -0.78, 0], [1.4, -0.78, 0],
  [-1.4,  0.78, Math.PI], [-0.46,  0.78, Math.PI], [0.46,  0.78, Math.PI], [1.4,  0.78, Math.PI]
];
const ROUND_OFFSETS = [
  [0, -1.0, 0], [-1.0, 0, Math.PI / 2], [0, 1.0, Math.PI], [1.0, 0, -Math.PI / 2]
];

const SEAT_PRESETS = [];
let seatIdx = 0;
ISLANDS.forEach((island) => {
  const offsets = island.type === "rect" ? RECT_OFFSETS : ROUND_OFFSETS;
  offsets.forEach((offset) => {
    const globalX = island.pos[0] + offset[0];
    const globalZ = island.pos[2] + offset[1];
    
    const enterWaypoints = [[4.5, 8.5], [3.5, 5.0], [globalX, 5.0], [globalX, globalZ]];
    const exitWaypoints = [[globalX, globalZ], [globalX, 5.0], [3.5, 5.0], [4.5, 8.5]];
    
    SEAT_PRESETS.push({
      seatIndex: seatIdx,
      color: COLORS[seatIdx % COLORS.length],
      hairColor: HAIR_COLORS[seatIdx % HAIR_COLORS.length],
      rotation: offset[2],
      enterWaypoints,
      exitWaypoints
    });
    seatIdx++;
  });
});

// --- 受付スタッフ ---
function Receptionist({ position, rotation, shirtColor = "#1E293B" }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#FFDFC4" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.61, -0.01]} castShadow>
        <sphereGeometry args={[0.125, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.32, 12]} />
        <meshStandardMaterial color={shirtColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

// --- 受付カウンター ---
function ReceptionDesk({ position = [4.5, 0, 9.8] }) {
  return (
    <group position={position}>
      <Receptionist position={[-0.6, 0, 0.6]} rotation={[0, Math.PI, 0]} shirtColor="#1E293B" />
      <Receptionist position={[0.6, 0, 0.6]} rotation={[0, Math.PI, 0]} shirtColor="#1E293B" />

      <mesh position={[0, 0.21, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.42, 0.8]} />
        <meshStandardMaterial color="#1E293B" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[2.7, 0.04, 0.85]} />
        <meshStandardMaterial color="#E2D4C3" roughness={0.2} />
      </mesh>
      
      <mesh position={[-0.5, 0.52, 0.1]} rotation={[0.3, Math.PI, 0]} castShadow>
        <boxGeometry args={[0.28, 0.2, 0.02]} />
        <meshStandardMaterial color="#1E293B" />
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.26, 0.18]} />
          <meshStandardMaterial color="#E0F2FE" emissive="#0EA5E9" emissiveIntensity={1.2} />
        </mesh>
      </mesh>
      <mesh position={[0.5, 0.52, 0.1]} rotation={[0.3, Math.PI, 0]} castShadow>
        <boxGeometry args={[0.28, 0.2, 0.02]} />
        <meshStandardMaterial color="#1E293B" />
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.26, 0.16]} />
          <meshStandardMaterial color="#E0F2FE" emissive="#0EA5E9" emissiveIntensity={1.2} />
        </mesh>
      </mesh>
    </group>
  );
}

// --- 自動ドア ---
function AutomaticDoor({ position = [0, 0, 11], actorPositionsRef, guardPosRef }) {
  const leftDoorRef = useRef();
  const rightDoorRef = useRef();
  const openAmount = useRef(0);

  useFrame((state, delta) => {
    let isNear = false;
    
    if (guardPosRef && guardPosRef.current) {
      const gp = guardPosRef.current;
      const dx = gp[0] - position[0];
      const dz = gp[2] - position[2];
      if (Math.sqrt(dx * dx + dz * dz) < 3.5) isNear = true;
    }

    if (!isNear && actorPositionsRef && actorPositionsRef.current) {
      isNear = Object.values(actorPositionsRef.current).some((data) => {
        if (!data || !data.pos) return false;
        const dx = data.pos[0] - position[0];
        const dz = data.pos[2] - position[2];
        return Math.sqrt(dx * dx + dz * dz) < 3.5;
      });
    }

    const targetOpen = isNear ? 1.0 : 0.0;
    openAmount.current += (targetOpen - openAmount.current) * (delta * 6);

    if (leftDoorRef.current) leftDoorRef.current.position.x = -0.7 - openAmount.current * 0.75;
    if (rightDoorRef.current) rightDoorRef.current.position.x = 0.7 + openAmount.current * 0.75;
  });

  return (
    <group position={position}>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[3.2, 0.2, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      <mesh position={[-1.5, 1.3, 0]}>
        <boxGeometry args={[0.2, 2.6, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      <mesh position={[1.5, 1.3, 0]}>
        <boxGeometry args={[0.2, 2.6, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      <mesh ref={leftDoorRef} position={[-0.7, 1.25, 0]} castShadow>
        <boxGeometry args={[1.35, 2.4, 0.05]} />
        <meshStandardMaterial color="#38BDF8" transparent opacity={0.4} roughness={0.1} />
      </mesh>
      <mesh ref={rightDoorRef} position={[0.7, 1.25, 0]} castShadow>
        <boxGeometry args={[1.35, 2.4, 0.05]} />
        <meshStandardMaterial color="#38BDF8" transparent opacity={0.4} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[2.8, 2.0]} rotation={[-Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

// --- 巡回警備員 ---
function SecurityGuard({ waypoints, speed = 1.0, onPositionUpdate }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const currentWaypointIndex = useRef(0);

  useEffect(() => {
    if (groupRef.current && waypoints.length > 0) {
      groupRef.current.position.set(waypoints[0][0], 0, waypoints[0][1]);
    }
  }, [waypoints]);

  useFrame((state, delta) => {
    if (!groupRef.current || waypoints.length === 0) return;
    const currentPos = groupRef.current.position;
    currentPos.y = 0;
    const targetPoint = waypoints[currentWaypointIndex.current];
    const targetVec = new THREE.Vector3(targetPoint[0], 0, targetPoint[1]);
    const dir = new THREE.Vector3().subVectors(targetVec, currentPos);
    
    if (dir.length() < 0.2) {
      currentWaypointIndex.current = (currentWaypointIndex.current + 1) % waypoints.length;
    } else {
      dir.normalize();
      currentPos.addScaledVector(dir, speed * delta);
      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - groupRef.current.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      groupRef.current.rotation.y += diff * delta * 6;

      const t = state.clock.getElapsedTime() * 8 * speed;
      const walkSwing = Math.sin(t) * 0.4;
      if (leftArmRef.current) leftArmRef.current.rotation.x = walkSwing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -walkSwing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -walkSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = walkSwing;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t)) * 0.04;
    }
    if (onPositionUpdate) onPositionUpdate([currentPos.x, currentPos.y, currentPos.z]);
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#FFDFC4" />
        </mesh>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.13, 0.34, 12]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        <group ref={leftArmRef} position={[-0.14, 0.46, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.14, 0.46, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
        <group ref={leftLegRef} position={[-0.06, 0.18, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.028, 0.22, 8]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.06, 0.18, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.028, 0.22, 8]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        </group>
      </group>
      <Html position={[0, 0.98, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{
          background: "rgba(15, 23, 42, 0.9)", color: "#FFFFFF", padding: "2px 6px",
          borderRadius: "0px", fontSize: "10px", fontWeight: "bold", whiteSpace: "nowrap"
        }}>
          🛡️ 巡回警備員
        </div>
      </Html>
    </group>
  );
}

// --- 学習者アクター ---
function ActorCharacter({
  id, rawName = "学習者", subject = "", color, hairColor, visitCount = 0, status, mode = "IDLE_OUTSIDE", seatWaypoints = [], exitWaypoints = [],
  finalRotation = 0, queue = [], joinQueue, leaveQueue, onArrival, onPositionUpdate
}) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();

  const [actorState, setActorState] = useState("OUTSIDE");
  const [statusText, setStatusText] = useState("");
  const wayIdx = useRef(0);
  const waitTimer = useRef(0);

  const isBreak = status === "BREAK";

  useEffect(() => {
    if (mode === "ENTER") {
      setActorState("APPROACHING_QUEUE");
      wayIdx.current = 0;
      waitTimer.current = 0;
      if (groupRef.current) {
        groupRef.current.position.set(0, 0, 18);
        groupRef.current.rotation.y = Math.PI; 
      }
    } else if (mode === "LEAVE") {
      setActorState("TO_EXIT_QUEUE");
      wayIdx.current = 0;
      waitTimer.current = 0;
      if (bodyRef.current) bodyRef.current.position.z = 0;
      if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.position.set(-0.05, 0.14, 0); }
      if (rightLegRef.current) { rightLegRef.current.rotation.x = 0; rightLegRef.current.position.set(0.05, 0.14, 0); }
    } else if (mode === "IDLE_SEATED") {
      setActorState("SEATED");
    } else if (mode === "IDLE_OUTSIDE") {
      setActorState("OUTSIDE");
      if (groupRef.current) groupRef.current.position.set(0, 0, 18);
    }
  }, [mode]);

  useFrame((state, delta) => {
    if (!groupRef.current || actorState === "OUTSIDE") return;

    const currentPos = groupRef.current.position;

    if (actorState === "SEATED") {
      currentPos.y = 0.1;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0;
        bodyRef.current.position.z = 0.08; 
      }
      if (onPositionUpdate) onPositionUpdate([currentPos.x, currentPos.y, currentPos.z], true, status);
      return;
    } else {
      if (bodyRef.current) bodyRef.current.position.z = 0;
    }

    currentPos.y = 0;

    if (actorState === "IN_QUEUE") {
      const qIndex = queue.indexOf(id);
      if (qIndex === -1) { joinQueue(id); return; }

      const targetZ = 8.5 - qIndex * 1.0;
      const targetVec = new THREE.Vector3(4.5, 0, targetZ);
      const dir = new THREE.Vector3().subVectors(targetVec, currentPos);

      if (dir.length() > 0.1) {
        dir.normalize();
        currentPos.addScaledVector(dir, 1.8 * delta);
        const targetAngle = Math.atan2(dir.x, dir.z);
        let diff = targetAngle - groupRef.current.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        groupRef.current.rotation.y += diff * delta * 10;
      } else {
        if (qIndex === 0) {
          let diff = 0 - groupRef.current.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          groupRef.current.rotation.y += diff * delta * 10;

          waitTimer.current += delta;
          setStatusText(`受付確認中... (${Math.max(0, Math.ceil(2.0 - waitTimer.current))}s)`);
          if (leftArmRef.current) leftArmRef.current.rotation.x *= 0.8;
          if (rightArmRef.current) rightArmRef.current.rotation.x *= 0.8;
          if (leftLegRef.current) leftLegRef.current.rotation.x *= 0.8;
          if (rightLegRef.current) rightLegRef.current.rotation.x *= 0.8;

          if (waitTimer.current >= 2.0) {
            leaveQueue(id);
            waitTimer.current = 0;
            setStatusText("");
            setActorState(mode === "ENTER" ? "TO_SEAT" : "LEAVING");
            wayIdx.current = 0;
          }
        } else {
          setStatusText(`⏳ 順番待ち (${qIndex + 1}人目)`);
          let diff = 0 - groupRef.current.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          groupRef.current.rotation.y += diff * delta * 8;
        }
      }
      if (onPositionUpdate) onPositionUpdate([currentPos.x, currentPos.y, currentPos.z], false, status);
      return;
    }

    if (currentWaypoints.length === 0) return;

    const targetPoint = currentWaypoints[wayIdx.current];
    if (!targetPoint) return;
    const targetVec = new THREE.Vector3(targetPoint[0], 0, targetPoint[1]);
    const dir = new THREE.Vector3().subVectors(targetVec, currentPos);

    if (dir.length() < 0.15) {
      if (wayIdx.current < currentWaypoints.length - 1) {
        wayIdx.current += 1;
      } else {
        if (actorState === "APPROACHING_QUEUE" || actorState === "TO_EXIT_QUEUE") {
          setActorState("IN_QUEUE");
          joinQueue(id);
        } else if (actorState === "TO_SEAT") {
          setActorState("SEATED");
          currentPos.y = 0.1;
          groupRef.current.rotation.y = finalRotation;
          if (leftArmRef.current) leftArmRef.current.rotation.x = 0.7;
          if (rightArmRef.current) rightArmRef.current.rotation.x = 0.7;
          if (leftLegRef.current) { leftLegRef.current.rotation.x = -1.5; leftLegRef.current.position.set(-0.05, 0.16, 0.1); }
          if (rightLegRef.current) { rightLegRef.current.rotation.x = -1.5; rightLegRef.current.position.set(0.05, 0.16, 0.1); }
          if (onArrival) onArrival("SEATED");
        } else if (actorState === "LEAVING") {
          setActorState("OUTSIDE");
          if (onArrival) onArrival("OUTSIDE");
        }
      }
    } else {
      dir.normalize();
      currentPos.addScaledVector(dir, 2.0 * delta);
      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - groupRef.current.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      groupRef.current.rotation.y += diff * delta * 10;

      const t = state.clock.getElapsedTime() * 11;
      const walkSwing = Math.sin(t) * 0.45;
      if (leftArmRef.current) leftArmRef.current.rotation.x = walkSwing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -walkSwing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -walkSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = walkSwing;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t)) * 0.04;
    }

    if (onPositionUpdate) onPositionUpdate([currentPos.x, currentPos.y, currentPos.z], false, status);
  });

  const indicatorColor = isBreak ? "#F59E0B" : (actorState === "SEATED" ? "#10B981" : "#EF4444");
  
  const showSubjectCard = actorState === "SEATED";
  let subjectText = "";
  if (isBreak) subjectText = "☕ 休憩中";
  else if (subject && subject.trim() !== "") subjectText = `${subject}`;

  return (
    <group ref={groupRef} position={[0, 0, 18]} visible={actorState !== "OUTSIDE"}>
      <group ref={bodyRef} visible={!isBreak}>
        <mesh position={[0, 0.58, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#FFDFC4" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.62, -0.01]} castShadow>
          <sphereGeometry args={[0.135, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hairColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.13, 0.32, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>

        <group ref={leftArmRef} position={[-0.12, 0.4, 0]}>
          <mesh position={[0, -0.08, 0.05]} rotation={[0.4, 0, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.12, 0.4, 0]}>
          <mesh position={[0, -0.08, 0.05]} rotation={[0.4, 0, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
        <group ref={leftLegRef} position={[-0.05, 0.14, 0]}>
          <mesh position={[0, -0.07, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.025, 0.18, 8]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.05, 0.14, 0]}>
          <mesh position={[0, -0.07, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.025, 0.18, 8]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
      </group>

      {actorState !== "OUTSIDE" && (
        <Html position={[0, 1.0, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "sans-serif", alignItems: "center", gap: "3px" }}>
            {statusText && (
              <div style={{
                background: "#F59E0B", color: "#FFFFFF", fontSize: "10px", fontWeight: "bold",
                padding: "2px 6px", borderRadius: "0px", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", whiteSpace: "nowrap"
              }}>
                {statusText}
              </div>
            )}
            {showSubjectCard && subjectText && (
              <div style={{
                background: isBreak ? "#F59E0B" : "rgba(15, 23, 42, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "0px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
              }}>
                {subjectText}
              </div>
            )}
            <div style={{
              background: "rgba(255, 255, 255, 0.95)", padding: "3px 8px", borderRadius: "0px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap"
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: indicatorColor, display: "inline-block" }} />
              <span style={{ fontSize: "12px", fontWeight: "900", color: "#1E293B", fontFamily: "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Quicksand', sans-serif" }}>
                {rawName}
              </span>
              {visitCount > 0 && <span style={{ fontSize: "10px", fontWeight: "bold", color: "#F59E0B", marginLeft: "1px" }}>★{visitCount}</span>}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// --- オフィスチェア ---
function Chair({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.36, 0.05, 0.36]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.44, -0.16]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.04]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
        <meshStandardMaterial color="#64748B" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 5]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
    </group>
  );
}

// --- 各席の独立制御コンポーネント (パフォーマンス改善用) ---
function DeskSeat({ islandPos, localX, localZ, rot, learnerDataRef }) {
  const materialRef = useRef();
  const globalX = islandPos[0] + localX;
  const globalZ = islandPos[2] + localZ;

  useFrame(() => {
    if (!materialRef.current) return;
    const isOccupied = Object.values(learnerDataRef.current).some((data) => {
      if (!data || !data.pos || !data.isSeated || data.status === "BREAK") return false;
      const dx = data.pos[0] - globalX;
      const dz = data.pos[2] - globalZ;
      return Math.sqrt(dx * dx + dz * dz) < 0.6;
    });

    if (isOccupied) {
      materialRef.current.color.set("#E0F2FE");
      materialRef.current.emissive.set("#0EA5E9");
      materialRef.current.emissiveIntensity = 1.5;
    } else {
      materialRef.current.color.set("#0F172A");
      materialRef.current.emissive.set("#000000");
      materialRef.current.emissiveIntensity = 0;
    }
  });

  return (
    <group position={[localX, 0, localZ]}>
      <Chair position={[0, 0, 0]} rotation={[0, rot, 0]} />
      <group position={[0, 0.47, localZ > 0 ? -0.28 : 0.28]} rotation={[0, localZ > 0 ? 0 : Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.015, 0.2]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.1, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.02]} />
          <meshStandardMaterial color="#1E293B" />
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshStandardMaterial ref={materialRef} color="#0F172A" />
          </mesh>
        </mesh>
      </group>
    </group>
  );
}

function RoundTableSeat({ islandPos, localX, localZ, rot, learnerDataRef }) {
  const materialRef = useRef();
  const globalX = islandPos[0] + localX;
  const globalZ = islandPos[2] + localZ;
  const pcX = localX * 0.4;
  const pcZ = localZ * 0.4;

  useFrame(() => {
    if (!materialRef.current) return;
    const isOccupied = Object.values(learnerDataRef.current).some((data) => {
      if (!data || !data.pos || !data.isSeated || data.status === "BREAK") return false;
      const dx = data.pos[0] - globalX;
      const dz = data.pos[2] - globalZ;
      return Math.sqrt(dx * dx + dz * dz) < 0.6;
    });

    if (isOccupied) {
      materialRef.current.color.set("#E0F2FE");
      materialRef.current.emissive.set("#0EA5E9");
      materialRef.current.emissiveIntensity = 1.5;
    } else {
      materialRef.current.color.set("#0F172A");
      materialRef.current.emissive.set("#000000");
      materialRef.current.emissiveIntensity = 0;
    }
  });

  return (
    <group position={[localX, 0, localZ]}>
      <Chair position={[0, 0, 0]} rotation={[0, rot, 0]} />
      {/* PC画面を着席者に向けて180度反転 (rot + Math.PI) */}
      <group position={[pcX - localX, 0.47, pcZ - localZ]} rotation={[0, rot + Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.015, 0.2]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.1, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.02]} />
          <meshStandardMaterial color="#1E293B" />
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshStandardMaterial ref={materialRef} color="#0F172A" />
          </mesh>
        </mesh>
      </group>
    </group>
  );
}

// --- 長方形デスク島 (8席) ---
function DeskIsland({ position, learnerDataRef }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.06, 1.2]} />
        <meshStandardMaterial color="#E2D4C3" roughness={0.3} />
      </mesh>
      {[[-2.05, 0.21, -0.55], [2.05, 0.21, -0.55], [-2.05, 0.21, 0.55], [2.05, 0.21, 0.55]].map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.06, 0.42, 0.06]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.6} />
        </mesh>
      ))}
      {RECT_OFFSETS.map(([x, z, rot], i) => (
        <DeskSeat key={i} islandPos={position} localX={x} localZ={z} rot={rot} learnerDataRef={learnerDataRef} />
      ))}
    </group>
  );
}

// --- 丸テーブル島 (4席) ---
function RoundTableIsland({ position, learnerDataRef }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.06, 32]} />
        <meshStandardMaterial color="#E2D4C3" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.44, 16]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.6} />
      </mesh>
      {ROUND_OFFSETS.map(([x, z, rot], i) => (
        <RoundTableSeat key={i} islandPos={position} localX={x} localZ={z} rot={rot} learnerDataRef={learnerDataRef} />
      ))}
    </group>
  );
}

// --- インテリアと壁 ---
function RoomDecorations() {
  return (
    <group>
      <group position={[0, 2.0, -10.8]}>
        <mesh castShadow>
          <boxGeometry args={[6, 1.0, 0.1]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.2} />
        </mesh>
        <Html position={[0, 0, 0.06]} center style={{ pointerEvents: "none" }}>
          <div style={{ textAlign: "center", fontFamily: "serif", color: "#1E293B", letterSpacing: "2px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>STUDY ROOM HQ</div>
            <div style={{ fontSize: "9px", color: "#64748B" }}>ONLINE CO-WORKING SPACE</div>
          </div>
        </Html>
      </group>
    </group>
  );
}

// --- 空間・床・壁 ---
function RoomEnvironment() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#F1ECE4" roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 17]} receiveShadow>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.8} />
      </mesh>

      <mesh position={[0, 1.4, -11]}>
        <boxGeometry args={[32, 2.8, 0.2]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>
      <mesh position={[-15.9, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[34, 2.8, 0.2]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
      </mesh>
      <mesh position={[-9.0, 1.4, 11]}>
        <boxGeometry args={[14, 2.8, 0.2]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
      </mesh>
      <mesh position={[9.0, 1.4, 11]}>
        <boxGeometry args={[14, 2.8, 0.2]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.7, 11]}>
        <boxGeometry args={[4, 0.2, 0.2]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.9} />
      </mesh>
      
      <gridHelper args={[32, 32, "#E2E8F0", "#E2E8F0"]} position={[0, 0.02, 0]} />
    </group>
  );
}

// --- カメラコントローラー (視点移動と手動操作の完全分離) ---
function CameraController({ viewTarget }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const isAnimating = useRef(false);
  const targetCamPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (viewTarget && viewTarget.camPos && viewTarget.target) {
      targetCamPos.current.set(...viewTarget.camPos);
      targetLookAt.current.set(...viewTarget.target);
      isAnimating.current = true;
    }
  }, [viewTarget?.trigger]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      isAnimating.current = false;
    };

    controls.addEventListener("start", handleStart);
    return () => controls.removeEventListener("start", handleStart);
  }, []);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isAnimating.current) {
      const speed = 5.0;
      camera.position.lerp(targetCamPos.current, delta * speed);
      controls.target.lerp(targetLookAt.current, delta * speed);

      if (
        camera.position.distanceTo(targetCamPos.current) < 0.05 &&
        controls.target.distanceTo(targetLookAt.current) < 0.05
      ) {
        camera.position.copy(targetCamPos.current);
        controls.target.copy(targetLookAt.current);
        isAnimating.current = false;
      }
    }
    controls.update();
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault 
      enableDamping 
      dampingFactor={0.08}
    />
  );
}

// --- メインアプリ ---
export default function App() {
  const guardRoute = useMemo(() => [[-13.5, -8.5], [13.5, -8.5], [13.5, 8.5], [-13.5, 8.5]], []);

  const [queue, setQueue] = useState([]);
  const joinQueue = (id) => setQueue((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const leaveQueue = (id) => setQueue((prev) => prev.filter((item) => item !== id));

  const guardPosRef = useRef([0, 0, -5]);
  const learnerDataRef = useRef({});

  const [learners, setLearners] = useState([]);
  const [learnerModes, setLearnerModes] = useState({});

  // 視点切り替え対象の全リスト
  const buttonTargets = useMemo(() => [
    { name: "全体表示 (外から)", target: [0, 0, 5], camPos: [14, 14, 22] },
    { name: "受付カウンター", target: [4.5, 0.5, 9.8], camPos: [8, 6, 16] },
    ...ISLANDS.map((desk) => ({
      name: desk.name,
      target: [desk.pos[0], 0.4, desk.pos[2]],
      camPos: [desk.pos[0] + 3, 3.5, desk.pos[2] + 4]
    }))
  ], []);

  // 「受付カウンター」を除外した自動切替用ターゲットリスト
  const autoTargets = useMemo(() => {
    return buttonTargets.filter((btn) => btn.name !== "受付カウンター");
  }, [buttonTargets]);

  const [selectedCamIdx, setSelectedCamIdx] = useState(0);
  const [viewTarget, setViewTarget] = useState(buttonTargets[0]);

  // 自動切替のON/OFF状態と巡回インデックス
  const [isAutoSwitch, setIsAutoSwitch] = useState(false);
  const autoIndexRef = useRef(0);

  // 5秒おきの自動切り替えタイマー処理（「受付カウンター」を除外して巡回）
  useEffect(() => {
    if (!isAutoSwitch) return;

    const interval = setInterval(() => {
      autoIndexRef.current = (autoIndexRef.current + 1) % autoTargets.length;
      const nextTarget = autoTargets[autoIndexRef.current];

      // 全体リストにおけるインデックスを検索してドロップダウン選択肢を同期
      const globalIdx = buttonTargets.findIndex((b) => b.name === nextTarget.name);
      if (globalIdx !== -1) {
        setSelectedCamIdx(globalIdx);
      }

      setViewTarget({ ...nextTarget, trigger: Date.now() });
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoSwitch, autoTargets, buttonTargets]);

  // Firebase Realtime Database リアルタイム同期
  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setLearners([]);
        return;
      }

      const activeLearners = [];
      const newModes = {};

      Object.entries(data).forEach(([uid, uData]) => {
        const seatIdx = uData.seatIndex !== undefined ? uData.seatIndex : 0;
        const preset = SEAT_PRESETS[seatIdx] || SEAT_PRESETS[0];

        const historyObj = uData.history || {};
        const visitCount = Object.keys(historyObj).length;

        activeLearners.push({
          id: uid,
          rawName: uData.name && uData.name.trim() !== "" ? uData.name : "学習者",
          subject: uData.subject || "",
          status: uData.status,
          color: preset.color,
          hairColor: preset.hairColor,
          seatWaypoints: preset.enterWaypoints,
          exitWaypoints: preset.exitWaypoints,
          rotation: preset.rotation,
          visitCount: visitCount
        });

        if (uData.status === "ENTER_REQUEST" || uData.status === "ENTER") {
          newModes[uid] = "ENTER";
        } else if (uData.status === "LEAVE_REQUEST" || uData.status === "LEAVE") {
          newModes[uid] = "LEAVE";
        } else if (uData.status === "SEATED" || uData.status === "BREAK") {
          newModes[uid] = "IDLE_SEATED";
        } else if (uData.status === "LEFT") {
          newModes[uid] = "IDLE_OUTSIDE";
        }
      });

      setLearners(activeLearners);
      setLearnerModes((prev) => {
        const updated = { ...prev };
        Object.keys(newModes).forEach((id) => {
          if (updated[id] !== newModes[id]) {
            updated[id] = newModes[id];
          }
        });
        return updated;
      });
    });

    return () => unsubscribe();
  }, []);

  const handleCameraChange = (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (!isNaN(selectedIndex) && buttonTargets[selectedIndex]) {
      setSelectedCamIdx(selectedIndex);
      setViewTarget({ ...buttonTargets[selectedIndex], trigger: Date.now() });
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0, background: "#0F172A" }}>
      
      {/* 上部 コントロールバー (ドロップダウン + 自動切替ボタン) */}
      <div style={{
        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20,
        display: "flex", alignItems: "center", gap: "10px", background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(8px)", padding: "8px 16px", borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)", fontFamily: "sans-serif"
      }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#334155" }}>📹 視点移動:</span>
        <select 
          value={selectedCamIdx}
          onChange={handleCameraChange}
          style={{
            padding: "4px 8px", fontSize: "12px", fontWeight: "600", borderRadius: "6px",
            border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#0F172A", cursor: "pointer", outline: "none"
          }}
        >
          {buttonTargets.map((btn, idx) => (
            <option key={idx} value={idx}>{btn.name}</option>
          ))}
        </select>

        {/* 5秒おきの自動切り替え ON/OFF ボタン */}
        <button
          onClick={() => setIsAutoSwitch(!isAutoSwitch)}
          style={{
            padding: "4px 10px", fontSize: "12px", fontWeight: "bold", borderRadius: "6px",
            border: "none", cursor: "pointer", transition: "all 0.2s",
            background: isAutoSwitch ? "#10B981" : "#E2E8F0",
            color: isAutoSwitch ? "#FFFFFF" : "#475569"
          }}
        >
          {isAutoSwitch ? "🔄 自動切替: ON (5s)" : "▶ 自動切替: OFF"}
        </button>
      </div>

      {/* ステータスパネル */}
      <div style={{
        position: "absolute", top: 16, left: 16, zIndex: 10, background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(8px)", padding: "12px 16px", borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)", fontFamily: "sans-serif"
      }}>
        <h2 style={{ margin: 0, fontSize: "13px", color: "#0F172A" }}>🛠️ 空間管理コンソール</h2>
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#475569" }}>
          受付待機: <strong style={{ color: "#2563EB" }}>{queue.length} 名</strong> / オンライン学習者: <strong>{learners.length} 名</strong>
        </div>
      </div>

      {/* 右上 QRコード */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 10, background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(8px)", padding: "12px", borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
        fontFamily: "sans-serif"
      }}>
        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#1E293B" }}>📱 入退室管理ページ</div>
        <img 
          src="https://my-study-room-b9d92.web.app/entry.html" 
          alt="QR" width={100} height={100} style={{ borderRadius: "4px" }}
        />
        <div style={{ fontSize: "9px", color: "#64748B", textAlign: "center" }}>スマホでスキャンして入退室</div>
      </div>

      {/* 3D Viewport */}
      <Canvas shadows camera={{ position: [14, 14, 22], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[15, 22, 15]} intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />

        <RoomEnvironment />
        <RoomDecorations />
        <ReceptionDesk position={[4.5, 0, 9.8]} />
        <AutomaticDoor position={[0, 0, 11]} actorPositionsRef={learnerDataRef} guardPosRef={guardPosRef} />
        <SecurityGuard waypoints={guardRoute} speed={0.9} onPositionUpdate={(pos) => { guardPosRef.current = pos; }} />

        {learners.map((l) => (
          <ActorCharacter
            key={l.id} 
            id={l.id} 
            rawName={l.rawName} 
            subject={l.subject}
            status={l.status}
            color={l.color} 
            hairColor={l.hairColor} 
            visitCount={l.visitCount}
            mode={learnerModes[l.id]}
            seatWaypoints={l.seatWaypoints} 
            exitWaypoints={l.exitWaypoints} 
            finalRotation={l.rotation}
            queue={queue} 
            joinQueue={joinQueue} 
            leaveQueue={leaveQueue}
            onArrival={(nextState) => {
              if (nextState === "SEATED") {
                setLearnerModes((prev) => ({ ...prev, [l.id]: "IDLE_SEATED" }));
                update(ref(db, `users/${l.id}`), { status: "SEATED" });
              } else if (nextState === "OUTSIDE") {
                setLearnerModes((prev) => ({ ...prev, [l.id]: "IDLE_OUTSIDE" }));
                update(ref(db, `users/${l.id}`), { status: "LEFT" });
              }
            }}
            onPositionUpdate={(pos, isSeated, currentStatus) => {
              learnerDataRef.current[l.id] = { pos, isSeated, status: currentStatus };
            }}
          />
        ))}

        {ISLANDS.map((desk) => {
          if (desk.type === "rect") {
            return <DeskIsland key={desk.id} position={desk.pos} learnerDataRef={learnerDataRef} />;
          } else {
            return <RoundTableIsland key={desk.id} position={desk.pos} learnerDataRef={learnerDataRef} />;
          }
        })}

        <CameraController viewTarget={viewTarget} />
      </Canvas>
    </div>
  );
}