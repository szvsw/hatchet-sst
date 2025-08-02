// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { normalizeName } from "./utils";
import { appConfig } from "./config";
import { brokerUsername, brokerPassword } from "./ssm";
import { vpc } from "./vpc";

const { brokerInstanceType } = appConfig

// BROKER CONFIGURATION
// We need to create a security group for the broker to be in so that it can be accessed
// by the engine's service.
export const brokerTargetSecurityGroup = new aws.ec2.SecurityGroup(
    normalizeName("BrokerTargetSecurityGroup"),
    {
        vpcId: vpc.id,
    }
)
// We need to create a security group for the engine to be in so that it can access the broker.
export const brokerSourceSecurityGroup = new aws.ec2.SecurityGroup(
    normalizeName("BrokerSourceSecurityGroup"),
    {
        vpcId: vpc.id,
    }
)

// We need to allow the engine to access the broker.
export const brokerIngressRule = new aws.vpc.SecurityGroupIngressRule(
    normalizeName("BrokerIngressRule"),
    {
        securityGroupId: brokerTargetSecurityGroup.id,
        fromPort: 5671,
        toPort: 5671,
        ipProtocol: "tcp",
        referencedSecurityGroupId: brokerSourceSecurityGroup.id,
    }
)

// We need to allow the engine to access the broker's API.
export const brokerApiIngressRule = new aws.vpc.SecurityGroupIngressRule(
    normalizeName("BrokerApiIngressRule"),
    {
        securityGroupId: brokerTargetSecurityGroup.id,
        fromPort: 15671,
        toPort: 15671,
        ipProtocol: "tcp",
        referencedSecurityGroupId: brokerSourceSecurityGroup.id,
    }
)

export const broker = new aws.mq.Broker(
    normalizeName("Broker"),
    {
        brokerName: normalizeName("Broker"),
        engineType: "RabbitMQ",
        engineVersion: "3.13",
        autoMinorVersionUpgrade: true,
        hostInstanceType: brokerInstanceType,
        publiclyAccessible: false,
        deploymentMode: "SINGLE_INSTANCE",
        logs: {
            general: true,
        },
        users: [{
            consoleAccess: true,
            username: brokerUsername.value,
            password: brokerPassword.value, // TODO: can this come from ssm?
        }],
        securityGroups: [brokerTargetSecurityGroup.id],
        subnetIds: [vpc.privateSubnets.apply((subnets) => subnets[0])],
    }
);

const brokerUrlWithoutProtocol = broker.instances[0].endpoints[0].apply((endpoint) => {
    return endpoint.split("://")[1]
})

// TODO: username and password are not resolving from broker output, so using a common ancestor (ssm)
const brokerUrl = $interpolate`amqps://${brokerUsername.value}:${brokerPassword.value}@${brokerUrlWithoutProtocol}`

export const brokerUrlSecret = new aws.ssm.Parameter(normalizeName("BrokerUrl", "/"), {
    name: normalizeName("BrokerUrl", "/"),
    type: "SecureString",
    value: brokerUrl,
});


