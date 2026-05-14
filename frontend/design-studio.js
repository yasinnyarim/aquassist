/**
 * AquAssist — Premium 3D aquarium design studio (Three.js)
 * Drag & drop from palette, orbit camera, inspector, undo/redo, presets, local save.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const STORAGE_KEY = 'aquassist-design-studio-v1';

/**
 * Harici 3D dosyaları (GLB / FBX) palet anahtarına bağlamak için.
 * Dosyaları `frontend/assets/models/` içine koy; yol index.html’e göredir.
 *
 * Örnek:
 *   'plant-anubias': 'assets/models/anubias.glb',
 *   'wood-spider': 'assets/models/spiderwood.fbx',
 */
export const MODEL_URLS = {
     'plant-pothos': 'assets/models/pothos_plant_large.fbx',
};

const ASSET_LABELS = {
    'plant-rotala': 'Rotala',
    'plant-anubias': 'Anubias',
    'plant-monte': 'Monte Carlo',
    'plant-java': 'Java Fern',
    'wood-spider': 'Örümcek kök',
    'wood-bonsai': 'Bonsai',
    'wood-branch': 'Dal',
    'rock-seiryu': 'Seiryu',
    'rock-lava': 'Lav',
    'rock-river': 'Irmağın taşı',
    'substrate-white': 'Beyaz kuvars',
    'substrate-black': 'Siyah kuvars',
    'substrate-soil': 'Bitki toprağı',
    'deco-temple': 'Sütun',
    'deco-jar': 'Amfora',
    'deco-drift': 'Kütük',
    'coral-branch': 'Dal mercan',
    'coral-brain': 'Beyin mercanı',
    'coral-anemone': 'Anemon',
};

const modelLoadPromises = new Map();
const modelTemplates = new Map();
let deserializeGen = 0;

function normalizeModelRoot(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const target = 0.24;
    const s = target / maxDim;
    root.scale.multiplyScalar(s);
    box.setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.position.y -= box.min.y;
}

function loadModelTemplateOnce(key) {
    const url = MODEL_URLS[key];
    if (!url) return Promise.resolve(null);
    if (modelLoadPromises.has(key)) return modelLoadPromises.get(key);
    const lower = url.toLowerCase();
    const p = new Promise((resolve, reject) => {
        const onRoot = (root) => {
            try {
                normalizeModelRoot(root);
                modelTemplates.set(key, root);
                resolve(root);
            } catch (e) {
                reject(e);
            }
        };
        const onErr = (err) => {
            console.error(`[design-studio] Model yüklenemedi (${key}):`, url, err);
            modelLoadPromises.delete(key);
            reject(err);
        };
        if (lower.endsWith('.fbx')) {
            new FBXLoader().load(url, onRoot, undefined, onErr);
        } else {
            new GLTFLoader().load(url, (gltf) => onRoot(gltf.scene), undefined, onErr);
        }
    });
    modelLoadPromises.set(key, p);
    return p;
}

/** Harici model varsa onu (önbellekten klonla), yoksa procedural buildAsset */
async function createAssetRoot(key) {
    if (MODEL_URLS[key]) {
        try {
            await loadModelTemplateOnce(key);
            const tmpl = modelTemplates.get(key);
            if (!tmpl) return buildAsset(key);
            const root = cloneSkinned(tmpl);
            root.traverse((o) => {
                if (o.isMesh) {
                    if (o.geometry) o.geometry = o.geometry.clone();
                    if (o.material) {
                        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
                    }
                }
            });
            const wrap = new THREE.Group();
            wrap.add(root);
            wrap.userData = {
                placed: true,
                assetKey: key,
                label: ASSET_LABELS[key] || key,
                fromFile: true,
            };
            root.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                }
            });
            return wrap;
        } catch {
            return buildAsset(key);
        }
    }
    return buildAsset(key);
}

let host;
let renderer;
let scene;
let camera;
let controls;
let raycaster;
let pointer;
let floorPlane;
let tankGroup;
let waterMesh;
let dirLight;
let hemi;
let rimLight;
let rafId = 0;
let initialized = false;
/** @type {ResizeObserver | null} */
let resizeObserver = null;

/** @type {THREE.Group[]} */
const placedRoots = [];

let selected = null;
let dragAssetKey = null;

/** @type {string[]} */
let history = [];
let historyPtr = -1;

const TANK = { w: 2.4, d: 1.15, h: 0.95, wall: 0.04 };
const FLOOR_Y = 0.002;

/** Kum yüzeyi — sürükleyip bırakma ışınları bu düzlemde kesişir */
const SAND_Y = TANK.wall + 0.002;
const dropPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SAND_Y);
const dropHit = new THREE.Vector3();

function snap(v, step = 0.05) {
    const el = document.getElementById('design-snap-grid');
    if (!el || !el.checked) return v;
    return Math.round(v / step) * step;
}

function pushHistory() {
    const snapshot = serializeScene();
    if (historyPtr < history.length - 1) history = history.slice(0, historyPtr + 1);
    history.push(snapshot);
    historyPtr = history.length - 1;
    if (history.length > 40) {
        history.shift();
        historyPtr--;
    }
}

function serializeScene() {
    return JSON.stringify(
        placedRoots.map((g) => ({
            k: g.userData.assetKey,
            p: g.position.toArray(),
            r: g.rotation.toArray(),
            s: g.scale.toArray(),
        }))
    );
}

function deserializeScene(json) {
    void deserializeSceneAsync(json);
}

async function deserializeSceneAsync(json) {
    const gen = ++deserializeGen;
    clearPlaced();
    let arr;
    try {
        arr = JSON.parse(json);
    } catch {
        return;
    }
    if (!Array.isArray(arr)) return;
    for (const row of arr) {
        if (gen !== deserializeGen) return;
        const g = await createAssetRoot(row.k);
        if (!g) continue;
        g.position.fromArray(row.p);
        g.rotation.fromArray(row.r);
        g.scale.fromArray(row.s);
        scene.add(g);
        placedRoots.push(g);
    }
}

function clearPlaced() {
    selectObject(null);
    placedRoots.forEach((g) => {
        scene.remove(g);
        g.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m) => m.dispose && m.dispose());
            }
        });
    });
    placedRoots.length = 0;
}

function selectObject(obj) {
    selected = obj;
    placedRoots.forEach((g) => {
        g.traverse((o) => {
            if (o.isMesh && o.material && 'emissive' in o.material) {
                o.material.emissive.setHex(0x000000);
                o.material.emissiveIntensity = 0;
            }
        });
    });
    if (obj) {
        obj.traverse((o) => {
            if (o.isMesh && o.material && 'emissive' in o.material) {
                o.material.emissive.setHex(0x1a3d32);
                o.material.emissiveIntensity = 0.42;
            }
        });
    }
    const empty = document.getElementById('design-inspector-empty');
    const fields = document.getElementById('design-inspector-fields');
    if (!empty || !fields) return;
    if (!obj) {
        empty.classList.remove('hidden');
        fields.classList.add('hidden');
        return;
    }
    empty.classList.add('hidden');
    fields.classList.remove('hidden');
    const label = document.getElementById('design-prop-label');
    const rot = document.getElementById('design-prop-rot');
    const sc = document.getElementById('design-prop-scale');
    const py = document.getElementById('design-prop-y');
    if (label) label.value = obj.userData.label || obj.userData.assetKey || '';
    if (rot) {
        const deg = (obj.rotation.y * 180) / Math.PI;
        rot.value = String(Math.round(((deg % 360) + 360) % 360));
    }
    if (sc) sc.value = String(Math.round(obj.scale.x * 100));
    const yNorm = Math.min(100, Math.max(0, ((obj.position.y - FLOOR_Y) / TANK.h) * 100));
    if (py) py.value = String(Math.round(yNorm));
}

function buildMaterial(color, { rough = 0.55, metal = 0.05, emissive = 0x000000, emissiveIntensity = 0 } = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        envMapIntensity: 0.6,
        emissive,
        emissiveIntensity,
    });
}

/** İki nokta arası silindir (dal, sap, mercan kolu) */
function stemBetween(addMesh, material, a, b, rTop, rBot, radialSeg = 6) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(d.length(), 1e-4);
    const geom = new THREE.CylinderGeometry(rTop, rBot, len, radialSeg, 1);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.lerpVectors(a, b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    addMesh(mesh);
}

function buildAsset(key) {
    const g = new THREE.Group();
    g.userData = { placed: true, assetKey: key, label: key };

    const addMesh = (mesh) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
    };

    if (key.startsWith('plant-')) {
        if (key === 'plant-anubias') {
            const rhiz = buildMaterial(0x4a3520, { rough: 0.88, metal: 0 });
            const leaf = buildMaterial(0x1b3d2a, { rough: 0.42 });
            const vein = buildMaterial(0x2d5a3d, { rough: 0.5 });
            const rhy = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.2, 8), rhiz);
            rhy.rotation.z = Math.PI / 2;
            rhy.position.set(0, 0.02, 0);
            addMesh(rhy);
            const leafPts = [
                { x: -0.07, y: 0.03, z: 0.02, ry: 0.35, sc: [0.11, 0.018, 0.075] },
                { x: 0.02, y: 0.04, z: 0.05, ry: -0.2, sc: [0.1, 0.016, 0.08] },
                { x: 0.06, y: 0.035, z: -0.02, ry: -1.1, sc: [0.095, 0.017, 0.07] },
                { x: -0.03, y: 0.028, z: -0.06, ry: 1.6, sc: [0.1, 0.016, 0.072] },
                { x: 0.04, y: 0.032, z: 0.06, ry: 2.2, sc: [0.085, 0.015, 0.065] },
            ];
            leafPts.forEach((p) => {
                const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), leaf);
                m.scale.set(p.sc[0], p.sc[1], p.sc[2]);
                m.position.set(p.x, p.y, p.z);
                m.rotation.y = p.ry;
                m.rotation.x = 0.25 + Math.random() * 0.15;
                m.rotation.z = (Math.random() - 0.5) * 0.2;
                addMesh(m);
                const mid = new THREE.Mesh(new THREE.BoxGeometry(p.sc[0] * 0.35, 0.004, p.sc[2] * 0.85, 1, 1, 1), vein);
                mid.position.set(p.x, p.y + 0.006, p.z);
                mid.rotation.copy(m.rotation);
                addMesh(mid);
            });
            g.userData.label = 'Anubias';
        } else if (key === 'plant-rotala') {
            const stemM = buildMaterial(0x8b2942, { rough: 0.4 });
            const leafM = buildMaterial(0xc43c55, { rough: 0.38 });
            const tipM = buildMaterial(0xe8b86d, { rough: 0.45 });
            for (let s = 0; s < 9; s++) {
                const bx = (Math.random() - 0.5) * 0.14;
                const bz = (Math.random() - 0.5) * 0.14;
                const h = 0.16 + Math.random() * 0.14;
                const base = new THREE.Vector3(bx, 0.01, bz);
                const top = new THREE.Vector3(bx + (Math.random() - 0.5) * 0.02, h, bz + (Math.random() - 0.5) * 0.02);
                stemBetween(addMesh, stemM, base, top, 0.004, 0.0065, 5);
                const nodes = 4;
                for (let n = 0; n < nodes; n++) {
                    const t = 0.2 + (n / (nodes - 1)) * 0.75;
                    const p = new THREE.Vector3().lerpVectors(base, top, t);
                    for (let w = 0; w < 4; w++) {
                        const ang = (w / 4) * Math.PI * 2 + s * 0.3;
                        const lf = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.003, 0.012), n === nodes - 1 ? tipM : leafM);
                        lf.position.copy(p);
                        lf.rotation.y = ang;
                        lf.rotation.x = 0.85 + Math.random() * 0.2;
                        addMesh(lf);
                    }
                }
            }
            g.userData.label = 'Rotala';
        } else if (key === 'plant-monte') {
            const m = buildMaterial(0x2d6b3a, { rough: 0.55 });
            const hi = buildMaterial(0x4a9d5f, { rough: 0.42 });
            const r = 0.11;
            for (let i = 0; i < 55; i++) {
                const rr = r * Math.sqrt(Math.random());
                const th = Math.random() * Math.PI * 2;
                const sx = Math.cos(th) * rr;
                const sz = Math.sin(th) * rr;
                const rad = 0.008 + Math.random() * 0.006;
                const clump = new THREE.Mesh(new THREE.SphereGeometry(rad, 6, 5), Math.random() > 0.35 ? hi : m);
                clump.position.set(sx, rad * 0.6 + 0.002, sz);
                clump.scale.y = 0.55 + Math.random() * 0.2;
                addMesh(clump);
            }
            g.userData.label = 'Monte Carlo';
        } else if (key === 'plant-java') {
            const rachis = buildMaterial(0x3d5c2e, { rough: 0.5 });
            const pin = buildMaterial(0x5a7d46, { rough: 0.48 });
            for (let f = 0; f < 4; f++) {
                const ang = (f / 4) * Math.PI * 2 + Math.random() * 0.4;
                const curve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(0, 0.02, 0),
                    new THREE.Vector3(Math.cos(ang) * 0.06, 0.1, Math.sin(ang) * 0.06),
                    new THREE.Vector3(Math.cos(ang) * 0.12, 0.16, Math.sin(ang) * 0.12),
                    new THREE.Vector3(Math.cos(ang) * 0.16, 0.1, Math.sin(ang) * 0.16),
                ]);
                const tube = new THREE.TubeGeometry(curve, 16, 0.006, 5, false);
                addMesh(new THREE.Mesh(tube, rachis));
                const steps = 10;
                for (let i = 0; i < steps; i++) {
                    const t = i / (steps - 1);
                    const p = curve.getPoint(t);
                    const tan = curve.getTangent(t);
                    const side = new THREE.Vector3(-tan.z, 0.2, tan.x).normalize().multiplyScalar(0.04 + (1 - t) * 0.05);
                    const lf = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.0025, 0.014), pin);
                    lf.position.copy(p).add(side);
                    lf.lookAt(p.clone().add(side.clone().multiplyScalar(2)));
                    lf.rotateX(Math.PI / 2);
                    addMesh(lf);
                    const lf2 = lf.clone();
                    lf2.position.copy(p).sub(side);
                    lf2.rotation.y += Math.PI;
                    addMesh(lf2);
                }
            }
            g.userData.label = 'Java Fern';
        } else {
            return null;
        }
    } else if (key.startsWith('wood-')) {
        const wood = buildMaterial(0x3d2914, { rough: 0.88, metal: 0 });
        const dark = buildMaterial(0x2a1a0e, { rough: 0.9 });
        if (key === 'wood-spider') {
            const hub = new THREE.Vector3(0, 0.03, 0);
            for (let i = 0; i < 8; i++) {
                const th = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
                const ph = 0.35 + Math.random() * 0.45;
                const dir = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)).normalize();
                const len = 0.12 + Math.random() * 0.14;
                const mid = dir.clone().multiplyScalar(len * 0.45).add(hub);
                const end = dir.clone().multiplyScalar(len).add(hub);
                const curve = new THREE.CatmullRomCurve3([hub.clone(), mid, end]);
                const tube = new THREE.TubeGeometry(curve, 12, 0.022 + Math.random() * 0.01, 5, false);
                addMesh(new THREE.Mesh(tube, i % 3 === 0 ? dark : wood));
                if (Math.random() > 0.45) {
                    const b2 = end.clone().add(dir.clone().multiplyScalar(0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.8));
                    stemBetween(addMesh, wood, end, b2, 0.012, 0.008);
                }
            }
            g.userData.label = 'Örümcek kök';
        } else if (key === 'wood-bonsai') {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.055, 0.32, 10), wood);
            trunk.position.y = 0.18;
            trunk.rotation.z = (Math.random() - 0.5) * 0.12;
            addMesh(trunk);
            const foliage = buildMaterial(0x1a3d24, { rough: 0.82 });
            for (let layer = 0; layer < 4; layer++) {
                const y = 0.28 + layer * 0.055;
                const rad = 0.12 - layer * 0.018;
                for (let i = 0; i < 9; i++) {
                    const a = (i / 9) * Math.PI * 2 + layer * 0.4;
                    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random() * 0.025, 7, 6), foliage);
                    cloud.position.set(Math.cos(a) * rad * (0.75 + Math.random() * 0.35), y + Math.random() * 0.04, Math.sin(a) * rad * (0.75 + Math.random() * 0.35));
                    cloud.scale.set(1.1, 0.55, 1.05);
                    addMesh(cloud);
                }
            }
            g.userData.label = 'Bonsai';
        } else if (key === 'wood-branch') {
            const p0 = new THREE.Vector3(-0.08, 0.02, 0);
            const p1 = new THREE.Vector3(0.02, 0.09, 0.04);
            const p2 = new THREE.Vector3(0.12, 0.06, -0.03);
            const p3 = new THREE.Vector3(0.18, 0.02, 0.02);
            const c1 = new THREE.CatmullRomCurve3([p0, p1, p2]);
            const c2 = new THREE.CatmullRomCurve3([p1, p2, p3]);
            addMesh(new THREE.Mesh(new THREE.TubeGeometry(c1, 14, 0.026, 5, false), wood));
            addMesh(new THREE.Mesh(new THREE.TubeGeometry(c2, 14, 0.02, 5, false), dark));
            stemBetween(addMesh, wood, p2, p2.clone().add(new THREE.Vector3(0.04, 0.05, 0.02)), 0.014, 0.01);
            g.userData.label = 'Dal';
        } else {
            return null;
        }
    } else if (key.startsWith('rock-')) {
        if (key === 'rock-seiryu') {
            const mat = buildMaterial(0x5a6169, { rough: 0.94, metal: 0.03 });
            const mat2 = buildMaterial(0x3e454c, { rough: 0.92 });
            for (let i = 0; i < 4; i++) {
                const ch = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 + Math.random() * 0.03, 0), i % 2 ? mat2 : mat);
                ch.position.set((Math.random() - 0.5) * 0.1, 0.04 + i * 0.03, (Math.random() - 0.5) * 0.1);
                ch.rotation.set(Math.random() * 0.8, Math.random() * Math.PI, Math.random() * 0.8);
                ch.scale.set(1.1 + Math.random() * 0.4, 0.65 + Math.random() * 0.25, 0.9 + Math.random() * 0.35);
                addMesh(ch);
            }
            g.userData.label = 'Seiryu';
        } else if (key === 'rock-lava') {
            const mat = buildMaterial(0x121212, { rough: 0.97, metal: 0.02 });
            const pit = buildMaterial(0x0a0a0a, { rough: 0.99 });
            for (let i = 0; i < 6; i++) {
                const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055 + Math.random() * 0.04, 0), mat);
                m.position.set((Math.random() - 0.5) * 0.12, 0.03 + Math.random() * 0.05, (Math.random() - 0.5) * 0.12);
                m.scale.setScalar(0.85 + Math.random() * 0.5);
                addMesh(m);
            }
            for (let h = 0; h < 5; h++) {
                const hole = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.012, 6, 5), pit);
                hole.position.set((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.06, (Math.random() - 0.5) * 0.08);
                addMesh(hole);
            }
            g.userData.label = 'Lav';
        } else if (key === 'rock-river') {
            const mat = buildMaterial(0x7a7a78, { rough: 0.35, metal: 0.04 });
            const peb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), mat);
            peb.scale.set(1.15, 0.62, 0.92);
            peb.position.y = 0.05;
            peb.rotation.set(0.08, 0.4, 0.12);
            addMesh(peb);
            const peb2 = peb.clone();
            peb2.scale.set(0.55, 0.45, 0.6);
            peb2.position.set(0.09, 0.03, 0.04);
            peb2.rotation.set(0.2, -0.3, 0.05);
            addMesh(peb2);
            g.userData.label = 'Irmağın taşı';
        } else {
            return null;
        }
    } else if (key.startsWith('substrate-')) {
        const col = key === 'substrate-white' ? 0xe8ebe8 : key === 'substrate-black' ? 0x252525 : 0x4a3f32;
        const mat = buildMaterial(col, { rough: 0.96 });
        const matHi = buildMaterial(
            key === 'substrate-white' ? 0xffffff : key === 'substrate-black' ? 0x3a3a3a : 0x5c4d3d,
            { rough: 0.9 }
        );
        const base = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), mat);
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.002;
        addMesh(base);
        for (let i = 0; i < 42; i++) {
            const rr = 0.19 * Math.sqrt(Math.random());
            const th = Math.random() * Math.PI * 2;
            const grr = 0.006 + Math.random() * 0.007;
            const grain = new THREE.Mesh(new THREE.SphereGeometry(grr, 4, 4), Math.random() > 0.55 ? matHi : mat);
            grain.position.set(Math.cos(th) * rr, grr * 0.4 + 0.003, Math.sin(th) * rr);
            grain.scale.set(1, 0.65, 1);
            addMesh(grain);
        }
        g.userData.label =
            { 'substrate-white': 'Beyaz kuvars', 'substrate-black': 'Siyah kuvars', 'substrate-soil': 'Bitki toprağı' }[key] || 'Zemin';
    } else if (key.startsWith('deco-')) {
        if (key === 'deco-temple') {
            const stone = buildMaterial(0x9ca3af, { rough: 0.48, metal: 0.08 });
            const dark = buildMaterial(0x6b7280, { rough: 0.52 });
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.095, 0.04, 16), dark);
            base.position.y = 0.03;
            addMesh(base);
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.22, 14), stone);
            col.position.y = 0.17;
            addMesh(col);
            const cap = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20), stone);
            cap.rotation.x = Math.PI / 2;
            cap.position.y = 0.29;
            addMesh(cap);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.05, 12), dark);
            top.position.y = 0.33;
            addMesh(top);
            g.userData.label = 'Sütun';
        } else if (key === 'deco-jar') {
            const clay = buildMaterial(0x8b7355, { rough: 0.52 });
            const rim = buildMaterial(0x6d5c48, { rough: 0.5 });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.12, 20), clay);
            body.position.y = 0.09;
            addMesh(body);
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.05, 16), clay);
            neck.position.y = 0.165;
            addMesh(neck);
            const lip = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 18), rim);
            lip.rotation.x = Math.PI / 2;
            lip.position.y = 0.19;
            addMesh(lip);
            const h1 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 6, 12, Math.PI), clay);
            h1.rotation.z = Math.PI / 2;
            h1.position.set(-0.075, 0.1, 0);
            addMesh(h1);
            const h2 = h1.clone();
            h2.position.x = 0.075;
            h2.rotation.z = -Math.PI / 2;
            addMesh(h2);
            g.userData.label = 'Amfora';
        } else if (key === 'deco-drift') {
            const w = buildMaterial(0x4a3520, { rough: 0.9 });
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.14, 0.03, 0.02),
                new THREE.Vector3(-0.05, 0.07, -0.02),
                new THREE.Vector3(0.06, 0.05, 0.03),
                new THREE.Vector3(0.15, 0.025, -0.01),
            ]);
            addMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.038, 6, false), w));
            g.userData.label = 'Kütük';
        } else {
            return null;
        }
    } else if (key.startsWith('coral-')) {
        const pink = buildMaterial(0xff5c8a, { rough: 0.32, metal: 0.06 });
        const orange = buildMaterial(0xff9a6e, { rough: 0.34 });
        const purple = buildMaterial(0x8b7cff, { rough: 0.38 });
        if (key === 'coral-branch') {
            const grow = (origin, dir, len, depth) => {
                if (depth <= 0 || len < 0.02) return;
                const end = origin.clone().add(dir.clone().normalize().multiplyScalar(len));
                stemBetween(addMesh, depth % 2 === 0 ? pink : orange, origin, end, 0.006 + depth * 0.002, 0.004 + depth * 0.0015, 5);
                const branches = depth > 2 ? 2 : 3;
                for (let i = 0; i < branches; i++) {
                    const ax = (i / branches) * Math.PI * 2 + len * 3.7;
                    const childDir = new THREE.Vector3(Math.sin(ax) * 0.45 + dir.x * 0.3, 0.55 + Math.random() * 0.2, Math.cos(ax) * 0.45 + dir.z * 0.3).normalize();
                    grow(end.clone(), childDir, len * (0.55 + Math.random() * 0.15), depth - 1);
                }
            };
            grow(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.1, 0.85, 0.05).normalize(), 0.1, 4);
            grow(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(-0.08, 0.75, -0.06).normalize(), 0.085, 3);
            g.userData.label = 'Dal mercan';
        } else if (key === 'coral-brain') {
            const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.095, 1), pink);
            core.position.y = 0.07;
            addMesh(core);
            const folds = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), orange);
            folds.position.set(0.02, 0.075, 0.015);
            folds.scale.set(1.05, 0.75, 1.08);
            folds.rotation.set(0.3, 0.5, 0.2);
            addMesh(folds);
            for (let i = 0; i < 12; i++) {
                const th = (i / 12) * Math.PI * 2;
                const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 10, Math.PI * 0.55), pink);
                ridge.rotation.x = Math.PI / 2;
                ridge.rotation.z = th;
                ridge.position.set(Math.cos(th) * 0.04, 0.06 + Math.sin(i) * 0.015, Math.sin(th) * 0.04);
                addMesh(ridge);
            }
            g.userData.label = 'Beyin mercanı';
        } else if (key === 'coral-anemone') {
            const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.018, 20), purple);
            disk.position.y = 0.015;
            addMesh(disk);
            const tent = buildMaterial(0xa69fff, { rough: 0.36 });
            for (let i = 0; i < 28; i++) {
                const th = (i / 28) * Math.PI * 2;
                const r = 0.02 + (i % 3) * 0.015;
                const base = new THREE.Vector3(Math.cos(th) * r, 0.02, Math.sin(th) * r);
                const tip = base.clone().add(new THREE.Vector3(Math.cos(th) * 0.04, 0.11 + Math.random() * 0.04, Math.sin(th) * 0.04));
                stemBetween(addMesh, tent, base, tip, 0.012, 0.004, 5);
            }
            const mouth = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.028, 16), buildMaterial(0x4a3d7a, { rough: 0.45 }));
            mouth.rotation.x = -Math.PI / 2;
            mouth.position.y = 0.026;
            addMesh(mouth);
            g.userData.label = 'Anemon';
        } else {
            return null;
        }
    } else {
        return null;
    }

    const box = new THREE.Box3().setFromObject(g);
    const dy = box.min.y;
    g.position.y -= dy;
    g.position.y += FLOOR_Y;
    return g;
}

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080d);
    scene.fog = new THREE.FogExp2(0x07080d, 0.09);

    camera = new THREE.PerspectiveCamera(42, 1, 0.06, 80);
    camera.position.set(2.15, 1.35, 2.55);

    hemi = new THREE.HemisphereLight(0xb8cfff, 0x1a1e28, 0.45);
    scene.add(hemi);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
    dirLight.position.set(3.2, 5.5, 2.2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.00015;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    scene.add(dirLight);

    rimLight = new THREE.SpotLight(0x6eb8ff, 0.55, 12, 0.55, 0.35, 1);
    rimLight.position.set(-3, 3.5, -1.2);
    scene.add(rimLight);

    const amb = new THREE.AmbientLight(0x404860, 0.22);
    scene.add(amb);

    tankGroup = new THREE.Group();
    scene.add(tankGroup);

    const { w, d, h, wall } = TANK;
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.08,
        transmission: 0.92,
        thickness: 0.45,
        transparent: true,
        opacity: 1,
        envMapIntensity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
    });

    const mkWall = (sx, sy, sz, px, py, pz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glassMat);
        m.position.set(px, py, pz);
        m.receiveShadow = true;
        tankGroup.add(m);
    };
    mkWall(wall, h, d, -w / 2 + wall / 2, h / 2, 0);
    mkWall(wall, h, d, w / 2 - wall / 2, h / 2, 0);
    mkWall(w, h, wall, 0, h / 2, -d / 2 + wall / 2);
    mkWall(w, h, wall, 0, h / 2, d / 2 - wall / 2);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w - wall * 2, wall, d - wall * 2), glassMat);
    bottom.position.set(0, wall / 2, 0);
    bottom.receiveShadow = true;
    tankGroup.add(bottom);

    const sand = new THREE.Mesh(
        new THREE.PlaneGeometry(w - wall * 2 - 0.02, d - wall * 2 - 0.02),
        buildMaterial(0xc4b8a5, { rough: 0.92, metal: 0 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, wall + 0.001, 0);
    sand.receiveShadow = true;
    tankGroup.add(sand);

    const waterGeo = new THREE.BoxGeometry(w - wall * 2 - 0.04, h - wall * 2 - 0.06, d - wall * 2 - 0.04);
    waterMesh = new THREE.Mesh(
        waterGeo,
        new THREE.MeshPhysicalMaterial({
            color: 0x1a4a6e,
            metalness: 0,
            roughness: 0.12,
            transmission: 0.65,
            thickness: 0.8,
            transparent: true,
            opacity: 0.55,
            ior: 1.33,
        })
    );
    waterMesh.position.set(0, h / 2 + wall * 0.25, 0);
    tankGroup.add(waterMesh);

    floorPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 1, metalness: 0 })
    );
    floorPlane.rotation.x = -Math.PI / 2;
    floorPlane.position.y = -0.001;
    floorPlane.receiveShadow = true;
    scene.add(floorPlane);

    const ped = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.35, 0.12, d + 0.35),
        buildMaterial(0x12141c, { rough: 0.55, metal: 0.15 })
    );
    ped.position.set(0, -0.06, 0);
    ped.receiveShadow = true;
    scene.add(ped);
}

function onPointerDown(ev) {
    if (ev.button !== 0) return;
    const rect = host.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(placedRoots, true);
    if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.placed) o = o.parent;
        if (o && o.userData.placed) {
            selectObject(o);
            ev.stopPropagation();
        }
    } else {
        selectObject(null);
    }
}

function dropOnScene(clientX, clientY) {
    void dropOnSceneAsync(clientX, clientY);
}

async function dropOnSceneAsync(clientX, clientY) {
    if (!host || !camera || !raycaster) return;
    const rect = host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dropPlane, dropHit)) return;
    const p = dropHit;
    const hx = TANK.w / 2 - 0.2;
    const hz = TANK.d / 2 - 0.2;
    let x = snap(Math.min(hx, Math.max(-hx, p.x)));
    let z = snap(Math.min(hz, Math.max(-hz, p.z)));
    const key = dragAssetKey;
    if (!key) return;
    let g;
    try {
        g = await createAssetRoot(key);
    } catch (e) {
        console.error('[design-studio] drop', e);
        return;
    }
    if (!g) return;
    g.position.x = x;
    g.position.z = z;
    scene.add(g);
    placedRoots.push(g);
    pushHistory();
    selectObject(g);
}

function bindDOM() {
    host = document.getElementById('design-canvas-host');
    if (!host) return;

    host.addEventListener('pointerdown', onPointerDown, { capture: true });

    document.querySelectorAll('.design-asset').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragAssetKey = el.getAttribute('data-asset');
            e.dataTransfer.setData('text/plain', dragAssetKey);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    const viewport = document.getElementById('design-viewport');
    if (viewport) {
        viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        viewport.addEventListener('drop', (e) => {
            e.preventDefault();
            const key = e.dataTransfer.getData('text/plain') || dragAssetKey;
            if (!key) return;
            dragAssetKey = key;
            dropOnScene(e.clientX, e.clientY);
        });
    }

    document.querySelectorAll('.design-acc-head').forEach((btn) => {
        btn.addEventListener('click', () => {
            const acc = btn.closest('.design-acc');
            if (acc) acc.toggleAttribute('data-open');
        });
    });

    const rot = document.getElementById('design-prop-rot');
    const sc = document.getElementById('design-prop-scale');
    const py = document.getElementById('design-prop-y');
    const apply = () => {
        if (!selected) return;
        if (rot) selected.rotation.y = (parseFloat(rot.value, 10) * Math.PI) / 180;
        if (sc) {
            const v = parseFloat(sc.value, 10) / 100;
            selected.scale.set(v, v, v);
        }
        if (py) {
            const t = parseFloat(py.value, 10) / 100;
            selected.position.y = FLOOR_Y + t * TANK.h * 0.85;
        }
    };
    [rot, sc, py].forEach((el) => el && el.addEventListener('input', apply));
    [rot, sc, py].forEach((el) => el && el.addEventListener('change', () => pushHistory()));

    document.getElementById('design-delete-selected')?.addEventListener('click', () => {
        if (!selected) return;
        scene.remove(selected);
        const i = placedRoots.indexOf(selected);
        if (i >= 0) placedRoots.splice(i, 1);
        selectObject(null);
        pushHistory();
    });

    document.getElementById('design-undo')?.addEventListener('click', () => {
        if (historyPtr <= 0) return;
        historyPtr--;
        deserializeScene(history[historyPtr]);
    });
    document.getElementById('design-redo')?.addEventListener('click', () => {
        if (historyPtr >= history.length - 1) return;
        historyPtr++;
        deserializeScene(history[historyPtr]);
    });

    document.getElementById('design-save')?.addEventListener('click', () => {
        try {
            localStorage.setItem(STORAGE_KEY, serializeScene());
        } catch (e) {
            console.warn(e);
        }
    });
    document.getElementById('design-load')?.addEventListener('click', () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        deserializeScene(raw);
        history = [serializeScene()];
        historyPtr = 0;
        selectObject(null);
    });

    const markLightMode = (mode) => {
        const map = [
            ['studio', 'design-light-studio'],
            ['mood', 'design-light-mood'],
            ['dramatic', 'design-light-dramatic'],
        ];
        map.forEach(([m, id]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('design-chip--active', m === mode);
        });
    };

    const setLight = (mode) => {
        if (mode === 'studio') {
            hemi.intensity = 0.55;
            dirLight.intensity = 1.1;
            dirLight.color.setHex(0xffffff);
            rimLight.intensity = 0.45;
            rimLight.color.setHex(0x6eb8ff);
            scene.fog.color.setHex(0x07080d);
            scene.background.setHex(0x07080d);
        } else if (mode === 'mood') {
            hemi.intensity = 0.28;
            dirLight.intensity = 0.35;
            dirLight.color.setHex(0x8ab4ff);
            rimLight.intensity = 0.85;
            rimLight.color.setHex(0x4466ff);
            scene.fog.color.setHex(0x03040a);
            scene.background.setHex(0x03040a);
        } else {
            hemi.intensity = 0.22;
            dirLight.intensity = 1.45;
            dirLight.color.setHex(0xffe8d0);
            rimLight.intensity = 0.25;
            rimLight.color.setHex(0xffb088);
            scene.fog.color.setHex(0x050508);
            scene.background.setHex(0x050508);
        }
        markLightMode(mode);
    };
    document.getElementById('design-light-studio')?.addEventListener('click', () => setLight('studio'));
    document.getElementById('design-light-mood')?.addEventListener('click', () => setLight('mood'));
    document.getElementById('design-light-dramatic')?.addEventListener('click', () => setLight('dramatic'));
    setLight('studio');

    document.querySelectorAll('.design-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.design-preset').forEach((b) => b.classList.remove('design-preset--active'));
            btn.classList.add('design-preset--active');
            const preset = btn.getAttribute('data-preset');
            void (async () => {
                clearPlaced();
                const place = async (k, px, py, pz) => {
                    const g = await createAssetRoot(k);
                    if (!g) return;
                    g.position.set(px, py, pz);
                    scene.add(g);
                    placedRoots.push(g);
                };
                try {
                    if (preset === 'minimal') {
                        await place('rock-seiryu', -0.35, FLOOR_Y, 0.1);
                        await place('plant-anubias', 0, FLOOR_Y, 0.1);
                        await place('substrate-white', 0.35, FLOOR_Y, 0.1);
                    } else if (preset === 'jungle') {
                        await place('plant-rotala', -0.45, FLOOR_Y, -0.15);
                        await place('plant-java', 0.05, FLOOR_Y, -0.15);
                        await place('wood-spider', -0.45, FLOOR_Y, 0.2);
                        await place('rock-river', 0.05, FLOOR_Y, 0.2);
                    } else if (preset === 'reef') {
                        await place('coral-branch', 0.2, FLOOR_Y, -0.1);
                        await place('coral-brain', 0.02, FLOOR_Y, -0.1);
                        await place('rock-lava', -0.16, FLOOR_Y, -0.1);
                        await place('substrate-black', -0.34, FLOOR_Y, -0.1);
                    } else if (preset === 'clear') {
                        /* clearPlaced zaten çağrıldı */
                    }
                } catch (e) {
                    console.error('[design-studio] preset', e);
                }
                pushHistory();
                selectObject(null);
            })();
        });
    });
}

function onResize() {
    if (!host || !renderer || !camera) return;
    const vp = document.getElementById('design-viewport');
    if (vp) {
        const rect = vp.getBoundingClientRect();
        if (rect.height < 120) {
            vp.style.minHeight = `${Math.max(360, Math.round(window.innerHeight * 0.5))}px`;
        }
    }
    const w = Math.max(host.clientWidth || 1, 2);
    const h = Math.max(host.clientHeight || 1, 2);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function animate() {
    rafId = requestAnimationFrame(animate);
    /* style.display güvenilir değil (.view.active ile çakışma / flex); app.js data-aq-view kullan */
    if (document.documentElement.dataset.aqView !== 'design') return;
    const tab = document.getElementById('view-design');
    if (!tab || !tab.classList.contains('active')) return;
    if (!controls || !renderer || !scene || !camera) return;
    if (waterMesh) {
        waterMesh.position.y = TANK.h / 2 + TANK.wall * 0.25 + Math.sin(performance.now() * 0.0004) * 0.006;
    }
    controls.update();
    renderer.render(scene, camera);
}

function init() {
    host = document.getElementById('design-canvas-host');
    if (!host || initialized) return;

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    setupScene();

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);
    } catch (e) {
        console.error('[design-studio] WebGL', e);
        host.innerHTML =
            '<p style="color:rgba(226,232,240,0.85);padding:1.25rem;font-size:0.9rem;line-height:1.5">WebGL başlatılamadı. Donanım hızlandırmasını açmayı veya başka bir tarayıcı denemeyi düşünün.</p>';
        return;
    }

    initialized = true;

    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envScene = new RoomEnvironment(renderer);
        scene.environment = pmrem.fromScene(envScene, 0.04).texture;
        envScene.dispose();
        pmrem.dispose();
    } catch (e) {
        console.warn('[design-studio] PMREM / environment skipped', e);
    }

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.42, 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 1.35;
    controls.maxDistance = 5.5;
    /* Sol tık: sahne seçimi; sağ sürükle: orbit (üst ipucuyla uyumlu) */
    const M = THREE.MOUSE || { ROTATE: 0, DOLLY: 1, PAN: 2 };
    controls.mouseButtons = { LEFT: M.PAN, MIDDLE: M.DOLLY, RIGHT: M.ROTATE };
    controls.enablePan = false;
    controls.update();

    resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(host);

    bindDOM();
    window.addEventListener('resize', onResize);
    onResize();

    history = [serializeScene()];
    historyPtr = 0;

    if (!rafId) animate();
}

export function bootstrapDesignStudio() {
    init();
    onResize();
    requestAnimationFrame(() => {
        onResize();
        if (renderer && scene && camera) renderer.render(scene, camera);
    });
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            onResize();
            if (renderer && scene && camera) renderer.render(scene, camera);
        });
    });
}
