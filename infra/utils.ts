// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />


export const normalizeName = (name: string, separator: string = "-") => {
    return `${separator === "/" ? "/" : ""}${$app.name}${separator}${$app.stage}${separator}${name}`
}