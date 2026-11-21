/* ===== VTuber Forge — js/anatomy/vrm_part_extractor.js ===== */
// Ekstraksi & pemisahan bagian model VRM/GLB, pencatatan Rest Pose awal, serta pembersihan pivot aman

(function () {
    'use strict';

    const extractedCache = new WeakMap();

    function logExtractor(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        }
    }

    function getPcAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function captureRestTransform(entity) {
        if (!entity) return null;
        const pos = entity.getLocalPosition();
        const rot = entity.getLocalEulerAngles();
        const scl = entity.getLocalScale();
        return {
            pos: [pos.x, pos.y, pos.z],
            rot: [rot.x, rot.y, rot.z],
            scl: [scl.x, scl.y, scl.z]
        };
    }

    function restoreRestTransform(entity, rest) {
        if (!entity || !rest) return;
        entity.setLocalPosition(rest.pos[0], rest.pos[1], rest.pos[2]);
        entity.setLocalEulerAngles(rest.rot[0], rest.rot[1], rest.rot[2]);
        entity.setLocalScale(rest.scl[0], rest.scl[1], rest.scl[2]);
    }

    function computeEntityBounds(rootEntity) {
        const min = new pc.Vec3(Infinity, Infinity, Infinity);
        const max = new pc.Vec3(-Infinity, -Infinity, -Infinity);
        let found = false;

        if (rootEntity && typeof rootEntity.findComponents === 'function') {
            const renders = rootEntity.findComponents('render');
            for (let i = 0; i < renders.length; i++) {
                const mis = renders[i].meshInstances || [];
                for (let j = 0; j < mis.length; j++) {
                    const aabb = mis[j] && mis[j].aabb;
                    if (!aabb) continue;
                    const bMin = aabb.getMin();
                    const bMax = aabb.getMax();
                    min.min(bMin);
                    max.max(bMax);
                    found = true;
                }
            }
        }

        if (!found) {
            const p = rootEntity ? rootEntity.getPosition() : new pc.Vec3(0, 0, 0);
            min.set(p.x - 0.35, p.y, p.z - 0.25);
            max.set(p.x + 0.35, p.y + 1.6, p.z + 0.25);
        }

        const size = new pc.Vec3().sub2(max, min);
        const center = new pc.Vec3().add2(min, max).mulScalar(0.5);
        return { min: min, max: max, size: size, center: center };
    }

    function traverseHierarchy(entity, visitor) {
        if (!entity) return;
        visitor(entity);
        const children = entity.children || [];
        for (let i = 0; i < children.length; i++) {
            traverseHierarchy(children[i], visitor);
        }
    }

    function cleanupFallbackPivots(record) {
        if (!record || !Array.isArray(record.fallbackPivots)) return;
        for (let i = 0; i < record.fallbackPivots.length; i++) {
            const p = record.fallbackPivots[i];
            try {
                if (p && p.destroy) p.destroy();
            } catch (e) {}
        }
        record.fallbackPivots.length = 0;
    }

    function extractModelAnatomy(rootEntity, forceRefresh) {
        if (!rootEntity || !window.AnatomyRegistry) return null;

        if (!forceRefresh && extractedCache.has(rootEntity)) {
            const cached = extractedCache.get(rootEntity);
            if (cached && cached.root === rootEntity) return cached;
        }

        const old = extractedCache.get(rootEntity);
        if (old) cleanupFallbackPivots(old);

        const parts = {};
        const accessories = [];
        const morphTargets = [];
        const fallbackPivots = [];
        const boneSet = new Set();

        if (typeof rootEntity.findComponents === 'function') {
            const renders = rootEntity.findComponents('render');
            for (let i = 0; i < renders.length; i++) {
                const mis = renders[i].meshInstances || [];
                for (let j = 0; j < mis.length; j++) {
                    const mi = mis[j];
                    if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                        mi.skinInstance.bones.forEach(b => { if (b) boneSet.add(b); });
                    }
                    if (mi && mi.morphInstance) {
                        morphTargets.push(mi);
                    }
                }
            }
        }

        traverseHierarchy(rootEntity, function (node) {
            if (node === rootEntity) return;
            const name = node.name || '';
            const partId = window.AnatomyRegistry.matchPartByName(name);
            const isBone = boneSet.has(node);

            if (partId) {
                if (!parts[partId] || (!parts[partId].isBone && isBone)) {
                    parts[partId] = {
                        partId: partId,
                        entity: node,
                        isBone: isBone,
                        isFallback: false,
                        rest: captureRestTransform(node),
                        offsetEuler: new pc.Vec3(0, 0, 0),
                        offsetPos: new pc.Vec3(0, 0, 0)
                    };
                }
                return;
            }

            if (window.AnatomyRegistry.isAccessoryOrSpringName(name)) {
                accessories.push({
                    name: name,
                    entity: node,
                    isBone: isBone,
                    rest: captureRestTransform(node)
                });
            }
        });

        const mappedCount = Object.keys(parts).length;
        const bounds = computeEntityBounds(rootEntity);
        const height = Math.max(0.25, bounds.size.y);
        const width = Math.max(0.25, Math.max(bounds.size.x, height * 0.45));

        if (mappedCount < 4) {
            const allIds = window.AnatomyRegistry.PART_ORDER;
            for (let i = 0; i < allIds.length; i++) {
                const partId = allIds[i];
                if (parts[partId]) continue;
                const def = window.AnatomyRegistry.getPartDef(partId);
                if (!def || !def.fallbackRatio) continue;

                const pivot = new pc.Entity('vtf_anatomy_pivot_' + partId);
                const wx = bounds.center.x + (def.fallbackRatio[0] * width);
                const wy = bounds.min.y + (def.fallbackRatio[1] * height);
                const wz = bounds.center.z + (def.fallbackRatio[2] * width);

                rootEntity.addChild(pivot);
                pivot.setPosition(wx, wy, wz);
                fallbackPivots.push(pivot);

                parts[partId] = {
                    partId: partId,
                    entity: pivot,
                    targetEntity: rootEntity,
                    isBone: false,
                    isFallback: true,
                    rest: captureRestTransform(pivot),
                    rootRest: captureRestTransform(rootEntity),
                    offsetEuler: new pc.Vec3(0, 0, 0),
                    offsetPos: new pc.Vec3(0, 0, 0)
                };
            }
        }

        const record = {
            root: rootEntity,
            parts: parts,
            accessories: accessories,
            morphTargets: morphTargets,
            fallbackPivots: fallbackPivots,
            isRigged: boneSet.size > 0,
            bounds: bounds,
            modelScale: Math.max(0.2, height)
        };

        extractedCache.set(rootEntity, record);
        logExtractor('🦴 Anatomy extracted: parts=' + Object.keys(parts).length + ' rigged=' + record.isRigged + ' acc=' + accessories.length);
        return record;
    }

    function resetPartPose(record, partId) {
        if (!record || !record.parts || !record.parts[partId]) return;
        const p = record.parts[partId];
        p.offsetEuler.set(0, 0, 0);
        p.offsetPos.set(0, 0, 0);
        restoreRestTransform(p.entity, p.rest);
        if (p.isFallback && p.targetEntity && p.rootRest) {
            restoreRestTransform(p.targetEntity, p.rootRest);
        }
    }

    function resetAllPoses(record) {
        if (!record || !record.parts) return;
        const ids = Object.keys(record.parts);
        for (let i = 0; i < ids.length; i++) {
            resetPartPose(record, ids[i]);
        }
    }

    function disposeRecordForEntity(rootEntity) {
        if (!rootEntity || !extractedCache.has(rootEntity)) return;
        const rec = extractedCache.get(rootEntity);
        cleanupFallbackPivots(rec);
        extractedCache.delete(rootEntity);
    }

    window.VrmPartExtractor = {
        extract: extractModelAnatomy,
        resetPartPose: resetPartPose,
        resetAllPoses: resetAllPoses,
        disposeForEntity: disposeRecordForEntity,
        computeEntityBounds: computeEntityBounds
    };
})();
