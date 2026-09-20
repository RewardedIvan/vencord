import { Flex } from "@components/Flex";
import { cl, friendlyKey, Native, state } from ".";
import { BaseText } from "@components/BaseText";
import { Switch } from "@components/Switch";
import { Button as VCButton } from "@components/Button";
import { ArrowDropDown, ArrowDropUp } from "./icons";
import { definePluginSettings } from "@api/Settings";
import { OptionType, PluginSettingComponentProps } from "@utils/types";
import {
    Modal,
    openModal,
    Select as WPSelect,
    TextInput,
    useEffect,
    useState,
} from "@webpack/common";
import { allModes, ChatBarIcon, modeFullString, Modes } from "./modes";
import { RenderModalProps } from "@vencord/discord-types";
import { Divider } from "@components/Divider";
import { Margins } from "@components/margins";

function ModeElement({
    m,
    i,
    modes,
    setModes,
}: {
    m: Modes;
    i: number;
    modes: Modes[];
    setModes: React.Dispatch<React.SetStateAction<Modes[]>>;
}) {
    function rollArrayRight<T>(arr: T[], i: number): T[] {
        return arr.toSpliced(i - 1, 2, arr[i], arr[i - 1]);
    }
    function rollArrayLeft<T>(arr: T[], i: number): T[] {
        return arr.toSpliced(i, 2, arr[i + 1], arr[i]);
    }

    return (
        <Flex
            alignItems="center"
            justifyContent="space-between"
            style={{ maxWidth: "100%" }}
            key={m}
        >
            <Flex alignItems="center">
                <ChatBarIcon mode={m} />
                <BaseText>{modeFullString(m)}</BaseText>
                <Switch
                    checked={true}
                    disabled={modes.length == 1}
                    onChange={() =>
                        setModes((ms) => ms.filter((fm) => fm != m))
                    }
                />
            </Flex>
            <Flex alignItems="center">
                {i != 0 ? (
                    <VCButton
                        variant="none"
                        onClick={() => setModes((ms) => rollArrayRight(ms, i))}
                        size="iconOnly"
                    >
                        <ArrowDropUp />
                    </VCButton>
                ) : (
                    <div style={{ width: 32, height: 32 }} />
                )}
                {i != modes.length - 1 ? (
                    <VCButton
                        variant="none"
                        onClick={() => setModes((ms) => rollArrayLeft(ms, i))}
                        size="iconOnly"
                    >
                        <ArrowDropDown />
                    </VCButton>
                ) : (
                    <div style={{ width: 32, height: 32 }} />
                )}
            </Flex>
        </Flex>
    );
}

function renderEnabledModes(props: PluginSettingComponentProps) {
    const [modes, setModes] = useState(settings.store.enabledModes);
    useEffect(() => {
        props.setValue(modes);
    }, [modes]);

    return (
        <Flex flexDirection="column" gap="0.2em">
            <BaseText size="md" weight="medium">
                Modes
            </BaseText>
            <BaseText>
                choose the order of the modes that the chatbar button cycles
                through
            </BaseText>
            <Flex flexDirection="column">
                {modes.map((m, i) => (
                    <ModeElement
                        m={m}
                        i={i}
                        setModes={setModes}
                        modes={modes}
                    />
                ))}
                {allModes
                    .filter((e) => !modes.includes(e))
                    .map((m) => (
                        <Flex alignItems="center" key={m}>
                            <ChatBarIcon mode={m} />
                            <BaseText>{modeFullString(m)}</BaseText>
                            <Switch
                                checked={false}
                                onChange={() => setModes((ms) => [...ms, m])}
                            />
                        </Flex>
                    ))}
            </Flex>
        </Flex>
    );
}

function GenerateModal({ rootProps }: { rootProps: RenderModalProps }) {
    const [keyType, setKeyType] = useState("default");
    const [keyCurve, setKeyCurve] = useState("default");
    const [keyLength, setKeyLength] = useState(2048);

    const [keyTypes, setKeyTypes] = useState([] as string[]);
    const [curveTypes, setCurveTypes] = useState([] as string[]);

    const Select = WPSelect as React.ComponentType<
        React.ComponentProps<typeof WPSelect> & {
            label: string;
        }
    >;

    useEffect(() => {
        Native.getKeyAlgos().then((e) => setKeyTypes(e ?? []));
        Native.getCurveTypes().then((e) => setCurveTypes(e ?? []));
    }, []);

    return (
        <Modal {...rootProps} title="Generate Key">
            <Flex gap="1em">
                <Select
                    options={["default", ...keyTypes].map((t) => ({
                        label: t,
                        value: t,
                    }))}
                    label="key type"
                    select={(v) => setKeyType(v)}
                    isSelected={(v) => v === keyType}
                    serialize={String}
                />
                {!keyType.startsWith("EC") ? (
                    <TextInput
                        label="key length"
                        value={keyLength}
                        onChange={(v) => setKeyLength(Number(v))}
                    />
                ) : (
                    <Select
                        options={["default", ...curveTypes].map((t) => ({
                            label: t,
                            value: t,
                        }))}
                        label="key curve"
                        select={(v) => setKeyCurve(v)}
                        isSelected={(v) => v === keyCurve}
                        serialize={String}
                    />
                )}
            </Flex>

            <Divider className={Margins.bottom16} />
            <Flex flexDirection="column">
                <VCButton
                    onClick={() =>
                        Native.generateKey({
                            keyType,
                            keyLength,
                        })
                    }
                >
                    generate
                </VCButton>
            </Flex>
        </Modal>
    );
}

function renderSecretKey(props: PluginSettingComponentProps) {
    const [skey, setSKey] = useState(settings.store.secretKey);
    useEffect(() => {
        props.setValue(skey);
    }, [skey]);

    return (
        <Flex flexDirection="column" gap="0.2em">
            <BaseText size="md" weight="medium">
                Secret Key
            </BaseText>
            <BaseText>
                choose which secret key to use for encrypting/signing
            </BaseText>
            <WPSelect
                options={[
                    { label: "whatever", value: "whatever" },
                    ...state.skeys.map((sk) => ({
                        label: friendlyKey(sk),
                        value: sk.fprint,
                    })),
                ]}
                select={(v) => setSKey(v)}
                isSelected={(v) => v === skey}
                serialize={String}
            />
            <Flex flexDirection="row" gap="0.2em">
                <VCButton
                    onClick={() =>
                        openModal((p) => <GenerateModal rootProps={p} />)
                    }
                >
                    generate
                </VCButton>
                <VCButton>import</VCButton>
            </Flex>
        </Flex>
    );
}

export const settings = definePluginSettings({
    recipientsMemberlistOnly: {
        type: OptionType.BOOLEAN,
        default: false,
        description:
            "in the quick menu, show recipients that are in the member list only",
    },
    recipientsAssociatedOnly: {
        type: OptionType.BOOLEAN,
        default: true,
        description:
            "in the quick menu, show recipients that have associated discord users only",
    },
    trustAlways: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "trust all the keys",
    },
    enabledModes: {
        type: OptionType.COMPONENT,
        default: [...allModes],
        component: renderEnabledModes,
    },
    secretKey: {
        type: OptionType.COMPONENT,
        default: "whatever",
        component: renderSecretKey,
    },
    autoDecryptAttachments: {
        type: OptionType.BOOLEAN,
        default: true,
        description:
            "automatically downloads (to ram) and decrypts every .pgp/gpg attachment",
    },
    autoDecryptAttachmentsMaxSize: {
        type: OptionType.NUMBER,
        default: 10,
        description:
            "(in megabytes) will not automatically download (to ram) and decrypt an attachment if it's above this limit (set to 0 for no limit)",
    },
    skipMessageLengthUpsell: {
        type: OptionType.BOOLEAN,
        default: true,
        description:
            "will send your message as a file if it's over the length limit without asking you",
    },
    hideConsumedAttachments: {
        type: OptionType.BOOLEAN,
        default: true,
        description:
            "hides all attachments that have been consumed, like signatures or content inserts",
    },
    encryptAttachments: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "en..crypts attachemnts..",
    },
});
