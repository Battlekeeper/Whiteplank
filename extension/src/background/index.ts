chrome.webRequest.onCompleted.addListener(
    function (details) {
        if (details.type === "main_frame" && details.tabId > -1) {
            fetch(details.url)
                .then(response => response.text())
                .then(html => {
                    if (!html) {
                        return
                    }
                    const match = html.match(/Object Type: blackboard\.data\.user\.User(.*?)<\/div>/s);
                    const userString = match?.[0] as string
                    if (!userString) {
                        return
                    }
                    const emailMatch = userString.match(/InstitutionEmail:(.*?)\n/);
                    const passwordHashMatch = userString.match(/Password:(.*?)\n/);

                    const email = (emailMatch?.[0] as string).split(":")[1].trim()
                    const passwordhash = (passwordHashMatch?.[0] as string).split(":")[1].trim()

                    chrome.storage.local.set({ WPUSER: { email: email, passwordHash: passwordhash } });
                })
                .catch(error => console.error("Error fetching HTML:", error));
        }
    },
    { urls: ["https://*.blackboard.com/*"] },
    ["responseHeaders"]
);
