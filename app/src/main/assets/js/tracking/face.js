/* ===== VTuber Forge — js/tracking/face.js ===== */
// Face Tracking via kamera depan menggunakan MediaPipe FaceMesh + Kalidokit

(function () {
    'use strict';

    let faceTrackingActive = false;
    let faceMeshInstance = null;
    let cameraStream = null;
    let videoElement = null;
    let animFrameId = null;
    let isProcessingFrame = false;

    let headBone = null;
    let neckBone = null;
    let headBindEuler = null;
    let neckBindEuler = null;
    let targetHeadRot = { x: 0, y: 0, z: 0 };
    let currentHeadRot = { x: 0, y: 0, z: 0 };

    function byId(id) {
        return document.getElementById(id);
    }

    function setFaceStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function logFace(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getFaceSelected() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function updateFaceButtonsState(active) {
        const btnTop = byId('btnFaceTrack');
        const btnPanel = byId('btnFaceTrackToggle');
        if (btnTop) btnTop.classList.toggle('active', !!active);
        if (btnPanel) btnPanel.classList.toggle('active', !!active);
    }

    function findHeadAndNeckBones(entity) {
        headBone = null;
        neckBone = null;
        headBindEuler = null;
        neckBindEuler = null;
        if (!entity || typeof entity.findComponent !== 'function') return;

        const rc = entity.findComponent('render');
        if (!rc || !Array.isArray(rc.meshInstances)) return;

        for (const mi of rc.meshInstances) {
            if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                const bones = mi.skinInstance.bones;
                for (let i = 0; i < bones.length; i++) {
                    const b = bones[i];
                    if (!b || !b.name) continue;
                    const lower = b.name.toLowerCase();
                    if (!headBone && (lower.includes('head') || lower.includes('kepala'))) {
                        headBone = b;
                        if (typeof b.getLocalEulerAngles === 'function') {
                            const r = b.getLocalEulerAngles();
                            headBindEuler = (r && typeof r.clone === 'function') ? r.clone() : { x: r.x || 0, y: r.y || 0, z: r.z || 0 };
                        }
                    } else if (!neckBone && (lower.includes('neck') || lower.includes('leher'))) {
                        neckBone = b;
                        if (typeof b.getLocalEulerAngles === 'function') {
                            const r = b.getLocalEulerAngles();
                            neckBindEuler = (r && typeof r.clone === 'function') ? r.clone() : { x: r.x || 0, y: r.y || 0, z: r.z || 0 };
                        }
                    }
                }
                if (headBone) break;
            }
        }
    }

    function applyFaceHeadRotation() {
        const selected = getFaceSelected();
        if (!selected || !faceTrackingActive) return;

        const smooth = 0.25;
        currentHeadRot.x += (targetHeadRot.x - currentHeadRot.x) * smooth;
        currentHeadRot.y += (targetHeadRot.y - currentHeadRot.y) * smooth;
        currentHeadRot.z += (targetHeadRot.z - currentHeadRot.z) * smooth;

        if (headBone && typeof headBone.setLocalEulerAngles === 'function') {
            const base = headBindEuler || { x: 0, y: 0, z: 0 };
            headBone.setLocalEulerAngles(
                base.x + currentHeadRot.x,
                base.y + currentHeadRot.y,
                base.z + currentHeadRot.z
            );
            if (neckBone && typeof neckBone.setLocalEulerAngles === 'function') {
                const nBase = neckBindEuler || { x: 0, y: 0, z: 0 };
                neckBone.setLocalEulerAngles(
                    nBase.x + currentHeadRot.x * 0.35,
                    nBase.y + currentHeadRot.y * 0.35,
                    nBase.z + currentHeadRot.z * 0.35
                );
            }
        } else if (typeof selected.setEulerAngles === 'function') {
            const base = selected._baseRot || { x: 0, y: 0, z: 0 };
            selected.setEulerAngles(
                base.x + currentHeadRot.x * 0.5,
                base.y + currentHeadRot.y * 0.5,
                base.z + currentHeadRot.z * 0.5
            );
        }
    }

    function onFaceMeshResults(results) {
        if (!faceTrackingActive) return;

        const landmarks = results && results.multiFaceLandmarks && results.multiFaceLandmarks[0];
        if (!landmarks) {
            return;
        }

        const KalidoKitRef = (typeof window.Kalidokit !== 'undefined')
            ? window.Kalidokit
            : ((typeof window.KalidoKit !== 'undefined') ? window.KalidoKit : null);

        if (KalidoKitRef && KalidoKitRef.Face && typeof KalidoKitRef.Face.solve === 'function') {
            try {
                const solved = KalidoKitRef.Face.solve(landmarks, {
                    runtime: 'mediapipe',
                    video: videoElement,
                    imageSize: {
                        width: (videoElement && videoElement.videoWidth) || 320,
                        height: (videoElement && videoElement.videoHeight) || 240
                    },
                    smoothBlink: true
                });

                if (solved && solved.head) {
                    const radToDeg = 180 / Math.PI;
                    const pitch = (solved.head.x || 0) * radToDeg * 0.7;
                    const yaw = (solved.head.y || 0) * radToDeg * 0.7;
                    const roll = (solved.head.z || 0) * radToDeg * 0.5;
                    targetHeadRot = {
                        x: Math.max(-35, Math.min(35, pitch)),
                        y: Math.max(-45, Math.min(45, yaw)),
                        z: Math.max(-30, Math.min(30, roll))
                    };
                }

                const selected = getFaceSelected();
                if (solved && solved.eye && selected && selected._morphInstance && Array.isArray(selected._morphNames)) {
                    const blinkVal = Math.max(0, Math.min(1, 1 - Math.min(solved.eye.l || 1, solved.eye.r || 1)));
                    selected._morphNames.forEach((name, idx) => {
                        const lower = String(name || '').toLowerCase();
                        if (lower.includes('blink') || lower.includes('eye_close') || lower.includes('eyeclose')) {
                            try {
                                if (typeof selected._morphInstance.setWeight === 'function') {
                                    selected._morphInstance.setWeight(idx, blinkVal);
                                }
                            } catch (e) {}
                        }
                    });
                }
            } catch (e) {}
        } else {
            const noseTip = landmarks[1] || landmarks[4];
            if (noseTip) {
                const yaw = (0.5 - noseTip.x) * 60;
                const pitch = (noseTip.y - 0.5) * 45;
                targetHeadRot = {
                    x: Math.max(-30, Math.min(30, pitch)),
                    y: Math.max(-40, Math.min(40, yaw)),
                    z: 0
                };
            }
        }

        applyFaceHeadRotation();
    }

    async function processVideoFrameLoop() {
        if (!faceTrackingActive) return;

        if (videoElement && faceMeshInstance && !isProcessingFrame && videoElement.readyState >= 2) {
            isProcessingFrame = true;
            try {
                await faceMeshInstance.send({ image: videoElement });
            } catch (e) {
            } finally {
                isProcessingFrame = false;
            }
        }

        animFrameId = requestAnimationFrame(processVideoFrameLoop);
    }

    async function startFaceTracking() {
        if (faceTrackingActive) return;

        const selected = getFaceSelected();
        if (!selected) {
            alert("Pilih karakter/model VRM/GLB dulu sebelum mengaktifkan Face Tracking!");
            return;
        }

        if (typeof window.FaceMesh === 'undefined') {
            alert("MediaPipe FaceMesh tidak tersedia di perangkat ini.");
            logFace("⚠ FaceMesh undefined");
            return;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            alert("Kamera tidak didukung di WebView/browser ini.");
            return;
        }

        try {
            setFaceStatus("📷 Membuka kamera depan...");
            logFace("📷 Requesting front camera...");

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                },
                audio: false
            });

            videoElement = document.createElement('video');
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('autoplay', '');
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.srcObject = cameraStream;
            await videoElement.play();

            findHeadAndNeckBones(selected);

            if (!faceMeshInstance) {
                faceMeshInstance = new window.FaceMesh({
                    locateFile: (file) => 'js/' + file
                });
                faceMeshInstance.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                faceMeshInstance.onResults(onFaceMeshResults);
            }

            faceTrackingActive = true;
            updateFaceButtonsState(true);
            setFaceStatus("📷 Face Tracking aktif — hadapkan wajah ke kamera");
            logFace("✅ Face tracking started");

            animFrameId = requestAnimationFrame(processVideoFrameLoop);
        } catch (err) {
            logFace("❌ Face tracking start error: " + err.message);
            stopFaceTracking();
            alert("Gagal mengaktifkan kamera Face Tracking:\n" + err.message);
        }
    }

    function stopFaceTracking() {
        faceTrackingActive = false;
        isProcessingFrame = false;

        if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        if (cameraStream) {
            try {
                cameraStream.getTracks().forEach(track => {
                    try { track.stop(); } catch (e) {}
                });
            } catch (e) {}
            cameraStream = null;
        }

        if (videoElement) {
            try {
                videoElement.pause();
                videoElement.srcObject = null;
                if (typeof videoElement.remove === 'function') videoElement.remove();
            } catch (e) {}
            videoElement = null;
        }

        targetHeadRot = { x: 0, y: 0, z: 0 };
        currentHeadRot = { x: 0, y: 0, z: 0 };

        if (headBone && headBindEuler && typeof headBone.setLocalEulerAngles === 'function') {
            try { headBone.setLocalEulerAngles(headBindEuler.x, headBindEuler.y, headBindEuler.z); } catch (e) {}
        }
        if (neckBone && neckBindEuler && typeof neckBone.setLocalEulerAngles === 'function') {
            try { neckBone.setLocalEulerAngles(neckBindEuler.x, neckBindEuler.y, neckBindEuler.z); } catch (e) {}
        }

        headBone = null;
        neckBone = null;
        headBindEuler = null;
        neckBindEuler = null;

        updateFaceButtonsState(false);
        setFaceStatus("📷 Face Tracking dimatikan");
        logFace("⏹ Face tracking stopped");
    }

    function toggleFaceTracking() {
        if (faceTrackingActive) {
            stopFaceTracking();
        } else {
            startFaceTracking();
        }
    }

    const btnTop = byId('btnFaceTrack');
    if (btnTop) btnTop.onclick = toggleFaceTracking;

    const btnPanel = byId('btnFaceTrackToggle');
    if (btnPanel) btnPanel.onclick = toggleFaceTracking;

    window.addEventListener('beforeunload', () => {
        if (faceTrackingActive) stopFaceTracking();
    });

    window.FaceTracking = {
        start: startFaceTracking,
        stop: stopFaceTracking,
        toggle: toggleFaceTracking,
        isActive: () => faceTrackingActive
    };

    logFace("✅ face.js loaded");
})();
