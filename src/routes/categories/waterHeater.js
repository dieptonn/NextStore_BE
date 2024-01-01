const express = require("express");
const router = express.Router();
const waterHeaterController = require("../../app/controllers/categories/waterHeaterController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct",  waterHeaterController.showProduct);

module.exports = router;
