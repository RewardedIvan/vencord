/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Menu } from "@webpack/common";

const browsers = ["zen", "firefox", "google-chrome"] as const;
export type Browser = typeof browsers[number];

const Native = VencordNative.pluginHelpers.OpenInIncognito as PluginNative<typeof import("./native")>;

const settings = definePluginSettings({
    browser: {
        type: OptionType.SELECT,
        description: "The browser to open the link in.",
        default: "google-chrome",
        options: browsers.map(b => ({ label: b, value: b })),
    },
});

const cl = classNameFactory("vc-open-in-incognito-");

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message, itemHref }: { message: Message; itemHref?: string; }) => {
    const group = findGroupChildrenByChildId("open-native-link", children);
    if (!group) return;

    group.push(
        <Menu.MenuItem
            id={cl("open-link")}
            label="Open Link in Incognito"
            action={async () => {
                if (!itemHref) console.log("no url");
                else Native.openInIncognito(itemHref, settings.store.browser ?? "google-chrome");
            }}
        />
    );
};

export default definePlugin({
    name: "OpenInIncognito",
    description: "Adds a context menu button to open links in an incognito window.",
    authors: [{ name: "int4_t", id: 723437187428778015n, }],
    settings,

    contextMenus: {
        "message": messageCtxPatch,
    },
});
