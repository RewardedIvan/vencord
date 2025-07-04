/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { classNameFactory } from "@api/Styles";
import { PencilIcon } from "@components/Icons";
import { ErrorBoundary, Flex } from "@components/index";
import { classes } from "@utils/misc";
import { ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Button, Menu, SearchableSelect, Text, useMemo, useState } from "@webpack/common";
import { Message } from "discord-types/general";

// const settings = definePluginSettings({
// });

const cl = classNameFactory("vc-timezones-");
var userTimezones = new Map<string, string>();

async function saveUT() {
    await DataStore.set(cl("user-timezones"), userTimezones);
}

async function loadUT() {
    userTimezones = await DataStore.get(cl("user-timezones")) ?? new Map();
}

export function TranslateIcon({ height = 20, width = 20, className }: { height?: number; width?: number; className?: string; }) {
    return (
        <svg
            viewBox="0 96 960 960"
            height={height}
            width={width}
            className={classes(cl("icon"), className)}
        >

        </svg>
    );
}

function SetUserTimezoneModal({ userId, onClose }: { userId: string; onClose: () => void; }) {
    const [stz, setSTZ] = useState("");
    const options = useMemo(() => Intl.supportedValuesOf("timeZone").map(tz => ({ label: tz, value: tz })), []);

    async function set() {
        userTimezones.set(userId, stz);
        await saveUT();
        onClose();
    }

    return (
        <Flex flexDirection="column">
            <SearchableSelect
                placeholder="Europe/Sofia"
                options={options}
                onChange={v => setSTZ(v)}
                value={options.find(o => o.value === stz)}
                closeOnSelect
            />

            <Button
                onClick={set}
                disabled={!options.some(o => o.value === stz)}
            >
                Set
            </Button>
        </Flex>
    );
}

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message.content) return;

    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    group.splice(group.findIndex(c => c?.props?.id === "copy-text") + 1, 0, (
        <Menu.MenuItem
            id={cl("set-timezone")}
            label="Set Timezone"
            icon={PencilIcon}
            action={async () => {
                openModal(modalProps =>
                    <ModalRoot {...modalProps}>
                        <ErrorBoundary>
                            <ModalHeader>
                                <Text variant="heading-lg/normal">
                                    Set timezone for {message.author.username}
                                </Text>
                            </ModalHeader>
                            <ModalContent className={cl("root")}>
                                <SetUserTimezoneModal userId={message.author.id} onClose={modalProps.onClose} />
                            </ModalContent>
                        </ErrorBoundary>
                    </ModalRoot>
                );
            }}
        />
    ));
};

export default definePlugin({
    name: "Timezones",
    description: ".",
    authors: [{ name: "int4_t", id: 723437187428778015n, }],
    // settings,

    contextMenus: {
        "message": messageCtxPatch
    },

    patches: [
        {
            find: "showCommunicationDisabledStyles",
            replacement: {
                // stolen from userMessagesPronouns
                // also tries to be compatible with it
                // but it loads before it and uh it's not compatible with my patch
                match: /(?<=return\s*\(0,.{0,10}\.jsxs?\)\(.{0,900}.{0,4}&&!.{0,4}&&)(\[?)(\(0,.{0,4}\.jsxs?\)\(.+?\{.+?\}\))(, Vencord.+\]\))?(\])?/,
                replace: "[$2$3, $self.render(arguments[0])]"
            }
        },
    ],

    async start() {
        await loadUT();
    },

    render: (data: { message: Message; }) => {
        const tz = userTimezones.get(data.message.author.id);

        if (tz) {
            var res = "";

            try {
                // kinda ai'd but shh
                // Get current date
                const now = new Date();

                // Get the same moment formatted as a string in both timezones
                const localTime = now.toLocaleString("sv-SE"); // ISO-like format: YYYY-MM-DD HH:mm:ss
                const targetTime = now.toLocaleString("sv-SE", { timeZone: tz });

                // Parse both times and calculate difference
                const localDate = new Date(localTime);
                const targetDate = new Date(targetTime);

                // Calculate the difference in minutes and round to avoid floating point issues
                const diffInMinutes = Math.round((localDate.getTime() - targetDate.getTime()) / (1000 * 60));

                // Convert to hours and minutes
                const hours = Math.floor(Math.abs(diffInMinutes) / 60);
                const minutes = Math.abs(diffInMinutes) % 60;

                // Format the result
                const sign = diffInMinutes >= 0 ? "-" : "+";
                const formattedHours = hours.toString().padStart(2, "0");
                const formattedMinutes = minutes.toString().padStart(2, "0");

                res = `${sign}${formattedHours}:${formattedMinutes}`;
            } catch (error) {
                res = "Invalid timezone";
            }

            return <Text variant="text-xs/bold" color="header-muted" tag="span"> {res}</Text>;
        } else {
            return <></>;
        }
    },
});
