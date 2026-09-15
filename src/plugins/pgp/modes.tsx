import { LockCheckIcon, LockOpenIcon, LockIcon, SignTextIcon } from "./icons";

export const allModes = Object.freeze(["e", "s", "es", "pt"] as const); // encrypt, sign, plaintext
export type Modes = (typeof allModes)[number];

export function modeFullString(m: Modes | "l", pastTense: boolean = false) {
    if (pastTense) {
        switch (m) {
            case "e":
                return "encrypted";
            case "s":
                return "signed";
            case "es":
                return "encrypted and signed";
            case "pt":
                return "plain text";
            case "l":
                return "loading";
        }
    } else {
        switch (m) {
            case "e":
                return "encrypt";
            case "s":
                return "sign";
            case "es":
                return "encrypt and sign";
            case "pt":
                return "plain text";
            case "l":
                return "load";
        }
    }
}

export function ChatBarIcon({ mode }: { mode: Modes }) {
    switch (mode) {
        case "e":
            return <LockIcon />;
        case "s":
            return <SignTextIcon />;
        case "es":
            return <LockCheckIcon />;
        case "pt":
            return <LockOpenIcon />;
    }
}
