// Roll20 content script

// Html elements
const chat = document.getElementById("textchat-input"); // Getting roll20's chat
const txt = chat.getElementsByTagName("textarea")[0];	// Getting chatbox
const btn = chat.getElementsByTagName("button")[0];		// Getting send button
const speakingas = document.getElementById("speakingas"); // Getting the speakingas element

// Injecting GoDice tab
let logoURL = chrome.runtime.getURL("images/GO_Logo.svg")
document.body.insertAdjacentHTML("afterbegin",
 `<div id="sliding-tab" class="sliding-tab">
	<img class="godice-logo" src="${logoURL}"></img>
	<div class="modifier-div">
		<div id="godice-mod-left" class="modifier-button button-left"> + </div>
		<span id="modifier-num" style="color: #333 !important" contenteditable="true"><b>0</b></span>
		<div id="godice-mod-right" class="modifier-button button-right"> - </div>
	</div>
	<div class="modifier-text">Set modifier</div>
	<input id="godice-roll-template" class="template-checkbox" type="checkbox">
	<div class="template-text">Playing D&D 5e? ⓘ
	<span class="tooltiptext">Uncheck for basic dice template
							  if this is not a D&D 5e session
	</span>
	</div>
	<div class="grey-vl"></div>
 </div>`);
const resizeObserver = new ResizeObserver((entries) => {
	document.getElementById('sliding-tab').style.right = (entries[0].contentRect.width) + "px"
})

resizeObserver.observe(document.getElementById('rightsidebar'))

// Getting modifier elements
var curModifier = 0
var modifierText = document.getElementById("modifier-num")	// Modifier number html element

allowed_keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace", "ArrowLeft", "ArrowRight", "-"]
modifierText.addEventListener("keydown", (event) => {
	if (event.key == "Enter") {
		modifierText.blur()
	}
	if (allowed_keys.indexOf(event.key) == -1 || (event.key == "-" && modifierText.textContent.includes("-"))) {
		event.preventDefault()
	}
})

modifierText.addEventListener("blur", (event) => {
	curModifier = Math.min(Math.max(parseInt(modifierText.textContent), -99), 99) | 0
	if (curModifier > 0) {
		modifierText.innerHTML = "<b>+" + curModifier.toString() + "<b>"
	} else {
		modifierText.innerHTML = "<b>" + curModifier.toString() + "<b>"
	}
})

// Adding events to buttons
document.getElementById("godice-mod-left").addEventListener('click', () => {
	if (curModifier < 99) {
		curModifier++;
		let newModifierText = curModifier.toString()
		if (curModifier > 0) {
			newModifierText = "+" + newModifierText
		}
		modifierText.innerHTML = `<b>${newModifierText}<b>`
	} else {
		curModifier = 99
		modifierText.innerHTML = "<b>+99<b>"
	}
})

document.getElementById("godice-mod-right").addEventListener('click', () => {
	if (curModifier > -99) {
		curModifier--;
		let newModifierText = curModifier.toString()
		if (curModifier > 0) {
			newModifierText = "+" + newModifierText
		}
		modifierText.innerHTML = `<b>${newModifierText}<b>`
	} else {
		curModifier = -99
		modifierText.innerHTML = "<b>-99<b>"
	}
})

// Getting and setting up template checkbox
let rollTemplateCheckbox = document.getElementById("godice-roll-template")
var use5ETemplate = false;

rollTemplateCheckbox.addEventListener('change', () => {
	use5ETemplate = rollTemplateCheckbox.checked
	console.log(use5ETemplate)
})

// Parameters for getting main active tab
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.log(message)
	if (message.text == "MultiDie") {
        PostRawChatMessage("GoDice " + message.type + " [[" + message.value+ "]]", false)
    } else if (message.text == "multiRollStarted") {
		PostRawChatMessage("Rolling...")
	} else {
		gotRoll(message)
	}
})

var modifierStr = ""

function gotRoll(message) {
	let modifier = curModifier
	modifierStr = ""
	
	if (modifier != 0) {
		// Adding modifier
		if (modifier >= 0) {
			modifierStr += " + " + modifier
		} else {
			modifierStr += " - " + Math.abs(modifier)
		}
	}
	
	if (!message.d20) {
		// Not a d20 roll
		let types = Object.keys(message.dice)
		
		let sum = modifier
		let typeStr = ""
		let formula = " "
		if (types.length == 2 && types.indexOf("D10") != -1 && types.indexOf("D10X") != -1)  {
			// D100 Logic
			sum = 0
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
		} else {
			// Not D100
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
					}
					sum += parseInt(curDice[j])
					formula += curDice[j] + " + "
				}
				formula = formula.slice(0, -3) // Removing last three characters
				formula += ") + "
			}
			typeStr = typeStr.slice(0, -3)
			if (modifier != 0) {
				// Adding modifier is there is one
				typeStr += modifierStr
			}
			
			formula = formula.slice(0, -3)
		}
		
		postChatMessage(sum, typeStr, formula, false, message.sendGM, )
		
	} else {
		let D20s = message.dice["D20"]
		
		// Formatting type string

		if (D20s.length == 1) {
			postChatMessage(D20s[0], "1D20" + modifierStr, "", false, message.sendGM)
		} else {
			postChatMessage(D20s, "2D20" + modifierStr, "", true, message.sendGM)
		}
	}
}


// Posts a die roll in the roll20 chat while with according format
// (Inspired by Beyond20 extension https://github.com/kakaroto/Beyond20)
function postChatMessage(dieValue, dieType, formula, advantage = false, sendGM = false) {
	
	// Getting current speakingas
	let speakingas_value = speakingas.value
	let charName = speakingas[0].textContent
	for (let i = 1; i < (speakingas.children.length); i++){
		if (speakingas_value == speakingas[i].value) {
			charName = speakingas[i].textContent
			break
		}
	}
	
	
    const old_text = txt.value; // Saving the current text in the textbox
	if (!advantage) {
		if (use5ETemplate) {
			txt.value = "&{template:simple} {{rname=GoDice " + dieType + "}}  {{r1= [[" + dieValue + " [" + dieType + "]" + formula + modifierStr + "]]}} {{normal=1}}{{charname=" + charName + "}}";
		} else {
			txt.value = "&{template:default} {{name=GoDice " + dieType + "}}  {{Roll= [[" + dieValue + " [" + dieType + "]" + formula + modifierStr + "]]}}"
		}
	} else {
		// If the roll is a d20 advantage roll
		let adv = Math.max(dieValue[0], dieValue[1])
		let dis = Math.min(dieValue[0], dieValue[1])
		if (use5ETemplate) {
			txt.value = "&{template:simple} {{rname=GoDice " + dieType + "}}  {{r1= [[" + adv + " [D20]" + formula + modifierStr + "]]}} {{always=1}} {{r2= [[" + dis + " [D20]" + formula + modifierStr + "]]}} {{charname=" + charName + "}}";
		} else {
			txt.value = "&{template:default} {{name=GoDice " + dieType + "}}  {{Advantage= [[" + adv + " [D20]" + formula + modifierStr + "]]}}  {{Disadvantage= [[" + dis + " [D20]" + formula + modifierStr + "]]}}"
		}
	}
	if (globalSendGM) {
		// Whispering message to gm
		txt.value = "/w gm " + txt.value
	}
    btn.click(); // Sending message
    txt.value = old_text; // Returning old text
}

// Prints raw string message into chat
function PostRawChatMessage(rawMessage) {
	
	const old_text = txt.value; // Saving the current text in the textbox
	txt.value = rawMessage
	if (globalSendGM) {
		txt.value = "/w gm " + txt.value
	}
	btn.click()
	txt.value = old_text;
}
