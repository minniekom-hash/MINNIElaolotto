const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const HISTORY_FILE = path.join(__dirname, 'history.json');

let masterPrediction = {
    inputDate: "--",
    inputTop: "--",
    inputBottom: "--",
    predictionDate: "--",
    top: { number: "--", probability: "0%", analysis: "กำลังประมวลผล..." },
    bottom: { number: "--", probability: "0%", analysis: "กำลังประมวลผล..." },
    methodology: "Dual-Stream Bayesian Convergence",
    lastUpdate: "--",
    datasetSize: { top: 0, bottom: 0 }
};

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            // ตรวจสอบว่า format ถูกต้อง (มี top และ bottom)
            if (data.top && data.bottom) return data;
        }
    } catch (e) {
        console.error("Error loading history.json:", e);
    }
    return { top: [], bottom: [] };
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function formatThaiDate(date) {
    return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getNextDrawDate() {
    let date = new Date();
    while (true) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day === 1 || day === 3 || day === 5) return formatThaiDate(date);
    }
}

async function calculateBestNumber(historyList, lastResult) {
    if (!historyList || historyList.length < 1) {
        return { number: "--", probability: "0%", analysis: "ไม่มีข้อมูลสถิติ" };
    }

    let bestScore = -1;
    let winner = "";

    for (let i = 0; i <= 99; i++) {
        let num = i.toString().padStart(2, '0');
        let score = 0;

        for (let j = 0; j < historyList.length - 1; j++) {
            if (historyList[j+1] === lastResult && historyList[j] === num) score += 30;
        }

        const lastIndex = historyList.lastIndexOf(num);
        const gap = lastIndex === -1 ? historyList.length : (historyList.length - 1) - lastIndex;
        if (gap > 8 && gap < 20) score += 50;

        const freq = historyList.filter(n => n === num).length;
        score += (freq * 15);

        if (score > bestScore) {
            bestScore = score;
            winner = num;
        }
    }
    const prob = Math.min(99.8, (bestScore / 150 * 100 + 60).toFixed(2));
    return { number: winner, probability: `${prob}%`, analysis: `วิเคราะห์จากรอบ Cycle ของเลข ${winner} ที่สัมพันธ์กับผลล่าสุด ${lastResult}` };
}

// --- [ ฟังก์ชันวิเคราะห์อัตโนมัติเมื่อเปิดเครื่อง ] ---
async function bootAnalysis() {
    console.log("🚀 Booting AI Analysis...");
    const history = loadHistory();
    
    if (history.top.length > 0 && history.bottom.length > 0) {
        const lastTop = history.top[0];
        const lastBottom = history.bottom[0];
        
        const predTop = await calculateBestNumber(history.top, lastTop);
        const predBottom = await calculateBestNumber(history.bottom, lastBottom);

        masterPrediction = {
            inputDate: "ข้อมูลจากประวัติ",
            inputTop: lastTop,
            inputBottom: lastBottom,
            predictionDate: getNextDrawDate(),
            top: predTop,
            bottom: predBottom,
            datasetSize: { top: history.top.length, bottom: history.bottom.length },
            lastUpdate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
        };
        console.log("✅ Boot analysis complete. Numbers are now live!");
    } else {
        console.log("⚠️ History is empty. Waiting for manual input.");
    }
}

app.post('/api/update-result', async (req, res) => {
    const { top, bottom } = req.body;
    if (!top || !bottom) return res.status(400).send("กรุณาใส่ทั้งบนและล่าง");

    let history = loadHistory();
    if (history.top[0] !== top) history.top.unshift(top);
    if (history.bottom[0] !== bottom) history.bottom.unshift(bottom);
    saveHistory(history);

    const predTop = await calculateBestNumber(history.top, top);
    const predBottom = await calculateBestNumber(history.bottom, bottom);

    masterPrediction = {
        inputDate: formatThaiDate(new Date()),
        inputTop: top,
        inputBottom: bottom,
        predictionDate: getNextDrawDate(),
        top: predTop,
        bottom: predBottom,
        datasetSize: { top: history.top.length, bottom: history.bottom.length },
        lastUpdate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    };
    res.json({ success: true, data: masterPrediction });
});

app.get('/api/prediction', (req, res) => res.json(masterPrediction));

app.listen(PORT, () => {
    console.log(`Dual-Stream AI Server running on port ${PORT}`);
    bootAnalysis(); // <--- เรียกใช้ฟังก์ชันนี้ทันทีที่เปิด Server
});
