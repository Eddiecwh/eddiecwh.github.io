---
title: "AI Assisted Scheduler - Project Discussion and Planning"
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

<hr>

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

<hr>

### Non Functional Requirements ###
Top 3 - 5 Requirements

- The system should render calendar events on the UI within 1-2s
- The system should retrieve specific event details via the AI agent within 5s
- The system should process event creates/updates/deletes via the UI within 500ms
- The system should process event creates/updates/deletes via the AI agent within 5-10s
- The system should be highly consistent, prioritizing consistency over availability.
- The system is hard dependent on Google Calendar API. If the service is unavailable, calendar operations cannot proceed. The system should handle transient failures with retries and exponential backoff, and detect outages via circuit breakers.
- The AI agent is a soft dependency — if the agent is unavailable, users can still manage calendar events through the system UI.
- The system should store OAuth refresh tokens per user with application-level encryption and request Access tokens on every subsequent login. Only Google Calendar scopes is neccessary

A little different from the usual system design format as I'm not expecting huge scale from this personal project. But there's still other factors to consider

- `Performance`:
    - How fast should things feel?
        - Granted that we are working with an AI agent, I'd expect read actions like checking existing events to return under 5s
        - Just vieweing events on the UI however, should not take this long. I would want my schedule rendered on the UI within a second or two
        - For more complex workflows like edit/creating as a user I'd expect more leniency in time, hoping for something closer to 5-10s. Scaling all the way out to more complex actions like reactive GETs and intelligent followups, prompting further action items, even more so (granted this would likely be a 2 part question/response interaction cycle)
- `Reliability`:
    - With Google Calendar API being a major dependency for our system, I don't think that we can meaningful proceed with calendar scheduling if that service is down. We can handle network partitions with retries and exponential backoff, but we'd have to implement circuit breakers to detect service outages.
    - I am also favoring consistency over availability (due to the problem with stale data for event scheduling that I mntioned earlier). As we build out other features, like a task list that is not tied to Google calendar events, we can employ a hybrid solution that priotizies availability over consistency without a hard dependency on Google API. But for now with our current functional requirements, Google API being down is a hard stop. 
    - On the other hand, our AI agent being down is a nice-to-have feature in the sense that we can still work through as we have the means of manually handling calendar scheduling.
- `Security`:
    - Since we will be utilizing Google calendar, we'll naturally be employing `Google OAuth` for sign-ins to our system as well. 
    - As we design the DB and our entities, we can refine this but I think it would make sense to store the OAuth token alongside our User data (In a `User entity`)
    - Probably getting ahead of myself here but after some research, Google OAuth providers 2 tokens a Refresh Token and an Access Token
        - We'd store the `refresh token` in our `User` entity, tied to our user and request a new `access token` everytime that user logs into the system (after the initial login)
        - Regarding refresh tokens, we should use `application-level` `encryption` on the token before storing it in the User entity. I posted the discussion with Claude over the difference between `Database-level` and Application-level encryption below if you are interested in understanding why application-level encryption makes the most use sense for this application
        - Since the only actions we are taking revolve around Google Calendar, we'd only request that scope. No need to obtain more permissions than we need.


```
Database-level encryption (encryption at rest) — the database encrypts the files on disk. If someone steals your hard drive or database files, they can't read them. But if someone gets access to your running database with valid credentials, they see plaintext. The database handles it transparently, your app does nothing special.

Application-level encryption — your Spring Boot app encrypts the token before sending it to the database. The database stores ciphertext and has no idea what it says. Even if someone gets direct database access with valid credentials, they still see encrypted garbage. Only your application, which holds the encryption key, can decrypt it.

Given that the thing you're protecting is a refresh token that grants access to someone's Google account — which of those two feels more appropriate, and why?
```
    
<hr>

### Core Entities ###

[Click here to skip the discussion and view the Core Entities Design](#my-designed-entities)

#### Core Entities Discussion and Planning

So our system works around users (`User`) who connect to the system via Google OAuth. Google offers more than just one calendar: There's family calendars, shared calendars, personal calendars etc... For my preliminary functional requirements I'm only going to be using personal calendars, but I want to design my entities with that forward compatability in mind. So I want to add a intemediary entity `Calendar`, so we can add multiple calendars to one user if we need to. Lastly, a Calendar can have numerous `Events`

<img src="../assets/img/figures/projects/ai-assistant-scheduler/entity1.png" alt="query-1.png" style="width: 75%; margin: 0 auto">

- Our data naturally relates to one another, there are very defined parent-child relationships.
- Our frontend will call on a specific subset of data that will not frequently evolve

I think a relational RDBMS like postgres would make perfect sense and fit very well for our application needs.

#### Breaking Down Events a little further ####

I'm looking through Google Calendar's events and there 3 types of events that you can schedule:
- Events
- Appointments
- Tasks

I'm only going to be building out `Feature` support, but say I wanted to make it forward compatible with other event types later on - what would be a good way for me to store this?

I was thinking initially of an Events entity with fields like:

| Events |
| --- |
| event_id (PK) |
| calendar_id (FK) |
| event_type |
| event_details |

where `event_type` would define the type of event (Event, Appt, Task) and `event_details` would specify the parameters of the individual event_type in a `json_blob` format

But I want to think through the tradeoffs of doing this.
- What if I do perform a READ task that would be conceptually easy with a `JOIN` function to say for example:
    - Find all events w/ a specific location
    - Find all tasks with a due date before Friday?
    
Id have to dig through the JSON and do pattern matching to find matching fields which could be cumbersome. I'd also lose a lot of benefits like `type safety`, `validation` and the ability to put constraints or index those fields. I could probably still add login in the service layer to add some restrictions - but probably not ideal joining concerns there.

What are some other options to think of here?

- Potentially having just 1 `Entity` table with ALL fields, and just leaving unapplicable columns as `NULL` for the respective event_type

- Having 3 individual tables for `Appointment`, `Task`, `Event` w/ their own respective fields that share a many to one relationship with the main `Events` table, which will probably have to have a different name as it's pretty similar to the sub-table `Event`

(After further research, I realized that we don't have to support AppointmentSchedule because that is for other people booking time with you via Calendly or some other booking app)

I think the seperate table approach makes the most sense, because that way we can proceed with our original scope, but still have the ability to create more entities for the event_type that can map to `Event`. 

In that case, I think it would make sense to do 2 things
1. Change the main `Events` table into a more generic name that the 2 different event types can represent a more intuitive parent -> child relationship
2. Group shared fields between the 2 event types and store that information in the parent table
- title
- start_dt_time
- end_dt_time
- created_dt
- description
- owner (calendar_id (FK))

Another modification, I might want to support a seperate Task view later on - so I'm going to add a `event_type` row on the `CalendarItem` entity so we can have a clear distinction defined in the parent table

#### Big Pivot, Abandoning the Calendar Entity ####

Okay huge modification here to my Core entities. After doing some reflection, I'm realizing that my `Calendar` entity doesn't serve a real purpose. Google Calendar is the source of truth for our system, so having our own local Calendar entity would be misleading because we'd have two seperate sources, and our local Calendar entity would only really be syncing data from Google Calendar's API.

In the case that Google Calendar API is down, our system reflects an inaccurate state of Google Calendar displays which is not what we want. We discussed `Consistency` over `Availabilty` and keeping them synced as closely as possible would require asynchronous sync jobs to pull Google Calendar data to ensure our Calendar entity maintains the correct state. 
In my opinion, that's not worth the overhead.

On the other hand though, the Google Calendar `Task` event differs slightly from what I was expecting it to do. I envision the tasks being able to support status' like:

- Created
- In Progress
- Completed

It supports other fields like deadlines and descriptions, but I think there's a lot more that we could add to this to make it a full fletched feature. Like say for example having the ability to add sub-tasks

I'm not removing my earlier thought process and entity breakdown for the old calendar entity design because I think it's a good example of showcasing how designs can change and scopes can evolve as I go deeper into the implementation details and planning phase. 

I want to give the user the option to block off calendar time with the task, so while it's not directly related to Google Calendar's tasks, it'll be it's own entity that we can populate on Google Calendar (if the user chooses to) that might say store category, description, status, deadline just as an event body.

Enjoy the read! (or not)

#### My Designed Entities

**Core Entities v1**

<img src="../assets/img/figures/projects/ai-assistant-scheduler/entity2.png" alt="query-1.png" style="width: 100%; margin: 0 auto">

**Core Entities v2**
[My reasoning](#big-pivot-abandoning-the-calendar-entity) for changing up the entity design (if you missed it)

<img src="../assets/img/figures/projects/ai-assistant-scheduler/entity3.png" alt="query-1.png" style="width: 100%; margin: 0 auto">

<hr>

### API Design ###

[Click here to skip the discussion and view the API Design](#my-designed-endpoints)

#### API Design Discussion and Planning ####

For my CRUD operations with fetching UI details/task creation/ and interacting with the Google calendar API I'm going to be using REST APIs, here are a few reasons why:

- We are using a standard CRUD interface with well defined resource. 
- We don't have issues with under/over fetching data since our data requirements are clearly defined
- The Google Calendar API, which we have a depdendency on, is also REST so making it consistent is a bonus

Our Calendar endpoints will really just be a proxy for calling Google Calendar's APIs, since Google we adjusted to Google Calendar being the source of truth. But having our Controller and our own Service layer makes sense because we might have certain business logic in place. Especially since we will want to have custom specifications on how to create tasks as events.

For the AI agent I'm thinking we might have to take a different approach. With my previous [RAG project](https://eddiecwh.github.io/categories/rag-ai-chatbot/) I was looking for a simple chat-based request response interaction with a local LLM that utilized a sample set of confluence documentation and JSON formatted slack styled messages as context. A REST API was the right approach there, because it followed a basic flow

```
user sends question → retrieve context → LLM responds → done
```

With an agentic loop it would be multi-step

```
User sends message 
-> Agent reasons 
-> Picks a tool 
-> Calls Google API 
-> Reasons again 
-> Picks another tool 
-> Formulates Response
```

So with a REST request/response cycle, we would lose the ability to push intermediate updates to the user as they happen. We'd essentially just have the user wait for `x` amount of time as the LLM figures out next steps and what tools to solve the problem

So since we are looking for `realtime updates` two twings we could look into are `SSEs` (Server Sent Events) or `WebSockets`

So based on what I understand from `Websockets`, they are built on the `HTTP` protocol on top of TCP.
- Instead of opening a new connection for every read/request response cycle, the connection stays alive until a certain idle time haas passed or the client closes the connection.

The main difference between `WebSockets` & `SSE` is that
- Websockets are `bidrectional`
    - Both sides can send messages over the same connection
- Server Sent Events are `unidirectional`
    - Only the server pushes to the client, but the client can't send back over the same connection (makes sense it's called `Server Sent` events, and not `_Server AND Client_` sent events lol)

So given that, for the AI agent interaction; there's going to be a constant back and forth between client and agent I initially considered WebSockets, but I got some push back from Claude to challenge my thinking

> _Good reasoning, and the logic tracks. But let me push on one thing before you commit to WebSockets._
> 
> _Think about the actual interaction pattern:_
>
> - _User speaks → single message sent to server_
> - _Server processes → pushes intermediate updates to client_
> - _Server responds → pushes final response to client_
> - _User speaks again → repeat_

The pattern is defintely bidrectional, but not necessarily simultaneous. It's more like alternating turns, where the client sends once and the server streams back

So althought SSE is unidrectional, we could pair it with regular `HTTP Post` requests

```
User speaks → HTTP POST to agent endpoint
Server processes → SSE stream pushes intermediate updates back
Server done → SSE stream closes
User speaks again → new HTTP POST, new SSE stream
```

Very interesting discussion with Claude over why althought websockets sounds like the answer initially, SSE might make more sense for my use case. Here are a few reasons we discusused:

- **Complexity**
    - Websockets require managing a `persistent connection`, `handling reconnects` and there is `more state` on the server side.
        - SSE is easier to implement, and my backend will be built with Spring Boot which has `native SSE` support
- **Use Case**
    - Websockets are useful when we really need `simultaneous bidrectional communication`, like in a multiplayer game where players perform actions in random orders. Since our Agentic Loop is more `turn-based`, Web Sockets wouldn't be bad per say, just more of a headache to implement for something that doesn't require that kind of utility
- **HTTP Infrastructure**
    - `SSE works over standard HTTP`, so if we were to implement things like load balancers, proxies, security configs, etc.. These would play together naturally. WebSockets would require additional support

A small pivot to handling audio input to the AI agent - I'm reasoning w/ Claude to understand my options for handling audio messages and processing it as input for our agent

> *1. Client-side transcription — the browser converts speech to text before sending, and your endpoint just receives text as planned*
> 
> *2. Server-side transcription — the client sends raw audio to your backend, your backend transcribes it, then passes the text to the agent*

**Client-side transcription thoughts and PROs/Cons**

My initial thoughts are that Client-side transcription makes more sense, so we keep can the logic specific to sending/and recieving agent requests isolated to the service layer. I'm not a frontend guy, but apparently browsers haave native Web Speech API that handles transcription without any third party service. So our React frontend would be able to convert speech to text, w/o the need of any backend logic. Cool!

But what would we be giving up by not handling that on the server-side?
Here are some of the tradeoffs that I discussed w/ Claude

- **More accurate transcription**
    - Web Speech API is good, but services like Google Cloud Speech-to-Text/OpenAI Whisper are a lot more accurate
- **Browser Support**
    - Chrome has great support, but firefox has had inconsistent support
- **Language Support**
    - 3rd party services handle more languages (not so relevant for this project), but also handles accents better (hmm...)
- **Control**
    - If we deem the service provider to be lacking, we could just swap services without touching the frontend

And for a personal project: There might be costs that are induced with using third party applications. 

I think my decision for now is to keep text-transcription on the client side. The factors that matter the most to be currently are: `convenience`, `ease of setup` and `cost`

If it's something that just isn't working out the way I want it to, I'll make a decision to change it later on.

#### My Designed Endpoints

Since the authenticated user is implicit from the OAuth token, I'm not going to have to expose userId in the path at all

**CRUD Operations for Calendar Event view/modification**

```
# fetch all events (leaving multiple google calendar types out of scope for now)
GET /Calendars/Events

# fetch event by Id
GET /Calendars/Events/{eventId}

# Create an event
POST /Calendars/Events

# Update an event
PUT /Calendars/Events/{eventId}

# Delete an event
DELETE /Calendars/Events/{eventId}
```

**Task events**

```
# fetch all tasks
GET /Tasks/

# fetch task by Id
GET /Tasks/{taskId}

# Create an event
POST /Tasks

requestBody {
    "title" : "Get ingredients from the store",
    "description" : "tomatoes, strawberries, ham",
    "category" : "Shopping",
    "status" : "NOT_STARTED",
    "deadline" : "2026-09-23 13:00",
    "priority" : "HIGH",
}

# Update a task
PUT /Tasks/{taskId}

requestBody {
    "title" : "Get ingredients from the store",
    "description" : "pineapple, ham",
}

# Delete a task
DELETE /Tasks/{taskId}

# Block Calendar Time for Task
POST /Tasks/{taskId}/block-time

requestBody: { 
    "start_dt": "...", 
    "end_dt": "..." 
}
```

**Agent Operations**

```
POST /agent/message
Body: { 
    "message" : "Schedule a coffee chat with John at 2:30 PM on Thursday"
}

Response: stream of SSE events
data: {"type": "thinking", "message": "Checking your calendar..."}
data: {"type": "thinking", "message": "Found a conflict at 2:30 PM..."}
data: {"type": "thinking", "message": "You have a conflict, want me to suggest alternatives?"}
data: {"type": "done"}
```

<hr>

### High Level Design ###

<img src="../assets/img/figures/projects/ai-assistant-scheduler/hld1.png" alt="query-1.png" style="width: 100%; margin: 0 auto">

Just to clarify, the diagram consists of two CalendarService but they are the same class. Just pointing out the flow where we call the GoogleCalendar config from that service, and then later parse the response

<img src="../assets/img/figures/projects/ai-assistant-scheduler/hld2.png" alt="query-1.png" style="width: 100%; margin: 0 auto">

<img src="../assets/img/figures/projects/ai-assistant-scheduler/hld3.png" alt="query-1.png" style="width: 100%; margin: 0 auto">

The agentic HLD is actually going to be interesting. I've created a small agent before with Spring AI, but it was pretty basic. Let's see how I map out this workflow design

When the user sends a message after it hits the `POST /agent/message` endpoint, the first thing is that the agent needs to decide what tools it has to use to solve the problem

Based on our functional requirements our agent should be able to do things like seeing/editing what's on the calendar and task list. These tools map directly to the services that we already designed

- Check calendar → `CalendarService`
- Edit calendar → `CalendarService`
- Check tasks → `TaskService`
- Edit tasks → `TaskService`

So our agent is kinda like a loadbalancer (lol idk how I got that analogy), that decides which of our existing services to call based on the user's request

Thinking about our SSE component for sending intermediary updates, our `AgentService` should be pushing real-time updates back to the client. With SpringAI, we have access to `ChatClient` which handles the communication with the `LLM Provider`. 

For understanding's sake, it's like the equivalent of our `GoogleCalendarClient` which abstracts the HTTP communication with the external service. But in this case it would be the LLM API. We'd also have to define `tools` that in SpringAI which route to our `Task/Calendar` services that `ChatClient` passes to the model so our agent knows what actions it can take.

So our flow starts to look like this:

<img src="../assets/img/figures/projects/ai-assistant-scheduler/hld4.png" alt="query-1.png" style="width: 100%; margin: 0 auto">


To word together what's happenning here:

1. a request is made to the `/agent/message` endpoint
2. AgentService injects `ChatClient` which makes a call to LLM
3. LLM reasons what tools it needs for the request (based on tools that we provided the LLM via CalendarService and TaskService explicity defined as tools)
4. As this is happenning, intermediate updates are pushed to the client via SSE
5. The LLM determines whether or not it needs further tools calls to fufill the request
5a. If no, pass completion information to the client
5.b If yes, pass result back to the LLM (repeat step 3)

I hope I was able to illustrate this clearly in the diagram, still getting the hang of clearly illustrating my workflows on paper

<hr>

### Deep-dives ###

```
The AI Agent implementation — specifically how you define tools in Spring AI, how the agentic loop actually works in code, and how you wire SSE streaming to it

Google OAuth flow — the actual token exchange, how you store and decrypt the refresh token, and how you attach the access token to outbound Google API calls
```

