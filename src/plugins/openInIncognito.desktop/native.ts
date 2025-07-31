/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import fs from "fs/promises";
import path from "path";

import { type Browser } from ".";

export async function openInIncognito(e: IpcMainInvokeEvent, _url: string, browser: Browser): Promise<void> {
    const url = new URL(_url);
    const checkPath = async (p: string) => await fs.access(p).then(() => true, () => false);
    const error = (err: string) => e.senderFrame?.executeJavaScript(`console.error(${JSON.stringify(err)});`);

    // i was too lazy to do the other platforms
    switch (browser) {
        case "zen":
            if (process.platform === "win32") {
                const p = path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Zen Browser", "private_browsing.exe");

                if (await checkPath(p)) {
                    exec(`"${p}" "${url.href}"`);
                } else {
                    error("Couldn't find Zen");
                }
            }
            break;
        case "firefox":
            if (process.platform === "win32") {
                const p = path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Mozilla Firefox", "private_browsing.exe");

                if (await checkPath(p)) {
                    exec(`"${p}" "${url.href}"`);
                } else {
                    error("Couldn't find Firefox");
                }
            }
            break;
        case "google-chrome":
            if (process.platform === "win32") {
                const paths = [
                    path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
                    path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome Beta", "Application", "chrome.exe"),
                    path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome Dev", "Application", "chrome.exe"),
                    path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome Canary", "Application", "chrome.exe"),
                    path.join(process.env.LOCALAPPDATA ?? "C:\\Users\\%USERNAME%\\AppData\\Local", "Google", "Chrome", "Application", "chrome.exe"),
                    path.join(process.env.LOCALAPPDATA ?? "C:\\Users\\%USERNAME%\\AppData\\Local", "Google", "Chrome SxS", "Application", "chrome.exe"),
                ];

                for (const p of paths) {
                    if (await checkPath(p)) {
                        exec(`"${p}" --incognito "${url.href}"`);
                        return;
                    }
                }

                error("Couldn't find Chrome");
            }
            break;
    }
}
