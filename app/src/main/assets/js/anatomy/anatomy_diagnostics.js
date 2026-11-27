/* ===== VTuber Forge — js/anatomy/anatomy_diagnostics.js ===== */
// Diagnostik lengkap per model: Versi VRM, Render Components, Skin Joints, Bone Unik, Morph per Mesh, & Binding Ekspresi VRM

(function () {
    'use strict';

    function getSelectedEntity() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        return null;
    }

    function collectDiagnostics() {
        const selEnt = getSelectedEntity();
        const rec = (window.AnatomySolver && typeof window.AnatomySolver.getRecord === 'function')
            ? window.AnatomySolver.getRecord()
            : null;

        const rigDiag = (selEnt && selEnt._rigDiagnostics) ? selEnt._rigDiagnostics : null;
        const rigLive = (selEnt && typeof window.collectRigFromEntity === 'function')
            ? window.collectRigFromEntity(selEnt, false)
            : null;

        const morphGroups = (selEnt && Array.isArray(selEnt._morphTargetGroups))
            ? selEnt._morphTargetGroups
            : [];
        const morphPerMesh = morphGroups.map(g => `${g.meshName || 'Mesh'}:${(g.names || []).length}`);
        const totalMorphTargets = (selEnt && Array.isArray(selEnt._morphSlots))
            ? selEnt._morphSlots.length
            : (rigDiag ? rigDiag.totalMorphTargets : 0);

        const vrmExprKeys = (selEnt && selEnt._vrmExpressions && typeof selEnt._vrmExpressions === 'object')
            ? Object.keys(selEnt._vrmExpressions)
            : [];

        const mappedIds = (rec && rec.parts) ? Object.keys(rec.parts) : [];
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
            modelName: selEnt ? (selEnt.name || 'Unnamed') : 'none',
            isRootModel: !!(selEnt && (selEnt._isVtfModelRoot || selEnt._isGLB)),
            vrmVersion: (selEnt && selEnt._vrmVersion) || (rigDiag && rigDiag.vrmVersion) || 'N/A',
            renderComponents: rigLive ? rigLive.renderComponents.length : (rigDiag ? rigDiag.renderComponents : 0),
            declaredSkinJoints: rigDiag ? rigDiag.declaredSkinJoints : 0,
            uniqueDeformBones: rigLive ? rigLive.bones.length : (rigDiag ? rigDiag.uniqueDeformBones : 0),
            morphMeshCount: morphGroups.length,
            morphPerMesh: morphPerMesh,
            totalMorphTargets: totalMorphTargets,
            vrmExpressionCount: vrmExprKeys.length,
            vrmExpressionNames: vrmExprKeys,
            hasRecord: !!rec,
            isRigged: !!(rec && rec.isRigged),
            anatomyMappedCount: mappedIds.length,
            accessoryCount: (rec && Array.isArray(rec.accessories)) ? rec.accessories.length : 0,
            activeBoxes: activeBoxes,
            density: density,
            selectedPart: selectedPart,
            dragMode: dragMode,
            modelScale: rec ? Number((rec.modelScale || 0).toFixed(3)) : 0
        };
    }

    function formatSummary(info) {
        const d = info || collectDiagnostics();
        const morphMeshStr = d.morphPerMesh.length > 0 ? d.morphPerMesh.join(',') : 'none';
        const exprNamesStr = d.vrmExpressionNames.length > 0 ? d.vrmExpressionNames.join(',') : 'none';

        return [
            'MODEL_DIAG',
            'model=' + d.modelName + (d.isRootModel ? '(ROOT)' : '(CHILD)'),
            'ver=' + d.vrmVersion,
            'renders=' + d.renderComponents,
            'skinJoints=' + d.declaredSkinJoints,
            'uniqueBones=' + d.uniqueDeformBones,
            'anatomyParts=' + d.anatomyMappedCount,
            'morphTargets=' + d.totalMorphTargets + '[' + morphMeshStr + ']',
            'vrmExpr=' + d.vrmExpressionCount + '[' + exprNamesStr + ']',
            'boxes=' + (d.activeBoxes ? 'ON' : 'OFF') + ':' + d.density,
            'selPart=' + (d.selectedPart || 'none')
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
