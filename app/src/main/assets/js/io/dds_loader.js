/* ===== VTuber Forge — js/io/dds_loader.js ===== */
// Decoder tekstur .DDS (DXT1, DXT3, DXT5, serta DXGI BC7 Mode 6)

(function () {
    'use strict';

    const DDPF_FOURCC = 0x4;

    const FOURCC_DXT1 = 0x31545844;
    const FOURCC_DXT3 = 0x33545844;
    const FOURCC_DXT5 = 0x35545844;
    const FOURCC_DX10 = 0x30315844;

    function srgbByteToLinear(c) {
        const s = c / 255;
        const lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        return Math.max(0, Math.min(255, Math.round(lin * 255)));
    }

    function decodeColor565(c0, c1, outRgb) {
        const r0 = ((c0 >> 11) & 0x1f) * 255 / 31;
        const g0 = ((c0 >> 5) & 0x3f) * 255 / 63;
        const b0 = (c0 & 0x1f) * 255 / 31;
        const r1 = ((c1 >> 11) & 0x1f) * 255 / 31;
        const g1 = ((c1 >> 5) & 0x3f) * 255 / 63;
        const b1 = (c1 & 0x1f) * 255 / 31;

        outRgb[0] = [Math.round(r0), Math.round(g0), Math.round(b0), 255];
        outRgb[1] = [Math.round(r1), Math.round(g1), Math.round(b1), 255];
        if (c0 > c1) {
            outRgb[2] = [Math.round((2 * r0 + r1) / 3), Math.round((2 * g0 + g1) / 3), Math.round((2 * b0 + b1) / 3), 255];
            outRgb[3] = [Math.round((r0 + 2 * r1) / 3), Math.round((g0 + 2 * g1) / 3), Math.round((b0 + 2 * b1) / 3), 255];
        } else {
            outRgb[2] = [Math.round((r0 + r1) / 2), Math.round((g0 + g1) / 2), Math.round((b0 + b1) / 2), 255];
            outRgb[3] = [0, 0, 0, 0];
        }
    }

    function decodeDxt1ToRgba(src, width, height, offset) {
        const rgba = new Uint8Array(width * height * 4);
        const palette = new Array(4);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 8 > src.length) break;
                const c0 = src[pos] | (src[pos + 1] << 8);
                const c1 = src[pos + 2] | (src[pos + 3] << 8);
                const idxBits = (src[pos + 4]) | (src[pos + 5] << 8) | (src[pos + 6] << 16) | (src[pos + 7] << 24);
                pos += 8;
                decodeColor565(c0, c1, palette);
                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const cell = py * 4 + px;
                        const colIdx = (idxBits >>> (cell * 2)) & 0x3;
                        const c = palette[colIdx];
                        const dst = (y * width + x) * 4;
                        rgba[dst] = c[0]; rgba[dst + 1] = c[1]; rgba[dst + 2] = c[2]; rgba[dst + 3] = c[3];
                    }
                }
            }
        }
        return rgba;
    }

    function decodeDxt3ToRgba(src, width, height, offset) {
        const rgba = new Uint8Array(width * height * 4);
        const palette = new Array(4);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 16 > src.length) break;
                const alphaBits = (src[pos]) | (src[pos + 1] << 8) | (src[pos + 2] << 16) | (src[pos + 3] << 24);
                const c0 = src[pos + 8] | (src[pos + 9] << 8);
                const c1 = src[pos + 10] | (src[pos + 11] << 8);
                const idxBits = (src[pos + 12]) | (src[pos + 13] << 8) | (src[pos + 14] << 16) | (src[pos + 15] << 24);
                pos += 16;
                decodeColor565(c0, c1, palette);
                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const cell = py * 4 + px;
                        const colIdx = (idxBits >>> (cell * 2)) & 0x3;
                        const c = palette[colIdx];
                        const dst = (y * width + x) * 4;
                        rgba[dst] = c[0]; rgba[dst + 1] = c[1]; rgba[dst + 2] = c[2];
                        rgba[dst + 3] = ((alphaBits >>> (cell * 4)) & 0xF) * 17;
                    }
                }
            }
        }
        return rgba;
    }

    function decodeDxt5ToRgba(src, width, height, offset) {
        const rgba = new Uint8Array(width * height * 4);
        const palette = new Array(4);
        const alphas = new Uint8Array(8);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 16 > src.length) break;
                const a0 = src[pos]; const a1 = src[pos + 1];
                alphas[0] = a0; alphas[1] = a1;
                if (a0 > a1) {
                    for (let k = 1; k <= 6; k++) alphas[1 + k] = Math.round(((7 - k) * a0 + k * a1) / 7);
                } else {
                    for (let k = 1; k <= 4; k++) alphas[1 + k] = Math.round(((5 - k) * a0 + k * a1) / 5);
                    alphas[6] = 0; alphas[7] = 255;
                }
                const alphaBitsLo = src[pos + 2] | (src[pos + 3] << 8) | (src[pos + 4] << 16);
                const alphaBitsHi = src[pos + 5] | (src[pos + 6] << 8) | (src[pos + 7] << 16);
                const c0 = src[pos + 8] | (src[pos + 9] << 8);
                const c1 = src[pos + 10] | (src[pos + 11] << 8);
                const idxBits = (src[pos + 12]) | (src[pos + 13] << 8) | (src[pos + 14] << 16) | (src[pos + 15] << 24);
                pos += 16;
                decodeColor565(c0, c1, palette);
                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const cell = py * 4 + px;
                        let aIdx = 0;
                        if (cell < 8) aIdx = (alphaBitsLo >>> (cell * 3)) & 0x7;
                        else aIdx = (alphaBitsHi >>> ((cell - 8) * 3)) & 0x7;
                        const colIdx = (idxBits >>> (cell * 2)) & 0x3;
                        const c = palette[colIdx];
                        const dst = (y * width + x) * 4;
                        rgba[dst] = c[0]; rgba[dst + 1] = c[1]; rgba[dst + 2] = c[2]; rgba[dst + 3] = alphas[aIdx];
                    }
                }
            }
        }
        return rgba;
    }

    function decodeBc7BlockToRgba(src, pos, outBlockRgba) {
        let bitPos = 0;
        function readBits(n) {
            let val = 0;
            for (let i = 0; i < n; i++) {
                const byteIdx = pos + ((bitPos + i) >> 3);
                const bitIdx = (bitPos + i) & 7;
                if (byteIdx < src.length && ((src[byteIdx] >> bitIdx) & 1)) val |= (1 << i);
            }
            bitPos += n;
            return val;
        }

        let mode = 0;
        while (mode < 8 && readBits(1) === 0) mode++;

        if (mode === 6) {
            const r0 = readBits(7), g0 = readBits(7), b0 = readBits(7), a0 = readBits(7);
            const r1 = readBits(7), g1 = readBits(7), b1 = readBits(7), a1 = readBits(7);
            const p0 = readBits(1), p1 = readBits(1);
            const R0 = (r0 << 1) | p0, G0 = (g0 << 1) | p0, B0 = (b0 << 1) | p0, A0 = (a0 << 1) | p0;
            const R1 = (r1 << 1) | p1, G1 = (g1 << 1) | p1, B1 = (b1 << 1) | p1, A1 = (a1 << 1) | p1;
            for (let i = 0; i < 16; i++) {
                const wIdx = readBits(4);
                const w = Math.floor((wIdx * 64 + 7) / 15);
                const inv = 64 - w;
                outBlockRgba[i * 4] = (R0 * inv + R1 * w + 32) >> 6;
                outBlockRgba[i * 4 + 1] = (G0 * inv + G1 * w + 32) >> 6;
                outBlockRgba[i * 4 + 2] = (B0 * inv + B1 * w + 32) >> 6;
                outBlockRgba[i * 4 + 3] = (A0 * inv + A1 * w + 32) >> 6;
            }
            return;
        }

        throw new Error(
            'Tekstur DDS memakai kompresi BC7 Mode ' + mode +
            ' yang belum didukung (saat ini hanya mendukung BC7 Mode 6, DXT1, DXT3, dan DXT5). ' +
            'Silakan simpan ulang tekstur DDS sebagai DXT5/BC3.'
        );
    }

    function decodeBc7ToRgba(src, width, height, offset, isSrgb) {
        const rgba = new Uint8Array(width * height * 4);
        const blockRgba = new Uint8Array(16 * 4);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 16 > src.length) break;
                decodeBc7BlockToRgba(src, pos, blockRgba);
                pos += 16;
                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const sIdx = (py * 4 + px) * 4;
                        const dIdx = (y * width + x) * 4;
                        rgba[dIdx] = isSrgb ? srgbByteToLinear(blockRgba[sIdx]) : blockRgba[sIdx];
                        rgba[dIdx + 1] = isSrgb ? srgbByteToLinear(blockRgba[sIdx + 1]) : blockRgba[sIdx + 1];
                        rgba[dIdx + 2] = isSrgb ? srgbByteToLinear(blockRgba[sIdx + 2]) : blockRgba[sIdx + 2];
                        rgba[dIdx + 3] = blockRgba[sIdx + 3];
                    }
                }
            }
        }
        return rgba;
    }

    function createTextureFromArrayBuffer(graphicsDevice, arrayBuffer, fileName) {
        const src = new Uint8Array(arrayBuffer);
        if (src.byteLength < 128) {
            throw new Error('Header file DDS tidak valid atau terlalu pendek.');
        }
        const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
        const height = Math.max(1, dv.getUint32(12, true));
        const width = Math.max(1, dv.getUint32(16, true));
        const pfFlags = dv.getUint32(80, true);
        const fourCC = dv.getUint32(84, true);

        let dataOffset = 128;
        let rgba;
        let formatLabel = 'DDS';

        if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DX10) {
            if (src.byteLength < 148) {
                throw new Error('Header DX10 DDS tidak lengkap.');
            }
            const dxgiFormat = dv.getUint32(128, true);
            dataOffset = 148;
            if (dxgiFormat === 98 || dxgiFormat === 97 || dxgiFormat === 99) {
                rgba = decodeBc7ToRgba(src, width, height, dataOffset, dxgiFormat === 98 || dxgiFormat === 99);
                formatLabel = 'BC7_Mode6_' + dxgiFormat;
            } else if (dxgiFormat === 71 || dxgiFormat === 72) {
                rgba = decodeDxt1ToRgba(src, width, height, dataOffset);
                formatLabel = 'DXT1';
            } else if (dxgiFormat === 77 || dxgiFormat === 78) {
                rgba = decodeDxt5ToRgba(src, width, height, dataOffset);
                formatLabel = 'DXT5';
            } else {
                throw new Error('DXGI format DDS tidak didukung: ' + dxgiFormat + ' (gunakan DXT1/DXT5).');
            }
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT1) {
            rgba = decodeDxt1ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT1';
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT3) {
            rgba = decodeDxt3ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT3';
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT5) {
            rgba = decodeDxt5ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT5';
        } else {
            throw new Error('Format DDS tidak dikenali (gunakan DXT1, DXT3, atau DXT5).');
        }

        const tex = new pc.Texture(graphicsDevice, {
            width: width, height: height, format: pc.PIXELFORMAT_RGBA8,
            mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR
        });
        const lockBuf = tex.lock();
        lockBuf.set(rgba.subarray(0, Math.min(rgba.length, lockBuf.length)));
        tex.unlock();
        tex._vtfDdsFormat = formatLabel;
        tex.name = fileName || 'dds_texture';
        return tex;
    }

    window.VtfDdsLoader = { createTexture: createTextureFromArrayBuffer };
})();
