const express = require('express');
const router = express.Router();
const chatBotController = require('../app/controllers/chatBotController');

router.get('/', chatBotController.getHomePage);
router.post('/webhooks', chatBotController.postwebhook);
router.get('/webhooks', chatBotController.getWebHook);



module.exports = router;
