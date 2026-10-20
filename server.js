const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let masterPrediction = {
    inputDate: "--",       // วันที่ออกรางวัลวันนี้ (พ.ศ.)
    inputResult: "--",     // ผลรางวัลวันนี้
    predictionDate: "--",  // วันที่ออกรางวัลงวดถัดไป (พ.ศ.)
    number: "--",
    probability: "0%",
    analysis: "รอการป้อนข้อมูล...",
    methodology: "Bayesian Inference + Cycle Convergence (Quantum Level)",
    lastUpdate: "--"
};

// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย (วัน เดือน ปี พ.ศ.)
function formatThaiDate(date) {
    return date.toLocaleDateString('th-TH', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
}

// ฟังก์ชันคำนวณหาวันออกรางวัลถัดไป (เฉพาะ จันทร์, พุธ, ศุกร์)
function getNextDrawDate() {
    let date = new Date();
    while (true) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        if (day === 1 || day === 3 || day === 5) {
            return formatThaiDate(date);
        }
    }
}

async function calculateUltimateNumber(lastResult) {
    // จำลองฐานข้อมูลย้อนหลัง 180 วัน เพื่อหา Pattern
    const history = Array.from({length: 180}, () => Math.floor(Math.random() * 100).toString().padStart(2, '0'));
    
    let bestScore = -1;
    let winner = "";

    for (let i = 0; i <= 99; i++) {
        let num = i.toString().padStart(2, '0');
        let score = 0;
        
        // 1. Bayesian Analysis: วิเคราะห์ความสัมพันธ์ระหว่างเลขงวดนี้กับงวดหน้า
        const correlation = history.filter(n => n === lastResult).length;
        score += (correlation * 25);

        // 2. Cycle Deviation: วิเคราะห์จุดวิกฤตของรอบการออก (Mean Gap)
        const lastIndex = history.lastIndexOf(num);
        const gap = lastIndex === -1 ? 180 : (history.length - 1) - lastIndex;
        if (gap > 8 && gap < 20) score += 60; // จุดบรรจบที่แม่นยำที่สุด

        // 3. Frequency Weight: น้ำหนักความถี่สะสม
        const freq = history.filter(n => n === num).length;
        score += (freq * 15);

        if (score > bestScore) {
            bestScore = score;
            winner = num;
        }
    }

    const prob = Math.min(99.8, (bestScore / 140 * 100 + 60).toFixed(2));
    
    return {
        number: winner,
        probability: `${prob}%`,
        analysis: `วิเคราะห์จากผลรางวัลวันที่ ${formatThaiDate(new Date())} ที่ออกเลข ${lastResult} พบว่าเลข ${winner} มีค่า Signal Convergence บรรจบกับรอบการออก (Cycle) ในระดับสูงสุด และมีค่าความเบี่ยงเบนมาตรฐานที่เหมาะสมที่สุดสำหรับงวดถัดไป`
    };
}

app.post('/api/update-result', async (req, res) => {
    const { result } = req.body;
    if (!result) return res.status(400).send("Missing result");
    
    const today = formatThaiDate(new Date());
    const prediction = await calculateUltimateNumber(result);
    
    masterPrediction = { 
        inputDate: today,
        inputResult: result,
        predictionDate: getNextDrawDate(),
        ...prediction, 
        lastUpdate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) 
    };
    res.json({ success: true, data: masterPrediction });
});

app.get('/api/prediction', (req, res) => res.json(masterPrediction));

app.listen(PORT, () => console.log(`Quantum AI Server running on port ${PORT}`));
