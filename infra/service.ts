// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import path from "path"

import { appConfig } from "./config"
import { SERVER_TASKQUEUE_RABBITMQ_URL } from "./mq"
import { DATABASE_URL } from "./pg"
import { vpc, endpoints } from "./vpc"
import { broker, brokerSourceSecurityGroup } from "./mq"
import { cluster } from "./cluster"
import { efs } from "./efs"
import { postgres } from "./pg"


// TODO: include these limits in the config (and in the engine? or just setup-config?)
// const _serverLimitsDefaultWorkflowRunLimit = 1000000
// const _serverLimitsDefaultWorkflowRunAlarmLimit = 7500000
// const _serverLimitsDefaultWorkerLimit = 5000
// const _serverLimitsDefaultWorkerAlarmLimit = 7500
// const _serverLimitsDefaultTaskRunLimit = 1000000
// const _serverLimitsDefaultTaskRunAlarmLimit = 7500000
// const _serverLimitsDefaultWorkerSlotLimit = _serverLimitsDefaultWorkerLimit * 100
// const _serverLimitsDefaultWorkerSlotAlarmLimit = _serverLimitsDefaultWorkerAlarmLimit * 100

const { engineCpu, engineMemory, rootDomain } = appConfig


const ADMIN_EMAIL = `hatchet@${rootDomain}`
const ADMIN_PASSWORD = "Hatchet1234567890"
const ADMIN_NAME = "hatchet"

const DEFAULT_TENANT_NAME = "Self-Hosted"
const DEFAULT_TENANT_SLUG = "self-hosted"
const DEFAULT_TENANT_ID = "77a6330d-40e4-4af1-b9e2-b3f713df9250"

// TODO: if no domain is provided, make sure setup still works.
const serviceName = `Engine`
const domain = `hatchet-${$app.stage}.${rootDomain}`

const engineCloudMapName = $interpolate`${serviceName}.${$app.stage}.${$app.name}.${vpc.nodes.cloudmapNamespace.name}`

export const engineAddresses = {
    domain,
    cloudMapHost: engineCloudMapName,
    externalServerUrl: `https://${domain}`,
    internalServerUrl: $interpolate`http://${engineCloudMapName}`, // TODO: Q: should this use https?
    externalGrpcBroadcastAddress: `${domain}:8443`,
    internalGrpcBroadcastAddress: $interpolate`${engineCloudMapName}:7070`, // TODO: Q: will this still work if grpc_insecure=false?
}

const environment = {
    // Confirmed Correct
    DATABASE_URL, // Aurora PG
    SERVER_TASKQUEUE_RABBITMQ_URL, // Amazon MQ RabbitMQ
    SERVER_AUTH_COOKIE_DOMAIN: domain,
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
    SERVER_AUTH_COOKIE_INSECURE: "t", // TODO: I think we can disable this since load balancer has cert? 
    SERVER_GRPC_INSECURE: "t", // Since loadbalancer is using https, can we remove? if so, would this cause problems for workers in the same network not going through LB?
    SERVER_AUTH_SET_EMAIL_VERIFIED: "t",

    // Tenant / Admin
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
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
    environment: {
        DATABASE_URL,
    }
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
    environment: {
        DATABASE_URL,
        SERVER_GRPC_BIND_ADDRESS: "0.0.0.0",
        SERVER_AUTH_SET_EMAIL_VERIFIED: "t",
        SERVER_GRPC_INSECURE: "t",
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
    environment: {
        DATABASE_URL,
    },
    volumes
}


const containers: ContainerArg[] = [
    engineContainer,
    migrationContainer,
    setupConfigContainer,
    dashboardContainer,
]

export const service = new sst.aws.Service(
    serviceName,
    {
        cluster,
        cpu: engineCpu,
        memory: engineMemory,
        loadBalancer: {
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
        },
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

