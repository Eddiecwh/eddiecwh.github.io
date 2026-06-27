---
layout: page
title: "Caching Notes"
permalink: /notes/caching/
---

## What is Caching?
Instead of hitting the database ever request, we store results in a fast in-memory storage
- The first request is slow (hits the database)
- But every subsequent request is fast (hitting cache)

```
Req 1: Cache miss -> hit DB -> store result in cache -> return
Req 2: Cache hit -> return from cache (no DB call)
```

## Cache Invalidationn
- There's a problem with caching data that never expires - our data becomes old and stale, and may not be accurate

### Cache Invalidation Strategies:
- TTL (Time to Live)
  - cached data automatically expires after `X` amount of time

- Cache Eviction on Write:
  - when new data comes in, we delete or update the cache entry

## Caching with SpringBoot

`@EnableCaching`
applied to the main application class, the switch that turns on the whole caching infrastructure

`@Cacheable("name")`
Applied to service level methods
- takes a parameter which will be the name of the bucket for that particular cache
e.g:
```
@Cacheable("orders")    // cached in the "orders" bucket
@Cacheable("customers") // cached in the "customers" bucket
@Cacheable("products")  // cached in the "products" bucket
```

`@CacheEvict("name")`
Applied to service level methods
- it tells Spring, after this method runs succesfully delete the cache in the `name` bucket

## Redis and Distributed Caching
With our current in-memory cache, we query the DB then cache the results, but what happens if we have more than 1 server?
Let's say we have 3 servers:
```
Server 1: Cached the results from GET /orders
Server 2: nothing
Server 3: nothing
```
Server's 2 and 3 will query the DB and not the cache when they are called to because, cache lives in Server 1's memory
Each server has it's own isolated cache

With Redis, all servers will share one centralized cache and this is called distributing caching.

We just swap out the dependencies in pom.xml to redis and its handled for us, easy!

Redis is also used for other things like: 

`Session storage` — store user sessions server-side. Faster than a database and shared across multiple servers.

`Rate limiting` — track how many requests a user has made in a time window. Redis's atomic increment operations make this perfect:
```
user_123_requests: 47  ← increment on every request, reject if > 100
```
`Distributed locks` — prevent two servers from processing the same thing simultaneously. Critical for things like "only process this order once."
`Message queues / pub-sub` — lightweight alternative to Kafka for simple async messaging.
Leaderboards — Redis has a sorted set data structure perfect for real-time rankings.