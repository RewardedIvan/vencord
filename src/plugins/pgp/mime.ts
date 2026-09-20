type Expand<T> = { [K in keyof T]: T[K] } & {};

type Invert<T extends Record<PropertyKey, PropertyKey>> = Expand<{
    [K in keyof T as T[K]]: K;
}>;

export const flipObject = <const T extends Record<PropertyKey, PropertyKey>>(
    obj: T,
): Invert<T> =>
    Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [v, k]),
    ) as Invert<T>;

export const TEXT_MTYPES = {
    txt: "text/plain",
    md: "text/markdown",
    vtt: "text/vtt",
    srt: "text/plain",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    mjs: "text/javascript",
} as const;
export const MTYPES_TEXT = flipObject(TEXT_MTYPES);

export const IMAGE_MTYPES = {
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    avif: "image/avif",
} as const;
export const MTYPES_IMAGE = flipObject(IMAGE_MTYPES);

export const VIDEO_MTYPES = {
    webm: "video/webm",
    mp4: "video/mp4",
    ts: "video/mp2t",
    m3u8: "application/x-mpegURL",
    ogv: "video/ogg",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
} as const;
export const MTYPES_VIDEO = flipObject(VIDEO_MTYPES);

const MIME_TYPES = {
    ...VIDEO_MTYPES,
    ...IMAGE_MTYPES,
    ...TEXT_MTYPES,

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
} as const;

export function getFileExt(filename: string) {
    const parts = filename.split(".");

    return parts.pop()?.toLowerCase();
}

export function getMimeType(ext?: string): string {
    return (ext && MIME_TYPES[ext]) ?? "application/octet-stream";
}
export function isPartOf(ext: string | undefined, obj: any): boolean {
    return Boolean(ext && obj[ext]);
}
