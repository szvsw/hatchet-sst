// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import path from "path"

import { appConfig } from "./config"
import { brokerUrlSecret } from "./mq"
import { dbUrlSecret } from "./pg"
import { vpc, endpoints } from "./vpc"
import { broker, brokerSourceSecurityGroup } from "./mq"
import { cluster } from "./cluster"
import { efs } from "./efs"
import { postgres } from "./pg"
import { adminPassword } from "./ssm"

// TODO: include these limits in the config (optionally in the engine?)
const SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_LIMIT = 1_000_000
const SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_ALARM_LIMIT = 750_000
const SERVER_LIMITS_DEFAULT_WORKER_LIMIT = 5_000
const SERVER_LIMITS_DEFAULT_WORKER_ALARM_LIMIT = 7_500
const SERVER_LIMITS_DEFAULT_TASK_RUN_LIMIT = 1_000_000
const SERVER_LIMITS_DEFAULT_TASK_RUN_ALARM_LIMIT = 750_000
const SERVER_LIMITS_DEFAULT_WORKER_SLOT_LIMIT = SERVER_LIMITS_DEFAULT_WORKER_LIMIT * 100
const SERVER_LIMITS_DEFAULT_WORKER_SLOT_ALARM_LIMIT = SERVER_LIMITS_DEFAULT_WORKER_ALARM_LIMIT * 100

const { engineCpu, engineMemory, rootDomain } = appConfig


export const ADMIN_EMAIL = `hatchet@${rootDomain ?? "example.com"}`
const ADMIN_NAME = "hatchet"

const DEFAULT_TENANT_NAME = "Self-Hosted"
const DEFAULT_TENANT_SLUG = "self-hosted"
const DEFAULT_TENANT_ID = "77a6330d-40e4-4af1-b9e2-b3f713df9250"

const serviceName = `Engine`
const engineCloudMapName = $interpolate`${serviceName}.${$app.stage}.${$app.name}.${vpc.nodes.cloudmapNamespace.name}`

const domain = rootDomain ? `hatchet-${$app.stage}.${rootDomain}` : null

const internalServerUrl = $interpolate`http://${engineCloudMapName}`
const externalServerUrl = domain ? `https://${domain}` : internalServerUrl
const internalGrpcBroadcastAddress = $interpolate`${engineCloudMapName}:7070`
const externalGrpcBroadcastAddress = domain ? `${domain}:8443` : internalGrpcBroadcastAddress

export const engineAddresses = {
    domain: domain ?? engineCloudMapName,
    cloudMapHost: engineCloudMapName,
    externalServerUrl,
    internalServerUrl,
    externalGrpcBroadcastAddress,
    internalGrpcBroadcastAddress,
}

const environment = {
    // Confirmed Correct
    SERVER_AUTH_COOKIE_DOMAIN: domain ?? engineAddresses.domain,
    SERVER_DEFAULT_ENGINE_VERSION: "V1",

    // Seems correct, but have questions
    // Currently, loadbalancer routes
    // - https/443 -> dashboard:80
    // - http/80 -> dashboard:80
    // - https/8443 -> engine:7070
    SERVER_URL: engineAddresses.externalServerUrl,
    SERVER_GRPC_BIND_ADDRESS: "0.0.0.0", // When would you ever change this?
    SERVER_GRPC_BROADCAST_ADDRESS: engineAddresses.externalGrpcBroadcastAddress, // nb: workers in the same VPC can bypass this by using the internal grpc broadcast address
    SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS: engineAddresses.internalGrpcBroadcastAddress, // TODO: Q: I think service connect is set up and working, but not positive? How would I know if it's working?

    // correct, but should be changed in production
    SERVER_AUTH_COOKIE_INSECURE: domain ? "f" : "t",
    SERVER_GRPC_INSECURE: "t", // even tho loadBalancer is using https for gRPC, we need to keep this as true since we have not set up certs
    SERVER_AUTH_SET_EMAIL_VERIFIED: "t",

    // SERVER LIMITS
    SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_LIMIT: SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_ALARM_LIMIT: SERVER_LIMITS_DEFAULT_WORKFLOW_RUN_ALARM_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_WORKER_LIMIT: SERVER_LIMITS_DEFAULT_WORKER_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_WORKER_ALARM_LIMIT: SERVER_LIMITS_DEFAULT_WORKER_ALARM_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_TASK_RUN_LIMIT: SERVER_LIMITS_DEFAULT_TASK_RUN_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_TASK_RUN_ALARM_LIMIT: SERVER_LIMITS_DEFAULT_TASK_RUN_ALARM_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_WORKER_SLOT_LIMIT: SERVER_LIMITS_DEFAULT_WORKER_SLOT_LIMIT.toString(),
    SERVER_LIMITS_DEFAULT_WORKER_SLOT_ALARM_LIMIT: SERVER_LIMITS_DEFAULT_WORKER_SLOT_ALARM_LIMIT.toString(),

    // Tenant / Admin
    ADMIN_EMAIL,
    ADMIN_NAME,
    DEFAULT_TENANT_NAME,
    DEFAULT_TENANT_SLUG,
    DEFAULT_TENANT_ID,
}

const volumes: NonNullable<sst.aws.ServiceArgs["volumes"]> = [
    {
        path: "/mnt/efs",
        efs,
    }
]

type ContainerArg = NonNullable<sst.aws.ServiceArgs["containers"]>[number]

const dockerfileDir = "infra/dockerfiles"
const migrationDockerfile = path.join(dockerfileDir, "Dockerfile.migration")
const setupConfigDockerfile = path.join(dockerfileDir, "Dockerfile.setup-config")
const engineDockerfile = path.join(dockerfileDir, "Dockerfile.engine")
const dashboardDockerfile = path.join(dockerfileDir, "Dockerfile.dashboard")

const migrationContainer: ContainerArg = {
    name: "migration",
    image: {
        dockerfile: migrationDockerfile,
        context: ".",
    },
    entrypoint: ["/hatchet/hatchet-migrate"],
    ssm: {
        DATABASE_URL: dbUrlSecret.arn,
    },
}

const setupConfigContainer: ContainerArg = {
    name: "setup-config",
    image: {
        dockerfile: setupConfigDockerfile,
        context: ".",
    },
    entrypoint: ["/hatchet/hatchet-admin"],
    command: ["quickstart", "--skip", "certs", "--generated-config-dir", "/mnt/efs/config", `--overwrite=${appConfig.overwriteConfig}`],
    environment,
    ssm: {
        ADMIN_PASSWORD: adminPassword.arn,
        DATABASE_URL: dbUrlSecret.arn,
        SERVER_TASKQUEUE_RABBITMQ_URL: brokerUrlSecret.arn,
    },
    volumes
}

const engineContainer: ContainerArg = {
    name: "engine",
    image: {
        dockerfile: engineDockerfile,
        context: ".",
    },
    entrypoint: ["/hatchet/hatchet-engine"],
    command: ["--config", "/mnt/efs/config"],
    environment,
    ssm: {
        DATABASE_URL: dbUrlSecret.arn,
    },
    volumes
}

const dashboardContainer: ContainerArg = {
    name: "dashboard",
    image: {
        dockerfile: dashboardDockerfile,
        context: ".",
    },
    entrypoint: ["sh", "./entrypoint.sh"],
    command: ["--config", "/mnt/efs/config"],
    environment,
    ssm: {
        DATABASE_URL: dbUrlSecret.arn,
    },
    volumes
}


const containers: ContainerArg[] = [
    engineContainer,
    migrationContainer,
    setupConfigContainer,
    dashboardContainer,
]

const loadBalancer: sst.aws.ServiceArgs["loadBalancer"] | undefined = domain ? {
    domain,
    rules: [
        {
            listen: "80/http",
            container: "dashboard",
            forward: "80/http",
        },
        {
            listen: "443/https",
            container: "dashboard",
            forward: "80/http",
        },
        {
            listen: "8443/https", // Must be HTTPS in order for healthcheck.protocolVersion = "GRPC" to work
            container: "engine",
            forward: "7070/http",
        },
    ],
} : undefined

export const service = new sst.aws.Service(
    serviceName,
    {
        cluster,
        cpu: engineCpu,
        memory: engineMemory,
        loadBalancer,
        containers,
        link: [efs, postgres, broker],
        transform: {
            target(args) {
                // We need to transform the protocolVersion so that the loadbalancer 
                // health checks for the engine service are GRPC; if we fail to do this,
                // then the health check will use HTTP and fail.
                if (args.port === 7070) {
                    args.protocolVersion = "GRPC"
                    args.protocol = "HTTP"
                }
            },
            taskDefinition: (args) => {
                // We want to make sure that the migration and setup-config containers
                // run to completion before the engine and dashboard containers start.
                // As such, we need to set the dependsOn property for the engine and dashboard
                // containers to include the migration and setup-config containers, and set
                // the essential property to false for the migration and setup-config containers.
                // NB: this is different than the pulumi-level `dependsOn` property, which is
                // a service/infra level dependency that controls order of infra creation.
                const defs = $jsonParse(args.containerDefinitions)
                type DependsOn = { containerName: string, condition: string }
                type PortMapping = { containerPort: number, hostPort: number, appProtocol: "gRPC" | "http" | "http2" }
                type Def = { name: string, dependsOn: DependsOn[], essential: boolean, portMappings: PortMapping[] }
                defs.apply((defs: Def[]) => {
                    defs.forEach((def) => {
                        if (["migration", "setup-config"].includes(def.name)) {
                            def.essential = false
                        }
                        if (def.name === "setup-config") {
                            def.dependsOn = [
                                {
                                    containerName: "migration",
                                    condition: "SUCCESS",
                                },
                            ]
                        }
                        if (["engine", "dashboard"].includes(def.name)) {
                            def.dependsOn = [
                                {
                                    containerName: "migration",
                                    condition: "SUCCESS",
                                },
                                {
                                    containerName: "setup-config",
                                    condition: "COMPLETE", // TODO: preferably would be SUCCESS, but currently we are getting a Tenant_pkey error.
                                }
                            ]
                        }
                    })
                })
                args.containerDefinitions = $jsonStringify(defs)
            },
            service(args, opts) {
                // We need to add the broker source security group to the service so that
                // the engine and dashboard containers can communicate with the broker.
                if (args.networkConfiguration) {
                    const securityGroups = vpc.securityGroups.apply((groups) => [...groups, brokerSourceSecurityGroup.id])
                    const subnets = appConfig.enginePrivateSubnet ? vpc.privateSubnets : vpc.publicSubnets
                    const assignPublicIp = appConfig.enginePrivateSubnet ? false : true
                    args.networkConfiguration = {
                        ...args.networkConfiguration,
                        securityGroups,
                        subnets,
                        assignPublicIp,
                    }
                }
                if (endpoints) {
                    const endpointNodes = Object.values(endpoints)
                    if (opts.dependsOn) {
                        if (Array.isArray(opts.dependsOn)) {
                            opts.dependsOn = [...opts.dependsOn, ...endpointNodes]
                        } else {
                            // TODO: set the dependsOn here.
                            // for some reason, the type checker doesn't like the curent setup when DependsOn is a single value

                        }
                    } else {
                        opts.dependsOn = endpointNodes
                    }
                }
            }
        }
    },
)

