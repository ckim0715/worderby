//#region API OPTIONS ---------------------------------------------------
//-----------------------------------------------------------------------

// ***** CURRENT OPTION IN USE *****
// Free Dictionary API
// useful for: getting exact match (or lack of match) for word
// site: https://dictionaryapi.dev/
// GET URL: https://api.dictionaryapi.dev/api/v2/entries/en/${word}

// Random Word API
// fetch random word (or words)
// site: http://random-word-api.herokuapp.com/home
// GET URL: https://random-word-api.herokuapp.com/word?swear=0

// Datamuse API
// useful for: getting a list of words that start with/end with a string
// site: https://www.datamuse.com/api/
// GET URL: https://api.datamuse.com/words?sp=${word}

// WordsAPI
// site: https://www.wordsapi.com/
// GET URL: [need to register]

//#endregion


//#region GLOBAL VARIABLES ----------------------------------------------
//-----------------------------------------------------------------------

// elements from title animation
const titleTextBeforeBold = document.getElementById('title-1');
const titleTextBold = document.getElementById('title-2');
const titleTextAfterBold = document.getElementById('title-3');

// elements from player form (game area)
const playerForm = document.getElementById('player-form');
const promptAndInputContainer = document.getElementById('prompt-and-input');
const controlsPopupContainer = document.getElementById('controls-popup-container');
let popupTimeout;
const popup = document.getElementById('popup')
const promptUnusable = document.getElementById('prompt-unusable');
const promptUsable = document.getElementById('prompt-usable');
const playerInput = document.getElementById('player-input');
const submitButton = document.querySelector('#player-form [type="submit"]');
const rulesButton = document.getElementById('rules-button');
let availablePromptText = promptUsable.textContent;
let selectedPromptText = "";
const player1Score = document.getElementById('player-1-score')
const player2Score = document.getElementById('player-2-score')
const player1Total = document.getElementById('player-1-total')
const player2Total = document.getElementById('player-2-total')


// frankenword element
const frankenword = document.getElementById('frankenword');
const voiceToggleButton = document.getElementById('voice-toggle');

// menu buttons
const newGameButton = document.getElementById('new-game-button');
const expandButton = document.getElementById('expand-button');
const footer = document.getElementById('game-info');
const playDiv = document.getElementById('play-area')

// game mechanics variables
let round = 1;
let isGameOver = false;
const roundLimit = 5;
let player1Points = 0;
let player2Points = 0;
const pointsPerPromptLetter = 10;
const pointsPerInputLetter = 1;
let currentPlayer = 1;
const coreRules = [
    `Score the most points in ${roundLimit} rounds by playing words`,
    `Select a starting point for your word within the prompt word (last word played)`,
    `Add at least one new letter to finish your word`
];
const pointsRules = [
    `${pointsPerPromptLetter} point${pointsPerPromptLetter === 1 ? '' : 's'} - per prompt letter used`,
    `${pointsPerInputLetter} point${pointsPerInputLetter === 1 ? '' : 's'} - per new letter added`,
]
const wordRules = [
    "Cannot use entire prompt word",
    "Cannot play a word already played this game"
]
const restrictedSuffixes = [
    's',
    'ly',
    'ful',
    'ish',
    'ing',
    'ive'
]
const suffixesUsedThisGame = [];
const wordsPlayedThisGame = [];
let rejectReason = "word not allowed";

// TTS variables
const synth = window.speechSynthesis
let isVoiceActive = false;
let voice;

//#endregion


//#region CODE RUN ON DOC LOAD ------------------------------------------
//-----------------------------------------------------------------------

pageLoad();

//#endregion


//#region FUNCTIONS - COMPLETE ------------------------------------------
//-----------------------------------------------------------------------

function pageLoad() {
    runTitleAnimationAtInterval(1.5);
    addEventListeners();
    getVoice();
    setTimeout(() => displayPopup('controls'), 1000);
    setPromptTo('begin');
    frankenword.textContent = 'begin';
    playerInput.placeholder = 'gerbread';
    wordsPlayedThisGame.length = 0;
    resizeInput();
    round = 1;
    currentPlayer = 1;
    isGameOver = false;
}

// starts the title animation
function runTitleAnimationAtInterval(intervalInSeconds) {
    setInterval(cycleTitle, intervalInSeconds * 1000);
}

// highlight the next word in the title animation sequence
function cycleTitle() {
    switch (titleTextBold.textContent) {
        case 'word':
            titleTextBeforeBold.textContent = 'w';
            titleTextBold.textContent = 'order';
            titleTextAfterBold.textContent = 'by';
            break;
        case 'order':
            titleTextBeforeBold.textContent = 'wor';
            titleTextBold.textContent = 'derby';
            titleTextAfterBold.textContent = '';
            break;
        case 'derby':
            titleTextBeforeBold.textContent = '';
            titleTextBold.textContent = 'word';
            titleTextAfterBold.textContent = 'erby';
            break;
        
        default:
            console.error('title text cycle broken')
            titleTextBeforeBold.textContent = '';
            titleTextBold.textContent = 'word';
            titleTextAfterBold.textContent = 'erby';
            break;
    }
}

// add all event listeners for the page
function addEventListeners() {
    // When player submits text input form, they submit the word as their answer
    playerForm.addEventListener('submit', submitAnswer);
    
    // When New Game button is clicked, entire game resets
    newGameButton.addEventListener('click', resetGame);

    // When unusable prompt section is clicked, flash red and indicate off limits
    promptUnusable.addEventListener('click', instructUnusablePrompt);

    // have document check for keyboard input
    document.addEventListener('keydown', processKeyboardInput)

    // Read button reads frankenword
    frankenword.addEventListener('click', readFrankenword)

    // toggle voice reading
    voiceToggleButton.addEventListener('click', toggleVoiceActive)

    // dynamically resize input field according to text input
    playerInput.addEventListener('input', resizeInput)

    // click popup to make it go away
    popup.addEventListener('click', () => setPopupVisibleTo(false));

    // click to expand/collapse footer
    expandButton.addEventListener('click', toggleFooterExpand);

    // click to display rules overlay
    rulesButton.addEventListener('click', () => displayOverlay('rules'));
}

// callback for when player submits an answer
function submitAnswer(e) {
    e.preventDefault();

    if (!selectedPromptText) {
        alert('must select at least one letter from prompt to begin your word!');
        return;
    } else if (!playerInput.value) {
        displayPopup('wordRejected', 'must enter at least one letter to play a word!')
        return;
    }

    setFormDisabledTo(true);

    testSingleWord()
    .then( wordEntry => {
        // if a valid word entry was found in the API
        if (wordEntry) {
            if (wordAllowed(wordEntry)) {
                wordsPlayedThisGame.push(wordEntry[0].word);
            
                // add score to player's total (IMPORTANT: order placement of this function affects output)
                currentPlayer === 1 ? player1TotalScore() : player2TotalScore();
    
                // add new word to scorecard (IMPORTANT: order placement of this function affects output)
                currentPlayer === 1 ? player1Submit() : player2Submit();
    
                // add input to frankenword
                frankenword.textContent += playerInput.value;
    
                // set played word as new prompt
                setPromptTo(wordEntry[0].word)
                
                // reset form
                playerForm.reset();
                playerInput.placeholder = "";
                resizeInput();
                
                // read new word
                isVoiceActive ? readFrankenword() : null;
                
                // toggle player turn (IMPORTANT: order placement of this function affects output)
                cyclePlayerTurn();
            } else {
                displayPopup('wordRejected', rejectReason);
            }
        // if input did not yield a valid entry in the API
        } else {
            displayPopup('wordRejected', 'word not found, try again!');
        }

        if (!isGameOver) {
            setFormDisabledTo(false);
            playerInput.focus();
        }
    })
}

function setPromptTo(word) {
    promptUnusable.textContent = word[0];
    availablePromptText = word.slice(1);
    formatPromptSpans();
    selectPromptLetters();
}

// test whether current player word guess is a word or not. Returns word entry or false
function testSingleWord() {
    const testWord = selectedPromptText + playerInput.value;
    
    return getWord(testWord)
}

// attempt to Get (presumed) word in dictionary API. Return dictionary entry or ""
function getWord(word) {
    return fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
    // parse json response if status is 200, otherwise return ""
    .then( res => res.status === 200 ? res.json() : false)
    // return parsed dictionary entry, or ""
    .then( data => data ? data : false)
    .catch( error => console.log(error.message))
}

// puts each letter of the player's usable prompt in its own span,
function formatPromptSpans() {
    // clear span HTML content
    promptUsable.innerHTML = "";

    for (let i = 0; i < availablePromptText.length; i++) {
        const span = document.createElement('span');
        span.textContent = availablePromptText[i];
        span.addEventListener('click', () => selectPromptLetters(i))
        promptUsable.appendChild(span);
    }

    selectedPromptText = "";
}

// "select" which prompt letters player is using based off starting letter index (in usable prompt)
function selectPromptLetters(i = 0) {
    selectedPromptText = availablePromptText.slice(i);
    highlightPromptStartingAt(i);
    playerInput.focus();
    popup.dataset.type === 'controls' ? setPopupVisibleTo(false) : null;
}

// highlight selected portion of prompt, dim unused portion
function highlightPromptStartingAt(startIndex) {
    for (let i = 0; i < availablePromptText.length; i++) {
        promptUsable.children[i].className = i < startIndex ? 'not-using' : 'using';
    }
}

// briefly apply '.alert' class to element to style, then remove
function flashTextRed(element) {
    if (element.classList.contains('alert')) {
        return;
    }
    element.classList.add('alert');
    setTimeout(() => {element.classList.remove('alert')}, 100);
}

// set game form (input/submit) to be disabled or enabled
function setFormDisabledTo(bool) {
    playerInput.disabled = bool;
    if (submitButton) {
        submitButton.disabled = bool;
    }
}

// determine which key/keys have been pressed and enact response
function processKeyboardInput(e) {
    if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        adjustPromptSelectionLeft();
    } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        adjustPromptSelectionRight();
    }
}

// start prompt selection one index to the left (or cycle to last index)
function adjustPromptSelectionLeft() {
    if (!selectedPromptText || selectedPromptText === availablePromptText) {
        selectPromptLetters(availablePromptText.length - 1);
    } else {
        let selectionStartIndex = availablePromptText.length - selectedPromptText.length - 1;
        selectPromptLetters(selectionStartIndex);
    }
}

// start prompt selection one index to the right (or cycle to first index)
function adjustPromptSelectionRight() {
    if (!selectedPromptText || selectedPromptText.length === 1) {
        selectPromptLetters(0);
    } else {
        let selectionStartIndex = availablePromptText.length - selectedPromptText.length + 1;
        selectPromptLetters(selectionStartIndex);
    }
}

// get voice for TTS
function getVoice() {
    let voices = window.speechSynthesis.getVoices();
    for (const voiceEntry of voices) {
        if (voiceEntry.name === 'Daniel') {
            voice = voiceEntry;
        }
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = getVoice;
    }
}

// have TTS voice read frankenword
function readFrankenword() {
    if (event) {
        event.preventDefault();
    }
    const utterThis = new SpeechSynthesisUtterance(frankenword.textContent);
    utterThis.voice = voice;
    utterThis.pitch = 1;
    utterThis.rate = 1;
    synth.speak(utterThis);
}

// activate/deactivate auto-reading on submit
function toggleVoiceActive() {
    isVoiceActive = !isVoiceActive;
    voiceToggleButton.textContent = isVoiceActive ? 'Voice On' : 'Voice Off';
    isVoiceActive ? voiceToggleButton.classList.add('engaged') : voiceToggleButton.classList.remove('engaged');
}

// resize input field to min size (incl placeholder) or exact sie of text
function resizeInput() {
    let minInputSize = playerInput.placeholder ? playerInput.placeholder.length : 7;
    let inputSize = Math.max(playerInput.value.length, minInputSize);
    playerInput.setAttribute('size', inputSize);
}

// set the popup message span to 
function setPopupVisibleTo(bool) {
    if (bool) {
        popup.classList.contains('show') ? null : popup.classList.add('show');
    } else {
        popup.classList.contains('show') ? popup.classList.remove('show') : null;
        popup.dataset.type = "";
    }
}

// display popup on screen
function displayPopup(popupType, rejectReason = 'default') {
    // ignore call if popup already on display
    if (popup.classList.contains('show') && popup.dataset.type === popupType) {
        if (popupType !== 'wordRejected' || popup.textContent === rejectReason) {
            return;
        }
    }

    // if (popupType === 'wordRejected' && popup.textContent === rejectReason && popup.classList.contains('show')) {
    //     return;
    // } else if (popup.dataset.type === popupType && popup.classList.contains('show')) {
    //     return;
    // }

    let container;
    let message;
    let timeoutDuration;

    switch (popupType) {
        case 'controls':
            container = controlsPopupContainer;
            message = 'press Shift ←/→'
            break;
        case 'unusablePrompt':
            container = promptUnusable;
            message = 'cannot use first letter!'
            timeoutDuration = 5;
            break;
        case 'wordRejected':
            container = promptAndInputContainer;
            message = rejectReason;
            timeoutDuration = 7;
            break;
        case 'newRound':
            container = promptAndInputContainer;
            message = `Round ${round} of ${roundLimit}`;
            timeoutDuration = 7;
            break;
        default:
            console.error('tried to display unlisted popup');
            return;
    }


    clearTimeout(popupTimeout);
    popup.textContent = message;
    popup.dataset.type = popupType;

    container.appendChild(popup);
    setPopupVisibleTo(true);
    timeoutDuration ? popupTimeout = setTimeout(() => setPopupVisibleTo(false), timeoutDuration * 1000) : null;
}

// display overlay of [type] to screen (create if not already existant)
function displayOverlay(type) {
    const overlayDiv = document.getElementById('overlay') ||  document.createElement('div');
    overlayDiv.id = 'overlay';
    overlayDiv.style.display = 'block';
    addContentToOverlay(overlayDiv, type);
    document.body.appendChild(overlayDiv);
}

// hide screen overlay
function hideOverlay() {
    const overlayDiv = document.getElementById('overlay');
    overlayDiv ? overlayDiv.style.display = 'none' : null;
    overlayDiv ? overlayDiv.innerHTML = "" : null;
}

// remove all ids from object and children (for use after cloning a node)
function removeAllIds(node) {
    node.id ? node.removeAttribute('id') : null;
    node.children ? [...node.children].forEach(child => removeAllIds(child)) : null;
}

//#endregion


//#region NOT IN USE ----------------------------------------------------
//-----------------------------------------------------------------------


// WHY NOT IN USE: no longer allowing total deselect of prompt
// // set usable prompt text back to default font styling
// function deselectPromptLetters() {
//     selectedPromptText = "";

//     for (let i = 0; i < availablePromptText.length; i++) {
//         promptUsable.children[i].className = "";
//     }
// }

// // WHY NOT IN USE: player prompt selection means only one word needs to be tested, not all possible from input
// // test player's answer (returns dictionary entry or alerts to try again)
// function testWord() {
//     // declare an array to contain all fetch (GET) promises
//     const promisesArray = [];
//    
//     // test each possible combination of prompt letters and player input, starting with the second letter
//     for (i = 0; i < availablePromptText.length; i++) {
//         // get this word to test
//         const testWord = availablePromptText.slice(i) + playerInput.value;
//        
//         // add the Promise reference to the promises array
//         promisesArray.push(getWord(testWord));
//     }
//
//     // return the first (& therefore longest) existing (truthy) result from the returned words array
//     return Promise.all(promisesArray)
//     .then(returnedWords => {
//         console.log(returnedWords);
//         return returnedWords.find(x => !!x)});
// }

// // WHY NOT IN USE: makes too many Get Calls, hits API limit. Replaced with manual player prompt selection
//
// // when user types in input field, prompt text will highlight if input makes a valid solution
// playerInput.addEventListener('input', autoHighlightPrompt)
//
// // automatically highlights portion of prompt that creates a valid solution with user input
// function autoHighlightPrompt() {
//     let promptText = availablePromptText
//
//     // if there is currently input from the player
//     if (playerInput.value) {
//         testWord()
//         .then( wordEntry => {
//             // if a valid word entry was found in the API...
//             if (wordEntry) {
//                 // get used and unused strings from prompt...
//                 let usedLength = wordEntry[0].word.length - playerInput.value.length;
//                 let usedPrompt = wordEntry[0].word.slice(0, usedLength);
//                 let unusedLength = availablePromptText.length - usedLength;
//                 let unusedPrompt = availablePromptText.slice(0,unusedLength);
//
//                 // and assign to appropriate styled spans
//                 promptNeutralText.textContent = "";
//                 promptDimText.textContent = unusedPrompt;
//                 promptLitText.textContent = usedPrompt;
//  
//             // if input did not yield a valid entry in the API...
//             } else {
//                 // place all prompt text in second, greyed-out, span
//                 promptNeutralText.textContent = "";
//                 promptDimText.textContent = promptText;
//                 promptLitText.textContent = "";
//             }
//         })
//
//     // if the input field is currently blank
//     } else {
//         // all prompt text in first, unstyled, span
//         promptUsable.children[0].textContent = promptText;
//         promptUsable.children[1].textContent = ""
//         promptUsable.children[2].textContent = "";
//     }
// }

//#endregion


//#region FUNCTIONS - IN-PROGRESS ---------------------------------------
//-----------------------------------------------------------------------
// reset page for new game
function resetGame() {
    resetScorecards();
    currentPlayer = 1;
    round = 1;
    isGameOver = false;
    hideOverlay();

    getRandomWord()
    .then(word => {
        setPromptTo(word);
        frankenword.textContent = word;
        wordsPlayedThisGame.length = 0;
        suffixesUsedThisGame.length = 0;
        isVoiceActive ? readFrankenword() : null;
        playerInput.removeAttribute('placeholder');
        resizeInput();
        setFormDisabledTo(false);
        
    })
}



// alert that prompt selection is unusable
function instructUnusablePrompt(e) {
    if (e.target.id !== 'prompt-unusable') {
        return;
    }
    flashTextRed(promptUnusable);
    displayPopup('unusablePrompt');
}

// retrieve score for word based on current selected prompt and input
function getScoreForCurrentWord() {
    let promptPoints = selectedPromptText.length * pointsPerPromptLetter;
    let inputPoints = playerInput.value.length * pointsPerInputLetter;

    return promptPoints + inputPoints;
}
// cycle player turn
function cyclePlayerTurn() {
    currentPlayer === 1 ? currentPlayer = 2 : currentPlayer = 1
    currentPlayer === 1 ? cycleGameRound() : null;
}

// cycle game round
function cycleGameRound() {
    if (round < roundLimit) {
        round++;
        displayPopup('newRound');
    } else {
        setGameOver();
    }   
}

function setGameOver() {
    isGameOver = true;
    displayOverlay('gameOver')
}

// add player 1 word to player 1 scorecard
function player1Submit() {
    let player1Submit = document.createElement('li');
    player1Submit.textContent = getScoreForCurrentWord() + ' - ' + selectedPromptText + playerInput.value;
    player1Submit.className = "player-1-submit";
    player1Score.appendChild(player1Submit);
}

// add player 2 word to player 2 scorecard
function player2Submit() {
    let player2Submit = document.createElement('li');
    player2Submit.textContent = getScoreForCurrentWord() + ' - ' + selectedPromptText + playerInput.value;
    player2Submit.className = "player-2-submit";
    player2Score.appendChild(player2Submit);   
}

// add player 1 score to player 1 total
function player1TotalScore() {
    player1Points += getScoreForCurrentWord();
    player1Total.textContent = player1Points.toString();
}

// add player 2 score to player 2 total
function player2TotalScore() {
    player2Points += getScoreForCurrentWord();
    player2Total.textContent = player2Points.toString();
}

// randomize starting word
function getRandomWord() {
    return fetch(`https://random-word-api.herokuapp.com/word?swear=0`)
    .then( res => res.json())
    .then( data => data[0])
    .catch( error => console.log(error.message));
}

// populate content to a given overlay based on type
function addContentToOverlay(overlay, type) {
    let h1 = document.createElement('h1');
    let button = document.createElement('button');

    switch (type) {
        case 'gameOver':
            let worderby = document.createElement('div');
            let h2 = document.createElement('h2');
            let finalScores = document.getElementById('scorecards').cloneNode(true);

            h1.textContent = `Player ${player1Points > player2Points ? '1' : '2'} Wins!`;
            worderby.classList.add('worderby');
            worderby.textContent = frankenword.textContent;
            worderby.addEventListener('click', readFrankenword);
            button.textContent = 'Start New Game';
            button.addEventListener('click', resetGame);
            h2.textContent = 'Final Scores:';
            removeAllIds(finalScores);

            overlay.append(h1, worderby, button, h2, finalScores);
            break;
    
        case 'rules':
            h1.textContent = 'How to Play';
            button.textContent = "Close";
            button.addEventListener('click', hideOverlay);
            let basicsHeader = document.createElement('h3');
            basicsHeader.textContent = 'Basics';
            let rulesHeader = document.createElement('h3');
            rulesHeader.textContent = 'Rules';
            let scoringHeader = document.createElement('h3');
            scoringHeader.textContent = 'Scoring';
            let coreRuleSection = createListFromArray(coreRules);
            let pointsRuleSection = createListFromArray(pointsRules);
            let wordRuleSection = createListFromArray(wordRules);
            // let restrictionStrings = restrictedSuffixes.map(suffix => `-${suffix}`);
            // let restrictionsList = createListFromArray(restrictionStrings);
            // wordRuleSection.appendChild(restrictionsList);

            overlay.append(h1, basicsHeader, coreRuleSection, scoringHeader, pointsRuleSection, rulesHeader, wordRuleSection, button);
            break;

        default:
            h1.textContent = 'Pause'
            button.textContent = 'Back to Game';
            button.addEventListener('click', hideOverlay);

            overlay.append(h1, button);
            break;
    }
}

function createListFromArray(array) {
    let ul = document.createElement('ul');
    for (const item of array) {
        let li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
    }
    return ul;
}

// clears player scorecards and score totals upon clicking new game button

function resetScorecards() {
    while (player1Score.hasChildNodes()) {
        player1Score.removeChild(player1Score.firstChild);
    }
    while (player2Score.hasChildNodes()) {
        player2Score.removeChild(player2Score.firstChild);
    }
    player1Total.textContent = '0';
    player2Total.textContent = '0';
    player1Points = 0;
    player2Points = 0;
}

function toggleFooterExpand() {
    footer.classList.toggle('expand');
    expandButton.textContent = expandButton.textContent === "Expand" ? "Collapse" : "Expand";
}

function wordAllowed(wordEntry) {
    if (wordsPlayedThisGame.includes(wordEntry[0].word)) {
        rejectReason = "word already used!"
        return false;
    }
    return true
}

// async function wordAllowed(wordEntry) {
//     if (wordsPlayedThisGame.includes(wordEntry[0].word)) {
//         rejectReason = "word already used!"
//         return false;
//     }

//     let usedSuffix = await suffixAlreadyUsed(wordEntry);

//     if (usedSuffix) {
//         console.log(`${wordEntry[0].word} ends in suffix chars`);
//         return false;
//     } else {
//         console.log('word permitted');
//         return true;
//     }
// }

async function suffixAlreadyUsed(wordEntry) {
    console.log(`testing ${wordEntry[0].word} for suffix chars`);
    for (const suffix of restrictedSuffixes) {
        console.log(`testing ${suffix}`);
        if (wordEntry[0].word.endsWith(suffix)) {

            let wordWithoutSuffix = wordEntry[0].word.slice(0, suffix.length * -1);

            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordWithoutSuffix}`)

            const data = await response.json();

            for (let i = 0; i < wordEntry[0].meanings[0].definitions.length; i++) {
                let comparisonDefinition = wordEntry[0].meanings[0].definitions[i].definition;

                // loop through data entries
                for (let i = 0; i < data.length; i++) {
                    let entry = data[i];
    
                    // loop through meanings
                    for (let j = 0; j < entry.meanings.length; j++) {
                        let meaning = entry.meanings[j];
    
                        // loop through definitions
                        for (let k = 0; k < meaning.definitions.length; k++) {
                            let definition = meaning.definitions[k].definition;
                            let match = definition === comparisonDefinition;
    
                            if (match) {
                                console.log(suffixesUsedThisGame);

                                if (suffixesUsedThisGame.includes(suffix)) {
                                    rejectReason = `-${suffix} suffix already played!`
                                    return true;
                                }

                                suffixesUsedThisGame.push(suffix);
                                console.log(suffixesUsedThisGame);
                                return false;
                            }
                        }
    
                    }
                }
            }
            return false;
        }
    }
    return false;
}

//#endregion