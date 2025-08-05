# Building a toolkit for embarrassingly parallel experiments using Hatchet + SST.dev

In my experience helping colleagues with their research projects,
academic researchers and engineers (as in actual engineers, not SWEs) often have the ability to define their
experiments via input and output specs fairly well and would love to run at large scales,
but often get limited by a lack of experience with distributed computing techniques,
eg. artifact infil- and exfiltration, handling errors, interacting with supercomputing schedulers,
dealing with cloud infrastructure, etc.

As part of the collaborative research process, I ended up developing - and re-developing -
my workflows for running both my own and my colleagues' emabarrassingly parallel experiments,
which eventually resulted in the creation of a library I've called [Scythe](https://github.com/szvsw/scythe).
Scythe is a lightweight tool which helps you seed and reap (scatter and gather)
emabarassingly parallel experiments via the asynchronous distributed queue [Hatchet](https://hatchet.run).

The goal of Scythe is to abstract away some of those unfamiliar cloud/distributed computing 
details to let researchers focus on what they are familiar with (i.e. writing consistent
input and output schemas and the computation logic that transforms data from inputs into
outputs) while automating the boring but necessary work to run millions of simulations (e.g.
serializing data to and from cloud buckets, configuring queues, etc).

There are of course lots of data engineering orchestration tools out there already, but Scythe
is a bit more lightweight and hopefully a little simpler to use, at the expense of fewer bells and whistles (for now)
like robust dataset lineage, etc.

[Hatchet](https://hatchet.run) is already very easy (and fun!) to use for newcomers to
distributed computing, so I recommend checking out their docs - you might be better off
simply directly running Hatchet! Scythe is just a lightweight modular layer on top of it
which is really tailored to the use case of generating large datasets of consistently structured
experiment inputs and outputs. Another option you might check out would be something like [Coiled + Dask](https://coiled.io/).

## Motivation for this writeup

I'm writing this for a few reasons - 

- to condense some of the knowledge that I think is most useful for other people looking
to get into large-scale distributed cloud computing (large at least in the context of 
academia, specifically engineering/applied ML fields, as opposed to say AI research) who
might otherwise take a while to get up to speed on stuff, and/or who feel extensive pain trying
to learn their institutions archaic and arcane supercomputing cluster patterns (ahem) when all
they wan to do is just run a shitload of simulations. 
- to give back to and participate in the community of developers who share their experiences
and challenges on their internet, and in so doing hopefully help at least one other person
learn and grow, the way countless others have helped me with their blog posts, videos, tutorials, 
books, etc.
- to reflect on some of the work I've been doing in the course of my Masters/PhD that does not 
get it to make it into the papers I write, but which is arguably more complex and valuable
from a personal skill development perspective.

## Context

Buildings account for ~40% of global emissions, mostly via space heating snd cooling. My 
research @ the MIT Sustainable Design Lab (School of Architecture+Planning) is focused on
decarbonizing the built environment by developing tools which leverage distributed computing 
and machine learning to accelerate large-scale bottom up building energy modeling within retrofit
planning frameworks used by policymakers, utility operators, real estate portfolio owners, and 
homeowners. 

As part of that work, I often work on research projects/experiments for myself or colleagues
with anywhere from 10e3 to 10e7 building energy simulations, and so have had to develop workflows 
which can handle operating at the requisite scale. 

> _You are probably immediately wondering what the carbon cost of the research is. Across all my
the simulations I've invoked, assuming some carbon factors and PUE factors for the AWS us-east-1
data center, I've estimated it to be on the order or 1 month of emissions associated with a 
typical single family home in New England. Definitely not nothing, but definitely small enough 
that if just one or two additional homes or businesses install a heat pump and do some airsealing
that wouldn't have otherwise, it will make the research net carbon negative. Could there have been 
a better use for that carbon spent on compute that might result in even greater carbon leverage?
Maybe, probably, but this is what I do and work on and enjoy, so for now I just hope for the best._


## Development history

Over the past few years, I've worked on and off on the system I use when I need to run
a few million simulations at a time, including rewriting things from the ground up a few 
times.  There's probably a component of that which is just wanting to try out a fancy new
thing I've learned about each time, another component which is wanting to grow as a 
developer by re-evaluating and re-designing something to achieve the same goal but with 
lessons learned and a better eye for what would be useful functionality, and finally a 
component of that is to satisfy the desire to get things to a place where someone else 
can actually take advantage of and make use of some of my work product in the open source
spirit.

- v-2: Spring 2023: Earning the `embarrassing` in the name: embarrassingly parallel, and 
embarrassingly architected. Spin up a bunch of instances on [PaperSpace](paperspace.com) 
(now owned by DigitalOcean) each with very high numbers of CPUs, open up virtual desktop 
via web UI, use [tmux](https://github.com/tmux/tmux/wiki) to start 30-ish simulation 
processes per instance. Each process does ~1k-2k sims, writes an HDF file with all of its
sim results to S3, eventually run a separate collector after completion to combine S3 
results.
- v-1: Summer 2023 - Spring 2024: Roll your own. Use SQS to ingest a message for each 
different simuation, then spin up AWS Batch array job with a few thousand worker nodes 
(Fargate Spot) which chew through messages from the queue, exit after queue has been empty for 
some amount of time.  Ugly attempts at dynamic leaf task invocation.
- v0: Summer 2024 - Spring 2025: Adopt [Hatchet](hatchet.run) (v0) as the async distributed
queue instead of SQS. Abstract common/shared scatter/gather logic to decouple simulation
fanout patterns from underlying leaf tasks.  Still create Hatchet worker nodes via AWS Batch 
(Fargate Spot). Use AWS Copilot CLI (blech) if self-deploying Hatchet, but mostly use
managed Hatchet.
- v1: Summer 2025+: Adopt Hatchet v1, fully isolate experiment creation/tracking into 
re-usable extensible patterns including middleware for things like data infiltration/exfiltration
by creating [Scythe](https://github.com/szvsw/scythe).  Create simpler self-hosting config
via [sst.dev](https://sst.dev).

### The other path(s).

There's probably one main alternative solution which *might* be a better choice than what I have
settled on: [Coiled](https://coiled.io) + [Dask](https://dask.org).  It's pretty easy to use,
setup, get started with, easy to spin up a ton of compute very quickly, etc.  I think had
I come across Coiled earlier, I might have just gone that route.  I didn't come across it until
Fall 2024, and I had already put substantial design time into the version using Hatchet,
so there was a bit of a sunk cost thing going on there, but I also just genuinely really
liked Hatchet's design decisions and the team from hatchet had already
been super fun and easy to work with as I was stress testing some of their managed infra, 
so I felt it was worth it to continue with Hatchet - as well as for a variety of other reasons which I 
probably will not get into in this post.  I guess one of them is that software stack at 
the building/real estate decarbonization planning SaaS startup that that I do ML engineering
work at ([CarbonSignal](https://carbonsignal.com)) makes heavy use of Celery, and I would
like to eventually move us away from Celery to Hatchet if we ever do a refactor of the 
async task management part of the stack, which we probably won't ("if it ain't broke..."), 
but if we do I would at least like to be prepared to make an argument for switching.

There's of course other bits of tooling like Dagster, Airflow, Prefect etc that play a role 
in workflow orchestration and data management, plus platforms like Weights & Biases or Neptune.ai
that play a role in experiment tracking (I actually really like WandB and use it at CarbonSignal), 
but I think these are mostly overkill in the context I am most typically working 
(academic experiments run once or twice a month - if that - with a few million tasks in 
each experiment).

## Scythe - from a user perspective


Scythe is useful for running many parallel simulations with a common I/O interface.
It abstracts away the logic of uploading and referencing artifacts, issuing simulations 
and combining results into well-structured dataframes and parquet files.

After an experiment is finished, you will have a directory in your S3 bucket with the 
following structure:

```
<experiment_id>/
├──── <datetime>/
│     ├──── manifest.yml
│     ├──── experiment_io_spec.yml
│     ├──── input_artifacts.yml
│     ├──── specs.pq
│     ├──── artifacts/
│     │     ├──── <field-1>/
│     │     │     ├──── file1.ext
│     │     │     └──── file2.ext
│     │     └──── <field-1>/
│     │     │     ├──── file1.ext
│     │     │     └──── file2.ext
│     │     ...
│     ├──── scatter-gather/
│     │     ├──── input/
│     │     └──── output/
│     ├──── final/
│     │     ├──── scalars.pq
│     │     ├──── <user-dataframe>.pq
│     │     ├──── <user-dataframe>.pq
├──── <datetime>/
...
```

In this example, we will demonstrate setting up a building energy simulation so we can 
create a dataset of energy modeling results for use in training a surrogate model.

To begin, we start by defining the schema of the inputs and outputs. The inputs will 
ultimately be converted into dataframes (where the defined input fields are columns). 
Similarly, the output schema fields will be used as columns of results dataframes 
(and the input dataframe will actualy be used as a MultiIndex). 

Note that `FileReference` inputs, which can be `HttpUrl | S3Url | Path`, which are of 
type `Path` will automatically be uploaded to S3 and re-referenced as S3 URIs.

```py
from pydantic import Field
from scythe.base import ExperimentInputSpec, ExperimentOutputSpec
from scythe.types import FileReference

class BuildingSimulationInput(ExperimentInputSpec):
    """Simulation inputs for a building energy model."""

    r_value: float = Field(default=..., description="The R-Value of the building [m2K/W]", ge=0, le=15)
    lpd: float = Field(default=..., description="Lighting power density [W/m2]", ge=0, le=20)
    setpoint: float = Field(default=..., description="Thermostat setpoint [deg.C]", ge=12, le=30)
    economizer: Literal["NoEconomizer", "DifferentialDryBulb", "DifferentialEnthalpy"] = Field(default=..., description="The type of economizer to use")
    weather_file: FileReference = Field(default=..., description="Weather file [.epw]")
    design_day_file: FileReference = Field(default=..., description="Weather file [.ddy]")


class BuildingSimulationOutput(ExperimentOutputSpec):
    """Simulation outputs for a building energy model."""

    heating: float = Field(default=..., description="Annual heating energy usage, kWh/m2", ge=0)
    cooling: float = Field(default=..., description="Annual cooling energy usage, kWh/m2", ge=0)
    lighting: float = Field(default=..., description="Annual lighting energy usage, kWh/m2", ge=0)
    equipment: float = Field(default=..., description="Annual equipment energy usage, kWh/m2", ge=0)
    fans: float = Field(default=..., description="Annual fans energy usage, kWh/m2", ge=0)
    pumps: float = Field(default=..., description="Annual pumps energy usage, kWh/m2", ge=0)
```

The schemas above will be exported into your results bucket as `experiment_io_spec.yaml` 
including any docstrings and descriptions.

_nb: you can also add your own dataframes to the outputs, e.g. for non-scalar values 
like timeseries and so on. documentation coming soon._

Next, we define the actual simulation logic. We will decorate the simulation function 
with an indicator that it should be a part of our `ExperimentRegistry`, which configures 
all of the fancy scatter/gather logic. Note that the function can only take a single 
argument (the schema defined previously) and can only return a single output instance of 
the previously defined output schema (though additional dataframes can be stored in the 
`dataframes` field inherited from the base `ExperimentOutputSpec`.).

```py
from scythe.registry import ExperimentRegistry

@ExperimentRegistry.Register()
def simulate_energy(input_spec: BuildingSimulationInput) -> BuildingSimulationOutput:
    """Initialize and execute an energy model of a building."""

    # do some work!
    ...

    return BuildingSimulationOutput(
        heating=...,
        cooling=...,
        lighting=...,
        equipment=...,
        fans=...,
        pumps=...
        dataframes=...,
    )
```

Since `BuildingSimulationInput` inherited from `ExperimentInputSpec`, some methods automatically exist on the class, e.g. `log` for writing messages to the worker logs, or methods for fetching common artifact files from remote resources like S3 or a web request into a cacheable filesystem.

**_TODO: document artifact fetching, writing artifacts per experiment_**

**_TODO: document allocating experiments, infra_**

After the experiment is finished running all tasks, it will automatically produce an output file `scalars.pq` with all of the results defined on your output schema for each of the individual simulations that were executed.

The index of the dataframe will itself be a dataframe with the input specs and some additional metadata, e.g:

`MultiIndex`
| experiment_id | sort_index | root_workflow_run_id | r_value | lpd | setpoint |
| --- | --- | --- | ---: |---:|---:|
| bem/v1 | 0 | abcd-efgh | 5.2 | 2.7 | 23.5 |
| bem/v1 | 1 | abcd-efgh | 2.9 | 1.3 | 19.7 |
| bem/v1 | 2 | abcd-efgh | 4.2 | 5.4 | 21.4 |

`Data`
| heating | cooling | lighting | equipment | fans | pumps |
| ---:| ---:| ---:| ---:| ---:| ---:|
| 17.2 | 15.3 | 10.1 | 13.8 | 14.2 | 1.4 |
| 21.7 | 5.4 | 9.2 | 5.8 | 10.3 | 2.0 |
| 19.5 | 8.9 | 12.5 | 13.7 | 8.9 | 0.9 |

**_TODO: document how additional dataframes of results are handled._**

Additionally, in your bucket, you will find a `manifest.yml` file as well as an `input_artifacts.yml` and `experiment_io_spec.yml`.

`manifest.yml`

```yaml
experiment_id: building_energy/v1/2025-07-23_12-59-51
experiment_name: scythe_experiment_simulate_energy
input_artifacts: s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/input_artifacts.yml
io_spec: s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/experiment_io_spec.yml
specs_uri: s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/specs.pq
workflow_run_id: f764ef33-a377-4572-a398-a2dc56a0810f
```

`input_artifacts.yml`

```yaml
files:
  design_day_file:
    - s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/artifacts/design_day_file/USA_MA_Boston.Logan_TMYx.ddy
    - s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/artifacts/design_day_file/USA_CA_Los.Angeles.LAX_TMYx.ddy
  weather_file:
    - s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/artifacts/weather_file/USA_MA_Boston.Logan_TMYx.epw
    - s3://mit-sdl/scythe/building_energy/v1/2025-07-23_12-59-51/artifacts/weather_file/USA_CA_Los.Angeles.LAX_TMYx.epw
```

`experiment_io_spec.yml`

```yaml
$defs:
  BuildingSimulationInput:
    additionalProperties: true
    description: Simulation inputs for a building energy model.
    properties:
      design_day_file:
        anyOf:
          - format: uri
            minLength: 1
            type: string
          - format: uri
            maxLength: 2083
            minLength: 1
            type: string
          - format: path
            type: string
          - format: file-path
            type: string
        description: Weather file [.ddy]
        title: Design Day File
      economizer:
        description: The type of economizer to use
        enum:
          - NoEconomizer
          - DifferentialDryBulb
          - DifferentialEnthalpy
        title: Economizer
        type: string
      experiment_id:
        description: The experiment_id of the spec
        title: Experiment Id
        type: string
      lpd:
        description: Lighting power density [W/m2]
        maximum: 20
        minimum: 0
        title: Lpd
        type: number
      r_value:
        description: The R-Value of the building [m2K/W]
        maximum: 15
        minimum: 0
        title: R Value
        type: number
      root_workflow_run_id:
        anyOf:
          - type: string
          - type: "null"
        default: null
        description: The root workflow run id of the leaf.
        title: Root Workflow Run Id
      setpoint:
        description: Thermostat setpoint [deg.C]
        maximum: 30
        minimum: 12
        title: Setpoint
        type: number
      sort_index:
        description: The sort index of the leaf.
        minimum: 0
        title: Sort Index
        type: integer
      weather_file:
        anyOf:
          - format: uri
            minLength: 1
            type: string
          - format: uri
            maxLength: 2083
            minLength: 1
            type: string
          - format: path
            type: string
          - format: file-path
            type: string
        description: Weather file [.epw]
        title: Weather File
      workflow_run_id:
        anyOf:
          - type: string
          - type: "null"
        default: null
        description: The workflow run id of the leaf.
        title: Workflow Run Id
    required:
      - experiment_id
      - sort_index
      - r_value
      - lpd
      - setpoint
      - economizer
      - weather_file
      - design_day_file
    title: BuildingSimulationInput
    type: object
  BuildingSimulationOutput:
    description: Simulation outputs for a building energy model.
    properties:
      cooling:
        description: Annual cooling energy usage, kWh/m2
        minimum: 0
        title: Cooling
        type: number
      equipment:
        description: Annual equipment energy usage, kWh/m2
        minimum: 0
        title: Equipment
        type: number
      fans:
        description: Annual fans energy usage, kWh/m2
        minimum: 0
        title: Fans
        type: number
      heating:
        description: Annual heating energy usage, kWh/m2
        minimum: 0
        title: Heating
        type: number
      lighting:
        description: Annual lighting energy usage, kWh/m2
        minimum: 0
        title: Lighting
        type: number
      pumps:
        description: Annual pumps energy usage, kWh/m2
        minimum: 0
        title: Pumps
        type: number
    required:
      - heating
      - cooling
      - lighting
      - equipment
      - fans
      - pumps
    title: BuildingSimulationOutput
    type: object
description: The input and output schema for the experiment.
properties:
  input:
    $ref: "#/$defs/BuildingSimulationInput"
    description: The input for the experiment.
  output:
    $ref: "#/$defs/BuildingSimulationOutput"
    description: The output for the experiment.
required:
  - input
  - output
title: ExperimentIO
type: object
```


## Scythe - from a developer perspective



## Cloud Infrastructure

This will assume that you have limited at least some knowledge of
[Docker](https://docker.com) and containers, but otherwise will try to introduce you to 
some of the key parts of the cloud deployment - and really cloud computing in general. It
covers some stuff that's pretty boring but it's not something that you will really learn
in the normal course of your academic research, and it's ultimately relatively simple to 
at least get to working knowledge with, so I think it's worth covering here.

### Self-hosting Hatchet as an intro to cloud configuration

While I actually think there's a good chance you are likely to be better off using 
[the managed Hatchet cloud](hatchet.run) (see my price comparison with self-hosting 
[here](https://github.com/szvsw/hatchet-sst?tab=readme-ov-file#cost-estimate)), if we 
are looking at what it takes to stand up an open source experiment tracking engine, I 
don't think it would be right to do so while relying on managed infra (as wonderfully 
easy and convenient as it is)!  Plus, for my use-case of simply running a few million
simulations once or twice a month, it's only about $13/day to run the Hatchet engine and then tear
it down when done (rather than paying for the entire stack monthly or for the managed cloud).

[Hatchet](https://github.com/hatchet-dev/hatchet) is composed of a few pieces - a broker
(RabbitMQ), a database (Postgres), the engine (written in Go - this is where most of 
Hatchet's magic happens), a web dashboard (Next) and an API (also in Go).  The Hatchet 
team has written a bunch of really 
[great blog posts](https://docs.hatchet.run/blog/multi-tenant-queues) which give you a peek 
into the underlying infrastructure, including some of the benefits of using pg as part of 
an async queue stack. The [release notes](https://github.com/hatchet-dev/hatchet/releases/tag/v0.55.26) 
also often include a lot of cool technical details which I encourage you to check out as well.

The official [Hatchet self-hosting docs](https://docs.onhatchet.run/self-hosting) already 
include deployment instructions for Kubernetes/Helm, but I do not have real experience with 
them, so I instead went the route of building out my own infra. The actual 
infrastructure-as-code for self-deploying Hatchet that I wrote is all done with 
[sst.dev](https://sst.dev) + [Pulumi](https://pulumi.com), and can be found with a bunch 
of detailed instructions in the [szvsw/hatchet-sst](https://github.com/szvsw/hatchet-sst) 
repository. This was my first time using both SST & Pulumi, but I have experience with 
Terraform as well as AWS Copilot CLI+CloudFormation (blech) as well as plenty of experience 
just doing things manually in the console, so picking up SST/Pulumi was straightforwrd enough.

After reading this section, you should have enough knowledge to dive into 
[szvsw/hatchet-sst](https://github.com/szvsw/hatchet-sst) and start customizing things to 
your liking or ripping things out and replacing - or even just rebuilding things on your own
in the AWS Console.

So, let's get into it!  

#### The VPC

When you are at home, you have a whole bunch of resources which all need to talk to each 
other, and possibly the internet - your laptop, your smart TV, your cell phone, your printer, 
etc.  They all sit behind your router and form a network where the devices can talk to
each other via the router without sending messages out over the internet, while some of 
them can additionally send or even receive messages from the big internet beyond through
the router. We can think of this cluster of devices as a local private cloud.  

On AWS, a _Virtual Private Cloud_ (_VPC_) can be thought of similarly - it's just where 
all of the different pieces of your infrastructure live in a shared network so that they 
can find each other and (possibly) talk to the internet, with lots of configurability for 
how the resources are allowed to (or not!) communicate with each other, what kinds of traffic
they are allowed to receive, how exposed they are to the internet, etc.

Our VPC itself lives inside of a _region_, which is just AWS parlance for "a bunch of 
datacenters in a particular location, e.g. North Virginia" (`us-east-1` stans rise up). 
Because, for some unknown, mysterious-to-me reasons, these datacenters very occasionally 
like to take a mental health day, each region will have a few different
_availability zones_ (_AZs_), (e.g. `us-east-1a` or `us-east-1b`) which are really just 
specific subgroups of the actual datacenter buildings within the same region that are 
nevertheless separated by enough distance to at least not be affected by the same tornado 
(yes, that seems to be an official metric, at least according to the
[AWS marketing](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/)). I
like to think of them as being close enough to support the same professional sports teams 
but different high school sports teams.  It's pretty common practice when setting up your 
VPC to specify that it will use two or three availability zones, but for our purposes we 
could probably get away with one.  For the types of computing I do, I've never really had
to think about AZs much, besides a few pieces of infrastructure which scale their cost 
with the number of AZs (like PrivateLink VPC Endpoints).

When the VPC gets created, it typically gets one _private subnet_ and one _public subnet_ 
created for each AZ. Resources in the VPC can always find and talk to each other, but 
resources in the private subnet cannot cannot reach or be reached by the outside internet 
(by default - they can in fact reach the internet with some extra bits and bobs attached) while 
resources in the public subnet can automatically reach the external internet (though
not necessarily be reached by it).  This is a little bit of a simplification, but it's 
the mental model I've always used and it has worked for me. You can think of this as if 
you had two routers set up at home, both connected to each other, but only one of them 
connected to your internet provider. You might put a device like your printer on the router
that's not connected to the internet, while you would put your smart TV on the one that is.
Of course you could set up some extra tooling to allow you to say, trigger a printout on your home
printer from work, but it would require following specific patterns to do so.

#### Public vs Private Subnets

> _nb: we use the term `egress` when the resource in question is initiating connections to
some other resource and receiving a response, while `ingress` would indicate that the resource
in question is open to connections initiated by some other resource and providing responses. 
At least that's how I think of it!_

Let's think through which subnets to use for each of our resources:

| Resource | Subnet | Reasoning |
| -- | -- | -- |
| Database | Private | The database does definitely does not need any internet egress or ingress. It just needs to be reachable inside the VPC by the Hatchet engine/API. |
| Broker | Private | Same as the db. |
| Load Balancer | Public | The load balancer will be responsible for routing internet ingress traffic from worker nodes (e.g. deployed locally on your machine) to the engine or API containers, or user traffic on the web UI dashboard to the dashboard container. As such, it definitely needs to be in the public subnet. |
| Hatchet Engine | Public or Private | The engine does not inherently need internet egress during operations, so we can definitely put it in a private subnet if we want; however, the service does need to pull container images from Elastic Container Registry (ECR) before starting up, and by default that requires internet egress even though ECR is still in the AWS region; however if we want the engine in a private subnet, we can just add a NAT Gateway or AWS PrivateLink VPC endpoints to allow the private subnet to reach ECR. Now you might be thinking - well, these services might need internet ingress so that local workers outside of the VPC can talk to the engine, and you would be right - but since we are using a load balancer to front the application, the load balancer can be in the public subnet while then routing traffic to the appropriate targets in the private subnet. |
| Hatchet Dashboard | Public or Private | Same as above. |

#### Security Groups

_Security groups_ (_SGs_) are just the logical groupings with rules that allow you to easily define which resources in your 
subnet are allowed to talk to which other resources.  A security group can have both ingress
and egress rules - who will this group accept incoming traffic from and on what ports/protocol? 
Who is this group allowed to send outgoing traffic to and on what ports/protocol? For instance,
suppose you have an EC2 compute instance up in a public subnet with a public IP address assigned
which you want to allow yourself to SSH into.  You could create a security group to place
that instance inside of which has a rule that says "allow ssh traffic via TCP/port 22 from *my IP address*", 
(AWS helpfully has a button you can click to resolve your personal IP address automatically).

To keep things simple then, we can just create a default security group that allows each service to send 
outbound traffic to any IP on any port and allow inbound traffic on any port but only from
IPs which are inside the VPC. Note that just because the security group allows outbound traffic
doesn't mean every resource can reach the internet (e.g. those in the subnet have no path) - 
it just means if it tries to make one such request, it won't get blocked by the security
group's rules. Now this is pretty permissive, even if each resource is only accepting traffic inside
the VPC. Of course, we could be much more precise (less permissive) without much more difficulty:

Clearly, both the Database and the Broker need ingress allowed from the Engine. The Dashboard (which
also includes the API) needs to be able to talk to the Database and possibly the Engine. 
The Engine possibly needs to be able to talk to the API.  To do that, we just need to 
set up specific security groups for each of the resources, and then create the relevant in-
or egress rules.  I've done that for the Broker for instance, but am still using the default
SG outlined above for everything else.  Want to contribute to [szvsw/hatchet-sst](https://github.com/szvsw/hatchet-sst)? 
That would be a great and easy first PR!

### Worker nodes