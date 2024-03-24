const express = require("express");
const router = express.Router();
const cartController = require("../app/controllers/cartCheckoutPaymet/cartController");
const verifyToken = require("../app/middlewares/verifyToken");
const checkoutController = require('../app/controllers/cartCheckoutPaymet/checkoutController')
const orderController = require('../app/controllers/cartCheckoutPaymet/orderController')



router.post("/getCart", cartController.getCart);
router.post("/addToCart", cartController.addToCart);

router.post("/orders", async (req, res) => {
    try {
        // use the cart information passed from the front-end to calculate the order amount detals
        const { cart } = req.body;
        const { jsonResponse, httpStatusCode } = await checkoutController.createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to create order." });
    }
});

router.post("/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { jsonResponse, httpStatusCode } = await checkoutController.captureOrder(orderID);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to capture order." });
    }
});

router.get("/", (req, res) => {
    res.sendFile(path.resolve("./client/checkout.html"));
});


router.post("/getOrder", cartController.getOrder);
router.post("/createNewOrder", cartController.createNewOrder);

module.exports = router;
