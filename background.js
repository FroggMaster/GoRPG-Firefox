// Passes messages from main content script and specific content script
// (Must use this script because of chrome extension limitations)

const ROLL20_URL = "https://app.roll20.net/editor/"
const DISCORD_URL = "https://particula-tech.com/godice-discord/discord.html"
var foundryIDs = []
const VALID_URLS = [ROLL20_URL, DISCORD_URL]

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	
	if (message.text == "diceResult" || message.text == "MultiDie" || message.text == "multiRollStarted") {
		let params = {
		active: true,
		currentWindow: true
		}
		
		// Getting main tab to communicate with the content script
		chrome.tabs.query(params, function(tabs) {
			if (VALID_URLS.indexOf(tabs[0].url) != -1 || tabs[0].url.startsWith("DISCORD_URL") || tabs[0].id == foundryIDs[0]) {
				console.log("Passing message")
				chrome.tabs.sendMessage(tabs[0].id, message)
			}
		});
		
	}
 });

 // Foundry VTT Tab checking (FOUNDRY ONLY)
chrome.webNavigation.onHistoryStateUpdated.addListener(function(activeInfo) {
	console.log("Tab Change")
	let params = {
		title: "*• Foundry Virtual Tabletop*",
		url: "https://*/game",
		active: true
	}
	chrome.tabs.query(params, function(tabs) {
		if (tabs.length > 0) {
			// Erasing the current foundryIDs list in case a tab got closed since last change
			foundryIDs = []
			for (let i in tabs) {
				
				// Adding tab id back to foundryIDs
				foundryIDs.push(tabs[i].id)

				// Checking if current tab is active
				console.log("Found-ry haha get it?")
				console.log("Injecting")
				chrome.scripting.executeScript(
					{	
						target: {tabId: tabs[i].id, allFrames: true},
						files: ['godice.js', 'mainDie.js', 'foundryContent.js']
					}
				, function(result) {
					if (chrome.runtime.lastError || !result || !result.length) {
						return;
					} if (result[0] !== true) {
						console.log("Injecting")
					}
				})
			}


		}
	})
});

// On install
chrome.runtime.onInstalled.addListener(function (object) {
	
	let externalUrl = "https://particula-tech.com/godice-discord/"		
	chrome.tabs.create({url: externalUrl}, function(tab) {
		console.log("Landing tab opened", externalUrl)
	})
})

// Context menus
var quickGuide = chrome.contextMenus.create({
	title: "Quick Guide",
	id: "Quick Guide",
})
var DiscordConnection = chrome.contextMenus.create({
	title: "Discord Connection",
	id: "Discord Connection",
})
var ShopGoDice = chrome.contextMenus.create({
	title: "Shop GoDice",
	id: "Shop GoDice",
})


chrome.contextMenus.onClicked.addListener((OnClickData) => {
	console.log(OnClickData)
	switch(OnClickData.menuItemId) {
		case "Quick Guide":
			chrome.tabs.create({url: "https://particula-tech.com/godice-discord/"}, function(tab) {})
			break
		case "Discord Connection":
			chrome.tabs.create({url: "https://particula-tech.com/godice-discord/discord.html"}, function(tab) {})
			break
		case "Shop GoDice":
			chrome.tabs.create({url: "https://particula-tech.com/godice/"}, function(tab) {})
			break
	}

})
