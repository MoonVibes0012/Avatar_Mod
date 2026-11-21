/* ===== VTuber Forge — js/anatomy/anatomy_diagnostics.js ===== */
// Diagnostik status pemetaan anatomi, jumlah handle kotak, fallback mode, & laporan ringkas

(function () {
    'use strict';

    function collectDiagnostics() {
        const rec = (window.AnatomySolver && typeof window.AnatomySolver.getRecord === 'function')
            ? window.AnatomySolver.getRecord()
            : null;

        const mappedIds = (rec && rec.parts) ? Object.keys(rec.parts) : [];
        const fallbackCount = mappedIds.filter(id => !!(rec.parts[id] && rec.parts[id].isFallback)).length;
        const activeBoxes = !!(window.AnatomyAnchorBoxes && window.AnatomyAnchorBoxes.isEnabled());
        const density = (window.AnatomyAnchorBoxes && window.AnatomyAnchorBoxes.getDensityMode)
            ? window.AnatomyAnchorBoxes.getDensityMode()
            : 'core';
        const selectedPart = (window.AnatomySelectionSphere && window.AnatomySelectionSphere.getSelectedPart)
            ? window.AnatomySelectionSphere.getSelectedPart()
            : null;
        const dragMode = (window.AnatomySelectionSphere && window.AnatomySelectionSphere.getDragMode)
            ? window.AnatomySelectionSphere.getDragMode()
            : 'rotate';

        return {
            hasRecord: !!rec,
            isRigged: !!(rec && rec.isRigged),
            mappedCount: mappedIds.length,
            fallbackCount: fallbackCount,
            accessoryCount: (rec && Array.isArray(rec.accessories)) ? rec.accessories.length : 0,
            morphCount: (rec && Array.isArray(rec.morphTargets)) ? rec.morphTargets.length : 0,
            activeBoxes: activeBoxes,
            density: density,
            selectedPart: selectedPart,
            dragMode: dragMode,
            modelScale: rec ? Number((rec.modelScale || 0).toFixed(3)) : 0
        };
    }

    function formatSummary(info) {
        const d = info || collectDiagnostics();
        return [
            'ANATOMY_DIAG',
            'rec=' + (d.hasRecord ? '1' : '0'),
            'rigged=' + (d.isRigged ? '1' : '0'),
            'parts=' + d.mappedCount,
            'fb=' + d.fallbackCount,
            'acc=' + d.accessoryCount,
            'morph=' + d.morphCount,
            'boxes=' + (d.activeBoxes ? 'ON' : 'OFF') + ':' + d.density,
            'sel=' + (d.selectedPart || 'none'),
            'mode=' + d.dragMode,
            'scale=' + d.modelScale
        ].join(' | ');
    }

    function printReport() {
        const summary = formatSummary();
        if (typeof window.dbg === 'function') {
            try { window.dbg(summary); } catch (e) {}
        }
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log(summary);
        }
        return summary;
    }

    window.AnatomyDiagnostics = {
        collect: collectDiagnostics,
        formatSummary: formatSummary,
        printReport: printReport
    };
})();
