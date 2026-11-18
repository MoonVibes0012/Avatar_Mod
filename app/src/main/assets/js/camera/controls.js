/* ===== VTuber Forge — camera.js ===== */

const tempVec = new pc.Vec3();
let targetYaw = 0, targetPitch = -15, targetDist = 6, currentYaw = 0, currentPitch = -15, currentDist = 6;
let targetPivotPos = new pc.Vec3(0, 1, 0), currentPivotPos = new pc.Vec3(0, 1, 0);

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

window.zoomIn = function() { targetDist = Math.max(2, targetDist - 2); };
window.zoomOut = function() { targetDist = Math.min(150, targetDist + 2); };

let time = 0;
app.on('update', (dt) => {
    updateCamera(dt); time = (time + dt) % 1000;
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

let isDragging = false, prevX = 0, prevY = 0, tapStartTime = 0, tapStartX = 0, tapStartY = 0, initialPinchDist = 0, initialTargetDist = 6, wasPinching = false;
const invMat = new pc.Mat4(), localRay = new pc.Ray(), intersection = new pc.Vec3();

window.resetCameraGesture = function() {
    isDragging = false;
    initialPinchDist = 0;
    wasPinching = false;
};

function doRaycast(x, y) {
    if (!isAppReady) return;
    const rect = canvas.getBoundingClientRect();
    const tapX = x - rect.left;
    const tapY = y - rect.top;
    const start = camera.camera.screenToWorld(tapX, tapY, camera.camera.nearClip);
    const end = camera.camera.screenToWorld(tapX, tapY, camera.camera.farClip);
    const ray = new pc.Ray(start, end.sub(start).normalize());
    let hit = null, minDist = Infinity;

    S.objects.forEach(obj => {
        const render = obj.findComponent('render');
        if (!render || !render.meshInstances) return;
        render.meshInstances.forEach(mi => {
            if (!mi.mesh) return;
            if (!mi.aabb || isNaN(mi.aabb.center.x)) {
                try { mi.aabb = pc.BoundingBox.fromMesh(mi.mesh); } catch(e) { return; }
            }
            invMat.copy(obj.getWorldTransform());
            invMat.invert();
            invMat.transformPoint(ray.origin, localRay.origin);
            invMat.transformVector(ray.direction, localRay.direction);
            localRay.direction.normalize();
            if (mi.aabb.intersectsRay(localRay, intersection)) {
                obj.getWorldTransform().transformPoint(intersection, intersection);
                const dist = start.distance(intersection);
                if (dist < minDist) { minDist = dist; hit = obj; }
            }
        });
    });

    if (!hit) {
        let minScreenDist = CONFIG.TAP_THRESHOLD;
        S.objects.forEach(obj => {
            const mi = obj.findComponent('render')?.meshInstances[0];
            let centerPos = obj.getPosition();
            if (mi && mi.aabb) {
                obj.getWorldTransform().transformPoint(mi.aabb.center, tempVec);
                centerPos = tempVec;
            }
            const screenPos = camera.camera.worldToScreen(centerPos);
            const d = Math.hypot(screenPos.x - tapX, screenPos.y - tapY);
            if (d < minScreenDist) { minScreenDist = d; hit = obj; }
        });
    }
    if (hit) {
        selectObject(hit);
        $('status').textContent = "Terpilih: " + hit.name;
    } else {
        selectObject(null);
    }
}

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevX = e.clientX; prevY = e.clientY;
    tapStartTime = performance.now();
    tapStartX = e.clientX; tapStartY = e.clientY;
});

window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        if (performance.now() - tapStartTime < 500 && Math.hypot(e.clientX - tapStartX, e.clientY - tapStartY) < 30) {
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

let EDGE_DEAD_ZONE = window.innerWidth > 400 ? 18 : 14;
window.addEventListener('resize', () => {
    EDGE_DEAD_ZONE = window.innerWidth > 400 ? 18 : 14;
});

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 2) return;
    if (e.touches[0].radiusX && e.touches[0].radiusX > 40) return;
    if (e.touches[0].clientX < EDGE_DEAD_ZONE || e.touches[0].clientX > window.innerWidth - EDGE_DEAD_ZONE) return;

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
        initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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
        const currentPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (currentPinchDist > 0) {
            targetDist = Math.max(2, Math.min(150, initialTargetDist * (initialPinchDist / currentPinchDist)));
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.stopPropagation();
    if (!wasPinching && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        if (performance.now() - tapStartTime < 500 && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 30) {
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
