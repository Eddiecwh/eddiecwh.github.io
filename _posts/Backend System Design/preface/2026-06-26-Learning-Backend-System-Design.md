---
title: "Backend System Design Series: Preface"
date: 2026-06-26
categories: [Backend System Design]
tags: [System Design, Backend, Into]
---

I saw a super interesting post on Reddit talking about focusing too much on solving "unique problems with code" and skip on a lot of the engineering fundementals that real world backend systems are truly built on. Unfortunately as I sit in the latter bucket, I'm realizing that perhaps I don't have the depth or even the skillset to tackle real system design, so I want to change that.

Quote from the Reddit Post:

```
Pick a few standard projects to focus on learning how to translate a problem into a technical problem statement. Defining a technical solution that is reason-bound and addresses different aspects of the problem statement. And then to actually implement it with scalability, observability, resiliency, failure handling, testing, deployment, monitoring and maintainability in mind.

A lot of junior devs jump straight to “unique problems that I should solve with code” and accidentally skip the engineering fundamentals that real-world backend systems are built on.

Build boring things first but build them deeply.
```

Here are a few systems he/she suggested to learn these patterns:
<ul>
  <li>
    Payment orchestration service
  </li>
  <li>
    Notification system
  </li>
  <li>
    URL shortener
  </li>
  <li>
    Feature flag service
  </li>
  <li>
    Job scheduler
  </li>
  <li>
    File processing pipeline
  </li>
  <li>
    Rate limiter
  </li>
  <li>
    Multi-tenant auth system
  </li>
</ul>

My goal is to build these systems with the intent that it's not just the concepts I'm implementing, but also seeing first hand why things work and why thigns don't. Being able to articulate tradeoffs and build a smart system design mindset. I hope to be able to understand concepts such as:

<ul>
  <li>
    Why queues exist
  </li>
  <li>
    where caching helps
  </li>
  <li>  
    How retries fail
  </li>
  <li>
    Why idempotency matters
  </li>
  <li>
    How and when concurrency affects the system
  </li>
  <li>
    How DB design affects scale
  </li>
  <li>
    Why monitoring saves production systems
  </li>
  <li>
    Where abstractions help vs hurt
  </li>
</ul>