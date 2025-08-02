// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from "./config"
import { adminPassword } from "./ssm"
import { vpc } from "./vpc"
import { efs } from "./efs"
import { broker } from "./mq"
import { postgres } from "./pg"
import { cluster } from "./cluster"
import { service, engineAddresses, ADMIN_EMAIL as adminEmail } from "./service"

export {
    vpc,
    cluster,
    efs,
    postgres,
    broker,
    service,
    engineAddresses,
    appConfig,
    adminEmail,
    adminPassword,
}