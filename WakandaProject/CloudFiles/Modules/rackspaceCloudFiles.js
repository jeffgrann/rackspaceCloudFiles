//****************************************************************************************************
// MODULE: rackspaceCloudFiles
//****************************************************************************************************
//|
//| rackspaceCloudFiles v1.0.1
//| ==========================
//|
//| rackspaceCloudFiles is a [Wakanda](http://www.wakanda.org) [CommonJS](http://www.commonjs.org)
//| module which provides a javascript interface to the [rackspace](http://www.rackspace.com) 
//| [CloudFiles](http://www.rackspace.com/cloud/files/) 
//| [API](http://docs.rackspace.com/files/api/v1/cf-devguide/cf-devguide-20130926.pdf).
//|
//| TOC
//|
//| Example
//| -------
//|
//| ```javascript
//| var cloudFiles = require('rackspaceCloudFiles');
//|
//| var myAccount = cloudFiles.login('myUserName', 'myApiKey');   // Login to the CloudFiles account.
//| var imageContainer = myAccount.container('images').create();  // Create a container.
//| imageContainer.file('image1.jpg')							  // Upload a file to the container.
//|               .upload(File(ds.getModelFolder().path + 'testFiles/image1.jpg'));
//|```
//|
//| Dependencies
//| ------------
//|
//| * [http](https://github.com/jeffgrann/http) (tested with v1.0) - PROVIDED
//| * [httpRequests](https://github.com/jeffgrann/httpRequests) (tested with v1.0) - PROVIDED
//| * [mimeTypes](https://github.com/jeffgrann/mimeTypes) (tested with v1.0) - PROVIDED
//| * [underscore](http://underscorejs.org) (tested with v1.5.1)
//| * [Wakanda](http://www.wakanda.org) v6+ (tested with v6 build 6.144914)
//----------------------------------------------------------------------------------------------------

"use strict";

var _;
var Account;
var ACCOUNT_LOCATIONS;
var authenticate;
var Container;
var ContainerFile;
var extractCustomMetaData;
var FileList;
var fileMimeType;
var getContainerCdnMetaData;
var getContainerFileList;
var getFileMD5;
var HEADER;
var login;
var mimeType;
var RACKSPACE_DEFAULTS;
var setGetFileMD5Function;

_ 				= require('underscore');
http 			= require('http');
httpRequests 	= require('httpRequests');
fileMimeType 	= require('mimeTypes');

HEADER = http.HEADER_FIELD_NAMES; // Alias for imported header field names.

//****************************************************************************************************
// Constants
//****************************************************************************************************
//|
//| Constants
//| ---------
//----------------------------------------------------------------------------------------------------
		
//| ### ACCOUNT\_LOCATIONS
//| To login to rackspace CloudFiles, you must know where your account is based. Your account may be
//| based in either the US or the UK. This is not determined by your physical location but by the
//| location of the Rackspace site which was used to create your account. 
//|
//| * UK - Specifies that the rackspace account is based in the United Kingdom.
//| * US - Specifies that the rackspace account is based in the United States.
//|
//| Examples:
//|
//| ```javascript
//| var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.US);
//| var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.UK);
//| var myAccount = cloudFiles.login('myUserName', 'myApiKey');  // The default is US.
//| ```
//|

ACCOUNT_LOCATIONS =
	{
		UK : 'UK',
		US : 'US'
	};

Object.freeze(ACCOUNT_LOCATIONS);

//| ### DELETE\_OPTIONS
//| Normally, CloudFiles will not allow the deletion of a container if it contains files. You can force
//| the deletion of a container even if it contains files by passing the DELETE\_EVEN\_IF\_NOT\_EMPTY
//| constant to the container's [remove()](#CONTAINER.REMOVE) method.
//|
//| * DELETE\_EVEN\_IF\_NOT\_EMPTY - Specifies that the container should be removed even if it contains files.
//| * DELETE\_ONLY\_IF\_EMPTY - Specifies that the container should not be removed it if contains files.
//| * FORCE\_DELETE - Alias for DELETE\_EVEN\_IF\_NOT\_EMPTY.
//|
//| Examples:
//|
//| ```javascript
//| myContainer.remove(cloudFiles.DELETE_OPTIONS.DELETE_EVEN_IF_NOT_EMPTY);
//| ```
//|

DELETE_OPTIONS =
	{
		DELETE_EVEN_IF_NOT_EMPTY : 'DELETE_EVEN_IF_NOT_EMPTY',
		DELETE_ONLY_IF_EMPTY 	 : 'DELETE_IF_EMPTY_ONLY'
	}
	
DELETE_OPTIONS.FORCE_DELETE = DELETE_OPTIONS.DELETE_EVEN_IF_NOT_EMPTY;
	
Object.freeze(DELETE_OPTIONS);

RACKSPACE_DEFAULTS =
	{
		RETRIEVAL_BATCH_LIMIT : 10000
	};
	
Object.freeze(RACKSPACE_DEFAULTS);

//****************************************************************************************************
// Private Module Functions
//****************************************************************************************************

//****************************************************************************************************
// Account constructor
//****************************************************************************************************
Account = function Account (username, apiKey, accountLocation) {	
	this.username = username;
	this.apiKey = apiKey;
	this.accountLocation = typeof accountLocation === 'string' && ACCOUNT_LOCATIONS.hasOwnProperty(accountLocation) ? accountLocation : ACCOUNT_LOCATIONS.US;
};

//****************************************************************************************************
// authenticate
//****************************************************************************************************
// Attempt to log into the rackspace CloudFiles service and, if successful, save the returned
// information in the given account object. 
//----------------------------------------------------------------------------------------------------
authenticate = function authenticate (account) {
	var url;
	var xhr;
	
	switch (account.accountLocation) {
		case ACCOUNT_LOCATIONS.UK:
			url = 'https://lon.identity.api.rackspacecloud.com/v1.0';
			break;
			
		case ACCOUNT_LOCATIONS.US:
			url = 'https://identity.api.rackspacecloud.com/v1.0';
			break;
	}
	
	xhr =
		httpRequests
			.get(url)
			.setHeaders(
				function (xhr) {
					xhr.setRequestHeader(HEADER.X_AUTH_USER, account.username);
					xhr.setRequestHeader(HEADER.X_AUTH_KEY, account.apiKey);
				})
			.send();

	account._authToken 			= xhr.getResponseHeader(HEADER.X_AUTH_TOKEN);
	account._CDNManagementUrl 	= xhr.getResponseHeader(HEADER.X_CDN_MANAGEMENT_URL);
	account._storageToken 		= xhr.getResponseHeader(HEADER.X_STORAGE_TOKEN);
	account._storageUrl 		= xhr.getResponseHeader(HEADER.X_STORAGE_URL);
	
	return account;
};

//****************************************************************************************************
// Container constructor
//****************************************************************************************************
Container = function Container (account, name) {
	if (name.indexOf('/') >= 0) {
		throw new Error("Could not create a rackspace container object with a name of '" + containerName + "'. Container names cannot contain forward slash characters.");
	}
	
	this._account = account;
	this._name = name;
	this._encodedName = encodeURIComponent(this._name);
	this._fullPath = this._account._storageUrl + "/" + this._encodedName;
};

//****************************************************************************************************
// ContainerFile constructor
//****************************************************************************************************
ContainerFile = function ContainerFile (container, fileName) {
	this._container = container;
	this._fileName = fileName;
	this._encodedFileName = encodeURIComponent(this._fileName);
	this._fullPath = this._container._fullPath + '/' + this._encodedFileName;
};

//****************************************************************************************************
// ContainerList constructor
//****************************************************************************************************
ContainerList = function ContainerList (account, batchLimit) {
	batchLimit = _.isNumber(batchLimit) && batchLimit > 0 && batchLimit <= RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT ? batchLimit : RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT;
	
	this._account = account;
	this._list = null;
	this._batchLimit = batchLimit;
};

//****************************************************************************************************
// extractCustomMetaData
//****************************************************************************************************
// Return a copy of the given object, filtered to only have values for the keys that begin with the
// given metaDataPrefix while removing the metaDataPrefix from the key names.
//----------------------------------------------------------------------------------------------------
extractCustomMetaData = function extractCustomMetaData (object, metaDataPrefix) {
	var result;
	
	result = _.chain(_.pairs(object)) 														// Get an array containing arrays of the object's key/value pairs [[k1,v1], [k2,v2]].
		   	.filter(function (pair) {return pair[0].indexOf(metaDataPrefix) === 0;}) 		// Remove pairs with keys that don't have the container meta prefix.
		   	.map(function (pair) {return [pair[0].replace(metaDataPrefix, ''), pair[1]];}) 	// Remove the container meta prefix from the keys.
		   	.object() 																		// Turn the array of key/value pairs into an object.
		   	.value();
		   	
	return result;
};

//****************************************************************************************************
// FileList constructor
//****************************************************************************************************
FileList = function FileList (container, batchLimit) {
	batchLimit = _.isNumber(batchLimit) && batchLimit > 0 && batchLimit <= RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT ? batchLimit : RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT;
	
	this._container = container;
	this._list = null;
	this._batchLimit = batchLimit;
};

//****************************************************************************************************
// getAccountContainerList
//****************************************************************************************************
// Returns a list of no more than the given batchLimit of containers for the given account starting at
// the given optional marker. The marker is the name of a container. If the marker is not specified,
// starts at the beginning of the containers. 
//----------------------------------------------------------------------------------------------------
getAccountContainerList = function getAccountContainerList (account, batchLimit, marker) {
	var result;
	var xhr;
	
	xhr =
		httpRequests
			.get(account._storageUrl + '?format=json&limit=' + batchLimit + (marker ? '&marker=' + marker : ''))
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, account._authToken); })
			.setAuthentication(authenticate, account)
			.send();

	result = JSON.parse(xhr.responseText);
	
	if (!_.isArray(result)) {
		throw new Error("Could not parse the response when getting the container listing for a rackspace account.");
	}

	return result;
};

//****************************************************************************************************
// getContainerCdnMetaData
//****************************************************************************************************
// Adds the CDN meta data to the given container.
//----------------------------------------------------------------------------------------------------
getContainerCdnMetaData = function getContainerCdnMetaData (container) {
	var xhr;
	
	xhr =
		httpRequests
			.head(container._account._CDNManagementUrl + "/" + container._encodedName)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, container._account._authToken); })
			.setAuthentication(authenticate, container._account)
			.send();
			  
	container._cdnSslUri = xhr.getResponseHeader(HEADER.X_CDN_SSL_URI);
	container._cdnUri = xhr.getResponseHeader(HEADER.X_CDN_URI);
	container._cdnStreamingUri = xhr.getResponseHeader(HEADER.X_CDN_STREAMING_URI);
	container._cdniOSUri = xhr.getResponseHeader(HEADER.X_CDN_IOS_URI);
};

//****************************************************************************************************
// getContainerFileList
//****************************************************************************************************
// Returns a list of no more than the given batchLimit of files in the given container starting at 
// the given optional marker. The marker is the name of a file. If the marker is not specified, 
// starts at the beginning of the container's files. 
//----------------------------------------------------------------------------------------------------
getContainerFileList = function getContainerFileList (container, batchLimit, marker) {
	var result;
	var xhr;
	
	xhr =
		httpRequests
			.get(container._fullPath + '?format=json&limit=' + batchLimit + (marker ? '&marker=' + marker : ''))
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, container._account._authToken); })
			.setAuthentication(authenticate, container._account)
			.send();
			  
	result = JSON.parse(xhr.responseText);
	
	if (!_.isArray(result)) {
		throw new Error("Could not parse the response when getting the file listing for a rackspace container named '" + container._name + "'.");
	}

	return result;
};

//****************************************************************************************************
//|
//| Module Functions
//| ----------------
//****************************************************************************************************

//****************************************************************************************************
// login
//****************************************************************************************************
//| ### login (username, apiKey, accountLocation)
//|
//| Logs into a rackspace CloudFiles account and returns an account object. Calling **login()** is the
//| only way to create an account object. All other objects in this module are created through and 
//| associated with an account object. Therefore, you must call **login()** before attempting to
//| interact with a rackspace account. See [Account Object Methods](#ACCOUNT_OBJECT_METHODS).
//|
//| All functions and methods in this module that require rackspace authentication will automatically
//| and transparently re-login when the current authentication expires. 
//|
//| #### Arguments
//|
//| * `username` - A string containing the rackspace CloudFiles user name.
//|
//| * `apiKey` - A string containing the rackspace CloudFiles API key. See the rackspace documentation
//| to learn how to get the API key. Example: "a86850deb2742ec3cb41518e26aa2d89". 
//|
//| * `accountLocation` *optional* - A value specifying where the rackspace CloudFiles account is 
//| based. See the [ACCOUNT\_LOCATIONS constants](#ACCOUNT_LOCATIONS). The default is
//| ACCOUNT\_LOCATIONS.US, specifying the United States. 
//|
//| #### Return Value
//|
//| * If the login is successful, an Account object is returned. You can use this object's methods
//| to perform various functions. Example: myAccount.container('test').create();
//|
//| Examples:
//|
//| ```javascript
//| var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.UK);
//| ```
//----------------------------------------------------------------------------------------------------
login = function login (username, apiKey, accountLocation) {
	return authenticate(new Account(username, apiKey, accountLocation));
};

//****************************************************************************************************
// setGetFileMD5Function
//****************************************************************************************************
//| ### setGetFileMD5Function (getFileMD5Function)
//|
//| Sets a function to be called when uploading and downloading files to compute the file's MD5 digest.
//| This value is used to insure the file was transferred correctly. If you do not call this
//| function, no checking will be performed. See the getFileMD5 function in scripts/test.js for an
//| example of an MD5 function. 
//|
//| #### Arguments
//|
//| * `getFileMD5Function` - A function that computes the MD5 digest of a system file or null. If null
//| (or any non-function value) is passed, no file-integrity checks will be performed. 
//|
//|     ##### getFileMD5Function Function Interface:
//|
//|     ##### Arguments
//|
//|     * `file` - A Wakanda Server File object.
//|
//|     ##### Return Value
//|
//|     * A string containing the hexidecimal representation of the given file's MD5 digest.
//| Example: '79054025255fb1a26e4bc422aef54eb4'. 
//|
//| Examples:
//|
//| ```javascript
//| cloudFiles.setGetFileMD5Function (
//| 	function (file) {
//|         // Compute the md5Digest of the given file....
//|         return md5Digest;
//| 	});
//| ```
//----------------------------------------------------------------------------------------------------
setGetFileMD5Function = function setGetFileMD5Function (getFileMD5Function) {
	getFileMD5 = getFileMD5Function;
};

//****************************************************************************************************
//| Account Object Methods
//| ----------------------
//****************************************************************************************************

//****************************************************************************************************
// Account.container
//****************************************************************************************************
//| ### Account.container (name)
//|
//| Creates a new container object for the account. A container object is used to refer to a container
//| within the account. The container may or may not actually exist in rackspace. This method creates
//| the container object but does not actually create the container in rackspace. See [Container
//| Object Methods](#CONTAINER_OBJECT_METHODS). 
//|
//| #### Arguments
//|
//| * `name` - The name of the container. Any valid rackspace container name is accepted. 
//|
//| #### Return Value
//|
//| * A Container object. See [Container Object Methods](#CONTAINER_OBJECT_METHODS).
//|
//| Examples:
//|
//| ```javascript
//| myContainer = myAccount.container('test');
//| ```
//----------------------------------------------------------------------------------------------------
Account.prototype.container = function container (name) {
	return new Container(this, name);
};

//****************************************************************************************************
// Account.containerList
//****************************************************************************************************
//| ### Account.containerList (batchLimit)
//|
//| Creates a new container list for the account. A container list is used to get a listing of all of 
//| the containers in an account. This method creates the list object but does not actually retrieve
//| the list. See [Container List Object Methods](#CONTAINER_LIST_OBJECT_METHODS). 
//|
//| #### Arguments
//|
//| * `batchLimit` *optional* - The number of containers retrieved at a time. If not given, the
//| rackspace default is used (currently 10,000). 
//|
//| #### Return Value
//|
//| * A Container List object. See [Container List Object Methods](#CONTAINER_LIST_OBJECT_METHODS).
//|
//| Examples:
//|
//| ```javascript
//| listOfContainers = myAccount.containerList();
//| ```
//----------------------------------------------------------------------------------------------------
Account.prototype.containerList = function containerList (batchLimit) {
	return new ContainerList(this, batchLimit);
};

//****************************************************************************************************
// Account.getInfo
//****************************************************************************************************
//| ### Account.getInfo ()
//|
//| Retrieves information about the account.
//|
//| #### Return Value
//|
//| * An object is returned containing the following properties.
//|
//|     * `bytesUsed` - The total number of bytes used for storage in the account.
//|
//|     * `containerCount` - The total number of containers in the account.
//|
//|     * `fileCount` - The total number of files stored in the account.
//|
//| Examples:
//|
//| ```javascript
//| info = myAccount.getInfo();
//|
//| // info ==> {
//| //               bytesUsed: 4583727,
//| //               containerCount: 12,
//| //               fileCount: 57
//| //          }
//| ```
//----------------------------------------------------------------------------------------------------
Account.prototype.getInfo = function getAccountInfo () {
	var that = this;
	var result;
	var xhr;

	xhr =
		httpRequests
			.head(this._storageUrl)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._authToken); })
			.setAuthentication(authenticate, this)
			.send();
						   
	result = _
		.chain(http.responseHeadersToObject(xhr)) 	// Get an object containing the response header fields.
		.pick( 										// Remove everything except the bytes used and the container and object counts.
			HEADER.X_ACCOUNT_BYTES_USED,
			HEADER.X_ACCOUNT_CONTAINER_COUNT,
			HEADER.X_ACCOUNT_OBJECT_COUNT)
		.pairs()									// Get an array containing arrays of the object's key/value pairs [[k1,v1], [k2,v2]].
		.map( 										// Rename the keys to generic names and make their values numeric.
			function (pair) {
		   		var result = [pair[0].replace(HEADER.X_ACCOUNT_BYTES_USED, 'bytesUsed')
		   	 		  				 .replace(HEADER.X_ACCOUNT_CONTAINER_COUNT, 'containerCount')
		   	 		  				 .replace(HEADER.X_ACCOUNT_OBJECT_COUNT, 'fileCount'),
		   	 		  					   	   
		   	 		  		  Number(pair[1])];
		   	 		  		  
				return result;
			})
		.object() 									// Turn the array of key/value pairs into an object.
		.value();

	return result;
};

//****************************************************************************************************
//|
//| Container Object Methods
//| ------------------------
//****************************************************************************************************

//****************************************************************************************************
// Container.cdniOSUrl
//****************************************************************************************************
//| ### Container.cdniOSUrl ()
//|
//| Returns the container's CDN iOS URL.
//|
//| #### Return Value
//|
//| * The container's CDN iOS URL. If the container is not CDN enabled, returns a blank string. See
//| [Container.enableCDN()](#CONTAINER.ENABLECDN). 
//|
//| Examples:
//|
//| ```javascript
//| URL = myAccount.container('test').cdniOSUrl();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.cdniOSUrl = function containercdniOSUrl () {
	if (_.isString(this._cdniOSUri) && this._cdniOSUri !== '') {
		return this._cdniOSUri;
	}
	
	getContainerCdnMetaData(this);

	return this._cdniOSUri;
};

//****************************************************************************************************
// Container.cdnSslUrl
//****************************************************************************************************
//| ### Container.cdnSslUrl ()
//|
//| Returns the container's CDN SSL URL.
//|
//| #### Return Value
//|
//| * The container's CDN SSL URL. If the container is not CDN enabled, returns a blank string. See
//| [Container.enableCDN()](#CONTAINER.ENABLECDN). 
//|
//| Examples:
//|
//| ```javascript
//| URL = myAccount.container('test').cdnSslUrl();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.cdnSslUrl = function containerCdnSslUrl () {
	if (_.isString(this._cdnSslUri) && this._cdnSslUri !== '') {
		return this._cdnSslUri;
	}
	
	getContainerCdnMetaData(this);

	return this._cdnSslUri;
};

//****************************************************************************************************
// Container.cdnStreamingUrl
//****************************************************************************************************
//| ### Container.cdnStreamingUrl ()
//|
//| Returns the container's CDN streaming URL.
//|
//| #### Return Value
//|
//| * The container's CDN streaming URL. If the container is not CDN enabled, returns a blank string. See
//| [Container.enableCDN()](#CONTAINER.ENABLECDN). 
//|
//| Examples:
//|
//| ```javascript
//| URL = myAccount.container('test').cdnStreamingUrl();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.cdnStreamingUrl = function containercdnStreamingUrl () {
	if (_.isString(this._cdnStreamingUri) && this._cdnStreamingUri !== '') {
		return this._cdnStreamingUri;
	}
	
	getContainerCdnMetaData(this);

	return this._cdnStreamingUri;
};

//****************************************************************************************************
// Container.containerCdnUrl
//****************************************************************************************************
//| ### Container.containerCdnUrl ()
//|
//| Returns the container's CDN URL.
//|
//| #### Return Value
//|
//| * The container's CDN URL. If the container is not CDN enabled, returns a blank string. See
//| [Container.enableCDN()](#CONTAINER.ENABLECDN). 
//|
//| Examples:
//|
//| ```javascript
//| URL = myAccount.container('test').cdnUrl();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.cdnUrl = function containerCdnUrl () {
	if (_.isString(this._cdnUri) && this._cdnUri !== '') {
		return this._cdnUri;
	}
	
	getContainerCdnMetaData(this);

	return this._cdnUri;
};

//****************************************************************************************************
// Container.create
//****************************************************************************************************
//| ### Container.create ()
//|
//| Creates a container in rackspace. If the container already exists, does nothing. 
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myAccount.container('test').create();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.create = function createContainer () {
	var that = this;
	
	httpRequests
		.put(this._fullPath)
		.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken); })
		.setAuthentication(authenticate, this._account)
		.send();
						   
	return this;
};

//****************************************************************************************************
// Container.disableCDN
//****************************************************************************************************
//| ### Container.disableCDN ()
//|
//| Disables CDN for the container.
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myAccount.container('test').disableCDN();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.disableCDN = function disableCDNForContainer () {
	var that = this;

	httpRequests
		.put(this._account._CDNManagementUrl + "/" + this._encodedName)
		.setHeaders(
			function (xhr) {
				xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken);
				xhr.setRequestHeader(HEADER.X_CDN_ENABLED, "False");
			})
		.setAuthentication(authenticate, this._account)
		.send();

	delete this._cdnSslUri;
	delete this._cdnUri;
	delete this._cdnStreamingUri;
	delete this._cdniOSUri;
	
	return this;
};

//****************************************************************************************************
//| Container.enableCDN
//****************************************************************************************************
//| ### Container.enableCDN ()
//|
//| Enables CDN for the container.
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myAccount.container('test').enableCDN();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.enableCDN = function enableCDNForContainer () {
	var that = this;
	var xhr;
	
	xhr =
		httpRequests
			.put(this._account._CDNManagementUrl + "/" + this._encodedName)
			.setHeaders(
				function (xhr) {
					xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken);
					xhr.setRequestHeader(HEADER.X_CDN_ENABLED, "True");
				})
			.setAuthentication(authenticate, this._account)
			.send();

	this._cdnSslUri = xhr.getResponseHeader(HEADER.X_CDN_SSL_URI);
	this._cdnUri = xhr.getResponseHeader(HEADER.X_CDN_URI);
	this._cdnStreamingUri = xhr.getResponseHeader(HEADER.X_CDN_STREAMING_URI);
	this._cdniOSUri = xhr.getResponseHeader(HEADER.X_CDN_IOS_URI);
	
	return this;
};

//****************************************************************************************************
// Container.file
//****************************************************************************************************
//| ### Container.file (name)
//|
//| Creates a new container file object for the container. A container file object is used to refer to
//| a file within a container. The file may or may not actually exist in rackspace. This method
//| creates the container file object but does not actually create the file in rackspace. See
//| [Container File Object Methods](#CONTAINER_FILE_OBJECT_METHODS). 
//|
//| #### Arguments
//|
//| * `name` - The name of the file. Any valid rackspace file name is accepted. 
//|
//| #### Return Value
//|
//| * A File object. See [Container File Object Methods](#CONTAINER_FILE_OBJECT_METHODS).
//|
//| Examples:
//|
//| ```javascript
//| myFile = myAccount.container('test').file('test.pdf');
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.file = function file (name) {
	return new ContainerFile(this, name);
};

//****************************************************************************************************
// Container.fileList
//****************************************************************************************************
//| ### Container.fileList (batchLimit)
//|
//| Creates a new file list object for the container. A file list is used to get a listing of all of 
//| the files in a container. This method creates the list object but does not actually retrieve
//| the list. See [File List Object Methods](#FILE_LIST_OBJECT_METHODS). 
//|
//| #### Arguments
//|
//| * `batchLimit` *optional* - The number of files retrieved at a time. If not given, the rackspace
//| default is used (currently 10,000). 
//|
//| #### Return Value
//|
//| * A File List object. See [File List Object Methods](#FILE_LIST_OBJECT_METHODS).
//|
//| Examples:
//|
//| ```javascript
//| listOfFiles = myAccount.container('test').fileList();
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.fileList = function fileList (batchLimit) {
	return new FileList(this, batchLimit);
};

//****************************************************************************************************
// Container.getInfo
//****************************************************************************************************
//| ### Container.getInfo ()
//|
//| Retrieves information about the container.
//|
//| #### Return Value
//|
//| * An object is returned containing the following properties.
//|
//|     * `bytesUsed` - The total number of bytes used for storage in the container.
//|
//|     * `fileCount` - The total number of files stored in the container.
//|
//| Examples:
//|
//| ```javascript
//| info = myContainer.getInfo();
//|
//| // info ==> {
//| //               bytesUsed: 4583727,
//| //               fileCount: 57
//| //          }
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.getInfo = function getContainerInfo () {
	var result;
	var that = this;
	var xhr;
	
	xhr =
		httpRequests
			.head(this._fullPath)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken); })
			.setAuthentication(authenticate, this._account)
			.send();

	result = _.chain(http.responseHeadersToObject(xhr)) // Get an object containing the response header fields.
			 .pick(HEADER.X_CONTAINER_OBJECT_COUNT, 		// Remove everything except the object count and bytes used.
				   HEADER.X_CONTAINER_BYTES_USED)
			 .pairs()									// Get an array containing arrays of the object's key/value pairs [[k1,v1], [k2,v2]].
		   	 .map(function (pair) { 					// Rename the keys to generic names and make their values numeric.
				      return [pair[0].replace(HEADER.X_CONTAINER_BYTES_USED, 'bytesUsed').replace(HEADER.X_CONTAINER_OBJECT_COUNT, 'fileCount'), Number(pair[1])];
				  })
		   	 .object() 									// Turn the array of key/value pairs into an object.
		   	 .value();

	return result;
};

//****************************************************************************************************
// Container.getMetaData
//****************************************************************************************************
//| ### Container.getMetaData ()
//|
//| Retrieves meta data previously saved with the container using the
//| [Container.setMetaData()](#CONTAINER.SETMETADATA) method. 
//|
//| #### Return Value
//|
//| * An object is returned containing the meta data. Be advised that rackspace formats property names 
//| by capitalizing the first letter and the first letter after a space or underscore, changing all
//| other letters to lowercase and changing all underscores to dashes.
//|
//|      **Property-Name Formatting Examples:**
//|      
//|      * "expense_category" ==> "Expense-Category"
//|      
//|      * "expenseCategory" ==> "Expensecategory". 
//|
//| Examples:
//|
//| ```javascript
//| metaData = myContainer.getMetaData();
//|
//| // metaData ==> {
//| //                   Expense-Category: "Advertising",
//| //                   Month: "June"
//| //              }
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.getMetaData = function getContainerMetaData () {
	var that = this;
	var xhr;
	
	xhr =
		httpRequests
			.head(this._fullPath)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken); })
			.setAuthentication(authenticate, this._account)
			.send();

	return extractCustomMetaData(http.responseHeadersToObject(xhr), HEADER.X_CONTAINER_META);
};

//****************************************************************************************************
// Container.remove
//****************************************************************************************************
//| ### Container.remove (deleteOption)
//|
//| Deletes the container from rackspace.
//|
//| #### Arguments
//|
//| * `deleteOption` *optional* - A constant value specifying if the container should be deleted even 
//| if it is not empty. If the container is not empty, the default behavior is to leave the container 
//| intact and to throw an exception. See the [DELETE\_OPTIONS constants](#DELETE_OPTIONS)
//| for valid values. 
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myContainer.remove(cloudFiles.DELETE_OPTIONS.FORCE_DELETE); // Delete even if not empty.
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.remove = function removeContainer (deleteOption) {
	var containerFileList;
	var that = this;
	var xhr;
	
	function makeRequest () {
		var result;
		
		result =
			httpRequests
				.del(that._fullPath)
				.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken); })
				.setAuthentication(authenticate, that._account)
				.send();
				  
		return result;
	}
	
	deleteOption = _.isString(deleteOption) && DELETE_OPTIONS.hasOwnProperty(deleteOption) ? deleteOption : DELETE_OPTIONS.DELETE_ONLY_IF_EMPTY;
	
	try {
		xhr = makeRequest();
	}
	catch (error) {
		if (error instanceof httpRequests.RequestError) {
			if (error.xhr.status !== http.STATUS_CODES.NOT_FOUND) {
				if (error.xhr.status === http.STATUS_CODES.CONFLICT && deleteOption === DELETE_OPTIONS.DELETE_EVEN_IF_NOT_EMPTY) {
					containerFileList = this.fileList().get();
					
					while (!containerFileList.isAtEnd()) {
						containerFileList.currentFile().remove();
						containerFileList.goToNextFile();
					}
					
					try {
						xhr = makeRequest();
					}
					catch (error2) {
						if (!(error2 instanceof httpRequests.RequestError) || error2.xhr.status !== http.STATUS_CODES.NOT_FOUND) {
							throw error2;
						}
					}
				}
				else if (xhr.status === http.STATUS_CODES.CONFLICT) {
					throw new Error("Could not delete a rackspace container named '" + this._name + "' because it is not empty.");
				}
				else {
					throw error;
				}
			}
		}
		else {
			throw error;
		}
	}
	
	return this;
};

//****************************************************************************************************
// Container.removeMetaData
//****************************************************************************************************
//| ### Container.removeMetaData (keys)
//|
//| Removes the meta data for each of the given property names (keys).
//|
//| #### Arguments
//|
//| * `keys` - An array of strings denoting the properties to remove from the container's meta data. 
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myContainer.removeMetaData(['Expense-Category', 'Month']);
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.removeMetaData = function removeContainerMetaData (keys) {
	var that = this;
	
	httpRequests
		.post(this._fullPath)
		.setHeaders(
			function (xhr) {
				xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken);
	
				keys.forEach(function (key) {
					xhr.setRequestHeader(HEADER.X_REMOVE_CONTAINER_META + key, 'remove');
				});
			})
		.setAuthentication(authenticate, this._account)
		.send();
	
	return this;
};

//****************************************************************************************************
// Container.setMetaData
//****************************************************************************************************
//| ### Container.setMetaData (metaData)
//|
//| Sets the meta data for a container. The meta data can be retrieved using the 
//| [Container.getMetaData()](#CONTAINER.GETMETADATA) method.
//|
//| #### Arguments
//|
//| * `metaData` - An object containing the meta data. The value of each of the object's properties
//| must be something other than an object (a string, number, etc.). 
//|      
//|      Be advised that rackspace formats property names by capitalizing the first letter and the first
//|      letter after a space or underscore, changing all other letters to lowercase and changing all
//|      underscores to dashes. 
//|      
//|      **Property-Name Formatting Examples:**
//|      
//|      * "expense_category" ==> "Expense-Category"
//|      
//|      * "expenseCategory" ==> "Expensecategory". 
//|
//| #### Return Value
//|
//| * The container object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myContainer.setMetaData({
//|                              Expense-Category: "Advertising",
//|                              Month: "June"
//|                         });
//| ```
//----------------------------------------------------------------------------------------------------
Container.prototype.setMetaData = function setContainerMetaData (metaData) {
	var that = this;
	
	httpRequests
		.post(this._fullPath)
		.setHeaders(
			function (xhr) {
				xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._account._authToken);
	
				Object.keys(metaData).forEach(function (key) {
					xhr.setRequestHeader(HEADER.X_CONTAINER_META + key, metaData[key]);
				});
			})
		.setAuthentication(authenticate, this._account)
		.send();
	
	return this;
};

//****************************************************************************************************
//|
//| Container File Object Methods
//| -----------------------------
//****************************************************************************************************

//****************************************************************************************************
// ContainerFile.copyTo
//****************************************************************************************************
//| ### ContainerFile.copyTo (toContainerFile)
//|
//| Copies a file to another file with a different name and/or location. If the `toContainerFile`
//| already exists, it is replaced with a copy of the source file. 
//|
//| #### Arguments
//|
//| * `toContainerFile` - A Container File object specifying the destination of the copy. This file's
//| container must already exist. 
//|
//| #### Return Value
//|
//| * The source Container File object (`this`). This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| // Copy a file named "test.pdf" in the "test" container to a file named "test2.pdf" in the "test2" container.
//| myAccount.container('test').file('test.pdf').copyTo(myAccount.container('test2').file('test2.pdf'));
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.copyTo = function copyToContainerFile (toContainerFile) {
	var that = this;
	
	httpRequests
		.put(toContainerFile._fullPath)
		.setHeaders(function (xhr) {
						xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken);
						xhr.setRequestHeader(HEADER.X_COPY_FROM, '/' + that._container._name + '/' + that._fileName);
					})
		.setAuthentication(authenticate, this._container._account)
		.send();
						   
	return this;
};

//****************************************************************************************************
// ContainerFile.download
//****************************************************************************************************
//| ### ContainerFile.download (destinationFile, bytesPerRequest)
//|
//| Downloads a file from rackspace to the given `destinationFile`. If a function to use to compute the
//| MD5 digest of files has been set using the [setGetFileMD5Function()](#SET_GET_FILE_MD5_FUNCTION)
//| function, the downloaded file is checked to insure its MD5 matches the one stored in rackspace.
//|
//| #### Arguments
//|
//| * `destinationFile` - A Wakanda File object specifying where to save the downloaded file. If the
//| file already exists, it is replaced. 
//|
//| * `bytesPerRequest` *optional* - Rather than retrieving large files in one request, this method
//| retrieves them in chunks. This argument allows the caller to specify the number of bytes of the
//| file to retrieve per request. The default is 512,000 bytes (0.5MB). 
//|
//| #### Return Value
//|
//| * The source Container File object (`this`). This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| // Download a rackspace file named "test.pdf" in the "test" container to a file of the same name
//| // within a testFiles folder in the Wakanda model folder. 
//| myAccount.container('test')
//|          .file('test.pdf')
//|          .download(File(ds.getModelFolder().path + 'testFiles/test.pdf'));
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.download = function downloadContainerFile (destinationFile, bytesPerRequest) {
	var done;
	var eTag;
	var startByte = 0;
	var that = this;
	var writeStream;
	var xhr;
	
	bytesPerRequest = _.isNumber(bytesPerRequest) && bytesPerRequest > 0 ? bytesPerRequest : 512000;
	
	writeStream = BinaryStream(destinationFile, "Write");

	try {
		do {
			done = false;
			
			try {
				xhr =
					httpRequests
						.get(this._fullPath)
				  		.setHeaders(
				    		function (xhr) {
				      			xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken);
								xhr.responseType = 'blob';
								xhr.setRequestHeader(HEADER.RANGE, 'bytes=' + startByte + '-' + (startByte + bytesPerRequest - 1));	
				      		})
						.setAuthentication(authenticate, this._container._account)
				  		.send();
			}
			catch (error) {
				if (error instanceof httpRequests.RequestError) {
					xhr = error.xhr;
					
					if (error.xhr.status === http.STATUS_CODES.RANGE_NOT_SATISFIABLE) {
						eTag = http.responseHeadersToObject(error.xhr).Etag;
						done = true;
					}
					else if (error.xhr.status !== http.STATUS_CODES.PARTIAL_CONTENT) {
						throw error;
					}
				}
			}
			
			if (!done) {
				writeStream.putBlob(xhr.response);
				startByte += bytesPerRequest;
			}
		} while (!done);
	}
	finally {
		writeStream.close();
	}
	
	if (_.isFunction(getFileMD5)) {
		if (getFileMD5(destinationFile) !== eTag) {
			throw new Error("The md5 of the downloaded file does not match the eTag sent from rackspace. File path: " + destinationFile.path);
		}
	}

	return this;
};

//****************************************************************************************************
// ContainerFile.getMetaData
//****************************************************************************************************
//| ### ContainerFile.getMetaData ()
//|
//| Retrieves meta data previously saved with the file using the
//| [ContainerFile.setMetaData()](#CONTAINERFILE.SETMETADATA) method. 
//|
//| #### Return Value
//|
//| * An object is returned containing the meta data. Be advised that rackspace formats property names 
//| by capitalizing the first letter and the first letter after a space or underscore, changing all
//| other letters to lowercase and changing all underscores to dashes.
//|
//|      **Property-Name Formatting Examples:**
//|      
//|      * "expense_category" ==> "Expense-Category"
//|      
//|      * "expenseCategory" ==> "Expensecategory". 
//|
//| Examples:
//|
//| ```javascript
//| metaData = myFile.getMetaData();
//|
//| // metaData ==> {
//| //                   Expense-Category: "Advertising",
//| //                   Month: "June"
//| //              }
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.getMetaData = function getContainerFileMetaData () {
	var that = this;
	var xhr;
	
	xhr =
		httpRequests
			.head(this._fullPath)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken); })
			.setAuthentication(authenticate, this._container._account)
			.send();
	
	return extractCustomMetaData(http.responseHeadersToObject(xhr), HEADER.X_OBJECT_META);
};

//****************************************************************************************************
// ContainerFile.moveTo
//****************************************************************************************************
//| ### ContainerFile.moveTo (toContainerFile)
//|
//| Moves a file from its current location/name to another file with a different name and/or location.
//| If the `toContainerFile` already exists, it is replaced with a copy of the source file (`this`). 
//|
//| #### Arguments
//|
//| * `toContainerFile` - A Container File object specifying the destination of the move. This file's
//| container must already exist. 
//|
//| #### Return Value
//|
//| * The source Container File object (`this`). This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| // Move a file named "test.pdf" in the "test" container to a file named "test2.pdf" in the "test2" container.
//| myAccount.container('test').file('test.pdf').moveTo(myAccount.container('test2').file('test2.pdf'));
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.moveTo = function moveToContainerFile (toContainerFile) {
	this.copyTo(toContainerFile);
	this.remove();
	
	return this;
};

//****************************************************************************************************
// ContainerFile.remove
//****************************************************************************************************
//| ### ContainerFile.remove ()
//|
//| Deletes the file from rackspace. Does nothing if the file does not exist in rackspace.
//|
//| #### Return Value
//|
//| * The Container File object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myContainer.remove(cloudFiles.DELETE_OPTIONS.FORCE_DELETE); // Delete even if not empty.
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.remove = function removeContainerFile () {
	var that = this;
	
	try {
		httpRequests
			.del(this._fullPath)
			.setHeaders(function (xhr) { xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken); })
			.setAuthentication(authenticate, this._container._account)
			.send();
	}
	catch (error) {
		if (error instanceof httpRequests.RequestError) {
			if (error.xhr.status !== http.STATUS_CODES.NOT_FOUND) {
				throw error;
			}
		}
	}
	
	return this;
};

// These methods seem to cause the uploaded file to be empty (0 bytes)!!!!!
//ContainerFile.prototype.setDeleteAfter = function setDeleteAfter (numberOfSeconds) {
//	var xhr;
//	!!!! CONVERT THIS TO USE THE HTTP MODULE
//	xhr = new XMLHttpRequest();
//	xhr.open('PUT', this._fullPath);
//	xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, this._container._account._authToken);
//	xhr.setRequestHeader(HEADER.X_DELETE_AFTER, numberOfSeconds);	
//	xhr.send();
//  http.checkForError(xhr, "Could not set the delete after time for a file named '" + this._fileName + "' in a rackspace container named '" + this._container._name + "'.", authenticate, _.bind(this.setDeleteAfter, this, numberOfSeconds), this._container._account);
//	
//	return this;
//};

//ContainerFile.prototype.setDeleteAt = function setDeleteAt (expirationDate) {
//	var xhr;
//	!!!! CONVERT THIS TO USE THE HTTP MODULE
//	xhr = new XMLHttpRequest();
//	xhr.open('PUT', this._fullPath);
//	xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, this._container._account._authToken);
//	xhr.setRequestHeader(HEADER.X_DELETE_AT, (expirationDate.getTime() / 1000).toFixed(0));	
//	xhr.send();
//  http.checkForError(xhr, "Could not set the delete at date for a file named '" + this._fileName + "' in a rackspace container named '" + this._container._name + "'.", authenticate, _.bind(this.setDeleteAt, this, expirationDate), this._container._account);
//	
//	return this;
//};

//****************************************************************************************************
// ContainerFile.setMetaData
//****************************************************************************************************
//| ### ContainerFile.setMetaData (metaData)
//|
//| Sets the meta data for a file. The meta data can be retrieved using the 
//| [ContainerFile.getMetaData()](#CONTAINERFILE.GETMETADATA) method.
//|
//| #### Arguments
//|
//| * `metaData` - An object containing the meta data. The value of each of the object's properties
//| must be something other than an object (a string, number, etc.). 
//|      
//|      Be advised that rackspace formats property names by capitalizing the first letter and the first
//|      letter after a space or underscore, changing all other letters to lowercase and changing all
//|      underscores to dashes. 
//|      
//|      **Property-Name Formatting Examples:**
//|      
//|      * "expense_category" ==> "Expense-Category"
//|      
//|      * "expenseCategory" ==> "Expensecategory". 
//|
//| #### Return Value
//|
//| * The Container File object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| myFile.setMetaData({
//|                         Expense-Category: "Advertising",
//|                         Month: "June"
//|                    });
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.setMetaData = function setContainerFileMetaData (metaData) {
	var that = this;
	
	httpRequests
		.post(this._fullPath)
		.setHeaders(
			function (xhr) {
				xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken);
	
				Object.keys(metaData).forEach(function (key) {
					xhr.setRequestHeader(HEADER.X_OBJECT_META + key, metaData[key]);
				});
			})
		.setAuthentication(authenticate, this._container._account)
		.send();
	
	return this;
};

//****************************************************************************************************
// ContainerFile.upload
//****************************************************************************************************
//| ### ContainerFile.upload (file, mimeType)
//|
//| Uploads a system `file` to a rackspace file (`this`). If the rackspace file already exists, it is
//| replaced. If a function to use to compute the MD5 digest of files has been set using the
//| [setGetFileMD5Function()](#SET_GET_FILE_MD5_FUNCTION) function, rackspace checks to insure the
//| uploaded file's MD5 matches the one computed on the original system file. 
//|
//| #### Arguments
//|
//| * `file` - A Wakanda File object specifying the system file to upload.
//|
//| * `mimeType` *optional* - This method can automatically determine the MIME type for the `file`
//| based on its extension (and sometimes its name). Supply this argument to override the
//| automatically generated MIME type. 
//|
//| #### Return Value
//|
//| * The destination Container File object (`this`). This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| // Upload a system file named "test.pdf" within a testFiles folder in the Wakanda model folder to a rackspace file
//| // with the same name in the "test" container. 
//| myAccount.container('test')
//|          .file('test.pdf')
//|          .upload(File(ds.getModelFolder().path + 'testFiles/test.pdf'));
//| ```
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.upload = function uploadContainerFile (file, mimeType) {
	var that = this;
	
	mimeType = mimeType ? mimeType : fileMimeType.lookup(file.name);
	
	httpRequests
		.put(this._fullPath)
		.setHeaders(
			function (xhr) {
				xhr.setRequestHeader(HEADER.X_AUTH_TOKEN, that._container._account._authToken);
	
				if (_.isFunction(getFileMD5)) {
					xhr.setRequestHeader(HEADER.ETAG, getFileMD5(file));
				}
				
				xhr.setRequestHeader(HEADER.CONTENT_TYPE, mimeType);
			})
		.setAuthentication(authenticate, this._container._account)
		.send(file);
						   
	return this;
};

//****************************************************************************************************
//|
//| Container List Object Methods
//| -----------------------------
//****************************************************************************************************

//| ### Example
//|
//| Display a list of all of the account's containers in the console.
//|
//| ```javascript
//| var cloudFiles = require('rackspaceCloudFiles');
//|
//| var containerList = cloudFiles.login('myUserName', 'myApiKey').containerList().get();
//|	
//| while (containerList.isNotAtEnd()) {
//|     console.info(containerList.currentContainerInfo().name);
//|     containerList.goToNextContainer();
//| }
//| ```

//****************************************************************************************************
// ContainerList.currentContainer
//****************************************************************************************************
//| ### ContainerList.currentContainer ()
//|
//| Returns a Container object representing the current container in the list.
//|
//| #### Return Value
//|
//| * A Container object representing the current container in the list. Returns null if there is no
//| current container because the list is empty or there are no more list items.
//|
//| Examples:
//|
//| ```javascript
//| theContainer = listOfContainers.currentContainer();
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.currentContainer = function currentContainer () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the container list before attempting to get the current container.");
	}
	
	if (this._currentIndex < 0 || this._currentIndex >= this._list.length) {
		return null;
	}
	
	return this._account.container(this._list[this._currentIndex].name);
};

//****************************************************************************************************
// ContainerList.currentContainerInfo
//****************************************************************************************************
//| ### ContainerList.currentContainerInfo ()
//|
//| Returns an object containing information about the current container in the list.
//|
//| #### Return Value
//|
//| * An object containing information about the current container in the list. Returns null if there
//| is no current container because the list is empty or there are no more list items.
//|
//|     ##### Returned Object Properties
//|
//|     * `bytes` - The total number of bytes stored in the container.
//|
//|     * `count` - The total number of files stored in the container.
//|
//|     * `name` - The name of the container.
//|
//| Examples:
//|
//| ```javascript
//| info = listOfContainers.currentContainerInfo();
//|
//| // info ==> {
//| //               bytes: 4583727,
//| //               count: 12,
//| //               name: "Test"
//| //          }
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.currentContainerInfo = function currentContainerInfo () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the container list before attempting to get info for the current container.");
	}
	
	if (this._currentIndex < 0 || this._currentIndex >= this._list.length) {
		return null;
	}
	
	return this._list[this._currentIndex];
};

//****************************************************************************************************
// ContainerList.get
//****************************************************************************************************
//| ### ContainerList.get ()
//|
//| Retrieves a list of the containers in an account. The first container in the list is set as the 
//| "current" container. You can get the current container using the
//| [currentContainer()](#CONTAINERLIST.CURRENTCONTAINER) method or just get its information (name,
//| size, etc.) using the [currentContainerInfo()](#CONTAINERLIST.CURRENTCONTAINERINFO) method. You
//| can iterate through the list using the [goToNextContainer()](#CONTAINERLIST.GOTONEXTCONTAINER)
//| method. 
//|
//| #### Return Value
//|
//| * The container list object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| listOfContainers = myAccount.containerList();
//| listOfContainers.get();
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.get = function getContainerList () {
	this._list = getAccountContainerList(this._account, this._batchLimit);
	this._currentIndex = this._list.length === 0 ? -1 : 0;

	return this;
};

//****************************************************************************************************
// ContainerList.goToNextContainer
//****************************************************************************************************
//| ### ContainerList.goToNextContainer ()
//|
//| Sets the current container in the list to the one after the current container.
//|
//| #### Return Value
//|
//| * The container list object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| listOfContainers.goToNextContainer();
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.goToNextContainer = function goToNextContainer () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the container list before attempting to go to the next container.");
	}
	
	if (this._currentIndex >= this._list.length) {
		return this;
	}
	else if (this._currentIndex >= 0 && this._currentIndex < this._list.length) {
		this._currentIndex++;
	}
	
	if (this._currentIndex === this._list.length && this._list.length > 0) {
		this._list = getAccountContainerList
		(this._account, this._batchLimit, this._list[this._list.length - 1].name);
		this._currentIndex = this._list.length === 0 ? -1 : 0;
	}
	
	return this;
};

//****************************************************************************************************
// ContainerList.isAtEnd
//****************************************************************************************************
//| ### ContainerList.isAtEnd ()
//|
//| Determines if there are no more items in the container list.
//|
//| #### Return Value
//|
//| * Returns *true* if there are no more items and *false* otherwise.
//|
//| Examples:
//|
//| ```javascript
//| listOfContainers.isAtEnd();
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.isAtEnd = function isAtEndOfContainerList () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the container list before attempting to determine if you're at the end of the list.");
	}
	
	return this._currentIndex < 0 || this._currentIndex >= this._list.length;
};

//****************************************************************************************************
// ContainerList.isNotAtEnd
//****************************************************************************************************
//| ### ContainerList.isNotAtEnd ()
//|
//| Determines if there are more items in the container list.
//|
//| #### Return Value
//|
//| * Returns *true* if there are more items and *false* otherwise.
//|
//| Examples:
//|
//| ```javascript
//| listOfContainers.isNotAtEnd();
//| ```
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.isNotAtEnd = function isNotAtEndOfContainerList () {
	return !this.isAtEnd();
};

//****************************************************************************************************
//|
//| File List Object Methods
//| ------------------------
//****************************************************************************************************

//| ### Example
//|
//| Display a list of all of the 'test' container's files in the console.
//|
//| ```javascript
//| var cloudFiles = require('rackspaceCloudFiles');
//|
//| var fileList = cloudFiles.login('myUserName', 'myApiKey').container('test').fileList().get();
//|	
//| while (fileList.isNotAtEnd()) {
//|     console.info(fileList.currentFileInfo().name);
//|     fileList.goToNextFile();
//| }
//| ```

//****************************************************************************************************
// FileList.currentFile
//****************************************************************************************************
//| ### FileList.currentFile ()
//|
//| Returns a Container File object representing the current file in the list.
//|
//| #### Return Value
//|
//| * A Container File object representing the current file in the list. Returns null if there is no
//| current file because the list is empty or there are no more list items.
//|
//| Examples:
//|
//| ```javascript
//| theFile = listOfFiles.currentFile();
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.currentFile = function currentFileListFile () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the file list before attempting to get the current file.");
	}
	
	if (this._currentIndex < 0 || this._currentIndex >= this._list.length) {
		return null;
	}
	
	return this._container.file(this._list[this._currentIndex].name);
};

//****************************************************************************************************
// FileList.currentFileInfo
//****************************************************************************************************
//| ### FileList.currentFileInfo ()
//|
//| Returns an object containing information about the current file in the list.
//|
//| #### Return Value
//|
//| * An object containing information about the current file in the list. Returns null if there
//| is no current file because the list is empty or there are no more list items.
//|
//|     ##### Returned Object Properties
//|
//|     * `bytes` - The file's total number of bytes.
//|
//|     * `content_type` - The file's MIME type.
//|
//|     * `hash` - The file's MD5 digest.
//|
//|     * `last_modified` - The date/time the file was last modified.
//|
//|     * `name` - The file's full name including any extension.
//|
//| Examples:
//|
//| ```javascript
//| info = listOfFiles.currentFileInfo();
//|
//| // info ==> {
//| //               bytes: 9978,
//| //               content_type: 'image/jpeg',
//| //               hash: 'f1cb7b29c89dfa3113d620b9e87232f4',
//| //               last_modified: '2013-10-25T14:11:35.469120',
//| //               name: "testFile.jpg"
//| //          }
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.currentFileInfo = function currentFileListFileInfo () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the file list before attempting to get info for the current file.");
	}
	
	if (this._currentIndex < 0 || this._currentIndex >= this._list.length) {
		return null;
	}
	
	return this._list[this._currentIndex];
};

//****************************************************************************************************
// FileList.get
//****************************************************************************************************
//| ### FileList.get ()
//|
//| Retrieves a list of the files in a container. The first file in the list is set as the "current"
//| file. You can get the current file using the [currentFile()](#FILELIST.CURRENTFILE) method or 
//| just get its information (name, size, etc.) using the [currentFileInfo()](#FILELIST.CURRENTFILEINFO)
//| method. You can iterate through the list using the [goToNextFile()](#FILELIST.GOTONEXTFILE) method. 
//|
//| #### Return Value
//|
//| * The file list object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| listOfFiles = myAccount.container('test').fileList();
//| listOfFiles.get();
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.get = function getFileList () {
	this._list = getContainerFileList(this._container, this._batchLimit);
	this._currentIndex = this._list.length === 0 ? -1 : 0;

	return this;
};

//****************************************************************************************************
// FileList.goToNextFile
//****************************************************************************************************
//| ### FileList.goToNextFile ()
//|
//| Sets the current file in the list to the one after the current file.
//|
//| #### Return Value
//|
//| * The file list object. This value is useful for chaining method calls.
//|
//| Examples:
//|
//| ```javascript
//| listOfFiles.goToNextFile();
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.goToNextFile = function goToNextFileListFile () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the file list before attempting to go to the next file.");
	}
	
	if (this._currentIndex >= this._list.length) {
		return this;
	}
	else if (this._currentIndex >= 0 && this._currentIndex < this._list.length) {
		this._currentIndex++;
	}
	
	if (this._currentIndex === this._list.length && this._list.length > 0) {
		this._list = getContainerFileList(this._container, this._batchLimit, this._list[this._list.length - 1].name);
		this._currentIndex = this._list.length === 0 ? -1 : 0;
	}
	
	return this;
};

//****************************************************************************************************
// FileList.isAtEnd
//****************************************************************************************************
//| ### FileList.isAtEnd ()
//|
//| Determines if there are no more items in the file list.
//|
//| #### Return Value
//|
//| * Returns *true* if there are no more items and *false* otherwise.
//|
//| Examples:
//|
//| ```javascript
//| listOfFiles.isAtEnd();
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.isAtEnd = function isAtEndOfFileList () {
	if (!_.isArray(this._list)) {
		throw new Error("The get method must be called for the file list before attempting to determine if you're at the end of the list.");
	}
	
	return this._currentIndex < 0 || this._currentIndex >= this._list.length;
};

//****************************************************************************************************
// FileList.isNotAtEnd
//****************************************************************************************************
//| ### FileList.isNotAtEnd ()
//|
//| Determines if there are more items in the file list.
//|
//| #### Return Value
//|
//| * Returns *true* if there are more items and *false* otherwise.
//|
//| Examples:
//|
//| ```javascript
//| listOfFiles.isNotAtEnd();
//| ```
//----------------------------------------------------------------------------------------------------
FileList.prototype.isNotAtEnd = function isNotAtEndOfFileList () {
	return !this.isAtEnd();
};

//----------------------------------------------------------------------------------------------------
// Public Interface.
//----------------------------------------------------------------------------------------------------
exports.ACCOUNT_LOCATIONS = ACCOUNT_LOCATIONS;
exports.DELETE_OPTIONS = DELETE_OPTIONS;
exports.login = login;
exports.setGetFileMD5Function = setGetFileMD5Function;

//****************************************************************************************************
//|
//| Known Issues
//| ------------
//****************************************************************************************************
//| ### Automatic File Deletion
//|
//| Using rackspace's X-Delete-After and X-Delete-At HTTP fields does not work properly. Setting either
//| of these for a rackspace file through the API results in a file of 0 bytes in length. Therefore the
//| ContainerFile.setDeleteAfter() and ContainerFile.setDeleteAt() methods are not available at this
//| time. They are commented out until this isssue is resolved. 
//****************************************************************************************************
//|
//| Testing
//| -------
//****************************************************************************************************
//| rackspaceCloudFiles uses Wakanda's implementation of [YUI
//| Test](http://yuilibrary.com/yui/docs/test/). 
//|
//| **WARNING:** The test code creates 5 rackspace containers in your account named "test1" through
//| "test5" and deletes them. If you have any real containers with any of these names, please rename
//| them before running the test or do not run the test. Otherwise they will be deleted. 
//|
//| 1. In Wakanda Studio, open Modules/testCases.js in the CloudFiles project.
//| 2. Enter your rackspace account information into the following three lines of code toward the top
//| of the file:  
//|
//|     ```javascript
//|     //**********************************************************************
//|     userName = 'Your User Name Here';
//|     apiKey = 'Your rackspace API Key Here';
//|     accountLocation = cloudFiles.ACCOUNT_LOCATIONS.US; // Your account location here.
//|     //**********************************************************************
//|     ```
//|
//| 3. Open scripts/test.js.
//| 4. Click Run File. The results should appear in your browser.
//****************************************************************************************************
//|
//| Contributions
//| -------------
//****************************************************************************************************
//| If you contribute to this library, just modify `Modules/rackspaceCloudFiles.js` and
//| `Modules/testCases.js` and send a pull request. Please remember to update the markdown if the public
//| interface changes. 
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
