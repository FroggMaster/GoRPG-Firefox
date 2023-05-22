// This is the main content script that gets run when the url matches one we work with

console.log("I'm Active!")


var isPopupConnected = false;
var popupPort; // Port of popup communication
var rollingDice = [] 	// The current dice (Non d20s) that are being rolled
var cachedResults = []	// Cached results of rolled dice 
var rollingD20s = []	// The current d20s that are being rolled
var cachedD20Results = [] // Cached results of d20 rolls

var holdSend = false 	// When true will continue to cache new results and not send them
var globalMultiRoll = true 	// Is in multiRoll mode
var isMultiDieRolling = false	// Is multiRoll rolling right now
var multiRollTimeout = null 	// Timeout for multiRoll 

var globalSendGM = false 	// Is whisper to gm mode on
var globalSendResult = true // If need to send result

var batteryCount = 0 // How many battery values we got
function resetBatteryCount() {  // Timeout reset battery
	battery = 0
}


// Dictionary to convert die types from strings into die index
var dieTypeIndexToStr = {
	0: "D6",
	1: "D20",
	2: "D10",
	3: "D10X",
	4: "D4",
	5: "D8",
	6: "D12",
}

// Called when popup connects to content script
function connected(p) {
	// Popup port has connected
	if (p.name == "popup") {
		console.debug("Popup Connected")
		isPopupConnected = true;
		popupPort = p;
		
		// Adding got message listener to the popup port
		popupPort.onMessage.addListener(gotMessage);
		popupPort.onDisconnect.addListener((p) => {
			// On disconnect
			isPopupConnected = false;
			if (p.error) {
			console.log(`Disconnected due to an error: ${p.error.message}`);
			} else {
				console.debug("Popup disconnected")
			}
		});
		
		if (batteryCount == 0) {
			for (var id in connectedDice) {
				connectedDice[id].getBatteryLevel()
			}
			setTimeout(resetBatteryCount, 7000)
		}
		
		for (var id in disconnectedDice) {
			attemptReconnectDie(id)
		}
		

	}
	

}

// Adding the listener for when a port attempts to connects
chrome.runtime.onConnect.addListener(connected);

// Sends query response to popup
function sendResponseToPopup() {
	if (isPopupConnected) {
		let queryResponse = formatParameterMessage()
		popupPort.postMessage(queryResponse)
	}
}


// Sends dice result to specific content script
function sendDiceResult(D20roll = false) {
	
	let rollMessage = {
		text: "diceResult",
		d20: D20roll,
		sendGM: globalSendGM,
		dice: {
			
		}
	}
	
	if (!D20roll) {
		for (let i = 0; i < cachedResults.length; i++) {
			if (!rollMessage.dice[cachedResults[i].type]) {
				rollMessage.dice[cachedResults[i].type] = []
			}
			rollMessage.dice[cachedResults[i].type].push(cachedResults[i].value)
		}
	} else {
		// D20 Message
		rollMessage.dice["D20"] = []
		for (let i = 0; i < cachedD20Results.length; i++) {
			rollMessage.dice["D20"].push(cachedD20Results[i])
		}
	}
	
	console.log("sendMessage: ", rollMessage);
	
	// Sending message through message passer script
	chrome.runtime.sendMessage(rollMessage)
}

function multiRollProcess(dieType, dieValue) {
	
	let multiRollMessage = {
		text: "MultiDie",
		type: dieType,
		value: dieValue
	}

	if (!isMultiDieRolling) {
		isMultiDieRolling = true
		holdSend = true
	}

	// Sending message through message passer script
	chrome.runtime.sendMessage(multiRollMessage)

	clearTimeout(multiRollTimeout)
	multiRollTimeout = setTimeout(() => {
		holdSend = false
		isMultiDieRolling = false

		if (cachedD20Results.length != 0) {
			sendDiceResult(true)
			cachedD20Results = []
		}
		if (cachedResults.length != 0) {
			sendDiceResult()
			cachedResults = []
		}


	}, 2200)

}

// Function to procces die roll 
function processDieRoll(dieValue, dieId) {
	// If we don't need to send the result there's no need to procces
	if (globalSendResult) {
		
		let curDieType = diceInfo[dieId].dieType
		

		if (curDieType != "D20") {
			if (rollingDice.length === 1 || rollingDice.indexOf(dieId) === -1){
				// Last rolling die / Single die roll
				cachedResults.push({type: curDieType, value: dieValue})
				rollingDice = []

				if (!globalMultiRoll) {
					sendDiceResult()
					cachedResults = []
				}

				

			} else {
				// Caching current die result
				cachedResults.push({type: curDieType, value: dieValue})
				
				// Removing value from rolling dice
				var index = rollingDice.indexOf(dieId);
				while (index !== -1) {
					rollingDice.splice(index, 1);
					index = rollingDice.indexOf(dieId);
				}
			}
		} else {
			// D20 logic
			let dieInstance = connectedDice[dieId]
			
			if (dieValue == 20){
				// Blue light
				dieInstance.pulseLed(5, 30, 20, [0, 0, 255])
			}
			else if (dieValue == 1){
				// Red light
				dieInstance.pulseLed(5, 30, 20, [255, 0, 0])
			}
			
			if (rollingD20s.length == 1 || rollingD20s.length > 2 || rollingD20s.indexOf(dieId) === -1) {
				// Single / double d20 roll
				cachedD20Results.push(dieValue)
				if (!globalMultiRoll) {
					sendDiceResult(true)
					cachedD20Results = []
				}


			} else {
				// Caching result
				cachedD20Results.push(dieValue)
			}
			// Removing stable d20 from rolling array
			var index = rollingD20s.indexOf(dieId);
			rollingD20s.splice(index, 1);
		}

		// Multi die feature
		if (globalMultiRoll) {
			// Sending every die roll
			multiRollProcess(curDieType, dieValue)
		}
	}
}


// Function to open the Bluetooth connection dialog for choosing a GoDice to connect
async function openConnectionDialog() {
	const newDice = new GoDice();
	try {
		await newDice.requestDevice();
	} catch {
		if (newDice.bluetoothDevice != null)
		{
			console.log("Error on connecting die or user closed connection dialog, trying again")
			newDice.attemptReconnect(newDice.GlobalDeviceId)
		}
	}
}

var connectedDice = {}; // Dictonary of all conencted die instances
var disconnectedDice = {}; // Dictionary of all dice that has been connected and was disconnected
var diceInfo = {}; // Dictonary of info on each die


// When a die has connected
GoDice.prototype.onDiceConnected = (diceId, diceInstance) => {
	console.log("Dice connected: ", diceId);
	console.log(diceId in connectedDice)
	
	if (!(diceId in disconnectedDice)) {
		// Die is connected for the first time
		connectedDice[diceId] = diceInstance;
		connectedDice[diceId].setDieType(GoDice.diceTypes.D20);
	
		// Intilazing die's info
		diceInfo[diceId] = {
			color: -1,
			dieType: "D20",
			batteryLevel: -1,
		}
	
		connectedDice[diceId].getDiceColor()
	} else {
		// Die was reconnected
		connectedDice[diceId] = disconnectedDice[diceId]
		delete disconnectedDice[diceId]
		sendResponseToPopup()
	}

}

// When a die has disconnected
GoDice.prototype.onDiceDisconnected = (diceId, diceInstance) => {
	console.log(diceId + " Has disconnected")
	// If dice was actually fully connected
	if (connectedDice[diceId]) {
		disconnectedDice[diceId] = connectedDice[diceId]
		delete connectedDice[diceId]
		//disconnectedDice[diceId].reconnecting = false
		attemptReconnectDie(diceId)
		sendResponseToPopup()
	}
}

async function attemptReconnectDie(dieId) {
	// Checking if the die is curretly attempting to reconnect
	console.log("Attempting reconnect again")
	if (!disconnectedDice[dieId]) {
		return;
	}
	if (!disconnectedDice[dieId].reconnecting) {
		disconnectedDice[dieId].reconnecting = true
		try{
			await disconnectedDice[dieId].attemptReconnect(dieId)
		} catch {
			console.log("Error on reconnecting")
		} finally {
			disconnectedDice[dieId].reconnecting = false
		}
	} else{
		console.debug("Reconnect already in progress!")
	}

}


// Formats the message to update the popup script's info
function formatParameterMessage() {
	
	let message = {
		txt: "query response",
		sendResult: globalSendResult,
		sendGM: globalSendGM,
		multiRoll: globalMultiRoll,
		dice: [] // Array of each connected/disconnected die
	}
	
	// Getting all connected dice's IDs
	diceIDs = Object.keys(connectedDice)
	// Iterating through each die and adding it's info to the message
	for (let i = 0; i < diceIDs.length; i++) {
		// Formatting message
		let curId = diceIDs[i]
		message.dice.push({
			ID: curId,
			color: diceInfo[curId].color,
			dieType: diceInfo[curId].dieType,
			batteryLevel: diceInfo[curId].batteryLevel,
		})
	}
	
	// Getting all disconnected dice's IDs
	disconnectedDiceIDs = Object.keys(disconnectedDice)
	//Iterating through each disconnected die and adding the according info
	for (let i = 0; i < disconnectedDiceIDs.length; i++) {
		// Formatting message
		let curId = disconnectedDiceIDs[i]
		message.dice.push({
			ID: curId,
			disconnected: true,
			dieType: diceInfo[curId].dieType,
			color: diceInfo[curId].color,
		})
	}
	
	console.debug("sending query response: ", message)
	return message
	
	
}

// Changes die type and the info stored on the die, gets the die's ID and string representation of the die type
function changeDieType(dieId, newType) {
	connectedDice[dieId].setDieType(newType)
	diceInfo[dieId].dieType = dieTypeIndexToStr[newType]
	
}

// ==== Stable dice events ===
// Stable event
GoDice.prototype.onStable = (diceId, value, xyzArray) => {
	console.log("Stable event: ", diceId, value);;
	processDieRoll(value, diceId)


};

// Tilt stable event
GoDice.prototype.onTiltStable = (diceId, xyzArray, value) => {
	console.log("Tilt")
	processDieRoll(value, diceId)
};

// Fake stable event
GoDice.prototype.onFakeStable = (diceId, value, xyzArray) => {
	processDieRoll(value, diceId)
};

// Move stable event
GoDice.prototype.onMoveStable = (diceId, value, xyzArray) => {
	console.log("Move stable")
}

// When getting response of dice color
GoDice.prototype.onDiceColor = (diceId, colorCode) => {
	diceInfo[diceId].color = colorCode
	
	// Letting popup script know (in case it is open while we got the message)
	connectedDice[diceId].getBatteryLevel()
};

GoDice.prototype.onBatteryLevel = (diceId, batteryLevel) => {
	console.log("Battery " + batteryLevel)
	
	let oldValue = diceInfo[diceId].batteryLevel
	diceInfo[diceId].batteryLevel = batteryLevel
	if (oldValue == -1) {
		sendResponseToPopup()
		connectedDice[diceId].pulseLed(1, 60, 20, [255, 0, 255])
	} else {
		batteryCount++
		if (batteryCount == Object.keys(connectedDice).length) {
			sendResponseToPopup()
			batteryCount = 0
		}
	}
	


};

// Roll start event
GoDice.prototype.onRollStart = (diceId) => {
	console.log(diceId + " Roll started")
	if (globalSendResult) {
		if (globalMultiRoll) {
			clearTimeout(multiRollTimeout)
			if (!isMultiDieRolling) {
				isMultiDieRolling = true
				let msg = {
					text: "multiRollStarted"
				}
				chrome.runtime.sendMessage(msg)
			}
		}
		// Adding die to rolling arrays
		if (diceInfo[diceId].dieType == "D20") {
			// D20 rolling logic
			if (rollingD20s.indexOf(diceId) === -1) {
				rollingD20s.push(diceId)
			}
		} else {
			if (rollingDice.indexOf(diceId) === -1) {
				rollingDice.push(diceId)
			}
		}
	}

}


// Callback function when the we get a message
function gotMessage(message, sender, sendRespnse) {
	
	// Connect GoDice request
	if (message.txt == "connect GoDice") {
		openConnectionDialog();
	}
	// Query parameters request (popup was opened and need info)
	else if (message.txt == "query parameters") {
		sendResponseToPopup()
	}
	// Change die type request
	else if (message.txt == "change die type") {
		
		let changeInfo = message.changeInfo
		
		if (connectedDice[changeInfo.dieId]) {
			changeDieType(changeInfo.dieId, changeInfo.newType)
		}
	}
	else if (message.txt == "change multi roll") {

		let changeInfo = message.changeInfo
		globalMultiRoll = changeInfo.newBool

	}
	// Change send result bool request
	else if (message.txt == "change send result") {
		
		let changeInfo = message.changeInfo
		globalSendResult = changeInfo.newBool
		
	}
	// Change whisper gm bool request
	else if (message.txt == "change whisper GM") {
		
		let changeInfo = message.changeInfo
		globalSendGM = changeInfo.newBool
	}
	// Reconnect die request
	else if (message.txt == "reconnect die") {
		if (message.dieId in disconnectedDice) {
			attemptReconnectDie(message.dieId)
		}
	}
	
	// Otherwise we print the message
	else {
		console.log(message)
	}
}
