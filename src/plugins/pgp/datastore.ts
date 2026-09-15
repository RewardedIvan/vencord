import { DataStore } from "@api/index";

// fprint: [userIds]
export var userPKs = new Map<string, string[]>();

export async function savePKs() {
    await DataStore.set("vc-pgp-user-pubkeys", userPKs);
}

export async function loadPKs() {
    userPKs = (await DataStore.get("vc-pgp-user-pubkeys")) ?? new Map();
}
