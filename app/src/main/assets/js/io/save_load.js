/* ===== VTuber Forge — js/io/save_load.js ===== */
// Serialisasi scene, Save/Load file JSON, dan Save Log

(function () {
    'use strict';

    function setSaveLoadStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function logSaveLoad(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getSceneStateSafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    function serializeScene(includeMeshData) {
        const st = getSceneStateSafe();
        const objects = (st && Array.isArray(st.objects)) ? st.objects : [];

        if (window.SceneSerializer && typeof window.SceneSerializer.serializeSceneSnapshot === 'function') {
            return window.SceneSerializer.serializeSceneSnapshot(objects, !!includeMeshData);
        }

        const safeVec3 = (v, fb) => {
            if (!v) return fb.slice();
            if (typeof v.toArray === 'function') return v.toArray();
            if (typeof v.x === 'number') return [v.x, v.y, v.z];
            return fb.slice();
        };

        const items = objects.map(o => {
            if (!o || typeof o.getPosition !== 'function') return null;
            let mat = (o.render && o.render.material) ? o.render.material : null;
            if (Array.isArray(mat)) mat = mat[0];
            const hasTex = !!(mat && mat.diffuseMap);
            return {
                name: o.name || 'Obj',
                type: (o.render && o.render.type) || 'box',
                pos: safeVec3(o.getPosition(), [0, 0, 0]),
                rot: safeVec3(typeof o.getEulerAngles === 'function' ? o.getEulerAngles() : null, [0, 0, 0]),
                scale: safeVec3(typeof o.getLocalScale === 'function' ? o.getLocalScale() : null, [1, 1, 1]),
                color: hasTex ? [0.5, 0.5, 0.5] : (mat && mat.diffuse ? safeVec3(mat.diffuse, [0.5, 0.5, 0.5]) : [0.5, 0.5, 0.5]),
                hasTex: hasTex,
                rough: (mat && typeof mat.gloss === 'number') ? mat.gloss : 0.5,
                metal: (mat && typeof mat.metalness === 'number') ? mat.metalness : 0,
                meshDataArr: (includeMeshData && Array.isArray(o._meshCache)) ? o._meshCache : [],
                hasMeshCache: !!(Array.isArray(o._meshCache) && o._meshCache.length > 0),
                morphNames: Array.isArray(o._morphNames) ? o._morphNames.slice() : [],
                morphWeights: [],
                animSpin: !!o._animSpin,
                animPulse: !!o._animPulse,
                animWobble: !!o._animWobble,
                baseScale: o._baseScale ? safeVec3(o._baseScale, [1, 1, 1]) : null,
                baseRot: o._baseRot ? safeVec3(o._baseRot, [0, 0, 0]) : null
            };
        }).filter(Boolean);

        return JSON.stringify(items);
    }
    window.serializeScene = serializeScene;

    function triggerSaveScene() {
        try {
            const jsonStr = serializeScene(true);
            const filename = `vtuber_scene_${Date.now()}.json`;
            if (typeof window.downloadNative === 'function') {
                window.downloadNative(filename, jsonStr);
            }
            setSaveLoadStatus("✓ Scene disimpan: " + filename);
        } catch (e) {
            logSaveLoad("Save scene error: " + e.message);
            alert("Gagal menyimpan scene: " + e.message);
        }
    }
    window.triggerSaveScene = triggerSaveScene;

    const saveBtn = document.getElementById('save');
    if (saveBtn) saveBtn.onclick = triggerSaveScene;

    const undoBtn = document.getElementById('undo');
    if (undoBtn) {
        undoBtn.onclick = () => {
            if (typeof window.triggerUndo === 'function') window.triggerUndo();
        };
    }

    const redoBtn = document.getElementById('redo');
    if (redoBtn) {
        redoBtn.onclick = () => {
            if (typeof window.triggerRedo === 'function') window.triggerRedo();
        };
    }

    const jsonFileInput = document.getElementById('jsonFile');
    if (jsonFileInput) {
        jsonFileInput.onchange = (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            e.target.value = '';

            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev && ev.target ? ev.target.result : '';
                if (typeof text === 'string' && text.trim()) {
                    const ok = (typeof window.loadState === 'function')
                        ? window.loadState(text, false)
                        : false;
                    if (ok) {
                        if (typeof window.saveState === 'function') window.saveState();
                        setSaveLoadStatus("✓ Scene dimuat dari: " + file.name);
                    } else {
                        setSaveLoadStatus("⚠ Gagal memuat scene: format file JSON tidak valid.");
                    }
                } else {
                    setSaveLoadStatus("⚠ File scene kosong.");
                }
            };
            reader.readAsText(file);
        };
    }

    function bindSaveLogButton() {
        const saveLogBtn = document.getElementById('saveLogBtn');
        if (saveLogBtn) {
            saveLogBtn.onclick = () => {
                const logs = Array.isArray(window.allLogs) ? window.allLogs : [];
                const content = logs.length > 0
                    ? logs.join('\n')
                    : ("VTuber Forge Log — " + new Date().toISOString() + "\n(Kosong)");
                const filename = `vtuber_debug_${Date.now()}.log`;
                if (typeof window.downloadNative === 'function') {
                    window.downloadNative(filename, content);
                }
                setSaveLoadStatus("✓ Debug log disimpan: " + filename);
            };
        }
    }
    window.bindSaveLogButton = bindSaveLogButton;
    bindSaveLogButton();

    logSaveLoad("✅ save_load.js loaded");
})();
