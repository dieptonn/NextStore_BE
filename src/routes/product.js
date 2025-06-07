const express = require("express");
const router = express.Router();
const verifyToken = require("../app/middlewares/verifyToken");
const productController = require("../app/controllers/products/productController");

router.get("/hot-products", productController.getHotProductData);
router.post('/:categorySlug/addProduct', productController.addProductToCategory);
router.get('/:categorySlug/showProduct', productController.getProductsByCategory);
router.put('/:categorySlug/updateProduct/:productId', productController.updateProductInCategory);
router.delete('/:categorySlug/deleteProduct/:productId', productController.deleteProductInCategory);

module.exports = router;
