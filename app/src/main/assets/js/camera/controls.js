/* ===== VTuber Forge — js/camera/controls.js ===== */
// Camera orbit, zoom, raycast, dan touch gestures
// FIX: Lazy initialization untuk menghindari "pc is not defined" saat PlayCanvas belum load

// Declare variabel di global scope (akan di-init nanti)
let tempVec, targetYaw = 0, targetPitch = -15, targetDist = 6;
let currentYaw = 0, currentPitch = -15, currentDist = 6;
let targetPivotPos, currentPivotPos;
let isDragging = false, prevX = 0, prevY = 0;
let tapStartTime = 0, tapStartX = 0, tapStartY = 0;
let initialPinchDist = 0, initialTargetDist = 6, wasPinching = false;
let invMat, localRay, intersection;
let time = 0;
let EDGE_DEAD_ZONE = 18;
let controlsInitialized = false;

function initControls() {
    if (controlsInitialized) return;
    // Tunggu sampai pc, app, dan canvas tersedia
    if (typeof pc === 'undefined' || typeof app === 'undefined' || typeof canvas === 'undefined') {
        setTimeout(initControls, 100);
        return;
    }
    
    controlsInitialized = true;
    
    // Init variabel yang butuh pc
    tempVec = new pc.Vec3();
    targetPivotPos = new pc.Vec3(0, 1, 0);
    currentPivotPos = new pc.Vec3(0, 1, 0);
    invMat = new pc.Mat4();
    localRay = new pc.Ray();
    intersection = new pc.Vec3();
    EDGE_DEAD_ZONE = window.innerWidth > 400 ? 18 : 14;
    
    // Camera update loop
    app.on('update', (dt) => {
        updateCamera(dt);
        time = (time + dt) % 1000;
        S.objects.forEach(obj => {
            if (!obj || obj._destroyed) return;
            if (obj._animSpin) obj.rotate(0, 90 * dt, 0);
            if (obj._animPulse) {
                if (!obj._baseScale) obj._baseScale = obj.getLocalScale().clone();
                const sf = 1 + Math.sin(time * 4) * 0.05;
                obj.setLocalScale(obj._baseScale.x * sf, obj._baseScale.y * sf, obj._baseScale.z * sf);
            }
            if (obj._animWobble) {
                if (!obj._baseRot) obj._baseRot = obj.getEulerAngles().clone();
                obj.setEulerAngles(obj._baseRot.x, obj._baseRot.y, obj._baseRot.z + Math.sin(time * 5) * 10);
            }
        });
    });
    
    // Setup event listeners
    setupMouseEvents();
    setupTouchEvents();
    setupFocusButton();
    
    dbg("✅ controls.js loaded (with lazy init)");
}

function updateCamera(dt) {
    const safeDt = Math.min(typeof dt === 'number' && isFinite(dt) && dt > 0 ? dt : 1 / 60, 0.05);
    const alpha = 1 - Math.exp(-10 * safeDt);
    currentYaw = pc.math.lerp(currentYaw, targetYaw, alpha);
    currentPitch = pc.math.lerp(currentPitch, targetPitch, alpha);
    currentDist = pc.math.lerp(currentDist, targetDist, alpha);
    currentPivotPos.lerp(currentPivotPos, targetPivotPos, alpha);
    pivot.setPosition(currentPivotPos);
    pivot.setLocalEulerAngles(currentPitch, currentYaw, 0);
    camera.setLocalPosition(0, 1.5, currentDist);
}

function setupMouseEvents() {
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        prevX = e.clientX; prevY = e.clientY;
        tapStartTime = performance.now();
        tapStartX = e.clientX; tapStartY = e.clientY;
    });
    
    window.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            if (performance.now() - tapStartTime < 500 &&
                Math.hypot(e.clientX - tapStartX, e.clientY - tapStartY) < 30) {
                doRaycast(e.clientX, e.clientY);
            }
        }
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevX, dy = e.clientY - prevY;
        prevX = e.clientX; prevY = e.clientY;
        targetYaw -= dx * 0.5;
        targetPitch = Math.max(-80, Math.min(80, targetPitch - dy * 0.5));
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        targetDist += e.deltaY * 0.05;
        targetDist = Math.max(2, Math.min(150, targetDist));
    }, { passive: false });
}

function setupTouchEvents() {
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 2) return;
        if (e.touches[0].radiusX && e.touches[0].radiusX > 40) return;
        if (e.touches[0].clientX < EDGE_DEAD_ZONE ||
            e.touches[0].clientX > window.innerWidth - EDGE_DEAD_ZONE) return;
        e.stopPropagation(); e.preventDefault();
        
        if (e.touches.length === 1) {
            wasPinching = false;
            isDragging = true;
            prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
            tapStartTime = performance.now();
            tapStartX = e.touches[0].clientX; tapStartY = e.touches[0].clientY;
            initialPinchDist = 0;
        } else if (e.touches.length === 2) {
            wasPinching = true;
            isDragging = false;
            initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX, 
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialTargetDist = targetDist;
        }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length > 2) return;
        e.stopPropagation(); e.preventDefault();
        
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - prevX, dy = e.touches[0].clientY - prevY;
            prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
            targetYaw -= dx * 0.5;
            targetPitch = Math.max(-80, Math.min(80, targetPitch - dy * 0.5));
        } else if (e.touches.length === 2 && initialPinchDist > 0) {
            const currentPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX, 
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (currentPinchDist > 0) {
                targetDist = Math.max(2, Math.min(150, initialTargetDist * (initialPinchDist / currentPinchDist)));
            }
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        e.stopPropagation();
        if (!wasPinching && e.changedTouches.length === 1) {
            const t = e.changedTouches[0];
            if (performance.now() - tapStartTime < 500 &&
                Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 30) {
                doRaycast(t.clientX, t.clientY);
            }
        }
        isDragging = false;
        initialPinchDist = 0;
        if (e.touches.length === 0) {
            wasPinching = false;
        } else if (e.touches.length === 1 && !wasPinching) {
            isDragging = true;
            prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
            tapStartTime = performance.now();
            tapStartX = e.touches[0].clientX; tapStartY = e.touches[0].clientY;
        }
    });
    
    canvas.addEventListener('touchcancel', () => {
        window.resetCameraGesture();
    });
    
    window.addEventListener('resize', () => {
        EDGE_DEAD_ZONE = window.innerWidth > 400 ? 18 : 14;
    });
}

function setupFocusButton() {
    if ($('focusBtn')) {
        $('focusBtn').onclick = () => {
            if (!S.selected) return alert("Pilih objek dulu!");
            try {
                const mi = S.selected.findComponent('render')?.meshInstances[0];
                if (mi && mi.aabb) {
                    const wScale = S.selected.getWorldTransform().getScale();
                    const maxScale = Math.max(wScale.x, wScale.y, wScale.z);
                    const size = mi.aabb.halfExtents.length() * maxScale;
                    targetDist = Math.max(0.5, Math.min(150, size * 3.5));
                    const center = new pc.Vec3();
                    S.selected.getWorldTransform().transformPoint(mi.aabb.center, center);
                    targetPivotPos.set(center.x, center.y, center.z);
                    $('status').textContent = "Fokus ke mesh objek.";
                } else {
                    targetDist = 6;
                    const p = S.selected.getPosition();
                    targetPivotPos.set(p.x, p.y, p.z);
                    $('status').textContent = "Fokus ke posisi objek (mesh belum siap).";
                }
            } catch(e) {
                targetDist = 6;
                const p = S.selected.getPosition();
                targetPivotPos.set(p.x, p.y, p.z);
            }
        };
    }
}

function doRaycast(x, y) {
    if (!isAppReady || S.objects.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const tapX = x - rect.left;
    const tapY = y - rect.top;
    
    if (tapX < 0 || tapY < 0 || tapX > rect.width || tapY > rect.height) return;
    
    let hit = null;
    let minDist = Infinity;
    
    // Method 1: AABB Raycast
    try {
        const start = camera.camera.screenToWorld(tapX, tapY, camera.camera.nearClip);
        const end = camera.camera.screenToWorld(tapX, tapY, camera.camera.farClip);
        if (!start || !end) return;
        
        const dir = new pc.Vec3();
        dir.sub2(end, start).normalize();
        const ray = new pc.Ray(start, dir);
        
        for (const obj of S.objects) {
            if (!obj || obj._destroyed) continue;
            const render = obj.findComponent('render');
            if (!render || !render.meshInstances) continue;
            
            for (const mi of render.meshInstances) {
                if (!mi.mesh) continue;
                
                try {
                    if (!mi.aabb || isNaN(mi.aabb.center.x)) {
                        try { mi.aabb = pc.BoundingBox.fromMesh(mi.mesh); } catch(e) { continue; }
                    }
                    
                    const worldMat = obj.getWorldTransform();
                    invMat.copy(worldMat);
                    if (!invMat.invert()) continue;
                    if (isNaN(invMat.data[0])) continue;
                    
                    invMat.transformPoint(ray.origin, localRay.origin);
                    invMat.transformVector(ray.direction, localRay.direction);
                    localRay.direction.normalize();
                    
                    if (mi.aabb.intersectsRay(localRay, intersection)) {
                        worldMat.transformPoint(intersection, intersection);
                        const dist = start.distance(intersection);
                        if (dist < minDist && dist >= 0) {
                            minDist = dist;
                            hit = obj;
                        }
                    }
                } catch (meshErr) {
                    continue;
                }
            }
        }
    } catch (e) {
        // Method 1 failed, try fallback
    }
    
    // Method 2: Screen-space fallback
    if (!hit) {
        let minScreenDist = CONFIG.TAP_THRESHOLD;
        
        for (const obj of S.objects) {
            if (!obj || obj._destroyed) continue;
            try {
                const mi = obj.findComponent('render')?.meshInstances[0];
                let worldCenter = obj.getPosition().clone();
                
                if (mi && mi.aabb) {
                    const worldMat = obj.getWorldTransform();
                    worldCenter = new pc.Vec3();
                    worldMat.transformPoint(mi.aabb.center, worldCenter);
                }
                
                const screenPos = camera.camera.worldToScreen(worldCenter);
                if (!screenPos) continue;
                
                const d = Math.hypot(screenPos.x - tapX, screenPos.y - tapY);
                
                let threshold = CONFIG.TAP_THRESHOLD;
                if (mi && mi.aabb) {
                    const extent = mi.aabb.halfExtents.length();
                    const scale = obj.getWorldTransform().getScale();
                    const maxScale = Math.max(scale.x, scale.y, scale.z);
                    const worldSize = extent * maxScale;
                    
                    const distToCam = worldCenter.distance(camera.getPosition());
                    if (distToCam > 0.1) {
                        const fov = camera.camera.fov * Math.PI / 180;
                        const screenSize = (worldSize / (distToCam * Math.tan(fov / 2))) * rect.height * 0.5;
                        threshold = Math.max(30, Math.min(200, screenSize * 0.7));
                    }
                }
                
                if (d < threshold && d < minScreenDist) {
                    minScreenDist = d;
                    hit = obj;
                }
            } catch (objErr) {
                continue;
            }
        }
    }
    
    if (hit) {
        selectObject(hit);
        $('status').textContent = "✓ Terpilih: " + hit.name;
    } else {
        selectObject(null);
        $('status').textContent = "Tidak ada objek di posisi tap";
    }
}

// Expose functions to global scope
window.updateCamera = updateCamera;
window.zoomIn = function() { targetDist = Math.max(2, targetDist - 2); };
window.zoomOut = function() { targetDist = Math.min(150, targetDist + 2); };
window.resetCameraGesture = function() {
    isDragging = false;
    initialPinchDist = 0;
    wasPinching = false;
};

// Init
initControls();
