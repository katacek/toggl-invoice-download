const Apify = require('apify');

Apify.main(async () => {
    
    const input = await Apify.getValue('INPUT');
    
    const user = input.togglUserName || process.env.user;
    const pwd = input.togglPassword || process.env.pwd;

    console.log('Launching Puppeteer...');
    const browser = await Apify.launchPuppeteer();

    console.log('Signing in ...');
    const page = await browser.newPage();
    await page.goto('https://toggl.com/login/');
    await page.type('#login-email', user, { delay: 100 });
    await page.type('#login-password', pwd, { delay: 100 });
    await page.click('#login-button');
    console.log('Signed ...');

    // go through pages to invoices
    const showMore = '.css-dq2otx.e34dboa1 > div:nth-child(1) > div:nth-child(21) > button';
    await page.waitForSelector(showMore);
    await page.click(showMore);

    const subscription = '.css-dq2otx.e34dboa1 > div:nth-child(1) > div:nth-child(15) > a';
    await page.waitForSelector(subscription);

    const linkSubscription = await page.$eval(subscription,el=>el.href);
    await page.goto(linkSubscription);

    const invoices = '.css-1f6gjvz.e1lwzskz3 > div > a:nth-child(3)';
    await page.waitForSelector(invoices);

    const linkInvoices = await page.$eval(invoices,el=>el.href);
    await page.goto(linkInvoices);

    const lastInvoice = '.css-1xdhyk6.e22ygp00 > div > a:nth-child(3)'
    await page.waitForSelector(lastInvoice);

    console.log('Opening invoice ...');
    
    // get url to last invoice and name the file
    const linkLastInvoice = await page.$eval(lastInvoice,el=>el.href);
    const invoiceName = '.css-1xdhyk6.e22ygp00 > div > a:nth-child(3) > div > div.css-8a0s72.e22ygp01'
    const text = await page.$eval(invoiceName, el => el.textContent);
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
