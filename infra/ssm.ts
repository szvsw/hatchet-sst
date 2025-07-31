// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { normalizeName } from "./utils"

// SSM Parameters
export const databaseUsername = new aws.ssm.Parameter(normalizeName("DatabaseUsername", "/"), {
    type: "String",
    value: "hatchet",
})
export const databasePassword = new aws.ssm.Parameter(normalizeName("DatabasePassword", "/"), {
    type: "SecureString",
    value: "hatchet-1234567890", // TODO: initialize or otherwise load from env var/sst secret
})
export const brokerUsername = new aws.ssm.Parameter(normalizeName("BrokerUsername", "/"), {
    type: "String",
    value: "hatchet",
})
export const brokerPassword = new aws.ssm.Parameter(normalizeName("BrokerPassword", "/"), {
    type: "SecureString",
    value: "hatchet-1234567890", // TODO: initialize or otherwise load from env var/sst secret
})