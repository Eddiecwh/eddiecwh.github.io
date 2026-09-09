---
title: "Getting Acquainted w/ Coder"
date: 2026-09-09
categories: [Misc]
tags: [coder, cde]
---

## What is Coder? ##

Coder was one of the sponsors of the Commit Your Code Conference here in Dallas this past week and I got a good chance to speak to some of the folks there about what Coder serves to do.

Coder? I barely even know'er

<img src="../assets/img/memes/spongebob-grin.gif" alt="query-1.png" style="width: 50%; margin: 0 auto">

Sorry.

From what I gathered, it is a platform for creating and managing cloud development environments. So instead of every developer setting up their own local machines (going back to my spiel about ec2-user instances, manual dependency installations during my ETL days) Coder, gives you the ability to define all of that in a template and create identical workspaces. 

So it's like the logical next step for not just your application, but for your entire dev environment.

I'm gonna be following the [Quick Start Guide](https://coder.com/docs/get-started) to get up and running

<hr>

## Installing Coder ##

Coder requires a docker-compatible runtime running on the host. Since I already have Docker Desktop installed I skipped that setup (this comes back to bite me in the butt later on)

When installing coder via the curl script that's provided in the setup documentation I ran into an issue with the Postgres binary installation

```
Using built-in PostgreSQL (/Users/<user>/Library/Application Support/coderv2/postgres)
2026-09-09 18:06:11.877 [warn]  failed to start embedded postgres  attempt=1  max_attempts=1  port=63322  error="unable to init database using '/Users/<user>/Library/Application Support/coderv2/postgres/bin/bin/initdb -A password -U <user> -D /Users/<user>/Library/Application Support/coderv2/postgres/data --pwfile=/Users/<user>/Library/Application Support/coderv2/postgres/runtime/pwfile --encoding=UTF8': fork/exec /Users/<user>/Library/Application Support/coderv2/postgres/bin/bin/initdb: bad CPU type in executable\n"
```

Claude recommended I create my own Postgres container and have my server point to it, which fixed the issue

```
coder server --postgres-url "postgresql://<R2D2>:<password>@localhost:5433/coder?sslmode=disable"
```

Server started, great!

But this issue is actually due to my own negligence. A friend very kindly helped me figure out that it is because I don't have `Rosetta 2` installed. I recently picked up a new Macbook Pro with the M5 pro chip, and Rosetta 2 is apple's translation layer that let's x86 applications run on the Apple Silicon chips. Which perfectly explains the `bad CPU type in executable` error that I was getting. 

I also very clearly remember saying no to installing it when prompted to while setting up Docker. So as per usual I am suffering from self induced punishment (yay)

<div style="text-align: center">
  <img src="../assets/img/memes/fine-happy-sad.gif" width="100%" alt="title">
</div>

<hr>

## Getting Started ##

The introduction section of the getting-started guide has a good breakdown of terminology used through the tutorial to better help understand what things mean in an easy-to-understand analogy

<div style="text-align: center">
  <img src="../assets/img/figures/coder-analogy.png" width="100%" alt="title">
</div>

As both user and a hobby-ist, food-loving chef, I appreciate that. 

<hr> 

### Picking a template ###

So based on the terminology breakdown, a template is:

> A Terraform blueprint that defines your dev environment (OS, tools, resources)

or more simply put: a recipe for a meal

I'm gonna go ahead and use a Docker template

I get back 2 files from Coder:

- main.tf and a README.md file

I haven't worked with Terraform before, but the breakdown from the documentation explains that the template generated a Terraform configuration with any modules that were selected (in my case pre-selected for a Docker setup) and created a Terraform configuration. This will allow me to have a reuseable template that other members in my server can create workspaces from.

Before moving on, I just did a lil research about Terraform to understand what's happening here a little better. 

Terraform is an infrastructure-as-code tool, instead of clicking through a UI to create a server/db/network that is defined in config files and Terraform builds it for you. Sounds a little bit like a dockerfile? Claude explains it as a complementary higher step

From Claude:

> Terraform operates above that. It provisions the infrastructure that containers (and everything else) run on. "Create an AWS EC2 instance, set up a VPC, spin up an RDS database, deploy this Docker container to it, configure the networking between them." It's the layer that decides what machines and services exist in the first place.

> So in your Coder setup, Terraform is what created the Docker container that is your workspace. If you were deploying Coder to the cloud instead of running it locally, Terraform could also be the thing that provisions the cloud server Coder runs on.

### Setting up My Workspace ###

My goal with experimenting with Coder is to set up a workspace that has everything that I'd need to develop Springboot projects:

- Java 21
- Maven
- Docker
- Git

<div style="text-align: center">
  <img src="../assets/img/figures/coder-workspace-1.png" width="100%" alt="title">
</div>

Ran into a small issue setting up my workspace, my docker socket isn't where Coder expects it to be:

```
# Docker is looking for:
ls -la /var/run/docker.sock

# This is where my socket is
/Users/<user>/.docker/run/docker.sock

# Creating a symlink to point it there
sudo ln -s ~/.docker/run/docker.sock /var/run/docker.sock
```

<div style="text-align: center">
  <img src="../assets/img/figures/coder-workspace-2.png" width="100%" alt="title">
</div>

Huzzah!

<hr>

### Connecting my IDE ###

I'm installing JetBrains toolbox to pair my local code editor with my Coder cde

Not anything important - just funny how the UI says the key was created 57 years ago. Kind of like those jobs apps that ask for 10 years of an experience with x technology, when that technology came out a year ago hahaha

<div style="text-align: center">
  <img src="../assets/img/figures/old-expiry-date.png" width="100%" alt="title">
</div>

I'm attempting to get the IntelliJ gateway working but am running into an issue where 
JetBrains required 8GB of RAM and only 7.75GBs is available on the host. 

<div style="text-align: center">
  <img src="../assets/img/figures/insufficient-ram.png" width="50%" style="margin: 0 auto" alt="title">
</div>

I was able to get around this by reallocating my RAM allocation for Docker from 8GB to 10GB. 

Funny how difficult it is to split my Mac's 24 GBs of RAM across the OS, Docker, IntelliJ, the Coder server and the workspace. On a remote server, all of that compute power could live there and my laptop just runs the thin client.

Makes sense why CDEs exist, hardware limitations and all. Especially when I needa do more than just "run the app"

### Setting up My Project in my workspace ###

I'm going to clone a project that I previously worked on, a URL-shortner that I built to learn backend system design.

I'm kinda working in reverse here, so I'm gonna tear down this current work space and build a template that includes all of those dependencies there.

### Trying my hand at creating a Template ###

<div style="text-align: center">
  <img src="../assets/img/figures/coder-1.png" width="100%" alt="title">
</div>

<div style="text-align: center">
  <img src="../assets/img/figures/coder-2.png" width="100%" alt="title">
</div>

<hr>

Looking at the `main.tf` that was generated by Coder, the base image we are using for our workspace comes from:

```
image = "codercom/enterprise-base:ubuntu"
```

Claude recommends 2 different ways of adding the dependencies to my template

Option 1:

- We can add our java and maven installs to the `startup_script` segment, so that every time the workspace starts, they get installed.

```
startup_script = <<-EOT
    set -e

    # Prepare user home with default files on first start.
    if [ ! -f ~/.init_done ]; then
      cp -rT /etc/skel ~
      touch ~/.init_done
    fi

    # Add any commands that should be executed at workspace startup (e.g install requirements, start a program, etc) here

  EOT
```

Option 2:
- Create my own docker image based on the Coder base image, but with Java and Maven included so I have faster workspace startups.

```
FROM codercom/enterprise-base:ubuntu

RUN sudo apt update && sudo apt install -y \
    openjdk-21-jdk \
    maven \
    && sudo rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"
```

So grabbing the base image that we were originally using, but including jdk-21 and maven at the same time.

(I could have also just installed the dependencies on my workspace, but where's the fun in that)

So I've created my dockerfile `Dockerfile.java-springboot` and built it with docker naming the image `coder-java-springboot`

```
docker build -t coder-java-springboot -f Dockerfile.java-springboot .
[+] Building 31.1s (6/6) FINISHED 
```

Then I'm gonna just change the image reference from the `main.tf` file from the old ubuntu image `codercom/enterprise-base:ubuntu` to our newly built image `coder-java-springboot`

Okay moment of truth...

<div style="text-align: center">
  <img src="../assets/img/memes/drum-roll.gif" width="100%" alt="title">
</div>

Build Success, yay :) let's try and create a workspace

### Creating my Workspace (again) ###

Okay, so I'm downloading and installing Intellij backend in the new workspace container again. But it's actually a pretty cool thing to note that environments like this are fast to spin up but also to tear down. Deleting my previous workspace and all the associated things with it happened quickly at a click of a button. 

Next on the to do list is to see if JDK was setup correctly, we'll check that out tomorrow.R