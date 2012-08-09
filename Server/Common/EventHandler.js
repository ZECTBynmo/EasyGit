//////////////////////////////////////////////////////////////////////////
// EventHandler - Server Side
//////////////////////////////////////////////////////////////////////////
//
// This is a generic interface to setup events in a class. 
//
// We want to be able to say this:
// 		someClass.on( "someEventName", function( eventData ) { do something }
//
// A class can create an event like this:
/*
	eventHandler.createEvent( "myEventName" );
*/
// A class can set up the on("some event") functionality like this:
/*
	someClass.prototype.on = function( eventName, callback ) {
		eventHandler.addEventCallback( eventName, callback );
	}
	
*/
// To trigger an event, you can call "fireEvent( eventName )"
//
// Give the event handler a name if you want to have legible debug statements.
// This is a big help, because debugging can be difficult when events have
// a complicated structure.
/* ----------------------------------------------------------------------
                                                    Object Structures
-------------------------------------------------------------------------
	var event = {
		name: some name,
		callbackList: some array of callbacks
	}
	
	var eventTraits = {
		callback: some callback (),
		callbackScope: some scope {},
		shouldCreateEvent: should we create a new even if we haven't heard of this eventName before
	}
	
	var callback = {
		callback: some function,
		callbackScope: optional scope argument, allows you to pass some 
		               arbitrary scope in while setting up the callback,
					   and get it back when an event occurs
	}
*/
//////////////////////////////////////////////////////////////////////////
// Node.js Exports
var globalNamespace = {};
(function (exports) {
	exports.createNewEventHandler = function( name ) {
		newEventHandler= new EventHandler( name );
		return newEventHandler;
	};
}(typeof exports === 'object' && exports || globalNamespace));


//////////////////////////////////////////////////////////////////////////
// Namespace (lol)
var DEBUG = true;
var log = function( text ) {
	if( DEBUG ) console.log( text ) ;
}

//////////////////////////////////////////////////////////////////////////
// Constructor
function EventHandler( name ) {
	this.name = name;
	this.eventList = {};
} // end EventHandler()


//////////////////////////////////////////////////////////////////////////
// Creates a new event that others can listen for
EventHandler.prototype.createEvent = function( eventName ) {
	var newEvent = {
		callbackList: new Array()
	}

	this.eventList[eventName] = newEvent;
	
	log( this.name + " event created: " + eventName );
}; // end createEvent()


//////////////////////////////////////////////////////////////////////////
// Deletes an event
EventHandler.prototype.deleteEvent = function( eventName ) {
	delete this.eventList[eventName];
}; // end deleteEvent()


//////////////////////////////////////////////////////////////////////////
// Adds a callback to an event's list
EventHandler.prototype.addEventCallback = function( eventName, callbackOrTraits ) {
	var traits = {};
	/*
		traits = {
			callback: some callback (),
			callback scope: some scope {},
			callbackIfNew: if this is the first time we've heard of eventName then call this,
			shouldCreateEvent: should we create a new even if we haven't heard of this eventName before
		}
	*/
	
	if( typeof(callbackOrTraits) == "undefined" ) { 
		log( "Tried to add a callback with no callback" );
		return;
	}
	
	// Construct our traits based on what we were given
	if( typeof(callbackOrTraits) == "function" ) {
		// We were given a callback
		traits.callback = callbackOrTraits;
	} else {
		// We were given some traits
		traits = callbackOrTraits;
	}

	// Create our new callback
	var newCallback = {
		callback: traits.callback,
		callbackScope: traits.callbackScope
	}
	
	console.log( require("util").inspect(traits) );

	// Push the new callback into the event callback list
	var event = this.eventList[eventName];
	if( typeof(event) != "undefined" ) {
		log( "Adding callback for " + eventName );
		event.callbackList.push( newCallback );
	} else {
		if( traits.shouldCreateEvent ) { 
			this.createEvent( eventName );
			this.eventList[eventName].callbackList.push( newCallback );
			if( typeof(traits.callbackIfNew) != "undefined" )
				traits.callbackIfNew( eventName );
		} else {
			console.log( "Didn't create event " + eventName );
		}
	}
	
	delete newCallback;
}; // end EventHandler.addEventCallback()


//////////////////////////////////////////////////////////////////////////
// Call all callback functions attached to an event
EventHandler.prototype.fireEvent = function( eventName, data ) {
	var event = this.eventList[eventName];
	
	// Just return if we don't have this event yet
	if( typeof(event) == "undefined" ) {
		log( "Tried to fire a " + this.name + " event that didn't exist: " + eventName );
		log( "It had data: " + require("util").inspect(data) );
		return;
	}
	
	var callbackList = event.callbackList;
	
	log( this.name + " event fired: " + eventName + " with " + callbackList.length + " callbacks" );

	for( var iCallback=0; iCallback<callbackList.length; ++iCallback ) {
		var callback = callbackList[iCallback];
	
		if( typeof( callback.callback ) != "function" ) console.log( require("util").inspect(callback) );
	
		if( typeof(callback.callbackScope) == "undefined" ) {
			callback.callback( data );
		} else {
			callback.callback( data, callback.callbackScope );
		}
	}
}; // end EventHandler.fireEvent()