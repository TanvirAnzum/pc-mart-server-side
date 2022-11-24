// dependencies
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { response } = require("express");

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

// function to connect with db

async function run() {
  try {
    const productsDb = client.db("resaleDB").collection("products");

    // getting products
    app.get("/products/:id", verifyJWT, async (req, res) => {
      const limit = req.query.limit;
      const page = req.query.page;
      const email = req.query.email;
      const category_id = Number(req.params.id);

      const category = {
        1: "desktop",
        2: "components",
        3: "accessories",
      };

      if (email !== req.decoded.email) {
        res.status(403).send({ message: "unauthorized access" });
      }

      const query = {};
      if (category_id) query.category = category[category_id];

      const cursor = productsDb
        .find(query)
        .skip(page ? (limit ? page * limit : 0) : 0)
        .limit(limit ? limit : 10);

      const response = await cursor.toArray();
      const totalCount = await productsDb.countDocuments(query);

      res.send({
        products: response,
        totalCount: totalCount,
      });
    });

    // creating products
    app.post("/products", async (req, res) => {
      const data = req.body;
      await productsDb.insertOne(data);
      res.send(data);
    });

    // updating products
    app.patch("/products/:id", async (req, res) => {
      const updatedData = req.body;
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const dataToUpdate = {
        $set: {
          ...updatedData.data,
        },
      };
      const response = await productsDb.updateOne(query, dataToUpdate, options);
      res.send(response);
    });

    // deleting products
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const response = await productsDb.deleteOne(query);
      res.send(response);
    });

    // users db
    const usersDb = client.db("resaleDB").collection("users");

    // get users
    app.get("/users", async (req, res) => {
      const limit = req.query.limit;
      const page = req.query.page;

      const query = {};

      const totalCount = await usersDb.countDocuments(query);
      const cursor = usersDb
        .find(query)
        .skip(page ? (limit ? page * limit : 0) : 0)
        .limit(limit ? limit : 10);
      const response = await cursor.toArray();

      res.send({
        users: response,
        totalCount,
      });
    });
  } catch (error) {
    console.log(error);
  }
}

run();

app.listen(port, () => {
  console.log("server listening on port" + port);
});
