const express = require("express");
const router = express.Router();
const fryerController = require("../../app/controllers/categories/fryerController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct",  fryerController.showProduct);

module.exports = router;
