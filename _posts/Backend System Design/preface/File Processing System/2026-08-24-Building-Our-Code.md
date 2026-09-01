---
title: "File Processor - Building our Backend"
date: 2026-08-24
categories: [Backend System Design, File Processor]
tags: [System Design, Backend]
---

***Part 3 of my Backend System Design Learning Series***
<hr>
***Developing a File Processing System to learn how backend systems are built***

[Click here to see the GitHub Repo](https://github.com/Eddiecwh/DataFlow)

<hr>

I've been reasoning back and forth with Claude and perhaps `Request` is not the most straight-forward name for our DB entity. `Asset` seems more reasonable as it is  more clear to other developers what this table really represents (the file's details).

***Implementing our Upload workflow ***

I've built out the Repo/Entity layer, so I'm going to tackle our first workflow (Uploading our content) with our service logic making decisions on whether it should be a `simple` upload vs a `multi-part` upload. 

1. Save file metadata to PostgreSQL
2. Decide simple vs. multipart
3. Generate presigned URLs from S3

We can do steps 1 and 2 without setting up our s3 infrastructure/config so let's do that first

Client sends `POST /files/` with filename, filesize and filetype

our service needs to recieve that request body and check the filesize to see which route it needs to take

Simple = < 100 MB
Multipart = > 100 MB

**** Requirements ****

> Method Signature: `public AssetResponseDTO uploadAsset(AssetRequestDTO)`

We'll need 2 DTOs
- AssetRequestDto
- AssetResponseDto
  - SimpleAssetResponseDto
  - MultiPartAssetResponseDto

Our asset entity has a lot of fields that we don't need to reveal to our user. We should just reveal fields that make sense. Our 3 most important ones are filename, filesize and filetype

```
AssetRequestDto
{
  "filename": "something.mp4",
  "filesize" : 1234567,
  "filetype" : "video/mp4"
}
```

```
AssetResponseDto
{
  "fileId" : 1234
}
```

```
SimpleAssetResponseDto
{
  "fileId" : 1234
  "Presigned URL" : asdasd
}
```

```
MultiPartAssetResponseDto
{
  "fileId" : 1234
  "uploadId" : 123
  "Presigned URL(s)" : {
    "1234", "1223"
  },
  "Part Size" : 1000000
  "Number of Parts" : 4
}
```

Im building out 2 different AssetResponseDTO(s) because I dont think it makes sense to return the same fields for both occurences. Why would we need to return multipart info for a file that doesnt go through that upload process? I think it would be more confusing to have multiple blank fields that are for multipart, that are just unused for a simple upload.

So what if we had a generic `AssetResponseDto` and implemented two child subclasses `SimpleResponseDto` and `MultiPartResponseDto` so our logic can decide which DTO to return

```
@Data
@RequiredArgsConstructor
public class AssetResponseDto {
    private Long fileId;
}
```

Now our AssetResponseDto will only hold fields common to both simple and multi part while the fields unique to multi and simple will live in their own classes 

```
@Data
@RequiredArgsConstructor
public class SimpleResponseDto extends AssetResponseDto {
    String presignedUrl;
}
```

```
@Data
@RequiredArgsConstructor
public class MultiPartResponseDto extends AssetResponseDto {
    private Long uploadId;
    private List<String> presignedUrls;
    private Long partSize;
    private int numberOfParts;
}
```

****Upload method pseudo-code****
```
public AssetResponseDto uploadAsset(AssetRequestDto assetRequestDto) {
      /* 
        For now we are not implementing Spring Security, so we will
        manually pass in userId as a path variable. Later on, we will
        take userId after the auth check from security context

        POST /files/{userId}
      */

      // Retrieve user with userId w/getUserById method from userService
      // Look up the user, if the user exists - continue
      
      /* 
        if not, throw a custom UserNotFound exception, but this should be handled
        in the getUserById method, not  here
      */
      

      // create new Asset object
      // set asset object with AssetRequestDto details:
      // from DTO: fileName, fileType, fileSize
      // not from DTO: User, createDt, updateDt

      /* 
        save our Asset Object, so we can persist to the DB
        and have a generated ID that we can use in our response
      */

      // determine multi or simple upload using filesize
      // get assetRequestDto.getFileSize();
      // if filesize > 100 MB initiate multipart
      // if filesize < 100 MB initiate simple upload
  }
```

***Playing around with MapStruct***
For all of my previous projects, I've always manually set my DTOs/mapped my Entity objects. I'm going to explore MapStruct which is a library that allows me to define a Mapper that will automate the field setting for me.

```
@Mapper(componentModel = "spring")
public interface AssetMapper {
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "s3FilePath", ignore = true)
    @Mapping(target = "createdDt", ignore = true)
    @Mapping(target = "updateDt", ignore = true)
    @Mapping(target = "deletedDt", ignore = true)

    public Asset mapRequestToAsset(AssetRequestDto assetRequestDto);
}
```

So what I've done here is I've defined an interface called AssetMapper, which maps our AssetRequestDto to our Asset. 

This is achieved by defining a method which takes the AssetRequestDto as a parameter, and returns an Asset.

Whatever fields match on the AssetRequestDto will be matched to the Asset. The fields that are not present on AssetRequestDto I have used the annotation @Mapping with a target being the fieldName set to ignore, because the mapper will not know how to map the field to Asset since those fields do not exist on the DTO.

The interface uses the `@Mapper` annotation with the parameter `componentModel = "spring"` because I need to register the Mapper class as a spring managed bean, except it's not a class - it's an interface. MapStruct generates an implementation of our AssetMapper, but spring is not aware of it. So with the annotation, we are registering the implementation as a Spring managed Bean so we can inject it whever we need to use it.

**Building our S3 Layer**

```
@Configuration
public class S3Config {
    @Value("${aws.secretKey}")
    String awsSecretKey;

    @Value("${aws.accessKey}")
    String awsAccessKey;

    @Value("${aws.region}")
    String awsRegion;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .credentialsProvider(createCreds())
                .region(Region.of(awsRegion))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .credentialsProvider(createCreds())
                .region(Region.of(awsRegion))
                .build();
    }

    private StaticCredentialsProvider createCreds() {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(awsAccessKey, awsSecretKey));
    }
}
```

First time poking around in S3, in an environment that is not preconfigured for me (I accidentally signed up for a paid plan, and had to open a support ticket to get it reverted lol...)

I've built out our `S3 config` file and have registered 2 beans, one for the s3 client, and one for our s3Presigner. Simple builder methods with credentials from the user I created tied to the us-east-1 region, set dynamically in our env variables.

Also extracting our credentialsProvider to a seperate helper method to clean up the a code a lil'

**Testing The Simple File Upload workflow**

I ran into an issue with my mapStruct depdencies. Apparently MapStruct and Lombok don't play well together.

MapStruct  needs two dependencies
- the core library
- the anotation processor
  - this generates the implementation classes that Spring instantiates as a bean

Using both Lombok and MapStruct, there's a conflict because they are both annotation processors, so the fix was to explicitly configure the `annotationProcessorPaths` for `maven-compiler-plugin` in the right order:

```
<annotationProcessorPaths>
    <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.46</version>
    </path>
    <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok-mapstruct-binding</artifactId>
        <version>0.2.0</version>
    </path>
    <path>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct-processor</artifactId>
        <version>1.6.3</version>
    </path>
</annotationProcessorPaths>
```

Testing the simple upload workflow:

```
POST http://localhost:8080/files/1

Request Body: {
    "fileName" : "test.mp4",
    "fileType" : "video/mp4",
    "fileSize" : 100000
}

Response: {
    "fileId": 1,
    "presignedUrl": "https://dataflow-uploads.s3.amazonaws.com/files/1/original/test.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260826T194557Z&X-Amz-SignedHeaders=host&X-Amz-Credential=AKIAWKT3BWBDQ5DY3ELB%2F20260826%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=86400&X-Amz-Signature=8e396aa4bc11fc6a4770da6258d6b929ed20a2d7186a688e394954c5706db805"
}
```

Breaking down the headers:

- We have our key (file path in s3), s3 actually reflects keys as a directory - but in reality it's just keys and the value is the file
- Algorithm
- Date
- Signed Headers
- Amazon Creds
- Server
- Expiry Date
- Signature

Now trying to upload a file with a `PUT` call to that presigned URL

<img src="../assets/img/figures/system-design/file-processor/postman-fileupload.png" alt="query-1.png" style="width: 100%">

File uploaded succesfully onto s3, but I'll need to find a way to upload the correct file meta data. As of now, it takes my RequestBody as the sole source of truth, so filenames might not be accurate to the actual filename. Same for file size and file type. As you can see the uploaded file was a `.jpg` but I had it set as a `video/mp4` and that's what it's set as in `s3`

<img src="../assets/img/figures/system-design/file-processor/s3-fileupload.png" alt="query-1.png" style="width: 100%">

(This was the picture I uploaded, shoutout to my old Interop team - I miss ya'll)

<img src="../assets/img/figures/system-design/file-processor/team-pic.png" alt="query-1.png" style="width: 100%">



