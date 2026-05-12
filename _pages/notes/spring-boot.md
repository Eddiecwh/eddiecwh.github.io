---
layout: page
title: "Spring Boot Notes"
permalink: /notes/spring-boot/
---

## JPA, Hibernate and Spring Data JPA

### JPA Lifecycle Callbacks

- `@PrePersist` — fires before INSERT
- `@PostPersist` — fires after INSERT
- `@PreUpdate` — fires before UPDATE
- `@PostUpdate` — fires after UPDATE
- `@PreRemove` — fires before DELETE

They are hooks, when a persist method is called, JPA fires the chosen method
We can use these hooks to decide when certain actions should happen

for example: 

```
@PrePersist
public void prePersist() {
    createdAt = LocalDateTime.now();
}
```

With @PrePersist, *Before* INSERT is fired, the hook is called and we set the variable `createdAt` = LocalDateTime.now()

> `persist` → saving data to a permanent storage     
> `transient` → object is just stored in memory
{: .prompt-info }

<hr>

### JPA vs Hibernate vs Spring Data JPA

`JPA` is the the standard specification - a set of rules and interfaces that define how Java objects should map to database dables

`Hibernate` is the implementation of JPA - it's the engine doing the work:
- Generating SQL
- Managing Connections
- Handling Transactions, etc

When we use `@Entity`, or `@Column` or other JPA annotations - Hibernate reads them and uses them as instructions in talking with the database

`Spring Data JPA` is a layer on top of `Hibernate` that reduces the need for boilerplate code even more
- Works by extending `JpaRepository` and Spring handles it for us
  - With `JpaRepository` we can interact with DB without even touching sql

*Basic CRUD:*

| function | description |
| --- | --- |
| save(entity) | INSERT or UPDATE |
| findById(id) | SELECT by primary key |
| findAll() | SELECT all rows |
| delete(entity) | DELETE |
| deleteById(id) | DELETE by primary key |
| count() | COUNT(*) |
| existsById(id) —| exists check |

*Derived query methods*
```
// you write this:
List<ConversationHistory> findBySessionIdOrderByCreatedAtAsc(String sessionId);

// Spring generates this SQL:
SELECT * FROM conversation_history 
WHERE session_id = ? 
ORDER BY created_at ASC
```

For more complex queries we just use `@Query`
```
@Query("SELECT c FROM ConversationHistory c WHERE c.sessionId = :sessionId AND c.createdAt > :since")
List<ConversationHistory> findRecentBySession(String sessionId, LocalDateTime since);
```