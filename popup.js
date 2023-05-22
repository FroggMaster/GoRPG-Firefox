var links = []				// Array of connection buttons
var inspector = null		// Inspector html element
var hiddenInspector = null
var inspectorTitle = null	// Inspector title html element
var batteryLevel = null		// Battery level html element
var multiRollToggle = null	// Multi roll checkbox html element
var sendChatToggle = null	// Send chat checkbox html element
var sendGMToggle = null		// Whisper to gm check html element
var currentDieIndex = 0		// Keeps track of the current selected die
var activeDieTypeButton = null // Keeps track of the current selected die type button

var popupPort; // This popup's port of communication with the main content script

const ROLL20_URL = "https://app.roll20.net/editor/"
const DISCORD_URL = "https://particula-tech.com/godice-discord/discord.html"
const FOUNDRY_URL = "foundry"
var correctSite = true


// Sends message to content script if the connection was already established
function sendMessageToContentScript(msg) {
	if (popupPort) {
		popupPort.postMessage(msg)
	}
};



// Converts the color indexes to string represention
colorIndexToString = [
	"Black",
	"Red",
	"Green",
	"Blue",
	"Yellow",
	"Orange",	
]

// Array of dice conneceted (currently max 3) and info about them
var dice = []

//  Type type tables
const dieTypeStrToIndex = {
	"D6": 0,
	"D20": 1,
	"D10": 2,
	"D10X": 3 ,
	"D4": 4,
	"D8": 5,
	"D12": 6,
}

const dieTypeIndexToStr = {
	0: "D6",
	1: "D20",
	2: "D10",
	3: "D10X",
	4: "D4",
	5: "D8",
	6: "D12",
}

var globalMultiRoll
var globalMuteSend;
var globalSendGM;

// On main page html load
document.addEventListener('DOMContentLoaded', function() {
	// Getting elements from html page
	links.push(document.getElementById('connect0'));
	links.push(document.getElementById('connect1'));
	links.push(document.getElementById('connect2'));
	links.push(document.getElementById('connect3'));
	links.push(document.getElementById('connect4'));
	links.push(document.getElementById('connect5'));
	
	inspector = 		document.getElementById('inspector');
	inspectorTitle = 	document.getElementById("titleText");
	batteryLevel = 		document.getElementById("batteryLevel");
	multiRollToggle = 	document.getElementById("multiRollCheck")
	sendChatToggle = 	document.getElementById("resultSendCheck");
	sendGMToggle = 		document.getElementById("whisperCheck");
	helpLink = 			document.getElementById("helpLink")

	helpLink.addEventListener('click', function() {
		chrome.tabs.create({active: true, url: "https://particula-tech.com/godice-discord/"});
	});

	// Parameters for getting main active tab
	let params = {
		active: true,
		currentWindow: true
	}

	// Getting main tab to communicate with the content script
	chrome.tabs.query(params, function(tab) {
		if (tab[0].url == ROLL20_URL || tab[0].url.startsWith(DISCORD_URL) || tab[0].url == FOUNDRY_URL || tab[0].title.includes("• Foundry Virtual Tabletop")) {
			// Connecting to content script
			popupPort = chrome.tabs.connect(tab[0].id, {name: "popup"});
			// Sends message to main content script
			popupPort.onMessage.addListener(gotMessage);
			
			// When the popup opens we query the main content script for update on parameters
			let query = {
				txt: "query parameters"
			}
			popupPort.postMessage(query)
		} else {
			correctSite = false
		}
	
		// Only apply logic if we are at roll20
		if (correctSite)  {
		
			// On click logic for connection buttons
			for (let i = 0; i <links.length; i++) {
				let link = links[i];
				
				link.addEventListener('click', function() {
					onClickConnectButton(links[i])
				});
			}
			
			// === Inspector UI ===
			// On change logic for the checkmarks
			multiRollToggle.addEventListener('change', function() {
				onMultiRollCheckChange()
			});
			sendChatToggle.addEventListener('change', function() {
				onHideResultCheckChange()
			});
			sendGMToggle.addEventListener('change', function() {
				onSendGMCheckChange()
			});
			
			// Getting all die type buttons html elements
			dieTypeButtons = [...document.getElementsByClassName("die-type-btn")]
			
			// On click logic for die type buttons
			for (let i = 0; i < dieTypeButtons.length; i++) {
				let button = dieTypeButtons[i]
				button.addEventListener('click', function() {
					onClickDieTypeButton(button)
				});
			}
		} else {
			document.getElementById("parent").remove()
			document.getElementById("main-parent").innerHTML = "<span class='platform-text'>Please open a supported platform</span>"
		}
	});

});

// Toggles highlight of die type buttons (highlighted -> non-highlighted, non-highlighted -> highlighted)
function toggleHighlightDieTypeButton(button) {
	let curSrc = button.src;
	if (curSrc.includes("W")) {
		button.src = curSrc.replace("W", "B");
	} else if (curSrc.includes("B")) {
		button.src = curSrc.replace("B", "W");
	}
}

// Function for when connection link gets clicked
function onClickConnectButton(link) {
	// If the link has no associated die
	
	// Telling content script to open connection dialog
	let msg = {
		txt: "connect GoDice"
	}
	sendMessageToContentScript(msg)
}

// When a connected die icon is clicked
function onClickConnectedDie(dieIndex){
	currentDieIndex = dieIndex // Setting the global die index to be the currently selected now
	
	// Revealing hidden inspector
	hiddenInspector = document.getElementById("hiddenInspector")
	hiddenInspector.style.display = "block"
	hiddenInspector.classList.add("animate-fade")
	
	// Updating inspecrtor html element
	inspectorTitle.innerHTML = "<b>GoDice " + dice[dieIndex].color + " " + (dieIndex + 1) + "</b>"
	batteryLevel.childNodes[0].textContent = dice[dieIndex].battery + "%"
	multiRollToggle.checked = globalMultiRoll
	sendChatToggle.checked = !globalMuteSend
	sendGMToggle.checked = globalSendGM
	
	// If an active dye button was already selected we remove it's highlight
	if (activeDieTypeButton) {
		toggleHighlightDieTypeButton(activeDieTypeButton)
	}
	
	// Highlighting and updating the corresponding die button
	toggleHighlightDieTypeButton(dieTypeButtons[dieTypeStrToIndex[dice[currentDieIndex].dieType]])
	activeDieTypeButton = dieTypeButtons[dieTypeStrToIndex[dice[currentDieIndex].dieType]]
}

// When a disconnected die icon is clicked
function onClickDisconnectedDie(dieIndex) {
	
	let msg = {
		txt: "reconnect die",
		dieId: dice[dieIndex].ID
	}
	
	sendMessageToContentScript(msg)
}

function onMultiRollCheckChange() {
	if (multiRollToggle.checked) {
		globalMultiRoll = true
	} else {
		globalMultiRoll = false
	}

	// Updating content script on the changes
	let msg = {
		txt: "change multi roll",
		changeInfo: {
			newBool: globalMultiRoll,
		},
	}

	sendMessageToContentScript(msg)
}

// Function for when the send result checkmark state changes
function onHideResultCheckChange() {
	if (sendChatToggle.checked) {
		globalMuteSend = false
	} else {
		globalMuteSend = true
	}
	
	// Updating content script on the changes
	let msg = {
		txt: "change send result",
		changeInfo: {
			newBool: globalMuteSend,
		},
	}
	
	sendMessageToContentScript(msg)
}

// Function for when the send gm checkmark state changes
function onSendGMCheckChange() {
	if (sendGMToggle.checked) {
		globalSendGM = true
	} else {
		globalSendGM = false
	}
	
	// Updating content script on the change
	let msg = {
		txt: "change whisper GM",
		changeInfo: {
			newBool: globalSendGM,
		},
	}
	
	sendMessageToContentScript(msg)
}

// Function for when the die type buttons are clicked
function onClickDieTypeButton(button) {
	// Getting the index of the die type from the button's index
	let indexDieType = dieTypeButtons.indexOf(button)
	if (indexDieType != -1) {
		
		// Switching the color highlight
		toggleHighlightDieTypeButton(button)
		toggleHighlightDieTypeButton(activeDieTypeButton)
		activeDieTypeButton = button
		

		// Notify content script on die change
		let msg = {
			txt: "change die type",
			changeInfo: {
				dieId: dice[currentDieIndex].ID,
				newType: indexDieType,
			}
		}
		
		dice[currentDieIndex].dieType = dieTypeIndexToStr[indexDieType]
		
		// Updating main die button graphics
		let curMainDie = document.getElementById("die-index-"+currentDieIndex)
		let mainDieImg = curMainDie.childNodes[1]
		mainDieImg.src = "images/" + dice[currentDieIndex].dieType + "BGW.png"
		curMainDie.childNodes[0].childNodes[0].innerHTML = "<b>" + dice[currentDieIndex].dieType + "</b>"

		
		sendMessageToContentScript(msg)

	}
}



// Callback function for when we get message from content server
function gotMessage(message) {
	if (message.txt == "query response") {
		
		// Reading update message parameters and updating popup accordingly
		globalMultiRoll = message.multiRoll
		globalMuteSend = message.sendResult
		globalSendGM = message.sendGM
		
		for (let i = 0; i < message.dice.length; i++) {
			let curDie = message.dice[i]
			onDieInfoUpdate(i, curDie)
		}
		
		
		if (dice.length > message.dice.length) {
			// Deleting last elements of array incase we got less than we needed
			let difference = dice.length - message.dice.length
			// Reverting Html
			revertDiceHtml(difference)
			// Removing from end of array
			dice.splice(dice.length - difference, difference)
		}
	} 
}

// Formats an inner html string for connected die buttons when it's image needs to be changed
function formatInnerHtmlConnected(messageDieInfo) {
	let formattedHtml = '<div class="connected-die-text">'
	formattedHtml += '<span style="color: var(--goDice' + colorIndexToString[messageDieInfo.color] + ')">'
	formattedHtml += "<b>" + messageDieInfo.dieType + "</b></span>"
	formattedHtml += '</div><img src="images/' + messageDieInfo.dieType + 'BGW.png" class="img-die-bg"></img>'
	return formattedHtml
}

// Formats an inner html string for a disconnected die button
function formatInnerHtmlDisconnected(messageDieInfo) {
	let formattedHtml = '<img src="images/LostConnectionBlack.svg" class="disconnted-die-img filter' + colorIndexToString[messageDieInfo.color] + '"></img>'
	formattedHtml += '<img src="images/' + messageDieInfo.dieType + 'BGW.png" class="img-die-bg img-die-bg-transparent"></img>'
	return formattedHtml
}

// Method for updating the die's stored info
function onDieInfoUpdate(dieIndex, messageDieInfo) {
	
	let dieElement = document.getElementById("die-index-"+dieIndex)

	if (!messageDieInfo.disconnected) {
		dieElement.innerHTML =  formatInnerHtmlConnected(messageDieInfo)
		
		dieElement.childNodes[1].addEventListener('click', function() {
			onClickConnectedDie(dieIndex)
		});
		
		if (!dice[dieIndex]) {
			// Initalizing die info
			dice[dieIndex] = {}
		}
		// Updating the local die info
		dice[dieIndex].ID = messageDieInfo.ID
		dice[dieIndex].color = colorIndexToString[messageDieInfo.color]
		dice[dieIndex].dieType = messageDieInfo.dieType
		dice[dieIndex].battery = messageDieInfo.batteryLevel
	} else {


		// Hiding inspector incase the currently selected die was disconnected
		if (!!dice[currentDieIndex]) {
			if (!dice[currentDieIndex] && dice[currentDieIndex].ID == messageDieInfo.ID && hiddenInspector) {
				hiddenInspector.style.display = "none"
			}
		}

		
		dieElement.innerHTML = formatInnerHtmlDisconnected(messageDieInfo)
		
		
		dieElement.childNodes[1].addEventListener('click', function() {
			onClickDisconnectedDie(dieIndex)
		})
	
		if (!dice[dieIndex]) {
			// Initalizing die info
			dice[dieIndex] = {}
		}
		// Updating local die info
		dice[dieIndex].ID = messageDieInfo.ID
		dice[dieIndex].color = colorIndexToString[messageDieInfo.color]
	}
}

// Reverts a connected die buttpn back to a normal connect button for when a die disconnected
function revertDiceHtml(difference) {
	for (let i = dice.length - difference; i < dice.length; i++) {
		let curElement = document.getElementById("die-index-" + i)
		curElement.innerHTML = '<button id="connect' + i + '" type="button" class="btn"><b>+</b></button>'
		curElement.addEventListener('click', function() {
			onClick(links[i])
		});
	}
}
