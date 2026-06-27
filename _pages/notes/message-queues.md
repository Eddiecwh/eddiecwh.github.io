---
layout: page
title: "Message Queues/RabbitMQ"
permalink: /notes/message_queues/
---

### Why Message Queues over Async Processing?

Using our `placeOrder()` example w/ `@async` - if the app crashes after the order saves BUT BEFORE the email sends -> the email is lost forever. `@async` has no retry mecahnism, no persistence and no guarantee.

So with message queues:

```
placeOrder() -> saves order -> publishes "ORDER_PLACED" message to RabbitMQ -> returns response

RabbitMQ -> HOLDS the message safely - > Email Consumer picks it up -> sends email
```

So even if the application crashes, RabbitMQ has the message! When the app restarts, the consumer picks ut up and sends the email.

With RabbitMQ there are 3 fundamental concepts:

1. Producer - publishes messages
2. Queue - stores messages until consumed
3. Consumer - reads and processes messages

In our application example:
1. Producer - `OrderService`
2. Queue - `RabbitMQ`
3. Consumer - `EmailService`

### Exchange Types

There is a layer between `Producer -> Queue` called Exchange, so it looks like: `Producer -> Exchange -> Queue -> Consumer`, the `exchange` routes the message to the right queue based on rules

There are 4 exchange types:
- `Direct` - routes messages to a queue based on an exact routing key match
```
message with the key "order.placed" goes to "order_queue"
message with the key "order.cancelled" goes to "cancelled_queue"
```
Like a specific address on an envelope

- `Fanout` - broadcasts to ALL queues bound to the exchange, ignores routing keys
```
message → goes to email_queue AND sms_queue AND analytics_queue simultaneously
```
Like a group email, everyone gets it

- `Topic` - Routes based on pattern matching w/ wildcards
"order." matches "order.placed", "order.cancelled", "order.shipped"
"#" matches everything

- `Headers` - Routes based on message header attributes. Rarely used in practice.

Downloading RabbitMQ I saw that this was their banner

<img src="../assets/img/figures/rabbit-mq.png" alt="query-1.png" style="width: 100%">

This is such an an elite reference, and I hope you have the ball knowledge to appreciate that

<img src="../assets/img/memes/LOTR.png" alt="query-1.png" style="width: 70%">

With SpringBoot we'll need the `spring-boot-starter-amqp` dependency which is Spring's abstraction on top of the RabbitMQ Java client.

Creating our `RabbitMQConfig.java` class:

```
@Configuration
public class RabbitMQConfig {

    @Bean
    public Queue orderQueue() {
        return new Queue("order.queue", true);
    }

    @Bean
    public FanoutExchange orderExchange() {
        return new FanoutExchange("order.exchange");
    }

    @Bean
    public Binding binding(Queue orderQueue, FanoutExchange orderExchange) {
        return BindingBuilder.bind(orderQueue).to(orderExchange);
    }
}
```

and `application.properties`
```
spring.rabbitmq.host=localhost
spring.rabbitmq.port=15672
spring.rabbitmq.username=guest
spring.rabbitmq.password=guest
```

### Issues with Spring Boot 4.06 and RabbitMQ
Apparently in SpringBoot 4.x, the `spring-boot-starter-amqp` dependency changed and now requires `@RabbitListener` to be present before it actualyl connects and creates the queue/exchange on startup.

So I'm going to try and build the producer first `MessageProducerService` - that uses `RabbitTemplate` (Spring's class for sending messages to RaabbitMQ)

