'use strict';

console.log('Loading function');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

var generateResponse = function generateResponse(callback, statusCode, body, headers) {
    var finalHeaders = headers || {};
    finalHeaders['Access-Control-Allow-Origin'] = "*";
    callback(null, {
        statusCode: statusCode,
        body: JSON.stringify(body) || null,
        headers: finalHeaders
    });
};

var generateErrorResponse = function generateErrorResponse(callback, statusCode, errorMessage, headers) {
    generateResponse(callback, statusCode, {"message": errorMessage}, headers);
};

var notImplemented = function notImplemented(event, callback) {
    generateResponse(callback, 501, {"message": "The required method is not already implemented"});
};

var createItem = function createItem(event, callback) {

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson)) {
        generateErrorResponse(callback, 400, "'username' is missing");
        return;
    }

    var params = {
        "TableName": "Properties",
        "Key": {
            "key": "nextUserId"
        }
    };

    docClient.get(params, function(err, data) {

        if (err) {
            console.log("[ERROR][CREATE ITEM] Get Current ItemId:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend");
        } else {
            var itemId = data.Item.val;

            var paramsInsertUser = {
                "TableName": "RegisteredUsers",
                "Item": {
                    "id": itemId,
                    "date": Date.now(),
                    "username": parsedJson.username
                }
            };

            docClient.put(paramsInsertUser, function(err, data) {
                if (err) {
                    console.log("[ERROR][CREATE ITEM] Insert User:", JSON.stringify(err));
                    generateErrorResponse(callback, 500, "Invalid Response from the backend");
                } else {
                    var paramsUpdateNextItemId = {
                        "TableName": "Properties",
                        "Key": {
                            "key": "nextUserId"
                        },
                        "UpdateExpression": "set val = val + :val",
                        "ExpressionAttributeValues": {
                            ":val": 1
                        },
                        "ReturnValues": "UPDATED_NEW"
                    };

                    docClient.update(paramsUpdateNextItemId, function(err, data) {
                        if (err) {
                            console.log("[ERROR][CREATE ITEM] Update Next Item ID:", JSON.stringify(err));
                            generateErrorResponse(callback, 500, "Invalid Response from the backend");
                        } else {
                            console.log("[INFO][CREATE ITEM] New Item Inserted: ", JSON.stringify(paramsInsertUser.Item));
                            generateResponse(callback, 201, paramsInsertUser.Item, {"Location": event.path + "/" + itemId});
                        }
                    });
                }
            });

        }
    });
};

var getAllItems = function getAllItems(event, callback) {
    var paramsScan = {
        "TableName": "RegisteredUsers",
    };

    docClient.scan(paramsScan, function(err, data) {
        if (err) {
            console.log("[ERROR][GET ALL ITEMS] Get All Items:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend");
        } else {
            generateResponse(callback, 200, data.Items.sort((a,b) => a.id - b.id));
        }
    });
};

var getItem = function getItem(event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][GET ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid");
        return;
    }

    var params = {
        "TableName": "RegisteredUsers",
        "Key": {
            "id": id
        }
    };

    docClient.get(params, function(err, data) {
        if (err) {
            console.log("[ERROR][GET ITEM] Get Item:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend");
        } else if (data.Item) {
            console.log("[INFO][GET ITEM] Returned Item: ", JSON.stringify(data.Item));
            generateResponse(callback, 200, data.Item);
        } else {
            console.log("[WARN][GET ITEM] Non exieting item: ", id);
            generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist");
        }
    });
};

var updateItem = function updateItem(event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][DELETE ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid");
        return;
    }

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson)) {
        generateErrorResponse(callback, 400, "'username' is missing");
        return;
    }

    var params = {
        "TableName": "RegisteredUsers",
        "Key": {
            "id": id
        },
        "UpdateExpression": "set username = :username",
        "ConditionExpression": "attribute_exists(id)",
        "ExpressionAttributeValues": {
            ":username": parsedJson.username
        },
        "ReturnValues": "ALL_NEW"
    };

    docClient.update(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException") {
                console.log("[WARN][UPDATE ITEM] Non existing item:", id);
                generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist");
            } else {
                console.log("[ERROR][UPDATE ITEM] Update Item:", JSON.stringify(err));
                generateErrorResponse(callback, 500, "Invalid Response from the backend");
            }
        } else {
            console.log("[INFO][UPDATE ITEM] Updated Item: ", JSON.stringify(data.Attributes));
            generateResponse(callback, 200, data.Attributes);
        }
    });

};

var deleteItem = function deleteItem(event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][DELETE ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid");
        return;
    }

    var params = {
        "TableName": "RegisteredUsers",
        "Key": {
            "id": id
        },
        "ReturnValues": "ALL_OLD"
    };

    docClient.delete(params, function(err, data) {
        if (err) {
            console.log("[ERROR][DELETE ITEM] Delete Item:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend");
        } else if (Object.keys(data).length > 0) {
            console.log("[INFO][DELETE ITEM] Deleted Item: ", id);
            generateResponse(callback, 204);
        } else {
            console.log("[WARN][DELETE ITEM] Non existing item: ", id);
            generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist");
        }
    });
};

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var handlers = {
        "/user": {
            "POST": createItem,
            "GET": getAllItems
        },
        "/user/{id}": {
            "GET": getItem,
            "DELETE": deleteItem,
            "PATCH": updateItem
        }
    };

    var handler = event.resource in handlers && event.httpMethod in handlers[event.resource] ? handlers[event.resource][event.httpMethod] : notImplemented;
    handler(event, callback);
};
