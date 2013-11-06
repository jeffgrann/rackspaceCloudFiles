//****************************************************************************************************
// MODULE: http
//****************************************************************************************************
//|
//| http v1.0
//| =========
//|
//| http is a unified Javascript RequireJS/CommonJS module for the browser or Wakanda Server (SSJS)
//| which provides basic http support. 
//|
//| TOC
//|
//| Dependencies
//| ------------
//|
//| * [RequireJS](http://requirejs.org) on the client (browser) side.
//| * [Wakanda](http://www.wakanda.org) v6+.
//|
//| Script Files
//| ------------
//|
//| * http.js - Fully commented script. Update to contribute.
//| * http.min.js - Minimized script. For normal use.
//| * http.no-md.js - Commented script without markdown comments. Use for debugging.
//----------------------------------------------------------------------------------------------------
({define: typeof define === 'function' ? define : function (A,F) {var I = F.apply(null, A.map(require)); Object.keys(I).forEach(function(k) {exports[k] = I[k];});}}).define(

[], // No module dependencies.

function () {
	"use strict";
	
	var isAuthErrorResponse;
	var isErrorResponse;
	var publicInterface;
	var responseHeadersToObject;
	var STATUS_CODES;
	var statusText;
	
	//****************************************************************************************************
	// Constants
	//****************************************************************************************************
	//|
	//| Constants
	//| ---------
	//----------------------------------------------------------------------------------------------------
		
	//| ### HEADER\_FIELD\_NAMES (Alias: HFN)
	//| Standard and common custom HTTP header field names. See the module code for specific values. 
	//|
	//| Examples:
	//|
	//| ```javascript
	//| xhr.setRequestHeader(http.HEADER_FIELD_NAMES.CONTENT_TYPE, "text/plain");	
	//| ```
	//|

	HEADER_FIELD_NAMES = HFN =
		{
			ACCEPT						: 'Accept',
			ACCEPT_CHARSET				: 'Accept-Charset',
			ACCEPT_ENCODING				: 'Accept-Encoding',
			ACCEPT_LANGUAGE				: 'Accept-Language',
			ACCEPT_RANGES				: 'Accept-Ranges',
			AGE							: 'Age',
			ALLOW						: 'Allow',
			AUTHORIZATION				: 'Authorization',
			CACHE_CONTROL				: 'Cache-Control',
			CONNECTION					: 'Connection',
			CONTENT_ENCODING			: 'Content-Encoding',
			CONTENT_LANGUAGE			: 'Content-Language',
			CONTENT_LENGTH				: 'Content-Length',
			CONTENT_LOCATION			: 'Content-Location',
			CONTENT_MD5					: 'Content-MD5',
			CONTENT_RANGE				: 'Content-Range',
			CONTENT_TYPE 				: 'Content-Type',
			DATE						: 'Date',
			ETAG						: 'ETag',
			EXPECT						: 'Expect',
			EXPIRES						: 'Expires',
			FROM						: 'From',
			IF_MATCH					: 'If-Match',
			IF_MODIFIED_SINCE			: 'If-Modified-Since',
			IF_NONE_MATCH				: 'If-None-Match',
			IF_RANGE					: 'If-Range',
			IF_UNMODIFIED_SINCE			: 'If-Unmodified-Since',
			LAST_MODIFIED				: 'Last-Modified',
			LOCATION					: 'Location',
			MAX_FORWARDS				: 'Max-Forwards',
			PRAGMA						: 'Pragma',
			PROXY_AUTHENTICATE			: 'Proxy-Authenticate',
			PROXY_AUTHORIZATION			: 'Proxy-Authorization',
			RANGE						: 'Range',
			REFERER						: 'Referer',
			RETRY_AFTER					: 'Retry-After',
			SERVER						: 'Server',
			TE							: 'TE',
			TRAILER						: 'Trailer',
			TRANSFER_ENCODING			: 'Transfer-Encoding',
			UPGRADE						: 'Upgrade',
			USER_AGENT					: 'User-Agent',
			VARY						: 'Vary',
			VIA							: 'Via',
			WARNING						: 'Warning',
			WWW_AUTHENTICATE			: 'WWW-Authenticate',
			X_ACCOUNT_BYTES_USED		: 'X-Account-Bytes-Used',
			X_ACCOUNT_CONTAINER_COUNT	: 'X-Account-Container-Count',
			X_ACCOUNT_OBJECT_COUNT		: 'X-Account-Object-Count',
			X_AUTH_KEY 					: 'X-Auth-Key',
			X_AUTH_TOKEN 				: 'X-Auth-Token',
			X_AUTH_USER 				: 'X-Auth-User',
			X_CDN_ENABLED				: 'X-CDN-Enabled',
			X_CDN_IOS_URI				: 'X-Cdn-Ios-Uri',
			X_CDN_MANAGEMENT_URL 		: 'X-CDN-Management-Url',
			X_CDN_SSL_URI				: 'X-Cdn-Ssl-Uri',
			X_CDN_STREAMING_URI			: 'X-Cdn-Streaming-Uri',
			X_CDN_URI					: 'X-Cdn-Uri',
			X_CONTAINER_BYTES_USED		: 'X-Container-Bytes-Used',
			X_CONTAINER_META			: 'X-Container-Meta-',
			X_CONTAINER_OBJECT_COUNT 	: 'X-Container-Object-Count',
			X_COPY_FROM					: 'X-Copy-From',
			X_DELETE_AFTER				: 'X-Delete-After',
			X_DELETE_AT					: 'X-Delete-At',
			X_OBJECT_META				: 'X-Object-Meta-',
			X_REMOVE_CONTAINER_META		: 'X-Remove-Container-Meta-',
			X_STORAGE_TOKEN 			: 'X-Storage-Token',
			X_STORAGE_URL 				: 'X-Storage-Url'
		};
		
	Object.freeze(HEADER_FIELD_NAMES);

	//| ### STATUS\_CODES
	//| The HTTP protocol status codes. See the module code for specific values. 
	//|
	//| Examples:
	//|
	//| ```javascript
	//| http.STATUS_CODES.OK; // 200
	//| ```
	//|

	STATUS_CODES =
		{
			CONTINUE						: 100,
			SWITCHING_PROTOCOLS				: 101,
			PROCESSING						: 102,
			OK								: 200,
			CREATED							: 201,
			ACCEPTED						: 202,
			NONAUTHORITATIVE_INFORMATION	: 203,
			NO_CONTENT						: 204,
			RESET_CONTENT					: 205,
			PARTIAL_CONTENT					: 206,
			MULTISTATIS						: 207,
			IM_USED							: 226,
			MULTIPLE_CHOICES				: 300,
			MOVED_PERMANENTLY				: 301,
			FOUND							: 302,
			SEE_OTHER						: 303,
			NOT_MODIFIED					: 304,
			USE_PROXY						: 305,
			TEMPORARY_REDIRECT				: 307,
			PERMANENT_REDIRECT				: 308,
			BAD_REQUEST						: 400,
			UNAUTHORIZED		 			: 401,
			PAYMENT_REQUIRED				: 402,
			FORBIDDEN						: 403,
			NOT_FOUND						: 404,
			METHOD_NOT_ALLOWED				: 405,
			NOT_ACCEPTABLE					: 406,
			PROXY_AUTHENTICATION_REQUIRED	: 407,
			REQUEST_TIMEOUT					: 408,
			CONFLICT						: 409,
			GONE							: 410,
			LENGTH_REQUIRED					: 411,
			PRECONDITION_FAILED				: 412,
			PAYLOAD_TOO_LARGE				: 413,
			URI_TOO_LONG					: 414,
			UNSUPPORTED_MEDIA_TYPE			: 415,
			RANGE_NOT_SATISFIABLE			: 416,
			EXPECTATION_FAILED				: 417,
			UNPROCESSABLE_ENTITY			: 422,
			LOCKED							: 423,
			FAILED_DEPENDENCY				: 424,
			UPGRADE_REQUIRED				: 426,
			PRECONDITION_REQUIRED			: 428,
			TOO_MANY_REQUESTS				: 429,
			REQUEST_HEADER_FIELDS_TOO_LARGE	: 431,
			UNAVAILABLE_FOR_LEGAL_REASONS	: 451,
			INTERNAL_SERVER_ERROR			: 500,
			NOT_IMPLEMENTED					: 501,
			BAD_GATEWAY						: 502,
			SERVICE_UNAVAILABLE				: 503,
			GATEWAY_TIMEOUT					: 504,
			HTTP_VERSION_NOT_SUPPORTED		: 505,
			INSUFFICIENT_STORAGE			: 507,
			NETWORK_AUTHENTICATION_REQUIRED	: 511
		};

	Object.freeze(STATUS_CODES);

	//****************************************************************************************************
	//|
	//| Module Functions
	//| ----------------
	//****************************************************************************************************

	//****************************************************************************************************
	// isAuthErrorResponse
	//****************************************************************************************************
	//| ### isAuthErrorResponse (xhr)
	//|
	//| Determines if the status within `xhr` indicates that an authentication error (401) occurred.
	//|
	//| #### Arguments
	//|
	//| * `xhr` - An XMLHttpRequest object.
	//|
	//| #### Return Value
	//|
	//| * Returns *true* if `xhr` indicates an authentication error and returns *false* otherwise.
	//|
	//| Examples:
	//|
	//| ```javascript
	//| ....
	//| xhr.send();
	//|
	//| if (http.isAuthErrorResponse(xhr)) {
	//|     // Reauthorize and try again.
	//| }
	//| ```
	//----------------------------------------------------------------------------------------------------
	isAuthErrorResponse = function isAuthErrorResponse (xhr) {
		return xhr.status === STATUS_CODES.UNAUTHORIZED;
	};

	//****************************************************************************************************
	// isErrorResponse
	//****************************************************************************************************
	//| ### isErrorResponse (xhr)
	//|
	//| Determines if the status within `xhr` indicates that an error occurred.
	//|
	//| #### Arguments
	//|
	//| * `xhr` - An XMLHttpRequest object.
	//|
	//| #### Return Value
	//|
	//| * Returns *true* if `xhr` indicates an error and returns *false* otherwise.
	//|
	//| Examples:
	//|
	//| ```javascript
	//| ....
	//| xhr.send();
	//|
	//| if (http.isErrorResponse(xhr)) {
	//|     // Handle the error.
	//| }
	//| ```
	//----------------------------------------------------------------------------------------------------
	isErrorResponse = function isErrorResponse (xhr) {
		return xhr.status < 200 || xhr.status > 299;
	};
	
	//****************************************************************************************************
	// responseHeadersToObject
	//****************************************************************************************************
	//| ### responseHeadersToObject (xhr)
	//|
	//| Converts the response headers in `xhr` into a javascript object where the response fields become
	//| the object's properties with their corresponding values. 
	//|
	//| #### Arguments
	//|
	//| * `xhr` - An XMLHttpRequest object.
	//|
	//| #### Return Value
	//|
	//| * Returns the response headers within `xhr` as a javascript object.
	//|
	//| Examples:
	//|
	//| ```javascript
	//| ....
	//| xhr.send();
	//|
	//| headers = http.responseHeadersToObject(xhr);
	//|
	//| // headers ==> {
	//| //                  "Content-Length": 583727,
	//| //                  "Content-Type": "text/html; charset=utf-8",
	//| //                  "Last-Modified": "Tue, 15 Nov 1994 12:45:26 +0000"
	//| //             }
	//| ```
	//----------------------------------------------------------------------------------------------------
	responseHeadersToObject = function responseHeadersToObject (xhr) {
		var headerLines;
		var result = {};
		
		headerLines = xhr.getAllResponseHeaders().split('\n');
		
		headerLines.forEach(function (line) {
								var firstColonPos;
								var key;
								var value;
								
								firstColonPos = line.indexOf(':');
								
								if (firstColonPos >= 0) {
									key = line.substring(0, firstColonPos).trim();
									
									if (key !== '') {
										value = line.substring(firstColonPos + 1).replace(/[\r\n]/g, '').trim();
										result[key] = value;
									}
								}
							});
							
		return result;
	};

	//****************************************************************************************************
	// statusText
	//****************************************************************************************************
	//| ### statusText (xhr)
	//|
	//| Returns a textual representation of the status within `xhr`.
	//|
	//| #### Arguments
	//|
	//| * `xhr` - An XMLHttpRequest object.
	//|
	//| #### Return Value
	//|
	//| * See description.
	//|
	//| Examples:
	//|
	//| ```javascript
	//| ....
	//| xhr.send();
	//|
	//| http.statusText(xhr); // "200 OK"
	//| ```
	//----------------------------------------------------------------------------------------------------
	statusText = function statusText (xhr) {
		return xhr.status === 0 ? 'A communication error occurred.' : xhr.status + ' ' + xhr.statusText;
	};
		
	//****************************************************************************************************
	// Set this module's public interface.
	//****************************************************************************************************
	publicInterface = {};

	publicInterface.HEADER_FIELD_NAMES 		= HEADER_FIELD_NAMES;
	publicInterface.HFN 					= HFN;
	publicInterface.isAuthErrorResponse 	= isAuthErrorResponse;
	publicInterface.isErrorResponse 		= isErrorResponse;
	publicInterface.responseHeadersToObject = responseHeadersToObject;
	publicInterface.STATUS_CODES			= STATUS_CODES;
	publicInterface.statusText 				= statusText;
	
	return publicInterface;
});

//****************************************************************************************************
//|
//| Contributions
//| -------------
//****************************************************************************************************
//| If you contribute to this library, just modify `http.js` and send a pull request. Please remember
//| to update the markdown if the public interface changes. 
//----------------------------------------------------------------------------------------------------

//****************************************************************************************************
//|
//| License
//| -------
//****************************************************************************************************
//| Licensed under MIT.
//| 
//| Copyright (C) 2013 [Jeff Grann](https://github.com/jeffgrann) <jeff@successware.net>
//|
//| Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//| associated documentation files (the "Software"), to deal in the Software without restriction,
//| including without limitation the rights to use, copy, modify, merge, publish, distribute,
//| sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
//| furnished to do so, subject to the following conditions: 
//|
//| The above copyright notice and this permission notice shall be included in all copies or substantial
//| portions of the Software. 
//|
//| THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
//| NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
//| NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
//| DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
//| OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
