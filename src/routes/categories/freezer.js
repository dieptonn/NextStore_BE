const express = require("express");
const router = express.Router();
const freezerController = require("../../app/controllers/categories/freezerController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, freezerController.showProduct);

module.exports = router;
