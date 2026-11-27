/* ===== VTuber Forge — js/anatomy/anatomy_solver.js ===== */
// Kalkulasi gerakan anatomi dari seretan bola penanda, batas kinematika, simetri, & damping ringan
// Hanya menggerakkan tulang nyata (tidak memutar root model palsu bila rig tidak terpetakan)

(function () {
    'use strict';

    let currentRecord = null;
    let selectedPartId = null;
    let mirrorEnabled = false;
    let smoothing = 0.65;
    let pendingTargetEuler = null;
    let pendingTargetPos = null;
    let frameTimer = null;

    function setSolverStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    function isFaceTrackingActive() {
        if (window.__vtfFaceTrackingActive || window.faceTrackingRunning) return true;
        if (window.FaceTracking && typeof window.FaceTracking.isActive === 'function') {
            try { return !!window.FaceTracking.isActive(); } catch (e) {}
        }
        return false;
    }

    function setRecord(record) {
        currentRecord = record || null;
        selectedPartId = null;
        pendingTargetEuler = null;
        pendingTargetPos = null;
        if (frameTimer !== null) {
            cancelAnimationFrame(frameTimer);
            frameTimer = null;
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.setTargetRecord(currentRecord);
        }
        if (window.AnatomySelectionSphere) {
            window.AnatomySelectionSphere.clearSelection();
        }
        if (currentRecord && !currentRecord.isRigged) {
            setSolverStatus('⚠ ' + (currentRecord.unavailableReason || 'Pose tulang tidak tersedia pada model ini.'));
        }
    }

    function selectPart(partId) {
        if (!currentRecord || !currentRecord.isRigged) {
            selectedPartId = null;
            pendingTargetEuler = null;
            pendingTargetPos = null;
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.clearSelection();
            }
            if (currentRecord && currentRecord.unavailableReason) {
                setSolverStatus('⚠ ' + currentRecord.unavailableReason);
            }
            return;
        }
        if (!currentRecord.parts || !currentRecord.parts[partId]) {
            selectedPartId = null;
            pendingTargetEuler = null;
            pendingTargetPos = null;
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.clearSelection();
            }
            return;
        }
        selectedPartId = partId;
        const partObj = currentRecord.parts[partId];
        pendingTargetEuler = partObj.offsetEuler.clone();
        pendingTargetPos = partObj.offsetPos.clone();

        const wPos = (partObj.entity && typeof partObj.entity.getPosition === 'function')
            ? partObj.entity.getPosition()
            : null;
        if (wPos && window.AnatomySelectionSphere) {
            window.AnatomySelectionSphere.selectPart(partId, wPos, currentRecord.modelScale);
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.setSelectedPart(partId);
            window.AnatomyAnchorBoxes.syncBoxes(true);
        }
    }

    function applyPoseToPartEntry(partId, partEntry) {
        if (!partEntry || !partEntry.entity || !partEntry.rest || partEntry.isFallback) return;
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;

        if (window.AnatomyRegistry) {
            window.AnatomyRegistry.clampEulerDelta(partId, partEntry.offsetEuler);
        }

        const maxPos = (def && def.limits && def.limits.pos) ? def.limits.pos : 0.25;
        partEntry.offsetPos.x = Math.max(-maxPos, Math.min(maxPos, partEntry.offsetPos.x));
        partEntry.offsetPos.y = Math.max(-maxPos, Math.min(maxPos, partEntry.offsetPos.y));
        partEntry.offsetPos.z = Math.max(-maxPos, Math.min(maxPos, partEntry.offsetPos.z));

        const r = partEntry.rest;
        const rotScale = (isFaceTrackingActive() && (partId === 'head' || partId === 'neck')) ? 0.5 : 1.0;

        if (typeof partEntry.entity.setLocalEulerAngles === 'function') {
            partEntry.entity.setLocalEulerAngles(
                r.rot[0] + partEntry.offsetEuler.x * rotScale,
                r.rot[1] + partEntry.offsetEuler.y * rotScale,
                r.rot[2] + partEntry.offsetEuler.z * rotScale
            );
        }

        if (def && def.mode === 'hybrid' && typeof partEntry.entity.setLocalPosition === 'function') {
            partEntry.entity.setLocalPosition(
                r.pos[0] + partEntry.offsetPos.x,
                r.pos[1] + partEntry.offsetPos.y,
                r.pos[2] + partEntry.offsetPos.z
            );
        }
    }

    function applyMirrorSymmetry(partId, sourceEntry) {
        if (!mirrorEnabled || !currentRecord || !currentRecord.parts || !window.AnatomyRegistry) return;
        const def = window.AnatomyRegistry.getPartDef(partId);
        if (!def || !def.mirror) return;
        const mirrorEntry = currentRecord.parts[def.mirror];
        if (!mirrorEntry || mirrorEntry.isFallback) return;

        mirrorEntry.offsetEuler.set(
            sourceEntry.offsetEuler.x,
            -sourceEntry.offsetEuler.y,
            -sourceEntry.offsetEuler.z
        );
        mirrorEntry.offsetPos.set(
            -sourceEntry.offsetPos.x,
            sourceEntry.offsetPos.y,
            sourceEntry.offsetPos.z
        );
        applyPoseToPartEntry(def.mirror, mirrorEntry);
    }

    function stepSmoothing() {
        if (!currentRecord || !currentRecord.isRigged || !selectedPartId || !currentRecord.parts || !currentRecord.parts[selectedPartId]) {
            frameTimer = null;
            return;
        }
        const entry = currentRecord.parts[selectedPartId];
        const alpha = Math.max(0.25, Math.min(1.0, smoothing));

        if (pendingTargetEuler) {
            entry.offsetEuler.x += (pendingTargetEuler.x - entry.offsetEuler.x) * alpha;
            entry.offsetEuler.y += (pendingTargetEuler.y - entry.offsetEuler.y) * alpha;
            entry.offsetEuler.z += (pendingTargetEuler.z - entry.offsetEuler.z) * alpha;
        }
        if (pendingTargetPos) {
            entry.offsetPos.x += (pendingTargetPos.x - entry.offsetPos.x) * alpha;
            entry.offsetPos.y += (pendingTargetPos.y - entry.offsetPos.y) * alpha;
            entry.offsetPos.z += (pendingTargetPos.z - entry.offsetPos.z) * alpha;
        }

        applyPoseToPartEntry(selectedPartId, entry);
        applyMirrorSymmetry(selectedPartId, entry);

        const wPos = (entry.entity && typeof entry.entity.getPosition === 'function')
            ? entry.entity.getPosition()
            : null;
        if (wPos && window.AnatomySelectionSphere) {
            window.AnatomySelectionSphere.updateWorldPosition(wPos, currentRecord.modelScale);
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(true);
        }

        const stillMoving =
            (pendingTargetEuler && (
                Math.abs(pendingTargetEuler.x - entry.offsetEuler.x) > 0.05 ||
                Math.abs(pendingTargetEuler.y - entry.offsetEuler.y) > 0.05 ||
                Math.abs(pendingTargetEuler.z - entry.offsetEuler.z) > 0.05
            )) ||
            (pendingTargetPos && (
                Math.abs(pendingTargetPos.x - entry.offsetPos.x) > 0.0005 ||
                Math.abs(pendingTargetPos.y - entry.offsetPos.y) > 0.0005 ||
                Math.abs(pendingTargetPos.z - entry.offsetPos.z) > 0.0005
            ));

        if (stillMoving || window.__vtfAnatomyDragging) {
            frameTimer = requestAnimationFrame(stepSmoothing);
        } else {
            frameTimer = null;
        }
    }

    function handleDragMove(partId, mode, dx, dy, camEntity) {
        if (!currentRecord || !currentRecord.isRigged) {
            if (currentRecord && currentRecord.unavailableReason) {
                setSolverStatus('⚠ ' + currentRecord.unavailableReason);
            }
            return;
        }
        if (!currentRecord.parts || !currentRecord.parts[partId]) return;
        if (selectedPartId !== partId) selectPart(partId);

        const entry = currentRecord.parts[partId];
        if (!pendingTargetEuler) pendingTargetEuler = entry.offsetEuler.clone();
        if (!pendingTargetPos) pendingTargetPos = entry.offsetPos.clone();

        const rotSpeed = 0.55;
        if (mode === 'translate') {
            const moveScale = 0.0025 * Math.max(0.5, currentRecord.modelScale || 1.5);
            let rightX = 1, rightY = 0, upX = 0, upY = 1;
            if (camEntity && typeof camEntity.getWorldTransform === 'function') {
                const wt = camEntity.getWorldTransform();
                const r = wt.getX();
                const u = wt.getY();
                if (r && u) {
                    rightX = r.x;
                    rightY = r.y;
                    upX = u.x;
                    upY = u.y;
                }
            }
            const worldDeltaX = (dx * rightX - dy * upX) * moveScale;
            const worldDeltaY = (dx * rightY - dy * upY) * moveScale;
            const worldDeltaZ = (-dy * 0.5) * moveScale;

            pendingTargetPos.x += worldDeltaX;
            pendingTargetPos.y += worldDeltaY;
            pendingTargetPos.z += worldDeltaZ;
        } else {
            pendingTargetEuler.y += dx * rotSpeed;
            pendingTargetEuler.x += dy * rotSpeed;
            pendingTargetEuler.z += (dx * 0.25) * rotSpeed;
            if (window.AnatomyRegistry) {
                window.AnatomyRegistry.clampEulerDelta(partId, pendingTargetEuler);
            }
        }

        if (frameTimer === null) {
            frameTimer = requestAnimationFrame(stepSmoothing);
        }
    }

    function resetSelectedPart() {
        if (!currentRecord || !selectedPartId || !window.VrmPartExtractor) return;
        window.VrmPartExtractor.resetPartPose(currentRecord, selectedPartId);
        const entry = currentRecord.parts[selectedPartId];
        if (entry) {
            pendingTargetEuler = entry.offsetEuler.clone();
            pendingTargetPos = entry.offsetPos.clone();
            if (window.AnatomySelectionSphere && entry.entity && typeof entry.entity.getPosition === 'function') {
                window.AnatomySelectionSphere.updateWorldPosition(entry.entity.getPosition(), currentRecord.modelScale);
            }
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(true);
        }
    }

    function resetAllParts() {
        if (!currentRecord || !window.VrmPartExtractor) return;
        window.VrmPartExtractor.resetAllPoses(currentRecord);
        if (selectedPartId && currentRecord.parts[selectedPartId]) {
            const entry = currentRecord.parts[selectedPartId];
            pendingTargetEuler = entry.offsetEuler.clone();
            pendingTargetPos = entry.offsetPos.clone();
            if (window.AnatomySelectionSphere && entry.entity && typeof entry.entity.getPosition === 'function') {
                window.AnatomySelectionSphere.updateWorldPosition(entry.entity.getPosition(), currentRecord.modelScale);
            }
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(true);
        }
    }

    function exportPoseSnapshot() {
        if (!currentRecord || !currentRecord.parts) return {};
        const snap = {};
        const ids = Object.keys(currentRecord.parts);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const p = currentRecord.parts[id];
            if (!p || p.isFallback) continue;
            snap[id] = {
                rx: Number(p.offsetEuler.x.toFixed(3)),
                ry: Number(p.offsetEuler.y.toFixed(3)),
                rz: Number(p.offsetEuler.z.toFixed(3)),
                px: Number(p.offsetPos.x.toFixed(4)),
                py: Number(p.offsetPos.y.toFixed(4)),
                pz: Number(p.offsetPos.z.toFixed(4))
            };
        }
        return snap;
    }

    function importPoseSnapshot(snap) {
        if (!currentRecord || !currentRecord.isRigged || !currentRecord.parts || !snap || typeof snap !== 'object') return;
        const ids = Object.keys(snap);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const p = currentRecord.parts[id];
            const item = snap[id];
            if (!p || !item || p.isFallback) continue;
            p.offsetEuler.set(Number(item.rx) || 0, Number(item.ry) || 0, Number(item.rz) || 0);
            p.offsetPos.set(Number(item.px) || 0, Number(item.py) || 0, Number(item.pz) || 0);
            applyPoseToPartEntry(id, p);
        }
        if (selectedPartId && currentRecord.parts[selectedPartId]) {
            const selP = currentRecord.parts[selectedPartId];
            pendingTargetEuler = selP.offsetEuler.clone();
            pendingTargetPos = selP.offsetPos.clone();
            if (window.AnatomySelectionSphere && selP.entity && typeof selP.entity.getPosition === 'function') {
                window.AnatomySelectionSphere.updateWorldPosition(selP.entity.getPosition(), currentRecord.modelScale);
            }
        }
        if (window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(true);
        }
    }

    window.AnatomySolver = {
        setRecord: setRecord,
        getRecord: function () { return currentRecord; },
        selectPart: selectPart,
        getSelectedPart: function () { return selectedPartId; },
        handleDragMove: handleDragMove,
        resetSelectedPart: resetSelectedPart,
        resetAllParts: resetAllParts,
        setMirrorEnabled: function (flag) { mirrorEnabled = !!flag; },
        isMirrorEnabled: function () { return mirrorEnabled; },
        setSmoothing: function (val) { smoothing = Math.max(0.2, Math.min(1.0, Number(val) || 0.65)); },
        exportPoseSnapshot: exportPoseSnapshot,
        importPoseSnapshot: importPoseSnapshot
    };
})();
