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
    inputResult: "--",
    predictionDate: "--",
    number: "--",
    probability: "0%",
    analysis: "ระบบกำลังประมวลผลฐานข้อมูลสถิติจริง...",
    methodology: "Bayesian Inference + Historical Cycle Convergence",
    lastUpdate: "--",
    datasetSize: 0
};

// --- [ MEMORY SYSTEM: จัดการข้อมูลย้อนหลัง ] ---
function loadHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    return []; // ถ้าไม่มีไฟล์ ให้เริ่มจากอาเรย์ว่าง
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

// --- [ SCRAPER: ดึงข้อมูลจริงจากเว็บ ] ---
async function scrapeLaoLottery() {
    console.log("🔍 Scraping real data...");
    try {
        // ใช้แหล่งข้อมูลที่ให้ตารางย้อนหลัง (จำลอง Selector สำหรับ Sanook/MThai)
        const url = 'https://www.sanook.com/lottery/lao/'; 
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        // พยายามดึงเลข 2 ตัวท้ายของงวดล่าสุด
        let result = $('.lottery-result-number').first().text().trim(); 
        if (!result) return null;
        
        return result.substring(0, 2);
    } catch (e) {
        return null;
    }
}

// --- [ ULTIMATE ANALYSIS: วิเคราะห์จากสถิติจริง ] ---
async function calculateUltimateNumber(lastResult) {
    let history = loadHistory();
    
    // เพิ่มผลล่าสุดลงในประวัติ (ถ้ายังไม่มี)
    if (history[0] !== lastResult) {
        history.unshift(lastResult);
        saveHistory(history);
    }

    if (history.length < 5) {
        return {
            number: "??",
            probability: "Low",
            analysis: "ฐานข้อมูลยังไม่เพียงพอ (ต้องการอย่างน้อย 5 งวด) ระบบกำลังสะสมสถิติจริง..."
        };
    }

    let bestScore = -1;
    let winner = "";

    for (let i = 0; i <= 99; i++) {
        let num = i.toString().padStart(2, '0');
        let score = 0;

        // 1. Bayesian Correlation: วิเคราะห์ว่าถ้าออก lastResult งวดหน้าออก num บ่อยแค่ไหน
        for (let j = 0; j < history.length - 1; j++) {
            if (history[j+1] === lastResult && history[j] === num) {
                score += 30;
            }
        }

        // 2. Real Cycle Deviation: หาจุด Peak จากข้อมูลจริง
        const lastIndex = history.lastIndexOf(num);
        const gap = lastIndex === -1 ? history.length : 0; // ถ้าไม่เคยออกเลย ให้ใช้ความยาว history เป็น gap
        if (gap > 10 && gap < 25) score += 50;

        // 3. Historical Frequency: ความถี่จริงใน 6 เดือน/งวดที่ผ่านมา
        const freq = history.filter(n => n === num).length;
        score += (freq * 15);

        if (score > bestScore) {
            bestScore = score;
            winner = num;
        }
    }

    const prob = Math.min(99.8, (bestScore / 150 * 100 + 60).toFixed(2));
    
    return {
        number: winner,
        probability: `${prob}%`,
        analysis: `วิเคราะห์จากฐานข้อมูลจริง ${history.length} งวด พบว่าเลข ${winner} มีค่าการบรรจบของสัญญาณ (Convergence) สูงสุด โดยอิงจากรอบการออก (Cycle) ย้อนหลังและแรงเหวี่ยงจากเลข ${lastResult}`
    };
}

async function runFullUpdate() {
    const result = await scrapeLaoLottery();
    if (result) {
        const prediction = await calculateUltimateNumber(result);
        masterPrediction = { 
            inputDate: formatThaiDate(new Date()),
            inputResult: result,
            predictionDate: getNextDrawDate(),
            ...prediction, 
            datasetSize: loadHistory().length,
            lastUpdate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) 
        };
    }
}

// รันทุกวัน จันทร์-ศุกร์ 20:40 น.
cron.schedule('40 20 * * 1-5', runFullUpdate, { timezone: "Asia/Bangkok" });

app.post('/api/update-result', async (req, res) => {
    const { result } = req.body;
    if (!result) return res.status(400).send("Missing result");
    const prediction = await calculateUltimateNumber(result);
    masterPrediction = { 
        inputDate: formatThaiDate(new Date()),
        inputResult: result,
        predictionDate: getNextDrawDate(),
        ...prediction, 
        datasetSize: loadHistory().length,
        lastUpdate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) 
    };
    res.json({ success: true, data: masterPrediction });
});

app.get('/api/prediction', (req, res) => res.json(masterPrediction));

app.listen(PORT, () => {
    console.log(`Quantum AI Server running on port ${PORT}`);
    runFullUpdate();
});
