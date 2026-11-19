/* ===== VTuber Forge — js/tracking/face.js ===== */
// Face Tracking dengan MediaPipe + Kalidokit

let faceMesh = null;
let cameraStream = null;
let isFaceTracking = false;
let faceSensitivity = 1.0;
let faceSmoothing = 0.5;
let faceRafId = null;

function setFaceStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logFace(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function getKalidokitFaceSolver() {
    if (typeof window.Kalidokit !== 'undefined' && window.Kalidokit && window.Kalidokit.Face) {
        return window.Kalidokit.Face;
    }
    if (typeof window.KalidoKit !== 'undefined' && window.KalidoKit && window.KalidoKit.Face) {
        return window.KalidoKit.Face;
    }
    return null;
}

function initFaceMesh() {
    if (faceMesh) return Promise.resolve();
    if (typeof window.FaceMesh === 'undefined') {
        return Promise.reject(new Error("MediaPipe FaceMesh belum ter-load."));
    }
    return new Promise((resolve, reject) => {
        try {
            faceMesh = new window.FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            faceMesh.onResults(onFaceResults);
            logFace("✅ MediaPipe Face Mesh initialized");
            resolve();
        } catch (e) {
            faceMesh = null;
            logFace("❌ Face Mesh init error: " + e.message);
            reject(e);
        }
    });
}

function findFaceMorphIndex(name) {
    if (!S.selected || !Array.isArray(S.selected._morphNames)) return -1;
    const lowerName = String(name || '').toLowerCase();
    let idx = S.selected._morphNames.findIndex(n => String(n || '').toLowerCase() === lowerName);
    if (idx >= 0) return idx;

    idx = S.selected._morphNames.findIndex(n => String(n || '').toLowerCase().includes(lowerName));
    if (idx >= 0) return idx;

    const normalized = lowerName.replace(/[\s_-]/g, '');
    idx = S.selected._morphNames.findIndex(n =>
        String(n || '').toLowerCase().replace(/[\s_-]/g, '').includes(normalized)
    );
    return idx;
}

function onFaceResults(results) {
    if (!isFaceTracking || !results || !Array.isArray(results.multiFaceLandmarks) || results.multiFaceLandmarks.length === 0) {
        return;
    }
    if (!S.selected || !S.selected._morphInstance || !Array.isArray(S.selected._morphNames)) return;

    const faceSolver = getKalidokitFaceSolver();
    if (!faceSolver || typeof faceSolver.solve !== 'function') return;

    try {
        const faceLandmarks = results.multiFaceLandmarks[0];
        const face = faceSolver.solve(faceLandmarks, { runtime: 'mediapipe', video: null });
        if (!face) return;

        if (face.head) {
            const headX = (face.head.x || 0) * faceSensitivity * (180 / Math.PI);
            const headY = (face.head.y || 0) * faceSensitivity * (180 / Math.PI);
            const headZ = (face.head.z || 0) * faceSensitivity * (180 / Math.PI);

            const renderComp = typeof S.selected.findComponent === 'function' ? S.selected.findComponent('render') : null;
            if (renderComp && renderComp.meshInstances) {
                for (const mi of renderComp.meshInstances) {
                    if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                        const headBone = mi.skinInstance.bones.find(b => {
                            const bName = ((b && b.name) || '').toLowerCase();
                            return bName.includes('head') || bName.includes('neck');
                        });
                        if (headBone && typeof headBone.setLocalEulerAngles === 'function') {
                            headBone.setLocalEulerAngles(headX, headY, headZ);
                        }
                        break;
                    }
                }
            }
        }

        applyFaceBlendshapes(face);
    } catch (e) {
        logFace("Face tracking error: " + e.message);
    }
}

function applyFaceBlendshapes(face) {
    if (!S.selected || !S.selected._morphInstance || !Array.isArray(S.selected._morphNames)) return;

    const morphMap = {
        eyeBlinkLeft: ['eye_blink_l', 'blink_l', 'eye_close_l'],
        eyeBlinkRight: ['eye_blink_r', 'blink_r', 'eye_close_r'],
        jawOpen: ['mouth_open', 'aa', 'jaw_open'],
        mouthSmileLeft: ['smile_l', 'mouth_smile_l'],
        mouthSmileRight: ['smile_r', 'mouth_smile_r'],
        browInnerUp: ['brow_up', 'brow_inner']
    };

    for (const [key, possibleNames] of Object.entries(morphMap)) {
        if (face[key] !== undefined && face[key] !== null) {
            const rawVal = Number(face[key]) || 0;
            const value = Math.max(0, Math.min(1, rawVal * faceSensitivity));
            for (const name of possibleNames) {
                const idx = findFaceMorphIndex(name);
                if (idx >= 0) {
                    S.selected._morphInstance.setWeight(idx, value);
                    const slider = document.querySelector(`#morphControls input[data-morph-idx="${idx}"]`);
                    if (slider) {
                        slider.value = value.toFixed(2);
                        const label = document.getElementById('morphVal_' + idx);
                        if (label) label.textContent = value.toFixed(2);
                    }
                    break;
                }
            }
        }
    }
}

async function startFaceTracking() {
    if (isFaceTracking) {
        stopFaceTracking();
        return;
    }
    if (!S.selected) return alert("Pilih model VRM/GLB dulu!");

    const renderComp = typeof S.selected.findComponent === 'function' ? S.selected.findComponent('render') : null;
    if (!renderComp || !renderComp.meshInstances) return alert("Model tidak memiliki mesh!");

    const hasMorph = !!(S.selected._morphInstance && Array.isArray(S.selected._morphNames) && S.selected._morphNames.length > 0);
    const hasSkeleton = renderComp.meshInstances.some(mi => mi && mi.skinInstance != null);

    if (!hasMorph && !hasSkeleton) {
        return alert("Model butuh blendshapes atau skeleton untuk face tracking!");
    }

    if (!getKalidokitFaceSolver()) {
        return alert("Library Kalidokit tidak tersedia. Cek koneksi internet/CDN lalu muat ulang.");
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        return alert("Kamera tidak didukung di perangkat atau konteks ini.");
    }

    try {
        setFaceStatus("Menginisialisasi Face Tracking...");
        await initFaceMesh();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        cameraStream = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.muted = true;
        await video.play();

        isFaceTracking = true;

        async function processFrame() {
            if (!isFaceTracking) return;
            try {
                if (video.readyState >= 2 && faceMesh && typeof faceMesh.send === 'function') {
                    await faceMesh.send({ image: video });
                }
            } catch (frameErr) {
                logFace("Face frame error: " + frameErr.message);
            }
            if (isFaceTracking) {
                faceRafId = requestAnimationFrame(processFrame);
            }
        }

        faceRafId = requestAnimationFrame(processFrame);

        const btnFaceTrack = document.getElementById('btnFaceTrack');
        if (btnFaceTrack) btnFaceTrack.classList.add('active');

        setFaceStatus("✅ Face Tracking aktif!");
        logFace("✅ Face tracking started");
    } catch (e) {
        logFace("❌ Face tracking error: " + e.message);
        alert("Gagal start face tracking: " + e.message);
        stopFaceTracking();
    }
}
window.startFaceTracking = startFaceTracking;

function stopFaceTracking() {
    isFaceTracking = false;
    if (faceRafId !== null) {
        cancelAnimationFrame(faceRafId);
        faceRafId = null;
    }
    if (cameraStream) {
        try {
            cameraStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
        cameraStream = null;
    }
    const btnFaceTrack = document.getElementById('btnFaceTrack');
    if (btnFaceTrack) btnFaceTrack.classList.remove('active');
    setFaceStatus("Face Tracking dinonaktifkan");
    logFace("⏹ Face tracking stopped");
}
window.stopFaceTracking = stopFaceTracking;

const btnFaceTrackEl = document.getElementById('btnFaceTrack');
if (btnFaceTrackEl) btnFaceTrackEl.onclick = startFaceTracking;

logFace("✅ faceTracking.js loaded");
