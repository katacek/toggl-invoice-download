# Toggl invoice download

Apify actor to download invoices from [Toggl.com](https://toggl.com/) (time-tracker application). This actor goes to toggl.com, signs in, goes to invoices, downloads the last one and saves it to key-value store.
There is a possibility to upload the invoice to dropbox and send a notification email - by already existing actors ([dropbox upload](https://apify.com/petr_cermak/dropbox-upload), [send mail](https://apify.com/apify/send-mail)) incorporated in the code. 

## Input 

The following table shows specification of the actor INPUT fields as defined by its input schema. 

Field |	Type	| Description
---| ---| ---|
user|	*String*|	(required) Username on toggl.com (i.e.  "user": "user@company.com" )
password|	*String*|	(required) Toggl account password (i.e.  "password": "password123" )
dropboxToken|	*String*|	(optional) Token for dropbox (i.e. "dropboxToken": "GCDRDJKU%$#%$(&f" )
pathToDropbox| 	*String*|	(optional) Path where to upload the invoice on Dropbox. Default setting is to folder named YYYY_MM.
emailTo| 	*String*|	(optional) Email address for sending the notification (i.e.  "emailTo": "user@company.com")

## How to run

To run the actor, you'll need an [Apify account](https://my.apify.com/). Simply create a new task for the actor by clicking the green button above, modify the actor input configuration, click Run and get your results.

## API

To run the actor from your code, send a HTTP POST request to the following API endpoint: 

https://api.apify.com/v2/acts/katerinahronik~toggl-invoice-download?token=<YOUR_API_TOKEN>

## CU usage 

Approximately 0.03 CU per run including upload to dropbox and sending e-mail.
