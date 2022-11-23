// dependencies
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

// express initialization

const app = express();
const port = 9000;

// middlewares

app.use(cors());
app.use(express.json());

// mongodb initialization
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.ote0m1f.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// default server homepage

app.get("/", (req, res) => {
  res.send("Welcome to the sell your pc server");
});

// middlewares function to verify jwt token

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({
        message: "Forbidden Access",
      });
    }
    req.decoded = decoded;
    next();
  });
}

// create jwt token

app.post("/jwt", (req, res) => {
  const data = req.body;
  const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });

  res.send({ token });
});

app.listen(port, () => {
  console.log("server listening on port" + port);
});
