# Hatchet/SST

This is a repository for deploying [Hatchet](https://hatchet.run) via [sst.dev](https://sst.dev) in [AWS](https://aws.amazon.com).

## Requirements 

You will need an AWS account with credentials, as well as Docker, Node and SST installed.

_TODO: document installing these and setting up credentials_

## Deploying the Stack

### Purchase a domain (optional, recommended)

~$50/yr

1. Log in to your AWS console.
1. Navigate to Route53.
1. Purchase a domain, write down its name, e.g. `acmelab.com`.

_TODO: document usage without a domain or via an imported domain/certificate arn._

### Getting ready to deploy

`sst` let's you manage different `stages` (aka environments) when you deploy, including 
some cool functionality around dev deployments, but we will not worry about that for now.  
By default, when you run a command like `sst deploy`, it will deploy to an environment 
with your current OS username - e.g. for me that's `szvsw` on my work computer but `sam` 
on my home computer.  You can always override which stage you want to deploy by passing 
in the `--stage <stage-name>` flag to the CLI.  By default, `sst` will also load in any
configuration variables you set in a corresponding `.env.<stage-name>` file.

1. Copy `.env.example` to `.env.<stage-name>` (e.g. `<your-os-username>` or `production`)
1. Update `ROOT_DOMAIN` (or delete if not publicly accessible)
1. Update any other configuration variables which might be relevant (e.g. cpu/mem size)

_TODO: document config vars, considerations when deploying in a private subnet_

### Setting secrets

1. `sst secret set DatabasePassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set BrokerPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set AdminPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars, must contain a caps value)

### Time to deploy!

1. `sst deploy --stage <stage-name>`
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

_TODO: document using pgadmin through the tunnel, accessing the dashboard thru the tunnel if a private subnet is used, etc_