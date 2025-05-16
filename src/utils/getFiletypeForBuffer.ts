export function getFileTypeForBuffer(buffer: Buffer): "png" | "jpg" | undefined {
    const fistBytesAsHex = buffer.toString("hex", 0, 4);

    const pngMagicBytes = "89504e47";
    if (fistBytesAsHex === pngMagicBytes) return "png";

    const jpgMagicBytes = "ffd8";
    if (fistBytesAsHex.startsWith(jpgMagicBytes)) return "jpg";

    return undefined;
}
