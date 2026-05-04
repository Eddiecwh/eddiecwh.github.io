---
title: "7. Designing/Building Our Python FastAPI Layer"
date: 2026-05-04
categories: [RAG - AI Chatbot]
tags: [rag, python, llm]
---

### What piece comes first, our SpringBoot layer or conversational RAG?

Really quickly, before we get into today's blog post - I do want to say thank you. I hope the blog has been as exciting for you read as it has been for me to write. I appreciate the support I've gotten on it so far and I'm excited to keep posting. So happy monday everyone! After a refreshing weekend we are back and ready to get back in the lab and continue cooking

<div style="text-align: center">
  <img src="../assets/img/memes/cooking.gif" width="60%" alt="title">
</div>

Trying to contemplate what the better course of action is:

1. Build out a SpringBoot API layer first
2. Build out conversational RAG first

Conversational RAG would require our application to maintain a `chat history` across turns. Currently, we fire up `query.py`, feed it a question and recieve our answer. The conversation dies there, no follow-ups no storage of state. For us to have a back and forth conversation, we'll need to store that history, perhaps through a session, cache, or some DB entry tied to the conversing user.

With our Spring Boot API layer, we can build out:

- A proper request/response cycle
- Store session/user identity
- A place to store and retrieve conversation history per user
- The async response handling that our end application would need

Building some sort of pseudo memory that lives off the python script would probably end up with me reworking it almsot completely later on anyway so let's work through designing the API layer first

<hr>

### Designing our Endpoints

Query:
```
POST /api/query
Body: { "question": "...", "domain": "dev", "sessionId": "..." }
```

Ingestion:
```
POST /api/ingest/confluence
POST /api/ingest/slack
POST /api/ingest/all        ← convenience endpoint to run both
```

Webhook (for automatic re-indexing):
```
POST /api/webhook/confluence  ← Confluence calls this when a page changes
POST /api/webhook/github      ← GitHub calls this when code is pushed
```

Admin:
```
GET  /api/health              ← is the service up?
GET  /api/stats               ← how many chunks indexed, by domain?
DELETE /api/index/{domain}    ← clear a specific domain's data
```

Conversational history:
```
GET  /api/sessions/{sessionId}          ← get conversation history
DELETE /api/sessions/{sessionId}        ← clear a session
```

<hr>

### Using Flask/Fast API to Expose Our Python functions as HTTP endpoints

To expose our python functions as HTTP endpoints, we will use Flask which is a lightweight Python web framework. Claude describes it as the Spring Boot we have at home - simpler and with less ceremony.

Flow:

<div style="text-align: center">
  <img src="../assets/img/figures/sb-flask-flow.png" width="100%" alt="title">
</div>

#### Flask vs Fast API?

I asked Claude to compare and contrast some pros and cons of both frameworks and highlighted some variances which I thought would be relevant to the project

<div style="text-align: center">
  <img src="../assets/img/figures/flask-vs-fastapi.png" width="100%" alt="title">
</div>

For this project, FastAPI's async support makes it easy for us to acknowledge our eventual slack integration's request and process the RAG query in the background - then post the answer back to us when its ready. Flask would require other workarounds for this (or so I'm told)

Another small benefit is that FastAPI has Swagger UI auto-gerated docs which would be very helpful

Additional Reddit research (because reddit never leads me astray :kekw:) also shows a lot of people encourage the use of FastAPI over flask - so let's get our hands dirty with it and see for ourselves...

#### First impressions using FastAPI:

This is our first FastAPI endpoint (yay) for accepting queries:

```
class QueryRequest(BaseModel):
  question: str
  domain: str = None
  session_id: str = None

@app.post("/api/query")
async def query(request: QueryRequest):

  conn = get_connection()

  model = SentenceTransformer(MODEL_NAME)

  question = request.question
  domain = request.domain

  relevant_chunks = find_matching_chunks_from_db(conn, question, model, TOP_K, domain)
  prompt = build_prompt(question, relevant_chunks)
  answer = ask_ollama(prompt)

  return {"answer": answer, 
          "sources": [{"source": chunk['source'], "page_id": chunk['page_id']} for chunk in relevant_chunks]
          }
```

- It feels very similar to a SpringBoot setup, defining our QueryRequest class (like setting up our DTO, data transformation object in Java) so we can determine what our requestBody will contain

- Defining out HTTP methods with @app.post (I like the @ annotation tags, just like springboot as well...) and the associated url and ofcourse request parameters
  - Feels very second nature and comfortable coming from SpringBoot, but maybe that's just my inexperience with API building frameworks outside of SpringBoot because I am a jake of all trades and barely a master in 1 haha

I have also modified our vector_search and keyword_search to accomodate looking in specific domains (e.g only Confluence, only slack) such that our API request can accomodate domain specific searches

Testing the endpoint in the auto-generated Swagger UI (Love that Fast API gives us this built-in):

<div style="text-align: center">
  <img src="../assets/img/figures/query-test-1.png" width="100%" alt="title">
</div>

<div style="text-align: center">
  <img src="../assets/img/figures/query-response-1.png" width="100%" alt="title">
</div>

Everything looks good so far! I'm gonna omit the rest of the endpoints for now and handle data ingestion manually, just so I can get the next piece moving which I think feels a bit more important for the sake of this learning project.



