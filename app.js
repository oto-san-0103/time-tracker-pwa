document.addEventListener('DOMContentLoaded', () => {
    // 1. Service Workerの登録 (PWAのオフライン機能に必須)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('SW registered: ', registration.scope))
                .catch(err => console.log('SW registration failed: ', err));
        });
    }

    // 2. ページ表示時に既存データを読み込み、グラフとテーブルを更新
    loadAndRenderData();

    // 3. 記録ボタンのイベントリスナー
    document.getElementById('save-button').addEventListener('click', saveRecord);
    
    // 4. CSVエクスポートボタンのイベントリスナー
    document.getElementById('export-csv-button').addEventListener('click', exportToCsv);

    // 5. 現在時刻のボタンのイベントリスナー
    document.querySelectorAll('.now-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const targetInput = document.getElementById(targetId);
            const now = new Date();

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');

            targetInput.value =
                `${year}-${month}-${day}T${hours}:${minutes}`;
        });
    });

    // タブ切り替え
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.tab;

            document.querySelectorAll('.tab-button').forEach(tabButton => {
                tabButton.classList.remove('active');
            });

            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });

            button.classList.add('active');
            document.getElementById(targetTabId).classList.add('active');

            // レポートタブを開いたときにグラフを再描画
            if (targetTabId === 'report-tab') {
                loadAndRenderData();
            }
        });
    });

    // 設定の読み込み
    const defaultBreakMinutes =
        localStorage.getItem('defaultBreakMinutes') || '60';

    document.getElementById('default-break-minutes').value =
        defaultBreakMinutes;

    document.getElementById('break-minutes').value =
        defaultBreakMinutes;

    // 設定の保存
    document.getElementById('save-settings-button').addEventListener('click', () => {
        const value = document.getElementById('default-break-minutes').value || '0';

        localStorage.setItem('defaultBreakMinutes', value);
        document.getElementById('break-minutes').value = value;
        document.getElementById('settings-message').textContent =
            '設定を保存しました。';
    });

    // 月の選択肢の初期化
    loadMonthOptions();
});

/**
 * 勤務記録をlocalStorageから取得する
 * @returns {Array} 勤務記録の配列
 */
function getRecords() {
    const json = localStorage.getItem('workRecords');
    return json ? JSON.parse(json) : [];
}

/**
 * 勤務記録をlocalStorageに保存する
 * @param {Array} records - 勤務記録の配列
 */
function saveRecords(records) {
    localStorage.setItem('workRecords', JSON.stringify(records));
}

// 記録の保存・計算処理（Chrome拡張機能のロジックと同様）
function saveRecord() {
    const startDateTimeStr =
        document.getElementById('start-datetime').value;
    const endDateTimeStr =
        document.getElementById('end-datetime').value;
    const breakMinutes =
        parseInt(document.getElementById('break-minutes').value, 10) || 0;

    if (!startDateTimeStr || !endDateTimeStr) {
        alert('開始日時と終了日時を入力してください。');
        return;
    }

    const start = new Date(startDateTimeStr);
    const end = new Date(endDateTimeStr);

    if (end <= start) {
        alert('終了日時は開始日時より後にしてください。');
        return;
    }

    const workTimeMs = end - start;
    const breakTimeMs = breakMinutes * 60 * 1000;
    const actualWorkMs = workTimeMs - breakTimeMs;

    const totalMinutes = Math.floor(actualWorkMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const workDuration = `${hours}時間 ${minutes}分`;

    const dateStr = startDateTimeStr.slice(0, 10);
    const startTimeStr = startDateTimeStr.slice(11, 16);
    const endTimeStr = endDateTimeStr.slice(11, 16);

    const newRecord = {
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        startDateTime: startDateTimeStr,
        endDateTime: endDateTimeStr,
        breakMinutes,
        options,
        workDuration,
        timestamp: Date.now()
    };

    const records = getRecords();

    const existingRecordIndex = records.findIndex(
        record => record.date === dateStr
    );

    if (existingRecordIndex !== -1) {
        records[existingRecordIndex] = newRecord;
    } else {
        records.push(newRecord);
    }

    saveRecords(records);
    loadMonthOptions();
    loadAndRenderData();

    const message = existingRecordIndex !== -1
        ? '記録を上書きしました'
        : '記録を追加しました';

    document.getElementById('result-display').textContent =
        `${message} 稼働時間: ${workDuration}`;
}


// グラフ描画、CSVエクスポートのロジック（前回の内容から流用）
function loadAndRenderData() {
    const records = getRecords();
    const chart = document.getElementById('workTimeChart');
    const emptyMessage = document.getElementById('chart-empty-message');

    if (records.length > 0) {
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        chart.style.display = 'block';
        emptyMessage.style.display = 'none';

        drawChart(records);
        renderTable(records);
    } else {
        chart.style.display = 'none';
        emptyMessage.style.display = 'block';

        document.getElementById('records-table').style.display = 'none';
    }
}

// グラフ描画関数 (前回の内容と同様)
function drawChart(records) {
    // グラフ描画ロジックは前回の options.js と同様
    const dates = records.map(r => r.date);
    const workMinutes = records.map(r => {
        const match = r.workDuration.match(/(\d+)時間 (\d+)分/);
        return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    });

    const ctx = document.getElementById('workTimeChart').getContext('2d');
    
    // 既存のChartインスタンスがあれば破棄する（更新のため）
    if (window.workTimeChartInstance) {
        window.workTimeChartInstance.destroy();
    }

    window.workTimeChartInstance = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: dates, 
            datasets: [{
                label: '稼働時間 (分)',
                data: workMinutes,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 15,
                        callback: (value) => value % 60 === 0 ? `${value}分` : ''
                    },
                    grid: {
                        color: (context) => context.tick.value % 60 === 0
                            ? 'rgba(0, 0, 0, 0.25)'
                            : 'rgba(0, 0, 0, 0.1)',
                        lineWidth: (context) => context.tick.value % 60 === 0 ? 1.5 : 1
                    },
                    title: { display: true, text: '稼働時間 (分)' }
                }
            }
        }
    });
}

// データテーブル表示関数
function renderTable(records) {
    const tableBody = document.querySelector('#records-table tbody');
    tableBody.innerHTML = ''; // テーブルをクリア

    // 新しい順に表示するため、レコードを反転
    [...records].reverse().forEach(record => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = record.date;
        row.insertCell().textContent = record.startTime;
        row.insertCell().textContent = record.endTime;
        row.insertCell().textContent = record.breakMinutes;
        row.insertCell().textContent = (record.options || []).join('、');
        row.insertCell().textContent = record.workDuration;
    });
    document.getElementById('records-table').style.display = 'table';
}


// CSVエクスポート関数 (前回の内容と同様)
function exportToCsv() {
    const records = getRecords();
    if (records.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
    }

    let csvContent = "日付,勤務開始時間,勤務終了時間,休憩時間(分),勤務区分,稼働時間\n";
    records.forEach(record => {
        const row = [
            record.date,
            record.startTime,
            record.endTime,
            record.breakMinutes,
            `"${(record.options || []).join('、')}"`,
            record.workDuration
        ].join(',');

        csvContent += row + "\n";
    });

    const BOM = "\uFEFF"; 
    const finalCsv = BOM + csvContent;

    const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `勤務記録_PWA_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    
    alert('CSVファイルのダウンロードを開始しました。');
}

// 月の選択肢の初期化
function loadMonthOptions() {
    const select = document.getElementById('record-month-select');

    if (!select) {
        return;
    }

    const records = getRecords();

    const months = [...new Set(
        records
            .map(record => record.date.slice(0, 7))
            .sort()
            .reverse()
    )];

    select.innerHTML =
        '<option value="">年月を選択してください</option>';

    months.forEach(month => {
        const option = document.createElement('option');

        option.value = month;
        option.textContent = month.replace('-', '/');

        select.appendChild(option);
    });
}

// 削除ボタンのイベントリスナー
document.getElementById('delete-month-button').addEventListener('click', () => {
    const month = document.getElementById('record-month-select').value;

    if (!month) {
        alert('削除する年月を選択してください。');
        return;
    }

    const displayMonth = month.replace('-', '/');

    if (!confirm(`${displayMonth}の記録をすべて削除しますか？`)) {
        return;
    }

    const records = getRecords();

    const remainingRecords = records.filter(record => {
        return !record.date.startsWith(month);
    });

    saveRecords(remainingRecords);
    loadMonthOptions();
    loadAndRenderData();

    document.getElementById('settings-message').textContent =
        `${displayMonth}の記録を削除しました。`;
});

// 記録の選択肢の初期化
const options = [...document.querySelectorAll(
    'input[name="record-option"]:checked'
)].map(checkbox => checkbox.value);
