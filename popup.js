const videoTitle = document.getElementById('videoTitle');
const status = document.getElementById('status');
const message = document.getElementById('message');

const ffmpeg = require("ffmpeg.js/ffmpeg-mp4.js");

(async function initPopupWindow() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url.indexOf("https://echo360.ca/lesson/") == -1) {
        setStatus("Warning");
        setMessage("The webpage URL is not suitable. Are you viewing the video?");
        return;
    }

    let cookie = await chrome.cookies.get({ name: "ECHO_JWT", url: "https://echo360.ca" });

    if (cookie == null) {
        setStatus("Error");
        setMessage("Unable to find authentication cookie. Are you logged in?");
        return;
    }

    let videoTitleResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getVideoTitle
    });

    let title = videoTitleResult[0].result;
    setVideoTitle(title);
    title = title.replace(".", "-");
    title = title.replaceAll("[\\\\/:*?\"<>|]", "");
    title += ".mp4"

    let baseUrlResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getBaseUrl
    });

    let baseUrl = baseUrlResult[0].result;

    let audioUrl = baseUrl + "s0q1.m4s";
    let videoUrl = baseUrl + "s1q1.m4s";

    let downloadCallback = (progress, total) => {
        setMessage(progressString(progress, total));
    };

    setStatus("Downloading audio...");
    let audioData = await downloadUrl(audioUrl, downloadCallback);

    setStatus("Downloading video...");
    let videoData = await downloadUrl(videoUrl, downloadCallback);

    setStatus("Merging audio and video...");
    setMessage("Almost there!");

    await sleep(50);

    let stdout = "";
    let stderr = "";

    const result = ffmpeg({
        MEMFS: [
            { name: "s0q1.m4s", data: audioData },
            { name: "s1q1.m4s", data: videoData },
        ],
        // ffmpeg -i s1q1.m4s -i s0q1.m4s -c:v copy -c:a copy out.mp4
        arguments: ["-i", "s1q1.m4s", "-i", "s0q1.m4s", "-c:v", "copy", "-c:a", "copy", "out.mp4"],
        print: data => { stdout += data + "\n"; },
        printErr: data => {stderr += data + "\n";},
        onExit: (code) => {
            console.log("Process exited with code " + code);
            console.log(stdout);
            console.log(stderr);
        }
    });

    setStatus("Complete!");
    setMessage("");

    const out = result.MEMFS[0];
    var blob = new Blob([out.data], { type: "video/mp4" });
    var url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: title
    });
})();

function getBaseUrl() {
    const video = document.getElementById('Video 1')
    let baseUrl = video['poster'];
    baseUrl = baseUrl.replace("https://thumbnails.echo360.ca/", "https://content.echo360.ca/");
    baseUrl = baseUrl.replace("poster1.jpg", "");
    return baseUrl;
}

function getVideoTitle() {
    return document.querySelector("a[data-tooltip='Class list']").innerHTML;
}

async function downloadUrl(url, callback) {
    var response = await fetch(url);
    const responseLength = response.headers.get('content-length');
    const total = parseInt(responseLength);
    let progress = 0;
    let chunks = [];
    const reader = response.body.getReader();
    for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        progress += value.byteLength;
        chunks.push(value);
        callback(progress, total);
    }

    let chunksAll = new Uint8Array(progress);
    let position = 0;
    for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
    }
    return chunksAll;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function setStatus(s) { status.innerHTML = s; }
function setMessage(m) { message.innerHTML = m; }
function setVideoTitle(t) { videoTitle.innerHTML = "Title: " + t; }
function progressString(progress, total) {
    return "Progress: " + Math.round(progress / total * 10000) / 100 + "%";
}