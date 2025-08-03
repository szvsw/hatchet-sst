# Hatchet/SST

This is a repository for deploying [Hatchet](https://hatchet.run) via 
[sst.dev](https://sst.dev) + [Pulumi](https://www.pulumi.com/) in [AWS](https://aws.amazon.com).  

This is aimed at someone who is looking to integrate Hatchet into their stack and needs 
self-hosting, but is not an expert in AWS.

The Hatchet managed cloud offers a [free tier](https://hatchet.run/pricing), however if
you do the kind of embarassingly parallel simulation work I do, the limitations on 
simultaneous Worker counts will prevent it from being relevant to you.  You would likely
need to go with a custom plan for the kind of workload pattern I have - e.g. running 
experiments with a few million simulations over a few thousands workers, but only once or 
twice a month, if that. I recommend you get in touch with the team to discuss pricing, 
because (a) they are super helpful and (b) if you are an academic like me, you would 
probably prefer to use managed infra rather than worring about your own.

In any case, it's relatively easy to self-deploy Hatchet (and inexpensive, assuming you 
don't mind standing up and tearing down infra each time you run an experiment, assuming
infrequent but highly bursty needs). It's only a few resources really - an AmazonMQ RabbitMQ broker, an Aurora/RDS Postgres 
database, and an ECS service with the actual Hatchet engine and web UI dashboard. Having said 
that, there are also serveral conveniences pre-configured so that you can easily
deploy in private subnets or with/without an internet-facing load balancer. If 
you have cloud infra experience, you may prefer to roll your own deployment, however, if
not, this should be enough to get you off the ground with Hatchet relatively quickly. 

Hatchet's official [self-hosting docs](https://docs.hatchet.run/self-hosting) include lots 
more information, including official support for Kubernetes w/ Helm charts or glasskube, 
but as someone with no real experience with K8S, I felt it was personally easier for me
to go the route of translating the [Docker Compose Deployment](https://docs.hatchet.run/self-hosting/docker-compose) instructions into ECS.

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
wait 20 min. _TODO: enable certificate referencing_

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


_TODO: considerations when deploying workers in a private subnet_

### Setting secrets

1. `sst secret set DatabasePassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set BrokerPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars)
1. `sst secret set AdminPassword <your-password> --stage <stage-name>` (nb: must be 12+ chars, must contain an uppercase value, a lowercase value, and a number)

### Time to deploy!

1. `sst deploy --stage <stage-name>`
1. Visit `hatchet-<your-stage-name>.<your-root-domain>`, e.g. `hatchet-production.acmelab.com` and log into the default admin tenant with `hatchet@<your-root-domain>` and the specified password.

## Deploying workers in the same subnet when a load balancer is present

If you have configured `ROOT_DOMAIN=your-domain.com`, a load balancer is automatically
configured and Hatchet's engine is configured to tell workers via the fields encoded in a JWT
API token to send the appropriate HTTP(s)/gRPC traffic via 
`hatchet-<your-stage-name>.<root_domain>` and `hatchet-<your-stage-name>.<root_domain>:8443` 
respectively.  These resolve to the load balancer, which then routes traffic to the appropriate
containers.  

There's a good chance you might be spinning up thousands of worker nodes, in
which case you probably want to skip the load balancer altogether, which you can do 
by deploying the worker nodes in the same VPC as the engine (_TODO: auto-deploy docs coming soon_)
and using the cloudmap namespace domains.

However, because the client JWTs you generate still have the load balancer URLs encoded in
the relevant fields, you need to override some environment variables when deploying the worker.

In addition to setting `HATCHET_CLIENT_TOKEN`, you will also need to set:

```
HATCHET_CLIENT_SERVER_URL=http://Engine.<your-stage-name>.hatchet.sst
HATCHET_CLIENT_HOST_PORT=Engine.<your-stage-name>.hatchet.sst:7070
HATCHET_CLIENT_TLS_STRATEGY=none
```

You can find the relevant URLs in the results of `sst deploy` under `EngineAddresses` in `internalServerUrl` and `internalGrpcBroadcastAddress`.

## Deploying engine without ingress from the internet

If you need to deploy without ingress from the internet, simply omit the `ROOT_DOMAIN`
env var or set it to `false`.  This will result in the deployment skipping the configuration
of a Load Balancer for the Hachet service.  However, this means that you will not be able to
connect local workers to Hatchet or check the dashboard from your machine, at least not with
some networking-fu. By default, this will still deploy the service in the public subnets
of your VPC, but there will be no ingress pathway from your local machine to the service.

Fortunately, `sst` makes it relatively easy to get connected to the VPC.

> NB: your choice of private/public subnets for the engine containers are irrelevant here,
since the tunnel we establish in the VPC will already have ingress rules which allow traffic
to reach the engine.


### Setting up Bastion & the tunnel

> _nb: if you are on windows, you will need to use WSL for this part_

1. First, you will need to set `BASTION_ENABLED=true` and redploy (`sst deploy --stage <your-stage-name>`).  Copy the Bastion Instance ID (something like `i-asdf1348`) to your clipboard for use later.
1. (install tunneling via `sudo sst tunnel install` if you have not already)
1. Open up a tunnel with `sst tunnel --stage <your-stage-name>`

### Accessing the dashboard

1. Open up a Firefox, then open `Settings > Network Settings > Settings`
1. Select `Manual proxy configuration`
1. Configure the `SOCKS` Proxy `host` field as `localhost` and the `port` field as `1080`.
1. Make sure that `SOCKS v5` is selected.
1. Click `OK` to save settings.
1. Open a shell on your Bastion Instance: `aws ssm start-session --target <Bastion-instance-id>`
1. Run `dig +short engine.<your-stage-name>.hatchet.sst` to print out the IP address of the engine service within the VPC (you can also check this from the AWS console).
1. Open your `hosts` file in a text editor (on Mac/Linux, this is at `/etc/hosts`, on windows it's at `C:/Windows/System32/drivers/etc`) and add a record at the end which says `<ipaddress> Engine.<your-stage-name>.hatchet.sst`, e.g. `10.0.10.136 Engine.szvsw.hatchet.sst`.  This will tell your computer to route the url to the ip address, while the proxy we configured in Firefox will tell your computer to route the IP address through the tunnel into the VPC.
1. You can now access the dashboard via the internal cloudmap namespace server url, which should be something like `Engine.<your-stage-name>.hatchet.sst`.
1. Default log-in email will be `hatchet@example.com` with your specified password from `sst secret`. 

> _nb: though it's not particularly problematic to leave it there, it's probably a good idea to 
remove the record you added to your `hosts` file as well as the proxy settings in Firefox when you
are done lest you confuse yourself in the future.

### Opening a shell in the VPC

You can remotely access your Bastion instance by running:

```
aws ssm start-session --target <Bastion-instance-id>
```

### Workers in the VPC

You will of course need to deploy your workers in the same VPC.  By default, the a client token
generated from the dashboard following the instructions above should work fine - it will use
the internal cloudmap namespace correctly.  However, you will need to set an additional env var
on the worker:

```
HATCHET_CLIENT_TLS_STRATEGY=none
```

## Depoying workers

_TODO: example of worker deployment_



## TODO

document credentials, hatchet login/token generation


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