/* ===== VTuber Forge — js/io/glb_loader.js ===== */
// Loader & Builder model .GLB / .VRM / .GLTF (tekstur, material PBR, node, skin, morph, & normalisasi)

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
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        if (!window.S) {
            window.S = { objects: [], selected: null, cnt: 1 };
        }
        return window.S;
    }

    function setGlbStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        }
    }

    function decodeGlbTextures(gltf, bin, graphicsDevice) {
        const textures = [];
        if (!gltf.images || !bin) return Promise.resolve(textures);

        const tasks = [];
        for (let i = 0; i < gltf.images.length; i++) {
            const imgInfo = gltf.images[i];
            if (imgInfo.bufferView === undefined || !gltf.bufferViews || !gltf.bufferViews[imgInfo.bufferView]) {
                continue;
            }
            const bv = gltf.bufferViews[imgInfo.bufferView];
            const byteOffset = bv.byteOffset || 0;
            const byteLength = bv.byteLength || 0;
            if (byteOffset < 0 || byteLength <= 0 || byteOffset + byteLength > bin.byteLength) continue;

            const slice = bin.subarray(byteOffset, byteOffset + byteLength);
            const mime = String(imgInfo.mimeType || 'image/png').toLowerCase();
            const isDds = mime.includes('dds') ||
                          (slice.byteLength >= 4 && slice[0] === 0x44 && slice[1] === 0x44 && slice[2] === 0x53 && slice[3] === 0x20);

            if (isDds && window.VtfDdsLoader && typeof window.VtfDdsLoader.createTexture === 'function') {
                try {
                    const ddsBuf = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
                    textures[i] = window.VtfDdsLoader.createTexture(graphicsDevice, ddsBuf, imgInfo.name || ('glb_dds_' + i));
                } catch (ddsErr) {
                    console.warn('Gagal decode tekstur DDS di dalam GLB:', ddsErr);
                }
                continue;
            }

            const texIndex = i;
            tasks.push(new Promise((resolve) => {
                const blob = new Blob([slice], { type: imgInfo.mimeType || 'image/png' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    try {
                        let targetCanvas = img;
                        const maxDim = 1024;
                        if (img.width > maxDim || img.height > maxDim) {
                            const scale = maxDim / Math.max(img.width, img.height);
                            const c = document.createElement('canvas');
                            c.width = Math.max(1, Math.round(img.width * scale));
                            c.height = Math.max(1, Math.round(img.height * scale));
                            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                            targetCanvas = c;
                        }
                        const tex = new pc.Texture(graphicsDevice, {
                            mipmaps: true,
                            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
                            magFilter: pc.FILTER_LINEAR,
                            addressU: pc.ADDRESS_REPEAT,
                            addressV: pc.ADDRESS_REPEAT
                        });
                        tex.setSource(targetCanvas);
                        textures[texIndex] = tex;
                    } catch (err) {
                        console.warn('Gagal membuat tekstur GLB:', err);
                    } finally {
                        URL.revokeObjectURL(url);
                        resolve();
                    }
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.src = url;
            }));
        }

        return Promise.all(tasks).then(() => textures);
    }

    function buildGlbMaterials(gltf, textures) {
        return (gltf.materials || []).map((m) => {
            const mat = new pc.StandardMaterial();
            const pbr = m.pbrMetallicRoughness || {};
            const bc = pbr.baseColorFactor || [1, 1, 1, 1];
            mat.diffuse = new pc.Color(bc[0], bc[1], bc[2]);

            if (pbr.baseColorTexture && gltf.textures) {
                const texDef = gltf.textures[pbr.baseColorTexture.index];
                if (texDef && textures[texDef.source]) {
                    mat.diffuseMap = textures[texDef.source];
                }
            }
            if (m.normalTexture && gltf.textures) {
                const normDef = gltf.textures[m.normalTexture.index];
                if (normDef && textures[normDef.source]) {
                    mat.normalMap = textures[normDef.source];
                }
            }
            if (m.emissiveTexture && gltf.textures) {
                const emDef = gltf.textures[m.emissiveTexture.index];
                if (emDef && textures[emDef.source]) {
                    mat.emissiveMap = textures[emDef.source];
                    const ef = m.emissiveFactor || [1, 1, 1];
                    mat.emissive = new pc.Color(ef[0], ef[1], ef[2]);
                }
            }

            mat.metalness = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0;
            mat.gloss = 1 - (pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 0.5);

            if (m.alphaMode === 'BLEND') {
                mat.blendType = pc.BLEND_NORMAL;
                mat.opacity = bc[3];
                mat.depthWrite = false;
            } else if (m.alphaMode === 'MASK') {
                mat.alphaTest = m.alphaCutoff !== undefined ? m.alphaCutoff : 0.5;
            }

            mat.twoSidedLighting = !!m.doubleSided;
            mat.cull = m.doubleSided ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
            mat.update();
            return mat;
        });
    }

    function createAccessorReader(gltf, bin) {
        return (idx) => {
            if (idx === undefined || idx === null || !gltf.accessors || !gltf.accessors[idx]) return null;
            if (!bin || !bin.buffer) return null;

            const acc = gltf.accessors[idx];
            if (!gltf.bufferViews || acc.bufferView === undefined || !gltf.bufferViews[acc.bufferView]) {
                return null;
            }
            const bv = gltf.bufferViews[acc.bufferView];
            const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);

            const compMap = {
                5120: { Ctor: Int8Array, bytes: 1 },
                5121: { Ctor: Uint8Array, bytes: 1 },
                5122: { Ctor: Int16Array, bytes: 2 },
                5123: { Ctor: Uint16Array, bytes: 2 },
                5125: { Ctor: Uint32Array, bytes: 4 },
                5126: { Ctor: Float32Array, bytes: 4 }
            };
            const typeMap = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
            const spec = compMap[acc.componentType] || { Ctor: Float32Array, bytes: 4 };
            const numComp = typeMap[acc.type] || 1;
            const elemBytes = spec.bytes * numComp;
            const stride = (bv.byteStride && bv.byteStride > 0) ? bv.byteStride : elemBytes;
            const count = Math.max(0, acc.count || 0);

            // PERBAIKAN: Gunakan Math.floor untuk mencegah error typed array length
            const totalLen = Math.floor(count * numComp);
            const result = new spec.Ctor(totalLen);
            if (count === 0 || off < 0) return result;

            const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
            for (let i = 0; i < count; i++) {
                const rowStart = off + i * stride;
                if (rowStart + elemBytes > bin.byteLength) break;

                for (let c = 0; c < numComp; c++) {
                    const bytePos = rowStart + c * spec.bytes;
                    let val = 0;
                    if (acc.componentType === 5126) val = dv.getFloat32(bytePos, true);
                    else if (acc.componentType === 5123) val = dv.getUint16(bytePos, true);
                    else if (acc.componentType === 5125) val = dv.getUint32(bytePos, true);
                    else if (acc.componentType === 5121) val = dv.getUint8(bytePos);
                    else if (acc.componentType === 5120) val = dv.getInt8(bytePos);
                    else if (acc.componentType === 5122) val = dv.getInt16(bytePos, true);
                    result[i * numComp + c] = val;
                }
            }
            return result;
        };
    }

    function importGLB(file) {
        const pcApp = getAppSafe();
        const st = getStateSafe();
        if (!pcApp || !pcApp.graphicsDevice || !pcApp.root) {
            const msg = 'Engine PlayCanvas belum siap untuk memuat model.';
            setGlbStatus('⚠ ' + msg);
            try { alert(msg); } catch (e) {}
            return;
        }

        const r = new FileReader();
        r.onload = async (e) => {
            try {
                setGlbStatus('⏳ Parsing struktur GLB/VRM: ' + file.name + '...');
                const buf = e.target.result;
                const d = new DataView(buf);
                if (buf.byteLength < 20 || d.getUint32(0, true) !== 0x46546C67) {
                    throw new Error('File bukan GLB/VRM valid (magic mismatch)');
                }

                const jsonLen = d.getUint32(12, true);
                if (20 + jsonLen > buf.byteLength) {
                    throw new Error('Panjang chunk JSON GLB tidak valid');
                }
                const jsonText = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
                const gltf = JSON.parse(jsonText);

                const binHeaderOff = 20 + jsonLen;
                let bin = null;
                if (buf.byteLength >= binHeaderOff + 8) {
                    const binLen = d.getUint32(binHeaderOff, true);
                    const binDataOff = binHeaderOff + 8;
                    const safeBinLen = Math.min(binLen, Math.max(0, buf.byteLength - binDataOff));
                    if (safeBinLen > 0) {
                        bin = new Uint8Array(buf, binDataOff, safeBinLen);
                    }
                }

                if (gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
                    throw new Error('Model memakai kompresi Draco (export ulang tanpa Draco)');
                }

                setGlbStatus('⏳ Memuat tekstur & material: ' + file.name + '...');
                const textures = await decodeGlbTextures(gltf, bin, pcApp.graphicsDevice);
                const materials = buildGlbMaterials(gltf, textures);
                const getAcc = createAccessorReader(gltf, bin);

                st.cnt = st.cnt || 1;
                st.objects = st.objects || []; // PERBAIKAN: Gunakan st.objects
                const rootEnt = new pc.Entity(file.name.replace(/\.(glb|vrm|gltf)$/i, '') + '_' + (st.cnt++));
                const allPositions = [], allIndices = [], allUvs = [], allNormals = [];
                let vtxOffset = 0;

                const nodes = gltf.nodes || [];
                const nodeEntities = nodes.map((n, i) => {
                    const ent = new pc.Entity(n.name || 'Node_' + i);
                    if (n.translation) ent.setLocalPosition(...n.translation);
                    if (n.rotation) ent.setLocalRotation(new pc.Quat(...n.rotation));
                    if (n.scale) ent.setLocalScale(...n.scale);
                    return ent;
                });

                nodes.forEach((n, i) => {
                    if (n.children) {
                        n.children.forEach((c) => {
                            if (nodeEntities[c]) nodeEntities[i].addChild(nodeEntities[c]);
                        });
                    }
                });

                const sceneIdx = gltf.scene !== undefined ? gltf.scene : 0;
                const rootNodes = (gltf.scenes && gltf.scenes[sceneIdx] && gltf.scenes[sceneIdx].nodes)
                    ? gltf.scenes[sceneIdx].nodes
                    : [];
                if (rootNodes.length > 0) {
                    rootNodes.forEach((rn) => {
                        if (nodeEntities[rn]) rootEnt.addChild(nodeEntities[rn]);
                    });
                } else {
                    nodeEntities.forEach((ne, i) => {
                        if (!nodes.some((n) => n.children && n.children.includes(i))) {
                            rootEnt.addChild(ne);
                        }
                    });
                }

                const skins = (gltf.skins || []).map((sk) => {
                    const bones = (sk.joints || []).map((j) => nodeEntities[j]).filter(Boolean);
                    const ibmArr = sk.inverseBindMatrices !== undefined ? getAcc(sk.inverseBindMatrices) : null;
                    const ibms = [];
                    if (ibmArr && ibmArr.length >= bones.length * 16) {
                        for (let i = 0; i < bones.length; i++) {
                            const m = new pc.Mat4();
                            m.data.set(ibmArr.subarray(i * 16, i * 16 + 16));
                            ibms.push(m);
                        }
                    } else {
                        bones.forEach(() => ibms.push(new pc.Mat4()));
                    }
                    const skin = new pc.Skin(pcApp.graphicsDevice, ibms, bones.map((b) => b.name));
                    return { skin: skin, bones: bones };
                });

                let hasMorphs = false;
                const morphTargetsList = [];

                nodes.forEach((n, i) => {
                    if (n.mesh !== undefined && gltf.meshes && gltf.meshes[n.mesh]) {
                        const meshDef = gltf.meshes[n.mesh];
                        const ent = nodeEntities[i];
                        const meshInstances = [];
                        const targetNames = (meshDef.extras && meshDef.extras.targetNames) ? meshDef.extras.targetNames : [];

                        (meshDef.primitives || []).forEach((prim) => {
                            if (!prim.attributes) return;
                            const pos = getAcc(prim.attributes.POSITION);
                            if (!pos || pos.length < 3) return;
                            const norm = getAcc(prim.attributes.NORMAL);
                            const uv = getAcc(prim.attributes.TEXCOORD_0);
                            const idx = prim.indices !== undefined ? getAcc(prim.indices) : null;
                            const joints = getAcc(prim.attributes.JOINTS_0);
                            const weights = getAcc(prim.attributes.WEIGHTS_0);

                            const mesh = new pc.Mesh(pcApp.graphicsDevice);
                            mesh.setPositions(pos);
                            if (norm && norm.length === pos.length) {
                                mesh.setNormals(norm);
                            } else {
                                mesh.setNormals(pc.calculateNormals(pos, idx || Array.from({ length: Math.floor(pos.length / 3) }, (_, k) => k)));
                            }
                            if (uv && uv.length >= Math.floor(pos.length / 3) * 2) mesh.setUvs(0, uv);
                            if (joints && weights && joints.length === Math.floor(pos.length / 3) * 4 && weights.length === Math.floor(pos.length / 3) * 4) {
                                mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, joints, 4, pc.TYPE_UINT8, false);
                                mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights, 4, pc.TYPE_FLOAT32, false);
                            }
                            if (idx && idx.length > 0) mesh.setIndices(idx);

                            let morphInst = null;
                            if (prim.targets && prim.targets.length > 0) {
                                const targets = prim.targets.map((t, tIdx) => {
                                    const dPos = getAcc(t.POSITION);
                                    const dNorm = getAcc(t.NORMAL);
                                    const mName = targetNames[tIdx] || `Shape_${tIdx}`;
                                    return new pc.MorphTarget({
                                        name: mName,
                                        // PERBAIKAN: Gunakan Math.floor untuk mencegah error typed array
                                        deltaPositions: (dPos && dPos.length === pos.length) ? dPos : new Float32Array(Math.floor(pos.length)),
                                        deltaNormals: (dNorm && dNorm.length === pos.length) ? dNorm : null
                                    });
                                });
                                mesh.morph = new pc.Morph(targets, pcApp.graphicsDevice);
                                morphInst = new pc.MorphInstance(mesh.morph);
                                hasMorphs = true;
                                morphTargetsList.push({ meshInstance: null, morphInstance: morphInst, names: targets.map((t) => t.name) });
                            }

                            mesh.update();

                            const mat = (prim.material !== undefined && materials[prim.material])
                                ? materials[prim.material]
                                : new pc.StandardMaterial();
                            const mi = new pc.MeshInstance(mesh, mat);
                            if (n.skin !== undefined && skins[n.skin]) {
                                const skObj = skins[n.skin];
                                const skinInst = new pc.SkinInstance(skObj.skin);
                                skinInst.bones = skObj.bones;
                                mi.skinInstance = skinInst;
                            }
                            if (morphInst) {
                                mi.morphInstance = morphInst;
                                morphTargetsList[morphTargetsList.length - 1].meshInstance = mi;
                            }
                            meshInstances.push(mi);

                            for (let p = 0; p < pos.length; p++) allPositions.push(pos[p]);
                            if (uv) for (let u = 0; u < uv.length; u++) allUvs.push(uv[u]);
                            if (norm) for (let nm = 0; nm < norm.length; nm++) allNormals.push(norm[nm]);
                            if (idx) {
                                for (let k = 0; k < idx.length; k++) allIndices.push(idx[k] + vtxOffset);
                            } else {
                                for (let k = 0; k < Math.floor(pos.length / 3); k++) allIndices.push(k + vtxOffset);
                            }
                            vtxOffset += Math.floor(pos.length / 3);
                        });

                        if (meshInstances.length > 0) {
                            ent.addComponent('render', { type: 'asset' });
                            ent.render.meshInstances = meshInstances;
                        }
                    }
                });

                if (allPositions.length === 0) {
                    throw new Error('Tidak ada data mesh yang ditemukan dalam file GLB/VRM.');
                }

                if (hasMorphs && morphTargetsList.length > 0) {
                    rootEnt._morphInstance = morphTargetsList[0].morphInstance;
                    rootEnt._morphNames = morphTargetsList[0].names;
                }

                if (gltf.animations && gltf.animations.length > 0) {
                    rootEnt._animNames = gltf.animations.map((a, idx) => a.name || `Clip_${idx}`);
                    rootEnt._animAssets = [];
                }

                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                for (let i = 0; i < allPositions.length; i += 3) {
                    const x = allPositions[i], y = allPositions[i + 1], z = allPositions[i + 2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }
                const sizeY = maxY - minY;
                const targetHeight = 2.0;
                const normScale = (sizeY > 0.001) ? (targetHeight / sizeY) : 1.0;

                rootEnt.setLocalScale(normScale, normScale, normScale);
                const cx = (minX + maxX) * 0.5 * normScale;
                const cz = (minZ + maxZ) * 0.5 * normScale;
                const cy = minY * normScale;
                rootEnt.setPosition(-cx, -cy, -cz);

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
                st.objects.push(rootEnt); // PERBAIKAN: Gunakan st.objects

                if (typeof window.selectObject === 'function') window.selectObject(rootEnt);
                else if (typeof selectObject === 'function') selectObject(rootEnt);
                if (typeof window.updateTree === 'function') window.updateTree();
                else if (typeof updateTree === 'function') updateTree();
                if (typeof window.saveState === 'function') window.saveState();
                else if (typeof saveState === 'function') saveState();

                setGlbStatus(
                    '✓ Model Imported: ' + file.name + (hasMorphs ? ` (${rootEnt._morphNames.length} morphs)` : '')
                );
            } catch (err) {
                const msg = 'Gagal import GLB/VRM: ' + (err && err.message ? err.message : err);
                console.error('GLB Import Error:', err);
                setGlbStatus('⚠ ' + msg);
                try { alert(msg); } catch (e) {}
            }
        };
        r.onerror = function () {
            const msg = 'Gagal membaca file GLB/VRM dari penyimpanan.';
            setGlbStatus('⚠ ' + msg);
            try { alert(msg); } catch (e) {}
        };
        r.readAsArrayBuffer(file);
    }

    window.importGLB = importGLB;
})();
