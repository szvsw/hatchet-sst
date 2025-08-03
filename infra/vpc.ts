// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from "./config";
import { defaultTags, normalizeName } from "./utils";
// VPC Configuration
// TODO: make az count configurable.
export const vpc = new sst.aws.Vpc("Vpc",
    { bastion: appConfig.bastionEnabled, nat: appConfig.natGateway ? 'managed' : undefined }

);

/*
If the engine is being placed into a private subnet but NAT Gateway is disabled, then
we need to create VPC endpoints to allow ECS to pull images from ECR and so that logging etc
still works.
*/
type VpcEndpoints = {
    EcrApi: aws.ec2.VpcEndpoint
    EcrDkr: aws.ec2.VpcEndpoint
    Logs: aws.ec2.VpcEndpoint
    SecretsManager: aws.ec2.VpcEndpoint
    S3: aws.ec2.VpcEndpoint
}

function createVpcEndpoints(): VpcEndpoints {
    // VPC Endpoints use "PrivateLink" to allow resolving private DNS names inside the VPC
    // to other AWS services, e.g. ECR and S3, which is necessary for pulling container images.
    // TODO: create some dependsOn statements for these 

    const currentRegion = aws.getRegionOutput({})

    const serviceNames = {
        EcrApi: "ecr.api",
        EcrDkr: "ecr.dkr",
        Logs: "logs",
        SecretsManager: "secretsmanager",
        S3: "s3"
    }
    function createInterfaceEndpoint(serviceName: keyof VpcEndpoints, srv: string) {
        const name = normalizeName(`${serviceName}VpcEndpoint`)
        return new aws.ec2.VpcEndpoint(
            name,
            {
                vpcId: vpc.id,
                serviceName: $interpolate`com.amazonaws.${currentRegion.name}.${srv}`,
                vpcEndpointType: "Interface",
                subnetIds: vpc.nodes.privateSubnets.apply(subnets => subnets.map(s => s.id)),
                privateDnsEnabled: true,
                securityGroupIds: vpc.securityGroups,
                tags: defaultTags
            }
        )
    }
    function createGatewayEndpoint(serviceName: keyof VpcEndpoints, srv: string) {
        const name = normalizeName(`${serviceName}VpcEndpoint`)
        return new aws.ec2.VpcEndpoint(
            name,
            {
                vpcId: vpc.id,
                serviceName: $interpolate`com.amazonaws.${currentRegion.name}.${srv}`,
                vpcEndpointType: "Gateway",
                // for gateways, we need to explicitly specify the route table.
                routeTableIds: vpc.nodes.privateRouteTables.apply(tables => tables.map(t => t.id)),
                tags: defaultTags
            }
        )
    }
    function createEndpoint(serviceName: keyof VpcEndpoints, srv: string) {
        // S3 can use a Gateway type endpoint which is effectively free per GB pulled.
        return serviceName === "S3" ? createGatewayEndpoint(serviceName, srv) : createInterfaceEndpoint(serviceName, srv)
    }

    const endpoints = (Object.keys(serviceNames) as (keyof VpcEndpoints)[]).reduce(
        (acc, key) => {
            acc[key] = createEndpoint(key, serviceNames[key]);
            return acc;
        },
        {} as VpcEndpoints
    );

    return endpoints
}

// If the engine is being placed into a private subnet but NAT Gateway is disabled, then
// we need to create VPC endpoints to allow ECS to pull images from ECR.
export const endpoints = (appConfig.enginePrivateSubnet && !appConfig.natGateway) ? createVpcEndpoints() : null