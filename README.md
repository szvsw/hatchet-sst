# Hatchet/SST

This is a repository for deploying [Hatchet](https://hatchet.run) via [sst.dev](https://sst.dev) in [AWS](https://aws.amazon.com).

## Requirements 

You will need an AWS account with credentials, as well as Docker, Node and SST installed.

_TODO: document installing these and setting up credentials_

## Deploying the Stack

### Purchase a domain (optional, recommended)

> You can skip this step if you only want the engine available to worker nodes in the 
same VPC (or via tunneling).  If you do not know what this means, then you should buy a 
domain!

In most cases, you will want to make the engine available over the open internet so that 
you will be able to visit the Hatchet dashboard to check task progresses and allow worker
nodes on your local machine to easily connect to the engine.  

The easiest way to do this is to purchase a domain through AWS Route53, and let sst.dev 
automatically configure all of the relevant DNS settings, certs for SSL, load balancer 
config etc.  Depending on how luxurious you are feeling with your choice of domain, this
is probably approx. $50/yr for the domain + the monthly LB costs (approx. $30/mo, but if 
you are just standing up the engine for infrequent experiment runs, e.g. once or twice a 
month and then tearing down, it's much less).

1. Log in to your AWS console.
1. Navigate to Route53.
1. Purchase a domain, write down its name, e.g. `acmelab.com`.


> If you have an externally managed domain, you will need to create a certificate in ACM
and add it to the env vars - more documentation coming soon.  It's pretty easy though! Essentially
just need to add one or two records to your DNS config via your DNS provider's console and 
wait 20 min.

### Getting ready to deploy

`sst` let's you manage different `stages` (aka environments) when you deploy, including 
some cool functionality around dev deployments, but we will not worry about that for now.  By 
default, when you run a command like `sst deploy`, it will deploy to an environment 
with your current OS username - e.g. for me that's `szvsw` on my work computer but `sam` 
on my home computer.  You can always override which stage you want to deploy by passing 
in the `--stage <stage-name>` flag to the CLI.  By default, `sst` will also load in any
configuration variables you set in a corresponding `.env.<stage-name>` file.

1. Copy `.env.example` to `.env.<stage-name>` (e.g. `<your-os-username>` or `production`)
1. Update `ROOT_DOMAIN` (or delete if not accessible over the internet)
1. Update any other configuration variables which might be relevant (e.g. cpu/mem size)

| EnvVar | Type | Description |
| -- | -- | -- |
| `ROOT_DOMAIN` | `undefined` or `valid domain in Route53`| The root domain which will be used for making Hatchet accessible.  The dashboard will be available at `hatchet-<stage-name>.<root-domain>`, e.g.  `hatchet-production.acmelab.com`.  If omitted or `false`, the engine will only be accessible inside the same VPC. |
| `DB_INSTANCE_TYPE` | [supported instances](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.DBInstanceClass.SupportAurora.html) | What type of AWS instance to use for the Aurora Postgres database. _nb: omit the `db.` prefix from the instance type name_ |
| `BROKER_INSTANCE_TYPE` | [supported instances](https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/rmq-broker-instance-types.html) | What type of AWS instance to use for the AmazonMQ RabbitMQ broker. _nb: do NOT omit the `mq.` prefix from the instance type name_ |
| `ENGINE_CPU` | [supported vCPU count](https://github.com/sst/sst/blob/46446fbe38b210e18e8a3641f1e0b9de19b9f890/platform/src/components/aws/fargate.ts#L42) | How many vCPUs the Hatchet engine service should use.  _nb: the combination of cpu/mem must be valid_ |
| `ENGINE_MEMORY` | [supported vCPU count](https://github.com/sst/sst/blob/46446fbe38b210e18e8a3641f1e0b9de19b9f890/platform/src/components/aws/fargate.ts#L42) | How much memory the Hatchet engine service should use. _nb: the combination of cpu/mem must be valid_ |
| `ENGINE_PRIVATE_SUBNET` | `boolean` | Whether or not to deploy the engine inside a private subnet. _nb: if `true`, additional monthly costs will be incurred because either a NAT Gateway or PrivateLink VPC Endpoints will be added in order to pull containers from ECR. |
| `NAT_GATEWAY` | `boolean` | Whether to add a NAT Gateway to the VPC.  If `false` and `ENGINE_PRIVATE_SUBNET=true`, then PrivateLink VPC Endpoints will be added so that containers can still be pulled. |
| `BASTION_ENABLED` | `boolean` | Whether to add a Bastion instance in your VPC which gives you remote access/tunneling capabilities |
| `OVERWRITE_CONFIG` | `boolean` | Whether to regenerate the base Hatchet config before redeploying the engine. |


_TODO: document config vars, considerations when deploying in a private subnet_

### Setting secrets

1. `sst secret set DatabasePassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set BrokerPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set AdminPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars, must contain an uppercase value, a lowercase value, and a number)

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