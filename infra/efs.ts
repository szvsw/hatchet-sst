// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { vpc } from "./vpc"

// Engine Configuration
export const efs = new sst.aws.Efs("Efs", {
    vpc,
});