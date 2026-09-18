---
title: "AI Assisted Scheduler - Project Discussion and Pseudo Planning"
date: 2026-09-17
categories: [Projects, AI Assisted Scheduler]
tags: [Projects, AI, Backend]
---

## Project Discussion and Inspiration ##

I've been looking for some ideas to built out, not just to learn new things but also something practical that I think that'd I'd be able to realistically use on a day-to-day basis. My million dollar idea, is an AI assisted scheduler.

The core idea is that it's a scheduler page with a built in AI assistant that is able to
- View items on your calendar
- Create new events on your calendar
- Check for conflicts before scheduling

My idea is for the application to be built around the AI helper, with Google Auth so that it can access the user's google calendar. 

I'm going to have to look into the different model capabilities and connectors to see what I can get away with. To add to this, I want the main feature of the application to be being able to interact via voice with the Agent to get everything situated. Big plans, but I am pretty new to utilizing agents in my project - so there's going to be a lot of research work and trial and error to see what I am actually going to be able to achieve. 

I think there's 3 main things I am going to have to evaluate and see what are the most important to me:
- Cost
- Ease of Itegration w/ Spring AI
- How capable the tool calling is

I want to start with a very high level overview of core features I want to include. This would primarily be the Voice Agent that can handle a two way conversation with the user to create/edit/provide information for calendar events. A secondary nice to have feature would be a seperate entitiy for tasks, that can be displayed in a dashboard (seperate from Calendar events). Potentially with a the ability to add as an event as well.

Start small, then build out. I've got a lot of ideas, but it's gonna serve me a lot better to start with a small idea, and scale out to more ideas as I design the project.

## Designing the System ##

As a bit of practice as well, I'm going to be following Hello Interview's [delivery framework](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) for system design

### Functional Requirements ###
Top 3-5 requirements

1. User should be able to add/edit/remove events from their Google calendar via the system UI
2. User should be able to interact with the AI agent to add/edit/remove events from their Google calendar via voice/text
3. The AI agent should be able to detect conflicts before scheduling events
4. The AI agent should be able to give the user information on existing events

Currently, a lot of my functional requirments are very reactive. The user has to engage the AI agent to initiate something. I think that's fine for now, don't overengineer in the beginning. But, in later revisions; I think I'd like it to be more proactive, where the AI agent suggests action plans following a question:

`Client`: Schedule a coffee chat with John Davis at 2:30 - 3:00 PM on Thursday

`AI Agent`: You have a conflict on Thursday at that time, want me to move it or suggest alternate times?"

So more reactive still, but with intelligent follow-up. But let's put that on the backburner for now.

### Non Functional Requirements ###
Top 3 - 5 Requirements

A little different from the usual system design format as I'm not expecting huge scale from this personal project. But there's still other factors to consider

- Performance:
    - How fast should things feel?
        - Granted that we are working with an AI agent, I'd expect read actions like checking existing events to return under 5s
        - Just vieweing events on the UI however, should not take this long. I would want my schedule rendered on the UI within a second or two
        - For more complex workflows like edit/creating as a user I'd expect more leniency in time, hoping for something closer to 5-10s. Scaling all the way out to more complex actions like reactive GETs and intelligent followups, prompting further action items, even more so (granted this would likely be a 2 part question/response interaction cycle)
- Reliability:
    - With Google Calendar API being a major dependency for our system, I don't think that we can meaningful proceed with calendar scheduling if that service is down. We can handle network partitions with retries and exponential backoff, but we'd have to implement circuit breakers to detect service outages.
    - I am also favoring consistency over availability (due to the problem with stale data for event scheduling that I mntioned earlier). As we build out other features, like a task list that is not tied to Google calendar events, we can employ a hybrid solution that priotizies availability over consistency without a hard dependency on Google API. But for now with our current functional requirements, Google API being down is a hard stop. 
    - On the other hand, our AI agent being down is a nice-to-have feature in the sense that we can still work through as we have the means of manually handling calendar scheduling.
- Security:
    - Since we will be utilizing Google calendar, we'll naturally be employing Google OAuth for sign-ins to our system as well. 
    - As we design the DB and our entities, we can refine this but I think it would make sense to store the OAuth token alongside our User data (In a User entity)
    - Probably getting ahead of myself here but after some research, Google OAuth providers 2 tokens a Refresh Token and an Access Token
        - We'd store the refresh token in our User entity, tied to our user and request a new access token everytime that user logs into the system (after the initial login)
        - Since the only actions we are taking revolve around Google Calendar, we'd only request that scope. No need to obtain more permissions than we need.

```
Use for oauth token encryotion details later:

Database-level encryption (encryption at rest) — the database encrypts the files on disk. If someone steals your hard drive or database files, they can't read them. But if someone gets access to your running database with valid credentials, they see plaintext. The database handles it transparently, your app does nothing special.

Application-level encryption — your Spring Boot app encrypts the token before sending it to the database. The database stores ciphertext and has no idea what it says. Even if someone gets direct database access with valid credentials, they still see encrypted garbage. Only your application, which holds the encryption key, can decrypt it.

Given that the thing you're protecting is a refresh token that grants access to someone's Google account — which of those two feels more appropriate, and why?

```
    

- The system should be highly consistent, prioritizing consistency over availability.
