import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();
const server = express();

server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("BatePapoUOL");
});

server.post("/participants", async (req, res) => {
    const { name } = req.body;
    const isNotValidName = await db.collection("participants").findOne({ name: name });
    console.log(isNotValidName);

    if (!name) {
        res.status(422).send({ message: "não foi possível processar" });
        return;
    }

    if (isNotValidName) {
        res.status(409).send({ message: "Permission Denied" });
        return;
    }

    try {
        const response = await db.collection("participants").insertOne({
            name,
            lastStatus: Date.now()
        });
        res.status(201).send(`Receita criada com id: ${response.insertedId}`)
    } catch (error) {
        res.sendStatus(500);
    }
})

server.get("/participants", async (req, res) => {
    try {
        const response = await db.collection("participants").find().toArray();
        res.status(200).send(response);
    } catch (error) {
        res.sendStatus(500);
    }
});

server.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const isValidType = type => type === "message" || type === "private_message";

    const isValidParticipant = await db.collection("participants").findOne({ name: user });

    const isValidMessage = (to, text, type, user) => to && to !== user && text && isValidType(type) && isValidParticipant;

    if (!isValidMessage(to, text, type, user)) {
        res.sendStatus(422);
        return;
    }

    try {
        const response = db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: dayjs().format("HH:mm:ss")
        });
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});

server.get("/messages", async (req, res) => {
    const { user } = req.headers;

    const isAllowedMessage = message => message.type === 'message' || message.from === user || message.to === user;

    try {
        const messages = await db.collection("messages").find().toArray();
        res.status(201).send(messages.filter(isAllowedMessage));
    } catch (error) {
        res.sendStatus(500);
    }

})

server.listen(5000, () => console.log("listening on port 5000"))