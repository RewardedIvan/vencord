import { Flex } from "@components/Flex";
import { cl, friendlyKey, Native, state } from ".";
import { savePKs, userPKs } from "./datastore";
import {
    Menu,
    Modal,
    openModal,
    SearchableSelect,
    useMemo,
    useReducer,
    useState,
} from "@webpack/common";
import { BaseText } from "@components/BaseText";
import { Button as VCButton } from "@components/Button";
import { UserContextProps } from "@plugins/biggerStreamPreview";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { PencilIcon } from "@components/Icons";
import { Divider } from "@components/Divider";
import { Margins } from "@components/margins";
import { Message } from "@vencord/discord-types";
import { showNotification } from "@api/Notifications";
import { Span } from "@components/Span";

type Key = import("./native").Key;

function SetUserPubkeyModal({
    userId,
    onClose,
}: {
    userId: string;
    onClose: () => void;
}) {
    const [skey, setSKey] = useState("");
    const [userPKsUpdated, userPKsUpdate] = useReducer((x) => x + 1, 0);

    const usersKeys = useMemo(() => {
        return userPKs
            .entries()
            .filter(([_, v]) => v.includes(userId))
            .map(
                ([fprint, users]) =>
                    [
                        fprint,
                        users,
                        state.pkeys.find((pk) => pk.fprint == fprint),
                    ] as [string, string[], Key | undefined],
            )
            .toArray();
    }, [userId, userPKs, userPKsUpdated]);

    const options = useMemo(() => {
        const userFPrints = usersKeys.map(([fprint]) => fprint);
        return state.pkeys
            .filter((k) => !userFPrints.includes(k.fprint))
            .map((k) => ({
                label: friendlyKey(k),
                value: k.fprint,
            }));
    }, [usersKeys]);

    async function add() {
        // the new Set() is for deduplication
        userPKs.set(skey, [...new Set([...(userPKs.get(skey) ?? []), userId])]);
        await savePKs();
        setSKey("");
        userPKsUpdate();
    }
    async function rm(fprint: string) {
        userPKs.set(
            fprint,
            [...(userPKs.get(fprint) ?? [])].filter((uid) => uid != userId),
        );
        await savePKs();
        userPKsUpdate();
    }

    return (
        <Flex flexDirection="column">
            {usersKeys.map(([fprint, users, key]) => (
                <Flex key={fprint}>
                    <BaseText>
                        {key ? friendlyKey(key) : "pkey not found"}
                    </BaseText>

                    <VCButton onClick={async () => await rm(fprint)}>
                        rm
                    </VCButton>
                </Flex>
            ))}

            <Flex>
                <SearchableSelect
                    placeholder="yeah idk"
                    options={options}
                    onChange={(v) => setSKey(v)}
                    value={options.find((o) => o.value === skey)?.value}
                    closeOnSelect
                />

                <VCButton
                    onClick={add}
                    disabled={!options.some((o) => o.value === skey)}
                >
                    add
                </VCButton>
            </Flex>
            <VCButton onClick={onClose}>close/done</VCButton>
        </Flex>
    );
}

export const userCtxPatch: NavContextMenuPatchCallback = (
    children,
    { user }: UserContextProps,
) => {
    children.unshift(
        <Menu.MenuItem
            id={cl("set-pubkey")}
            label="Set PGP public key"
            icon={PencilIcon}
            action={async () => {
                openModal((modalProps) => (
                    <Modal {...modalProps} title="pgp">
                        <BaseText tag="h2" size="lg">
                            Associate {user.username} with some pgp public keys
                        </BaseText>
                        <Divider className={Margins.bottom8} />
                        <SetUserPubkeyModal
                            userId={user.id}
                            onClose={modalProps.onClose}
                        />
                    </Modal>
                ));
            }}
        />,
    );
};

const PGP_PKEY_REGEX =
    /-{2,}BEGIN PGP PUBLIC KEY BLOCK-{2,}[\s\S]*?-{2,}END PGP PUBLIC KEY BLOCK-{2,}/g;

export const messageCtxPatch: NavContextMenuPatchCallback = (
    children,
    props: { message: Message; itemHref?: string },
) => {
    const { message } = props;
    console.log("propssss", props);
    children.unshift(
        <Menu.MenuItem
            id={cl("import-pubkey")}
            label={
                "import key" + props.itemHref
                    ? " (will check the right-clicked link too)"
                    : ""
            }
            icon={PencilIcon}
            action={async () => {
                var errs = "",
                    keys = 0;
                for (const a of message.attachments) {
                    if (
                        a.filename.endsWith(".asc") ||
                        a.filename.endsWith(".pgp") ||
                        a.filename.endsWith(".gpg")
                    ) {
                        const { imported, out } =
                            await Native.keyImportFromExternal(a.url);
                        errs += out.stderr;
                        if (imported) {
                            keys += 1;
                        }
                    }
                }
                PGP_PKEY_REGEX.lastIndex = 0;
                const matches = [...message.content.matchAll(PGP_PKEY_REGEX)];
                for (const match of matches) {
                    const block = match[0];
                    const { imported, out } = await Native.keyImport(block);
                    errs += out.stderr;
                    if (imported) {
                        keys += 1;
                    }
                }
                if (props.itemHref) {
                    const { imported, out } =
                        await Native.keyImportFromExternal(props.itemHref);
                    errs += out.stderr;
                    if (imported) {
                        keys += 1;
                    }
                }
                showNotification({
                    body: errs,
                    richBody: (
                        <Span style={{ whiteSpace: "pre-wrap" }}>{errs}</Span>
                    ),
                    title: `imported ${keys} public keys`,
                });
            }}
        />,
    );
};
