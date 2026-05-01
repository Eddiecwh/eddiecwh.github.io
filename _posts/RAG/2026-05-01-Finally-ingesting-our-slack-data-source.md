---
title: "6. Ingesting our Slack Data Source"
date: 2026-05-01
categories: [RAG - AI Chatbot]
tags: [rag, python, llm]
---

Another day, another dolla'! We are another step closer to integrating slack messages as an additional data source. I have:

- Implemented chunking and embedding for our slack messages reading the following messages as criterias:

> `thread_ts == ts` → standalone message, not part of a thread  
> `thread_ts != ts` → reply, belongs to the thread started by `thread_ts`
{: .prompt-info }

Now running the script, I'm realizing that we're truncating the table on each ingestion of each data source. So when we run the slack ingestion script we lose the confluence context, and vice versa

But, we have a solution! 

```
CREATE TABLE documents (
    id        SERIAL PRIMARY KEY,
    text      TEXT,
    source    VARCHAR(255),
    page_id   VARCHAR(50),
    domain    VARCHAR(50),  <---- Our knight in shining armor!!!
    embedding vector(384)
);
```

We have a column in our documents table that supports the categorization of our data source (domain). So we'll add a domain variable (confluence/slack) alongside our chunks so that we effectively purge contents of the context table that need to be refreshed (not just blindly wiping everything). Two thumbs up for forward thinking! (sike Claude puts me to shame)

<div style="text-align: center">
  <img src="../assets/img/memes/fine-happy-sad.gif" width="100%" alt="title">
</div>

After conversion our 2 thread types are going from:
<br>
Raw message from JSON:

```
{
  "user": "john.doe",
  "text": "anyone know why the Athena sync is timing out for client Sunrise Medical?",
  "ts": "1702554180.000100",
  "thread_ts": "1702554180.000100",
  "reply_count": 3
}
```

After grouping by thread_ts — a thread list:
```
[
    {"user": "john.doe", "text": "anyone know why the Athena sync is timing out for client Sunrise Medical?", ...},
    {"user": "jane.smith", "text": "check ehr_timeout_seconds in their config, its probably still set to 10", ...},
    {"user": "mike.johnson", "text": "also check if they hit the 1000 req/min rate limit", ...},
    {"user": "john.doe", "text": "timeout was the issue, bumped ehr_timeout_seconds to 30", ...}
]
```

After flatten_thread — a readable string:
```
john.doe: anyone know why the Athena sync is timing out for client Sunrise Medical?
jane.smith: check ehr_timeout_seconds in their config, its probably still set to 10
mike.johnson: also check if they hit the 1000 req/min rate limit
john.doe: timeout was the issue, bumped ehr_timeout_seconds to 30
```

After appending to all_chunks — a dictionary:
```
{
    "text": "john.doe: anyone know why...\njane.smith: check ehr_timeout_seconds...\n...",
    "source": "dev-integrations",
    "page_id": "1702554180.000100",
    "domain": "slack"
}
```

Then embedded and stored in pgvector as a row:
```
id: 42
text: "john.doe: anyone know why..."
source: "dev-integrations"
page_id: "1702554180.000100"
domain: "slack"
embedding: [0.082, -0.031, ...] (384 numbers)
textsearch: 'athena':4 'check':8 'client':6 'ehr_timeout':9 ...
```

and now to test our context retrieval, I'm aiming to use this query:
```
Ask a question: Have we had any problems with athena sync timing out for our clients?
```

and I the conversation piece I'm targeting is this one:
```
"messages": [
        {
          "user": "john.doe",
          "text": "anyone know why the Athena sync is timing out for client Sunrise Medical?",
          "ts": "1702554180.000100",
          "thread_ts": "1702554180.000100",
          "reply_count": 3
        },
        {
          "user": "jane.smith",
          "text": "check ehr_timeout_seconds in their config, its probably still set to 10",
          "ts": "1702554300.000200",
          "thread_ts": "1702554180.000100",
          "reply_count": 0
        },
        {
          "user": "mike.johnson",
          "text": "also check if they hit the 1000 req/min rate limit, Athena is aggressive about that",
          "ts": "1702554360.000300",
          "thread_ts": "1702554180.000100",
          "reply_count": 0
        },
        {
          "user": "john.doe",
          "text": "timeout was the issue, bumped ehr_timeout_seconds to 30 and its working now. thanks!",
          "ts": "1702554420.000400",
          "thread_ts": "1702554180.000100",
          "reply_count": 0
        },
```

<div style="text-align: center">
  <img src="../assets/img/memes/drum-roll.gif" width="100%" alt="title">
</div>

```
Ask a question: Have we had any problems with athena sync timing out for our clients?

Answer: Yes, it seems that there have been issues with Athena sync timing out for some of your clients. One client, Sunrise Medical, was experiencing timeout errors and was able to resolve the issue by increasing the ehr_timeout_seconds value in their config from 10 to 30.

Sources:
 - dev-integrations
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/1702554180.000100
 - EHR Integration Overview
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/1048577
 - Troubleshooting Common Issues
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/524290
```

<div style="text-align: center">
  <img src="../assets/img/memes/yes.gif" width="100%" alt="title">
</div>