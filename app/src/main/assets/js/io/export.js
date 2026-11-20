/* ===== VTuber Forge — js/io/export.js ===== */
// Helper download (AndroidBridge & browser fallback), Export OBJ, dan Screenshot

(function () {
    'use strict';

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

    function getExportApp() {
        if (typeof window.getPcApp === 'function') {
            const pcApp = window.getPcApp();
            if (pcApp) return pcApp;
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    function downloadNative(filename, content) {
        if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
            try {
                window.AndroidBridge.saveFile(filename, content);
                setExportStatus("✓ File disimpan ke Downloads: " + filename);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveFile error: " + e.message);
            }
        }
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File diunduh: " + filename);
        } catch (e) {
            setExportStatus("⚠ Gagal download: " + e.message);
        }
    }
    window.downloadNative = downloadNative;

    function downloadBinary(filename, uint8Array, mimeType) {
        const safeMime = mimeType || 'application/octet-stream';
        if (window.AndroidBridge && typeof window.AndroidBridge.saveBinaryFile === 'function') {
            try {
                let binaryStr = '';
                const bytes = uint8Array;
                for (let i = 0; i < bytes.length; i++) {
                    binaryStr += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binaryStr);
                window.AndroidBridge.saveBinaryFile(filename, base64, safeMime);
                setExportStatus("✓ File binary disimpan ke Downloads: " + filename);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveBinaryFile error: " + e.message);
            }
        }
        try {
            const blob = new Blob([uint8Array], { type: safeMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File binary diunduh: " + filename);
        } catch (e) {
            setExportStatus("⚠ Gagal download binary: " + e.message);
        }
    }
    window.downloadBinary = downloadBinary;

    function exportOBJ() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.root) return alert("Scene belum siap.");
        if (!S.selected) return alert("Pilih objek dulu!");
        const renderComp = typeof S.selected.findComponent === 'function' ? S.selected.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
            return alert("Objek tidak punya mesh untuk di-export ke OBJ.");
        }

        let objStr = `# VTuber Forge OBJ Export\n# Object: ${S.selected.name || 'Object'}\n\n`;
        let vertexOffset = 1;
        let hasAnyGeometry = false;

        renderComp.meshInstances.forEach((mi, idx) => {
            if (!mi || !mi.mesh || !mi.mesh.getPositions || !mi.mesh.getIndices) return;
            const pos = mi.mesh.getPositions();
            const indices = mi.mesh.getIndices();
            if (!pos || !indices || pos.length < 3 || indices.length < 3) return;

            hasAnyGeometry = true;
            objStr += `o ${(S.selected.name || 'Object').replace(/\s+/g, '_')}_part${idx}\n`;

            const vCount = Math.floor(pos.length / 3);
            for (let i = 0; i < vCount; i++) {
                objStr += `v ${(pos[i * 3] || 0).toFixed(6)} ${(pos[i * 3 + 1] || 0).toFixed(6)} ${(pos[i * 3 + 2] || 0).toFixed(6)}\n`;
            }

            const triLimit = indices.length - (indices.length % 3);
            for (let i = 0; i < triLimit; i += 3) {
                const a = indices[i] + vertexOffset;
                const b = indices[i + 1] + vertexOffset;
                const c = indices[i + 2] + vertexOffset;
                objStr += `f ${a} ${b} ${c}\n`;
            }

            vertexOffset += vCount;
        });

        if (!hasAnyGeometry) {
            return alert("Data posisi/index mesh kosong atau terkompresi.");
        }

        const cleanName = (S.selected.name || 'model').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadNative(`${cleanName}.obj`, objStr);
    }
    window.exportOBJ = exportOBJ;

    const xObjBtn = document.getElementById('x-obj');
    if (xObjBtn) xObjBtn.onclick = exportOBJ;

    function takeScreenshot() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.graphicsDevice) return alert("Scene belum siap.");
        const canvas = document.getElementById('gl') || pcApp.graphicsDevice.canvas;
        if (!canvas) return alert("Canvas tidak ditemukan.");

        try {
            if (typeof pcApp.render === 'function') pcApp.render();
            const dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') {
                throw new Error("Canvas kosong atau diblokir.");
            }
            const base64 = dataUrl.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            downloadBinary(`vtuber_screenshot_${Date.now()}.png`, bytes, 'image/png');
        } catch (e) {
            logExport("Screenshot error: " + e.message);
            alert("Gagal mengambil screenshot: " + e.message);
        }
    }
    window.takeScreenshot = takeScreenshot;

    const shotBtn = document.getElementById('btnScreenshot');
    if (shotBtn) shotBtn.onclick = takeScreenshot;

    logExport("✅ export.js loaded");
})();
