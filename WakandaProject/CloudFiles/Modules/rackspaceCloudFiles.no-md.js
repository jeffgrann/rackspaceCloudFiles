//****************************************************************************************************
// MODULE: rackspaceCloudFiles
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
		

ACCOUNT_LOCATIONS =
	{
		UK : 'UK',
		US : 'US'
	};

Object.freeze(ACCOUNT_LOCATIONS);


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
Account = function Account (username, apiKey, accountLocation) {	
	this.username = username;
	this.apiKey = apiKey;
	this.accountLocation = typeof accountLocation === 'string' && ACCOUNT_LOCATIONS.hasOwnProperty(accountLocation) ? accountLocation : ACCOUNT_LOCATIONS.US;
};

extractCustomMetaData = function extractCustomMetaData (object, metaDataPrefix) {
	var result;
	
	result = _.chain(_.pairs(object)) 														// Get an array containing arrays of the object's key/value pairs [[k1,v1], [k2,v2]].
		   	.filter(function (pair) {return pair[0].indexOf(metaDataPrefix) === 0;}) 		// Remove pairs with keys that don't have the container meta prefix.
		   	.map(function (pair) {return [pair[0].replace(metaDataPrefix, ''), pair[1]];}) 	// Remove the container meta prefix from the keys.
		   	.object() 																		// Turn the array of key/value pairs into an object.
		   	.value();
		   	
	return result;
};

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

Container = function Container (account, name) {
	if (name.indexOf('/') >= 0) {
		throw new Error("Could not create a rackspace container object with a name of '" + containerName + "'. Container names cannot contain forward slash characters.");
	}
	
	this._account = account;
	this._name = name;
	this._encodedName = encodeURIComponent(this._name);
	this._fullPath = this._account._storageUrl + "/" + this._encodedName;
};

ContainerList = function ContainerList (account, batchLimit) {
	batchLimit = _.isNumber(batchLimit) && batchLimit > 0 && batchLimit <= RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT ? batchLimit : RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT;
	
	this._account = account;
	this._list = null;
	this._batchLimit = batchLimit;
};

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

FileList = function FileList (container, batchLimit) {
	batchLimit = _.isNumber(batchLimit) && batchLimit > 0 && batchLimit <= RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT ? batchLimit : RACKSPACE_DEFAULTS.RETRIEVAL_BATCH_LIMIT;
	
	this._container = container;
	this._list = null;
	this._batchLimit = batchLimit;
};

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

ContainerFile = function ContainerFile (container, fileName) {
	this._container = container;
	this._fileName = fileName;
	this._encodedFileName = encodeURIComponent(this._fileName);
	this._fullPath = this._container._fullPath + '/' + this._encodedFileName;
};

//****************************************************************************************************
//****************************************************************************************************

//****************************************************************************************************
// login
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------
login = function login (username, apiKey, accountLocation) {
	return authenticate(new Account(username, apiKey, accountLocation));
};

//****************************************************************************************************
// setGetFileMD5Function
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------
setGetFileMD5Function = function setGetFileMD5Function (getFileMD5Function) {
	getFileMD5 = getFileMD5Function;
};

//****************************************************************************************************
//****************************************************************************************************

//****************************************************************************************************
// Account.container
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------
Account.prototype.container = function container (name) {
	return new Container(this, name);
};

//****************************************************************************************************
// Account.containerList
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------
Account.prototype.containerList = function containerList (batchLimit) {
	return new ContainerList(this, batchLimit);
};

//****************************************************************************************************
// Account.getInfo
//****************************************************************************************************
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
//****************************************************************************************************

//****************************************************************************************************
// Container.cdniOSUrl
//****************************************************************************************************
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
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
Container.prototype.file = function file (name) {
	return new ContainerFile(this, name);
};

//****************************************************************************************************
// Container.fileList
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------
Container.prototype.fileList = function fileList (batchLimit) {
	return new FileList(this, batchLimit);
};

//****************************************************************************************************
// Container.getInfo
//****************************************************************************************************
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
//****************************************************************************************************

//****************************************************************************************************
// ContainerFile.copyTo
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
ContainerFile.prototype.moveTo = function moveToContainerFile (toContainerFile) {
	this.copyTo(toContainerFile);
	this.remove();
	
	return this;
};

//****************************************************************************************************
// ContainerFile.remove
//****************************************************************************************************
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
//****************************************************************************************************


//****************************************************************************************************
// ContainerList.currentContainer
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.get = function getContainerList () {
	this._list = getAccountContainerList(this._account, this._batchLimit);
	this._currentIndex = this._list.length === 0 ? -1 : 0;

	return this;
};

//****************************************************************************************************
// ContainerList.goToNextContainer
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
ContainerList.prototype.isNotAtEnd = function isNotAtEndOfContainerList () {
	return !this.isAtEnd();
};

//****************************************************************************************************
//****************************************************************************************************


//****************************************************************************************************
// FileList.currentFile
//****************************************************************************************************
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
//----------------------------------------------------------------------------------------------------
FileList.prototype.get = function getFileList () {
	this._list = getContainerFileList(this._container, this._batchLimit);
	this._currentIndex = this._list.length === 0 ? -1 : 0;

	return this;
};

//****************************************************************************************************
// FileList.goToNextFile
//****************************************************************************************************
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
//****************************************************************************************************
//****************************************************************************************************
//****************************************************************************************************
//****************************************************************************************************
//****************************************************************************************************
//----------------------------------------------------------------------------------------------------

//****************************************************************************************************
//****************************************************************************************************

