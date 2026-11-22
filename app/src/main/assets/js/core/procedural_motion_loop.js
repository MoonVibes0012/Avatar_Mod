/* ===== VTuber Forge — js/core/procedural_motion_loop.js ===== */
// Grid lantai, helper loading/undo-cache, & loop animasi prosedural (Spin, Pulse, Wobble)

(function () {
    'use strict';

    let animTime = 0;

    function logMotion(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function createGridFloor(pcApp) {
        if (!pcApp || !pcApp.root || typeof pc === 'undefined') return null;

        const gridEntity = new pc.Entity('GridFloor');
        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(0.14, 0.16, 0.22);
        mat.specular = new pc.Color(0.05, 0.05, 0.05);
        mat.gloss = 0.2;
        mat.update();

        gridEntity.addComponent('render', {
            type: 'box',
            material: mat,
            castShadows: false,
            receiveShadows: true
        });
        gridEntity.setLocalScale(20, 0.05, 20);
        gridEntity.setPosition(0, -0.025, 0);
        pcApp.root.addChild(gridEntity);

        const lineMat = new pc.StandardMaterial();
        lineMat.emissive = new pc.Color(0.22, 0.28, 0.38);
        lineMat.useLighting = false;
        lineMat.update();

        const half = 10;
        const step = 1;
        for (let i = -half; i <= half; i += step) {
            const lineX = new pc.Entity('GridLineX_' + i);
            lineX.addComponent('render', {
                type: 'box',
                material: lineMat,
                castShadows: false,
                receiveShadows: false
            });
            lineX.setLocalScale(0.015, 0.004, half * 2);
            lineX.setPosition(i, 0.002, 0);
            pcApp.root.addChild(lineX);

            const lineZ = new pc.Entity('GridLineZ_' + i);
            lineZ.addComponent('render', {
                type: 'box',
                material: lineMat,
                castShadows: false,
                receiveShadows: false
            });
            lineZ.setLocalScale(half * 2, 0.004, 0.015);
            lineZ.setPosition(0, 0.002, i);
            pcApp.root.addChild(lineZ);
        }

        return gridEntity;
    }

    function clearUndoStack() {
        try {
            if (Array.isArray(window.undoStack)) window.undoStack.length = 0;
            if (Array.isArray(window.redoStack)) window.redoStack.length = 0;
            if (Array.isArray(window.meshCachePool)) window.meshCachePool.length = 0;
            logMotion('🧹 Undo stack & mesh cache cleared');
        } catch (e) {}
    }

    function showLoadingOverlay(text) {
        const overlay = document.getElementById('loadingOverlay');
        const label = document.getElementById('loadingText');
        if (label && text) label.textContent = text;
        if (overlay) overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function bindProceduralMotionLoop(pcApp) {
        if (!pcApp || typeof pcApp.on !== 'function' || pcApp._vtfProceduralMotionBound) return;
        pcApp._vtfProceduralMotionBound = true;

        pcApp.on('update', function (dt) {
            animTime += dt;
            const stateObj = (typeof window.S !== 'undefined' && window.S) ? window.S : null;
            const objs = (stateObj && Array.isArray(stateObj.objs)) ? stateObj.objs : [];

            for (let i = 0; i < objs.length; i++) {
                const obj = objs[i];
                if (!obj || !obj.enabled) continue;

                if (obj._animSpin) {
                    obj.rotate(0, 60 * dt, 0);
                }

                if (obj._animPulse) {
                    if (!obj._baseScale && typeof obj.getLocalScale === 'function') {
                        obj._baseScale = obj.getLocalScale().clone();
                    }
                    const s = 1 + 0.08 * Math.sin(animTime * 4);
                    const base = obj._baseScale || { x: 1, y: 1, z: 1 };
                    obj.setLocalScale(base.x * s, base.y * s, base.z * s);
                }

                if (obj._animWobble) {
                    if (!obj._baseRot && typeof obj.getEulerAngles === 'function') {
                        obj._baseRot = obj.getEulerAngles().clone();
                    }
                    const baseR = obj._baseRot || { x: 0, y: 0, z: 0 };
                    const w = 8 * Math.sin(animTime * 6);
                    obj.setEulerAngles(baseR.x, baseR.y, baseR.z + w);
                }
            }
        });
    }

    window.clearUndoStack = clearUndoStack;
    window.__vtfShowLoading = showLoadingOverlay;
    window.__vtfHideLoading = hideLoadingOverlay;
    window.VtfProceduralMotion = {
        createGridFloor: createGridFloor,
        bindLoop: bindProceduralMotionLoop,
        clearUndoStack: clearUndoStack
    };
})();
