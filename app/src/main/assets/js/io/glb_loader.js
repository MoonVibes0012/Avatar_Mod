/* ===== VTuber Forge — js/io/glb_loader.js ===== */
// Loader & Builder model .GLB / .VRM (Fix Skin boneNames & VRM MToon/WebView Textures)

(function () {
    'use strict';

    function getAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function getStateSafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        if (!window.S) window.S = { objects: [], selected: null, cnt: 1 };
        return window.S;
    }

    function setGlbStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        }
    }

    function clampByteRange(totalLength, offset, length) {
        const safeTotal = Math.max(0, Math.floor(Number(totalLength) || 0));
        const safeOffset = Math.max(0, Math.min(safeTotal, Math.floor(Number(offset) || 0)));
        const rawLen = Math.max(0, Math.floor(Number(length) || 0));
        const safeLen = Math.max(0, Math.min(rawLen, safeTotal - safeOffset));
        return { start: safeOffset, end: safeOffset + safeLen, length: safeLen };
    }

    function loadImageElement(srcUrl) {
        return new Promise((resolve) => {
            if (!srcUrl) return resolve(null);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = srcUrl;
        });
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve) => {
            try {
                const fr = new FileReader();
                fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(blob);
            } catch (e) {
                resolve(null);
            }
        });
    }

    function decodeGlbTextures(gltf, bin, graphicsDevice) {
        const textures = [];
        if (!Array.isArray(gltf.images) || gltf.images.length === 0) {
            return Promise.resolve(textures);
        }

        const tasks = [];
        for (let i = 0; i < gltf.images.length; i++) {
            const imgInfo = gltf.images[i];
            if (!imgInfo) continue;

            // Kasus 1: Image embedded lewat URI (data:image/...;base64,...)
            if (typeof imgInfo.uri === 'string' && imgInfo.uri.startsWith('data:')) {
                const texIndex = i;
                tasks.push(
                    loadImageElement(imgInfo.uri).then((img) => {
                        if (img) {
                            try {
                                const tex = new pc.Texture(graphicsDevice, {
                                    mipmaps: true,
                                    addressU: pc.ADDRESS_REPEAT,
                                    addressV: pc.ADDRESS_REPEAT
                                });
                                tex.setSource(img);
                                textures[texIndex] = tex;
                            } catch (e) {}
                        }
                    })
                );
                continue;
            }

            // Kasus 2: Image di dalam binary chunk lewat bufferView
            if (!bin || !bin.buffer || imgInfo.bufferView === undefined || !gltf.bufferViews || !gltf.bufferViews[imgInfo.bufferView]) {
                continue;
            }

            const bv = gltf.bufferViews[imgInfo.bufferView];
            const range = clampByteRange(bin.byteLength, bv.byteOffset || 0, bv.byteLength || 0);
            if (range.length <= 0) continue;

            const slice = bin.subarray(range.start, range.end);
            const mime = String(imgInfo.mimeType || 'image/png').toLowerCase();
            const isDds = mime.includes('dds') || (
                slice.length >= 4 &&
                slice[0] === 0x44 && slice[1] === 0x44 && slice[2] === 0x53 && slice[3] === 0x20
            );

            if (isDds && window.VtfDdsLoader && typeof window.VtfDdsLoader.createTexture === 'function') {
                try {
                    const ddsBuf = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
                    textures[i] = window.VtfDdsLoader.createTexture(graphicsDevice, ddsBuf, imgInfo.name || 'glb_dds');
                } catch (e) {
                    console.warn('DDS decode error:', e);
                }
                continue;
            }

            const texIndex = i;
            tasks.push((async () => {
                const blob = new Blob([slice], { type: imgInfo.mimeType || 'image/png' });
                let img = null;
                let blobUrl = '';

                try {
                    blobUrl = URL.createObjectURL(blob);
                    img = await loadImageElement(blobUrl);
                } catch (e) {
                    img = null;
                } finally {
                    if (blobUrl) {
                        try { URL.revokeObjectURL(blobUrl); } catch (e) {}
                    }
                }

                // Fallback DataURL untuk Android WebView jika blob: URL diblokir/gagal
                if (!img) {
                    const dataUrl = await blobToDataUrl(blob);
                    if (dataUrl) {
                        img = await loadImageElement(dataUrl);
                    }
                }

                if (img) {
                    try {
                        const tex = new pc.Texture(graphicsDevice, {
                            mipmaps: true,
                            addressU: pc.ADDRESS_REPEAT,
                            addressV: pc.ADDRESS_REPEAT
                        });
                        tex.setSource(img);
                        textures[texIndex] = tex;
                    } catch (e) {}
                }
            })());
        }
        return Promise.all(tasks).then(() => textures);
    }

    function resolveTextureByIndex(gltf, textures, texIdx) {
        if (texIdx === undefined || texIdx === null || !Array.isArray(gltf.textures)) return null;
        const texDef = gltf.textures[texIdx];
        if (!texDef || texDef.source === undefined) return null;
        return textures[texDef.source] || null;
    }

    function buildGlbMaterials(gltf, textures) {
        const vrmMatProps = (gltf.extensions && gltf.extensions.VRM && Array.isArray(gltf.extensions.VRM.materialProperties))
            ? gltf.extensions.VRM.materialProperties
            : [];

        return (gltf.materials || []).map((m, idx) => {
            const mat = new pc.StandardMaterial();
            const pbr = (m && m.pbrMetallicRoughness) ? m.pbrMetallicRoughness : {};
            const vrmProp = vrmMatProps[idx] || null;

            let bc = Array.isArray(pbr.baseColorFactor) && pbr.baseColorFactor.length >= 4
                ? pbr.baseColorFactor
                : [1, 1, 1, 1];

            if (vrmProp && vrmProp.vectorProperties && Array.isArray(vrmProp.vectorProperties._Color) && vrmProp.vectorProperties._Color.length >= 4) {
                bc = vrmProp.vectorProperties._Color;
            }

            mat.diffuse = new pc.Color(bc[0], bc[1], bc[2]);

            // 1. Cari tekstur standar glTF PBR baseColorTexture
            let diffuseTex = null;
            if (pbr.baseColorTexture && pbr.baseColorTexture.index !== undefined) {
                diffuseTex = resolveTextureByIndex(gltf, textures, pbr.baseColorTexture.index);
            }

            // 2. Fallback ke VRM 0.x MToon _MainTex
            if (!diffuseTex && vrmProp && vrmProp.textureProperties && vrmProp.textureProperties._MainTex !== undefined) {
                diffuseTex = resolveTextureByIndex(gltf, textures, vrmProp.textureProperties._MainTex);
            }

            // 3. Fallback ke VRM 1.0 VRMC_materials_mtoon
            if (!diffuseTex && m && m.extensions && m.extensions.VRMC_materials_mtoon) {
                const mtoon1 = m.extensions.VRMC_materials_mtoon;
                if (mtoon1.shadeMultiplyTexture && mtoon1.shadeMultiplyTexture.index !== undefined) {
                    diffuseTex = resolveTextureByIndex(gltf, textures, mtoon1.shadeMultiplyTexture.index);
                }
            }

            if (diffuseTex) {
                mat.diffuseMap = diffuseTex;
            }

            mat.metalness = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0;
            mat.gloss = 1 - (pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 0.75);

            // Render dua sisi untuk rambut/pakaian VRM
            if ((m && m.doubleSided) || (vrmProp && vrmProp.floatProperties && vrmProp.floatProperties._CullMode === 0)) {
                mat.cull = pc.CULLFACE_NONE;
            }

            if (m && m.alphaMode === 'BLEND') {
                mat.blendType = pc.BLEND_NORMAL;
                mat.opacity = bc[3];
                mat.depthWrite = false;
            } else if (m && m.alphaMode === 'MASK') {
                mat.alphaTest = m.alphaCutoff !== undefined ? m.alphaCutoff : 0.5;
            }

            mat.update();
            return mat;
        });
    }

    function createAccessorReader(gltf, bin) {
        return (idx) => {
            if (idx === undefined || idx === null || !gltf.accessors || !gltf.accessors[idx]) return null;
            if (!bin || !bin.buffer || bin.byteLength <= 0) return null;

            const acc = gltf.accessors[idx];
            if (acc.bufferView === undefined || !gltf.bufferViews || !gltf.bufferViews[acc.bufferView]) return null;

            const bv = gltf.bufferViews[acc.bufferView];
            const compMap = {
                5120: Int8Array,
                5121: Uint8Array,
                5122: Int16Array,
                5123: Uint16Array,
                5125: Uint32Array,
                5126: Float32Array
            };
            const typeMap = {
                SCALAR: 1,
                VEC2: 2,
                VEC3: 3,
                VEC4: 4,
                MAT2: 4,
                MAT3: 9,
                MAT4: 16
            };

            const Ctor = compMap[acc.componentType] || Float32Array;
            const numComp = typeMap[acc.type] || 1;
            const bytesPerComp = Ctor.BYTES_PER_ELEMENT;
            const elemBytes = bytesPerComp * numComp;
            const stride = (bv.byteStride && bv.byteStride >= elemBytes) ? bv.byteStride : elemBytes;

            const bvStart = Math.max(0, Math.floor(Number(bv.byteOffset) || 0));
            const bvLen = bv.byteLength !== undefined
                ? Math.max(0, Math.floor(Number(bv.byteLength) || 0))
                : Math.max(0, bin.byteLength - bvStart);
            const bvRange = clampByteRange(bin.byteLength, bvStart, bvLen);

            const accOff = Math.max(0, Math.floor(Number(acc.byteOffset) || 0));
            const startInBin = bvRange.start + accOff;
            const maxBytesInView = Math.max(0, bvRange.end - startInBin);

            const requestedCount = Math.max(0, Math.floor(Number(acc.count) || 0));
            const maxRowsByBytes = stride > 0 ? Math.floor(maxBytesInView / stride) : 0;
            const safeCount = Math.min(requestedCount, maxRowsByBytes);

            const outLen = Math.max(0, safeCount * numComp);
            const result = new Ctor(outLen);
            if (safeCount <= 0 || outLen <= 0 || startInBin >= bin.byteLength) return result;

            const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
            for (let i = 0; i < safeCount; i++) {
                const rowStart = startInBin + i * stride;
                if (rowStart < 0 || rowStart + elemBytes > bin.byteLength) break;

                for (let c = 0; c < numComp; c++) {
                    const bytePos = rowStart + c * bytesPerComp;
                    if (bytePos + bytesPerComp > bin.byteLength) break;

                    let val = 0;
                    if (acc.componentType === 5126) val = dv.getFloat32(bytePos, true);
                    else if (acc.componentType === 5123) val = dv.getUint16(bytePos, true);
                    else if (acc.componentType === 5125) val = dv.getUint32(bytePos, true);
                    else if (acc.componentType === 5121) val = dv.getUint8(bytePos);
                    else if (acc.componentType === 5120) val = dv.getInt8(bytePos);
                    else if (acc.componentType === 5122) val = dv.getInt16(bytePos, true);
                    else val = dv.getFloat32(bytePos, true);

                    result[i * numComp + c] = Number.isFinite(val) ? val : 0;
                }
            }
            return result;
        };
    }

    function importGLB(file) {
        const pcApp = getAppSafe();
        const st = getStateSafe();
        if (!pcApp || !pcApp.graphicsDevice || !pcApp.root) {
            return setGlbStatus('⚠ Engine PlayCanvas belum siap.');
        }
        if (!file) {
            return setGlbStatus('⚠ File model tidak ditemukan.');
        }

        let stage = 'baca file';
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                stage = 'parsing header GLB/VRM';
                setGlbStatus('⏳ Parsing struktur GLB/VRM: ' + file.name + '...');
                const buf = e.target.result;
                if (!(buf instanceof ArrayBuffer) || buf.byteLength < 20) {
                    throw new Error('Buffer file tidak valid atau kosong.');
                }

                const d = new DataView(buf);
                if (d.getUint32(0, true) !== 0x46546C67) {
                    throw new Error('Bukan file GLB/VRM biner valid.');
                }

                const jsonLen = d.getUint32(12, true);
                if (jsonLen <= 0 || 20 + jsonLen > buf.byteLength) {
                    throw new Error('Panjang chunk JSON tidak valid.');
                }

                const jsonText = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
                const gltf = JSON.parse(jsonText);

                const binHeaderOff = 20 + jsonLen;
                let bin = null;
                if (buf.byteLength >= binHeaderOff + 8) {
                    const binLen = d.getUint32(binHeaderOff, true);
                    const binDataOff = binHeaderOff + 8;
                    const binRange = clampByteRange(buf.byteLength, binDataOff, binLen);
                    if (binRange.length > 0) {
                        bin = new Uint8Array(buf, binRange.start, binRange.length);
                    }
                }

                if (gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
                    throw new Error('Model memakai kompresi Draco. Harap export ulang tanpa Draco.');
                }

                stage = 'decode tekstur & material';
                setGlbStatus('⏳ Memuat tekstur & material...');
                const textures = await decodeGlbTextures(gltf, bin, pcApp.graphicsDevice);
                const loadedTexCount = textures.filter(Boolean).length;
                setGlbStatus(`⏳ Tekstur dimuat: ${loadedTexCount}/${(gltf.images || []).length}...`);
                const materials = buildGlbMaterials(gltf, textures);
                const getAcc = createAccessorReader(gltf, bin);

                stage = 'membangun node & hierarki';
                st.cnt = st.cnt || 1;
                st.objects = st.objects || [];
                const rootEnt = new pc.Entity(file.name.replace(/\.(glb|vrm|gltf)$/i, '') + '_' + (st.cnt++));
                const allPositions = [];
                const allIndices = [];
                const allUvs = [];
                const allNormals = [];
                let vtxOffset = 0;

                const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
                const nodeEntities = nodes.map((n, i) => {
                    const ent = new pc.Entity((n && n.name) ? n.name : 'Node_' + i);
                    if (n && Array.isArray(n.translation) && n.translation.length >= 3) {
                        ent.setLocalPosition(n.translation[0] || 0, n.translation[1] || 0, n.translation[2] || 0);
                    }
                    if (n && Array.isArray(n.rotation) && n.rotation.length >= 4) {
                        ent.setLocalRotation(new pc.Quat(n.rotation[0] || 0, n.rotation[1] || 0, n.rotation[2] || 0, n.rotation[3] || 1));
                    }
                    if (n && Array.isArray(n.scale) && n.scale.length >= 3) {
                        ent.setLocalScale(n.scale[0] || 1, n.scale[1] || 1, n.scale[2] || 1);
                    }
                    return ent;
                });

                nodes.forEach((n, i) => {
                    if (n && Array.isArray(n.children)) {
                        n.children.forEach((c) => {
                            if (nodeEntities[c] && nodeEntities[i] !== nodeEntities[c]) {
                                nodeEntities[i].addChild(nodeEntities[c]);
                            }
                        });
                    }
                });

                const sceneIdx = gltf.scene !== undefined ? gltf.scene : 0;
                const rootNodes = (gltf.scenes && gltf.scenes[sceneIdx] && Array.isArray(gltf.scenes[sceneIdx].nodes))
                    ? gltf.scenes[sceneIdx].nodes
                    : [];
                if (rootNodes.length > 0) {
                    rootNodes.forEach((rn) => {
                        if (nodeEntities[rn]) rootEnt.addChild(nodeEntities[rn]);
                    });
                } else {
                    nodeEntities.forEach((ne, i) => {
                        if (!nodes.some((n) => n && Array.isArray(n.children) && n.children.includes(i))) {
                            rootEnt.addChild(ne);
                        }
                    });
                }

                stage = 'membangun skin & tulang';
                const skins = (Array.isArray(gltf.skins) ? gltf.skins : []).map((sk) => {
                    const bones = (Array.isArray(sk && sk.joints) ? sk.joints : [])
                        .map((j) => nodeEntities[j])
                        .filter(Boolean);
                    if (bones.length === 0) return null;

                    const ibmArr = (sk && sk.inverseBindMatrices !== undefined) ? getAcc(sk.inverseBindMatrices) : null;
                    const ibms = [];
                    if (ibmArr && ibmArr.length >= bones.length * 16) {
                        for (let i = 0; i < bones.length; i++) {
                            const m = new pc.Mat4();
                            const slice16 = ibmArr.subarray(i * 16, i * 16 + 16);
                            const f32 = new Float32Array(16);
                            for (let k = 0; k < 16; k++) f32[k] = slice16[k] || 0;
                            m.data.set(f32);
                            ibms.push(m);
                        }
                    } else {
                        bones.forEach(() => ibms.push(new pc.Mat4()));
                    }

                    const boneNames = bones.map((b, idx) => b.name || ('Bone_' + idx));
                    const skinObj = new pc.Skin(pcApp.graphicsDevice, ibms, boneNames);
                    return {
                        skin: skinObj,
                        bones: bones
                    };
                });

                let hasMorphs = false;
                const morphTargetsList = [];

                stage = 'membangun mesh & morph target';
                nodes.forEach((n, i) => {
                    if (n && n.mesh !== undefined && Array.isArray(gltf.meshes) && gltf.meshes[n.mesh]) {
                        const meshDef = gltf.meshes[n.mesh];
                        const ent = nodeEntities[i];
                        const meshInstances = [];
                        const targetNames = (meshDef.extras && Array.isArray(meshDef.extras.targetNames))
                            ? meshDef.extras.targetNames
                            : [];

                        (Array.isArray(meshDef.primitives) ? meshDef.primitives : []).forEach((prim, pIdx) => {
                            if (!prim || !prim.attributes) return;
                            let subStep = `prim[${pIdx}].read`;

                            const pos = getAcc(prim.attributes.POSITION);
                            if (!pos || pos.length < 3) return;

                            const numVerts = Math.floor(pos.length / 3);
                            if (numVerts <= 0) return;

                            const norm = prim.attributes.NORMAL !== undefined ? getAcc(prim.attributes.NORMAL) : null;
                            const uv = prim.attributes.TEXCOORD_0 !== undefined ? getAcc(prim.attributes.TEXCOORD_0) : null;
                            const idx = prim.indices !== undefined ? getAcc(prim.indices) : null;
                            const joints = prim.attributes.JOINTS_0 !== undefined ? getAcc(prim.attributes.JOINTS_0) : null;
                            const weights = prim.attributes.WEIGHTS_0 !== undefined ? getAcc(prim.attributes.WEIGHTS_0) : null;

                            try {
                                subStep = `prim[${pIdx}].pos_norm_uv`;
                                const mesh = new pc.Mesh(pcApp.graphicsDevice);

                                const posArr = new Float32Array(numVerts * 3);
                                for (let p = 0; p < numVerts * 3; p++) posArr[p] = pos[p] || 0;
                                mesh.setPositions(posArr);

                                let safeIdxPlain = null;
                                if (idx && idx.length >= 3) {
                                    const triCount = Math.floor(idx.length / 3) * 3;
                                    if (triCount > 0) {
                                        safeIdxPlain = new Array(triCount);
                                        for (let k = 0; k < triCount; k++) {
                                            const iv = idx[k] || 0;
                                            safeIdxPlain[k] = iv < numVerts ? iv : 0;
                                        }
                                    }
                                }

                                if (norm && norm.length >= numVerts * 3) {
                                    const normArr = new Float32Array(numVerts * 3);
                                    for (let p = 0; p < numVerts * 3; p++) normArr[p] = norm[p] || 0;
                                    mesh.setNormals(normArr);
                                } else {
                                    const calcIdx = safeIdxPlain || Array.from({ length: numVerts }, (_, k) => k);
                                    mesh.setNormals(pc.calculateNormals(posArr, calcIdx));
                                }

                                if (uv && uv.length >= numVerts * 2) {
                                    const uvArr = new Float32Array(numVerts * 2);
                                    for (let p = 0; p < numVerts * 2; p++) uvArr[p] = uv[p] || 0;
                                    mesh.setUvs(0, uvArr);
                                }

                                subStep = `prim[${pIdx}].skin_stream`;
                                let hasSkinStream = false;
                                if (joints && weights && joints.length >= numVerts * 3 && weights.length >= numVerts * 3) {
                                    const jArr = new Uint8Array(numVerts * 4);
                                    const wArr = new Float32Array(numVerts * 4);
                                    const has4J = joints.length >= numVerts * 4;
                                    const has4W = weights.length >= numVerts * 4;

                                    for (let v = 0; v < numVerts; v++) {
                                        jArr[v * 4] = joints[v * 3] || 0;
                                        jArr[v * 4 + 1] = joints[v * 3 + 1] || 0;
                                        jArr[v * 4 + 2] = joints[v * 3 + 2] || 0;
                                        jArr[v * 4 + 3] = has4J ? (joints[v * 4 + 3] || 0) : 0;

                                        wArr[v * 4] = weights[v * 3] || 0;
                                        wArr[v * 4 + 1] = weights[v * 3 + 1] || 0;
                                        wArr[v * 4 + 2] = weights[v * 3 + 2] || 0;
                                        wArr[v * 4 + 3] = has4W ? (weights[v * 4 + 3] || 0) : 0;
                                    }
                                    mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, jArr, 4, pc.TYPE_UINT8, false);
                                    mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, wArr, 4, pc.TYPE_FLOAT32, false);
                                    hasSkinStream = true;
                                }

                                subStep = `prim[${pIdx}].indices`;
                                if (safeIdxPlain && safeIdxPlain.length >= 3) {
                                    let maxIdx = 0;
                                    for (let k = 0; k < safeIdxPlain.length; k++) {
                                        if (safeIdxPlain[k] > maxIdx) maxIdx = safeIdxPlain[k];
                                    }
                                    const safeIdx = (maxIdx > 65535 || safeIdxPlain.length % 2 !== 0)
                                        ? new Uint32Array(safeIdxPlain)
                                        : new Uint16Array(safeIdxPlain);
                                    mesh.setIndices(safeIdx);
                                }

                                subStep = `prim[${pIdx}].morph`;
                                let morphInst = null;
                                if (Array.isArray(prim.targets) && prim.targets.length > 0) {
                                    try {
                                        const targets = prim.targets.map((t, tIdx) => {
                                            const dPos = (t && t.POSITION !== undefined) ? getAcc(t.POSITION) : null;
                                            const dNorm = (t && t.NORMAL !== undefined) ? getAcc(t.NORMAL) : null;
                                            const mName = targetNames[tIdx] || `Shape_${tIdx}`;

                                            const dPosArr = new Float32Array(numVerts * 3);
                                            if (dPos && dPos.length > 0) {
                                                const copyLen = Math.min(dPos.length, numVerts * 3);
                                                for (let p = 0; p < copyLen; p++) dPosArr[p] = dPos[p] || 0;
                                            }

                                            const dNormArr = new Float32Array(numVerts * 3);
                                            let hasValidNorm = false;
                                            if (dNorm && dNorm.length > 0) {
                                                const copyLen = Math.min(dNorm.length, numVerts * 3);
                                                for (let p = 0; p < copyLen; p++) dNormArr[p] = dNorm[p] || 0;
                                                hasValidNorm = true;
                                            }

                                            return new pc.MorphTarget({
                                                name: mName,
                                                deltaPositions: dPosArr,
                                                deltaNormals: hasValidNorm ? dNormArr : null
                                            });
                                        });

                                        if (targets.length > 0) {
                                            mesh.morph = new pc.Morph(targets, pcApp.graphicsDevice);
                                            morphInst = new pc.MorphInstance(mesh.morph);
                                            hasMorphs = true;
                                            morphTargetsList.push({
                                                meshInstance: null,
                                                morphInstance: morphInst,
                                                names: targets.map((t) => t.name)
                                            });
                                        }
                                    } catch (morphErr) {
                                        console.warn(`Morph dilewati pada ${subStep}:`, morphErr);
                                        mesh.morph = null;
                                        morphInst = null;
                                    }
                                }

                                subStep = `prim[${pIdx}].update`;
                                try {
                                    mesh.update();
                                } catch (updErr) {
                                    // Jika gagal saat morph terpasang, coba lepas morph lalu update ulang
                                    if (mesh.morph) {
                                        mesh.morph = null;
                                        morphInst = null;
                                        try {
                                            mesh.update();
                                        } catch (updErr2) {
                                            console.warn(`Fallback mesh update pada ${subStep}:`, updErr2);
                                        }
                                    } else {
                                        console.warn(`Fallback mesh update pada ${subStep}:`, updErr);
                                    }
                                }

                                const mat = (prim.material !== undefined && materials[prim.material])
                                    ? materials[prim.material]
                                    : new pc.StandardMaterial();
                                const mi = new pc.MeshInstance(mesh, mat);

                                // Pasang skinInstance hanya jika skin, bones, dan vertex stream valid agar tidak error 'boneNames'
                                if (hasSkinStream && n.skin !== undefined && skins[n.skin] && skins[n.skin].skin && skins[n.skin].bones.length > 0) {
                                    const skObj = skins[n.skin];
                                    const skinInst = new pc.SkinInstance(skObj.skin);
                                    if (!skinInst.skin) skinInst.skin = skObj.skin;
                                    skinInst.bones = skObj.bones;
                                    if (skinInst.skin && Array.isArray(skinInst.skin.boneNames)) {
                                        mi.skinInstance = skinInst;
                                    }
                                }

                                if (morphInst) {
                                    mi.morphInstance = morphInst;
                                    morphTargetsList[morphTargetsList.length - 1].meshInstance = mi;
                                }
                                meshInstances.push(mi);

                                for (let p = 0; p < numVerts * 3; p++) allPositions.push(posArr[p]);
                                if (uv && uv.length >= numVerts * 2) {
                                    for (let u = 0; u < numVerts * 2; u++) allUvs.push(uv[u] || 0);
                                }
                                if (norm && norm.length >= numVerts * 3) {
                                    for (let nm = 0; nm < numVerts * 3; nm++) allNormals.push(norm[nm] || 0);
                                }
                                if (safeIdxPlain && safeIdxPlain.length >= 3) {
                                    for (let k = 0; k < safeIdxPlain.length; k++) {
                                        allIndices.push(safeIdxPlain[k] + vtxOffset);
                                    }
                                } else {
                                    for (let k = 0; k < numVerts; k++) allIndices.push(k + vtxOffset);
                                }
                                vtxOffset += numVerts;
                            } catch (primErr) {
                                const pMsg = (primErr && primErr.message) ? primErr.message : String(primErr);
                                throw new Error(`${subStep} -> ${pMsg}`);
                            }
                        });

                        if (meshInstances.length > 0 && ent) {
                            ent.addComponent('render', { type: 'asset' });
                            ent.render.meshInstances = meshInstances;
                        }
                    }
                });

                if (allPositions.length === 0) {
                    throw new Error('Tidak ada data mesh ditemukan.');
                }

                if (hasMorphs && morphTargetsList.length > 0) {
                    rootEnt._morphInstance = morphTargetsList[0].morphInstance;
                    rootEnt._morphNames = morphTargetsList[0].names;
                }

                stage = 'normalisasi & memasukkan ke scene';
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                for (let i = 0; i < allPositions.length; i += 3) {
                    const x = allPositions[i], y = allPositions[i + 1], z = allPositions[i + 2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }

                const sizeY = maxY - minY;
                const normScale = (Number.isFinite(sizeY) && sizeY > 0.001) ? (2.0 / sizeY) : 1.0;
                rootEnt.setLocalScale(normScale, normScale, normScale);
                rootEnt.setPosition(
                    -((minX + maxX) * 0.5) * normScale,
                    -minY * normScale,
                    -((minZ + maxZ) * 0.5) * normScale
                );

                rootEnt._meshCache = {
                    positions: allPositions,
                    indices: allIndices,
                    uvs: allUvs,
                    normals: allNormals
                };
                rootEnt._isGLB = true;
                if (!Array.isArray(window.meshCachePool)) window.meshCachePool = [];
                window.meshCachePool.push(rootEnt._meshCache);

                pcApp.root.addChild(rootEnt);
                st.objects.push(rootEnt);

                if (typeof window.selectObject === 'function') window.selectObject(rootEnt);
                if (typeof window.updateTree === 'function') window.updateTree();
                if (typeof window.saveState === 'function') window.saveState();

                setGlbStatus(`✓ Model Imported: ${file.name} (Tekstur: ${loadedTexCount})`);
            } catch (err) {
                const detail = (err && err.message) ? err.message : String(err);
                const msg = `Gagal import GLB/VRM [${stage}]: ${detail}`;
                console.error('GLB Import Error:', err);
                setGlbStatus('⚠ ' + msg);
                alert(msg);
            }
        };
        r.onerror = () => {
            setGlbStatus('⚠ Gagal membaca file dari penyimpanan.');
        };
        r.readAsArrayBuffer(file);
    }

    window.importGLB = importGLB;
})();
