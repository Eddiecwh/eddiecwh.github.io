---
title: "URL Shortner"
date: 2026-08-17
categories: [Backend System Design, URL Shortner]
tags: [System Design, Backend]
---

***Part 2 of my Backend System Design Learning Series***
<hr>
***Developing a URL shortner to learn how backend systems are built***

[Click here to see the GitHub Repo](https://github.com/Eddiecwh/url-shortner)
<hr>

***Some pre-development thoughts:***

What are some interesting problems I might face building this?
- How do I handle mutating various domain names into a concise format
- How do I handle URL that redirect themselves?
- What would happen if someone tried to shorten a URL that's already sortened? (double feed)
- Would there be a case where two shortened URLs are the same?
- How would I deal with collisions? if generated URLs are the same?
- How would I handle requests after a very large number?
    - Would there be a limit to requests I can process?

Data Model Think-Through
Let's say we turn a URL into our shortened URL - `shortner.com/ae1234`, we need to store the short code

| urls                                                                              |
|-----------------------------------------------------------------------------------|
| id (PK)                                                                           |
| original_url                                                                      |
| short_code                                                                        |
| expires_at (Maybe not needed, but custom expiration date would be a good feature) |
| created_dt                                                                        |
| update_dt                                                                         |

Thinking about analytics and data measuring - it might make sense to track how many times a URL has been used.
We could implement just a simple row in URLs that increments a counter everytime a URL is clicked - but from a learning perspective, a seperate
visits table would help me to understand more about aggregate queries, time-based/custom filtering, JOIN patterns etc..

| visits       |
|--------------|
| id (PK)      |
| url_id (FK)  |
| clicked_at   |

API Endpoint Think-Through
From a user perspective - we would want to reveal two endpoints:

```
POST /urls           Submit a long URL and recieve a short URL
GET  /{shortcode}    Submit the shortURL as a path variable, and be redirected to the long URL destination
```

To Do List:
1. Expiry check in getUrlByShortCode (done)
2. GET /urls/{id} — URL details (done)
3. GET /urls/{id}/visits — visit history (done)

4. Analytics endpoints (clicks per day, most popular) (done)
5. Custom short codes (done)
6. Redis caching (done)

(Future potential additions)
7. Spring Security + JWT
8. User ownership of URLs

<hr>

***Expiry Check***:

When a user visits a link that is expired, should we:
- Throw an exception, return 410/404 error to the user
- automatically regenerate a new shortcode and redirect it

Automatically regenerating a new short code seems better for user experience. If a user is using the url-shortner, they probably don't care about
the logistics of the application. They just want to be redirected.

But let's say someone shares the shortCode on social media and 1000 people click it. When the code expires, our system regenerates a new code
but all 1000 people that bookmarked the old link still have an expired code.

What if we have logic that keeps popular URLs active for longer? Currently we have it
set to expire a week from creation, but what if every time it is clicked, the expiration date is increased by 2 hours?
Essentially becomes like a TTL that resets on activity.

```
1. Find URL by short code → throw if not found
2. If expired → throw 410 Gone (truly dead, no recent activity)
3. If not expired → extend expiresAt by 7 days → save → redirect
```

<hr>

***GET /urls/{id} — URL details (Management Endpoint)***
- Done

***GET /urls/{id}/visits — Visit details (Management Endpoint)***
- Done

<hr>

***Analytics endpoints (clicks per day, most popular)***
For clicks per day: I am wondering how'd i'd display this information - should we take an id as a variable, and return the count of clicks per day? 
What does per day mean only today, or for the past week? should these be parameters?

Thinking about it logically, a useful breakdown might be like:
```
2026-08-01 -> 5 clicks
2026-08-02 -> 6 clicks
2026-08-03 -> 2 clicks
```
So maybe we pass the date range as a parameter, and we return the number of clicks
for everyday, starting from that day until the supplied end date

```commandline
GET /urls/{urlId}/analytics?startDate=2026-08-01&endDate=2026-08-03
```

We'll have to think about some fallbacks too, 
for example:
- if no date range is supplied?
  - Supply the last week (default)
- How do we handle end date/start date > today
  - Start date > today (throw error)
  - endDate > today (if startDate is < today, just return date range until today)

I want to introduce another endpoint
```
GET /urls/analytics/mostVisited
Optional parameters:
- startDate
- endDate
- limit (top x results)
```
It will have optional parameters startDate and endDate and will return a list of the top x most visited sites.
Only 1 controller endpoint will be defined, but will point to a service method that redirects to 2 different repo
methods, one with date params and one without. This will help me to practice some custom JPQL queries.

Some interesting finds:
With our previous VisitHistoryDTO, we are passing in startDate and endDate of `LocalDate` types, and because we are mapping the JPQL
query response into our custom DTO it is having issues converting Visits.clickedDt as LocalDate since that is an explicit property
of the VisitHistoryDTO

```
@Query("SELECT new com.eddiecwh.url_shortner.dto.VisitHistoryDTO(CAST(v.clickedDt AS date), COUNT(v.id)) " +
            "FROM Visits v " +
            "WHERE v.url.id = :urlId " +
            "AND CAST(v.clickedDt AS date) BETWEEN :startDate AND :endDate " +
            "GROUP BY CAST(v.clickedDt AS date) " +
            "ORDER BY CAST(v.clickedDt AS date)")
```

I had previously setup my DTO to just use the `@allargsconstructor`, but ran into errors - with the solution being to explicitly
define the constructor and manually type cast the date parameter into sql's expected date object

```
@Data
public class VisitHistoryDTO {
    LocalDate date;
    Long visits;

    public VisitHistoryDTO(Object date, Long visits) {
        this.date = ((java.sql.Date) date).toLocalDate();
        this.visits = visits;
    }
}
```

<hr>

***Custom Short Codes***

Think this might be a tricky one, currently our request body takes an original URL and encodes it with our custom
base64 encoder file - we'll have to modify this DTO to accept a parameter for an optional shortCode like:

```commandline
{
    "originalUrl" : "https://www.google.com"
    "customShortCode" : "eddiesLink"
}
```

Thinking about how this will have to play with our current validations like:
- (Checking if a shortCode already exists)
  - Will this custom shortCode tell a user a shortCode already exists? or is this private to a user that generates it?
- On the logistical side of the house:
  - What if this custom shortCode already exists?
    - Maybe we just throw a custom "shortCodeInUseException"
  - What characters should be allowed?
    - I think for simplicity's sake we limit it to alphanumeric characters (a-zA-Z0-9), no special characters
  - Should there be a length limit?
    - I would think a 6-character limit seems reasonable

Some other concerns:
- Should a custom shortCode have its own column in the URL entity? 
  - I'm just thinking of a situation where let's say "eddie" is the supplied shortCode and "eddie" somehow already exists
    as a non-custom shortCode - would the two conflict?
    - Talking it through with Claude, I think we'd just throw our custom "shortCodeInUseException" - so no real need for us
      to have a separate column in our URL entity

Proposed workflow:
```
customCode supplied -> validate format -> check if taken -> save with custom code
customCode = null   -> default behavior (base62 encoding)
```

I've also introduced a few more exceptions for this improved workflow:
`InvalidCustomCodeException` returns 400 Bad Request
`ShortCodeInUseException`    returns 409 Conflict

Which all bubble up to the GlobalException handler to ensure that the correct status codes
are returned instead of a generic 500 server error, which is not indicative of what the actual problem was

<hr>

***Redis Caching***
Q: What is Redis and what purpose does caching serve?

Caching serves as an intermediary data store between our application and our database to store frequently queried items.
Might not have a huge impact in the scale of my small learning project, but it definitely plays a huge part when the data store
is massive and transactions are very frequent.

Looking at my endpoints, I think 
`GET /urls/{shortCode} - my getUrlByShortCode controller endpoint`
makes a lot of sense to be a candidate for caching.
- Every redirect hits the database to look-up the original URL
  - If a short URL has a lot of visits (like if it went viral), we'd be making thousands of queries to fetch the same record

According to Claude, caching makes the most sense for `GET` endpoints, `POST` or write endpoints are more problematic:
Cons of Caching on `POST` operations
- Every request potentially creates `NEW` data
- Cache would be stale immediately after a write
- We'd then need to invalidate the cache on every POST
  - Which is just adding an unnecessary extra step

Workflow think through for `GET /urls/{shortCode}`
```
Without Cache:
GET /abc -> queries DB everytime

With Cache:
GET /abc (first time)          -> DB lookup -> store in Redis
GET /abc (second time)         -> Cache hit -> no DB query
GET /abc (third time)          -> Cache hit -> no DB query (etc..)
GET /abc (but TTL has expired) -> Cache miss → hit DB → store in Redis → redirect

Redis is a KV data store (hashmap Data Struc) so a good key might be:
key: shortCode
value: originalUrl (or the full Url entity)
```
We also currently have a standard expiration of 1 week on shortCodes, so a TTL of 1 week I
think makes sense

Trade-off between caching just the originalUrl vs. the entire Url entity
```
originalUrl only  → lightweight, fast, less memory
                  → but if we need expiresAt to check expiry, we'd still hit the DB

full Url entity   → more memory
                  → but you we check expiry from cache without hitting DB
                  → avoids a DB hit for the expiry extension too
                  
However, if we cache the full entity and then extend expiresAt in the DB, our cache would be stale
so we'd need to update the cache as well

hmm, decisions, decisions, decisions..
```
Let's cache just the originalUrl for now, then the expiry check still hits the database, but the redirect
lookup will be cached. At least we split the number of DB queries by half

Serialization Issues:

So in our current Redis config
```
.serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
.serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()));
```

I'm using StringRedisSerializer for serializing values. Based on what I understand, when items are stored into cache, there is a
serialization process that happens which transforms strings/objects/entities into bytes to be stored in the cache. So instead of a object (for example) it stored as bytes. Serialization is what Redis uses to serialize from object -> bytes, then bytes -> object when we need to retrieve the value. 

In my config, I used `StringRedisSerializer`, but the method I am calling `@Cacheable` on, returns the type Url (My Url entity), so there is a serialization/serialization problem. 

Looking @ the `StringRedisSerializer` class, it implements an interface `RedisSerializer<String>` specifically for strings. The interface itself takes `<T>` parameter, but to parse my custom URL object i'd have to create a UrlRedisSerializer class and override the interface methods.

Claude recommends using `GenericJackson2JsonRedisSerializer`, but seems like that library is deprecated. Looking at classes that implement the interface `RedisSerializer` w/ my current version of SpringBoot, JacksonJsonRedisSerializer

```
JacksonJsonRedisSerializer<Url> serializer = new JacksonJsonRedisSerializer<>(Url.class);
```

Looking at this class, it implements the RedisSerializer<T> class which is great, exactly what we wanted from what I mentioned above.
Claude says that it's Jackson's core class for converting between Java objects and Json, so it's
essentially the backbone behind the serialization and deserialization process. I'm not going to dig into the code to see how exactly the
process works, but good to know.

```
@Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        JacksonJsonRedisSerializer<Url> serializer = new JacksonJsonRedisSerializer<>(Url.class);

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(7))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(serializer));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
```

Leaving the key serialization as `StringRedisSerializer` (since our key is just a string) and instantiating our JacksonJsonRedisSerializer
to serialize/deserialize our Url entity.

Stale Data for expiresAt field (cache):

So with our current workflow we:
1. (1st time) call getUrlByShortCode which hits the database and extends expiryDt by 7 days
2. (2nd time) cache is populated under urls::{shortCode}
    - The cache has a 7 day TTL, which will start on the run right after the first call hits the database
    - Hypothetical situation: {shortCode} : c is set to expire in a few minutes,
      - Suddenly the site gains a lot of traction
        - 1st call hits the DB and extends the expiresAt by 7 days
        - 2nd call (and so on...) hits populates from cache, and expiresAt never changes
      - So eventually, the shortCode will expire the cache will continue to be populated, even if the original shortCode already expires

TLDR: 2 problems 
- ExpiresAt in DB never gets updated after first cache hit 
- Even after DB expiresAt expires, Redis still serves the cached value - meaning expired URLs can still be accessed 
      as long as Redis cache is alive

Potential Solution:
```
DB expiresAt = 7 days from now
Redis TTL    = 5 days (expiresAt - 2 days)

This means:

Day 0   → first request → DB hit → extends expiresAt to Day 7 → cached with 5 day TTL
Day 1-5 → cache hits → served from Redis
Day 5   → Redis TTL expires → next request hits DB
→ DB expiresAt = Day 7 → still valid → extends to Day 14 → re-cached with 5 day TTL
Day 6-10 → cache hits again

So every 5 days the cache expires, forcing a DB hit which extends expiresAt another 7 days and re-caches. Active URLs never expire.

The tradeoff:

Smaller gap (e.g. -2 days) → DB hit more frequently, more consistent
Larger gap (e.g. -5 days)  → fewer DB hits, less consistent
```

But then this would require a dynamic TTL that is based off of `expiresAt`. Our `redisConfig`
is currently set to hardcode 7 days as the TTL, but we'd have to use something like `RedisTemplate`
to set a TTL per key

So with `@Cacheable`, spring handles everything automatically - but because I want to set a custom TTL w/ RedisTemplate, we'd
have to implement the cache check from within the function body itself.

```
@Bean
    RedisTemplate<String, Url> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Url> template = new RedisTemplate<>();
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new JacksonJsonRedisSerializer<>(Url.class));
        return template;
    }
```

Key parts of the code changes I made:
- I've taken out the `@cacheable` changes
  - By doing so, the logic for handling the key value store for redisTemplate is now entirely handled by me (and not spring)
  - here we are checking for a cached value from our key urls::shortCode
    - returning the stored value (Url) if it is present
    - If it is not:
      - hit DB → check expiry → extend expiresAt → cache with 5 day TTL → save → return


```
@Transactional
    public Url getUrlByShortCode(String shortCode) {
        Url cached = redisTemplate.opsForValue().get("urls::" + shortCode);
        if (cached != null) {
            log.info("Returning cached value for {}", cached);
            return cached;
        }

        Url url = urlRepository.findByShortCode(shortCode).orElseThrow(() -> new UrlNotFoundException("Short code not found"));

        if (url.getExpiresAt().isAfter(LocalDateTime.now())) {
            url.setExpiresAt(url.getExpiresAt().plusDays(7));
            redisTemplate.opsForValue().set("urls::" + shortCode, url, 5, TimeUnit.DAYS);
            return urlRepository.save(url);
        } else {
            throw new UrlExpiredException("Url has expired");
        }
    }
    
returns: 2026-08-14T12:44:05.851-05:00  INFO 45300 --- [url-shortner] [nio-8080-exec-4] c.e.url_shortner.service.UrlService      
         Returning cached value for Url(id=2, originalUrl=https://www.youtube.com/watch?v=NX6uBCydAyU&list=RDRaEVcYBmesQ&index=2, 
         shortCode=c, expiresAt=2026-09-26T18:44:36.679659, createdDt=2026-08-08T18:44:36.679659, updateDt=2026-08-08T18:44:36.717962)
```

Also, few other notes:
- `@EnableCaching` at the application level was removed since we are not using Spring to handle our cache anymore
- our `RedisCacheManager` in `redisConfig` was also removed, since we are manually handling cache behavior now





