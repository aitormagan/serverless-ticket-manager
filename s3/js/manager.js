$(window).load(function() {

    var apigClient = apigClientFactory.newClient();
    var currentUsers = {};
    var currentDonations = {};
    const USER_TICKET_COST = 33;

    var getActionIcon = function getActionIcon(action, id) {
        return "<span class=\"glyphicon glyphicon-" + action + "\" style=\"cursor: pointer; color: #777777;\" data-id=" + id + "></span>"
    };

    var showAlert = function showAlert(text, type) {
        type = type || "success";
        $("#messages").empty();
        $("#messages").append(
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
            showAlert("<strong>" + result.data.username + "</strong> creado con # <strong>" + result.data.id + "</strong>.");
            updateUsersTable();
        });
    }

    var editUser = function editUser(id, username) {
        callAPI("userIdPatch", {id: id}, {username: username}, function(result) {
            showAlert("Abono <strong>#" + result.data.id + "</strong> de <strong>" + result.data.username + "</strong> editado correctamente</strong>.");
            updateUsersTable();
        });
    };

    var deleteUser = function deleteUser(id) {
        callAPI("userIdDelete", {id: id}, {}, function(result) {
            showAlert("Abono <strong>#" + id + "</strong> de <strong>" + currentUsers[id].username + "</strong> borrado correctamente</strong>.");
            updateUsersTable();
        });
    };

    var createDonation = function createDonation(username, amount) {
        callAPI("donationPost", {}, {username: username, amount: amount}, function(result) {
            showAlert("Donación de <strong>" + result.data.username + "</strong> por la cantidad de <strong>" + result.data.amount + " €</strong> registrada correctamente con # <strong>" + result.data.id + "</strong>.");
            updateDonationsTable();
        });
    };

    var editDonation = function createDonation(id, username, amount) {
        callAPI("donationIdPatch", {id: id}, {username: username, amount: amount}, function(result) {
            showAlert("Donación <strong>#" + result.data.id + "</strong> de <strong>" + result.data.username + "</strong> por la cantidad de <strong>" + result.data.amount + " €</strong> editada correctamente.");
            updateDonationsTable();
        });
    };

    var deleteDonation = function deleteDonation(id) {
        callAPI("donationIdDelete", {id: id}, {}, function(result) {
            showAlert("Donación <strong>#" + id + "</strong> de <strong>" + currentDonations[id].username + "</strong> borrada correctamente</strong>.");
            updateDonationsTable();
        });
    };

    var initUserForm = function initUserForm(id, username) {
        $("#userid-input").val(id);
        $("#username-input").val(username);
        $("#amount-form").addClass("hidden");
    };

    var initDonationForm = function initDonationForm(id, username, amount) {
        $("#userid-input").val(id);
        $("#username-input").val(username);
        $("#amount-input").val(amount);
        $("#amount-form").removeClass("hidden");
    };

    var updateUsersTable = function updateUsersTable() {
        callAPI("userGet", null, null, function(res) {
            var tableBody = $("#abonados-table > tbody");
            tableBody.empty();

            currentUsers = {};
            res.data.forEach(function(element) {
                currentUsers[element.id] = element;
                var date = new Date(element.date);
                var strDate = date.toLocaleDateString("es-es") + " " + date.toLocaleTimeString();
                var editIcon = getActionIcon("pencil", element.id);
                var deleteIcon = getActionIcon("remove", element.id);
                tableBody.append("<tr> <th scope=\"row\">" + element.id + "</th> <td>" + element.username + "</td> <td>" + strDate + "</td> <td>" + editIcon + deleteIcon + "</td> </tr>");
            });

            $("#abonados-table .glyphicon-pencil").click(function(event) {
                var id = $(event.target).data("id");
                initUserForm(id, currentUsers[id].username);
                $("#abonado-modal").modal("show");
            });


            $("#abonados-table .glyphicon-remove").click(function(event) {
                var id = $(event.target).data("id");
                $("#delete-item-text").empty()
                $("#delete-item-text").append("al abonado <strong>" + currentUsers[id].username + "</strong>");
                $("#delete-form-accept-button").unbind("click");
                $("#delete-form-accept-button").click(deleteUser.bind(this, id));
                $("#delete-modal").modal("show");
            });

            $("#users-total-amount").text((res.data.length * USER_TICKET_COST).toFixed(2));

        });
    };


    var updateDonationsTable = function updateUsersTable() {
        callAPI("donationGet", null, null, function(res) {
            var tableBody = $("#donaciones-table > tbody");
            tableBody.empty();

            var totalAmount = 0;
            currentDonations = {};
            res.data.forEach(function(element) {
                currentDonations[element.id] = element;
                totalAmount += element.amount;
                var date = new Date(element.date);
                var strDate = date.toLocaleDateString("es-es") + " " + date.toLocaleTimeString();
                var editIcon = getActionIcon("pencil", element.id);
                var deleteIcon = getActionIcon("remove", element.id);
                tableBody.append("<tr> <th scope=\"row\">" + element.id + "</th> <td>" + element.username + "</td> <td>" + strDate + "</td> <td>" + element.amount +  "</td> <td>" + editIcon + deleteIcon + "</td> </tr>");
            });

            $("#donaciones-table .glyphicon-pencil").click(function(event) {
                var id = $(event.target).data("id");
                initDonationForm(id, currentDonations[id].username, currentDonations[id].amount);
                $("#abonado-modal").modal("show");
            });


            $("#donaciones-table .glyphicon-remove").click(function(event) {
                var id = $(event.target).data("id");
                $("#delete-item-text").empty()
                $("#delete-item-text").append("la donación de <strong>" + currentDonations[id].username + "</strong> por un valor de <strong>" + currentDonations[id].amount + " €");
                $("#delete-form-accept-button").unbind("click");
                $("#delete-form-accept-button").click(deleteDonation.bind(this, id));
                $("#delete-modal").modal("show");
            });

            $("#donations-total-amount").text(totalAmount.toFixed(2));

        });
    };

    $("#new-abono").click(function() {
        initUserForm("", "");
        $("#abonado-modal").modal("show");
    });

    $("#new-donacion").click(function() {
        initDonationForm("", "", "");
        $("#abonado-modal").modal("show");
    });


    $("#update-abonos-list").click(updateUsersTable);
    $("#update-donaciones-list").click(updateDonationsTable);

    $("#edit-form-accept-button").click(function() {
        var id = $("#userid-input").val();
        var username = $("#username-input").val();

        if ($("#amount-form").hasClass("hidden")) {
            if (id === "") {
                createUser(username);
            } else {
                editUser(id, username);
            }
        } else {
            var amount = $("#amount-input").val();
            if (id === "") {
                createDonation(username, amount);
            } else {
                editDonation(id, username, amount);
            }

        }
    });

    updateUsersTable();
    updateDonationsTable();
});