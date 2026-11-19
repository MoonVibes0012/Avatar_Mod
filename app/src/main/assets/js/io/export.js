/* ===== VTuber Forge — js/io/export.js ===== */
// Fungsi download native, OBJ export, Screenshot, dan VRM export (x-vrm)

function setExportStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logExport(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function downloadNative(filename, dataStr, mimeType) {
    try {
        const blob = new Blob([dataStr], { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = function () {
            try {
                const res = String(reader.result || '');
                const base64data = res.indexOf(',') >= 0 ? res.split(',')[1] : '';
                if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
                    window.AndroidBridge.downloadFile(filename, base64data, mimeType);
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            } catch (innerErr) {
                alert("Gagal mendownload: " + innerErr.message);
            }
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        alert("Gagal mendownload: " + e.message);
    }
}
window.downloadNative = downloadNative;

function downloadBinary(filename, arrayBuffer) {
    try {
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        const reader = new FileReader();
        reader.onloadend = function () {
            try {
                const res = String(reader.result || '');
                const base64data = res.indexOf(',') >= 0 ? res.split(',')[1] : '';
                if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
                    window.AndroidBridge.downloadFile(filename, base64data, 'application/octet-stream');
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            } catch (e) {
                alert("Gagal download: " + e.message);
            }
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        alert("Gagal download: " + e.message);
    }
}
window.downloadBinary = downloadBinary;

// ==== SAVE LOG ====
const saveLogBtnEl = document.getElementById('saveLogBtn');
if (saveLogBtnEl) {
    saveLogBtnEl.onclick = () => {
        const logs = Array.isArray(window.allLogs) ? window.allLogs.join('\n') : '';
        downloadNative('vtuber_error_log.txt', logs, 'text/plain');
        alert("Log berhasil disimpan di folder Download!");
    };
}

// ==== EXPORT OBJ ====
function exportOBJ() {
    const objArr = ["# Exported from VTuber Forge"];
    let vertexOffset = 1, uvOffset = 1, normalOffset = 1;
    let skipped = 0;

    (S.objects || []).forEach(o => {
        try {
            const renderComp = o && typeof o.findComponent === 'function' ? o.findComponent('render') : null;
            const mi = renderComp && renderComp.meshInstances ? renderComp.meshInstances[0] : null;
            if (!mi || !mi.mesh) return;

            const mesh = mi.mesh;
            const positions = mesh.getPositions ? mesh.getPositions() : null;
            const indices = mesh.getIndices ? mesh.getIndices() : null;
            if (!positions || !indices || positions.length === 0 || indices.length < 3) return;

            const normals = mesh.getNormals ? mesh.getNormals() : null;
            const uvs = mesh.getUvs ? mesh.getUvs() : null;
            const matrix = typeof o.getWorldTransform === 'function' ? o.getWorldTransform() : null;

            const vCount = Math.floor(positions.length / 3);
            const uvCount = uvs ? Math.floor(uvs.length / 2) : 0;
            const nrmCount = normals ? Math.floor(normals.length / 3) : 0;

            objArr.push("o " + (o.name || "Object"));

            for (let i = 0; i < positions.length; i += 3) {
                const p = new pc.Vec3(positions[i], positions[i + 1], positions[i + 2]);
                if (matrix) matrix.transformPoint(p, p);
                objArr.push(`v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}`);
            }

            if (uvs) {
                for (let i = 0; i < uvs.length; i += 2) {
                    objArr.push(`vt ${uvs[i].toFixed(4)} ${uvs[i + 1].toFixed(4)}`);
                }
            }

            if (normals) {
                for (let i = 0; i < normals.length; i += 3) {
                    const n = new pc.Vec3(normals[i], normals[i + 1], normals[i + 2]);
                    if (matrix) matrix.transformVector(n, n).normalize();
                    objArr.push(`vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}`);
                }
            }

            const triLimit = indices.length - (indices.length % 3);
            for (let i = 0; i < triLimit; i += 3) {
                let faceStr = "f ";
                for (let j = 0; j < 3; j++) {
                    const localIdx = indices[i + j];
                    const v = localIdx + vertexOffset;
                    const hasVt = uvCount > localIdx;
                    const hasVn = nrmCount > localIdx;
                    const vt = hasVt ? (localIdx + uvOffset) : null;
                    const vn = hasVn ? (localIdx + normalOffset) : null;
                    if (vt !== null && vn !== null) faceStr += `${v}/${vt}/${vn} `;
                    else if (vt !== null) faceStr += `${v}/${vt} `;
                    else if (vn !== null) faceStr += `${v}//${vn} `;
                    else faceStr += `${v} `;
                }
                objArr.push(faceStr.trim());
            }

            vertexOffset += vCount;
            uvOffset += uvCount;
            normalOffset += nrmCount;
        } catch (e) {
            skipped++;
            logExport("OBJ export skip: " + ((o && o.name) || '?') + " — " + e.message);
        }
    });

    if (skipped > 0) {
        setExportStatus("OBJ exported, " + skipped + " model di-skip (skinned/tidak didukung)");
    } else {
        setExportStatus("✓ OBJ exported");
    }
    downloadNative('vtuber_model.obj', objArr.join('\n'), 'text/plain');
}
window.exportOBJ = exportOBJ;

const objBtnEl = document.getElementById('obj');
if (objBtnEl) objBtnEl.onclick = exportOBJ;

// ==== SCREENSHOT ====
function takeScreenshot() {
    if (typeof app === 'undefined' || !app || !app.graphicsDevice) return;
    if (typeof app.render === 'function') app.render();
    const w = app.graphicsDevice.width;
    const h = app.graphicsDevice.height;
    if (!w || !h) return;

    const pixels = new Uint8Array(w * h * 4);
    app.graphicsDevice.readPixels(0, 0, w, h, pixels);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        const dstRow = y * w * 4;
        for (let x = 0; x < w * 4; x++) imgData.data[dstRow + x] = pixels[srcRow + x];
    }

    ctx.putImageData(imgData, 0, 0);
    downloadNative('screenshot.png', tempCanvas.toDataURL('image/png'), 'image/png');
    tempCanvas.width = 0;
    tempCanvas.height = 0;
    setExportStatus("✓ Screenshot diambil");
}
window.takeScreenshot = takeScreenshot;

['btnScreenshot', 'screenshot'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = takeScreenshot;
});

/* ===== VRM 1.0 EXPORT (x-vrm) ===== */
function exportVRM() {
    const objs = S.objects || [];
    const target = S.selected || objs.find(o => {
        const rc = o && typeof o.findComponent === 'function' ? o.findComponent('render') : null;
        return rc && rc.meshInstances && rc.meshInstances.length > 0;
    });

    if (!target) {
        alert("Tidak ada objek untuk diexport!\n\nTambahkan objek atau import model dulu.");
        return;
    }

    const renderComp = target.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
        alert("Objek tidak memiliki mesh yang valid.");
        return;
    }

    setExportStatus("Menyiapkan VRM export...");

    try {
        const allPositions = [];
        const allIndices = [];
        const allNormals = [];
        let vertexOffset = 0;
        const worldMatrix = typeof target.getWorldTransform === 'function' ? target.getWorldTransform() : null;
        const tmpVec = new pc.Vec3();

        renderComp.meshInstances.forEach(mi => {
            const mesh = mi ? mi.mesh : null;
            if (!mesh) return;
            let pos, idx, nrm;
            try {
                pos = mesh.getPositions ? mesh.getPositions() : null;
                idx = mesh.getIndices ? mesh.getIndices() : null;
                nrm = mesh.getNormals ? mesh.getNormals() : null;
            } catch (e) {
                logExport("VRM export: skip mesh — " + e.message);
                return;
            }

            if (pos) {
                for (let i = 0; i < pos.length; i += 3) {
                    tmpVec.set(pos[i], pos[i + 1], pos[i + 2]);
                    if (worldMatrix) worldMatrix.transformPoint(tmpVec, tmpVec);
                    allPositions.push(tmpVec.x, tmpVec.y, tmpVec.z);
                }
            }
            if (idx) {
                for (let i = 0; i < idx.length; i++) allIndices.push(idx[i] + vertexOffset);
            }
            if (nrm) {
                for (let i = 0; i < nrm.length; i += 3) {
                    tmpVec.set(nrm[i], nrm[i + 1], nrm[i + 2]);
                    if (worldMatrix) worldMatrix.transformVector(tmpVec, tmpVec).normalize();
                    allNormals.push(tmpVec.x, tmpVec.y, tmpVec.z);
                }
            }
            vertexOffset += pos ? Math.floor(pos.length / 3) : 0;
        });

        if (allPositions.length === 0) {
            alert("Mesh tidak memiliki vertex data yang bisa diexport.");
            return;
        }

        const vertCount = Math.floor(allPositions.length / 3);
        if (vertCount > 100000) {
            if (!confirm("Mesh besar: " + vertCount + " vertex.\nProses export bisa lama. Lanjutkan?")) {
                return;
            }
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < allPositions.length; i += 3) {
            const x = allPositions[i], y = allPositions[i + 1], z = allPositions[i + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        const posBytes = allPositions.length * 4;
        const nrmBytes = allNormals.length * 4;
        const idxBytes = allIndices.length * 4;
        const totalBinBytes = posBytes + nrmBytes + idxBytes;

        const binBuffer = new ArrayBuffer(totalBinBytes);
        const floatView = new Float32Array(binBuffer, 0, allPositions.length + allNormals.length);
        for (let i = 0; i < allPositions.length; i++) floatView[i] = allPositions[i];
        for (let i = 0; i < allNormals.length; i++) floatView[allPositions.length + i] = allNormals[i];
        const intView = new Uint32Array(binBuffer, posBytes + nrmBytes);
        for (let i = 0; i < allIndices.length; i++) intView[i] = allIndices[i];

        const gltf = {
            asset: { version: "2.0", generator: "VTuber Forge v0.1" },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ name: target.name || "Avatar", mesh: 0 }],
            meshes: [{
                name: target.name || "Avatar",
                primitives: [{
                    attributes: { POSITION: 0, NORMAL: 1 },
                    indices: 2,
                    mode: 4
                }]
            }],
            accessors: [
                { bufferView: 0, componentType: 5126, count: allPositions.length / 3, type: "VEC3", min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
                { bufferView: 1, componentType: 5126, count: allNormals.length / 3, type: "VEC3" },
                { bufferView: 2, componentType: 5125, count: allIndices.length, type: "SCALAR" }
            ],
            bufferViews: [
                { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
                { buffer: 0, byteOffset: posBytes, byteLength: nrmBytes, target: 34962 },
                { buffer: 0, byteOffset: posBytes + nrmBytes, byteLength: idxBytes, target: 34963 }
            ],
            buffers: [{ byteLength: totalBinBytes }],
            extensionsUsed: ["VRMC_vrm"],
            extensions: {
                VRMC_vrm: {
                    specVersion: "1.0",
                    meta: {
                        name: target.name || "Avatar",
                        version: "1",
                        authors: ["VTuber Forge User"],
                        licenseUrl: "",
                        avatarPermission: "onlyAuthor",
                        allowExcessivelyViolentUsage: false,
                        allowExcessivelySexualUsage: false,
                        commercialUsage: "personalNonProfit",
                        allowRedistribution: false,
                        allowModification: true,
                        allowPoliticalOrReligiousUsage: false,
                        allowAntisocialOrHateUsage: false,
                        creditNotation: "unnecessary",
                        modification: "prohibited",
                        otherLicenseUrl: ""
                    },
                    humanoid: {
                        humanBones: {
                            hips: { node: 0 }
                        }
                    }
                }
            }
        };

        const glb = buildGLB(gltf, binBuffer);
        downloadBinary('x-vrm.vrm', glb);
        setExportStatus("✓ VRM exported: " + (target.name || "Avatar"));
    } catch (e) {
        logExport("VRM export error: " + e.message + "\n" + (e.stack || ""));
        alert("Gagal export VRM: " + e.message);
        setExportStatus("VRM export gagal.");
    }
}
window.exportVRM = exportVRM;

function buildGLB(gltf, binBuffer) {
    const jsonStr = JSON.stringify(gltf);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
    const jsonChunkLength = jsonBytes.length + jsonPad;
    const binPad = (4 - (binBuffer.byteLength % 4)) % 4;
    const binChunkLength = binBuffer.byteLength + binPad;
    const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

    const glb = new ArrayBuffer(totalLength);
    const view = new DataView(glb);
    const uint8 = new Uint8Array(glb);

    view.setUint32(0, 0x46546C67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, totalLength, true);

    view.setUint32(12, jsonChunkLength, true);
    view.setUint32(16, 0x4E4F534A, true);
    uint8.set(jsonBytes, 20);
    for (let i = 0; i < jsonPad; i++) uint8[20 + jsonBytes.length + i] = 0x20;

    const binOffset = 20 + jsonChunkLength;
    view.setUint32(binOffset, binChunkLength, true);
    view.setUint32(binOffset + 4, 0x004E4942, true);
    uint8.set(new Uint8Array(binBuffer), binOffset + 8);
    for (let i = 0; i < binPad; i++) uint8[binOffset + 8 + binBuffer.byteLength + i] = 0;

    return glb;
}

logExport("✅ exportVRM (x-vrm) loaded");
