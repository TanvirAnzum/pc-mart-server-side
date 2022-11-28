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
    // console.log(decoded);
    next();
  });
}

// create jwt token

app.post("/jwt", (req, res) => {
  const data = req.body;
  // console.log(data);
  const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });

  res.send({ token });
});

// function to connect with db

async function run() {
  try {
    const productsDb = client.db("resaleDB").collection("products");
    const bookingsDb = client.db("resaleDB").collection("bookings");
    const usersDb = client.db("resaleDB").collection("users");

    // verify admin, verify seller

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersDb.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      // console.log(query);
      const user = await usersDb.findOne(query);
      // console.log(user);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyBoth = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersDb.findOne(query);

      if (user?.role !== "seller" || user?.role === "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // getting products
    app.get("/products/:id", async (req, res) => {
      const limit = req.query.limit;
      const page = req.query.page;
      const email = req.query.email;
      const category_id = Number(req.params.id);

      const category = {
        1: "desktop",
        2: "components",
        3: "accessories",
      };

      // if (email !== req.decoded.email) {
      //   res.status(403).send({ message: "unauthorized access" });
      // }

      const query = {};
      if (category_id) query.category = category[category_id];
      query.status = "unsold";

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

    // getting producst

    app.get("/products", verifyJWT, async (req, res) => {
      const limit = req.query.limit;
      const page = req.query.page;
      const email = req.query.email;
      const status = req.query.status;
      const boost = req.query.boost;
      const isReported = req.query.isReported;

      const query = {};
      if (email) query["seller.email"] = email;
      if (status) query.status = status;
      if (boost) query.boost = true;
      if (isReported) query.isReported = "yes";

      // console.log(query);

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
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const data = req.body;
      await productsDb.insertOne(data);
      res.send(data);
    });

    // updating products
    app.patch("/products/:id", verifyJWT, async (req, res) => {
      const updatedData = req.body;
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const dataToUpdate = {
        $set: {
          ...updatedData,
        },
      };
      const response = await productsDb.updateOne(query, dataToUpdate, options);
      res.send(response);
    });

    // deleting products
    app.delete("/products/:id", verifyJWT, verifyBoth, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const response = await productsDb.deleteOne(query);
      res.send(response);
    });

    // users db

    // get users
    app.get("/users", verifyJWT, async (req, res) => {
      const limit = req.query.limit;
      const page = req.query.page;
      const seller = req.query.seller;
      const buyer = req.query.buyer;

      const query = {};

      if (seller) query.role = "seller";
      if (buyer) query.role = "buyer";
      console.log(query);

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

    // isverified
    app.get("/isVerified", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const result = await usersDb.findOne({ email });
      const response = result?.verified ? true : false;
      res.send(response);
    });

    app.post("/users", verifyJWT, async (req, res) => {
      const data = req.body;
      const upsert = req.query.upsert;
      if (upsert) {
        const user = await usersDb.findOne({ uid: data.uid });
        if (user) {
          res.send(data);
        } else {
          await usersDb.insertOne(data);
          res.send(data);
        }
      } else {
        await usersDb.insertOne(data);
        res.send(data);
      }
    });

    // check role
    app.get("/role", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const user = await usersDb.findOne(query);
      res.send(user);
    });

    app.patch("/users", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email };

      console.log(query);
      const options = { upsert: true };
      const updatedData = req.body;
      const dataToUpdate = {
        $set: {
          ...updatedData,
        },
      };
      const response = await usersDb.updateOne(query, dataToUpdate, options);
      res.send(response);
    });

    app.delete("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const response = await usersDb.deleteOne(query);
      const deleteProduct = await productsDb.deleteMany({
        "seller.email": email,
      });
      res.send(response);
    });

    // booking collection

    app.post("/bookings", verifyJWT, async (req, res) => {
      const data = req.body;
      const response = await bookingsDb.insertOne(data);
      return data;
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const buyerEmail = req.query.buyer;
      const sellerEmail = req.query.seller;

      const query = {};
      if (buyerEmail) query["buyer.email"] = buyerEmail;
      if (sellerEmail) query["seller.email"] = sellerEmail;

      console.log(query);

      const cursor = bookingsDb.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.patch("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedData = req.body;
      const dataToUpdate = {
        $set: {
          ...updatedData,
        },
      };
      const response = await bookingsDb.updateOne(query, dataToUpdate, options);
      res.send(response);
    });

    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const response = await bookingsDb.deleteOne(query);
      res.send(response);
    });
  } catch (error) {
    console.log(error);
  }
}

run();

app.listen(port, () => {
  console.log("server listening on port" + port);
});
