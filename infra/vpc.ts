// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { appConfig } from "./config";
// VPC Configuration
export const vpc = new sst.aws.Vpc("Vpc",
    { bastion: appConfig.bastionEnabled }

);
