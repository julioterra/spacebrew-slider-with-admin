/**
 * 
 * Spacebrew Library for Javascript
 * --------------------------------
 *  
 * This library was designed to work on front-end (browser) envrionments, and back-end (server) 
 * environments. Please refer to the readme file, the documentation and examples to learn how to 
 * use this library.
 * 
 * Spacebrew is an open, dynamically re-routable software toolkit for choreographing interactive 
 * spaces. Or, in other words, a simple way to connect interactive things to one another. Learn 
 * more about Spacebrew here: http://docs.spacebrew.cc/
 *
 * To import into your web apps, we recommend using the minimized version of this library, 
 * filename sb-1.0.4.min.js.
 *
 * Latest Updates:
 * - enable client apps to register for admin privileges.
 * - added methods to handle admin messages and to update routes.
 * - added close method to close Spacebrew connection.
 * 
 * @author 		Brett Renfer and Julio Terra from LAB @ Rockwell Group
 * @filename	sb-1.0.4.js
 * @version 	1.0.4
 * @date 		Mar 18, 2013
 * 
 */

/**
 * Check if Bind method exists in current enviroment. If not, it creates an implementation of
 * this useful method.
 */
if (!Function.prototype.bind) {  
  Function.prototype.bind = function (oThis) {  
	if (typeof this !== "function") {  
	  // closest thing possible to the ECMAScript 5 internal IsCallable function  
	  throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");  
	} 
  
	var aArgs = Array.prototype.slice.call(arguments, 1),   
		fToBind = this,   
		fNOP = function () {},  
		fBound = function () {  
		  return fToBind.apply(this instanceof fNOP  
								 ? this  
								 : oThis || window,  
							    aArgs.concat(Array.prototype.slice.call(arguments)));  
		};  
  
	fNOP.prototype = this.prototype;  
	fBound.prototype = new fNOP();  
  
	return fBound;  
  };  
} 

/**
 * @namespace for Spacebrew library
 */
var Spacebrew = Spacebrew || {};

/**
 * create placeholder var for WebSocket object, if it does not already exist
 */
var WebSocket = WebSocket || {};


/**
 * Check if Running in Browser or Server (Node) Environment * 
 */

// check if window object already exists to determine if running browswer
var window = window || undefined;

// check if module object already exists to determine if this is a node application
var module = module || undefined;

// if app is running in a browser, then define the getQueryString method
if (window) {
	if (!window['getQueryString']){
		/**
		 * Get parameters from a query string
		 * @param  {String} name Name of query string to parse (w/o '?' or '&')
		 * @return {String}	value of parameter (or empty string if not found)
		 */
		window.getQueryString = function( name ) {
			if (!window.location) return;
			name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
			var regexS = "[\\?&]"+name+"=([^&#]*)";
			var regex = new RegExp( regexS );
			var results = regex.exec( window.location.href );
			if( results == null ) return "";
			else return results[1];
		}
	}	
}

// if app is running in a node server environment then package Spacebrew library as a module.
// 		WebSocket module (ws) needs to be saved in a node_modules so that it can be imported.
if (!window && module) {
	WebSocket = require("ws");
	module.exports = {
		Spacebrew: Spacebrew
	} 
}


/**
 * Define the Spacebrew Library * 
 */

/**
 * Spacebrew client!
 * @constructor
 * @param  {String} server      (Optional) Base address of Spacebrew server. This server address is overwritten if server defined in query string; defaults to localhost.
 * @param  {String} name        (Optional) Base name of app. Base name is overwritten if "name" is defined in query string; defaults to window.location.href.
 * @param  {String} description (Optional) Base description of app. Description name is overwritten if "description" is defined in query string;
 * @param  {Object} options		(Optional) An object that holds the optional parameters described below
 *         			port 		(Optional) Port number for the Spacebrew server
 *            		admin 		(Optional) Flag that identifies when app should register for admin privileges with server
 *              	debug 		(Optional) Debug flag that turns on info and debug messaging (limited use)
 */
Spacebrew.Client = function( server, name, description, options ){

	this.debug = options.debug || false;

	/**
	 * Name of app
	 * @type {String}
	 */
	this._name = name || "javascript client";
	if (window) {
		this._name = (window.getQueryString('name') !== "" ? unescape(window.getQueryString('name')) : this._name);
	}
	
	/**
	 * Description of your app
	 * @type {String}
	 */
	this._description = description || "spacebrew javascript client";
	if (window) {
		this._description = (window.getQueryString('description') !== "" ? unescape(window.getQueryString('description')) : this._description);
	}


	/**
	 * Spacebrew server to which the app will connect
	 * @type {String}
	 */
	this.server = server || "sandbox.spacebrew.cc";
	if (window) {
		this.server = (window.getQueryString('server') !== "" ? unescape(window.getQueryString('server')) : this.server);
	}

	/**
	 * Port number on which Spacebrew server is running
	 * @type {Integer}
	 */
	this.port = options.port || 9000;
	if (window) {
		port = window.getQueryString('port');
		if (port !== "" && !isNaN(port)) { 
			this.port = port; 
		} 
	}

	/**
	 * Reference to WebSocket
	 * @type {WebSocket}
	 */
	this.socket = null;

	/**
	 * Configuration file for Spacebrew
	 * @type {Object}
	 */
	this.client_config = {
		name: this._name,
		description: this._description,
		publish:{
			messages:[]
		},
		subscribe:{
			messages:[]
		}
	};

	this.admin_config = [
			{
				admin: true
			}
		];		

	this.admin = {
		active: options.admin || false, 
		remoteAddress: undefined,
		clients: [],
		routes: []
	}

	/**
	 * Are we connected to a Spacebrew server?
	 * @type {Boolean}
	 */
	this._isConnected = false;
}

/**
 * Connect to Spacebrew 
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype.connect = function(){
	try {
		this.socket 	 		= new WebSocket("ws://" + this.server + ":" + this.port);
		this.socket.onopen 		= this._onOpen.bind(this);
		this.socket.onmessage 	= this._onMessage.bind(this);
		this.socket.onclose 	= this._onClose.bind(this);
	} catch(e){
		this._isConnected = false;
		console.log("[connect:Spacebrew] connection attempt failed")
	}
}

/**
 * Close Spacebrew connection
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype.close = function(){
	try {
		if (this._isConnected == true) {
			this.socket.close();
			this._isConnected = false;
			console.log("[close:Spacebrew] closing websocket connection")
		}		
	} catch (e) {		
		this._isConnected = false;
	}
}

/**
 * Override in your app to receive on open event for connection
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onOpen = function( name, value ){}


/**
 * Override in your app to receive on close event for connection
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onClose = function( name, value ){}

/**
 * Override in your app to receive "range" messages, e.g. sb.onRangeMessage = yourRangeFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onRangeMessage = function( name, value ){}

/**
 * Override in your app to receive "boolean" messages, e.g. sb.onBooleanMessage = yourBoolFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onBooleanMessage = function( name, value ){}

/**
 * Override in your app to receive "string" messages, e.g. sb.onStringMessage = yourStringFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onStringMessage = function( name, value ){}

/**
 * Override in your app to receive "custom" messages, e.g. sb.onCustomMessage = yourStringFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onCustomMessage = function( name, value, type ){}


/**
 * Add a route you are publishing on 
 * @param {String} name Name of incoming route
 * @param {String} type "boolean", "range", or "string"
 * @param {String} def  default value
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.addPublish = function( name, type, def ){
	this.client_config.publish.messages.push({"name":name, "type":type, "default":def});
	this.updatePubSub();
}

/**
 * [addSubscriber description]
 * @param {String} name Name of outgoing route
 * @param {String} type "boolean", "range", or "string"
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.addSubscribe = function( name, type ){
	this.client_config.subscribe.messages.push({"name":name, "type":type });
	this.updatePubSub();
}

/**
 * Update publishers and subscribers
 * @memberOf Spacebrew.Client
 * @private
 */
Spacebrew.Client.prototype.updatePubSub = function(){
	if (this._isConnected) {
		this.socket.send(JSON.stringify({"config": this.client_config}));
		console.log ("this.admin.active ", this.admin.active);
		if (this.admin.active == true) this.socket.send(JSON.stringify({"admin": this.admin_config}));
	}
}

/**
 * Send a route to Spacebrew
 * @param  {String} name  Name of outgoing route (must match something in addPublish)
 * @param  {String} type  "boolean", "range", or "string"
 * @param  {String} value Value to send
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.send = function( name, type, value ){
	var message = {
		message: {
           clientName:this._name,
           name:name,
           type:type,
           value:value
       }
   	};

   	//console.log(message);
   	this.socket.send(JSON.stringify(message));
}

/**
 * Called on WebSocket open
 * @private
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onOpen = function() {
    console.log("[_onOpen:Spacebrew] Spacebrew connection opened, client name is: " + this._name);
	this._isConnected = true;

  	// send my config
  	this.updatePubSub();
  	this.onOpen();
}

/**
 * Called on WebSocket message
 * @private
 * @param  {Object} e
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onMessage = function( e ){
	var data = JSON.parse(e.data)
		, name
		, type
		, value
		;


	// handle client messages 
	if (data["message"]) {
		// check to make sure that this is not an admin message
		if (!data.message["clientName"]) {
			name = data.message.name;
		    type = data.message.type;
			value = data.message.value;

			switch( type ){
				case "boolean":
					this.onBooleanMessage( name, value == "true" );
					break;
				case "string":
					this.onStringMessage( name, value );
					break;
				case "range":
					this.onRangeMessage( name, Number(value) );
					break;
				default:
					this.onCustomMessage( name, value, type );
			}			
		}
	} 

	// handle admin messages
	else {
		if (true) console.log("ADMIN handling client ", data);
		
		if (data["admin"]) {
			// nothing to be done
		}
		else if (data["remove"]) {
			if (true) console.log("REMOVE handling remove user message ", data["remove"]);
			for (var i = 0; i < data.remove.length; i ++) {
				this.onRemoveClient( data.remove[i].name, data.remove[i].remoteAddress );
				this.onAllClientUpdates();
			}			
		}
		else if (data["route"]) {
			this.onUpdatedRoute( data.route.type, data.route.publish, data.route.subscribe );
			if (true) console.log("ROUTE handling route update message ", data["route"]);
		} 
		else if (data instanceof Array || data["config"]) {
			if (true) console.log("POSSIBLE handling client config message ", data);
			if (data["config"]) data = [data];
			for (var i = 0; i < data.length; i ++) {
				if (data[i]["config"]) {
					if (true) console.log("NEW handling client config message ", data[i].config);
					this._onNewClient(data[i].config);
					this.onAllClientUpdates();
				} 
			}
		}
	}
}

/**
 * Called on WebSocket close
 * @private
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onClose = function() {
    console.log("[_onClose:Spacebrew] Spacebrew connection closed");
	this._isConnected = false;
	this.onClose();
};

/**
 * name Method that sets or gets the spacebrew app name. If parameter is provided then it sets the name, otherwise
 * 		it just returns the current app name.
 * @param  {String} newName New name of the spacebrew app
 * @return {String} Returns the name of the spacebrew app if called as a getter function. If called as a 
 *                  setter function it will return false if the method is called after connecting to spacebrew, 
 *                  because the name must be configured before connection is made.
 */
Spacebrew.Client.prototype.name = function (newName){
	if (newName) {								// if a name has been passed in then update it
		if (this._isConnected) return false;  	// if already connected we can't update name
		this._name = newName;	
		if (window) {
			this._name = (window.getQueryString('name') !== "" ? unescape(window.getQueryString('name')) : this._name);
		}
		this.client_config.name = this._name;			// update spacebrew config file
	} 	
	return this._name;	
};

/**
 * name Method that sets or gets the spacebrew app description. If parameter is provided then it sets the description, 
 * 		otherwise it just returns the current app description.
 * @param  {String} newDesc New description of the spacebrew app
 * @return {String} Returns the description of the spacebrew app if called as a getter function. If called as a 
 *                  setter function it will return false if the method is called after connecting to spacebrew, 
 *                  because the description must be configured before connection is made.
 */
Spacebrew.Client.prototype.description = function (newDesc){
	if (newDesc) {								// if a description has been passed in then update it
		if (this._isConnected) return false;  	// if already connected we can't update description
		this._description = newDesc || "spacebrew javascript client";
		if (window) {
			this._description = (window.getQueryString('description') !== "" ? unescape(window.getQueryString('description')) : this._description);
		}
		this.client_config.description = this._description;	// update spacebrew config file
	} 
	return this._description;	
};

/**
 * isConnected Method that returns current connection state of the spacebrew client.
 * @return {Boolean} Returns true if currently connected to Spacebrew
 */
Spacebrew.Client.prototype.isConnected = function (){
	return this._isConnected;	
};

/**
 * ADMIN HANDLER METHODS
 */

Spacebrew.Client.prototype.onAllClientUpdates = function(){}

/**
 * Override in your app to receive new client information, e.g. sb.onNewClient = yourFunction
 * Admin-related method.
 * 
 * @param {Object} client  			Object with client config details described below
 *        {String} name  			Name of client
 *        {String} address 			IP address of client
 *        {String} description 		Description of client
 *        {Array} publish 			Array with all publish data feeds for client
 *        {Array} subscribe  		Array with subscribe data feeds for client
 * @memberOf Spacebrew.Client
 * @public
 */
// Spacebrew.Client.prototype.onNewClient = function( name, address, description, pubs, subs ){}
Spacebrew.Client.prototype.onNewClient = function( client ){}

/**
 * Override in your app to receive updated information about existing client, e.g. sb.onNewClient = yourFunction
 * Admin-related method.
 * 
 * @param {Object} client  			Object with client config details described below
 *        {String} name  			Name of client
 *        {String} address 			IP address of client
 *        {String} description 		Description of client
 *        {Array} publish 			Array with all publish data feeds for client
 *        {Array} subscribe  		Array with subscribe data feeds for client
 * @memberOf Spacebrew.Client
 * @public
 */
// Spacebrew.Client.prototype.onUpdatedClient = function( name, address, description, pubs, subs ){}
Spacebrew.Client.prototype.onUpdatedClient = function( client ){}

/**
 * Override in your app to receive information about new routes, e.g. sb.onNewRoute = yourStringFunction
 * Admin-related method.
 * 
 * @param  {String} type 			Type of route message, either add or remove
 * @param  {Object} pub 			Object with name of client name and address, publish name and type
 * @param  {Object} sub 			Object with name of client name and address, subscribe name and type
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onUpdatedRoute = function( type, pub, sub ){}

/**
 * Override in your app to receive client removal messages, e.g. sb.onCustomMessage = yourStringFunction
 * Admin-related method.
 * 
 * @param  {String} name  		Name of client being removed
 * @param  {String} address  	Address of client being removed
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onRemoveClient = function( name, address ){}


/**
 * Called when a new client message is received. Only used when app is registered as
 * an admin application.
 * 
 * @param  {object} client 	Configuration information for new client, including name,
 *                          address, description, subscribe, and publishers
 * @private
 */
Spacebrew.Client.prototype._onNewClient = function( client ){
	var existing_client = false;

		if (client.name === this._name && !this.admin.remoteAddress) {
			console.log("ADDRESS testing for remote address - STEP 1");				
			if ((client.publish.messages.length == this.client_config.publish.messages.length) &&
				(client.subscribe.messages.length == this.client_config.subscribe.messages.length)) {
				console.log("ADDRESS testing for remote address - STEP 2");				
				var match_confirmed = true
					, cur_pub_sub = ["subscribe", "publish"]
					;
				for (var j = 0; j < cur_pub_sub.length; j ++ ) {
					var client_config = client[cur_pub_sub[j]].messages;
					var local_config = this.client_config[cur_pub_sub[j]].messages;
					for (var i = 0; i < client_config.length; i ++ ) {
						if (!(client_config[i].name === local_config[i].name) ||
							!(client_config[i].type === local_config[i].type)) {
							match_confirmed = false;
							break;
						}	
					}									
				}	
				if (match_confirmed){
					this.admin.remoteAddress = client.remoteAddress;					
					console.log("ADDRESS updating local remote address to " + this.admin.remoteAddress);				
				}
			}
		}

	for( var j = 0; j < this.admin.clients.length; j++ ){
		console.log("existing client logged on " + client.name + " address " + client.remoteAddress);				

		if ( this.admin.clients[j].name === client.name
			 && this.admin.clients[j].remoteAddress === client.remoteAddress ) {

			this.admin.clients[j].publish = client.publish;
			this.admin.clients[j].subscribe = client.subscribe;
			this.admin.clients[j].description = client.description;

			existing_client = true;

			// client.publish = client.publish.messages;
			// client.subscribe = client.subscribe.messages;

			this.onUpdatedClient( client );
		}
	}

	//if we did not find a matching client, then add this one
	if ( !existing_client ) {
		console.log("new client logged on " + client.name + " address " + client.remoteAddress);				

		this.admin.clients.push( client );

		// client.publish = client.publish.messages;
		// client.subscribe = client.subscribe.messages;
		this.onNewClient( client );
	}
}

/**
 * Returns the client that matches the name and remoteAddress parameters queried
 * @param  {String} name           	Name of the client application
 * @param  {String} remoteAddress  	IP address of the client apps
 * @return {Object}                	Object featuring all client config information
 */
Spacebrew.Client.prototype.getClient = function (name, remoteAddress){
	var client;

	for( var j = 0; j < this.admin.clients.length; j++ ){
		client = this.admin.clients[j];
		if ( client.name === name && client.remoteAddress === remoteAddress ) {
			return client;
		}
	}
}



Spacebrew.Client.prototype.subscribeListByType = function (type){
	return this._pubSubByType("subscribe", type);
}

Spacebrew.Client.prototype.publishListByType = function (type){
	return this._pubSubByType("publish", type);
}

Spacebrew.Client.prototype._pubSubByType = function (pub_or_sub, type){
	var client = {}
		, filtered_clients = []
		, pub_sub_item = {}
		, new_item = {}
		;

	for( var j = 0; j < this.admin.clients.length; j++ ){
		client = this.admin.clients[j];
		for (var i = 0; i < client[pub_or_sub].messages.length; i++) {
			pub_sub_item = client[pub_or_sub].messages[i];
			if ( pub_sub_item.type === type ) {
				new_item = { clientName: client.name
							, remoteAddress: client.remoteAddress 
							, name: pub_sub_item.name
							, type: pub_sub_item.type
						};
				filtered_clients.push( new_item );
			}			
		}
	}
	return filtered_clients;
}

/**
 * Method that is used to add a route to the Spacebrew server
 * @param {String or Object} pub_client 	Publish client app name OR
 *                   						object with all publish information.
 * @param {String or Object} pub_address 	Publish app remote IP address OR
 *                   						object with all subscribe information.
 * @param {String} pub_name    				Publish name 
 * @param {String} sub_client  				Subscribe client app name
 * @param {String} sub_address 				Subscribe app remote IP address 
 * @param {String} sub_name    				Subscribe name
 */
Spacebrew.Client.prototype.addRoute = function ( pub_client, pub_address, pub_name, sub_client, sub_address, sub_name ){
	this._updateRoute("add", pub_client, pub_address, pub_name, sub_client, sub_address, sub_name);
}

Spacebrew.Client.prototype.addSubRoute = function ( pub_name, sub_client, sub_address, sub_name ){
	if (!this.admin.remoteAddress) return;
	this._updateRoute("add", this._name, this.admin.remoteAddress, pub_name, sub_client, sub_address, sub_name);
}

Spacebrew.Client.prototype.addPubRoute = function ( sub_name, pub_client, pub_address, pub_name){
	if (!this.admin.remoteAddress) return;
	this._updateRoute("add", pub_client, pub_address, pub_name, this._name, this.admin.remoteAddress, sub_name);
}

/**
 * Method that is used to remove a route from the Spacebrew server
 * @param {String or Object} pub_client 	Publish client app name OR
 *                   						object with all publish information.
 * @param {String or Object} pub_address 	Publish app remote IP address OR
 *                   						object with all subscribe information.
 * @param {String} pub_name    				Publish name 
 * @param {String} sub_client  				Subscribe client app name
 * @param {String} sub_address 				Subscribe app remote IP address 
 * @param {String} sub_name    				Subscribe name
 */
Spacebrew.Client.prototype.removeRoute = function ( pub_client, pub_address, pub_name, sub_client, sub_address, sub_name ){
	this._updateRoute("remove", pub_client, pub_address, pub_name, sub_client, sub_address, sub_name);
}

Spacebrew.Client.prototype.removeSubRoute = function ( pub_name, sub_client, sub_address, sub_name ){
	if (!this.admin.remoteAddress) return;
	this._updateRoute("remove", this.name, this.remoteAddress, pub_name, sub_client, sub_address, sub_name);
}

Spacebrew.Client.prototype.removePubRoute = function ( sub_name, pub_client, pub_address, pub_name){
	if (!this.admin.remoteAddress) return;
	this._updateRoute("remove", pub_client, pub_address, pub_name, this.name, this.remoteAddress, sub_name);
}

/**
 * Method that handles both add and remove route requests. Responsible for parsing requests
 * and communicating with Spacebrew server
 * @private
 * 
 * @param {String} type 					Type of route request, either "add" or "remove"
 * @param {String or Object} pub_client 	Publish client app name OR
 * @param {String or Object} pub_client 	Publish client app name OR
 *                   						object with all publish information.
 * @param {String or Object} pub_address 	Publish app remote IP address OR
 *                   						object with all subscribe information.
 * @param {String} pub_name    				Publish name 
 * @param {String} sub_client  				Subscribe client app name
 * @param {String} sub_address 				Subscribe app remote IP address 
 * @param {String} sub_name    				Subscribe name
 */
Spacebrew.Client.prototype._updateRoute = function ( type, pub_client, pub_address, pub_name, sub_client, sub_address, sub_name ){
	var new_route
		, route_type
		, subscribe
		, publish
		;

	// if request type is not supported then abort
	if (type !== "add" && type !== "remove") return;
	console.log("[_updateRoute] changing routes " + type);

	// check if pub and sub information was in first two arguments. If so then 
	if ((pub_client.clientName && pub_client.remoteAddress && pub_client.name && pub_client.type) &&
		(pub_address.clientName && pub_address.remoteAddress && pub_address.name && pub_address.type)) {
		new_route = {
			route: {
				type: type,
				publisher: pub_client,
				subscriber: pub_address				
			}
		}

		if (type === "add") {
			for (var i = 0; i < this.admin.routes.length; i++) {
				if (!this._compareRoutes(new_route, this.admin.routes[i])) this.admin.routes.push(new_route);
			}
		}

		else if (type === "remove") {
			for (var i = this.admin.routes.length - 1; i >= 0; i--) {
				if (this._compareRoutes(new_route, this.admin.routes[i])) this.admin.routes.splice(i,i);
			}
		}

		console.log("[_updateRoute] sending route to admin ", JSON.stringify(new_route));

		this.socket.send(JSON.stringify(new_route));
		return;
	}

	pub_type = this.getPublishType(pub_client, pub_address, pub_name);
	sub_type = this.getSubscribeType(pub_client, pub_address, pub_name);
	if (pub_type != sub_type && pub_type != undefined) {
		console.log("[_updateRoute] unable to create route because of type mismatch - pub:" + pub_type + " sub:  " + sub_type);
		return;
	}

	publish = {
		clientName: pub_client,
		remoteAddress: pub_address,
		name: pub_name,
		type: pub_type
	}

	console.log("[_updateRoute] create pub object ", publish);

	subscribe = {
		clientName: sub_client,
		remoteAddress: sub_address,
		name: sub_name,
		type: sub_type
	}

	console.log("[_updateRoute] create sub object ", subscribe);

	// call itself with publish and subscribe objects properly formatted
	this._updateRoute(type, publish, subscribe);
}

Spacebrew.Client.prototype._compareRoutes = function (route_a, route_b){
	if ((route_a.clientName === route_b.clientName) &&
		(route_a.name === route_b.name) &&
		(route_a.type === route_b.type) &&
		(route_a.remoteAddress === route_b.remoteAddress)) {
		return true;
	}
	return false;
}

Spacebrew.Client.prototype.getPublishType = function (client_name, remoteAddress, pub_name){
	return this._getPubSubType("publish", client_name, remoteAddress, pub_name);
}

Spacebrew.Client.prototype.getSubscribeType = function (client_name, remoteAddress, sub_name){
	return this._getPubSubType("subscribe", client_name, remoteAddress, sub_name);
}

Spacebrew.Client.prototype._getPubSubType = function (pub_or_sub, client_name, remoteAddress, pub_sub_name){
	var clients;

	for( var j = 0; j < this.admin.clients.length; j++ ){
		client = this.admin.clients[j];
		if ( client.name === client_name && client.remoteAddress === remoteAddress ) {
			for( var i = 0; i < client[pub_or_sub].messages.length; i++ ){
				if (client[pub_or_sub].messages[i].name === pub_sub_name) {
					return client[pub_or_sub].messages[i].type;
				}
			}
		}
	}
	return false;
}
