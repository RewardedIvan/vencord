/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeBlock } from "@components/CodeBlock";
import { CopyIcon } from "@components/Icons";
import definePlugin, {
    PluginNative,
    ReporterTestable,
} from "@utils/types";
import {
    Channel,
    Message,
    PopoutPosition,
    CloudUpload as TCloudUpload,
} from "@vencord/discord-types";
import {
    ChannelStore,
    showToast,
    Toasts,
    Tooltip,
    UserStore,
} from "@webpack/common";
import { BaseText } from "@components/BaseText";
import {
    addMessagePreEditListener,
    addMessagePreSendListener,
    MessageObject,
    removeMessagePreEditListener,
    removeMessagePreSendListener,
} from "@api/MessageEvents";
import { classNameFactory } from "@utils/css";
import { findByCodeLazy, findLazy } from "@webpack";
import {
    LockCheckIcon,
    LockIcon,
    LockClockIcon,
    CheckIcon,
    LockXIcon,
    XIcon,
} from "./icons";
import { settings } from "./settings";

import "./styles.css";
import { getFileExt, getMimeType, isExtTxt } from "./mime";
import { CloudUploadPlatform, DraftType } from "@vencord/discord-types/enums";
import { showNotification } from "@api/Notifications";
import { Span } from "@components/Span";
import { copyWithToast, sendMessage } from "@utils/discord";
import { modeFullString, Modes } from "./modes";
import { messageCtxPatch, userCtxPatch } from "./contextMenus";
import { ChatBarRender } from "./chatbar";
import { loadPKs } from "./datastore";

export const Native = VencordNative.pluginHelpers.PGP as PluginNative<
    typeof import("./native")
>;

type Key = import("./native").Key;

export const cl = classNameFactory("vc-pgp-");

const uploadFiles: (
    files: File[],
    channel: Channel,
    draftType: DraftType,
    options?: {
        filesMetadata?: any[];
        requireConfirm?: boolean; // Defaults to true
        isThumbnail?: boolean; // Defaults to false
        origin?: string;
    },
) => Promise<void> = findByCodeLazy(
    "filesMetadata",
    "requireConfirm",
    "originalContentType",
);

const CloudUpload: typeof TCloudUpload = findLazy(
    (m) => m.prototype?.trackUploadFinished,
);

export const friendlyKey = (k: Key) =>
    `${k.owner} (${k.fprint.substring(0, 16)})`;

export var state = {
    recipients: [] as string[],
    mode: "es" as Modes,
    modeIconUpdate: null as (() => void) | null,
    skeys: [] as Key[],
    pkeys: [] as Key[],
};

const TitleCase = (str: string) =>
    str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
    );

function MessageIndicator({
    errs,
    variant,
    goodSignaturez,
    tooltipPosition = "top",
}: {
    errs?: string;
    tooltipPosition?: PopoutPosition;
    variant: Exclude<Modes, "pt"> | "l";
    goodSignaturez?: boolean;
}) {
    const full = modeFullString(variant, true);
    const Icon = (() => {
        switch (variant) {
            case "e":
                return LockIcon;
            case "es":
                return goodSignaturez ? LockCheckIcon : LockXIcon;
            case "s":
                return goodSignaturez ? CheckIcon : XIcon;
            case "l":
                return LockClockIcon;
        }
    })();

    return (
        <Tooltip
            allowOverflow
            position={tooltipPosition}
            text={
                <div className={cl("msg-tooltip-contents")}>
                    {variant == "l" ? (
                        <BaseText>
                            This message is being processed by the pgp plugin!
                            If you see this for too long, you can check the
                            console and or discord stdout.
                        </BaseText>
                    ) : (
                        <BaseText>
                            This message has a pgp {full} message!
                        </BaseText>
                    )}
                    {errs && <CodeBlock lang="plaintext" content={errs} />}
                </div>
            }
        >
            {({ onMouseEnter, onMouseLeave }) => (
                <Icon
                    aria-label={`${TitleCase(full)} Message Indicator (PGP)`}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    style={{
                        transform: "translateY(4p)",
                    }}
                />
            )}
        </Tooltip>
    );
}

const PGP_MESSAGE_REGEX =
    /-{2,}BEGIN PGP MESSAGE-{2,}[\s\S]*?-{2,}END PGP MESSAGE-{2,}/g;
const PGP_SIGNED_REGEX =
    /-{2,}BEGIN PGP SIGNED MESSAGE-{2,}\r?\n(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)\r?\n-{2,}BEGIN PGP SIGNATURE-{2,}[\s\S]*?-{2,}END PGP SIGNATURE-{2,}/g;

type PGPMsgData = {
    originalContent: string;
    newContent: string;
    errs: string;
    isAfter: boolean;
    isSigned: boolean;
    isEncrypted: boolean;
    hasGoodSignaturez?: boolean;
    forceUpdate: () => void;
};
type PGPAtchData = {
    originalUrl: string;
};

const md = (m: Message) => m["pgp"] as PGPMsgData;
const empty_blob_url = URL.createObjectURL(new Blob([], {}));

function RenderIndicator({
    message,
    afterMessage,
    noStyle,
    tooltipPosition,
}: {
    message: Message;
    afterMessage?: boolean;
    noStyle?: boolean;
    tooltipPosition?: PopoutPosition;
}) {
    const d = md(message);
    const loading = message["pgp_processing"];
    if (loading || d?.isEncrypted || d?.isSigned) {
        return (
            <div
                style={
                    afterMessage
                        ? {
                              display: "inline-flex",
                              float: "right",
                              transform: "translateY(6px)",
                          }
                        : {
                              display: "inline-flex",
                              marginLeft: noStyle ? undefined : 2,
                          }
                }
            >
                {d?.isEncrypted && d?.isSigned ? (
                    <MessageIndicator
                        tooltipPosition={tooltipPosition}
                        variant={"es"}
                        goodSignaturez={d.hasGoodSignaturez}
                        errs={d.errs}
                    />
                ) : d?.isEncrypted ? (
                    <MessageIndicator
                        variant="e"
                        errs={d.errs}
                        tooltipPosition={tooltipPosition}
                    />
                ) : (
                    d?.isSigned && (
                        <MessageIndicator
                            tooltipPosition={tooltipPosition}
                            variant="s"
                            errs={d.errs}
                            goodSignaturez={d.hasGoodSignaturez}
                        />
                    )
                )}
                {loading && (
                    <MessageIndicator
                        variant="l"
                        tooltipPosition={tooltipPosition}
                    />
                )}
            </div>
        );
    }
}

export default definePlugin({
    name: "PGP",
    description: "pgp!",
    tags: ["Chat", "Privacy"],
    authors: [{ name: "int4_t", id: 723437187428778015n }],
    dependencies: [
        "MessageUpdaterAPI",
        "ChatInputButtonAPI",
        "MessagePopoverAPI",
        "MessageEventsAPI",
    ],
    reporterTestable: ReporterTestable.Patches,
    settings,

    chatBarButton: {
        icon: LockIcon,
        render: ChatBarRender,
    },

    contextMenus: {
        "user-context": userCtxPatch,
        message: messageCtxPatch,
    },

    patches: [
        {
            find: /renderContentOnly:/,
            replacement: {
                match: /(\i)\.memo\(.{0,700}renderContentOnly.{0,700};/,
                replace:
                    "$&const [,fu]=$1.useReducer((x)=>(x+1),0);$self.modify(arguments[0], fu);",
            },
        },
        {
            find: "showCommunicationDisabledStyles",
            replacement: {
                // stolen from userMessagesPronouns
                // also tries to be compatible with it
                // but it loads before it and uh it's not compatible with my patch
                match: /(?<=return\s*\(0,.{0,10}\.jsxs?\)\(.{0,900}.{0,4}&&!.{0,4}&&)(\[?)(\(0,.{0,4}\.jsxs?\)\(.+?\{.+?\}\))(, Vencord.+\]\))?(\])?/,
                replace: "[$2$3, $self.renderHeader(arguments[0])]",
            },
        },
        {
            find: 'type:"MESSAGE_LENGTH_UPSELL"',
            replacement: {
                match: /(?<=if\()\i\.length>\i(?=\))/,
                replace: "$& && !$self.settings.store.skipMessageLengthUpsell",
            },
        },
        {
            // this function does not have a good anchor, i found it by searching for "filenameLinkWrapper__0ccae" and xreffing it
            find: /let{className:\i,url:\i,fileName:\i,fileSize:\i,onClick:\i/,
            replacement: {
                match: /let{className:\i,url:\i,fileName:\i,fileSize:\i,onClick:\i.*\}=(\i)(?=;return\((\d*),(\i))/,
                replace:
                    "$&;if($self.settings.store.hideConsumedAttachments&&$1?.item?.originalItem?.pgp?.consumed)return ($2,$3.jsxs)($3.Fragment,{children:[]})",
            },
        },
        {
            // could also just be "async upload(){" but ehh
            find: 'async upload(){if("COMPLETED"',
            replacement: {
                match: /let \i=await \i\.getUploadPayload\(this\).{0,50}\(this\.item\.target\);/,
                replace: "if($self.settings.store.encryptAttachments&&null!=this.item.file&&!this.item);$&",
            },
        },
    ],

    modify(
        { message, groupId }: { message: Message; groupId: string },
        forceUpdate: () => void,
    ) {
        const isNewGroup = message.id == groupId;
        if (message["pgp_processing"]) {
            console.error("processing..");
            return;
        } else if (message["pgp"]) {
            console.error("work done here");
            return;
        }
        message["pgp_processing"] = true;

        (async () => {
            let errs = "",
                isSigned = false,
                isEncrypted = false,
                hasGoodSignaturez = undefined as boolean | undefined,
                content = message.content;

            if (PGP_MESSAGE_REGEX.test(content)) {
                PGP_MESSAGE_REGEX.lastIndex = 0;
                const matches = [...content.matchAll(PGP_MESSAGE_REGEX)];

                for (const match of matches) {
                    const block = match[0];
                    const { out, signed, encrypted, goodSignaturez } =
                        await Native.decrypt(block);

                    isEncrypted ||= encrypted;
                    isSigned ||= signed;
                    if (goodSignaturez !== undefined) {
                        hasGoodSignaturez ??= goodSignaturez;
                        hasGoodSignaturez &&= goodSignaturez;
                    }

                    errs += out.stderr + "\n";
                    content = content.replace(block, out.stdout ?? "");
                }
            }

            if (PGP_SIGNED_REGEX.test(content)) {
                PGP_SIGNED_REGEX.lastIndex = 0;

                const signedMatches = [...content.matchAll(PGP_SIGNED_REGEX)];

                for (const match of signedMatches) {
                    const fullMatch = match[0];
                    const cleartextBody = match[1];

                    const { out, goodSignaturez } =
                        await Native.verify(fullMatch);

                    errs += out.stdout + "\n";
                    errs += out.stderr + "\n";

                    hasGoodSignaturez ??= goodSignaturez;
                    hasGoodSignaturez &&= goodSignaturez;
                    isSigned = true;

                    const cleanedBody = cleartextBody.replace(/^-\s/gm, "");

                    content = content.replace(fullMatch, cleanedBody);
                }
            }

            const amaxSize = settings.store.autoDecryptAttachmentsMaxSize;
            for (const a of message.attachments) {
                if (!settings.store.autoDecryptAttachments) break;

                const isAtchEncrypted =
                    a.filename.endsWith(".pgp") || a.filename.endsWith(".gpg");
                const isAtchSigned = a.filename.endsWith(".sig");
                if (
                    !(
                        isAtchEncrypted ||
                        isAtchSigned ||
                        a.filename.startsWith("content.")
                    ) ||
                    a["pgp"] != undefined
                ) {
                    continue;
                }

                if (amaxSize == 0 || a.size > 1024 * 1024 * amaxSize) {
                    continue;
                }

                a["pgp"] = {
                    originalUrl: a.url,
                } satisfies PGPAtchData;

                if (a.filename == "content.sig") {
                    const { out, goodSignaturez } = await Native.verifyDetached(
                        content,
                        a.url,
                    );
                    isSigned ||= true;
                    hasGoodSignaturez ??= goodSignaturez;
                    hasGoodSignaturez &&= goodSignaturez;

                    errs += out.stderr + "\n";
                    a.filename += " (looked at)";
                    a["pgp"].consumed = true;

                    continue;
                }

                if (a.filename == "content.md" || a.filename == "content.txt") {
                    a["pgp"].consumed = true;
                    a.content_type = undefined;
                    a.filename += " (consumed)";
                    content += await (await fetch(a.url)).text();
                    a.url = empty_blob_url;

                    continue;
                }

                if (isAtchEncrypted) {
                    a.filename = a.filename.substring(
                        0,
                        a.filename.length - ".pgp".length,
                    );
                }

                const ext = getFileExt(a.filename);
                const isTxt = isExtTxt(ext);

                const { out, signed, encrypted, goodSignaturez } =
                    await Native.decryptAttachment(a.url, !isTxt);

                if (a.filename == "content.md" || a.filename == "content.txt") {
                    a["pgp"].consumed = true;
                    a.content_type = undefined;
                    a.url = empty_blob_url;
                    a.filename += " (consumed)";
                    content += out.stdout;
                } else {
                    const blob = new Blob(
                        [
                            isTxt
                                ? out.stdout
                                : Uint8Array.fromBase64(out.stdout),
                        ],
                        { type: getMimeType(ext) },
                    );

                    a.url = URL.createObjectURL(blob);
                    a.size = blob.size;
                    a.content_type = blob.type;
                }

                isEncrypted ||= encrypted;
                isSigned ||= signed;
                if (goodSignaturez !== undefined) {
                    hasGoodSignaturez ??= goodSignaturez;
                    hasGoodSignaturez &&= goodSignaturez;
                }

                errs += out.stderr + "\n";
            }

            const modification = isEncrypted || isSigned;
            if (modification) {
                message["pgp"] = {
                    originalContent: message.content,
                    newContent: content,
                    errs: errs.trim(),
                    isAfter: !isNewGroup,
                    isEncrypted,
                    isSigned,
                    hasGoodSignaturez,
                    forceUpdate,
                } satisfies PGPMsgData;

                message.content = content;
                forceUpdate();
            }
            message["pgp_processing"] = false;
        })();
    },

    renderAfterMessage({
        message,
        content,
    }: {
        message: Message;
        content: any[];
    }) {
        if (message["pgp_processing"] === false && md(message)?.isAfter) {
            content.push(
                this.renderHeader({
                    message,
                    afterMessage: true,
                }),
            );
        }
    },

    renderHeader: RenderIndicator,

    async start() {
        await loadPKs();
        state.skeys = await Native.getSecretKeys();
        state.pkeys = await Native.getPubKeys();

        function getSecretKey(): string | undefined {
            const key = settings.store.secretKey;
            return key !== "whatever" ? key : undefined;
        }

        function notifyPGPError(stderr: string): void {
            showNotification({
                title: "PGP",
                body: stderr,
                richBody: (
                    <Span style={{ whiteSpace: "pre-wrap" }}>{stderr}</Span>
                ),
                onClick: () => copyWithToast(stderr),
            });
        }

        async function applyPGP(msg: MessageObject, ascii: boolean = true) {
            const encrypt = state.mode.startsWith("e");
            const signOnly = state.mode === "s";

            if (!encrypt && !signOnly) {
                return { cancel: false, unchanged: true };
            }

            if (encrypt) {
                const [stdout, stderr, ec] = await Native.encryptText(
                    msg.content,
                    state.recipients,
                    {
                        sign: state.mode === "es",
                        defaultKey: getSecretKey(),
                        trustAlways: settings.store.trustAlways,
                        ascii,
                    },
                );

                if (ec !== 0) {
                    notifyPGPError(stderr);
                    return { cancel: true };
                }

                msg.content = ascii ? stdout : "";
                return { cancel: false, stdout };
            }

            const [stdout, stderr, ec] = await Native.sign(msg.content, {
                defaultKey: getSecretKey(),
                ascii,
            });

            if (ec !== 0) {
                notifyPGPError(stderr);
                return { cancel: true };
            }

            msg.content = ascii ? stdout : "";
            return { cancel: false, stdout };
        }

        const premiumType = UserStore.getCurrentUser()?.premiumType ?? 0;
        const charMax = premiumType === 2 ? 4000 : 2000;

        this.preSend = addMessagePreSendListener(async (channelId, msg) => {
            const origContent = msg.content;
            let result = await applyPGP(msg, true);
            if (result.cancel) return result;

            if (result.unchanged || msg.content.length <= charMax) {
                return result;
            }

            msg.content = origContent;

            result = await applyPGP(msg, false);
            if (result.cancel) return result;

            const textBlob = new Blob(
                [Uint8Array.fromBase64(result.stdout ?? "")],
                {
                    type: "application/pgp-encrypted",
                },
            );

            if (state.mode == "es") {
                const file = new File([textBlob], "content.md.pgp", {
                    type: "application/pgp-encrypted",
                });
                file["pgp"] = true;

                await uploadFiles(
                    [file],
                    ChannelStore.getChannel(channelId),
                    DraftType.ChannelMessage,
                    { requireConfirm: false },
                );

                return result;
            }

            const sigFile = new File([textBlob], "content.sig", {
                type: "application/pgp-encrypted",
            });
            sigFile["pgp"] = true;

            if (origContent.length > charMax) {
                const contentFile = new File([origContent], "content.md", {
                    type: "text/plain",
                });
                contentFile["pgp"] = true;

                await uploadFiles(
                    [contentFile, sigFile],
                    ChannelStore.getChannel(channelId),
                    DraftType.ChannelMessage,
                    { requireConfirm: false },
                );

                return result;
            }

            const upload = new CloudUpload(
                {
                    file: sigFile,
                    isThumbnail: false,
                    platform: CloudUploadPlatform.WEB,
                },
                channelId,
            );

            upload.on("complete", () => {
                sendMessage(channelId, { content: origContent }, false, {
                    attachmentsToUpload: [upload],
                });
            });

            upload.on("error", () =>
                showToast(
                    "Failed to upload signature file",
                    Toasts.Type.FAILURE,
                ),
            );

            upload.upload();

            return result;
        });

        this.preEdit = addMessagePreEditListener(async (_, __, messageObj) => {
            return await applyPGP(messageObj, true);
        });
    },

    stop() {
        removeMessagePreSendListener(this.preSend);
        removeMessagePreEditListener(this.preEdit);
    },

    messagePopoverButton: {
        icon: CopyIcon,
        render(message) {
            const d = md(message);
            return d
                ? {
                      label:
                          message.content == d.originalContent
                              ? "See pgp message"
                              : "See original message",
                      icon: () => (
                          <RenderIndicator
                              message={message}
                              noStyle
                              tooltipPosition="bottom"
                          />
                      ),
                      message: message,
                      channel: ChannelStore.getChannel(message.channel_id),
                      onClick: async () => {
                          const d = md(message);
                          if (message.content == d.originalContent) {
                              message.content = d.newContent;
                          } else {
                              message.content = d.originalContent;
                          }

                          d.forceUpdate();
                      },
                  }
                : null;
        },
    },
});
