import { Router } from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import { sendAdminEmailController } from "../controllers/adminEmails.controller.js";

const adminEmailsRoute = Router();

adminEmailsRoute.post("/send", userAuthentication, sendAdminEmailController);

export default adminEmailsRoute;
