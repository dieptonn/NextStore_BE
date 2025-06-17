const express = require("express");
const router = express.Router();
const cartController = require("../app/controllers/cartCheckoutPayment/cartController");
const verifyToken = require("../app/middlewares/verifyToken");
const checkoutController = require('../app/controllers/cartCheckoutPayment/checkoutController')
const orderController = require('../app/controllers/cartCheckoutPayment/orderController')


router.post("/getCart", cartController.getCart);
router.post("/addToCart", cartController.addToCart);
router.post("/update-cart", cartController.updateCartItemQuantity);

router.post("/orders", async (req, res) => {
    try {
        // use the cart information passed from the front-end to calculate the order amount detals
        const {cart} = req.body;
        const {jsonResponse, httpStatusCode} = await checkoutController.createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({error: "Failed to create order."});
    }
});

router.post("/orders/:orderID/capture", async (req, res) => {
    try {
        const {orderID} = req.params;
        const {jsonResponse, httpStatusCode} = await checkoutController.captureOrder(orderID);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({error: "Failed to capture order."});
    }
});

router.get("/", (req, res) => {
    res.sendFile(path.resolve("./client/checkout.html"));
});


router.post("/getOrder", orderController.getOrder);
router.post("/createNewOrder", orderController.createNewOrder);

router.post("/create-order-after-payment", orderController.createOrderAfterPayment);
router.get("/get-all", orderController.getAllOrders);

module.exports = router;
