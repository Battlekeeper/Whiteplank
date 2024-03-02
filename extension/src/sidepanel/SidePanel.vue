<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Toggle from '../componets/Toggle.vue'

const currentQuestion = ref("")
const AnswerAIEnabled = ref(false)
const errorMessage = ref("")

const AICertainty = ref(-1)


onMounted(async () => {
    console.log('SidePanel mounted')
    currentQuestion.value = (await chrome.storage.local.get(["currentQuestion"])).currentQuestion
    currentQuestion.value = currentQuestion.value.replace("\n", " ")
    AnswerAIEnabled.value = (await chrome.storage.local.get(["AnswerAIEnabled"])).AnswerAIEnabled
})

async function searchGoogle() {
    chrome.search.query({ text: currentQuestion.value, disposition: "NEW_TAB" })
}

async function toggleAnswerAIEnabled() {
    AnswerAIEnabled.value = !AnswerAIEnabled.value
    await chrome.storage.local.set({ AnswerAIEnabled: AnswerAIEnabled.value })
}

async function autoFillClicked() {
    errorMessage.value = ""
    let tab = await chrome.tabs.getCurrent()
    if (tab) {
        chrome.tabs.sendMessage(tab.id as number, { type: "autofill" })
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type == "error") {
        errorMessage.value = request.message
    }
    if (request.type == "AICertainty") {
        AICertainty.value = request.message
    }
})

</script>

<template>
    <div class="bg-[#242424] h-screen pt-[30px]">
        <h1 class="text-center font-bold text-xl text-white">Whiteplank</h1>
        <div class="flex flex-col items-center">
            <button v-if="currentQuestion != ''" @click="autoFillClicked"
                class="text-white text-center mt-10 text-md bg-green-700 px-5 py-3 rounded-md ring-2 ring-white hover:ring-4 duration-300 font-semibold">Autofill
                Question</button>
            <p class="mt-2 text-red-500 px-5 text-center whitespace-pre">{{ errorMessage }}</p>
            <button v-if="currentQuestion != ''" @click="searchGoogle"
                class="text-white text-center mt-8 text-md bg-blue-500 px-5 py-3 rounded-md ring-2 ring-white hover:ring-4 duration-300 font-semibold">Search
                <strong>Google</strong> for Question</button>
            <button v-else
                class="text-white text-center mt-8 text-md bg-red-500 px-5 py-3 rounded-md ring-2 ring-white hover:ring-4 duration-300 font-semibold">Unable to Search Question</button>
            <div class="flex flex-col py-10 px-3">
                <Toggle :value="AnswerAIEnabled" @toggled="toggleAnswerAIEnabled()">
                    <p>Enable AI Answers</p>
                </Toggle>
                <p class=" mt-1 text-white">Use the Whiteplank AI when the answer is not found in the database</p>
            </div>
            <div v-if="AICertainty >= 0" class="flex flex-col">
                <p class="font-semibold text-center text-2xl text-green-700">AI Answer Selected!</p>
                <p class="text-white font-semibold text-lg text-center">Whiteplank AI: <span
                        class="text-bold text-blue-500">{{ AICertainty * 100 }}%</span> certain</p>
                <p class="font-semibold text-red-500 underline text-center">The percentage DOES NOT MEAN<br>the answer is
                    correct!</p>
                <p class="font-semibold mt-10 text-orange-500 px-5 text-center">Use the AI as a last resort option when
                    answering. Whiteplank can never guarantee the AI selected answer is correct.</p>
            </div>
        </div>
    </div>
</template>

<style></style>
