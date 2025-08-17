/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { JSONPathJS } from './jsonpath.js';

const settings = definePluginSettings({
    denyAll: {
        type: OptionType.BOOLEAN,
        description: "Deny all file uploads. Thought it was funny.",
    },
    bypassSizeCheck: {
        type: OptionType.BOOLEAN,
        description: "Bypass file size check. Server stops you though.",
    },
});

function submit(files: File[], urls: string[]) {
    insertTextIntoChatInputBox(`\n\n${urls.map((url, i) => `[${files[i].name}](${url})`).join(" ")}`);
    return true;
}

function handleFormdata(dm: any, fileList: FileList, platform: Platform) {
    if (!("url" in platform)) return false;

    const files = Array.from(fileList);
    const urls = files.map(file => {
        let formData = new FormData();

        for (const [key, value] of Object.entries(platform.formData)) {
            if (value === "file!") {
                formData.append(key, file);
                continue;
            }

            formData.append(key, value);
        }

        // im sorry i just badly need sync code here :sob: i could make all the
        // platforms run in a Promise and then callback onFinish, if no platform
        // did it then error, etc... but i'd be calling every single platform
        // and also if discord is lower on the list and succeds i'll need to
        // return -1 which is not possible since i'll need to early return. this
        // is just easier, but uses a deprecated ahh api and blocks uoghhhh

        const xhr = new XMLHttpRequest();
        xhr.open("POST", platform.url, false);
        xhr.send(formData);

        // const res = (await fetch(platform.url, {
        //     body: formData,
        //     method: "POST",
        // }));

        if (!xhr.status.toString().startsWith("2")) {
            console.error(xhr);
            return false;
        }

        if (platform.response.type === "url") {
            return xhr.responseText;
        } else if (platform.response.type === "json") {
            const json = JSON.parse(xhr.responseText);
            return (new JSONPathJS(platform.response.path)).find(json) ?? false;
        }
    });

    if (urls.some(url => !url)) {
        return false;
    }

    return submit(files, urls as string[]);
}

type Platform = {
    name: string;
    fn: (dm: any, fileList: FileList) => boolean;
} | {
    name: "discord";
} | {
    name: string;
    url: string;
    formData: {
        [key: string]: "file!" | string;
    };
    response: {
        type: "url";
    } | {
        type: "json";
        path: string; // JSONPath
    };
};

// TODO: make ui for this, im logging off for the night also jsonpath is untested
const tryList = Object.freeze([
    { name: "discord" },
    {
        name: "litterbox",
        url: "https://litterbox.catbox.moe/resources/internals/api.php",
        formData: {
            time: "1h",
            fileNameLength: "16",
            reqtype: "fileupload",
            fileToUpload: "file!"
        },
        response: {
            type: "url"
        }
    },
    {
        name: "catbox",
        url: "https://catbox.moe/user/api.php",
        formData: {
            reqtype: "fileupload",
            userhash: "",
            fileToUpload: "file!"
        },
        response: {
            type: "url"
        }
    }
] as Platform[]);

export default definePlugin({
    name: "CustomFileUploads",
    description: "Customize file upload",
    authors: [{ name: "int4_t", id: 723437187428778015n, }],
    settings,

    patches: [
        {
            find: "\"Unexpected mismatch between files and file metadata\"",
            replacement: {
                match: /if\(\((.*?)\)\)return void (\w*)\((\w*),(\w*)\)/,
                replace: "let override=$self.fileSizeCheck(($1),$2,$3,$4);if(override!=-1)return override;"
            }
        }
    ],

    // return error() to get the file size error
    // return -1 to continue discord's file upload
    // return anything else (i think) to bypass discord's file upload
    fileSizeCheck(discordFileSizeExceeded: boolean, error: Function, dm: any, fileList: FileList) {
        if (settings.store.denyAll) {
            return error(dm, fileList);
        }
        if (settings.store.bypassSizeCheck) {
            return -1;
        }

        for (const platform of tryList) {
            if (platform.name === "discord" && !discordFileSizeExceeded) {
                return -1;
            } else if ("formData" in platform && handleFormdata(dm, fileList, platform)) {
                return undefined;
            } else if ("fn" in platform && platform.fn?.(dm, fileList)) {
                return undefined;
            }
        }

        return error(dm, fileList);
    }
});

