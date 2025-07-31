// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { vpc } from "./vpc";
import { databasePassword, databaseUsername } from "./ssm";
import { appConfig } from "./config";

const { dbInstanceType, dbStorage } = appConfig

// DATABASE CONFIGURATION
export const postgres = new sst.aws.Postgres("Postgres", {
    vpc,
    password: databasePassword.value,
    username: databaseUsername.value,
    database: "hatchet",
    instance: dbInstanceType,
    storage: dbStorage,
});
// TODO: store in a secret and pass in via ssm
export const DATABASE_URL = $interpolate`postgres://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.port}/${postgres.database}`;