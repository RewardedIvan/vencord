/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeBlock } from "@components/CodeBlock";
import { CopyIcon } from "@components/Icons";
import definePlugin, { PluginNative, ReporterTestable } from "@utils/types";
import {
    Channel,
    Message,
    MessageAttachment,
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
import {
    getFileExt,
    getMimeType,
    isPartOf,
    MTYPES_IMAGE,
    MTYPES_VIDEO,
    TEXT_MTYPES,
} from "./mime";
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
    isSigned?: boolean;
    isEncrypted?: boolean;
    hasGoodSignaturez?: boolean;
    errs: string;
};

const md = <T extends Message | MessageAttachment>(
    m: T,
): T extends MessageAttachment ? PGPAtchData : PGPMsgData => {
    return m["pgp"] as T extends MessageAttachment ? PGPAtchData : PGPMsgData;
};
const empty_blob_url = URL.createObjectURL(new Blob([], {}));

function RenderIndicator({
    message,
    afterMessage,
    noStyle,
    tooltipPosition,
}: {
    message: Message | MessageAttachment;
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

function getSecretKey(): string | undefined {
    const key = settings.store.secretKey;
    return key !== "whatever" ? key : undefined;
}

function notifyPGPError(stderr: string): void {
    showNotification({
        title: "PGP",
        body: stderr,
        richBody: <Span style={{ whiteSpace: "pre-wrap" }}>{stderr}</Span>,
        onClick: () => copyWithToast(stderr),
    });
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
                replace:
                    "if($self.settings.store.encryptAttachments&&null!=this.item.file&&!this.item.file.pgp){" +
                    "this.item.file=await $self.encryptFile(this.item.file,this.channelId);this.currentSize=this.item.file.size;this.setFilename(this.item.file.name)" +
                    "};$&",
            },
        },
        {
            find: /MEDIA_DOWNLOAD_BUTTON_TAPPED.{0,150}Anchor/,
            replacement: {
                match: /(?<=\{let.{0,50}href:(\i).{0,100}\}=(\i),.{0,100}useCallback.{0,50}\{).{0,50}MEDIA_DOWNLOAD_BUTTON_TAPPED,\{.{0,90}\}\),.{0,90}(?=\},\[)/,
                replace:
                    'if($1.startsWith("blob:")){' +
                    "$2.preventDefault();$self.blobA.download=$self.url_attachs[$1].filename;$self.blobA.href=$1;$self.blobA.click()" +
                    "}else{$&}",
            },
        },
        {
            // tries to be compatible with PictureInPicture
            // but it won't be if vencord loads it before pgp
            find: '["VIDEO","CLIP","AUDIO"]',
            replacement: {
                match: /(\[\i>0&&\i\.length>0.{0,150}?children:)(.+?)(\}\),)(?<=showDownload:(\i).+?)/,
                replace: "$1[$self.renderAttachmentIcon(arguments[0]),...$2]$3",
            },
        },
    ],

    renderAttachmentIcon({ downloadURL }: { downloadURL: string }) {
        const a = this.url_attachs[downloadURL];
        if (!a) return <></>;
        return (
            <Tooltip text="Copy original url">
                {(tooltipProps) => (
                    <div
                        {...tooltipProps}
                        className={cl("attach-indicator")}
                        role="button"
                        style={{
                            cursor: "pointer",
                            paddingTop: "4px",
                            paddingLeft: "4px",
                            paddingRight: "4px",
                        }}
                        onClick={async () => {
                            await navigator.clipboard.writeText(
                                md(a).originalUrl ?? downloadURL,
                            );
                            showToast("Copied!");
                        }}
                    >
                        <RenderIndicator
                            message={a}
                            noStyle
                            tooltipPosition="bottom"
                        />
                    </div>
                )}
            </Tooltip>
        );
    },

    url_attachs: {} as Record<string, MessageAttachment | undefined>,

    async encryptFile(file: File, channelId: string) {
        if (state.mode == "pt") {
            return file;
        }
        const fr = new FileReader();
        const onLoad = async (dp: (value: unknown) => void) => {
            const b64 = (fr.result as string).split(";base64,")[1];

            if (state.mode == "s") {
                const [stdout, stderr, ec] = await Native.sign(b64, {
                    defaultKey: getSecretKey(),
                    ascii: false,
                    base64Content: true,
                });

                if (ec !== 0) {
                    notifyPGPError(stderr);
                    dp(file);
                    return;
                }

                const blob = new Blob([Uint8Array.fromBase64(stdout ?? "")], {
                    type: "application/pgp-encrypted",
                });

                const sigFile = new File([blob], file.name + ".sig", {
                    type: "application/pgp-encrypted",
                });
                sigFile["pgp"] = true;

                await uploadFiles(
                    [sigFile],
                    ChannelStore.getChannel(channelId),
                    DraftType.ChannelMessage,
                    { requireConfirm: true },
                );

                file["pgp"] = true;
                dp(file);
                return;
            }

            const [stdout, stderr, ec] = await Native.encrypt(
                b64,
                state.recipients,
                {
                    sign: state.mode === "es",
                    defaultKey: getSecretKey(),
                    trustAlways: settings.store.trustAlways,
                    base64Content: true,
                },
            );

            if (ec !== 0) {
                notifyPGPError(stderr);
                dp(file);
                return;
            }

            const blob = new Blob([Uint8Array.fromBase64(stdout ?? "")], {
                type: "application/pgp-encrypted",
            });

            const newFile = new File([blob], file.name + ".pgp", {
                type: "application/pgp-encrypted",
            });
            newFile["pgp"] = true;

            dp(newFile);
        };

        const promise = new Promise((dp) => {
            fr.onload = () => onLoad(dp);
        });
        fr.readAsDataURL(file);
        return promise;
    },

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
                const isSignature = a.filename.endsWith(".sig");
                if (
                    !(
                        isAtchEncrypted ||
                        isSignature ||
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
                    errs: "",
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
                    a["pgp"].errs += out.stderr + "\n";
                    a["pgp"].consumed = true;

                    continue;
                }

                if (isSignature) {
                    const origFilename = a.filename.substring(
                        0,
                        a.filename.length - ".sig".length,
                    );
                    const a2 = message.attachments.find(
                        (a2) => a2.filename == origFilename,
                    );

                    if (!a2) {
                        console.error("couldn't find file for " + a.filename);
                        continue;
                    }

                    const { out, goodSignaturez } = await Native.verifyDetached(
                        a2.url,
                        a.url,
                        true,
                    );

                    a2["pgp"] ??= {};
                    a2["pgp"].hasGoodSignaturez = goodSignaturez;
                    a2["pgp"].isSigned = true;
                    a2["pgp"].errs ??= "";
                    a2["pgp"].errs += out.stderr + "\n";

                    a.filename += " (looked at)";
                    a["pgp"].consumed = true;

                    this.url_attachs[a.url] = a;
                    this.url_attachs[a2.url] = a2;

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
                const isTxt = isPartOf(ext, TEXT_MTYPES);

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

                    a.url = URL.createObjectURL(blob) + "#";
                    a.proxy_url = a.url;
                    // a.content_type = undefined;
                    this.url_attachs[a.url] = a;
                    a.size = blob.size;
                    a.content_type = blob.type;
                    if (isPartOf(blob.type, MTYPES_IMAGE)) {
                        // from PreviewMessage
                        const getImageBox = (
                            url: string,
                        ): Promise<{ width: number; height: number } | null> =>
                            new Promise((res) => {
                                const img = new Image();
                                img.onload = () =>
                                    res({
                                        width: img.width,
                                        height: img.height,
                                    });

                                img.onerror = () => res(null);

                                img.src = url;
                            });

                        const box = await getImageBox(a.url);
                        if (box) {
                            a.width = box.width;
                            a.height = box.height;
                        }
                    } else if (isPartOf(blob.type, MTYPES_VIDEO)) {
                        const getVideoBox = (
                            url: string,
                        ): Promise<{ width: number; height: number } | null> =>
                            new Promise((res) => {
                                const video = document.createElement("video");
                                video.preload = "metadata";

                                video.onloadedmetadata = () =>
                                    res({
                                        width: video.videoWidth,
                                        height: video.videoHeight,
                                    });

                                video.onerror = () => res(null);

                                video.src = url;
                            });

                        const box = await getVideoBox(a.url);
                        if (box) {
                            a.width = box.width;
                            a.height = box.height;
                        }
                    }
                }

                a["pgp"].isEncrypted ||= encrypted;
                a["pgp"].isSigned ||= signed;
                if (goodSignaturez !== undefined) {
                    a["pgp"].hasGoodSignaturez ??= goodSignaturez;
                    a["pgp"].hasGoodSignaturez &&= goodSignaturez;
                }

                a["pgp"].errs += out.stderr + "\n";
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
        this.blobA = document.createElement("a");
        await loadPKs();
        state.skeys = await Native.getSecretKeys();
        state.pkeys = await Native.getPubKeys();

        async function applyPGP(msg: MessageObject, ascii: boolean = true) {
            const encrypt = state.mode.startsWith("e");
            const signOnly = state.mode === "s";

            if ((!encrypt && !signOnly) || msg.content.length == 0) {
                return { cancel: false, unchanged: true };
            }

            if (encrypt) {
                const [stdout, stderr, ec] = await Native.encrypt(
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
        (this.blobA as HTMLAnchorElement).remove();
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
