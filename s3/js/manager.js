$(window).load(function() {

    var apigClient = apigClientFactory.newClient();
    var currentUsers = {};
    var currentDonations = {};
    const USER_TICKET_COST = 40;

    const ERROR_TRANSLATIONS = {
        "INVALID_OAUTH2_RESPONSE": "Respuesta Inválida del proveedor OAuth2. Reintentalo de nuevo más tarde.",
        "PERMISSION_DENIED": "No se ha autorizado a la aplicación a acceder a tu información en el proveedor OAuth2. Vuelve a intentarlo y pulsa el botón \"Permitir\".",
        "INVALID_BACKEND_RESPONSE": "Error al acceder al servicio. Inténtalo de nuevo pasados unos segundos.",
        "NOT_AUTHORIZED_EMAIL": "Tu dirección de correo electrónico no tiene acceso a este servicio.", 
        "AHTORIZATION_NOT_INCLUDED": "La cabecera \"Authorization\" no está incluída.",
        "INVALID_AUTHORIZATION": "El token de autorización incluído en la petición no es válido.",
        "MISSING_USER_NAME": "No se ha incluído el nombre en la petición. Vuelve a realizar la operación incluyendo el nombre.",
        "MISSING_USER_NAME_OR_AMOUNT": "No se ha incluído el nombre o la cantidad donada en la petición. Vuelve a realizar la operación incluyendo el nombre y la cantidad donada.",
        "INVALID_AMOUNT": "El valor de la cantidad donada sólo puede ser un número. Vuelve a realizar la operación especificando un número válido",
        "INVALID_ID_FORMAT": "El formato del ID de recurso es inválido.",
        "NON_EXISTING_ID": "El ID de recurso indicado no existe.",
        "MISSING_MAIL_": "No se ha incluído el email a ser autorizado.",
        "EMAIL_ALREADY_REGISTERED": "El email indicado ya está autorizado."
    }

    const DATA_TABLES_SPANISH = {
        "sProcessing":     "Procesando...",
        "sLengthMenu":     "Mostrar _MENU_ registros",
        "sZeroRecords":    "No se encontraron resultados",
        "sEmptyTable":     "Ningún dato disponible en esta tabla",
        "sInfo":           "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
        "sInfoEmpty":      "Mostrando registros del 0 al 0 de un total de 0 registros",
        "sInfoFiltered":   "(filtrado de un total de _MAX_ registros)",
        "sInfoPostFix":    "",
        "sSearch":         "Buscar:",
        "sUrl":            "",
        "sInfoThousands":  ",",
        "sLoadingRecords": "Cargando...",
        "oPaginate": {
            "sFirst":    "Primero",
            "sLast":     "Último",
            "sNext":     "Siguiente",
            "sPrevious": "Anterior"
        },
        "oAria": {
            "sSortAscending":  ": Activar para ordenar la columna de manera ascendente",
            "sSortDescending": ": Activar para ordenar la columna de manera descendente"
        }
    }

    var abonadosTable = $('#abonados-table').DataTable({
        "ordering": false,
        "pageLength": 25,
        "language": DATA_TABLES_SPANISH,
        "autoWidth": false
    });

    var donationsTable = $('#donaciones-table').DataTable({
        "ordering": false,
        "pageLength": 25,
        "language": DATA_TABLES_SPANISH,
        "autoWidth": false
    });


    var getActionIcon = function getActionIcon(action, id) {
        return "<span class=\"glyphicon glyphicon-" + action + "\" style=\"cursor: pointer; color: #777777;\" data-id=" + id + "></span>"
    };

    $.urlParam = function(name){
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        return results === null ? null : decodeURIComponent(results[1]) || 0;
    }

    var showAlert = function showAlert(text, type) {
        type = type || "success";
        $("#messages").empty();
        $("#messages").append(
            "<div id=\"temporal-alert\" class=\"alert alert-" + type + "\" role=\"alert\">" + 
                "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\"><span aria-hidden=\"true\">&times;</span></button>" + text + 
              "</div>"
        );
    };

    var showError = function showError(errorCode, updateText) {
        var errorText = errorCode in ERROR_TRANSLATIONS ? ERROR_TRANSLATIONS[errorCode] : errorCode;

        if (updateText) {
            errorText += " <a href=\"/\">Actualizar</a>";
        }

        showAlert(errorText, "danger");
    }

    var callAPI = function callAPI(apiAction, params, body, then) {
        var additionalParams = { headers: { Authorization: Cookies.get("token") } };
        $("#loading-alert").removeClass("hidden");
        apigClient[apiAction](params, body, additionalParams).then(function(result) {
            $("#loading-alert").addClass("hidden");
            then(result);
        }).catch(function(result) {
            if (result.status === 401 || result.status === 0) {
                $(location).attr("href", apigClient.url + "/auth/login");
                return;
            }
            $("#loading-alert").addClass("hidden");
            showError(result.data.code);
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

    var authorizeUser = function authorizeuser(email) {
        callAPI("authAuthorizePost", {}, {"email": email}, function(result) {
            showAlert("Email <strong>" + email + "</strong> autorizado correctamente.");
        });
    }

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
        callAPI("userGet", {"order": "desc"}, null, function(res) {
            //var tableBody = $("#abonados-table > tbody");
            //tableBody.empty();

            abonadosTable.clear();

            currentUsers = {};
            res.data.forEach(function(element) {
                currentUsers[element.id] = element;
                var date = new Date(element.date);
                var strDate = date.toLocaleDateString("es-es") + " " + date.toLocaleTimeString();
                var editIcon = getActionIcon("pencil", element.id);
                var deleteIcon = getActionIcon("remove", element.id);
                abonadosTable.row.add([element.id, element.username, strDate, editIcon + deleteIcon]);
            });

            abonadosTable.draw();

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
        callAPI("donationGet", {"order": "desc"}, null, function(res) {
            
            donationsTable.clear()

            var totalAmount = 0;
            currentDonations = {};
            res.data.forEach(function(element) {
                currentDonations[element.id] = element;
                totalAmount += element.amount;
                var date = new Date(element.date);
                var strDate = date.toLocaleDateString("es-es") + " " + date.toLocaleTimeString();
                var editIcon = getActionIcon("pencil", element.id);
                var deleteIcon = getActionIcon("remove", element.id);
                donationsTable.row.add([element.id, element.username, strDate, element.amount + " €", editIcon + deleteIcon]);
            });

            donationsTable.draw();

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

    $("#current-user").click(function() {
        $("#authorized-email-input").val("");
        $("#authorize-user-modal").modal("show");
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

    $("#authorize-form-button").click(function() {
        var email = $("#authorized-email-input").val().trim();
        authorizeUser(email);
    });


    var newToken = $.urlParam("token");
    var error = $.urlParam("error");
    window.history.pushState("", "", '/');

    if (error) {
        showError(error, true);
        $('#abonos').addClass('hidden');
        $('#donaciones').addClass('hidden')
    } else {

        if (newToken) {
            Cookies.set("token", newToken);
        }

        callAPI("authCurrentUserGet", {}, {}, function(data) {
            $("#current-user").text(data.data.name || data.data.email);
            updateUsersTable();
            updateDonationsTable();
        });
    }

});