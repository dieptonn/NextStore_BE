const express = require('express');
const router = express.Router();
const chatBotController = require('../app/controllers/chatBotController');

router.get('/', chatBotController.getHomePage);
router.post('/webhook', chatBotController.postWebhook);
router.get('/webhook', chatBotController.getWebHook);



module.exports = router;
