/* ===== VTuber Forge — js/tracking/face.js ===== */
// Face Tracking dengan MediaPipe + Kalidokit

let faceMesh = null;
let cameraStream = null;
let isFaceTracking = false;
let faceSensitivity = 1.0;
let faceSmoothing = 0.5;

function initFaceMesh() {
    if (faceMesh) return Promise.resolve();
    return new Promise((resolve, reject) => {
        try {
            faceMesh = new FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            faceMesh.onResults(onFaceResults);
            dbg("✅ MediaPipe Face Mesh initialized");
            resolve();
        } catch (e) {
            dbg("❌ Face Mesh init error: " + e.message);
            reject(e);
        }
    });
}

function onFaceResults(results) {
    if (!isFaceTracking || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
    if (!S.selected || !S.selected._morphInstance || !S.selected._morphNames) return;
    
    try {
        const faceLandmarks = results.multiFaceLandmarks[0];
        const face = Kalidokit.Face.solve(faceLandmarks, { runtime: 'mediapipe', video: null });
        if (!face) return;
        
        // Apply head rotation ke bone
        const headX = face.head.x * faceSensitivity * (180 / Math.PI);
        const headY = face.head.y * faceSensitivity * (180 / Math.PI);
        const headZ = face.head.z * faceSensitivity * (180 / Math.PI);
        
        const renderComp = S.selected.findComponent('render');
        if (renderComp && renderComp.meshInstances) {
            for (const mi of renderComp.meshInstances) {
                if (mi.skinInstance) {
                    const headBone = mi.skinInstance.bones.find(b => 
                        b.name.toLowerCase().includes('head') || b.name.toLowerCase().includes('neck')
                    );
                    if (headBone) headBone.setLocalEulerAngles(headX, headY, headZ);
                    break;
                }
            }
        }
        
        // Apply blendshapes
        applyFaceBlendshapes(face);
    } catch (e) {
        dbg("Face tracking error: " + e.message);
    }
}

function applyFaceBlendshapes(face) {
    if (!S.selected || !S.selected._morphInstance || !S.selected._morphNames) return;
    
    const morphMap = {
        'eyeBlinkLeft': ['eye_blink_l', 'blink_l', 'eye_close_l'],
        'eyeBlinkRight': ['eye_blink_r', 'blink_r', 'eye_close_r'],
        'jawOpen': ['mouth_open', 'aa', 'jaw_open'],
        'mouthSmileLeft': ['smile_l', 'mouth_smile_l'],
        'mouthSmileRight': ['smile_r', 'mouth_smile_r'],
        'browInnerUp': ['brow_up', 'brow_inner']
    };
    
    for (const [key, possibleNames] of Object.entries(morphMap)) {
        if (face[key] !== undefined) {
            const value = Math.min(1, face[key] * faceSensitivity);
            for (const name of possibleNames) {
                const idx = findMorphIndex(name);
                if (idx >= 0) {
                    S.selected._morphInstance.setWeight(idx, value);
                    const slider = document.querySelector(`#morphControls input[data-morph-idx="${idx}"]`);
                    if (slider) {
                        slider.value = value;
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
    if (isFaceTracking) { stopFaceTracking(); return; }
    if (!S.selected) return alert("Pilih model VRM/GLB dulu!");
    
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances) return alert("Model tidak memiliki mesh!");
    
    const hasMorph = S.selected._morphInstance && S.selected._morphNames && S.selected._morphNames.length > 0;
    const hasSkeleton = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    
    if (!hasMorph && !hasSkeleton) return alert("Model butuh blendshapes atau skeleton untuk face tracking!");
    
    try {
        $('status').textContent = "Menginisialisasi Face Tracking...";
        await initFaceMesh();
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
        cameraStream = stream;
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.play();
        
        async function processFrame() {
            if (!isFaceTracking) return;
            if (video.readyState === video.HAVE_ENOUGH_DATA) await faceMesh.send({ image: video });
            requestAnimationFrame(processFrame);
        }
        
        isFaceTracking = true;
        processFrame();
        
        // Tombol face track biasanya ada di toolbar, jika ada:
        const btnFaceTrack = $('btnFaceTrack');
        if (btnFaceTrack) btnFaceTrack.classList.add('active');
        
        $('status').textContent = "✅ Face Tracking aktif!";
        dbg("✅ Face tracking started");
    } catch (e) {
        dbg("❌ Face tracking error: " + e.message);
        alert("Gagal start face tracking: " + e.message);
        stopFaceTracking();
    }
}

function stopFaceTracking() {
    isFaceTracking = false;
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; }
    const btnFaceTrack = $('btnFaceTrack');
    if (btnFaceTrack) btnFaceTrack.classList.remove('active');
    $('status').textContent = "Face Tracking dinonaktifkan";
    dbg("⏹ Face tracking stopped");
}

// Bind tombol face tracking jika ada di HTML
const btnFaceTrack = $('btnFaceTrack');
if (btnFaceTrack) btnFaceTrack.onclick = startFaceTracking;

dbg("✅ faceTracking.js loaded");
