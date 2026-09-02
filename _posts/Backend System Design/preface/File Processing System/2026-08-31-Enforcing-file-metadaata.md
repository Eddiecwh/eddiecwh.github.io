---
title: "File Processor - Multipart Upload Workflow and Enforcing File Metadata"
date: 2026-08-31
categories: [Backend System Design, File Processor]
tags: [System Design, Backend]
---

***Part 3 of my Backend System Design Learning Series***
<hr>
***Developing a File Processing System to learn how backend systems are built***

[Click here to see the GitHub Repo](https://github.com/Eddiecwh/DataFlow)

<hr>

## Forcing a check on supplied meta data ##

Currently, when we upload a file to S3 - our API never touches the file. We take a requestBody that defines the files metadata and submits that request to s3.

So filename, filesize and filetype all come from the requestBody and that's our single source of truth. So because I started the initial request with this requestBody:

```
{
    "fileName" : "test.mp4",
    "fileType" : "video/mp4",
    "fileSize" : 100000
}
```

This was the metadata associated with that upload, eventhough the `.PNG` file I uploaded had none of thata data. Which means if I were to upload a 10GB video file, that would go through the simple upload route, because our service logic takes the filesize from the request body and not the actual file.

Since we're posting the image through postman, we don't have functionality like from a browser that can read the metadata/MIME type automatically. 

For now, I'm gonna modify the putObjectRequest variable to enforce a `contentType`, so if it doesnt match the filetype that's uploaded, S3 should return a `403 SignatureDoesNotMatch` error.

```
String presignedUrl = s3Service.generatePresignedUrl(savedAsset.getId(),
                    assetRequestDto.getFileName(), 
                    assetRequestDto.getFileType());

public String generatePresignedUrl(Long assetId, String fileName, String fileType) {
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(s3Bucket)
                .contentType(fileType)
                .key("files/" + assetId + "/original/" + fileName)
                .build();

        PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(PutObjectPresignRequest.builder()
                .putObjectRequest(putObjectRequest)
                .signatureDuration(Duration.ofDays(1))
                .build()
        );

        return presignedPutObjectRequest.url().toString();
    }
```

For the filesize issue, Claude recommends I look into `presigned URL conditions` or `presigned POST policies`. S3 let's use set content-length-range conditions that S3 itself enforces server-side. IT won't be able to bypass it because S3 checks the actual bytes recieved. I'll look into this more later - after we've built out the multipart workload.

## Building out our MultiPart Upload workflow ##

<hr>

1. Initiate the multipart upload with S3 → get an uploadId
2. Generate presigned URLs for each part
3. Return the MultiPartResponseDto with uploadId, presigned URLs, part size, number of parts

<img src="../assets/img/figures/system-design/file-processor/multipart-uploaad.png" alt="query-1.png" style="width: 100%">

I've built out our multi-part upload workflow, and postman is returning our DTO with all our components:
- partSize
- number of parts
- upload id
- file id
- list of presigned URLs

Hard to test this currently, because I don't have any frontend logic to break the file down into the required number of parts, but also because I dont have the final piece of the puzzle. 

After all parts of the multi-part upload have completed, we need to call this endpoint `PUT /files/{fileId}` to mark the multipart upload as complete, and assemble the parts into one object. 

<hr>

### ETags generated from s3 ###

We didn't have to worry about this for simple uploads, but for multi part uploads when we PUT a part to a presigned URL, S3 sends back a response header caalled ETag which is a hash that uniquely identifies each part (kind of like a reciept). 

When we assemble all the parts, S# needs each part number paired with its' ETag to verify that each part came intact and int he right order.

Request Body for `PUT /files/{fileId}`
```
{
    "uploadId": "abc123",
    "parts": [
        { "partNumber": 1, "eTag": "etag1" },
        { "partNumber": 2, "eTag": "etag2" }
    ]
}
```

I've built 2 DTOs to take from the user:

```
@Data
@Builder
public class MultiPartConfirmationRequestDto {
    private String uploadId;
    private List<Part> parts;
}
```

```
@Data
public class Part {
    private int partNumber;
    private String eTag;
}
```

Then within the S3Service class, I have created a method to build a `completeMultipartUploadRequest` that we will pass to the `completeMultiPartUpload` in the `completeMultiPartUpload` method in `s3Client`

Just wanted to rant a little bit how tedious it is define all these objects, that subsequently get passed into the next thing in order to build the thing that we need. Not a joke when people say Java is so syntax heavy lol

```
public void completeMultiPartUpload(String uploadId, List<Part> partsList, String fileName, Long assetId) {
        List<CompletedPart> completedPartList = partsList.stream()
                .map(part -> CompletedPart.builder()
                        .partNumber(part.getPartNumber())
                        .eTag(part.getETag())
                        .build())
                .toList();

        CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder()
                .parts(completedPartList)
                .build();

        CompleteMultipartUploadRequest completeMultipartUploadRequest = CompleteMultipartUploadRequest.builder()
                        .uploadId(uploadId)
                .multipartUpload(completedMultipartUpload)
                .bucket(s3Bucket)
                .key(getS3Key(assetId, fileName))
                .build();

        s3Client.completeMultipartUpload(completeMultipartUploadRequest);
    }
```

1. Using streams to break down our Parts list that's built off of our DTO into the input class `Part` that's provided by the `aws sdk`

2. Then passing that to the `CompletedMultipartUpload` builder

3. Which we then pass to a `CompleteMultipartUploadRequest` builder

4. And then we pass that to S3Client's `completeMultipartUpload` method. 

Gosh what a mouthful lol

I think my next goal here is to have Claude assist in coding me up a UI to test this workflow and handle breaking down the file into parts, so we can fully test this multipart upload. Then we can get started on the download workflows

Exciting!

<hr>

## Testing the MultiPart Workflow ##

For testing purposes, I have had Claude code up a simple `.html` page that breaks down the file if > 100 MB into 100 MB chunks for the multipart workflow.

> Full disclaimer, I did not write up the frontend - but I am checking through the code with my to ensure that the logic is sound and is performing it's required responsibilities.

[You can view the sourceCode for the test page here](https://github.com/Eddiecwh/DataFlow/blob/main/index.html)

After selecting a file, we are dynamically grabbing the filename, size and type from the file - which is great considering the meta data issue we were having before.

our `startUpload()` method then calls our `POST /files/{userId}` endpoint and store the initial result. If the data returned contains :
- a singular presignedUrl
  - an asynchronous method call to `doSimpleUpload()` is called
- multiple presignedUrls
  - async method call to `doMultipartUpload`

## Chunking the multipart file ##

Based on the numberOfParts that we return from the multiPartResponseDto, we are slicing each part of the file into chunks that are submitted to s3 individually via `PUT` to each individual `presignedUrl` with the file chunk as the requestBody.

If the response is succesful, we grab the Etag and the partNumber and store them into a parts object.

Once the multipart upload is complete, we call our `PUT /files/{fileId}` endpoint to submit the confirmation upload receipt passing along the `uploadId` and all of our `parts`

<img src="../assets/img/figures/system-design/file-processor/ui-upload.png" alt="query-1.png" style="width: 100%">

<img src="../assets/img/figures/system-design/file-processor/s3-upload.png" alt="query-1.png" style="width: 100%">

## Some Issues I Ran Into ##

<hr>

### CORS Errors ###

So naturally, my springboot backend is blocking my HTML page from accessing my endpoints. Fixed it with a simple `@CrossOrigin` annotation in my controller. For testing purposes this is fine, no need for custom config since I'm just working on it locally for now, allow all origins, all headers, standard methods - send it all! hahaha

Additionally, within my S3 Bucket, I have to define permissions for CORS as well, specifically for the methods, origins and headers that I am passing through:

```
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

<hr>

### @AllArgsConstructor and @NoArgsConstructor in parallel with @Builder ###

So previously on my `MultiPartConfirmationRequestDto` I was getting this error:

```
tools.jackson.databind.exc.InvalidDefinitionException: Cannot construct instance of com.eddiecwh.DataFlow.dto.MultiPartConfirmationRequestDto (no Creators, like default constructor, exist): cannot deserialize from Object value (no delegate- or property-based Creator)
 at [Source: REDACTED (StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION disabled); byte offset: #1]
```

I had no lombok annotations for constructors, so I couldn't generate a `MultiPartResponseDto`

> But doesn't @Builder generate an all-args constructor?

So I found out the way it works is that `@Builder` generates an `all-args` constructor and makes it `package-private`, which hides the no-args constructor.So in order for it to work, I need to define both an `@AllArgsConstructor` and a `@NoArgsConstructor`.

I thought I would have to define that on all `Dtos` but Claude explains that it's only when im using `@Builder`

- `@NoArgsConstructor` to reveal the hidden constuctor that @Builder hides
- `@AllArgsConstructor` to keep @Builder working

```
For response DTOs where you're only building them in code (not deserializing from JSON), @Builder alone is fine — Jackson serializes from objects using getters, which doesn't need a constructor.

So: request DTOs that come from @RequestBody → add @NoArgsConstructor and @AllArgsConstructor. Response DTOs you only build in your service → @Builder is enough.
```


