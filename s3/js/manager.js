$(window).load(function() {

    var apigClient = apigClientFactory.newClient();
    var currentUsers = {};

    var getActionIcon = function getActionIcon(action, id) {
        return "<span class=\"glyphicon glyphicon-" + action + "\" style=\"cursor: pointer; color: #777777;\" data-id=" + id + "></span>"
    };

    var showAlert = function showAlert(text, type) {
        type = type || "success";
        $("#temporal-alert").remove();
        $("#abonados").before(
            "<div id=\"temporal-alert\" class=\"alert alert-" + type + "\" role=\"alert\">" + 
                "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\"><span aria-hidden=\"true\">&times;</span></button>" + text + 
              "</div>"
        );
    };

    var callAPI = function callAPI(apiAction, params, body, then) {
        $("#loading-alert").removeClass("hidden");
        apigClient[apiAction](params, body).then(function(result) {
            $("#loading-alert").addClass("hidden");
            then(result);
        }).catch(function(result) {
            $("#loading-alert").addClass("hidden");
            showAlert("Error al acceder al servicio. Inténtalo de nuevo pasados unos segundos.", "danger");
        });
    };


    var createUser = function createUser(username) {
        callAPI("userPost", {}, {username: username}, function(result) {
            showAlert("<strong>" + result.data.username + "</strong> creado con # <strong>" + result.data.id + "</strong>")
            updateTable();
        });
    }

    var editUser = function editUser(id, username) {
        callAPI("userIdPatch", {id: id}, {username: username}, function(result) {
            showAlert("<strong>#" + result.data.id + " " + result.data.username + "</strong> ha sido editado correctamente</strong>")
            updateTable();
        });
    };

    var deleteUser = function deleteUser(id) {
        callAPI("userIdDelete", {id: id}, {}, function(result) {
            showAlert("<strong>#" + id + " " + currentUsers[id].username + "</strong> ha sido borrado correctamente</strong>")
            updateTable();
        });
    };

    var initForm = function initForm(id, username) {
        $("#userid-input").val(id);
        $("#username-input").val(username)
    }

    var updateTable = function updateTable() {
        callAPI("userGet", null, null, function(res) {
            var tableBody = $("#abonados > tbody");
            tableBody.empty();

            currentUsers = {};
            res.data.forEach(function(element) {
                currentUsers[element.id] = element;
                var date = new Date(element.date);
                var strDate = date.toLocaleDateString() + " " + date.toLocaleTimeString();
                var editIcon = getActionIcon("pencil", element.id);
                var deleteIcon = getActionIcon("remove", element.id);
                tableBody.append("<tr> <th scope=\"row\">" + element.id + "</th> <td>" + element.username + "</td> <td>" + strDate + "</td> <td>" + editIcon + deleteIcon + "</td> </tr>");
            });

            $(".glyphicon-pencil").click(function(event) {
                var id = $(event.target).data("id");
                initForm(id, currentUsers[id].username);
                $("#abonado-modal").modal("show");
            });


            $(".glyphicon-remove").click(function(event) {
                var id = $(event.target).data("id");
                $("#delete-abonado-username").text(currentUsers[id].username);
                $("#delete-form-accept-button").unbind("click");
                $("#delete-form-accept-button").click(deleteUser.bind(this, id));
                $("#delete-modal").modal("show");
            });

        });
    };

    $("#new-abono").click(function() {
        initForm("", "")
        $("#abonado-modal").modal("show");
    });

    $("#edit-form-accept-button").click(function() {
        var id = $("#userid-input").val();
        var username = $("#username-input").val();

        if (id === "") {
            createUser(username);
        } else {
            editUser(id, username);
        }
    });

    updateTable();
});