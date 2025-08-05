// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { z } from "zod"
import { supportedCpus, supportedMemories } from "@/.sst/platform/src/components/aws/fargate"

type SupportedCpuNames = keyof typeof supportedCpus

const names = [...Object.keys(supportedCpus)] as SupportedCpuNames[]

const typedEnum = <T extends string>(arr: T[]) =>
    z.enum(arr as [T, ...T[]]);

type EnvConfig = {
    rootDomain?: string
    brokerInstanceType?: string
    dbInstanceType?: string
    dbStorage?: string
    engineCpu?: string
    engineMemory?: string
    enginePrivateSubnet: boolean
    bastionEnabled: boolean
    overwriteConfig: "true" | "false"
    natGateway: boolean
}

export type Config = {
    rootDomain?: string
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

const configFromEnv: EnvConfig = {
    rootDomain: process.env.ROOT_DOMAIN,
    brokerInstanceType: process.env.BROKER_INSTANCE_TYPE,
    dbInstanceType: process.env.DB_INSTANCE_TYPE,
    dbStorage: process.env.DB_STORAGE,
    engineCpu: process.env.ENGINE_CPU,
    engineMemory: process.env.ENGINE_MEMORY,
    enginePrivateSubnet: process.env.ENGINE_PRIVATE_SUBNET === "true",
    bastionEnabled: process.env.BASTION_ENABLED === "true",
    overwriteConfig: process.env.OVERWRITE_CONFIG === "true" ? "true" : "false",
    natGateway: process.env.NAT_GATEWAY === "true",
}

const configSchema = z.object({
    rootDomain: z.string().min(1).optional().or(z.literal(undefined)),
    dbInstanceType: z.string().default("t4g.medium"),
    dbStorage: z.string().default("20 GB").refine(x => /^\d+ GB$/.test(x), {
        message: "DB storage must be a number followed by ' GB'"
    }),
    engineCpu: typedEnum(names).default("4 vCPU"),
    engineMemory: z.string().default("20 GB").refine(x => /^\d+ GB$/.test(x), {
        message: "Engine memory must be a number followed by ' GB'"
    }),
    brokerInstanceType: z.string().default("mq.t3.micro"),
    bastionEnabled: z.boolean().default(false),
    overwriteConfig: z.enum(["true", "false"]).default("false"),
    natGateway: z.boolean().default(false),
    enginePrivateSubnet: z.boolean().default(false),
}).refine((data) => {
    const validMemoryChoices = supportedMemories[data.engineCpu]
    const isValidMemory = Object.keys(validMemoryChoices).includes(data.engineMemory)
    return isValidMemory
}, {
    message: "Invalid engine memory choice for selected engine CPU count."
})

type ParsedConfig = z.output<typeof configSchema>


function castToSSTPulumTypes(config: ParsedConfig): Config {
    return {
        rootDomain: config.rootDomain,
        dbInstanceType: config.dbInstanceType as sst.aws.PostgresArgs["instance"],
        dbStorage: config.dbStorage as sst.aws.PostgresArgs["storage"],
        engineCpu: config.engineCpu as sst.aws.ServiceArgs["cpu"],
        engineMemory: config.engineMemory as sst.aws.ServiceArgs["memory"],
        brokerInstanceType: config.brokerInstanceType as aws.mq.BrokerArgs["hostInstanceType"],
        bastionEnabled: config.bastionEnabled,
        overwriteConfig: config.overwriteConfig,
        natGateway: config.natGateway,
        enginePrivateSubnet: config.enginePrivateSubnet,
    }
}


// CONFIGURATION VARIABLES
const validatedConfig = configSchema.parse(configFromEnv)
export const appConfig: Config = castToSSTPulumTypes(validatedConfig)