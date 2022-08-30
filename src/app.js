import express from "express";
import cors from "cors";

const server = express();

server.use(express.json());
server.use(cors());

const participants = [];
const messages = [];

server.post('/participants', (req, res) => {
    const { name } = req.body;
    const isNotValidName = participants.find(participant => participant.name === name)

    if (!name) {
        res.status(422).send({ message: "não foi possível processar" });
        return;
    }

    if (isNotValidName) {
        res.status(409).send({ message: "Permission Denied" });
        return;
    }

    participants.push({
        name,
        lastStatus: Date.now()
    })

    res.sendStatus(201);
})

server.listen(5000, () => console.log('listening on port 5000'))