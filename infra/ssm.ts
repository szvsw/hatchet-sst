// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { defaultTags, normalizeName } from "./utils"

// SSM Parameters
export const databaseUsername = new aws.ssm.Parameter(normalizeName("DatabaseUsername", "/"), {
    name: normalizeName("DatabaseUsername", "/"),
    type: "String",
    value: "hatchet",
    tags: defaultTags
})
export const databasePassword = new aws.ssm.Parameter(normalizeName("DatabasePassword", "/"), {
    name: normalizeName("DatabasePassword", "/"),
    type: "SecureString",
    value: new sst.Secret("DatabasePassword", "hatchet-1234567890").value,
    tags: defaultTags
})
export const brokerUsername = new aws.ssm.Parameter(normalizeName("BrokerUsername", "/"), {
    name: normalizeName("BrokerUsername", "/"),
    type: "String",
    value: "hatchet",
    tags: defaultTags
})
export const brokerPassword = new aws.ssm.Parameter(normalizeName("BrokerPassword", "/"), {
    name: normalizeName("BrokerPassword", "/"),
    type: "SecureString",
    value: new sst.Secret("BrokerPassword", "hatchet-1234567890").value,
    tags: defaultTags
})

export const adminPassword = new aws.ssm.Parameter(normalizeName("AdminPassword", "/"), {
    name: normalizeName("AdminPassword", "/"),
    type: "SecureString",
    value: new sst.Secret("AdminPassword", "Hatchet1234567890").value,
    tags: defaultTags
})