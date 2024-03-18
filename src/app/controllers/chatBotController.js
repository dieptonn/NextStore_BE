

const getHomePage = (req, res) => {

}



const postWebhook = (req, res) => {
    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
}

const getWebHook = (req, res) => {

    let VERIFY_TOKEN = process.env.VERIFY_TOKEN

    let mode = req.query['hub.mode']
    let token = req.query['hub.verify_token']
    let challenge = req.query['hub.challenge']

    if (mode && token) {

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED')
            return res.status(200).send(challenge)
        } else {
            return res.status(403)
        }
    }

}


// Handles messages events
function handleMessage(sender_psid, received_message) {

}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {

}


module.exports = { getHomePage, getWebHook, postWebhook } 