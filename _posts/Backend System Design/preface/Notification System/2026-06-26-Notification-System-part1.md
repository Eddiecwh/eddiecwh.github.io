---
title: "Notification-System: (Part 1) - Design"
date: 2026-06-26
categories: [Backend System Design, Notification System]
tags: [System Design, Backend, Into]
---

Im starting each problem with defining the problem statement and writing down my thoughts before writing any code

What should a notification system do?
- Accept a request(s) and send a notification
- Routes that notification to the right channel (could be email, text, maybe a phone push notification?)
- It should be able to deal with failures and have retry
- It should be able to guarantee delivery, not have our messages dissapear into the void if not sent
- We should be able to see what is happenning, logging!

<span style="font-weight: bold; font-style:italic">So what should trigger a notification in our system?</span>

We defined that our system should accept a request and send a notification, so our request should trigger a notification.
Our request needs to pass information for our notification, so maybe a request notification could look like:

```
v1:
request-type: email/text/push
request-subject: subject header
request-specifics: date/time
request-body: the message we want to send
```

Missing a big piece here actually lol, who do we want to send that notification to?

```
v2:
request-type: email/text/push
request-subject: subject header
request-specifics: date/time
recipient: who needs to recieve this notification
request-body: the message we want to send
```

So based on the the request-type, we'd have to what user we need to send that notification to maybe a user_id, from which we could pull user specific data like email address/phone no

```
v23:
userId,
request_type: email/sms/push
subject
body
date/time
```

<span style="font-weight: bold; font-style:italic">So what should should happen after the system recieves that request?</span>

After the system recieves that request, we need to process that message to decide where and when it needs to go. Depending on how we decide to design our data layer, we might to perform data transformations to turn the request into a data format we are expecting. Then from there we submit our message into a message queue, we could have different message queues based on the request type and can be queued up in accordance to when they need to be sent out (date/time). We'll also need to think about implementation details for service providers that can handle outbound sms/emails, push notifications might be more internal

<span style="font-weight: bold; font-style:italic">Diving a little deeper into our rough plan:</span>

What should happen if our system pulls a message off the queue and the delivery fails?

I think this is where oberservability and resilience are going to be very important. It would be pretty negligent of us to not:
1. Store details/logging of recieved messages and delivery status
- If we were asked to investigate why something that didn't send out, and we have no trace of getting that message or sending it, that'll be a tough conversation to have (ask me how I know lol)
2. Attempt to retry to send out that notification, if the delivery fails (within a reasonable window of time)
- But we also have to account for what the failure reason is?
- Is it our fault? some part of our pipleline down?
- Is it a service provider fault? If twillio is down, we can implement a strategy like exponential retry, but if their service is down for an hour maybe, exponential retry's window is way below that, so we need to be able to log the reason for the error - perhaps like in the case of a 500 error, twillio is down -> let's mark the request as pending for retry or something and revisit this later

<img src="../../../assets/img/figures/system-design/notification-system/notification-lifecycle.png" alt="query-1.png" style="width: 100%">

<h4>Service Implementation Details Planning</h4>

So with the current notification system design, I've never directly worked with queues/messaging systems but I know that RabbitMQ is one of the industry's standards so I'm gonna use this oppurtunity to learn how to use it.

For our modality notifications I've worked with Twillio's API briefly for text/calls, and I'll have to do some research into email services. Claaude recommends SendGrid or AWS SES as they both have Java SDKs. 

I want to built out the backend in SpringBoot as I am unfortunately currently a one trick pony with Java being my preffered language and SpringBoot having good support for libraries such as bucket4j for caching and redis for caching (not sure if we'll need to implement caching yet). Might be useful for storing cached user data. Like if every notifcation that comes requires a usuer_id, we'd have to hit the database every single time. Might not seem much in the scale of my learning application, but for bigger purposes that could get very cumbersome. And for data that doesn't really change like user data (email, phone, etc).. we can have a significant TTL

Going down the rabbit hole cause I mentioned it... I'll have to think about implementration details of cache invalidation, say for example the usuer changes their personal information - our system has know to invalidate the cache because it's stale. So for querying a user's data, that information is stored, but when a method say updateDetails is called we'd have to trigger a database call and update the cache. 

Regarding push notifications, in the initial buildout, we have no client app to send notifications to, so it's out of scope for now.

<img src="../../../assets/img/figures/system-design/notification-system/design-plan.png" alt="query-1.png" style="width: 100%">

<h4>Designing our database</h4>

Version 1 think through:

So I'm thinking it's 1 centralized database, and not 3 databases for each service

for the userService, we'll need a users table:

```
userId
firstName
lastName
phone
email
```

for requestService
```
requestId
requestType
recipient
subject
message
dateTime
```
for our requestService

we'll process our request and maybe utilize a job_queue for each modality

job_queue_calls, job_queue_text (or 1 single job_queue table)

where processed jobs can be stored into these tables before being picked up by the queue

```
job_id
job_category
job_status
job_payload
job_status
createdDt
```

and then we can have a table for storing processed/need retry/dead jobs

```
job_id
job_category
job_status
job_payload
job_status
sendDt (null for calls that need retry)
```

Using Claude to help me refine my database schema and see what I missed/is redundant:

v2 think through:

<h4>Users</h4>
Our users table looks good, but would be important to add in timetamps for createdTime and updatedTime so we can track changes
<table>
  <tr>
    <th>v1</th>
    <th>v2</th>
  </tr>
  <tr>
    <td>userId</td>
    <td>user_id (PK)</td>
  </tr>
  <tr>
  </tr>
    <td>firstName</td>
    <td>first_name</td>
  <tr>
  </tr>
    <td>lastName</td>
    <td>last_name</td>
  <tr>
    <td>email</td>
    <td>email</td>
  </tr>
  <tr>
    <td>phone</td>
    <td>phone</td>
  </tr>
  <tr>
    <td></td>
    <td>created_dt</td>
  </tr>
  <tr>
    <td></td>
    <td>updated_dt</td>
  </tr>
</table>

<h4>Request</h4>
For the most part, looks like our design was okay -> recipient should explicity that it is a foreign key reference to the user table, joined on the user_id column. I should be explicit when stating that and establishing the relationship. Also once again, create_dt and scheduled_dt should be present, with scheduled_dt being defined which is more clear as to its purpose as opposed to dateTime.
<table>
  <tr>
    <th>v1</th>
    <th>v2</th>
  </tr>
  <tr>
    <td>requestId</td>
    <td>request_id (PK)</td>
  </tr>
  <tr>
    <td>recipient</td>
    <td>user_id (FK → users)</td>
  </tr>
  <tr>
    <td>subject</td>
    <td>subject</td>
  </tr>
  <tr>
    <td>message</td>
    <td>body</td>
  </tr>
  <tr>
    <td>dateTime</td>
    <td>scheduled_dt</td>
  </tr>
  <tr>
    <td></td>
    <td>created_dt</td>
  </tr>
</table>

<h4>jobs</h4>
This one needed the most reworking:

I had initially said that i might want to have 2 job_queue tables where we store all queued up jobs for each modality, but I think that's the wrong approach. They will both have identical columns with the exception being the job_category. So makes more sense to lump them into one. Additionally, I also said we'd throw jobs that failed/need retry into another table, but that's counter intuitive. Our `job status` column already helps us to give the right jobs the approirate state and from there we can deal with them accordingly. Over-engineering for no reason. KISS (keep it simple stupid)

Columns for retry/error handling:
I also needed to add stat specific columns for error-handling, like: retry_count, next_retry_dt, error_message, etc.. Since the jobs table is home to both queued/processed/erorred out job, we need to be able to hold values for when it is either of the status. Also important defining status columns for our jobs:

```
QUEUED     → waiting to be picked up
PROCESSING → consumer currently handling it
SENT       → delivered successfully
FAILED     → delivery failed, eligible for retry
RETRYING   → scheduled for another attempt
DEAD       → max retries exceeded, needs manual intervention
```

<table>
  <tr>
    <th>v1</th>
    <th>v2</th>
  </tr>
  <tr>
    <td>job_id</td>
    <td>job_id (PK)</td>
  </tr>
  <tr>
    <td></td>
    <td>request_id (FK → requests)</td>
  </tr>
  <tr>
    <td>job_category</td>
    <td>job_category</td>
  </tr>
  <tr>
    <td>job_status</td>
    <td>job_status</td>
  </tr>
  <tr>
    <td>job_payload</td>
    <td>job_payload</td>
  </tr>
  <tr>
    <td></td>
    <td>retry_count</td>
  </tr>
  <tr>
    <td></td>
    <td>next_retry_dt</td>
  </tr>
    <tr>
    <td></td>
    <td>sent_dt</td>
  </tr>
    <tr>
    <td></td>
    <td>error_message</td>
  </tr>
    <tr>
    <td></td>
    <td>created_dt</td>
  </tr>
  <tr>
    <td></td>
    <td>updated_dt</td>
  </tr>
</table>