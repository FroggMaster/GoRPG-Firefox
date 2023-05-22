// Discord content script

var webhookURL = ""
var discordName = "Username"	// Default value

console.log("I'm active")
// Parameters for getting main active tab
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.text == "MultiDie") {
        PostRawChatMessage(message.type + " ``" + message.value + "``", false)
    } else if (message.text == "multiRollStarted") {
		PostRawChatMessage("Rolling...", true)
	} else {
		gotRoll(message)
	}
})

//submitButton = document.getElementsByClassName("form-home-discord__button")[0]
nameInput = document.getElementById("form-home-discord__name")
nameInput.addEventListener("change", () => {
	discordName = nameInput.value
})
webhookInput = document.getElementById("form-home-discord__webhooks")
webhookInput.addEventListener("change", () => {
	webhookURL = webhookInput.value
})

modifierValueText = document.getElementsByClassName("modifier-webhooks-discord__count")[0]

function gotRoll(message) {
	console.log(message)
	let modifier = parseInt(modifierValueText.textContent)
	let modifierStr = ""
	if (modifier != 0) {
		if (modifier > 0) {
			modifierStr = " + " + modifier
		} else {
			modifierStr = " - " + Math.abs(modifier)
		}
	}

	if (!message.d20) {
		// Not a d20 roll
		let types = Object.keys(message.dice)
		
		let sum = 0
		let typeStr = ""
		let formula = ""
		if (types.length == 1 && message.dice[types[0]].length == 1) {
			// Single die mode (for different messages)
			typeStr = types[0]
			if (typeStr == "D10" && message.dice["D10"][0] == "0") {
				// D10's 0 is a 10
				sum = 10
			} else {
				sum = parseInt(message.dice[types[0]][0])
			}
			sum += modifier
		} else if (types.length == 2  && types.indexOf("D10") != -1 && types.indexOf("D10X") != -1) {
			// D100 Logic
			typeStr = "D100"
			if (message.dice["D10"] == "0") {
				if (message.dice["D10X"] == 0) {
					sum += 100
				} else {
					sum += parseInt(message.dice["D10X"])
				}
			} else {
				sum += parseInt(message.dice["D10"]) + parseInt(message.dice["D10X"])
			}
			sum += modifier
		}
		else {
			// Not d100 or single die
			for (let i = 0; i < types.length; i++) {
				// Iterating through each type
				let curDice = message.dice[types[i]]
				typeStr += curDice.length + types[i] + " + "
				formula += "("
				
				for (let j = 0; j < curDice.length; j++) {
					// Iterating through each die in the current type
					if (types[i] == "D10" && curDice[j] == "0") {
						// D10's 0 is 10
						curDice[j] = "10"
						console.log("D10")
					}
					sum += parseInt(curDice[j])
					formula +=  curDice[j] + " + " 
				}
				formula = formula.slice(0, -3) + ") + "
			}
			typeStr = typeStr.slice(0, -3)
			formula = formula.slice(0, -3)
			sum += modifier
		}
		typeStr += modifierStr
		if (formula != "") {
			formula += modifierStr
		}
		postDiscordMessage(sum, typeStr, formula)
		
	} else {
		let D20s = message.dice["D20"]
		D20s[0] = parseInt(D20s[0]) + modifier
		if (D20s.length == 1) {
			postDiscordMessage(D20s[0], "D20" + modifierStr)
		} else {
			D20s[1] = parseInt(D20s[1]) + modifier
			postDiscordMessage(D20s, "Adv : Dis" + modifierStr, "", true)
		}
	}
}


// Posts a die roll in the roll20 chat while with according format
function postDiscordMessage(dieValue, dieType, formula = "", advantage = false, isMultiRoll = false, isRollingMsg = false) {
	
    var xhr = new XMLHttpRequest();
    xhr.open('POST', webhookURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
		
	let text = "``" + discordName + " | " + dieType
	if(isMultiRoll)
	{
		if(isRollingMsg)
			text = "``" + discordName + "``\r\n"
		else
			text = "";
		
		text += dieValue;
	}
	else if (!advantage) {
		if (formula != "") {
			text += "`` ||``" + formula + "``||\r\n"
		} else {
			text += "``\r\n"
		}
		text +=  "► **" + dieValue + "** ◄"
	} else {
		text +=  "``\r\n"
		if (dieValue[0] == dieValue[1]) {
			text += "►**" + dieValue[0] + "** || **" + dieValue[0] + "**◄"
		} else {
			text += "▲**" + Math.max(dieValue[0], dieValue[1]) + "** || **" + Math.min(dieValue[0], dieValue[1]) + "**▼"	
			}
	}
    data = {
        content: text,
    }

    xhr.send(JSON.stringify(data));

    xhr.onload = function(res) {
        //console.log('posted: ', res);
    }

    xhr.onerror = function(res) {
        console.log('error posting: ', res);
    }
	
}

// Prints raw string message into chat
function PostRawChatMessage(rawMessage, isRolling) {
	
	postDiscordMessage(rawMessage, "", "", false, true, isRolling);
}
