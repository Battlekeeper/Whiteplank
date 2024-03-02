import { Db, MongoClient, ObjectId } from 'mongodb';
import { IWPAnswer, WPQuestion, WPUser } from '../models';

export class WPDatabase {

    public mongoClient: MongoClient;
    public database: Db;

    constructor() {
        console.log('Connecting to MongoDB...');
        try {
            this.mongoClient = new MongoClient(process.env.MONGODB_URI as string)
            this.database = new Db(this.mongoClient, 'Whiteplank');

            this.mongoClient.connect().then((client) => {
                this.mongoClient = client;
                this.database = client.db('Whiteplank');
            })
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
            throw "Error connecting to MongoDB";
        }
    }
    public async getUser(email: string, passwordHash: string) {
        let userdoc = await this.database.collection('users').findOne({ email: email, passwordHash: passwordHash });
        if (userdoc) {
            return new WPUser(userdoc._id, userdoc.email, userdoc.passwordHash);
        }
        return undefined
    }
    public async getQuestion(questionHash: string) {
        let questiondoc = await this.database.collection('questions').findOne({ questionHash: questionHash });
        if (questiondoc) {
            return new WPQuestion(questiondoc._id, questiondoc.questionHash, questiondoc.correctAnswerHash, questiondoc.correct, questiondoc.validated, questiondoc.answers);
        }
        return undefined
    }
    public async storeAnswers(answers: Array<IWPAnswer>) {
        answers.forEach(async (answer) => {
            let question = await this.getQuestion(answer.questionHash);
            if (!question) {
                question = new WPQuestion(new ObjectId(), answer.questionHash, '', false, false, []);
            }
            if (question.answers.filter((x) => x.userId.$oid === answer.userId.$oid && x.correct === answer.correct && x.validated == answer.validated).length == 0)
            {
                question.answers.push(answer);
            }
            this.database.collection('questions').replaceOne({ questionHash: question.questionHash }, question, { upsert: true })
        })
    }

}