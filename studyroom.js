import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, SoftShadows } from "@react-three/drei";
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

// --- 内装トーン: 住友林業の木質建築 × 図書館の落ち着き ---
const WOOD = {
  wallUpper: "#F6F1E7",   // 漆喰調の壁
  wallLower: "#8B6F47",   // 腰壁(羽目板)
  trim: "#5C4530",        // 廻り縁・幅木・梁
  deskTop: "#DCC6A1",     // 天板(オーク)
  metal: "#9C9184",       // 金物(暖色系スチール)
  ink: "#2B2621",         // UI文字色(チャコール)
  sub: "#8A7F6E",         // UI補助文字色
  accent: "#C17A4A"       // アクセント(テラコッタ)
};

const BOOK_COLORS = ["#8B4049", "#4A6C6F", "#B08D57", "#5B4B6E", "#4B5D67", "#7C8B5E", "#9C5B3C", "#3E5C6B"];

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

// --- 各島の座席開始番号 (PC画面の席番号表示・Firebaseのseat Indexと対応) ---
const ISLAND_SEAT_START = {};
{
  let cursor = 0;
  ISLANDS.forEach((isl) => {
    ISLAND_SEAT_START[isl.id] = cursor;
    cursor += isl.type === "rect" ? RECT_OFFSETS.length : ROUND_OFFSETS.length;
  });
}

// --- 家具レイアウト (本棚): 見た目と経路探索の障害物判定の両方で共有 ---
const BOOKSHELF_LAYOUT = [
  // 奥壁: 書架をずらりと並べて図書館らしい書架列に
  { position: [-13, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  { position: [-9, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  { position: [-5.5, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  { position: [5.5, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  { position: [9, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  { position: [13, 0, -10.55], rotation: [0, 0, 0], width: 2.2, height: 1.8 },
  // 左右壁の奥側コーナー
  { position: [-15.4, 0, -9.3], rotation: [0, Math.PI / 2, 0], width: 2.2, height: 1.8 },
  { position: [15.4, 0, -9.3], rotation: [0, -Math.PI / 2, 0], width: 2.2, height: 1.8 },
  // 中央のテーブル群を緩やかに仕切るパーティション (奥のデスク列と手前のテーブル群の間)
  { position: [-4.1, 0, -1.8], rotation: [0, 0, 0], width: 3.8, height: 1.4 },
  { position: [4.1, 0, -1.8], rotation: [0, 0, 0], width: 3.8, height: 1.4 },
  // 中央付近: 手前側にもう一段パーティションを設け、D/E/R2まわりを書架に囲まれた閲覧室のように
  { position: [-4.1, 0, 6.3], rotation: [0, 0, 0], width: 3.8, height: 1.4 },
  { position: [4.1, 0, 6.3], rotation: [0, 0, 0], width: 3.8, height: 1.4 },
  // 両パーティションの端をつなぐ袖の書架 (コーナーの書架アルコーブ)
  { position: [-6.2, 0, -1.0], rotation: [0, Math.PI / 2, 0], width: 1.6, height: 1.4 },
  { position: [6.2, 0, -1.0], rotation: [0, Math.PI / 2, 0], width: 1.6, height: 1.4 },
  { position: [-6.2, 0, 6.1], rotation: [0, Math.PI / 2, 0], width: 1.6, height: 1.4 },
  { position: [6.2, 0, 6.1], rotation: [0, Math.PI / 2, 0], width: 1.6, height: 1.4 }
];

// 壁沿いの個人学習スペース (パソコンなし、番号のみのカレル席)
const CARRELS = [];
{
  const leftZs = [-6, -4, -2, 0, 2, 4, 6, 8];
  leftZs.forEach((z, i) => {
    CARRELS.push({ id: `L${i}`, anchor: [-15.75, z], groupRotation: [0, 0, 0], rot: -Math.PI / 2 });
  });
  const rightZs = [-6, -4, -2, 0, 2, 4];
  rightZs.forEach((z, i) => {
    CARRELS.push({ id: `R${i}`, anchor: [15.75, z], groupRotation: [0, Math.PI, 0], rot: Math.PI / 2 });
  });
}

// --- 経路探索用の障害物リスト (矩形バウンディングボックス、可視グラフ法) ---
function buildObstacles() {
  const obstacles = [];
  const pad = 0.2;

  ISLANDS.forEach((isl) => {
    if (isl.type === "rect") {
      obstacles.push({
        minX: isl.pos[0] - 2.4 - pad, maxX: isl.pos[0] + 2.4 + pad,
        minZ: isl.pos[2] - 0.9 - pad, maxZ: isl.pos[2] + 0.9 + pad
      });
    } else {
      const h = 1.3 + pad;
      obstacles.push({ minX: isl.pos[0] - h, maxX: isl.pos[0] + h, minZ: isl.pos[2] - h, maxZ: isl.pos[2] + h });
    }
  });

  BOOKSHELF_LAYOUT.forEach((b) => {
    const rotated = Math.abs(b.rotation[1]) > 0.1;
    const halfAlong = b.width / 2 + pad;
    const halfDepth = 0.175 + pad;
    if (rotated) {
      obstacles.push({ minX: b.position[0] - halfDepth, maxX: b.position[0] + halfDepth, minZ: b.position[2] - halfAlong, maxZ: b.position[2] + halfAlong });
    } else {
      obstacles.push({ minX: b.position[0] - halfAlong, maxX: b.position[0] + halfAlong, minZ: b.position[2] - halfDepth, maxZ: b.position[2] + halfDepth });
    }
  });

  obstacles.push({ minX: 4.5 - 1.7, maxX: 4.5 + 1.7, minZ: 9.8 - 0.9, maxZ: 9.8 + 1.0 }); // 受付カウンター

  return obstacles;
}
const OBSTACLES = buildObstacles();

// --- 線分と矩形の交差判定 (Liang-Barsky) ---
function segmentIntersectsRect(x1, z1, x2, z2, rect) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  const p = [-dx, dx, -dz, dz];
  const q = [x1 - rect.minX, rect.maxX - x1, z1 - rect.minZ, rect.maxZ - z1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return t0 < t1;
}
function hasLineOfSight(a, b) {
  for (let i = 0; i < OBSTACLES.length; i++) {
    if (segmentIntersectsRect(a[0], a[1], b[0], b[1], OBSTACLES[i])) return false;
  }
  return true;
}
function dist2D(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

// --- 障害物コーナーの静的グラフ (一度だけ構築し、席ごとの経路計算で使い回す) ---
const STATIC_NODES = [];
OBSTACLES.forEach((o) => {
  const eps = 0.05;
  STATIC_NODES.push([o.minX - eps, o.minZ - eps], [o.maxX + eps, o.minZ - eps], [o.minX - eps, o.maxZ + eps], [o.maxX + eps, o.maxZ + eps]);
});
const STATIC_EDGES = STATIC_NODES.map(() => []);
for (let i = 0; i < STATIC_NODES.length; i++) {
  for (let j = i + 1; j < STATIC_NODES.length; j++) {
    if (hasLineOfSight(STATIC_NODES[i], STATIC_NODES[j])) {
      const d = dist2D(STATIC_NODES[i], STATIC_NODES[j]);
      STATIC_EDGES[i].push([j, d]);
      STATIC_EDGES[j].push([i, d]);
    }
  }
}

// --- 可視グラフ + ダイクストラ法で、机や本棚を避けた経路を求める ---
function findPath(start, end) {
  if (hasLineOfSight(start, end)) return [start, end];

  const nodes = [start, end, ...STATIC_NODES];
  const n = nodes.length;
  const adj = Array.from({ length: n }, () => []);

  for (let i = 0; i < STATIC_NODES.length; i++) {
    for (const [j, d] of STATIC_EDGES[i]) {
      if (j > i) {
        adj[i + 2].push([j + 2, d]);
        adj[j + 2].push([i + 2, d]);
      }
    }
  }
  for (let k = 2; k < n; k++) {
    if (hasLineOfSight(nodes[0], nodes[k])) {
      const d = dist2D(nodes[0], nodes[k]);
      adj[0].push([k, d]); adj[k].push([0, d]);
    }
    if (hasLineOfSight(nodes[1], nodes[k])) {
      const d = dist2D(nodes[1], nodes[k]);
      adj[1].push([k, d]); adj[k].push([1, d]);
    }
  }

  const distArr = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const visited = Array(n).fill(false);
  distArr[0] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!visited[i] && distArr[i] < best) { best = distArr[i]; u = i; }
    if (u === -1) break;
    visited[u] = true;
    for (const [v, w] of adj[u]) {
      if (distArr[u] + w < distArr[v]) { distArr[v] = distArr[u] + w; prev[v] = u; }
    }
  }

  if (distArr[1] === Infinity) return [start, end]; // 経路が見つからない場合は直線にフォールバック
  const path = [];
  let cur = 1;
  while (cur !== -1) { path.unshift(nodes[cur]); cur = prev[cur]; }
  return path;
}

const QUEUE_ENTRY_POINT = [4.5, 8.5]; // 受付列の先頭 (既存のIN_QUEUE解決地点)

function buildSeatPreset(seatIdx, globalX, globalZ, rot) {
  // 着席時に向く方向の逆 = 椅子に歩み寄る側。そこに障害物の外側の「取り付き点」を置く
  const outX = -Math.sin(rot);
  const outZ = -Math.cos(rot);
  const approach = [globalX + outX * 1.0, globalZ + outZ * 1.0];

  const corridorPath = findPath(QUEUE_ENTRY_POINT, approach);
  const enterWaypoints = [...corridorPath, [globalX, globalZ]];
  const exitWaypoints = [[globalX, globalZ], ...[...corridorPath].reverse()];

  return {
    seatIndex: seatIdx,
    color: COLORS[seatIdx % COLORS.length],
    hairColor: HAIR_COLORS[seatIdx % HAIR_COLORS.length],
    rotation: rot,
    enterWaypoints,
    exitWaypoints
  };
}

const SEAT_PRESETS = [];
let seatIdx = 0;
ISLANDS.forEach((island) => {
  const offsets = island.type === "rect" ? RECT_OFFSETS : ROUND_OFFSETS;
  offsets.forEach((offset) => {
    const globalX = island.pos[0] + offset[0];
    const globalZ = island.pos[2] + offset[1];
    SEAT_PRESETS.push(buildSeatPreset(seatIdx, globalX, globalZ, offset[2]));
    seatIdx++;
  });
});

// カレル席 (壁沿いの個人学習スペース) も同じ番号体系に続けて登録
CARRELS.forEach((c) => {
  const deskReach = 0.75; // 壁アンカーから着席位置までの距離 (壁に正対して座る)
  const seatLocalX = c.groupRotation[1] === 0 ? deskReach : -deskReach;
  const globalX = c.anchor[0] + seatLocalX;
  const globalZ = c.anchor[1];
  c.seatIndex = seatIdx;
  c.seatPos = [globalX, globalZ];
  SEAT_PRESETS.push(buildSeatPreset(seatIdx, globalX, globalZ, c.rot));
  seatIdx++;
});

// --- 受付スタッフ ---
function Receptionist({ position, rotation, shirtColor = "#2E2A25" }) {
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
      <Receptionist position={[-0.6, 0, 0.6]} rotation={[0, Math.PI, 0]} />
      <Receptionist position={[0.6, 0, 0.6]} rotation={[0, Math.PI, 0]} />

      <mesh position={[0, 0.21, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.42, 0.8]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[2.7, 0.04, 0.85]} />
        <meshStandardMaterial color={WOOD.deskTop} roughness={0.25} />
      </mesh>

      <Html position={[0, 1.15, -0.1]} center style={{ pointerEvents: "none" }}>
        <div style={{
          background: "rgba(43, 38, 33, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "2px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
        }}>
          受付
        </div>
      </Html>

      <mesh position={[-0.5, 0.52, 0.1]} rotation={[0.3, Math.PI, 0]} castShadow>
        <boxGeometry args={[0.28, 0.2, 0.02]} />
        <meshStandardMaterial color="#2B2621" />
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.26, 0.18]} />
          <meshStandardMaterial color="#E0F2FE" emissive="#0EA5E9" emissiveIntensity={1.2} />
        </mesh>
      </mesh>
      <mesh position={[0.5, 0.52, 0.1]} rotation={[0.3, Math.PI, 0]} castShadow>
        <boxGeometry args={[0.28, 0.2, 0.02]} />
        <meshStandardMaterial color="#2B2621" />
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.26, 0.18]} />
          <meshStandardMaterial color="#E0F2FE" emissive="#0EA5E9" emissiveIntensity={1.2} />
        </mesh>
      </mesh>

      {/* 受付脇のグリーン */}
      <PottedPlant position={[-1.5, 0, -0.1]} scale={0.85} />
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
      {/* ヘッダー(まぐさ) - 厚みを持たせ、下端に見切り材を追加 */}
      <mesh position={[0, 2.55, 0]} castShadow>
        <boxGeometry args={[3.6, 0.3, 0.3]} />
        <meshStandardMaterial color="#4A4038" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.39, 0.05]}>
        <boxGeometry args={[3.5, 0.03, 0.32]} />
        <meshStandardMaterial color="#D8C9A8" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* センサー */}
      <mesh position={[0, 2.36, 0.16]}>
        <boxGeometry args={[0.16, 0.06, 0.05]} />
        <meshStandardMaterial color="#1E1A16" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.36, 0.19]}>
        <circleGeometry args={[0.02, 12]} />
        <meshStandardMaterial color="#8FE3FF" emissive="#38BDF8" emissiveIntensity={1.4} />
      </mesh>

      {/* 縦枠(左右) */}
      <mesh position={[-1.55, 1.2, 0]} castShadow>
        <boxGeometry args={[0.16, 2.5, 0.3]} />
        <meshStandardMaterial color="#4A4038" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[1.55, 1.2, 0]} castShadow>
        <boxGeometry args={[0.16, 2.5, 0.3]} />
        <meshStandardMaterial color="#4A4038" metalness={0.55} roughness={0.35} />
      </mesh>

      {/* 袖壁 (両脇に少し奥行きを出して開口部を引き立てる) */}
      <mesh position={[-1.75, 1.2, -0.22]}>
        <boxGeometry args={[0.22, 2.5, 0.5]} />
        <meshStandardMaterial color={WOOD.wallUpper} roughness={0.88} />
      </mesh>
      <mesh position={[1.75, 1.2, -0.22]}>
        <boxGeometry args={[0.22, 2.5, 0.5]} />
        <meshStandardMaterial color={WOOD.wallUpper} roughness={0.88} />
      </mesh>

      {/* ガラス扉 (目線位置にフロスト帯) */}
      <mesh ref={leftDoorRef} position={[-0.7, 1.2, 0]} castShadow>
        <boxGeometry args={[1.3, 2.3, 0.05]} />
        <meshStandardMaterial color="#38BDF8" transparent opacity={0.32} roughness={0.08} />
      </mesh>
      <mesh position={[-0.7, 1.2, 0.03]}>
        <boxGeometry args={[1.3, 0.14, 0.01]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.55} />
      </mesh>
      <mesh ref={rightDoorRef} position={[0.7, 1.2, 0]} castShadow>
        <boxGeometry args={[1.3, 2.3, 0.05]} />
        <meshStandardMaterial color="#38BDF8" transparent opacity={0.32} roughness={0.08} />
      </mesh>
      <mesh position={[0.7, 1.2, 0.03]}>
        <boxGeometry args={[1.3, 0.14, 0.01]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.55} />
      </mesh>

      {/* 御影石調の三和土(たたき) */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.0, 1.8]} />
        <meshStandardMaterial color="#B9AE9C" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.9, 0.06]} />
        <meshStandardMaterial color="#8F8574" roughness={0.8} />
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
          <meshStandardMaterial color="#2B2621" />
        </mesh>
        <group ref={leftArmRef} position={[-0.14, 0.46, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
            <meshStandardMaterial color="#2B2621" />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.14, 0.46, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
            <meshStandardMaterial color="#2B2621" />
          </mesh>
        </group>
        <group ref={leftLegRef} position={[-0.06, 0.18, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.028, 0.22, 8]} />
            <meshStandardMaterial color="#1E1A16" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.06, 0.18, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.028, 0.22, 8]} />
            <meshStandardMaterial color="#1E1A16" />
          </mesh>
        </group>
      </group>
      <Html position={[0, 0.98, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{
          background: "rgba(43, 38, 33, 0.92)", color: "#FFFFFF", padding: "2px 6px",
          borderRadius: "2px", fontSize: "10px", fontWeight: "bold", whiteSpace: "nowrap"
        }}>
          巡回警備員
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
          setStatusText(`順番待ち (${qIndex + 1}人目)`);
          let diff = 0 - groupRef.current.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          groupRef.current.rotation.y += diff * delta * 8;
        }
      }
      if (onPositionUpdate) onPositionUpdate([currentPos.x, currentPos.y, currentPos.z], false, status);
      return;
    }

    let currentWaypoints = [];
    if (actorState === "APPROACHING_QUEUE") currentWaypoints = [[0, 11.5], [0, 9.5], [3.5, 9.5], [4.5, 8.5]];
    else if (actorState === "TO_SEAT") currentWaypoints = seatWaypoints;
    else if (actorState === "TO_EXIT_QUEUE") currentWaypoints = exitWaypoints;
    else if (actorState === "LEAVING") currentWaypoints = [[4.5, 8.5], [3.5, 9.5], [0, 9.5], [0, 11.5], [0, 18]];

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

  const indicatorColor = isBreak ? WOOD.accent : (actorState === "SEATED" ? "#10B981" : "#EF4444");

  const showSubjectCard = actorState === "SEATED";
  let subjectText = "";
  if (isBreak) subjectText = "休憩中";
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
            <meshStandardMaterial color="#1E1A16" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.05, 0.14, 0]}>
          <mesh position={[0, -0.07, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.025, 0.18, 8]} />
            <meshStandardMaterial color="#1E1A16" />
          </mesh>
        </group>
      </group>

      {actorState !== "OUTSIDE" && (
        <Html position={[0, 1.0, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "sans-serif", alignItems: "center", gap: "3px" }}>
            {statusText && (
              <div style={{
                background: WOOD.accent, color: "#FFFFFF", fontSize: "10px", fontWeight: "bold",
                padding: "2px 6px", borderRadius: "2px", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", whiteSpace: "nowrap"
              }}>
                {statusText}
              </div>
            )}
            {showSubjectCard && subjectText && (
              <div style={{
                background: isBreak ? WOOD.accent : "rgba(43, 38, 33, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "2px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
              }}>
                {subjectText}
              </div>
            )}
            <div style={{
              background: "rgba(255, 255, 255, 0.95)", padding: "3px 8px", borderRadius: "2px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap"
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: indicatorColor, display: "inline-block" }} />
              <span style={{ fontSize: "12px", fontWeight: "900", color: WOOD.ink, fontFamily: "'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', 'Quicksand', sans-serif" }}>
                {rawName}
              </span>
              {visitCount > 0 && <span style={{ fontSize: "10px", fontWeight: "bold", color: WOOD.accent, marginLeft: "1px" }}>★{visitCount}</span>}
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
        <meshStandardMaterial color="#33302B" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.44, -0.16]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.04]} />
        <meshStandardMaterial color="#33302B" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
        <meshStandardMaterial color={WOOD.metal} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 5]} />
        <meshStandardMaterial color="#26221D" />
      </mesh>
    </group>
  );
}

// --- 各席の独立制御コンポーネント (パフォーマンス改善用) ---
function DeskSeat({ islandPos, localX, localZ, rot, learnerDataRef, seatNumber }) {
  const materialRef = useRef();
  const [occupied, setOccupied] = useState(false);
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
      materialRef.current.color.set("#1E1A16");
      materialRef.current.emissive.set("#000000");
      materialRef.current.emissiveIntensity = 0;
    }
    if (isOccupied !== occupied) setOccupied(isOccupied);
  });

  return (
    <group position={[localX, 0, localZ]}>
      <Chair position={[0, 0, 0]} rotation={[0, rot, 0]} />
      <group position={[0, 0.47, localZ > 0 ? -0.28 : 0.28]} rotation={[0, localZ > 0 ? 0 : Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.015, 0.2]} />
          <meshStandardMaterial color={WOOD.metal} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.1, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.02]} />
          <meshStandardMaterial color="#2B2621" />
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshStandardMaterial ref={materialRef} color="#1E1A16" />
          </mesh>
        </mesh>
      </group>
      {!occupied && (
        <Html position={[0, 0.85, localZ > 0 ? -0.28 : 0.28]} center style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(43, 38, 33, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "2px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
          }}>
            {seatNumber}
          </div>
        </Html>
      )}
    </group>
  );
}

function RoundTableSeat({ islandPos, localX, localZ, rot, learnerDataRef, seatNumber }) {
  const materialRef = useRef();
  const [occupied, setOccupied] = useState(false);
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
      materialRef.current.color.set("#1E1A16");
      materialRef.current.emissive.set("#000000");
      materialRef.current.emissiveIntensity = 0;
    }
    if (isOccupied !== occupied) setOccupied(isOccupied);
  });

  return (
    <group position={[localX, 0, localZ]}>
      <Chair position={[0, 0, 0]} rotation={[0, rot, 0]} />
      {/* PC画面を着席者に向けて180度反転 (rot + Math.PI) */}
      <group position={[pcX - localX, 0.47, pcZ - localZ]} rotation={[0, rot + Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.015, 0.2]} />
          <meshStandardMaterial color={WOOD.metal} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.1, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.02]} />
          <meshStandardMaterial color="#2B2621" />
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshStandardMaterial ref={materialRef} color="#1E1A16" />
          </mesh>
        </mesh>
      </group>
      {!occupied && (
        <Html position={[pcX - localX, 0.85, pcZ - localZ]} center style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(43, 38, 33, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "2px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
          }}>
            {seatNumber}
          </div>
        </Html>
      )}
    </group>
  );
}

// --- 長方形デスク島 (8席) ---
function DeskIsland({ position, learnerDataRef, seatStart = 0 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.06, 1.2]} />
        <meshStandardMaterial color={WOOD.deskTop} roughness={0.3} />
      </mesh>
      {[[-2.05, 0.21, -0.55], [2.05, 0.21, -0.55], [-2.05, 0.21, 0.55], [2.05, 0.21, 0.55]].map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.06, 0.42, 0.06]} />
          <meshStandardMaterial color={WOOD.metal} metalness={0.5} />
        </mesh>
      ))}
      {RECT_OFFSETS.map(([x, z, rot], i) => (
        <DeskSeat key={i} islandPos={position} localX={x} localZ={z} rot={rot} learnerDataRef={learnerDataRef} seatNumber={seatStart + i} />
      ))}
    </group>
  );
}

// --- 丸テーブル島 (4席) ---
function RoundTableIsland({ position, learnerDataRef, seatStart = 0 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.06, 32]} />
        <meshStandardMaterial color={WOOD.deskTop} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.44, 16]} />
        <meshStandardMaterial color={WOOD.metal} metalness={0.5} />
      </mesh>
      {ROUND_OFFSETS.map(([x, z, rot], i) => (
        <RoundTableSeat key={i} islandPos={position} localX={x} localZ={z} rot={rot} learnerDataRef={learnerDataRef} seatNumber={seatStart + i} />
      ))}
    </group>
  );
}

// --- 観葉植物 ---
function PottedPlant({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.28, 12]} />
        <meshStandardMaterial color="#9C5A38" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.3, 6]} />
        <meshStandardMaterial color="#4B3A2A" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.14, 0.6 + (i % 2) * 0.08, Math.sin(a) * 0.14]} rotation={[0.3, a, 0]} castShadow>
            <coneGeometry args={[0.13, 0.4, 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#4F6B45" : "#5F7D52"} roughness={0.75} />
          </mesh>
        );
      })}
    </group>
  );
}

// --- ペンダントライト (各島の照明) ---
// --- ラグ (丸テーブルの下、くつろぎゾーン) ---
function Rug({ position, radius = 1.6, color = "#7A8B6F" }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[radius, 32]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} receiveShadow>
        <ringGeometry args={[radius - 0.12, radius, 32]} />
        <meshStandardMaterial color="#F6F1E7" roughness={0.95} transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

// --- 本棚 (図書館らしさの演出) ---
function Bookshelf({ position, rotation = [0, 0, 0], width = 2.2, shelves = 4, height = 1.8 }) {
  const shelfHeight = height;
  const depth = 0.35;

  const rows = useMemo(() => {
    return Array.from({ length: shelves }, (_, row) => {
      let x = -width / 2 + 0.08;
      const books = [];
      let i = 0;
      while (x < width / 2 - 0.08) {
        const bw = 0.04 + ((row * 7 + i * 3) % 5) * 0.015;
        const bh = 0.22 + ((row * 5 + i * 2) % 4) * 0.02;
        const c = BOOK_COLORS[(row * 3 + i) % BOOK_COLORS.length];
        books.push({ x: x + bw / 2, w: bw, h: bh, c });
        x += bw + 0.006;
        i++;
      }
      return books;
    });
  }, [width, shelves]);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-width / 2, shelfHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.04, shelfHeight, depth]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
      <mesh position={[width / 2, shelfHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.04, shelfHeight, depth]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
      <mesh position={[0, shelfHeight + 0.02, 0]} castShadow>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
      {rows.map((books, row) => {
        const y = (row + 1) * (shelfHeight / (shelves + 1));
        return (
          <group key={row}>
            <mesh position={[0, y, 0]} receiveShadow>
              <boxGeometry args={[width, 0.03, depth]} />
              <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
            </mesh>
            {books.map((b, bi) => (
              <mesh key={bi} position={[b.x, y + b.h / 2 + 0.02, 0.02]}>
                <boxGeometry args={[b.w, b.h, depth - 0.08]} />
                <meshStandardMaterial color={b.c} roughness={0.7} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// --- 個人学習スペース (壁沿い、パソコンなしのカレル席) ---
function StudyCarrel({ position, rotation, seatNumber, seatPos, learnerDataRef }) {
  const [occupied, setOccupied] = useState(false);

  useFrame(() => {
    const isOccupied = Object.values(learnerDataRef.current).some((data) => {
      if (!data || !data.pos || !data.isSeated || data.status === "BREAK") return false;
      const dx = data.pos[0] - seatPos[0];
      const dz = data.pos[2] - seatPos[1];
      return Math.sqrt(dx * dx + dz * dz) < 0.6;
    });
    if (isOccupied !== occupied) setOccupied(isOccupied);
  });

  return (
    <group position={position} rotation={rotation}>
      {/* 壁付けデスク */}
      <mesh position={[0.35, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.05, 0.7]} />
        <meshStandardMaterial color={WOOD.deskTop} roughness={0.3} />
      </mesh>
      <mesh position={[0.35, 0.22, -0.3]} castShadow>
        <boxGeometry args={[0.04, 0.42, 0.04]} />
        <meshStandardMaterial color={WOOD.metal} metalness={0.5} />
      </mesh>
      <mesh position={[0.35, 0.22, 0.3]} castShadow>
        <boxGeometry args={[0.04, 0.42, 0.04]} />
        <meshStandardMaterial color={WOOD.metal} metalness={0.5} />
      </mesh>

      {/* 両脇のパーティション (集中しやすい半個室感) */}
      <mesh position={[0.15, 0.75, -0.34]} castShadow>
        <boxGeometry args={[0.7, 0.6, 0.02]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.6} />
      </mesh>
      <mesh position={[0.15, 0.75, 0.34]} castShadow>
        <boxGeometry args={[0.7, 0.6, 0.02]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.6} />
      </mesh>

      <Chair position={[0.75, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {!occupied && (
        <Html position={[0.6, 1.0, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(43, 38, 33, 0.9)", color: "#FFFFFF", padding: "2px 8px", borderRadius: "2px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)", fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap"
          }}>
            {seatNumber}
          </div>
        </Html>
      )}
    </group>
  );
}

// --- 窓 (自然光の演出、フレームは木製) ---
function WindowPanel({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[1.6, 1.8, 0.06]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.6} />
      </mesh>
      {/* 無色透明のガラス (外から中が見通せるように、奥行きを離してZファイティングも解消) */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[1.4, 1.6]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transparent
          opacity={0.1}
          roughness={0.05}
          transmission={0.95}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.03, 1.6, 0.01]} />
        <meshStandardMaterial color={WOOD.trim} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[1.4, 0.03, 0.01]} />
        <meshStandardMaterial color={WOOD.trim} />
      </mesh>
    </group>
  );
}

// --- 木目床テクスチャ (プロシージャル生成) ---
function useWoodFloorTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const plankColors = ["#B4906A", "#AC8760", "#A47C55", "#B89473"];
    const plankHeight = 256 / 8;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = plankColors[i % plankColors.length];
      ctx.fillRect(0, i * plankHeight, 256, plankHeight);
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        const gy = i * plankHeight + Math.random() * plankHeight;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(256, gy + (Math.random() * 4 - 2));
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, i * plankHeight);
      ctx.lineTo(256, i * plankHeight);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 6);
    tex.anisotropy = 4;
    return tex;
  }, []);
}

// --- 壁 (腰壁・廻り縁・幅木を備えた共通コンポーネント) ---
function Wall({ position, rotation = [0, 0, 0], length, faceSign = 1, height = 2.8 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <boxGeometry args={[length, height, 0.2]} />
        <meshStandardMaterial color={WOOD.wallUpper} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.55, faceSign * 0.11]} receiveShadow castShadow>
        <boxGeometry args={[length, 1.1, 0.03]} />
        <meshStandardMaterial color={WOOD.wallLower} roughness={0.65} />
      </mesh>
      <mesh position={[0, height - 0.09, faceSign * 0.12]} castShadow>
        <boxGeometry args={[length, 0.14, 0.05]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.04, faceSign * 0.12]} castShadow>
        <boxGeometry args={[length, 0.09, 0.05]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>
    </group>
  );
}

// --- インテリアと壁 ---
function RoomDecorations() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const timeStr = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <group>
      <group position={[0, 2.0, -10.85]}>
        <mesh castShadow>
          <boxGeometry args={[6.2, 1.15, 0.06]} />
          <meshStandardMaterial color={WOOD.trim} roughness={0.6} />
        </mesh>
        {/* デジタルサイネージ盤面 */}
        <mesh position={[0, 0, 0.04]} castShadow>
          <boxGeometry args={[6, 1.0, 0.06]} />
          <meshStandardMaterial color="#20241F" roughness={0.5} />
        </mesh>
        <Html position={[0, 0, 0.08]} center style={{ pointerEvents: "none" }}>
          <div style={{ textAlign: "center", fontFamily: "'Courier New', monospace" }}>
            <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#B7A98A", marginBottom: "3px" }}>STUDY ROOM</div>
            <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "2px", color: "#F3D9A0", textShadow: "0 0 8px rgba(243,217,160,0.55)" }}>
              {timeStr}
            </div>
            <div style={{ fontSize: "11px", letterSpacing: "1px", color: "#D8C79E", marginTop: "3px" }}>{dateStr}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}

// --- 空間・床・壁 ---
function RoomEnvironment() {
  const floorTex = useWoodFloorTexture();

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 26]} />
        {floorTex ? (
          <meshStandardMaterial map={floorTex} roughness={0.68} />
        ) : (
          <meshStandardMaterial color="#B4906A" roughness={0.68} />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 17]} receiveShadow>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#C9BFAE" roughness={0.85} />
      </mesh>

      {/* 奥壁・左右壁 (囲われた空間にするため右壁を追加) */}
      <Wall position={[0, 0, -11]} length={32} faceSign={1} />
      <Wall position={[-15.9, 0, 0]} rotation={[0, Math.PI / 2, 0]} length={34} faceSign={1} />
      <Wall position={[15.9, 0, 0]} rotation={[0, -Math.PI / 2, 0]} length={34} faceSign={1} />

      {/* 手前壁 (自動ドアの開口を挟んだ2分割) */}
      <Wall position={[-9.0, 0, 11]} length={14} faceSign={-1} />
      <Wall position={[9.0, 0, 11]} length={14} faceSign={-1} />
      <mesh position={[0, 2.7, 11]}>
        <boxGeometry args={[4, 0.2, 0.2]} />
        <meshStandardMaterial color={WOOD.trim} roughness={0.55} />
      </mesh>

      {/* 窓 (左右壁、自然光の演出) */}
      <WindowPanel position={[-15.75, 1.5, -6]} rotation={[0, Math.PI / 2, 0]} />
      <WindowPanel position={[-15.75, 1.5, 4]} rotation={[0, Math.PI / 2, 0]} />
      <WindowPanel position={[15.75, 1.5, -6]} rotation={[0, -Math.PI / 2, 0]} />
      <WindowPanel position={[15.75, 1.5, 4]} rotation={[0, -Math.PI / 2, 0]} />

      {/* 本棚 (図書館らしさ + 中央テーブル群を緩やかに仕切るパーティション) */}
      {BOOKSHELF_LAYOUT.map((b, i) => (
        <Bookshelf key={i} position={b.position} rotation={b.rotation} width={b.width} height={b.height} />
      ))}

      {/* 観葉植物 */}
      <PottedPlant position={[-14.3, 0, 9.5]} />
      <PottedPlant position={[14.3, 0, 9.5]} />
      <PottedPlant position={[-13.0, 0, -6.6]} scale={0.85} />
      <PottedPlant position={[13.3, 0, -6.6]} scale={0.85} />

      {/* ラグ (丸テーブルのくつろぎゾーン) */}
      {ISLANDS.filter((d) => d.type === "round").map((d) => (
        <Rug key={`rug-${d.id}`} position={[d.pos[0], 0, d.pos[2]]} />
      ))}

      <gridHelper args={[32, 32, "#E7DFCF", "#E7DFCF"]} position={[0, 0.015, 0]} />
    </group>
  );
}

// --- カメラコントローラー (視点移動と手動操作の完全分離) ---
function CameraController({ viewTarget, followUid, learnerDataRef }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const isAnimating = useRef(false);
  const targetCamPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (followUid) return; // 追従モード中はプリセット視点の切り替えを無視
    if (viewTarget && viewTarget.camPos && viewTarget.target) {
      targetCamPos.current.set(...viewTarget.camPos);
      targetLookAt.current.set(...viewTarget.target);
      isAnimating.current = true;
    }
  }, [viewTarget?.trigger, followUid]);

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

    if (followUid) {
      const data = learnerDataRef.current[followUid];
      if (data && data.pos) {
        const [px, py, pz] = data.pos;
        targetLookAt.current.set(px, py + 0.5, pz);
        targetCamPos.current.set(px + 2.4, py + 2.6, pz + 3.2);
        const speed = 3.0;
        camera.position.lerp(targetCamPos.current, delta * speed);
        controls.target.lerp(targetLookAt.current, delta * speed);
      }
      controls.update();
      return;
    }

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
      maxPolarAngle={Math.PI / 2.02}
    />
  );
}

// --- メインアプリ ---
export default function App() {
  // URLパラメータ: ?follow=<uid> で指定した学習者をカメラが自動追従、?embed=1 でUIを最小化
  // (入退室ページからiframe埋め込みで開いた際の「自分のキャラクターを追いかける」表示用)
  const urlParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const followUid = urlParams.get("follow") || null;
  const embedMode = urlParams.get("embed") === "1";

  const guardRoute = useMemo(() => [[-13.5, -8.5], [13.5, -8.5], [13.5, 8.5], [-13.5, 8.5]], []);

  const [queue, setQueue] = useState([]);
  const joinQueue = (id) => setQueue((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const leaveQueue = (id) => setQueue((prev) => prev.filter((item) => item !== id));

  const guardPosRef = useRef([0, 0, -5]);
  const learnerDataRef = useRef({});

  const [learners, setLearners] = useState([]);
  const [learnerModes, setLearnerModes] = useState({});

  const buttonTargets = useMemo(() => [
    { name: "全体表示 (外から)", target: [0, 0, 5], camPos: [14, 14, 22] },
    { name: "受付カウンター", target: [4.5, 0.5, 9.8], camPos: [8, 6, 16] },
    ...ISLANDS.map((desk) => ({
      name: desk.name,
      target: [desk.pos[0], 0.4, desk.pos[2]],
      camPos: [desk.pos[0] + 3, 3.5, desk.pos[2] + 4]
    }))
  ], []);

  const [viewTarget, setViewTarget] = useState(buttonTargets[0]);

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

  // 深夜2時になったら、退室し忘れている学習者を一括で退室扱いにする
  // (このページが開かれているブラウザでのみ動作するクライアント側の保険。
  //  確実に実行したい場合はFirebase Cloud Functionsの定時トリガーを別途用意するのが望ましい)
  useEffect(() => {
    const checkMidnightReset = () => {
      const now = new Date();
      if (now.getHours() !== 2) return;
      const todayKey = now.toDateString();
      const lastReset = window.localStorage.getItem("studyroom_last_reset");
      if (lastReset === todayKey) return;

      const usersRef = ref(db, "users");
      onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const updates = {};
          Object.entries(data).forEach(([uid, uData]) => {
            if (uData.status && uData.status !== "LEFT") {
              updates[`users/${uid}/status`] = "LEFT";
            }
          });
          if (Object.keys(updates).length > 0) {
            update(ref(db), updates);
          }
        }
        window.localStorage.setItem("studyroom_last_reset", todayKey);
      }, { onlyOnce: true });
    };

    checkMidnightReset();
    const timer = setInterval(checkMidnightReset, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCameraChange = (e) => {
    setAutoTour(false);
    const selectedIndex = parseInt(e.target.value, 10);
    if (!isNaN(selectedIndex) && buttonTargets[selectedIndex]) {
      setViewTarget({ ...buttonTargets[selectedIndex], trigger: Date.now() });
    }
  };

  // 自動巡回モード: 座席ビューを5秒おきに順番へスムーズに切り替える
  const [autoTour, setAutoTour] = useState(false);
  const tourIndexRef = useRef(0);
  const seatViewTargets = useMemo(() => buttonTargets.slice(2), [buttonTargets]);

  useEffect(() => {
    if (!autoTour || seatViewTargets.length === 0) return;
    const advance = () => {
      const next = seatViewTargets[tourIndexRef.current % seatViewTargets.length];
      tourIndexRef.current += 1;
      setViewTarget({ ...next, trigger: Date.now() });
    };
    advance();
    const timer = setInterval(advance, 5000);
    return () => clearInterval(timer);
  }, [autoTour, seatViewTargets]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0, background: "#EDE6D8" }}>

      {/* ヘッダー: ワードマーク + 在室状況 + 視点切替を1本のバーに集約 (embedモードでは非表示) */}
      {!embedMode && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 22px", background: "rgba(246, 241, 231, 0.92)",
          backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(43,38,33,0.08)",
          fontFamily: "'Hiragino Kaku Gothic ProN', 'Zen Kaku Gothic New', sans-serif"
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: WOOD.ink, letterSpacing: "0.12em" }}>
              STUDY ROOM
            </span>
            <span style={{ fontSize: "11px", color: WOOD.sub }}>
              学習者 <strong style={{ color: WOOD.ink }}>{learners.length}</strong>名
              <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
              受付待機 <strong style={{ color: WOOD.accent }}>{queue.length}</strong>名
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setAutoTour((v) => !v)}
              style={{
                padding: "6px 10px", fontSize: "11px", fontWeight: 600,
                color: autoTour ? "#FFFFFF" : WOOD.ink,
                background: autoTour ? WOOD.accent : "#FFFFFF",
                border: "1px solid rgba(43,38,33,0.15)", borderRadius: "3px",
                outline: "none", cursor: "pointer", whiteSpace: "nowrap"
              }}
            >
              {autoTour ? "自動巡回中 ■" : "自動巡回 ▶"}
            </button>
            <select
              onChange={handleCameraChange}
              style={{
                padding: "6px 10px", fontSize: "11px", fontWeight: 600, color: WOOD.ink,
                background: "#FFFFFF", border: "1px solid rgba(43,38,33,0.15)", borderRadius: "3px",
                outline: "none", cursor: "pointer"
              }}
            >
              {buttonTargets.map((btn, idx) => (
                <option key={idx} value={idx}>{btn.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 入退室QR (右下の控えめなタブ、embedモードでは非表示) */}
      {!embedMode && (
        <div style={{
          position: "absolute", bottom: 20, right: 20, zIndex: 10,
          background: "rgba(246, 241, 231, 0.95)", border: "1px solid rgba(43,38,33,0.1)",
          padding: "10px", borderRadius: "4px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: "6px", fontFamily: "'Hiragino Kaku Gothic ProN', sans-serif"
        }}>
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=https://yazakiai.github.io/study-room/entry3"
            alt="QR" width={88} height={88} style={{ borderRadius: "2px" }}
          />
          <div style={{ fontSize: "9px", color: WOOD.sub, letterSpacing: "0.02em" }}>入退室はこちらから</div>
        </div>
      )}

      {/* 3D Viewport */}
      <Canvas
        shadows
        camera={{ position: [14, 14, 22], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#EDE6D8"]} />
        <fog attach="fog" args={["#EDE6D8", 24, 50]} />
        <SoftShadows size={14} samples={8} focus={0.5} />

        <hemisphereLight args={["#FFF6E8", "#8B7355", 0.62]} />
        <ambientLight intensity={0.32} />
        <directionalLight
          position={[15, 22, 10]}
          intensity={1.15}
          color="#FFF1DD"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Environment preset="lobby" />

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
          const seatStart = ISLAND_SEAT_START[desk.id];
          if (desk.type === "rect") {
            return <DeskIsland key={desk.id} position={desk.pos} learnerDataRef={learnerDataRef} seatStart={seatStart} />;
          } else {
            return <RoundTableIsland key={desk.id} position={desk.pos} learnerDataRef={learnerDataRef} seatStart={seatStart} />;
          }
        })}

        {/* 個人学習スペース (壁沿い、パソコンなし) */}
        {CARRELS.map((c) => (
          <StudyCarrel
            key={c.id}
            position={[c.anchor[0], 0, c.anchor[1]]}
            rotation={c.groupRotation}
            seatNumber={c.seatIndex}
            seatPos={c.seatPos}
            learnerDataRef={learnerDataRef}
          />
        ))}

        <CameraController viewTarget={viewTarget} followUid={followUid} learnerDataRef={learnerDataRef} />
      </Canvas>
    </div>
  );
}
