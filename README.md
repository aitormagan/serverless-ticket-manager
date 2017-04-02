# Serverless Ticket Manager
A sample Ticket Manager built using the Serverless capabilities offered by AWS (S3 + API GateWay + DynamoDB + Lambda)

* API GateWay has been used to defined the API structure. 
* API GateWay bypass all the requests to a lambda function that processes them and returns an appropiate response.
* Lambda function uses DynamoDB to manage tickets information (users and times).
* A HTML/JS frontend deployed in S3 allow final users to manage tickets in a simple way. This frontend checks the API using AJAX requests. 

## DynamoDB Definitions

### Table "Properties":
* HashKey: key - String

Items: {key: "nextUserId", "val": 1}

### Table "RegisteredUsers": 
* Hashkey: id - Number
