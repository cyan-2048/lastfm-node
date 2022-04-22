# lastfm-node

Read and write to users recent plays on Last.fm.

Changes made by cyan:

-   get rid of underscore dependency
-   get rid of useragent option(useless imo)
-   get rid of port option(browser fetch does not have such option)
-   remove crypto dependency(big bloat, only need md5)
-   remove http dependency(will use fetch)
-   use ES6 classes
-   use more lightweight [EventEmitter](https://github.com/billjs/event-emitter)
-   remove unnecessary things not needed for zMusic

## Installation

    	1. add md5 library script of choice (function name must be `md5()`)
    	2. add script tag with js file

## Usage

    var LastFmNode = require('lastfm').LastFmNode;

    var lastfm = new LastFmNode({
      api_key: 'apikey',    // sign-up for a key at http://www.last.fm/api
      secret: 'secret',
    });

## Documentation

### LastFmRequest (all write methods are removed except scrobble and nowplaying)

    lastfm.request(method, options);

Returns a `LastFmRequest` instance.

Send request to Last.fm. Requests automatically include the API key and are signed and/or sent via POST as described in the Last.fm API documentation.

Methods:

Accepts any Last.fm API method name, eg "artist.getInfo".

Options:

All options are passed through to Last.fm with the exception of the following.

-   _write_

          Force request to act as a write method. Write methods are signed and sent via POST. Useful for new methods not yet recognised by lastfm-node.

-   _signed_

          Force request to be signed. See Last.fm API docs for signature details. Useful for new methods not yet recognised by lastfm-node.

-   _handlers_

          Default event handlers to attach to the request object on creation.

Events:

-   _success(json)_

          JSON response from Last.fm

-   _error(error)_

          Ruh-roh. Either a error returned by Last.fm or a transmission error.

### RecentTracksStream (removed, class not implemented)

    lastfm.stream(username);

Returns: a `RecentTracksStream` instance

Methods:

-   _start()_

          Start streaming recent track info.

-   _stop()_

          Stop streaming recent track info.

-   _isStreaming()_

          Boolean. True is nowplaying/recent track data is being actively fetched.

-   _on(event, listener)_

          Adds a listener for the specified event.

-   _removeListener(event, listener)_

          Removes the listener for the specified event.

Options:

-   _autostart_

          Start streaming automatically. Defaults to false.

-   _extended_

          Includes extended data in each artist, and whether or not the user has loved each track

-   _handlers_

          Default event handlers to attach to the request object on creation.

Events:

-   _lastPlayed(track)_

          The user's last scrobbled track.

-   _nowPlaying(track)_

          Track the user is currently listening to.

-   _scrobbled(track)_

          Now playing track has been scrobbled.

-   _stoppedPlaying(track)_

          User stopped listening to current track.

-   _error(error)_

          Ruh-roh.

### LastFmSession

    lastfm.session(options);

Returns: a `LastFmSession` instance.

If the user and session key are already known supply these in the options. Otherwise supply a token for authorisation. When a token is supplied the session will be authorised with Last.fm. If the user has not yet approved the token (desktop application flow) then authorisation will be automatically retried.

See the last.fm API documentation for more info on Last.fm authorisation flow.

Options:

-   _user_

          User name, if known.

-   _key_

          Session key, if known.

-   _token_

          Token supplied by auth.getToken or web flow callback.

-   _retryInterval_

          Time in milliseconds to leave between retries. Defaults to 10 seconds.

-   _handlers_

          Default event handlers to attach to the session object on creation.

Public properties:

-   _user_

          The username of the Last.fm user associated with the session.

-   _key_

          The session key. Either passed in or generated using authorise().

Methods:

-   _authorise(token, [options])_

          Deprecated. Use lastfm.session({ token: token }) instead.
          Authorises user with Last.fm api. See last.fm documentation. Options argument has handlers property that has default event handlers to attach to the LastFmSession instance.

-   _on(event, handler)_

          Adds a listener for the specified event.

-   _removeListener(event, handler)_

          Removes the listener for the specified event.

-   _isAuthorised()_

          Returns true if the session has been authorised or a key was specified in the constructor.

-   _cancel()_

          Prevent any further authorisation retries. Only applies if token supplied.

Events:

-   _success(session)_

          Authorisation of session was successful.
          Note: Only emitted if a token was supplied in options. Username/key combinations supplied in options are assumed to be valid.

-   _authorised(session)_

          Deprecated: Use success instead.
          Authorisation of session was successful.

-   _retrying(retry)_

         Authorisation request was not successful but will be retried after a delay. Retry object contains the following properties:
         `delay` - The time in milliseconds before the request will be retried.
         `error` - The error code returned by the Last.fm API.
         `message` - The error message returned by the Last.fm API.

-   _error(track, error)_

          The authorisation was not successful and will not be retried.

### LastFmUpdate

    lastfm.update(method, session, options);

Returns a `LastFmUpdate` instance.

Valid methods are 'nowplaying' and 'scrobble'.

An authorised `LastFmSession` instance is required to make a successful update.

If a scrobble request receives an 11 (service offline), 16 (temporarily unavailable) or 29 (rate limit exceeded) error code from Last.fm then the request is automatically retried until it is permanently rejected or accepted. The first retry attempt is made after 10 seconds with subsequent requests delayed by 30 seconds, 1 minute, 5 minutes, 15 minutes and then every 30 minutes.

Options:

Accepts all parameters used by track.updateNowPlaying and user.scrobble (see Last.Fm API) as well as:

-   _track_

          Track for nowplaying and scrobble requests. Uses same format as returned by `RecentTracksStream` events.

-   _timestamp_

          Required for scrobble requests. Timestamp is in unix time (seconds since 01-01-1970 and is in UTC time).

-   _handlers_

          Default event handlers to attach to the request object on creation.

Events:

-   _success(track)_

         Update request was successful.

-   _retrying(retry)_

         Scrobble request was not successful but will be retried after a delay. Retry object contains the following properties:
         `delay` - The time in milliseconds before the request will be retried.
         `error` - The error code returned by the Last.fm API.
         `message` - The error message returned by the Last.fm API.

-   _error(track, error)_

          Ruh-roh.

### LastFmInfo (removed, class not implemented)

    lastfm.info(itemtype, [options]);

Returns: a `LastFmInfo` instance.

Gets extended info about specified item.

Public properties:

-   _itemtype_

          Any Last.fm item with a getInfo method. eg user, track, artist, etc.

Options:

-   _handlers_

          Event handlers to attach to object at creation.

-   _various_

         Params as specified in Last.fm API, eg user: "username"

Special cases:

When requesting track info the `track` param can be either the track name or a track object as returned by `RecentTracksStream`.

## Example

    var LastFmNode = require('lastfm').LastFmNode;

    var lastfm = new LastFmNode({
      api_key: 'abc',
      secret: 'secret'
    });

    var trackStream = lastfm.stream('username');

    trackStream.on('lastPlayed', function(track) {
      console.log('Last played: ' + track.name);
    });

    trackStream.on('nowPlaying', function(track) {
      console.log('Now playing: ' + track.name);
    });

    trackStream.on('scrobbled', function(track) {
      console.log('Scrobbled: ' + track.name);
    });

    trackStream.on('stoppedPlaying', function(track) {
      console.log('Stopped playing: ' + track.name);
    });

    trackStream.on('error', function(error) {
      console.log('Error: '  + error.message);
    });

    trackStream.start();

    var session = lastfm.session({
       token: token,
       handlers: {
          success: function(session) {
             lastfm.update('nowplaying', session, { track: track } );
             lastfm.update('scrobble', session, { track: track, timestamp: 12345678 });
          }
       }
    });

    var request = lastfm.request("artist.getInfo", {
        artist: "The Mae Shi",
        handlers: {
            success: function(data) {
                console.log("Success: " + data);
            },
            error: function(error) {
                console.log("Error: " + error.message);
            }
        }
    });

## Influences

Heavily drawn from technoweenie's twitter-node  
http://github.com/technoweenie/twitter-node

## Contributors

-   Garret Wilkin (garrettwilkin) - http://geethink.com
-   Uwe L. Korn (xhochy) - http://xhochy.com
-   Max Kueng (maxkueng) - http://maxkueng.com
