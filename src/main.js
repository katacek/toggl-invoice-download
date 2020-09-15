const Apify = require('apify');

Apify.main(async () => {
    
    const input = await Apify.getValue('INPUT');

    const user = input.togglUserName || process.env.user;
    const pwd = input.togglPassword || process.env.pwd;
    
    console.log('Launching Puppeteer...');
    const browser = await Apify.launchPuppeteer();

    console.log('Signing in ...');
    const page = await browser.newPage();

    //await page.goto('https://toggl.com/login/', {
        //waitUntil: ['load','domcontentloaded','networkidle0','networkidle2']
       //});

    await page.goto('https://toggl.com/login/');
    //await page.type('#login-email', user, { delay: 100 });
    //await page.type('#login-password', pwd, { delay: 100 });
    
    //await page.focus('#login-button');
    //await page.waitFor(500);
    
    //await page.click('#login-button');
    //await page.waitForNavigation();
    
    await page.type('#email', user, { delay: 100 });
    await page.type('#password', pwd, { delay: 100 });

    await page.evaluate(() => document.querySelector('button[type="submit"]').scrollIntoView());
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    console.log('Signed ...');

    //go to url subscriptions
    const urlSubscription = 'https://toggl.com/app/subscription';
    await page.goto(urlSubscription);
    await page.waitForNavigation();
    const currentUrl = page.url();

    //find id in url
    const regex = /[0-9]+/g;
    const found = currentUrl.match(regex);

    //construct invoice url with id
    const invoiceUrl = 'https://toggl.com/app/subscription/'+ found +'/invoices-and-payments';
    //goto url invoices
    await page.goto(invoiceUrl);

    const lastInvoice = '.css-1xdhyk6.e22ygp00 > div > a:nth-child(3)'
    await page.waitForSelector(lastInvoice);

    console.log('Opening invoice ...');
    
    // get url to last invoice and name the file
    const linkLastInvoice = await page.$eval(lastInvoice,el=>el.href);
    const invoiceName = '.css-1xdhyk6.e22ygp00 > div > a:nth-child(3) > div > div.css-8a0s72.e22ygp01'
    const texpromise = page.$eval(invoiceName, el => el.textContent);
    const text = await texpromise;
    const filename = text.replace(/\s+/g,'_').replace(/,/g,'')+'_toggl.pdf';
    
    // get request     
    const simpleRequest = require('request-promise-native');
    
    async function getPdfBuffer(url, cookies)
    {
        //make cookie string - page.cookies() return dictionary
        let cookieStr = '';
        for(var i = 0; i < cookies.length; i+=1)
        {
                const cookie = cookies[i];
                cookieStr += cookie.name + "=" + cookie.value + ";";
        }
  
        const options = 
        {
            url: url,
            method: 'GET',
            timeout: 120 * 1000,
            // set to `null`, if you expect binary data.
            encoding: null, 
            //set cookies to header
            headers: { "cookie": cookieStr }, 
        };

        const buffer = await simpleRequest.get(options);
        return buffer;
    }

    const cookies = await page.cookies();
    const pdfBuffer  = await getPdfBuffer(linkLastInvoice, cookies);

    // pdf to KVS
    console.log('Saving invoice ...');
    await Apify.setValue(filename, pdfBuffer, { contentType: 'application/pdf' });
    const urlForKVS = `https://api.apify.com/v2/key-value-stores/${Apify.getEnv().defaultKeyValueStoreId}/records/${filename}`
    await Apify.setValue('OUTPUT', { url: `https://api.apify.com/v2/key-value-stores/${Apify.getEnv().defaultKeyValueStoreId}/records/${filename}` });
         
    console.log('Invoice was downloaded.');
    console.log('Invoice can be found on the following url: ' + urlForKVS);

    // upload to dropbox optional
    const dropboxToken = input.dropboxToken || process.env.dropboxToken

    if (dropboxToken) {
        const base64str = pdfBuffer.toString('base64');
        //filenameDropbox = '/apps/actorDr/'+filename;
        const date = new Date();
        const month = ("0" + (date.getMonth() + 1)).slice(-2);
        const year = date.getFullYear();
        const dropboxPath = year + '_' + month;
        
        let filenameDropbox = null

        if (input.pathToDropbox !== undefined){
            filenameDropbox = input.pathToDropbox + '/' + filename;
        } else {
            filenameDropbox = '/' + dropboxPath + '/' + filename;
        }
       
        const dropboxActorInput = {
            "accessToken": dropboxToken,       // dropbox access token
            "filePath": filenameDropbox,      // path on dropbox to save the file to
            "fileBase64": base64str,         // contents of the file as base64   
        }
        
        await Apify.call('petr_cermak/dropbox-upload', dropboxActorInput);
        
        console.log('Done, invoice was uploaded to Dropbox!');
    }

    const emailTo = input.emailTo;
    const attachmentPdf = pdfBuffer.toString('base64');
    
    if (emailTo) {  
        const emailText = "Invoice (" + filename + ") was downloaded from Toggl.com and uploaded to Dropbox (if requested). URL to key-value store: " + urlForKVS + ".";

        const emailActorInput = {
            "to": emailTo,
            "subject": "Toggl invoice was downloaded",
            "text": emailText,
            "attachments": [{
                filename: filename,
                data: attachmentPdf
            }]
        }

        await Apify.call('apify/send-mail', emailActorInput)

        console.log('Notification email sent.');
    }


  });
