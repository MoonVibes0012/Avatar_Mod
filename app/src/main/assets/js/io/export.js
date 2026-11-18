/* ===== VTuber Forge — js/io/export.js ===== */
// Fungsi download native, OBJ export, dan Screenshot

function downloadNative(filename, dataStr, mimeType) {
    try {
        const blob = new Blob([dataStr], {type: mimeType});
        const reader = new FileReader();
        reader.onloadend = function() {
            const base64data = reader.result.split(',')[1];
            if (window.AndroidBridge && window.AndroidBridge.downloadFile) {
                window.AndroidBridge.downloadFile(filename, base64data, mimeType);
            } else {
                // Fallback untuk browser desktop
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        };
        reader.readAsDataURL(blob);
    } catch(e) { 
        alert("Gagal mendownload: " + e.message); 
    }
}

$('saveLogBtn').onclick = () => {
    const logStr = window.allLogs.join('\n');
    downloadNative('vtuber_error_log.txt', logStr, 'text/plain');
    alert("Log berhasil disimpan di folder Download!");
};

$('obj').onclick = () => {
    let objArr = [ "# Exported from VTuber Forge "];
    let vertexOffset = 1, uvOffset = 1, normalOffset = 1;
    let skipped = 0;
    
    S.objects.forEach(o => {
        try {
            const mi = o.findComponent('render')?.meshInstances[0];
            if (!mi) return;
            const mesh = mi.mesh;
            const positions = mesh.getPositions();
            const indices = mesh.getIndices();
            if (!positions || !indices) return;
            
            const normals = mesh.getNormals ? mesh.getNormals() : null;
            const uvs = mesh.getUvs ? mesh.getUvs() : null;
            const matrix = o.getWorldTransform();
            
            objArr.push( `o ${o.name}` );
            
            for (let i = 0; i < positions.length; i += 3) {
                const p = new pc.Vec3(positions[i], positions[i+1], positions[i+2]);
                matrix.transformPoint(p, p);
                objArr.push( `v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}` );
            }
            
            if (uvs) for (let i = 0; i < uvs.length; i += 2) objArr.push( `vt ${uvs[i].toFixed(4)} ${uvs[i+1].toFixed(4)}` );
            
            if (normals) for (let i = 0; i < normals.length; i += 3) {
                const n = new pc.Vec3(normals[i], normals[i+1], normals[i+2]);
                matrix.transformVector(n, n).normalize();
                objArr.push( `vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}` );
            }
            
            for (let i = 0; i < indices.length; i += 3) {
                let faceStr = "f ";
                for(let j=0; j<3; j++) {
                    const v = indices[i+j] + vertexOffset;
                    const vt = uvs ? indices[i+j] + uvOffset : null;
                    const vn = normals ? indices[i+j] + normalOffset : null;
                    if (vt && vn) faceStr += `${v}/${vt}/${vn}`;
                    else if (vt) faceStr += `${v}/${vt}`;
                    else if (vn) faceStr += `${v}//${vn}`;
                    else faceStr += `${v}`;
                }
                objArr.push(faceStr.trim());
            }
            
            vertexOffset += positions.length / 3;
            if (uvs) uvOffset += uvs.length / 2;
            if (normals) normalOffset += normals.length / 3;
        } catch(e) {
            skipped++;
            dbg("OBJ export skip: " + o.name + " — " + e.message);
        }
    });
    
    if (skipped > 0) {
        $('status').textContent = "OBJ exported, " + skipped + " model di-skip (skinned/tidak didukung)";
    }
    downloadNative('vtuber_model.obj', objArr.join('\n'), 'text/plain');
};

$('screenshot').onclick = () => {
    app.render();
    const w = app.graphicsDevice.width;
    const h = app.graphicsDevice.height;
    const pixels = new Uint8Array(w * h * 4);
    app.graphicsDevice.readPixels(0, 0, w, h, pixels);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
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
};
