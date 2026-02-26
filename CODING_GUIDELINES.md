# Coding Guidelines

## General Best Practices

### API Configuration

- While configuring API urls, only use the API URL (without URI) in `config.url`. Don't use API (URI) calls in the variable.

### Code Documentation

- Have comments in your code. Comments should be brief and concise to explain what is being done.
- **Title**: Each file should have a title comment, giving a brief description of what this file does.

### Architecture

- Abstraction for DB and API connections.
- Function names should be self explanatory.
- Don't create too many functions.

### Exception Handling

- Exception handling at every external connection or possibility of failure.
- Assume every external call will fail and handle it accordingly. API/DB (Exceptions as well as logic should be built to deal with connection failures).
- For external API calls, have keepalive & timeouts to ensure threads are not waiting forever for response in case of an issue on the other side.

### Logging Standards

- Log information instead of just dumping exceptions. In case of exception, give some error message (should include the function and class name which has failed) along with the exception.
- **Support log levels**: Logging should support log levels of INFO, ERROR and DEBUG with the ability to enable/disable each level from the config file. (DEBUG should include detailed contents of all the activity and its data in each step).
- **Do not put sensitive information** (password, keys, secrets, etc.) in logs.
- **Support log destinations**: A parameter in the config file to set the destination of logs, it can be console or a file on the local system.

### Code Organization

- Standardized spacing in the code.
- Do not store credentials/keys/secrets in code. Keep them in configurable environments.
- Don't hardcode values in the code. Instead use variables. For example: Timeouts/keepalives, Values of external sites data (language id and status id for Judge0).

## Performance Optimization

### Database

- Reduce DB calls. Wherever possible cache data, optimize logic to reduce DB calls.
- Cache invalidation should be done whenever data is modified/deleted.
- Cached data should have appropriate expiry times.
- When doing joins in DB query, always mention the table name while using the columns. (eg: if you want the status column of the problem table, use it as `problem.status` instead of just `status`. This will ensure that things don't break if we add new columns in future.)

### Frontend Storage

- Make use of client side storage (session and local).

### JavaScript/Node.js Performance

- Prefer using `int` instead of strings if possible. (faster compare)
- Strictly define arguments of a function to avoid optional params.
- Define interfaces for object input avoid optional fields. (better engine performance as object shape is presumed by engine)
- In arrays, use imperative loops instead of functional loops (map, filter, reduce) (less memory taken)
- Use direct access (store child value in a separate variable) instead of nested access for object when using the same object child value repeatedly in a loop.
- Retrieve smallest amount of data possible (L1, L2, L3, RAM)
- Iterate object values directly instead of fetching each of them by key.
- Use data structures wherever possible.

**Reference**: [Adam Wathan's Performance Tweet](https://twitter.com/adamwathan/status/1773668592325722362?t=80VUCkMvF0F4TTo-86d8og&s=19)

## API Development

### Response Standards

- HTTP response codes should follow the International guidelines - [MDN HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- **API's response**: Instead of simply dumping the output from ORM, format the output properly in json before sending. Make sure to remove unnecessary fields (eg: createdAt, updatedAt, other filters/fields, etc. if not needed)

## Frontend Guidelines

### Styling

- **Do NOT use gradient colors** in the UI. Use solid colors with appropriate opacity instead.
- Maintain consistent color palette across the application.
- Use border colors with opacity to create visual hierarchy.

## API Documentation Guidelines

### Documentation Format

#### Example 1: Registration

**Authentication**: Yes  
**Method**: POST  
**Endpoint**: `/api/firebase/register/mobile`  
**Parameters**: None

**Payload (json)**:

```json
{
    "email": "abc@gmail.com",
    "deviceToken": "123abdkcb$wiwe"
}
```

**Headers**:

```
Key: Google-Token
Value: Complete "credential" object in json format.
```

**Responses**:

- `400` - Invalid payload (email, token missing).
- `401` - Unauthorized user. Register on mentorpick.com
- `500` - Internal server error. Please retry later or contact admin.
- `200` - Device registration successful

---

#### Example 2: Fetch Notification History

**Authentication**: Yes  
**Method**: GET  
**Endpoint**: `/api/firebase/mobile/fetch/notification/history`  
**Payload**: None  
**Parameters**: `?deviceToken=<DEVICETOKEN>`

**Headers**:

```
Key: Google-Token
Value: Complete "credential" object in json format.
```

**Responses (Codes)**:

- `400` - Invalid payload (token missing).
- `401` - Device Token not found.
- `500` - Internal server error. Please retry later or contact admin.
- `200` - Success

**Response (Data is list of notifications sent in last 30 days)**:

```json
{
    "message": [
        {
            "title": "Hello World",
            "body": "Hello World",
            "timestamp": "IST time of message"
        },
        {
            "title": "Hello World2",
            "body": "Hello World2",
            "timestamp": "IST time of message"
        }
    ]
}
```

---

## Summary

Following these guidelines ensures:

- Clean, maintainable code
- Better performance and optimization
- Consistent error handling and logging
- Secure credentials management
- Standardized API documentation
- Consistent UI/UX with solid color palette
