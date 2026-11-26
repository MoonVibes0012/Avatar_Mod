/* ===== VTuber Forge — js/io/export.js ===== */
// Helper download (DebugBridge / AndroidBridge & browser fallback), Export OBJ, dan Screenshot

(function () {
    'use strict';

    /**
     * Memperbarui teks status pada bar status aplikasi jika elemen tersedia.
     */
    function setExportStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mencatat log debug ke overlay debug atau konsol browser.
     */
    function logExport(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    /**
     * Mengambil instance pc.Application aktif secara aman.
     */
    function getExportApp() {
        if (typeof window.getPcApp === 'function') {
            try {
                const pcApp = window.getPcApp();
                if (pcApp) return pcApp;
            } catch (e) {}
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    /**
     * Mengambil entitas objek terpilih pada state global S secara aman.
     */
    function getSelectedEntitySafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S.selected || null;
        try {
            if (typeof S !== 'undefined' && S) return S.selected || null;
        } catch (e) {}
        return null;
    }

    /**
     * Mengonversi Uint8Array menjadi string Base64 secara bertahap untuk menghindari stack overflow.
     */
    function uint8ArrayToBase64(uint8Array) {
        const chunkSize = 0x8000;
        const parts = [];
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const slice = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            parts.push(String.fromCharCode.apply(null, slice));
        }
        return btoa(parts.join(''));
    }

    /**
     * Mengonversi teks UTF-8 menjadi string Base64 secara aman untuk dikirim ke bridge native.
     */
    function utf8TextToBase64(text) {
        try {
            const encoder = new TextEncoder();
            return uint8ArrayToBase64(encoder.encode(String(text || '')));
        } catch (e) {
            return btoa(unescape(encodeURIComponent(String(text || ''))));
        }
    }

    /**
     * Menyimpan file teks melalui DebugBridge.downloadFile() atau fallback unduhan browser.
     */
    function downloadNative(filename, content) {
        const safeName = filename || 'export.txt';
        const textStr = String(content || '');

        if (window.DebugBridge && typeof window.DebugBridge.downloadFile === 'function') {
            try {
                const b64 = utf8TextToBase64(textStr);
                window.DebugBridge.downloadFile(safeName, b64, 'text/plain;charset=utf-8');
                setExportStatus("✓ File disimpan ke Downloads: " + safeName);
                return;
            } catch (e) {
                logExport("DebugBridge.downloadFile error: " + e.message);
            }
        }

        if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
            try {
                window.AndroidBridge.saveFile(safeName, textStr);
                setExportStatus("✓ File disimpan ke Downloads: " + safeName);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveFile error: " + e.message);
            }
        }

        try {
            const blob = new Blob([textStr], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = safeName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File diunduh: " + safeName);
        } catch (e) {
            setExportStatus("⚠ Gagal download: " + e.message);
        }
    }
    window.downloadNative = downloadNative;

    /**
     * Menyimpan file biner melalui DebugBridge.downloadFile() atau fallback unduhan browser.
     */
    function downloadBinary(filename, uint8Array, mimeType) {
        const safeName = filename || 'export.bin';
        const safeMime = mimeType || 'application/octet-stream';
        const bytes = (uint8Array instanceof Uint8Array) ? uint8Array : new Uint8Array(uint8Array);

        if (window.DebugBridge && typeof window.DebugBridge.downloadFile === 'function') {
            try {
                const base64 = uint8ArrayToBase64(bytes);
                window.DebugBridge.downloadFile(safeName, base64, safeMime);
                setExportStatus("✓ File binary disimpan ke Downloads: " + safeName);
                return;
            } catch (e) {
                logExport("DebugBridge.downloadFile binary error: " + e.message);
            }
        }

        if (window.AndroidBridge && typeof window.AndroidBridge.saveBinaryFile === 'function') {
            try {
                const base64 = uint8ArrayToBase64(bytes);
                window.AndroidBridge.saveBinaryFile(safeName, base64, safeMime);
                setExportStatus("✓ File binary disimpan ke Downloads: " + safeName);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveBinaryFile error: " + e.message);
            }
        }

        try {
            const blob = new Blob([bytes], { type: safeMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = safeName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File binary diunduh: " + safeName);
        } catch (e) {
            setExportStatus("⚠ Gagal download binary: " + e.message);
        }
    }
    window.downloadBinary = downloadBinary;

    /**
     * Mengekspor geometri objek terpilih ke format Wavefront OBJ.
     */
    function exportOBJ() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.root) {
            setExportStatus("⚠ Scene belum siap.");
            return;
        }
        const selected = getSelectedEntitySafe();
        if (!selected) {
            setExportStatus("⚠ Pilih objek dulu sebelum Export OBJ!");
            return;
        }
        const renderComp = typeof selected.findComponent === 'function' ? selected.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
            setExportStatus("⚠ Objek tidak punya mesh untuk di-export ke OBJ.");
            return;
        }

        let objStr = `# VTuber Forge OBJ Export\n# Object: ${selected.name || 'Object'}\n\n`;
        let vertexOffset = 1;
        let hasAnyGeometry = false;

        renderComp.meshInstances.forEach((mi, idx) => {
            if (!mi || !mi.mesh || !mi.mesh.getPositions || !mi.mesh.getIndices) return;
            const pos = mi.mesh.getPositions();
            const indices = mi.mesh.getIndices();
            if (!pos || !indices || pos.length < 3 || indices.length < 3) return;

            hasAnyGeometry = true;
            objStr += `o ${(selected.name || 'Object').replace(/\s+/g, '_')}_part${idx}\n`;

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
            setExportStatus("⚠ Data posisi/index mesh kosong atau terkompresi.");
            return;
        }

        const cleanName = (selected.name || 'model').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadNative(`${cleanName}.obj`, objStr);
    }
    window.exportOBJ = exportOBJ;

    /**
     * Mengambil tangkapan layar canvas WebGL dan menyimpannya sebagai file PNG.
     */
    function takeScreenshot() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.graphicsDevice) {
            setExportStatus("⚠ Scene belum siap.");
            return;
        }
        const canvas = document.getElementById('gl') || pcApp.graphicsDevice.canvas;
        if (!canvas) {
            setExportStatus("⚠ Canvas tidak ditemukan.");
            return;
        }

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
            setExportStatus("⚠ Gagal mengambil screenshot: " + e.message);
        }
    }
    window.takeScreenshot = takeScreenshot;

    /**
     * Menghubungkan tombol Export OBJ setelah panel dirender.
     */
    function bindExportControls() {
        try {
            const xObjBtn = document.getElementById('x-obj');
            if (xObjBtn) xObjBtn.onclick = exportOBJ;
        } catch (e) {
            logExport("bindExportControls error: " + e.message);
        }
    }

    bindExportControls();
    window.__vtfBindExportControls = bindExportControls;

    logExport("✅ export.js loaded");
})();
