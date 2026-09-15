import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { findStoreLazy } from "@webpack";
import {
    Avatar,
    ContextMenuApi,
    SelectedGuildStore,
    Tooltip,
    UserStore,
    Menu,
    useMemo,
    useState,
    useEffect,
    useStateFromStores,
    SelectedChannelStore,
} from "@webpack/common";
import { cl, friendlyKey, state } from ".";
import { BaseText } from "@components/BaseText";
import { Flex } from "@components/Flex";
import { FluxStore, GuildMember } from "@vencord/discord-types";
import { settings } from "./settings";
import { userPKs } from "./datastore";
import { CheckIcon } from "./icons";
import { ChatBarIcon, modeFullString } from "./modes";

type Key = import("./native").Key;

const ChannelMemberStore = findStoreLazy("ChannelMemberStore") as FluxStore & {
    getProps(
        guildId?: string,
        channelId?: string,
    ): { groups: { count: number; id: string }[] };
    getRows(guildId?: string, channelId?: string): GuildMember[];
};

function useSidebarMemberList() {
    return useStateFromStores(
        [SelectedChannelStore, SelectedGuildStore, ChannelMemberStore],
        () => {
            const channelId = SelectedChannelStore.getChannelId();
            if (!channelId) return null;
            const guildId = SelectedGuildStore.getGuildId();
            if (!guildId) return null;

            return ChannelMemberStore.getRows(guildId, channelId).filter(
                (t) => t["type"] == "MEMBER",
            );
        },
    );
}

function UIDAvatar({ uid }: { uid: string }) {
    return (
        <Avatar
            className={cl("avatar")}
            size={"SIZE_24"}
            key={uid}
            src={UserStore.getUser(uid)?.getAvatarURL(
                SelectedGuildStore.getGuildId(),
                128,
            )}
        />
    );
}

function Recipient({ pk, uids }: { pk: Key; uids?: string[] }) {
    return (
        <Tooltip
            text={
                <BaseText className={cl("recipient-tooltip-contents")}>
                    {pk.fprint}
                </BaseText>
            }
            position="left"
            allowOverflow
        >
            {({ onMouseEnter, onMouseLeave }) => (
                <Flex
                    alignItems="center"
                    gap="0.25em"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                >
                    <Flex
                        flexDirection="row-reverse"
                        alignItems="center"
                        style={{ flexShrink: 0 }}
                        gap="0px"
                    >
                        {uids?.length &&
                            uids
                                .toReversed()
                                .map((uid) => <UIDAvatar uid={uid} />)}
                    </Flex>
                    <BaseText
                        weight="medium"
                        size="sm"
                        className={cl("recipient-text")}
                    >
                        {friendlyKey(pk)}
                    </BaseText>
                </Flex>
            )}
        </Tooltip>
    );
}

function RecipientsContextMenu({
    e,
}: {
    e: React.MouseEvent<Element, MouseEvent>;
}) {
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
        Object.fromEntries(state.recipients.map((r) => [r, true])),
    );
    const [search, setSearch] = useState("");
    const members = useSidebarMemberList();
    const filtered1StagePKeysUsers = useMemo(() => {
        var pkeysUsers = state.pkeys.map((pk) => ({
            pk,
            uids: userPKs.get(pk.fprint),
        }));
        if (settings.store.recipientsAssociatedOnly) {
            pkeysUsers = pkeysUsers.filter((pku) => pku.uids?.length);
        }
        if (settings.store.recipientsMemberlistOnly) {
            return pkeysUsers.filter(
                ({ pk, uids }) =>
                    uids &&
                    members?.some((m) =>
                        userPKs.get(pk.fprint)?.includes(m.userId),
                    ),
            );
        }
        return pkeysUsers;
    }, [members, userPKs]);
    const filteredPKeysUsers = useMemo(() => {
        return filtered1StagePKeysUsers.filter(
            (e) => e.pk.owner.search(search) != -1,
        );
    }, [filtered1StagePKeysUsers, search]);

    const allVisibleSelected = useMemo(() => {
        return Object.fromEntries(
            filteredPKeysUsers.map((e) => [e.pk.fprint, true]),
        );
    }, [filteredPKeysUsers]);
    const isAllVisibleSelected = useMemo(() => {
        return Object.entries(filteredPKeysUsers).every(
            ([k, v]) => selectedItems[v.pk.fprint],
        );
    }, [filteredPKeysUsers]);

    useEffect(() => {
        state.recipients = Object.entries(selectedItems)
            .filter(([_, v]) => v)
            .map(([k, _]) => k);
    }, [selectedItems]);

    const [defaultSKey, setDefaultSKey] = useState(settings.store.secretKey);
    useEffect(() => {
        settings.store.secretKey = defaultSKey;
    }, [defaultSKey]);

    const handleToggle = (id: string) => {
        setSelectedItems((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    type KeysOfType<T, ValueType> = {
        [K in keyof T]: T[K] extends ValueType ? K : never;
    }[keyof T];

    const toggleSetting = (
        key: KeysOfType<(typeof settings)["store"], boolean>,
    ) => {
        //setMemberlistOnly((v) => !v);
        settings.store[key] = !settings.store[key];
        ContextMenuApi.closeContextMenu();
        e.currentTarget = e.nativeEvent.target as any; // keep the chain going
        ContextMenuApi.openContextMenu(e, () => (
            <RecipientsContextMenu e={e} />
        ));
    };

    // whoever reversed and typed this shit is a lazy fucker
    // well i also am, cuz i didn't type quite everything
    const MenuCheckboxItem = Menu.MenuCheckboxItem as React.ComponentType<
        Omit<React.ComponentProps<typeof Menu.MenuCheckboxItem>, "label"> & {
            label: React.ReactNode;
        }
    >;
    const MenuItem = Menu.MenuItem as React.ComponentType<
        React.ComponentProps<typeof Menu.MenuItem> & {
            dontCloseOnAction?: boolean;
        }
    >;

    return (
        <Menu.Menu
            navId={cl("quick-options")}
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="pgp quick options"
        >
            <Menu.MenuGroup label="PGP settings">
                <Menu.MenuItem
                    id={cl("default-skey")}
                    label={
                        <BaseText
                            weight="medium"
                            size="sm"
                            style={{
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                minWidth: 0,
                            }}
                        >
                            set default secret key
                        </BaseText>
                    }
                >
                    {[
                        {
                            fprint: "whatever",
                            owner: "someone",
                            keySize: 69,
                        } satisfies Key,
                        ...state.skeys,
                    ].map((sk) => (
                        <MenuItem
                            id={cl("default-skey-" + sk.fprint)}
                            action={() => setDefaultSKey(sk.fprint)}
                            dontCloseOnAction
                            label={
                                <Tooltip
                                    text={
                                        <BaseText
                                            className={cl(
                                                "recipient-tooltip-contents",
                                            )}
                                        >
                                            {sk.fprint == "whatever"
                                                ? "uses whatever the backend decides"
                                                : sk.fprint}
                                        </BaseText>
                                    }
                                    position="left"
                                    allowOverflow
                                    key={sk.fprint}
                                >
                                    {({ onMouseEnter, onMouseLeave }) => (
                                        <Flex
                                            alignItems="center"
                                            justifyContent="space-between"
                                            onMouseEnter={onMouseEnter}
                                            onMouseLeave={onMouseLeave}
                                        >
                                            <BaseText
                                                weight="medium"
                                                size="sm"
                                                style={{
                                                    textOverflow: "ellipsis",
                                                    overflow: "hidden",
                                                    minWidth: 0,
                                                }}
                                            >
                                                {sk.fprint == "whatever"
                                                    ? sk.fprint
                                                    : friendlyKey(sk)}
                                            </BaseText>
                                            {defaultSKey == sk.fprint ? (
                                                <CheckIcon
                                                    style={{ flexShrink: 0 }}
                                                />
                                            ) : (
                                                <div />
                                            )}
                                        </Flex>
                                    )}
                                </Tooltip>
                            }
                        />
                    ))}
                </Menu.MenuItem>
                <Menu.MenuCheckboxItem
                    key={cl("pgp-settings-trust-always")}
                    id={cl("pgp-settings-trust-always")}
                    label="trust always"
                    checked={settings.store.trustAlways}
                    action={() => toggleSetting("trustAlways")}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup label="recipients">
                <Menu.MenuControlItem
                    id={cl("recipients-search")}
                    control={(props, ref) => (
                        <Menu.MenuSearchControl
                            {...props}
                            query={search}
                            onChange={setSearch}
                            ref={ref}
                        />
                    )}
                />
                <MenuItem
                    id={cl("recipients-seperator")}
                    render={() => <div style={{ height: "1em" }}></div>}
                    label={<></>}
                />
                <Menu.MenuCheckboxItem
                    key={cl("recipients-memberlist-only")}
                    id={cl("recipients-memberlist-only")}
                    label="from the member list only"
                    checked={settings.store.recipientsMemberlistOnly}
                    action={() => toggleSetting("recipientsMemberlistOnly")}
                />
                <MenuItem
                    id={cl("recipients-select-all")}
                    label={
                        <BaseText>
                            select
                            {isAllVisibleSelected
                                ? " none"
                                : " all visible only"}
                        </BaseText>
                    }
                    dontCloseOnAction
                    action={() => {
                        if (isAllVisibleSelected) {
                            setSelectedItems({});
                        } else {
                            setSelectedItems(allVisibleSelected);
                        }
                    }}
                />
                {filteredPKeysUsers
                    .filter(({ pk }) => pk.caps?.includes("e"))
                    .map(({ pk, uids }) => (
                        <MenuCheckboxItem
                            key={pk.fprint}
                            id={cl(`pkey-recp-${pk.fprint}`)}
                            label={<Recipient pk={pk} uids={uids} />}
                            checked={!!selectedItems[pk.fprint]}
                            action={() => handleToggle(pk.fprint)}
                        />
                    ))}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

export const ChatBarRender: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        ContextMenuApi.openContextMenu(event, () => (
            <RecipientsContextMenu e={event} />
        ));
    };

    const [mode, setMode] = useState(state.mode);

    useEffect(() => {
        state.mode = mode;
    }, [mode]);

    return (
        <ChatBarButton
            tooltip={
                mode == "pt"
                    ? "pgp disabled"
                    : modeFullString(mode) + " using pgp"
            }
            onClick={() => {
                const em = settings.store.enabledModes;
                setMode(em[(em.indexOf(mode) + 1) % em.length]);
            }}
            onContextMenu={handleContextMenu}
            buttonProps={{
                "aria-haspopup": "dialog",
            }}
        >
            <ChatBarIcon mode={mode} />
        </ChatBarButton>
    );
};
