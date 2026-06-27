---
layout: page
title: "Pagination and Database Indexing"
permalink: /notes/pagination_and_db_indexing/
---

Using our Orders SpringBoot App to illustrate System Design Concepts

Imagine our `GET /orders` endpoints returns 100k orders all at once
We'll have 2 main problems:
- Database: Quering 100k rows and loading them all into memory is:
  - Slow & Espensive
- Network: Sending 100k records in 1 HTTP response is a massive payload:
  - Slow to Transfer
  - And Painful for client to process

So `Pagination` solves this - returning a small chunk at a time e.g 20 orders per page

<hr>

#### 1. Page-based pagination - *Give me page 3, 20 items per page*
```
GET /orders?page=2&size=20
```

Page based pagination uses `page` and `size` parameters to navigate through pages of data

Pagination in the response might look like:

```
{
  "data": [
    ...
  ],
  "page": 2,
  "size": 10,
  "total_pages": 100
}
```
And we can also include Hypermedia Controls like:
```
{
  "data": [
    ...
  ],
  "meta": {
    "page": 2,
    "size": 10,
    "total_pages": 100
  },
  "links": {
    "self": "/items?page=2&size=10",
    "next": "/items?page=3&size=10",
    "prev": "/items?page=1&size=10",
    "first": "/items?page=1&size=10",
    "last": "/items?page=100&size=10"
  }
}
```

| PROS | CONS |
|---|---|
| Simple to implement and understand | Involves counting all records in the dataset, which can be slow and hard to cache |
| Easy for users to navigate through pages | Becomes exponentially slower the more records you have |
| UI can show page no.s and know exactly how many pages exist | If you load the latest 10 records, then another record is added to the database, when the user loads the second page - they'll see one of those records twice. 

<hr>

#### 2. Offset-baased pagination - *Give me the next X items after this offset*
```
GET /orders?offset=10&limit=10
```

uses `offset` and `limit` params to controll the no of items returned and the starting point of the data (which avoids the concept of counting everything and dividing by limit) and focuses on using offsets to grab more data

```
{
  "data": [
    ...
  ],
  "meta": {
    "total": 1000,
    "limit": 10,
    "offset": 10
  }
}
```

or with hypermedia controls

```
{
  "data": [
    ...
  ],
  "meta": {
    "total": 1000,
    "limit": 10,
    "offset": 10
  },
  "links": {
    "self": "/items?offset=10&limit=10",
    "next": "/items?offset=20&limit=10",
    "prev": "/items?offset=0&limit=10",
    "first": "/items?offset=0&limit=10",
    "last": "/items?offset=990&limit=10"
  }
}
```
##### Pros:
- Simple to implement and understand
- Easily integrates with SQLs `LIMIT` and `OFFSET` clauses
- We can show next/prev buttons with hypermedia like page based

##### Cons:
- Can't really do the math on pages like 1, 2, 3 ... END, math not as straight forward
- Can become ineffiecient with Large datasets cause we need to scan through all records
- As offset increases, so does performance degredation
- Same problem as pagination, if a new item is added, we'll likely see something twice

<hr>

#### 3. Cursor pagination - *Give me the next 20 items after this ID*
```
GET /orders?cursor=order_id_123&size=10
```

cursors uses an `opaque string` (unique identifier) to mark the starting point for the next set of items (like a landmark).
More often used for larger datasets

here order_id_123 is our unique identifier from the previous page

The way I understand it is that it is kind of like a linked list, where each node points to the next node - you cant just traverse to the end you have to go through them all.

```
{
  "data": [
    ...
  ],
  "links": {
    "self": "/items?cursor=abc123&limit=10",
    "next": "/items?cursor=xyz789&limit=10",
    "prev": "/items?cursor=prevCursor&limit=10",
    "first": "/items?cursor=firstCursor&limit=10",
    "last": "/items?cursor=lastCursor&limit=10"
  }
}
```

Pros:

- API consumers don't have to think about anything and you can change the logic easily.
- Generally more efficient than offset-based pagination depending on your data source.
- Avoids the need to count records to perform any sort of maths which means larger data sets can be paginated without suffering exponential slowdown.
- Cursor based pagination data remains consistent, even if new data is added or removed, because the cursor acts as a stable merker identifying a specific record in the dataset instead of "the 10th one" which might change between requests.

Cons:
- Slightly more complex to implement than offset-based pagination.
- API does not know if there are more records available after the last one in the dataset so has to show a next/previous link which may return no data.

### Exploring Pagination with Spring Data JPA

Spring Data JPA offers us an interface `Page<T>` that wraps our results and includes metadata

When we return a `Page<T>` from a repository method we get:

```
{
  "content": [...],        // the actual data
  "totalElements": 100,    // total records in DB
  "totalPages": 5,         // total pages based on size
  "number": 0,             // current page number
  "size": 20,              // page size
  "first": true,           // is this the first page?
  "last": false            // is this the last page?
}
```

To implement it:

1. Repository method accepts `Pageable` and return `Page<T>`
```
Page<Order> findAll(Pageable pageable);
```

2. Service/controller builds a `Pageable` from the request parameters:
```
Pageable pageable = PageRequest.of(page, size);
```

Here's an example:

`OrderRepository.java`

Before implementing Pageable:
```
@Query("SELECT o from Order o JOIN FETCH o.customer JOIN FETCH o.product")
    List<Order> findAllWithCustomerAndProduct();
```
After implementing Pageable:

```
@Query(value = "SELECT o from Order o JOIN FETCH o.customer JOIN FETCH o.product",
        countQuery = "SELECT COUNT(o) FROM Order o")
Page<Order> findAllWithCustomerAndProduct(Pageable pageable);
```

`OrderService.java`
Before implementing Pageable:
```
public List<OrderResponseDTO> getOrders() {
    List<Order> orders = orderRepository.findAllWithCustomerAndProduct();
    List<OrderResponseDTO> result = orders.stream()
            .map(order ->
                    mapToOrderResponseDTO(order)
            )
            .collect(Collectors.toList());
    return result;
}
```

After implementing Pageable:
```
public Page<OrderResponseDTO> getOrders(int page, int size) {
    Pageable pageable = PageRequest.of(page, size);
    Page<Order> orders = orderRepository.findAllWithCustomerAndProduct(pageable);
    Page<OrderResponseDTO> result = orders.map(order -> mapToOrderResponseDTO(order));
    return result;
}
```

`OrderController.java`

Before implementing Pageable:
```
@GetMapping
public ResponseEntity<Page<OrderResponseDTO>> getAllOrders() {
    return new ResponseEntity<>(orderService.getOrders(), HttpStatus.OK);
}
```

After implementing Pageable:
```
@GetMapping
public ResponseEntity<Page<OrderResponseDTO>> getAllOrders(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size) {
    return new ResponseEntity<>(orderService.getOrders(page, size), HttpStatus.OK);
}
```
