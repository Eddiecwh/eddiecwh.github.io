---
title: "Learning Docker"
date: 2026-09-08
categories: [Misc]
tags: [docker]
---

Back in my ETL days, I remember the cumbersome process of setting up a local vagrant box, installing Perl depdencies on our server that we had to SSH into. The onboarding process was long, and our setup documentation was like a pokemon, always evolving. Except it wasn't always pretty, and it was always the case that testing was never 1-1 or closely replicable across the team's setups. 

"Yeah man idk, I mean it works on my machine", was the name of my album as I watch my coworkers try to run our loadbulk script with all DateTime.pm dependencies missing. Wasn't any better when we moved over to a ec2-user instance. 

It's been a while since I've worked on that side of the house, but I still remember the pain.

<img src="../assets/img/figures/burning-house-meme.jpg" alt="query-1.png" style="width: 50%; margin: 0 auto">

I am going to first dockerize one of my SpringBoot projects, a URL shortner, and evaluate some of the differences going from my local setup -> a dockerized application -> hosted on Coder as a prequisite before I dive a little deeper on Coder - stay tuned for that post!

## Docker deep dive ##

A bit of context for this project:

- Spring Boot 4.0 / Java 21 Maven Project
- PostgreSQL / Redis for caching

When locally hosted, Postgres lives on `localhost:5432`, redis on `localhost:6379` and my application on `localhost:8080`. The service processes are running directly on my OS, and share the same network namespace.

But in Docker, each container is in it's own isolated network stack. A container 

> A container packages up a single service — your app, or Postgres, or Redis — along with everything it needs to run (the OS libraries, the runtime, the config). It's an isolated process that thinks it has its own filesystem, its own network, its own everything, even though it's sharing the host machine's kernel underneath.

### Postgres container?? ###

Interesting read here how docker containers actually work and what they do. I used the example of the Postgres container to understand this. 

Creating a Postgres container, doesn't in any way or form touch anything on my local machine. It runs its OWN Postgres server with it's own data directory entirely inside the container's filesystem. So it's a fully independent database instance. It's just running on my machine via Docker instead of being installed directly. 

So with Docker I'm able to spin up a postgres container/redis container/whatever other depdendency container from within Docker and future developers who download my Docker image are able to access it without having to go through any setup whatsoever. Full DB capabilities, full Redis access and full application context without setting up ANYTHING besides the docker related items.

<img src="../assets/img/memes/living_under_a_rock.png" alt="query-1.png" style="width: 50%; margin: 0 auto">

That's actually kind of insane, I feel like I've been living under a damn rock. Me writing about this kinda feels like I'm Prometheus stealing fire from the Gods of Olympus and bringing it back to the people. Except everyone already knew about this and it's more like me preaching the gospel of coloured television in the age of flying cars.

Anyway... better late than never

### dockerfile and docker-compose.yml ###

#### dockerfile, the building of our docker image ####

1. The JVM engine executes the project's bytecode
2. Mvn compiles and packages our code which produces a jar file with our app and its dependencies backed in
3. Running the project in IntelliJ handles executing the bytecode and compiling and packaging our code with Maven, then running the jar file.

w/ `Dockerfile`, it is just a series of isntructions, each one building on the last

- `FROM` - What base image to start from
- `COPY` - brings files from your machine into the container
- `RUN` - executes a command (like building your jar)
- `CMD` - defines what to run when the container starts

So for my project something like:

```
FROM    eclipse-temurin:21
COPY    source code into the container
RUN     ./mvnw clean package
CMD     java -jar target/the-jar-file.jar
```

```
FROM eclipse-temurin:21
WORKDIR /app
COPY . .
RUN ./mvnw clean package
CMD ["java", "-jar", "target/url-shortner-0.0.1-SNAPSHOT.jar"]
```

#### docker-compose.yml, the blueprint ###

The docker-compose.yml file serves as the blueprint telling Docker what containers we have a depdency on, and how we want those containers to be defined/created


## Putting it Together ##

### `application.yml` change ####

```
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/url-shortner
```

```
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/url-shortner
    host: ${REDIS_HOST:localhost}
```

Within application.yml, I am changing my data source to dynamically point to the `environment` variable `DB_HOST` if it exists, if not fallback to `localhost`.

When running in Docker, we pass `DB_HOST=db` and it connects to the postgres container

This way the build doesnt break if we run it locally or in docker.

### Dockerfile - Two Stage Build ###

```
# ---- Stage 1: Build ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

1. From this Java 21 JDK image, we'll name this stage "build"
2. create and cd into /app
3. copy our entire project into the container
4. Run the mvn build command (skipping tests to quicken the image build)

# ---- Stage 2: Run ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
CMD ["java", "-jar", "app.jar"]

1. start a new clean image with just the JRE
2. go back into the build stage copy the jar
3. run the app when the contain starts
```

So reasoning with Claude, this is called a multi-stage build.

1. Stage 1 uses the full JDK (which is pretty big) to compile the code and produce the jar file

2. Stage 2 starts fresh from just the JRE (a lot smaller, only what's needed to run the JAR not compile it). It copies the finished jar from stage 1 and that's the final image.

The result is a production image that is ~300MB instead of ~700MB+

### `docker-compose.yml` ###

```
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: url-shortner
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

Breaking it down
- Pull the official Postgres 17 image
- Create a user, with values our env-variables stored in `${DB_USERNAME}` and `${DB_PASSWORD}`
- Create a database called `url-shortner`
- Again dynaymically referencing the ports `5432` on our local setup or `5432` inside the container. Doesn't really matter cause they're the same but the same conditions apply
- declaring this `volumes` fields makes the data persist when we stop the container

```
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

Same idea for the Official Redis 7 image, and again `volumes` for persistent data

```
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
    depends_on:
      - db
      - redis
```

`DB_HOST: db` is the service name of the Postgres container, so Docker resolves to its IP on the shared network.

`depends_on` tells Docker to start db (postgres) and the redis container BEFORE the app starts

Lastly:

```
volumes:
  postgres_data:
  redis_data:
```

We declare the named volumes at the bottom for persistence

## Building my Docker image for the first time ##


Welp, I ran into a few errors - don't think I've ever done anything succesfully on the first try anyway so wasn't gonna start today

### Permissions issue, maven script not executable ###

```
=> [internal] load build context                                                               0.0s
 => => transferring context: 48.46kB                                                            0.0s
 => [stage-1 2/3] WORKDIR /app                                                                  0.3s
 => [build 2/4] WORKDIR /app                                                                    0.0s
 => [build 3/4] COPY . .                                                                        0.0s
 => ERROR [build 4/4] RUN ./mvnw clean package -DskipTests                                      0.1s
------
[+] up 27/284] RUN ./mvnw clean package -DskipTests:
 ✔ Image postgres:17      Pulled                                                                 5.4s
 ✔ Image redis:7          Pulled                                                                 5.4s
 ⠙ Image url-shortner-app Building                                                               6.5s
dockerfile:5

--------------------

   3 |     WORKDIR /app

   4 |     COPY . .

   5 | >>> RUN ./mvnw clean package -DskipTests

   6 |     

   7 |     # ---- Stage 2: Run ----

--------------------

failed to solve: process "/bin/sh -c ./mvnw clean package -DskipTests" did not complete successfully: exit code: 126
```

Claude's saying that this one is a permission issue. The Maven script isn't marked as an executable inside the container, so we'll need to adjsut those permission as part of the dockerfile

```

# ---- Stage 1: Build ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests
```

### Timing issue, app is up before postgres container ###

So looking back at my .env files I used `:` instead of `=` to set my variables, so as a result of that postgres failed to start and then the timing issue occured because we explicity said that the app depends on postgres and redis, and postgres is failing to start

`Caused by: java.net.UnknownHostException: db`

Interesting discovery, with depends on: docker is only waiting for the postgres container to be spun up. It doesn't actually care if Postgres is ready to accept connections (how rude)

So two problems:
1. Our app booted up faster than postgres did (the depends on didn't matter, cause the postgres container was ready to go)
2. Postgres wasnt gonna boot up anyway cause of the syntax error in our .env file lol...

Claude suggests that we add this, and the equivalent for redis

```
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME}"]
      interval: 5s
      timeout: 5s
      retries: 5
```

It basically is performing a health check, looking for a response from the command line with a success message from postgres with a set internal, timeout and retry mechanism

In addition to that also modifying our depends on criteria:

```
depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

Which will only pass once the healthcheck condition is true

Also, make sure that we tear down the volumes because Postgres may have written corrupt data on that first run, and the volume wont reinitialize if there's already data in it

> docker compose down -v

### Health check on the incorrect criteria ###
```
test: ["CMD-SHELL", "pg_isready -U eddie]

```

Should be:

```
test: ["CMD-SHELL", "pg_isready -U eddie -d url-shortner"]
```

This is the correct health check to look for, previously we didnt pass a database name; only supplied a username so it was going on an endlesss loop looking for a database with no name lol

the `-d` flag tells the healthcheck with database to check against

### Not error related just a cool find ###

Running `Docker compose up -build` runs faster everytime you run it, because it caches the prevuous steps

<img src="../assets/img/figures/first_dockerized_project.png" alt="query-1.png" style="width: 100%; margin: 0 auto">


And that's it, we have our first dockerized application!