// HTML Strings for formatting the dice messages
const toBeFormattedHTML = '<h3>GoDice</h3><div class="dice-roll"> <div class="dice-result"> <div class="dice-formula">TOTALFORMULA</div> <div class="dice-tooltip"> <section class="tooltip-part"> <div class="dice">DICELISTS</div> </section> </div> <h4 class="dice-total">TOTALSUM</h4> </div></div>'
const dieListHTML = ' <header class="part-header flexrow"> <span class="part-formula">DICETYPES</span> <span class="part-total">PARTSUM</span> </header> <ol class="dice-rolls">DIEROLLS</ol>'
const dieRollHTML = '<li class="roll die TYPE">VALUE</li>'

var chat = null
var rangeElement = null
var rangeValue = null
var modifier = 0

// Tries to get the chat element at program start and every 700 miliseconds until it finds it (Chat takes time to load)
tryGetChat()
function tryGetChat() {
    chat = document.getElementById("chat-message")
    if (!chat) {
        setTimeout(tryGetChat, 700)
    } else {
        injectModifier()
    }
}

// Function to post a message into foundry's chat
function postChatMessage(message, returnOld=true) {
    
    // Checking if the chat element was found
    if (chat) {
        // Saving the current text value of the chat
        const oldValue = chat.value;

        // Entering the message into chat
        chat.value = message
        // Sending enter event to chat to send the message
        chat.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Enter'}));

        if (!oldValue.startsWith("<h3>GoDice</h3>")) {
            // Putting back the old chat value after a small timeout 
            //(Foundry seems to clear the chat a bit after sending the message, the delay is there so it doesn't delete the old message)
            if (returnOld) {
                setTimeout( () => {
                    chat.value = oldValue;
                }, 50)
            }
        }

    }
}

// Formats an HTML dice message after getting a message from the mainDie script
function formatHTMLMessage(message) {
    // Setting up variables for formatting
    let formattedHTML = toBeFormattedHTML
    let diceLists = ""
    let totalSum = 0
    let totalFormula = ""
    let types = Object.keys(message.dice)


    if (types.length == 2 && types.indexOf("D10") != -1 && types.indexOf("D10X") != -1)  {
        // D100 Logic
        sum = 0
        if (message.dice["D10"] == "0") {
            if (message.dice["D10X"] == 0) {
                sum += 100
            } else {
                sum += parseInt(message.dice["D10X"])
            }
        } else {
            sum += parseInt(message.dice["D10"]) + parseInt(message.dice["D10X"])
        }
        let curDiceList = dieListHTML // Duplicating the dice list HTML string for formatting
        let dieRoll = dieRollHTML.replace("TYPE", "d100")
        dieRoll = dieRoll.replace("VALUE", sum)
        let diceList = dieListHTML
        diceList = diceList.replace("DICETYPES", "d100")
        diceList = diceList.replace("PARTSUM", sum)
        diceList = diceList.replace("DIEROLLS", dieRoll)
        totalSum = sum
        totalFormula = "D100"
    }

    else {
        // Iterating through each die type in message
        for (let i in types) {
            console.debug("Here")
            let curDiceList = dieListHTML // Duplicating the dice list HTML string for formatting
            let partSum = 0	
            let curDice = message.dice[types[i]]
            let diceTypes = message.dice[types[i]].length + types[i]
            let dieRolls = ""

            // Iterating thorugh each die in the curent die type
            for (let j in curDice) {
                // D10 Logic
                let typeStr = types[i].toLowerCase()
                if (typeStr == "d10" && curDice[j] == 0) {
                    // Zero on a D10 means 10
                    curDice[j] = 10
                }
                partSum += parseInt(curDice[j]) // Adding current value to sum        

                // Checking if the current value is max or min
                if (curDice[j] == typeStr.slice(1)) {
                    typeStr += " max"
                } else if (curDice[j] == 1) {
                    typeStr += " min"
                }
                // Formatting each die element and adding to the current dice list
                let curDieRoll = dieRollHTML.replace("TYPE", typeStr)
                curDieRoll = curDieRoll.replace("VALUE", curDice[j])
                dieRolls += curDieRoll
            }

            // Formatting the dice list html and adding it to the diceList string
            curDiceList = curDiceList.replace("DICETYPES", diceTypes)
            curDiceList = curDiceList.replace("PARTSUM", partSum)
            curDiceList = curDiceList.replace("DIEROLLS", dieRolls)
            diceLists += curDiceList
            
            // Updating the total sum and total formula
            totalSum += partSum
            totalFormula += diceTypes + " + "

        }
        if (modifier == 0) {
            totalFormula = totalFormula.slice(0, -3)
        } else {
            if (modifier < 0) {
                totalFormula = totalFormula.replace("+", "-") + Math.abs(modifier)
            } else {
                totalFormula += modifier
            }
        }
    }
    


    formattedHTML = formattedHTML.replace("TOTALFORMULA", totalFormula)
    formattedHTML = formattedHTML.replace("DICELISTS", diceLists)
    formattedHTML = formattedHTML.replace("TOTALSUM", totalSum + modifier)

    return formattedHTML
}


// Listening for message from background script (Passes messages from mainDie Script)
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	console.warn(message)
    if (message.text == "MultiDie") {
        postChatMessage("GoDice " + message.type + " " + message.value, false)
    } else if (message.text == "multiRollStarted") {
        postChatMessage("Rolling...")
    } else {
        postChatMessage(formatHTMLMessage(message))
    }
})

// Function to inject dice modifier into chat
function injectModifier() {
    // Getting the chat controls div
    let chatControls = document.getElementById("chat-controls")

    // Creating the span element which will show the modifier's value
    let rangeValue = document.createElement("span")
    rangeValue.style = "position: absolute; text-align: center; margin: 5px 5px; bottom: 0px; width: 35px; color: black; background-color: rgba(0, 0, 0, 0); background-image: url('/ui/parchment.jpg'); border: 1px solid rgb(0, 0, 0);"
    rangeValue.textContent = "0"
    rangeValue.contentEditable = true

    allowed_keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace", "ArrowLeft", "ArrowRight", "-"]
    rangeValue.addEventListener("keydown", (event) => {
        if (event.key == "Enter") {
            rangeValue.blur()
        }
        if (allowed_keys.indexOf(event.key) == -1 || (event.key == "-" && rangeValue.textContent.includes("-"))) {
            event.preventDefault()
        }
    })
    rangeValue.addEventListener("blur", (event) => {
        modifier = Math.min(Math.max(parseInt(rangeValue.textContent), -99), 99) | 0
        rangeValue.textContent = modifier.toString()
        
    })

    // Number range slider to pick modifier
    plusButton = document.createElement("input")
    minusButton = document.createElement("input")
    plusButton.type = "button"
    minusButton.type = "button"
    plusButton.id = "modifier-plus"
    minusButton.id = "modifier-minus"
    plusButton.value = "+"
    minusButton.value = "-"
    plusButton.title = "GoDice Modifier"
    minusButton.title = "GoDice Modifier"
    buttonStyle = `cursor: pointer; margin-right: 5px; margin-top: 2.5px; border: 0px; width: 21px; height: 21px;
    border-radius: 2px; color: #782e22; background-image: url('/ui/parchment.jpg'); font-weight: 900;
    vertical-align:middle;`
    plusButton.style = buttonStyle
    minusButton.style = buttonStyle

    plusButton.addEventListener('click', () => {
        modifier = Math.min(99, modifier+1)
        rangeValue.textContent = modifier
    })
    minusButton.addEventListener('click', () => {
        modifier = Math.max(-99, modifier-1)
        rangeValue.textContent = modifier
    })

    // Container for the slider and value
    let rangeContainer = document.createElement("div")
    rangeContainer.style = "position: relative; flex: 22px 22px 100%"
    rangeContainer.title = "GoDice Modifier"
    rangeContainer.appendChild(plusButton)
    rangeContainer.appendChild(minusButton)
    rangeContainer.appendChild(rangeValue)

    // Adding elements to chat controls
    chatControls.appendChild(rangeContainer)
}
