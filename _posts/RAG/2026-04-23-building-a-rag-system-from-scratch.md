---
title: "1. Building a RAG system From Scratch"
date: 2026-04-23
categories: [RAG]
tags: [rag, python, llm]
---

## Experimenting with PDF file consumption

- Experimented with reading PDF files using pymupdf, library had a hard time reading tables
  content wasn't lost, but columns were jumbled around. Could clean it, but too many variables to account for not worth it. Going to try using confluence API instead

- Set up a sample page, and moved over the test files (config.md) and onboarding.md

```python
response = requests.get(
    f"{base_url}/wiki/rest/api/content/884737?expand=body.storage",
    auth=HTTPBasicAuth(email, api_token)
)
```
  We are getting back the html, we will use beautiful soup to strip the html tags

- Some considerations: with our old mock files, we individually made the config.md/onboarding.md
  files, we dont want to manually make each one of these documents and link them - so how can we fetch
  all docs at once? Confluence API supports us grabbing everything from a confluence page (ragpoc) in our case

  from there we can paginate the response if we have a large subset of data (pages), and
  process the pages individually into .md files

- Need to think about future RAG strategies, we have regular naive rag for now, but we should look to incorporate advanced RAG/Hybrid search rag and most importantly, when we get to the slack integration step we need conversational rag, must be able to keep state and remember context from previous questions

- Further considerations:
  - Get feedback regarding w/ context from current project roadmap/goaals
  - What context will we use? (confluence, slack, codebase, etc)
  - What are the requirements to host our LLM on a server? Currently Llama 3.2 runs off my local CPU/GPU, but if this were to go on production - how would hosting the LLM work? Or if pivoting to using a cloud LLM, how would data privacy work?
  - Future ideas: API layer w/ Spring boot, Slack App Integration