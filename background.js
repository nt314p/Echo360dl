chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.url) return;
    if (tab.url.indexOf("https://echo360.ca/lesson/") == -1) return;

    if (changeInfo.status != 'complete') return;
    if (!tab.active) return;

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: injectSettingsClickEvent
    });
});

function injectSettingsClickEvent() {
    let optionTag = (value) => `<option value="${value}">${value}</option>`;
    let getSettingsMenu = () => document.querySelector('div.video-menu.settings-menu');

    let injectSpeedOptions = (settingsMenu) => {
        let speedSelect = document.getElementById("speed-select");

        if (settingsMenu.savedValue == null) {
            // We use a property on the menu to persist the value
            // For some reason it resets to 0.5 if a custom speed is selected
            settingsMenu.savedValue = speedSelect.value;
        }

        let currentValue = settingsMenu.savedValue;

        speedSelect.innerHTML += optionTag(2.25);
        speedSelect.innerHTML += optionTag(2.5);
        speedSelect.innerHTML += optionTag(2.75);
        speedSelect.innerHTML += optionTag(3);
        speedSelect.value = currentValue;

        // Update the property on settingsMenu to persist the selected value
        speedSelect.addEventListener("change", () => {
            let settingsMenu = getSettingsMenu();
            settingsMenu.savedValue = speedSelect.value;
        });
    }

    let settingsMenu = getSettingsMenu();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // The settingsMenu has two children when open, only one when closed
            if (mutation.target.children.length < 2) return;
            injectSpeedOptions(settingsMenu); // Inject options when the menu is open
        });
    });

    observer.observe(settingsMenu, { childList: true });
}