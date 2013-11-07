"use strict";

({define: typeof define === 'function' ? define : function (A,F) {var I = F.apply(null, A.map(require)); Object.keys(I).forEach(function(k) {exports[k] = I[k];});}}).define(

['rackspaceCloudFiles',
 'underscore'],

function (cloudFiles, _) {
	var account;
	var accountLocation;
	var apiKey;
	var cdnURL;
	var downloadedFiles = [];
	var downloadFile;
	var getFileMD5;
	var jpgCloudFile;
	var pdfCloudFile;
	var publicInterface = {};
	var testFilesFolder = ds.getModelFolder().path + 'testFiles/';
	var userName;
	
	//**********************************************************************
	//userName = 'Your User Name Here';
	//apiKey = 'Your rackspace API Key Here';
	//accountLocation = cloudFiles.ACCOUNT_LOCATIONS.US; // Your account location here.
	//**********************************************************************

	//----------------------------------------------------------------------------------------------------
	// MD5
	//----------------------------------------------------------------------------------------------------
	getFileMD5 = function getFileMD5 (file) {
		var firstSpacePos;
		var result;
		var trimmedResult;
		
		if (os.isMac) {
			result = SystemWorker.exec('md5 -q ' + file.path);

			if (result.exitStatus !== 0) {
				throw new Error("Cannot get md5 for '" + file.path + "'. " + result.error.toString());
			}
		
			return result.output.toString().trim();
		}
		else if (os.isWindows) {
			throw new Error("Computing the md5 digest for a file on the Windows platform is not yet implemented."); // See http://support.microsoft.com/kb/841290 !!!!!
		}
		else if (os.isLinux) {
			//This needs to be tested on a Linux system!!!!!
			result = SystemWorker.exec('md5sum ' + file.path);

			if (result.exitStatus !== 0) {
				throw new Error("Cannot get md5 for '" + file.path + "'. " + result.error.toString());
			}
		
			trimmedResult = result.output.toString().trim();
			firstSpacePos = trimmedResult.indexOf(' ');
			
			if (firstSpacePos >=0 ) {
				trimmedResult = trimmedResult.substring(0, firstSpacePos);
			}
			
			return trimmedResult;
		}
	};

	//----------------------------------------------------------------------------------------------------
	// Download File
	//----------------------------------------------------------------------------------------------------
	downloadFile = function downloadFile (url, destinationFile) {
		var writeStream;
		var xhr;
		
		writeStream = BinaryStream(destinationFile, "Write");

		try {
			xhr = new XMLHttpRequest();
			xhr.open('GET', url);
			xhr.responseType = 'blob';
			xhr.send();
			
			if (xhr.status < 200 || xhr.status > 299) {
				throw new Error("Could not download a file at '" + url + "'. " + xhrStatusText(xhr));
			}
			else {
				writeStream.putBlob(xhr.response);
			}
		}
		finally {
			writeStream.close();
		}
	};

	publicInterface.get = function getTestCases () {
		cloudFiles.setGetFileMD5Function(getFileMD5);

		account = cloudFiles.login(userName, apiKey, accountLocation);

		jpgCloudFile = account.container('test1').file('testFile1.jpg');
		pdfCloudFile = account.container('test1').file('testFile2.pdf');

		var testCases = {
		    name: "cloudFiles Tests",

		    _should: {
		        error: {
		            'test moved source file no longer exists': true,
		            'test moved source file no longer exists when reauth needed': true,
		            'test container deletion when not empty and not passing the force-delete option': true
		        }
		    },

			//----------------------------------------------------------------------------------------------------
			// Get Account Info
			//----------------------------------------------------------------------------------------------------
			'test get account info': function () {
				var accountInfo;
				
				accountInfo = account.getInfo();
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('bytesUsed'), 'account info should contain bytesUsed');
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('containerCount'), 'account info should contain containerCount');
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('fileCount'), 'account info should contain fileCount');
			},

			'test get account info when reauth needed': function () {
				var accountInfo;
				
				account._authToken = 'XXXXX'; // fake auth token
				accountInfo = account.getInfo();
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('bytesUsed'), 'account info should contain bytesUsed');
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('containerCount'), 'account info should contain containerCount');
				Y.Assert.isTrue(_.isObject(accountInfo) && accountInfo.hasOwnProperty('fileCount'), 'account info should contain fileCount');
			},

			//----------------------------------------------------------------------------------------------------
			// Container Creation
			//----------------------------------------------------------------------------------------------------
			'test container creation': function () {
				var originalContainerCount = account.getInfo().containerCount;
				account.container('test1').create();
				Y.Assert.areSame(account.getInfo().containerCount, originalContainerCount + 1, 'container listing should contain ' + (originalContainerCount + 1) + ' items');
				account.container('test2').create();
				Y.Assert.areSame(account.getInfo().containerCount, originalContainerCount + 2, 'container listing should contain ' + (originalContainerCount + 2) + ' items');
				account.container('test3').create();
				Y.Assert.areSame(account.getInfo().containerCount, originalContainerCount + 3, 'container listing should contain ' + (originalContainerCount + 3) + ' items');
				account.container('test4').create();
				Y.Assert.areSame(account.getInfo().containerCount, originalContainerCount + 4, 'container listing should contain ' + (originalContainerCount + 4) + ' items');
			},

			'test container creation when reauth needed': function () {		
				var originalContainerCount = account.getInfo().containerCount;
				account._authToken = 'XXXXX'; // fake auth token
				account.container('test5').create();
				Y.Assert.areSame(account.getInfo().containerCount, originalContainerCount + 1, 'container listing should contain ' + (originalContainerCount + 1) + ' items');
			},

			//----------------------------------------------------------------------------------------------------
			// Get/Set Container Meta Data
			//----------------------------------------------------------------------------------------------------
			'test get/set container meta data': function () {
				var container = account.container('test1');
				var metaData = {Owner: 'Jeff', Category: 'Expenses'};
				
				container.setMetaData(metaData);
				Y.Assert.isTrue(_.isEqual(container.getMetaData(), metaData), 'retrieved container meta data should be the same as the originally set meta data');
			},

			'test get/set container meta data when reauth needed': function () {
				var container = account.container('test2');
				var metaData = {Owner: 'John Doe', Category: 'Receipts'};
				
				account._authToken = 'XXXXX'; // fake auth token
				container.setMetaData(metaData);
				account._authToken = 'XXXXX'; // fake auth token
				Y.Assert.isTrue(_.isEqual(container.getMetaData(), metaData), 'retrieved container meta data should be the same as the originally set meta data');
			},

			//----------------------------------------------------------------------------------------------------
			// Remove Container Meta Data
			//----------------------------------------------------------------------------------------------------
			'test remove container meta data': function () {
				var container = account.container('test1');
				var metaData = {Category: 'Expenses'};
				
				container.removeMetaData(['Owner']);
				Y.Assert.isTrue(_.isEqual(container.getMetaData(), metaData), 'retrieved container meta data should not longer contain removed meta data');
			},

			'test remove container meta data when reauth needed': function () {
				var container = account.container('test2');
				var metaData = {Owner: 'John Doe'};
				
				account._authToken = 'XXXXX'; // fake auth token
				container.removeMetaData(['Category']);
				Y.Assert.isTrue(_.isEqual(container.getMetaData(), metaData), 'retrieved container meta data should not longer contain removed meta data');
			},

			//----------------------------------------------------------------------------------------------------
			// Container Listing
			//----------------------------------------------------------------------------------------------------
			'test container listing': function () {
				var containerCount = account.getInfo().containerCount;
				var containerList;
				var containerNames = [];
				var i = 1;
				var infoNames = [];
				var name;
				
				containerList = account.containerList(2).get();
				
				while (containerList.isNotAtEnd()) {
					name = containerList.currentContainerInfo().name;
					
					if (name.match(/^test\d/) !== null) {
						infoNames.push(name);
					}
					
					name = containerList.currentContainer()._name;
					
					if (name.match(/^test\d/) !== null) {
						containerNames.push(name);
					}
					
					i++;
					containerList.goToNextContainer();
				}
				
				Y.Assert.areSame(infoNames.length, 5, 'container listing should contain 5 test# items');
				Y.Assert.areSame(containerNames.length, 5, 'container listing should contain 5 test# containers');
				Y.Assert.areSame(i - 1, containerCount, 'container listing should contain the same number of items as the account container count');
			},

			'test container listing when reauth needed': function () {
				var containerCount = account.getInfo().containerCount;
				var containerList;
				var containerNames = [];
				var i = 1;
				var infoNames = [];
				var name;
				
				account._authToken = 'XXXXX'; // fake auth token
				containerList = account.containerList(2).get();
				
				while (containerList.isNotAtEnd()) {
					name = containerList.currentContainerInfo().name;
					
					if (name.match(/^test\d/) !== null) {
						infoNames.push(name);
					}
					
					name = containerList.currentContainer()._name;
					
					if (name.match(/^test\d/) !== null) {
						containerNames.push(name);
					}
					
					i++;
					account._authToken = 'XXXXX'; // fake auth token
					containerList.goToNextContainer();
				}
				
				Y.Assert.areSame(infoNames.length, 5, 'container listing should contain 5 test# items');
				Y.Assert.areSame(containerNames.length, 5, 'container listing should contain 5 test# containers');
				Y.Assert.areSame(i - 1, containerCount, 'container listing should contain the same number of items as the account container count');
			},

			//----------------------------------------------------------------------------------------------------
			// File Upload/Download
			//----------------------------------------------------------------------------------------------------
			'test file upload/download': function () {
				var downloadFile = File(testFilesFolder + 'downloadedTestImage.jpg');
				var systemFile = File(testFilesFolder + 'testImage.jpg');
				
				jpgCloudFile.upload(systemFile);
				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				jpgCloudFile.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'downloaded file should be the same as the originally uploaded file');
			},
			
			'test file upload/download when reauth needed': function () {
				var downloadFile = File(testFilesFolder + 'downloadedTestPdf.pdf');
				var systemFile = File(testFilesFolder + 'testPdf.pdf');
				
				account._authToken = 'XXXXX'; // fake auth token
				pdfCloudFile.upload(systemFile);
				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				account._authToken = 'XXXXX'; // fake auth token
				pdfCloudFile.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'downloaded file should be the same as the originally uploaded file when reauth needed');
			},

			//----------------------------------------------------------------------------------------------------
			// Container File Listing
			//----------------------------------------------------------------------------------------------------
			'test container file listing': function () {
				var fileCount = account.container('test1').getInfo().fileCount;
				var fileList;
				var fileNames = [];
				var i = 1;
				var infoNames = [];
				var name;
				
				fileList = account.container('test1').fileList(2).get();
				
				while (!fileList.isAtEnd()) {
					name = fileList.currentFileInfo().name;
					
					if (name.match(/^testFile\d/) !== null) {
						infoNames.push(name);
					}
					
					name = fileList.currentFile()._fileName;
					
					if (name.match(/^testFile\d/) !== null) {
						fileNames.push(name);
					}
					
					i++;
					fileList.goToNextFile();
				}
				
				Y.Assert.areSame(infoNames.length, 2, 'container file listing should contain 2 testFile# items');
				Y.Assert.areSame(fileNames.length, 2, 'container file listing should contain 2 testFile# containers');
				Y.Assert.areSame(i - 1, fileCount, 'container file listing should contain the same number of files as the container file count');
			},
			
			'test container file listing when reauth needed': function () {
				var fileCount = account.container('test1').getInfo().fileCount;
				var fileList;
				var fileNames = [];
				var i = 1;
				var infoNames = [];
				var name;
				
				account._authToken = 'XXXXX'; // fake auth token
				fileList = account.container('test1').fileList(2).get();
				
				while (!fileList.isAtEnd()) {
					name = fileList.currentFileInfo().name;
					
					if (name.match(/^testFile\d/) !== null) {
						infoNames.push(name);
					}
					
					name = fileList.currentFile()._fileName;
					
					if (name.match(/^testFile\d/) !== null) {
						fileNames.push(name);
					}
					
					i++;
					account._authToken = 'XXXXX'; // fake auth token
					fileList.goToNextFile();
				}
				
				Y.Assert.areSame(infoNames.length, 2, 'container file listing should contain 2 testFile# items');
				Y.Assert.areSame(fileNames.length, 2, 'container file listing should contain 2 testFile# containers');
				Y.Assert.areSame(i - 1, fileCount, 'container file listing should contain the same number of files as the container file count');
			},

			//----------------------------------------------------------------------------------------------------
			// Get/Set File Meta Data
			//----------------------------------------------------------------------------------------------------
			'test get/set file meta data': function () {
				var metaData = {Owner: 'Jeff', Category: 'Expenses'};
				
				jpgCloudFile.setMetaData(metaData);
				Y.Assert.isTrue(_.isEqual(jpgCloudFile.getMetaData(), metaData), 'retrieved file meta data should be the same as the originally set meta data');
			},

			'test get/set file meta data when reauth needed': function () {
				var metaData = {Owner: 'John Doe', Category: 'Receipts'};
				
				account._authToken = 'XXXXX'; // fake auth token
				pdfCloudFile.setMetaData(metaData);
				account._authToken = 'XXXXX'; // fake auth token
				Y.Assert.isTrue(_.isEqual(pdfCloudFile.getMetaData(), metaData), 'retrieved file meta data should be the same as the originally set meta data');
			},

			//----------------------------------------------------------------------------------------------------
			// Get Container Info
			//----------------------------------------------------------------------------------------------------
			'test get container info': function () {
				var info;
				
				info = account.container('test1').getInfo();
				Y.Assert.isTrue(_.isObject(info) && info.hasOwnProperty('bytesUsed') && info.bytesUsed === 17780, 'container info should contain correct bytesUsed');
				Y.Assert.isTrue(_.isObject(info) && info.hasOwnProperty('fileCount') && info.fileCount === 2, 'container info should contain correct fileCount');
			},

			'test get container info when reauth needed': function () {
				var info;
				
				account._authToken = 'XXXXX'; // fake auth token
				info = account.container('test1').getInfo();
				Y.Assert.isTrue(_.isObject(info) && info.hasOwnProperty('bytesUsed') && info.bytesUsed === 17780, 'container info should contain correct bytesUsed');
				Y.Assert.isTrue(_.isObject(info) && info.hasOwnProperty('fileCount') && info.fileCount === 2, 'container info should contain correct fileCount');
			},

			//----------------------------------------------------------------------------------------------------
			// Copy File
			//----------------------------------------------------------------------------------------------------
			'test copy file': function () {
				var destination;
				var downloadFile;
				var fileName = 'copiedJpgCloudFile.jpg';
				var systemFile = File(testFilesFolder + 'testImage.jpg');
				
				destination = account.container('test2').file(fileName);
				downloadFile = File(testFilesFolder + fileName);
				jpgCloudFile.copyTo(destination);

				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				destination.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'copied file should be the same as the originally uploaded file');
			},

			'test copy file when reauth needed': function () {
				var destination;
				var downloadFile;
				var fileName = 'copiedpdfCloudFile.pdf';
				var systemFile = File(testFilesFolder + 'testPdf.pdf');
				
				destination = account.container('test2').file(fileName);
				downloadFile = File(testFilesFolder + fileName);
				account._authToken = 'XXXXX'; // fake auth token
				pdfCloudFile.copyTo(destination);

				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				destination.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'copied file should be the same as the originally uploaded file');
			},

			//----------------------------------------------------------------------------------------------------
			// Move File
			//----------------------------------------------------------------------------------------------------
			'test move file': function () {
				var destination;
				var downloadFile;
				var fileName = 'movedJpgCloudFile.jpg';
				var source = account.container('test2').file('copiedJpgCloudFile.jpg');
				var systemFile = File(testFilesFolder + 'testImage.jpg');
				
				destination = account.container('test1').file(fileName);
				downloadFile = File(testFilesFolder + fileName);
				source.moveTo(destination);
				
				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				destination.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'moved file should be the same as the originally uploaded file');
			},

			'test moved source file no longer exists': function () {
				account.container('test2').file('copiedJpgCloudFile.jpg').getMetaData();
			},

			'test move file when reauth needed': function () {
				var destination;
				var downloadFile;
				var fileName = 'movedpdfCloudFile.pdf';
				var source = account.container('test2').file('copiedpdfCloudFile.pdf');
				var systemFile = File(testFilesFolder + 'testPdf.pdf');
				
				destination = account.container('test1').file(fileName);
				downloadFile = File(testFilesFolder + fileName);
				account._authToken = 'XXXXX'; // fake auth token
				source.moveTo(destination);
				
				downloadedFiles.push(downloadFile);
				downloadFile.remove();
				destination.download(downloadFile);
				Y.Assert.areSame(getFileMD5(downloadFile), getFileMD5(systemFile), 'moved file should be the same as the originally uploaded file');
			},
			
			'test moved source file no longer exists when reauth needed': function () {
				account.container('test2').file('copiedpdfCloudFile.pdf').getMetaData();
			},

			//----------------------------------------------------------------------------------------------------
			// CDN
			//----------------------------------------------------------------------------------------------------
			'test CDN': function () {
				var container = account.container('test1');
				var destination = File(testFilesFolder + 'downloadedCdnTestImage.jpg');
				var systemFile = File(testFilesFolder + 'testImage.jpg');
				
				container.enableCDN();
				
				downloadedFiles.push(destination);
				destination.remove();
				cdnURL = container.cdnUrl()+ '/' + jpgCloudFile._encodedFileName;
				downloadFile(cdnURL, destination);
				Y.Assert.areSame(getFileMD5(destination), getFileMD5(systemFile), 'fetched CDN file should be the same as the originally uploaded file');
				
				downloadedFiles.push(destination);
				destination.remove();
				cdnURL = container.cdnSslUrl()+ '/' + jpgCloudFile._encodedFileName;
				downloadFile(cdnURL, destination);
				Y.Assert.areSame(getFileMD5(destination), getFileMD5(systemFile), 'SSL-fetched CDN file should be the same as the originally uploaded file');
			},

			//----------------------------------------------------------------------------------------------------
			// Container Deletion
			//----------------------------------------------------------------------------------------------------
			'test container deletion when not empty and not passing the force-delete option': function () {
				account.container('test1').remove();
			},

			'test container deletion': function () {
				var currentContainerCount = account.getInfo().containerCount;
				
				account.container('test1').remove(cloudFiles.DELETE_OPTIONS.DELETE_EVEN_IF_NOT_EMPTY);
				Y.Assert.areSame(account.getInfo().containerCount, currentContainerCount - 1, 'should be able to delete a non-empty container when passing the force-delete option');
			},

			'test container deletion when reauth needed': function () {		
				var currentContainerCount = account.getInfo().containerCount;
				account._authToken = 'XXXXX'; // fake auth token
				account.container('test2').remove();
				Y.Assert.areSame(account.getInfo().containerCount, currentContainerCount - 1, 'should be able to delete a container when reauth needed');
			},

			'test remove remaining containers and downloaded files': function () {		
				var containerList = account.containerList().get();
				
				while (containerList.isNotAtEnd()) {
					if (containerList.currentContainerInfo().name.match(/^test\d/) !== null) {
						containerList.currentContainer().remove(cloudFiles.DELETE_OPTIONS.FORCE_DELETE);
					}
					
					containerList.goToNextContainer();
				}
				
				downloadedFiles.forEach(function (downloadedFile) {
											downloadedFile.remove();
										});
			}
	    };
	    
	    return testCases;
	};
	
	return publicInterface;
});
