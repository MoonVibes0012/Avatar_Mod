/* ===== VTuber Forge — js/io/history.js ===== */
// Manajemen undo/redo stack dan rekonstruksi snapshot scene

(function () {
    'use strict';

    function setHistoryStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function logHistory(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getHistoryApp() {
        if (typeof window.getPcApp === 'function') {
            const pcApp = window.getPcApp();
            if (pcApp) return pcApp;
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    function getSceneStateSafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    function callGlobalFn(name, ...args) {
        if (typeof window[name] === 'function') {
            return window[name](...args);
        }
        try {
            const fn = Function('"use strict"; return (typeof ' + name + ' === "function") ? ' + name + ' : null;')();
            if (typeof fn === 'function') return fn(...args);
        } catch (e) {}
        return undefined;
    }

    function getUndoStack() {
        if (!Array.isArray(window.undoStack)) window.undoStack = [];
        return window.undoStack;
    }

    function getRedoStack() {
        if (!Array.isArray(window.redoStack)) window.redoStack = [];
        return window.redoStack;
    }

    function hasAnySkinnedEntity() {
        const st = getSceneStateSafe();
        if (!st || !Array.isArray(st.objects)) return false;
        return st.objects.some(o => {
            if (!o || typeof o.findComponents !== 'function') return false;
            return o.findComponents('render').some(c =>
                c && Array.isArray(c.meshInstances) && c.meshInstances.some(mi => mi && mi.skinInstance != null)
            );
        });
    }
    window.hasAnySkinnedEntity = hasAnySkinnedEntity;

    function applyMorphWeightsToEntity(entity, morphWeights) {
        if (!entity || !entity._morphInstance || !Array.isArray(morphWeights)) return;
        for (let i = 0; i < morphWeights.length; i++) {
            const rawW = Number(morphWeights[i]);
            if (!isFinite(rawW)) continue;
            const clampedW = Math.max(0, Math.min(1, rawW));
            try {
                if (typeof entity._morphInstance.setWeight === 'function') {
                    entity._morphInstance.setWeight(i, clampedW);
                }
            } catch (e) {}
        }
    }

    function loadState(stateStr, skipClearRedo) {
        const pcApp = getHistoryApp();
        const st = getSceneStateSafe();
        if (!pcApp || !pcApp.root || !st) return false;

        let arr;
        try {
            if (window.SceneSerializer && typeof window.SceneSerializer.parseSceneSnapshot === 'function') {
                arr = window.SceneSerializer.parseSceneSnapshot(stateStr);
            } else {
                arr = JSON.parse(stateStr);
            }
        } catch (e) {
            logHistory("Gagal parse state: " + e.message);
            return false;
        }

        if (!Array.isArray(arr)) {
            logHistory("Format state tidak valid: bukan array.");
            return false;
        }

        callGlobalFn('selectObject', null);
        callGlobalFn('resetMode');

        (st.objects || []).forEach(o => {
            if (typeof window.destroyEntity === 'function') {
                window.destroyEntity(o);
            } else if (o && typeof o.destroy === 'function') {
                o.destroy();
            }
        });
        st.objects = [];

        arr.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const e = new pc.Entity(item.name || 'Obj');
            const p = Array.isArray(item.pos) ? item.pos : [0, 0, 0];
            const r = Array.isArray(item.rot) ? item.rot : [0, 0, 0];
            const s = Array.isArray(item.scale) ? item.scale : [1, 1, 1];
            e.setPosition(p[0] || 0, p[1] || 0, p[2] || 0);
            e.setEulerAngles(r[0] || 0, r[1] || 0, r[2] || 0);
            e.setLocalScale(s[0] || 1, s[1] || 1, s[2] || 1);

            const m = new pc.StandardMaterial();
            const c = Array.isArray(item.color) ? item.color : [0.5, 0.5, 0.5];
            m.diffuse = new pc.Color(c[0] || 0.5, c[1] || 0.5, c[2] || 0.5);
            m.gloss = (typeof item.rough === 'number') ? item.rough : 0.5;
            m.metalness = (typeof item.metal === 'number') ? item.metal : 0;
            if (typeof m.update === 'function') m.update();

            let cachedMeshData = null;
            if (Array.isArray(item.meshDataArr) && item.meshDataArr.length > 0) {
                cachedMeshData = item.meshDataArr;
            } else if (item.name && window.meshCachePool && window.meshCachePool.has(item.name)) {
                cachedMeshData = window.meshCachePool.get(item.name);
            }

            if (item.type === 'custom' && Array.isArray(cachedMeshData) && cachedMeshData.length > 0 && pcApp.graphicsDevice) {
                e.addComponent('render', { type: 'asset', castShadows: false });
                const mis = [];
                cachedMeshData.forEach(md => {
                    if (!md || !md.pos || !md.pos.length) return;
                    const mesh = new pc.Mesh(pcApp.graphicsDevice);
                    mesh.setPositions(new Float32Array(md.pos));
                    if (md.idx && md.idx.length) {
                        const maxIdx = md.idx.reduce((a, b) => Math.max(a, b), 0);
                        mesh.setIndices(maxIdx > 65535 ? new Uint32Array(md.idx) : new Uint16Array(md.idx));
                    }
                    if (md.uvs && md.uvs.length) mesh.setUvs(0, new Float32Array(md.uvs));
                    if (md.normals && md.normals.length) mesh.setNormals(new Float32Array(md.normals));
                    else if (typeof mesh.calculateNormals === 'function') mesh.calculateNormals();
                    mesh.update(pc.PRIMITIVE_TRIANGLES);

                    const mi = new pc.MeshInstance(mesh, m);
                    if (typeof pc.BoundingBox !== 'undefined') {
                        mi.aabb = pc.BoundingBox.fromMesh(mesh);
                    }
                    mis.push(mi);
                });
                e.render.meshInstances = mis;
                e._meshCache = cachedMeshData;
            } else {
                const primType = (item.type && item.type !== 'custom' && item.type !== 'asset') ? item.type : 'box';
                e.addComponent('render', { type: primType, castShadows: false });
                e.render.material = m;
            }

            if (Array.isArray(item.morphNames) && item.morphNames.length > 0) {
                e._morphNames = item.morphNames.slice();
            }
            if (Array.isArray(item.morphWeights) && item.morphWeights.length > 0) {
                applyMorphWeightsToEntity(e, item.morphWeights);
            }

            e._animSpin = !!item.animSpin;
            e._animPulse = !!item.animPulse;
            e._animWobble = !!item.animWobble;
            e._baseScale = Array.isArray(item.baseScale)
                ? new pc.Vec3(item.baseScale[0] || 1, item.baseScale[1] || 1, item.baseScale[2] || 1)
                : e.getLocalScale().clone();
            e._baseRot = Array.isArray(item.baseRot)
                ? new pc.Vec3(item.baseRot[0] || 0, item.baseRot[1] || 0, item.baseRot[2] || 0)
                : e.getEulerAngles().clone();

            pcApp.root.addChild(e);
            st.objects.push(e);
        });

        if (!skipClearRedo) {
            getRedoStack().length = 0;
        }
        callGlobalFn('updateTree');
        if (st.objects.length > 0) {
            callGlobalFn('selectObject', st.objects[st.objects.length - 1]);
        }
        return true;
    }
    window.loadState = loadState;

    function saveState() {
        const uStack = getUndoStack();
        const maxUndo = (typeof window.CONFIG !== 'undefined' && window.CONFIG && window.CONFIG.MAX_UNDO)
            ? window.CONFIG.MAX_UNDO
            : 20;
        if (typeof window.serializeScene !== 'function') return;
        try {
            const snap = window.serializeScene(true);
            uStack.push(snap);
            if (uStack.length > maxUndo) {
                uStack.splice(0, uStack.length - maxUndo);
            }
            getRedoStack().length = 0;
        } catch (e) {
            logHistory("saveState warning: " + e.message);
        }
    }
    window.saveState = saveState;

    function triggerUndo() {
        const uStack = getUndoStack();
        const rStack = getRedoStack();
        if (uStack.length <= 1) {
            setHistoryStatus("Tidak ada yang bisa di-Undo.");
            return;
        }
        const current = uStack.pop();
        rStack.push(current);
        const prev = uStack[uStack.length - 1];
        if (loadState(prev, true)) {
            setHistoryStatus("↶ Undo berhasil.");
        } else {
            setHistoryStatus("⚠ Gagal melakukan Undo.");
        }
    }
    window.triggerUndo = triggerUndo;

    function triggerRedo() {
        const uStack = getUndoStack();
        const rStack = getRedoStack();
        if (rStack.length === 0) {
            setHistoryStatus("Tidak ada yang bisa di-Redo.");
            return;
        }
        const nextState = rStack.pop();
        uStack.push(nextState);
        if (loadState(nextState, true)) {
            setHistoryStatus("↷ Redo berhasil.");
        } else {
            setHistoryStatus("⚠ Gagal melakukan Redo.");
        }
    }
    window.triggerRedo = triggerRedo;

    logHistory("✅ history.js loaded");
})();
