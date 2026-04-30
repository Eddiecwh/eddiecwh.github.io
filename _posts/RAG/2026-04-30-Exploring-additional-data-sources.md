---
title: "5. Exploring Additional Data Sources"
date: 2026-04-30
categories: [RAG]
tags: [rag, python, llm]
---

## Exploring Adding Additional Data Sources to the Context Pool

### In today's episode: slack messages!

With a good bit of the foundational work out of the way, I think it's a good idea to add on additional data sources to add on the context pool (yes, I know our sample data only has 5 pages worth of confluence pages). 

I'm going for a variety of data sources as opposed to large quanitities of data for this learning process. So, today I'm going to see how we can incorporate Slack messages into the context pool

Some things to consider:
- A slack conversation is unstructured, it's not a single message, it's a thread. So a question and its subsequent replies together become 1 unit of knowledge.
- With our confluence documentation, we've been chunking by character count, 500 chars and a 100 char overlap
- So with a slack message our chunk would be: 

```
1 thread = original message + all the replies
```
An example might be like: (1 chunk)
```
Person A: How many times do our sync jobs run in the day?
Person B: Erm, if I'm not mistaken they run every 5 minutes during the day, and maybe every 8 minutes at night - is that right John?
John: Yes 5 minutes during the day, and 8 minutes at night
```

But, how do we account for `thread length?` I'd be lying to you if I said I've never seen a question go back and forth for a super long message chain. In which case a short thread might `NOT` need to be split, but a super long one `will need` to split - so we have to figure out a way to split at a `natural conversation bounday` and NOT by a `fixed character limit`

So our current strategy will be:
- Group messages by thread
- Each thread = one chunk
- if a thread > x length (undecided what length), split it a natural pause

Also one thing to note, since this is just a learning project - I'm not going to go through the hassle of setting up a slack channel and generating fake slack messages with myself (I'm already talking to myself on this blog hahaha) so I'm going to have Claude mock up some API responses and pull off a JSON file as our 'mock slack data'

### Further observations:

This is going to be a little harder than I thought - I jumped the gun with the sample slack response that Claude generated

```
{
  "messages": [
    {
      "type": "message",
      "user": "U12345",
      "text": "anyone know why the Athena sync is timing out for client XYZ?",
      "ts": "1702554180.000100",
      "reply_count": 2,
      "thread_ts": "1702554180.000100"
    },
    {
      "type": "message",
      "user": "U67890",
      "text": "check ehr_timeout_seconds in their config, it's probably still set to 10",
      "ts": "1702554300.000200",
      "thread_ts": "1702554180.000100"
    },
    {
      "type": "message",
      "user": "U12345",
      "text": "that was it, bumped it to 30 and it's working now",
      "ts": "1702554420.000300",
      "thread_ts": "1702554180.000100"
    }
  ]
}
```

So in this JSON response, it's easy for us to group responses to the original thread as there is a clear way for us to identify the main question at hand (thread) and the corresponding reply count + content of the replies.

But this isn't going to always be the case, sometimes we'll have people who dont reply to a thread in slack, but rather directly reply in the broader chat - how can I account for this?

<div style="text-align: center">
  <img src="../assets/img/memes/darn-it-shoot.gif" width="30%" alt="title">
</div>

So for our original `thread` case, `replies to a thread` in slack will have a `thread_ts` that matches the parent message, easy to group

But a `channel reply`, would have a `thread_ts` of their own, no parents

so we need to account for these two conditions:

```
thread_ts == ts → this is a standalone message, not part of a thread
thread_ts != ts → this is a reply, belongs to the thread started by thread_ts
```

Potential ways to deal with standalone messages:

Option 1 — treat each standalone message as its own tiny chunk
- creates very small chunks with little context, is it worth it?

Option 2 — group consecutive standalone messages into one chunk
- messages sent within a certain window of time (maybe 5 mins) in the same channel can get grouped as 1 chunk

Option 3 — ignore standalone messages under a certain length
- this means omitting smiley faces, one word replies, reactions, etc

For now, I'm going to go with this chunk building logic:

```
1. Loop through messages

2. If a message has reply_count > 0 — it's a thread parent. Collect all messages sharing its thread_ts as one chunk.

3. If a message is standalone — group it with other standalone messages sent within 5 minutes in the same channel as one chunk.

4. Filter out noise — messages under a certain character length, pure emoji, reactions etc.
```
Thinking about the chunks, some important data we should store might be:
- source (channel name, #dev-ops, #ops-integration)
- page_id (thread timestamp, maybe we could build a link back to the slack message)

Sample chunk:

```
[#dev-integrations | 2024-12-14]
john.doe: anyone know why the Athena sync is timing out for client XYZ?
jane.smith: check ehr_timeout_seconds in their config, it's probably still set to 10
john.doe: that was it, bumped it to 30 and it's working now
```
