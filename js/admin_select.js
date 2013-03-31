		/**
		 * ADMIN DROPDOWN MENU HANDLER METHODS
		 */

		function checkIfMobile(data_types) {
			for (var i = 0; i < data_types.length; i ++) {
				$("select.select-subscribe-" + data_types[i]).each( function(i, $item) {
					if (!$.browser.mobile) $("#" + $item.id).attr("data-native-menu", "false");
					else $("#" + $item.id).attr("data-native-menu", "true");
					console.log("update menu ", $("#" + $item.id).attr("data-native-menu"));
				});
			}
		}

		function updateRouteFromUI ( event, self ) {
			var pub_name
				, remote_address
				, client_name
				, sub_name
				;

			for ( var i = 0; i < event.target.length; i++ ) {
				if (i == 0) continue;
				sub_name = $(event.target[i]).attr("data-route-name");
				client_name = $(event.target[i]).attr("data-client-name");
				remote_address = $(event.target[i]).attr("data-remote-address");
				prev_state = $(event.target[i]).attr("data-prev-state");
				pub_name = $(self).parent().context.id.replace("-select", "");	

				if (event.target[i].selected && prev_state === "false") {
					console.log("NEW route " +pub_name + " client " + client_name + " add " + remote_address + " sub " + sub_name)
					sb.addSubRoute( pub_name, client_name, remote_address, sub_name );
					$(event.target[i]).attr("data-prev-state", "true");					
				} 

				else if (!event.target[i].selected && prev_state === "true") {
					sb.removeSubRoute( pub_name, client_name, remote_address, sub_name );					
					$(event.target[i]).attr("data-prev-state", "false");					
				}
			}
		}

		function updateRouteFromServer ( type, pub, sub ) {
			var pub_sub_id
				, select_id
				, connecting_to_pub_or_sub
				;

			// check if route involves the current app, get ids if appropriate
			if (sb.isThisApp(pub.clientName, pub.remoteAddress)) {
				pub_sub_id = sub.clientName + "_" + sub.remoteAddress + "_" + sub.name;
				pub_sub_id = pub_sub_id.replace(/ /g, "");
				select_id = pub.name + "-select";
				connecting_to_pub_or_sub = "subscribe";
			} 
			else if (sb.isThisApp(sub.clientName, sub.remoteAddress)) {
				pub_sub_id = pub.clientName + "_" + pub.remoteAddress + "_" + pub.name;
				pub_sub_id = pub_sub_id.replace(/ /g, "");
				select_id = sub.name + "-select";
				connecting_to_pub_or_sub = "publish";
			} 
			// if route doesn't involve current app then abort
			else {
				console.log ("[updateRouteFromServer] route doesn't involve this client");
				return;
			}

			console.log ("[updateRouteFromServer] '" + type + "' route to dropdown '" + select_id + "' option '" + pub_sub_id + "'");
			console.log ("[updateRouteFromServer] select dom node ", $('#' + select_id).find('option[value="' + pub_sub_id + '"]'));

			var cur_option

			// if add route message then select appropriate drop down option
			if (type === "add") {
				cur_option = $('#' + select_id).find('option[value="' + pub_sub_id + '"]')

				// make sure that drop-down option is of appropriate type (pub or sub)
				if ($(cur_option[0]).attr("data-pub-or-sub") === connecting_to_pub_or_sub) {
					if (!$(cur_option[0]).attr("selected")) {
						$(cur_option[0]).attr("selected", "selected");
						$(cur_option[0]).attr("data-prev-state", "true");						
					}
				}
			} 

			// if remove message then de-select approrpriate drop down option
			else if (type === "remove") {
				cur_option = $('#' + select_id).find('option[value="' + pub_sub_id + '"]');

				// make sure that drop-down option is of appropriate type (pub or sub)
				if ($(cur_option[0]).attr("data-pub-or-sub") === connecting_to_pub_or_sub) {
					if ($(cur_option[0]).attr("selected")) {
						$(cur_option[0]).removeAttr("selected");
						$(cur_option[0]).attr("data-prev-state", "false");						
					}
				}
			}
			console.log ("[updateRouteFromServer] cur option ", cur_option[0]);
		}

		function removePubSub(name, address, pub_sub_array) {
			var client_id = name + "_" + address;
			client_id = client_id.replace(/ /g, "");

			// extract appropriate pub or sub elements from new client 
			console.log("[removePubSub] removing client '" + name + "' with address '" + address + "'");

			// and loop through each one to add to list.
			for (var i = pub_sub_array.length - 1; i >= 0 ; i --) {
				console.log("[removePubSub] " + client_id  + " comp to " + pub_sub_array[i].clientId);
				if (client_id === pub_sub_array[i].clientId) {				
					console.log("[removePubSub] found client with id " + client_id );
					if ($("option[name='" + client_id + "']")) {
						$("option[name='" + client_id + "']").remove();
					}
				}
			}			
		}		

		function addPubSub (client, type, pub_or_sub, pub_sub_array) {
			var client_id = client.name + "_" + client.remoteAddress;
			client_id = client_id.replace(/ /g, "");

			// and loop through each one to add to list.
			for (var j = 0; j < pub_sub_array.length; j ++) {
				if (pub_sub_array[j].clientId === client_id) {
					removePubSub(client.name, client.remoteAddress, pub_sub_array);
					break;
				}
			}

			// extract appropriate pub or sub elements from new client 
			var new_subs_or_pubs = extractPubOrSubFromClient(client, type, pub_or_sub);
			if (new_subs_or_pubs.length <= 0) return;
			console.log("[addPubSub] adding '" + pub_or_sub + "' of type '" + type + "' from ", client);

			// and loop through each one to add to list.
			for (var i = 0; i < new_subs_or_pubs.length; i ++) {

				// add new subscribe elements to local array
				pub_sub_array.push(new_subs_or_pubs[i]);

				// loop through pub or sub drop down of appropriate type to add new items
				if ($("select.select-" + pub_or_sub + "-" + type)) {
					$("select.select-" + pub_or_sub + "-" + type).each( function(index, $item) {
						var $new_option = $('<option>', { value: new_subs_or_pubs[i].id
										, text: new_subs_or_pubs[i].clientName + " : " + new_subs_or_pubs[i].name
										, name: new_subs_or_pubs[i].clientId
						});
						$new_option.attr("data-route-name", new_subs_or_pubs[i].name);
						$new_option.attr("data-client-name", new_subs_or_pubs[i].clientName);
						$new_option.attr("data-remote-address", new_subs_or_pubs[i].remoteAddress);
						$new_option.attr("data-pub-or-sub", pub_or_sub);
						$new_option.attr("data-prev-state", "false");
						$new_option.appendTo("#" + $item.id);
						console.log("created new option ", $("#" + $item.id));
						console.log("created new option ", $new_option);
					});					
				}
			}			
		}

		function extractPubOrSubFromClient (client, type, pub_or_sub){
			var pub_sub_item = {}
				, new_item = {}
				, pub_sub_list = []
				, client_id = ""
				, pub_sub_id = ""
				;

			// loop through pub or sub elements to extract appropriate types
			for( var j = 0; j < client[pub_or_sub].messages.length; j++ ){
				pub_sub_item = client[pub_or_sub].messages[j];
				if ( pub_sub_item.type === type ) {

					client_id = client.name + "_" + client.remoteAddress;
					client_id = client_id.replace(/ /g, "");

					pub_sub_id = client_id + "_" + pub_sub_item.name;
					pub_sub_id = pub_sub_id.replace(/ /g, "");

					new_item = { clientName: client.name
								, remoteAddress: client.remoteAddress 
								, name: pub_sub_item.name
								, type: pub_sub_item.type
								, id: pub_sub_id
								, clientId: client_id
							};
					pub_sub_list.push( new_item );
				}			
			}
			console.log("[extractPubOrSubFromClient] returning list of " + pub_or_sub, pub_sub_list );
			return pub_sub_list;
		}