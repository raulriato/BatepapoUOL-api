import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";

dotenv.config();
const server = express();

server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("BatePapoUOL");
});

const participantSchema = joi.object({
    name: joi.string().trim().required()
})

server.post("/participants", async (req, res) => {
    const { name } = req.body;
    const isNotValidName = await db.collection("participants").findOne({ name: name });

    const participantValidation = participantSchema.validate({ name });

    if (participantValidation.error) {
        res.status(422).send(participantValidation.error.details[0].message);
        return;
    }

    if (isNotValidName) {
        res.status(409).send({ message: "Permission Denied" });
        return;
    }



    const statusMessage = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss")
    }

    try {
        const response = await db.collection("participants").insertOne({
            name,
            lastStatus: Date.now()
        });

        await db.collection("messages").insertOne(statusMessage);

        res.status(201).send(`Participante criado com id: ${response.insertedId}`);
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

    const messageSchema = joi.object({
        to: joi.string().invalid(user).required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()
    });

    const messageValidation = messageSchema.validate({
        to,
        text,
        type
    }, { abortEarly: false });

    if (messageValidation.error) {
        const messages = messageValidation.error.details.map(detail => detail.message);
        res.status(422).send(messages);
        return;
    };

    const isValidSender = await db.collection("participants").findOne({ name: user });
    const isValidReceiver = await db.collection("participants").findOne({ name: to }) || to.toLowerCase() === "todos";

    if (!isValidSender || !isValidReceiver) {
        res.sendStatus(422);
        return;
    };

    try {
        await db.collection("messages").insertOne({
            from: user,
            ...messageValidation.value,
            time: dayjs().format("HH:mm:ss")
        });
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});

server.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const limit = parseInt(req.query.limit);

    const isAllowedMessage = message => message.type !== "private_message" || message.from === user || message.to === user;

    if (!limit) {
        try {
            const messages = await db.collection("messages").find().toArray();
            res.status(201).send(messages.filter(isAllowedMessage));
        } catch (error) {
            res.sendStatus(500);
        }
        return;
    };

    try {
        const messages = await db.collection("messages").find().toArray();
        const alloweddMessages = messages.filter(isAllowedMessage);
        const limitedMessages = alloweddMessages.slice(-limit);
        res.status(201).send(limitedMessages);
    } catch (error) {
        res.sendStatus(500);
    }

});

server.post("/status", async (req, res) => {
    const { user } = req.headers;

    const isStoredUser = await db.collection("participants").findOne({ name: user });

    if (!isStoredUser) {
        res.sendStatus(404);
        return;
    }

    try {
        const response = await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

setInterval(async () => {
    try {
        const participants = await db.collection("participants").find().toArray();
        const inactiveParticipants = participants.filter(participant => Date.now() - Number(participant.lastStatus) > 10000);
        inactiveParticipants.forEach(async value => {
            const statusMessage = {
                from: value.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss")
            }
            await db.collection("participants").deleteOne(value);
            await db.collection("messages").insertOne(statusMessage);
        })
    } catch (error) {
        console.error(error);

    }
}, 15000);

server.listen(5000, () => console.log("listening on port 5000"));