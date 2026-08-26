---
title: "File Processor - Design and Planning"
date: 2026-08-19
categories: [Backend System Design, File Processor]
tags: [System Design, Backend]
---

***Part 3 of my Backend System Design Learning Series***
<hr>
***Developing a File Processing System to learn how backend systems are built***

[Click here to see the GitHub Repo](https://github.com/Eddiecwh/DataFlow)

<hr>

### Design and Planning

Okay now that we have our theory covered, let's talk a little about design.

- API Layer - what should it manage?
- Storage - what lives where?
- Async Processing - what happens after upload, how do we trigger it?
- How does our user know when the file is ready?

#### API Layer

Here are some things that our API layer should manage:

- Auth comparisons against AWS creds
- Issuing presigned URLs based on the above ^
- Decision Logic for simple upload/multi part upload
- Providing Initial transfer check
- Providing completed transfer check
- Providing endpoints for Upload/Download/Viewing/Editing

Things that are our API layer should NOT manage:
- Storing the uploaded/downloaded media

#### Storage

| API Layer | S3/Data Store |
| ---       | ---           |
| Content meta-data | Uploaded/Downloaded file |
| AWS creds |        |

#### Async Processing
Asynchronous processing should be triggered when a file is deemed fit for a multipart upload. If the file download/upload is above 100 MB and will not complete in a quick time period, the API should return a processing... status to the user with a 200 status code while triggering an asynchronous workflow where the file upload/download will be triggered in s3

Correction: I'm tying async processing to multi-part uploads, but it should be more in the realm of processing in regards to the file.

> Think about what Dropbox does after you upload a video. Think about what YouTube does. What work happens after the bytes land in S3 that would be too slow to make the user wait for?

##### Thumbnail generation
- We could generate a small preview image for every uploaded file. We create additional assets based off of our media to present a preview for the user

##### Multiple Quality Variants
- Videos for example, we can pre-generate multiple versions after the upload is complete, 1080p, 720, 480, 360 etc.. YouTube does this, in a process called `transcoding`

##### Compression
- For extremely large videos, we can compress the quality of the video so that it doesn't take up way too much space

### How will the user know that processing is done?
The API should return an immediate status code on the result of the initial transfer state, (for e.g 200 if the process has started). But in regards to the completion of the overarching process, what would be a good way to follow up after the initial success?

In our `Notifcation Service` project, we used `RabbitMQ` to decouple producers from consumers. The process of creating a request for a notification was seperate from the job service that handled processing that request and queueing the notifcation for delivery. In the same way, for our file processing project, we can decouple the file transfer initiation from the processing service and promptly record delivery status'

But in the `Notification Service` project, our API handled the delivery and processing of the notifications - here S3 is doing that. 

Two ways of dealing with this:

##### The Client tells our API on succesful transfer
- PROs
  - Less depdendency on S3, client driven
- CONs
  - Puts a hard dependency on the client to update delivery status which is unreliable

##### S3 tells our API on succesful transfer
- PROs
  - Definitive answer on the status of the transfer
  - Happens immediately on success/failure
- CONs
  - More overhead on S3, not sure if there is a API limit (cost inducing, not sure because I've never built integrations with S3)

Good to know this regarding S3:

> AWS built this exact feature into S3. It's called S3 Event Notifications. You configure your S3 bucket to automatically emit an event whenever an object is created, deleted, etc.

#### Where does s3 send that event?
Thinking about the AWS services that I know/have heard off, I know that there is a message service they use - I believe it's Amazon SQS? (simple queue service). This would drop a message directly onto a queue that our async workers are already listening to, and since we have this, we might just be able to replace RabbitMQ completely.

I'm thinking through 3 different paths we could take:

#### One queue with one worker that does everything sequentially

<img src="../assets/img/figures/system-design/file-processor/diagram1.png" alt="query-1.png" style="width: 100%">

Pros: One queue handles all the responsibility, easy to maintain business logic

Cons: 1 Queue handles all responsibility, which is incredibly burdensome. An failure point for one of the 3 responsibilities might lead to cascading failures for all jobs even if 2/3 completed succesfully. Additionally, if thumbnail generation takes 2 seconds, but transcoding takes 10 minutes, it would get hung up on a certain task while others are still waiting for a worker to free up and process them. Not efficient

#### One queue with a worker that fans out to sub-tasks
<img src="../assets/img/figures/system-design/file-processor/diagram2.png" alt="query-1.png" style="width: 100%">

Pros: More efficient, we have a dedicated queue that distributes sub tasks based on the task type. 

Cons: Unessacary middle step, when we can directly bind queues directly to their responsibility type.

#### Multiple queues, one per job type
<img src="../assets/img/figures/system-design/file-processor/diagram3.png" alt="query-1.png" style="width: 100%">

Pros: Compromise between the 1st and 2nd option, we have dedicated queues for each responsibility. Certain tasks might require more time than others, so we can individually scale the number of workers for a certain task such that items in that queue are processed faster. For failures, we can also pinpoint the source of the failure easier. Makes observability more clear and consice.

Cons: More formal definition of routes and slightly more complicated architecture.

### Handling The Distribution of Events -> Queues
S3 Event Notifications fire a singular even when a file lands. With our current workflow, we need to take that 1 event and distribute it to the 3 queues that will process it downstream. Since we are using Amazon SQS, we need a replacement for Exchanges in RabbitMQ that route messages to multiple queues.

Google says that the service that amazon has for fan-ing out messages to their respective queues is called `SNS topic`. It sits between the S3 event and Amazon SQS to fan out the messages to the appropriate queues

#### Multiple queues, one per job type
<img src="../assets/img/figures/system-design/file-processor/diagram4.png" alt="query-1.png" style="width: 100%">

### Planning Out the Upload/Download Workflow
<img src="../assets/img/figures/system-design/file-processor/diagram5.png" alt="query-1.png" style="width: 100%">

For the workflow, I've defined `API`, `user`, and `S3` to ensure that the ownership of that responsibility is with the respective party.
For e.g, the API doesnt initiate the transfer of a file to s3, it simply generates a presigned URL that the `user` uses to start the upload/download

- The `user` makes a request to our API to upload a file
- Our `API` checks the DB to see if the `user` has access to upload a document
- If yes, the workflow proceeds. If not, a 403 Unauthorized error is thrown
- Our `API` stores the request with the metadata of the file (request metadata design later)
- Our `API` generates a presigned URL and the `user` initiates the transfer to `S3`
- Depending on the size of the file, either a `simple upload` or a `multipart upload` is triggered (multipart if > 100 MB)

If it is a multipart upload:
- The client's upload will be split into batches (depending on the file size)
- Our `API` generates a presigned URL for each batch that is being transferred
- After each batch has been sent, our `API` sends a confirmation message to `S3` and `S3` begins to piece together the batches

If it is a simple upload:
- The client's uploaad is uploaded to `S3`
- Our `API` generates a presigned URL for this single upload

Once the file has been uploaded, it is stored in s3 under the directory:

```
files/{fileId}/original/filename
```

Once `S3` has verified that the upload is completed, it triggers an event that `SNS Topic` picks up
- `SNS Topic` fans out the the event to each of the 3 queues:
  - Thumbnail Generation
  - Transcoding
  - Compression
- A configurable amount of workers for each queue will then pickup the job and handle the subtasks
- Once completed, the files will be stored in the same file directory under their respective sub-dirs

```
files/{fileId}/thumbnails/thumb.jpg
files/{fileId}/variants/720p.mp4
files/{fileId}/variants/480p.mp4
```

- The workers will then update the job status directly in our database marking the job as `Completed` or `Failed`

### Designing the Request Data Entity

|request|
|---|
|id (PK)| int |
|user_id (FK) | int |
|filename| varchar |
|filesize| bigint |
|filetype| varchar |
|s3_file_path| varchar |
|create_dt|datetime|
|update_dt|datetime|
|deleted_at|datetime|

|jobs|
|---|
|id (PK)| int |
|request_id (FK)| int|
|job_type| varchar (enums in Java) |
|job_status| varchar (enums in Java) |
|create_dt|datetime|
|update_dt|datetime|

|users|
|---|
|id (PK) | int |
| username | varchar |
| password_hash | varchar |
| create_dt | datetime |
| update_dt | datetime |

### API Endpoints
```
POST   /files/                      — initiate upload
PUT    /files/{fileId}              — update file (complete upload)
GET    /files/{fileId}              — download a file
GET    /files/                      — list user's files
DELETE /files/{fileId}              — delete a file (soft delete)
GET    /files/{fileId}/jobs         — get all job statuses
GET    /files/{fileId}/jobs?type=   — get specific job status
```
### POST /files Request Body and Response
```
{
  "filename": "video.mp4",
  "filetype": "video/mp4",
  "size" : 29884416
}
```

If not succesfully initiated:
```
Error 401 (Unauthorized)
Error 400 (For bad request Body)
```

If succesfully initiated:
```
Array of presigned URLs
- Only 1 if simple upload < 100 MB
- 1 presigned URL per 100 MB
- Upload ID
- No. of parts
- Part size
- FileId
```

### GET /files/{fileId} Parameter Specification and Response

```
GET /files/{fileId}?type=thumbnail
GET /files/{fileId}?type=original
GET /files/{fileId}?type=transcoded&size=720p
GET /files/{fileId}?type=transcoded&size=480p
GET /files/{fileId}?type=transcoded&size=360p

```
If not succesfully initiated:
```
Error 401 (Unauthorized)
Error 400 (For bad request Body)
```

If succesfully initiated:
```
{
  "fileId": "abc123",
  "variant": "720p",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600
}
```









