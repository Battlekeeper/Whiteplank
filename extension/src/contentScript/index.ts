import md5 from "md5";
import { IWPAnswer, WPUser, IObjectId } from "../../../models";

class ObjectId implements IObjectId {
    $oid: string;
    constructor(id: string = "") {
        this.$oid = id;
    }
};
async function getWPUser() {
    let data = (await chrome.storage.local.get("WPUSER")).WPUSER
    let user = new WPUser(new ObjectId(), data.email, data.passwordHash)
    return user
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type == "autofill")
    {
        takeAssessment()
    }
})

if (window.location.href.includes("/webapps/assessment/take/")) {
    var iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('sidepanel.html');
    iframe.style.cssText = 'width:300px;';

    let contentPanel = document.getElementById("contentPanel")
    let content = document.getElementById("content")
    let locationPane = document.querySelector(".locationPane") as HTMLElement


    if (contentPanel && content) {
        contentPanel.style.display = "flex"
        content.style.flexGrow = "1"
    }
    if (locationPane) {
        locationPane.style.paddingBottom = "0px"
    }

    document.getElementById("contentPanel")?.appendChild(iframe);
}

async function APIStoreAnswers(answerList: Array<IWPAnswer>) {
    const url = "http://localhost:9090/api/storeanswers";

    let data = {} as any
    data.answerList = answerList
    data.WPUSER = await getWPUser()

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    console.log(response)
}
scrapeAnswers()
async function scrapeAnswers() {
    console.log((await chrome.storage.local.get("WPUSER")).WPUSER)
    if (!window.location.href.includes("/webapps/assessment/review/")) {
        return
    }
    console.log("Scraping Answers...")
    const urlParams = new URLSearchParams(window.location.search);
    const QuizId = urlParams.get('content_id') as string

    let questionList: Array<IWPAnswer> = []
    const filteredQuestionImages = document.querySelectorAll('img[id^="gs_q"]');

    for (let i = 0; i < filteredQuestionImages.length; i++) {
        let questionImage = filteredQuestionImages[i];
        let answer = (await parseQuesionLI(questionImage.parentElement?.parentElement?.parentElement as HTMLTableSectionElement, QuizId)) as IWPAnswer
        if (answer) {
            questionList.push(answer)
        }
    }

    APIStoreAnswers(questionList as Array<IWPAnswer>)
}

function getImgHash(callback: Function, src: string) {
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
        const base64String = event.target?.result as string;
        callback(md5(base64String));
    };
    fileReader.readAsDataURL(new Blob([src]));
}

async function parseQuesionLI(node: HTMLTableSectionElement | null, QuizId: string | null) {
    if (node == null) {
        return;
    }
    let answer = {} as IWPAnswer
    answer.correct = !(node.rows[1].cells[0].childNodes[0] as HTMLImageElement).src.includes("incorrect");
    if (node.rows[1].cells[1].innerText.trim() == "") {
        const imageElement = node.rows[1].cells[1].querySelector("img");
        if (imageElement) {
            answer.questionHash = await new Promise(r => getImgHash(r, imageElement.src));
        } else {
            console.log("No question text or image found");
            return undefined
        }
    } else {
        let questionsrc = ""
        const imageElement = node.rows[1].cells[1].querySelector("img");
        if (imageElement) {
            questionsrc = imageElement.src
        }
        answer.questionHash = md5(node.rows[1].cells[1].innerText.trim() + questionsrc);
    }
    if ((node.querySelector('.reviewQuestionsAnswerDiv')?.querySelector(".answerTextSpan") as HTMLElement).innerText.trim() == "") {
        const imageElement = node.querySelector('.reviewQuestionsAnswerDiv')?.querySelector("img");
        if (imageElement) {
            answer.answerHash = await new Promise(r => getImgHash(r, imageElement.src));
        } else {
            console.log("No answer text or image found");
            return undefined
        }
    } else {
        answer.answerHash = md5((node.querySelector('.reviewQuestionsAnswerDiv')?.querySelector(".answerTextSpan") as HTMLElement).innerText.trim());
    }
    answer.validated = true;
    return answer
}

async function takeAssessment() {
    if (!window.location.href.includes("/webapps/assessment/take/")) {
        return
    }
    console.log("Taking Assessment...")
    // parse url parameters
    const urlParams = new URLSearchParams(window.location.search);
    //@ts-ignore
    const QuizId = urlParams.get('content_id') as string

    document.querySelector(".takeQuestionDiv")?.childNodes.forEach(async (node) => {
        if (node.nodeName == "FIELDSET") {

            let questionHash = ""
            chrome.storage.local.set({ "currentQuestion": (node.childNodes[0] as HTMLElement).innerText.trim() })
            if ((node.childNodes[0] as HTMLElement).innerText.trim() == "") {
                let questionImage = (node.childNodes[0] as HTMLElement).querySelector("img")
                if (questionImage) {
                    //@ts-ignore
                    questionHash = await new Promise(r => getImgHash(r, questionImage.src));
                }
            } else {
                let questionImage = (node.childNodes[0] as HTMLElement).querySelector("img")
                let questionsrc = ""
                if (questionImage) {
                    questionsrc = questionImage.src
                }
                questionHash = md5((node.childNodes[0] as HTMLElement).innerText.trim() + questionsrc)
            }

            let response = await fetch(`http://localhost:9090/api/getquestionanswer?questionHash=${questionHash}`)
            let correctAnswerHash = await response.text()

            let questionsBody = (node as HTMLElement).querySelector(".multiple-choice-table")?.querySelector("tbody")
            let answerFound = false
            questionsBody?.childNodes.forEach(async (row) => {
                if (row.nodeName == "TR") {
                    //console.log(((row as HTMLElement).querySelector("td:nth-child(3)") as HTMLElement).innerText.trim())
                    let optionHash = ""
                    if (((row as HTMLElement).querySelector("td:nth-child(3)") as HTMLElement).innerText.trim() == "") {
                        let answerImage = ((row as HTMLElement).querySelector("td:nth-child(3)") as HTMLElement).querySelector("img")
                        if (answerImage) {
                            //@ts-ignore
                            optionHash = await new Promise(r => getImgHash(r, answerImage.src));
                        }
                    } else {
                        optionHash = md5(((row as HTMLElement).querySelector("td:nth-child(3)") as HTMLElement).innerText.trim())
                    }
                    if (optionHash == correctAnswerHash) {
                        answerFound = true
                        if (!(row as HTMLElement).querySelector("input")?.hasAttribute("checked")) {
                            console.log("Selecting Correct Answer...");
                            (row as HTMLElement).querySelector("input")?.click();
                        }
                    }
                }
            })
            let AnswerAIEnabled = (await chrome.storage.local.get(["AnswerAIEnabled"])).AnswerAIEnabled
            console.log("AI Enabled: " + AnswerAIEnabled)

            if (!answerFound && AnswerAIEnabled) {
                console.log("Generating answer...")
                let answers = [] as Array<string>
                let answerInputs = [] as Array<HTMLInputElement>

                questionsBody?.childNodes.forEach(async (row) => {
                    if (row.nodeName == "TR") {
                        answers.push(((row as HTMLElement).querySelector("td:nth-child(3)") as HTMLElement).innerText.trim())
                        answerInputs.push((row as HTMLElement).querySelector("input") as HTMLInputElement)
                    }
                })

                for (let i = 0; i < answers.length; i++) {
                    if (answers[i] == "") {
                        return
                    }
                }
                if ((node.childNodes[0] as HTMLElement).innerText.trim() == "") {
                    return
                }


                let response = await fetch(`http://localhost:9090/api/generateanswer`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: (node.childNodes[0] as HTMLElement).innerText.trim(),
                        answers: answers
                    }),
                });

                if (response.status == 404) {
                    chrome.runtime.sendMessage({ type: "error", message: "Question not found in database and AI could not generate answer\nPlease answer manually"})
                    return
                }

                let generated = await response.json()
                console.log("Answer Generated: " + generated.answer)
                console.log("Certainty: " + generated.certainty)
                chrome.runtime.sendMessage({ type: "AICertainty", message: generated.certainty })

                if (!answerInputs[Number.parseInt(generated.answer)].hasAttribute("checked")) {
                    console.log("Selecting Correct Answer...");
                    answerInputs[Number.parseInt(generated.answer)].click();
                }
            } else {
                chrome.runtime.sendMessage({ type: "error", message: "Question not found in database!\nTry searching google or enable AI"})
            }
        }
    });
}
