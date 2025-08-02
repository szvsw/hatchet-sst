# Hatchet/SST

This is a repository for deploying Hatchet via sst.dev onto AWS.

## Requirements 

You will need an AWS account with credentials, and Node/SST installed.

## How-To

### Purchase a domain (optional, recommended)

~$50/yr

1. Log in to your AWS console.
1. Navigate to Route53.
1. Purchase a domain, write down its name, e.g. `acmelab.com`.

_TODO: document usage without a domain or via an imported domain/certificate arn._

### Getting ready to deploy

_TODO: document secret creation_

1. Copy `.env.example` to `.env.testing` (or `.env.<your-stage-name>`, e.g. `production`)
1. Update `ROOT_DOMAIN` (or delete if not publicly accessible)
1. Update any other configuration variables which might be relevant (e.g. cpu/mem size) _TODO: document how the different ones work_
1. `sst deploy --stage testing` (or `<your-stage-name>`)
1. Visit `hatchet-<your-stage-name>.<your-root-domain>`, e.g. `hatchet-production.acmelab.com` and log into the default admin tenant with `hatchet@<your-root-domain>` and the specified password.


## TODO

document credentials, hatchet login/token generation, config variables, route53, etc.


## Getting in to the VPC:


`.env.x`
```
BASTION_ENABLED=true
```

```
sudo sst tunnel install
sst tunnel
```

### Session from Bastion Instance

The `<instance-id> is returned by SST at the end of the deploy as a stack output.

```
aws ssm start-session --target <instance-id>
```