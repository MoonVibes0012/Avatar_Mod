/* ===== VTuber Forge — js/io/import.js ===== */
// Import model 3D (.OBJ, .GLB/.VRM) & Tekstur (.DDS) (Android & Browser)

function applyDdsTextureToEntity(targetEntity, ddsTex, fileName) {
    if (!targetEntity || !ddsTex) return 0;
    let appliedCount = 0;

    if (typeof targetEntity.findComponents === 'function') {
        const renders = targetEntity.findComponents('render');
        for (let i = 0; i < renders.length; i++) {
            const mis = renders[i].meshInstances || [];
            for (let j = 0; j < mis.length; j++) {
                const mi = mis[j];
                if (!mi || !mi.material) continue;
                const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                for (let k = 0; k < mats.length; k++) {
                    const m = mats[k];
                    if (!m) continue;
                    if (m.diffuseMap && m.diffuseMap !== ddsTex && typeof m.diffuseMap.destroy === 'function') {
                        try { m.diffuseMap.destroy(); } catch (e) {}
                    }
                    m.diffuseMap = ddsTex;
                    m.diffuse = new pc.Color(1, 1, 1);
                    if (typeof m.update === 'function') m.update();
                    appliedCount++;
                }
            }
        }
    }

    targetEntity._ddsTextureName = fileName || 'texture.dds';
    return appliedCount;
}

function importDdsFile(file) {
    if (!file) return;
    if (!window.VtfDdsLoader || typeof window.VtfDdsLoader.createTexture !== 'function') {
        alert('Modul DDS Loader belum siap.');
        return;
    }

    const r = new FileReader();
    r.onload = function (ev) {
        try {
            const buf = ev.target.result;
            const ddsTex = window.VtfDdsLoader.createTexture(app.graphicsDevice, buf, file.name);
            let target = (typeof S !== 'undefined' && S && S.selected) ? S.selected : null;

            if (!target && typeof addObj === 'function') {
                target = addObj('box');
                if (target) {
                    target.name = file.name.replace(/\.dds$/i, '') + '_DDS';
                }
            }

            if (!target) {
                throw new Error('Tidak ada objek target untuk menerapkan tekstur DDS.');
            }

            const count = applyDdsTextureToEntity(target, ddsTex, file.name);
            if (typeof selectObject === 'function') selectObject(target);
            if (typeof updateTree === 'function') updateTree();
            if (typeof saveState === 'function') saveState();

            const fmt = ddsTex._vtfDdsFormat || 'DDS';
            document.getElementById('status').textContent =
                '✓ Tekstur DDS (' + fmt + ', ' + ddsTex.width + 'x' + ddsTex.height + ') diterapkan ke ' +
                (target.name || 'objek') + ' (' + count + ' material)';
            if (typeof dbg === 'function') {
                dbg('✓ DDS loaded: ' + file.name + ' [' + fmt + ' ' + ddsTex.width + 'x' + ddsTex.height + ']');
            }
        } catch (err) {
            console.error('DDS Import Error:', err);
            alert('Gagal membaca file DDS: ' + (err && err.message ? err.message : err));
        }
    };
    r.readAsArrayBuffer(file);
}

// Import .OBJ
function importOBJ(file) {
    const r = new FileReader();
    r.onload = e => {
        try {
            const lines = e.target.result.split('\n');
            const v = [], n = [], u = [], f = [];
            lines.forEach(l => {
                const p = l.trim().split(/\s+/);
                if (p[0] === 'v') v.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0]);
                else if (p[0] === 'vn') n.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0]);
                else if (p[0] === 'vt') u.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0]);
                else if (p[0] === 'f') {
                    const poly = p.slice(1).map(s => {
                        const i = s.split('/').map(x => parseInt(x) - 1);
                        return { v: i[0], u: i[1], n: i[2] };
                    });
                    for (let j = 1; j < poly.length - 1; j++) f.push(poly[0], poly[j], poly[j + 1]);
                }
            });

            if (v.length === 0 || f.length === 0) throw new Error("File OBJ kosong atau format tidak valid.");

            const pos = [], norm = [], uv = [], idx = [];
            let c = 0;
            f.forEach(pt => {
                if (v[pt.v]) {
                    pos.push(...v[pt.v]);
                    norm.push(...(n[pt.n] || [0, 1, 0]));
                    uv.push(...(u[pt.u] || [0, 0]));
                    idx.push(c++);
                }
            });

            const m = new pc.Mesh(app.graphicsDevice);
            m.setPositions(pos);
            m.setNormals(norm);
            m.setUvs(0, uv);
            m.setIndices(idx);
            m.update();

            const ent = new pc.Entity(file.name.replace(/\.obj$/i, '') + '_' + (S.cnt++));
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(0.55, 0.45, 0.85);
            mat.gloss = 0.5;
            mat.update();

            ent.addComponent('render', { type: 'asset' });
            ent.render.meshInstances = [new pc.MeshInstance(m, mat)];
            ent.setPosition(0, 1, 0);

            ent._meshCache = {
                positions: Array.from(pos),
                indices: Array.from(idx),
                uvs: Array.from(uv),
                normals: Array.from(norm)
            };
            ent._isObj = true;
            if (typeof meshCachePool !== 'undefined') meshCachePool.push(ent._meshCache);

            app.root.addChild(ent);
            S.objs.push(ent);
            selectObject(ent);
            updateTree();
            saveState();
            document.getElementById('status').textContent = '✓ OBJ Imported: ' + file.name;
        } catch (err) {
            console.error("OBJ Import Error:", err);
            alert("Gagal import OBJ: " + err.message);
        }
    };
    r.readAsText(file);
}

// Import .GLB / .VRM
function importGLB(file) {
    const r = new FileReader();
    r.onload = async e => {
        try {
            const buf = e.target.result;
            const d = new DataView(buf);
            if (d.getUint32(0, true) !== 0x46546C67) throw new Error('File bukan GLB/VRM valid (magic mismatch)');

            const jsonLen = d.getUint32(12, true);
            const jsonText = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
            const gltf = JSON.parse(jsonText);

            const binOffset = 20 + jsonLen + 8;
            let bin = null;
            if (buf.byteLength >= binOffset) {
                const binLen = d.getUint32(20 + jsonLen, true);
                if (buf.byteLength >= binOffset + binLen) {
                    bin = new Uint8Array(buf, binOffset, binLen);
                }
            }

            if (gltf.extensionsUsed && gltf.extensionsUsed.includes('KHR_draco_mesh_compression')) {
                alert('Model ini menggunakan kompresi Draco yang tidak didukung tanpa decoder terpisah. Mohon export ulang tanpa Draco compression.');
                return;
            }

            const textures = [];
            if (gltf.images && bin) {
                for (let i = 0; i < gltf.images.length; i++) {
                    const imgInfo = gltf.images[i];
                    if (imgInfo.bufferView !== undefined) {
                        const bv = gltf.bufferViews[imgInfo.bufferView];
                        const slice = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
                        const mime = String(imgInfo.mimeType || 'image/png').toLowerCase();
                        const isDds = mime.includes('dds') ||
                                      (slice.byteLength >= 4 && slice[0] === 0x44 && slice[1] === 0x44 && slice[2] === 0x53 && slice[3] === 0x20);

                        if (isDds && window.VtfDdsLoader && typeof window.VtfDdsLoader.createTexture === 'function') {
                            try {
                                const ddsBuf = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
                                textures[i] = window.VtfDdsLoader.createTexture(app.graphicsDevice, ddsBuf, imgInfo.name || ('glb_dds_' + i));
                            } catch (ddsErr) {
                                console.warn('Gagal decode tekstur DDS di dalam GLB:', ddsErr);
                            }
                        } else {
                            const blob = new Blob([slice], { type: imgInfo.mimeType || 'image/png' });
                            const url = URL.createObjectURL(blob);
                            await new Promise(res => {
                                const img = new Image();
                                img.onload = () => {
                                    let targetCanvas = img;
                                    const maxDim = 1024;
                                    if (img.width > maxDim || img.height > maxDim) {
                                        const scale = maxDim / Math.max(img.width, img.height);
                                        const c = document.createElement('canvas');
                                        c.width = Math.round(img.width * scale);
                                        c.height = Math.round(img.height * scale);
                                        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                                        targetCanvas = c;
                                    }
                                    const tex = new pc.Texture(app.graphicsDevice, {
                                        mipmaps: true,
                                        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
                                        magFilter: pc.FILTER_LINEAR,
                                        addressU: pc.ADDRESS_REPEAT,
                                        addressV: pc.ADDRESS_REPEAT
                                    });
                                    tex.setSource(targetCanvas);
                                    textures[i] = tex;
                                    URL.revokeObjectURL(url);
                                    res();
                                };
                                img.onerror = () => { URL.revokeObjectURL(url); res(); };
                                img.src = url;
                            });
                        }
                    }
                }
            }

            const materials = (gltf.materials || []).map(m => {
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

            const getAcc = (idx) => {
                if (idx === undefined || !gltf.accessors || !gltf.accessors[idx]) return null;
                const acc = gltf.accessors[idx];
                const bv = gltf.bufferViews[acc.bufferView];
                const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
                const compMap = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
                const typeMap = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
                const Arr = compMap[acc.componentType] || Float32Array;
                const numComp = typeMap[acc.type] || 1;
                const stride = bv.byteStride || 0;

                if (stride === 0 || stride === Arr.BYTES_PER_ELEMENT * numComp) {
                    const alignedBuf = bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + acc.count * numComp * Arr.BYTES_PER_ELEMENT);
                    return new Arr(alignedBuf);
                } else {
                    const result = new Arr(acc.count * numComp);
                    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
                    for (let i = 0; i < acc.count; i++) {
                        for (let c = 0; c < numComp; c++) {
                            const bytePos = off + i * stride + c * Arr.BYTES_PER_ELEMENT;
                            if (acc.componentType === 5126) result[i * numComp + c] = dv.getFloat32(bytePos, true);
                            else if (acc.componentType === 5123) result[i * numComp + c] = dv.getUint16(bytePos, true);
                            else if (acc.componentType === 5125) result[i * numComp + c] = dv.getUint32(bytePos, true);
                            else if (acc.componentType === 5121) result[i * numComp + c] = dv.getUint8(bytePos);
                            else if (acc.componentType === 5120) result[i * numComp + c] = dv.getInt8(bytePos);
                            else if (acc.componentType === 5122) result[i * numComp + c] = dv.getInt16(bytePos, true);
                        }
                    }
                    return result;
                }
            };

            const rootEnt = new pc.Entity(file.name.replace(/\.(glb|vrm|gltf)$/i, '') + '_' + (S.cnt++));
            const allPositions = [], allIndices = [], allUvs = [], allNormals = [];
            let vtxOffset = 0;

            const nodes = gltf.nodes || [];
            const nodeEntities = nodes.map((n, i) => {
                const e = new pc.Entity(n.name || 'Node_' + i);
                if (n.translation) e.setLocalPosition(...n.translation);
                if (n.rotation) e.setLocalRotation(new pc.Quat(...n.rotation));
                if (n.scale) e.setLocalScale(...n.scale);
                return e;
            });

            nodes.forEach((n, i) => {
                if (n.children) n.children.forEach(c => nodeEntities[i].addChild(nodeEntities[c]));
            });

            const sceneIdx = gltf.scene !== undefined ? gltf.scene : 0;
            const rootNodes = (gltf.scenes && gltf.scenes[sceneIdx] && gltf.scenes[sceneIdx].nodes) ? gltf.scenes[sceneIdx].nodes : [];
            if (rootNodes.length > 0) {
                rootNodes.forEach(rn => rootEnt.addChild(nodeEntities[rn]));
            } else {
                nodeEntities.forEach((ne, i) => {
                    if (!nodes.some(n => n.children && n.children.includes(i))) rootEnt.addChild(ne);
                });
            }

            const skins = (gltf.skins || []).map(sk => {
                const bones = (sk.joints || []).map(j => nodeEntities[j]);
                const ibmArr = sk.inverseBindMatrices !== undefined ? getAcc(sk.inverseBindMatrices) : null;
                const ibms = [];
                if (ibmArr) {
                    for (let i = 0; i < bones.length; i++) {
                        const m = new pc.Mat4();
                        m.data.set(ibmArr.subarray(i * 16, i * 16 + 16));
                        ibms.push(m);
                    }
                } else {
                    bones.forEach(() => ibms.push(new pc.Mat4()));
                }
                const skin = new pc.Skin(app.graphicsDevice, ibms, bones.map(b => b.name));
                return { skin, bones };
            });

            let hasMorphs = false;
            const morphTargetsList = [];

            nodes.forEach((n, i) => {
                if (n.mesh !== undefined && gltf.meshes && gltf.meshes[n.mesh]) {
                    const meshDef = gltf.meshes[n.mesh];
                    const ent = nodeEntities[i];
                    const meshInstances = [];
                    const targetNames = (meshDef.extras && meshDef.extras.targetNames) ? meshDef.extras.targetNames : [];

                    (meshDef.primitives || []).forEach(prim => {
                        const pos = getAcc(prim.attributes.POSITION);
                        if (!pos) return;
                        const norm = getAcc(prim.attributes.NORMAL);
                        const uv = getAcc(prim.attributes.TEXCOORD_0);
                        const idx = prim.indices !== undefined ? getAcc(prim.indices) : null;
                        const joints = getAcc(prim.attributes.JOINTS_0);
                        const weights = getAcc(prim.attributes.WEIGHTS_0);

                        const mesh = new pc.Mesh(app.graphicsDevice);
                        mesh.setPositions(pos);
                        if (norm) mesh.setNormals(norm);
                        else mesh.setNormals(pc.calculateNormals(pos, idx || Array.from({ length: pos.length / 3 }, (_, k) => k)));
                        if (uv) mesh.setUvs(0, uv);
                        if (joints && weights) {
                            mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, joints, 4, pc.TYPE_UINT8, false);
                            mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights, 4, pc.TYPE_FLOAT32, false);
                        }
                        if (idx) mesh.setIndices(idx);

                        let morphInst = null;
                        if (prim.targets && prim.targets.length > 0) {
                            const targets = prim.targets.map((t, tIdx) => {
                                const dPos = getAcc(t.POSITION);
                                const dNorm = getAcc(t.NORMAL);
                                const mName = targetNames[tIdx] || `Shape_${tIdx}`;
                                return new pc.MorphTarget({
                                    name: mName,
                                    deltaPositions: dPos || new Float32Array(pos.length),
                                    deltaNormals: dNorm
                                });
                            });
                            mesh.morph = new pc.Morph(targets, app.graphicsDevice);
                            morphInst = new pc.MorphInstance(mesh.morph);
                            hasMorphs = true;
                            morphTargetsList.push({ meshInstance: null, morphInstance: morphInst, names: targets.map(t => t.name) });
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

                        for (let p = 0; p < pos.length; p++) allPositions.push(pos[p]);
                        if (uv) for (let u = 0; u < uv.length; u++) allUvs.push(uv[u]);
                        if (norm) for (let nm = 0; nm < norm.length; nm++) allNormals.push(norm[nm]);
                        if (idx) {
                            for (let k = 0; k < idx.length; k++) allIndices.push(idx[k] + vtxOffset);
                        } else {
                            for (let k = 0; k < pos.length / 3; k++) allIndices.push(k + vtxOffset);
                        }
                        vtxOffset += pos.length / 3;
                    });

                    if (meshInstances.length > 0) {
                        ent.addComponent('render', { type: 'asset' });
                        ent.render.meshInstances = meshInstances;
                    }
                }
            });

            if (allPositions.length === 0) throw new Error("Tidak ada data mesh yang ditemukan dalam file GLB/VRM.");

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
            if (typeof meshCachePool !== 'undefined') meshCachePool.push(rootEnt._meshCache);

            app.root.addChild(rootEnt);
            S.objs.push(rootEnt);
            selectObject(rootEnt);
            updateTree();
            saveState();

            document.getElementById('status').textContent = '✓ Model Imported: ' + file.name + (hasMorphs ? ` (${rootEnt._morphNames.length} morphs)` : '');
            if (typeof dbg === 'function') dbg(`✓ GLB/VRM loaded: ${file.name}, scale=${normScale.toFixed(3)}, vtx=${allPositions.length / 3}`);
        } catch (err) {
            console.error("GLB Import Error:", err);
            alert("Gagal import GLB/VRM: " + err.message);
        }
    };
    r.readAsArrayBuffer(file);
}

// Binding input file
const fileInput = document.getElementById('file');
if (fileInput) {
    fileInput.onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const name = f.name.toLowerCase();
        if (name.endsWith('.dds')) importDdsFile(f);
        else if (name.endsWith('.obj')) importOBJ(f);
        else if (name.endsWith('.glb') || name.endsWith('.vrm') || name.endsWith('.gltf')) importGLB(f);
        else alert('Format tidak didukung! Gunakan file .VRM, .GLB, .OBJ, atau .DDS.');
        e.target.value = '';
    };
}
