/* ===== VTuber Forge — js/anatomy/vrm_part_extractor.js ===== */
// Ekstraksi & pemisahan bagian model VRM/GLB (Prioritas Metadata VRM 0.x & VRM 1.0 + Pencocokan Nama)

(function () {
    'use strict';

    const extractedCache = new WeakMap();

    const VRM_TO_ANATOMY_PART = {
        hips: 'hips',
        spine: 'spine',
        chest: 'chest',
        upperchest: 'upperChest',
        neck: 'neck',
        head: 'head',
        leftshoulder: 'leftShoulder',
        leftupperarm: 'leftUpperArm',
        leftlowerarm: 'leftLowerArm',
        lefthand: 'leftHand',
        rightshoulder: 'rightShoulder',
        rightupperarm: 'rightUpperArm',
        rightlowerarm: 'rightLowerArm',
        righthand: 'rightHand',
        leftupperleg: 'leftUpperLeg',
        leftlowerleg: 'leftLowerLeg',
        leftfoot: 'leftFoot',
        rightupperleg: 'rightUpperLeg',
        rightlowerleg: 'rightLowerLeg',
        rightfoot: 'rightFoot'
    };

    function logExtractor(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        }
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
                    if (!isFinite(bMin.x) || !isFinite(bMin.y) || !isFinite(bMin.z)) continue;
                    if (!isFinite(bMax.x) || !isFinite(bMax.y) || !isFinite(bMax.z)) continue;
                    min.min(bMin);
                    max.max(bMax);
                    found = true;
                }
            }
        }

        if (!found) {
            const p = (rootEntity && typeof rootEntity.getPosition === 'function')
                ? rootEntity.getPosition()
                : new pc.Vec3(0, 0, 0);
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

    function extractVrmHumanoidMetadata(rootEntity) {
        const map = new Map();
        if (!rootEntity || !rootEntity._gltfJson || !Array.isArray(rootEntity._nodeEntities)) {
            return map;
        }
        const gltf = rootEntity._gltfJson;
        const nodeEntities = rootEntity._nodeEntities;

        // 1. VRM 0.x: gltf.extensions.VRM.humanoid.humanBones[] -> { bone: 'head', node: 12 }
        const vrm0Bones = gltf.extensions &&
            gltf.extensions.VRM &&
            gltf.extensions.VRM.humanoid &&
            Array.isArray(gltf.extensions.VRM.humanoid.humanBones)
            ? gltf.extensions.VRM.humanoid.humanBones
            : null;

        if (vrm0Bones) {
            for (let i = 0; i < vrm0Bones.length; i++) {
                const entry = vrm0Bones[i];
                if (!entry || entry.node === undefined || !entry.bone) continue;
                const key = String(entry.bone).toLowerCase().replace(/[^a-z0-9]/g, '');
                const partId = VRM_TO_ANATOMY_PART[key];
                const nodeEnt = nodeEntities[entry.node];
                if (partId && nodeEnt && !map.has(partId)) {
                    map.set(partId, nodeEnt);
                }
            }
        }

        // 2. VRM 1.0: gltf.extensions.VRMC_vrm.humanoid.humanBones -> { head: { node: 12 }, ... }
        const vrm1Bones = gltf.extensions &&
            gltf.extensions.VRMC_vrm &&
            gltf.extensions.VRMC_vrm.humanoid &&
            gltf.extensions.VRMC_vrm.humanoid.humanBones &&
            typeof gltf.extensions.VRMC_vrm.humanoid.humanBones === 'object'
            ? gltf.extensions.VRMC_vrm.humanoid.humanBones
            : null;

        if (vrm1Bones) {
            const keys = Object.keys(vrm1Bones);
            for (let i = 0; i < keys.length; i++) {
                const rawName = keys[i];
                const spec = vrm1Bones[rawName];
                if (!spec || spec.node === undefined) continue;
                const key = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
                const partId = VRM_TO_ANATOMY_PART[key];
                const nodeEnt = nodeEntities[spec.node];
                if (partId && nodeEnt && !map.has(partId)) {
                    map.set(partId, nodeEnt);
                }
            }
        }

        return map;
    }

    function extractModelAnatomy(rootEntity, forceRefresh) {
        if (!rootEntity || !window.AnatomyRegistry) return null;

        if (!forceRefresh && extractedCache.has(rootEntity)) {
            const cached = extractedCache.get(rootEntity);
            if (cached && cached.root === rootEntity) return cached;
        }

        const parts = {};
        const accessories = [];
        const morphTargets = [];
        const boneSet = new Set();

        if (typeof window.collectRigFromEntity === 'function') {
            const rig = window.collectRigFromEntity(rootEntity, false);
            if (rig && Array.isArray(rig.bones)) {
                rig.bones.forEach((b) => { if (b) boneSet.add(b); });
            }
        }

        if (typeof rootEntity.findComponents === 'function') {
            const renders = rootEntity.findComponents('render') || [];
            for (let i = 0; i < renders.length; i++) {
                const mis = renders[i].meshInstances || [];
                for (let j = 0; j < mis.length; j++) {
                    const mi = mis[j];
                    if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                        mi.skinInstance.bones.forEach((b) => { if (b) boneSet.add(b); });
                    }
                    if (mi && mi.morphInstance) {
                        morphTargets.push(mi);
                    }
                }
            }
        }

        // Prioritas 1: Metadata Humanoid VRM 0.x / VRM 1.0
        const vrmMetaMap = extractVrmHumanoidMetadata(rootEntity);
        vrmMetaMap.forEach((node, partId) => {
            parts[partId] = {
                partId: partId,
                entity: node,
                isBone: boneSet.has(node),
                isFallback: false,
                source: 'vrm_metadata',
                rest: captureRestTransform(node),
                offsetEuler: new pc.Vec3(0, 0, 0),
                offsetPos: new pc.Vec3(0, 0, 0)
            };
        });

        // Prioritas 2: Fallback pencocokan nama tulang/node di hierarki
        traverseHierarchy(rootEntity, function (node) {
            if (node === rootEntity) return;
            if (typeof node.name === 'string' && node.name.indexOf('vtf_anatomy_pivot_') === 0) return;

            const name = node.name || '';
            const partId = window.AnatomyRegistry.matchPartByName(name);
            const isBone = boneSet.has(node);

            if (partId) {
                if (!parts[partId] || (!parts[partId].isBone && isBone && parts[partId].source !== 'vrm_metadata')) {
                    parts[partId] = {
                        partId: partId,
                        entity: node,
                        isBone: isBone,
                        isFallback: false,
                        source: 'name_match',
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
        const hasValidRig = boneSet.size > 0 && mappedCount > 0;
        const bounds = computeEntityBounds(rootEntity);
        const height = Math.max(0.25, bounds.size.y);

        const record = {
            root: rootEntity,
            parts: parts,
            accessories: accessories,
            morphTargets: morphTargets,
            fallbackPivots: [],
            isRigged: hasValidRig,
            mappedCount: mappedCount,
            totalBones: boneSet.size,
            bounds: bounds,
            modelScale: Math.max(0.2, height),
            unavailableReason: hasValidRig
                ? ''
                : 'Pose tulang tidak tersedia: model tidak memiliki rig humanoid atau tulang yang dapat dipetakan.'
        };

        extractedCache.set(rootEntity, record);
        logExtractor('🦴 Anatomy extracted: parts=' + mappedCount + ' bones=' + boneSet.size + ' rigged=' + hasValidRig);
        return record;
    }

    function resetPartPose(record, partId) {
        if (!record || !record.parts || !record.parts[partId]) return;
        const p = record.parts[partId];
        p.offsetEuler.set(0, 0, 0);
        p.offsetPos.set(0, 0, 0);
        restoreRestTransform(p.entity, p.rest);
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
