/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Button } from "@webpack/common";

interface PresenceUpdate {
    user: {
        id: string;
        username?: string;
        global_name?: string;
    };
    clientStatus: {
        desktop?: string;
        web?: string;
        mobile?: string;
        console?: string;
    };
    guildId?: string;
    status: string;
    broadcast?: any;
    activities: {
        session_id: string;
        created_at: number;
        id: string;
        name: string;
        details?: string;
        type: number;
    }[];
}

function optionalize(options: string[]) {
    return options.map(o => ({
        label: o.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
        value: o,
    }));
}

var audioElement: HTMLAudioElement | null = null;

const settings = definePluginSettings({
    victimId: {
        type: OptionType.STRING,
        description: "The victim's snowflake.",
        default: "",
    },
    platform: {
        type: OptionType.SELECT,
        description: "The platform to alarm on.",
        default: "mobile",
        options: optionalize(["mobile", "desktop", "web", "console", "any"]),
    },
    status: {
        type: OptionType.SELECT,
        description: "The status to alarm on.",
        options: optionalize(["online", "offline", "idle", "dnd", "not_offline", "online_or_dnd"]),
        default: "online",
    },
    volume: {
        type: OptionType.NUMBER,
        description: "The volume of the alarm.",
        default: 0.5,
    },
    alarm: {
        type: OptionType.STRING,
        description: "The alarm to play.",
        default: "https://files.catbox.moe/12x6xn.mp3",
    },
    test: {
        type: OptionType.COMPONENT,
        default: null,
        component: () => {
            return <Button onClick={() => troll()}>TEST</Button>;
        }
    },
    STOP: {
        type: OptionType.COMPONENT,
        default: null,
        component: () => {
            return <Button onClick={stop}>STOP ARARGGHHhaa</Button>;
        }
    },
});

function troll() {
    if (audioElement != null) return;

    // there is no escaping this.
    audioElement = document.createElement("audio");
    audioElement.src = settings.store.alarm;
    audioElement.volume = settings.store.volume;
    audioElement.play();
    audioElement.onended = () => {
        if (audioElement != null) {
            audioElement.currentTime = 0;
            audioElement.play();
        }
    };
}

function stop() {
    if (audioElement != null) {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement = null;
    }
}

export default definePlugin({
    name: "StatusChangeAlarm",
    description: "Alarm when the status changes",
    authors: [
        {
            name: "int4_t",
            id: 723437187428778015n,
        }
    ],

    settings,
    stop,

    flux: {
        PRESENCE_UPDATES({ updates }: { updates: PresenceUpdate[]; }) {
            const { victimId, platform, status } = settings.store;
            if (victimId === "") return;

            const victim = updates.find(u => u.user.id === victimId);
            if (!victim) return;

            var st = "";
            if (platform === "any") {
                st = victim.status;
            } else {
                st = victim.clientStatus[platform as keyof typeof victim.clientStatus] ?? "";
            }

            if (status === "online_or_dnd") {
                if (st === "online" || st === "dnd") {
                    troll();
                }
            } else if (st === status) {
                troll();
            }
        },
    },
});
