/* ===== VTuber Forge — js/io/glb_loader.js ===== */
// Loader & Builder model .GLB / .VRM / .GLTF (tekstur, material PBR, node, skin, morph)

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
        if (typeof window.dbg === 'function') try { window.dbg(msg); } catch (e) {}
    }

    function decodeGlbTextures(gltf, bin, graphicsDevice) {
        const textures = [];
        if (!gltf.images || !bin) return Promise.resolve(textures);

        const tasks = [];
        for (let i = 0; i < gltf.images.length; i++) {
            const imgInfo = gltf.images[i];
            if (imgInfo.bufferView === undefined || !gltf.bufferViews || !gltf.bufferViews[imgInfo.bufferView]) continue;
            
            const bv = gltf.bufferViews[imgInfo.bufferView];
            const slice = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + (bv.byteLength || 0));
            const mime = String(imgInfo.mimeType || 'image/png').toLowerCase();
            const isDds = mime.includes('dds') || (slice.length >= 4 && slice[0] === 0x44 && slice[1] === 0x44 && slice[2] === 0x53 && slice[3] === 0x20);

            if (isDds && window.VtfDdsLoader) {
                try {
                    const ddsBuf = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
                    textures[i] = window.VtfDdsLoader.createTexture(graphicsDevice, ddsBuf, imgInfo.name || 'glb_dds');
                } catch (e) { console.warn('DDS decode error:', e); }
                continue;
            }

            const texIndex = i;
            tasks.push(new Promise((resolve) => {
                const blob = new Blob([slice], { type: imgInfo.mimeType || 'image/png' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    try {
                        const tex = new pc.Texture(graphicsDevice, { mipmaps: true });
                        tex.setSource(img);
                        textures[texIndex] = tex;
                    } catch (e) {} finally { URL.revokeObjectURL(url); resolve(); }
                };
                img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
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
                if (texDef && textures[texDef.source]) mat.diffuseMap = textures[texDef.source];
            }
            mat.metalness = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0;
            mat.gloss = 1 - (pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 0.5);
            if (m.alphaMode === 'BLEND') { mat.blendType = pc.BLEND_NORMAL; mat.opacity = bc[3]; mat.depthWrite = false; }
            mat.update();
            return mat;
        });
    }

    function createAccessorReader(gltf, bin) {
        return (idx) => {
            if (idx === undefined || idx === null || !gltf.accessors || !gltf.accessors[idx]) return null;
            if (!bin || !bin.buffer) return null;

            const acc = gltf.accessors[idx];
            if (acc.bufferView === undefined || !gltf.bufferViews || !gltf.bufferViews[acc.bufferView]) return null;
            
            const bv = gltf.bufferViews[acc.bufferView];
            const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
            const compMap = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
            const typeMap = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
            
            const Ctor = compMap[acc.componentType] || Float32Array;
            const numComp = typeMap[acc.type] || 1;
            const bytesPerComp = Ctor.BYTES_PER_ELEMENT;
            const elemBytes = bytesPerComp * numComp;
            const stride = (bv.byteStride && bv.byteStride > 0) ? bv.byteStride : elemBytes;
            const count = Math.max(0, acc.count || 0);

            const result = new Ctor(Math.floor(count * numComp));
            if (count === 0 || off < 0) return result;

            const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
            for (let i = 0; i < count; i++) {
                const rowStart = off + i * stride;
                if (rowStart + elemBytes > bin.byteLength) break;
                for (let c = 0; c < numComp; c++) {
                    const bytePos = rowStart + c * bytesPerComp;
                    if (acc.componentType === 5126) result[i * numComp + c] = dv.getFloat32(bytePos, true);
                    else if (acc.componentType === 5123) result[i * numComp + c] = dv.getUint16(bytePos, true);
                    else if (acc.componentType === 5125) result[i * numComp + c] = dv.getUint32(bytePos, true);
                    else if (acc.componentType === 5121) result[i * numComp + c] = dv.getUint8(bytePos);
                    else if (acc.componentType === 5120) result[i * numComp + c] = dv.getInt8(bytePos);
                    else if (acc.componentType === 5122) result[i * numComp + c] = dv.getInt16(bytePos, true);
                }
            }
            return result;
        };
    }

    function importGLB(file) {
        const pcApp = getAppSafe();
        const st = getStateSafe();
        if (!pcApp || !pcApp.graphicsDevice || !pcApp.root) return setGlbStatus('⚠ Engine PlayCanvas belum siap.');

        const r = new FileReader();
        r.onload = async (e) => {
            try {
                setGlbStatus('⏳ Parsing struktur GLB/VRM: ' + file.name + '...');
                const buf = e.target.result;
                const d = new DataView(buf);
                if (buf.byteLength < 20 || d.getUint32(0, true) !== 0x46546C67) throw new Error('Bukan file GLB valid.');

                const jsonLen = d.getUint32(12, true);
                const jsonText = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
                const gltf = JSON.parse(jsonText);

                const binHeaderOff = 20 + jsonLen;
                let bin = null;
                if (buf.byteLength >= binHeaderOff + 8) {
                    const binLen = d.getUint32(binHeaderOff, true);
                    const binDataOff = binHeaderOff + 8;
                    bin = new Uint8Array(buf, binDataOff, Math.min(binLen, buf.byteLength - binDataOff));
                }

                if (gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
                    throw new Error('Model memakai kompresi Draco. Harap export ulang tanpa Draco.');
                }

                setGlbStatus('⏳ Memuat tekstur & material...');
                const textures = await decodeGlbTextures(gltf, bin, pcApp.graphicsDevice);
                const materials = buildGlbMaterials(gltf, textures);
                const getAcc = createAccessorReader(gltf, bin);

                st.cnt = st.cnt || 1;
                st.objects = st.objects || [];
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
                    if (n.children) n.children.forEach((c) => { if (nodeEntities[c]) nodeEntities[i].addChild(nodeEntities[c]); });
                });

                const sceneIdx = gltf.scene !== undefined ? gltf.scene : 0;
                const rootNodes = (gltf.scenes && gltf.scenes[sceneIdx] && gltf.scenes[sceneIdx].nodes) ? gltf.scenes[sceneIdx].nodes : [];
                if (rootNodes.length > 0) rootNodes.forEach((rn) => { if (nodeEntities[rn]) rootEnt.addChild(nodeEntities[rn]); });
                else nodeEntities.forEach((ne, i) => { if (!nodes.some((n) => n.children && n.children.includes(i))) rootEnt.addChild(ne); });

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
                    } else bones.forEach(() => ibms.push(new pc.Mat4()));
                    return { skin: new pc.Skin(pcApp.graphicsDevice, ibms, bones.map((b) => b.name)), bones: bones };
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
                            
                            // KUNCI PERBAIKAN: Hitung jumlah vertex secara absolut
                            const numVerts = Math.floor(pos.length / 3);
                            const norm = getAcc(prim.attributes.NORMAL);
                            const uv = getAcc(prim.attributes.TEXCOORD_0);
                            const idx = prim.indices !== undefined ? getAcc(prim.indices) : null;
                            const joints = getAcc(prim.attributes.JOINTS_0);
                            const weights = getAcc(prim.attributes.WEIGHTS_0);

                            const mesh = new pc.Mesh(pcApp.graphicsDevice);
                            mesh.setPositions(pos.subarray(0, numVerts * 3));
                            
                            if (norm && norm.length >= numVerts * 3) {
                                mesh.setNormals(norm.subarray(0, numVerts * 3));
                            } else {
                                const defaultIdx = Array.from({ length: numVerts }, (_, k) => k);
                                mesh.setNormals(pc.calculateNormals(pos.subarray(0, numVerts * 3), idx || defaultIdx));
                            }
                            
                            if (uv && uv.length >= numVerts * 2) {
                                mesh.setUvs(0, uv.subarray(0, numVerts * 2)); // Paksa ukuran sama
                            }
                            
                            if (joints && weights && joints.length >= numVerts * 4 && weights.length >= numVerts * 4) {
                                mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, joints.subarray(0, numVerts * 4), 4, pc.TYPE_UINT8, false);
                                mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights.subarray(0, numVerts * 4), 4, pc.TYPE_FLOAT32, false);
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
                                        deltaPositions: (dPos && dPos.length >= numVerts * 3) ? dPos.subarray(0, numVerts * 3) : new Float32Array(numVerts * 3),
                                        deltaNormals: (dNorm && dNorm.length >= numVerts * 3) ? dNorm.subarray(0, numVerts * 3) : null
                                    });
                                });
                                mesh.morph = new pc.Morph(targets, pcApp.graphicsDevice);
                                morphInst = new pc.MorphInstance(mesh.morph);
                                hasMorphs = true;
                                morphTargetsList.push({ meshInstance: null, morphInstance: morphInst, names: targets.map((t) => t.name) });
                            }

                            mesh.update();

                            const mat = (prim.material !== undefined && materials[prim.material]) ? materials[prim.material] : new pc.StandardMaterial();
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

                            for (let p = 0; p < numVerts * 3; p++) allPositions.push(pos[p]);
                            if (uv) for (let u = 0; u < numVerts * 2; u++) allUvs.push(uv[u]);
                            if (norm) for (let nm = 0; nm < numVerts * 3; nm++) allNormals.push(norm[nm]);
                            if (idx) {
                                for (let k = 0; k < idx.length; k++) allIndices.push(idx[k] + vtxOffset);
                            } else {
                                for (let k = 0; k < numVerts; k++) allIndices.push(k + vtxOffset);
                            }
                            vtxOffset += numVerts;
                        });

                        if (meshInstances.length > 0) {
                            ent.addComponent('render', { type: 'asset' });
                            ent.render.meshInstances = meshInstances;
                        }
                    }
                });

                if (allPositions.length === 0) throw new Error('Tidak ada data mesh ditemukan.');

                if (hasMorphs && morphTargetsList.length > 0) {
                    rootEnt._morphInstance = morphTargetsList[0].morphInstance;
                    rootEnt._morphNames = morphTargetsList[0].names;
                }

                let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                for (let i = 0; i < allPositions.length; i += 3) {
                    const x = allPositions[i], y = allPositions[i + 1], z = allPositions[i + 2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }
                const sizeY = maxY - minY;
                const normScale = (sizeY > 0.001) ? (2.0 / sizeY) : 1.0;
                rootEnt.setLocalScale(normScale, normScale, normScale);
                rootEnt.setPosition(-(minX + maxX) * 0.5 * normScale, -minY * normScale, -(minZ + maxZ) * 0.5 * normScale);

                rootEnt._meshCache = { positions: allPositions, indices: allIndices, uvs: allUvs, normals: allNormals };
                rootEnt._isGLB = true;
                if (!Array.isArray(window.meshCachePool)) window.meshCachePool = [];
                window.meshCachePool.push(rootEnt._meshCache);

                pcApp.root.addChild(rootEnt);
                st.objects.push(rootEnt);

                if (typeof window.selectObject === 'function') window.selectObject(rootEnt);
                if (typeof window.updateTree === 'function') window.updateTree();
                if (typeof window.saveState === 'function') window.saveState();

                setGlbStatus('✓ Model Imported: ' + file.name);
            } catch (err) {
                const msg = 'Gagal import GLB/VRM: ' + (err && err.message ? err.message : err);
                console.error('GLB Import Error:', err);
                setGlbStatus('⚠ ' + msg);
                try { alert(msg); } catch (e) {}
            }
        };
        r.onerror = () => setGlbStatus('⚠ Gagal membaca file dari penyimpanan.');
        r.readAsArrayBuffer(file);
    }

    window.importGLB = importGLB;
})();
