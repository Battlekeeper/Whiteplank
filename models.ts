export interface IObjectId {
    $oid: string;
}

export interface IWPAnswer {
    userId: IObjectId;
    answerHash: string;
    correct: boolean;
    assignmentId: string;
    questionHash: string;
    validated: boolean;
}

export interface IWPQuestion {
    _id: IObjectId;
    questionHash: string;
    correctAnswerHash: string;
    correct: boolean;
    validated: boolean;
    answers: Array<IWPAnswer>;
}

export class WPQuestion implements IWPQuestion {
    _id: IObjectId | any;
    questionHash: string;
    correctAnswerHash: string;
    correct: boolean;
    validated: boolean;
    answers: Array<IWPAnswer>;
    constructor(_id: IObjectId | any, questionHash: string, correctAnswerHash: string, correct: boolean, validated: boolean, answers: Array<IWPAnswer>) {
        this._id = _id;
        this.questionHash = questionHash;
        this.correctAnswerHash = correctAnswerHash;
        this.correct = correct;
        this.validated = validated;
        this.answers = answers;
    }
}

export interface IWPUser {
    email: string;
    passwordHash: string;
}
export class WPUser {
    _id: IObjectId | any;
    email: string;
    passwordHash: string;
    constructor(_id: IObjectId | any, email: string, passwordHash: string) {
        this._id = _id;
        this.email = email;
        this.passwordHash = passwordHash;
    }
}
