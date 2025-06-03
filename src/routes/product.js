const express = require("express");
const router = express.Router();
const verifyToken = require("../app/middlewares/verifyToken");
const productController = require("../app/controllers/products/productController");

router.get("/hot-products", productController.getHotProductData);

module.exports = router;
