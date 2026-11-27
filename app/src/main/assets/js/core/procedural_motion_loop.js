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

    function buildMergedGridLinesMesh(graphicsDevice, halfExtent, stepSize) {
        if (!graphicsDevice || typeof pc === 'undefined' || !pc.Mesh) return null;

        const half = Math.max(1, Math.floor(Number(halfExtent) || 10));
        const step = Math.max(0.5, Number(stepSize) || 1);
        const halfThick = 0.008;
        const lineY = 0.002;

        const positions = [];
        const normals = [];
        const indices = [];
        let vtxCount = 0;

        function pushQuadBox(cx, cy, cz, hx, hy, hz) {
            const corners = [
                [cx - hx, cy - hy, cz - hz],
                [cx + hx, cy - hy, cz - hz],
                [cx + hx, cy + hy, cz - hz],
                [cx - hx, cy + hy, cz - hz],
                [cx - hx, cy - hy, cz + hz],
                [cx + hx, cy - hy, cz + hz],
                [cx + hx, cy + hy, cz + hz],
                [cx - hx, cy + hy, cz + hz]
            ];
            for (let i = 0; i < corners.length; i++) {
                positions.push(corners[i][0], corners[i][1], corners[i][2]);
                normals.push(0, 1, 0);
            }

            const base = vtxCount;
            const tris = [
                0, 2, 1, 0, 3, 2,
                4, 5, 6, 4, 6, 7,
                0, 1, 5, 0, 5, 4,
                2, 3, 7, 2, 7, 6,
                0, 4, 7, 0, 7, 3,
                1, 2, 6, 1, 6, 5
            ];
            for (let t = 0; t < tris.length; t++) {
                indices.push(base + tris[t]);
            }
            vtxCount += 8;
        }

        for (let pos = -half; pos <= half + 1e-6; pos += step) {
            const p = Number(pos.toFixed(4));
            pushQuadBox(p, lineY, 0, halfThick, 0.002, half);
            pushQuadBox(0, lineY, p, half, 0.002, halfThick);
        }

        const mesh = new pc.Mesh(graphicsDevice);
        mesh.setPositions(new Float32Array(positions));
        mesh.setNormals(new Float32Array(normals));
        if (indices.length >= 3) {
            const maxIdx = indices.reduce((m, v) => (v > m ? v : m), 0);
            mesh.setIndices(maxIdx > 65535 ? new Uint32Array(indices) : new Uint16Array(indices));
        }
        if (typeof mesh.update === 'function') {
            mesh.update(pc.PRIMITIVE_TRIANGLES);
        }
        return mesh;
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
            receiveShadows: false
        });
        gridEntity.setLocalScale(20, 0.05, 20);
        gridEntity.setPosition(0, -0.025, 0);
        pcApp.root.addChild(gridEntity);

        const mergedMesh = buildMergedGridLinesMesh(pcApp.graphicsDevice, 10, 1);
        if (mergedMesh) {
            const lineMat = new pc.StandardMaterial();
            lineMat.emissive = new pc.Color(0.22, 0.28, 0.38);
            lineMat.useLighting = false;
            lineMat.update();

            const linesEntity = new pc.Entity('GridLinesMerged');
            linesEntity.addComponent('render', {
                type: 'asset',
                castShadows: false,
                receiveShadows: false
            });
            linesEntity.render.meshInstances = [new pc.MeshInstance(mergedMesh, lineMat)];
            pcApp.root.addChild(linesEntity);
        }

        return gridEntity;
    }

    function clearUndoStack() {
        try {
            if (Array.isArray(window.undoStack)) window.undoStack.length = 0;
            if (Array.isArray(window.redoStack)) window.redoStack.length = 0;
            if (Array.isArray(window.meshCachePool)) {
                window.meshCachePool.length = 0;
            } else if (window.meshCachePool && typeof window.meshCachePool.clear === 'function') {
                window.meshCachePool.clear();
            }
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
            const safeDt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(dt, 0.1) : 0.016;
            animTime += safeDt;

            const stateObj = (typeof window.S !== 'undefined' && window.S) ? window.S : null;
            const objs = (stateObj && Array.isArray(stateObj.objects))
                ? stateObj.objects
                : ((stateObj && Array.isArray(stateObj.objs)) ? stateObj.objs : []);

            for (let i = 0; i < objs.length; i++) {
                const obj = objs[i];
                if (!obj || !obj.enabled) continue;

                if (obj._animSpin) {
                    obj.rotate(0, 60 * safeDt, 0);
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
