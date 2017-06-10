"use_strict";

const USER_TOKENS_TABLE = "UserTokens";

var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();

var generatePolicy = function(principalId, effect, resource) {
    var authResponse = {};
    
    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {};
        policyDocument.Version = "2012-10-17"; // default version
        policyDocument.Statement = [];
        var statementOne = {};
        statementOne.Action = "execute-api:Invoke"; // default action
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    
    // Can optionally return a context object of your choosing.
    authResponse.context = {};
    authResponse.context.stringKey = "stringval";
    authResponse.context.numberKey = 123;
    authResponse.context.booleanKey = true;
    return authResponse;
};

exports.handler =  (event, context, callback) => {

    var params = {
        "TableName": USER_TOKENS_TABLE,
        "Key": {
            "token": event.authorizationToken
        }
    };

    docClient.get(params, function(err, data) {
        if (err) {
            console.log("[ERROR][AUTHORIZER] Error Accessing DynamoDB:", JSON.stringify(err));
            callback("Error: Invalid Response from the backend");
        } else if (data.Item) {
            callback(null, generatePolicy("user", "Allow", event.methodArn));
        } else {
            callback("Unauthorized");   // Return a 401 Unauthorized response
        }
    });
};