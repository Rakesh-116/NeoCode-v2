import express from "express";
import { createCheckout, stripeWebhook } from "../controllers/payments.controller.js";
import { userAuthentication } from "../middlewares/authentication.js";

const paymentsRouter = express.Router();
paymentsRouter.post("/checkout-session", userAuthentication, createCheckout);

const stripeWebhookRouter = express.Router();
stripeWebhookRouter.post("/", stripeWebhook);

export { paymentsRouter, stripeWebhookRouter };
