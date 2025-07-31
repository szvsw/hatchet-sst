# Hatchet/SST

This is a repository for deploying Hatchet via sst.dev onto AWS.

You will need an AWS account with credentials and SST installed.

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

Go to the console and find the instance id of bastion runner.

```
aws ssm start-session --target <instance-id>
```