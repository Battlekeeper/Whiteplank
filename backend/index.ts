import fastify, { FastifyRegister, FastifyReply, FastifyRequest } from "fastify";
import { MongoClient, Db, ObjectId } from 'mongodb';
import { IWPAnswer, WPUser } from '../models';
import { WPDatabase } from "./database";
import cors from '@fastify/cors'
import OpenAI from "openai";
import fs from "fs";
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const server = fastify();
server.register(cors, {
    origin: true
})

let database = new WPDatabase();

function findMostCommonValue(array: Array<string>) {
    let occurrences = new Map();
  
    // Count occurrences of each value
    array.forEach(value => {
      occurrences.set(value, (occurrences.get(value) || 0) + 1);
    });
  
    // Find the value with the maximum occurrences
    let mostCommonValue;
    let maxOccurrences = 0;
  
    occurrences.forEach((count, value) => {
      if (count > maxOccurrences) {
        mostCommonValue = value;
        maxOccurrences = count;
      }
    });
  
    return { value: mostCommonValue, occurrences: maxOccurrences };
  }

server.post("/api/storeanswers", async (request: FastifyRequest, reply: FastifyReply) => {

    let data = request.body as { WPUSER: WPUser, answerList: Array<IWPAnswer> };

    let user = await database.getUser(data.WPUSER.email, data.WPUSER.passwordHash);
    if (!user) {
        user = new WPUser(new ObjectId(), data.WPUSER.email, data.WPUSER.passwordHash)
        await database.database.collection('users').insertOne(user);
    }

    data.answerList.forEach(async (answer) => {
        //@ts-ignore
        answer.userId = user._id;
    })

    await database.storeAnswers(data.answerList);

    reply.status(200).send();
});

server.get("/api/getquestionanswer", async (request: FastifyRequest, reply: FastifyReply) => {
    let query = request.query as { questionHash: string };
    let question = await database.getQuestion(query.questionHash);
    if (!question) {
        reply.status(404).send("");
        return;
    }
    if (question.correctAnswerHash.length == 0) {
        for (let i = 0; i < question.answers.length; i++) {
            if (question.answers[i].validated && question.answers[i].correct) {
                question.correctAnswerHash = question.answers[i].answerHash;
                break;
            }
        }
    }
    reply.send(question.correctAnswerHash);
});

server.post("/api/generateanswer", async (request: FastifyRequest, reply: FastifyReply) => {

    let data = request.body as any
    

    let mostCommonAnswer = await generateAnswer(data.question, data.answers);

    if (mostCommonAnswer.occurrences > 1)
    {   
        reply.send({answer: mostCommonAnswer.value, certainty: mostCommonAnswer.occurrences / 3});
        return
    }
    reply.status(404).send();
});

async function generateAnswer(question: string, answers: Array<string>) {
    let answersString = ""

    for (let i = 0; i < answers.length; i++) {
        answersString += `${i}:` + answers[i]
    }

    const chatCompletion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: 'Given a question and a list of answers, select the correct answer to the question.' },
            { role: 'user', content: `Select the correct answer to the following question: ${question}\n\n${answersString}` }
        ],
        n: 3,
        tools: [
            {
                "type": "function",
                "function": {
                    "name": "selectAnswer",
                    "description": "Select the answer from the list of answers given the question",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "answer": {
                                "type": "string",
                                "enum": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
                                "description": "The integer index of the selected answer from the list of answers.",
                            },
                        },
                        "required": ["answer"],
                    }
                }
            }
        ],
        temperature: 0.1,
        tool_choice: { "type": "function", "function": { "name": "selectAnswer" } },
        model: 'gpt-3.5-turbo-0125',
    });
    console.log((chatCompletion.usage!.prompt_tokens / 1000 * 0.0005) + (chatCompletion.usage!.completion_tokens / 1000 * 0.0015))

    let generatedAnswers = [JSON.parse(chatCompletion.choices[0].message.tool_calls![0].function.arguments).answer, JSON.parse(chatCompletion.choices[1].message.tool_calls![0].function.arguments).answer, JSON.parse(chatCompletion.choices[2].message.tool_calls![0].function.arguments).answer]


    
    return findMostCommonValue(generatedAnswers);
}

server.setErrorHandler(function (error, request, reply) {
    console.error(error);
    reply.status(500).send();
})

server.listen({ port: 9090 }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening on ${address}`);
})