/* ===== VTuber Forge — js/scene/serialize.js ===== */
// Modul helper serialisasi & parsing snapshot scene

(function () {
    'use strict';

    function logSerialize(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function toVec3Array(val, fallback) {
        if (!val) return fallback.slice();
        if (typeof val.toArray === 'function') {
            const arr = val.toArray();
            if (Array.isArray(arr) && arr.length >= 3) {
                return [
                    isFinite(Number(arr[0])) ? Number(arr[0]) : fallback[0],
                    isFinite(Number(arr[1])) ? Number(arr[1]) : fallback[1],
                    isFinite(Number(arr[2])) ? Number(arr[2]) : fallback[2]
                ];
            }
        }
        if (Array.isArray(val) && val.length >= 3) {
            return [
                isFinite(Number(val[0])) ? Number(val[0]) : fallback[0],
                isFinite(Number(val[1])) ? Number(val[1]) : fallback[1],
                isFinite(Number(val[2])) ? Number(val[2]) : fallback[2]
            ];
        }
        if (typeof val.x === 'number' && typeof val.y === 'number' && typeof val.z === 'number') {
            return [
                isFinite(val.x) ? val.x : fallback[0],
                isFinite(val.y) ? val.y : fallback[1],
                isFinite(val.z) ? val.z : fallback[2]
            ];
        }
        return fallback.slice();
    }

    function extractMorphWeights(entity) {
        if (!entity || !entity._morphInstance || !Array.isArray(entity._morphNames)) return [];
        const weights = [];
        for (let i = 0; i < entity._morphNames.length; i++) {
            let w = 0;
            try {
                if (typeof entity._morphInstance.getWeight === 'function') {
                    w = Number(entity._morphInstance.getWeight(i));
                }
            } catch (e) {
                w = 0;
            }
            weights.push(isFinite(w) ? Math.max(0, Math.min(1, w)) : 0);
        }
        return weights;
    }

    function serializeEntitySnapshot(entity, includeMeshData) {
        if (!entity || typeof entity.getPosition !== 'function') return null;

        let meshDataArr = [];
        if (includeMeshData && Array.isArray(entity._meshCache) && entity._meshCache.length > 0) {
            meshDataArr = entity._meshCache;
        }

        let mat = (entity.render && entity.render.material) ? entity.render.material : null;
        if (Array.isArray(mat)) mat = mat[0];

        const hasTex = !!(mat && mat.diffuseMap !== null && mat.diffuseMap !== undefined);
        const colorArr = hasTex
            ? [0.5, 0.5, 0.5]
            : ((mat && mat.diffuse) ? toVec3Array(mat.diffuse, [0.5, 0.5, 0.5]) : [0.5, 0.5, 0.5]);

        let objType = (entity.render && entity.render.type) ? entity.render.type : 'box';
        if (meshDataArr.length > 0) objType = 'custom';

        const renderComps = typeof entity.findComponents === 'function' ? entity.findComponents('render') : [];
        const hasSkeleton = renderComps.some(comp =>
            comp && Array.isArray(comp.meshInstances) && comp.meshInstances.some(mi => mi && mi.skinInstance != null)
        );

        const morphNames = Array.isArray(entity._morphNames) ? entity._morphNames.slice() : [];
        const morphWeights = extractMorphWeights(entity);

        return {
            name: entity.name || 'Obj',
            type: objType,
            pos: toVec3Array(entity.getPosition(), [0, 0, 0]),
            rot: toVec3Array(typeof entity.getEulerAngles === 'function' ? entity.getEulerAngles() : null, [0, 0, 0]),
            scale: toVec3Array(typeof entity.getLocalScale === 'function' ? entity.getLocalScale() : null, [1, 1, 1]),
            color: colorArr,
            hasTex: hasTex,
            hasSkeleton: hasSkeleton,
            rough: (mat && typeof mat.gloss === 'number' && isFinite(mat.gloss)) ? mat.gloss : 0.5,
            metal: (mat && typeof mat.metalness === 'number' && isFinite(mat.metalness)) ? mat.metalness : 0,
            meshDataArr: meshDataArr,
            hasMeshCache: !!(Array.isArray(entity._meshCache) && entity._meshCache.length > 0),
            morphNames: morphNames,
            morphWeights: morphWeights,
            animSpin: !!(entity._animSpin),
            animPulse: !!(entity._animPulse),
            animWobble: !!(entity._animWobble),
            baseScale: entity._baseScale ? toVec3Array(entity._baseScale, [1, 1, 1]) : null,
            baseRot: entity._baseRot ? toVec3Array(entity._baseRot, [0, 0, 0]) : null
        };
    }

    function serializeSceneSnapshot(objects, includeMeshData) {
        const list = Array.isArray(objects) ? objects : [];
        const items = [];
        for (let i = 0; i < list.length; i++) {
            try {
                const snap = serializeEntitySnapshot(list[i], !!includeMeshData);
                if (snap) items.push(snap);
            } catch (err) {
                logSerialize("Serialize skip object: " + err.message);
            }
        }
        return JSON.stringify(items);
    }

    function parseSceneSnapshot(jsonStr) {
        if (typeof jsonStr !== 'string' || !jsonStr.trim()) {
            throw new Error("Snapshot kosong.");
        }
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) {
            throw new Error("Format snapshot harus array.");
        }
        return parsed;
    }

    window.SceneSerializer = {
        toVec3Array: toVec3Array,
        serializeEntitySnapshot: serializeEntitySnapshot,
        serializeSceneSnapshot: serializeSceneSnapshot,
        parseSceneSnapshot: parseSceneSnapshot
    };

    logSerialize("✅ serialize.js loaded");
})();
