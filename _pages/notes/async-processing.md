---
layout: page
title: "Async Processing"
permalink: /notes/async_processing/
---

### What is `Async` Processing?
Async processing is used to process logic seperate threads so that we can ensure `responsiveness`, and quick responses to uses requests - even when the server is under heavy load.

We have two ways to handle async procession:

#### 1. `@Async` - Spring's built-in-annotation, that will run whatever method it is tied to in a seperate thread
```
@Async
public void sendConfirmationEmail(String email) {
    // runs in background thread
    // caller doesn't wait for this
}
```
It's simple, doesn't require additional infrastructure and is good for lightweight background tasks.

#### 2. Message Queues (RabbitMQ/Kafka)
Instead of processing in a background thread, we publish a `message to a queue`, and a seperate `consumer` service picks it up and processes it

```
placeOrder() -> public "order placed" mesage -> return response immediately -> Consumer picks up message -> sends email
```

When do we use what?
- @Async when we want to run simple background tasks, it's okay if it fails silently
- Messaage queue: critical tasks that CANT be lost/seperate services/needs retry logic

### @Async w/ SpringBoot

`@EnableAsync` is a required annotation at the application class level to enable async processing

Going to create an `EmailService` class to learn async 

```
public class EmailService {
    @Async
    public void sendConfirmationEmail(OrderResponseDTO order) {
        log.info("Sending confirmation email to: {}", order.getCustomerEmail());
    }
}
```

Then in `orderService.java` I call it:
```
Order response = this.orderRepository.save(order);

OrderResponseDTO result = mapToOrderResponseDTO(response);

emailService.sendConfirmationEmail(result);
```

and in the logs we get:
```
task-1] c.eddiecwh.drills.service.EmailService   : Sending confirmation email to: alice@email.com
```

So my email service method is running on thread 1

#### AsyncConfigurer - Handling a large numbers of proccesses simultaneously

If we place 100 orders simultaneously, Spring creates `task-1`, `task-2`,e tc up to a configurable thread pool limit. Beyond that - tasks queue up. Default thread pool is `8` threads, so we could do something like:

```
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    @Bean
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(500);
        executor.initialize();
        return executor;
    }
}
```

With a custom AsyncConfig bean we won't need need the default setup so we can remove @EnableAsync from the main application class



