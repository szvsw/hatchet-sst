// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { vpc } from "./vpc";
import { databasePassword, databaseUsername } from "./ssm";
import { appConfig } from "./config";
import { defaultTags, normalizeName } from "./utils";

const { dbInstanceType, dbStorage } = appConfig

// DATABASE CONFIGURATION
export const postgres = new sst.aws.Postgres("Postgres", {
    vpc,
    password: databasePassword.value,
    username: databaseUsername.value,
    database: `hatchet_${$app.stage.replace("-", "_")}`,
    instance: dbInstanceType,
    storage: dbStorage,
});

const dbUrl = $interpolate`postgres://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.port}/${postgres.database}`;
export const dbUrlSecret = new aws.ssm.Parameter(normalizeName("DatabaseUrl", "/"), {
    name: normalizeName("DatabaseUrl", "/"),
    type: "SecureString",
    value: dbUrl,
    tags: defaultTags
});

