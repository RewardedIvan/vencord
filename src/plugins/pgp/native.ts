/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import fs from "fs/promises";
import path from "path";
import Stream from "stream";

const FPRINT_REGEX = /^[0-9A-F]{40}$/;

export type CmdOut = [string, string, number | string | undefined];
export type CmdOutObj = {
    stdout: string;
    stderr: string;
    code?: number | string;
};

type CmdOpts<B extends boolean> = {
    stdin?: string | Uint8Array<ArrayBuffer>;
    obj?: B;
    bin?: boolean;
    extraData?: string | Uint8Array<ArrayBuffer>;
};

function cmd(
    e: IpcMainInvokeEvent,
    args: string,
    opts?: CmdOpts<false>,
): Promise<CmdOut>;
function cmd(
    e: IpcMainInvokeEvent,
    args: string,
    opts?: CmdOpts<true>,
): Promise<CmdOutObj>;

async function cmd(
    e: IpcMainInvokeEvent,
    args: string | string[],
    opts?: CmdOpts<boolean>,
): Promise<CmdOutObj | CmdOut> {
    const error = (err: string) =>
        e.senderFrame?.executeJavaScript(
            `console.error(${JSON.stringify(err)});`,
        );

    const { bin, obj, stdin, extraData } = opts ?? {};
    const gpgPath = process.env.GPG_PROGRAM ?? "/usr/bin/gpg";
    console.log("running: " + (Array.isArray(args) ? args.join(" ") : args));

    const argList = typeof args === "string" ? args.trim().split(/\s+/) : args;

    return new Promise((res) => {
        // stdio[3] must be explicitly allocated if extraData is passed
        const stdio: ("pipe" | "ignore" | "inherit")[] = extraData
            ? ["pipe", "pipe", "pipe", "pipe"]
            : ["pipe", "pipe", "pipe"];

        const proc = spawn(gpgPath, argList, { stdio });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        proc.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

        let resolved = false;
        const finalize = (code: number) => {
            if (resolved) return;
            resolved = true;

            const stdoutBuf = Buffer.concat(stdoutChunks);
            const stderr = Buffer.concat(stderrChunks).toString("utf-8");
            const stdout = bin
                ? stdoutBuf.toString("base64")
                : stdoutBuf.toString("utf-8");

            if (obj) {
                res({ stdout, stderr, code });
            } else {
                res([stdout, stderr, code]);
            }
        };

        proc.on("error", (err) => {
            error(`gpg execution error: ${err.message}`);
            finalize(1);
        });

        proc.on("close", (code) => {
            finalize(code ?? 0);
        });

        if (extraData) {
            const s = proc.stdio?.[3] as Stream.Writable | null;
            if (s) {
                s.on("error", (err: NodeJS.ErrnoException) => {
                    if (err.code !== "ECONNRESET" && err.code !== "EPIPE") {
                        console.error("extraData stream error:", err);
                    }
                });
                s.write(extraData, (err) => {
                    if (err) console.error("extraData write error:", err);
                    s.end();
                });
            }
        }

        if (stdin) {
            if (proc.stdin) {
                proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
                    if (err.code !== "ECONNRESET" && err.code !== "EPIPE") {
                        console.error("stdin stream error:", err);
                    }
                });
                proc.stdin.write(stdin, (err) => {
                    if (err) console.error("stdin write error:", err);
                    proc.stdin?.end();
                });
            }
        }
    });
}

type SignOpts = {
    defaultKey?: string;
    ascii?: boolean;
    base64Content?: boolean;
};

export async function sign(
    e: IpcMainInvokeEvent,
    content: string,
    { ascii, defaultKey, base64Content }: SignOpts,
) {
    var args = "";

    if (ascii) {
        args += " -a --clear-sign";
    } else {
        args += " -b";
    }

    if (defaultKey) {
        if (!FPRINT_REGEX.test(defaultKey)) {
            return ["", ""];
        }

        args += " --default-key " + defaultKey;
    }

    return await cmd(e, `-s${args}`, {
        stdin: base64Content ? Uint8Array.fromBase64(content) : content,
        bin: !ascii,
    });
}

export type Key = {
    keySize: number;
    created?: number;
    expires?: number;
    caps?: string;
    fprint: string;
    owner: string;
};

// kt = keyType
function parseKeys(stdout: string, kt: "s" | "p"): Key[] {
    let ki = -1,
        keys = [] as Key[];

    const pub = kt == "s" ? "sec" : "pub";
    const sub = kt == "s" ? "ssb" : "sub";

    stdout
        .split("\n")
        .map((e) => e.split(":"))
        .forEach((e) => {
            switch (e.at(0)) {
                case pub:
                    ki++;
                    keys[ki] = {} as Key;
                    //keys[ki].cipher = e.at(16);
                    keys[ki].keySize = parseInt(e.at(2) ?? "-1");
                    break;
                case "fpr":
                    keys[ki].fprint ??= e.at(9) ?? "";
                    break;
                case sub:
                    keys[ki].created = parseInt(e.at(5) ?? "-1");
                    keys[ki].expires = parseInt(e.at(6) ?? "-1");
                    keys[ki].caps = e.at(11) ?? "";
                    break;
                case "uid":
                    keys[ki].owner = e.at(9) ?? "";
                    break;
                case "grp":
                    break;
            }
        });

    return keys;
}

export async function getSecretKeys(e: IpcMainInvokeEvent): Promise<Key[]> {
    const [stdout] = await cmd(e, "-K --with-colons --batch");
    return parseKeys(stdout, "s");
}
export async function getPubKeys(e: IpcMainInvokeEvent): Promise<Key[]> {
    const [stdout] = await cmd(e, "-k --with-colons --batch");
    return parseKeys(stdout, "p");
}

type DecryptOut = {
    signed: boolean;
    encrypted: boolean;
    // s/z/(s)
    goodSignaturez?: boolean;
    out: CmdOutObj;
};

export async function decrypt(
    e: IpcMainInvokeEvent,
    content: string,
    bin?: boolean,
): Promise<DecryptOut> {
    const out = await cmd(e, "-d --batch", { stdin: content, obj: true, bin });
    const signed = out.stderr?.search?.(/(Good|BAD) signature/) > 0;
    const encrypted = out.stderr?.search?.(/encrypted with/) > 0;

    return {
        encrypted,
        signed,
        goodSignaturez: signed
            ? out.stderr?.search?.("BAD signature") == -1
            : undefined,
        out,
    };
}

export async function decryptAttachment(
    e: IpcMainInvokeEvent,
    url: string,
    bin?: boolean,
): Promise<DecryptOut> {
    const parsed = new URL(url);
    if (
        !parsed.pathname.startsWith("/attachments/") ||
        parsed.origin !== "https://cdn.discordapp.com"
    ) {
        return null as any;
    }

    console.warn("FETCHING " + parsed);

    const res = await fetch(parsed);
    const out = await cmd(e, "-d --batch", {
        stdin: await res.bytes(),
        obj: true,
        bin,
    });
    const signed = out.stderr?.search?.(/(Good|BAD) signature/) > 0;
    const encrypted = out.stderr?.search?.(/encrypted with/) > 0;

    return {
        encrypted,
        signed,
        goodSignaturez: signed
            ? out.stderr?.search?.("BAD signature") < 0
            : undefined,
        out,
    };
}

type ImportOut = {
    imported: boolean;
    out: CmdOutObj;
};

// mm i love vulnerabilities :p
// this is technically a cors bypass
// (well so is decryptAttachment but i'd
// worry less about hitting the discord cdn)
export async function keyImportFromExternal(
    e: IpcMainInvokeEvent,
    url: string,
): Promise<ImportOut> {
    console.warn("FETCHING " + url);

    const res = await fetch(url);
    const out = await cmd(e, "--import --batch", {
        stdin: await res.bytes(),
        obj: true,
    });

    return {
        imported: out.stderr.search("imported:") != -1,
        out,
    };
}
export async function keyImport(
    e: IpcMainInvokeEvent,
    key: string,
): Promise<ImportOut> {
    const out = await cmd(e, "--import --batch", { stdin: key, obj: true });

    return {
        imported: out.stderr.search("imported:") != -1,
        out,
    };
}

type VerifyOut = {
    // s/z/(s)
    goodSignaturez: boolean;
    out: CmdOutObj;
};

export async function verify(
    e: IpcMainInvokeEvent,
    content: string,
): Promise<VerifyOut> {
    const out = await cmd(e, "--batch --verify", { stdin: content, obj: true });
    return {
        goodSignaturez: out.stderr?.search?.("BAD signature") == -1,
        out,
    };
}

export async function verifyDetached(
    e: IpcMainInvokeEvent,
    content: string,
    sigUrl: string,
    isContentAnUrl?: boolean,
): Promise<VerifyOut> {
    const parsed = new URL(sigUrl);
    if (
        !parsed.pathname.startsWith("/attachments/") ||
        parsed.origin !== "https://cdn.discordapp.com"
    ) {
        return null as any;
    }
    var parsed2: URL | null = null;
    if (isContentAnUrl) {
        parsed2 = new URL(content);

        if (
            !parsed2.pathname.startsWith("/attachments/") ||
            parsed2.origin !== "https://cdn.discordapp.com"
        ) {
            return null as any;
        }

        console.warn("FETCHING " + parsed2);
    }

    console.warn("FETCHING " + parsed);

    const res = await fetch(parsed);

    const out = await cmd(
        e,
        "--batch --enable-special-filenames --verify - -&3",
        {
            stdin: await res.bytes(),
            obj: true,
            extraData: isContentAnUrl
                ? await (await fetch(parsed2 as URL)).bytes()
                : content,
        },
    );
    return {
        goodSignaturez:
            out.stderr?.search?.("BAD signature") == -1 && out.code == 0,
        out,
    };
}

type EncOpts = {
    sign?: boolean;
    defaultKey?: string;
    trustAlways?: boolean;
    ascii?: boolean;
    base64Content?: boolean;
};

export async function encrypt(
    e: IpcMainInvokeEvent,
    content: string,
    contacts: string[],
    { sign, defaultKey, trustAlways, ascii, base64Content }: EncOpts,
) {
    if (contacts.find((c) => !FPRINT_REGEX.test(c)) != undefined) {
        return ["", ""];
    }

    var args = "";
    if (ascii) {
        args += " -a";
    }
    if (sign) {
        args += " -s";
    }
    if (trustAlways) {
        args += " --trust-model always";
    }
    if (defaultKey) {
        if (!FPRINT_REGEX.test(defaultKey)) {
            return ["", ""];
        }

        args += " --default-key " + defaultKey;
    }
    args += " " + contacts.map((c) => "-r " + c).join(" ");

    const out = await cmd(e, `-e --batch${args}`, {
        stdin: base64Content ? Uint8Array.fromBase64(content) : content,
        bin: !ascii,
    });

    return out;
}

export async function getKeyAlgos(
    e: IpcMainInvokeEvent,
): Promise<string[] | undefined> {
    const [stdout] = await cmd(e, "--list-config --with-colons");
    return stdout.match(/(?<=pubkeyname:).*/)?.[0]?.split(";");
}
export async function getCurveTypes(
    e: IpcMainInvokeEvent,
): Promise<string[] | undefined> {
    const [stdout] = await cmd(e, "--list-config --with-colons");
    const ar = stdout.match(/(?<=curve:).*/)?.[0]?.split(";");
    if (!ar) return ar;
    return [...new Set(ar)]; // deduplicate
}

export interface GpgKeyOpts {
    keyType: string;
    keyLength?: number;
    keyCurve?: string;
    keyUsage?: string | string[];
    subkeyType?: string;
    subkeyLength?: number;
    subkeyCurve?: string;
    subkeyUsage?: string | string[];

    nameReal?: string;
    nameEmail?: string;
    nameComment?: string;
    expireDate?: string | number;

    passphrase?: string;
    noProtection?: boolean;
    noAskPassphrase?: boolean;

    transientKey?: boolean;
    //pubring?: string;
    //secring?: string;
    preferences?: string;
    keyserver?: string;
    notation?: string;
    revoker?: string;
}

export async function generateKey(
    e: IpcMainInvokeEvent,
    keyOpts: GpgKeyOpts,
): Promise<CmdOut> {
    const lines: string[] = [];

    const keyValueMap: Array<[keyof GpgKeyOpts, string]> = [
        ["keyType", "Key-Type"],
        ["keyLength", "Key-Length"],
        ["keyCurve", "Key-Curve"],
        ["keyUsage", "Key-Usage"],
        ["subkeyType", "Subkey-Type"],
        ["subkeyLength", "Subkey-Length"],
        ["subkeyCurve", "Subkey-Curve"],
        ["subkeyUsage", "Subkey-Usage"],
        ["nameReal", "Name-Real"],
        ["nameEmail", "Name-Email"],
        ["nameComment", "Name-Comment"],
        ["expireDate", "Expire-Date"],
        ["passphrase", "Passphrase"],
        ["preferences", "Preferences"],
        ["keyserver", "Keyserver"],
        ["notation", "Notation"],
        ["revoker", "Revoker"],
    ];

    for (const [key, directive] of keyValueMap) {
        const v = keyOpts[key];
        if (v !== undefined && v !== null) {
            const formattedValue = Array.isArray(v) ? v.join(" ") : String(v);
            lines.push(
                `${directive}: ${formattedValue.replaceAll(/\r|\n/g, " ")}`,
            );
        }
    }

    if (keyOpts.noProtection) lines.push("%no-protection");
    if (keyOpts.noAskPassphrase) lines.push("%no-ask-passphrase");
    if (keyOpts.transientKey) lines.push("%transient-key");
    //if (keyOpts.pubring) lines.push(`%pubring ${keyOpts.pubring}`);
    //if (keyOpts.secring) lines.push(`%secring ${keyOpts.secring}`);

    lines.push("%commit");

    const stdin = lines.join("\n") + "\n";

    return cmd(e, "--batch --generate-key", { stdin });
}
