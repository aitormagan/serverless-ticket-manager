'use strict';

console.log('Loading function');

var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = "RegisteredUsers";
const DONATIONS_TABLE = "RegisteredDonations";
const PROPERTIES_TABLE = "Properties";

const INVALID_BACKEND_RESPONSE_ERROR = "INVALID_BACKEND_RESPONSE";
const MISSING_USER_NAME_ERROR = "MISSING_USER_NAME";
const MISSING_USER_NAME_OR_AMOUNT_ERROR = "MISSING_USER_NAME_OR_AMOUNT";
const INVALID_AMOUNT_ERROR = "INVALID_AMOUNT";
const INVALID_ID_FORMAT_ERROR = "INVALID_ID_FORMAT";
const NON_EXISTING_ID_ERROR = "NON_EXISTING_ID";


var generateResponse = function generateResponse(callback, statusCode, body, headers) {
    var finalHeaders = headers || {};
    finalHeaders['Access-Control-Allow-Origin'] = "*";
    callback(null, {
        statusCode: statusCode,
        body: JSON.stringify(body) || null,
        headers: finalHeaders
    });
};

var generateErrorResponse = function generateErrorResponse(callback, statusCode, errorMessage, errorCode, headers) {
    generateResponse(callback, statusCode, {"message": errorMessage, "code": errorCode}, headers);
};

var notImplemented = function notImplemented(event, callback) {
    generateResponse(callback, 501, {"message": "The required method is not already implemented"});
};

// CREATE ITEMS

var createItem = function createItem(nextItemIdKey, tablenName, item, event, callback) {

    var params = {
        "TableName": PROPERTIES_TABLE,
        "Key": {
            "key": nextItemIdKey
        },
        "UpdateExpression": "set val = val + :val",
        "ExpressionAttributeValues": {
            ":val": 1
        },
        "ReturnValues": "UPDATED_OLD"

    };

    docClient.update(params, function(err, data) {

        if (err) {
            console.log("[ERROR][CREATE ITEM] Update Current ItemId:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
        } else {
            var itemId = data.Attributes.val;
            var itemCopy = JSON.parse(JSON.stringify(item));
            itemCopy.id = itemId;

            var paramsInsertUser = {
                "TableName": tablenName,
                "Item": itemCopy
            };

            docClient.put(paramsInsertUser, function(err, data) {
                if (err) {
                    console.log("[ERROR][CREATE ITEM] Insert User:", JSON.stringify(err));
                    generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
                } else {
                    console.log("[INFO][CREATE ITEM] New Item Inserted: ", JSON.stringify(paramsInsertUser.Item));
                    generateResponse(callback, 201, paramsInsertUser.Item, {"Location": event.path + "/" + itemId});
                }
            });
        }
    });
};


var createUser = function(event, callback) {

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson) || parsedJson["username"] === "") {
        generateErrorResponse(callback, 400, "'username' is missing", MISSING_USER_NAME_ERROR);
        return;
    }

    var item = {
        "date": Date.now(),
        "username": parsedJson.username
    };

    createItem("nextUserId", USERS_TABLE, item, event, callback);

};

var createDonation = function(event, callback) {
    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson) || !("amount" in parsedJson) || parsedJson["username"] === "" || parsedJson["amount"] === "") {
        generateErrorResponse(callback, 400, "'username' and/or 'amount' are missing", MISSING_USER_NAME_OR_AMOUNT_ERROR);
        return;
    }

    var amount = parseFloat(parsedJson.amount.replace(",", "."));

    if (isNaN(amount)) {
        generateErrorResponse(callback, 400, "'amount' is not a valid float", INVALID_AMOUNT_ERROR);
        return;
    }

    var item = {
        "date": Date.now(),
        "username": parsedJson.username,
        "amount": amount
    };

    createItem("nextDonationId", DONATIONS_TABLE, item, event, callback);
};

// GET ITEMS

var getAllItems = function getAllItems(tableName, event, callback) {
    var paramsScan = {
        "TableName": tableName,
    };

    var multiplier = event["queryStringParameters"] !== null && "order" in event["queryStringParameters"] && event["queryStringParameters"]["order"] === 'desc' ? -1 : 1;

    docClient.scan(paramsScan, function(err, data) {
        if (err) {
            console.log("[ERROR][GET ALL ITEMS] Get All Items:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
        } else {
            generateResponse(callback, 200, data.Items.sort((a,b) => multiplier * (a.id - b.id)));
        }
    });
};

// GET SINGLE ITEM

var getItem = function getItem(tableName, event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][GET ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid", INVALID_ID_FORMAT_ERROR);
        return;
    }

    var params = {
        "TableName": tableName,
        "Key": {
            "id": id
        }
    };

    docClient.get(params, function(err, data) {
        if (err) {
            console.log("[ERROR][GET ITEM] Get Item:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
        } else if (data.Item) {
            console.log("[INFO][GET ITEM] Returned Item: ", JSON.stringify(data.Item));
            generateResponse(callback, 200, data.Item);
        } else {
            console.log("[WARN][GET ITEM] Non exieting item: ", id);
            generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist", NON_EXISTING_ID_ERROR);
        }
    });
};

// UPDATE ITEM

var updateItem = function updateItem(tableName, updateExpression, updateAttributeValues, event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][DELETE ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid", INVALID_ID_FORMAT_ERROR);
        return;
    }

    var params = {
        "TableName": tableName,
        "Key": {
            "id": id
        },
        "UpdateExpression": updateExpression,
        "ConditionExpression": "attribute_exists(id)",
        "ExpressionAttributeValues": updateAttributeValues,
        "ReturnValues": "ALL_NEW"
    };

    docClient.update(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException") {
                console.log("[WARN][UPDATE ITEM] Non existing item:", id);
                generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist", NON_EXISTING_ID_ERROR);
            } else {
                console.log("[ERROR][UPDATE ITEM] Update Item:", JSON.stringify(err));
                generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
            }
        } else {
            console.log("[INFO][UPDATE ITEM] Updated Item: ", JSON.stringify(data.Attributes));
            generateResponse(callback, 200, data.Attributes);
        }
    });

};

var updateUser = function updateUser(event, callback) {

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson)) {
        generateErrorResponse(callback, 400, "'username' is missing", MISSING_USER_NAME_ERROR);
        return;
    }

    updateItem(USERS_TABLE, "set username = :username", {":username": parsedJson.username}, event, callback);
};

var updateDonation = function updateDonation(event, callback) {

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("username" in parsedJson) || !("amount" in parsedJson)) {
        generateErrorResponse(callback, 400, "'username' and/or 'amount' are missing", MISSING_USER_NAME_OR_AMOUNT_ERROR);
        return;
    }

    var amount = parseFloat(parsedJson.amount);

    if (isNaN(amount)) {
        generateErrorResponse(callback, 400, "'amount' is not a valid float", INVALID_AMOUNT_ERROR);
        return;
    }

    updateItem(DONATIONS_TABLE, "set username = :username, amount = :amount", {":username": parsedJson.username, ":amount": amount}, event, callback);
};

// DELETE ITEM

var deleteItem = function deleteItem(tableName, event, callback) {

    var id = parseInt(event.pathParameters.id);

    if (isNaN(id)) {
        console.log("[WARN][DELETE ITEM] Invalid ID: ", id);
        generateErrorResponse(callback, 400, "The ID '" + event.pathParameters.id + "' is not valid", INVALID_ID_FORMAT_ERROR);
        return;
    }

    var params = {
        "TableName": tableName,
        "Key": {
            "id": id
        },
        "ReturnValues": "ALL_OLD"
    };

    docClient.delete(params, function(err, data) {
        if (err) {
            console.log("[ERROR][DELETE ITEM] Delete Item:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
        } else if (Object.keys(data).length > 0) {
            console.log("[INFO][DELETE ITEM] Deleted Item: ", id);
            generateResponse(callback, 204);
        } else {
            console.log("[WARN][DELETE ITEM] Non existing item: ", id);
            generateErrorResponse(callback, 404, "The ID '" + id + "' does not exist", NON_EXISTING_ID_ERROR);
        }
    });
};

// MAIN CONTROLLER

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var handlers = {
        "/user": {
            "POST": createUser,
            "GET": getAllItems.bind(this, USERS_TABLE)
        },
        "/user/{id}": {
            "GET": getItem.bind(this, USERS_TABLE),
            "DELETE": deleteItem.bind(this, USERS_TABLE),
            "PATCH": updateUser
        },
        "/donation": {
            "POST": createDonation,
            "GET": getAllItems.bind(this, DONATIONS_TABLE)
        },
        "/donation/{id}": {
            "GET": getItem.bind(this, DONATIONS_TABLE),
            "DELETE": deleteItem.bind(this, DONATIONS_TABLE),
            "PATCH": updateDonation
        }
    };

    var handler = event.resource in handlers && event.httpMethod in handlers[event.resource] ? handlers[event.resource][event.httpMethod] : notImplemented;
    handler(event, callback);
};
