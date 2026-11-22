/* ===== VTuber Forge — js/anatomy/selection_sphere.js ===== */
// Bola penanda saat kotak kecil anatomi di-tap + interaksi sentuh (tap, drag, hysteresis, camera lock)

(function () {
    'use strict';

    const TOUCH_SLOP_PX = 8;
    const SPHERE_HIT_RADIUS_PX = 44;

    let sphereEntity = null;
    let ringEntity = null;
    let sphereMat = null;
    let ringMat = null;

    let enabled = false;
    let activePartId = null;
    let activeWorldPos = null;
    let dragMode = 'rotate'; // 'rotate' | 'translate'

    let pointerDown = false;
    let armedForSphereDrag = false;
    let isDraggingSphere = false;
    let activePointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let cameraLockSaved = null;

    function getPcAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function getActiveCameraEntity() {
        const pcApp = getPcAppSafe();
        if (!pcApp || !pcApp.root) return null;
        return pcApp.root.findByName('camera') || null;
    }

    function ensureSphereVisuals() {
        const pcApp = getPcAppSafe();
        if (!pcApp || !pcApp.root) return null;

        if (!sphereMat) {
            sphereMat = new pc.StandardMaterial();
            sphereMat.diffuse = new pc.Color(0.15, 0.55, 0.95);
            sphereMat.emissive = new pc.Color(0.25, 0.80, 1.0);
            sphereMat.opacity = 0.42;
            sphereMat.blendType = pc.BLEND_NORMAL;
            sphereMat.useLighting = false;
            sphereMat.depthTest = false;
            sphereMat.depthWrite = false;
            sphereMat.update();
        }

        if (!ringMat) {
            ringMat = new pc.StandardMaterial();
            ringMat.diffuse = new pc.Color(0.95, 0.85, 0.2);
            ringMat.emissive = new pc.Color(1.0, 0.90, 0.35);
            ringMat.useLighting = false;
            ringMat.depthTest = false;
            ringMat.depthWrite = false;
            ringMat.update();
        }

        if (!sphereEntity) {
            sphereEntity = new pc.Entity('vtf_anatomy_selection_sphere');
            sphereEntity.addComponent('render', {
                type: 'sphere',
                material: sphereMat,
                castShadows: false,
                receiveShadows: false
            });
            sphereEntity.enabled = false;
            pcApp.root.addChild(sphereEntity);

            ringEntity = new pc.Entity('vtf_anatomy_selection_ring');
            ringEntity.addComponent('render', {
                type: 'cylinder',
                material: ringMat,
                castShadows: false,
                receiveShadows: false
            });
            ringEntity.setLocalScale(1.18, 0.04, 1.18);
            sphereEntity.addChild(ringEntity);
        }

        return sphereEntity;
    }

    function setCameraOrbitLocked(locked) {
        const camEnt = getActiveCameraEntity();

        if (locked) {
            window.__vtfAnatomyDragging = true;
            if (cameraLockSaved === null) {
                cameraLockSaved = {
                    camEnabled: camEnt ? !!camEnt.enabled : true
                };
            }
            if (camEnt) {
                camEnt._orbitLocked = true;
            }
            if (window.CameraControls) {
                if (typeof window.CameraControls.clearGesture === 'function') {
                    window.CameraControls.clearGesture();
                } else {
                    window.CameraControls._dragging = false;
                    window.CameraControls._panning = false;
                    window.CameraControls._pinchDist = 0;
                    window.CameraControls._pinchMid = null;
                }
            }
        } else {
            window.__vtfAnatomyDragging = false;
            if (camEnt && camEnt._orbitLocked !== undefined) {
                try { delete camEnt._orbitLocked; } catch (e) { camEnt._orbitLocked = false; }
            }
            cameraLockSaved = null;
        }
    }

    function updateSphereTransform(modelScale) {
        if (!sphereEntity || !enabled || !activePartId || !activeWorldPos) {
            if (sphereEntity) sphereEntity.enabled = false;
            return;
        }
        const s = Math.max(0.09, Math.min(0.45, (modelScale || 1.5) * 0.11));
        sphereEntity.setPosition(activeWorldPos.x, activeWorldPos.y, activeWorldPos.z);
        sphereEntity.setLocalScale(s, s, s);
        if (ringEntity) {
            ringEntity.rotate(0, 1.5, 0);
        }
        sphereEntity.enabled = true;
    }

    function selectPartWithSphere(partId, worldPos, modelScale) {
        activePartId = partId || null;
        if (!activePartId || !worldPos) {
            activePartId = null;
            activeWorldPos = null;
            if (sphereEntity) sphereEntity.enabled = false;
            return;
        }
        activeWorldPos = worldPos.clone();
        ensureSphereVisuals();
        updateSphereTransform(modelScale);
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.setSelectedPart(activePartId);
        }
        if (typeof window.__vtfOnAnatomyPartSelected === 'function') {
            window.__vtfOnAnatomyPartSelected(activePartId, dragMode);
        }
    }

    function isHitOnActiveSphere(clientX, clientY) {
        if (!sphereEntity || !sphereEntity.enabled || !activeWorldPos) return false;
        const camEnt = getActiveCameraEntity();
        const canvas = document.getElementById('gl');
        if (!camEnt || !camEnt.camera || !canvas) return false;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const screenPos = new pc.Vec3();
        camEnt.camera.worldToScreen(activeWorldPos, screenPos);
        if (screenPos.z < 0) return false;

        const dist = Math.hypot(screenPos.x - x, screenPos.y - y);
        return dist <= SPHERE_HIT_RADIUS_PX;
    }

    function resetPointerState(unlockCam) {
        pointerDown = false;
        armedForSphereDrag = false;
        isDraggingSphere = false;
        activePointerId = null;
        if (unlockCam) {
            setCameraOrbitLocked(false);
        }
    }

    function onPointerDown(e) {
        if (!enabled) return;
        if (e.target && typeof e.target.closest === 'function') {
            if (e.target.closest('.panel, .top, #gpuSettingsModal, #debugOverlay, #anatomyFloatingHud, button, input, select')) {
                return;
            }
        }
        const canvas = document.getElementById('gl');
        if (!canvas || e.target !== canvas) return;

        pointerDown = true;
        armedForSphereDrag = false;
        isDraggingSphere = false;
        activePointerId = (typeof e.pointerId === 'number') ? e.pointerId : null;
        startClientX = e.clientX;
        startClientY = e.clientY;
        lastClientX = e.clientX;
        lastClientY = e.clientY;

        if (activePartId && isHitOnActiveSphere(e.clientX, e.clientY)) {
            armedForSphereDrag = true;
            setCameraOrbitLocked(true);
        }
    }

    function onPointerMove(e) {
        if (!enabled || !pointerDown) return;
        if (activePointerId !== null && typeof e.pointerId === 'number' && e.pointerId !== activePointerId) {
            return;
        }

        const dx = e.clientX - lastClientX;
        const dy = e.clientY - lastClientY;
        const totalMove = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);

        if (!isDraggingSphere && activePartId) {
            const hitSphere = armedForSphereDrag || isHitOnActiveSphere(startClientX, startClientY);
            if (hitSphere && totalMove >= TOUCH_SLOP_PX) {
                isDraggingSphere = true;
                setCameraOrbitLocked(true);
                if (typeof window.__vtfOnAnatomyDragStart === 'function') {
                    window.__vtfOnAnatomyDragStart(activePartId, dragMode);
                }
            }
        }

        if (isDraggingSphere && activePartId) {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const camEnt = getActiveCameraEntity();
            if (typeof window.__vtfOnAnatomyDragMove === 'function') {
                window.__vtfOnAnatomyDragMove(activePartId, dragMode, dx, dy, camEnt);
            }
        }

        lastClientX = e.clientX;
        lastClientY = e.clientY;
    }

    function onPointerUp(e) {
        if (!pointerDown) return;
        if (activePointerId !== null && e && typeof e.pointerId === 'number' && e.pointerId !== activePointerId) {
            return;
        }

        const endX = (e && typeof e.clientX === 'number') ? e.clientX : lastClientX;
        const endY = (e && typeof e.clientY === 'number') ? e.clientY : lastClientY;
        const totalMove = Math.hypot(endX - startClientX, endY - startClientY);
        const wasDragging = isDraggingSphere;
        const isCancel = !!(e && e.type === 'pointercancel');

        resetPointerState(true);

        if (!enabled) return;

        if (wasDragging) {
            if (typeof window.__vtfOnAnatomyDragEnd === 'function') {
                window.__vtfOnAnatomyDragEnd(activePartId, dragMode);
            }
            return;
        }

        if (!isCancel && totalMove < TOUCH_SLOP_PX && window.AnatomyAnchorBoxes) {
            const hitPartId = window.AnatomyAnchorBoxes.hitTestScreenPoint(endX, endY, 36);
            if (hitPartId && typeof window.__vtfOnAnatomyBoxTapped === 'function') {
                window.__vtfOnAnatomyBoxTapped(hitPartId);
            }
        }
    }

    function onWindowBlur() {
        resetPointerState(true);
    }

    function bindInputListeners() {
        if (window.__vtfAnatomySphereBound) return;
        window.__vtfAnatomySphereBound = true;
        window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
        window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
        window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false });
        window.addEventListener('pointercancel', onPointerUp, { capture: true, passive: false });
        window.addEventListener('blur', onWindowBlur);
    }

    function setEnabled(flag) {
        enabled = !!flag;
        if (enabled) {
            bindInputListeners();
            ensureSphereVisuals();
            if (activePartId && activeWorldPos && sphereEntity) {
                sphereEntity.enabled = true;
            }
        } else {
            resetPointerState(true);
            if (sphereEntity) sphereEntity.enabled = false;
        }
    }

    function setDragMode(mode) {
        dragMode = (mode === 'translate') ? 'translate' : 'rotate';
        if (typeof window.__vtfOnAnatomyModeChanged === 'function') {
            window.__vtfOnAnatomyModeChanged(dragMode);
        }
    }

    function destroyAll() {
        resetPointerState(true);
        activePartId = null;
        activeWorldPos = null;
        if (ringEntity) {
            try { ringEntity.destroy(); } catch (e) {}
            ringEntity = null;
        }
        if (sphereEntity) {
            try { sphereEntity.destroy(); } catch (e) {}
            sphereEntity = null;
        }
        if (sphereMat) {
            try { sphereMat.destroy(); } catch (e) {}
            sphereMat = null;
        }
        if (ringMat) {
            try { ringMat.destroy(); } catch (e) {}
            ringMat = null;
        }
    }

    window.AnatomySelectionSphere = {
        setEnabled: setEnabled,
        isEnabled: function () { return enabled; },
        setDragMode: setDragMode,
        getDragMode: function () { return dragMode; },
        selectPart: selectPartWithSphere,
        updateWorldPosition: function (worldPos, modelScale) {
            if (!worldPos) return;
            activeWorldPos = worldPos.clone();
            updateSphereTransform(modelScale);
        },
        getSelectedPart: function () { return activePartId; },
        clearSelection: function () {
            selectPartWithSphere(null, null, 1.5);
        },
        destroyAll: destroyAll
    };
})();
