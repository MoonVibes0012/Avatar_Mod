/* ===== VTuber Forge — js/core/pc_compat.js ===== */
// Modul Kompatibilitas PlayCanvas (Safe Mesh Streams, Indices, Normals, Morph & Rig Hierarchy Helper)

(function () {
    'use strict';

    function getGraphicsDevice(explicitDevice) {
        if (explicitDevice) return explicitDevice;
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a && a.graphicsDevice) return a.graphicsDevice;
        }
        if (typeof window.app !== 'undefined' && window.app && window.app.graphicsDevice) {
            return window.app.graphicsDevice;
        }
        return null;
    }

    function toFloat32Safe(arr, expectedLen) {
        const len = Math.max(0, Math.floor(Number(expectedLen) || 0));
        const out = new Float32Array(len);
        if (!arr || len === 0) return out;
        const copyLen = Math.min(arr.length || 0, len);
        for (let i = 0; i < copyLen; i++) {
            const v = Number(arr[i]);
            out[i] = Number.isFinite(v) ? v : 0;
        }
        return out;
    }

    function toUint8Safe(arr, expectedLen) {
        const len = Math.max(0, Math.floor(Number(expectedLen) || 0));
        const out = new Uint8Array(len);
        if (!arr || len === 0) return out;
        const copyLen = Math.min(arr.length || 0, len);
        for (let i = 0; i < copyLen; i++) {
            const v = Number(arr[i]);
            out[i] = Number.isFinite(v) ? Math.max(0, Math.min(255, Math.floor(v))) : 0;
        }
        return out;
    }

    function buildSafeIndexArray(idx, numVerts) {
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        if (!idx || idx.length < 3 || verts <= 0) return null;

        const triCount = Math.floor(idx.length / 3) * 3;
        if (triCount <= 0) return null;

        let maxIdx = 0;
        const plain = new Array(triCount);
        for (let i = 0; i < triCount; i++) {
            let v = Number(idx[i]);
            if (!Number.isFinite(v) || v < 0 || v >= verts) v = 0;
            else v = Math.floor(v);
            plain[i] = v;
            if (v > maxIdx) maxIdx = v;
        }

        const useUint32 = (maxIdx > 65535) || (plain.length % 2 !== 0);
        return useUint32 ? new Uint32Array(plain) : new Uint16Array(plain);
    }

    function computeNormalsSafe(posArr, idxArr, numVerts) {
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        const fallback = new Float32Array(verts * 3);
        for (let i = 1; i < fallback.length; i += 3) {
            fallback[i] = 1;
        }

        if (!posArr || posArr.length < verts * 3 || verts <= 0) return fallback;

        try {
            if (typeof pc !== 'undefined' && typeof pc.calculateNormals === 'function') {
                const idxArg = (idxArr && idxArr.length >= 3)
                    ? Array.from(idxArr)
                    : Array.from({ length: verts }, (_, k) => k);
                const calc = pc.calculateNormals(posArr, idxArg);
                if (calc && calc.length >= verts * 3) {
                    return toFloat32Safe(calc, verts * 3);
                }
            }
        } catch (e) {}
        return fallback;
    }

    function setVertexStreamSafe(mesh, semantic, dataTypedArray, components, dataType, normalize) {
        if (!mesh || !dataTypedArray || dataTypedArray.length === 0) return false;
        if (typeof mesh.setVertexStream !== 'function') return false;

        try {
            mesh.setVertexStream(semantic, dataTypedArray, components, dataType, !!normalize);
            return true;
        } catch (e1) {
            try {
                mesh.setVertexStream(semantic, dataTypedArray, components, dataType);
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    function updateMeshSafe(mesh) {
        if (!mesh || typeof mesh.update !== 'function') return false;
        try {
            mesh.update();
            return true;
        } catch (e1) {
            try {
                mesh.update(true, true);
                return true;
            } catch (e2) {
                throw e1;
            }
        }
    }

    function buildMeshCompat(opts) {
        const o = opts || {};
        const gd = getGraphicsDevice(o.graphicsDevice);
        if (!gd || typeof pc === 'undefined' || !pc.Mesh) {
            throw new Error('PlayCanvas GraphicsDevice atau pc.Mesh belum tersedia.');
        }

        const numVerts = Math.max(0, Math.floor(Number(o.numVerts) || 0));
        if (numVerts <= 0) {
            throw new Error('Jumlah vertex tidak valid (numVerts <= 0).');
        }

        const mesh = new pc.Mesh(gd);
        const posArr = toFloat32Safe(o.positions, numVerts * 3);
        const safeIdx = buildSafeIndexArray(o.indices, numVerts);

        let normArr;
        if (o.normals && o.normals.length >= numVerts * 3) {
            normArr = toFloat32Safe(o.normals, numVerts * 3);
        } else {
            normArr = computeNormalsSafe(posArr, safeIdx, numVerts);
        }

        mesh.setPositions(posArr);
        mesh.setNormals(normArr);

        if (o.uvs && o.uvs.length >= numVerts * 2) {
            const uvArr = toFloat32Safe(o.uvs, numVerts * 2);
            if (typeof mesh.setUvs === 'function') {
                mesh.setUvs(0, uvArr);
            }
        }

        let skinApplied = false;
        if (o.joints && o.weights && o.joints.length >= numVerts * 3 && o.weights.length >= numVerts * 3) {
            const jArr = new Uint8Array(numVerts * 4);
            const wArr = new Float32Array(numVerts * 4);
            const has4J = o.joints.length >= numVerts * 4;
            const has4W = o.weights.length >= numVerts * 4;

            for (let v = 0; v < numVerts; v++) {
                jArr[v * 4] = toUint8Safe([o.joints[v * 3]], 1)[0];
                jArr[v * 4 + 1] = toUint8Safe([o.joints[v * 3 + 1]], 1)[0];
                jArr[v * 4 + 2] = toUint8Safe([o.joints[v * 3 + 2]], 1)[0];
                jArr[v * 4 + 3] = has4J ? toUint8Safe([o.joints[v * 4 + 3]], 1)[0] : 0;

                wArr[v * 4] = Number.isFinite(Number(o.weights[v * 3])) ? Number(o.weights[v * 3]) : 0;
                wArr[v * 4 + 1] = Number.isFinite(Number(o.weights[v * 3 + 1])) ? Number(o.weights[v * 3 + 1]) : 0;
                wArr[v * 4 + 2] = Number.isFinite(Number(o.weights[v * 3 + 2])) ? Number(o.weights[v * 3 + 2]) : 0;
                wArr[v * 4 + 3] = has4W && Number.isFinite(Number(o.weights[v * 4 + 3]))
                    ? Number(o.weights[v * 4 + 3])
                    : 0;
            }

            const okJ = setVertexStreamSafe(mesh, pc.SEMANTIC_BLENDINDICES, jArr, 4, pc.TYPE_UINT8, false);
            const okW = setVertexStreamSafe(mesh, pc.SEMANTIC_BLENDWEIGHT, wArr, 4, pc.TYPE_FLOAT32, false);
            skinApplied = okJ && okW;
        }

        if (safeIdx && safeIdx.length >= 3) {
            mesh.setIndices(safeIdx);
        }

        updateMeshSafe(mesh);

        return {
            mesh: mesh,
            posArr: posArr,
            normArr: normArr,
            safeIdx: safeIdx,
            skinApplied: skinApplied
        };
    }

    function captureNodeTransformRecord(b) {
        const eul = (b && typeof b.getLocalEulerAngles === 'function')
            ? b.getLocalEulerAngles()
            : { x: 0, y: 0, z: 0 };
        const quat = (b && typeof b.getLocalRotation === 'function')
            ? b.getLocalRotation()
            : { x: 0, y: 0, z: 0, w: 1 };
        const pos = (b && typeof b.getLocalPosition === 'function')
            ? b.getLocalPosition()
            : { x: 0, y: 0, z: 0 };
        const scl = (b && typeof b.getLocalScale === 'function')
            ? b.getLocalScale()
            : { x: 1, y: 1, z: 1 };
        return {
            name: (b && b.name) || '',
            x: Number(eul.x) || 0,
            y: Number(eul.y) || 0,
            z: Number(eul.z) || 0,
            qx: Number(quat.x) || 0,
            qy: Number(quat.y) || 0,
            qz: Number(quat.z) || 0,
            qw: Number.isFinite(Number(quat.w)) ? Number(quat.w) : 1,
            px: Number(pos.x) || 0,
            py: Number(pos.y) || 0,
            pz: Number(pos.z) || 0,
            sx: Number.isFinite(Number(scl.x)) ? Number(scl.x) : 1,
            sy: Number.isFinite(Number(scl.y)) ? Number(scl.y) : 1,
            sz: Number.isFinite(Number(scl.z)) ? Number(scl.z) : 1
        };
    }

    function collectHelperNodesFromHierarchy(rootEntity, deformBoneSet) {
        const helpers = [];
        const seen = new Set();
        function walk(node) {
            if (!node) return;
            if (node !== rootEntity && !seen.has(node)) {
                seen.add(node);
                const name = String(node.name || '');
                const isInternalPivot = name.indexOf('vtf_anatomy_') === 0;
                const isMeshOnlyNode = !!(node.render && (!node.children || node.children.length === 0));
                if (!isInternalPivot && !isMeshOnlyNode && (!deformBoneSet || !deformBoneSet.has(node))) {
                    helpers.push(node);
                }
            }
            const children = node.children || [];
            for (let i = 0; i < children.length; i++) {
                walk(children[i]);
            }
        }
        walk(rootEntity);
        return helpers;
    }

    /**
     * Memindai seluruh komponen render dalam hierarki entitas, memisahkan:
     * - `bones`: joint deformasi yang dipakai oleh `skinInstance.bones`
     * - `helperNodes`: node/helper non-deformasi dalam hierarki (misal spring/hair/accessory)
     */
    function collectRigFromEntity(entity, forceCaptureBindPose) {
        const result = {
            hasSkinned: false,
            renderComponents: [],
            skinInstances: [],
            bones: [],
            helperNodes: [],
            allNodes: [],
            bindPose: [],
            helperBindPose: []
        };
        if (!entity) return result;

        let renders = [];
        if (typeof entity.findComponents === 'function') {
            renders = entity.findComponents('render') || [];
        } else if (entity.render) {
            renders = [entity.render];
        }

        result.renderComponents = renders;

        const seenSkins = new Set();
        const seenBones = new Set();

        for (let i = 0; i < renders.length; i++) {
            const rc = renders[i];
            if (!rc || !Array.isArray(rc.meshInstances)) continue;
            for (let j = 0; j < rc.meshInstances.length; j++) {
                const mi = rc.meshInstances[j];
                if (!mi || !mi.skinInstance) continue;
                const si = mi.skinInstance;
                if (!seenSkins.has(si)) {
                    seenSkins.add(si);
                    result.skinInstances.push(si);
                }
                if (Array.isArray(si.bones)) {
                    for (let k = 0; k < si.bones.length; k++) {
                        const b = si.bones[k];
                        if (b && !seenBones.has(b)) {
                            seenBones.add(b);
                            result.bones.push(b);
                        }
                    }
                }
            }
        }

        result.helperNodes = collectHelperNodesFromHierarchy(entity, seenBones);
        result.allNodes = result.bones.concat(result.helperNodes);
        result.hasSkinned = result.skinInstances.length > 0 && result.bones.length > 0;

        if (result.hasSkinned) {
            const needCapture = forceCaptureBindPose ||
                !Array.isArray(entity._bindPose) ||
                entity._bindPose.length !== result.bones.length;

            if (needCapture) {
                entity._bindPose = result.bones.map(captureNodeTransformRecord);
            }
            entity._rigBones = result.bones;
            result.bindPose = entity._bindPose;
        }

        if (result.helperNodes.length > 0) {
            const needHelperCapture = forceCaptureBindPose ||
                !Array.isArray(entity._helperBindPose) ||
                entity._helperBindPose.length !== result.helperNodes.length;

            if (needHelperCapture) {
                entity._helperBindPose = result.helperNodes.map(captureNodeTransformRecord);
            }
            entity._helperNodes = result.helperNodes;
            result.helperBindPose = entity._helperBindPose;
        }

        return result;
    }

    window.collectRigFromEntity = collectRigFromEntity;
    window.VtfPcCompat = {
        version: '1.2.0',
        toFloat32Safe: toFloat32Safe,
        toUint8Safe: toUint8Safe,
        buildSafeIndexArray: buildSafeIndexArray,
        computeNormalsSafe: computeNormalsSafe,
        setVertexStreamSafe: setVertexStreamSafe,
        updateMeshSafe: updateMeshSafe,
        buildMeshCompat: buildMeshCompat,
        collectRigFromEntity: collectRigFromEntity
    };
})();
