const express = require("express");
const router = express.Router();
const cartController = require("../app/controllers/cartController");
const verifyToken = require("../app/middlewares/verifyToken");


router.post("/getCart", cartController.getCart);
router.post("/addToCart", cartController.addToCart);




module.exports = router;
