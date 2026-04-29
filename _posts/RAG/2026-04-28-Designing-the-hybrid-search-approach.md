---
title: "Designing the Hybrid Search, and problems continued..."
date: 2026-04-27
categories: [RAG]
tags: [rag, python, llm]
---

## Designing the Hybrid Search Approach

Diving into the flow for the hybrid search, here's what I'm thinking in terms of the workflow:

1. Embed The query (no changes here)
2. Run the vector search (this time, we're grabbing top 20, again by cosine similarity)
3. Run the keyword search (get top 20 by text match)
4. Merge the two lists, and remove duplicate ids
5. Re-rank, our list of candidates using an algorithm
6. Return the `top_k` elements from our reranked results

So in terms of reranking (sorting algorithms) Claude recommends using `RRF - Reciprocal Rank Fusion`, other alternatives include `Linear Combination`, `Cross-encoder re-ranking` let's see why RRF is recommended and what it does:

The formula: 
```
RRF score = 1/(rank_in_vector_results + k) + 1/(rank_in_keyword_results + k)
```
*k is usually 60, a constant that softens the impact of top rankings so first place isnt overwhelmingly dominant*

So example, let's say we have 2 chunks

1. Ranked 1st in vector search and 5th in keyword search

```
1/(1+60) + 1/(5+60) = 0.0164 + 0.0154 = 0.0318
```

2. 2nd in both searches
```
1/(2+60) + 1/(2+60) = 0.0161 + 0.0161 = 0.0323
```

The chunk ranked 2nd in both scores higher than one ranked 1st in one and 5th in the other. So this algorithm actually favors situations where there is a balance of both searches

`Linear Combination` would be the opposite of this where we decide how much weight we want to attribute to each search

```
final_score = 0.7 * vector_score + 0.3 * keyword_score
```

*^ Favoring a 70% weight on vector score, vs 30% on keyword score*

`Cross-encoder` re-ranking would have us pass each chunk + query into a seperate more powerful model, which would be more accurate - but we're adding a whole new model call for each candidate chunk. I think we'll skip that for now

--- 

### Having issues with Tables (cont..)

After implementation of the hybrid search, I am noticing that the LLM is still having issues with retrieving context from table data sources:

e.g - prompt: 
```
what is the average Athena response time
```

Response:
```
Answer: I don't know. The context only mentions that Athena is the slowest of our integrations under load, frequently hitting the ehr_timeout_seconds limit, but it doesn't provide information about the average Athena response time.
```
Context:

| EHR | Auth Method | Data Format | Avg Response Time |
| --- | --- | --- | --- |
| Athena | API Key | REST/JSON | 800ms | 

It is still not parsing tables correctly, and looks like it is unable to properly utilize our newly added keyword search and associate the `EHR` with the corresponding `Avg Response Time`

To try and work around this, I've implemented a helper method within `ingest_confluence.py` to utilize beautiful soup to find tables in a given document, and preprocess it into a data row that can be paired with the right headers.


```
EHR: Athena | Auth Method: API Key | Data Format: REST/JSON | Avg Response Time: 800ms
```
The method returns a string with associated values tied to their corresponding headers:

the html parsing script will also need to be modified to accomodate html tables already being happenned so they are not parsed twice

Testing the results with the fix:

```
Fetching pages from confluence...
Found 5 pages
Chunking and Embedding
Total chunks: 25
```
Fetching 25 instead of 21 chunks now, looks like we are parsing the table correctly...

```
(venv) PS C:\Users\Eddie PC\Documents\Coding\python\rag-poc> python .\query.py                                                                                                                                     
Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN to enable higher rate limits and faster downloads.
Loading weights: 100%|██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 103/103 [00:00<00:00, 8067.32it/s]
Ask a question: what is the average Athena response time

Answer: The average Athena response time is 800ms.

Sources:
 - EHR Integration Overview
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/1048577
 - EHR Integration Overview
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/1048577
 - Configuration
    - https://eddiecwh.atlassian.net/wiki/spaces/ragpoc/pages/884737
```

<div style="text-align: center">
  <img src="../assets/img/memes/great-success.jpg" width="30%" alt="title">
</div>