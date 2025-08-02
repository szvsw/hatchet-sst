// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

export type Config = {
    rootDomain: string
    dbInstanceType: sst.aws.PostgresArgs["instance"]
    dbStorage: sst.aws.PostgresArgs["storage"]
    engineCpu: sst.aws.ServiceArgs["cpu"]
    engineMemory: sst.aws.ServiceArgs["memory"]
    brokerInstanceType: aws.mq.BrokerArgs["hostInstanceType"]
    bastionEnabled: boolean
    overwriteConfig: "true" | "false"
    natGateway: boolean
    enginePrivateSubnet: boolean
}
// CONFIGURATION VARIABLES
// TODO: better way of validating env data is valid
export const appConfig: Config = {
    rootDomain: process.env.ROOT_DOMAIN,
    dbInstanceType: process.env.DB_INSTANCE_TYPE || "t4g.medium",
    brokerInstanceType: process.env.BROKER_INSTANCE_TYPE || "mq.t3.micro",
    dbStorage: process.env.DB_STORAGE || "20 GB",
    engineCpu: process.env.ENGINE_CPU || "4 vCPU",
    engineMemory: process.env.ENGINE_MEMORY || "20 GB",
    enginePrivateSubnet: process.env.ENGINE_PRIVATE_SUBNET === "true" || false,
    bastionEnabled: process.env.BASTION_ENABLED === "true" || false,
    overwriteConfig: process.env.OVERWRITE_CONFIG === "true" ? "true" : "false",
    natGateway: process.env.NAT_GATEWAY === "true" || false,
} as Config
if (!appConfig.rootDomain) {
    throw new Error("ROOT_DOMAIN is required")
}