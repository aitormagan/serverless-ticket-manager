"use_strict";

var request = require("request");
var uuid = require("uuid");

const CLIENT_ID = "GOOGLE_CLIENT_ID";
const CLIENT_SECRET = "GOOGLE_CLIENT_SECRET";
const CALLBACK_URL = "https://API_ID.execute-api.eu-central-1.amazonaws.com/DEV/auth/callback";
const S3_WEBSITE_URL = "http://BUCKET_ID.s3-website.eu-central-1.amazonaws.com/";

const PROPERTIES_TABLE = "Properties";
const USER_TOKENS_TABLE = "UserTokens";

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

var handleCallback = function handleCallback(event, callback) {
    if (!('code' in event.queryStringParameters)) {
        console.log("[ERROR][CALLBCK] Code not included");
        redirectToFront(callback, null, "You must authorize the application to access your Google profile");
        return;
    }

    request.post({url:"https://www.googleapis.com/oauth2/v4/token", form: getPOSTContent(event)}, function(err, response, body_token){

        if (err || response.statusCode != 200) {
            var info = err !== null ? err : body_token;
            console.log("[ERROR][CALLBCK] Get Token:", info);
            redirectToFront(callback, null, "Invalid response from the OAuth server");
            return;
        }

        var access_token = JSON.parse(body_token).access_token;

        request.get({url: "https://www.googleapis.com/oauth2/v2/userinfo", headers: {"Authorization": "Bearer " + access_token}}, 
            function(err, httpResponse, body_user) {

                if (err || response.statusCode != 200) {
                    var info = err !== null ? err : body_user;
                    console.log("[ERROR][CALLBACK] Get User Info:", info);
                    redirectToFront(callback, null, "Invalid response from the OAuth server");
                    return;
                }

                var user = JSON.parse(body_user);
                var email = user.email;
                var name = user.name;
                var picture = user.picture;
                var ttl = Math.round(new Date().getTime() / 1000) + (3600 * 24); 

                var paramsGetAuthUsers = {
                    "TableName": PROPERTIES_TABLE,
                    "Key": {
                        "key": "authUsers"
                    }
                };

                docClient.get(paramsGetAuthUsers, function(err, data) {
                    if (err) {
                        console.log("[ERROR][CALLBACK] Get Auth Users:", JSON.stringify(err));
                        redirectToFront(callback, null, "Invalid response from the backend");
                        return;
                    }

                    var emails = data.Item.val;

                    if (emails.indexOf(email) >= 0) {

                        var token = uuid.v4();

                        var paramsInsertUser = {
                            "TableName": "UserTokens",
                            "Item": {
                                token: token,
                                email: email,
                                name: name,
                                picture: picture,
                                ttl: ttl
                            }
                        };

                        docClient.put(paramsInsertUser, function(err, data) {
                            if (err) {
                                console.log("[ERROR][CALLBACK] Unable to insert user:", JSON.stringify(err));
                                redirectToFront(callback, null, "Invalid response from the backend");
                                return;
                            }

                            redirectToFront(callback, token);
                        });

                    } else {
                        console.log("[ERROR][CALLBACK] User not authorized:", email);
                        redirectToFront(callback, null, "Your email is not authorized to access this service");
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
        generateResponse(callback, 400, {"message": "Authorization not included"});
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
            generateResponse(callback, 500, {"message": "Invalid response from the backend"});
            callback("Error: Invalid Response from the backend");
        } else if (data.Item) {
            generateResponse(callback, 200, data.Item);
        } else {
            generateResponse(callback, 401, {"message": "Provided token is unknown"});
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
            "GET": handleCallback,
        },
        "/auth/current-user": {
            "GET": currentUser
        }
    };

    var handler = event.resource in handlers && event.httpMethod in handlers[event.resource] ? handlers[event.resource][event.httpMethod] : notImplemented;
    handler(event, callback);
};
