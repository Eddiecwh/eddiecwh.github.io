---
title: "File Processor - Project Talkthrough & Goal Setting"
date: 2026-08-17
categories: [Backend System Design, File Processor]
tags: [System Design, Backend]
---

***Part 3 of my Backend System Design Learning Series***
<hr>
***Developing a File Processing System to learn how backend systems are built***

[Click here to see the GitHub Repo](https://github.com/Eddiecwh/DataFlow)

<hr>

### Project Talkthrough and Goal Setting

So far, based on the other projects I have worked on the aim of the application has been pretty straightforward, with a pretty definitive list of expected requirements. But when it comes to a File Processing pipeline, I think there's a bit more ambiguity. 

For example: would this be a service where users upload images and get back a url to share it? (Like imgur), or get back thumnails and optimized versions? Or a compressed version? or a document ingestion pipeline that extracts texts from PDFs?

I think this project would be a good oppurtunity to learn AWS/infrastructure concepts like:
- S3 operations
- Predesigned URLs
- Multipart uploads
- Async processing

My first thought of a good example was IMGUR, where people upload images and can share them via a link - but then fitting them into some of our learning goals, perhaps it's not that great of a fit:

Here a few questions Claude prompted me on against my learning goals:

***S3 bucket operations***
<hr>
Q: Why would you use S3 here instead of just storing files on your server's local disk?
<hr>
A: Yeah for something as miniscule and at a small scale, storing images on our server's local disk would make more sense


***Presigned URLs***
<hr>
Q: When would you use these and why? Think about who's accessing the images and what problem presigned URLs solve vs. just serving files through your API.
<hr>
A: A predesigned URL would be a shareable link that is given to a user to share their file. In the case of our URL-shortner, we used a base64 encoder to transform the int value of our URL into a (1-6 alphanumeric) code. And it was instant, because that conversion happens instantenously. With small images, that process would be the same if not similar, so would a predesigned URL really be the best use case here?

Correction here: A predesigned URL is not a shareable link, its a temporary, signed URL that lets aa user interact with s3 directly, bypaassing the server. It has an expiration date and is designed to keep large file transfers off of the API server.

***Multipart uploads***
<hr>
Q: Does this fit naturally? Consider what Imgur actually supports — are users uploading files large enough to justify multipart?
<hr>
A: Again, small files will upload instantly. Is there a valid use caase for multipart uploads?


***Async processing***
<hr>
Q: What work needs to happen after upload that would be slow enough to handle asynchronously?
<hr>
A: Same argument as above

---

So, let's think bigger - let's think of something like DropBox.
Now we're talking size (literally), and I think this fits our use cases a lot better. If we were to upload big files like videos in the GB range, that would take a long time. A predesigned URL would make sense, because we could serve that as a placeholder that our users can share which will hold the file when the upload is complete. 

Async processing and multi-part uploads also make a lot of sense because bigger files will take a lot of time, and our user would not want to sit there throughout and wait for the upload to complete.

I've been a consumer of AWS/S3, but i've never had to set up/manage that data connection

Here are somethings I'm targetting to achieve:

```
→ File upload directly to S3 (presigned URLs)
→ Multiple S3 objects per upload (original + processed variants)
→ S3 event triggers for async processing
→ Multipart upload for large files
→ S3 bucket policies and permissions
```

and some learning goals might include:

```
→ AWS SDK for Java
→ S3 bucket operations (put, get, delete, list)
→ Presigned URLs (temporary access to private files)
→ Async processing with RabbitMQ (worked on this before with our Notifcation Service app)
→ Job status tracking (also covered before, but getting the reps in never hurts)
```

Im wondering if there'll be any space for `CDN caching`. I'm somewhat faamiliar with how it works thereotically, but if I could include it in the project that would give me hands on experience. We'll put it on the backburner for now.

---

## Understanding The Concepts

### Presigned URLs

Thinking a little bit about how presigned URLs work...

2 scenarios:

> A user wants to upload a 1.5GB video to DataFlow, and later their friend wants to download it (assume the owner granted access).

__Upload__: The client wants to put a file in S3. What role does your API play, and what role does the presigned URL play?

__Download__: The friend requests the file. What does your API do, and what does the client do with the presigned URL?

A good analogy from Claude here:

> Think of your API as a bouncer at a club. The bouncer checks `your ID` and decides if you are allowed in. But, the bouncer doesn't `carry you inside`. Our API's job should be to handle `auth` and `URL` generation, not data transfer.

So here's how I think the flow should work:

__Upload__: Our API verifies that our user is authorized, submits a request to S3, and generates a URL to let them know their request has been recieved. The media being uploaded lives on the uploader's machine and never touches the API server.

__Download__: Our API verifies that our user is authorized to access/view this media, then generates a URL to let the user pull the file directly from S3.

The key point here being that our media/any transacations takes place outside of our API. Files are either on the client machine or on S3. Our API facilitates the auth check and the URL generation which contains a cryptographic signature that says:

> Whoever shows up with this URL is allowed to PUT/GET this specific object for the next X amount of time

And it can do that because our API has the AWS credentials

### MultiPart downloads

My understanding of a multipart upload, is a kind of failsafe mechanism for partially completed uploads. For example, like if you're downloading a big file and halfway your internet drops. Without it, you lose your progress and the upload needs to be restarted. 

But how does that actually work in theory? Are there landmarks that are set to dictate how far along progress was, so when the connection picks back up we can pick off where we left off? And how does that implementation actually look like in practice?

Additionally, if all downloading/uploading is handled by s3 - how do multipart uploads play a role with our application?

__Claude: On how multipart upload works in theory:__

> Think about it literally — if you had to move 100 heavy boxes from one building to another, would you rather load all 100 onto one giant truck that either delivers everything or nothing? Or would you send them in 10 smaller trips, tracking which batches arrived?
That's the core idea. A multipart upload breaks a large file into smaller parts, each uploaded independently. S3 tracks which parts have arrived. If part 7 fails, you only re-upload part 7, not the whole file.

2 questions to test my understanding:

> Question 1: There are three stages to a multipart upload — you initiate it, you upload the parts, and then you do something at the end to tell S3 you're done. Why do you think that final step is necessary? What would S3 have without it — just a bunch of disconnected chunks? What does it need to do with them?

> Question 2: This is the really important one you asked — if the client is uploading directly to S3 via presigned URLs and your API never touches the bytes, what role does your API play in coordinating a multipart upload? Think about those three stages I mentioned. Which ones need your API's AWS credentials, and which ones can the client do on its own?

Question 1: 

The final step would be necessary as a sign-off document of kind. To signal that all previous transfers have been completed. If we had 10 seperate parts that uploaded independently, the final step would need to piece them together. The user would want a confirmation that the file is now available

Question 2:
The initation of the upload would require a presigned URL, so the API would need to coordinate that initial handshake. I would assume that each part would use the a different presigned URL, and the final sign-off step would piece together the chunks to return a completed file.

So for a file split into 5 parts
- My API initiates the multipart upload (1)
- My API generates 5 distinct presigned URLs after verifying permissions and generating each part of the upload with our stored AWS creds (5). API handles this internally, no need for interaction with s3
- Client uploads the 5 parts to s3 (5)
- After finishing all 5 uploads, my API sends another confirmation to s3 that the 5 multi-part uploads are completed (1)

Total: 12
```
Client -> API: 7
Client -> s3: 5
```

### To Multi-part or not to Multi Part

Multi part uploads should NOT be hard requirements for every single upload. I can't imagine a multi-part upload making sense for say a `4MB` picture. `AWS` recommends multipart uploads for files `> 100 MB`.

I also don't think we should offer 2 different endpoints to let the Client make the decision on whether the file should be put through a simple upload or a multi-part upload. Although our API will not ever house the actual media being uploaded, it should be aware of the content size and make that decision internally to submit that process through the respective workflow.
