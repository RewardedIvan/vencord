const TEXT_TYPES = {
    txt: "text/plain",
    md: "text/markdown",
    vtt: "text/vtt",
    srt: "text/plain",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    mjs: "text/javascript",
};

const MIME_TYPES = {
    // Video
    webm: "video/webm",
    mp4: "video/mp4",
    ts: "video/mp2t",
    m3u8: "application/x-mpegURL",
    ogv: "video/ogg",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    mkv: "video/x-matroska",

    // Images
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    avif: "image/avif",

    // Text & Captions
    ...TEXT_TYPES,

    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
    m4a: "audio/mp4",

    // Data & Documents
    json: "application/json",
    pdf: "application/pdf",
    xml: "application/xml",
    csv: "text/csv",
    wasm: "application/wasm",

    // Archives
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
};

export function getFileExt(filename: string) {
    const parts = filename.split(".");

    return parts.pop()?.toLowerCase();
}

export function getMimeType(ext?: string): string {
    return (ext && MIME_TYPES[ext]) ?? "application/octet-stream";
}
export function isExtTxt(ext?: string): boolean {
    return Boolean(ext && TEXT_TYPES[ext]);
}
