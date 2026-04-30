---
title: "2. Building A Roadmap"
date: 2026-04-24
categories: [RAG - AI Chatbot]
tags: [rag, python, llm]
---

## Building a Roadmap

Next Steps:

Roadmap proposed by Claude:

| Step | Title | Description |
|---|---|---|
| Step 1 | Upgrading Our Datastore |Swap index.pkl for pgvector Get a real vector database in place first. Everything else gets easier once you have proper persistent storage with metadata filtering. This is also where your Spring Boot background becomes relevant — pgvector is just Postgres |
| Step 2 | Adding Hybrid Search | Once you're on pgvector you can add keyword search alongside vector search almost for free — Postgres has full text search built in. This immediately improves retrieval quality before you add more data |
| Step 3 | Adding more data sources | Now that the foundation is solid, add the codebase first — it's simpler than Slack because it's just files. Slack is the messiest source — short messages, lots of noise, threading makes chunking tricky. Save it for last |
| Step 4 | Spring Boot API layer | Wrap everything in an API so it's not just scripts anymore |
| Step 5 | Slack integration | Now you have something worth wiring up to Slack |

Today's work: Step 1 has been completed - we have succesfully migrated over from a index.pkl file -> using a pgvector database which our RAG application succesfully calls to retrieve context. our previous process of loading the index file, then finding the relevant chunks is now streamlined into 1 function where we embed the query and directly use cosine similarity to find the the top_k relevant contexts. 

To do: we'll have to figure out how to avoid storing duplicate context - because everyime we run ingest_confluence.py, we will just add the same information again