// works for NODE > v10
const pug = require('pug');
const path = require('path');
require('dotenv').config()
const fs = require("fs");
const axios = require('axios');
var FormData = require('form-data');
//formidable takes the form data and saves the file, and parameterises the fields into JSON
const formidable = require('formidable')
const express = require('express');
const app = express();
var plateToken = process.env.plateToken;
var DVLAToken = process.env.DVLAToken;
//base64 conversion
var atob = require('atob');

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
//set up pug as view engine
app.set('view engine','pug');
// https://expressjs.com/en/starter/basic-routing.html


app.get("/", (request, response) => {
    return response.render('index');
});


app.get("/camera", (request, response) => {
    response.sendFile(path.join(__dirname, '/public', 'camera.html'));  
});
app.get("/MOT", (request, response) => {
   response.redirect('/camera.html?response=mot');
	 
});
app.get("/tax", (request, response) => {
	response.redirect('/camera.html?response=tax');
	  
 });

app.post("/", (request, response) => {

	//this sends in a form with an image
    //formidable reads the form, saves the image
	var form = new formidable.IncomingForm({maxFileSize : 2000 * 1024 * 1024}); //2 Gb
	
	form.parse(request, (err, fields, files) => {
    if (err) {
		  console.error('Error', err);
		  throw err;
	}
	var responseType = fields.responseType;
	console.log("responsetype", responseType);
	//console.log(fields);
	//PARSED FORM
	var newImagePath;
	var base64Image = false;
	//if from camera - the image comes in as base64
	if(fields.file.length>0){
		base64Image = true;
		//base64 immage from camera app
		console.log("fields", fields.file);
		// Remove header
		let base64String= fields.file;
		let base64ImageFile = base64String.split(';base64,').pop();
		//console.log(base64ImageFile);
		fs.writeFile('image.png', base64ImageFile, {encoding: 'base64'}, function(err) {
			console.log('File created');
		});
		newImagePath = 'image.png';

		console.log("newImagePath",newImagePath);
		makeRequest(newImagePath);
	} else{
		//uploaded image
		console.log("file");	
		console.log("files data", JSON.stringify(files.imageSource));
		var imageName = path.parse(files.imageSource.name).name;
		var imagePath = files.imageSource.path;
		var imageType = files.imageSource.type;
		var imageSize = files.imageSource.size;
		
		//FORMIDIABLE USES A RANDOM NAME ON UPLOAD.  RENAME
		 newImagePath  = imagePath+ imageName;
		fs.rename(imagePath, newImagePath, function (err) {
			if (err) throw err;
			console.log('File uploaded and moved!');
			//FILE IS RENAMED
			//NOW UPLOAD IT TO MINDEE WITH THE MAKEREQUEST FUNCTION
			makeRequest(newImagePath);
		});
	}
	
	
		async function makeRequest(newImagePath) {
			console.log("newImagePath",newImagePath);

			let data = new FormData();
			if(base64Image){
				//add base64 image
				data.append('file', fs.createReadStream(newImagePath));	
			} else {
				//add the image that was uploaded	
				data.append('file', fs.createReadStream(newImagePath));
			}
		//	console.log("form data ", data);
	
 		   const config = {
  			 method: 'POST',
  			   url: 'https://api.mindee.net/products/license_plates/v1/predict',
  			   headers: { 
  				   'X-Inferuser-Token':plateToken,
  				   ...data.getHeaders()
 				  },
				  data
 			  }
			  console.log("config" ,config);
			  try {
				  let apiResponse = await axios(config)
				  console.log(" api response", apiResponse.data);
				  
				  
				  
		 		  //pull out the data I want to show on the page
				  var predict = apiResponse.data.predictions[0];

				  console.log("predict",predict);
				  var plate = apiResponse.data.predictions[0].license_plates[0].value;
				  
				  console.log("plate", plate);
				  
				  //NOW WE HAVE THE PLATE NUMBER, 
				  // CALL DVLA TO FIND OUT ABOUT THE CAR 
				  data = {'registrationNumber': plate};
				  const DVLAconfig = {
					method: 'POST',
					  url: 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
					  headers: { 
						  'x-api-key':DVLAToken,
						  'Content-Type': 'application/json'
						},
						data
					}
					console.log("DVLAconfig" ,DVLAconfig);
					try {
						let DVLAapiResponse = await axios(DVLAconfig)
						console.log("DVLA response", DVLAapiResponse.data);

						var motStatus = DVLAapiResponse.data.motStatus;
						var motExpire = DVLAapiResponse.data.motExpiryDate;
						var fuelType = DVLAapiResponse.data.fuelType;
						var colour = DVLAapiResponse.data.colour;
						var make = DVLAapiResponse.data.make;
						var taxStatus = DVLAapiResponse.data.taxStatus;
						var year = DVLAapiResponse.data.yearOfManufacture;
						var taxDueDate = DVLAapiResponse.data.taxDueDate;
						if(responseType.length>0){
							console.log(responseType);
							//there could be a bunch of different responses
							if(responseType === "mot"){
								return response.render('mot',{plate, motStatus, motExpire,fuelType, colour, make, taxStatus, year});
							} 
							else if (responseType ==="tax"){
								return response.render('tax',{plate,taxDueDate, motStatus, motExpire,fuelType, colour, make, taxStatus, year});
							}
						}else{
							return response.render('receipt',{plate, motStatus, motExpire,fuelType, colour, make, taxStatus, year});
						}
					} catch (error) {
						console.log(error)
					}		

				  
				  
			  } catch (error) {
 				  console.log(error)
 			  }

		  }
		  //makeRequest()
	 });
});






// listen for requests :)
const listener = app.listen(3003, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

function decodeBase64Image(dataString) {
	var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
	  response = {};
  
	if (matches.length !== 3) {
	  return new Error('Invalid input string');
	}
  
	response.type = matches[1];
	response.data = new Buffer(matches[2], 'base64');
  
	return response;
  }