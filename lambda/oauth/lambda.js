"use_strict";

var request = require("request");
var uuid = require("uuid");

const CLIENT_ID = "GOOGLE_CLIENT_ID";
const CLIENT_SECRET = "GOOGLE_CLIENT_SECRET";
const CALLBACK_URL = "https://API_ID.execute-api.eu-central-1.amazonaws.com/DEV/auth/callback";
const S3_WEBSITE_URL = "http://BUCKET_ID.s3-website.eu-central-1.amazonaws.com/";

const PROPERTIES_TABLE = "Properties";
const USER_TOKENS_TABLE = "UserTokens";

const AUTH_USERS_HASH_KEY = "authUsers"

const INVALID_OAUTH2_RESPONSE_ERROR = "INVALID_OAUTH2_RESPONSE";
const PERMISSION_DENIED_ERROR = "PERMISSION_DENIED";
const INVALID_BACKEND_RESPONSE_ERROR = "INVALID_BACKEND_RESPONSE";
const NOT_AUTHORIZED_EMAIL_ERROR = "NOT_AUTHORIZED_EMAIL";
const AUTHORIZATION_NOT_INCLUDED_ERROR = "AHTORIZATION_NOT_INCLUDED";
const INVALID_AUTHORIZATION_ERROR = "INVALID_AUTHORIZATION";
const MISSING_MAIL_ERROR = "MISSING_MAIL";
const EMAIL_ALREADY_REGISTERED_ERROR = "EMAIL_ALREADY_REGISTERED";

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

var generateErrorResponse = function generateErrorResponse(callback, statusCode, errorMessage, errorCode, headers) {
    generateResponse(callback, statusCode, {"message": errorMessage, "code": errorCode}, headers);
};

// INIT LOGIN

var getOAuth2URL = function getOAuth2URL() {
    return "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + CLIENT_ID + "&response_type=code&scope=email&redirect_uri=" + 
            encodeURIComponent(CALLBACK_URL);
};

var login = function login(event, callback) {
    generateResponse(callback, 302, null, {
        Location: getOAuth2URL()
    });
};

// CALLBACK

var redirectToFront = function redirectToFront(callback, token, error) {

    var queryParams = token ? "token=" + token : "error=" + error;

    generateResponse(callback, 302, null, {
        "Location": S3_WEBSITE_URL + "?" + queryParams
    });

};

var getPOSTContent = function getPOSTContent(event) {
    return {
        code: event.queryStringParameters.code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: CALLBACK_URL,
        grant_type: "authorization_code"
    };
};

var getTTL = function getTTL() {
    var ttl = new Date();
    ttl.setDate(ttl.getDate() + 1);
    ttl.setHours(6);
    ttl.setMinutes(0);
    ttl.setSeconds(0);
    return Math.round(ttl.getTime() / 1000);
};

var handleCallback = function handleCallback(event, callback) {
    if (!('code' in event.queryStringParameters)) {
        console.log("[ERROR][CALLBCK] Code not included");
        redirectToFront(callback, null, PERMISSION_DENIED_ERROR);
        return;
    }

    request.post({url:"https://www.googleapis.com/oauth2/v4/token", form: getPOSTContent(event)}, function(err, response, body_token){

        if (err || response.statusCode != 200) {
            var info = err !== null ? err : body_token;
            console.log("[ERROR][CALLBCK] Get Token:", info);
            redirectToFront(callback, null, INVALID_OAUTH2_RESPONSE_ERROR);
            return;
        }

        var access_token = JSON.parse(body_token).access_token;

        request.get({url: "https://www.googleapis.com/oauth2/v2/userinfo", headers: {"Authorization": "Bearer " + access_token}}, 
            function(err, httpResponse, body_user) {

                if (err || response.statusCode != 200) {
                    var info = err !== null ? err : body_user;
                    console.log("[ERROR][CALLBACK] Get User Info:", info);
                    redirectToFront(callback, null, INVALID_OAUTH2_RESPONSE_ERROR);
                    return;
                }

                var user = JSON.parse(body_user);
                var email = user.email;
                var name = user.name;
                var picture = user.picture;
                var ttl = getTTL(); 

                var paramsGetAuthUsers = {
                    "TableName": PROPERTIES_TABLE,
                    "Key": {
                        "key": AUTH_USERS_HASH_KEY
                    }
                };

                docClient.get(paramsGetAuthUsers, function(err, data) {
                    if (err) {
                        console.log("[ERROR][CALLBACK] Get Auth Users:", JSON.stringify(err));
                        redirectToFront(callback, null, INVALID_BACKEND_RESPONSE_ERROR);
                        return;
                    }

                    var emails = data.Item.val;

                    if (emails.indexOf(email) >= 0) {

                        var token = uuid.v4();

                        var item = {
                            token: token,
                            email: email,
                            name: name,
                            picture: picture,
                            ttl: ttl
                        };

                        Object.keys(item).forEach((key) => (item[key] === "") && delete item[key]);

                        var paramsInsertUser = {
                            "TableName": USER_TOKENS_TABLE,
                            "Item": item
                        };

                        docClient.put(paramsInsertUser, function(err, data) {
                            if (err) {
                                console.log("[ERROR][CALLBACK] Unable to insert user:", JSON.stringify(err));
                                redirectToFront(callback, null, INVALID_BACKEND_RESPONSE_ERROR);
                                return;
                            }

                            redirectToFront(callback, token);
                        });

                    } else {
                        console.log("[ERROR][CALLBACK] User not authorized:", email);
                        redirectToFront(callback, null, NOT_AUTHORIZED_EMAIL_ERROR);
                        return;
                    }
                });
            }
        );
    });
};

// CURRENT USER

var currentUser = function currentUser(event, callback) {

    if (event.headers === null || !('Authorization' in event.headers)) {
        generateResponse(callback, 400, {"message": "Authorization not included", "code": AUTHORIZATION_NOT_INCLUDED_ERROR});
        return;
    }

    var params = {
        "TableName": USER_TOKENS_TABLE,
        "Key": {
            "token": event.headers.Authorization.trim()
        }
    };

    docClient.get(params, function(err, data) {
        if (err) {
            console.log("[ERROR][CHECK LOGGED] Error Accessing DynamoDB:", JSON.stringify(err));
            generateErrorResponse(callback, 500, "Invalid response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
            callback("Error: Invalid Response from the backend");
        } else if (data.Item) {
            generateResponse(callback, 200, data.Item);
        } else {
            generateErrorResponse(callback, 401, "Provided token is unknown", INVALID_AUTHORIZATION_ERROR);
        }
    });
};

// AUTHORIZE

var authorizeUser = function authorizeUser(event, callback) {

    var parsedJson = JSON.parse(event.body);

    if (parsedJson === null || !("email" in parsedJson) || parsedJson["email"] === "") {
        generateErrorResponse(callback, 400, "'email' is missing", MISSING_MAIL_ERROR);
        return;
    }

    var email = parsedJson["email"].trim();

    var paramsAuthorizeNewUser = {
        "TableName": PROPERTIES_TABLE,
        "Key": {
            "key": AUTH_USERS_HASH_KEY
        },
        "UpdateExpression": "set val = list_append(val, :email)",
        "ConditionExpression": "not contains (val, :emailStr)",
        "ExpressionAttributeValues" : {
            ":email" : [email],
            ":emailStr": email
        },
        "ReturnValues": "UPDATED_NEW"
    };

    docClient.update(paramsAuthorizeNewUser, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException") {
                console.log("[WARN][AUTHORIZE USER] Authroize New User: Email " + email + " already registered");
                generateErrorResponse(callback, 409, "Email " + email + " already registered", EMAIL_ALREADY_REGISTERED_ERROR);
            } else {
                console.log("[ERROR][AUTHORIZE USER] Authroize New User:", JSON.stringify(err));
                generateErrorResponse(callback, 500, "Invalid Response from the backend", INVALID_BACKEND_RESPONSE_ERROR);
            }
        } else {
            console.log("[INFO][AUTHORIZE USER] Authorize New User: ", JSON.stringify(data.Attributes.val));
            generateResponse(callback, 200, data.Attributes.val);
        }
    });
};

// MAIN CONTROLLER

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var handlers = {
        "/auth/login": {
            "GET": login
        },
        "/auth/callback": {
            "GET": handleCallback
        },
        "/auth/current-user": {
            "GET": currentUser
        },
        "/auth/authorize": {
            "POST": authorizeUser
        }
    };

    var handler = event.resource in handlers && event.httpMethod in handlers[event.resource] ? handlers[event.resource][event.httpMethod] : notImplemented;
    handler(event, callback);
};
