---
title: "Learning About Hybrid Search and Modifying Data Stores"
date: 2026-04-27
categories: [RAG]
tags: [rag, python, llm]
---

## Learning about Hybrid Search

Todays focus: Adding hybrid search
 - want to attempt combining vector search (currently implemented) and keyword search
    - for example if we search specific system_config_keys: Athena_no_days_out, ConfiguredDaysToPull, etc.
    - currently pure vector search looks for meaning, and not exact key words
    - solution: with pgvector store, we can add a tsvector column to the documents table, and we'll query it along with vector search

current pipeline:

```
query -> embed -> vector search -> top_k (3) -> LLM
```

combining hybrid search and vector search (using arrows to diagram because I dont know how to embed images lol):

```
vector search  → top 20 candidates ─┐
                                    ├─→ merge → re-rank → top_k (3) → LLM
keyword search → top 20 candidates ─┘
```

In our documents table, I added a column `embeddings` that would store our embeddings and created a HNSW index on it

Here's how I understand how it works: 
Our `embedding` column stores vectors, which essentially is a list of 384 numbers, so when we do our query matching logic
we are trying to find which stored vectors are closest to our query vectors.

Using `HNSW (Hierachical Navigable Small World)` builds a smart graph structure on top of those vectors, so we can find the nearest neighbors withought having to check every row.

to implement keyword search, our new column `textsearch` of the type `tsvector` , will have an index created with `GIN - Generealized Inverted Index` which searches inside values rather than comparing whole values.

so that turns our vector into something like this: 
```
"appointment sync is enabled" → ['appoint', 'enabl', 'sync']
```

`GIN` builds an index that maps each word to which row contains it, which is what we need for keyword search

TLDR: 
`HNSW` — find vectors that point in a similar direction
`GIN` — find rows that contain specific words

To populate the `textsearch` column, we are converting `text` into a tsvector using `to_tsvector`, since postgres supports this method we don't have to implement it in `save_to_documents`, we can create a trigger (which is new to me), so that everytime a new entry is created, we'll run the method on the text column

The function:
```
CREATE OR REPLACE FUNCTION update_textsearch()
RETURNS trigger AS $$
BEGIN
  NEW.textsearch := to_tsvector('english', NEW.text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The trigger:
```
CREATE TRIGGER textsearch_update
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_textsearch();
```

Pros of using the trigger:
- We don't have to implement the method to_tsvector at the code level within `save_to_documents`

Cons:
- Since it's not in the code, other developers who might reuse the code might not know straight away (not looking at db functions) that the textsearch column population (or the keyword search as a whole) is dependent on this trigger

While testing the trigger, (re-running `ingest_confluence.py`) I realized that I did not add anything in to deal with handling duplicates, so I am just stacking on new data on top of the old pre-existing data.

I'm not sure if this is the best way to deal with it, but it's a band-aid solution for now, I'll just modify `save_to_documents` and truncate all pre-existing data so anytime we run the script - we start building context from scratch

Is it the best idea? Probably not, will it work for now? Yeah!
