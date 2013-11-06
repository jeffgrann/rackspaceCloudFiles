
rackspaceCloudFiles v1.0 
========================

rackspaceCloudFiles is a [Wakanda](http://www.wakanda.org) [CommonJS](http://www.commonjs.org)
module which provides a javascript interface to the [rackspace](http://www.rackspace.com) 
[CloudFiles](http://www.rackspace.com/cloud/files/) 
[API](http://docs.rackspace.com/files/api/v1/cf-devguide/cf-devguide-20130926.pdf).

Contents
--------
* [Example](#EXAMPLE)
* [Dependencies](#DEPENDENCIES)
* [Constants](#CONSTANTS)
    * [ACCOUNT\_LOCATIONS](#ACCOUNT_LOCATIONS)
    * [DELETE\_OPTIONS](#DELETE_OPTIONS)
* [Module Functions](#MODULE_FUNCTIONS)
    * [login (username, apiKey, accountLocation)](#LOGIN)
    * [setGetFileMD5Function (getFileMD5Function)](#SETGETFILEMD5FUNCTION)
* [Account Object Methods](#ACCOUNT_OBJECT_METHODS)
    * [container (name)](#ACCOUNT.CONTAINER)
    * [containerList (batchLimit)](#ACCOUNT.CONTAINERLIST)
    * [getInfo ()](#ACCOUNT.GETINFO)
* [Container Object Methods](#CONTAINER_OBJECT_METHODS)
    * [cdniOSUrl ()](#CONTAINER.CDNIOSURL)
    * [cdnSslUrl ()](#CONTAINER.CDNSSLURL)
    * [cdnStreamingUrl ()](#CONTAINER.CDNSTREAMINGURL)
    * [containerCdnUrl ()](#CONTAINER.CONTAINERCDNURL)
    * [create ()](#CONTAINER.CREATE)
    * [disableCDN ()](#CONTAINER.DISABLECDN)
    * [enableCDN ()](#CONTAINER.ENABLECDN)
    * [file (name)](#CONTAINER.FILE)
    * [fileList (batchLimit)](#CONTAINER.FILELIST)
    * [getInfo ()](#CONTAINER.GETINFO)
    * [getMetaData ()](#CONTAINER.GETMETADATA)
    * [remove (deleteOption)](#CONTAINER.REMOVE)
    * [removeMetaData (keys)](#CONTAINER.REMOVEMETADATA)
    * [setMetaData (metaData)](#CONTAINER.SETMETADATA)
* [Container File Object Methods](#CONTAINER_FILE_OBJECT_METHODS)
    * [copyTo (toContainerFile)](#CONTAINERFILE.COPYTO)
    * [download (destinationFile, bytesPerRequest)](#CONTAINERFILE.DOWNLOAD)
    * [getMetaData ()](#CONTAINERFILE.GETMETADATA)
    * [moveTo (toContainerFile)](#CONTAINERFILE.MOVETO)
    * [remove ()](#CONTAINERFILE.REMOVE)
    * [setMetaData (metaData)](#CONTAINERFILE.SETMETADATA)
    * [upload (file, mimeType)](#CONTAINERFILE.UPLOAD)
* [Container List Object Methods](#CONTAINER_LIST_OBJECT_METHODS)
    * [Example](#EXAMPLE)
    * [currentContainer ()](#CONTAINERLIST.CURRENTCONTAINER)
    * [currentContainerInfo ()](#CONTAINERLIST.CURRENTCONTAINERINFO)
    * [get ()](#CONTAINERLIST.GET)
    * [goToNextContainer ()](#CONTAINERLIST.GOTONEXTCONTAINER)
    * [isAtEnd ()](#CONTAINERLIST.ISATEND)
    * [isNotAtEnd ()](#CONTAINERLIST.ISNOTATEND)
* [File List Object Methods](#FILE_LIST_OBJECT_METHODS)
    * [Example](#EXAMPLE)
    * [currentFile ()](#FILELIST.CURRENTFILE)
    * [currentFileInfo ()](#FILELIST.CURRENTFILEINFO)
    * [get ()](#FILELIST.GET)
    * [goToNextFile ()](#FILELIST.GOTONEXTFILE)
    * [isAtEnd ()](#FILELIST.ISATEND)
    * [isNotAtEnd ()](#FILELIST.ISNOTATEND)
* [Known Issues](#KNOWN_ISSUES)
    * [Automatic File Deletion](#AUTOMATIC_FILE_DELETION)
* [Testing](#TESTING)
* [Contributions](#CONTRIBUTIONS)
* [License](#LICENSE)


<a id="EXAMPLE"></a>
Example
-------

```javascript
var cloudFiles = require('rackspaceCloudFiles');

var myAccount = cloudFiles.login('myUserName', 'myApiKey');   // Login to the CloudFiles account.
var imageContainer = myAccount.container('images').create();  // Create a container.
imageContainer.file('image1.jpg')							  // Upload a file to the container.
              .upload(File(ds.getModelFolder().path + 'testFiles/image1.jpg'));
```

<a id="DEPENDENCIES"></a>
Dependencies
------------

* [http](https://github.com/jeffgrann/http) (tested with v1.0)
* [httpRequests](https://github.com/jeffgrann/httpRequests) (tested with v1.0)
* [mimeTypes](https://github.com/jeffgrann/mimeTypes) (tested with v1.0)
* [underscore](http://underscorejs.org) (tested with v1.5.1)
* [Wakanda](http://www.wakanda.org) v6+ (tested with v6 build 6.144914)

<a id="CONSTANTS"></a>
Constants
---------
<a id="ACCOUNT_LOCATIONS"></a>
### ACCOUNT\_LOCATIONS
To login to rackspace CloudFiles, you must know where your account is based. Your account may be
based in either the US or the UK. This is not determined by your physical location but by the
location of the Rackspace site which was used to create your account. 

* UK - Specifies that the rackspace account is based in the United Kingdom.
* US - Specifies that the rackspace account is based in the United States.

Examples:

```javascript
var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.US);
var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.UK);
var myAccount = cloudFiles.login('myUserName', 'myApiKey');  // The default is US.
```

<a id="DELETE_OPTIONS"></a>
### DELETE\_OPTIONS
Normally, CloudFiles will not allow the deletion of a container if it contains files. You can force
the deletion of a container even if it contains files by passing the DELETE\_EVEN\_IF\_NOT\_EMPTY
constant to the container's [remove()](#CONTAINER.REMOVE) method.

* DELETE\_EVEN\_IF\_NOT\_EMPTY - Specifies that the container should be removed even if it contains files.
* DELETE\_ONLY\_IF\_EMPTY - Specifies that the container should not be removed it if contains files.
* FORCE\_DELETE - Alias for DELETE\_EVEN\_IF\_NOT\_EMPTY.

Examples:

```javascript
myContainer.remove(cloudFiles.DELETE_OPTIONS.DELETE_EVEN_IF_NOT_EMPTY);
```


<a id="MODULE_FUNCTIONS"></a>
Module Functions
----------------
<a id="LOGIN"></a>
### login (username, apiKey, accountLocation)

Logs into a rackspace CloudFiles account and returns an account object. Calling **login()** is the
only way to create an account object. All other objects in this module are created through and 
associated with an account object. Therefore, you must call **login()** before attempting to
interact with a rackspace account. See [Account Object Methods](#ACCOUNT_OBJECT_METHODS).

All functions and methods in this module that require rackspace authentication will automatically
and transparently re-login when the current authentication expires. 

#### Arguments

* `username` - A string containing the rackspace CloudFiles user name.

* `apiKey` - A string containing the rackspace CloudFiles API key. See the rackspace documentation
to learn how to get the API key. Example: "a86850deb2742ec3cb41518e26aa2d89". 

* `accountLocation` *optional* - A value specifying where the rackspace CloudFiles account is 
based. See the [ACCOUNT\_LOCATIONS constants](#ACCOUNT_LOCATIONS). The default is
ACCOUNT\_LOCATIONS.US, specifying the United States. 

#### Return Value

* If the login is successful, an Account object is returned. You can use this object's methods
to perform various functions. Example: myAccount.container('test').create();

Examples:

```javascript
var myAccount = cloudFiles.login('myUserName', 'myApiKey', cloudFiles.ACCOUNT_LOCATIONS.UK);
```
<a id="SETGETFILEMD5FUNCTION"></a>
### setGetFileMD5Function (getFileMD5Function)

Sets a function to be called when uploading and downloading files to compute the file's MD5 digest.
This value is used to insure the file was transferred correctly. If you do not call this
function, no checking will be performed. See the getFileMD5 function in scripts/test.js for an
example of an MD5 function. 

#### Arguments

* `getFileMD5Function` - A function that computes the MD5 digest of a system file or null. If null
(or any non-function value) is passed, no file-integrity checks will be performed. 

    ##### getFileMD5Function Function Interface:

    ##### Arguments

    * `file` - A Wakanda Server File object.

    ##### Return Value

    * A string containing the hexidecimal representation of the given file's MD5 digest.
Example: '79054025255fb1a26e4bc422aef54eb4'. 

Examples:

```javascript
cloudFiles.setGetFileMD5Function (
	function (file) {
        // Compute the md5Digest of the given file....
        return md5Digest;
	});
```
<a id="ACCOUNT_OBJECT_METHODS"></a>
Account Object Methods
----------------------
<a id="ACCOUNT.CONTAINER"></a>
### Account.container (name)

Creates a new container object for the account. A container object is used to refer to a container
within the account. The container may or may not actually exist in rackspace. This method creates
the container object but does not actually create the container in rackspace. See [Container
Object Methods](#CONTAINER_OBJECT_METHODS). 

#### Arguments

* `name` - The name of the container. Any valid rackspace container name is accepted. 

#### Return Value

* A Container object. See [Container Object Methods](#CONTAINER_OBJECT_METHODS).

Examples:

```javascript
myContainer = myAccount.container('test');
```
<a id="ACCOUNT.CONTAINERLIST"></a>
### Account.containerList (batchLimit)

Creates a new container list for the account. A container list is used to get a listing of all of 
the containers in an account. This method creates the list object but does not actually retrieve
the list. See [Container List Object Methods](#CONTAINER_LIST_OBJECT_METHODS). 

#### Arguments

* `batchLimit` *optional* - The number of containers retrieved at a time. If not given, the
rackspace default is used (currently 10,000). 

#### Return Value

* A Container List object. See [Container List Object Methods](#CONTAINER_LIST_OBJECT_METHODS).

Examples:

```javascript
listOfContainers = myAccount.containerList();
```
<a id="ACCOUNT.GETINFO"></a>
### Account.getInfo ()

Retrieves information about the account.

#### Return Value

* An object is returned containing the following properties.

    * `bytesUsed` - The total number of bytes used for storage in the account.

    * `containerCount` - The total number of containers in the account.

    * `fileCount` - The total number of files stored in the account.

Examples:

```javascript
info = myAccount.getInfo();

// info ==> {
//               bytesUsed: 4583727,
//               containerCount: 12,
//               fileCount: 57
//          }
```

<a id="CONTAINER_OBJECT_METHODS"></a>
Container Object Methods
------------------------
<a id="CONTAINER.CDNIOSURL"></a>
### Container.cdniOSUrl ()

Returns the container's CDN iOS URL.

#### Return Value

* The container's CDN iOS URL. If the container is not CDN enabled, returns a blank string. See
[Container.enableCDN()](#CONTAINER.ENABLECDN). 

Examples:

```javascript
URL = myAccount.container('test').cdniOSUrl();
```
<a id="CONTAINER.CDNSSLURL"></a>
### Container.cdnSslUrl ()

Returns the container's CDN SSL URL.

#### Return Value

* The container's CDN SSL URL. If the container is not CDN enabled, returns a blank string. See
[Container.enableCDN()](#CONTAINER.ENABLECDN). 

Examples:

```javascript
URL = myAccount.container('test').cdnSslUrl();
```
<a id="CONTAINER.CDNSTREAMINGURL"></a>
### Container.cdnStreamingUrl ()

Returns the container's CDN streaming URL.

#### Return Value

* The container's CDN streaming URL. If the container is not CDN enabled, returns a blank string. See
[Container.enableCDN()](#CONTAINER.ENABLECDN). 

Examples:

```javascript
URL = myAccount.container('test').cdnStreamingUrl();
```
<a id="CONTAINER.CONTAINERCDNURL"></a>
### Container.containerCdnUrl ()

Returns the container's CDN URL.

#### Return Value

* The container's CDN URL. If the container is not CDN enabled, returns a blank string. See
[Container.enableCDN()](#CONTAINER.ENABLECDN). 

Examples:

```javascript
URL = myAccount.container('test').cdnUrl();
```
<a id="CONTAINER.CREATE"></a>
### Container.create ()

Creates a container in rackspace. If the container already exists, does nothing. 

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myAccount.container('test').create();
```
<a id="CONTAINER.DISABLECDN"></a>
### Container.disableCDN ()

Disables CDN for the container.

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myAccount.container('test').disableCDN();
```
Container.enableCDN
<a id="CONTAINER.ENABLECDN"></a>
### Container.enableCDN ()

Enables CDN for the container.

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myAccount.container('test').enableCDN();
```
<a id="CONTAINER.FILE"></a>
### Container.file (name)

Creates a new container file object for the container. A container file object is used to refer to
a file within a container. The file may or may not actually exist in rackspace. This method
creates the container file object but does not actually create the file in rackspace. See
[Container File Object Methods](#CONTAINER_FILE_OBJECT_METHODS). 

#### Arguments

* `name` - The name of the file. Any valid rackspace file name is accepted. 

#### Return Value

* A File object. See [Container File Object Methods](#CONTAINER_FILE_OBJECT_METHODS).

Examples:

```javascript
myFile = myAccount.container('test').file('test.pdf');
```
<a id="CONTAINER.FILELIST"></a>
### Container.fileList (batchLimit)

Creates a new file list object for the container. A file list is used to get a listing of all of 
the files in a container. This method creates the list object but does not actually retrieve
the list. See [File List Object Methods](#FILE_LIST_OBJECT_METHODS). 

#### Arguments

* `batchLimit` *optional* - The number of files retrieved at a time. If not given, the rackspace
default is used (currently 10,000). 

#### Return Value

* A File List object. See [File List Object Methods](#FILE_LIST_OBJECT_METHODS).

Examples:

```javascript
listOfFiles = myAccount.container('test').fileList();
```
<a id="CONTAINER.GETINFO"></a>
### Container.getInfo ()

Retrieves information about the container.

#### Return Value

* An object is returned containing the following properties.

    * `bytesUsed` - The total number of bytes used for storage in the container.

    * `fileCount` - The total number of files stored in the container.

Examples:

```javascript
info = myContainer.getInfo();

// info ==> {
//               bytesUsed: 4583727,
//               fileCount: 57
//          }
```
<a id="CONTAINER.GETMETADATA"></a>
### Container.getMetaData ()

Retrieves meta data previously saved with the container using the
[Container.setMetaData()](#CONTAINER.SETMETADATA) method. 

#### Return Value

* An object is returned containing the meta data. Be advised that rackspace formats property names 
by capitalizing the first letter and the first letter after a space or underscore, changing all
other letters to lowercase and changing all underscores to dashes.

     **Property-Name Formatting Examples:**
     
     * "expense_category" ==> "Expense-Category"
     
     * "expenseCategory" ==> "Expensecategory". 

Examples:

```javascript
metaData = myContainer.getMetaData();

// metaData ==> {
//                   Expense-Category: "Advertising",
//                   Month: "June"
//              }
```
<a id="CONTAINER.REMOVE"></a>
### Container.remove (deleteOption)

Deletes the container from rackspace.

#### Arguments

* `deleteOption` *optional* - A constant value specifying if the container should be deleted even 
if it is not empty. If the container is not empty, the default behavior is to leave the container 
intact and to throw an exception. See the [DELETE\_OPTIONS constants](#DELETE_OPTIONS)
for valid values. 

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myContainer.remove(cloudFiles.DELETE_OPTIONS.FORCE_DELETE); // Delete even if not empty.
```
<a id="CONTAINER.REMOVEMETADATA"></a>
### Container.removeMetaData (keys)

Removes the meta data for each of the given property names (keys).

#### Arguments

* `keys` - An array of strings denoting the properties to remove from the container's meta data. 

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myContainer.removeMetaData(['Expense-Category', 'Month']);
```
<a id="CONTAINER.SETMETADATA"></a>
### Container.setMetaData (metaData)

Sets the meta data for a container. The meta data can be retrieved using the 
[Container.getMetaData()](#CONTAINER.GETMETADATA) method.

#### Arguments

* `metaData` - An object containing the meta data. The value of each of the object's properties
must be something other than an object (a string, number, etc.). 
     
     Be advised that rackspace formats property names by capitalizing the first letter and the first
     letter after a space or underscore, changing all other letters to lowercase and changing all
     underscores to dashes. 
     
     **Property-Name Formatting Examples:**
     
     * "expense_category" ==> "Expense-Category"
     
     * "expenseCategory" ==> "Expensecategory". 

#### Return Value

* The container object. This value is useful for chaining method calls.

Examples:

```javascript
myContainer.setMetaData({
                             Expense-Category: "Advertising",
                             Month: "June"
                        });
```

<a id="CONTAINER_FILE_OBJECT_METHODS"></a>
Container File Object Methods
-----------------------------
<a id="CONTAINERFILE.COPYTO"></a>
### ContainerFile.copyTo (toContainerFile)

Copies a file to another file with a different name and/or location. If the `toContainerFile`
already exists, it is replaced with a copy of the source file. 

#### Arguments

* `toContainerFile` - A Container File object specifying the destination of the copy. This file's
container must already exist. 

#### Return Value

* The source Container File object (`this`). This value is useful for chaining method calls.

Examples:

```javascript
// Copy a file named "test.pdf" in the "test" container to a file named "test2.pdf" in the "test2" container.
myAccount.container('test').file('test.pdf').copyTo(myAccount.container('test2').file('test2.pdf'));
```
<a id="CONTAINERFILE.DOWNLOAD"></a>
### ContainerFile.download (destinationFile, bytesPerRequest)

Downloads a file from rackspace to the given `destinationFile`. If a function to use to compute the
MD5 digest of files has been set using the [setGetFileMD5Function()](#SET_GET_FILE_MD5_FUNCTION)
function, the downloaded file is checked to insure its MD5 matches the one stored in rackspace.

#### Arguments

* `destinationFile` - A Wakanda File object specifying where to save the downloaded file. If the
file already exists, it is replaced. 

* `bytesPerRequest` *optional* - Rather than retrieving large files in one request, this method
retrieves them in chunks. This argument allows the caller to specify the number of bytes of the
file to retrieve per request. The default is 512,000 bytes (0.5MB). 

#### Return Value

* The source Container File object (`this`). This value is useful for chaining method calls.

Examples:

```javascript
// Download a rackspace file named "test.pdf" in the "test" container to a file of the same name
// within a testFiles folder in the Wakanda model folder. 
myAccount.container('test')
         .file('test.pdf')
         .download(File(ds.getModelFolder().path + 'testFiles/test.pdf'));
```
<a id="CONTAINERFILE.GETMETADATA"></a>
### ContainerFile.getMetaData ()

Retrieves meta data previously saved with the file using the
[ContainerFile.setMetaData()](#CONTAINERFILE.SETMETADATA) method. 

#### Return Value

* An object is returned containing the meta data. Be advised that rackspace formats property names 
by capitalizing the first letter and the first letter after a space or underscore, changing all
other letters to lowercase and changing all underscores to dashes.

     **Property-Name Formatting Examples:**
     
     * "expense_category" ==> "Expense-Category"
     
     * "expenseCategory" ==> "Expensecategory". 

Examples:

```javascript
metaData = myFile.getMetaData();

// metaData ==> {
//                   Expense-Category: "Advertising",
//                   Month: "June"
//              }
```
<a id="CONTAINERFILE.MOVETO"></a>
### ContainerFile.moveTo (toContainerFile)

Moves a file from its current location/name to another file with a different name and/or location.
If the `toContainerFile` already exists, it is replaced with a copy of the source file (`this`). 

#### Arguments

* `toContainerFile` - A Container File object specifying the destination of the move. This file's
container must already exist. 

#### Return Value

* The source Container File object (`this`). This value is useful for chaining method calls.

Examples:

```javascript
// Move a file named "test.pdf" in the "test" container to a file named "test2.pdf" in the "test2" container.
myAccount.container('test').file('test.pdf').moveTo(myAccount.container('test2').file('test2.pdf'));
```
<a id="CONTAINERFILE.REMOVE"></a>
### ContainerFile.remove ()

Deletes the file from rackspace. Does nothing if the file does not exist in rackspace.

#### Return Value

* The Container File object. This value is useful for chaining method calls.

Examples:

```javascript
myContainer.remove(cloudFiles.DELETE_OPTIONS.FORCE_DELETE); // Delete even if not empty.
```
<a id="CONTAINERFILE.SETMETADATA"></a>
### ContainerFile.setMetaData (metaData)

Sets the meta data for a file. The meta data can be retrieved using the 
[ContainerFile.getMetaData()](#CONTAINERFILE.GETMETADATA) method.

#### Arguments

* `metaData` - An object containing the meta data. The value of each of the object's properties
must be something other than an object (a string, number, etc.). 
     
     Be advised that rackspace formats property names by capitalizing the first letter and the first
     letter after a space or underscore, changing all other letters to lowercase and changing all
     underscores to dashes. 
     
     **Property-Name Formatting Examples:**
     
     * "expense_category" ==> "Expense-Category"
     
     * "expenseCategory" ==> "Expensecategory". 

#### Return Value

* The Container File object. This value is useful for chaining method calls.

Examples:

```javascript
myFile.setMetaData({
                        Expense-Category: "Advertising",
                        Month: "June"
                   });
```
<a id="CONTAINERFILE.UPLOAD"></a>
### ContainerFile.upload (file, mimeType)

Uploads a system `file` to a rackspace file (`this`). If the rackspace file already exists, it is
replaced. If a function to use to compute the MD5 digest of files has been set using the
[setGetFileMD5Function()](#SET_GET_FILE_MD5_FUNCTION) function, rackspace checks to insure the
uploaded file's MD5 matches the one computed on the original system file. 

#### Arguments

* `file` - A Wakanda File object specifying the system file to upload.

* `mimeType` *optional* - This method can automatically determine the MIME type for the `file`
based on its extension (and sometimes its name). Supply this argument to override the
automatically generated MIME type. 

#### Return Value

* The destination Container File object (`this`). This value is useful for chaining method calls.

Examples:

```javascript
// Upload a system file named "test.pdf" within a testFiles folder in the Wakanda model folder to a rackspace file
// with the same name in the "test" container. 
myAccount.container('test')
         .file('test.pdf')
         .upload(File(ds.getModelFolder().path + 'testFiles/test.pdf'));
```

<a id="CONTAINER_LIST_OBJECT_METHODS"></a>
Container List Object Methods
-----------------------------
<a id="EXAMPLE"></a>
### Example

Display a list of all of the account's containers in the console.

```javascript
var cloudFiles = require('rackspaceCloudFiles');

var containerList = cloudFiles.login('myUserName', 'myApiKey').containerList().get();
	
while (containerList.isNotAtEnd()) {
    console.info(containerList.currentContainerInfo().name);
    containerList.goToNextContainer();
}
```
<a id="CONTAINERLIST.CURRENTCONTAINER"></a>
### ContainerList.currentContainer ()

Returns a Container object representing the current container in the list.

#### Return Value

* A Container object representing the current container in the list. Returns null if there is no
current container because the list is empty or there are no more list items.

Examples:

```javascript
theContainer = listOfContainers.currentContainer();
```
<a id="CONTAINERLIST.CURRENTCONTAINERINFO"></a>
### ContainerList.currentContainerInfo ()

Returns an object containing information about the current container in the list.

#### Return Value

* An object containing information about the current container in the list. Returns null if there
is no current container because the list is empty or there are no more list items.

    ##### Returned Object Properties

    * `bytes` - The total number of bytes stored in the container.

    * `count` - The total number of files stored in the container.

    * `name` - The name of the container.

Examples:

```javascript
info = listOfContainers.currentContainerInfo();

// info ==> {
//               bytes: 4583727,
//               count: 12,
//               name: "Test"
//          }
```
<a id="CONTAINERLIST.GET"></a>
### ContainerList.get ()

Retrieves a list of the containers in an account. The first container in the list is set as the 
"current" container. You can get the current container using the
[currentContainer()](#CONTAINERLIST.CURRENTCONTAINER) method or just get its information (name,
size, etc.) using the [currentContainerInfo()](#CONTAINERLIST.CURRENTCONTAINERINFO) method. You
can iterate through the list using the [goToNextContainer()](#CONTAINERLIST.GOTONEXTCONTAINER)
method. 

#### Return Value

* The container list object. This value is useful for chaining method calls.

Examples:

```javascript
listOfContainers = myAccount.containerList();
listOfContainers.get();
```
<a id="CONTAINERLIST.GOTONEXTCONTAINER"></a>
### ContainerList.goToNextContainer ()

Sets the current container in the list to the one after the current container.

#### Return Value

* The container list object. This value is useful for chaining method calls.

Examples:

```javascript
listOfContainers.goToNextContainer();
```
<a id="CONTAINERLIST.ISATEND"></a>
### ContainerList.isAtEnd ()

Determines if there are no more items in the container list.

#### Return Value

* Returns *true* if there are no more items and *false* otherwise.

Examples:

```javascript
listOfContainers.isAtEnd();
```
<a id="CONTAINERLIST.ISNOTATEND"></a>
### ContainerList.isNotAtEnd ()

Determines if there are more items in the container list.

#### Return Value

* Returns *true* if there are more items and *false* otherwise.

Examples:

```javascript
listOfContainers.isNotAtEnd();
```

<a id="FILE_LIST_OBJECT_METHODS"></a>
File List Object Methods
------------------------
<a id="EXAMPLE"></a>
### Example

Display a list of all of the 'test' container's files in the console.

```javascript
var cloudFiles = require('rackspaceCloudFiles');

var fileList = cloudFiles.login('myUserName', 'myApiKey').container('test').fileList().get();
	
while (fileList.isNotAtEnd()) {
    console.info(fileList.currentFileInfo().name);
    fileList.goToNextFile();
}
```
<a id="FILELIST.CURRENTFILE"></a>
### FileList.currentFile ()

Returns a Container File object representing the current file in the list.

#### Return Value

* A Container File object representing the current file in the list. Returns null if there is no
current file because the list is empty or there are no more list items.

Examples:

```javascript
theFile = listOfFiles.currentFile();
```
<a id="FILELIST.CURRENTFILEINFO"></a>
### FileList.currentFileInfo ()

Returns an object containing information about the current file in the list.

#### Return Value

* An object containing information about the current file in the list. Returns null if there
is no current file because the list is empty or there are no more list items.

    ##### Returned Object Properties

    * `bytes` - The file's total number of bytes.

    * `content_type` - The file's MIME type.

    * `hash` - The file's MD5 digest.

    * `last_modified` - The date/time the file was last modified.

    * `name` - The file's full name including any extension.

Examples:

```javascript
info = listOfFiles.currentFileInfo();

// info ==> {
//               bytes: 9978,
//               content_type: 'image/jpeg',
//               hash: 'f1cb7b29c89dfa3113d620b9e87232f4',
//               last_modified: '2013-10-25T14:11:35.469120',
//               name: "testFile.jpg"
//          }
```
<a id="FILELIST.GET"></a>
### FileList.get ()

Retrieves a list of the files in a container. The first file in the list is set as the "current"
file. You can get the current file using the [currentFile()](#FILELIST.CURRENTFILE) method or 
just get its information (name, size, etc.) using the [currentFileInfo()](#FILELIST.CURRENTFILEINFO)
method. You can iterate through the list using the [goToNextFile()](#FILELIST.GOTONEXTFILE) method. 

#### Return Value

* The file list object. This value is useful for chaining method calls.

Examples:

```javascript
listOfFiles = myAccount.container('test').fileList();
listOfFiles.get();
```
<a id="FILELIST.GOTONEXTFILE"></a>
### FileList.goToNextFile ()

Sets the current file in the list to the one after the current file.

#### Return Value

* The file list object. This value is useful for chaining method calls.

Examples:

```javascript
listOfFiles.goToNextFile();
```
<a id="FILELIST.ISATEND"></a>
### FileList.isAtEnd ()

Determines if there are no more items in the file list.

#### Return Value

* Returns *true* if there are no more items and *false* otherwise.

Examples:

```javascript
listOfFiles.isAtEnd();
```
<a id="FILELIST.ISNOTATEND"></a>
### FileList.isNotAtEnd ()

Determines if there are more items in the file list.

#### Return Value

* Returns *true* if there are more items and *false* otherwise.

Examples:

```javascript
listOfFiles.isNotAtEnd();
```

<a id="KNOWN_ISSUES"></a>
Known Issues
------------
<a id="AUTOMATIC_FILE_DELETION"></a>
### Automatic File Deletion

Using rackspace's X-Delete-After and X-Delete-At HTTP fields does not work properly. Setting either
of these for a rackspace file through the API results in a file of 0 bytes in length. Therefore the
ContainerFile.setDeleteAfter() and ContainerFile.setDeleteAt() methods are not available at this
time. They are commented out until this isssue is resolved. 

<a id="TESTING"></a>
Testing
-------
rackspaceCloudFiles uses Wakanda's implementation of [YUI
Test](http://yuilibrary.com/yui/docs/test/). 

**WARNING:** The test code creates 5 rackspace containers in your account named "test1" through
"test5" and deletes them. If you have any real containers with any of these names, please rename
them before running the test or do not run the test. Otherwise they will be deleted. 

1. In Wakanda Studio, open Modules/testCases.js in the CloudFiles project.
2. Enter your rackspace account information into the following three lines of code toward the top
of the file:  

    ```javascript
    //**********************************************************************
    userName = 'Your User Name Here';
    apiKey = 'Your rackspace API Key Here';
    accountLocation = cloudFiles.ACCOUNT_LOCATIONS.US; // Your account location here.
    //**********************************************************************
    ```

3. Open scripts/test.js.
4. Click Run File. The results should appear in your browser.

<a id="CONTRIBUTIONS"></a>
Contributions
-------------
If you contribute to this library, just modify `Modules/rackspaceCloudFiles.js` and
`Modules/testCases.js` and send a pull request. Please remember to update the markdown if the public
interface changes. 

<a id="LICENSE"></a>
License
-------
Licensed under MIT.

Copyright (C) 2013 [Jeff Grann](https://github.com/jeffgrann) <jeff@successware.net>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions: 

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software. 

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
