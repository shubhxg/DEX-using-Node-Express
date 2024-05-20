import express from "express";
import Decimal from "decimal.js";
const jwt = require("jsonwebtoken");
import rateLimit from "express-rate-limit";
import winston from "winston";

const app = express();
const PORT = 3000;
const SECRET_KEY = "your_secret_key"; // Replace with your actual secret key

// Set up rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use(express.json());
app.use(limiter); // Apply rate limiting middleware

// Set up logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Initial balances for ETH and USDC
let ETH_BALANCE: Decimal = new Decimal(200);
let USDC_BALANCE: Decimal = new Decimal(1000000);
const FEES: Decimal = new Decimal(0.003); // 0.3% fees

// Authentication middleware
const authenticateToken = (req:any, res:any, next:any) => {
  // Get the JWT token from the Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // If no token is provided, return 401 Unauthorized
  if (token == null) return res.sendStatus(401);

  // Verify the JWT token using the secret key
  jwt.verify(token, SECRET_KEY, (err:any, user:any) => {
    if (err) return res.sendStatus(403); // If token is invalid, return 403 Forbidden
    req.user = user; // If token is valid, attach the user data to the request object
    next(); // Call the next middleware function
  });
};

// Add liquidity (not implemented)
app.post("/add-liquidity", authenticateToken, (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});

// Buy asset
app.post("/buy-asset", authenticateToken, (req, res) => {
  const { quantity } = req.body;

  // Input validation
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid quantity" });
  }

  const quantityDecimal = new Decimal(quantity);
  const product = ETH_BALANCE.mul(USDC_BALANCE); // Calculate the constant product
  const updatedEthQuant = ETH_BALANCE.sub(quantityDecimal); // Calculate the updated ETH balance
  const updatedUSDCBalance = product.div(updatedEthQuant); // Calculate the updated USDC balance
  const paidAmount = updatedUSDCBalance.sub(USDC_BALANCE); // Calculate the amount of USDC paid
  const feeAmount = paidAmount.mul(FEES); // Calculate the fee amount

  // Update the balances with the new values
  ETH_BALANCE = updatedEthQuant;
  USDC_BALANCE = updatedUSDCBalance.sub(feeAmount);

  logger.info(`User bought ${quantityDecimal} ETH for ${paidAmount.add(feeAmount)} USDC`);

  res.json({
    message: `You paid ${paidAmount.add(feeAmount)} USDC for ${quantityDecimal} ETH!`,
    fee: feeAmount.toFixed(2),
  });
});

// Sell asset
app.post("/sell-asset", authenticateToken, (req, res) => {
  const { quantity } = req.body;

  // Input validation
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid quantity" });
  }

  const quantityDecimal = new Decimal(quantity);
  const updatedUSDCBalance = USDC_BALANCE.sub(quantityDecimal); // Calculate the updated USDC balance
  const product = ETH_BALANCE.mul(updatedUSDCBalance); // Calculate the constant product
  const updatedEthQuant = product.div(USDC_BALANCE); // Calculate the updated ETH balance
  const paidAmount = ETH_BALANCE.sub(updatedEthQuant); // Calculate the amount of ETH paid
  const feeAmount = paidAmount.mul(FEES); // Calculate the fee amount

  // Update the balances with the new values
  ETH_BALANCE = updatedEthQuant.sub(feeAmount);
  USDC_BALANCE = updatedUSDCBalance;

  logger.info(`User sold ${quantityDecimal} USDC for ${paidAmount.sub(feeAmount)} ETH`);

  res.json({
    message: `You got ${quantityDecimal} USDC for ${paidAmount.sub(feeAmount)} ETH!`,
    fee: feeAmount.toFixed(2),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});